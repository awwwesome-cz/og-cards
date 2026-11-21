// Renders the cards to images with Playwright (Chromium).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createOgCards, readJson } from "./index.js";
import { installBrowserHelpers } from "./browser.js";
import { QUEUE_ENV } from "./eleventy.js";

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
async function collect(og) {
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
    throw new Error("og-cards: set `pages` in the config (or install Eleventy and add the plugin) – see README › Where cards come from.");
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
 * @param {import("./types").OgCardsConfig} config
 * @param {{ all?: boolean, filter?: string, check?: boolean, log?: (msg: string) => void }} [opts]
 * @returns {Promise<{ rendered: string[], removed: string[], stale: string[] }>}
 */
export async function render(config, { all = false, filter, check = false, log = console.log } = {}) {
  const og = createOgCards(config);
  const c = og.config;
  const queue = await collect(og);
  const hashes = readJson(c.hashesPath);
  const file = (key) => path.join(c.outDirPath, `${key}.${c.ext}`);
  const rel = (key) => path.relative(c.root, file(key));

  const stale = Object.entries(queue)
    .filter(([key, q]) => hashes[key] !== q.hash || !existsSync(file(key)))
    .map(([key]) => key);
  const todo = Object.keys(queue).filter((key) => (!filter || key.includes(filter)) && (all || filter || stale.includes(key)));
  const orphans = !filter && existsSync(c.outDirPath)
    ? readdirSync(c.outDirPath).filter((f) => f.endsWith(`.${c.ext}`) && !queue[f.slice(0, -c.ext.length - 1)])
    : [];

  if (check) {
    for (const key of stale) log(`✗ ${rel(key)} (${existsSync(file(key)) ? "outdated" : "missing"})`);
    for (const f of orphans) log(`✗ ${path.join(c.outDir, f)} (page no longer exists)`);
    return { rendered: [], removed: [], stale: [...stale, ...orphans] };
  }

  mkdirSync(c.outDirPath, { recursive: true });
  if (todo.length) {
    const { chromium } = projectRequire(c.root)("playwright");
    const browser = await chromium.launch(c.launch);
    try {
      const page = await browser.newPage({ viewport: { width: c.width, height: c.height }, deviceScaleFactor: 1 });
      await page.addInitScript(installBrowserHelpers);
      const url = pathToFileURL(c.template).href;
      for (const key of todo) {
        await page.goto(url);
        await page.evaluate(async (card) => {
          if (typeof window.renderCard !== "function") throw new Error("og-cards: the template must define window.renderCard(card)");
          await window.renderCard(card);
          await document.fonts.ready;
        }, queue[key].card);
        const img = await page.screenshot(c.format === "jpeg" ? { type: "jpeg", quality: c.quality } : { type: "png" });
        writeFileSync(file(key), img);
        hashes[key] = queue[key].hash;
        log(`✓ ${rel(key)}`);
      }
    } finally {
      await browser.close();
    }
  }

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

  // Optional manifest for non-JS stacks (PHP, Laravel, WordPress, …): page URL → image
  if (c.manifest) {
    const manifest = {};
    for (const [key, q] of Object.entries(queue).sort(([a], [b]) => a.localeCompare(b))) {
      if (!sorted[key]) continue;
      manifest[q.url] = { src: `${c.publicPath}/${key}.${c.ext}?v=${sorted[key]}`, width: c.width, height: c.height, type: c.mime };
    }
    const manifestPath = path.resolve(c.root, c.manifest);
    mkdirSync(path.dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }
  return { rendered: todo, removed: orphans, stale: [] };
}
