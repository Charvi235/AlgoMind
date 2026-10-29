  import type { Request, Response } from "express";
  import { randomUUID } from "crypto";
  import jwt from "jsonwebtoken";
  import BstMatch from "../models/BstMatch";
  import { recordActivityAndXP } from "../utils/activityTracker";

const BST_ROUND_MS = 60_000;

function optionalAuthenticatedUserId(req: Request): string | undefined {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token || !process.env.JWT_SECRET) return undefined;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) as { userId?: unknown };
    return typeof payload.userId === "string" ? payload.userId : undefined;
  } catch {
    return undefined;
  }
}

export function resolveBstFinalOutcome(
  numbers: number[],
  deadlineAt: Date,
  completed: boolean,
  placedCount: number,
  nowMs: number = Date.now()
): { validCompletion: boolean; score: number; expired: boolean } {
  const requiredPlacements = Math.max(0, numbers.length - 1);
  const validCompletion = completed
    && placedCount === requiredPlacements
    && nowMs < deadlineAt.getTime();
  return {
    validCompletion,
    score: validCompletion ? Math.min(60, placedCount * 10) : 0,
    expired: !validCompletion,
  };
}

  /**
   * Generates a set of unique numbers that form a visually appealing BST.
   */
  function generateBstQuestionSet(count: number = 7): number[] {
    const min = 10;
    const max = 90;
    const set = new Set<number>();

    while (set.size < count) {
      // Generate distinct two-digit numbers rounded to multiples of 5 for clean UI
      const val = Math.floor(Math.random() * ((max - min) / 5 + 1)) * 5 + min;
      set.add(val);
    }

    const nums = Array.from(set);

    // Sort and select a middle element as root to ensure a balanced initial split
    nums.sort((a, b) => a - b);
    const midIndex = Math.floor(nums.length / 2);
    const root = nums.splice(midIndex, 1)[0];

    // Shuffle the remaining numbers
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }

    return [root, ...nums];
  }

  /**
   * GET /api/games/bst/question
   * Returns a new set of numbers and initializes a match session.
   */
  export const getQuestion = async (req: Request, res: Response): Promise<void> => {
    try {
      const count = parseInt(req.query.count as string) || 7;
      const numbers = generateBstQuestionSet(count);
      const requestId = typeof req.query.requestId === "string" ? req.query.requestId : undefined;
      const matchId = `bst_${randomUUID().substring(0, 8)}`;
      const deadlineAt = new Date(Date.now() + BST_ROUND_MS);
      const userId = optionalAuthenticatedUserId(req);

      let match: InstanceType<typeof BstMatch>;
      if (requestId) {
        match = await BstMatch.findOneAndUpdate(
          { requestId },
          {
            $setOnInsert: {
              matchId,
              requestId,
              ...(userId ? { userId } : {}),
              numbers,
              score: 0,
              completed: false,
              finalized: false,
              expired: false,
              deadlineAt,
            },
          },
          { upsert: true, new: true }
        );
      } else {
        match = new BstMatch({ matchId, numbers, deadlineAt, ...(userId ? { userId } : {}) });
        await match.save();
      }

      res.status(200).json({
        success: true,
        data: {
          matchId: match.matchId,
          numbers: match.numbers,
          deadlineAt: match.deadlineAt,
        },
      });
    } catch (error) {
      console.error("Error generating BST question:", error);
      res.status(500).json({ success: false, message: "Server Error" });
    }
  };

  /**
   * POST /api/games/bst/validate
   * Server-side check for verifying if a node placement satisfies BST properties.
   */
  export const validatePlacement = async (req: Request, res: Response): Promise<void> => {
    try {
      const { parentValue, side, value } = req.body;

      if (parentValue === undefined || !side || value === undefined) {
        res.status(400).json({ success: false, message: "Invalid payload parameters" });
        return;
      }

      let isValid = false;
      if (side === "left" && value < parentValue) {
        isValid = true;
      } else if (side === "right" && value > parentValue) {
        isValid = true;
      }

      res.status(200).json({
        success: true,
        valid: isValid,
      });
    } catch (error) {
      console.error("Error validating BST drop:", error);
      res.status(500).json({ success: false, message: "Validation Server Error" });
    }
  };

  /**
   * POST /api/games/bst/submit
   * Records the final game completion score and marks the match session as finished.
   */
  export const submitScore = async (req: Request, res: Response): Promise<void> => {
    try {
      const { matchId, completed, placed, attempts } = req.body;

      if (typeof matchId !== "string" || matchId.length === 0) {
        res.status(400).json({ success: false, message: "matchId is required" });
        return;
      }

      const existing = await BstMatch.findOne({ matchId });
      if (!existing) {
        res.status(404).json({ success: false, message: "BST match not found" });
        return;
      }
      const userId = optionalAuthenticatedUserId(req);
      if (existing.userId && existing.userId !== userId) {
        res.status(403).json({ success: false, message: "BST match belongs to another user" });
        return;
      }

      const deadlineAt = existing.deadlineAt ?? new Date(existing.createdAt.getTime() + 60_000);
      const placedCount = Array.isArray(placed) ? placed.length : 0;
      const attemptCount = typeof attempts === "number" && Number.isFinite(attempts)
        ? Math.max(placedCount, Math.floor(attempts))
        : placedCount;
      const accuracy = attemptCount > 0
        ? Number(((placedCount / attemptCount) * 100).toFixed(2))
        : 0;
      const outcome = resolveBstFinalOutcome(
        existing.numbers,
        deadlineAt,
        completed === true,
        placedCount
      );
      const { validCompletion, score: finalScore } = outcome;

      const finalized = await BstMatch.findOneAndUpdate(
        { matchId, finalized: { $ne: true } },
        {
          score: finalScore,
          correctCount: validCompletion ? placedCount : 0,
          attempts: attemptCount,
          accuracy: validCompletion ? accuracy : 0,
          completed: validCompletion,
          finalized: true,
          expired: outcome.expired,
          deadlineAt,
        },
        { new: true }
      );

      const match = finalized ?? existing;
      if (finalized && userId && finalized.score > 0) {
        const xpClaim = await BstMatch.findOneAndUpdate(
          { _id: finalized._id, xpRecorded: { $ne: true } },
          { $set: { xpRecorded: true } },
          { new: true }
        );
        if (xpClaim) await recordActivityAndXP(userId, finalized.score);
      }

      res.status(200).json({
        success: true,
        message: validCompletion
          ? "BST challenge results recorded successfully"
          : "Incomplete BST round finalized with zero score",
        data: {
          matchId,
          score: match.score,
          completed: match.completed,
          finalized: match.finalized,
          expired: match.expired,
          placedCount,
          attempts: attemptCount,
          accuracy: validCompletion ? accuracy : 0,
          deadlineAt,
        },
      });
    } catch (error) {
      console.error("Error submitting BST score:", error);
      res.status(500).json({ success: false, message: "Submission Server Error" });
    }
  };