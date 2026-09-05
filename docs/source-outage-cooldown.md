# Shared source-outage cooldown

## Behavior

- Three **different queue pages** failing without a non-transient response between them open a shared 15-minute pause. Before a pause opens, the failure streak expires after 15 minutes without another failure. Repeated attempts at one isolated bad page do not open it.
- The existing ordinary retry rules apply before the threshold; the triggering page is returned to pending without increasing either retry counter. Other pages are left untouched.
- After expiry, the next normally eligible queued page tests connectivity at the existing pace. Failure immediately pauses again for 30 minutes, then at most 60 minutes per failed recovery test. No special URL, proxy, credentials, user-agent change or increased fetch concurrency is used.
- A real non-transient, non-blocked HTTP response clears the connectivity state. That is **not** proof of a valid result: normal HTTP, parser, winner and identity guards still decide whether anything can import. Cached replay and access blocks never clear the cooldown.
- Access restrictions remain blocked and now stop the checkpoint immediately. They never become outage retries. Database and parser errors do not count as source outages.
- Automatic, weekly, historical and direct/manual sync entry points honor the same persisted state. State is reread after acquiring the existing shared sync-run lock, preventing an invocation with stale settings from bypassing the pause.
- Ratings remain eligible to run during a source pause under the existing lock. No rating math, official level, source result, captain correction, cron cadence or request ceiling changes.
- Operational health reports a temporary source pause. Summaries and sanitized logs include `source_cooldown` and the retry time. No source bodies, player names or URLs are logged for the circuit.

## Failure handling

Cooldown saves are checked. A persistence failure stops the checkpoint rather than continuing to fetch. Fatal checkpoint cleanup returns any still-running pages to pending before marking the run failed. If cleanup itself fails, the run remains reclaimable by the existing stale-run recovery, with its error recorded. Cooldown skips still reclaim already-stale locks so ratings are not blocked for the duration of a source pause.

## Rollout

Published September 5 through PR #1196, master commit `784d52cb`. Production deployment `dpl_9BZT8SJF9et2ReGrQnqb55Vta14R` became READY at 21:33:20 UTC and serves both TenAceIQ domains. The migration was applied before merging; read-back confirms it exists and source pacing remains 18 requests per checkpoint / 3,000 ms. The separate snapshot-write optimization was not included in that release.

Apply additive migration `20260905000400_source_outage_cooldown.sql` before deploying this code. It adds only an empty JSON operational-state column to existing protected settings; it does not alter queue rows, access policies, match records, ratings or existing retry limits. The authoritative column read fails closed if migration is missing.

Do not reset historical/deferred error rows as part of rollout. Those require independent recovery decisions. Verify naturally scheduled cooldown/open/skip/recovery telemetry and current/historical progress; do not induce an outage or force source requests in production.

Rollback: restore the prior application version; leave the additive column for evidence. Do not silently reset saved cooldown or source evidence.

## Verification

Regression coverage includes distinct-page counting across serialized checkpoints, stale failure expiry, bounded backoff, direct/manual and scheduler skips, lock-time rechecks, triggering/probe retry preservation, success reset, replay exclusion, database-error separation, block termination, and persistence/cleanup failures.

Final local verification on September 5: 506 test files / 2,469 tests passed; full lint, standalone typecheck, production build including TypeScript and all 245 prerendered pages, extension syntax check, and diff whitespace check passed. CI and schema audit passed before merge. Preview and production cron authentication smoke checks returned the expected 401 without invoking jobs; the initial post-release error scan was empty. Follow natural checkpoint telemetry for operational acceptance; never trigger source work to manufacture an outage test.
