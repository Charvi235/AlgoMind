/**
 * activityTracker.ts
 *
 * Single shared function for recording a day's activity + XP + streak,
 * used by BOTH solo sessions and live matches — no duplicated logic.
 */


import User from "../models/User";
import UserActivity from "../models/UserActivity";

function todayDateOnly(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

function isYesterday(date: Date, today: Date): boolean {
  return today.getTime() - date.getTime() === 24 * 60 * 60 * 1000;
}

export async function recordActivityAndXP(
  userId: string,
  xpEarned: number,
  submissionCount = 1
): Promise<void> {
  const today = todayDateOnly();

  await UserActivity.findOneAndUpdate(
    { user_id: userId, activity_date: today },
    { $inc: { submission_count: submissionCount, points_earned: xpEarned } },
    { upsert: true, new: true }
  );

  const user = await User.findById(userId);
  if (!user) return;

  const last = user.last_active_date ? new Date(user.last_active_date) : null;
  if (last) last.setUTCHours(0, 0, 0, 0);

  let newStreak = user.current_streak;
  if (!last || !isSameDay(last, today)) {
    newStreak = last && isYesterday(last, today) ? user.current_streak + 1 : 1;
  }

  user.current_streak = newStreak;
  user.longest_streak = Math.max(user.longest_streak, newStreak);
  user.last_active_date = today;
  user.totalXP += xpEarned;
  await user.save();
}