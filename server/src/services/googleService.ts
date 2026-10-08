import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';
import { CIRCULAR_SEARCH_TERMS } from './circularFilter';

const gmailScopes = config.google.scopes;

export function createOAuth2Client(accessToken?: string, refreshToken?: string) {
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );

  if (accessToken) {
    client.setCredentials({ access_token: accessToken });
  }
  if (refreshToken) {
    client.setCredentials({ refresh_token: refreshToken });
  }

  return client;
}

export function isGoogleConfigured(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret);
}

export function generateAuthUrl(): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: gmailScopes,
    include_granted_scopes: false,
  });
}

export async function exchangeCodeForTokens(code: string): Promise<{
  tokens: { access_token?: string; refresh_token?: string; expiry_date?: number };
  profile: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
}> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const profileRes = await oauth2.userinfo.get();
  const profile = profileRes.data;

  if (!profile.id || !profile.email) {
    throw new Error('Failed to retrieve Google profile');
  }

  return {
    tokens: {
      access_token: tokens.access_token ?? undefined,
      refresh_token: tokens.refresh_token ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
    },
    profile: {
      id: profile.id,
      email: profile.email.toLowerCase(),
      name: profile.name || profile.email?.split('@')[0] || 'Google User',
      picture: profile.picture ?? undefined,
    },
  };
}

/**
 * Refresh the Google access token for a user. Returns the new access token
 * and expiry, or throws if the refresh token is unavailable/invalid.
 */
export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiryDate: Date;
}> {
  const client = createOAuth2Client(undefined, refreshToken);
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error('No access token returned from Google refresh');
  }
  return {
    accessToken: credentials.access_token,
    expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600 * 1000),
  };
}

export async function profileFromAccessToken(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string;
  picture?: string;
}> {
  const client = createOAuth2Client(accessToken);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const profileRes = await oauth2.userinfo.get();
  const profile = profileRes.data;

  if (!profile.id || !profile.email) {
    throw new Error('Failed to retrieve Google profile');
  }

  return {
    id: profile.id,
    email: profile.email.toLowerCase(),
    name: profile.name || profile.email.split('@')[0] || 'Google User',
    picture: profile.picture ?? undefined,
  };
}

export interface GmailMessageSummary {
  messageId: string;
  threadId: string;
  subject: string;
  senderEmail: string;
  senderName: string | null;
  receivedDate: Date;
  bodyText: string | null;
  attachments: {
    filename: string;
    fileType: string;
    fileSize: number;
    filePath?: string;
    data?: Buffer;
    contentId?: string;
    sourceAttachmentId?: string;
  }[];
}

/**
 * Build a Gmail search (`q`) that only matches circular-related messages,
 * instead of pulling the whole inbox. Terms are OR'd and matched against
 * subject + body by Gmail's default full-text search.
 */
export function buildCircularSearchQuery(label?: string): string {
  const terms = new Set(CIRCULAR_SEARCH_TERMS);
  if (label) terms.add(label);

  const q = Array.from(terms)
    .map((t) => (t.indexOf(' ') > -1 ? `"${t}"` : t))
    .join(' OR ');

  return `in:inbox (${q})`;
}

/**
 * Fetch up to `maxResults` messages from the user's Gmail inbox,
 * optionally filtered by a search query (e.g. "circulars").
 */
export async function fetchGmailMessages(
  accessToken: string,
  query: string,
  maxResults = 20
): Promise<GmailMessageSummary[]> {
  const client = createOAuth2Client(accessToken);
  const gmail = google.gmail({ version: 'v1', auth: client });

  // List message IDs matching query
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });

  const messages = listRes.data.messages || [];
  if (messages.length === 0) {
    return [];
  }

  const summaries: GmailMessageSummary[] = [];

  for (const item of messages) {
    if (!item.id) continue;
    try {
      const msg = await fetchSingleGmailMessage(gmail, item.id);
      if (msg) summaries.push(msg);
    } catch (err) {
      logger.error(`Failed to fetch Gmail message ${item.id}:`, err);
    }
  }

  return summaries;
}

function decodeBase64Url(data: string): Buffer {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

async function fetchSingleGmailMessage(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string
): Promise<GmailMessageSummary | null> {
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const payload = res.data.payload;
  if (!payload) return null;

  const headers = payload.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  const subject = getHeader('subject') || '(No Subject)';
  const from = getHeader('from');
  const dateStr = getHeader('date');

  let senderEmail = '';
  let senderName: string | null = null;
  const match = from.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
  if (match) {
    senderName = match[1] ? match[1].trim() : null;
    senderEmail = match[2].trim().toLowerCase();
  } else {
    senderEmail = from.trim().toLowerCase();
  }

  const receivedDate = dateStr ? new Date(dateStr) : new Date();

  // Extract body text and attachments from MIME parts
  const parts = payload.parts || [payload];
  let bodyText: string | null = null;

  const findTextPlain = (partList: any[]): string | null => {
    for (const part of partList) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data).toString('utf-8');
      }
      if (part.parts) {
        const found = findTextPlain(part.parts);
        if (found) return found;
      }
    }
    return null;
  };

  bodyText = findTextPlain(parts);
  if (bodyText) {
    bodyText = bodyText.replace(/\r\n/g, '\n').trim();
  }

  const supportedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'tif', 'tiff', 'gif', 'bmp', 'txt'];
  const attachments: GmailMessageSummary['attachments'] = [];

  const collectParts = async (list: any[]) => {
    for (const part of list) {
      if (part.mimeType === 'multipart/alternative' || (part.mimeType && part.mimeType.startsWith('multipart/'))) {
        if (part.parts) await collectParts(part.parts);
        continue;
      }
      if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') continue;

      const filename = part.filename || '';
      const attachmentId = part.body?.attachmentId;
      const ext = filename ? filename.split('.').pop()?.toLowerCase() || '' : '';

      if (filename && (attachmentId || part.body?.data) && supportedExtensions.includes(ext)) {
        let content: Buffer;
        if (attachmentId) {
          try {
            const attRes = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId,
              id: attachmentId,
            });
            content = decodeBase64Url(attRes.data.data || '');
          } catch (err) {
            logger.error(`Failed to download attachment ${filename}:`, err);
            continue;
          }
        } else {
          content = decodeBase64Url(part.body?.data || '');
        }

        attachments.push({
          filename,
          fileType: ext,
          fileSize: part.body?.size || content.length,
          data: content,
        });
      } else if (part.parts) {
        await collectParts(part.parts);
      }
    }
  };

  await collectParts(parts);

  // Handle case where the whole payload is a single attachment (no parts)
  if (attachments.length === 0 && payload?.filename) {
    const filename = payload.filename;
    const ext = path.extname(filename).replace('.', '').toLowerCase();
    if (supportedExtensions.includes(ext) && payload.body?.data) {
      const content = decodeBase64Url(payload.body.data);
      attachments.push({
        filename,
        fileType: ext,
        fileSize: content.length,
        data: content,
      });
    }
  }

  return {
    messageId,
    threadId: res.data.threadId || messageId,
    subject,
    senderEmail,
    senderName,
    receivedDate,
    bodyText,
    attachments,
  };
}