# Scheduled rating publication verification

PR #1474 is deployed. Network snapshot writes now use batches of up to 1,000 rows instead of 500, with the same eight-request concurrency bound. Legacy publication keeps 500-row batches. Model 1.2, calculations, eligibility, history cleanup, foreign-key/schema fallbacks, lock timing and source pacing are unchanged.

Focused verification passed 91 tests. New tests compare calculated outputs and all successful stored rows across modern, missing-metric, missing-constraint and combined fallback schemas. Full release verification passed 3,262 tests, lint, typecheck, extension syntax, production build, schema audit and captain continuity.

The scheduled production run at 20:32:46 UTC completed at 20:36:14 with HTTP 200 and no error. It processed 11 pending matches, published network evidence from 61,424 usable courts for 45,409 players, and cleared the pending rebuild marker. Total request time was 207.796 seconds against the 300-second limit. Snapshot publication took 132.472 seconds.

The immediately preceding scheduled run took 196.811 seconds overall and 126.028 seconds for snapshots. Both runs used evolving input data and variable database/runtime conditions. This release reduces the number of write requests but has not demonstrated a runtime improvement. The history-publication bottleneck remains unresolved; do not describe this measurement as a speedup or sufficient long-term capacity validation.

Nathan remains at 4.592 overall, 4.666 singles and 4.525 doubles. Phyllis Norman remains at 4.980 and Anne Hope at 5.063. These spot checks agree with the independent replay to stored rounding precision. Tests provide batch-equivalence coverage; spot checks alone do not establish all-player equivalence.

The next substantive improvement should avoid rewriting unchanged history, with explicit removal of stale/excluded rows and an atomic or recoverable publication process. Measure cleanup and upsert durations separately before choosing the implementation. Do not simply extend runtime beyond the current six-minute stale-lock lifetime.

Evidence: `artifacts/rating-evidence/snapshot-batch-production-runtime.log`, `snapshot-batch-live-verification.json`, `snapshot-batch-ci.log`. Merge commit: `a66a455493b9ce3a3f38d7fa097e2a997b70907c`; production deployment: `dpl_D8fWJpbUnNEF21GVeLnpnwa2kCsB`.
