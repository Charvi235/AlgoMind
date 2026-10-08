// import { Request, Response, NextFunction } from "express";
// import { generateBstQuestion, validateBstPlacement, BSTNode } from "../utils/bstGenerator";
// import BstMatch from "../models/BstMatch";

// /**
//  * GET /api/games/bst/question
//  * Returns dynamic BST numbers & initializes a match session
//  */
// export const getBstQuestion = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const count = req.query.count ? parseInt(req.query.count as string, 10) : 7;
//     const numbers = generateBstQuestion(count);

//     const match = await BstMatch.create({
//       numbers,
//       score: 0,
//     });

//     res.status(200).json({
//       success: true,
//       data: {
//         matchId: match._id,
//         numbers,
//       },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * POST /api/games/bst/validate
//  * Validates a single move server-side
//  */
// export const validateMove = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const { tree, parentValue, side, value } = req.body as {
//       tree: BSTNode | null;
//       parentValue: number;
//       side: "left" | "right";
//       value: number;
//     };

//     if (parentValue === undefined || !side || value === undefined) {
//       res.status(400).json({ success: false, message: "Missing required parameters." });
//       return;
//     }

//     const isValid = validateBstPlacement(tree, parentValue, side, value);

//     res.status(200).json({
//       success: true,
//       valid: isValid,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * POST /api/games/bst/submit
//  * Submits final score and time spent
//  */
// export const submitBstMatch = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const { matchId, score, timeSpentSeconds } = req.body;

//     const match = await BstMatch.findByIdAndUpdate(
//       matchId,
//       {
//         score,
//         timeSpentSeconds,
//         completed: true,
//       },
//       { new: true }
//     );

//     if (!match) {
//       res.status(404).json({ success: false, message: "Match session not found." });
//       return;
//     }

//     res.status(200).json({
//       success: true,
//       message: "Match recorded successfully.",
//       data: match,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import BstMatch from "../models/BstMatch";

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
    const matchId = `bst_${uuidv4().substring(0, 8)}`;

    const match = new BstMatch({
      matchId,
      numbers,
    });
    await match.save();

    res.status(200).json({
      success: true,
      data: {
        matchId,
        numbers,
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
    const { matchId, score, placed } = req.body;

    if (matchId) {
      await BstMatch.findOneAndUpdate(
        { matchId },
        { score, completed: true },
        { new: true }
      );
    }

    res.status(200).json({
      success: true,
      message: "BST challenge results recorded successfully",
      data: { score, placedCount: placed?.length || 0 },
    });
  } catch (error) {
    console.error("Error submitting BST score:", error);
    res.status(500).json({ success: false, message: "Submission Server Error" });
  }
};