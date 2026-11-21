# og-cards

Generate **social preview images** (`og:image`, Twitter/X, LinkedIn, Slack, WhatsApp…) for every page of your site
from **an HTML template you design yourself**.

![Example card rendered with the bundled default template](docs/example.jpg)

- **Your design stays yours** – the package ships only a plain default template; your template lives in your project.
- **Any stack** – Eleventy plugin included; Astro, Next.js, Vite, plain Node, PHP/Laravel/WordPress work via a page list + JSON manifest.
- **Only what changed is re-rendered** – every card is fingerprinted (card data + template), up-to-date images are skipped.
- **Cache-busting built in** – image URLs get `?v=<fingerprint>`, so Facebook & LinkedIn pick up new versions.
- **Images are committed, not built on the server** – no headless browser in CI or on your hosting.
- **CI check** – `og-cards --check` fails when an image is missing or outdated.

Rendering uses [Playwright](https://playwright.dev) (Chromium), so CSS, web fonts, gradients, SVG – anything a browser
can draw – works.

## Install

```bash
npm install --save-dev @awwwesome-cz/og-cards playwright
npx playwright install chromium   # once per machine
```

## How it works

```
page data ──card(data)──▶ card { title, … } ──template.html──▶ og/<page>.jpg
                                   │
                                   └── fingerprint ──▶ og-hashes.json   (commit both)
```

1. **`card(data)`** (in `og.config.js`) decides what goes on a page's image.
2. **Your template** (`window.renderCard(card)`) draws it.
3. **`npx og-cards`** renders new/changed cards, removes images of deleted pages and stores fingerprints.
4. **At build time** your site asks for the image URL (`og.image(data)` / Eleventy filter `ogImage`) and gets
   `{ src, width, height, type }` – or your `fallback` while the image does not exist yet, plus a warning.

## Quick start (Eleventy)

**1. `og.config.js`** in the project root:

```js
import { defineConfig } from "@awwwesome-cz/og-cards";

export default defineConfig({
  outDir: "src/og",          // where images are written (a folder used only for these images)
  publicPath: "/og",         // URL of that folder on your site
  fallback: { src: "/default-share.png", width: 1200, height: 630, type: "image/png" },

  card(data) {
    if (data.noindex || !data.url.endsWith("/")) return null; // no image → fallback
    return { title: data.title, description: data.description, site: "example.com" };
  },
});
```

**2. `eleventy.config.js`:**

```js
import ogCards from "@awwwesome-cz/og-cards/eleventy";
import ogConfig from "./og.config.js";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(ogCards, { config: ogConfig });
  eleventyConfig.addPassthroughCopy("src/og");
}
```

**3. In your `<head>`** (Nunjucks) – pass whatever your `card()` reads:

```njk
{%- set og = { url: page.url, title: title, description: description, noindex: noindex } | ogImage -%}
<meta property="og:image" content="https://example.com{{ og.src }}">
<meta property="og:image:width" content="{{ og.width }}">
<meta property="og:image:height" content="{{ og.height }}">
<meta property="og:image:type" content="{{ og.type }}">
<meta name="twitter:card" content="summary_large_image">
```

**4. Render and commit:**

```bash
npx og-cards
git add og-hashes.json src/og
```

From now on the build prints a warning whenever a card changed (new page, edited title…) – just run `npx og-cards` again.
The CLI collects cards by running your Eleventy build into a temporary folder, so it always sees exactly what your site does.

## Where cards come from (any framework)

Without the Eleventy plugin, tell og-cards which pages exist with **`pages`**: an array, an (async) function, or a path to
a JSON file. Each page is an object with a `url` plus anything your `card()` needs.

```js
// og.config.js
import { readFile } from "node:fs/promises";
import { defineConfig } from "@awwwesome-cz/og-cards";

export default defineConfig({
  outDir: "public/og",
  publicPath: "/og",
  manifest: "src/og-manifest.json",   // optional: URL → image map for your site to read
  pages: async () => JSON.parse(await readFile("content/pages.json", "utf8")),
  card: (page) => ({ title: page.title, description: page.excerpt }),
});
```

Then use the image in your framework:

**Astro / Next.js / Vite / anything in JS** – call the same helper the Eleventy plugin uses:

```js
import { createOgCards } from "@awwwesome-cz/og-cards";
import ogConfig from "../og.config.js";

const og = createOgCards(ogConfig);
const image = og.image({ url: "/blog/hello/", title: "Hello" }); // → { src, width, height, type }
```

**PHP, Laravel, WordPress, Hugo…** – set `manifest` and read the generated JSON:

```json
{ "/blog/hello/": { "src": "/og/blog-hello.jpg?v=3f2a9c01de", "width": 1200, "height": 630, "type": "image/jpeg" } }
```

```php
$og = json_decode(file_get_contents(__DIR__ . '/og-manifest.json'), true)[$path] ?? null;
```

## Your own template

A template is a plain HTML file sized to your image (1200 × 630 by default) that defines **`window.renderCard(card)`**.
og-cards opens it in Chromium, calls `renderCard` with the card from your config, waits for fonts and takes a screenshot.
The `card` object is entirely yours – og-cards never looks inside it.

Start by copying the default template:

```bash
cp node_modules/@awwwesome-cz/og-cards/templates/default.html og/template.html
```

```js
// og.config.js
export default defineConfig({
  template: "og/template.html",
  watch: ["og/fonts/brand.woff2", "og/logo.svg"], // changing these re-renders every card too
  card: (data) => ({ title: data.title, kicker: data.category, color: data.color }),
});
```

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: Brand; src: url("fonts/brand.woff2"); }   /* paths are relative to the template */
  html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
  body { font-family: Brand, sans-serif; background: #111; color: #fff; padding: 64px; box-sizing: border-box; }
  h1 { font-size: 80px; line-height: 1.05; }
  [hidden] { display: none !important; }
</style>
<script>
  window.renderCard = async (card) => {
    document.body.style.background = card.color || "#111";
    ogCards.text("#kicker", card.kicker);         // sets text, hides the element when empty
    ogCards.text("#title", card.title);
    await ogCards.fit(document.querySelector("#title"), { min: 40, maxLines: 3 }); // shrink long titles
  };
</script>
</head>
<body>
  <p id="kicker"></p>
  <h1 id="title"></h1>
  <img src="logo.svg" alt="">
</body>
</html>
```

Tips:

- **Open the template in your browser** while designing – call `renderCard({ title: "Test" })` from the dev tools
  (the `ogCards` helpers exist only during rendering, so guard them or paste a stub).
- Load fonts and images **from local files** next to the template – no network is needed and output stays stable.
- Changing the template (or a `watch` file) changes every fingerprint → `npx og-cards` re-renders everything.
- Pin the Playwright version in your project so the output does not change between machines.

### Helpers available in the template (`window.ogCards`)

| Helper | What it does |
|---|---|
| `ogCards.text(elOrSelector, value)` | Sets `textContent`; hides the element when the value is empty. |
| `await ogCards.fit(el, options)` | Shrinks the font size until `el` fits `maxLines` lines and `container` stops overflowing. Options: `min` (24), `step` (2), `maxLines` (3), `lineHeight` (factor, default from CSS), `container`, `property` (`"font-size"` or a custom property such as `"--fs"`). |

### Keeping your design private

Your template, fonts and logos never need to leave your project. To share one design between several of your own
projects, put the template folder in a **private** package (GitHub Packages, a private npm scope or a git dependency)
and point `template` to it:

```js
template: "node_modules/@my-company/og-theme/template.html",
watch: ["node_modules/@my-company/og-theme/package.json"], // new theme version → re-render
```

## CLI

```bash
npx og-cards              # render new and changed cards
npx og-cards --all        # re-render everything
npx og-cards blog         # only cards whose file name contains "blog"
npx og-cards --check      # render nothing, exit 1 if anything is missing/outdated (CI)
npx og-cards -c path/to/og.config.js
```

A full run also deletes images in `outDir` whose page no longer exists, so **use a folder dedicated to these images**.

Example CI step (no browser needed):

```yaml
- run: npx og-cards --check
```

## Configuration

| Option | Default | |
|---|---|---|
| `card(data)` | – | **Required.** Returns the card for a page, or `null` to use `fallback`. |
| `template` | bundled plain template | HTML file defining `window.renderCard(card)`. |
| `outDir` | `"og"` | Folder for the images (dedicated – unknown images are deleted). |
| `publicPath` | `"/og"` | URL of `outDir` on your site. |
| `hashes` | `"og-hashes.json"` | Fingerprints file – commit it. |
| `pages` | – | Pages to render without the Eleventy plugin: array, (async) function or JSON file path. |
| `manifest` | – | Also write a JSON map "page URL → image". |
| `fallback` | `null` | Image used when a page has no card or its image does not exist yet. |
| `override(data)` | – | Return an image to skip generating one (e.g. a hand-made image in front matter). |
| `key(url, data)` | from URL (`/` → `home`) | Image file name without extension. |
| `watch` | `[]` | Extra files (fonts, logos, CSS) included in the template fingerprint. |
| `width`, `height` | `1200`, `630` | Image size. Run `--all` after changing. |
| `format`, `quality` | `"jpeg"`, `88` | `"jpeg"` or `"png"`; quality for JPEG. |
| `launch` | – | Options for Playwright's `chromium.launch()`. |
| `onStale(problems)` | English warning | Custom report of missing/outdated images after an Eleventy build. |
| `root` | folder of `og.config.js` | Base for all relative paths. |

All paths are relative to `root`.

## License

MIT
