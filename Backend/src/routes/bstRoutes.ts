import { Router } from "express";
import { getBstQuestion, validateMove, submitBstMatch } from "../controllers/bstController";

const router = Router();

router.get("/question", getBstQuestion);
router.post("/validate", validateMove);
router.post("/submit", submitBstMatch);

export default router;