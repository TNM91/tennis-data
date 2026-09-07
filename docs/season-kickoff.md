# Captain season kickoff

Entry point: **Teams → team → Season calendar → Start season**. This uses the
existing team schedule and roster, with an explicit season selector when needed.

- The captain selects players and prepares personal invitations. Nothing is sent
  automatically. Copy invite or Open text message hands off a named-player text.
- Players use their personal link without signing in: Yes, Not sure, or No for
  each fixture, or Available for all followed by exceptions. Save is explicit;
  the same link reopens saved answers. Unanswered is never Yes.
- Apple subscription, Google subscription instructions / individual events, and
  authenticated Save to TiQ are next to the availability flow. Native Apple or
  Google acceptance still happens in the calendar app.
- Season readiness shows per-match counts and player answers. Build this match's
  lineup carries the canonical fixture ID. Newer availability takes precedence
  over older replies; season Yes is labeled Available for season, not Confirmed.
- Dates or times changed after a reply require review again. Existing lineup
  confirmation remains a separate match-week action.
- Captains can stop and replace personal links. Replacement preserves answers
  and invalidates the previous reply and calendar tokens.
- After new fixtures are imported, select the affected roster and prepare again
  to attach the refreshed season to existing links. Existing answers and tokens
  remain stable; past fixtures stay in the calendar.

## Privacy and data boundaries

Server verifies Captain access plus the accepted captain/co-captain role for the
exact team, league and flight. Only server-side service access can read tokens or
write replies. A personal response token identifies one invited player; submitted
player names/IDs cannot change that identity. Calendar subscriptions use a
different read-only token and never include availability or roster details.
The response-page token is in the URL fragment, outside page requests/referrers.
Advertising and telemetry do not render on the personal reply page.

Replies are keyed by invitation and canonical match ID, with date/time snapshots.
Atomic database saves re-check the token and fixtures under locks. No canonical
player, rating, match, winner, roster or existing saved-calendar rows are changed
by this feature's migration.

## Release status / prerequisites

Implemented locally on `codex/season-kickoff`; **not published**. Before deploying,
apply `supabase/migrations/20260907200000_season_kickoff.sql` through the normal
reviewed migration process. It creates two RLS-protected tables and a service-only
save function. No production migration or invitations were applied during development.
The existing availability `updated_at` column is used for latest-answer ordering.

## Verification

- Full regression suite, lint, TypeScript, extension syntax, production build.
- Focused tests: cross-team/season isolation, doubleheaders, reschedules, stale
  responses, no implicit Yes, revoked links, token-bound identity, and calendar
  read-only access.
- `scripts/verify-season-kickoff-db.mjs`: 21 checks against an isolated in-memory
  PostgreSQL runtime, including rollback of partial batches, retries, role grants,
  stopped tokens and separation of calendar/reply tokens. Test-only runtime setup
  is documented at the top of the script; no app dependency was added.
- `scripts/season-kickoff-browser-fixture.mjs`: local synthetic API harness for
  the real captain components and production-bundle player page. Requires the
  local production app at port 3030; harness runs on 3021. No real users/messages.
- Browser exercised prepare → all 14 available → one unavailable exception →
  save → reopen → captain refresh. Saved exception and waiting counts survived.
- Checked phone-width overflow and absence of third-party scripts on the reply
  page. Actual Apple/Google account subscription acceptance and a live authenticated
  end-to-end run remain release smoke checks, not claims of this local fixture test.

Test database reference: [PGlite documentation](https://pglite.dev/docs/).
