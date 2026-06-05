# TenAceIQ Customer Journey QA Index

Start here when preparing for next-week journey testing.

## Commands

| Command | Use |
| --- | --- |
| `npm run qa:prep` | Run the core prep packet and deterministic inventory guard in one pass. |
| `npm run qa:status` | Check that the QA docs and commands are present. |
| `npm run qa:day1` | Print the Day 1 trust-loop checklist. |
| `npm run qa:week` | Print the full week testing sequence and fixture list. |
| `npm run qa:fixtures` | Print account, data fixture, and setup-order expectations. |
| `npm run qa:ledger` | Print starter result rows for every planned journey. |
| `npm run qa:flows` | Print tier journey steps, handoffs, access rules, and evidence points. |
| `npm run qa:focus -- <tier-or-journey>` | Print one focused tier or journey flow for manual testing. |
| `npm run qa:matrix` | Print the tier-by-feature QA matrix with pain points and verification mode. |
| `npm run qa:gaps` | Print feature gaps that still need account, fixture, manual, or local-sync proof. |
| `npm run qa:evidence` | Print the proof checklist for each journey before recording results. |
| `npm run qa:triage` | Print issue categories, severity rules, and closeout actions. |
| `npm run qa:results` | Summarize the result ledger, missing journeys, and open p0/p1 items. |
| `npm run qa:launch` | Fail unless every journey has pass evidence and no p0/p1 row remains open. |
| `npm run verify:closeout` | Run deterministic closeout checks. |
| `npm run verify:closeout:live` | Run production closeout checks with browser smoke. |

## Start Here

1. Run `npm run qa:prep`.
2. Open `docs/customer-journey-weekly-runbook.md`.
3. For Day 1, run `npm run qa:day1`.
4. Run `npm run qa:fixtures` while confirming test accounts and safe data.
5. Run `npm run qa:ledger` and paste starter rows into `docs/customer-journey-test-results.md`.
6. Run `npm run qa:flows` before walking a tier end to end.
7. Run `npm run qa:focus -- <tier-or-journey>` while testing one journey at a time.
8. Run focused commands as needed: `npm run qa:matrix`, `npm run qa:gaps`, `npm run qa:evidence`, or `npm run qa:triage`.
9. Run `npm run qa:results` after each testing block.
10. Run `npm run qa:launch` only after the ledger has real pass evidence.
11. Run `npm run verify:closeout:live` after the latest deploy.

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
- Use `npm run qa:prep` at the start of a testing session to confirm the packet, matrix, gap report, evidence checklist, and inventory guard are healthy.
- Use `npm run qa:fixtures` before testing account-dependent journeys; missing fixture means `fixture-gap`, not pass.
- Use `npm run qa:flows` when checking the entry, action, proof, handoff, and return state for a tier.
- Use `npm run qa:focus -- coach` or another tier/flow query when you only want the one path currently under test.
- Treat `sync-gap`, `access-gap`, `gating-gap`, and `data-propagation-gap` as product logic until proven otherwise.
- Treat `fixture-gap` as blocked, not passed.
- Do not close a journey until the result is `pass` and the evidence shows the pain point was solved.
- Use `npm run qa:matrix` when checking whether a tier feature actually solves the documented pain point.
- Use `npm run qa:gaps` when deciding which account, fixture, manual, or local-sync evidence still needs attention.
- Use `npm run qa:evidence` before marking a journey `pass`, especially for sync, access, mobile, and fixture-sensitive flows.
- Use `npm run qa:triage` when choosing the result category, severity, and next action for an issue.
- Use `npm run qa:results` at the end of each testing day to see missing journeys and open high-priority issues.
- Use `npm run qa:launch` as the final manual-evidence gate; it is expected to fail until every journey has a pass row.
