import express from "express";
import { authenticate } from "../middlewares/auth.js";
import { pool } from "../utils/db.js";
import { searchSimilarPhones } from "../services/embeddingService.js";

const router = express.Router();

// GET /user/phones/search?q=&brand=&year=&page=
router.get("/phones/search", authenticate, async (req, res) => {
  const q      = req.query.q?.trim() || "";
  const brand  = req.query.brand?.trim() || "";
  const year   = req.query.year?.trim() || "";
  const page   = Math.max(parseInt(req.query.page) || 1, 1);
  const limit  = 20;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    const params = [];

    if (q) {
      params.push(q);
      conditions.push(
        `(search_vec @@ plainto_tsquery('english', $${params.length})
         OR model ILIKE $${params.length + 1}
         OR brand ILIKE $${params.length + 1})`
      );
      params.push(`%${q}%`);
    }
    if (brand) {
      params.push(`%${brand}%`);
      conditions.push(`brand ILIKE $${params.length}`);
    }
    if (year) {
      params.push(year);
      conditions.push(`specs->>'Released Year' = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await pool.query(`SELECT COUNT(*) FROM phones ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(limit, offset);
    const { rows } = await pool.query(
      `SELECT id, brand, model,
        specs->>'Released Year' AS year,
        specs->>'Operating System' AS os,
        specs->>'RAM Capacity' AS ram,
        specs->>'Nominal Battery Capacity' AS battery,
        specs->>'Number of effective pixels' AS camera,
        specs->>'Display Diagonal' AS display
       FROM phones ${where}
       ORDER BY specs->>'Released Year' DESC NULLS LAST, model
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ phones: rows, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Search failed: " + err.message });
  }
});

// GET /user/phones/brands — list of all brands for filter
router.get("/phones/brands", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT DISTINCT brand FROM phones ORDER BY brand"
    );
    res.json(rows.map((r) => r.brand));
  } catch {
    res.status(500).json({ error: "Failed to fetch brands" });
  }
});

// GET /user/phones/:id
router.get("/phones/:id", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM phones WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Phone not found" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to fetch phone" });
  }
});

// GET /user/favorites
router.get("/favorites", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.brand, p.model,
        p.specs->>'Released Year' AS year,
        p.specs->>'RAM Capacity' AS ram,
        p.specs->>'Nominal Battery Capacity' AS battery
       FROM favorite_phones fp
       JOIN phones p ON p.id = fp.phone_id
       WHERE fp.user_id = $1
       ORDER BY fp.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

// POST /user/favorites/:phoneId
router.post("/favorites/:phoneId", authenticate, async (req, res) => {
  try {
    await pool.query(
      "INSERT INTO favorite_phones (user_id, phone_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [req.user.id, req.params.phoneId]
    );
    res.status(201).json({ message: "Added to favorites" });
  } catch {
    res.status(500).json({ error: "Failed to add favorite" });
  }
});

// DELETE /user/favorites/:phoneId
router.delete("/favorites/:phoneId", authenticate, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM favorite_phones WHERE user_id = $1 AND phone_id = $2",
      [req.user.id, req.params.phoneId]
    );
    res.json({ message: "Removed from favorites" });
  } catch {
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

// GET /user/recommendations
router.get("/recommendations", authenticate, async (req, res) => {
  try {
    const { rows: favs } = await pool.query(
      "SELECT p.model FROM favorite_phones fp JOIN phones p ON p.id = fp.phone_id WHERE fp.user_id = $1 LIMIT 3",
      [req.user.id]
    );

    if (favs.length === 0) {
      const { rows } = await pool.query(
        `SELECT id, brand, model, specs->>'Released Year' AS year
         FROM phones ORDER BY specs->>'Released Year' DESC NULLS LAST LIMIT 12`
      );
      return res.json(rows);
    }

    const query = favs.map((f) => f.model).join(", ");
    const similarIds = await searchSimilarPhones(query, 12);

    if (similarIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT id, brand, model,
          specs->>'Released Year' AS year,
          specs->>'RAM Capacity' AS ram,
          specs->>'Nominal Battery Capacity' AS battery
         FROM phones WHERE id = ANY($1::int[])`,
        [similarIds]
      );
      return res.json(rows);
    }

    // Fallback: recent phones
    const { rows } = await pool.query(
      `SELECT id, brand, model, specs->>'Released Year' AS year FROM phones
       ORDER BY specs->>'Released Year' DESC NULLS LAST LIMIT 12`
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

export default router;
