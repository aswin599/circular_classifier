import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { logger } from './utils/logger';
import authRoutes from './modules/auth/auth.routes';
import googleAuthRoutes from './modules/auth/google.routes';
import userRoutes from './modules/users/users.routes';
import categoryRoutes from './modules/categories/categories.routes';
import circularRoutes from './modules/circulars/circulars.routes';
import searchRoutes from './modules/search/search.routes';
import adminRoutes from './modules/admin/admin.routes';
import processorRoutes from './modules/processor/processor.routes';
import realtimeRoutes from './modules/realtime/realtime.routes';
import pushRoutes from './modules/push/push.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration.
// Allow the configured client origin plus any http://localhost / http://127.0.0.1
// origin on any port. Opening the client from a slightly different URL (e.g.
// 127.0.0.1 instead of localhost, or a different Vite port) otherwise makes
// browsers block the response, which surfaces as a generic "Network Error".
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === 'null') {
        callback(null, true);
        return;
      }
      const clientUrlTrimmed = (config.clientUrl || '').replace(/\/$/, '');
      const originTrimmed = origin.replace(/\/$/, '');
      const isAllowed =
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
        originTrimmed === clientUrlTrimmed;
      callback(null, isAllowed);
    },
    credentials: true,
  })
);

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/api/auth', limiter);
app.use('/api', limiter);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/google', googleAuthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/circulars', circularRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/processor', processorRoutes);
app.use('/api', realtimeRoutes);
app.use('/api/push', pushRoutes);

// Serve client build if available (production or single-service deployment)
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req: Request, res: Response, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// 404 handler
app.use(notFoundHandler);

// Error handling
app.use(errorHandler);

export default app;
