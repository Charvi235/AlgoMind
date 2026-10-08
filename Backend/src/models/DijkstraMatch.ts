/**
 * DijkstraMatch.ts
 *
 * Temporary server-side storage for an in-progress Dijkstra round.
 * The shortestPath is NEVER sent to the client — only used here to
 * validate each step the player takes. Documents auto-expire after
 * 1 hour via the TTL index, so no manual cleanup job is needed.
 */


import mongoose, { Schema, Document } from "mongoose";


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
  nodes: { type: [NodeSchema], required: true },
  edges: { type: [EdgeSchema], required: true },
  start: { type: String, required: true },
  target: { type: String, required: true },
  shortestPath: { type: [String], required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 }, // TTL: auto-delete after 1 hour
});


export default mongoose.model<IDijkstraMatch>("DijkstraMatch", DijkstraMatchSchema);