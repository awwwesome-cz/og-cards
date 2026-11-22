// Helpers injected into the template page before it loads, available as `window.ogCards`.
// Kept as a plain function so it can be serialised by Playwright's addInitScript.

/** @param {{ root?: string, publicDir?: string }} [paths] file:// URLs (with trailing slash) */
export function installBrowserHelpers(paths = {}) {
  window.ogCards = {
    /** file:// URL of the project root (where og.config.js lives). */
    root: paths.root || "",
    /** file:// URL of the folder that "/…" paths point to (config `publicDir`). */
    publicDir: paths.publicDir || paths.root || "",

    /**
     * URL for an image given in a card – usable as <img src>.
     *   "https://…", "data:…", "file:…"  → unchanged
     *   "/images/logo.svg"               → <publicDir>/images/logo.svg
     *   "assets/logo.svg"                → <project root>/assets/logo.svg
     */
    src(value) {
      if (!value) return "";
      if (/^(https?:|data:|file:|blob:)/i.test(value)) return value;
      const base = value.startsWith("/") ? this.publicDir : this.root;
      return base ? new URL(value.replace(/^\//, ""), base).href : value;
    },

    /**
     * Shrinks `el`'s font size until it fits `maxLines` lines and (optionally) its
     * `container` stops overflowing.
     *
     *   await ogCards.fit(h1, { min: 34, maxLines: 3, container: document.querySelector(".main") })
     *
     * @param {HTMLElement} el
     * @param {{ min?: number, step?: number, maxLines?: number, lineHeight?: number,
     *           container?: HTMLElement | null, property?: string }} [o]
     *   lineHeight – factor used to measure lines (default: el's computed line-height)
     *   property   – what to set: "font-size" (default) or a CSS custom property like "--fs"
     */
    async fit(el, o = {}) {
      if (!el) return 0;
      await document.fonts.ready;
      const { min = 24, step = 2, maxLines = 3, container = null, property = "font-size" } = o;
      let fs = parseFloat(getComputedStyle(el).fontSize);
      const lh = () => o.lineHeight ?? (parseFloat(getComputedStyle(el).lineHeight) / fs || 1.2);
      const overflows = () =>
        (container && container.scrollHeight > container.clientHeight + 1) || el.offsetHeight > fs * lh() * maxLines + 2;
      while (fs > min && overflows()) {
        fs -= step;
        el.style.setProperty(property, `${fs}px`);
      }
      return fs;
    },

    /** Sets textContent and hides the element when the value is empty. */
    text(el, value) {
      if (typeof el === "string") el = document.querySelector(el);
      if (!el) return;
      el.textContent = value ?? "";
      el.hidden = value === undefined || value === null || value === "" || value === false;
    },

    /** Sets an <img>'s source (see `src`) and hides it when there is none. */
    image(el, value) {
      if (typeof el === "string") el = document.querySelector(el);
      if (!el) return;
      const url = this.src(value);
      el.hidden = !url;
      if (url) el.src = url;
      else el.removeAttribute("src");
    },

    /** "Jane Cooper" → "JC" */
    initials(name) {
      return String(name || "")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || "")
        .join("");
    },

    /** Resolves once every <img> on the page has loaded (or failed). */
    async images() {
      await Promise.all([...document.images].filter((i) => !i.hidden && i.src).map((i) => i.decode().catch(() => {})));
    },
  };
}
