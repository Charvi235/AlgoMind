import mongoose, { Schema, type Document } from "mongoose";
import type { SortStep, SortItem, SortAlgo } from "../utils/sortingEngine";

export interface ISortingMatch extends Document {
  roundId: string;
  algo: SortAlgo;
  steps: SortStep[];
  finalArr: SortItem[];
  stepIndex: number;
  attempts: number;
  mistakes: number;
  completed: boolean;
  createdAt: Date;
}

const SortItemSchema = new Schema<SortItem>(
  {
    id: { type: Number, required: true },
    value: { type: Number, required: true },
  },
  { _id: false }
);

const SortChoiceSchema = new Schema(
  {
    value: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false }
);

const SortStepSchema = new Schema(
  {
    kind: { type: String, enum: ["swap-or-keep", "pick-min", "pick-choice"], required: true },
    arr: { type: [SortItemSchema], required: true },
    focus: { type: [Number], required: true },
    sorted: { type: [Number], required: true },
    range: { type: [Number] },
    prompt: { type: String },
    choices: { type: [SortChoiceSchema] },
    answer: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const SortingMatchSchema = new Schema<ISortingMatch>({
  roundId: { type: String, required: true, unique: true },
  algo: { type: String, enum: ["bubble", "insertion", "selection", "merge", "quick", "heap"], required: true },
  steps: { type: [SortStepSchema], required: true },
  finalArr: { type: [SortItemSchema], required: true },
  stepIndex: { type: Number, default: 0 },
  attempts: { type: Number, default: 0 },
  mistakes: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 3600 },
});

export default mongoose.model<ISortingMatch>("SortingMatch", SortingMatchSchema);
