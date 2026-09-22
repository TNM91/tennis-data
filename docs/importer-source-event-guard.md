# Source-event identity prevention

Status: implementation on `codex/importer-source-event-guard`; not deployed. Historical data repair is separate and is not authorized by this implementation.

## What changed

- Before fresh imports stage any players/courts/observations, verify the source year + match ID against all retained evidence for that fingerprint and its existing canonical aliases.
- Apply the same check before cached replay supersedes older staging evidence.
- Recheck at reconciliation before identities, observation selection, canonical/result writes or rating work. A late conflict places the incoming court and page in review.
- Existing canonical links and external IDs derived from legacy fingerprints are no longer accepted as event proof without that verification.
- Query failures, absent responses, ambiguous/missing source IDs and conflicting retained events fail closed. Reads paginate; superseded/quarantined source records remain evidence. Independently supplied captain/admin observations are not mistaken for TennisRecord event URLs.
- Normalize http/https, www, query order, HTML ampersands, ID leading zeros and URL fragments. Reject foreign hosts, credentials/ports, malformed IDs and repeated identity parameters.

This is a conservative guard, not a global fingerprint migration. A colliding page goes to review in its entirety; it does not quietly update an existing event. Normal same-event refreshes keep their established fingerprint. Same-day rematches with ambiguous legacy identity need review rather than silent deduplication. No parser revision bump or historical replay is requested.

## Audit coverage

`scripts/audit-match-data-integrity.sql` now reports both multiple source events within one fingerprint and multiple events linked through different fingerprints to one active played record. It also counts pages/courts held by this guard. These are review findings, not permission to split/merge records automatically.

Read-only production acceptance found the original 15 collision fingerprints and 16 active linked-record candidates. The extra candidate is `3011871a-3bb4-4996-af3a-6e61f2005b47`, source events 2025:153172/153173, across two fingerprints. Original-source review of this additional association remains outstanding. The 15-group historical manifest must not silently be expanded into an approved 16-group repair.

The ordinary winner comparison still uses staged evidence; zero winner differences alone does not prove original-source correctness. The new event fields must be considered separately. Full counts are returned; examples are capped at 25, so retrieve complete IDs when counts exceed that cap.

## Verification / deployment boundaries

- Focused regressions cover URL identity, legacy same-key collisions, rematches, empty/failed/paginated evidence, independent source filtering, fresh/manual/weekly/bootstrap holds, cached replay, cross-fingerprint aliases and late reconciliation.
- Read-only execution of the guard against the 15 exact known production collision fingerprints rejected all 15; no records or queues were written and no source website was requested.
- Expanded read-only production audit completed successfully over 77,253 active matches / 76,866 source comparisons.
- Final verification passed: ESLint, TypeScript, all 511 test files / 2,540 tests, and the Next.js 16.3.0 production build (245 pages). Focused importer regressions: 4 files / 98 tests. Next.js skill and installed version-specific guidance were used for this implementation.

No schema migration, source pacing change, scheduler trigger, queue reset, historical result repair, rating rebuild, billing change or deployment is part of this local implementation. Deploy through the normal reviewed release workflow. After deployment, verify normal source refreshes and held-review status without forcing importer jobs. Historical separation needs exact per-event before-value backups, fresh guards, preservation of independent corrections, and separate approval.
