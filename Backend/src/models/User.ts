import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
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

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  age: { type: Number },

  current_streak:   { type: Number, default: 0 },
  longest_streak:   { type: Number, default: 0 },
  last_active_date: { type: Date, default: null },

  totalXP: { type: Number, default: 0 },

 
});

// Keep updated_at fresh on every save
UserSchema.set("timestamps", { createdAt: "created_at", updatedAt: "updated_at" });
export default mongoose.model<IUser>("User", UserSchema);