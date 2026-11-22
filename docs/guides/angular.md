# Angular

## First: social networks don't run JavaScript

Facebook, LinkedIn, X and Slack read the **HTML your server sends** – they don't run Angular. A plain SPA sends the
same `index.html` for every URL, so every page shares one image no matter what your components do.

Per-page images need **server-side rendering or prerendering** (`ng add @angular/ssr`). With prerendering
(`outputMode: "static"`, Angular 19+), every route becomes an HTML file with its own meta tags – perfect for
og-cards. Without SSR, set one static image in `src/index.html` and stop here.

The flow:

1. Your pages (routes + titles) are in a JSON file the app and og-cards both read.
2. `og-cards` renders images into `public/og` and writes `src/og-manifest.json` before `ng build`.
3. A service sets `og:image` from the manifest on every navigation; prerendering bakes it into the HTML.

## 1. Install

```bash
npm install --save-dev @awwwesome-cz/og-cards playwright
npx playwright install chromium
```

## 2. Pages – `src/content/pages.json`

```json
[
  { "url": "/", "title": "Acme", "description": "Websites and apps." },
  { "url": "/about", "title": "About us" },
  { "url": "/blog/hello", "title": "Hello world", "eyebrow": "Blog" }
]
```

URLs as Angular's router reports them: leading slash, no trailing slash. Content from an API? Make `pages` an async
function that fetches it (`pages: async () => (await fetch("https://api.example.com/pages")).json()`).

## 3. `og.config.js`

```js
import { defineConfig } from "@awwwesome-cz/og-cards";

export default defineConfig({
  mode: "build",
  pages: "src/content/pages.json",
  card: (page) => ({ eyebrow: page.eyebrow, title: page.title, description: page.description, site: "acme.example" }),
  template: "og/template.html",
  outDir: "public/og",               // Angular 18+ copies public/ to the output root
  publicPath: "/og",
  manifest: "src/og-manifest.json",
});
```

(Angular 17 and older: `outDir: "src/assets/og"`, `publicPath: "/assets/og"`.)

```gitignore
/.cache
/public/og
/src/og-manifest.json
```

## 4. Run it before build and serve – `package.json`

```json
{
  "scripts": {
    "start": "og-cards && ng serve",
    "build": "og-cards && ng build"
  }
}
```

Unchanged images come from the cache, so this adds little time after the first run.

## 5. The service – `src/app/og-image.service.ts`

`tsconfig.json` needs `"resolveJsonModule": true` (and `"esModuleInterop": true`, default in new projects).

```ts
import { Injectable, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import ogManifest from '../og-manifest.json';

type OgImage = { src: string; width: number; height: number; type: string };

const SITE_URL = 'https://acme.example';
const FALLBACK: OgImage = { src: '/share.png', width: 1200, height: 630, type: 'image/png' };
const manifest = ogManifest as Record<string, OgImage>;

@Injectable({ providedIn: 'root' })
export class OgImageService {
  private meta = inject(Meta);

  set(url: string): void {
    const path = url.split(/[?#]/)[0] || '/';
    const og = manifest[path] ?? FALLBACK;
    this.meta.updateTag({ property: 'og:image', content: SITE_URL + og.src });
    this.meta.updateTag({ property: 'og:image:width', content: String(og.width) });
    this.meta.updateTag({ property: 'og:image:height', content: String(og.height) });
    this.meta.updateTag({ property: 'og:image:type', content: og.type });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
  }
}
```

## 6. Call it on navigation – `src/app/app.component.ts`

```ts
import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { OgImageService } from './og-image.service';

@Component({ selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })
export class AppComponent {
  constructor() {
    const router = inject(Router);
    const og = inject(OgImageService);
    router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => og.set(e.urlAfterRedirects));
  }
}
```

During prerendering this runs on the server, so each generated HTML file contains its own `og:image`.

## 7. Prerender the routes

`src/app/app.routes.server.ts` (Angular 19+):

```ts
import { RenderMode, ServerRoute } from '@angular/ssr';
import pages from '../content/pages.json';

export const serverRoutes: ServerRoute[] = [
  ...pages.map((p) => ({ path: p.url.slice(1), renderMode: RenderMode.Prerender }) as ServerRoute),
  { path: '**', renderMode: RenderMode.Prerender },
];
```

Check the result: `npm run build`, then look for `og:image` in `dist/<app>/browser/about/index.html`.

## CI

Build mode in GitHub Actions: [CI › build mode](../ci.md#build-mode) – install Chromium, cache
`.cache/og-cards`, run `npm run build`, deploy `dist/<app>/browser` (Firebase, S3, GitHub Pages, your server…).

Hosting that builds the app itself (Vercel, Cloudflare Pages) may not run Chromium – then use commit mode: remove
`mode: "build"`, commit `public/og`, `src/og-manifest.json` and `og-hashes.json`, and change the scripts to plain
`ng serve` / `ng build` (run `npx og-cards` yourself when pages change).
