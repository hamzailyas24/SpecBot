#!/usr/bin/env node
// Run with: node scripts/runImport.js [optional/path/to/dataset.csv]
import dotenv from "dotenv";
dotenv.config();

import { importDataset } from "../services/importDataset.js";
import { processEmbeddingQueue } from "../services/embedQueue.js";
import logger from "../utils/logger.js";

const csvPath = process.argv[2] || process.env.DATASET_PATH;

logger.info("=== SpecBot Dataset Import ===");

try {
  const summary = await importDataset(csvPath);
  logger.info("Import done", summary);

  logger.info("=== Processing Embedding Queue ===");
  logger.info("This will take a while (~8 hours for 24k phones on HF free tier)");
  logger.info("You can Ctrl+C and restart — it resumes from where it left off");

  const embedSummary = await processEmbeddingQueue();
  logger.info("Embeddings done", embedSummary);
} catch (err) {
  logger.error("Fatal error", { err: err.message });
  process.exit(1);
}

process.exit(0);
