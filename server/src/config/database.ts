import mongoose from 'mongoose';
import { config } from './index';
import { logger } from '../utils/logger';

declare global {
   
  var mongoose: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
}

interface CachedConnection {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalAny = globalThis as unknown as { mongoose?: CachedConnection };

async function dbConnect(): Promise<typeof mongoose> {
  if (!config.db.url) {
    throw new Error('DATABASE_URL is not defined in environment');
  }

  if (globalAny.mongoose?.conn) {
    return globalAny.mongoose.conn;
  }

  const cache = globalAny.mongoose ?? (globalAny.mongoose = { conn: null, promise: null });

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(config.db.url, {
        serverSelectionTimeoutMS: 10000,
      })
      .then((m) => {
        logger.info('✅ MongoDB connected');
        return m;
      })
      .catch((err) => {
        logger.error('MongoDB connection failed:', err);
        cache.promise = null;
        throw err;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

export default dbConnect;
export { mongoose };
