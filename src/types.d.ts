export type PageData = Record<string, any> & { url: string };

/** Whatever your template's `renderCard(card)` expects. Must be JSON-serialisable. */
export type Card = Record<string, any>;

export interface OgImage {
  src: string;
  width: number;
  height: number;
  type: string;
}

export interface Problem {
  url: string;
  key: string;
  reason: "missing" | "outdated";
}

export interface OgCardsConfig {
  /** Builds the card for a page. Return null/false to use `fallback` (e.g. 404, noindex pages). */
  card(data: PageData): Card | null | false | undefined;
  /** HTML template defining `window.renderCard(card)`. Default: the bundled plain template. */
  template?: string;
  /** Where images are written (dedicated folder – unknown images in it are deleted). Default "og". */
  outDir?: string;
  /** Public URL of `outDir`. Default "/og". */
  publicPath?: string;
  /** File with card fingerprints (commit it). Default "og-hashes.json". */
  hashes?: string;
  /** Pages to render when not using the Eleventy plugin: array, (async) function, or path to a JSON array. */
  pages?: PageData[] | (() => PageData[] | Promise<PageData[]>) | string;
  /** Also write a JSON map "page URL → image" (handy for PHP, Laravel, WordPress…). */
  manifest?: string;
  /** Image used when a page has no card or its image does not exist yet. */
  fallback?: OgImage | null;
  /** Return an image to skip generating one for this page (e.g. a hand-made `og_image`). */
  override?(data: PageData): OgImage | null | undefined | false;
  /** File name (without extension) for a page. Default: from the URL, "/" → "home". */
  key?(url: string, data: PageData): string;
  /** Extra files (fonts, CSS, images) whose change should re-render every card. */
  watch?: string[];
  /** Base directory for every path above. Default: the folder of og.config.js / current directory. */
  root?: string;
  width?: number;
  height?: number;
  format?: "jpeg" | "png";
  /** JPEG quality 0–100. Default 88. */
  quality?: number;
  /** Options for Playwright's chromium.launch(). */
  launch?: Record<string, any>;
  /** Custom reporting of missing/outdated images at the end of a build. */
  onStale?(problems: Problem[]): void;
}

export function defineConfig<T extends OgCardsConfig>(config: T): T;
export function cardKey(url: string): string;
export const DEFAULT_TEMPLATE: string;

export interface OgCards {
  config: Required<OgCardsConfig>;
  begin(): void;
  image(data: PageData): OgImage | null;
  queue(): Record<string, { url: string; hash: string; card: Card }>;
  problems(): Problem[];
}
export function createOgCards(config: OgCardsConfig): OgCards;

export function render(
  config: OgCardsConfig,
  opts?: { all?: boolean; filter?: string; check?: boolean; log?: (msg: string) => void },
): Promise<{ rendered: string[]; removed: string[]; stale: string[] }>;
