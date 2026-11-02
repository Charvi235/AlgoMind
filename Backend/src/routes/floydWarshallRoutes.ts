
import { Router } from "express";

import {
  createFloydWarshallMatch,
  validateFloydWarshallAnswer,
} from "../controllers/floydWarshallController";

import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/new", createFloydWarshallMatch);
router.post("/validate-answer", validateFloydWarshallAnswer);

export default router;
