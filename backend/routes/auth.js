import express from "express";
import bcrypt from "bcryptjs";
import { body, validationResult } from "express-validator";
import { pool } from "../utils/db.js";
import { generateTokens, generateAccessToken, verifyRefreshToken } from "../utils/jwt.js";
import { refreshCookieOptions } from "../utils/cookies.js";
import logger from "../utils/logger.js";

const router = express.Router();

router.post("/register",
  [body("email").isEmail().normalizeEmail(), body("password").isLength({ min: 8 }), body("name").trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, name } = req.body;
    try {
      const exists = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
      if (exists.rows.length > 0) return res.status(409).json({ error: "Email already in use" });

      const password_hash = await bcrypt.hash(password, 12);
      const { rows: [user] } = await pool.query(
        "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, role",
        [email, password_hash, name]
      );

      const { accessToken, refreshToken } = generateTokens(user);
      await pool.query("UPDATE users SET refresh_token = $1 WHERE id = $2", [refreshToken, user.id]);

      res.cookie("refreshToken", refreshToken, refreshCookieOptions());
      res.status(201).json({ accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (err) {
      logger.error("Register failed", { err: err.message });
      res.status(500).json({ error: "Registration failed" });
    }
  }
);

router.post("/login",
  [body("email").isEmail().normalizeEmail(), body("password").notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
      const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      if (!rows.length) return res.status(401).json({ error: "Invalid credentials" });

      const user = rows[0];
      if (!await bcrypt.compare(password, user.password_hash)) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const { accessToken, refreshToken } = generateTokens(user);
      await pool.query("UPDATE users SET refresh_token = $1 WHERE id = $2", [refreshToken, user.id]);

      res.cookie("refreshToken", refreshToken, refreshCookieOptions());
      res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (err) {
      logger.error("Login failed", { err: err.message });
      res.status(500).json({ error: "Login failed" });
    }
  }
);

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: "No refresh token" });
  try {
    const payload = verifyRefreshToken(token);
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1 AND refresh_token = $2", [payload.id, token]);
    if (!rows.length) return res.status(401).json({ error: "Invalid refresh token" });

    const user = rows[0];
    // Issue new access token only — keep refresh cookie/DB value (avoids parallel-refresh races).
    const accessToken = generateAccessToken(user);

    res.json({
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch {
    res.status(401).json({ error: "Token refresh failed" });
  }
});

router.post("/logout", async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      const p = verifyRefreshToken(token);
      await pool.query("UPDATE users SET refresh_token = NULL WHERE id = $1", [p.id]);
    } catch {}
  }
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out" });
});

export default router;
