import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  
  db: {
    url: process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/circulars_db',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  email: {
    host: process.env.EMAIL_HOST || '',
    port: parseInt(process.env.EMAIL_PORT || '993', 10),
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    tls: (process.env.EMAIL_TLS || 'true') === 'true',
    label: process.env.EMAIL_LABEL || 'circulars',
    watchInterval: Number(process.env.EMAIL_WATCH_INTERVAL || '60000'),
  },
  
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  },

  ocr: {
    // Python OCR engine used for scanned/image documents. Override at runtime
    // with OCR_PYTHON_EXE; on Windows 'py -3.13' is the default interpreter.
    pythonExe: process.env.OCR_PYTHON_EXE || (process.platform === 'win32' ? 'py -3.13' : 'python3'),
    // Resolves to <server>/python/ocr_extract.py in both src (tsx) and dist builds.
    scriptPath: process.env.OCR_PYTHON_SCRIPT || path.join(__dirname, '../../python/ocr_extract.py'),
    tesseractCmd: process.env.TESSERACT_CMD || '',
    dpi: parseInt(process.env.OCR_DPI || '300', 10),
    timeoutMs: parseInt(process.env.OCR_TIMEOUT_MS || '180000', 10),
  },

  student: {
    // Students only see circulars sent from this tutor mailbox.
    tutorEmail: (process.env.STUDENT_TUTOR_EMAIL || 'aasswwiinn987@gmail.com').toLowerCase(),
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback',
    scopes: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
  },

  push: {
    // VAPID keys for Web Push notifications
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:' + (process.env.EMAIL_USER || 'admin@localhost'),
    // Reminder cron schedule (default: 9:00 AM local server time)
    reminderSchedule: process.env.REMINDER_CRON || '0 9 * * *',
  },
};
