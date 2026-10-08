import 'dotenv/config';
import dbConnect from '../config/database';
import { User } from '../models/User';
import { Circular } from '../models/Circular';
import {
  refreshGoogleAccessToken,
  fetchGmailMessages,
  buildCircularSearchQuery,
} from '../services/googleService';
import { textExtractor } from '../services/textExtractor';
import { extractSenderNameFromRef, formatRefSenderName, ingestFetchedEmail } from '../services/circularIngest';
import { detectExpiry } from '../services/expiryDetector';
import { classifier } from '../services/classifier';
import { cleanCircularSubject } from '../utils/subject';
import { generateShortTitle, generate3PointerSummary } from '../utils/summaryHelper';
import { Types } from 'mongoose';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sleepWithTicks(ms: number, label: string): Promise<void> {
  const tickMs = 30_000;
  let waited = 0;
  while (waited < ms) {
    const step = Math.min(tickMs, ms - waited);
    await sleep(step);
    waited += step;
    console.log(`   ...waiting on ${label}: ${Math.round((ms - waited) / 1000)}s remaining`);
  }
}

function isRateLimited(err: any): boolean {
  return Boolean(err && (err.status === 429 || err.code === 429 || (err.response && err.response.status === 429)));
}

function retryDelayFromError(err: any): number {
  const msg = err instanceof Error ? err.message : '';
  const match = msg.match(/Retry after\s+([\dT:.Z+Z-]+)/i);
  if (match) {
    const t = new Date(match[1]).getTime();
    if (!Number.isNaN(t) && t > Date.now()) return t - Date.now();
  }
  return 60_000;
}

async function fetchMessagesWithBackoff(
  accessToken: string,
  query: string,
  limit: number,
  maxAttempts = 10
): Promise<Awaited<ReturnType<typeof fetchGmailMessages>>> {
  let attempt = 0;
  for (;;) {
    try {
      return await fetchGmailMessages(accessToken, query, limit);
    } catch (err) {
      attempt++;
      if (!isRateLimited(err) || attempt >= maxAttempts) throw err;
      const waitMs = retryDelayFromError(err);
      console.log(`⏳ Gmail rate limit hit. Waiting ${Math.round(waitMs / 1000)}s before retry (attempt ${attempt}/${maxAttempts})...`);
      await sleepWithTicks(waitMs, 'Gmail rate limit');
    }
  }
}

/**
 * Re-fetches every circular from the source Gmail mailbox, stores the raw
 * attachment bytes inside the database, re-extracts text (with OCR fallback for
 * scanned PDFs) and recomputes all derived fields (sender name from Ref.No / TCE/,
 * category, priority, expiry, summary, role) for every stored circular.
 * Business logic is unchanged: it reuses the same services used during ingest.
 */
async function main(): Promise<void> {
  console.log('🔄 Re-fetching circulars from Gmail and re-extracting all stored data...');
  await dbConnect();

  const admin = await User.findOne({ role: 'ADMIN', googleRefreshToken: { $exists: true } });
  if (!admin || !admin.googleRefreshToken) {
    throw new Error('No ADMIN user with a Google refresh token found');
  }

  const refreshed = await refreshGoogleAccessToken(admin.googleRefreshToken);
  console.log(`Using Gmail access token for ${admin.email} (expires ${refreshed.expiryDate.toISOString()})`);

  const query = buildCircularSearchQuery();
  const messages = await fetchMessagesWithBackoff(refreshed.accessToken, query, 500);
  console.log(`Fetched ${messages.length} circular emails from Gmail`);

  let updatedCount = 0;
  let insertedCount = 0;
  let noMatchCount = 0;

  for (const msg of messages) {
    const circular = await Circular.findOne({ emailMessageId: msg.messageId });

    if (!circular) {
      // Reuse the existing ingest pipeline so business logic stays identical.
      const outcome = await ingestFetchedEmail(
        {
          messageId: msg.messageId,
          subject: msg.subject,
          senderEmail: msg.senderEmail,
          senderName: null,
          receivedDate: msg.receivedDate,
          bodyText: msg.bodyText,
          attachments: msg.attachments.map((a) => ({
            filename: a.filename,
            fileType: a.fileType,
            fileSize: a.fileSize,
            data: a.data,
          })),
        },
        'reingest'
      );
      noMatchCount++;
      if (outcome === 'saved') insertedCount++;
      continue;
    }

    // Persist raw bytes + re-extract text (OCR fallback) per attachment.
    const used: Record<string, number> = {};
    const extractedTexts: string[] = [];

    for (const att of circular.attachments) {
      const occurrence = used[att.filename] || 0;
      used[att.filename] = occurrence + 1;
      const matches = msg.attachments.filter((a) => a.filename === att.filename);
      const src = matches[occurrence] || matches[0];

      if (!src || !src.data) {
        console.log(`  ⚠️  No source bytes for attachment "${att.filename}"`);
        continue;
      }

      att.data = src.data;
      att.fileSize = src.fileSize || src.data.length;

      const result = await textExtractor.extractFromBuffer(src.data, att.fileType || 'pdf');
      att.extractedText = result.text;
      att.ocrConfidence = result.confidence;
      att.isProcessed = true;
      if (result.text) extractedTexts.push(result.text);
    }

    const combinedExtracted = extractedTexts.join('\n\n');
    const cleanTitle = cleanCircularSubject(msg.subject, msg.attachments?.[0]?.filename);
    const combinedAllText = [cleanTitle, combinedExtracted, msg.bodyText || '']
      .filter(Boolean)
      .join('\n\n');

    const rawSenderName = extractSenderNameFromRef(combinedAllText);
    const senderName = formatRefSenderName(rawSenderName);
    const expiryResult = detectExpiry(combinedAllText);
    const classification = await classifier.classify(combinedAllText, cleanTitle);
    const roleResult = classifier.classifyRole(combinedAllText);
    const shortTitle = generateShortTitle(cleanTitle, msg.bodyText || '');
    const summaryBullets = generate3PointerSummary(
      cleanTitle,
      msg.bodyText || '',
      combinedExtracted
    );

    circular.subject = cleanTitle;
    circular.senderEmail = msg.senderEmail;
    circular.senderName = senderName;
    circular.receivedDate = msg.receivedDate;
    circular.bodyText = msg.bodyText;
    circular.extractedText = combinedExtracted || undefined;
    circular.shortTitle = shortTitle;
    circular.summaryBullets = summaryBullets;
    circular.categoryId = classification.categoryId
      ? (new Types.ObjectId(classification.categoryId) as any)
      : (null as any);
    circular.priority = classification.priority;
    circular.priorityOrder = classification.priorityOrder;
    circular.tags = classification.matchedKeywords;
    circular.targetRole = roleResult.targetRole;
    circular.expireDate = expiryResult.expireDate || null;
    circular.lastDateWithoutFine = expiryResult.lastDateWithoutFine || null;
    circular.lastDateWithFine = expiryResult.lastDateWithFine || null;
    circular.expirySource = expiryResult.expirySource || null;
    circular.expiryConfidence = expiryResult.expiryConfidence || null;
    circular.importantDates = expiryResult.importantDates;
    circular.processingStatus = 'COMPLETED';
    circular.isProcessed = true;

    await circular.save();
    updatedCount++;
    console.log(
      `✅ "${cleanTitle.slice(0, 70)}" -> sender="${senderName ?? 'NULL'}" textLen=${combinedExtracted.length}`
    );
  }

  await textExtractor.shutdown();

  const all = await Circular.find({});
  let noText = 0;
  let noSender = 0;
  console.log('\n📊 Final verification across DB:');
  for (const c of all) {
    const hasText = Boolean(c.extractedText && c.extractedText.trim());
    if (!hasText) noText++;
    if (!c.senderName) noSender++;
    console.log(`  - "${String(c.subject).slice(0, 60)}" | sender="${c.senderName ?? 'NULL'}" | extracted=${hasText ? 'yes' : 'NO'}`);
  }
  console.log(`\n🔄 Done. Updated: ${updatedCount}, inserted: ${insertedCount}, unmatched: ${noMatchCount}.`);
  console.log(`   Total circulars: ${all.length} | missing extracted text: ${noText} | missing sender name: ${noSender}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error during reprocessing:', err);
    process.exit(1);
  });