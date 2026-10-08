import cron, { ScheduledTask } from 'node-cron';
import { config } from '../config';
import { logger } from '../utils/logger';
import { getDeadlinesDueToday, notifyDueDeadlines, isPushConfigured } from '../services/pushService';

let reminderTask: ScheduledTask | null = null;

/**
 * Runs on the configured cron schedule (default 9:00 AM) and pushes a
 * "Deadline Reminder" for every circular deadline happening today.
 */
async function runDeadlineReminder(): Promise<void> {
  try {
    const deadlines = await getDeadlinesDueToday();
    if (deadlines.length === 0) {
      logger.info('Push reminder: no deadlines due today');
      return;
    }

    logger.info(`Push reminder: ${deadlines.length} deadline(s) due today`);
    const sent = await notifyDueDeadlines(deadlines);
    logger.info(`Push reminder: sent ${sent} notification(s)`);
  } catch (err) {
    logger.error('Push reminder job failed:', err);
  }
}

export function startDeadlineReminderJob(): void {
  if (!isPushConfigured()) {
    logger.warn('Deadline reminder job NOT started: VAPID keys not configured.');
    return;
  }

  if (reminderTask) {
    logger.warn('Deadline reminder job already running');
    return;
  }

  const schedule = config.push.reminderSchedule;
  if (!cron.validate(schedule)) {
    logger.error(`Invalid REMINDER_CRON schedule "${schedule}"`);
    return;
  }

  reminderTask = cron.schedule(schedule, () => {
    runDeadlineReminder();
  });

  reminderTask.start();
  logger.info(`Deadline reminder job started (cron: ${schedule})`);
}

export function stopDeadlineReminderJob(): void {
  if (reminderTask) {
    reminderTask.stop();
    reminderTask = null;
    logger.info('Deadline reminder job stopped');
  }
}

// Allow manual trigger for testing / debugging via env flag RUN_REMINDER_ONCE=1
if (process.env.RUN_REMINDER_ONCE === '1') {
  setTimeout(() => {
    runDeadlineReminder();
  }, 0);
}
