import mongoose, { Schema, Document, Types } from "mongoose";

export interface IEdge {
  source: string;
  target: string;
  weight: number;
}

export interface INode {
  id: string;
  label: string;
}

export interface IDijkstraMatch extends Document {
  graphId: string;
  userId?: Types.ObjectId;     // who asked for this graph
  sessionId?: Types.ObjectId;  // the solo session it belongs to, if any
  round: number;
  currentNode: string;         // where the player is, tracked by the server
  completed: boolean;          // a graph can complete a round only once
  nodes: INode[];
  edges: IEdge[];
  start: string;
  target: string;
  shortestPath: string[];
  createdAt: Date;
}

const EdgeSchema = new Schema<IEdge>(
  {
    source: { type: String, required: true },
    target: { type: String, required: true },
    weight: { type: Number, required: true },
  },
  { _id: false }
);

const NodeSchema = new Schema<INode>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false }
);

const DijkstraMatchSchema = new Schema<IDijkstraMatch>({
  graphId: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  sessionId: { type: Schema.Types.ObjectId, ref: "GameSession" },
  round: { type: Number, default: 1 },
  currentNode: { type: String, required: true },
  completed: { type: Boolean, default: false },
  nodes: { type: [NodeSchema], required: true },
  edges: { type: [EdgeSchema], required: true },
  start: { type: String, required: true },
  target: { type: String, required: true },
  shortestPath: { type: [String], required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 }, // TTL: auto-delete after 1 hour
});

export default mongoose.model<IDijkstraMatch>("DijkstraMatch", DijkstraMatchSchema);