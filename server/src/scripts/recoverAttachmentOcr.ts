import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { config } from '../config';
import { textExtractor } from '../services/textExtractor';
import { User } from '../models/User';

/**
 * Recovers PDF attachments that were deleted from disk by re-downloading the
 * source messages from Gmail (by Gmail message id), OCR'ing them, and printing
 * the extracted text. Add --write to persist recovered text back to the DB.
 */
async function main() {
  const write = process.argv.includes('--write');
  await mongoose.connect(config.db.url);

  const targetIds = process.argv.slice(2).filter((a) => !a.startsWith('--'));

  const users = await User.find({
    googleRefreshToken: { $exists: true, $ne: '' },
  }).sort({ role: -1 });

  if (!users.length) {
    throw new Error('No users with Google refresh tokens found in DB.');
  }

  let recovered = 0;
  let lastError: unknown = null;

  for (const user of users) {
    if (recovered >= targetIds.length) break;
    try {
      const client = new google.auth.OAuth2(
        config.google.clientId,
        config.google.clientSecret,
        config.google.redirectUri
      );
      client.setCredentials({ refresh_token: user.googleRefreshToken! });
      const { credentials } = await client.refreshAccessToken();
      client.setCredentials(credentials);

      const gmail = google.gmail({ version: 'v1', auth: client });

      for (const messageId of targetIds) {
        if (recovered >= targetIds.length) break;
        try {
          const res = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full',
          });
          const payload = res.data.payload;
          const parts = payload?.parts || [payload!];
          const attachments: { filename: string; data: Buffer }[] = [];

          const collect = async (list: any[]) => {
            for (const part of list) {
              const filename = part.filename || '';
              const attachmentId = part.body?.attachmentId;
              const ext = filename.split('.').pop()?.toLowerCase() || '';
              if (filename && attachmentId && ext === 'pdf') {
                const attRes = await gmail.users.messages.attachments.get({
                  userId: 'me',
                  messageId,
                  id: attachmentId,
                });
                const b64 = (attRes.data.data || '').replace(/-/g, '+').replace(/_/g, '/');
                attachments.push({ filename, data: Buffer.from(b64, 'base64') });
              } else if (part.parts) {
                await collect(part.parts);
              }
            }
          };
          await collect(parts);

          console.log(`\n[${user.email}] message ${messageId} (${res.data.threadId}): ${attachments.length} PDF(s)`);
          if (!attachments.length) continue;

          const outDir = path.join(path.resolve(config.upload.dir), 'recovered');
          fs.mkdirSync(outDir, { recursive: true });

          for (const att of attachments) {
            const filePath = path.join(outDir, `${messageId}-${att.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
            fs.writeFileSync(filePath, att.data);
            const result = await textExtractor.extract(filePath, 'pdf');
            console.log(`  ${att.filename} (${att.data.length} bytes) method=${result.method} conf=${result.confidence ?? '-'} chars=${result.text.length}`);
            const preview = result.text.slice(0, 1200);
            console.log('  --- TEXT ---');
            console.log(preview);
            console.log('  --- END ---');

            if (write && result.text) {
              const db = mongoose.connection.db!;
              const doc = await db.collection('circulars').findOne({ emailMessageId: messageId });
              if (doc) {
                const attachmentsDb = (doc.attachments || []).map((a: any) =>
                  a.filename === att.filename ? { ...a, extractedText: result.text, isProcessed: true } : a
                );
                await db.collection('circulars').updateOne(
                  { _id: doc._id },
                  { $set: { extractedText: result.text, attachments: attachmentsDb } }
                );
                console.log(`  -> persisted extractedText (${result.text.length} chars) to circular ${doc._id}`);
              }
            }
          }
          recovered++;
        } catch (err) {
          lastError = err;
          console.log(`  ! failed to fetch message ${messageId}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      lastError = err;
      console.log(`! token refresh failed for ${user.email}: ${(err as Error).message}`);
    }
  }

  if (lastError) console.log('\nLast error seen:', (lastError as Error).message);
  await textExtractor.shutdown();
  await mongoose.disconnect();
  console.log(`\nDone. recovered=${recovered}/${targetIds.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});