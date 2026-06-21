import express from "express";
import "./config/env.js"; // ensure .env is loaded
import { connectDB } from "./config/db.js";
import multer from "multer";

const app = express();
const port = Number(process.env.PORT) || 5000;
app.disable("x-powered-by");

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

// CORS (without external dependency)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(String(process.env.FRONTEND_URLS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)),
].filter(Boolean);
const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (!allowedOrigins.length) return false;
  return allowedOrigins.includes(origin);
};
app.use((req, res, next) => {
  const requestOrigin = String(req.headers.origin || "");
  const originToSend = isOriginAllowed(requestOrigin) ? requestOrigin : "";
  if (originToSend) {
    res.header("Access-Control-Allow-Origin", originToSend);
  }
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Vary", "Origin");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-token"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  // baseline hardening headers for API responses
  res.header("X-Content-Type-Options", "nosniff");
  res.header("X-Frame-Options", "DENY");
  res.header("Referrer-Policy", "strict-origin-when-cross-origin");
  res.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    status: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

const startServer = async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error("Failed to connect to MongoDB. Exiting.");
    process.exit(1);
  }

  try {
    const { default: adminRouter } = await import("./router/admin.router.js");
    app.use("/api/backend", adminRouter);
    console.log("Admin routes loaded at /api/backend");
  } catch (error) {
    console.warn("Admin routes not loaded:", error.message);
  }

  try {
    const { default: userRouter } = await import("./router/user.router.js");
    app.use("/user", userRouter);
    console.log("User routes loaded at /user");
  } catch (error) {
    console.warn("User routes not loaded:", error.message);
  }

  try {
    const { default: authRouter } = await import("./router/auth.router.js");
    app.use("/api/auth", authRouter);
    console.log("Auth routes loaded at /api/auth");
  } catch (error) {
    console.warn("Auth routes not loaded:", error.message);
  }

  // Central error handler (important for multer/multipart uploads).
  // Without this, some multipart failures can surface as connection resets to the proxy.
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError || err?.name === "MulterError") {
      const code = err.code || "MULTER_ERROR";
      const isTooLarge = code === "LIMIT_FILE_SIZE";
      return res.status(isTooLarge ? 413 : 400).json({
        status: false,
        message: isTooLarge ? "Uploaded file is too large." : "Upload failed.",
        code,
      });
    }

    if (err) {
      console.error("Unhandled error:", err);
      return res.status(500).json({
        status: false,
        message: "Server error",
      });
    }

    next();
  });

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
};

startServer();

export default app;
