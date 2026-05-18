const ipBuckets = new Map();

const now = () => Date.now();

const getKey = (req, keyPart) => {
  const ip =
    String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() ||
    req.ip ||
    "unknown";
  return `${keyPart}:${ip}`;
};

export const createRateLimiter = ({ key, limit, windowMs }) => {
  return (req, res, next) => {
    const bucketKey = getKey(req, key);
    const current = ipBuckets.get(bucketKey);
    const ts = now();

    if (!current || ts > current.resetAt) {
      ipBuckets.set(bucketKey, { count: 1, resetAt: ts + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > limit) {
      const retryAfter = Math.ceil((current.resetAt - ts) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfter, 1)));
      return res.status(429).json({
        status: false,
        message: "Too many requests. Please try again later.",
      });
    }
    return next();
  };
};

export const otpRateLimit = createRateLimiter({
  key: "otp",
  limit: 8,
  windowMs: 15 * 60 * 1000,
});

export const verifyOtpRateLimit = createRateLimiter({
  key: "otp-verify",
  limit: 20,
  windowMs: 15 * 60 * 1000,
});

export const adminLoginRateLimit = createRateLimiter({
  key: "admin-login",
  limit: 10,
  windowMs: 15 * 60 * 1000,
});

export const paymentRateLimit = createRateLimiter({
  key: "payment",
  limit: 30,
  windowMs: 5 * 60 * 1000,
});

