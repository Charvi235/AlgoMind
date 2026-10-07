import mongoose, { Schema, Document } from "mongoose";

export interface IBstMatch extends Document {
  userId?: string;
  numbers: number[];
  score: number;
  timeSpentSeconds: number;
  completed: boolean;
  createdAt: Date;
}

const BstMatchSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
    numbers: { type: [Number], required: true },
    score: { type: Number, default: 0 },
    timeSpentSeconds: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IBstMatch>("BstMatch", BstMatchSchema);