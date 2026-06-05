# TenAceIQ Customer Journey Weekly Runbook

Use this to sequence next-week testing after the Day 1 trust loop. The goal is a complete platform pass by tier and workflow, not a random route tour.

Primary references:

- Day 1 runbook: `docs/customer-journey-day-one-runbook.md`
- Agenda: `docs/customer-journey-test-plan.md`
- Manual scripts: `docs/customer-journey-test-scripts.md`
- Fixtures: `docs/customer-journey-test-fixtures.md`
- Result ledger: `docs/customer-journey-test-results.md`
- Sync audit: `docs/level-up-sync-audit.md`
- Verification log: `docs/platform-closeout-verification-log.md`

## Daily Preflight

1. Pull latest changes.
2. Run `npm run qa:week` to print the week sequence.
3. Run `npm run qa:session -- day1` through `day5` before each testing session.
4. Run `npm run qa:day1` when testing Day 1 journeys.
5. Run `npm run verify:closeout:live` after production deploys.
6. Record the pass or failure in `docs/platform-closeout-verification-log.md`.
7. Confirm the account/data fixtures needed for that day.
8. Prepare result rows in `docs/customer-journey-test-results.md`.

## Day 1: Trust Loop

Goal: prove the highest-trust player/coach loop before broadening.

Journeys:

- `player-level-up-mobile-loop`
- `coach-player-assigned-challenge`

Pass signal: a player can train on phone, save honest proof, and the coach can assign/review without manual cleanup.

Do not move wider if there is a `p0` or `p1` sync, access, gating, or data propagation issue in this loop.

## Day 2: Player And Coach Depth

Goal: make sure the player and coach surfaces still make sense after the trust loop.

Journeys:

- `coach-lesson-support`
- `player-my-lab-return-state`

Pass signal: the player can return and understand what matters next; the coach can turn identity, readiness, and assigned work into the next lesson.

Watch for:

- `return-state-gap` in My Lab.
- `content-quality-gap` in coach planner or player recommendations.
- `product-logic` if planner and Level Up feel like disconnected products.

## Day 3: Captain Week

Goal: test whether Captain tools help someone make a real weekly decision.

Journey:

- `captain-week-flow`

Pass signal: captain moves from availability/readiness to lineup/scenario to team communication without rebuilding context.

Watch for:

- `data-propagation-gap` if availability does not feed lineup decisions.
- `mobile-ux-gap` if captain actions are hard to use on phone.
- `product-logic` if the workflow is a dashboard but not a decision tool.

## Day 4: League And Admin

Goal: prove operator workflows can safely update access/data and member-facing context.

Journeys:

- `league-result-to-public-context`
- `admin-access-and-data-quality`

Pass signal: coordinator/admin actions are fixture-safe, source-of-truth behavior is clear, and public/member surfaces show only what they should.

Watch for:

- `access-gap` or `gating-gap` in admin/league access.
- `data-propagation-gap` from coordinator/admin changes to expected surfaces.
- `fixture-gap` if safe editable league/admin data is missing.

## Day 5: Full-Court And Free/Public Regression

Goal: confirm the product still tells the right story across entry, upgrade, and all-workspace access.

Journeys:

- `full-court-access-pass`
- `free-public-discovery`

Pass signal: public users get value before upgrade prompts, and Full-Court users can move through Player, Coach, Captain, and League without stale locks.

Watch for:

- `access-gap` on paid workspace access.
- `gating-gap` if Free users see paid controls.
- `product-logic` if tier story or workspace routing feels confusing.

## End-Of-Week Closeout

1. Every journey in `docs/customer-journey-test-plan.md` has at least one result row.
2. Every `blocked` result has a fixture owner or environment owner.
3. Every `p0` and `p1` issue has a fix or explicit launch decision.
4. Every `sync-gap`, `access-gap`, `gating-gap`, and `data-propagation-gap` is retested after fix.
5. `npm run verify:closeout:live` passes after the final deploy.
6. The latest production pass is recorded in `docs/platform-closeout-verification-log.md`.
