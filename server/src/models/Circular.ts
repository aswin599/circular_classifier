import { Schema, model, models, Document, Types } from 'mongoose';
import './Category';

export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface AttachmentSubdoc {
  _id: Types.ObjectId;
  filename: string;
  fileType: string;
  fileSize?: number;
  filePath?: string;
  data?: Buffer;
  extractedText?: string;
  ocrConfidence?: number;
  isProcessed: boolean;
  createdAt: Date;
}

export type ImageSourceType = 'pdf_page' | 'pdf_embed' | 'docx' | 'email_inline';

export interface CircularImageSubdoc {
  _id: Types.ObjectId;
  sourceAttachmentId?: Types.ObjectId;
  sourceType: ImageSourceType;
  page?: number;
  index?: number;
  filename: string;
  mimeType: string;
  filePath?: string;
  width?: number;
  height?: number;
  isPrimary: boolean;
  thumb: {
    filePath?: string;
    data?: Buffer;
    width: number;
    height: number;
  };
  createdAt: Date;
}

export interface ImportantDateSubdoc {
  title: string;
  date: Date;
  dateType?: string;
  rawText?: string;
  confidence?: number;
}

export interface CreatedBySubdoc {
  userId?: string;
  fullName?: string;
  email?: string;
  role: 'ADMIN' | 'STUDENT' | 'SYSTEM';
}

export interface CircularDocument extends Document {
  emailMessageId?: string;
  attachmentHash?: string;
  subject: string;
  shortTitle?: string;
  summaryBullets: string[];
  senderEmail: string;
  senderName?: string;
  receivedDate: Date;
  bodyText?: string;
  extractedText?: string;
  categoryId?: Types.ObjectId;
  priority: Priority;
  priorityOrder: number;
  tags: string[];
  processingStatus: ProcessingStatus;
  isProcessed: boolean;
  isDuplicate: boolean;
  duplicateOfDate?: Date;
  targetRole: 'ALL' | 'STUDENT' | 'ADMIN';
  expireDate?: Date;
  lastDateWithoutFine?: Date;
  lastDateWithFine?: Date;
  expirySource?: string;
  expiryConfidence?: number;
  importantDates: ImportantDateSubdoc[];
  createdBy?: CreatedBySubdoc;
  createdAt: Date;
  updatedAt: Date;
  attachments: AttachmentSubdoc[];
  images: CircularImageSubdoc[];
  primaryThumb?: Buffer;
}

const attachmentSchema = new Schema<AttachmentSubdoc>(
  {
    filename: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number },
    filePath: { type: String, required: false },
    data: { type: Buffer },
    extractedText: { type: String },
    ocrConfidence: { type: Number },
    isProcessed: { type: Boolean, default: false },
  },
  {
    timestamps: false,
    toJSON: {
      transform: (_doc, rawRet) => {
        const ret = rawRet as unknown as Record<string, unknown>;
        if (ret._id) {
          ret.id = String(ret._id);
          delete ret._id;
        }
        // Don't serialize raw binary buffer to JSON API responses
        if (ret.data) {
          delete ret.data;
        }
        return ret;
      },
    },
  }
);

const importantDateSchema = new Schema<ImportantDateSubdoc>(
  {
    title: { type: String, required: true },
    date: { type: Date, required: true },
    dateType: { type: String, default: 'general' },
    rawText: { type: String },
    confidence: { type: Number },
  },
  { _id: false }
);

const circularImageSchema = new Schema<CircularImageSubdoc>(
  {
    sourceAttachmentId: { type: Schema.Types.ObjectId },
    sourceType: {
      type: String,
      enum: ['pdf_page', 'pdf_embed', 'docx', 'email_inline'],
      required: true,
    },
    page: { type: Number },
    index: { type: Number },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    filePath: { type: String },
    width: { type: Number },
    height: { type: Number },
    isPrimary: { type: Boolean, default: false },
    thumb: {
      type: {
        filePath: { type: String },
        data: { type: Buffer },
        width: { type: Number, default: 0 },
        height: { type: Number, default: 0 },
      },
      _id: false,
      default: () => ({ width: 0, height: 0 }),
    },
  },
  {
    timestamps: false,
    toJSON: {
      transform: (_doc, rawRet) => {
        const ret = rawRet as unknown as Record<string, unknown>;
        if (ret._id) {
          ret.id = String(ret._id);
          delete ret._id;
        }
        // Keep the primary thumbnail readily available while hiding the
        // per-image binary buffers from JSON API responses.
        const thumb = ret.thumb as Record<string, unknown> | undefined;
        if (thumb && thumb.data) {
          delete (thumb as Record<string, unknown>).data;
        }
        return ret;
      },
    },
  }
);

const circularSchema = new Schema<CircularDocument>(
  {
    emailMessageId: { type: String, unique: true, sparse: true },
    attachmentHash: { type: String },
    subject: { type: String, required: true, trim: true },
    shortTitle: { type: String, trim: true },
    summaryBullets: { type: [String], default: [] },
    senderEmail: { type: String, required: true, trim: true, lowercase: true },
    senderName: { type: String },
    receivedDate: { type: Date, default: Date.now },
    bodyText: { type: String },
    extractedText: { type: String },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    priority: { type: String, enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'], default: 'NORMAL' },
    priorityOrder: { type: Number, default: 2 },
    tags: { type: [String], default: [] },
    processingStatus: { type: String, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
    isProcessed: { type: Boolean, default: false },
    isDuplicate: { type: Boolean, default: false },
    duplicateOfDate: { type: Date },
    targetRole: { type: String, enum: ['ALL', 'STUDENT', 'ADMIN'], default: 'ALL' },
    expireDate: { type: Date },
    lastDateWithoutFine: { type: Date },
    lastDateWithFine: { type: Date },
    expirySource: { type: String },
    expiryConfidence: { type: Number },
    importantDates: { type: [importantDateSchema], default: [] },
    createdBy: {
      type: {
        userId: { type: String },
        fullName: { type: String },
        email: { type: String },
        role: { type: String, enum: ['ADMIN', 'STUDENT', 'SYSTEM'], default: 'SYSTEM' },
      },
      _id: false,
      default: () => ({ role: 'SYSTEM' }),
    },
    attachments: { type: [attachmentSchema], default: [] },
    images: { type: [circularImageSchema], default: [] },
    primaryThumb: { type: Buffer },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, rawRet) => {
        const ret = rawRet as unknown as Record<string, unknown>;
        ret.id = (rawRet._id as unknown)?.toString();
        delete ret._id;
        delete ret.__v;
        // Thumbnail buffers are exposed explicitly by the API serializer as a
        // data URL; never leak raw base64 into generic JSON payloads.
        if (ret.primaryThumb) {
          delete ret.primaryThumb;
        }
        return ret;
      },
      virtuals: true,
    },
  }
);

circularSchema.virtual('category', {
  ref: 'Category',
  localField: 'categoryId',
  foreignField: '_id',
  justOne: true,
});

// Indexes for fast search, filtering and composite priority-date sorting
circularSchema.index({ priorityOrder: -1, receivedDate: -1 });
circularSchema.index({ receivedDate: -1 });
circularSchema.index({ categoryId: 1 });
circularSchema.index({ priority: 1 });
circularSchema.index({ processingStatus: 1 });
circularSchema.index({ tags: 1 });
circularSchema.index({ expireDate: 1 });
circularSchema.index({ targetRole: 1 });
circularSchema.index({ isDuplicate: 1 });
circularSchema.index({ 'createdBy.role': 1 });
circularSchema.index({ 'createdBy.userId': 1 });

// Text indexes for full-text search
circularSchema.index(
  { subject: 'text', shortTitle: 'text', bodyText: 'text', extractedText: 'text', senderName: 'text', senderEmail: 'text' },
  {
    name: 'circular_text_index',
    weights: { shortTitle: 12, subject: 10, extractedText: 5, bodyText: 3, senderName: 2, senderEmail: 1 },
  }
);

export const Circular = models.Circular || model<CircularDocument>('Circular', circularSchema);

