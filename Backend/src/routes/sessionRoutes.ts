import { Router } from "express";
import { startSoloSession, finishSoloSession } from "../controllers/sessionController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);
router.post("/solo/start", startSoloSession);
router.post("/solo/finish", finishSoloSession);

export default router;