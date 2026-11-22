// Renders the cards to images with Playwright (Chromium).
//
//   render(config) – picks the right flow for `config.mode`
//   commit mode → renderCommit: images in outDir + fingerprints in `hashes` (you commit both)
//   build mode  → build:        images rendered into a cache, copied to the build output

import { execFileSync } from "node:child_process";
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createOgCards, fileName, QUEUE_ENV, readJson } from "./index.js";
import { installBrowserHelpers } from "./browser.js";

/** Load a module from the *project* (not from this package), so peer deps resolve there. */
const projectRequire = (root) => createRequire(path.join(root, "package.json"));

function findPackageDir(file, name) {
  let dir = path.dirname(file);
  while (dir !== path.dirname(dir)) {
    const pkg = path.join(dir, "package.json");
    if (existsSync(pkg) && JSON.parse(readFileSync(pkg, "utf8")).name === name) return dir;
    dir = path.dirname(dir);
  }
  throw new Error(`og-cards: cannot locate ${name}`);
}

/** Page list from `config.pages`: an array, a (async) function, or a path to a JSON file. */
async function loadPages(c) {
  let pages = c.pages;
  if (typeof pages === "function") pages = await pages();
  if (typeof pages === "string") pages = JSON.parse(readFileSync(path.resolve(c.root, pages), "utf8"));
  if (!Array.isArray(pages)) throw new Error("og-cards: `pages` must be an array, a function returning one, or a path to a JSON array.");
  return pages;
}

/** Collect cards: from `config.pages` if given, otherwise by running an Eleventy build. */
export async function collect(og) {
  const c = og.config;
  if (c.pages) {
    og.begin();
    for (const data of await loadPages(c)) {
      if (!data?.url) throw new Error("og-cards: every page needs a `url`.");
      og.image(data);
    }
    return og.queue();
  }
  let eleventyDir;
  try {
    eleventyDir = findPackageDir(projectRequire(c.root).resolve("@11ty/eleventy"), "@11ty/eleventy");
  } catch {
    throw new Error("og-cards: set `pages` in the config (or use Eleventy with the og-cards plugin) – see docs/configuration.md.");
  }
  const tmp = mkdtempSync(path.join(tmpdir(), "og-cards-"));
  const queueFile = path.join(tmp, "queue.json");
  try {
    execFileSync(process.execPath, [path.join(eleventyDir, "cmd.cjs"), `--output=${path.join(tmp, "site")}`, "--quiet"], {
      cwd: c.root,
      stdio: ["ignore", "ignore", "inherit"],
      env: { ...process.env, [QUEUE_ENV]: queueFile },
    });
    if (!existsSync(queueFile)) throw new Error("og-cards: the build produced no cards – is the plugin added in eleventy.config.js?");
    return JSON.parse(readFileSync(queueFile, "utf8"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Render cards with one browser. Launches Chromium only when there is something to render.
 * @param {ReturnType<typeof createOgCards>["config"]} c
 * @param {{ card: unknown, file: string, label: string }[]} jobs
 */
async function renderImages(c, jobs, log) {
  if (!jobs.length) return;
  let chromium;
  try {
    ({ chromium } = projectRequire(c.root)("playwright"));
  } catch {
    throw new Error("og-cards: Playwright is not installed – run `npm install -D playwright && npx playwright install chromium`.");
  }
  const browser = await chromium.launch(c.launch);
  try {
    const page = await browser.newPage({ viewport: { width: c.width, height: c.height }, deviceScaleFactor: 1 });
    const dirUrl = (dir) => pathToFileURL(dir.endsWith(path.sep) ? dir : dir + path.sep).href;
    await page.addInitScript(installBrowserHelpers, { root: dirUrl(c.root), publicDir: dirUrl(c.publicDir) });
    const url = pathToFileURL(c.template).href;
    for (const job of jobs) {
      await page.goto(url);
      await page.evaluate(async (card) => {
        if (typeof window.renderCard !== "function") throw new Error("og-cards: the template must define window.renderCard(card)");
        await window.renderCard(card);
        await document.fonts.ready;
        await window.ogCards.images();
      }, job.card);
      const img = await page.screenshot(c.format === "jpeg" ? { type: "jpeg", quality: c.quality } : { type: "png" });
      mkdirSync(path.dirname(job.file), { recursive: true });
      writeFileSync(job.file, img);
      log(`✓ ${job.label}`);
    }
  } finally {
    await browser.close();
  }
}

/** Optional manifest for non-JS stacks (PHP, Laravel, …): page URL → image. */
function writeManifest(c, entries) {
  if (!c.manifest) return;
  const manifest = {};
  for (const [url, src] of entries.sort(([a], [b]) => a.localeCompare(b))) {
    manifest[url] = { src, width: c.width, height: c.height, type: c.mime };
  }
  const file = path.resolve(c.root, c.manifest);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
}

/** Image files in a folder that are not in `keep` (only files with our extension). */
const extraFiles = (dir, ext, keep) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(`.${ext}`) && !keep.has(f)) : [];

/**
 * commit mode: render new/changed cards into outDir, store fingerprints, remove images of deleted pages.
 * @param {import("./types").OgCardsConfig} config
 * @param {{ all?: boolean, filter?: string, check?: boolean, log?: (msg: string) => void }} [opts]
 */
export async function renderCommit(config, { all = false, filter, check = false, log = console.log } = {}) {
  const og = createOgCards({ ...config, mode: "commit" });
  const c = og.config;
  const queue = await collect(og);
  const hashes = readJson(c.hashesPath);
  const file = (key) => path.join(c.outDirPath, fileName(c, key));
  const rel = (key) => path.relative(c.root, file(key));

  const stale = Object.entries(queue)
    .filter(([key, q]) => hashes[key] !== q.hash || !existsSync(file(key)))
    .map(([key]) => key);
  const todo = Object.keys(queue).filter((key) => (!filter || key.includes(filter)) && (all || filter || stale.includes(key)));
  const orphans = filter ? [] : extraFiles(c.outDirPath, c.ext, new Set(Object.keys(queue).map((k) => fileName(c, k))));

  if (check) {
    for (const key of stale) log(`✗ ${rel(key)} (${existsSync(file(key)) ? "outdated" : "missing"})`);
    for (const f of orphans) log(`✗ ${path.join(c.outDir, f)} (page no longer exists)`);
    return { rendered: [], removed: [], stale: [...stale, ...orphans] };
  }

  await renderImages(c, todo.map((key) => ({ card: queue[key].card, file: file(key), label: rel(key) })), log);
  for (const key of todo) hashes[key] = queue[key].hash;

  // Remove images of pages that no longer exist (only for full runs)
  for (const f of orphans) {
    unlinkSync(path.join(c.outDirPath, f));
    log(`− removed ${path.join(c.outDir, f)} (page no longer exists)`);
  }

  const sorted = Object.fromEntries(
    Object.entries(hashes).filter(([k]) => queue[k]).sort(([a], [b]) => a.localeCompare(b)),
  );
  mkdirSync(path.dirname(c.hashesPath), { recursive: true });
  writeFileSync(c.hashesPath, JSON.stringify(sorted, null, 2) + "\n");
  writeManifest(
    c,
    Object.entries(queue).filter(([k]) => sorted[k]).map(([k, q]) => [q.url, `${c.publicPath}/${fileName(c, k)}?v=${sorted[k]}`]),
  );
  return { rendered: todo, removed: orphans, stale: [] };
}

/**
 * build mode: render cards that are not in the cache yet, then copy every image to `outDir`
 * as <key>.<hash>.<ext>. Old images in outDir and unused cache entries are removed.
 * @param {import("./types").OgCardsConfig} config
 * @param {{ outDir?: string, queue?: Record<string, { url: string, hash: string, card: unknown }>, log?: (msg: string) => void }} [opts]
 *   outDir – absolute folder to write to (default: config.outDir); the Eleventy plugin passes <output>/<publicPath>
 *   queue  – cards collected elsewhere (the Eleventy plugin passes the ones from the current build)
 *   prune  – remove images in outDir that are not in this build (default true; off for partial/watch builds)
 */
export async function build(config, { outDir, queue, prune = true, log = console.log } = {}) {
  const og = createOgCards({ ...config, mode: "build" });
  const c = og.config;
  queue ??= await collect(og);
  const dest = outDir ? path.resolve(c.root, outDir) : c.outDirPath;
  const cached = (q) => path.join(c.cacheDir, `${q.hash}.${c.ext}`);

  const missing = Object.entries(queue).filter(([, q]) => !existsSync(cached(q)));
  await renderImages(c, missing.map(([key, q]) => ({ card: q.card, file: cached(q), label: `${key} → cache` })), log);

  mkdirSync(dest, { recursive: true });
  const now = new Date();
  const keep = new Set();
  for (const [key, q] of Object.entries(queue)) {
    const name = fileName(c, key, q.hash);
    keep.add(name);
    copyFileSync(cached(q), path.join(dest, name));
    utimesSync(cached(q), now, now); // mark as used (cache pruning keeps recently used files)
  }
  const removed = prune ? extraFiles(dest, c.ext, keep) : [];
  for (const f of removed) unlinkSync(path.join(dest, f));

  // Prune cache entries unused for 30 days (other branches / builds may still need recent ones)
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  for (const f of extraFiles(c.cacheDir, c.ext, new Set())) {
    const p = path.join(c.cacheDir, f);
    try {
      if (statSync(p).mtimeMs < cutoff) unlinkSync(p);
    } catch {}
  }

  writeManifest(c, Object.entries(queue).map(([key, q]) => [q.url, `${c.publicPath}/${fileName(c, key, q.hash)}`]));
  const total = Object.keys(queue).length;
  log(`og-cards: ${total} image(s) → ${path.relative(c.root, dest) || "."} (${missing.length} rendered, ${total - missing.length} from cache)`);
  return { rendered: missing.map(([key]) => key), removed, total };
}

/**
 * Render according to `config.mode`.
 * @param {import("./types").OgCardsConfig} config
 * @param {{ all?: boolean, filter?: string, check?: boolean, log?: (msg: string) => void }} [opts]
 */
export async function render(config, opts = {}) {
  if ((config.mode || "commit") === "build") {
    if (opts.check) throw new Error("og-cards: --check is for commit mode – in build mode images are rendered during the build.");
    return build(config, opts);
  }
  return renderCommit(config, opts);
}
