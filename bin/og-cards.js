#!/usr/bin/env node
// og-cards CLI
//
//   og-cards                 render new and changed cards
//   og-cards --all           re-render every card
//   og-cards blog            only cards whose file name contains "blog"
//   og-cards --check         exit 1 when an image is missing or outdated (CI)
//   og-cards -c path.js      use another config file

import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { render } from "../src/render.js";

const HELP = `Usage: og-cards [filter] [--all] [--check] [--config <file>]

  filter          only render cards whose file name contains this text
  --all           re-render every card, even up-to-date ones
  --check         do not render; exit with code 1 if any image is missing or outdated
  -c, --config    config file (default: og.config.js / og.config.mjs in the current directory)
  -h, --help      show this help`;

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  console.log(HELP);
  process.exit(0);
}
const ci = Math.max(args.indexOf("-c"), args.indexOf("--config"));
const configArg = ci >= 0 ? args[ci + 1] : null;
const filter = args.find((a, i) => !a.startsWith("-") && (ci < 0 || i !== ci + 1));

const configPath = configArg
  ? path.resolve(configArg)
  : ["og.config.js", "og.config.mjs"].map((f) => path.resolve(f)).find(existsSync);
if (!configPath || !existsSync(configPath)) {
  console.error("og-cards: no og.config.js found – see https://github.com/awwwesome-cz/og-cards");
  process.exit(1);
}

try {
  const config = (await import(pathToFileURL(configPath).href)).default;
  const opts = { all: args.includes("--all"), check: args.includes("--check"), filter: filter || undefined };
  const res = await render({ root: path.dirname(configPath), ...config }, opts);
  if (opts.check) {
    console.log(res.stale.length ? `${res.stale.length} image(s) need \`og-cards\`.` : "All images are up to date.");
    process.exit(res.stale.length ? 1 : 0);
  }
  console.log(res.rendered.length ? `Done – ${res.rendered.length} image(s).` : "All images are up to date.");
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
