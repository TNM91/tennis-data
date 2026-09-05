# Bounded rating-history saves

## Evidence

Production run `5b3d87da-43ef-46ed-87eb-42b78eb4deb9` on September 5, 2026 completed successfully in 187.247 seconds. Its measured engine took 186.616 seconds: player reads 2.847 s, match reads 8.287 s, participant reads 33.254 s, calculation 3.891 s, finalization 0.001 s, player-rating saves 7.346 s and snapshot saves 129.049 s. The snapshot phase was approximately 69% of the overall run. This was a baseline-evidence refresh with zero newly pending canonical matches, not a no-op.

## Focused change

Scheduled ratings opt into two concurrent snapshot batches, still 500 rows each. Every snapshot is deduplicated by the existing player/match/type/track key before batching, so concurrent batches contain disjoint keys. Calculations, their order, snapshot values, conflict keys, payloads, total request count, player writes and legacy-schema fallbacks are unchanged. Manual callers remain sequential unless they explicitly opt in. Unsupported runtime widths fall back to one. No schema migration, dependency or external source concurrency change.

Each two-batch wave is fully settled before proceeding or throwing. On failure, no new wave starts and no pending sibling write outlives the rejected engine call; the scheduled wrapper retains its existing shared lock until that call settles. Successful earlier writes are not rolled back: retries retain the existing upsert behavior. This is not an atomic transaction or a cure for existing legacy insert fallback limitations. Host-level termination still cannot be handled by JavaScript; existing lock recovery applies.

## Verification and rollout

Release candidate is integrated on the source-outage cooldown release (`784d52cb`, PR #1196). September 5 combined verification passed: 508 test files / 2,480 tests, full lint, standalone typecheck, extension syntax, diff checks and Node 22 production build (245 pages). The focused combined rating-write, lock, HTTP and cooldown suite also passes (5 files / 54 tests). No production deployment of the two-batch option has occurred at this implementation handoff.

Tests compare all six player ratings, every snapshot and the full request-payload inventory against sequential execution across more than 2,000 snapshots. They include current schema, missing metrics, missing conflict constraint, both missing, dry runs, bounded concurrency, synchronous/asynchronous failures, draining sibling writes and preventing later writes after failure. Database read plans were inspected, but no indexes changed: prioritize the measured save bottleneck first.

Implementation alone does not establish a production speedup. After rollout, compare naturally scheduled completed rating runs, `saving-snapshots` duration, overall duration and outer job status; check database errors and import recovery. Retain the prior deployment as rollback if contention or failures increase. Do not force a full rebuild merely to create a benchmark. Data-integrity review inventories remain separate and must not be auto-repaired.
