import type { Request, Response, NextFunction } from "express";
import { recordActivityAndXP } from "../utils/activityTracker";

export async function completeSoloSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const { correctCount } = req.body as { correctCount?: number };

    if (typeof correctCount !== "number" || correctCount < 0) {
      res.status(400).json({ error: "correctCount must be a non-negative number" });
      return;
    }

    const xpEarned = correctCount * 10; // same formula used across the app

    await recordActivityAndXP(userId, xpEarned);

    res.json({ xpEarned });
  } catch (err) {
    next(err);
  }
}