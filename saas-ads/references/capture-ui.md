# Capturing the real UI

## Why plates
Screenshots of the real product, captured at 2.5–4× pixel density, stay sharp when the camera pushes in 2× on a single card, and they carry the product's real typography and spacing. Element rectangles captured at the same time let scenes crop a card, lift a row, put a ring around a button or move the cursor to the exact pixel.

## Steps
1. **Get a safe copy of each page.** Prefer a local or staging build with demo data. If only production with real data exists, save each page's HTML with its CSS and replace personal data (names, emails, avatars, grades) before capturing, or inject masking CSS/JS through the capture config. Never send real personal data anywhere, and never put it in the video.
2. **Mark elements** you will animate with `data-promo="key"` attributes in the saved HTML, or list CSS selectors in the config.
3. **Write a config** (`plates.config.json`):
   ```json
   {
     "out": "public/plates",
     "ts": "src/plates.ts",
     "viewports": {
       "desktop": {"width": 1600, "height": 900, "scale": 2.5},
       "mobile": {"width": 412, "height": 700, "scale": 4, "fullPage": true}
     },
     "pages": [
       {"name": "dashboard", "url": "file:///abs/path/dashboard.html",
        "selectors": {"sidebar": "aside", "stats": ".stats"},
        "css": ".cookie-banner{display:none}"}
     ]
   }
   ```
4. **Run** from the Remotion project (it uses Remotion's bundled Chrome, or `CHROME=/path`):
   ```bash
   node <skill>/scripts/capture-plates.mjs plates.config.json
   ```
   Output: `public/plates/<viewport>-<page>.jpg` and `src/plates.ts` exporting `PLATES[viewport][page] = {src, w, h, rects}` in CSS pixels.
5. **Keep plates out of git** if they come from a real deployment (add `public/plates` and `src/plates.ts` to `.gitignore`).

## Using plates
- `<Plate plate={PLATES.desktop.dashboard} r={rect} />` crops any rectangle; `r = {x:0, y:0, w, h}` shows the page.
- Positions inside plates are in CSS pixels of the capture viewport; read a plate image to place overlays, converting from the displayed size.
- Pages that were not captured can be drawn in the product's colours inside the real page frame: fill the main area with the page background, patch the sidebar's active item and the breadcrumb, then lay out cards in page coordinates.
