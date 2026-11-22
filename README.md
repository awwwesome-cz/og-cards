# og-cards

Generate **social preview images** (`og:image` for Facebook, LinkedIn, X, Slack, WhatsApp…) for every page of
your site from **an HTML template you design yourself**.

![Example card rendered with the bundled default template](https://raw.githubusercontent.com/awwwesome-cz/og-cards/main/docs/images/example.jpg)

- **Your design stays yours** – the package ships only a plain default template; your template lives in your project.
- **Any stack** – Eleventy plugin included; plain PHP, Laravel, Angular, Astro, Next.js… via a page list and a JSON manifest.
- **Commit the images, or don't** – render locally and commit them, or render them during the build / in CI.
- **Only what changed is rendered** – every card is fingerprinted (card data + template).
- **Cache-busting built in** – the image URL changes whenever the image does, so social networks pick up new versions.

It renders with [Playwright](https://playwright.dev) (Chromium), so anything a browser can draw works: web fonts,
gradients, SVG, images.

## Install

```bash
npm install --save-dev @awwwesome-cz/og-cards playwright
npx playwright install chromium   # once per machine
```

Node 20+.

## In 30 seconds

```js
// og.config.js
import { defineConfig } from "@awwwesome-cz/og-cards";

export default defineConfig({
  pages: [
    { url: "/", title: "Hello world", description: "My new site" },
    { url: "/about/", title: "About us" },
  ],
  card: (page) => ({ title: page.title, description: page.description, site: "example.com" }),
  outDir: "public/og",
  publicPath: "/og",
  manifest: "og-manifest.json",
});
```

```bash
npx og-cards
```

You get `public/og/home.jpg` and `public/og/about.jpg`, plus `og-manifest.json` mapping each page URL to its image.
Your site reads the manifest and prints the `<meta property="og:image">` tag.

## Documentation

**Start here**

| | |
|---|---|
| [How it works](docs/how-it-works.md) | Cards, templates, fingerprints, and the two modes: **commit** vs **build** |
| [Your own template](docs/templates.md) | Designing the image in HTML/CSS, helpers, fonts, keeping your design private |

**Guides for your stack**

| Stack | Guide |
|---|---|
| Eleventy | [docs/guides/eleventy.md](docs/guides/eleventy.md) – plugin, no page list needed |
| Plain PHP | [docs/guides/php.md](docs/guides/php.md) |
| Laravel | [docs/guides/laravel.md](docs/guides/laravel.md) – incl. pages from the database |
| Angular | [docs/guides/angular.md](docs/guides/angular.md) – SSR / prerendering |
| Astro, Next.js, Vite, other JS | [docs/guides/javascript.md](docs/guides/javascript.md) |

**Reference**

| | |
|---|---|
| [CI / deployment](docs/ci.md) | GitHub Actions for both modes, caching, self-hosted runners, GitLab |
| [Configuration](docs/configuration.md) | Every option of `og.config.js` and the JavaScript API |
| [CLI](docs/cli.md) | `og-cards` command |

## Which mode should I use?

| | **commit** (default) | **build** (`mode: "build"`) |
|---|---|---|
| Where images are rendered | on your computer (`npx og-cards`) | during the build / in CI |
| In git | images + fingerprints file | nothing (only the template and config) |
| Needs Chromium in CI | no | yes |
| Good for | hosting without a build step, simple setups | sites built in CI, keeping the repository small |

Details: [How it works › Modes](docs/how-it-works.md#modes).

## License

MIT
