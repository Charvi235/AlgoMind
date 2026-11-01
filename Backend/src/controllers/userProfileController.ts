import type { Request, Response, NextFunction } from "express";
import User from "../models/User";
import UserActivity from "../models/UserActivity";
import { computeRank } from "./statsController";

export async function getUserProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as any).userId as string;
    const user = await User.findById(userId).select("username totalXP current_streak longest_streak").lean();

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const rank = await computeRank(userId, user.totalXP);

    res.json({
      username: user.username,
      totalXP: user.totalXP,
      current_streak: user.current_streak,
      longest_streak: user.longest_streak,
      rank,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUserHeatmap(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as any).userId as string;
    const today = new Date();
    const endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 364);

    const dailyRecords = await UserActivity.find({
      user_id: userId,
      activity_date: { $gte: startDate, $lte: endDate },
    })
      .select("activity_date points_earned")
      .lean();

    const pointsByDate = new Map<string, number>();
    for (const record of dailyRecords) {
      const dateKey = new Date(record.activity_date).toISOString().slice(0, 10);
      const currentPoints = pointsByDate.get(dateKey) ?? 0;
      pointsByDate.set(dateKey, currentPoints + (record.points_earned ?? 0));
    }

    const year = endDate.getUTCFullYear();
    const dailyActivity: Array<{ date: string; points: number }> = [];
    let totalPoints = 0;

    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const points = pointsByDate.get(dateKey) ?? 0;
      dailyActivity.push({ date: dateKey, points });
      totalPoints += points;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    res.json({
      year,
      totalPoints,
      dailyActivity,
    });
  } catch (error) {
    next(error);
  }
}
