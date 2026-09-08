# Teams premium pass — September 7, 2026

## Scope and current audit evidence

The goal is faster match-week navigation from My Teams into a specific team, without changing team membership, match data, saved lineups, or availability answers.

1. **Your teams — healthy foundation, action hierarchy opportunity.** Current production cards preserve team/league/flight context and show the next match clearly. The header uses separate full-width rows, and roster navigation visually outranks the captain's weekly actions. Captured and inspected: `artifacts/teams-premium-20260907/01-teams-before.png`.
2. **Team profile — functional, repetitive.** The linked Fall team header exposes chat, My Lab, matchup, lineup, availability and Follow; player tools repeat inside chat, and the large Captain week panel repeats several actions again. Captured and inspected: `artifacts/teams-premium-20260907/02-team-before.png`.

Screenshots are current-run production captures, not recreated mockups. They establish desktop hierarchy only, not full accessibility compliance or a completed phone audit.

## Changes in the local branch

- Compact Teams header: title/count and setup actions share the desktop row and reflow on phones.
- Captain cards lead with Build lineup and Season availability; roster, chat, calendar and default-team controls remain scoped and available. Player-only cards retain roster-first behavior.
- Linked team profiles use a consistent, responsive action group for lineup, availability, schedule/calendar and Team Chat. Icons reuse the approved product-navigation system.
- Follow and Player tools move into one disclosure; duplicate My Lab/matchup and captain links are removed from the chat panel.
- Deeper captain readiness, pairings and team-plan tools are retained in a closed disclosure, without another nested disclosure on phones.
- No source data, permissions, role entitlements, or destination scope is changed.
- Same-page calendar/availability actions use native anchors, preserving the existing hashchange-driven disclosure behavior; cross-page chat and lineup actions retain Next routing.

## Verification and remaining gate

Focused existing Teams tests: 29 passed. Four new compact-action tests passed, covering scoped links, role-dependent actions, touch sizing and retained tools. Full lint and an initial production build passed. The first full regression run had 2,676 passes, one outdated layout assertion and one 5-second asset-scan timeout during the concurrent build. The layout assertion now checks the new compact group and preserved role gate. No retired logo references were found; the asset safeguard was not weakened.

The complete rerun passed **all 2,678 tests in 527 files**. After the final native-anchor refinement, all **20 targeted tests** (compact actions, Teams simplification and locked assets) passed, as did focused lint and standalone TypeScript checking (`tsc --noEmit --incremental false`). The static-render test emits a non-fatal styled-jsx attribute warning from the existing icon component outside Next's compiler. A fresh production build remains required before release because the initial successful build preceded the anchor refinement.

The earlier browser approval usage limit cleared on the next user-requested continuation. The in-app browser reconnected successfully. Native viewport overrides changed layout but screenshot capture failed twice; the existing same-browser loopback phone iframe preview was used instead, with the override reset. No alternative browser or indirect browser execution bypassed the earlier rejection.

### September 8 verification continuation

- Final production build of `3b58a557` passed (including the native-anchor change).
- Synthetic previews of the actual TeamHomeCard and TeamQuickActions components were inspected at 320px and 390px. Cards, long names, captain/player quick actions and disclosures remained readable, without horizontal overflow. The 390px iframe had 375px usable content after its desktop scrollbar.
- Synthetic default-team switching reordered the cards correctly. Availability navigation reached the native hash target. Follow/player tools expanded and remained accessible. No real account state was changed.
- The local production-bundle Fall team profile loaded successfully, with no captured browser errors. Schedule navigation opened the calendar panel, which showed all 14 matches selected (not just the two recent-history preview rows). Settled panel position was 20px from the frame top, with no horizontal overflow.
- Localhost remains signed out. The user was asked to sign in at `http://localhost:3030/compete/teams` to check the actual linked/captain profile composition and protected actions. Production remains signed in, but its existing build is not evidence for the pending changes.

### Signed-in release gate completed

After the user signed in, the actual local production bundle showed both connected teams and retained the correct default. At the 390px phone viewport, the Fall team's four quick actions were 151.5px wide and 55–61px tall, with no horizontal overflow (375px usable width). Screenshots confirmed readable, non-overlapping cards and tools. Follow/player tools expanded correctly. The availability shortcut opened the Fall team's season panel; the calendar shortcut switched to all 14 selected matches with Apple, Google, TiQ and family-sharing options. The closed Captain tools disclosure expanded to readiness, availability, lineup, pairings and team-plan links. No invitations, availability answers, default-team changes, follow changes or saved lineups were submitted during these checks. The protected links preserve exact team, league and flight scope.

Production publication is pending the pull-request checks and deployment verification.

Next visual checks: 320px/390px captain and player action groups; long team names; opening all disclosures; direct Season availability anchor; exact team scope on chat/lineup links; default-team switching with synthetic data. Existing synthetic card fixture: `scripts/team-home-browser-fixture.mjs`; existing phone production-bundle preview: `/phone-team` on that fixture.
