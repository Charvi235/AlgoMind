import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import GameSession, { type IGameSession } from "../models/GameSession";
import { recordActivityAndXP } from "../utils/activityTracker";
// <<<<<<< HEAD
// import BstMatch from "../models/BstMatch";
// =======
import {
  XP_PER_ROUND,
  SOLO_SCORED_GAMES,
  SOLO_SESSION_SECONDS,
} from "../config/sessionRules";
// >>>>>>> main

// The result is always derived from the server's own counters, so every
// request for a finished session returns exactly the same numbers.
function resultOf(s: Pick<IGameSession, "roundsCompleted" | "attempts" | "correctSteps">) {
  return {
    roundsCompleted: s.roundsCompleted,
    accuracy: s.attempts > 0 ? Math.round((s.correctSteps / s.attempts) * 100) : 0,
    xp: s.roundsCompleted * XP_PER_ROUND,
  };
}

export async function startSoloSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
// <<<<<<< HEAD
//     const { correctCount, gameType, matchIds } = req.body as {
//       correctCount?: number;
//       gameType?: string;
//       matchIds?: unknown;
//     };
//
//     let xpEarned: number;
//     if (gameType === "bst" && Array.isArray(matchIds)) {
//       const ids = matchIds.filter((id): id is string => typeof id === "string" && id.length > 0);
//       const rounds = await BstMatch.find({ matchId: { $in: ids }, userId }).select("matchId score xpRecorded").lean();
//       const awardable = rounds.filter((round) => !round.xpRecorded);
//       xpEarned = awardable.reduce((sum, round) => sum + round.score, 0);
//
//       if (awardable.length > 0) {
//         await BstMatch.updateMany(
//           { _id: { $in: awardable.map((round) => round._id) }, xpRecorded: false },
//           { $set: { xpRecorded: true } }
//         );
//       }
//     } else {
//       if (typeof correctCount !== "number" || correctCount < 0) {
//         res.status(400).json({ error: "correctCount must be a non-negative number" });
//         return;
//       }
//       xpEarned = correctCount * 10;
//     }
//
//     await recordActivityAndXP(userId, xpEarned);
// =======
    const gameType = typeof req.body?.gameType === "string" ? req.body.gameType : "";

    if (!SOLO_SCORED_GAMES.has(gameType)) {
      res.status(400).json({ error: "XP is not available for this game yet." });
      return;
    }

    // One live solo session per user at a time.
    await GameSession.updateMany(
      { userId, mode: "solo", status: "in_progress" },
      { $set: { status: "abandoned" } }
    );

    const session = await GameSession.create({
      userId,
      gameType,
      mode: "solo",
      status: "in_progress",
      startedAt: new Date(),
    });
// >>>>>>> main

    res.status(201).json({ sessionId: session.id, durationSeconds: SOLO_SESSION_SECONDS });
  } catch (err) {
    next(err);
  }
}

export async function finishSoloSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
    if (!mongoose.isValidObjectId(sessionId)) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const now = new Date();

    // Atomic: only ONE request can move a session from in_progress to
    // completed, so a refresh or double click can never award XP twice.
    const finished = await GameSession.findOneAndUpdate(
      { _id: sessionId, userId, mode: "solo", status: "in_progress" },
      { $set: { status: "completed", completedAt: now } },
      { returnDocument: "after" }
    );

    if (!finished) {
      const existing = await GameSession.findOne({ _id: sessionId, userId, mode: "solo" });
      if (existing?.status === "completed") {
        res.json(resultOf(existing));
        return;
      }
      res.status(404).json({ error: "Session not found or no longer active." });
      return;
    }

    const result = resultOf(finished);
    finished.accuracy = result.accuracy;
    finished.xpEarned = result.xp;
    finished.durationSeconds = Math.round((now.getTime() - finished.startedAt.getTime()) / 1000);
    await finished.save();

    // A session counts as activity (streak) once at least one round was completed.
    if (result.roundsCompleted > 0) await recordActivityAndXP(userId, result.xp);

    res.json(result);
  } catch (err) {
    next(err);
  }
}