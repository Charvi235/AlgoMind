import mongoose, { Schema, Document } from "mongoose";

export interface IMatchPlayerResult {
  user_id: mongoose.Types.ObjectId;
  username: string;
  correctCount: number;
  totalRounds: number;
  accuracy: number;
  xpEarned: number;
  result: "win" | "loss" | "tie";
}

export interface IMatchResult extends Document {
  gameType: string;
  roomId: string;
  players: IMatchPlayerResult[];
  startedAt: Date;
  endedAt: Date;
}

const MatchPlayerResultSchema = new Schema<IMatchPlayerResult>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    username: { type: String, required: true },
    correctCount: { type: Number, required: true },
    totalRounds: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    xpEarned: { type: Number, required: true },
    result: { type: String, enum: ["win", "loss", "tie"], required: true },
  },
  { _id: false }
);

const MatchResultSchema = new Schema<IMatchResult>({
  gameType: { type: String, required: true },
  roomId: { type: String, required: true },
  players: { type: [MatchPlayerResultSchema], required: true },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, default: Date.now },
});

MatchResultSchema.index({ "players.user_id": 1 });

export default mongoose.model<IMatchResult>("MatchResult", MatchResultSchema);