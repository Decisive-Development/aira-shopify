# Kit PDP speed brief: handoff note (8 September 2026)

Brief: `Brief.txt` (AIRA kit PDP speed brief, 8 Sep). Page: `/products/aira-kit`.
Status: **seven commits on `main`, local only. Nothing pushed, deployed or tagged.** Brief.txt itself is untouched.
Every brief fact was checked against the repo and the live page before anything changed; the deviations are listed with their evidence below, and Tom signed off the three judgement calls on 8 Sep.

## Commits

| Commit | Brief section |
|---|---|
| `bfdca6e` Lazy-load section videos and drop the 1080p renditions | A |
| `9ec6cfc` Prioritise and size the product hero image | B |
| `381a395` Inline critical CSS, preload the real fonts, drop Work Sans | C |
| `09bcdfd` Keep the generated stylesheet out of Tailwind's scan | C (follow-up) |
| `58d89d6` Add async decoding and real sizes to below-the-fold images | E |
| `f22f6ae` Meet AA contrast on eyebrows, sticky bar and small labels | F |
| this commit: Add the PDP speed handoff note | D |

## Before you push (Tom)

1. `shopify theme pull --live` for `templates/*.json`, `sections/*.json` and `config/settings_data.json`, then commit the sync.
2. Deploy with `shopify theme push --live --allow-live --nodelete --only <files>`. A push is not atomic, so files that other files depend on go in a first batch:
   - Batch 1 (new files nothing yet references): `assets/lazy-video.js snippets/lazy-video.liquid snippets/critical-css.liquid snippets/css-variables.liquid assets/nunito-sans-variable.woff2`
   - Batch 2 (everything else): `layout/theme.liquid layout/password.liquid templates/gift_card.liquid config/settings_schema.json sections/product.liquid sections/benefits-slider.liquid sections/benefits-grid.liquid sections/before-after-slider.liquid sections/custom-reviews.liquid sections/footer.liquid sections/scratch-offer-popup.liquid sections/ugc-gallery.liquid snippets/ugc-card.liquid snippets/section-heading.liquid`
   - Do not push `assets/critical.css`: it is now a build intermediate and sits in `.shopifyignore`.
3. `--nodelete` leaves `assets/critical.css` and `assets/nunito-sans-variable.ttf` on the live theme. Delete both in the admin code editor after batch 2 is live; nothing references them.
4. Run PageSpeed Insights (mobile) after the push and fill in the table below. For a per-section reading, push batch 1 plus each section's files in commit order and run PSI between pushes.
5. Tag `v1.1-pdp-speed` on sign-off.

| Run | Perf | FCP | LCP | TBT | CLS | SI | Requests | Media on load |
|---|---|---|---|---|---|---|---|---|
| Baseline, 8 Sep 15:47 BST | 74 | 2.1 s | 5.9 s | 180 ms | 0 | 2.5 s | 352 | ~138 MB |
| After A | | | | | | | | |
| After B | | | | | | | | |
| After C | | | | | | | | |
| After E | | | | | | | | |
| After F | | | | | | | | |

Targets after A to D: Perf 90 or more, LCP 2.5 s or less, TBT 200 ms or less, CLS 0, requests 150 or fewer, media on load 0 bytes.

## Post-push checks that could not run locally

Rendering needs a store, and `theme dev --theme-editor-sync` hot-deploys every save to the live theme, so none of these ran. In DevTools on the live page, mobile emulation, Slow 4G, cache disabled:

- Network filter Media: zero requests before any scroll. Scroll to the benefits slider: one request at 720 px or under (plus the `.m3u8` playlist on Safari). Scroll to the UGC gallery: three requests, each the smallest rendition. Every video shows its poster first.
- The hero image request starts before any third-party script, comes from the `Link: rel=preload` response header, and is not duplicated. PSI "LCP request discovery" should pass all three checks. If "discoverable in initial document" still fails, the fallback is a `<link rel="preload">` at the top of `<head>` built from one captured srcset string; ask for it.
- Rendered `<head>`: no `worksans`, two font preloads (`satoshi-variable.woff2`, `nunito-sans-variable.woff2`), no `critical.css` request, `<meta charset>` within the first few hundred bytes, text visible while fonts load.
- Homepage and `/products/aira-refill-tabs` render the same benefits-slider and UGC gallery sections, so the video change applies there too; check they still play when scrolled into view and CLS stays 0.
- iOS Safari and Android Chrome: gallery thumbnails, videos (muted autoplay in view, tap to play under Low Power Mode or data saver), sticky bar, popup.

## What the audit got wrong, with evidence

| Brief | Reality | What was done |
|---|---|---|
| A3: the UGC videos come from a URL or text setting; convert it to `video` and re-select three files | `snippets/ugc-card.liquid` reads a metaobject **file_reference video** (`entry.video.value`). `.sources` and `.preview_image` were always available; `.sources.last.url` was what picked the 1080p file | No setting change. **Nothing for Tom to re-select.** |
| B: hero master is 2304 by 2304 | The CDN original `product-1.png` is **1080 by 1080** RGB PNG (525 KB); `?width=1200` returns the 1080 file. `image_tag` does not cap srcset at the natural width (a 794 px image on the page carried an 800w candidate) | srcset candidates are 480, 640, 832, 1080. Raise the top width if a larger master is uploaded |
| B1: `loading="true"` | Root cause was `loading: forloop.first \| default: false,` in `sections/product.liquid`: the pipe split the filter chain, so `class`, `widths`, `sizes` and `alt` never reached `image_tag`. The hero shipped the default 352/832/1200 srcset with no `sizes`, and items 2 to 8 had no `loading` at all (eager) | Pipe removed; two branches, first item eager and preloaded, the rest lazy |
| B3: hand-written `<link rel="preload">` matching the `<img>` byte for byte | `image_tag` has `preload: true`, which sends a `Link` HTTP header with the same `imagesrcset` and `imagesizes` | Used that instead; one candidate list, nothing to keep in sync |
| B4 and E3: `format: 'pjpg'` on photo PNGs | Shopify's CDN already serves WebP to browsers: the hero at width 1200 is 40.6 KB. Adding `format=pjpg` switches the CDN to JPEG, 93.8 KB. The 525 KB PNG figure only appears for non-browser requests | **Skipped** (Tom, 8 Sep) |
| C1: `inline_asset_content` | Shopify caps that filter at 15 KB; critical.css was 114 KB | The build minifies the CSS and writes it into `snippets/critical-css.liquid`, rendered inside `<style>` by all three layouts (Tom, 8 Sep). 78 KB raw, roughly 13 KB compressed, on every HTML response; cross-page CSS caching is given up, which is the right trade for an ad landing page |
| C3: preload Nunito Sans as woff2 | The asset was a 569 KB TTF carrying four variable axes (weight, width, optical size, YTLC) plus Cyrillic and Vietnamese. A straight woff2 conversion is 208 KB | Shipped as **38 KB**: Latin ranges, weight axis 200 to 1000 kept, the three axes the theme never sets pinned to their defaults (Tom, 8 Sep) |
| D2: three gtag script tags, list the sources | The theme contains no gtag, GTM or dataLayer code. All three loads come from **one** source, the Google and YouTube channel web pixel (id 3943596414), which carries `G-HBCPR72K8D`, `GT-K8HBK7NP` and `MC-XEWQQRXCK0` and loads gtag.js once per id | Nothing to remove theme-side |

## A. Videos

- New `snippets/lazy-video.liquid` renders every `<video>`: poster from `preview_image`, `muted loop playsinline preload="none"`, no `autoplay` attribute, sources in `data-src`. HLS playlist first, then one mp4 chosen by the short side of the frame, never by filename. `quality: 'full'` takes the largest mp4 at 720 or under (benefits slider, product gallery, UGC lightbox); `quality: 'card'` takes the smallest (UGC tiles). The 1080p rendition is never emitted.
- New `assets/lazy-video.js` (3.5 KB, deferred, loaded on every page like the modal script): an IntersectionObserver with a 200 px root margin hydrates and plays, pauses on leave, pauses on tab hide and resumes what was in view, honours `navigator.connection.saveData` (poster and tap to play), and arms the same tap-to-play if `play()` is refused (iOS Low Power Mode). No JS: poster only. `window.airaLazyVideo.activate()` is what the product gallery calls when a thumbnail reveals a hidden video.
- Callers rewritten in place: `sections/benefits-slider.liquid` (its own play/pause observer deleted), `snippets/ugc-card.liquid` (tile and lightbox template), `sections/product.liquid` gallery. `sections/how-it-works-hero.liquid` is untouched: its videos never autoplayed and it is not on the PDP, but its cover video still carries `preload="metadata"`; a follow-up if that page is audited.
- Greps: `autoplay` in executing code now only appears as `allow="autoplay"` on the two review lightbox iframes in `sections/custom-reviews.liquid` (user-initiated, unchanged). `1080p` matches only the pre-existing `max-w-[1080px]` in `sections/policy-content.liquid`. `sources.last`: 0.

## C. Head, fonts and CSS

- Head order is now: meta-tags (charset, viewport, title, SEO), two font preloads via `preload_tag`, css-variables (with both `@font-face` declarations, moved out of critical.source.css because a relative `url()` breaks once the CSS is inlined and `asset_url` makes the preload URLs match), inline critical CSS, deferred scripts, favicons, the Judge.me scroll patch, `content_for_header`.
- Work Sans is gone: the preconnect to `fonts.shopifycdn.com`, both preloads, four `font_face` declarations, the `--font-primary-*` variables (no consumer) and the `type_primary_font` setting group in `config/settings_schema.json` (no value in settings_data, so nothing to migrate).
- Build: `npm run build:css` now runs Tailwind with `--minify` and then `scripts/build-critical-snippet.js`; `npm run watch:css` keeps both in step. `assets/critical.css` stays as the intermediate (ignored by Shopify). CI diffs the snippet instead; `scripts/aira-rules-check.sh` skips it. The generated snippet is excluded from Tailwind's scan (`@source not`), because the first rebuild read its own escaped class names and emitted 18 phantom utilities.
- C2: the theme has no dynamic checkout references at all (`payment_button`, `payment_terms`, `shopify-payment-button`: 0 hits). `accelerated-checkout-backwards-compat.css` is injected by `content_for_header` because wallets are enabled for the store (the `shopify-digital-wallet` meta is present). Turning it off means turning off Shop Pay, Apple Pay and Google Pay in Settings, Payments. That is a business call, not a theme fix.
- C4: the only preconnect was the Work Sans one, now removed. Nothing preconnects to `cdn.shopify.com`; every theme asset is served from `shop-aira.com/cdn`, so none is needed.
- C5: the `shop-cart-sync` module chain is present three times in the live head, all from `content_for_header`. Admin task: Settings, Checkout and Customer accounts, turn off Sign in with Shop or cart sync if unused, then confirm the chain is gone.

## D. Third-party inventory

### D1. Judge.me: what the custom reviews section depends on

`sections/custom-reviews.liquid` depends on the **Judge.me app embed's rendered DOM**, not on metafields alone:

1. It renders a hidden Judge.me product widget itself (`div.jdgm-widget[data-jdgm-product-widget]`, `display:none`), seeded from `shop.metafields.judgeme.shop_reviews_count` and `product.metafields.judgeme.widget`.
2. It waits for the embed's loader to populate that widget (a MutationObserver plus a 500 ms poll for 15 s, then a fixed 2 s delay), then scrapes review cards out of Judge.me's own class names (`.jm-review-item`, `.jm-star-rating[aria-label]`, `.jm-reviewer-info__name`, `.jm-review-content__body` and so on), and clicks Judge.me's own "next page" button to paginate.
3. It prints `product.metafields.judgeme.review_widget_data` inline as `jdgm.data.reviewWidget[<id>]` and matches scraped cards back to that JSON for Vimeo ids and full-size photos; the summary line ("5.0 from 6 reviews") reads `number_of_reviews` and `average_rating` from the same JSON first.
4. "Write a review" synthetically clicks the hidden widget's `.jm-button--primary`, then patches Judge.me's modal fields.

The metafield JSON already contains everything the section scrapes: `number_of_reviews`, `average_rating`, the histogram, and `reviews[]` with `body_html`, `title`, `rating`, `reviewer_name`, `created_at`, `verified_buyer`, `pictures_urls` and `video_external_ids` (checked on the live page: 6 reviews, page 1 of `total_pages`).

**Recommendation: (a).** Rewrite the section's data layer (roughly 300 lines of scraping and pagination) to read the inline JSON only, point "Write a review" at Judge.me's hosted review form link (from the Judge.me admin), then switch the app embed off. That removes the loader, the widget bundle, 31 stylesheets and the icon font from every page (96 requests on the PDP today), well under the 5-request target. Two things fall out with it: the `jdgm.data ||= {}` line must stop assuming `jdgm` exists, and the scroll-hijack patch in `layout/theme.liquid` (lines 69 to 122) can be deleted. Caveat: the metafield holds one page of reviews; fine at 6, revisit past about 10.

Option (b), loading the embed on demand, is **not achievable from theme code**: the loader is injected by `content_for_header`, which the theme cannot defer or gate. Do not flip the embed until (a) is built; today the section shows a header and no reviews without it.

### D2. Google tags

- Theme: 0 (`gtag`, `googletagmanager`, `dataLayer`, `GTM-`, `AW-`: no hits in layout, sections, snippets, templates, config).
- One source: the Google and YouTube channel web pixel, id `3943596414`, config `google_tag_ids: ["G-HBCPR72K8D", "GT-K8HBK7NP"]` with `MC-XEWQQRXCK0` on purchase events. Each id gets its own `gtag/js` load, which is the "three tags" Lighthouse counted.
- The only custom pixel is Shopify's `shopify-custom-pixel` container. Check Settings, Customer events, for what it holds; nothing in the page markup points at a second Google source.

### D3. Lenis

`assets/smooth-scroll.js`: `new Lenis({ lerp: 0.08, wheelMultiplier: 0.9, smoothWheel: true })`, created only when `(min-width: 1024px) and (pointer: fine)` matches and `(prefers-reduced-motion: reduce)` does not, destroyed when either changes. No `smoothTouch` or `syncTouch`, so it never runs on a phone. Nothing above the fold waits on it: the only consumer of `window.lenis` outside that file is `assets/policy-page.js`, which only policy pages load.

## E. Images

- `decoding="async"` on every below-fold `image_tag` on the PDP and on the popup logo (`loading="lazy"` too). `image_tag` already emits `width` and `height` from the requested width, so intrinsic sizes were in place.
- "16 images without width/height" recount: the delivered HTML has 6 `<img` without `width`, all inside JavaScript template strings (review card and lightbox images in custom-reviews, cart-drawer line items). The rest of the count is Judge.me widget markup injected at runtime and goes away with D1 (a).
- Before/after pair: candidates 400, 480, 640, 800, 1200 and `sizes` following the 896 px slot. Stacking cards: 480, 640, 800 added on both the mobile `<source>` and the desktop `<img>`.

## F. Contrast

- Changed: the shared light-surface eyebrow (`snippets/section-heading.liquid`, which covers WHY AIRA, BEFORE & AFTER, WHAT OUR CUSTOMERS SAY and every other section heading on a light background), LAUNCH OFFER, the sticky bar offer line, popup LIMITED TIME OFFER, the stat source chips, the review date, the review dots (24 px tap target, same 8 px dot, pitch 16 to 24 px), footer column labels `h4` to `h2`.
- Not changed, will still be flagged: "Save $X on refills" and the plan save text in the buy box (`sections/product.liquid`, `text-sm font-bold text-highlight` on white, 3.5:1). Not in the brief's list; your call.
- Outside the PDP, the same orange-on-light pattern remains in `kit-offer`, `contact-hero`, `faq-hero`, `returns-*`, `how-it-works-*`, `our-story-*`, `policy-hero`, the cart drawer eyebrow, and the UGC gallery's offer line on the homepage light theme (18 px semibold). One follow-up brief would clear them all.

## Measurements

| Item | Before | After |
|---|---|---|
| Video requested on load | ~138 MB (four 1080p files) | 0 bytes; posters only until a section is near the viewport |
| Nunito Sans | 569,372 B TTF, not preloaded | 38,272 B woff2, preloaded |
| Satoshi | 42,588 B woff2, not preloaded | unchanged, preloaded |
| Work Sans | 2 preloads, 4 faces, 1 preconnect | 0 |
| Critical CSS | 114,042 B render-blocking request | 80,225 B inline (minified), no request |
| Hero image (WebP as served) | 1200w candidate for every device | 480w 18.2 KB, 640w 25.0 KB, 832w 32.7 KB, 1080w |
| Hero as `format: 'pjpg'` (not used) | | width 1200: 93.8 KB JPEG vs 40.6 KB WebP |

## Tailwind note

Tailwind v4 auto-scans the whole repo in addition to the `@source` globs, so classes named in `Brief.txt`, `AUDIT_REPORT.md` and the dead sections under `for-delete/` end up in the live CSS (about 10 KB of the 80). `@import "tailwindcss" source(none)` would fix it but needs a verified pass over every class that is only referenced outside the four Liquid folders. Separate cleanup.

## Local verification done

- `npm run build:css` succeeds; `snippets/critical-css.liquid` regenerates at 78 KB; `assets/critical.css` is ignored by Shopify.
- `shopify theme check`: 1 error, 164 warnings, versus 1 error, 165 warnings before this work. The error is the pre-existing `UnsupportedFilterArguments` in `sections/before-after-slider.liquid`; the warning that went away was an unused assign removed in F. No offences in any touched file.
- `bash scripts/aira-rules-check.sh`: no new findings; the generated snippet is excluded from the hex scan.
- Greps: `loading="true"` 0, `default: false,` 0, `worksans` 0, `type_primary_font` 0, `pjpg` 0, `sources.last` 0, `autoplay` only the two iframe `allow` attributes, `1080p` only the policy page width.
- Font file opened with fontkit: one axis (wght 200 to 1000), 489 glyphs, Basic Latin 95/95, Latin-1 96/96, Latin Extended-A 127/128.
- Contrast computed with the WCAG formula: `#FF4000` on white 3.5:1; navy at 65 percent about 5.5:1 on white and 5.2:1 on cream.
