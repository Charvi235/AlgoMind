import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { getUserProfile, getUserHeatmap } from "../controllers/userProfileController";

const router = Router();

router.get("/", authMiddleware, getUserProfile);
router.get("/heatmap", authMiddleware, getUserHeatmap);
router.get("/me", authMiddleware, getUserProfile);
router.get("/me/heatmap", authMiddleware, getUserHeatmap);

export default router;
