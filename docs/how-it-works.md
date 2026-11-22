# How it works

```
page data ──card(page)──▶ card { title, … } ──your template──▶ image (1200 × 630)
                              │
                              └─▶ fingerprint (card + template) ──▶ file name / ?v= in the URL
```

1. **Pages** – og-cards needs to know which pages exist and their data (title, description…).
   With Eleventy the plugin collects them from your build; anywhere else you give a list in `pages`
   (array, function, or JSON file).
2. **`card(page)`** – your function in `og.config.js` decides what goes on the image. Return `null` for pages
   that should not get their own image (404, `noindex`) – they get the `fallback` image.
3. **Template** – an HTML file with `window.renderCard(card)` that draws the card. og-cards opens it in
   Chromium and takes a screenshot. See [Your own template](templates.md).
4. **Fingerprint** – a hash of the card data and the template. When it changes, the image is rendered again;
   otherwise it is skipped. The fingerprint is also part of the image URL, so Facebook, LinkedIn and others
   download the new image instead of using their cached copy.
5. **Your site prints the meta tag** – via the Eleventy filter, the JSON manifest (PHP, Laravel, Angular…)
   or the JavaScript API.

## Modes

### commit (default)

You run `npx og-cards` on your computer. Images are written to `outDir` and fingerprints to `hashes`;
**you commit both**. Hosting and CI never need a browser.

```
public/og/home.jpg            ← committed
public/og/blog-hello.jpg      ← committed
og-hashes.json                ← committed
```

Image URL: `/og/home.jpg?v=3f2a9c01de`

- New or changed page → the Eleventy build prints a warning, `npx og-cards --check` fails in CI.
  Run `npx og-cards` and commit.
- A deleted page → its image is removed on the next full `npx og-cards`.
- The same mode works **on a server** (e.g. Laravel with content in a database): run `npx og-cards` there after
  deploys or on a schedule – the images simply stay in `outDir`.

### build

Images are rendered **during the build** – in CI or wherever you build the site. Nothing is committed.

```
.cache/og-cards/3f2a9c01de.jpg   ← cache (kept between builds by CI cache)
dist/og/home.3f2a9c01de.jpg      ← build output, deployed with the site
```

Image URL: `/og/home.3f2a9c01de.jpg`

- The URL is known before the image exists, so pages can be built first and images rendered right after.
- Rendered images are cached in `cacheDir` (default `.cache/og-cards`, keyed by fingerprint). Keep that folder
  between CI runs ([CI › build mode](ci.md#build-mode)) and only new or changed cards are rendered.
- Old images in `outDir` are removed on every full build; cache entries unused for 30 days are pruned.
- Chromium must be available where you build. Local quick build without images: `OG_CARDS_SKIP=1`.

### Choosing

| Situation | Mode |
|---|---|
| Static site deployed by CI (GitHub Actions, GitLab…) and you don't want images in git | **build** |
| Hosting builds the site but can't run Chromium (some Vercel/Cloudflare setups) | **commit** |
| No build step at all (plain PHP uploaded by FTP, by hand) | **commit** |
| Content lives in a production database (Laravel, WordPress) | **commit**, run on the server – see [Laravel](guides/laravel.md#content-from-the-database) |

Switching later is just `mode` in the config (plus removing the committed images).

## The manifest

With `manifest: "path/to/og-manifest.json"`, every run also writes a map of page URL → image:

```json
{
  "/": { "src": "/og/home.3f2a9c01de.jpg", "width": 1200, "height": 630, "type": "image/jpeg" },
  "/blog/hello": { "src": "/og/blog-hello.a7c4e2b910.jpg", "width": 1200, "height": 630, "type": "image/jpeg" }
}
```

Any language can read it – that's how PHP, Laravel and Angular get their image URL. The keys are exactly the
`url` values you gave in `pages`, so use the same form your site uses when it looks them up
(`/blog/hello` vs `/blog/hello/`).

## File names

The file name comes from the page URL: `/` → `home`, `/blog/hello/` → `blog-hello`. Override with
`key(url, page)` in the config if two URLs would collide.
