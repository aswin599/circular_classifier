import { User, UserDocument } from '../models/User';
import { Circular, Priority } from '../models/Circular';
import { fetchGmailMessages, refreshGoogleAccessToken, GmailMessageSummary, buildCircularSearchQuery } from './googleService';
import { detectExpiry } from './expiryDetector';
import { isCircularEmail } from './circularFilter';
import { textExtractor } from './textExtractor';
import { classifier } from './classifier';
import { logger } from '../utils/logger';
import { extractionQueue } from '../jobs/queue';
import { broadcastNewCircular, circularFingerprint } from './circularIngest';
import { cleanCircularSubject } from '../utils/subject';
import { generateShortTitle, generate3PointerSummary } from '../utils/summaryHelper';
import { extractSenderNameFromRef, formatRefSenderName } from '../utils/senderName';
import fs from 'fs';
import path from 'path';
import { Types } from 'mongoose';
import { config } from '../config';
import { buildImagesForEmail } from './imageExtractor';

export interface GmailImportResult {
  fetched: number;
  circularsFound: number;
  saved: number;
  duplicates: number;
  skippedNonCirculars: number;
  skippedNoToken: boolean;
}

async function getUserWithValidToken(userId: string): Promise<{
  user: UserDocument;
  accessToken: string;
}> {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (!user.googleRefreshToken && !user.googleAccessToken) {
    const err = new Error('No Google tokens available. Please sign in with Google again.') as Error & { code?: string };
    err.code = 'NO_GOOGLE_TOKENS';
    throw err;
  }

  let accessToken = user.googleAccessToken || '';

  // Refresh if expired or missing
  if (
    !accessToken ||
    (user.googleTokenExpiry && user.googleTokenExpiry.getTime() - Date.now() < 5 * 60 * 1000)
  ) {
    if (!user.googleRefreshToken) {
      throw new Error('Google access token expired and no refresh token available');
    }
    const refreshed = await refreshGoogleAccessToken(user.googleRefreshToken);
    accessToken = refreshed.accessToken;
    user.googleAccessToken = refreshed.accessToken;
    user.googleTokenExpiry = refreshed.expiryDate;
    await user.save();
  }

  return { user, accessToken };
}

export async function importCircularsFromGmail(
  userId: string,
  opts: { query?: string; limit?: number } = {}
): Promise<GmailImportResult> {
  const { user, accessToken } = await getUserWithValidToken(userId);

  const query = opts.query || buildCircularSearchQuery();
  const limit = opts.limit || 50;

  const emails: GmailMessageSummary[] = await fetchGmailMessages(accessToken, query, limit);

  logger.info(`Fetched ${emails.length} emails from Gmail for user ${user.email} (query: ${query.slice(0, 120)}...)`);

  let saved = 0;
  let duplicates = 0;
  let skippedNonCirculars = 0;
  let circularsFound = 0;

  for (const email of emails) {
    // 1. Check if email is an official circular
    const check = isCircularEmail({
      subject: email.subject,
      bodyText: email.bodyText,
      senderEmail: email.senderEmail,
      senderName: email.senderName,
      attachments: email.attachments,
    });

    if (!check.isCircular) {
      logger.info(`Skipping non-circular email "${email.subject}": ${check.reason}`);
      skippedNonCirculars++;
      continue;
    }

    circularsFound++;

    const cleanTitle = cleanCircularSubject(email.subject, email.attachments?.[0]?.filename);
    const fingerprint = circularFingerprint(email);

    // 2. Avoid duplicate imports; mark duplicate with date
    let existing = await Circular.findOne({ emailMessageId: email.messageId });
    if (!existing && fingerprint) {
      existing = await Circular.findOne({ attachmentHash: fingerprint });
    }
    if (!existing) {
      existing = await Circular.findOne({ subject: cleanTitle });
    }
    if (existing) {
      const duplicateTag = `Duplicate (${new Date(existing.receivedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
      if (!existing.tags.includes(duplicateTag)) {
        existing.tags.push(duplicateTag);
      }
      existing.isDuplicate = true;
      existing.duplicateOfDate = existing.receivedDate;
      existing.receivedDate = email.receivedDate;
      await existing.save();
      duplicates++;
      continue;
    }

    // 3. Extract text from PDF, DOCX, and text attachments immediately
    const attachmentSubdocs: Array<{
      _id: Types.ObjectId;
      filename: string;
      fileType: string;
      fileSize: number;
      filePath?: string;
      data?: Buffer;
      extractedText?: string;
      isProcessed: boolean;
    }> = [];

    const extractedTexts: string[] = [];
    const pendingOcrAttachments: typeof attachmentSubdocs = [];

    for (const att of email.attachments) {
      const ext = (att.fileType || '').toLowerCase();
      let extractedText: string | undefined = undefined;
      let isProcessed = false;
      const subdocId = new Types.ObjectId();
      att.sourceAttachmentId = subdocId.toString();

      // Extract text directly if PDF, DOCX, or text file
      if (['pdf', 'docx', 'txt'].includes(ext)) {
        try {
          if (att.data) {
            const result = await textExtractor.extractFromBuffer(att.data, ext);
            extractedText = result.text;
            isProcessed = true;
            if (result.text) extractedTexts.push(result.text);
          } else if (att.filePath && fs.existsSync(att.filePath)) {
            const result = await textExtractor.extract(att.filePath, ext);
            extractedText = result.text;
            isProcessed = true;
            if (result.text) extractedTexts.push(result.text);
          }
          if (extractedText) {
            logger.info(`Successfully extracted text from attachment ${att.filename} (${extractedText.length} chars)`);
          }
        } catch (err) {
          logger.warn(`Failed to extract text from attachment ${att.filename}:`, err);
        }
      }

      const subdoc = {
        _id: subdocId,
        filename: att.filename,
        fileType: att.fileType,
        fileSize: att.fileSize,
        filePath: att.filePath,
        data: att.data,
        extractedText,
        isProcessed,
      };

      attachmentSubdocs.push(subdoc);

      // If image, queue for OCR processing in background
      if (!isProcessed && ['png', 'jpg', 'jpeg', 'tif', 'tiff', 'gif', 'bmp'].includes(ext)) {
        pendingOcrAttachments.push(subdoc);
      }
    }

    // Extract images (PDF page renders, embedded figures, DOCX media, inline
    // email pictures). Purely additive; classification/expiry never uses it.
    const imageDestDir = path.join(path.resolve(config.upload.dir), 'extracted');
    const imageBaseName = (email.messageId || cleanTitle || 'circular').replace(/[^a-zA-Z0-9]/g, '_');
    const imageResult = await buildImagesForEmail(email.attachments, imageDestDir, imageBaseName).catch((err) => {
      logger.warn('Image extraction failed during Gmail import:', err);
      return { images: [], primaryThumb: undefined };
    });

    const combinedExtracted = extractedTexts.join('\n\n');
    const combinedAllText = [combinedExtracted, email.bodyText || ''].filter(Boolean).join('\n\n');

    // Sender name is always the office/code in the circular's Ref.No — the
    // "TCE/{name}/{name}" reference (falling back to other recognized office
    // codes), never the email sender. Stored as the bare office name
    // (e.g. "Alumni-Pragati"), not a prefixed "Ref: TCE/..." value.
    const rawSenderName = extractSenderNameFromRef([email.subject, combinedAllText].filter(Boolean).join('\n'));
    const senderName = formatRefSenderName(rawSenderName);

    // 4. Detect multiple expiry, deadline, fee, and exam dates
    const expiryResult = detectExpiry(combinedAllText);

    // 5. Classify circular category and priority
    const classification = await classifier.classify(combinedAllText, cleanTitle);

    const shortTitle = generateShortTitle(cleanTitle, email.bodyText || '');
    const summaryBullets = generate3PointerSummary(
      cleanTitle,
      email.bodyText || '',
      combinedExtracted
    );

    // 6. Create Circular record
    const circular = await Circular.create({
      emailMessageId: email.messageId,
      attachmentHash: fingerprint || undefined,
      subject: cleanTitle,
      shortTitle,
      summaryBullets,
      senderEmail: email.senderEmail,
      senderName,
      receivedDate: email.receivedDate,
      bodyText: email.bodyText,
      extractedText: combinedExtracted || undefined,
      categoryId: classification.categoryId ? new Types.ObjectId(classification.categoryId) : undefined,
      priority: classification.priority as Priority,
      priorityOrder: classification.priorityOrder,
      processingStatus: pendingOcrAttachments.length > 0 ? 'PROCESSING' : 'COMPLETED',
      isProcessed: pendingOcrAttachments.length === 0,
      isDuplicate: false,
      targetRole: 'ALL',
      expireDate: expiryResult.expireDate || undefined,
      lastDateWithoutFine: expiryResult.lastDateWithoutFine || undefined,
      lastDateWithFine: expiryResult.lastDateWithFine || undefined,
      expirySource: expiryResult.expirySource || undefined,
      expiryConfidence: expiryResult.expiryConfidence || undefined,
      importantDates: expiryResult.importantDates,
      createdBy: { role: 'SYSTEM', fullName: 'Gmail Sync' },
      attachments: attachmentSubdocs,
      images: imageResult.images,
      primaryThumb: imageResult.primaryThumb || undefined,
    });

    // Notify connected admin clients that a new circular arrived
    const populated = await circular.populate('category');
    await broadcastNewCircular(populated);

    // 7. If there are pending OCR attachments, queue them
    if (pendingOcrAttachments.length > 0) {
      for (const att of circular.attachments) {
        if (!att.isProcessed) {
          extractionQueue.add({
            circularId: circular._id.toString(),
            attachmentId: att._id ? att._id.toString() : '',
            filePath: att.filePath,
            fileType: att.fileType,
          });
        }
      }
    }

    saved++;
  }

  logger.info(
    `Gmail import for ${user.email}: ${saved} saved, ${duplicates} duplicates, ${skippedNonCirculars} non-circulars skipped, total evaluated: ${emails.length}`
  );

  return {
    fetched: emails.length,
    circularsFound,
    saved,
    duplicates,
    skippedNonCirculars,
    skippedNoToken: false,
  };
}

export const gmailCircularService = {
  importCircularsFromGmail,
  getUserWithValidToken,
};

export default gmailCircularService;