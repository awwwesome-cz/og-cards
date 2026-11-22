// Renders docs/images/feed-preview.jpg – how cards look when shared in a social feed.
//   node scripts/examples.js && node scripts/feed-preview.js
import path from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(path.join(root, "package.json"))("playwright");
const img = (name) => pathToFileURL(path.join(root, "docs/images/templates", `${name}.jpg`)).href;
const logo = pathToFileURL(path.join(root, "docs/images/examples/logo.svg")).href;
const font = pathToFileURL(path.join(root, "templates/fonts/inter-latin-wght-normal.woff2")).href;

const icon = {
  reply: '<path d="M4 12a8 8 0 0 1 8-8h1a7 7 0 0 1 0 14H9l-5 4z"/>',
  repost: '<path d="M7 7h10l-3-3M17 17H7l3 3M17 7v6M7 17v-6"/>',
  like: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  views: '<path d="M5 20V10M10 20V4M15 20v-7M20 20v-4"/>',
};
const actions = (n) =>
  `<div class="actions">${[["reply", n[0]], ["repost", n[1]], ["like", n[2]], ["views", n[3]]]
    .map(([i, v]) => `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon[i]}</svg>${v}</span>`).join("")}</div>`;
const post = (name, handle, time, text, card, title, n) => `
  <article class="post">
    <img class="pfp" src="${logo}">
    <div class="body">
      <div class="head"><b>${name}</b><svg class="badge" viewBox="0 0 24 24"><path fill="#1d9bf0" d="M12 2l2.4 2.1 3.2-.4.9 3.1 2.8 1.6-1.2 3 1.2 3-2.8 1.6-.9 3.1-3.2-.4L12 22l-2.4-2.1-3.2.4-.9-3.1-2.8-1.6 1.2-3-1.2-3 2.8-1.6.9-3.1 3.2.4z"/><path d="M8 12.2l2.6 2.6L16.2 9" fill="none" stroke="#fff" stroke-width="2"/></svg><span>${handle} · ${time}</span></div>
      <p>${text}</p>
      <div class="card"><img src="${img(card)}"><span class="domain">${title}</span></div>
      <div class="from">From acme.example</div>
      ${actions(n)}
    </div>
  </article>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Inter; src: url("${font}") format("woff2"); font-weight: 100 900; }
  * { box-sizing: border-box; margin: 0; }
  html { background: #000; }
  body { width: 1280px; align-items: start; background: #000; font-family: Inter, system-ui, sans-serif; color: #e7e9ea; padding: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .post { display: flex; gap: 14px; padding: 18px 18px 14px; border: 1px solid #2f3336; border-radius: 20px; background: #000; }
  .pfp { width: 44px; height: 44px; border-radius: 50%; flex: none; }
  .body { min-width: 0; flex: 1; }
  .head { display: flex; align-items: center; gap: 5px; font-size: 15px; white-space: nowrap; }
  .head span { color: #71767b; }
  .badge { width: 18px; height: 18px; }
  p { font-size: 15px; line-height: 1.4; margin: 4px 0 12px; }
  .card { position: relative; border-radius: 16px; overflow: hidden; border: 1px solid #2f3336; }
  .card img { display: block; width: 100%; }
  .domain { position: absolute; left: 12px; bottom: 12px; padding: 2px 6px; border-radius: 4px; background: rgba(0,0,0,.77); color: #fff; font-size: 13px; }
  .from { color: #71767b; font-size: 13px; margin-top: 6px; }
  .actions { display: flex; justify-content: space-between; margin-top: 12px; color: #71767b; font-size: 13px; padding-right: 30px; }
  .actions span { display: flex; align-items: center; gap: 6px; }
  .actions svg { width: 18px; height: 18px; }
</style></head><body>
  ${post("Acme Studio", "@acmestudio", "2h", "We just shipped 2.0 🎉 Set up your store, payments and shipping in one afternoon.", "bold", "Launch your store in one afternoon", ["48", "212", "1.9K", "84K"])}
  ${post("Acme Studio", "@acmestudio", "5h", "Most landing pages leak conversions in the same 7 places. Here's the checklist we use with every client 👇", "article", "7 landing page mistakes that quietly kill conversions", ["31", "96", "804", "41K"])}
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 600 }, deviceScaleFactor: 2 });
// file:// page, so it may load the local images
const tmp = mkdtempSync(path.join(tmpdir(), "og-feed-"));
writeFileSync(path.join(tmp, "feed.html"), html);
await page.goto(pathToFileURL(path.join(tmp, "feed.html")).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.locator("body").screenshot({ path: path.join(root, "docs/images/feed-preview.jpg"), type: "jpeg", quality: 86 });
await browser.close();
rmSync(tmp, { recursive: true, force: true });
console.log("✓ docs/images/feed-preview.jpg");
