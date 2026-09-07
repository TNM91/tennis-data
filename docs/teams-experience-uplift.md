# Teams experience uplift — September 7, 2026

## Changes

- My Teams uses responsive next-match cards with a clear default team and consistent roster/schedule, chat, calendar, availability, and lineup actions.
- Existing connection, league, flight, source-layer, and role checks are preserved. Season availability is offered only for actual captain connections.
- Connected teams appear before the compact setup guide; adding a team and managing links remain available.
- Team detail has a smaller heading, navigation after team identity in both DOM and visual order, and expandable season statistics (closed on phones).
- The availability deep link opens the existing season hub without submitting anything or discarding unsaved edits.

## Verification

- Full suite: 524 test files / 2,658 tests passed.
- Full ESLint and standalone TypeScript passed. Production build passed (251 pages).
- Following the final navigation-order adjustment: 25 focused regressions passed, focused ESLint passed, production build passed again.
- Real card component checked with synthetic data on desktop and at 320px; long names and actions wrap readably. Synthetic default-team action reorders cards correctly.
- Anonymous local production bundle loaded the public team profile, ten roster members, and all 14 season matches. Schedule navigation opened calendar options with all 14 selected.
- Local 390px iframe verified readable built team-detail presentation. The loopback preview adjusts framing headers only in the fixture; production security headers are unchanged.

## Limits and release

Authenticated live My Teams was inspected read-only. No real memberships, availability replies, messages, or calendar subscriptions were changed. The new authenticated card links are covered by component/source tests; no live account write round-trip was performed.

This branch includes the prior season-availability hub commit. Neither this uplift nor that prior local enhancement is claimed deployed by this verification.

Reproduce card previews with `node scripts/team-home-browser-fixture.mjs` (port 3022). `/phone?width=320` is synthetic. `/phone-team` is an anonymous read-only proxy to a production build running locally on port 3030.
