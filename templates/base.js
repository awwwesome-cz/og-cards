// Shared logic of the og-cards built-in templates. `ogCards` helpers come from the renderer.
window.ogBase = {
  /** Common card fields: accent, accent2, background, eyebrow, title, description, cta, site, logo, image. */
  apply(card) {
    const root = document.documentElement.style;
    if (card.accent) root.setProperty("--accent", card.accent);
    if (card.accent2) root.setProperty("--accent-2", card.accent2);
    if (card.background) root.setProperty("--bg", card.background);
    for (const id of ["eyebrow", "title", "description", "cta", "site"]) ogCards.text(`#${id}`, card[id]);
    ogCards.image("#logo", card.logo);
    ogCards.image("#image", card.image);
    const brand = document.querySelector(".brand");
    if (brand) brand.hidden = !card.logo && !card.site;
  },

  /** Photo or initials in an .avatar element. */
  avatar(el, name, photo) {
    if (typeof el === "string") el = document.querySelector(el);
    if (!el) return;
    el.innerHTML = "";
    if (photo) {
      const img = document.createElement("img");
      img.src = ogCards.src(photo);
      el.append(img);
    } else el.textContent = ogCards.initials(name);
    el.hidden = !name && !photo;
  },

  /** Five stars filled to `rating` (0–5). */
  stars(el, rating) {
    if (typeof el === "string") el = document.querySelector(el);
    if (!el) return;
    const star = (x) => `<path transform="translate(${x} 0)" d="M15 1.5l4.1 8.6 9.4 1.2-6.9 6.5 1.8 9.3L15 22.6l-8.4 4.5 1.8-9.3-6.9-6.5 9.4-1.2z"/>`;
    const row = (fill) => `<svg viewBox="0 0 170 30" fill="${fill}">${[0, 35, 70, 105, 140].map(star).join("")}</svg>`;
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    el.innerHTML = `${row("var(--star-empty, #d9dce3)")}<span class="stars-fill" style="width:${(r / 5) * 100}%">${row("var(--star, #f5a524)")}</span>`;
    el.hidden = rating === undefined || rating === null || rating === "";
  },

  /** Shrinks #title until it fits (max lines) and .main stops overflowing. */
  fitTitle(options = {}) {
    return ogCards.fit(document.getElementById("title"), {
      min: 40, maxLines: 3, container: document.querySelector(".main"), ...options,
    });
  },
};
