import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import SortingMatch from "../models/SortingMatch";
import { generateSortRound, type SortStep } from "../utils/sortingEngine";

export function publicStep(step: SortStep | undefined): Omit<SortStep, "answer"> | null {
  if (!step) return null;
  const visibleStep: Omit<SortStep, "answer"> = {
    kind: step.kind,
    arr: step.arr.map(({ id, value }) => ({ id, value })),
    focus: [...step.focus],
    sorted: [...step.sorted],
  };
  if (step.range) visibleStep.range = [...step.range];
  if (step.prompt !== undefined) visibleStep.prompt = step.prompt;
  if (step.choices) {
    visibleStep.choices = step.choices.map(({ value, label }) => ({ value, label }));
  }
  return visibleStep;
}

export async function createSortingRound(req: Request, res: Response, next: NextFunction) {
  try {
    const requestedRound = Number(req.query.round ?? 1);
    if (!Number.isSafeInteger(requestedRound) || requestedRound < 1) {
      res.status(400).json({ error: "round must be a positive integer" });
      return;
    }

    const generated = generateSortRound(requestedRound);
    const roundId = randomUUID();
    await SortingMatch.create({
      roundId,
      algo: generated.algo,
      steps: generated.steps,
      finalArr: generated.finalArr,
    });

    res.json({
      roundId,
      algo: generated.algo,
      stepIndex: 0,
      totalSteps: generated.steps.length,
      step: publicStep(generated.steps[0]),
      completed: generated.steps.length === 0,
    });
  } catch (error) {
    next(error);
  }
}

export async function validateSortingStep(req: Request, res: Response, next: NextFunction) {
  try {
    const { roundId, answer } = req.body as { roundId?: string; answer?: unknown };
    if (!roundId || answer === undefined) {
      res.status(400).json({ error: "roundId and answer are required" });
      return;
    }

    const match = await SortingMatch.findOne({ roundId });
    if (!match) {
      res.status(404).json({ error: "Sorting round not found or expired" });
      return;
    }
    if (match.completed) {
      res.status(409).json({ error: "Sorting round is already complete" });
      return;
    }

    const currentStep = match.steps[match.stepIndex];
    if (!currentStep) {
      res.status(409).json({ error: "Sorting round has no remaining step" });
      return;
    }

    match.attempts += 1;
    const correct =
      typeof answer === typeof currentStep.answer && answer === currentStep.answer;
    if (correct) {
      match.stepIndex += 1;
      match.completed = match.stepIndex >= match.steps.length;
    } else {
      match.mistakes += 1;
    }
    await match.save();

    res.json({
      correct,
      completed: match.completed,
      stepIndex: match.stepIndex,
      totalSteps: match.steps.length,
      step: correct ? publicStep(match.steps[match.stepIndex]) : publicStep(currentStep),
      finalArr: match.completed ? match.finalArr : undefined,
    });
  } catch (error) {
    next(error);
  }
}
