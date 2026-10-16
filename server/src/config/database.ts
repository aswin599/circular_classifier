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
  const dbUrl = config.db.url;

  if (config.env === 'production' && (!process.env.DATABASE_URL && !process.env.MONGODB_URI)) {
    const msg = '❌ DATABASE_URL is not set in Render Environment Variables! Please add your MongoDB Atlas connection string (DATABASE_URL=mongodb+srv://...) in Render.';
    console.error(msg);
    throw new Error(msg);
  }

  if (dbUrl.includes('<password>') || dbUrl.includes('<PASSWORD>')) {
    const msg = '❌ DATABASE_URL contains "<password>" placeholder! Please replace "<password>" with your real MongoDB Atlas database user password in Render Environment Variables.';
    console.error(msg);
    throw new Error(msg);
  }

  if (globalAny.mongoose?.conn) {
    return globalAny.mongoose.conn;
  }

  const cache = globalAny.mongoose ?? (globalAny.mongoose = { conn: null, promise: null });

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(dbUrl, {
        serverSelectionTimeoutMS: 10000,
      })
      .then((m) => {
        console.log('✅ MongoDB connected successfully');
        logger.info('✅ MongoDB connected');
        return m;
      })
      .catch((err) => {
        console.error('❌ MongoDB connection failed:', err.message || err);
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
