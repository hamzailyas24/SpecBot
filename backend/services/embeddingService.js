import { pool } from "../utils/db.js";
import logger from "../utils/logger.js";
import { pipeline } from "@xenova/transformers";

let embedder = null;

export const initEmbedder = async () => {
  if (!embedder) {
    embedder = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
};

export const getEmbedding = async (text) => {
  await initEmbedder();
  const output = await embedder(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
};

// FIX #12: Include battery, charging, camera, weight, NFC, display refresh in embedding
// text so queries like "long battery", "light phone", "fast charging" actually match.
// Previously only model/OS/CPU/RAM/display-type/year were included.
export const addPhoneEmbedding = async ({ id, model, specs }) => {
  try {
    const text = [
      model,
      specs["Operating System"]           || "",
      specs["CPU"]                         || "",
      specs["RAM Capacity"]                || "",
      specs["Display Type"]                || "",
      specs["Display Refresh Rate"]        || "",
      specs["Nominal Battery Capacity"]    || "",
      specs["Max. Charging Power"]         || "",
      specs["Number of effective pixels"]  || "",
      specs["NFC"]                         || "",
      specs["Mass"]                        || "",
      specs["Released Year"]               || "",
    ].filter(Boolean).join(" ");

    const vector = await getEmbedding(text);

    await pool.query(
      "UPDATE phones SET embedding = $1 WHERE id = $2",
      [`[${vector.join(",")}]`, id]
    );
  } catch (err) {
    logger.error("Embedding save error", { err: err.message, model });
    throw err;
  }
};

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
