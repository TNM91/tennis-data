# TenAceIQ Customer Journey QA Index

Start here when preparing for next-week journey testing.

## Commands

| Command | Use |
| --- | --- |
| `npm run qa:status` | Check that the QA docs and commands are present. |
| `npm run qa:day1` | Print the Day 1 trust-loop checklist. |
| `npm run qa:week` | Print the full week testing sequence and fixture list. |
| `npm run qa:ledger` | Print starter result rows for every planned journey. |
| `npm run qa:matrix` | Print the tier-by-feature QA matrix with pain points and verification mode. |
| `npm run verify:closeout` | Run deterministic closeout checks. |
| `npm run verify:closeout:live` | Run production closeout checks with browser smoke. |

## Start Here

1. Run `npm run qa:status`.
2. Run `npm run qa:week`.
3. Open `docs/customer-journey-weekly-runbook.md`.
4. For Day 1, run `npm run qa:day1`.
5. Run `npm run qa:ledger` and paste starter rows into `docs/customer-journey-test-results.md`.
6. Run `npm run qa:matrix` before tier-by-tier feature testing.
7. Run `npm run verify:closeout:live` after the latest deploy.

## Core Docs

| Doc | Use |
| --- | --- |
| `docs/customer-journey-weekly-runbook.md` | Day-by-day testing sequence. |
| `docs/customer-journey-day-one-runbook.md` | First session focused on Level Up mobile and Coach-to-player assignment. |
| `docs/customer-journey-test-plan.md` | Ordered typed agenda with journey IDs, fixtures, routes, and pass signals. |
| `docs/customer-journey-test-results.md` | Result ledger, issue categories, severity, and daily summary. |
| `docs/customer-journey-test-fixtures.md` | Account and data fixture checklist. |
| `docs/customer-journey-test-scripts.md` | Manual journey steps by tier. |
| `docs/customer-journey-process-map.md` | Tier-by-feature flow map and pain points. |
| `docs/level-up-sync-audit.md` | Level Up local, Player+, coach-invited, and sync behavior. |
| `docs/platform-closeout-verification-log.md` | Production/local closeout pass history. |
| `docs/platform-closeout-qa.md` | Master platform closeout checklist. |

## Testing Order

1. Day 1 trust loop: Level Up mobile and Coach-to-player assigned challenge.
2. Player/Coach depth: Coach Lesson Support and Player My Lab return state.
3. Captain week flow.
4. League and Admin operator flows.
5. Full-Court access and Free/Public regression.

## Result Rules

- Log every journey attempt in `docs/customer-journey-test-results.md`.
- Treat `sync-gap`, `access-gap`, `gating-gap`, and `data-propagation-gap` as product logic until proven otherwise.
- Treat `fixture-gap` as blocked, not passed.
- Do not close a journey until the result is `pass` and the evidence shows the pain point was solved.
- Use `npm run qa:matrix` when checking whether a tier feature actually solves the documented pain point.
