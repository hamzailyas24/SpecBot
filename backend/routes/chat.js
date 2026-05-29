import express from "express";
import { body, validationResult } from "express-validator";
import { authenticate } from "../middlewares/auth.js";
import { chatLimiter } from "../middlewares/rateLimiter.js";
import { queryAI } from "../services/aiService.js";
import { searchSimilarPhones } from "../services/embeddingService.js";
import { cacheGet, cacheSet } from "../utils/redis.js";
import { pool } from "../utils/db.js";
import crypto from "crypto";

const router = express.Router();

// POST /chat
router.post("/",
  authenticate, chatLimiter,
  [body("message").trim().notEmpty().isLength({ max: 1000 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { message } = req.body;
    const userId = req.user.id;

    // Cache key based on message content (shared across users for same query)
    const cacheKey = `chat:${crypto.createHash("sha256").update(message.toLowerCase().trim()).digest("hex")}`;

    try {
      // Try cache first
      const cached = await cacheGet(cacheKey);
      if (cached) {
        await pool.query(
          "INSERT INTO chat_history (user_id, message, response, cached) VALUES ($1, $2, $3, true)",
          [userId, message, cached]
        );
        return res.json({ response: cached, cached: true });
      }

      // RAG: find similar phones for context
      const similarIds = await searchSimilarPhones(message, 5);
      let context = "";
      if (similarIds.length > 0) {
        const { rows } = await pool.query(
          "SELECT brand, model, specs FROM phones WHERE id = ANY($1::int[])",
          [similarIds]
        );
        context = rows
          .map((p) => {
            // Extract key specs only — keeps context focused
            const s = p.specs || {};
            return `**${p.brand} ${p.model}**\nOS: ${s["Operating System"] || "?"} | CPU: ${s["CPU"] || "?"} | RAM: ${s["RAM Capacity"] || "?"} | Display: ${s["Display Type"] || "?"} | Battery: ${s["Nominal Battery Capacity"] || "?"} | Camera: ${s["Number of effective pixels"] || "?"}`;
          })
          .join("\n\n");
      }

      const response = await queryAI(message, context);

      // Cache for 1 hour
      await cacheSet(cacheKey, response, 3600);

      await pool.query(
        "INSERT INTO chat_history (user_id, message, response, cached) VALUES ($1, $2, $3, false)",
        [userId, message, response]
      );

      res.json({ response, cached: false });
    } catch (err) {
      res.status(500).json({ error: err.message || "Chat failed" });
    }
  }
);

// POST /chat/compare — dedicated compare endpoint
router.post("/compare",
  authenticate, chatLimiter,
  [body("phoneA").trim().notEmpty(), body("phoneB").trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { phoneA, phoneB } = req.body;
    const cacheKey = `compare:${[phoneA, phoneB].sort().join("|").toLowerCase()}`;

    try {
      const cached = await cacheGet(cacheKey);
      if (cached) return res.json({ response: JSON.parse(cached), cached: true });

      // Find both phones by name similarity
      const findPhone = async (name) => {
        const { rows } = await pool.query(
          `SELECT brand, model, specs FROM phones
           WHERE model ILIKE $1 OR to_tsvector('english', brand || ' ' || model) @@ plainto_tsquery('english', $2)
           ORDER BY similarity(model, $1) DESC LIMIT 1`,
          [`%${name}%`, name]
        );
        return rows[0] || null;
      };

      const [pA, pB] = await Promise.all([findPhone(phoneA), findPhone(phoneB)]);

      if (!pA || !pB) {
        return res.status(404).json({
          error: `Could not find: ${!pA ? phoneA : phoneB}. Try a more specific name.`
        });
      }

      const formatSpecs = (p) => {
        const s = p.specs || {};
        return {
          name: `${p.brand} ${p.model}`,
          os: s["Operating System"],
          cpu: s["CPU"],
          ram: s["RAM Capacity"],
          storage: s["Non-volatile Memory Capacity"],
          display: `${s["Display Diagonal"]} ${s["Display Type"]} ${s["Display Refresh Rate"]}`,
          camera: s["Number of effective pixels"],
          battery: s["Nominal Battery Capacity"],
          charging: s["Max. Charging Power"],
          dimensions: `${s["Width"]} × ${s["Height"]} × ${s["Depth"]}`,
          weight: s["Mass"],
          nfc: s["NFC"],
          released: s["Released Year"],
        };
      };

      const specA = formatSpecs(pA);
      const specB = formatSpecs(pB);

      const prompt = `Compare these two phones in detail. Give a verdict on which is better overall and for different use cases.
      
Phone A: ${JSON.stringify(specA)}
Phone B: ${JSON.stringify(specB)}

Structure your response as:
1. Quick spec comparison table (markdown)
2. Category winners (camera, battery, performance, display, value)
3. Who should buy Phone A vs Phone B
4. Overall verdict`;

      const aiResponse = await queryAI(prompt);

      const result = { phoneA: specA, phoneB: specB, analysis: aiResponse };
      await cacheSet(cacheKey, JSON.stringify(result), 86400); // cache 24h

      res.json({ response: result, cached: false });
    } catch (err) {
      res.status(500).json({ error: err.message || "Compare failed" });
    }
  }
);

// GET /chat/history
router.get("/history", authenticate, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  try {
    const { rows } = await pool.query(
      "SELECT id, message, response, cached, created_at FROM chat_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
      [req.user.id, limit, offset]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// DELETE /chat/history
router.delete("/history", authenticate, async (req, res) => {
  try {
    await pool.query("DELETE FROM chat_history WHERE user_id = $1", [req.user.id]);
    res.json({ message: "History cleared" });
  } catch {
    res.status(500).json({ error: "Failed to clear history" });
  }
});

export default router;
