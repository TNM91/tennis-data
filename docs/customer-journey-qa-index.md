# TenAceIQ Customer Journey QA Index

Start here when preparing for next-week journey testing.

## Commands

| Command | Use |
| --- | --- |
| `npm run qa:prep` | Run the core prep packet and deterministic inventory guard in one pass. |
| `npm run qa:status` | Check that the QA docs and commands are present. |
| `npm run qa:brief -- <day1-day5>` | Print the morning testing card: top risk, fixtures, starter rows, and closeout commands. |
| `npm run qa:next` | Print the next incomplete journey/session from the result ledger. |
| `npm run qa:session -- <day1-day5>` | Print one testing session brief with journeys, fixtures, commands, and handoffs. |
| `npm run qa:session-status -- <day1-day5>` | Read the result ledger and show whether each testing session can move forward. |
| `npm run qa:day -- <day1-day5>` | Print the compact daily driver: focus, proof, ledger rows, and after-testing commands. |
| `npm run qa:journey -- <journey-id \| tier \| search>` | Print one focused journey card with route, fixture, pass signal, fail-fast list, and evidence. |
| `npm run qa:tier -- <tier>` | Print one tier readiness card with promise, features, journeys, blockers, and proof. |
| `npm run qa:tier-status -- <tier>` | Read the result ledger and show whether each tier has pass evidence or blockers. |
| `npm run qa:day1` | Print the Day 1 trust-loop checklist. |
| `npm run qa:week` | Print the full week testing sequence and fixture list. |
| `npm run qa:fixtures` | Print account, data fixture, and setup-order expectations. |
| `npm run qa:ledger` | Print starter result rows for every planned journey. |
| `npm run qa:session-ledger -- <day1-day5>` | Print paste-ready result rows for one testing session, with optional date/tester/device defaults. |
| `npm run qa:flows` | Print tier journey steps, handoffs, access rules, and evidence points. |
| `npm run qa:focus -- <tier-or-journey>` | Print one focused tier or journey flow for manual testing. |
| `npm run qa:handoffs` | Print cross-role handoff checks and shared proof expectations. |
| `npm run qa:matrix` | Print the tier-by-feature QA matrix with pain points and verification mode. |
| `npm run qa:coverage -- <tier>` | Show which journey proves each feature and whether pass evidence has been logged. |
| `npm run qa:risk-board -- <tier \| day \| journey>` | Rank the highest-value journeys to test or fix next across blockers, evidence gaps, and risk. |
| `npm run qa:gaps` | Print feature gaps that still need account, fixture, manual, or local-sync proof. |
| `npm run qa:evidence` | Print the proof checklist for each journey before recording results. |
| `npm run qa:evidence-pack -- <day1-day5>` | Print screenshot/video filenames and ledger evidence cells for a testing day. |
| `npm run qa:triage` | Print issue categories, severity rules, and closeout actions. |
| `npm run qa:ledger-check` | Validate recorded ledger rows before using them for summaries or launch decisions. |
| `npm run qa:results` | Summarize the result ledger, missing journeys, and open p0/p1 items. |
| `npm run qa:action-list` | Print logged fail, blocked, and follow-up rows as a prioritized fix list. |
| `npm run qa:retest -- <day-or-journey>` | Build the rerun list from open rows and missing pass evidence. |
| `npm run qa:daily-summary -- <yyyy-mm-dd>` | Recap one testing day with pass/fail counts, blockers, missing actions, and the top fix. |
| `npm run qa:close-day -- <day1-day5>` | Confirm whether a testing day has pass evidence, screenshots/video, next actions, and a retest queue. |
| `npm run qa:launch` | Fail unless every journey has pass evidence and no p0/p1 row remains open. |
| `npm run verify:closeout` | Run deterministic closeout checks. |
| `npm run verify:closeout:live` | Run production closeout checks with browser smoke. |

## Start Here

1. Run `npm run qa:prep`.
2. Run `npm run qa:brief -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` for the active testing card.
3. Run `npm run qa:risk-board` to see the highest-value journey to prove or fix first.
4. Run `npm run qa:next` to see the next incomplete session.
5. Run `npm run qa:session -- day1` for the active testing session.
6. Run `npm run qa:session-status` after logging results to see session readiness.
7. Run `npm run qa:day -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` for the compact daily driver.
8. Run `npm run qa:journey -- <journey-id>` for the specific journey you are walking.
9. Run `npm run qa:tier -- player` or the tier being tested to keep role expectations clear.
10. Run `npm run qa:tier-status` after logging results to see tier readiness.
11. Open `docs/customer-journey-weekly-runbook.md`.
12. For Day 1, run `npm run qa:day1`.
13. Run `npm run qa:fixtures` while confirming test accounts and safe data.
14. Run `npm run qa:session-ledger -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` for the rows you need in the current session, or `npm run qa:ledger` for every journey.
15. Paste starter rows into `docs/customer-journey-test-results.md`.
16. Run `npm run qa:flows` before walking a tier end to end.
17. Run `npm run qa:focus -- <tier-or-journey>` while testing one journey at a time.
18. Run `npm run qa:handoffs` before testing linked or shared-role workflows.
19. Run `npm run qa:matrix` to keep tier features tied to pain points.
20. Run `npm run qa:coverage -- <tier>` to confirm each feature has a proving journey and logged evidence.
21. Run `npm run qa:evidence-pack -- <day1-day5> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` before saving screenshots or videos.
22. Run focused commands as needed: `npm run qa:gaps`, `npm run qa:evidence`, or `npm run qa:triage`.
23. Run `npm run qa:ledger-check` after adding or editing result rows.
24. Run `npm run qa:results` after each testing block.
25. Run `npm run qa:action-list` to turn open rows into the next fix list.
26. Run `npm run qa:retest -- <day-or-journey>` after fixes to know exactly what needs a clean rerun.
27. Run `npm run qa:daily-summary -- <yyyy-mm-dd>` at the end of each testing day.
28. Run `npm run qa:close-day -- <day1-day5> --date=yyyy-mm-dd` before calling that testing day done.
29. Run `npm run qa:launch` only after the ledger has real pass evidence.
30. Run `npm run verify:closeout:live` after the latest deploy.

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
- Use `npm run qa:brief -- <day1-day5>` as the one-screen morning card for focus, fixtures, ledger rows, and closeout commands.
- Use `npm run qa:risk-board` before broad testing to rank blocker, evidence, and risk priorities.
- Use `npm run qa:next` after logging results to decide the next session or high-priority fix.
- Use `npm run qa:session -- day1` through `day5` to keep each manual testing block focused.
- Use `npm run qa:session-status` after logging results to see whether each testing day is ready to move forward.
- Use `npm run qa:day -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` when you want one compact daily testing card.
- Use `npm run qa:journey -- player-level-up-mobile-loop` or another journey id when you need one field card with the route, fixture, pass signal, fail-fast list, and evidence.
- Use `npm run qa:tier -- coach` or another tier when checking whether that role is test-ready across its features and journeys.
- Use `npm run qa:tier-status` after logging results to see which role-based tiers are still blocked by missing pass evidence or open p0/p1 rows.
- Use `npm run qa:fixtures` before testing account-dependent journeys; missing fixture means `fixture-gap`, not pass.
- Use `npm run qa:session-ledger -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` through `day5` to avoid copying rows for journeys you are not testing that session.
- Use `npm run qa:flows` when checking the entry, action, proof, handoff, and return state for a tier.
- Use `npm run qa:focus -- coach` or another tier/flow query when you only want the one path currently under test.
- Use `npm run qa:handoffs` when checking whether shared work reaches the right role and avoids the wrong one.
- Treat `sync-gap`, `access-gap`, `gating-gap`, and `data-propagation-gap` as product logic until proven otherwise.
- Treat `fixture-gap` as blocked, not passed.
- Do not close a journey until the result is `pass` and the evidence shows the pain point was solved.
- Use `npm run qa:matrix` when checking whether a tier feature actually solves the documented pain point.
- Use `npm run qa:coverage -- <tier>` when checking whether every feature has a proving journey and logged pass evidence.
- Use `npm run qa:gaps` when deciding which account, fixture, manual, or local-sync evidence still needs attention.
- Use `npm run qa:evidence` before marking a journey `pass`, especially for sync, access, mobile, and fixture-sensitive flows.
- Use `npm run qa:evidence-pack -- <day1-day5>` to keep screenshot/video names and ledger evidence cells consistent.
- Use `npm run qa:triage` when choosing the result category, severity, and next action for an issue.
- Use `npm run qa:ledger-check` before trusting summaries, daily recaps, or launch readiness.
- Use `npm run qa:results` at the end of each testing day to see missing journeys and open high-priority issues.
- Use `npm run qa:action-list` after `qa:results` to list every logged fix, blocker, and follow-up by severity and missing next action.
- Use `npm run qa:retest -- day1` or a journey id after fixing issues so reruns stay tied to the original journey.
- Use `npm run qa:daily-summary -- <yyyy-mm-dd>` after `qa:action-list` to record the day-level recap and the top fix to start with next.
- Use `npm run qa:close-day -- <day1-day5>` after the daily summary to confirm pass evidence, screenshots/video, open next actions, and the retest queue.
- Use `npm run qa:launch` as the final manual-evidence gate; it is expected to fail until every journey has a pass row.
