import mongoose, { Schema, Document } from "mongoose";

export interface IBstMatch extends Document {
  matchId: string;
  userId?: string;
  numbers: number[];
  score: number;
  completed: boolean;
  createdAt: Date;
}

const BstMatchSchema: Schema = new Schema({
  matchId: { type: String, required: true, unique: true },
  userId: { type: String, required: false },
  numbers: { type: [Number], required: true },
  score: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IBstMatch>("BstMatch", BstMatchSchema);