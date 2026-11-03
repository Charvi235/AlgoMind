import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import LinearStructureMatch from "../models/LinearStructureMatch";
import {
  applyLinearOperation,
  generateLinearRound,
  isLinearGameType,
  publicLinearOperation,
} from "../utils/linearStructureEngine";

const MAX_ROUND = 50;

export async function createLinearStructureRound(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const gameType = req.query.gameType;
    const round = Number(req.query.round ?? 1);
    if (!isLinearGameType(gameType)) {
      res.status(400).json({ error: "gameType must be fifo or lifo" });
      return;
    }
    if (!Number.isSafeInteger(round) || round < 1 || round > MAX_ROUND) {
      res.status(400).json({ error: `round must be an integer from 1 to ${MAX_ROUND}` });
      return;
    }

    const requestId = typeof req.query.requestId === "string" ? req.query.requestId : "";
    if (requestId && requestId.length > 100) {
      res.status(400).json({ error: "requestId must be 100 characters or fewer" });
      return;
    }

    const generated = generateLinearRound(gameType, round);
    const challengeId = requestId || randomUUID();
    const match = await LinearStructureMatch.findOneAndUpdate(
      { challengeId },
      {
        $setOnInsert: {
          challengeId,
          gameType,
          round,
          initialItems: generated.initialItems,
          items: generated.initialItems,
          operations: generated.operations,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (match.gameType !== gameType || match.round !== round) {
      res.status(409).json({ error: "requestId was already used for a different challenge" });
      return;
    }

    res.status(201).json({
      challengeId: match.challengeId,
      gameType: match.gameType,
      round: match.round,
      totalSteps: match.operations.length,
      stepIndex: match.stepIndex,
      items: match.items,
      step: match.completed
        ? null
        : publicLinearOperation(match.operations[match.stepIndex]),
      completed: match.completed,
    });
  } catch (error) {
    next(error);
  }
}

export async function validateLinearStructureStep(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { challengeId, stepIndex, itemId } = req.body ?? {};
    if (
      typeof challengeId !== "string" ||
      !challengeId ||
      !Number.isSafeInteger(stepIndex) ||
      (itemId !== undefined && !Number.isSafeInteger(itemId))
    ) {
      res.status(400).json({ error: "challengeId, stepIndex, and an optional integer itemId are required" });
      return;
    }

    const current = await LinearStructureMatch.findOne({ challengeId });
    if (!current) {
      res.status(404).json({ error: "Challenge not found or expired" });
      return;
    }
    if (current.completed) {
      res.status(409).json({ error: "Challenge is already complete" });
      return;
    }
    if (stepIndex !== current.stepIndex) {
      res.status(409).json({ error: "Challenge state changed; reload the current step" });
      return;
    }

    const operation = current.operations[current.stepIndex];
    if (!operation) {
      res.status(409).json({ error: "Challenge has no remaining steps" });
      return;
    }

    const result = applyLinearOperation(
      current.gameType,
      current.items,
      operation,
      itemId
    );
    const nextStepIndex = current.stepIndex + (result.correct ? 1 : 0);
    const updated = await LinearStructureMatch.findOneAndUpdate(
      {
        challengeId,
        stepIndex: current.stepIndex,
        items: current.items,
        completed: false,
      },
      {
        $set: {
          ...(result.correct ? { items: result.items, stepIndex: nextStepIndex } : {}),
          completed: result.correct && nextStepIndex >= current.operations.length,
        },
        $inc: {
          attempts: 1,
          ...(result.correct ? { correctActions: 1 } : {}),
        },
      },
      { new: true }
    );

    if (!updated) {
      res.status(409).json({ error: "Challenge state changed; reload the current step" });
      return;
    }

    res.json({
      correct: result.correct,
      challengeId: updated.challengeId,
      gameType: updated.gameType,
      round: updated.round,
      totalSteps: updated.operations.length,
      stepIndex: updated.stepIndex,
      items: updated.items,
      step: updated.completed
        ? null
        : publicLinearOperation(updated.operations[updated.stepIndex]),
      completed: updated.completed,
      attempts: updated.attempts,
      correctActions: updated.correctActions,
      score: updated.completed ? updated.correctActions * 10 : 0,
    });
  } catch (error) {
    next(error);
  }
}
