import mongoose, { Schema, Document } from "mongoose";

/**
 * A signup that has not been completed yet. Nothing here is a real
 * account: the User document is created only after the email code is
 * verified AND a username is chosen. MongoDB deletes these automatically
 * once expiresAt has passed.
 */
export interface IPendingSignup extends Document {
  email: string;
  passwordHash: string;
  otpHash: string;
  attempts: number;
  lastSentAt: Date;
  verified: boolean;
  expiresAt: Date;
}

const PendingSignupSchema = new Schema<IPendingSignup>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
  verified: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

export default mongoose.model<IPendingSignup>("PendingSignup", PendingSignupSchema);