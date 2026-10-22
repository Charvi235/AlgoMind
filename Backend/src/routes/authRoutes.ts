import { Router } from "express";
import {
  signupStart,
  signupVerify,
  signupResend,
  signupComplete,
  usernameAvailable,
  login,
  getMe,
} from "../controllers/authController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.post("/signup/start", signupStart);
router.post("/signup/verify", signupVerify);
router.post("/signup/resend", signupResend);
router.post("/signup/complete", signupComplete);
router.get("/username-available", usernameAvailable);
router.post("/login", login);
router.get("/me", authMiddleware, getMe); // protected, requires a valid JWT

export default router;