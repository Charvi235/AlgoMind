
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IFloydWarshallNode {
  id: string;
  label: string;
}

export interface IFloydWarshallEdge {
  source: string;
  target: string;
  weight: number;
}

export interface IFloydWarshallStep {
  k: number;
  i: number;
  j: number;
  newValue: number;
}

export interface IFloydWarshallMatch extends Document {
  graphId: string;
  userId?: Types.ObjectId;
  sessionId?: Types.ObjectId;
  round: number;

  nodes: IFloydWarshallNode[];
  edges: IFloydWarshallEdge[];

  start: string;
  target: string;

  initialMatrix: number[][];
  steps: IFloydWarshallStep[];

  currentStep: number;
  attempts: number;
  completed: boolean;

  createdAt: Date;
}

const NodeSchema = new Schema<IFloydWarshallNode>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false }
);

const EdgeSchema = new Schema<IFloydWarshallEdge>(
  {
    source: { type: String, required: true },
    target: { type: String, required: true },
    weight: { type: Number, required: true },
  },
  { _id: false }
);

const StepSchema = new Schema<IFloydWarshallStep>(
  {
    k: { type: Number, required: true },
    i: { type: Number, required: true },
    j: { type: Number, required: true },
    newValue: { type: Number, required: true },
  },
  { _id: false }
);

const FloydWarshallMatchSchema = new Schema<IFloydWarshallMatch>({
  graphId: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  sessionId: { type: Schema.Types.ObjectId, ref: "GameSession" },
  round: { type: Number, default: 1 },

  nodes: { type: [NodeSchema], required: true },
  edges: { type: [EdgeSchema], required: true },

  start: { type: String, required: true },
  target: { type: String, required: true },

  initialMatrix: { type: [[Number]], required: true },
  steps: { type: [StepSchema], required: true },

  currentStep: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now, expires: 3600 },
});

export default mongoose.model<IFloydWarshallMatch>(
  "FloydWarshallMatch",
  FloydWarshallMatchSchema
);
