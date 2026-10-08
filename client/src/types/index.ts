export type Role = 'ADMIN' | 'STUDENT';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  department?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  keywords: string[];
  color: string;
  createdAt: string;
  _count?: { circulars: number };
}

export interface Attachment {
  id: string;
  circularId: string;
  filename: string;
  fileType: string;
  fileSize?: number;
  filePath: string;
  extractedText?: string;
  ocrConfidence?: number;
  isProcessed: boolean;
  createdAt: string;
}

export type ImageSourceType = 'pdf_page' | 'pdf_embed' | 'docx' | 'email_inline';

export interface CircularImage {
  id: string;
  sourceAttachmentId?: string;
  sourceType: ImageSourceType;
  page?: number;
  index?: number;
  filename: string;
  mimeType: string;
  width?: number;
  height?: number;
  isPrimary: boolean;
  thumb?: {
    width: number;
    height: number;
  };
  viewPath: string;
  thumbPath: string;
}

export interface CreatedBy {
  userId?: string;
  fullName?: string;
  email?: string;
  role: 'ADMIN' | 'STUDENT' | 'SYSTEM';
}

export interface ImportantDate {
  title: string;
  date: string;
  dateType?: string;
  rawText?: string;
  confidence?: number;
}

export interface Circular {
  id: string;
  emailMessageId?: string;
  subject: string;
  shortTitle?: string;
  summaryBullets?: string[];
  senderEmail: string;
  senderName?: string;
  receivedDate: string;
  bodyText?: string;
  extractedText?: string;
  categoryId?: number;
  category?: Category;
  priority: Priority;
  priorityOrder?: number;
  tags: string[];
  processingStatus: ProcessingStatus;
  isProcessed: boolean;
  isDuplicate?: boolean;
  duplicateOfDate?: string;
  targetRole?: 'ALL' | 'STUDENT' | 'ADMIN';
  expireDate?: string;
  lastDateWithoutFine?: string;
  lastDateWithFine?: string;
  expirySource?: string;
  expiryConfidence?: number;
  importantDates?: ImportantDate[];
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  images?: CircularImage[];
  primaryThumbnail?: string;
  createdBy?: CreatedBy;
}

export interface SearchFilters {
  q?: string;
  senderName?: string;
  endingToday?: boolean;
  categoryId?: number;
  priority?: Priority;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  tag?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Stats {
  totalCirculars: number;
  totalByCategory: Record<string, number>;
  totalByPriority: Record<string, number>;
  circularsThisWeek: number;
  unprocessedCount: number;
  totalAttachments: number;
}
