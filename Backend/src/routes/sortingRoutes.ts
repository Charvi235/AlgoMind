import { Router } from "express";
import { createSortingRound, validateSortingStep } from "../controllers/sortingController";

const router = Router();

router.get("/new", createSortingRound);
router.post("/validate-step", validateSortingStep);

export default router;
