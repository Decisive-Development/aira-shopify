# Kit PDP speed brief: handoff note (8 September 2026)

Brief: `Brief.txt` (AIRA kit PDP speed brief, 8 Sep). Page: `/products/aira-kit`.
Status: **deployed to the live theme on 8 September (evening) and pushed to origin/main (nine commits, `bfdca6e` to `de16c88`).** Tag, orphan-file cleanup, PSI runs and two decisions remain with Tom; see the deploy record at the end. Brief.txt itself is untouched.
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
| `6934bf4` Add the PDP speed handoff note | D |
| `422225f` Point npm run dev at a development theme | process |
| `de16c88` Preload the hero at high priority from one candidate list | B (fix after preview checks) |

## Before you push (Tom): done 8 Sep, kept for the record

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

Written before the preview theme existed; all of these were then run on the preview and again on live (see the deploy record). Kept as the checklist for a phone:

- Network filter Media: zero requests before any scroll. Scroll to the benefits slider: one request at 720 px or under (plus the `.m3u8` playlist on Safari). Scroll to the UGC gallery: three requests, each the smallest rendition. Every video shows its poster first.
- The hero image request starts before any third-party script, comes from the `Link: rel=preload` response header, and is not duplicated. Lighthouse "LCP request discovery" passes all three checks on live (verified 8 Sep after the `de16c88` fix).
- Rendered `<head>`: no `worksans`, two font preloads (`satoshi-variable.woff2`, `nunito-sans-variable.woff2`), no `critical.css` request, `<meta charset>` within the first few hundred bytes, text visible while fonts load.
- Homepage and `/products/aira-refill-tabs` render the same benefits-slider and UGC gallery sections, so the video change applies there too; check they still play when scrolled into view and CLS stays 0.
- iOS Safari and Android Chrome: gallery thumbnails, videos (muted autoplay in view, tap to play under Low Power Mode or data saver), sticky bar, popup.

## What the audit got wrong, with evidence

| Brief | Reality | What was done |
|---|---|---|
| A3: the UGC videos come from a URL or text setting; convert it to `video` and re-select three files | `snippets/ugc-card.liquid` reads a metaobject **file_reference video** (`entry.video.value`). `.sources` and `.preview_image` were always available; `.sources.last.url` was what picked the 1080p file | No setting change. **Nothing for Tom to re-select.** |
| B: hero master is 2304 by 2304 | The CDN original `product-1.png` is **1080 by 1080** RGB PNG (525 KB); `?width=1200` returns the 1080 file. `image_tag` does not cap srcset at the natural width (a 794 px image on the page carried an 800w candidate) | srcset candidates are 480, 640, 832, 1080. Raise the top width if a larger master is uploaded |
| B1: `loading="true"` | Root cause was `loading: forloop.first \| default: false,` in `sections/product.liquid`: the pipe split the filter chain, so `class`, `widths`, `sizes` and `alt` never reached `image_tag`. The hero shipped the default 352/832/1200 srcset with no `sizes`, and items 2 to 8 had no `loading` at all (eager) | Pipe removed; two branches, first item eager and preloaded, the rest lazy |
| B3: hand-written `<link rel="preload">` matching the `<img>` byte for byte | `image_tag preload: true` sends the Link header but without `fetchpriority`, so Chrome fetched the hero at Low priority (found on the preview) | `preload_tag` with `fetchpriority: high` in `theme.liquid`; srcset and sizes for both the preload and the `<img>` come from `snippets/hero-image-candidates.liquid`, so nothing can drift (`de16c88`) |
| B4 and E3: `format: 'pjpg'` on photo PNGs | Shopify's CDN already serves WebP to browsers: the hero at width 1200 is 40.6 KB. Adding `format=pjpg` switches the CDN to JPEG, 93.8 KB. The 525 KB PNG figure only appears for non-browser requests | **Skipped** (Tom, 8 Sep) |
| C1: `inline_asset_content` | Shopify caps that filter at 15 KB; critical.css was 114 KB | The build minifies the CSS and writes it into `snippets/critical-css.liquid`, rendered inside `<style>` by all three layouts (Tom, 8 Sep). 78 KB raw, roughly 13 KB compressed, on every HTML response; cross-page CSS caching is given up, which is the right trade for an ad landing page |
| C3: preload Nunito Sans as woff2 | The asset was a 569 KB TTF carrying four variable axes (weight, width, optical size, YTLC) plus Cyrillic and Vietnamese. A straight woff2 conversion is 208 KB | Shipped as **38 KB**: Latin ranges, weight axis 200 to 1000 kept, the three axes the theme never sets pinned to their defaults (Tom, 8 Sep) |
| D2: three gtag script tags, list the sources | The theme contains no gtag, GTM or dataLayer code. All three loads come from **one** source, the Google and YouTube channel web pixel (id 3943596414), which carries `G-HBCPR72K8D`, `GT-K8HBK7NP` and `MC-XEWQQRXCK0` and loads gtag.js once per id | Nothing to remove theme-side |

## A. Videos

- New `snippets/lazy-video.liquid` renders every `<video>`: poster from `preview_image`, `muted loop playsinline preload="none"`, no `autoplay` attribute, sources in `data-src`. HLS playlist first, then one mp4 chosen by the short side of the frame, never by filename. `quality: 'full'` takes the largest mp4 at 720 or under (benefits slider, product gallery, UGC lightbox); `quality: 'card'` takes the smallest (UGC tiles). On this store the mp4 fallback is the 1080p file, because Liquid exposes no smaller mp4; see the deploy record.
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

## Deploy record (8 September 2026, evening)

Sequence as agreed: preview theme, checks, fixes, guard pull, batch 1, batch 2, live checks. Commits `422225f` (dev script) and `de16c88` (hero preload fix) were added after the first handoff; all nine are on `origin/main`.

### Preview theme verification (`pdp-speed-0908`, id 196502258046)

Thirteen agents ran browser and Lighthouse checks against the preview (mobile emulation, Slow 4G, fresh profiles, theme id confirmed on every page), then four more tried to refute the failures.

- Zero media requests on load on kit, home and refill. All four lazy videos: poster, `preload="none"`, no `autoplay`, sources in `data-src`. A full throttled scroll of the kit page moved 4.7 MB of video (13 requests) where live moved about 138 MB. Videos hydrate in view and pause out of view.
- No Liquid errors, no missing assets, charset at byte 55, two font requests (one per file, via 103 Early Hints), no Work Sans, no critical.css request, inline stylesheet 80 KB.
- Contrast failures 13 on live, 3 on the preview: the three CTA buttons (white on orange), the accepted exception. Eyebrows, sticky bar line, popup eyebrow, dots (24 by 24 with an 8 by 8 span), footer h2, Lenis gate, gallery, popup and UGC lightbox all behaved.
- Two defects found and fixed before deploy:
  1. **Hero priority.** `image_tag preload: true` sends the Link header without `fetchpriority`, so Chrome fetched the hero at Low and never raised it; Lighthouse failed the priority-hint check and resource load delay was 1.8 to 2.6 s. Now `preload_tag` with `fetchpriority: 'high'` in `layout/theme.liquid`, with srcset and sizes for both the preload and the `<img>` coming from `snippets/hero-image-candidates.liquid`. Re-verified: hero is the first image request at High, one download, Lighthouse discovery passes all three checks, resource load delay 8 ms. Two independent refuters confirmed it (Lighthouse three times, CDP three cold loads).
  2. **AbortError tap.** `pause()` against a pending `play()` rejects with AbortError; the helper no longer arms tap-to-play on it.
- **A2 is not delivered as written, and cannot be from theme code.** On this store Liquid `video.sources` exposes exactly two entries per video: the `.m3u8` playlist and the `HD-1080p-7.2Mbps` mp4. The 480p and 720p mp4s exist on the CDN but their filenames carry unpredictable suffixes, so selecting them means filename matching, which the brief forbids. What ships: HLS first, which Safari, iOS, Chrome 152 and Android play natively and pick a bitrate for (480p under Slow 4G, climbing towards 1080p on Wi-Fi after 12 to 27 s of playback); the single mp4 fallback for browsers without native HLS (Firefox) is the 1080p file, the same file every browser autoplayed before. Options: accept this, or re-upload masters at 720p or below so the one exposed mp4 is small. The snippet comment and the earlier line in this note claiming full HD is never offered were wrong and are corrected.
- Not regressions, for the record: the sticky bar is visible at scrollY 0 on a 390 by 844 phone because the add-to-cart button sits at 1,146 px, below the fold; identical on live. Under emulated Slow 4G the lowest HLS ladder step (1.5 Mbps, 1.1 MB first segments) means the slider video starts 14 to 16 s after coming into view and UGC tiles later still; that is bandwidth, and live was far worse. The four video posters (232 KB at width 800) are fetched on cold load at Low priority; a smaller poster width for the tiles is a cheap follow-up.

### Font glyphs and structured data (Tom's two asks)

- Every character listed (ellipsis, en dash, multiplication sign, middle dot, curly quotes, dollar, pound, euro, degree, trademark, nbsp) is in the 38 KB Nunito. The four code points in theme text it lacks (an arrow, two box-drawing characters, a small triangle) were never in the original TTF either; three sit in code comments, the triangle is the policy page's TOC caret, so nothing changed on screen.
- The server HTML carries one JSON-LD block (Shopify's Product schema from `snippets/meta-tags.liquid`, no rating). The `aggregateRating` (5.00, 6 reviews) is a second JSON-LD injected by the Judge.me embed at runtime (`script.jdgm-aggregate-rating-jld`). Switching the embed off under D1 (a) removes it, so the rewrite must emit `aggregateRating` from `review_widget_data` server-side, which is an improvement over JS-injected schema.

### theme dev

The "hot-deploys to live" behaviour was real but the cause was the npm script, not the CLI: `npm run dev` passed `--theme Aira-theme`, the live theme. Removed in `422225f`; `theme dev` now serves a per-user development theme. `shopify.theme.toml` pins live only for `-e production`.

### Deploy

1. Guard pull of live `templates/*.json`, `sections/*.json`, `config/settings_data.json`: identical to the repo, nothing to sync (checked twice, once before the preview and once before the push).
2. Batch 1 to live: `assets/lazy-video.js snippets/lazy-video.liquid snippets/critical-css.liquid snippets/css-variables.liquid assets/nunito-sans-variable.woff2 snippets/hero-image-candidates.liquid`. Live PDP checked: no Liquid error, new font faces present.
3. Batch 2 to live: `layout/theme.liquid layout/password.liquid templates/gift_card.liquid config/settings_schema.json sections/product.liquid sections/benefits-slider.liquid sections/benefits-grid.liquid sections/before-after-slider.liquid sections/custom-reviews.liquid sections/footer.liquid sections/scratch-offer-popup.liquid sections/ugc-gallery.liquid snippets/ugc-card.liquid snippets/section-heading.liquid`.
4. `git push origin main` (9ad91fd..de16c88).

### Live verification (straight after batch 2)

- Kit, home, refill HTML: 0 Liquid errors, 0 missing assets, 0 `worksans`, 0 `critical.css`, inline Tailwind present, charset at byte 55, 0 `autoplay` attributes, 4 lazy videos each. Live Link header carries both font preloads and the hero preload with `fetchpriority="high"`, `imagesrcset` and `imagesizes`.
- Kit in a mobile browser on Slow 4G: theme Aira-theme (live), hero request 6 of 213 at High priority and the first image request, one download at 1080w, fonts requests 4 and 5 at High, zero media requests after 10 s, 4 lazy videos untouched, sticky bar line navy, both fonts loaded, no page or console errors.
- Local Lighthouse 12.8.2 mobile on live (not PSI: the PSI API quota for today was exhausted, run PSI in the browser):

| Run | Perf | FCP | LCP | TBT | CLS | SI | Requests | Media | Notes |
|---|---|---|---|---|---|---|---|---|---|
| live 1 | 84 | 2.3 s | 2.5 s | 180 ms | 0 | 8.6 s | 299 | 0 | LCP discovery all three checks pass; contrast failures 3 (CTA buttons); render-blocking none |
| live 2 | 52 | 3.8 s | 10.7 s | 320 ms | 0 | 9.3 s | 298 | 0 | first paint at exactly 2.561 s although DOM ready at 0.93 s and every resource done by 1.5 s |
| live 3 | 54 | 3.6 s | 11.7 s | 270 ms | 0 | 9.5 s | 316 | 0 | same 2.561 s first paint; no long task, nothing loading |

Read run 1 as the page and runs 2 and 3 as the harness: an identical first-paint stamp in two runs with an idle network and idle main thread is not the theme. Speed Index is inflated in every local run by the scratch offer popup opening at 5 s inside the trace. PSI in the browser is the number for the table above; the brief's baseline was PSI.

Two things the live timeline makes plain for what comes next: the Judge.me loader injects about thirty stylesheets at VeryHigh priority between 1.0 and 1.7 s (D1), and the largest transfers are Shopify checkout-web chunks (`hydrate` 203 KB, `checkout-policy` 89 KB) from the Sign in with Shop / cart sync path (C5, admin toggle).

### Still open

- Tom: real phone check, then tag `v1.1-pdp-speed`.
- Tom: delete `assets/critical.css` and `assets/nunito-sans-variable.ttf` from the live theme in the admin code editor (unreferenced, left by `--nodelete`); delete the preview theme `pdp-speed-0908` when done with it.
- Tom: PSI mobile runs for the table; Shop cart sync toggle (C5).
- Tom: A2 decision (accept HLS-first with the 1080p mp4 fallback, or re-upload masters at 720p or below).
- Next brief: Judge.me D1 (a), including server-side `aggregateRating`.
- Not changed, will still be flagged by Lighthouse: the three CTA buttons (accepted); "Save $X on refills" in the buy box was not flagged in any run.
