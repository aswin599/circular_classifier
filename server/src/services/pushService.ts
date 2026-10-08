import webpush from 'web-push';
import { Types } from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';
import { PushSubscription } from '../models/PushSubscription';
import { Circular } from '../models/Circular';
import { User } from '../models/User';
import type { UserRole } from '../models/User';

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  data?: Record<string, unknown>;
}

/**
 * Deadline incl. the circular it came from, which role it targets and when it is due.
 */
export interface DueDeadline {
  deadline: Date;
  kind: string;
  title: string;
  circularId: string;
  circularSubject: string;
  targetRole: 'ALL' | 'STUDENT' | 'ADMIN';
}

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;

  const { publicKey, privateKey, subject } = config.push;
  if (!publicKey || !privateKey) {
    logger.warn(
      'Web Push is not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in the environment. ' +
        'Generate keys with: npx web-push generate-vapid-keys --json'
    );
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(config.push.publicKey && config.push.privateKey);
}

/**
 * Query circulars that have any deadline occurring "today" (the calendar day of
 * `referenceDay`). Covers expireDate, lastDateWithoutFine, lastDateWithFine and
 * the importantDates[] sub-documents.
 */
export async function getDeadlinesDueToday(referenceDay: Date = new Date()): Promise<DueDeadline[]> {
  const startOfDay = new Date(referenceDay);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const range = { $gte: startOfDay, $lt: endOfDay };

  const circulars = await Circular.find({
    $or: [
      { expireDate: range },
      { lastDateWithoutFine: range },
      { lastDateWithFine: range },
      { 'importantDates.date': range },
    ],
  })
    .select('_id subject expireDate lastDateWithoutFine lastDateWithFine importantDates targetRole')
    .lean();

  const deadlines: DueDeadline[] = [];

  for (const c of circulars) {
    const targetRole = (c.targetRole as 'ALL' | 'STUDENT' | 'ADMIN') || 'ALL';
    const push = (date: Date | undefined, kind: string, title: string) => {
      if (date && date >= startOfDay && date < endOfDay) {
        deadlines.push({
          deadline: date,
          kind,
          title,
          circularId: String(c._id),
          circularSubject: c.subject,
          targetRole,
        });
      }
    };

    if (c.expireDate) push(c.expireDate, 'expireDate', 'Expiry');
    if (c.lastDateWithoutFine) push(c.lastDateWithoutFine, 'lastDateWithoutFine', 'Last date without fine');
    if (c.lastDateWithFine) push(c.lastDateWithFine, 'lastDateWithFine', 'Last date with fine');
    for (const d of c.importantDates || []) {
      push(d.date, d.dateType || 'importantDate', d.title || 'Deadline');
    }
  }

  return deadlines;
}

function rolesForTarget(target: 'ALL' | 'STUDENT' | 'ADMIN'): UserRole[] {
  if (target === 'ALL') return ['ADMIN', 'STUDENT'];
  if (target === 'STUDENT') return ['STUDENT'];
  return ['ADMIN'];
}

/**
 * Send a push notification to every subscribed user who matches the circular's
 * target audience. Removes subs that throw 404/410 (expired).
 */
export async function notifyDueDeadlines(deadlines: DueDeadline[]): Promise<number> {
  if (!ensureVapid() || deadlines.length === 0) return 0;

  let sent = 0;

  for (const deadline of deadlines) {
    const allowedRoles = rolesForTarget(deadline.targetRole);
    const subscriptions = await PushSubscription.find()
      .where('userId')
      .in(
        await getActiveUserIds(allowedRoles)
      );

    if (subscriptions.length === 0) continue;

    const payload: PushNotificationPayload = {
      title: 'Deadline Reminder',
      body: `${deadline.title} — "${deadline.circularSubject}" is due today.`,
      url: `/circulars/${deadline.circularId}`,
      data: { kind: 'deadline-reminder', circularId: deadline.circularId, deadline: deadline.deadline.toISOString() },
    };

    const serialized = JSON.stringify(payload);

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          },
          serialized,
          { TTL: 60 * 60 * 24 }
        );
        sent++;
      } catch (err: any) {
        const status = err?.statusCode;
        // 404/410 mean the subscription is gone/unsubscribed - clean it up.
        if (status === 404 || status === 410) {
          logger.info(`Removing stale push subscription for user ${sub.userId}`);
          await PushSubscription.deleteOne({ _id: sub._id });
        } else {
          logger.error(`Failed to send push notification (status ${status || 'unknown'}): ${err?.message || err}`);
        }
      }
    }
  }

  return sent;
}

async function getActiveUserIds(roles: UserRole[]): Promise<Types.ObjectId[]> {
  const users = await User.find({ role: { $in: roles }, isActive: true }).select('_id').lean();
  return users.map((u) => u._id as Types.ObjectId);
}
