# Laravel

Laravel already has a `package.json` (Vite), so og-cards fits right in. The flow:

1. `php artisan og:pages` prints your pages as JSON.
2. og-cards renders the images into `public/og` and writes a manifest.
3. A small helper reads the manifest and your layout prints the meta tags.

Which mode depends on **where your content lives**:

| Content | Setup |
|---|---|
| In the code (routes, Blade views, config, Markdown files) | [commit](#commit-mode) or [build](#build-mode-ci) mode – like any static site |
| In the production database (blog posts from an admin…) | [render on the server](#content-from-the-database) |

## 1. Install

```bash
npm install --save-dev @awwwesome-cz/og-cards playwright
npx playwright install chromium
```

## 2. `php artisan og:pages`

`routes/console.php` (Laravel 11+; in older versions use a command class):

```php
use App\Models\Post;
use Illuminate\Support\Facades\Artisan;

Artisan::command('og:pages', function () {
    $pages = [
        ['url' => '/',        'title' => config('app.name'), 'description' => 'Websites and apps.'],
        ['url' => '/about',   'title' => 'About us'],
        ['url' => '/contact', 'title' => 'Contact'],
    ];

    foreach (Post::query()->whereNotNull('published_at')->get() as $post) {
        $pages[] = [
            'url' => route('posts.show', $post, absolute: false),   // "/blog/my-post"
            'title' => $post->title,
            'description' => str($post->excerpt)->limit(120)->toString(),
            'eyebrow' => 'Blog',
        ];
    }

    $this->line(json_encode($pages, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
})->purpose('List pages for og-cards');
```

URLs are paths without the domain and **without a trailing slash** (`/`, `/blog/my-post`) – the same form the
helper in step 4 looks up.

## 3. `og.config.js`

```js
import { execFileSync } from "node:child_process";
import { defineConfig } from "@awwwesome-cz/og-cards";

export default defineConfig({
  pages: () => JSON.parse(execFileSync("php", ["artisan", "og:pages"], { encoding: "utf8" })),
  card: (page) => ({ eyebrow: page.eyebrow, title: page.title, description: page.description, site: "acme.example" }),

  template: "resources/og/template.html",   // your design (copy the default one to start)
  outDir: "public/og",
  publicPath: "/og",
  manifest: "resources/og/manifest.json",
  hashes: "resources/og/hashes.json",       // commit mode
});
```

## 4. Helper – `app/Support/OgImage.php`

```php
<?php

namespace App\Support;

class OgImage
{
    private static ?array $manifest = null;

    /** @return array{src: string, width: int, height: int, type: string} */
    public static function for(?string $path = null): array
    {
        self::$manifest ??= json_decode(@file_get_contents(resource_path('og/manifest.json')) ?: '{}', true);
        $path ??= '/' . ltrim(request()->path(), '/');   // "/" or "/blog/my-post"

        return self::$manifest[$path]
            ?? ['src' => '/images/share.png', 'width' => 1200, 'height' => 630, 'type' => 'image/png'];
    }
}
```

## 5. Meta tags – in your layout `<head>`

```blade
@php($og = \App\Support\OgImage::for())
<meta property="og:image" content="{{ url($og['src']) }}">
<meta property="og:image:width" content="{{ $og['width'] }}">
<meta property="og:image:height" content="{{ $og['height'] }}">
<meta property="og:image:type" content="{{ $og['type'] }}">
<meta name="twitter:card" content="summary_large_image">
```

## commit mode

```bash
npx og-cards
git add public/og resources/og
```

Your local database must contain the content you want images for (`og:pages` runs locally). After adding pages or
changing texts, run it again; `npx og-cards --check` in CI tells you when you forgot
([CI › commit mode](../ci.md#commit-mode) – the job needs PHP and `composer install`).

## build mode (CI)

For content that is in the code. Set `mode: "build"` and ignore the output:

```gitignore
/.cache
/public/og
/resources/og/manifest.json
```

In the deploy workflow ([CI › build mode](../ci.md#build-mode)) add PHP and run og-cards before you ship:

```yaml
      - uses: shivammathur/setup-php@v2
        with: { php-version: "8.3" }
      - run: composer install --no-dev --prefer-dist --no-interaction
      - run: npm ci
      # … Chromium + .cache/og-cards caches (see docs/ci.md)
      - run: npx og-cards && npm run build
      # … deploy (rsync, Envoyer, Deployer…) including public/og and resources/og/manifest.json
```

If `og:pages` needs the database, CI would need it too – usually that means the next setup instead.

## Content from the database

When editors publish content in production, the images have to be rendered **where the data is – on the
server**. That needs Node and Chromium on the server (once):

```bash
npx playwright install --with-deps chromium
```

Use commit mode (the default) and keep everything generated in `storage/`, which survives deploys – also
zero-downtime ones (Envoyer, Deployer) where each release is a new folder:

```js
// og.config.js – instead of the paths from step 3
outDir: "storage/app/public/og",     // served via `php artisan storage:link`
publicPath: "/storage/og",
manifest: "storage/app/og/manifest.json",
hashes: "storage/app/og/hashes.json",
```

…and in `OgImage::for()` read `storage_path('app/og/manifest.json')` instead of `resource_path(…)`.
Nothing generated is committed (`storage/` is ignored by Laravel's default `.gitignore`).

Then run og-cards:

**After each deploy** (Forge / Envoyer / Deployer deploy script):

```bash
npm ci
npx og-cards
```

**When content changes** – a queued job, so the editor doesn't wait for Chromium:

```php
// app/Jobs/RenderOgImages.php
namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Process;

class RenderOgImages implements ShouldQueue, ShouldBeUnique
{
    use Queueable;

    public int $uniqueFor = 60;

    public function handle(): void
    {
        Process::path(base_path())->timeout(300)->run('npx og-cards')->throw();
    }
}
```

```php
// app/Models/Post.php
protected static function booted(): void
{
    static::saved(fn () => \App\Jobs\RenderOgImages::dispatch());
    static::deleted(fn () => \App\Jobs\RenderOgImages::dispatch());
}
```

…or simply on a schedule (`routes/console.php`):

```php
Schedule::exec('npx og-cards')->hourly()->withoutOverlapping();
```

Only new and changed cards are rendered, so these runs are quick. Until a page's image exists, the helper returns
the fallback.
