import 'dotenv/config';
import { google } from 'googleapis';
import dbConnect from '../config/database';
import { User } from '../models/User';
import { refreshGoogleAccessToken, createOAuth2Client, buildCircularSearchQuery } from '../services/googleService';
import { logger } from '../utils/logger';

async function getAdminAccessToken(): Promise<string> {
  const user = await User.findOne({ email: 'circularclassifier@gmail.com' }).orFail(
    new Error('Admin user not found')
  );

  let accessToken = user.googleAccessToken || '';
  if (
    !accessToken ||
    (user.googleTokenExpiry && user.googleTokenExpiry.getTime() - Date.now() < 5 * 60 * 1000)
  ) {
    const refreshed = await refreshGoogleAccessToken(user.googleRefreshToken || '');
    accessToken = refreshed.accessToken;
    user.googleAccessToken = refreshed.accessToken;
    user.googleTokenExpiry = refreshed.expiryDate;
    await user.save();
  }
  return accessToken;
}

async function main(): Promise<void> {
  await dbConnect();

  const accessToken = await getAdminAccessToken();
  const client = createOAuth2Client(accessToken);
  const gmail = google.gmail({ version: 'v1', auth: client });

  // Circular-related messages that are currently READ. In Gmail a read message
  // simply has no UNREAD label, so "-is:unread" selects the read ones.
  const q = `${buildCircularSearchQuery()} -is:unread`;
  console.log(`Marking as UNREAD, query: ${q}`);

  let unmarked = 0;
  let failed = 0;
  let pageToken: string | undefined;

  do {
    const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: 100, pageToken });
    const messages = res.data.messages || [];

    for (const item of messages) {
      if (!item.id) continue;
      try {
        await gmail.users.messages.modify({
          userId: 'me',
          id: item.id,
          requestBody: { addLabelIds: ['UNREAD'] },
        });
        unmarked++;
        if (unmarked % 50 === 0) console.log(`  ... ${unmarked} marked unread`);
      } catch (err) {
        failed++;
        logger.error(`Failed to mark message ${item.id} as unread:`, err);
      }
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  console.log(`\nDone. Marked ${unmarked} circular-related emails as UNREAD. Failures: ${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });