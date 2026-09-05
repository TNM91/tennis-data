# Importer timing diagnostics

These changes add structured runtime logs only. They do not change source pacing, retry counts, checkpoint budgets, match interpretation, canonical matching, rating formulas or persistence payloads. No new service, environment variable, database migration or external log destination is required.

## Source attempts

`tennisrecord_source_attempt` records each actual fetch attempt, including its normal retry: run ID, queue ID, page kind, lane (`current`, `bootstrap`, `weekly` or `manual`), one-based attempt, HTTP status, outcome, pacing milliseconds and fetch/body-read milliseconds. A page with a failed first attempt and successful retry produces two events. A request that cannot fit the checkpoint budget produces no attempted-fetch event.

Outcomes distinguish success, HTTP errors, access blocks, timeouts, DNS failures, connection failures, TLS failures and unknown network errors. Categories use allowlisted error codes, not raw messages. Source URLs/query parameters, player names, HTML, credentials and error stacks are omitted. Queue/run IDs permit correlation with restricted importer records. Access blocks still do not retry; transient network retry behavior is unchanged. A logger exception cannot cause another fetch.

## Rating phases

`tennisrecord_rating_timing` records `phase_started`, `phase_finished`, and one `engine_finished` event under the shared rating run ID. Monotonic durations separate player reads, match reads, participant reads, calculation/preparation, finalization, player-rating writes and snapshot writes. A phase-start log remains useful if the host terminates execution before a completion event. Normal exceptions record the failing phase; instrumentation exceptions do not block lock cleanup.

The existing `processing` progress notification now occurs before calculation/preparation instead of after the calculation loop. No mathematical or saved-data behavior changes. The final engine duration also includes result assembly; phase-duration sums can differ slightly due to that work and rounding. An engine success event means the engine finished; the outer rating job may still fail during later watermark/lock persistence, so always check the outer job status too.

## Reading results

Filter production runtime logs by `tennisrecord_source_attempt` or `tennisrecord_rating_timing`. Compare actual source success count, retries, pacing and transport time separately. Compare rating reads, calculation and writes before selecting an optimization. Logs are subject to the hosting platform's retention and delivery behavior; missing events are not proof of zero work, and these logs are not a durable database audit ledger or a complete team-freshness guarantee.

Do not increase concurrency or change the rating model from total duration alone. A captured scorecard or replay timestamp is not proof a team's entire schedule was checked. Verified team/season source mapping and full schedule evidence remain separate work.

## Verification

Fixtures cover sanitized classifications, retry-success accounting, blocked requests, deadline handling, logger exceptions, phase boundaries, failure attribution, and exact equality of all rating outputs, snapshots and write payloads with/without timing for singles/tiebreak and doubles results. Shared source-budget and rating-lock regressions remain enabled. This document describes implementation, not evidence that new timing events are already deployed.
