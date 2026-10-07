import { Router } from "express";
import { signup, login, getMe } from "../controllers/authController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", authMiddleware, getMe); // protected — requires valid JWT

export default router;