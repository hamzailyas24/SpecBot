import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
dotenv.config();

import authRoutes  from "./routes/auth.js";
import chatRoutes  from "./routes/chat.js";
import userRoutes  from "./routes/user.js";
import adminRoutes from "./routes/admin.js";
import { limiter } from "./middlewares/rateLimiter.js";
import logger from "./utils/logger.js";

const app = express();

// Required behind nginx (Docker) — otherwise express-rate-limit throws and API returns 500.
app.set("trust proxy", 1);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost",
  "http://localhost:80",
  "http://localhost:5173",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, allowedOrigins[0] || "http://localhost:5173");
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(limiter);

app.use("/auth",  authRoutes);
app.use("/chat",  chatRoutes);
app.use("/user",  userRoutes);
app.use("/admin", adminRoutes);

app.get("/health", (_, res) => res.json({ status: "ok", ts: Date.now() }));

app.use((err, req, res, _next) => {
  logger.error("Unhandled error", { err: err.message, path: req.path });
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.info(`GSM-AI backend running on :${PORT}`));
