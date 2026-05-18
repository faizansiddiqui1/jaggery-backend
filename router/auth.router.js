import { Router } from "express";
import { sendOtp, verifyOtp } from "../controller/auth.controller.js";
import { otpRateLimit, verifyOtpRateLimit } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/log", otpRateLimit, sendOtp);
router.post("/varify-email", verifyOtpRateLimit, verifyOtp);

// Admin auth placeholders
router.post("/admin-reset", (req, res) => {
  res.status(200).json({ status: true, message: "Password reset not implemented" });
});

router.post("/admin-logout", (req, res) => {
  res.status(200).json({ status: true, message: "Logout successful" });
});

export { router };
export default router;
