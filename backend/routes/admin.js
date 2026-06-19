import express from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.js";
import { pool } from "../utils/db.js";
import { importDataset } from "../services/importDataset.js";
import { processEmbeddingQueue } from "../services/embedQueue.js";
import { cacheFlushPattern, isRedisAvailable } from "../utils/redis.js";

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get("/stats", async (req, res) => {
  try {
    const [phones, users, chats, lastImport, embedStats, cacheHits] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM phones"),
      pool.query("SELECT COUNT(*) FROM users"),
      pool.query("SELECT COUNT(*) FROM chat_history"),
      pool.query("SELECT * FROM import_runs ORDER BY created_at DESC LIMIT 1"),
      pool.query("SELECT status, COUNT(*) FROM embedding_queue GROUP BY status"),
      pool.query("SELECT COUNT(*) FILTER (WHERE cached=true) hits, COUNT(*) total FROM chat_history"),
    ]);

    const embedMap = {};
    embedStats.rows.forEach((r) => { embedMap[r.status] = parseInt(r.count); });

    const ch = cacheHits.rows[0];

    res.json({
      totalPhones:  parseInt(phones.rows[0].count),
      totalUsers:   parseInt(users.rows[0].count),
      totalChats:   parseInt(chats.rows[0].count),
      cacheHitRate: ch.total > 0 ? Math.round((ch.hits / ch.total) * 100) : 0,
      lastImport:   lastImport.rows[0] || null,
      embeddings:   embedMap,
      redisOnline:  isRedisAvailable(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/import", async (req, res) => {
  res.json({ message: "Import started in background" });
  importDataset().catch((e) => console.error("Import error:", e));
});

router.post("/embed", async (req, res) => {
  res.json({ message: "Embedding queue started in background" });
  processEmbeddingQueue().catch((e) => console.error("Embed error:", e));
});

router.get("/import-runs", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM import_runs ORDER BY created_at DESC LIMIT 10"
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/embed-status", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT status, COUNT(*) FROM embedding_queue GROUP BY status"
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

// FIX #10: Flush all cache namespaces including web-scrape caches.
// Previously only chat:* and compare:* were flushed, leaving gsmarena/kimovil/phonearena
// caches (7-day TTL) impossible to clear even after stale data was detected.
router.delete("/cache", async (req, res) => {
  try {
    await Promise.all([
      cacheFlushPattern("chat:*"),
      cacheFlushPattern("compare:*"),
      cacheFlushPattern("gsmarena:*"),
      cacheFlushPattern("kimovil:*"),
      cacheFlushPattern("phonearena:*"),
    ]);
    res.json({ message: "Cache flushed (chat + compare + scrape sources)" });
  } catch {
    res.status(500).json({ error: "Cache flush failed" });
  }
});

router.get("/phones", async (req, res) => {
  const q      = req.query.q?.trim() || "";
  const brand  = req.query.brand?.trim() || "";
  const year   = req.query.year?.trim() || "";
  const page   = Math.max(parseInt(req.query.page) || 1, 1);
  const limit  = 30;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    const params = [];

    if (q) {
      params.push(q, `%${q}%`);
      conditions.push(`(search_vec @@ plainto_tsquery('english', $1) OR model ILIKE $2 OR brand ILIKE $2)`);
    }
    if (brand) { params.push(`%${brand}%`); conditions.push(`brand ILIKE $${params.length}`); }
    if (year)  { params.push(year);          conditions.push(`specs->>'Released Year' = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM phones ${where}`, params),
      pool.query(
        `SELECT id, brand, model,
          specs->>'Released Year' AS year,
          specs->>'Operating System' AS os,
          specs->>'RAM Capacity' AS ram,
          specs->>'Nominal Battery Capacity' AS battery,
          specs->>'Number of effective pixels' AS camera,
          specs->>'Display Diagonal' AS display,
          specs->>'Mass' AS weight
         FROM phones ${where}
         ORDER BY (specs->>'Released Year') DESC NULLS LAST, model
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
    ]);

    res.json({
      phones: dataRes.rows,
      total:  parseInt(countRes.rows[0].count),
      page,
      pages:  Math.ceil(parseInt(countRes.rows[0].count) / limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/phones/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM phones WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/users", async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, role, created_at FROM users
       ORDER BY created_at DESC LIMIT 30 OFFSET $1`,
      [(page - 1) * 30]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

router.patch("/users/:id/role", async (req, res) => {
  const { role } = req.body;
  if (!["user", "admin"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  try {
    await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, req.params.id]);
    res.json({ message: "Role updated" });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
