import Redis from "ioredis";
import logger from "./logger.js";

let client = null;
let available = false;

const connect = () => {
  if (!process.env.REDIS_URL) {
    logger.warn("REDIS_URL not set — caching disabled");
    return;
  }

  client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on("ready",  () => { available = true;  logger.info("Redis connected"); });
  client.on("error",  (e) => { available = false; logger.warn("Redis error — caching off", { err: e.message }); });
  client.on("close",  () => { available = false; });

  client.connect().catch(() => {});
};

connect();

// Safe wrappers — never throw, just return null on failure
export const cacheGet = async (key) => {
  if (!available) return null;
  try { return await client.get(key); } catch { return null; }
};

export const cacheSet = async (key, value, ttlSeconds = 3600) => {
  if (!available) return;
  try { await client.setex(key, ttlSeconds, value); } catch {}
};

export const cacheDel = async (key) => {
  if (!available) return;
  try { await client.del(key); } catch {}
};

export const cacheFlushPattern = async (pattern) => {
  if (!available) return;
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) await client.del(...keys);
  } catch {}
};

export const isRedisAvailable = () => available;
