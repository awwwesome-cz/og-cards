# Configuration

`og.config.js` in your project root (or any file passed with `og-cards -c`). Wrap it in `defineConfig` for
editor autocompletion.

```js
import { defineConfig } from "@awwwesome-cz/og-cards";

export default defineConfig({
  mode: "commit",
  template: "og/template.html",
  outDir: "public/og",
  publicPath: "/og",
  pages: "og-pages.json",
  manifest: "og-manifest.json",
  fallback: { src: "/share.png", width: 1200, height: 630, type: "image/png" },
  card: (page) => page.noindex ? null : { title: page.title, description: page.description },
});
```

All paths are relative to `root` (by default the folder that contains `og.config.js`).

## Options

### What and how

| Option | Default | |
|---|---|---|
| `card(page)` | – | **Required.** Returns the card (any JSON object your template understands), or `null`/`false` to use `fallback`. |
| `template` | `"default"` | A [built-in template](built-in-templates.md) name (`"default"`, `"minimal"`, `"bold"`, `"article"`, `"split"`, `"product"`, `"event"`, `"quote"`, `"stats"`, `"docs"`) or a path to your own HTML file defining `window.renderCard(card)` ([templates](templates.md)). |
| `watch` | `[]` | Extra files (fonts, logos, CSS) included in the template fingerprint. |
| `width`, `height` | `1200`, `630` | Image size in px. In commit mode run `og-cards --all` after changing. |
| `format` | `"jpeg"` | `"jpeg"` or `"png"`. |
| `quality` | `88` | JPEG quality (0–100). |
| `launch` | – | Options passed to Playwright's `chromium.launch()` (e.g. `{ executablePath }`). |

### Which pages

| Option | Default | |
|---|---|---|
| `pages` | – | Page list: an array, an (async) function returning one, or a path to a JSON file with an array. Each page needs a `url`; everything else is up to your `card()`. **Not needed with the Eleventy plugin.** |
| `key(url, page)` | from URL | Image file name without extension. `/` → `home`, `/blog/hello/` → `blog-hello`. |
| `override(page)` | – | Return an image object to skip generating one for that page (e.g. a hand-made image set in front matter). |

### Where

| Option | Default | |
|---|---|---|
| `mode` | `"commit"` | `"commit"` – images and fingerprints live in your repository; `"build"` – rendered during the build. See [modes](how-it-works.md#modes). |
| `outDir` | `"og"` | Folder the images are written to. **Use a folder only for these images** – other `.jpg`/`.png` files in it are deleted. With the Eleventy plugin in build mode it is ignored (images go to `<output>/<publicPath>`). |
| `publicPath` | `"/og"` | URL of `outDir` on your site. |
| `publicDir` | `"."` | Folder your site serves at `/` (e.g. `"public"`, `"src"`). Card images given as `"/images/x.png"` are read from here. |
| `manifest` | – | Also write a JSON map "page URL → image" (for PHP, Laravel, Angular…). |
| `fallback` | `null` | Image object `{ src, width, height, type }` for pages without a card – and, in commit mode, for pages whose image does not exist yet. |
| `hashes` | `"og-hashes.json"` | commit mode: fingerprints file – commit it. |
| `cacheDir` | `".cache/og-cards"` | build mode: rendered images cached by fingerprint. Keep it between CI runs; add it to `.gitignore`. |
| `root` | folder of the config | Base for all relative paths. |

### Reporting

| Option | Default | |
|---|---|---|
| `onStale(problems)` | English warning | Eleventy, commit mode: custom message when images are missing/outdated after a build. `problems` = `[{ url, key, reason: "missing" \| "outdated" }]`. |

## Environment variables

| Variable | |
|---|---|
| `OG_CARDS_SKIP=1` | build mode with the Eleventy plugin: don't render images (quick local builds). |

## JavaScript API

```js
import { createOgCards, render, build, defineConfig, cardKey, TEMPLATES } from "@awwwesome-cz/og-cards";
import ogCards from "@awwwesome-cz/og-cards/eleventy"; // Eleventy plugin
```

| Function | |
|---|---|
| `createOgCards(config)` | Returns `{ begin(), image(page), queue(), problems(), config }`. `image(page)` gives `{ src, width, height, type }` (or the fallback) – what the Eleventy filter uses. Use it in any JS build to get the URL for a page. |
| `render(config, { all, filter, check, log })` | What the CLI does – renders according to `mode`. |
| `build(config, { outDir, queue, prune, log })` | build mode rendering. `queue` lets you pass cards collected by `createOgCards` during your own build (otherwise `pages` is used). |
| `cardKey(url)` | Default file name for a URL. |
| `TEMPLATES` | Names of the built-in templates. |

Built-in template files are exported as `@awwwesome-cz/og-cards/templates/<name>.html`.

TypeScript types are included.
