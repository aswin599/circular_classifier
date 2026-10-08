import { JobQueue } from './jobQueue';
import { logger } from '../utils/logger';
import { Circular, Priority, CircularImageSubdoc, AttachmentSubdoc } from '../models/Circular';
import emailProcessor from '../services/emailProcessor';
import textExtractor from '../services/textExtractor';
import { extractAndPersistAttachmentImages } from '../services/imageExtractor';
import classifier from '../services/classifier';
import { detectExpiry } from '../services/expiryDetector';
import { broadcastNewCircular, circularFingerprint } from '../services/circularIngest';
import { cleanCircularSubject } from '../utils/subject';
import { extractSenderNameFromRef, formatRefSenderName } from '../utils/senderName';
import dbConnect from '../config/database';
import { Types } from 'mongoose';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

export interface EmailJobData {
  batchSize?: number;
}

export interface ExtractorJobData {
  circularId: string;
  attachmentId: string;
  filePath: string;
  fileType: string;
}

export interface ClassifierJobData {
  circularId: string;
  extractedText: string;
  subject: string;
}

// Email fetch job processor
export const emailQueue = new JobQueue<EmailJobData>('email-processing', async (jobData) => {
  const batchSize = jobData.batchSize || 50;
  logger.info(`Starting email fetch job (batch: ${batchSize})`);

  await dbConnect();

  await emailProcessor.connect();
  const emails = await emailProcessor.fetchCircularEmails(batchSize);
  await emailProcessor.disconnect();

  logger.info(`Fetched ${emails.length} emails`);

  let savedCount = 0;
  for (const email of emails) {
    const cleanTitle = cleanCircularSubject(email.subject, email.attachmentResults?.[0]?.filename);
    const fingerprint = circularFingerprint({ attachments: email.attachmentResults, bodyText: email.bodyText });

    let existing = await Circular.findOne({ emailMessageId: email.messageId });
    if (!existing && fingerprint) {
      existing = await Circular.findOne({ attachmentHash: fingerprint });
    }
    if (existing) {
      // Same circular re-sent: refresh the received date instead of duplicating
      existing.receivedDate = email.receivedDate;
      existing.subject = cleanTitle;
      await existing.save();
      logger.debug(`Refreshed received date for existing email: ${email.messageId}`);
      continue;
    }

    const circular = await Circular.create({
      emailMessageId: email.messageId,
      attachmentHash: fingerprint || undefined,
      subject: cleanTitle,
      senderEmail: email.senderEmail,
      senderName: formatRefSenderName(extractSenderNameFromRef([cleanTitle, email.bodyText || ''].join('\n'))),
      receivedDate: email.receivedDate,
      bodyText: email.bodyText,
      processingStatus: 'PROCESSING',
      isProcessed: false,
      createdBy: { role: 'SYSTEM', fullName: 'Email Sync' },
      attachments: email.attachmentResults.map((a) => ({
        filename: a.filename,
        fileType: a.fileType,
        fileSize: a.fileSize,
        filePath: a.filePath,
      })),
    });

    const broadcasted = await circular.populate('category');
    await broadcastNewCircular(broadcasted);

    const created = circular.toObject() as unknown as CircularDocumentLike;

    if (created.attachments && created.attachments.length > 0) {
      for (const attachment of created.attachments) {
        extractionQueue.add({
          circularId: circular._id.toString(),
          attachmentId: (attachment as unknown as AttachmentSubdoc)._id
            ? (attachment as unknown as AttachmentSubdoc)._id.toString()
            : '',
          filePath: (attachment as unknown as AttachmentSubdoc).filePath || '',
          fileType: (attachment as unknown as AttachmentSubdoc).fileType,
        });
      }
    } else {
      classificationQueue.add({
        circularId: circular._id.toString(),
        extractedText: email.bodyText || '',
        subject: email.subject,
      });
    }

    savedCount++;
  }

  logger.info(`Saved ${savedCount} new circulars`);
  return { savedCount };
});

interface CircularDocumentLike {
  _id: Types.ObjectId;
  attachments?: Array<Record<string, unknown>>;
}

// Text extraction job processor
export const extractionQueue = new JobQueue<ExtractorJobData>('text-extraction', async (jobData) => {
  const { circularId, attachmentId, filePath, fileType } = jobData;

  logger.info(`Extracting text from attachment: ${attachmentId} for circular ${circularId}`);

  const circular = await Circular.findById(circularId);
  if (!circular) {
    logger.warn(`Circular not found: ${circularId}`);
    return;
  }

  const attachment = circular.attachments.find(
    (att: AttachmentSubdoc) => att._id && att._id.toString() === attachmentId
  );

  if (!attachment) {
    logger.warn(`Attachment not found in circular: ${attachmentId}`);
    return;
  }

  const result = await textExtractor.extract(filePath, fileType);

  attachment.extractedText = result.text;
  attachment.ocrConfidence = result.confidence ?? undefined;
  attachment.isProcessed = true;

  const combined = [circular.extractedText || '', result.text].filter(Boolean).join('\n\n');
  circular.extractedText = combined;

  // Extract the attachment's images alongside the text (PDF page renders,
  // embedded figures, DOCX media). Purely additive.
  try {
    if (attachment._id && filePath && fs.existsSync(filePath)) {
      const destDir = path.join(path.resolve(config.upload.dir), 'extracted');
      const baseName = `${circular._id.toString()}-${attachment._id.toString()}`;
      const { images, primaryThumb } = await extractAndPersistAttachmentImages(
        { filePath, fileType, sourceAttachmentId: attachment._id.toString() },
        destDir,
        baseName,
        attachment._id.toString()
      );

      if (images.length > 0) {
        const existingKeys = new Set((circular.images || []).map((im: CircularImageSubdoc) => `${im.sourceType}-${im.page}-${im.index}`));
        const fresh = images.filter((im) => !existingKeys.has(`${im.sourceType}-${im.page}-${im.index}`));
        circular.images.push(...(fresh as unknown as CircularImageSubdoc[]));
        if (!circular.primaryThumb && primaryThumb) {
          circular.primaryThumb = primaryThumb;
        }
      }
    }
  } catch (err) {
    logger.warn(`Image extraction failed for attachment ${attachmentId}:`, err);
  }

  // Full content is available only after extraction; recompute the sender
  // name from the Ref.No / TCE/ code (never the email sender).
  const fullContent = [circular.subject, combined, circular.bodyText || ''].filter(Boolean).join('\n\n');
  circular.senderName = formatRefSenderName(extractSenderNameFromRef(fullContent));
  const expiryResult = detectExpiry(fullContent);
  if (expiryResult.importantDates && expiryResult.importantDates.length > 0) {
    circular.importantDates = expiryResult.importantDates;
  }
  if (expiryResult.expireDate) {
    circular.expireDate = expiryResult.expireDate;
    circular.expirySource = expiryResult.expirySource;
    circular.expiryConfidence = expiryResult.expiryConfidence;
  }
  if (expiryResult.lastDateWithoutFine) {
    circular.lastDateWithoutFine = expiryResult.lastDateWithoutFine;
  }
  if (expiryResult.lastDateWithFine) {
    circular.lastDateWithFine = expiryResult.lastDateWithFine;
  }

  await circular.save();

  // If all attachments are processed, queue classification
  const pendingAttachments = circular.attachments.some((att: AttachmentSubdoc) => !att.isProcessed);

  if (!pendingAttachments) {
    const fresh = await Circular.findById(circularId);
    classificationQueue.add({
      circularId,
      extractedText: fresh?.extractedText || '',
      subject: fresh?.subject || '',
    });
  }

  return { attachmentId, length: result.text.length };
});

// Classification job processor
export const classificationQueue = new JobQueue<ClassifierJobData>('classification', async (jobData) => {
  const { circularId, extractedText, subject } = jobData;

  logger.info(`Classifying circular: ${circularId}`);

  const circular = await Circular.findById(circularId);
  if (!circular) {
    logger.warn(`Circular not found: ${circularId}`);
    return;
  }

  const bodyText = circular.bodyText || '';
  const combinedText = `${extractedText} ${bodyText}`;

  const result = await classifier.classify(combinedText, subject);

  circular.categoryId = result.categoryId ? new Types.ObjectId(result.categoryId) : undefined;
  circular.priority = result.priority as Priority;
  circular.processingStatus = 'COMPLETED';
  circular.isProcessed = true;
  circular.tags = result.matchedKeywords;

  // Recompute sender name from the full circular text (Ref.No / TCE/ code).
  const fullContent = [circular.subject, circular.bodyText || '', circular.extractedText || ''].join('\n\n');
  circular.senderName = formatRefSenderName(extractSenderNameFromRef(fullContent));

  // Detect expiry / last date from full available text
  const expiryResult = detectExpiry([circular.subject, circular.bodyText || '', circular.extractedText || ''].join('\n\n'));
  if (expiryResult.expireDate) {
    circular.expireDate = expiryResult.expireDate;
    circular.expirySource = expiryResult.expirySource;
    circular.expiryConfidence = expiryResult.expiryConfidence;
  }
  if (expiryResult.lastDateWithoutFine) {
    circular.lastDateWithoutFine = expiryResult.lastDateWithoutFine;
  }
  if (expiryResult.lastDateWithFine) {
    circular.lastDateWithFine = expiryResult.lastDateWithFine;
  }

  await circular.save();

  logger.info(`Circular ${circularId} classified as: ${result.categoryName} (priority: ${result.priority})`);
  return result;
});

// Reprocess all unprocessed circulars (falls back to body text classification)
export async function reprocessUnprocessed(): Promise<number> {
  await dbConnect();

  const unprocessed = await Circular.find({ isProcessed: false }).limit(50);

  for (const circular of unprocessed) {
    const pendingAttachments = circular.attachments.filter((att: AttachmentSubdoc) => !att.isProcessed);

    if (pendingAttachments.length > 0) {
      for (const attachment of pendingAttachments) {
        extractionQueue.add({
          circularId: circular._id.toString(),
          attachmentId: attachment._id ? attachment._id.toString() : '',
          filePath: attachment.filePath,
          fileType: attachment.fileType,
        });
      }
    } else {
      classificationQueue.add({
        circularId: circular._id.toString(),
        extractedText: circular.extractedText || '',
        subject: circular.subject,
      });
    }
  }

  return unprocessed.length;
}

export async function addEmailJob(batchSize?: number): Promise<string> {
  return emailQueue.add({ batchSize });
}

export function getQueueStats() {
  return {
    email: emailQueue.stats,
    extraction: extractionQueue.stats,
    classification: classificationQueue.stats,
  };
}

export default {
  emailQueue,
  extractionQueue,
  classificationQueue,
  addEmailJob,
  reprocessUnprocessed,
  getQueueStats,
};
