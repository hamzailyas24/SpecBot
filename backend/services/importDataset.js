import { createReadStream } from "fs";
import { createInterface } from "readline";
import { pool } from "../utils/db.js";
import logger from "../utils/logger.js";

const DELIMITER = ";";
const BATCH_SIZE = 200;
const SKIP_COLS = new Set(["Brand", "Model"]);

const parseLine = (line) =>
  line.split(DELIMITER).map((v) => v.trim().replace(/\r$/, "") || null);

export const importDataset = async (csvPath) => {
  const path = csvPath || process.env.DATASET_PATH || "./dataset.csv";
  logger.info("Dataset import starting", { path });

  const { rows: [run] } = await pool.query(
    "INSERT INTO import_runs (status) VALUES ('running') RETURNING id"
  );

  const stream = createReadStream(path, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let headers = null;
  let batch = [];
  let imported = 0, skipped = 0, errors = 0, lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    if (!line.trim()) continue;
    const values = parseLine(line);

    if (!headers) {
      headers = values;
      logger.info(`Columns: ${headers.length}`);
      continue;
    }

    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? null; });

    const brand = row["Brand"];
    const model = row["Model"];
    if (!brand || !model) { skipped++; continue; }

    const year = parseInt(row["Released Year"]);
    if (!isNaN(year) && year < 2010) { skipped++; continue; }

    const specs = {};
    for (const [k, v] of Object.entries(row)) {
      if (!SKIP_COLS.has(k) && v !== null) specs[k] = v;
    }

    batch.push({ brand, model, specs });

    if (batch.length >= BATCH_SIZE) {
      const r = await flushBatch(batch);
      imported += r.imported; skipped += r.skipped; errors += r.errors;
      batch = [];
      if (lineNum % 2000 === 0) {
        logger.info(`Progress: ${lineNum} lines`, { imported, skipped, errors });
      }
    }
  }

  if (batch.length > 0) {
    const r = await flushBatch(batch);
    imported += r.imported; skipped += r.skipped; errors += r.errors;
  }

  await pool.query(
    "UPDATE import_runs SET imported=$1, skipped=$2, errors=$3, total=$4, status='completed' WHERE id=$5",
    [imported, skipped, errors, lineNum - 1, run.id]
  );

  const summary = { imported, skipped, errors, total: lineNum - 1 };
  logger.info("Import complete", summary);
  return summary;
};

const flushBatch = async (batch) => {
  let imported = 0, skipped = 0, errors = 0;

  for (const { brand, model, specs } of batch) {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `INSERT INTO phones (brand, model, specs)
         VALUES ($1, $2, $3)
         ON CONFLICT (brand, model) DO NOTHING
         RETURNING id`,
        [brand, model, JSON.stringify(specs)]
      );

      if (res.rows.length > 0) {
        await client.query(
          "INSERT INTO embedding_queue (phone_id) VALUES ($1) ON CONFLICT DO NOTHING",
          [res.rows[0].id]
        );
        imported++;
      } else {
        skipped++;
      }
    } catch (err) {
      logger.error("Row error", { model, err: err.message });
      errors++;
    } finally {
      client.release();
    }
  }

  return { imported, skipped, errors };
};