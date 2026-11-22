# CI / deployment

- [commit mode](#commit-mode) – CI only checks that the committed images are up to date
- [build mode](#build-mode) – CI renders the images while building the site
- [Self-hosted runners](#self-hosted-runners)
- [Hosting that builds your site (Netlify, Vercel, Cloudflare Pages)](#hosting-that-builds-your-site)
- [GitLab CI](#gitlab-ci)

Stack-specific deploy steps (FTP, Laravel deploy scripts, Angular hosting) are in the [guides](../README.md#documentation).

## commit mode

Images are rendered on your computer and committed. CI needs **no browser** – it only verifies that nobody forgot
to run `npx og-cards`:

```yaml
# .github/workflows/check.yml
name: Check
on: [push, pull_request]
jobs:
  og-images:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx og-cards --check
```

If your `pages` come from PHP (`php og-pages.php`, `php artisan og:pages`), the job needs PHP too
(`ubuntu-latest` has it; for Laravel run `composer install` first).

The deploy job then just uploads the site – the images are already in the repository.

## build mode

CI renders the images as part of the build. Two things make it fast:

1. **Chromium** is cached (`~/.cache/ms-playwright`), so it isn't downloaded on every run.
2. **Rendered images** are cached (`.cache/og-cards`), so only new or changed cards are rendered.

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push: { branches: [main] }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci

      # Chromium for og-cards (version follows Playwright in package-lock.json)
      - name: Cache Chromium
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
      - run: npx playwright install --with-deps chromium

      # Images rendered by previous runs – only new/changed cards are rendered
      - name: Cache social images
        uses: actions/cache@v4
        with:
          path: .cache/og-cards
          key: og-cards-${{ github.ref_name }}-${{ github.sha }}
          restore-keys: |
            og-cards-${{ github.ref_name }}-
            og-cards-

      - run: npm run build        # Eleventy: images are rendered at the end of the build
      # - run: npx og-cards && npm run build   # other stacks: render first, then build

      # … upload / deploy the output folder as usual
```

Notes:

- `--with-deps` installs the system libraries Chromium needs (uses `sudo apt-get`). It is fast when they are
  already present.
- The cache key includes the commit, so every run saves an updated cache; `restore-keys` loads the latest one.
- Add `.cache/` and the output image folder (e.g. `public/og/`) to `.gitignore`.
- Run your E2E/link checks after the build – images exist by then.

## Self-hosted runners

- `npx playwright install --with-deps chromium` needs root or passwordless `sudo` for the system libraries. On a
  runner image without them, install once in the image (`npx playwright install-deps chromium`) and use
  `npx playwright install chromium` in the workflow.
- The workspace is often reused between runs. `actions/cache` still works (it talks to GitHub's cache service),
  but you can also point `cacheDir` to a persistent folder outside the workspace:
  ```js
  cacheDir: process.env.RUNNER_TOOL_CACHE ? `${process.env.RUNNER_TOOL_CACHE}/og-cards` : ".cache/og-cards",
  ```

## Hosting that builds your site

Netlify, Vercel and Cloudflare Pages run `npm run build` themselves.

- **Netlify:** Chromium usually works. Add `npx playwright install chromium` before the build command and keep
  `.cache/og-cards` with a build cache plugin – or simply use commit mode.
- **Vercel / Cloudflare Pages:** the build image lacks libraries Chromium needs. Use **commit mode**, or render in
  GitHub Actions and deploy the built output from there.

## GitLab CI

```yaml
build:
  image: mcr.microsoft.com/playwright:v1.63.0-noble   # Node + Chromium preinstalled; match your Playwright version
  cache:
    - key: og-cards
      paths: [.cache/og-cards]
  script:
    - npm ci
    - npm run build
  artifacts:
    paths: [dist]
```

commit mode on GitLab: any Node image and `npx og-cards --check`.
