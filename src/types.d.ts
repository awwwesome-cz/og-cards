export type TemplateName = "default" | "minimal" | "bold" | "article" | "split" | "product" | "event" | "quote" | "stats" | "docs";

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
  /**
   * "commit" (default): you run `og-cards`, images + fingerprints are committed.
   * "build": images are rendered during the build/CI into the output, nothing is committed.
   */
  mode?: "commit" | "build";
  /** build mode: where rendered images are cached between builds. Default ".cache/og-cards". */
  cacheDir?: string;
  /** Built-in template name, or a path to an HTML file defining `window.renderCard(card)`. Default "default". */
  template?: TemplateName | (string & {});
  /** Folder your site serves at "/" – card images like "/images/x.png" are read from here. Default ".". */
  publicDir?: string;
  /** Where images are written (dedicated folder – unknown images in it are deleted). Default "og".
   *  With the Eleventy plugin in build mode this is ignored: images go to <output>/<publicPath>. */
  outDir?: string;
  /** Public URL of `outDir`. Default "/og". */
  publicPath?: string;
  /** commit mode: file with card fingerprints (commit it). Default "og-hashes.json". */
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
export const TEMPLATES: TemplateName[];

export interface OgCards {
  config: Required<OgCardsConfig>;
  begin(): void;
  image(data: PageData): OgImage | null;
  queue(): Record<string, { url: string; hash: string; card: Card }>;
  problems(): Problem[];
}
export function createOgCards(config: OgCardsConfig): OgCards;

export const QUEUE_ENV: string;
export const SKIP_ENV: string;

/** Render according to `config.mode` (what the CLI does). */
export function render(
  config: OgCardsConfig,
  opts?: { all?: boolean; filter?: string; check?: boolean; log?: (msg: string) => void },
): Promise<{ rendered: string[]; removed: string[]; stale?: string[]; total?: number }>;

/** build mode: render missing cards into the cache and copy every image to `outDir`. */
export function build(
  config: OgCardsConfig,
  opts?: {
    outDir?: string;
    queue?: Record<string, { url: string; hash: string; card: Card }>;
    prune?: boolean;
    log?: (msg: string) => void;
  },
): Promise<{ rendered: string[]; removed: string[]; total: number }>;
