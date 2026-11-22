// Eleventy plugin.
//
//   import ogCards from "@awwwesome-cz/og-cards/eleventy";
//   import ogConfig from "./og.config.js";
//   eleventyConfig.addPlugin(ogCards, { config: ogConfig });
//
// Adds the `ogImage` filter: {{ { url: page.url, title: title } | ogImage }}
// → { src, width, height, type } (or `fallback`).
//
// commit mode: warns at the end of a build when images are missing/outdated (run `npx og-cards`).
// build mode:  renders the images into <output>/<publicPath> at the end of every build
//              (unchanged cards come from the cache). Set OG_CARDS_SKIP=1 to skip.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { createOgCards, QUEUE_ENV, SKIP_ENV } from "./index.js";
import { build } from "./render.js";

export { QUEUE_ENV };

/**
 * @param {any} eleventyConfig
 * @param {{ config: import("./types").OgCardsConfig, filter?: string }} options
 */
export default function ogCardsPlugin(eleventyConfig, options = {}) {
  if (!options.config) throw new Error("og-cards: pass your config – addPlugin(ogCards, { config })");
  const og = createOgCards(options.config);
  const c = og.config;

  eleventyConfig.on("eleventy.before", () => og.begin());
  eleventyConfig.addFilter(options.filter || "ogImage", (data) => og.image(data));
  eleventyConfig.on("eleventy.after", async (event = {}) => {
    // `og-cards` CLI runs a build with this variable to collect the cards
    if (process.env[QUEUE_ENV]) return writeFileSync(process.env[QUEUE_ENV], JSON.stringify(og.queue()));

    if (c.mode === "build") {
      if (process.env[SKIP_ENV] === "1") return console.warn("og-cards: rendering skipped (OG_CARDS_SKIP=1).");
      const output = event.directories?.output ?? event.dir?.output ?? "_site";
      const outDir = path.join(path.resolve(c.root, output), c.publicPath);
      // watch/serve builds can be partial → do not delete images of pages that were not rebuilt
      const prune = !event.runMode || event.runMode === "build";
      return build(c, { outDir, queue: og.queue(), prune, log: (m) => console.log(m.startsWith("og-cards") ? `[11ty] ${m}` : `[11ty] og-cards ${m}`) });
    }

    const problems = og.problems();
    if (!problems.length) return;
    if (c.onStale) return c.onStale(problems);
    console.warn(
      `\n⚠ og-cards: ${problems.length} social preview image(s) are missing or outdated – run \`npx og-cards\` and commit the result:\n  ` +
        problems.map((p) => `${p.url} (${p.reason})`).join("\n  ") + "\n",
    );
  });
}
