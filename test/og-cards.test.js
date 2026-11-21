import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cardKey, createOgCards, render } from "../src/index.js";

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
