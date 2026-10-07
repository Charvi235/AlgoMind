import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User";

const SALT_ROUNDS = 10;

function signToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign({ userId }, secret, { expiresIn: "7d" });
}

export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, email, password, age } = req.body as {
      username?: string; email?: string; password?: string; age?: number;
    };

    if (!username || !email || !password) {
      res.status(400).json({ error: "username, email, and password are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      res.status(409).json({ error: "Username or email already in use" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ username, email, passwordHash, age });

    const token = signToken(user.id);
    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, email: user.email, totalXP: user.totalXP },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken(user.id);
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, totalXP: user.totalXP },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    // req.userId is set by the authMiddleware
    const user = await User.findById((req as any).userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      totalXP: user.totalXP,
      current_streak: user.current_streak,
      longest_streak: user.longest_streak,
    });
  } catch (err) {
    next(err);
  }
}