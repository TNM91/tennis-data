# Rating history publication repair

PR #1475 is deployed. Current-season network publication compares the calculated history with storage, keeps identical rows, saves new or changed rows, and removes stale TIQ rows only for players published by the network. USTA history, older seasons and fallback-player history retain their established scope. The chronological replay and rating methodology remain version 1.2.

Four readers use disjoint primary-key ranges. They process pages as they arrive, retaining seen IDs and changed rows rather than a second full copy of history. Floating-point comparisons ignore only serialization noise within 1e-12 relative tolerance, far below published 0.001 precision. Dates, nulls, zeroes and probabilities retain distinct meanings. Real changes remain eligible for publication.

The comparison finishes before player or history publication. A failed inventory read therefore writes nothing. New and changed snapshot writes must all settle successfully before stale history is removed. Failed publication does not report completion or clear the pending request. The existing shared lock, six-minute stale recovery and 300-second route limit remain unchanged. Missing-metric schemas retain the previous replacement fallback; missing unique constraints replace only exact changed keys before legacy insertion. This is recoverable publication, not a single database transaction.

## Production recovery and verification

The old rewrite path failed at 21:06:59 UTC while inserting history after deleting 436,556 network TIQ rows. Read-only comparison identified those missing rows and confirmed the other 518,082 rows were intact.

The new protected rebuild ran from 21:14:00 to 21:17:50 UTC. It restored all 436,556 missing rows, preserved the 518,082 intact rows, and removed no rows. Engine time was 229.357 seconds; history comparison took 42.175 seconds and restoration writes 63.295 seconds.

A repeat protected rebuild completed successfully in 177.964 seconds. Its comparison read 954,638 existing rows in 54.312 seconds and found every desired row unchanged. It performed zero history writes and zero deletions. Both rebuilds ran against production data through the scheduled service and shared lock from the protected local runner. They were not direct Vercel cron HTTP invocations. The natural Vercel cron invocation at 21:32:46 UTC then completed successfully with HTTP 200 in 161.597 seconds. It read 954,638 rows, found every row unchanged, and performed zero history writes or deletions. This verifies the recurring production route as well as the protected local runner.

Verified current/future history count is 954,638, matching the fresh pre-failure backup. Nathan has 17 current TIQ overall courts, Phyllis Norman 16, and Anne Hope 37. Ratings remain Nathan 4.592 overall / 4.666 singles / 4.525 doubles; Phyllis 4.980; Anne 5.063. No rating was manually adjusted.

Full release verification passed 3,274 tests, lint, typecheck, extension syntax, production build, schema audit and captain continuity. Tests cover complete pagination, batch equivalence, persisted-value changes, cleanup scope, duplicate keys, read failures, write failures and older-schema insertion fallbacks.

The fresh verified rollback archive contains 82,079 players and 954,638 current/future history rows, totaling 1,036,718 records including metadata. Integrity checks matched the uncompressed SHA-256 and gzip contents. The archive is an indexed, nontransactional backup; source evidence remains retained independently.

## Limits

The engine still replays chronological match evidence and still reads current history. A changed early court or starting label can legitimately require many later history updates. This release avoids redundant writes; it does not prove unlimited capacity or validated USTA year-end forecasts. Shared-lock failures, database timeouts and source outages still require runtime observation.

Evidence under `artifacts/rating-evidence`: `rating-history-diff-shadow.json`, `full-rating-history-diff-shadow.json`, `full-rating-history-stream-shadow.json`, `history-diff-backup-verification.json`, `history-diff-rollout.log`, `history-diff-repeat.log`, `history-diff-live-verification.json`, `history-diff-final-ci.log`. Merge commit: `6d645b404016e69358d89eb9d35b8ce11924d3c0`; deployment: `dpl_HxM7TLAC7NrAkRNohudZMzQMfE8m`.

