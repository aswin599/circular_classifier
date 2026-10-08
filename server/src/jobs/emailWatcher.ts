import { config } from '../config';
import { logger } from '../utils/logger';
import emailProcessor from '../services/emailProcessor';
import { ingestFetchedEmails } from '../services/circularIngest';

let intervalTimer: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Polls the configured mailbox (EMAIL_USER / circularclassifier@gmail.com)
 * for newly arrived circulars and imports them through the shared ingest
 * pipeline, which broadcasts a live "new-circular" event afterwards.
 */
export async function checkForNewEmails(): Promise<void> {
  if (isRunning) return;
  if (!config.email.user || !config.email.password || !config.email.host) {
    return;
  }

  isRunning = true;
  try {
    await emailProcessor.connect();
    const emails = await emailProcessor.fetchCircularEmails(10);
    await emailProcessor.disconnect();

    if (emails.length > 0) {
      const mapped = emails.map((email) => ({
        messageId: email.messageId,
        subject: email.subject,
        senderEmail: email.senderEmail,
        senderName: email.senderName,
        receivedDate: email.receivedDate,
        bodyText: email.bodyText,
        attachments: email.attachmentResults.map((a) => ({
          filename: a.filename,
          fileType: a.fileType,
          fileSize: a.fileSize,
          filePath: a.filePath,
        })),
      }));

      const result = await ingestFetchedEmails(mapped, 'watcher');
      logger.info(
        `Email watcher: fetched ${result.fetched}, saved ${result.saved}, duplicates ${result.duplicates}, skipped ${result.skipped}`
      );
    }
  } catch (err) {
    logger.warn(`Email watcher tick failed: ${err instanceof Error ? err.message : err}`);
    try {
      await emailProcessor.disconnect();
    } catch {
      // ignore disconnect errors on failed ticks
    }
  } finally {
    isRunning = false;
  }
}

export function startEmailWatcher(): void {
  if (intervalTimer) return;
  if (!config.email.user || !config.email.password || !config.email.host) {
    logger.info('Email watcher disabled: mailbox not configured in environment');
    return;
  }

  const intervalMs = Number(config.email.watchInterval);
  logger.info(`Starting email watcher for ${config.email.user} (every ${Math.round(intervalMs / 1000)}s)`);

  void checkForNewEmails();
  intervalTimer = setInterval(() => void checkForNewEmails(), intervalMs);
}

export function stopEmailWatcher(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}