# CLI

```bash
npx og-cards [filter] [--all] [--check] [--config <file>]
```

It reads `og.config.js` (or `og.config.mjs`) from the current folder.

## commit mode (default)

| Command | |
|---|---|
| `npx og-cards` | Render new and changed cards into `outDir`, update the fingerprints file and the manifest, delete images of pages that no longer exist. |
| `npx og-cards --all` | Re-render every card (e.g. after upgrading Playwright). |
| `npx og-cards blog` | Only cards whose file name contains `blog` (nothing is deleted). |
| `npx og-cards --check` | Render nothing; exit with code 1 if an image is missing, outdated or orphaned. For CI. Needs no browser. |

## build mode

| Command | |
|---|---|
| `npx og-cards` | Render cards that are not in the cache, copy all images to `outDir` as `<name>.<fingerprint>.jpg`, remove old images there, write the manifest. |

With the Eleventy plugin you don't call the CLI in build mode – images are rendered at the end of every Eleventy
build.

## Common

| Option | |
|---|---|
| `-c`, `--config <file>` | Use another config file. Relative paths in it are resolved from its folder. |
| `-h`, `--help` | Help. |

Where pages come from: `pages` in the config, or – if it is not set – an Eleventy build into a temporary folder
(that's how the CLI sees exactly the pages your Eleventy site has).

## npm scripts

```json
{
  "scripts": {
    "og": "og-cards",
    "build": "og-cards && vite build"
  }
}
```
