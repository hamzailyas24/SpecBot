import rateLimit from "express-rate-limit";

export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please slow down." },
});

export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  message: { error: "Chat rate limit exceeded." },
});
