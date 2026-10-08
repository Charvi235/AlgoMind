import { Router } from "express";
import {
  getQuestion,
  validatePlacement,
  submitScore,
} from "../controllers/bstController";

const router = Router();

router.get("/question", getQuestion);
router.post("/validate", validatePlacement);
router.post("/submit", submitScore);

export default router;