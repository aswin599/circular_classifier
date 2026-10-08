import { Types } from 'mongoose';
import { config } from '../config';
import { CircularRead } from '../models/CircularRead';

/**
 * Restricts students to circulars received from the configured tutor mailbox.
 * Admins remain unrestricted. Mutates and returns the given Mongo filter.
 */
export function applyAudienceFilter(filter: Record<string, any>, role?: string): Record<string, any> {
  if (role === 'STUDENT') {
    filter.senderEmail = config.student.tutorEmail;
  }
  return filter;
}

/** Circular ids the given user has marked as read. */
export async function getReadCircularIds(userId?: string): Promise<Types.ObjectId[]> {
  if (!userId) return [];
  const rows = await CircularRead.find({ userId }).select('circularId').lean();
  return rows.map((row) => row.circularId as Types.ObjectId);
}

/** Excludes circulars the given user has already marked as read. */
export function applyUnreadFilter(filter: Record<string, any>, readIds: Types.ObjectId[]): Record<string, any> {
  if (readIds.length > 0) {
    filter._id = { $nin: readIds };
  }
  return filter;
}
