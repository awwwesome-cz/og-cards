# Your own template

Don't want a [built-in template](built-in-templates.md)? A template is a plain HTML file, sized to the image
(1200 × 630 by default), that defines **`window.renderCard(card)`**. og-cards opens it in Chromium, calls
`renderCard` with the card returned by your `card()` function, waits for web fonts and images and takes a screenshot.

The `card` object is entirely yours – og-cards never looks inside it. It only has to be JSON-serialisable.

## Start from a built-in template

The easiest way: copy the built-in templates into your project and edit the one you like.

```bash
mkdir -p og
cp -r node_modules/@awwwesome-cz/og-cards/templates/. og/
```

```js
// og.config.js
export default defineConfig({
  template: "og/article.html",   // your copy – edit freely
  watch: ["og/base.css", "og/base.js"],
  card: (page) => ({ title: page.title, author: page.author }),
  // …
});
```

`base.css` and `base.js` hold what all built-in templates share (font, avatar, stars, title fitting); `fonts/` has
the Inter font. Delete the templates you don't need.

## Start from scratch

## Example

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  /* paths are relative to the template file */
  @font-face { font-family: Brand; src: url("fonts/brand.woff2") format("woff2"); font-weight: 100 900; }

  html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
  body { box-sizing: border-box; padding: 64px; display: flex; flex-direction: column;
         font-family: Brand, sans-serif; background: #111; color: #fff; }
  .main { flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 0; }
  h1 { font-size: 80px; line-height: 1.05; margin: 0; }
  [hidden] { display: none !important; }
</style>
<script>
  window.renderCard = async (card) => {
    document.body.style.background = card.color || "#111";
    ogCards.text("#kicker", card.kicker);   // sets the text, hides the element when empty
    ogCards.text("#title", card.title);
    // shrink long titles until they fit in 3 lines and .main stops overflowing
    await ogCards.fit(document.querySelector("#title"), { min: 40, maxLines: 3, container: document.querySelector(".main") });
  };
</script>
</head>
<body>
  <div class="main">
    <p id="kicker"></p>
    <h1 id="title"></h1>
  </div>
  <img src="logo.svg" alt="" width="160">
</body>
</html>
```

## Helpers (`window.ogCards`)

Injected by the renderer before your template loads. The renderer also waits for all `<img>` elements to load before the screenshot.

| Helper | What it does |
|---|---|
| `ogCards.text(elOrSelector, value)` | Sets `textContent`; hides the element (`hidden`) when the value is empty. |
| `ogCards.image(imgOrSelector, value)` | Sets an `<img>` source from a card field (resolved like `src`); hides it when empty. |
| `ogCards.src(value)` | URL for an image from a card: relative paths → project root, `/…` → `publicDir`, URLs unchanged. |
| `await ogCards.fit(el, options)` | Shrinks the font size until `el` fits `maxLines` lines and `container` stops overflowing. Returns the final size. |
| `ogCards.initials(name)` | `"Jane Cooper"` → `"JC"` (for avatars without a photo). |

`fit` options:

| Option | Default | |
|---|---|---|
| `min` | `24` | Smallest font size in px. |
| `step` | `2` | How much to shrink per step (px). |
| `maxLines` | `3` | Maximum number of lines. |
| `lineHeight` | from CSS | Line-height factor used to count lines. |
| `container` | – | Element that must not overflow (e.g. the main column). |
| `property` | `"font-size"` | What to set – or a custom property like `"--fs"` if your CSS uses `font-size: var(--fs)`. |

You don't have to use the helpers – plain DOM code works the same.

## Tips

- **Designing:** the quickest loop is a one-page config that renders your test card: `npx og-cards` and open the
  image. Or open the template in a browser and call `renderCard({ … })` from the dev tools – the `ogCards` helpers
  exist only during rendering, so stub the ones you use.
- **Load everything locally** (fonts, logos, background images) – files next to the template, referenced with
  relative paths. No network is used and the output is the same on every machine.
- **Don't rely on system fonts** – a Mac and a Linux CI runner have different ones. Ship the font files.
- **Template changes re-render everything.** Its fingerprint is part of every card's fingerprint. Add fonts,
  images and CSS files to `watch` so changing them does the same.
- **Pin Playwright** in your project (`"playwright": "1.63.0"`) if you commit images, so they don't change
  between machines just because Chromium was updated.
- **Different looks for different pages:** put a field such as `layout: "post"` into the card and switch on it in
  the template (e.g. `document.body.dataset.layout = card.layout` and style `body[data-layout="post"]`).

## Keeping your design private

Your template, fonts and logos never have to leave your project – og-cards on npm only contains the engine and
the plain default template.

To share one design between several of your own projects, publish the template folder as a **private** package
(GitHub Packages, a private npm scope or a git dependency) and point `template` at it:

```js
template: "node_modules/@my-company/og-theme/template.html",
watch: ["node_modules/@my-company/og-theme/package.json"], // new theme version → re-render
```
