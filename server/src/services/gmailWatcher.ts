import { User } from '../models/User';
import { config } from '../config';
import { logger } from '../utils/logger';
import { importCircularsFromGmail } from './gmailCircularService';

let intervalTimer: NodeJS.Timeout | null = null;
let isSyncing = false;

export interface GmailSyncSummary {
  accounts: number;
  fetched: number;
  circularsFound: number;
  saved: number;
  duplicates: number;
  skippedNonCirculars: number;
  errors: string[];
}

const EMPTY_SUMMARY: GmailSyncSummary = {
  accounts: 0,
  fetched: 0,
  circularsFound: 0,
  saved: 0,
  duplicates: 0,
  skippedNonCirculars: 0,
  errors: [],
};

/**
 * Imports circulars from the designated circulars mailbox (config.email.user,
 * e.g. circularclassifier@gmail.com) using the Gmail API. Personal Google
 * accounts connected by students are deliberately NOT synced so unrelated
 * mail (social notifications, promotions, etc.) is never fetched. New
 * circulars are persisted and broadcast live through the shared ingest path.
 */
export async function syncConnectedMailboxes(): Promise<GmailSyncSummary> {
  if (isSyncing) return { ...EMPTY_SUMMARY };

  isSyncing = true;
  try {
    const connected = await User.find({
      $and: [
        { $or: [{ googleRefreshToken: { $ne: null } }, { googleAccessToken: { $ne: null } }] },
        ...(config.email.user
          ? [{ email: config.email.user.toLowerCase() }]
          : [{ role: 'ADMIN' }]),
      ],
    }).select('+googleRefreshToken +googleAccessToken');

    if (connected.length === 0) {
      logger.warn(
        config.email.user
          ? `Gmail watcher: no Google connection found for designated mailbox ${config.email.user}`
          : 'Gmail watcher: no Google-connected admin mailboxes to sync'
      );
      return { ...EMPTY_SUMMARY };
    }

    const summary: GmailSyncSummary = { ...EMPTY_SUMMARY, accounts: connected.length };

    for (const user of connected) {
      try {
        const result = await importCircularsFromGmail(user._id.toString(), { limit: 10 });
        summary.fetched += result.fetched;
        summary.circularsFound += result.circularsFound;
        summary.saved += result.saved;
        summary.duplicates += result.duplicates;
        summary.skippedNonCirculars += result.skippedNonCirculars;
        logger.info(
          `Gmail sync [${user.email}]: fetched ${result.fetched}, saved ${result.saved}, duplicates ${result.duplicates}, non-circulars ${result.skippedNonCirculars}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`Gmail sync failed for ${user.email}: ${msg}`);
        summary.errors.push(`${user.email}: ${msg}`);
      }
    }

    logger.info(
      `Gmail watcher tick: ${summary.accounts} account(s), ${summary.fetched} emails, ${summary.saved} saved, ${summary.duplicates} duplicates`
    );
    return summary;
  } finally {
    isSyncing = false;
  }
}

export function startGmailWatcher(): void {
  if (intervalTimer) return;

  const intervalMs = Number(config.email.watchInterval || 60000);
  logger.info(`Starting Gmail watcher for Google-connected mailboxes (every ${Math.round(intervalMs / 1000)}s)`);

  void syncConnectedMailboxes();
  intervalTimer = setInterval(() => void syncConnectedMailboxes(), intervalMs);
}

export function stopGmailWatcher(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}