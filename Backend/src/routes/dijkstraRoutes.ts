import { Router } from "express";
import { createDijkstraMatch, validateDijkstraStep } from "../controllers/dijkstraController";

const router = Router();

router.get("/new", createDijkstraMatch);
router.post("/validate-step", validateDijkstraStep);

export default router;