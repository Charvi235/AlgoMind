import mongoose, { Schema, Document } from "mongoose";

export interface IUserActivity extends Document {
  user_id: mongoose.Types.ObjectId;
  activity_date: Date;
  submission_count: number;
  points_earned: number;
}

const UserActivitySchema = new Schema<IUserActivity>({
  user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  activity_date: { type: Date, required: true },
  submission_count: { type: Number, default: 0 },
  points_earned: { type: Number, default: 0 },
});

UserActivitySchema.index({ user_id: 1, activity_date: 1 }, { unique: true });

export default mongoose.model<IUserActivity>("UserActivity", UserActivitySchema);