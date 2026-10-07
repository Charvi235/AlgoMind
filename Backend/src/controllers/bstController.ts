import { Request, Response, NextFunction } from "express";
import { generateBstQuestion, validateBstPlacement, BSTNode } from "../utils/bstGenerator";
import BstMatch from "../models/BstMatch";

/**
 * GET /api/games/bst/question
 * Returns dynamic BST numbers & initializes a match session
 */
export const getBstQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const count = req.query.count ? parseInt(req.query.count as string, 10) : 7;
    const numbers = generateBstQuestion(count);

    const match = await BstMatch.create({
      numbers,
      score: 0,
    });

    res.status(200).json({
      success: true,
      data: {
        matchId: match._id,
        numbers,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/games/bst/validate
 * Validates a single move server-side
 */
export const validateMove = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tree, parentValue, side, value } = req.body as {
      tree: BSTNode | null;
      parentValue: number;
      side: "left" | "right";
      value: number;
    };

    if (parentValue === undefined || !side || value === undefined) {
      res.status(400).json({ success: false, message: "Missing required parameters." });
      return;
    }

    const isValid = validateBstPlacement(tree, parentValue, side, value);

    res.status(200).json({
      success: true,
      valid: isValid,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/games/bst/submit
 * Submits final score and time spent
 */
export const submitBstMatch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { matchId, score, timeSpentSeconds } = req.body;

    const match = await BstMatch.findByIdAndUpdate(
      matchId,
      {
        score,
        timeSpentSeconds,
        completed: true,
      },
      { new: true }
    );

    if (!match) {
      res.status(404).json({ success: false, message: "Match session not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Match recorded successfully.",
      data: match,
    });
  } catch (error) {
    next(error);
  }
};