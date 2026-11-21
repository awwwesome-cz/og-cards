// Core of og-cards: turns page data into a "card", fingerprints it and tells you
// which image URL to put into <meta property="og:image">.
//
// Nothing here knows about any particular design – the look lives entirely in the
// HTML template you point `template` at.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Bundled plain template, used when `template` is not set. */
export const DEFAULT_TEMPLATE = path.join(here, "../templates/default.html");

const FORMATS = {
  jpeg: { ext: "jpg", type: "image/jpeg" },
  png: { ext: "png", type: "image/png" },
};

/**
 * Identity helper that gives you editor autocompletion in `og.config.js`.
 * @template {import("./types").OgCardsConfig} T
 * @param {T} config
 * @returns {T}
 */
export const defineConfig = (config) => config;

/**
 * Image file name (without extension) from a page URL.
 * "/" → "home", "/blog/my-post/" → "blog-my-post"
 * @param {string} url
 */
export const cardKey = (url) =>
  String(url || "").replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "home";

/**
 * Fills in defaults and resolves all paths against `root`.
 * @param {import("./types").OgCardsConfig} config
 * @param {{ root?: string }} [opts]
 */
export function resolveConfig(config, { root } = {}) {
  if (!config || typeof config.card !== "function") {
    throw new Error("og-cards: the config must have a `card(data)` function.");
  }
  if (config.__resolved) return config;
  const base = path.resolve(config.root || root || process.cwd());
  const format = config.format || "jpeg";
  if (!FORMATS[format]) throw new Error(`og-cards: unsupported format "${format}" (use "jpeg" or "png").`);
  const outDir = config.outDir || "og";
  return {
    ...config,
    __resolved: true,
    root: base,
    width: config.width || 1200,
    height: config.height || 630,
    format,
    quality: config.quality ?? 88,
    ext: FORMATS[format].ext,
    mime: FORMATS[format].type,
    template: path.resolve(base, config.template || DEFAULT_TEMPLATE),
    outDir,
    outDirPath: path.resolve(base, outDir),
    publicPath: (config.publicPath ?? "/og").replace(/\/$/, ""),
    hashesPath: path.resolve(base, config.hashes || "og-hashes.json"),
    watch: (config.watch || []).map((f) => path.resolve(base, f)),
    key: config.key || cardKey,
    fallback: config.fallback ?? null,
  };
}

/**
 * Fingerprint of the template (+ any `watch` files). Changing it re-renders every card.
 * @param {ReturnType<typeof resolveConfig>} c
 */
export function templateHash(c) {
  const h = createHash("sha1");
  for (const file of [c.template, ...c.watch]) if (existsSync(file)) h.update(readFileSync(file));
  return h.digest("hex");
}

/**
 * Fingerprint of one card = template fingerprint + card data.
 * @param {unknown} card
 * @param {string} tplHash
 */
export const cardHash = (card, tplHash) =>
  createHash("sha1").update(tplHash).update(JSON.stringify(card)).digest("hex").slice(0, 10);

export function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Stateful helper used by the Eleventy plugin (and usable from any other generator).
 *
 *   const og = createOgCards(config);
 *   og.begin();                    // before a build
 *   const img = og.image(pageData) // for every page → { src, width, height, type } | fallback
 *   og.queue(); og.problems();     // after the build
 *
 * @param {import("./types").OgCardsConfig} config
 */
export function createOgCards(config) {
  const c = resolveConfig(config);
  let hashes = {};
  let tpl = "";
  let queue = {};
  const problems = new Map();

  const api = {
    config: c,
    /** Reset state and re-read hashes + template (call before every build). */
    begin() {
      hashes = readJson(c.hashesPath);
      tpl = templateHash(c);
      queue = {};
      problems.clear();
    },
    /**
     * Image for one page.
     * @param {Record<string, any> & { url: string }} data
     */
    image(data) {
      if (!tpl) api.begin();
      const custom = c.override?.(data);
      if (custom) return custom;
      const card = c.card(data);
      if (!card) return c.fallback;
      const key = c.key(data.url, data);
      const hash = cardHash(card, tpl);
      queue[key] = { url: data.url, hash, card };
      const exists = existsSync(path.join(c.outDirPath, `${key}.${c.ext}`));
      if (!exists) problems.set(key, { url: data.url, key, reason: "missing" });
      else if (hashes[key] !== hash) problems.set(key, { url: data.url, key, reason: "outdated" });
      if (!exists) return c.fallback;
      // ?v= changes whenever the image changes, so Facebook / LinkedIn fetch the new one
      return {
        src: `${c.publicPath}/${key}.${c.ext}?v=${hashes[key] || hash}`,
        width: c.width,
        height: c.height,
        type: c.mime,
      };
    },
    /** Every card seen since `begin()`, keyed by file name. */
    queue: () => queue,
    /** Cards whose image is missing or does not match the current data. */
    problems: () => [...problems.values()],
  };
  return api;
}

export { render } from "./render.js";
