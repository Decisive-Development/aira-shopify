# Handoff: aira — "Backed by science" (research book)

## Overview

This is the design handoff for the **/pages/backed-by-science** page, redesigned as a **bound research book on a desk**. Every "Research backed" badge on the PDP and homepage links here, so this page carries the trust of the whole site.

The concept: the page IS the evidence. A small cloth-bound book (brand tan cover, orange spine) sits on a navy desk. Each page inside is **one peer-reviewed study** — headline, approved finding, a schematic figure (graph or table), and the full citation. The reader flicks through it like a physical object: pages turn in 3D around the spine, drag a page and it bends with the pointer, turned pages pile up on the left while the unread stack on the right thins out.

There is deliberately **no marketing furniture** — no proof chips, no benefit sections, no breathing widget. One quiet "Get my kit" appears on the closing page only. The honesty boundary lives in the closing small print.

## About the Design File

The file in this bundle is a **design reference created in plain HTML/CSS/JS** — a working prototype of look, content, and behaviour. It is framework-agnostic (vanilla JS, ~150 lines) and close to drop-in for a Liquid template.

Your task is to recreate this in the aira Shopify theme as a dedicated page template (e.g. `templates/page.backed-by-science.json` + one custom section), using theme tokens and the theme's font pipeline.

## Fidelity

**High-fidelity.** Colours, typography, page mechanics, figures, and copy are locked. Copy is **legally locked** (see Claims law below) — do not paraphrase study findings or titles. The only open slot is the closing CTA's URL.

## Files in this bundle

```
design_handoff_science/
├── README.md                       ← you are here
└── designs/
    ├── Backed by Science.html      ← full prototype (open in a browser)
    └── assets/
        ├── satoshi-variable.woff2      ← display / heading font
        └── nunito-sans-variable.ttf    ← body font
```

Fonts are bundled so it renders standalone; in production load them from the theme's existing webfont setup — do not re-bundle.

A phone-framed preview also exists in the design project (`Backed by Science Mobile (Framed).html`) — same file in an iPhone 390×844 frame.

---

## The scene

- Full-viewport, `overflow: hidden`. Desk background = navy gradient stack (blue radial top, faint orange radial bottom, `#0A1A34 → #0c2044 → #081228`).
- Fixed masthead: `✭ aira` top-left, `BACKED BY SCIENCE` top-right, cream, Satoshi.
- The book: portrait sheet, `height = min(74vh, 640px)`, `width = height × 0.75` (capped `88vw`). On desktop the whole book is shifted right by half a page width (`.shift`) so the open book reads centred; the shift is removed ≤980px.
- Desk shadow: soft radial ellipse under the book.
- Page stacks: 7px striped edges (`repeating-linear-gradient`, paper tones) absolutely positioned either side. JS scales `stackR` by remaining pages and `stackL` by read pages every turn (`scaleX`, min 0.15 / 0.001).
- A hint line ("Flick, tap the page edge or use your arrow keys") floats **below the book, outside the sheets** (never inside — it gets clipped), visible only while the cover is showing (`.bookwrap[data-oncover] .book-hint`).

## Book mechanics (the signature)

Each `.sheet` is a full-size absolutely-positioned card with a `front` and `back` face (`backface-visibility: hidden`, back pre-rotated 180°). Turning = `rotateY(0 → -180deg)` with `transform-origin: left center`, transition `1s cubic-bezier(.65,.05,.18,1)`, inside a `perspective: 3000px` wrapper.

- **Z-index rule:** unturned sheets stack `n - i`, turned sheets `i + 1`; the currently-turning sheet gets a temporary boost (`2n + 2`) for ~1.05s so it sweeps above everything.
- **Drag-to-bend:** pointer-drag rotates the active sheet live (`deg = dx × 0.45`, clamped −180…0, transition disabled during drag). On release: commit past ~38° (forward) / ~-142° (backward), else spring back. A 300ms `justDragged` guard stops the click handler double-firing.
- **Click:** right half of the book = next, left half = prev (ignored on buttons/links).
- **Keyboard:** ← → / PageUp PageDown / Space / Home / End.
- **Pager (bottom, fixed):** prev/next round buttons + one tick per sheet (orange = current, `scaleY(1.25)`) + label `Study 03 of 07 · Ulfberg 1997`. Frosted navy pill (`backdrop-filter: blur(12px)`).
- **Contents page:** each row is a button jumping straight to its study.
- **Persistence:** current page index in `localStorage` (`aira-research-page`).
- **Back faces:** ghost numeral of the next page (huge, 3.5% ink) + footer `AIRA · BACKED BY SCIENCE` — visible mid-turn, so blank backs never flash.

## Page inventory (10 sheets)

| # | Sheet | Face content |
|---|---|---|
| 0 | Cover | Tan cloth (`#F7F1E6 → #F1EBE1 → #EBE1CD`), dark ink text, orange bound spine (12px gradient strip with shadow). Title: "The evidence, *bound.*" (accent word orange). Meta: orange rule, `7 PEER-REVIEWED STUDIES`, `1995 TO 2018`. |
| 1 | Contents | "7 studies on the nose at night." + 7 clickable rows (number · title · year), footer note. |
| 2 | Study 01 · Lundberg 1995 | "Your sinuses make nitric oxide." + **Table 1** (breathing route vs sinus NO: nose = carried into the airway, mouth = bypassed entirely). |
| 3 | Study 02 · Young 1997 | "Blocked noses make for tired days." 2.4x count-up in the lead. **Fig. 1** vertical bars, clear vs blocked, 2.4x annotation. |
| 4 | Study 03 · Ulfberg 1997 | "The people who really judge snoring: partners." **Fig. 2** night 1 vs night 14 bars, "rated quieter". |
| 5 | Study 04 · Roithmann 1998 | "It works even when the septum doesn't." **Fig. 3** no-dilator vs with-dilator bars, "airflow up". |
| 6 | Study 05 · Krakow 2006 | "The gold standard: a randomised trial." **Fig. 4** rising line, week 0→4. |
| 7 | Study 06 · Dallam 2018 | "Trained noses run more efficiently." 22% count-up in the lead. **Fig. 5** mouth vs nose ventilation bars, −22%. |
| 8 | Study 07 · Al Shaikh 2018 | "This is not a faraway problem." **Fig. 6** horizontal proportion bars: adults who snore (1 in 3, orange), snorers at high apnoea risk (nearly half, blue). |
| 9 | Closing | "Keep the nose open, and the night improves." through-line paragraph, `Get my kit` (orange, Press hover), "Free shipping across the UAE. 30-night guarantee.", medical-boundary small print. |

Every study page footer = full academic citation, hairline-ruled, 10.5px.

## Figures — rules

- **Static only. No animated illustrations.** Figures are schematic graphs (SVG) or an HTML table — axes labelled (Satoshi 600, ink 55%), captioned `Fig. n` / `Table 1`, always ending "schematic".
- Palette: data-primary orange `#FF4000` (0.9), comparison blue `#9BB7D4` (0.55), axes/labels ink `#16223A` at 40–70%.
- The only in-page motion: the two `.count` spans (2.4x, 22%) count up over ~1.1s when their page arrives (cubic ease-out, `requestAnimationFrame`). Disabled under reduced motion.
- Do not redraw figures with real data axes/values — the studies' licensed figures are not ours to reproduce; these are deliberately schematic and the closing note + contents footer say so.

## Design tokens

```
--navy   #0A1A34   desk, spine text, cover ink        (theme bg-main)
--cream  #F1EBE1   masthead, pager text, cover tan     (theme secondary)
--paper  #FBF7EF → #F4EDDF   page faces (warm paper gradient + spine-side shading)
--orange #FF4000   spine, study numbers, data-primary, ticks, CTA  (theme highlight)
--blue   #9BB7D4   comparison data, contents years     (theme tertiary-light)
--ink    #16223A   page text (70% body, 55% captions, 12% rules)
```

Typography: Satoshi (headlines 500, kickers/numbers 600–700, all caps kickers with 0.14–0.22em tracking), Nunito Sans (leads, cite lines, table cells). Page headline `clamp(20px, ph×0.042, 28px)`; lead `clamp(13px, ph×0.024, 15.5px)`.

CTA: theme `cta-button` snippet, `variant: 'shop'`, Press hover (translateY 1px, brightness .96, tight orange shadow).

## Claims law (binding — from the brand copy standards)

- Every finding is phrased **exactly** as shipped in this file; the approved phrasings come from the claims register. Never "stops snoring", never "breathe less", never a percentage on the nitric-oxide line, never "fixes/treats" a septum, "a UAE study" not "X% of UAE adults".
- Study titles in citations keep their **original published spelling** ("randomized", "sleep apnea", the "Breathe Right" brand name in Ulfberg's title) — altering them breaks verifiability.
- Body copy: UK English (apnoea, randomised), "aira" lowercase and never sentence-initial, sentence case headings, no em-dashes, no exclamation marks, numerals always.
- The closing small print (mechanical support, not medical treatment + "figures are schematic") must ship with the page.

## Accessibility

- Figures are `aria-hidden` decoration; the finding is carried by the lead sentence text. The table (Study 01) is a real `<table>`.
- All navigation is real `<button>`s with labels ("Go to page n", study titles on ticks); pager arrows disable at the ends.
- Keyboard covers the full flow; drag and click are additive.
- `prefers-reduced-motion`: page turns become instant (`.01s`), count-ups render final values, stack transitions off.
- Contrast: ink-on-paper and cream-on-navy pass AA at the sizes used.

## Without JS

The book renders showing the cover; navigation requires JS. For the Shopify port add a `<noscript>` fallback: a plain stacked list of the 7 studies (headline + finding + citation) and the closing note — content-complete, unstyled mechanics.

## Responsive

- `--ph` drops to `min(72vh, 620px)` ≤640px; page label and masthead subtitle hide; the desktop half-page shift is removed ≤980px so the book centres.
- All page type scales from `--ph` via clamp, so no per-breakpoint text work.
- Touch: horizontal drag turns pages (`touch-action` default); commit thresholds as above.

## What's NOT in this handoff

- **Routing/template** — wire as `templates/page.backed-by-science` in the theme; keep the slug (badges across the site link to it).
- **SEO shell** — title tag "The science of nasal breathing, backed by research | aira" and meta description are in the file `<head>`; carry them over.
- **Analytics** — suggested events: page-turn depth (furthest sheet reached), contents jumps, closing CTA click.
- **The retired versions** — the scroll page and magazine prototype live in the design project for reference (`Backed by Science (scroll).html`, `(magazine).html`); this book supersedes both.
