import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import LinearStructureMatch from "../models/LinearStructureMatch";
import {
  applyLinearOperation,
  generateLinearRound,
  isLinearGameType,
  publicLinearOperation,
} from "../utils/linearStructureEngine";
import mongoose from "mongoose";
import GameSession from "../models/GameSession";

const MAX_ROUND = 50;

export async function createLinearStructureRound(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).userId as string;

    const gameType = req.query.gameType;
    const round = Number(req.query.round ?? 1);
    const sessionId =
      typeof req.query.sessionId === "string" ? req.query.sessionId : "";

    if (!isLinearGameType(gameType)) {
      res.status(400).json({ error: "gameType must be fifo or lifo" });
      return;
    }

    if (!Number.isSafeInteger(round) || round < 1 || round > MAX_ROUND) {
      res.status(400).json({
        error: `round must be an integer from 1 to ${MAX_ROUND}`,
      });
      return;
    }

    if (!mongoose.isValidObjectId(sessionId)) {
      res.status(400).json({ error: "A valid sessionId is required" });
      return;
    }

    const session = await GameSession.findOne({
      _id: sessionId,
      userId,
      gameType,
      mode: "solo",
      status: "in_progress",
    });

    if (!session) {
      res.status(404).json({
        error: "Active solo session not found",
      });
      return;
    }

    const requestId =
      typeof req.query.requestId === "string" ? req.query.requestId : "";

    if (requestId && requestId.length > 100) {
      res.status(400).json({
        error: "requestId must be 100 characters or fewer",
      });
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
          userId: new mongoose.Types.ObjectId(userId),
          sessionId: session._id,
          initialItems: generated.initialItems,
          items: generated.initialItems,
          operations: generated.operations,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (
      match.gameType !== gameType ||
      match.round !== round ||
      match.userId.toString() !== userId ||
      match.sessionId.toString() !== sessionId
    ) {
      res.status(409).json({
        error: "requestId was already used for a different challenge",
      });
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
  const dbSession = await mongoose.startSession();

  try {
    const { challengeId, stepIndex, itemId } = req.body ?? {};
    const authenticatedUserId = (req as any).userId as string;

    if (
      typeof challengeId !== "string" ||
      !challengeId ||
      !Number.isSafeInteger(stepIndex) ||
      (itemId !== undefined && !Number.isSafeInteger(itemId))
    ) {
      res.status(400).json({
        error: "challengeId, stepIndex, and an optional integer itemId are required",
      });
      return;
    }

    let responseData: any;

    await dbSession.withTransaction(async () => {
      const current = await LinearStructureMatch.findOne({
        challengeId,
      }).session(dbSession);

      if (!current) {
        throw Object.assign(new Error("Challenge not found or expired"), {
          status: 404,
        });
      }

      if (current.userId.toString() !== authenticatedUserId) {
        throw Object.assign(new Error("You are not authorized to access this challenge"), {
          status: 403,
        });
      }

      if (current.completed) {
        throw Object.assign(new Error("Challenge is already complete"), {
          status: 409,
        });
      }

      if (stepIndex !== current.stepIndex) {
        throw Object.assign(
          new Error("Challenge state changed; reload the current step"),
          { status: 409 }
        );
      }

      const operation = current.operations[current.stepIndex];

      if (!operation) {
        throw Object.assign(new Error("Challenge has no remaining steps"), {
          status: 409,
        });
      }

      const result = applyLinearOperation(
        current.gameType,
        current.items,
        operation,
        itemId
      );

      const nextStepIndex =
        current.stepIndex + (result.correct ? 1 : 0);

      const isRoundCompleted =
        result.correct &&
        nextStepIndex >= current.operations.length;

      // Update the challenge.
      const updated = await LinearStructureMatch.findOneAndUpdate(
        {
          challengeId,
          userId: current.userId,
          sessionId: current.sessionId,
          stepIndex: current.stepIndex,
          items: current.items,
          completed: false,
        },
        {
          $set: {
            ...(result.correct
              ? {
                  items: result.items,
                  stepIndex: nextStepIndex,
                }
              : {}),
            completed: isRoundCompleted,
          },
          $inc: {
            attempts: 1,
            ...(result.correct ? { correctActions: 1 } : {}),
          },
        },
        {
          new: true,
          session: dbSession,
        }
      );

      if (!updated) {
        throw Object.assign(
          new Error("Challenge state changed; reload the current step"),
          { status: 409 }
        );
      }

      // Update the associated solo GameSession.
      const sessionUpdate = await GameSession.findOneAndUpdate(
        {
          _id: current.sessionId,
          userId: current.userId,
          gameType: current.gameType,
          mode: "solo",
          status: "in_progress",
        },
        {
          $inc: {
            attempts: 1,
            ...(result.correct ? { correctSteps: 1 } : {}),
            ...(isRoundCompleted ? { roundsCompleted: 1 } : {}),
          },
        },
        {
          new: true,
          session: dbSession,
        }
      );

      if (!sessionUpdate) {
        throw Object.assign(
          new Error("Active solo session not found"),
          { status: 404 }
        );
      }

      responseData = {
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
      };
    });

    res.json(responseData);
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    next(error);
  } finally {
    await dbSession.endSession();
  }
}