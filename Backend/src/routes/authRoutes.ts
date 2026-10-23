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
import {
  signupStartIpLimiter,
  signupStartDailyLimiter,
  resendIpLimiter,
  verifyIpLimiter,
  usernameCheckLimiter,
  loginIpLimiter,
  loginAccountLimiter,
} from "../middleware/rateLimiters";

const router = Router();

router.post("/signup/start", signupStartIpLimiter, signupStartDailyLimiter, signupStart);
router.post("/signup/verify", verifyIpLimiter, signupVerify);
router.post("/signup/resend", resendIpLimiter, signupResend);
router.post("/signup/complete", verifyIpLimiter, signupComplete);
router.get("/username-available", usernameCheckLimiter, usernameAvailable);
router.post("/login", loginIpLimiter, loginAccountLimiter, login);
router.get("/me", authMiddleware, getMe); // protected, requires a valid JWT

export default router;