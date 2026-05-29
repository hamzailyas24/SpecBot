import { pool } from "../utils/db.js";
import logger from "../utils/logger.js";
import { pipeline } from "@xenova/transformers";

// Use Xenova JS model (no ONNX)
let embedder = null;

export const initEmbedder = async () => {
  if (!embedder) {
    embedder = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2" // ✅ JS-native, works in Docker
    );
  }
};

export const getEmbedding = async (text) => {
  await initEmbedder();

  const output = await embedder(text, {
    pooling: "mean",       // average pooling for sentence embedding
    normalize: true        // normalize vector
  });

  // output.data is Float32Array → convert to normal array
  return Array.from(output.data);
};

// Save embedding directly into phones table via pgvector
export const addPhoneEmbedding = async ({ id, model, specs }) => {
  try {
    const text = [
      model,
      specs["Operating System"] || "",
      specs["CPU"] || "",
      specs["RAM Capacity"] || "",
      specs["Display Type"] || "",
      specs["Released Year"] || "",
    ].filter(Boolean).join(" ");

    const vector = await getEmbedding(text);

    // pgvector expects array format: '[0.1, 0.2, ...]'
    await pool.query(
      "UPDATE phones SET embedding = $1 WHERE id = $2",
      [`[${vector.join(",")}]`, id]
    );
  } catch (err) {
    logger.error("Embedding save error", { err: err.message, model });
    throw err;
  }
};

// Search similar phones using cosine similarity in Postgres
export const searchSimilarPhones = async (query, nResults = 5) => {
  try {
    const vector = await getEmbedding(query);

    const { rows } = await pool.query(
      `SELECT id
       FROM phones
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1
       LIMIT $2`,
      [`[${vector.join(",")}]`, nResults]
    );

    return rows.map((r) => r.id);
  } catch (err) {
    logger.error("Vector search error", { err: err.message });
    return [];
  }
};