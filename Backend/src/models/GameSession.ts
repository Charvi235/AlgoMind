import mongoose, { Schema, Document, Types } from "mongoose";

export interface IGameSession extends Document {
  userId: Types.ObjectId;
  gameType: string;
  mode: "solo" | "live";
  status: "in_progress" | "completed" | "abandoned";
  roundsCompleted: number;
  attempts: number;      // every step the player tried (solo)
  correctSteps: number;  // steps that were correct (solo)
  accuracy: number;      // 0-100
  xpEarned: number;
  roomId?: string;       // live matches only
  startedAt: Date;
  completedAt?: Date;
  durationSeconds: number;
}

const GameSessionSchema = new Schema<IGameSession>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  gameType: { type: String, required: true },
  mode: { type: String, enum: ["solo", "live"], required: true },
  status: { type: String, enum: ["in_progress", "completed", "abandoned"], default: "in_progress" },
  roundsCompleted: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 },
  correctSteps: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
  xpEarned: { type: Number, default: 0 },
  roomId: { type: String },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date },
  durationSeconds: { type: Number, default: 0 },
});

GameSessionSchema.index({ userId: 1, completedAt: -1 });
GameSessionSchema.index({ gameType: 1, xpEarned: -1 });

export default mongoose.model<IGameSession>("GameSession", GameSessionSchema);