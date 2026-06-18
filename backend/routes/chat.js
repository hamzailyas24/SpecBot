import express from "express";
import { body, validationResult } from "express-validator";
import { authenticate } from "../middlewares/auth.js";
import { chatLimiter } from "../middlewares/rateLimiter.js";
import { queryAI } from "../services/aiService.js";
import { searchSimilarPhones } from "../services/embeddingService.js";
import { webSearch, formatWebResults, saveScrapedPhone } from "../services/webSearchService.js";
import { cacheGet, cacheSet } from "../utils/redis.js";
import { pool } from "../utils/db.js";
import crypto from "crypto";

const router = express.Router();

const formatPhoneContext = (rows) =>
  rows.map((p) => {
    const s = p.specs || {};
    return (
      `**${p.brand} ${p.model}**\n` +
      `OS: ${s["Operating System"] || "?"} | ` +
      `CPU: ${s["CPU"] || "?"} | ` +
      `RAM: ${s["RAM Capacity"] || "?"} | ` +
      `Storage: ${s["Non-volatile Memory Capacity"] || "?"} | ` +
      `Display: ${s["Display Diagonal"] || ""} ${s["Display Type"] || ""} ${s["Display Refresh Rate"] || ""} | ` +
      `Battery: ${s["Nominal Battery Capacity"] || "?"} | ` +
      `Charging: ${s["Max. Charging Power"] || "?"} | ` +
      `Camera: ${s["Number of effective pixels"] || "?"} | ` +
      `NFC: ${s["NFC"] || "?"} | ` +
      `Weight: ${s["Mass"] || "?"} | ` +
      `Released: ${s["Released Year"] || "?"}`
    );
  }).join("\n\n");

const extractPhoneName = (message) =>
  message
    .toLowerCase()
    .replace(/tell me about|specs of|review of|compare|what is|how is|is the|the|about|specifications|features/gi, "")
    .replace(/\s+/g, " ")
    .trim();

// General query detection
const isGeneralQuery = (message) => {
  const patterns = [
    /best\s+\w*\s*phone/i,
    /recommend/i,
    /under\s+\$?\d+/i,
    /budget\s+phone/i,
    /flagship/i,
    /top\s+\d*\s*phone/i,
    /which\s+phone/i,
    /what\s+phone/i,
    /\b5g\s+phone/i,
    /gaming\s+phone/i,
    /camera\s+phone/i,
    /long\s+battery/i,
    /cheap\s+phone/i,
    /mid.?range/i,
    /vs\s+\w/i,
  ];
  return patterns.some((p) => p.test(message));
};

// General query ke liye smart DB filter
const fetchGeneralResults = async (message) => {
  const conditions = [];
  const params = [];

  // 5G
  if (/5g/i.test(message)) {
    params.push("%5G%");
    conditions.push(`(specs->>'Network Technology' ILIKE $${params.length} OR specs->>'Network' ILIKE $${params.length})`);
  }

  // Camera query — high MP phones
  if (/camera|photo|photography|selfie|portrait/i.test(message)) {
    conditions.push(`(specs->>'Number of effective pixels')::text != ''`);
  }

  // Gaming — high RAM + good chipset
  if (/gaming|game|performance/i.test(message)) {
    params.push("%12GB%", "%16GB%", "%8GB%");
    conditions.push(`(specs->>'RAM Capacity' ILIKE $${params.length - 2} OR specs->>'RAM Capacity' ILIKE $${params.length - 1} OR specs->>'RAM Capacity' ILIKE $${params.length})`);
  }

  // Battery query
  if (/battery|long.?lasting|all.?day/i.test(message)) {
    conditions.push(`(regexp_replace(specs->>'Nominal Battery Capacity', '[^0-9]', '', 'g'))::int >= 4500`);
  }

  // RAM filter
  const ramMatch = message.match(/(\d+)\s*gb\s*ram/i);
  if (ramMatch) {
    params.push(`%${ramMatch[1]}GB%`);
    conditions.push(`specs->>'RAM Capacity' ILIKE $${params.length}`);
  }

  // Brand filter
  const brands = ["samsung", "apple", "xiaomi", "oneplus", "google", "oppo", "vivo", "realme", "motorola", "nokia", "huawei", "sony"];
  const mentionedBrand = brands.find((b) => message.toLowerCase().includes(b));
  if (mentionedBrand) {
    params.push(mentionedBrand);
    conditions.push(`LOWER(brand) = $${params.length}`);
  }

  // Recent phones (2020+)
  conditions.push(`(specs->>'Released Year') IS NOT NULL`);
  conditions.push(`(specs->>'Released Year')::int >= 2020`);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `SELECT id, brand, model, specs FROM phones
       ${where}
       ORDER BY (specs->>'Released Year')::int DESC NULLS LAST
       LIMIT 8`,
      params
    );

    // Agar conditions ke saath koi result nahi aaya — fallback
    if (rows.length === 0) {
      const { rows: fallback } = await pool.query(
        `SELECT id, brand, model, specs FROM phones
         WHERE (specs->>'Released Year')::int >= 2020
         ORDER BY (specs->>'Released Year')::int DESC NULLS LAST
         LIMIT 8`
      );
      return fallback;
    }

    return rows;
  } catch {
    const { rows } = await pool.query(
      `SELECT id, brand, model, specs FROM phones
       WHERE (specs->>'Released Year')::int >= 2020
       ORDER BY (specs->>'Released Year')::int DESC NULLS LAST
       LIMIT 8`
    );
    return rows;
  }
};

router.post("/",
  authenticate, chatLimiter,
  [body("message").trim().notEmpty().isLength({ max: 1000 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { message, history = [] } = req.body;
    const userId = req.user.id;
    const hasHistory = Array.isArray(history) && history.length > 0;
    const cacheKey = `chat:${crypto.createHash("sha256").update(message.toLowerCase().trim()).digest("hex")}`;

    try {
      if (!hasHistory) {
        const cached = await cacheGet(cacheKey);
        if (cached) {
          await pool.query(
            "INSERT INTO chat_history (user_id, message, response, cached) VALUES ($1, $2, $3, true)",
            [userId, message, cached]
          );
          return res.json({ response: cached, cached: true, source: "cache" });
        }
      }

      let context = "";
      let dataSource = "database";
      let allRows = [];

      if (isGeneralQuery(message)) {
        // ── General query — smart DB filter ─────────────────
        allRows = await fetchGeneralResults(message);
        if (allRows.length > 0) {
          context = formatPhoneContext(allRows);
        }
        // General queries ke liye web scrape nahi — AI khud answer dega
      } else {
        // ── Specific phone query ─────────────────────────────

        // Step 1: Exact + fuzzy DB match
        const { rows: exactRows } = await pool.query(
          `SELECT id, brand, model, specs FROM phones
           WHERE to_tsvector('english', brand || ' ' || model) @@ plainto_tsquery('english', $1)
              OR model ILIKE $2
              OR brand || ' ' || model ILIKE $2
           ORDER BY similarity(brand || ' ' || model, $1) DESC
           LIMIT 5`,
          [message, `%${message}%`]
        );

        // Step 2: Vector search
        const similarIds = await searchSimilarPhones(message, 5);
        let vectorRows = [];
        if (similarIds.length > 0) {
          const { rows } = await pool.query(
            "SELECT id, brand, model, specs FROM phones WHERE id = ANY($1::int[])",
            [similarIds]
          );
          vectorRows = rows;
        }

        // Step 3: Merge — exact first
        const seen = new Set();
        allRows = [...exactRows, ...vectorRows].filter((r) => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        }).slice(0, 6);

        // Step 4: Match quality check
        const cleanedQuery = extractPhoneName(message);
        const bestMatchScore = allRows.reduce((best, r) => {
          const phoneName = `${r.brand} ${r.model}`.toLowerCase();
          const queryWords = cleanedQuery.split(" ").filter((w) => w.length > 2);
          const matchCount = queryWords.filter((w) => phoneName.includes(w)).length;
          const score = queryWords.length > 0 ? matchCount / queryWords.length : 0;
          return Math.max(best, score);
        }, 0);

        const queryModelNum = cleanedQuery.match(/[a-z]\d{2,}/i)?.[0]?.toLowerCase();
        const hasModelMatch = queryModelNum
          ? allRows.some((r) => r.model.toLowerCase().includes(queryModelNum))
          : true;

        const shouldUseWeb = allRows.length === 0 || bestMatchScore < 0.5 || !hasModelMatch;

        if (!shouldUseWeb) {
          context = formatPhoneContext(allRows);
        } else {
          // Step 5: Web scrape
          dataSource = "web";
          const searchQuery = `${message} smartphone specs`;
          const { results } = await webSearch(searchQuery);
          context = formatWebResults(results);

          // Step 6: Scraped phones DB mein save karo
          for (const r of results) {
            if (r.rawSpecs) {
              await saveScrapedPhone(pool, r.rawSpecs).catch(() => { });
            }
          }
        }
      }

      const response = await queryAI(message, context, history, dataSource);

      if (!hasHistory) {
        await cacheSet(cacheKey, response, 3600);
      }

      await pool.query(
        "INSERT INTO chat_history (user_id, message, response, cached) VALUES ($1, $2, $3, false)",
        [userId, message, response]
      );

      res.json({ response, cached: false, source: dataSource });
    } catch (err) {
      res.status(500).json({ error: err.message || "Chat failed" });
    }
  }
);

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

      const findPhone = async (name) => {
        const { rows: exact } = await pool.query(
          `SELECT brand, model, specs FROM phones
           WHERE to_tsvector('english', brand || ' ' || model) @@ plainto_tsquery('english', $1)
              OR model ILIKE $2
              OR brand || ' ' || model ILIKE $2
           ORDER BY similarity(brand || ' ' || model, $1) DESC
           LIMIT 1`,
          [name, `%${name}%`]
        );
        if (exact.length > 0) return exact[0];

        const ids = await searchSimilarPhones(name, 1);
        if (ids.length > 0) {
          const { rows } = await pool.query(
            "SELECT brand, model, specs FROM phones WHERE id = $1",
            [ids[0]]
          );
          return rows[0] || null;
        }
        return null;
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
      const prompt = `Compare these two phones in detail.\n\nPhone A: ${JSON.stringify(specA)}\nPhone B: ${JSON.stringify(specB)}\n\nStructure:\n1. Spec comparison table (markdown)\n2. Category winners\n3. Who should buy which\n4. Overall verdict`;
      const aiResponse = await queryAI(prompt);
      const result = { phoneA: specA, phoneB: specB, analysis: aiResponse };

      await cacheSet(cacheKey, JSON.stringify(result), 86400);
      res.json({ response: result, cached: false });
    } catch (err) {
      res.status(500).json({ error: err.message || "Compare failed" });
    }
  }
);

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

router.delete("/history", authenticate, async (req, res) => {
  try {
    await pool.query("DELETE FROM chat_history WHERE user_id = $1", [req.user.id]);
    res.json({ message: "History cleared" });
  } catch {
    res.status(500).json({ error: "Failed to clear history" });
  }
});

export default router;