# aira Shopify theme — agent instructions

Before touching ANY customer-facing copy string in this repo, read `AIRA_Brand_Copy_Standards.md` (root of this repo). It is law. Deviations need Tom's sign-off. Before touching title tags, meta descriptions, or anything SEO, also read `AIRA_SEO_Meta_Plan.md`.

## Hard rules that get violated most (full detail in the standards doc)

1. **UK English.** colour, optimise, customise. Never Americanise copy strings. (Code, class names, and Liquid keys are untouched.)
2. **No em-dashes (—), no hyphens-as-pivots, no arrow characters (→)** in any customer-facing string or link text. Pivot with a period, comma, or colon. Hyphens only inside compound words (sweat-proof, latex-free).
3. **Brand casing:** "aira" lowercase always, even in headings. Restructure sentences so it is never the first word.
4. **Units and sizes:** pairs (1 pair = 1 night), never "tabs" as a unit. Band sizes are L1–L4.
5. **CTAs:** primary "Get my kit" · refills "Get refills" · PDP button "Add to Cart". Never "Shop Now", "Buy Now", "Learn more".
6. **Guarantee:** "30-night guarantee" (nights, not days).
7. **Shipping line:** "Free shipping across the GCC." exactly.
8. **Claims:** no stat without a named source. New claims must exist in the Claims Register (standards doc §6) before they enter copy. Never invent numbers, reviews, or ratings.
9. **Placement wording:** tabs go "just above the nostril", never "nose bridge".
10. **Spoken voice:** if you would not say the sentence to someone's face, rewrite it. Short beats thorough. Never phrase a promise so it implies a limit ("all night", not "until morning").
11. **Sentence case everywhere, no exceptions:** headings, buttons, badges, labels, links ("30-night guarantee", "Research backed", "Add to cart"). No Title Case, no ALL CAPS except eyebrow labels (standards doc §5).

## Workflow

- Tom delivers work as brief files (`Brief.txt` or `AIRA_*_Brief_VSC.txt`). Execute the brief exactly; copy strings in briefs are final and pre-approved unless marked as a dependency.
- Stack: Shopify Liquid (Online Store 2.0), Tailwind utility classes from the existing theme only, vanilla JS or Alpine for light interactions, no React. Footer nav comes from Shopify Navigation menus, not hardcoded.
- After copy changes, sweep the touched templates for em-dashes, US spellings, and arrow characters, and list what you changed in your summary.
