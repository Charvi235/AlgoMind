import mongoose, { Schema, Document } from "mongoose";

/**
 * A password-reset request that has not been completed yet.
 * MongoDB deletes these automatically once expiresAt has passed.
 */
export interface IPasswordReset extends Document {
  email: string;
  otpHash: string;
  attempts: number;
  lastSentAt: Date;
  verified: boolean;
  resetTokenHash?: string; // proof of a verified code, used to set a new password
  expiresAt: Date;
}

const PasswordResetSchema = new Schema<IPasswordReset>({
  email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
  otpHash:        { type: String, required: true },
  attempts:       { type: Number, default: 0 },
  lastSentAt:     { type: Date, default: Date.now },
  verified:       { type: Boolean, default: false },
  resetTokenHash: { type: String },
  expiresAt:      { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

export default mongoose.model<IPasswordReset>("PasswordReset", PasswordResetSchema);
