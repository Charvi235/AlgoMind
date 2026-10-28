import { Router } from "express";
import { createDijkstraMatch, validateDijkstraStep } from "../controllers/dijkstraController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Login required for every Dijkstra endpoint.
router.use(authMiddleware);
router.get("/new", createDijkstraMatch);
router.post("/validate-step", validateDijkstraStep);

export default router;