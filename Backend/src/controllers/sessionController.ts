import type { Request, Response, NextFunction } from "express";
import { recordActivityAndXP } from "../utils/activityTracker";
import BstMatch from "../models/BstMatch";

export async function completeSoloSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const { correctCount, gameType, matchIds } = req.body as {
      correctCount?: number;
      gameType?: string;
      matchIds?: unknown;
    };

    let xpEarned: number;
    if (gameType === "bst" && Array.isArray(matchIds)) {
      const ids = matchIds.filter((id): id is string => typeof id === "string" && id.length > 0);
      const rounds = await BstMatch.find({ matchId: { $in: ids }, userId }).select("matchId score xpRecorded").lean();
      const awardable = rounds.filter((round) => !round.xpRecorded);
      xpEarned = awardable.reduce((sum, round) => sum + round.score, 0);

      if (awardable.length > 0) {
        await BstMatch.updateMany(
          { _id: { $in: awardable.map((round) => round._id) }, xpRecorded: false },
          { $set: { xpRecorded: true } }
        );
      }
    } else {
      if (typeof correctCount !== "number" || correctCount < 0) {
        res.status(400).json({ error: "correctCount must be a non-negative number" });
        return;
      }
      xpEarned = correctCount * 10;
    }

    await recordActivityAndXP(userId, xpEarned);

    res.json({ xpEarned });
  } catch (err) {
    next(err);
  }
}