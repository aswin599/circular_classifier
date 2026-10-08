import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Circular } from '../models/Circular';
import { CIRCULAR_SEARCH_TERMS } from './circularFilter';

// Use the declared mailparser types
type ParsedMailType = import('mailparser').ParsedMail;
type AttachmentType = import('mailparser').Attachment;

export interface FetchedEmail {
  messageId: string;
  subject: string;
  senderEmail: string;
  senderName: string | null;
  receivedDate: Date;
  bodyText: string | null;
  attachmentResults: {
    filename: string;
    fileType: string;
    fileSize: number;
    filePath: string;
    contentId?: string;
  }[];
}

export class EmailProcessor {
  private client: ImapFlow | null = null;

  async connect(): Promise<void> {
    this.client = new ImapFlow({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.tls,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
      logger: false,
    });

    await this.client.connect();
    logger.info('Connected to IMAP server');
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.logout();
      this.client = null;
      logger.info('Disconnected from IMAP server');
    }
  }

  async ensureStorageDirs(): Promise<void> {
    const uploadDir = path.resolve(config.upload.dir);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const rawDir = path.join(uploadDir, 'raw');
    if (!fs.existsSync(rawDir)) {
      fs.mkdirSync(rawDir, { recursive: true });
    }

    const extractedDir = path.join(uploadDir, 'extracted');
    if (!fs.existsSync(extractedDir)) {
      fs.mkdirSync(extractedDir, { recursive: true });
    }
  }

  /**
   * Build an IMAP SEARCH that only matches circular-related messages.
   * Each term is OR'd across both the subject header and the body, so
   * unrelated mail (newsletters, OTPs, promotions) is never downloaded.
   */
  private buildImapSearchQuery(): Record<string, unknown> {
    const terms: string[] = [];
    const seen = new Set<string>();

    for (const term of CIRCULAR_SEARCH_TERMS) {
      if (seen.has(term)) continue;
      seen.add(term);
      if (terms.length >= 15) break;
      terms.push(term);
    }

    // Keep supporting an explicit mailbox label config (EMAIL_LABEL)
    if (config.email.label && !seen.has(config.email.label)) {
      terms.pop();
      terms.push(config.email.label);
    }

    const keys = terms.map((t) => ({
      or: [
        { header: { subject: t } },
        { text: t },
      ] as unknown as Record<string, unknown>,
    }));

    return { or: keys };
  }

  async fetchCircularEmails(batchSize = 50): Promise<FetchedEmail[]> {
    if (!this.client) {
      throw new Error('IMAP client not connected');
    }

    await this.ensureStorageDirs();

    const fetched: FetchedEmail[] = [];

    try {
      await this.client.mailboxOpen('INBOX');

      const searchQuery = this.buildImapSearchQuery();
      logger.info(`Searching emails matching circular terms (${JSON.stringify(searchQuery).slice(0, 200)}...)`);

      // imapflow search returns a range object or array of sequence numbers
      const messages = await this.client.search(searchQuery);

      // Normalize to an array of numbers
      let messageList: number[] = [];
      if (Array.isArray(messages)) {
        messageList = messages as number[];
      } else if (messages && typeof messages === 'object') {
        // imapflow can return a range {from, to} when to is omitted
        const range = messages as { from?: number; to?: number };
        const from = range.from ?? 1;
        const to = range.to ?? 0;
        if (to >= from) {
          messageList = Array.from({ length: to - from + 1 }, (_, i) => from + i);
        }
      }

      // Take only the latest batch
      const batchMessages = messageList.slice(-batchSize);

      logger.info(`Found ${messageList.length} emails, processing ${batchMessages.length} in this batch`);

      for (const seq of batchMessages) {
        try {
          const email = await this.processMessage(seq);
          if (email) {
            fetched.push(email);
          }
        } catch (err) {
          logger.error(`Failed to process message seq ${seq}:`, err);
        }
      }

      return fetched;
    } catch (err) {
      logger.error('Error fetching emails:', err);
      throw err;
    }
  }

  private async processMessage(seq: number): Promise<FetchedEmail | null> {
    if (!this.client) {
      throw new Error('IMAP client not connected');
    }

    // imapflow fetch returns an async iterable; collect the first message
    const messages = this.client.fetch(
      String(seq),
      {
        source: true,
        envelope: true,
      }
    );

    let rawSource: Buffer | null = null;
    for await (const message of messages) {
      rawSource = (message as { source?: Buffer }).source ?? null;
      break;
    }

    if (!rawSource) {
      logger.warn(`No source found for seq ${seq}`);
      return null;
    }

    const parsed: ParsedMailType = await simpleParser(rawSource);

    const messageId = parsed.messageId || `msg-${seq}-${Date.now()}`;

    // Check if already processed
    const existing = await Circular.findOne({ emailMessageId: messageId });

    if (existing) {
      logger.debug(`Skipping already-processed email: ${messageId}`);
      return null;
    }

    const attachmentResults: FetchedEmail['attachmentResults'] = [];
    const rawDir = path.join(path.resolve(config.upload.dir), 'raw');

    const attachments: AttachmentType[] = parsed.attachments || [];

    // Filter attachments to supported files
    const supported = attachments.filter((att) => {
      const type = (att.contentType || '').toLowerCase();
      const filename = (att.filename || '').toLowerCase();
      return (
        type.includes('pdf') ||
        type.includes('/png') ||
        type.includes('/jpeg') ||
        type.includes('msword') ||
        type.includes('wordprocessingml') ||
        type.includes('/plain') ||
        filename.endsWith('.pdf') ||
        filename.endsWith('.png') ||
        filename.endsWith('.jpg') ||
        filename.endsWith('.jpeg') ||
        filename.endsWith('.tif') ||
        filename.endsWith('.tiff') ||
        filename.endsWith('.doc') ||
        filename.endsWith('.docx') ||
        filename.endsWith('.txt')
      );
    });

    for (const att of supported) {
      const filename = att.filename || `attachment-${Date.now()}.bin`;
      const ext = path.extname(filename).replace('.', '').toLowerCase();
      const fileType = ext || 'pdf';
      const safeMessageId = messageId.replace(/[^a-zA-Z0-9]/g, '_');
      const storedFilename = `${safeMessageId}-${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = path.join(rawDir, storedFilename);

      try {
        const content = att.content as Buffer;
        fs.writeFileSync(filePath, content);
        attachmentResults.push({
          filename,
          fileType,
          fileSize: att.size || content.length,
          filePath,
          contentId: att.contentId || undefined,
        });
      } catch (err) {
        logger.error(`Failed to save attachment ${filename}:`, err);
      }
    }

    const bodyText = parsed.text || parsed.htmlAsText || null;
    const fromValue = parsed.from?.value?.[0];

    return {
      messageId,
      subject: parsed.subject || '(No subject)',
      senderEmail: fromValue?.address || '',
      senderName: fromValue?.name || null,
      receivedDate: parsed.date || new Date(),
      bodyText,
      attachmentResults,
    };
  }
}

export default new EmailProcessor();
