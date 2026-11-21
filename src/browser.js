// Helpers injected into the template page before it loads, available as `window.ogCards`.
// Kept as a plain function so it can be serialised by Playwright's addInitScript.

export function installBrowserHelpers() {
  window.ogCards = {
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
      await document.fonts.ready;
      const { min = 24, step = 2, maxLines = 3, container = null, property = "font-size" } = o;
      let fs = parseFloat(getComputedStyle(el).fontSize);
      const lh = () => o.lineHeight ?? (parseFloat(getComputedStyle(el).lineHeight) / fs || 1.2);
      const overflows = () =>
        (container && container.scrollHeight > container.clientHeight) || el.offsetHeight > fs * lh() * maxLines + 2;
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
      el.hidden = !value;
    },
  };
}
