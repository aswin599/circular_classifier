import { Schema, model, models, Document } from 'mongoose';

export type UserRole = 'ADMIN' | 'STUDENT';
export type AuthProvider = 'local' | 'google';

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  department?: string;
  isActive: boolean;
  refreshToken?: string;
  authProvider: AuthProvider;
  googleId?: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiry?: Date;
  googleProfilePicture?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: '' },
    fullName: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'STUDENT'], default: 'STUDENT' },
    department: { type: String },
    isActive: { type: Boolean, default: true },
    refreshToken: { type: String },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String, unique: true, sparse: true },
    googleAccessToken: { type: String },
    googleRefreshToken: { type: String },
    googleTokenExpiry: { type: Date },
    googleProfilePicture: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, rawRet) => {
        const ret = rawRet as unknown as Record<string, unknown>;
        ret.id = (rawRet._id as unknown)?.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.refreshToken;
        delete ret.googleAccessToken;
        delete ret.googleRefreshToken;
        delete ret.googleTokenExpiry;
        return ret;
      },
    },
  }
);

export const User = models.User || model<UserDocument>('User', userSchema);

