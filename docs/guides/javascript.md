# Astro, Next.js, Vite and other JavaScript sites

The same recipe works everywhere:

1. Give og-cards your pages (`pages` – array, async function, or JSON file).
2. Run `og-cards` before your build; it writes images into the folder your framework serves statically and a
   manifest (page URL → image).
3. Read the manifest where you render `<head>`.

```js
// og.config.js
import { defineConfig } from "@awwwesome-cz/og-cards";

export default defineConfig({
  mode: "build",                       // or commit – see docs/how-it-works.md#modes
  pages: async () => { /* return [{ url, title, … }] */ },
  card: (page) => ({ title: page.title, description: page.description }),
  outDir: "public/og",                 // Astro, Next.js and Vite serve public/ at /
  publicPath: "/og",
  manifest: "src/og-manifest.json",
});
```

```json
{ "scripts": { "build": "og-cards && <your build command>", "dev": "og-cards && <your dev command>" } }
```

```gitignore
/.cache
/public/og
/src/og-manifest.json
```

## Astro

Pages from content collections – read the Markdown front matter in `pages` (og-cards runs in plain Node, outside
Astro):

```js
import { readdir, readFile } from "node:fs/promises";

pages: async () => {
  const dir = "src/content/blog";
  const posts = await Promise.all((await readdir(dir)).filter((f) => f.endsWith(".md")).map(async (f) => {
    const fm = (await readFile(`${dir}/${f}`, "utf8")).match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const title = fm.match(/^title:\s*["']?(.+?)["']?$/m)?.[1];
    return { url: `/blog/${f.replace(/\.md$/, "")}/`, title };
  }));
  return [{ url: "/", title: "My site" }, ...posts];
},
```

`src/layouts/Base.astro`:

```astro
---
import manifest from "../og-manifest.json";
const og = manifest[Astro.url.pathname] ?? { src: "/share.png", width: 1200, height: 630, type: "image/png" };
---
<meta property="og:image" content={new URL(og.src, Astro.site)} />
<meta property="og:image:width" content={og.width} />
<meta property="og:image:height" content={og.height} />
<meta name="twitter:card" content="summary_large_image" />
```

## Next.js (App Router)

Next.js can generate images itself (`next/og`), but if you want your HTML/CSS template and static files:

```ts
// app/blog/[slug]/page.tsx
import manifest from "@/og-manifest.json";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const og = (manifest as Record<string, { src: string; width: number; height: number }>)[`/blog/${slug}`];
  return { openGraph: og ? { images: [{ url: og.src, width: og.width, height: og.height }] } : undefined };
}
```

Set `metadataBase` in the root layout so relative image URLs become absolute.

## Single-page apps (Vite + React/Vue/Svelte without SSR)

Social networks don't run JavaScript, so a client-rendered SPA can only have one image for all URLs (put it into
`index.html`). Per-page images need SSR or prerendering – see the reasoning in the [Angular guide](angular.md).

## Using the API directly

If your build is a Node script, skip the CLI and manifest:

```js
import { createOgCards, build } from "@awwwesome-cz/og-cards";
import config from "./og.config.js";

const og = createOgCards({ ...config, mode: "build" });
og.begin();
for (const page of pages) {
  const image = og.image(page);   // { src, width, height, type } → put into your HTML
  // …render the page
}
await build(config, { queue: og.queue(), outDir: "dist/og" });
```
