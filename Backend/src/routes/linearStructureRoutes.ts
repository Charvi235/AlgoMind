import { Router } from "express";
import {
  createLinearStructureRound,
  validateLinearStructureStep,
} from "../controllers/linearStructureController";

const router = Router();

router.get("/new", createLinearStructureRound);
router.post("/validate-step", validateLinearStructureStep);

export default router;
