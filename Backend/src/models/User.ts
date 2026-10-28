import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  usernameLower?: string; // lowercase copy, used for case-insensitive uniqueness
  email: string;
  passwordHash: string;
  age?: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: Date | null;
  totalXP: number;
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    // sparse: older accounts created before this field existed don't have it
    usernameLower: { type: String, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    age: { type: Number },

    current_streak: { type: Number, default: 0 },
    longest_streak: { type: Number, default: 0 },
    last_active_date: { type: Date, default: null },

    totalXP: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Supports the leaderboard query: sort by XP desc, then by sign-up date asc
// (earlier sign-up wins ties), and the "my rank" count query (totalXP > X).
UserSchema.index({ totalXP: -1, created_at: 1 });

export default mongoose.model<IUser>("User", UserSchema);