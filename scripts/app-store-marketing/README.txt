TenAceIQ App Store marketing package — November 19, 2026

Source app: build 324, commit 9fe0931d5d06a372354e39f427da98e1643bca98.
The successful signed upload run 44559245093 records app-store distribution
and TIQ_BUILD_NUMBER 324. No new app binary is needed for these assets.

Scope
Seven screenshots per device group: My Lab, team chat, practice sign-ups,
Explore, Coach assignment/check-in, league standings and tournament draw.
Two separate creative PNGs: header and search results.
English (U.S.) copy is in en-US.json. Retain the standard Apple EULA link.

The capture runner bundles the actual native app at this commit and substitutes
local synthetic account/API data. Browser requests to live services are blocked.
It does not claim physical iPhone or Xcode simulator capture. It changes no
production UI, permissions, subscription products, data imports or backend.
Focused component captures are actual rendered app elements. Their source
full-screen captures are retained beside them for review.

Brand artwork comes only from public/brand, placed proportionally and intact.
No source logos or court artwork are regenerated, filtered, recolored or cropped.
Screenshot layouts are composed deterministically with HTML/CSS and rendered
to PNG. Fonts use the installed Bahnschrift face, with Arial fallback.

Reproduction (from this checkout with the repository dependencies installed)
1. node mobile/scripts/build-bundled.mjs --first-party-full
2. node scripts/app-store-marketing/capture.mjs
3. node scripts/app-store-marketing/render.mjs

Output: ../../output/app-store-premium-20261119 relative to this checkout.
The package includes source captures, rendered layouts, a preview gallery,
revised metadata and an asset manifest with dimensions and SHA-256 hashes.

Validation
- iPhone 6.9: 1320 x 2868; iPhone 6.3: 1206 x 2622; iPad 13: 2064 x 2752.
- Header: 3840 x 1646; search: 3840 x 2560.
- All 23 final PNGs have the expected dimensions and no alpha channel.
- Header/search focal artwork is checked against Apple's specified safe areas.
- Copy field lengths and keyword UTF-8 bytes are checked; EULA is required.
- Final captures, desktop gallery and phone/tablet artwork receive visual QA.

Release handling
Keep iOS 1.0 (324) Waiting for Review. Do not withdraw or replace that build.
Stage new screenshots in Asset Library without replacing the locked gallery.
Creative assets can use a separate asset review where Apple permits it.
Apply only metadata fields that Apple permits during the existing review.
Any locked field stays ready in en-US.json for the next permitted update.

References
https://developer.apple.com/help/app-store-connect/manage-app-information/manage-your-app-store-assets
https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications
https://developer.apple.com/help/app-store-connect/reference/app-information/app-and-submission-statuses
