import logger from "../utils/logger.js";
import * as cheerio from "cheerio";
import { cacheGet, cacheSet } from "../utils/redis.js";

const CACHE_TTL = 60 * 60 * 24 * 7; // 7 din
const DELAY_MS  = 1200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchHtml = async (url) => {
  const res = await fetch(url, {
    headers: {
      "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Cache-Control":   "no-cache",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
};

// ─────────────────────────────────────────────
// 1. GSMARENA
// (GSMArena ka apna search.php3 ab bots ko Phone Finder page deta hai —
//  DuckDuckGo se exact page URL discover karo, phir proven scrape() chalao)
// ─────────────────────────────────────────────
const gsmarena = {
  async search(query) {
    const cacheKey = `gsmarena:search:${query.toLowerCase().trim()}`;
    const cached   = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const links = [];

    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
        "site:gsmarena.com " + query
      )}`;
      const html = await fetchHtml(ddgUrl);
      const $    = cheerio.load(html);

      $("a.result__a").each((_, el) => {
        if (links.length >= 2) return false;
        let href = $(el).attr("href") || "";

        const wrapped = href.match(/uddg=([^&]+)/);
        if (wrapped) href = decodeURIComponent(wrapped[1]);

        const slugMatch = href.match(/gsmarena\.com\/([a-z0-9_]+-\d+\.php)/i);
        if (slugMatch) {
          const name = $(el).text().trim().replace(/\s*-\s*GSMArena.*/i, "");
          links.push({ slug: slugMatch[1], name });
        }
      });
    } catch (err) {
      logger.warn("GSMArena DDG discovery failed", { err: err.message });
    }

    console.log("GSMArena search (via DDG):", query, "→", links.length, links.map((l) => l.name));
    await cacheSet(cacheKey, JSON.stringify(links), 60 * 60 * 24);
    return links;
  },

  async scrape(slug, name) {
    const cacheKey = `gsmarena:specs:${slug}`;
    const cached   = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const url  = `https://www.gsmarena.com/${slug}`;
    const html = await fetchHtml(url);
    const $    = cheerio.load(html);

    const specs = { name: name || "", sourceUrl: url, source: "GSMArena" };

    const title = $("h1.specs-phone-name-title").text().trim();
    if (title) specs.name = title;

    const img = $("div.specs-photo-main a img").attr("src");
    if (img) specs.image = img;

    $("table tr").each((_, row) => {
      const label = $(row).find("td.ttl").text().trim();
      const value = $(row).find("td.nfo").text().replace(/\s+/g, " ").trim();
      if (label && value) specs[label] = value;
    });

    await cacheSet(cacheKey, JSON.stringify(specs), CACHE_TTL);
    return specs;
  },

  async get(query) {
    const links = await this.search(query);
    if (!links.length) return [];
    const results = [];
    for (const link of links) {
      try {
        await sleep(DELAY_MS);
        const specs = await this.scrape(link.slug, link.name);
        results.push(specs);
      } catch (err) {
        logger.warn("GSMArena scrape fail", { err: err.message });
      }
    }
    return results;
  },
};

// ─────────────────────────────────────────────
// 2. KIMOVIL
// ─────────────────────────────────────────────
const kimovil = {
  async search(query) {
    const cacheKey = `kimovil:search:${query.toLowerCase().trim()}`;
    const cached   = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const links = [];

    try {
      const html = await fetchHtml(
        `https://www.kimovil.com/en/search/${encodeURIComponent(query)}`
      );
      const $ = cheerio.load(html);

      $(".b-search-product-item").each((_, el) => {
        if (links.length >= 2) return false;
        const a    = $(el).find("a").first();
        const href = a.attr("href");
        const name = $(el).find(".b-search-product-item__title").text().trim() ||
                     a.attr("title") || "";
        if (href && name) links.push({ href, name });
      });

      if (links.length === 0) {
        $("a[href*='/en/frequency-checker/']").each((_, el) => {
          if (links.length >= 2) return false;
          const href = $(el).attr("href");
          const name = $(el).text().trim();
          if (href && name) links.push({ href, name });
        });
      }
    } catch (err) {
      logger.warn("Kimovil search failed", { err: err.message });
    }

    await cacheSet(cacheKey, JSON.stringify(links), 60 * 60 * 24);
    return links;
  },

  async scrape(href, name) {
    const cacheKey = `kimovil:specs:${href}`;
    const cached   = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const url  = href.startsWith("http") ? href : `https://www.kimovil.com${href}`;
    const html = await fetchHtml(url);
    const $    = cheerio.load(html);

    const specs = { name: name || "", sourceUrl: url, source: "Kimovil" };

    const title = $("h1").first().text().trim();
    if (title) specs.name = title;

    const img = $(".phone-image img, .product-image img").first().attr("src");
    if (img) specs.image = img.startsWith("http") ? img : `https://www.kimovil.com${img}`;

    $(".specs-list__item, .b-specs-list__row").each((_, el) => {
      const label = $(el).find(".specs-list__label, .b-specs-list__label").text().trim();
      const value = $(el).find(".specs-list__value, .b-specs-list__value").text().replace(/\s+/g, " ").trim();
      if (label && value) specs[label] = value;
    });

    $("table tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const label = $(cells[0]).text().trim();
        const value = $(cells[1]).text().replace(/\s+/g, " ").trim();
        if (label && value && !specs[label]) specs[label] = value;
      }
    });

    await cacheSet(cacheKey, JSON.stringify(specs), CACHE_TTL);
    return specs;
  },

  async get(query) {
    const links = await this.search(query);
    if (!links.length) return [];
    const results = [];
    for (const link of links) {
      try {
        await sleep(DELAY_MS);
        const specs = await this.scrape(link.href, link.name);
        results.push(specs);
      } catch (err) {
        logger.warn("Kimovil scrape fail", { err: err.message });
      }
    }
    return results;
  },
};

// ─────────────────────────────────────────────
// 3. PHONEARENA
// ─────────────────────────────────────────────
const phonearena = {
  async search(query) {
    const cacheKey = `phonearena:search:${query.toLowerCase().trim()}`;
    const cached   = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const links = [];

    try {
      const html = await fetchHtml(
        `https://www.phonearena.com/phones/search?search=${encodeURIComponent(query)}`
      );
      const $ = cheerio.load(html);

      $(".phone-item, .widget_item").each((_, el) => {
        if (links.length >= 2) return false;
        const a    = $(el).find("a").first();
        const href = a.attr("href");
        const name = $(el).find(".PHONEWIDGET_NAME, h3, .phone-name").text().trim() ||
                     a.attr("title") || "";
        if (href && name) links.push({ href, name });
      });
    } catch (err) {
      logger.warn("PhoneArena search failed", { err: err.message });
    }

    await cacheSet(cacheKey, JSON.stringify(links), 60 * 60 * 24);
    return links;
  },

  async scrape(href, name) {
    const cacheKey = `phonearena:specs:${href}`;
    const cached   = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const url  = href.startsWith("http") ? href : `https://www.phonearena.com${href}`;
    const html = await fetchHtml(url);
    const $    = cheerio.load(html);

    const specs = { name: name || "", sourceUrl: url, source: "PhoneArena" };

    const title = $("h1").first().text().trim();
    if (title) specs.name = title;

    const img = $(".widgetPhoneImage img, .main-phone-img img").first().attr("src");
    if (img) specs.image = img;

    $(".widgetSpecs_col_model_1, .spec-row").each((_, el) => {
      const label = $(el).find(".widgetSpecs_name, .spec-title").text().trim();
      const value = $(el).find(".widgetSpecs_value, .spec-value").text().replace(/\s+/g, " ").trim();
      if (label && value) specs[label] = value;
    });

    $("table tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const label = $(cells[0]).text().trim();
        const value = $(cells[1]).text().replace(/\s+/g, " ").trim();
        if (label && value && !specs[label]) specs[label] = value;
      }
    });

    const review = $(".article-text p, .review-intro p").first().text().trim();
    if (review) specs["Review Snippet"] = review.slice(0, 300);

    await cacheSet(cacheKey, JSON.stringify(specs), CACHE_TTL);
    return specs;
  },

  async get(query) {
    const links = await this.search(query);
    if (!links.length) return [];
    const results = [];
    for (const link of links) {
      try {
        await sleep(DELAY_MS);
        const specs = await this.scrape(link.href, link.name);
        results.push(specs);
      } catch (err) {
        logger.warn("PhoneArena scrape fail", { err: err.message });
      }
    }
    return results;
  },
};

// ─────────────────────────────────────────────
// 4. WHATMOBILE.COM.PK — Pakistan pricing (PKR)
// ─────────────────────────────────────────────
const whatmobile = {
  async search(query) {
    const cacheKey = `whatmobile:search:${query.toLowerCase().trim()}`;
    const cached   = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const links = [];

    try {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
        "site:whatmobile.com.pk " + query
      )}`;
      const html = await fetchHtml(ddgUrl);
      const $    = cheerio.load(html);

      $("a.result__a").each((_, el) => {
        if (links.length >= 1) return false; // sirf best match
        let href = $(el).attr("href") || "";

        const wrapped = href.match(/uddg=([^&]+)/);
        if (wrapped) href = decodeURIComponent(wrapped[1]);

        const isProduct = href.includes("whatmobile.com.pk/") &&
          !/_Reviews|_Pictures|-vs-|Mobiles_Prices|Comingsoon|news-|advanceSearch/i.test(href);

        if (isProduct) {
          const path = href.split("whatmobile.com.pk/")[1]?.split("?")[0];
          if (path && path.includes("_")) {
            const name = $(el).text().trim().replace(/\s*-\s*WhatMobile.*/i, "").replace(/Price.*$/i, "").trim();
            links.push({ href, name });
          }
        }
      });
    } catch (err) {
      logger.warn("WhatMobile DDG discovery failed", { err: err.message });
    }

    await cacheSet(cacheKey, JSON.stringify(links), 60 * 60 * 24);
    return links;
  },

  async scrape(href, name) {
    const cacheKey = `whatmobile:specs:${href}`;
    const cached   = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);

    const html = await fetchHtml(href);
    const $    = cheerio.load(html);

    const specs = { name: name || "", sourceUrl: href, source: "WhatMobile.pk" };

    const title = $("h1").first().text().trim();
    if (title) specs.name = title;

    const bodyText    = $("body").text();
    const priceMatch  = bodyText.match(/Rs\.?\s*([\d,]{4,})/);
    const usdMatch    = bodyText.match(/USD\s*\$?\s*([\d,]+)/i);
    if (priceMatch) specs["Price (PKR)"] = `Rs. ${priceMatch[1]}`;
    if (usdMatch)   specs["Price (USD)"] = `$${usdMatch[1]}`;

    let lastKey = null;
    $("table tr").each((_, row) => {
      const cells = $(row)
        .find("td")
        .map((_, td) => $(td).text().replace(/\s+/g, " ").trim())
        .get()
        .filter(Boolean);

      if (cells.length >= 2) {
        const label = cells[cells.length - 2];
        const value = cells[cells.length - 1];
        if (label && value && label.length < 40) {
          specs[label] = value;
          lastKey = label;
        }
      } else if (cells.length === 1 && lastKey && specs[lastKey]) {
        specs[lastKey] += " " + cells[0];
      }
    });

    await cacheSet(cacheKey, JSON.stringify(specs), CACHE_TTL);
    return specs;
  },

  async get(query) {
    const links = await this.search(query);
    if (!links.length) return [];
    const results = [];
    for (const link of links) {
      try {
        await sleep(DELAY_MS);
        const specs = await this.scrape(link.href, link.name);
        results.push(specs);
      } catch (err) {
        logger.warn("WhatMobile scrape fail", { err: err.message });
      }
    }
    return results;
  },
};

// ─────────────────────────────────────────────
// MERGE HELPERS
// ─────────────────────────────────────────────
const isSamePhone = (nameA, nameB) => {
  if (!nameA || !nameB) return false;
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const a = normalize(nameA);
  const b = normalize(nameB);
  return a === b || a.includes(b) || b.includes(a);
};

const mergeSpecs = (allResults) => {
  if (!allResults.length) return null;

  const merged = { ...allResults[0] };

  for (let i = 1; i < allResults.length; i++) {
    const r = allResults[i];
    for (const [key, val] of Object.entries(r)) {
      if (!merged[key] && val) merged[key] = val;
    }
  }

  merged.sources = allResults.map((r) => `${r.source}: ${r.sourceUrl}`).join(" | ");
  return merged;
};

const formatForAI = (specs) => {
  const skip  = ["image", "sourceUrl", "source", "sources"];
  const lines = Object.entries(specs)
    .filter(([k, v]) => !skip.includes(k) && v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  return `**${specs.name}**\n${lines}\nSources: ${specs.sources || specs.sourceUrl}`;
};

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────
export const webSearch = async (query) => {
  const cleanQuery = query
    .replace(/smartphone|specs|specification|review|price|features/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  logger.info("Multi-source scrape start", { query: cleanQuery });

  const [gsmResults, kimoResults, paResults, wmResults] = await Promise.allSettled([
    gsmarena.get(cleanQuery),
    kimovil.get(cleanQuery),
    phonearena.get(cleanQuery),
    whatmobile.get(cleanQuery),
  ]);

  const gsm = gsmResults.status === "fulfilled" ? gsmResults.value : [];
  const kim = kimoResults.status === "fulfilled" ? kimoResults.value : [];
  const pa  = paResults.status  === "fulfilled" ? paResults.value  : [];
  const wm  = wmResults.status  === "fulfilled" ? wmResults.value  : [];

  logger.info("Sources fetched", {
    gsmarena:   gsm.length,
    kimovil:    kim.length,
    phonearena: pa.length,
    whatmobile: wm.length,
  });

  const primarySources = [gsm[0], kim[0], pa[0], wm[0]].filter(Boolean);
  const merged         = mergeSpecs(primarySources);

  const results = [];

  if (merged) {
    results.push({
      title:    merged.name,
      snippet:  formatForAI(merged),
      url:      merged.sourceUrl,
      image:    merged.image || null,
      rawSpecs: merged,
    });
  }

  const secondary = [gsm[1], kim[1], pa[1], wm[1]].filter(Boolean);
  if (secondary.length) {
    const mergedSecondary = mergeSpecs(secondary);
    if (mergedSecondary && !isSamePhone(mergedSecondary.name, merged?.name)) {
      results.push({
        title:    mergedSecondary.name,
        snippet:  formatForAI(mergedSecondary),
        url:      mergedSecondary.sourceUrl,
        image:    mergedSecondary.image || null,
        rawSpecs: mergedSecondary,
      });
    }
  }

  logger.info("Multi-source done", { results: results.length });
  return { results, source: "gsmarena+kimovil+phonearena+whatmobile" };
};

export const formatWebResults = (results) => {
  if (!results.length) return "";
  return results
    .map((r, i) => `[${i + 1}] ${r.snippet}`)
    .join("\n\n---\n\n");
};

// Scraped phone ko DB mein permanently save karo
export const saveScrapedPhone = async (pool, specs) => {
  if (!specs?.name) return null;

  try {
    const parts = specs.name.trim().split(" ");
    const brand = parts[0];
    const model = parts.slice(1).join(" ");

    if (!brand || !model) return null;

    const { rows } = await pool.query(
      `INSERT INTO phones (brand, model, specs)
       VALUES ($1, $2, $3)
       ON CONFLICT (brand, model) DO UPDATE
         SET specs = EXCLUDED.specs,
             updated_at = NOW()
       RETURNING id`,
      [brand, model, JSON.stringify(specs)]
    );

    return rows[0]?.id || null;
  } catch (err) {
    logger.warn("saveScrapedPhone failed", { err: err.message });
    return null;
  }
};