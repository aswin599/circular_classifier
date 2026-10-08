import { Schema, model, models, Document, Types } from 'mongoose';

export interface CircularReadDocument extends Document {
  userId: Types.ObjectId;
  circularId: Types.ObjectId;
  readAt: Date;
}

const circularReadSchema = new Schema<CircularReadDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    circularId: { type: Schema.Types.ObjectId, ref: 'Circular', required: true },
    readAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

circularReadSchema.index({ userId: 1, circularId: 1 }, { unique: true });
circularReadSchema.index({ userId: 1 });

export const CircularRead =
  models.CircularRead || model<CircularReadDocument>('CircularRead', circularReadSchema);
