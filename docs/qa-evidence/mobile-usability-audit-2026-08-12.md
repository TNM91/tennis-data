# Mobile usability audit — August 12, 2026

## Scope

Production reference: `https://tenaceiq.com`

Audited at 390 × 844 across the public home, Explore, My Lab, Captain, Coaches,
Leagues, Clubs, Pricing, Upgrade, and Login routes. Pricing, Leagues, Upgrade, and
Login were also stress-tested at 320 × 800.

## Findings and changes

| Journey | Result | Change |
| --- | --- | --- |
| Home | Healthy after fix | Raised the compact primary action and footer controls to a 44 px minimum target. |
| Explore | Healthy after fix | Enlarged the compact “Free to start” action and inherited the footer fix. |
| My Lab | Healthy after fix | Enlarged the player selector, progress links, and match actions. |
| Captain | Healthy | No overflow or route-specific target failure; inherited the footer fix. |
| Coaches | Healthy | No overflow or route-specific target failure; inherited the footer fix. |
| Leagues | Healthy after fix | Enlarged search, filters, season actions, and refresh/limit controls. |
| Clubs | Healthy | No overflow or route-specific target failure; inherited the footer fix. |
| Pricing | Healthy after fix | Enlarged compact plan actions to 44 px and improved label legibility. |
| Upgrade | Healthy after fix | Enlarged form fields and the inline sign-in action. |
| Login | Healthy after fix | Enlarged account, recovery, sign-in, and Explore actions. |

## Verification

- No horizontal overflow on the ten audited routes at 390 px.
- No visible interactive element below 44 × 44 px on those routes after the fix.
- No horizontal overflow or undersized interactive element on the four highest-risk
  routes at 320 px.
- Full repository verification passed: lint, TypeScript, 1,833 tests, extension
  syntax check, and the Next.js production build.

## Evidence

- Production baseline: `artifacts/mobile-usability-audit/`
- Final 390 px build: `artifacts/mobile-usability-after-viewports/`
- Final 320 px stress test: `artifacts/mobile-usability-after-320/`

## Known coverage limits

The audited browser session did not have a signed-in account, so authenticated
Player, Captain, Coach, Club, and League Coordinator workflows were not claimed as
visually verified. A real iOS/Android software keyboard and screen-reader pass also
remain device-level checks.
