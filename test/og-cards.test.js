import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, cardKey, createOgCards, render } from "../src/index.js";
import ogCardsPlugin from "../src/eleventy.js";
import { installBrowserHelpers } from "../src/browser.js";
import { TEMPLATES, resolveConfig } from "../src/index.js";
import { EXAMPLES } from "../scripts/examples.js";


const tmp = path.join(path.dirname(fileURLToPath(import.meta.url)), ".tmp");
const fresh = () => {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
};
const pages = [
  { url: "/", title: "Home" },
  { url: "/blog/hello-world/", title: "Hello world", description: "First post" },
  { url: "/404.html", title: "Not found" },
];
const config = (extra = {}) => ({
  root: tmp,
  pages,
  card: (d) => (d.url.endsWith("/") ? { title: d.title, description: d.description, site: "example.com" } : null),
  fallback: { src: "/fallback.png", width: 1200, height: 630, type: "image/png" },
  ...extra,
});
const silent = () => {};

test("cardKey", () => {
  assert.equal(cardKey("/"), "home");
  assert.equal(cardKey("/blog/Hello World/"), "blog-hello-world");
});

test("image() reports missing images and returns the fallback", () => {
  fresh();
  const og = createOgCards(config());
  og.begin();
  assert.deepEqual(og.image(pages[0]), config().fallback);
  assert.deepEqual(og.image(pages[2]), config().fallback); // no card
  assert.deepEqual(og.problems().map((p) => p.reason), ["missing"]);
});

test("override() wins", () => {
  const custom = { src: "/x.jpg", width: 1, height: 1, type: "image/jpeg" };
  const og = createOgCards(config({ override: (d) => d.url === "/" && custom }));
  assert.equal(og.image(pages[0]), custom);
});

test("render → images, hashes, manifest; second run is a no-op; --check; orphan cleanup", async () => {
  fresh();
  const c = config({ manifest: "og-manifest.json" });
  const first = await render(c, { log: silent });
  assert.deepEqual(first.rendered.sort(), ["blog-hello-world", "home"]);

  const jpg = readFileSync(path.join(tmp, "og/home.jpg"));
  assert.equal(jpg.subarray(0, 2).toString("hex"), "ffd8"); // JPEG
  const hashes = JSON.parse(readFileSync(path.join(tmp, "og-hashes.json"), "utf8"));
  assert.deepEqual(Object.keys(hashes), ["blog-hello-world", "home"]);
  const manifest = JSON.parse(readFileSync(path.join(tmp, "og-manifest.json"), "utf8"));
  assert.equal(manifest["/"].src, `/og/home.jpg?v=${hashes.home}`);

  const og = createOgCards(c);
  og.begin();
  assert.equal(og.image(pages[0]).src, `/og/home.jpg?v=${hashes.home}`);
  assert.equal(og.problems().length, 0);

  assert.deepEqual((await render(c, { log: silent })).rendered, []);
  assert.deepEqual((await render(c, { check: true, log: silent })).stale, []);

  // changed text → only that card is stale
  const changed = config({ pages: [pages[0], { ...pages[1], title: "Changed" }] });
  assert.deepEqual((await render(changed, { check: true, log: silent })).stale, ["blog-hello-world"]);

  // page removed → its image is deleted
  writeFileSync(path.join(tmp, "og/gone.jpg"), "x");
  const res = await render(config({ pages: [pages[0]] }), { log: silent });
  assert.deepEqual(res.removed.sort(), ["blog-hello-world.jpg", "gone.jpg"]);
  assert.equal(existsSync(path.join(tmp, "og/home.jpg")), true);
});

test("template must define renderCard", async () => {
  fresh();
  writeFileSync(path.join(tmp, "bad.html"), "<!doctype html><p>no script</p>");
  await assert.rejects(render(config({ template: "bad.html" }), { log: silent }), /renderCard/);
  rmSync(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// build mode
// ---------------------------------------------------------------------------

test("build mode: hashed URL without needing the file", () => {
  fresh();
  const og = createOgCards(config({ mode: "build" }));
  const img = og.image(pages[1]);
  assert.match(img.src, /^\/og\/blog-hello-world\.[0-9a-f]{10}\.jpg$/);
  assert.equal(og.problems().length, 0);
  assert.deepEqual(og.image(pages[2]), config().fallback);
});

test("build mode: cache, copy to outDir, manifest, prune", async () => {
  fresh();
  const c = config({ mode: "build", outDir: "dist/og", manifest: "og-manifest.json" });
  const first = await build(c, { log: silent });
  assert.equal(first.rendered.length, 2);
  const files = readdirSync(path.join(tmp, "dist/og")).sort();
  assert.equal(files.length, 2);
  assert.equal(readdirSync(path.join(tmp, ".cache/og-cards")).length, 2);
  const manifest = JSON.parse(readFileSync(path.join(tmp, "og-manifest.json"), "utf8"));
  assert.equal(manifest["/"].src, `/og/${files.find((f) => f.startsWith("home."))}`);

  // fresh output folder, everything comes from the cache
  rmSync(path.join(tmp, "dist"), { recursive: true });
  const second = await build(c, { log: silent });
  assert.deepEqual(second.rendered, []);
  assert.deepEqual(readdirSync(path.join(tmp, "dist/og")).sort(), files);

  // changed card → new file name, old one removed from outDir
  const third = await build(config({ mode: "build", outDir: "dist/og", pages: [pages[0], { ...pages[1], title: "Changed" }] }), { log: silent });
  assert.deepEqual(third.rendered, ["blog-hello-world"]);
  assert.equal(third.removed.length, 1);
  assert.equal(readdirSync(path.join(tmp, "dist/og")).length, 2);
});

test("build mode: --check is refused", async () => {
  await assert.rejects(render(config({ mode: "build" }), { check: true, log: silent }), /commit mode/);
});

test("Eleventy plugin: build mode renders into <output>/<publicPath>, keeps files on partial (serve) builds", async () => {
  fresh();
  const hooks = {};
  const filters = {};
  const eleventyConfig = { on: (n, fn) => (hooks[n] = fn), addFilter: (n, fn) => (filters[n] = fn) };
  ogCardsPlugin(eleventyConfig, { config: config({ mode: "build", pages: undefined }) });
  const log = console.log;
  console.log = silent;
  try {
    hooks["eleventy.before"]();
    const src = filters.ogImage(pages[0]).src;
    filters.ogImage(pages[1]);
    await hooks["eleventy.after"]({ directories: { output: "site" }, runMode: "build" });
    assert.equal(existsSync(path.join(tmp, "site", src)), true);
    assert.equal(readdirSync(path.join(tmp, "site/og")).length, 2);

    // partial rebuild in --serve: only one page → the other image must stay
    hooks["eleventy.before"]();
    filters.ogImage(pages[0]);
    await hooks["eleventy.after"]({ directories: { output: "site" }, runMode: "serve" });
    assert.equal(readdirSync(path.join(tmp, "site/og")).length, 2);
  } finally {
    console.log = log;
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// built-in templates
// ---------------------------------------------------------------------------

test("built-in template names resolve to bundled files", () => {
  for (const name of TEMPLATES) {
    const c = resolveConfig(config({ template: name }));
    assert.equal(existsSync(c.template), true, name);
    assert.ok(c.watch.some((f) => f.endsWith("base.css")), name);
  }
  assert.equal(resolveConfig(config({ template: "og/mine.html" })).template, path.join(tmp, "og/mine.html"));
});

test("ogCards.src resolves card images", () => {
  globalThis.window = {};
  installBrowserHelpers({ root: "file:///project/", publicDir: "file:///project/public/" });
  const { src, initials } = globalThis.window.ogCards;
  const o = globalThis.window.ogCards;
  assert.equal(src.call(o, "https://x.test/a.png"), "https://x.test/a.png");
  assert.equal(src.call(o, "/img/logo.svg"), "file:///project/public/img/logo.svg");
  assert.equal(src.call(o, "assets/logo.svg"), "file:///project/assets/logo.svg");
  assert.equal(src.call(o, ""), "");
  assert.equal(initials("Jane  Cooper"), "JC");
  delete globalThis.window;
});

test("every built-in template renders its example and an almost empty card", async () => {
  fresh();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  for (const name of TEMPLATES) {
    const res = await build(
      { root, mode: "build", template: name, cacheDir: path.join(tmp, "cache"), publicPath: "/",
        pages: [{ url: `/${name}/full/`, card: EXAMPLES[name] }, { url: `/${name}/empty/`, card: { title: "Hi" } }],
        card: (p) => p.card },
      { outDir: path.join(tmp, name), log: silent },
    );
    assert.equal(res.total, 2, name);
    assert.equal(readdirSync(path.join(tmp, name)).length, 2, name);
  }
  rmSync(tmp, { recursive: true, force: true });
});
