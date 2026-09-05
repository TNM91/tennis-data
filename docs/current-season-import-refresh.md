# Independent current-season importing

## Behavior

The existing authenticated collector cron alternates current-season and historical checkpoints while bootstrap remains active. Current-season work uses its own year/due-date markers on the existing durable queue; it does not reset or replace campaign state. When nothing is due, the opportunity returns to historical work. Both lanes share the existing 18-page maximum (or smaller admin limit), source pacing, three-minute source-work budget, and one-active-run database constraint. Current checkpoints omit historical parser replay.

Current coverage starts from the existing Missouri campaign's current-year public directory seeds and every known source profile explicitly marked MO, read with keyset pagination. Profile seed preparation handles at most 500 profiles per checkpoint and saves a durable cursor only after that page's URLs are queued; the seed completion timestamp advances only after the final page. Known current-year Missouri teams/leagues and the last 45 days of Missouri result pages also become refresh candidates. Candidate selection is server-side, not capped at the first 100 courts. Each checkpoint reopens at most 100 due completed rows, preserving the remainder for later checkpoints. Successful pages become due again after seven days. A page freshly fetched by backfill is not immediately fetched again. Blocked, error and review rows are not reopened by refresh preparation; existing deliberate transient-retry rules remain separate.

The service continues discovering through current-year histories even when a player has no recent match result. New source-format failures and ambiguous winners retain source evidence and review holds. This feature does not bypass source access restrictions or promise results before the source publishes them.

New Missouri discovery requires explicit Missouri district or parsed regional/profile evidence. Missouri Valley alone is not Missouri state. Direct opponent profiles remain references; an out-of-state profile cannot expand unrelated history. Explicit URL years before 2025 or after the current year are rejected for the Missouri campaign. This is not retroactive queue pruning or a comprehensive match-date repair: previously captured records and the historical queue remain intact. Unknown geography stays conservative and may require additional verified seed evidence.

Rating jobs now take the same active-run lock as imports and mark failures for recovery. Weekly-mode results can reach the existing rating cron throughout the week instead of waiting for Wednesday. A completed rebuild clears only requests at or before its input watermark. The calculation algorithm and official USTA levels are unchanged.

## Rollout order

1. Run lint, typecheck, the full tests, production build, and disposable PostgreSQL verification below. Inspect the exact production queue/coverage before activation.
2. Apply migration `20260905000100_independent_current_season_refresh.sql` before deploying this code. It is additive; `current_refresh_enabled` defaults to false. Existing collection is unchanged by the migration alone. It also permits the new ratings lock record, so deploying code first is unsafe.
3. Deploy the verified code while the new lane remains disabled. Verify authenticated cron handling and normal checkpoint/rating logs.
4. Explicitly enable `tennisrecord_collector_settings.current_refresh_enabled` for the singleton row, preserving enabled, campaign state, request pacing, and rating watermarks.
5. Verify a weekly checkpoint during bootstrap, subsequent historical progress, due-page timestamps, held-page preservation, rating completion and no overlapping running jobs. Measure successful source fetches and current-team coverage, not merely completed invocations. Do not declare fall coverage ready from a seed count alone.

To pause the new lane, set only `current_refresh_enabled=false`. Keep the additive schema and source evidence. This stops automatic lane selection but is not a full rollback of discovery hardening or rating-lock code; a full code rollback needs its own reviewed deployment plan. Never remove an active rating lock or roll back the trigger-kind constraint while jobs may use it.

## Local database verification

`scripts/verify-current-refresh-migration.mjs` creates a disposable in-memory PostgreSQL database and never loads production credentials. It requires the test-only `@electric-sql/pglite` package, either installed in an isolated temporary prefix or available as a local module. Set `TIQ_PGLITE_MODULE` to its file URL when using an isolated prefix, then run the script with Node 22.

The fixture executes the actual migration and stored function, checks >100 source courts, bounded release across repeated calls, recent-backfill protection, regional inclusion/exclusion, held states, function permissions, and the shared ratings/collector unique constraint. It is single-connection PostgreSQL testing; it verifies unique-constraint enforcement, not a multi-server load test. Service tests separately exercise the lock-race result, pagination beyond 500 players and mid-seed failure recovery.

## Remaining follow-ups

- Audit and classify the existing out-of-scope backlog before any requeue/removal action.
- Measure source transport causes and current coverage by linked team; no 24-hour freshness SLA is claimed.
- Improve rating persistence efficiency with exact full-engine equivalence checks, without changing the scoring model.
- Extend explicit scope definitions for additional state/section-season campaigns before national activation. This initial current lane is Missouri, not national coverage.

## Verification — September 5, 2026

Story: authenticated scheduled invocation → shared job lock → bounded current-season queue → existing source validation/reconciliation → status response, while historical checkpoints retain processing opportunities.

| Boundary | Result | Evidence |
| --- | --- | --- |
| Static checks | Passed | Full ESLint and typecheck on Node 22.23.2; final changed-file lint clean. |
| Regression suite | Passed | 502 files, 2,415 tests, including current-refresh and rating/import lock tests. |
| PostgreSQL queue behavior | Passed locally | Actual migration/function executed in disposable PostgreSQL fixtures: >100 courts, repeated bounded release, held-state preservation, permissions and shared unique lock. |
| Service checkpoint recovery | Passed locally | 501 profiles across separate calls, failed later-page recovery, bounded URL batches and delayed seed-completion watermark. |
| Production bundle | Passed | Next.js 16.3.0 build, 245 generated pages. |
| Cron request/response guards | Passed locally | Both collector and rating endpoints: missing/wrong token 401, unsupported POST 405, authorized paused invocation 200 with disabled summary. |
| Browser/UI | Not applicable | Background importer change; no visual layout changed. |
| Live source → production database | Not run | Migration, deployment and explicit activation remain pending. No production mutation or source fetch was used for implementation verification. |

The local server used a test-only token and an explicit collector pause switch, then was stopped. `scripts/verify-import-cron-smoke.mjs` reproduces those loopback-only guard checks. These tests establish the code and migration behavior, not a measured live freshness or nationwide-throughput guarantee.
