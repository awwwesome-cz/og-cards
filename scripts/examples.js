// Renders docs/images/templates/<name>.jpg – one example per built-in template.
//   node scripts/examples.js
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, TEMPLATES } from "../src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ex = "docs/images/examples";

export const EXAMPLES = {
  default: { eyebrow: "Guide", title: "How to price your freelance web projects", description: "A simple framework that works for small and large clients alike.", site: "acme.example", logo: `${ex}/logo.svg` },
  minimal: { eyebrow: "Acme Studio", title: "We design and build websites that sell", description: "Strategy, design and development for growing brands.", site: "acme.example", logo: `${ex}/logo.svg` },
  bold: { eyebrow: "New in 2.0", title: "Launch your store in one afternoon", description: "Templates, payments and shipping – ready when you are.", cta: "Start free", site: "acme.example", logo: `${ex}/logo-light.svg`, accent: "#7c3aed" },
  article: { eyebrow: "Marketing", title: "7 landing page mistakes that quietly kill conversions", author: "Jane Cooper", role: "Head of Growth", date: "Mar 12, 2026", readingTime: "6 min read", site: "acme.example", logo: `${ex}/logo.svg`, accent: "#ea580c" },
  split: { eyebrow: "Case study", title: "A dashboard teams actually open every morning", description: "How we cut onboarding time in half for a SaaS analytics product.", cta: "Read the story", image: `${ex}/screenshot.svg`, site: "acme.example", logo: `${ex}/logo.svg` },
  product: { title: "Pulse Smartwatch S2", description: "7-day battery, heart-rate and sleep tracking.", image: `${ex}/product.svg`, price: "$149", oldPrice: "$199", badge: "−25 %", rating: 4.7, reviews: "1,284 reviews", cta: "Buy now", site: "acme.example", logo: `${ex}/logo.svg`, accent: "#0f766e" },
  event: { eyebrow: "Free webinar", title: "Scaling a small e-shop past 1,000 orders a month", date: "2026-12-03", time: "18:00 – 19:30 CET", place: "Online · Zoom", cta: "Save my seat", site: "acme.example", logo: `${ex}/logo-light.svg`, accent: "#e11d48" },
  quote: { quote: "Within three months our new site brought in more leads than the old one did in a year. The team just gets it.", author: "Michael Foster", avatar: `${ex}/avatar.svg`, role: "CEO, Brightline Interiors", rating: 5, site: "acme.example", logo: `${ex}/logo.svg`, accent: "#0d9488" },
  stats: { eyebrow: "Case study", title: "Redesign for an outdoor gear shop", stats: [{ value: "+312 %", label: "organic traffic in 6 months" }, { value: "2.4×", label: "conversion rate" }, { value: "−48 %", label: "page load time" }], site: "acme.example", logo: `${ex}/logo-light.svg`, accent: "#2563eb" },
  docs: { breadcrumb: ["Docs", "Guides", "Laravel"], title: "Social images for every page in Laravel", description: "Render og:image cards from your own HTML template.", version: "v0.3", site: "acme.example", logo: `${ex}/logo-light.svg`, accent: "#22d3ee" },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const only = process.argv[2];
  for (const name of TEMPLATES.filter((t) => !only || t === only)) {
    const out = path.join(root, "docs/images/templates", name);
    await build(
      { root, mode: "build", template: name, cacheDir: `.cache/examples/${name}`, publicPath: "/", pages: [{ url: `/${name}/` }], card: () => EXAMPLES[name], quality: 90 },
      { outDir: out, log: () => {} },
    );
    // keep a stable file name for the docs
    const { readdirSync, renameSync } = await import("node:fs");
    const file = readdirSync(out)[0];
    renameSync(path.join(out, file), path.join(root, "docs/images/templates", `${name}.jpg`));
    rmSync(out, { recursive: true });
    console.log(`✓ docs/images/templates/${name}.jpg`);
  }
  rmSync(path.join(root, ".cache/examples"), { recursive: true, force: true });
}
