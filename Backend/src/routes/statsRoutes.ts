import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { getLeaderboard, getDashboard } from "../controllers/statsController";

const router = Router();

router.get("/leaderboard",    authMiddleware, getLeaderboard);
router.get("/me/dashboard",   authMiddleware, getDashboard);

export default router;
