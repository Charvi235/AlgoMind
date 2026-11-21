
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { randomUUID } from "crypto";

import FloydWarshallMatch from "../models/FloydWarshallMatch";
import GameSession from "../models/GameSession";

import {
  generateFloydWarshallGraph,
} from "../utils/floydWarshallGenerator";

import {
  SOLO_MAX_ROUNDS,
  SOLO_MIN_ROUND_MS,
  SOLO_SESSION_SECONDS,
  SOLO_GRACE_MS,
} from "../config/sessionRules";

export const createFloydWarshallMatch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).userId;
    const { sessionId } = req.query;

    if (
      !userId ||
      !mongoose.Types.ObjectId.isValid(userId) ||
      !sessionId ||
      typeof sessionId !== "string" ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return res.status(400).json({
        message: "Invalid user or session ID",
      });
    }

    const session = await GameSession.findOne({
      _id: sessionId,
      userId,
      gameType: "floyd-warshall",
      mode: "solo",
      status: "in_progress",
    });

    if (!session) {
      return res.status(404).json({
        message: "Active Floyd-Warshall session not found",
      });
    }

    const round = session.roundsCompleted + 1;
     const existingMatch = await FloydWarshallMatch.findOne({
  sessionId,
  userId,
  round,
  completed: false,
});

if (existingMatch) {
  return res.status(200).json({
    graphId: existingMatch.graphId,
    round: existingMatch.round,
    nodes: existingMatch.nodes,
    edges: existingMatch.edges,
    start: existingMatch.start,
    target: existingMatch.target,
   initialMatrix: (() => {
  const matrix = existingMatch.initialMatrix.map((row: number[]) => [...row]);

  for (let step = 0; step < existingMatch.currentStep; step++) {
    const { i, j, newValue } = existingMatch.steps[step];
    matrix[i][j] = newValue;
  }

  return matrix;
})(),
    totalSteps: existingMatch.steps.length,
    currentStep:
      existingMatch.currentStep < existingMatch.steps.length
        ? {
            k: existingMatch.steps[existingMatch.currentStep].k,
            i: existingMatch.steps[existingMatch.currentStep].i,
            j: existingMatch.steps[existingMatch.currentStep].j,
          }
        : null,
  });
}
    if (round > SOLO_MAX_ROUNDS) {
      return res.status(400).json({
        message: "Maximum rounds reached",
      });
    }

    const generated = generateFloydWarshallGraph(round);
    const graphId = randomUUID();

    const match = await FloydWarshallMatch.create({
      graphId,
      userId,
      sessionId,
      round,
      nodes: generated.nodes,
      edges: generated.edges,
      start: generated.start,
      target: generated.target,
      initialMatrix: generated.initialMatrix,
      steps: generated.steps,
      currentStep: 0,
      attempts: 0,
      completed: false,
    });

    return res.status(201).json({
      graphId: match.graphId,
      round: match.round,
      nodes: match.nodes,
      edges: match.edges,
      start: match.start,
      target: match.target,
      initialMatrix: match.initialMatrix,
      totalSteps: match.steps.length,
      currentStep: match.steps[0]
  ? {
      k: match.steps[0].k,
      i: match.steps[0].i,
      j: match.steps[0].j,
    }
  : null,
    });
  } catch (error) {
    next(error);
  }
};

async function countSoloRound(
  match: mongoose.HydratedDocument<any>,
  userId: string
): Promise<void> {
  if (!match.sessionId) return;

  const claimed = await FloydWarshallMatch.updateOne(
    { _id: match._id, completed: false },
    { $set: { completed: true } }
  );

  if (claimed.modifiedCount !== 1) return;

  const now = Date.now();

  if (now - match.createdAt.getTime() < SOLO_MIN_ROUND_MS) return;

  await GameSession.updateOne(
    {
      _id: match.sessionId,
      userId,
      status: "in_progress",
      roundsCompleted: match.round - 1,
      startedAt: {
        $gte: new Date(
          now - SOLO_SESSION_SECONDS * 1000 - SOLO_GRACE_MS
        ),
      },
    },
    { $inc: { roundsCompleted: 1 } }
  );
}

export async function validateFloydWarshallAnswer(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = (req as any).userId as string;
    const { graphId, answer } = (req.body ?? {}) as {
      graphId?: unknown;
      answer?: unknown;
    };

    if (
      typeof graphId !== "string" ||
      !graphId ||
      typeof answer !== "number" ||
      !Number.isFinite(answer)
    ) {
      res.status(400).json({
        error: "Valid graphId and numeric answer are required",
      });
      return;
    }

    const match = await FloydWarshallMatch.findOne({ graphId });

    if (!match || String(match.userId) !== userId) {
      res.status(404).json({
        error: "Match not found or expired",
      });
      return;
    }

    if (match.completed || match.currentStep >= match.steps.length) {
      res.status(409).json({
        error: "This round is already completed",
      });
      return;
    }

    const expectedStep = match.steps[match.currentStep];
    const correct = answer === expectedStep.newValue;

    if (match.sessionId) {
      const updated = await GameSession.updateOne(
        {
          _id: match.sessionId,
          userId,
          status: "in_progress",
        },
        {
          $inc: {
            attempts: 1,
            correctSteps: correct ? 1 : 0,
          },
        }
      );

      if (updated.matchedCount !== 1) {
        res.status(409).json({
          error: "Session is no longer active",
        });
        return;
      }
    }

    if (!correct) {
      await FloydWarshallMatch.updateOne(
        {
          _id: match._id,
          currentStep: match.currentStep,
          completed: false,
        },
        { $inc: { attempts: 1 } }
      );

      res.json({
        correct: false,
        isComplete: false,
      });
      return;
    }

    const nextStep = match.currentStep + 1;
    const isComplete = nextStep === match.steps.length;

    const updatedMatch = await FloydWarshallMatch.updateOne(
      {
        _id: match._id,
        currentStep: match.currentStep,
        completed: false,
      },
      {
        $inc: {
          currentStep: 1,
          attempts: 1,
        },
       
      }
    );

    if (updatedMatch.modifiedCount !== 1) {
      res.status(409).json({
        error: "Answer was already processed. Please retry.",
      });
      return;
    }

    if (isComplete) {
      await countSoloRound(match, userId);
    }

    res.json({
  correct: true,
  isComplete,
  currentStep: isComplete
    ? null
    : {
        k: match.steps[nextStep].k,
        i: match.steps[nextStep].i,
        j: match.steps[nextStep].j,
      },
  stepIndex: nextStep,
  totalSteps: match.steps.length,
});
  } catch (err) {
    next(err);
  }
}

