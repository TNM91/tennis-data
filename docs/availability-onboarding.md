# Team availability onboarding

## Player experience

- Shared team invitation: branded, mobile-first entry with the team and season visible, Free signup/sign-in, and three short steps.
- Availability-specific Free signup asks for email, one password, and terms consent. Email verification remains required; optional first-name and repeat-password fields are omitted only on this entry path. Captain offers and other signup paths are unchanged.
- Confirmation and sign-in retain the exact match/season destination. The welcome page returns availability visitors directly to their request.
- Player linking happens inline through a name search of the public dataset, not a capped initial download. Same-name results show location; the user explicitly chooses and confirms their own player.
- The existing authenticated profile API must confirm the cloud save before continuing. This path neither creates a duplicate/self-rated player nor changes ratings.
- Team confirmation happens inline for a server-discovered connection in the exact team/league/flight. It is never granted from the URL alone. Declined or archived connections are not silently restored.
- A successful player link without a corresponding roster/team connection has a clear next step instead of repeating setup.
- Returning, linked players go directly to their own availability. Personal bearer links still do not require an account. Match-first replies, optional season dates, and Apple/Google/TiQ calendar options remain available.

## Verification — September 7, 2026

- Full suite: 2,707 tests across 530 files passed. Full lint and standalone typecheck passed.
- Final roster-mismatch guidance: 31 focused tests and focused lint passed; final production build passed.
- Built `/team-availability` route smoke passed with the approved brand asset and new entry copy.
- Isolated browser harness exercised Free signup, confirmation return, same-name player selection, cloud-save response validation, explicit team acceptance, focused match reply, retry after a failed save response, and saved-answer persistence on return without repeated setup.
- Phone checks at 390px and 320px. Narrow reply view reported content width 305px within a 320px viewport.
- No real accounts, invitations, team links, emails, or replies were created or changed. Email delivery itself was not re-tested; the existing delivery and verification backend is unchanged. The local harness replaces auth/data APIs and blocks non-local connections.

Harness: `scripts/availability-onboarding-fixture.mjs`, port 3024. Set `TIQ_FIXTURE_CONNECTED=1` for the returning-player scenario. This is test data only.

Local production preview: port 3030. These changes and the preceding short-link changes are not published yet.
