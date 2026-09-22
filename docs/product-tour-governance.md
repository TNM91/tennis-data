# Product tour governance

The product tour sells the current TenAceIQ experience without baking changing prices into exported video files.

## Source of truth

- Plan names, prices, billing cadence, and value: `lib/pricing-plans.ts` and `lib/product-story.ts`
- Video metadata, captions, transcripts, CTA destinations, and review version: `lib/product-tour-videos.ts`
- Verified member proof: `lib/product-tour-proof.ts`
- Production media: `public/media/product-tours/`
- Approved brand assets: `public/brand/`

Pricing shown around a video must be derived from the pricing source of truth. Never add a dollar amount to narration, captions, posters, or exported video frames.

## Quarterly review

Review the tour in March, June, September, and December. Update `PRODUCT_TOUR_CONTENT_REVIEW` after the review is complete.

Check:

1. Every role name, product promise, icon, workflow, and CTA still matches production.
2. Club capacities and plan boundaries still match `CLUB_PLAN_STORY`.
3. Captions match narration and every transcript remains complete.
4. Desktop and mobile playback keep the whole frame visible without clipping or layout shift.
5. The pricing rail and modal price summaries match the pricing page and checkout.
6. Start, 25%, 50%, 75%, completion, role-selection, and CTA events are visible in analytics.
7. Poster images use approved brand artwork and remain sharp at desktop and phone sizes.

## Rerender triggers

Rerender only when a plan name, role promise, product workflow, capacity, narration, on-screen product view, or approved brand presentation changes materially. A price-only change does not require a video rerender.

## Member proof standard

Publish a member quote only after confirming the exact wording, role, attribution, and permission for public use. Add approved records to `VERIFIED_PRODUCT_TOUR_PROOF`. Never ship placeholder names, invented outcomes, or unverified performance claims.

## Analytics decisions

- Low starts: improve placement, poster, or the opening promise.
- Strong starts with weak 25% completion: shorten or strengthen the opening.
- Strong 75% completion with weak CTA clicks: improve the role-specific offer and CTA.
- Repeated role selections: prioritize that role’s walkthrough, proof, and onboarding path.
