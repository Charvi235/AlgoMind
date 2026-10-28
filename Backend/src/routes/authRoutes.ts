import { Router } from "express";
import {
  signupStart,
  signupVerify,
  signupResend,
  signupComplete,
  usernameAvailable,
  login,
  getMe,
  passwordForgot,
  passwordVerify,
  passwordReset,
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
  passwordForgotLimiter,
  passwordVerifyLimiter,
  passwordResetLimiter,
} from "../middleware/rateLimiters";

const router = Router();

router.post("/signup/start",    signupStartIpLimiter, signupStartDailyLimiter, signupStart);
router.post("/signup/verify",   verifyIpLimiter, signupVerify);
router.post("/signup/resend",   resendIpLimiter, signupResend);
router.post("/signup/complete", verifyIpLimiter, signupComplete);
router.get( "/username-available", usernameCheckLimiter, usernameAvailable);
router.post("/login",           loginIpLimiter, loginAccountLimiter, login);
router.get( "/me",              authMiddleware, getMe);

router.post("/password/forgot", passwordForgotLimiter, passwordForgot);
router.post("/password/verify", passwordVerifyLimiter, passwordVerify);
router.post("/password/reset",  passwordResetLimiter,  passwordReset);

export default router;