import { Router } from "express";
import { completeSoloSession } from "../controllers/sessionController";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.post("/solo", authMiddleware, completeSoloSession);

export default router;