# aira — SEO & Meta Plan

**Status:** v1 · 2026-06-12 · Implementation deferred (Tom: "we'll do all this later")
**Source:** keyword map in AIRA_Brand_Copy_Standards.md §10 (deep research, 2026-06-12)
**Rules applied:** UK English, no dashes or arrows, aira lowercase, keyword first and brand last in title tags.

---

## Per-page meta

### Homepage `/`
- **Title tag:** Magnetic nasal strips, reusable | aira
- **Meta description:** Reusable magnetic nasal strips that hold your nose open all night. Less snoring, deeper sleep, easier training. Free shipping across the GCC.
- **H1:** existing hero headline (voice wins over keyword here; keyword lives in title tag and body)
- **Primary keyword:** magnetic nasal strips · Secondary: reusable nasal strips, nasal strips for snoring, nasal breathing

### Kit PDP `/products/aira-kit`
- **Title tag:** Magnetic nasal strip kit, reusable | aira
- **Meta description:** One magnetic strip, skin-safe 3M adhesive tabs, all four sizes in the box. A reusable magnetic nasal strip kit with a 30-night guarantee.
- **H1:** The aira kit
- **Primary:** magnetic nasal strip kit · Secondary: reusable nasal strips, nose strips for snoring, nasal dilator

### Shop `/collections/...`
- **Title tag:** Nasal strips UAE, kits and refills | aira
- **Meta description:** Shop reusable magnetic nasal strips in the UAE and across the GCC. Kits and refill tabs, free shipping, 30-night guarantee.
- **H1:** Shop
- **Primary:** nasal strips UAE · Secondary: buy nasal strips Dubai, anti snoring devices UAE, breathing strips

### Refills PDP `/products/aira-refill-tabs`
- **Title tag:** Nasal strip refills, adhesive tabs | aira
- **Meta description:** Refill tabs for your aira strip. 30 fresh pairs a month, 3M medical-grade adhesive, delivered across the GCC. Save 20% with monthly delivery.
- **H1:** Refill tabs
- **Primary:** nasal strip refills · Secondary: magnetic nasal strip refills, adhesive tabs

### FAQ `/pages/faq`
- **Title tag:** Nasal strip FAQs: fit, adhesive, snoring | aira
- **Meta description:** Do nasal strips work for snoring? How do magnetic nasal strips stay on? Answers on fit, sizing, the 3M adhesive, shipping and the 30-night guarantee.
- **H1:** Questions, answered.
- **Primary:** do nasal strips work for snoring · Secondary: how do magnetic nasal strips work, are nasal strips safe, stop mouth breathing while sleeping

---

## Technical to-dos (when implementing)

1. **Product schema (JSON-LD)** on both PDPs: Product + Offer. Add AggregateRating ONLY once real reviews exist.
2. **OG / social tags:** og:title mirrors title tag, og:image is the final brand photography (not supplier placeholder).
3. **Image alt text:** descriptive + keyword where natural ("magnetic nasal strip strip, size L2, navy"). Never keyword-stuffed.
4. **llms.txt** at site root describing brand, products, shipping, guarantee (the Hostage Tape play; cheap, do at launch).
5. **Redirects:** confirm aira-starter-kit → aira-kit auto-redirect live (Tom's rename, 2026-06-11).
6. **3M adhesive claims:** verify exact 3M product/grade in supplier docs before meta descriptions and FAQ copy referencing 3M go live.
7. **Blog cluster (post-launch backlog):** symptom queries from research: how to stop snoring naturally · one nostril always blocked · why do I wake up with a dry mouth · nose breathing while running · plus a brand-owned "best nasal strips" comparison post (the Intake play, ranks top 3 for them).

---

**Dependencies before this ships:** final prices, real product photography, supplier confirmation of 3M grade, review system live (for schema ratings).
