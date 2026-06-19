import { pool } from "../utils/db.js";
import { addPhoneEmbedding } from "./embeddingService.js";
import logger from "../utils/logger.js";

const BATCH_SIZE = 100;   // 10x faster than old 10
const CONCURRENCY = 10;   // max parallel embeddings at a time
const MAX_ATTEMPTS = 3;

// Utility to process in limited concurrency
const parallelLimit = async (items, limit, fn) => {
  const results = [];
  let i = 0;

  const runNext = async () => {
    if (i >= items.length) return;
    const index = i++;
    try {
      results[index] = await fn(items[index]);
    } catch (err) {
      results[index] = { error: err };
    }
    await runNext();
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, runNext);
  await Promise.all(workers);
  return results;
};

export const processEmbeddingQueue = async () => {
  logger.info("Embedding queue processor started");
  let processed = 0, failed = 0;

  while (true) {
    // Grab next batch of pending items
    const { rows: items } = await pool.query(
      `SELECT eq.id, eq.phone_id, eq.attempts, p.model, p.specs
       FROM embedding_queue eq
       JOIN phones p ON p.id = eq.phone_id
       WHERE eq.status = 'pending' AND eq.attempts < $1
       ORDER BY eq.id
       LIMIT $2`,
      [MAX_ATTEMPTS, BATCH_SIZE]
    );

    if (items.length === 0) break;

    // Process embeddings in parallel
    const results = await parallelLimit(items, CONCURRENCY, async (item) => {
      try {
        await addPhoneEmbedding({ id: item.phone_id, model: item.model, specs: item.specs });
        await pool.query("UPDATE embedding_queue SET status = 'done' WHERE id = $1", [item.id]);
        return { success: true };
      } catch (err) {
        const newAttempts = item.attempts + 1;
        const newStatus = newAttempts >= MAX_ATTEMPTS ? "failed" : "pending";
        await pool.query(
          "UPDATE embedding_queue SET attempts = $1, status = $2 WHERE id = $3",
          [newAttempts, newStatus, item.id]
        );
        if (newStatus === "failed") {
          logger.warn("Embedding failed after max attempts", { model: item.model });
        }
        return { success: false };
      }
    });

    // Update counters
    processed += results.filter(r => r.success).length;
    failed += results.filter(r => !r.success).length;

    logger.info("Embedding queue progress", { processed, failed });
  }

  const { rows: [counts] } = await pool.query(
    "SELECT COUNT(*) FILTER (WHERE status='done') done, COUNT(*) FILTER (WHERE status='failed') failed FROM embedding_queue"
  );

  logger.info("Embedding queue complete", counts);
  return { processed, failed };
};