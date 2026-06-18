import express from "express";
import { authenticate } from "../middlewares/auth.js";
import { pool } from "../utils/db.js";
import { searchSimilarPhones } from "../services/embeddingService.js";
import { webSearch, formatWebResults } from "../services/webSearchService.js";

const router = express.Router();

// GET /user/phones/search?q=&brand=&year=&page=
router.get("/phones/search", authenticate, async (req, res) => {
  const q = req.query.q?.trim() || "";
  const brand = req.query.brand?.trim() || "";
  const year = req.query.year?.trim() || "";
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = 20;
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

// POST /user/matchmaker
router.post("/matchmaker", authenticate, async (req, res) => {
  const { lifestyle } = req.body;
  if (!lifestyle || lifestyle.trim().length < 10) {
    return res.status(400).json({ error: "Describe your usage in at least 10 characters" });
  }

  try {
    // Step 1: AI se spec requirements extract karo
    const extractPrompt = `A user described their phone usage as:
"${lifestyle}"

Extract the most important smartphone specs they need. Return ONLY a JSON object like this:
{
  "priorities": ["battery", "camera", "performance", "display", "storage"],
  "minRam": "6GB",
  "minBattery": "5000mAh",
  "preferredOS": "Android",
  "mustHave": ["fast charging", "night mode"],
  "avoid": ["small battery"],
  "searchQuery": "long battery life night camera AMOLED",
  "summary": "One sentence explaining what this user needs"
}
Only return valid JSON, nothing else.`;

    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const extraction = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: extractPrompt }],
      temperature: 0.1,
      max_tokens: 512,
    });

    let specs;
    try {
      const raw = extraction.choices[0]?.message?.content || "{}";
      specs = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      specs = { searchQuery: lifestyle, summary: "Custom search based on your description" };
    }

    // Step 2: Vector search in DB
    const { searchSimilarPhones } = await import("../services/embeddingService.js");
    const similarIds = await searchSimilarPhones(specs.searchQuery || lifestyle, 10);

    let phoneList = [];
    let usedWeb = false;

    if (similarIds.length > 0) {
      // DB se mila — full specs fetch karo
      const { rows } = await pool.query(
        `SELECT id, brand, model, specs FROM phones WHERE id = ANY($1::int[])`,
        [similarIds]
      );
      phoneList = rows.map((p) => {
        const s = p.specs || {};
        return {
          id: p.id,
          name: `${p.brand} ${p.model}`,
          battery: s["Nominal Battery Capacity"],
          ram: s["RAM Capacity"],
          storage: s["Non-volatile Memory Capacity"],
          cpu: s["CPU"],
          display: `${s["Display Diagonal"]} ${s["Display Type"]} ${s["Display Refresh Rate"] || ""}`,
          camera: s["Number of effective pixels"],
          charging: s["Max. Charging Power"],
          os: s["Operating System"],
          nfc: s["NFC"],
          weight: s["Mass"],
          year: s["Released Year"],
          source: "database",
        };
      });
    }

    // DB mein kam results (< 3) ya koi nahi — web se bhi dhoondho
    if (phoneList.length < 3) {
      usedWeb = true;
      const webQuery = `best smartphone for ${specs.searchQuery || lifestyle} specs review 2024`;
      const { results: webResults } = await webSearch(webQuery);

      if (webResults.length > 0) {
        // Web results ko AI se structured phone list mein convert karo
        const webExtractPrompt = `From these web search results about smartphones, extract up to 3 phone recommendations with their specs.

Search results:
${formatWebResults(webResults)}

Return ONLY a JSON array:
[
  {
    "id": null,
    "name": "Brand Model",
    "battery": "5000mAh",
    "ram": "8GB",
    "storage": "128GB",
    "cpu": "Snapdragon 7s Gen 2",
    "display": "6.7 inch AMOLED 120Hz",
    "camera": "50MP",
    "charging": "33W",
    "os": "Android 14",
    "source": "web",
    "sourceUrl": "https://..."
  }
]
Only return valid JSON array, nothing else. If no specific phones found, return [].`;

        const webExtraction = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: webExtractPrompt }],
          temperature: 0.1,
          max_tokens: 800,
        });

        try {
          const raw = webExtraction.choices[0]?.message?.content || "[]";
          const webPhones = JSON.parse(raw.replace(/```json|```/g, "").trim());
          // Web phones ko phoneList mein merge karo (duplicates avoid)
          const existingNames = phoneList.map((p) => p.name.toLowerCase());
          webPhones.forEach((wp, i) => {
            if (!existingNames.includes(wp.name?.toLowerCase())) {
              phoneList.push({ ...wp, id: `web-${i}` });
            }
          });
        } catch {
          // Web extraction fail — continue with whatever phoneList has
        }
      }
    }

    if (phoneList.length === 0) {
      return res.json({ matches: [], specs, message: "No matches found" });
    }

    // Step 4: AI se har phone ko score karo aur explain karo


    const rankPrompt = `User lifestyle: "${lifestyle}"

User needs summary: ${specs.summary || ""}
Priorities: ${(specs.priorities || []).join(", ")}
Must have: ${(specs.mustHave || []).join(", ")}

Available phones:
${JSON.stringify(phoneList, null, 2)}

Rank the TOP 3 phones for this user. Return ONLY a JSON array:
[
  {
    "id": 123,
    "name": "Brand Model",
    "matchScore": 92,
    "verdict": "Best choice because...",
    "pros": ["Great battery", "Excellent night camera"],
    "cons": ["Heavy weight"],
    "bestFor": "Heavy YouTube watchers who need all-day battery"
  }
]
Only return valid JSON array, nothing else.`;

    const ranking = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: rankPrompt }],
      temperature: 0.2,
      max_tokens: 1024,
    });

    let matches = [];
    try {
      const raw = ranking.choices[0]?.message?.content || "[]";
      matches = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      matches = phoneList.slice(0, 3).map((p) => ({
        id: p.id,
        name: p.name,
        matchScore: 80,
        verdict: "Good match for your needs",
        pros: [],
        cons: [],
        bestFor: specs.summary || "",
      }));
    }

    // Full specs bhi attach karo matches mein
    const matchesWithSpecs = matches.map((m) => ({
      ...m,
      specs: phoneList.find((p) => p.id === m.id) || {},
    }));

    res.json({ matches: matchesWithSpecs, extracted: specs, usedWeb });
  } catch (err) {
    res.status(500).json({ error: err.message || "Matchmaker failed" });
  }
});

export default router;
