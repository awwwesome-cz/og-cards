# Eleventy

The plugin adds an `ogImage` filter and collects the pages from your build – no page list needed.

## 1. Install

```bash
npm install --save-dev @awwwesome-cz/og-cards playwright
npx playwright install chromium
```

## 2. `og.config.js`

```js
import { defineConfig } from "@awwwesome-cz/og-cards";

export default defineConfig({
  mode: "build",                 // or "commit" – see below
  publicPath: "/og",             // URL of the images on your site
  template: "og/template.html",  // optional, see docs/templates.md
  fallback: { src: "/share.png", width: 1200, height: 630, type: "image/png" },

  // `page` is whatever you pass to the filter (step 4)
  card(page) {
    if (page.noindex || !page.url.endsWith("/")) return null; // 404s, feeds… → fallback
    return {
      eyebrow: page.tags?.includes("posts") ? "Blog" : null,
      title: page.title,
      description: page.description,
      site: "example.com",
    };
  },
});
```

## 3. `eleventy.config.js`

```js
import ogCards from "@awwwesome-cz/og-cards/eleventy";
import ogConfig from "./og.config.js";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(ogCards, { config: ogConfig });
}
```

## 4. The meta tags

In your base layout (Nunjucks). Pass everything your `card()` reads:

```njk
{%- set og = { url: page.url, title: title, description: description, tags: tags, noindex: noindex } | ogImage -%}
<meta property="og:image" content="https://example.com{{ og.src }}">
<meta property="og:image:width" content="{{ og.width }}">
<meta property="og:image:height" content="{{ og.height }}">
<meta property="og:image:type" content="{{ og.type }}">
<meta name="twitter:card" content="summary_large_image">
```

The filter takes any object with a `url`. A different filter name:
`addPlugin(ogCards, { config: ogConfig, filter: "socialImage" })`.

## 5a. build mode – images rendered by `eleventy`

Nothing else to do: at the end of every build (`npx @11ty/eleventy`, `--serve` too) the images are rendered into
`<output>/<publicPath>` (e.g. `_site/og/`). Unchanged cards come from `.cache/og-cards`.

```gitignore
.cache/
```

- Quick local build without images: `OG_CARDS_SKIP=1 npx @11ty/eleventy`.
- `outDir` is not used – the plugin writes into Eleventy's output folder.
- CI: [CI › build mode](../ci.md#build-mode) (install Chromium, cache `.cache/og-cards`).

## 5b. commit mode – images rendered by you

Use `mode: "commit"` (the default) and tell it where the images live in your **input**:

```js
outDir: "src/og",         // + eleventyConfig.addPassthroughCopy("src/og")
publicPath: "/og",
hashes: "og-hashes.json",
```

```bash
npx og-cards      # renders new/changed cards (runs your Eleventy build into a temp folder to find them)
git add src/og og-hashes.json
```

When a page changes, the Eleventy build prints a warning listing the outdated images. Customise it with
`onStale(problems)`. CI: `npx og-cards --check` ([CI › commit mode](../ci.md#commit-mode)).

## Per-page options

Anything in front matter reaches your `card()` if you pass it to the filter. A common pattern:

```yaml
---
title: My post
og_title: Shorter title for the image
og_image: /images/hand-made.jpg   # skip generation for this page
---
```

```js
card: (page) => ({ title: page.og_title || page.title }),
override: (page) => page.og_image && { src: page.og_image, width: 1200, height: 630, type: "image/jpeg" },
```

```njk
{%- set og = { url: page.url, title: title, og_title: og_title, og_image: og_image } | ogImage -%}
```
