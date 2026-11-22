// Renders docs/images/social-preview.png (1280 × 640) – the GitHub social preview of this repository,
// made with og-cards itself. Upload it in Settings → General → Social preview.
//   node scripts/examples.js && node scripts/social-preview.js
import { readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".cache/social-out");
await build(
  {
    root, mode: "build", template: "docs/social/template.html", width: 1280, height: 640, format: "png",
    cacheDir: ".cache/social", publicPath: "/", pages: [{ url: "/" }],
    card: () => ({ images: ["bold", "article", "product"].map((t) => `docs/images/templates/${t}.jpg`) }),
  },
  { outDir: out, log: () => {} },
);
renameSync(path.join(out, readdirSync(out)[0]), path.join(root, "docs/images/social-preview.png"));
rmSync(path.join(root, ".cache/social-out"), { recursive: true, force: true });
rmSync(path.join(root, ".cache/social"), { recursive: true, force: true });
console.log("✓ docs/images/social-preview.png");
