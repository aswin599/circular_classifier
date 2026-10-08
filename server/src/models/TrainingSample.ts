import { Schema, model, models, Document } from 'mongoose';

export interface TrainingSampleDocument extends Document {
  senderEmail: string;
  subject: string;
  categoryName: string;
  text?: string;
  createdAt: Date;
}

const trainingSampleSchema = new Schema<TrainingSampleDocument>(
  {
    senderEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    subject: { type: String, required: true, trim: true },
    categoryName: { type: String, required: true, trim: true },
    text: { type: String },
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
    },
  }
);

trainingSampleSchema.index({ senderEmail: 1, categoryName: 1 });

export const TrainingSample =
  models.TrainingSample || model<TrainingSampleDocument>('TrainingSample', trainingSampleSchema);