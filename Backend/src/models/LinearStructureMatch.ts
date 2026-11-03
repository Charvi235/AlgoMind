import mongoose, { Schema, type Document } from "mongoose";
import type {
  LinearGameType,
  LinearItem,
  LinearOperation,
} from "../utils/linearStructureEngine";

export interface ILinearStructureMatch extends Document {
  challengeId: string;
  gameType: LinearGameType;
  round: number;
  initialItems: LinearItem[];
  items: LinearItem[];
  operations: LinearOperation[];
  stepIndex: number;
  attempts: number;
  correctActions: number;
  completed: boolean;
  createdAt: Date;
}

const ItemSchema = new Schema<LinearItem>(
  {
    id: { type: Number, required: true },
    value: { type: Number, required: true },
  },
  { _id: false }
);

const OperationSchema = new Schema<LinearOperation>(
  {
    type: { type: String, enum: ["add", "remove"], required: true },
    item: { type: ItemSchema },
  },
  { _id: false }
);

const LinearStructureMatchSchema = new Schema<ILinearStructureMatch>({
  challengeId: { type: String, required: true, unique: true },
  gameType: { type: String, enum: ["fifo", "lifo"], required: true },
  round: { type: Number, required: true },
  initialItems: { type: [ItemSchema], required: true },
  items: { type: [ItemSchema], required: true },
  operations: { type: [OperationSchema], required: true },
  stepIndex: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 },
  correctActions: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 3600 },
});

export default mongoose.model<ILinearStructureMatch>(
  "LinearStructureMatch",
  LinearStructureMatchSchema
);
