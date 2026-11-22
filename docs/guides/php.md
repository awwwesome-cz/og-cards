# Plain PHP

For a classic PHP site (`index.php`, `about.php`, includes…). og-cards is a Node tool, so you need Node on the
machine that renders the images – your computer (commit mode) or CI (build mode). **The web server only needs
PHP**: it reads a JSON manifest.

```
my-site/
├── index.php
├── about.php
├── blog/hello.php
├── includes/
│   ├── head.php            ← prints the meta tags
│   ├── og.php              ← reads the manifest
│   └── og-manifest.json    ← generated
├── og-images/              ← generated images (served at /og-images/)
├── og/template.html        ← your design (optional)
├── og-pages.php            ← list of pages for og-cards
├── og.config.js
└── package.json
```

## 1. Install

```bash
npm init -y                     # if you have no package.json yet
npm install --save-dev @awwwesome-cz/og-cards playwright
npx playwright install chromium
```

## 2. List your pages – `og-pages.php`

og-cards needs to know the pages and their texts. Keep that in PHP, next to your content:

```php
<?php
// Pages that get a social image. og-cards runs: php og-pages.php
$pages = [
    ['url' => '/',          'title' => 'Acme Studio', 'description' => 'Websites and apps.'],
    ['url' => '/about.php', 'title' => 'About us',    'description' => 'Who we are.'],
];

// e.g. one page per blog post file (blog/*.php starting with $title = '…';)
foreach (glob(__DIR__ . '/blog/*.php') as $file) {
    preg_match('/\$title\s*=\s*[\'"](.+?)[\'"]/', file_get_contents($file), $m);
    $pages[] = ['url' => '/blog/' . basename($file), 'title' => $m[1] ?? basename($file, '.php'), 'eyebrow' => 'Blog'];
}

echo json_encode($pages, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
```

The `url` must be exactly what the browser requests (`/about.php`, or `/about` with pretty URLs) – that's the key
your PHP looks up later. Content in a database? Query it here the same way.

## 3. `og.config.js`

```js
import { execFileSync } from "node:child_process";
import { defineConfig } from "@awwwesome-cz/og-cards";

export default defineConfig({
  pages: () => JSON.parse(execFileSync("php", ["og-pages.php"], { encoding: "utf8" })),
  card: (page) => ({ eyebrow: page.eyebrow, title: page.title, description: page.description, site: "acme.example" }),

  outDir: "og-images",
  publicPath: "/og-images",
  manifest: "includes/og-manifest.json",
  hashes: "og-hashes.json",            // commit mode only
  // template: "og/template.html",
  // mode: "build",
});
```

## 4. Read the manifest – `includes/og.php`

```php
<?php
/**
 * Social image for the current page (or $path), from the og-cards manifest.
 * @return array{src: string, width: int, height: int, type: string}
 */
function og_image(?string $path = null): array
{
    static $manifest = null;
    if ($manifest === null) {
        $json = @file_get_contents(__DIR__ . '/og-manifest.json');
        $manifest = $json ? json_decode($json, true) : [];
    }
    $path ??= parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

    return $manifest[$path]
        ?? ['src' => '/images/share.png', 'width' => 1200, 'height' => 630, 'type' => 'image/png']; // fallback
}
```

## 5. Print the meta tags – `includes/head.php`

```php
<?php
require_once __DIR__ . '/og.php';
$og = og_image();
$base = 'https://acme.example';
?>
<meta property="og:image" content="<?= htmlspecialchars($base . $og['src']) ?>">
<meta property="og:image:width" content="<?= $og['width'] ?>">
<meta property="og:image:height" content="<?= $og['height'] ?>">
<meta property="og:image:type" content="<?= htmlspecialchars($og['type']) ?>">
<meta name="twitter:card" content="summary_large_image">
```

## 6. Render

```bash
npx og-cards
```

## commit mode (default) – upload by FTP, no CI needed

Commit `og-images/`, `includes/og-manifest.json` and `og-hashes.json`, upload as you always do.
After changing texts or adding a page, run `npx og-cards` again (`npx og-cards --check` tells you whether you
need to).

Optional CI check: [CI › commit mode](../ci.md#commit-mode) (`ubuntu-latest` has PHP for `og-pages.php`).

## build mode – rendered in CI before upload

Set `mode: "build"` and ignore the generated files:

```gitignore
.cache/
og-images/
includes/og-manifest.json
```

Deploy workflow: [CI › build mode](../ci.md#build-mode) with `npx og-cards` as the build step, then upload, e.g.:

```yaml
      - run: npx og-cards
      - name: Upload
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.FTP_SERVER }}
          username: ${{ secrets.FTP_USERNAME }}
          password: ${{ secrets.FTP_PASSWORD }}
          exclude: |
            **/.git*/**
            **/node_modules/**
            .cache/**
```

In build mode file names contain the fingerprint (`og-images/about-php.3f2a9c01de.jpg`) and old ones are
deleted from `og-images/` locally – make sure your upload also removes them on the server (FTP-Deploy-Action
does) or clean the folder from time to time.
