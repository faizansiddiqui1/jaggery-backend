import crypto from "crypto";
import { sendBrevoEmail } from "../utils/brevo.js";
import { loadEnv } from "../config/env.js";
import Profile from "../model/profile.model.js";
import UserSession from "../model/session.model.js";

loadEnv();

const otpStore = new Map(); // email -> { code, expires }
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_VERIFY_ATTEMPTS = 3;
const OTP_VERIFY_COOLDOWN_MS = 30 * 1000;

const brevoApiKey = process.env.BREVO_API_KEY;
const brevoFromEmail = process.env.BREVO_FROM_EMAIL;
const brevoFromName = process.env.BREVO_FROM_NAME || "Amila Gold";

export const sendOtp = async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) return res.status(400).json({ message: "Email required" });

    const existing = otpStore.get(normalizedEmail);
    if (existing?.resendAfter && Date.now() < existing.resendAfter) {
      const retryAfter = Math.ceil((existing.resendAfter - Date.now()) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfter, 1)));
      return res.status(429).json({
        status: false,
        message: `Please wait ${Math.max(retryAfter, 1)} seconds before requesting another OTP`,
        retryAfter: Math.max(retryAfter, 1),
      });
    }

    if (!brevoApiKey || !brevoFromEmail) {
      return res
        .status(500)
        .json({ message: "Email service not configured on server" });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const expires = Date.now() + OTP_TTL_MS;
    otpStore.set(normalizedEmail, {
      code,
      expires,
      resendAfter: Date.now() + OTP_RESEND_COOLDOWN_MS,
      attempts: 0,
      cooldownUntil: 0,
    });

    const subject = "Your Amila Gold Login Code";
    const textContent = `Your OTP is ${code}. It expires in 10 minutes.`;
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d5016;">Your Login Code</h2>
        <p>Enter the following code to sign in to your Amila Gold account:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; margin: 20px 0;">
          ${code}
        </div>
        <p>This code expires in 10 minutes.</p>
        <p style="color: #666; font-size: 12px;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
    `;

    const doSend = process.env.EMAIL_DRY_RUN !== "true";

    if (doSend) {
      await sendBrevoEmail({
        apiKey: brevoApiKey,
        fromEmail: brevoFromEmail,
        fromName: brevoFromName,
        toEmail: normalizedEmail,
        subject,
        textContent,
        htmlContent,
      });
    } else {
      console.log(`[EMAIL_DRY_RUN] OTP for ${normalizedEmail}: ${code}`);
    }

    return res.status(200).json({
      status: true,
      message: "OTP sent",
      resendAfter: new Date(Date.now() + OTP_RESEND_COOLDOWN_MS).toISOString(),
    });
  } catch (error) {
    console.error("sendOtp error:", error);
    return res
      .status(500)
      .json({ status: false, message: error.message || "Failed to send OTP" });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !otp) {
    return res.status(400).json({ message: "Email and OTP required" });
  }

  const entry = otpStore.get(normalizedEmail);
  if (!entry) return res.status(400).json({ message: "OTP expired or not found" });
  if (Date.now() > entry.expires) {
    otpStore.delete(normalizedEmail);
    return res.status(400).json({ message: "OTP expired" });
  }
  if (entry.cooldownUntil && Date.now() < entry.cooldownUntil) {
    const retryAfter = Math.ceil((entry.cooldownUntil - Date.now()) / 1000);
    res.setHeader("Retry-After", String(Math.max(retryAfter, 1)));
    return res.status(429).json({
      status: false,
      message: `Too many wrong OTP attempts. Try again in ${Math.max(retryAfter, 1)} seconds.`,
      retryAfter: Math.max(retryAfter, 1),
    });
  }
  if (entry.code !== otp) {
    entry.attempts = Number(entry.attempts || 0) + 1;
    if (entry.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
      entry.attempts = 0;
      entry.cooldownUntil = Date.now() + OTP_VERIFY_COOLDOWN_MS;
      const retryAfter = Math.ceil(OTP_VERIFY_COOLDOWN_MS / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        status: false,
        message: `Too many wrong OTP attempts. Try again in ${retryAfter} seconds.`,
        retryAfter,
      });
    }

    return res.status(400).json({
      status: false,
      message: "Invalid OTP",
      attemptsLeft: OTP_MAX_VERIFY_ATTEMPTS - entry.attempts,
    });
  }

  otpStore.delete(normalizedEmail);

  // Find or create user profile
  let profile = await Profile.findOne({ email: normalizedEmail });
  if (profile?.isBlocked) {
    return res.status(403).json({
      status: false,
      message: profile.blockedReason
        ? `You are blocked: ${profile.blockedReason}`
        : "You are blocked. Please contact support.",
    });
  }
  const isNew = !profile;

  if (!profile) {
    profile = new Profile({ email: normalizedEmail, name: "" });
    await profile.save();
  }

  // Generate session token
  const token = crypto.randomUUID();
  const ttlDays = 30;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  const session = new UserSession({
    session_id: token,
    email: normalizedEmail,
    expiresAt,
  });
  await session.save();

  return res.status(200).json({
    status: true,
    message: "OTP verified",
    token,
    email: normalizedEmail,
    expiresAt: expiresAt.toISOString(),
    isNew,
    profile: {
      email: profile.email,
      name: profile.name,
    },
  });
};
