import { Schema, model, models, Document, Types } from 'mongoose';

export interface WebPushKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionDocument extends Document {
  userId: Types.ObjectId;
  endpoint: string;
  keys: WebPushKeys;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const webPushKeysSchema = new Schema<WebPushKeys>(
  {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  { _id: false }
);

const pushSubscriptionSchema = new Schema<PushSubscriptionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // The browser push endpoint URL (unique per device/browser)
    endpoint: { type: String, required: true, unique: true },
    keys: { type: webPushKeysSchema, required: true },
    userAgent: { type: String },
  },
  { timestamps: true }
);

export const PushSubscription =
  models.PushSubscription || model<PushSubscriptionDocument>('PushSubscription', pushSubscriptionSchema);
