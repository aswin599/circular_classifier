import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import dbConnect from './config/database';
import { mongoose } from './config/database';
import emailProcessor from './services/emailProcessor';
import textExtractor from './services/textExtractor';
import { classifier } from './services/classifier';
import { startDeadlineReminderJob, stopDeadlineReminderJob } from './jobs/deadlineReminder';

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    stopDeadlineReminderJob();
    await emailProcessor.disconnect();
    await textExtractor.shutdown();
    await mongoose.disconnect();
  } catch (err) {
    logger.error('Error during shutdown:', err);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise);
  logger.error('Reason:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
});

async function start() {
  try {
    // Test database connection
    await dbConnect();
    logger.info('✅ Database connected');

    // Train the classifier from labelled samples (e.g. circularclassifier@gmail.com)
    try {
      await classifier.trainFromSamples();
    } catch (err) {
      logger.warn('Classifier training skipped at boot:', err);
    }

    app.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`Client URL: ${config.clientUrl}`);
      // Mailbox syncing is strictly on-demand (extension "Sync mailbox" button
      // or the in-app sync button) so new mail is never fetched automatically.
      startDeadlineReminderJob();
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
