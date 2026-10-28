import mongoose, { Schema, Document } from "mongoose";

export interface IBstMatch extends Document {
  matchId: string;
  userId?: string;
  numbers: number[];
  score: number;
  correctCount: number;
  attempts: number;
  accuracy: number;
  completed: boolean;
  finalized: boolean;
  expired: boolean;
  requestId?: string;
  deadlineAt: Date;
  xpRecorded: boolean;
  createdAt: Date;
}

const BstMatchSchema: Schema = new Schema({
  matchId: { type: String, required: true, unique: true },
  userId: { type: String, required: false },
  numbers: { type: [Number], required: true },
  score: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  finalized: { type: Boolean, default: false },
  expired: { type: Boolean, default: false },
  requestId: { type: String, required: false },
  deadlineAt: { type: Date, required: true, default: () => new Date(Date.now() + 60_000) },
  xpRecorded: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

BstMatchSchema.index({ requestId: 1 }, { unique: true, sparse: true });

export default mongoose.model<IBstMatch>("BstMatch", BstMatchSchema);