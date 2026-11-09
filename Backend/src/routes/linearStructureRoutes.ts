import { Router } from "express";
import {
  createLinearStructureRound,
  validateLinearStructureStep,
} from "../controllers/linearStructureController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/new", createLinearStructureRound);
router.post("/validate-step", validateLinearStructureStep);

export default router;