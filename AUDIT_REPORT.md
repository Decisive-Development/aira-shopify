# aira theme — code audit (2026-06-28)

Audited against `CLAUDE.md` and `.claude/rules/copy.md`. **Proposal only — nothing changed.**
Evidence gathered by script across all 72 sections, 14 snippets, templates and layout; every suspect verified by reading, not assumed.

## Summary

Better shape than the brief history suggested. Snippet reuse is genuinely good, there is zero `{% include %}`, and every `<img>` has alt text. The real work is **dead code** (~10 unused sections, ~2,280 lines), **token drift** (30 files hardcode hex), one **confusingly mirror-named pair**, and a few **copy-casing** slips. Nothing is on fire; all of it is cleanup that turns the gate green.

## Wins (already compliant)

- 0 `{% include %}` — everything uses `{% render %}`.
- 0 `<img>` without `alt`.
- Strong shared-snippet discipline: `cta-button` (40 renders), `section-heading` (13), `cta-banner`, `image`, `product-card`.

## HIGH

### H1. Unplaced sections — built but not on any page (verify intent, NOT auto-dead)

10 section files are referenced by no template, group, or tag. **But "unreferenced" is a weak dead-code signal in this repo: it builds sections ahead and places them later** — two carry their own "OPTIONAL — fills at launch" comments. Verified per section (2026-06-29):

**Keep — deliberate:**
- `science-clinical-claims` (138) and `science-medical-advisor` (172) — comments say "fills at launch".
- `product-features-grid` (184), `how-it-works-pitfalls` (121), `how-it-works-pro-tips` (84) — committed 2026-06-28, active WIP.

**Moved to `/for-delete` (staged, recoverable, pending a final live-theme check):**
- `judgeme-reviews` (319) — superseded Judge.me styling; Judge.me is live via the app embed + `custom-reviews`.
- `trust-bar` (491) — trust is shown via `trust_badge` blocks instead.
- `health-effects` (510) — science content, not on the science page.
- `aira-difference` (133) and `cross-sell` (128) — unplaced.

Lesson for the audit method: never treat "not referenced" as "dead" in this repo without checking intent (last-commit date, in-file comments, app-served features like Judge.me).

### H2. Mirror-named pair — both live, not dead

`science-nasal-breathing.liquid` ("Science — Nasal") and `nasal-breathing-science.liquid` ("Science — Nestor citation") are **both** on `page.backed-by-science.json`. They are different sections, so the fix is **rename for clarity**, not delete. The "one is dead" line in `CLAUDE.md` §9 is therefore inaccurate and should be reworded (I'll do it alongside the fixes).

**Recommend:** rename to function-describing names, e.g. `science-nasal-mechanism` and `science-nestor-citation`.

### H3. CTA casing ("Add to Cart" → "Add to cart")

Per the settled sentence-case rule. Live occurrences:

- `sections/product-refill.liquid:229, 344`
- `snippets/cart-drawer.liquid:192, 195`
- `snippets/product-card.liquid:209`
- `sections/collection.liquid:124` ("Add to Cart" and "Sold Out" → "Sold out")
- `sections/cross-sell.liquid:48` (resolved if H1 deletes it)

`product.liquid` is already correct.

## MEDIUM

### M1. Token drift — 30 files hardcode hex

Worst live offenders: `custom-reviews` (47), `social-proof` (9), `benefits-slider` (9), `comparison-table` (8), `benefits-grid` (8). Off-palette colours not in the token set: `#D4A853` (gold), `#40464F` (grey), plus hardcoded Tailwind greys (`#6b7280`, `#4b5563`, `#9ca3af`).
**Recommend:** replace with token utility classes / `var(--color-*)`. Decide the gold (a star-rating colour?) and the greys: add to the token set if intentional, otherwise map to existing tokens.

### M2. Oversized sections

`custom-reviews` is **1,616 lines** in a single file (with 47 hardcoded hex). Also `product` 852, `product-refill` 702, `benefits-slider` 572.
**Recommend:** extract repeated markup from `custom-reviews` into snippets — it's the biggest live maintainability liability.

### M3. Heading snippet not reused

20+ sections render their own `<h1>/<h2>` instead of `section-heading`.
**Recommend:** migrate to `section-heading` where the structure fits (eyebrow + heading); leave bespoke hero and PDP headers alone.

## LOW

### L1. Raw buttons (11 files) — mostly legitimate

Native `<button>` / link-buttons in `header`, `search`, `password`, `faq`, `faq-categories` (toggles and forms) are correct. Review only the CTA-style ones for `cta-button`: `benefits-slider` and `how-it-works-hero` (and `health-effects`, dead, resolved by H1).

## False positives (not issues)

- **"behavior" (8+ hits):** all JS/CSS scroll API (`scroll-behavior`, `behavior: 'smooth'`). Code, not copy. Correct as-is.
- **Em-dash / arrow (390 raw hits):** overwhelmingly inside `{%- comment -%}` blocks and section descriptions, which don't ship.

## Proposed order of work (turns the gate green)

1. **Delete the ~10 dead sections** (after the live-theme check). Biggest win; also removes a chunk of M1.
2. **Rename the science pair** and correct the `CLAUDE.md` §9 note.
3. **Fix CTA casing** (5 live spots once H1 is done).
4. **Tokenise hardcoded hex** in the surviving live sections; resolve the off-palette colours.
5. **Refactor `custom-reviews`** into snippets when there's time.
6. **Flip the gate to enforcing** (remove `continue-on-error`, run the rule check with `STRICT=1`, fail the `critical.css` diff) once 1–4 are clean.

Each of 1–4 is a small, single-purpose change. Nothing here is urgent.
