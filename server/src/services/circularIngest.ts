import { Circular, Priority } from '../models/Circular';
import { detectExpiry } from './expiryDetector';
import { isCircularEmail } from './circularFilter';
import { textExtractor } from './textExtractor';
import { classifier } from './classifier';
import { realtime } from './realtime';
import { cleanCircularSubject } from '../utils/subject';
import { generateShortTitle, generate3PointerSummary } from '../utils/summaryHelper';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';
import { config } from '../config';
import { buildImagesForEmail, ImageSourceAttachment } from './imageExtractor';
import { extractSenderNameFromRef, formatRefSenderName } from '../utils/senderName';

export { extractSenderNameFromRef, formatRefSenderName };

export interface IngestableEmail {
  messageId: string;
  subject: string;
  senderEmail: string;
  senderName?: string | null;
  receivedDate: Date;
  bodyText?: string | null;
  attachments: (ImageSourceAttachment & {
    filename: string;
    fileType: string;
    fileSize?: number;
    filePath?: string;
    data?: Buffer;
  })[];
}

export type IngestOutcome = 'saved' | 'duplicate' | 'skipped';

export interface IngestResult {
  fetched: number;
  saved: number;
  duplicates: number;
  skipped: number;
}

export interface CircularBroadcastPayload {
  id: string;
  subject: string;
  shortTitle?: string;
  senderEmail: string;
  senderName?: string | null;
  receivedDate: Date;
  expireDate?: Date | null;
  category?: { name: string; color: string } | null;
  categoryName?: string | null;
  priority: Priority;
  excerpt?: string | null;
  primaryThumbnail?: string;
}

export function toBroadcastPayload(circular: any): CircularBroadcastPayload {
  return {
    id: circular._id?.toString?.() || circular.id,
    subject: circular.subject,
    shortTitle: circular.shortTitle,
    senderEmail: circular.senderEmail,
    senderName: circular.senderName ?? null,
    receivedDate: circular.receivedDate,
    expireDate: circular.expireDate ?? null,
    category: circular.category
      ? { name: circular.category.name, color: circular.category.color }
      : null,
    categoryName: circular.category?.name ?? null,
    priority: circular.priority,
    excerpt: (circular.bodyText || circular.extractedText || '').slice(0, 600) || null,
    primaryThumbnail:
      circular.primaryThumb && circular.primaryThumb.length
        ? `data:image/jpeg;base64,${circular.primaryThumb.toString('base64')}`
        : undefined,
  };
}

export async function broadcastNewCircular(circular: any): Promise<void> {
  try {
    const payload = toBroadcastPayload(circular);
    realtime.newCircular(payload);
  } catch (err) {
    logger.warn('Failed to broadcast new circular:', err);
  }
}

/**
 * Content fingerprint used to detect a re-sent circular even when the
 * Message-ID changes (e.g. the same PDF forwarded from another account).
 * Prefers a SHA-256 of the first attachment's bytes, falling back to a
 * hash of the normalized body text.
 */
export function circularFingerprint(email: {
  attachments?: Array<{ filePath?: string; data?: Buffer }>;
  bodyText?: string | null;
}): string {
  const attachment = email.attachments?.[0];
  if (attachment?.data) {
    return `file:${createHash('sha256').update(attachment.data).digest('hex')}`;
  }
  if (attachment?.filePath && fs.existsSync(attachment.filePath)) {
    try {
      const buf = fs.readFileSync(attachment.filePath);
      return `file:${createHash('sha256').update(buf).digest('hex')}`;
    } catch {
      // fall through to body-based fingerprint
    }
  }

  const normalized = (email.bodyText || '').replace(/\s+/g, ' ').trim().slice(0, 4000);
  return normalized ? `text:${createHash('sha256').update(normalized).digest('hex')}` : '';
}

/**
 * Shared pipeline used by the email watcher, the background queue and the
 * Gmail sync: validates the email as a circular, extracts attachment text,
 * detects expiry dates, classifies it, persists it and pushes a live
 * "new-circular" event to any connected clients.
 */
export async function ingestFetchedEmail(email: IngestableEmail, source = 'email'): Promise<IngestOutcome> {
  const cleanTitle = cleanCircularSubject(email.subject, email.attachments?.[0]?.filename);
  const fingerprint = circularFingerprint(email);

  const check = isCircularEmail({
    subject: email.subject,
    bodyText: email.bodyText || null,
    senderEmail: email.senderEmail,
    senderName: email.senderName || null,
    attachments: email.attachments,
  });

  if (!check.isCircular) {
    logger.info(`[ingest:${source}] Skipping non-circular email "${email.subject}": ${check.reason}`);
    return 'skipped';
  }

  let existing = await Circular.findOne({ emailMessageId: email.messageId });
  let contentMatch = false;
  if (!existing && fingerprint) {
    existing = await Circular.findOne({ attachmentHash: fingerprint });
    contentMatch = !!existing;
  }
  if (!existing) {
    const sameSubject = await Circular.findOne({ subject: cleanTitle });
    if (sameSubject) {
      existing = sameSubject;
      contentMatch = true;
    }
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
    logger.info(
      `[ingest:${source}] Marked existing circular as duplicate "${cleanTitle}"${contentMatch ? ' (content match)' : ''}`
    );
    return 'duplicate';
  }

  // Extract text from PDF / DOCX / text attachments inline
  const attachmentSubdocs: Array<Record<string, unknown>> = [];
  const extractedTexts: string[] = [];

  for (const att of email.attachments || []) {
    const ext = (att.fileType || '').toLowerCase();
    let extractedText: string | undefined;
    let isProcessed = false;
    const subdocId = new Types.ObjectId();
    att.sourceAttachmentId = subdocId.toString();

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
    } catch (err) {
      logger.warn(`Failed to extract text from attachment ${att.filename}:`, err);
    }

    attachmentSubdocs.push({
      _id: subdocId,
      filename: att.filename,
      fileType: att.fileType,
      fileSize: att.fileSize || att.data?.length,
      filePath: att.filePath,
      data: att.data,
      extractedText,
      isProcessed,
    });
  }

  // Extract images (PDF page renders, embedded figures, DOCX media, email
  // inline pictures) alongside the text. This is purely additive: the
  // classification / expiry / duplicate logic below never depends on it.
  const imageDestDir = path.join(path.resolve(config.upload.dir), 'extracted');
  const imageBaseName = (email.messageId || cleanTitle || 'circular').replace(/[^a-zA-Z0-9]/g, '_');
  const imageResult = await buildImagesForEmail(email.attachments || [], imageDestDir, imageBaseName).catch((err) => {
    logger.warn('Image extraction failed during ingest:', err);
    return { images: [], primaryThumb: undefined };
  });

  const combinedExtracted = extractedTexts.join('\n\n');
  // Subject is included so due dates mentioned in the title line
  // (e.g. "on or before 09.10.2026") are detected even when the
  // attached PDF is a scanned image with no extractable text.
  const combinedAllText = [cleanTitle, combinedExtracted, email.bodyText || ''].filter(Boolean).join('\n\n');
  const expiryResult = detectExpiry(combinedAllText);
  const classification = await classifier.classify(combinedAllText, cleanTitle);
  const roleResult = classifier.classifyRole(combinedAllText);

  // Sender name is always the office/code in the circular's Ref.No — the
  // "TCE/{name}/{name}" reference (falling back to other recognized office
  // codes), never the email sender. Stored as the bare office name
  // (e.g. "Alumni-Pragati"), not a prefixed "Ref: TCE/..." value.
  const rawSenderName = extractSenderNameFromRef(combinedAllText);
  const senderName = formatRefSenderName(rawSenderName);

  const shortTitle = generateShortTitle(cleanTitle, email.bodyText || '');
  const summaryBullets = generate3PointerSummary(
    cleanTitle,
    email.bodyText || '',
    combinedExtracted
  );

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
    priority: classification.priority,
    priorityOrder: classification.priorityOrder,
    tags: [],
    processingStatus: 'COMPLETED',
    isProcessed: true,
    isDuplicate: false,
    targetRole: roleResult.targetRole,
    expireDate: expiryResult.expireDate || undefined,
    lastDateWithoutFine: expiryResult.lastDateWithoutFine || undefined,
    lastDateWithFine: expiryResult.lastDateWithFine || undefined,
    expirySource: expiryResult.expirySource || undefined,
    expiryConfidence: expiryResult.expiryConfidence || undefined,
    importantDates: expiryResult.importantDates,
    createdBy: { role: 'SYSTEM', fullName: 'Email Sync' },
    attachments: attachmentSubdocs,
    images: imageResult.images,
    primaryThumb: imageResult.primaryThumb || undefined,
  });

  const populated = await circular.populate('category');
  await broadcastNewCircular(populated);

  logger.info(`[ingest:${source}] Saved circular "${cleanTitle}" [${shortTitle}] (${classification.categoryName || 'uncategorized'})`);
  return 'saved';
}

export async function ingestFetchedEmails(emails: IngestableEmail[], source = 'email'): Promise<IngestResult> {
  let saved = 0;
  let duplicates = 0;
  let skipped = 0;

  for (const email of emails) {
    const outcome = await ingestFetchedEmail(email, source);
    if (outcome === 'saved') saved++;
    else if (outcome === 'duplicate') duplicates++;
    else skipped++;
  }

  return { fetched: emails.length, saved, duplicates, skipped };
}