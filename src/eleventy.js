// Eleventy plugin.
//
//   import ogCards from "@awwwesome-cz/og-cards/eleventy";
//   import ogConfig from "./og.config.js";
//   eleventyConfig.addPlugin(ogCards, { config: ogConfig });
//
// Adds the `ogImage` filter: {{ { url: page.url, title: title } | ogImage }}
// → { src, width, height, type } (or `fallback` when the card has no image yet).

import { writeFileSync } from "node:fs";
import { createOgCards } from "./index.js";

export const QUEUE_ENV = "OG_CARDS_QUEUE";

/**
 * @param {any} eleventyConfig
 * @param {{ config: import("./types").OgCardsConfig, filter?: string }} options
 */
export default function ogCardsPlugin(eleventyConfig, options = {}) {
  if (!options.config) throw new Error('og-cards: pass your config – addPlugin(ogCards, { config })');
  const og = createOgCards(options.config);

  eleventyConfig.on("eleventy.before", () => og.begin());
  eleventyConfig.addFilter(options.filter || "ogImage", (data) => og.image(data));
  eleventyConfig.on("eleventy.after", () => {
    // `og-cards` CLI runs a build with this variable to collect the cards
    if (process.env[QUEUE_ENV]) return writeFileSync(process.env[QUEUE_ENV], JSON.stringify(og.queue()));
    const problems = og.problems();
    if (!problems.length) return;
    if (og.config.onStale) return og.config.onStale(problems);
    console.warn(
      `\n⚠ og-cards: ${problems.length} social preview image(s) are missing or outdated – run \`npx og-cards\` and commit the result:\n  ` +
        problems.map((p) => `${p.url} (${p.reason})`).join("\n  ") + "\n",
    );
  });
}
