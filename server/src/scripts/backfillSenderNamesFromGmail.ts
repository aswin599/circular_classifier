import 'dotenv/config';
import { google } from 'googleapis';
import { simpleParser } from 'mailparser';
import dbConnect from '../config/database';
import '../models/Category';
import { Circular, AttachmentSubdoc } from '../models/Circular';
import { User } from '../models/User';
import { refreshGoogleAccessToken, createOAuth2Client } from '../services/googleService';
import { textExtractor } from '../services/textExtractor';
import { extractSenderNameFromRef, formatRefSenderName } from '../utils/senderName';

interface AttachmentBuffer {
  filename?: string;
  content?: Buffer;
}

function pickLetterAttachment(atts: AttachmentBuffer[]): AttachmentBuffer | undefined {
  if (!atts || atts.length === 0) return undefined;
  const supported = /\.(pdf|png|jpe?g|tif|tiff|bmp|gif)$/i;
  const withExt = atts.filter((a) => (a.filename || '').trim().toLowerCase().match(supported));
  if (withExt.length === 0) return undefined;

  const sorted = [...withExt].sort((a, b) => {
    const aLetter = /circular/i.test(a.filename || '') ? 0 : 1;
    const bLetter = /circular/i.test(b.filename || '') ? 0 : 1;
    if (aLetter !== bLetter) return aLetter - bLetter;
    return /pdf$/i.test(a.filename || '') ? -1 : 1;
  });

  const chosen = sorted[0];
  if (!chosen || !chosen.content || chosen.content.length === 0) return undefined;
  return chosen;
}

function decodeBase64Url(data: string): Buffer {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

async function main(): Promise<void> {
  await dbConnect();

  const targets = await Circular.find({
    $or: [
      { senderName: null },
      { senderName: { $in: ['', 'null'] } },
      { senderName: { $regex: /^ref\s*:/i } },
    ],
  }).select('emailMessageId subject senderEmail senderName attachments bodyText extractedText');

  console.log(`Target circulars (missing or legacy "Ref:"-prefixed senderName): ${targets.length}`);

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

  const client = createOAuth2Client(accessToken);
  const gmail = google.gmail({ version: 'v1', auth: client });

  let updated = 0;
  let notFound = 0;

  for (const circular of targets) {
    const messageId = circular.emailMessageId || '';
    let rawSource: Buffer | undefined;

    try {
      if (messageId) {
        const res = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'raw' });
        if (res.data.raw) rawSource = decodeBase64Url(res.data.raw);
      }
    } catch (err) {
      console.log(`  [${String(circular.subject).slice(0, 40)}] gmail get failed: ${(err as Error).message}`);
    }

    let ocrText = '';
    if (rawSource) {
      const parsed = await simpleParser(rawSource);
      const letter = pickLetterAttachment((parsed.attachments || []) as AttachmentBuffer[]);

      if (letter) {
        const ext = (letter.filename || '').split('.').pop()?.toLowerCase() || 'pdf';
        try {
          const result = await textExtractor.extractFromBuffer(letter.content!, ext);
          ocrText = result.text || '';
        } catch (err) {
          console.log(`  [${String(circular.subject).slice(0, 40)}] extraction error: ${(err as Error).message}`);
        }
      }
    }

    // If the Gmail attachment OCR came up empty (or the message isn't
    // reachable), fall back to the already-extracted text stored in the DB so
    // a circular is never left with a NULL sender when its ref is parseable.
    const storedText = [
      circular.subject,
      circular.bodyText || '',
      circular.extractedText || '',
      ...(circular.attachments || ([] as AttachmentSubdoc[])).map((att: AttachmentSubdoc) => att.extractedText || ''),
    ]
      .filter(Boolean)
      .join('\n\n');

    const senderName = formatRefSenderName(extractSenderNameFromRef(ocrText) ?? extractSenderNameFromRef(storedText));

    if (senderName) {
      circular.senderName = senderName;
      await circular.save();
      updated++;
      console.log(`OK       ${String(circular.subject).slice(0, 50)} | att=${ocrText ? 'gmail' : 'db'} -> "${senderName}"`);
    } else {
      console.log(`NONAME   ${String(circular.subject).slice(0, 50)} | no sender pattern found`);
      console.log(`         --- first 300 chars of ${ocrText ? 'OCR' : 'stored'} text ---`);
      console.log(`         ${(ocrText || storedText).slice(0, 300).replace(/\n/g, ' / ')}`);
      notFound++;
    }
  }

  console.log(`\nDone. Updated=${updated} NoSenderFound=${notFound}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });