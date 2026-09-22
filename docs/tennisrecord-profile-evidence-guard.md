# Missing-profile ingestion guard

## Invariant

A requested URL is not evidence that its player was found. An HTTP 200 response containing `No Player Found`, an empty profile, or an unverifiable owner must not create or overwrite any staged player, identity, match, or discovery.

- Accept a matching visible named heading on legacy profiles, or the matching owner self-link in the current Player Profile header. Sparse profiles need not have ratings or location.
- Match the requested profile identity, including the current self-link's `s` discriminator. Do not guess a repair for a truncated URL.
- Ignore scripts, templates, comments, and names found only in later match/team sections as owner evidence.
- Fresh missing profiles retain their source response and enter queue review without success/freshness advancement or automatic retries.
- Cached replay checks the same guard before superseding prior evidence. It records the parser revision but cannot stage or discover anything from that response.
- Valid sparse evidence preserves previously saved city/state as well as existing rating preservation behavior.

Parser revision intentionally remains unchanged: this preventive release does **not** initiate a global historical replay, repair identities, reset queues, or modify prior results. Historical repair requires a separately reviewed exact-ID plan and approval.

## Verification (2026-09-05)

Regression coverage includes real-parser HTTP 200 missing profiles; empty/generic layouts; current and legacy valid sparse owners; apostrophe names; mismatched names/discriminators; fresh weekly/bootstrap/manual runs; cached replay; preservation of prior location/rating; and persistence failure handling.

Full local verification: 509 test files / 2,501 tests passed, lint passed, typecheck passed, and Node 22 / Next 16.3 production build passed.

## Bounded read-only impact scan

At 2026-09-05T22:08:47.707911Z, inspected all 2,716 retained inline profile bodies and 76 stored bodies at or below 12 KB: 2,792 total. Results: 2,711 verified valid profiles, 71 explicit missing profiles, 10 HTTP-error bodies excluded from semantic classification, zero unexplained owner failures, zero retrieval failures.

This is **not** a full scan of larger stored profile bodies or of future imports. All 71 missing responses were linked to distinct historical staged records. Of these, 63 still have canonical mappings and 8 identities are already rejected; 31 mapped names differ and 32 agree. Name differences are review candidates, not permission to merge or rewrite players. Private exact-ID evidence is retained in the local integrity-watch artifacts, not committed here.

No historical record was changed by this scan or release. No source-site requests, forced scheduled jobs, or queue resets were used for verification.
