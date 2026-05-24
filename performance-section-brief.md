# Build brief — `sections/performance.liquid`

A new homepage section: cinematic diptych with a floating stat card straddling the seam. Replaces the existing text-over-photo "TRAIN" treatment.

## Files to create

```
sections/performance.liquid                          ← NEW (this brief)
```

The section type `performance` is already wired into `templates/index.json` (see existing block) — all settings below match the JSON that is already there. **Do not rename the type or change the setting keys, or the template will break.**

---

## Layout — desktop (≥ 1024px)

Full-bleed two-column grid. Container is **not** wrapped in `.container-contained` — this section is intentionally edge-to-edge.

```
┌──────────────────────────────┬────────────────────────────────┐
│                              │                                │
│                              │   eyebrow                      │
│   PHOTO (left)               │   ─── TRAIN                    │
│   1.05fr                     │                                │
│   100vh-ish height           │   More air.                    │
│   editorial corner labels    │   Less effort.                 │
│       ┌────────────────────┐ │                                │
│       │ FLOATING STAT CARD │ │   subhead paragraph            │
│       │ navy, 340px wide,  │ │                                │
│       │ centered on seam   │ │   ───────────                  │
│       └────────────────────┘ │   01  Easier endurance —       │
│                              │   02  Cleaner air in —         │
│                              │   03  Calmer recovery —        │
│                              │                                │
│                              │   [Shop AIRA]  The science →   │
└──────────────────────────────┴────────────────────────────────┘
```

- Grid: `grid-template-columns: 1.05fr 1fr`. Min-height around `min(760px, 90vh)`.
- **Photo column** uses `section.settings.image_desktop` (responsive `image_tag`, `widths: '768,1280,1920,2400'`, `loading: 'lazy'`). `object-fit: cover`, full bleed.
- **Corner labels on photo** (positioned absolute):
  - Top-left: a 18px hairline + `Field · 01` in mono, 10.5px, cream 0.7, letter-spacing 0.16em, uppercase. 28px from edges.
  - Bottom-left: `Hatta · 04:42` (or whatever the photographer's slate reads — make this CMS editable as a single `image_caption` text setting). Mono 10.5px, cream 0.55, letter-spacing 0.14em, uppercase. 28px from edges.
- **Copy column**: padding `96px 88px 80px 132px`. Vertically centered (`justify-content: center`).
  - Eyebrow row: 24px orange hairline + `TRAIN` in mono, 11px, orange (`--color-highlight`), letter-spacing 0.22em, uppercase, weight 500. Gap 12px between hairline and label.
  - Heading: Satoshi, 64px, weight 400, line-height 1.0, letter-spacing -0.03em, navy. **Wraps "More air. / Less effort." across two lines** — explicit `<br>` after the first sentence.
  - Subhead: Nunito Sans 17.5px, line-height 1.65, copy color, max-width 38ch.
  - Benefits block: 1px cream-border top divider, then 3 rows of `grid-template-columns: 32px 1fr` (mono index + benefit text). Index is mono 11px orange 0.12em tracking. Text is Nunito Sans 15px, with the lead-in word bold navy followed by `— rest of sentence` in copy. Gap 14px between rows.
  - CTA row: orange primary button (`Shop AIRA`, padding 17×34, radius 10) + secondary text link `The science →` (Nunito Sans 14.5px, weight 500, navy, 1px navy bottom border).

### Floating stat card (the focal element)

Absolutely positioned at `left: 50%; top: 50%; transform: translate(-50%, -50%)`. **Straddles the seam between photo and copy column** — this overlap is the whole point of the section.

- 340px wide. Background `--color-main` (navy `#0A1A34`). Border-radius 6px. Padding `36px 38px 32px`.
- 1px `rgba(241,235,225,0.08)` border. Two-layer drop shadow: `0 32px 80px rgba(7,18,38,0.5), 0 8px 24px rgba(7,18,38,0.3)`.
- **Card header row** (flex space-between, 1px translucent cream divider below, 16px bottom padding, 20px margin-bottom):
  - Left: `Proof · 01` mono 10px, blue (`#9BB7D4`), 0.18em tracking, uppercase.
  - Right: `Peer-reviewed` mono 10px, cream 0.45, 0.14em tracking, uppercase.
- **Big number** (`{{ section.settings.stat_value }}` — currently "22%"). Split visually:
  - The numeric portion ("22") in Satoshi 84px, weight 400, cream, letter-spacing -0.03em, line-height 0.95.
  - The unit ("%") in Satoshi 36px, weight 400, blue (`#9BB7D4`), letter-spacing -0.02em.
  - Render this in Liquid by extracting the trailing non-digit characters from `stat_value`. If that's too fragile, add two separate settings (`stat_value_number` + `stat_value_unit`) and concatenate them in the prototype display — but on the live site keep the split sizes.
- Label: Satoshi 11px, weight 600, cream, letter-spacing 0.18em, uppercase, margin `12px 0 14px`.
- Supporting line: Nunito Sans 13px, line-height 1.6, cream 0.75.
- Footnote link: `{{ section.settings.stat_footnote_url }}` wrapping `{{ section.settings.stat_footnote }}` + external-link icon. Mono 10.5px, blue, 0.06em tracking, no underline, `display: inline-flex; gap: 6px`.

---

## Layout — mobile (< 768px)

Single column. The floating stat card now overlaps the seam between the photo and the copy block — same idea, vertical version.

```
┌────────────────────┐
│                    │
│   PHOTO (4:5)      │
│   full-bleed       │
│   corner labels    │
│                    │
│ ╔════════════════╗ │  ← stat card pulled up
│ ║ STAT CARD      ║ │     margin-top: -56px
│ ║ overlaps seam  ║ │     z-index: 2
│ ╚════════════════╝ │
│                    │
│   eyebrow          │
│   ─── TRAIN        │
│                    │
│   More air.        │
│   Less effort.     │
│                    │
│   subhead          │
│   ───────────      │
│   01  Easier...    │
│   02  Cleaner...   │
│   03  Calmer...    │
│                    │
│   [Shop AIRA]      │
│   The science →    │
└────────────────────┘
```

- Photo: `aspect-ratio: 4/5`, full-width. Same corner labels but slightly smaller (9.5px mono, top/bottom 16px from edges).
- Stat card: `margin-top: -56px`, horizontal padding `0 24px`, `z-index: 2`. Card itself: padding 28px / 28px / 24px, same navy + border + shadow as desktop. Number scales down: `22` at 64px, `%` at 28px.
- Copy block: padding `40px 24px 56px`. Heading drops to 40px, subhead 15.5px. Benefits block stays the same shape but with smaller index column (`24px 1fr`). CTA goes **full-width** on mobile; "The science →" sits below the button as a separate row.

---

## Schema — match the existing `index.json` settings exactly

The template already provides these. Build the schema so they bind 1:1:

```liquid
{% schema %}
{
  "name": "Performance",
  "tag": "section",
  "class": "shopify-section",
  "settings": [
    { "type": "header", "content": "Header" },
    { "type": "text",   "id": "eyebrow",     "label": "Eyebrow",     "default": "TRAIN" },
    { "type": "text",   "id": "heading",     "label": "Heading",     "default": "More air. Less effort." },
    { "type": "textarea","id": "subheading", "label": "Subheading" },

    { "type": "header", "content": "CTA" },
    { "type": "text", "id": "cta_label", "label": "CTA label", "default": "Shop AIRA" },
    { "type": "url",  "id": "cta_url",   "label": "CTA URL" },

    { "type": "header", "content": "Proof stat" },
    { "type": "text",     "id": "stat_value",         "label": "Stat value",         "default": "22%" },
    { "type": "text",     "id": "stat_label",         "label": "Stat label",         "default": "More efficient breathing" },
    { "type": "textarea", "id": "stat_supporting",    "label": "Stat supporting line" },
    { "type": "text",     "id": "stat_footnote",      "label": "Footnote (source)",  "default": "Dallam et al., 2018" },
    { "type": "url",      "id": "stat_footnote_url",  "label": "Footnote URL" },

    { "type": "header", "content": "Image" },
    { "type": "image_picker", "id": "image_desktop",  "label": "Desktop image" },
    { "type": "image_picker", "id": "image_mobile",   "label": "Mobile image (optional, defaults to desktop)" },
    { "type": "text",         "id": "image_caption",  "label": "Image caption (slate)", "default": "Hatta · 04:42" },
    { "type": "text",         "id": "image_marker",   "label": "Image top-left marker", "default": "Field · 01" }
  ],
  "blocks": [
    {
      "type": "benefit",
      "name": "Benefit",
      "limit": 3,
      "settings": [
        { "type": "text", "id": "lead", "label": "Lead-in word" },
        { "type": "text", "id": "text", "label": "Benefit text" }
      ]
    }
  ],
  "presets": [{ "name": "Performance" }]
}
{% endschema %}
```

### Important — schema migration for the benefit blocks

The existing JSON in `templates/index.json` has these block settings:
```
"benefit_1": { "settings": { "icon": "", "text": "Easier endurance — an open airway means less breathing effort..." } }
```

The new schema splits each benefit into `lead` (bold word, e.g. "Easier endurance") + `text` (rest of sentence, e.g. "less breathing effort on long, steady efforts"). Two options:

1. **Migrate the JSON**: update `templates/index.json` block settings to use `lead` + `text` keys with the values split. Cleanest.
2. **Render-time split**: keep the existing single `text` setting; in the Liquid, take the substring before the first ` — ` as the lead, rest as the text. Lossy if the dash is missing — prefer option 1.

Go with option 1. Update `templates/index.json` in the same commit.

---

## Design tokens (use existing CSS variables / Tailwind classes)

| Role | Value | Token |
|---|---|---|
| Section bg | `#F1EBE1` cream | `--color-secondary` / `bg-secondary` |
| Stat card bg | `#0A1A34` navy | `--color-main` / `bg-main` |
| Stat card body text | `rgba(241,235,225,0.75)` | — |
| Eyebrow + index numerals | `#FF4000` orange | `--color-highlight` / `text-highlight` |
| Card header label + unit + footnote link | `#9BB7D4` blue | use directly (already in palette as tertiary-light) |
| Heading | `#0A1A34` navy | `--color-main` |
| Copy | `#40464F` | `--color-copy` |
| Divider on cream | `#E6DFD2` | `--color-border` |

Headings = Satoshi 400 (`font-heading heading-weight` per the existing codebase). Body = Nunito Sans (default). Mono labels = JetBrains Mono — load once globally if not already; otherwise fall back to system mono and accept the metric shift.

---

## Behavior

Static. No JS required. The CTA links use `<a>` if the template's CTA pattern is a link; the existing `snippets/cta-button.liquid` can be reused for the primary button — pass `variant: 'accent', size: 'lg'`.

## Accessibility

- Heading is `<h2>`. The eyebrow/labels are `<p>` or `<span>`, never headings.
- Image alt text: read from `section.settings.image_desktop.alt`. Provide a sensible fallback (e.g. `section.settings.heading`).
- Footnote link uses real `<a href>` with the URL setting — keep the external-link icon as an inline SVG decoration with `aria-hidden="true"`.
- The stat card's `Proof · 01` and `Peer-reviewed` labels are decorative; they don't need to be semantic content.
- Tap targets ≥ 44px on mobile: primary CTA is already 16px padding × 14.5px font; verify after build.

## Responsive breakpoints

- `≥ 1024px` — desktop diptych as described.
- `768–1024px` — same diptych but: photo column collapses to `1fr 1fr`, copy column inner padding shrinks (`64px 48px 64px 64px`), heading to 52px, stat card width 300px. Card stays floating on the seam.
- `< 768px` — mobile stack (see above).

## Reference

Working prototype: `Aira Explorations.html` → section **"Train — Option C, refined + mobile"**. Both desktop and mobile artboards are there; the source is `explorations-app.jsx`, components `TrainDiptychRefined` (desktop) and `TrainDiptychMobile` (mobile).

The prototype uses inline styles for clarity — translate to the codebase's existing Tailwind/utility class conventions where they exist (e.g. `bg-main`, `text-highlight`, `font-heading`, the `cta-button` snippet) rather than re-inventing them.
