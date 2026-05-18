import crypto from "crypto";
import UserSession from "../model/session.model.js";

const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const getAdminSigningSecret = () =>
  String(
    process.env.ADMIN_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      "change-this-admin-token-secret"
  );

const signAdminPayload = (payloadBase64) => {
  return crypto
    .createHmac("sha256", getAdminSigningSecret())
    .update(payloadBase64)
    .digest("hex");
};

export const createAdminToken = (username) => {
  const payload = {
    sub: String(username || "admin"),
    iat: Date.now(),
    exp: Date.now() + ADMIN_TOKEN_TTL_MS,
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signAdminPayload(payloadBase64);
  return `${payloadBase64}.${signature}`;
};

const verifyAdminToken = (token) => {
  if (!token || !String(token).includes(".")) return null;
  const [payloadBase64, signature] = String(token).split(".", 2);
  if (!payloadBase64 || !signature) return null;
  const expected = signAdminPayload(payloadBase64);
  if (signature !== expected) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf8")
    );
    if (!parsed?.exp || Date.now() > Number(parsed.exp)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const requireAdminAuth = (req, res, next) => {
  const token = String(req.headers["x-admin-token"] || "").trim();
  const payload = verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({ status: false, message: "Admin authentication required" });
  }
  req.admin = { username: String(payload.sub || "admin") };
  next();
};

export const requireUserSession = async (req, res, next) => {
  try {
    const auth = String(req.headers.authorization || "").trim();
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) {
      return res.status(401).json({ status: false, message: "Authentication required" });
    }

    const now = new Date();
    const session = await UserSession.findOne({
      session_id: token,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .select("email session_id expiresAt")
      .lean();

    if (!session?.email) {
      return res.status(401).json({ status: false, message: "Session expired or invalid" });
    }

    const bodyEmail = String(req.body?.email || "").trim().toLowerCase();
    if (bodyEmail && bodyEmail !== String(session.email).toLowerCase()) {
      return res.status(403).json({ status: false, message: "Email/token mismatch" });
    }

    req.user = {
      email: String(session.email).toLowerCase(),
      sessionId: String(session.session_id || ""),
    };
    next();
  } catch (error) {
    console.error("requireUserSession error:", error);
    return res.status(500).json({ status: false, message: "Auth middleware failed" });
  }
};

