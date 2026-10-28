import type { Request, Response, NextFunction } from "express";
import User from "../models/User";
import UserActivity from "../models/UserActivity";
import GameSession from "../models/GameSession";
import mongoose from "mongoose";

// ─── Shared rank helper ───────────────────────────────────────────────────────
//
// Competition ranking: 1 + the number of users with strictly greater XP.
// Returns null when the user's XP is 0.

async function computeRank(userId: string, myXP: number): Promise<number | null> {
  if (myXP === 0) return null;
  const ahead = await User.countDocuments({ totalXP: { $gt: myXP } });
  return ahead + 1;
}

// ─── GET /api/leaderboard?limit=<n> ──────────────────────────────────────────

export async function getLeaderboard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const myUserId = (req as any).userId as string;

    // Parse limit: default 50, clamp to [1, 100], ignore garbage.
    const raw   = Number(req.query.limit);
    const limit = Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), 100) : 50;

    // Fetch users with XP > 0, ordered by XP desc then sign-up asc.
    const users = await User.find({ totalXP: { $gt: 0 } })
      .sort({ totalXP: -1, created_at: 1 })
      .limit(limit)
      .select("username totalXP created_at -_id")
      .lean();

    // Assign competition ranks (equal XP = equal rank, next rank skips).
    let currentRank = 1;
    let prevXP      = -1;
    let prevRank    = 1;

    const entries = users.map((u, i) => {
      if (u.totalXP !== prevXP) {
        currentRank = i + 1;
        prevXP      = u.totalXP;
        prevRank    = currentRank;
      } else {
        currentRank = prevRank;
      }
      return {
        rank:     currentRank,
        username: u.username,
        totalXP:  u.totalXP,
        isMe:     (u as any)._id
          ? String((u as any)._id) === myUserId
          : false,
      };
    });

    // We used select("-_id") so _id won't be present; fetch the real me row.
    const meUser = await User.findById(myUserId).select("username totalXP").lean();
    let meEntry: { rank: number | null; username: string; totalXP: number } | null = null;
    if (meUser) {
      const meRank = await computeRank(myUserId, meUser.totalXP);
      meEntry = { rank: meRank, username: meUser.username, totalXP: meUser.totalXP };

      // Mark isMe in entries list (select("-_id") removed _id; re-check by username).
      for (const e of entries) {
        if (e.username === meUser.username) e.isMe = true;
      }
    }

    res.json({ entries, me: meEntry });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/me/dashboard ────────────────────────────────────────────────────

export async function getDashboard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const myUserId = (req as any).userId as string;
    const uid      = new mongoose.Types.ObjectId(myUserId);

    // Fetch user doc.
    const user = await User.findById(uid)
      .select("username totalXP current_streak longest_streak")
      .lean();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Rank (competition ranking, null when XP = 0).
    const rank = await computeRank(myUserId, user.totalXP);

    // xpToday: today's UTC-midnight date.
    const now     = new Date();
    const todayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const activity = await UserActivity.findOne({
      user_id:       uid,
      activity_date: todayUTC,
    })
      .select("points_earned")
      .lean();
    const xpToday = activity?.points_earned ?? 0;

    // gamesPlayed: completed GameSession count.
    const gamesPlayed = await GameSession.countDocuments({
      userId: uid,
      status: "completed",
    });

    // accuracy: rounded mean of the 20 most recent completed sessions.
    const recentSessions = await GameSession.find({
      userId: uid,
      status: "completed",
    })
      .sort({ completedAt: -1 })
      .limit(20)
      .select("accuracy")
      .lean();

    const accuracy: number | null =
      recentSessions.length === 0
        ? null
        : Math.round(
            recentSessions.reduce((sum, s) => sum + s.accuracy, 0) /
              recentSessions.length,
          );

    res.json({
      username:        user.username,
      totalXP:         user.totalXP,
      rank,
      xpToday,
      gamesPlayed,
      accuracy,
      current_streak:  user.current_streak,
      longest_streak:  user.longest_streak,
    });
  } catch (err) {
    next(err);
  }
}
