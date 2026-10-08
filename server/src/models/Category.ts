import { Schema, model, models, Document, Types } from 'mongoose';

export interface CategoryDocument extends Document {
  name: string;
  description?: string;
  keywords: string[];
  color: string;
  createdAt: Date;
  circularCount?: number;
}

const categorySchema = new Schema<CategoryDocument>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String },
    keywords: { type: [String], default: [] },
    color: { type: String, default: '#3B82F6' },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, rawRet) => {
        const ret = rawRet as unknown as Record<string, unknown>;
        ret.id = (rawRet._id as unknown)?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
      virtuals: true,
    },
  }
);

categorySchema.virtual('circularCount', {
  ref: 'Circular',
  localField: '_id',
  foreignField: 'categoryId',
  count: true,
});

export const Category = models.Category || model<CategoryDocument>('Category', categorySchema);

