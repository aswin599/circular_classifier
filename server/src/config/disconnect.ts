import { logger } from '../utils/logger';
import { mongoose } from '../config/database';

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('Disconnected from MongoDB');
}
