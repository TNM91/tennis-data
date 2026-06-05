# TenAceIQ Customer Journey QA Index

Start here when preparing for next-week journey testing. Use `docs/customer-journey-test-week-quickstart.md` when you want the shortest human operating guide for the day.

## Commands

| Command | Use |
| --- | --- |
| `npm run qa:prep` | Run the core prep packet and deterministic inventory guard in one pass. |
| `npm run qa:status` | Check that the QA docs and commands are present. |
| `npm run qa:control` | Print the compact mission-control view: scoreboard, next block, sessions, tiers, and blockers. |
| `npm run qa:start` | Print the shortest useful first testing block, commands to run, and closeout checks. |
| `npm run qa:today` | Print the active testing-day sheet with required devices, proof targets, and closeout gates. |
| `npm run qa:readiness` | Print packet health, ledger state, fixture reminders, and the first commands to run. |
| `npm run qa:brief -- <day1-day5>` | Print the morning testing card: top risk, fixtures, starter rows, and closeout commands. |
| `npm run qa:next` | Print the next incomplete journey/session from the result ledger. |
| `npm run qa:session -- <day1-day5>` | Print one testing session brief with journeys, fixtures, commands, and handoffs. |
| `npm run qa:session-status -- <day1-day5>` | Read the result ledger and show whether each testing session can move forward. |
| `npm run qa:day -- <day1-day5>` | Print the compact daily driver: focus, proof, ledger rows, and after-testing commands. |
| `npm run qa:tester-packet -- <day1-day5> --device=<phone \| tablet \| desktop>` | Print one tester-ready run order for a session/device with commands, journeys, evidence, and closeout checks. |
| `npm run qa:journey -- <journey-id \| tier \| search>` | Print one focused journey card with route, fixture, pass signal, fail-fast list, and evidence. |
| `npm run qa:live-card -- <journey-id>` | Print a one-screen live test card with route, task, pass signal, evidence filenames, ledger row, and blocked-state commands. |
| `npm run qa:device-card -- <phone \| tablet \| desktop \| journey-id>` | Print viewport-specific checks, device risk, and live-card commands for a journey or device pass. |
| `npm run qa:device-ledger -- <phone \| tablet \| desktop \| journey-id>` | Print paste-ready result rows for required device passes with evidence filenames prefilled. |
| `npm run qa:device-status -- <phone \| tablet \| desktop \| journey-id>` | Read the result ledger and show required, passed, and missing device evidence by journey. |
| `npm run qa:route-review -- </route \| tier \| feature \| journey>` | Print what the current browser route should prove across features, journeys, fixtures, and evidence. |
| `npm run qa:tier -- <tier>` | Print one tier readiness card with promise, features, journeys, blockers, and proof. |
| `npm run qa:tier-status -- <tier>` | Read the result ledger and show whether each tier has pass evidence or blockers. |
| `npm run qa:access-review -- <tier>` | Print tier unlock, protected-control, fixture, feature, and proving-journey checks. |
| `npm run qa:day1` | Print the Day 1 trust-loop checklist. |
| `npm run qa:week` | Print the full week testing sequence and fixture list. |
| `npm run qa:week-plan -- <day1-day5>` | Print the full week or one day as device-specific tester-packet commands with closeout gates. |
| `npm run qa:fixtures` | Print account, data fixture, and setup-order expectations. |
| `npm run qa:fixture-status -- <day1-day5 \| fixture \| journey \| route>` | Print required fixtures, dependent journeys, and fixture-gap blockers for a testing block. |
| `npm run qa:fixture-review -- <fixture \| tier \| journey \| route>` | Print one fixture's setup needs, dependent journeys, routes, and evidence state. |
| `npm run qa:ledger` | Print starter result rows for every planned journey. |
| `npm run qa:session-ledger -- <day1-day5>` | Print paste-ready result rows for one testing session, with optional date/tester/device defaults. |
| `npm run qa:flows` | Print tier journey steps, handoffs, access rules, and evidence points. |
| `npm run qa:trace -- <tier \| journey \| feature \| route>` | Print tier promise, pain point, features, proving journeys, handoffs, and ledger evidence in one trace. |
| `npm run qa:focus -- <tier-or-journey>` | Print one focused tier or journey flow for manual testing. |
| `npm run qa:handoffs` | Print cross-role handoff checks and shared proof expectations. |
| `npm run qa:matrix` | Print the tier-by-feature QA matrix with pain points and verification mode. |
| `npm run qa:feature-review -- <feature \| tier \| route>` | Print one feature's tier, route, pain point, proving journeys, connected flows, and evidence state. |
| `npm run qa:coverage -- <tier>` | Show which journey proves each feature and whether pass evidence has been logged. |
| `npm run qa:risk-board -- <tier \| day \| journey>` | Rank the highest-value journeys to test or fix next across blockers, evidence gaps, and risk. |
| `npm run qa:change-impact -- --files=<comma-separated-files>` | Map changed files to journeys that need fresh evidence after a commit or deploy. |
| `npm run qa:gaps` | Print feature gaps that still need account, fixture, manual, or local-sync proof. |
| `npm run qa:evidence` | Print the proof checklist for each journey before recording results. |
| `npm run qa:evidence-index` | Print the evidence folder, capture standard, ledger rule, and closeout commands. |
| `npm run qa:evidence-pack -- <day1-day5>` | Print screenshot/video filenames and ledger evidence cells for a testing day. |
| `npm run qa:triage` | Print issue categories, severity rules, and closeout actions. |
| `npm run qa:issue` | Print the issue decision guide: result, category, severity, next action, and retest path. |
| `npm run qa:ledger-check` | Validate recorded ledger rows before using them for summaries or launch decisions. |
| `npm run qa:results` | Summarize the result ledger, missing journeys, and open p0/p1 items. |
| `npm run qa:action-list` | Print logged fail, blocked, and follow-up rows as a prioritized fix list. |
| `npm run qa:retest -- <day-or-journey>` | Build the rerun list from open rows and missing pass evidence. |
| `npm run qa:daily-summary -- <yyyy-mm-dd>` | Recap one testing day with pass/fail counts, blockers, missing actions, and the top fix. |
| `npm run qa:close-day -- <day1-day5>` | Confirm whether a testing day has pass evidence, screenshots/video, next actions, and a retest queue. |
| `npm run qa:tester-handoff -- <day1-day5 \| journey \| tier>` | Print what was tested, what carries forward, what evidence exists, and the next commands for another tester. |
| `npm run qa:scorecard` | Print the compact tier, session, evidence, blocker, and next-command status table. |
| `npm run qa:signoff` | Print the final journey signoff sheet with owners, evidence state, and launch blockers. |
| `npm run qa:launch` | Fail unless every journey has pass evidence and no p0/p1 row remains open. |
| `npm run verify:closeout` | Run deterministic closeout checks. |
| `npm run verify:closeout:live` | Run production closeout checks with browser smoke. |

## Start Here

1. Run `npm run qa:prep`.
2. Open `docs/customer-journey-test-week-quickstart.md` for the daily operating rhythm and pass rules.
3. Run `npm run qa:control` for the compact scoreboard, next block, session state, tier state, and blocker count.
4. Run `npm run qa:start -- --date=yyyy-mm-dd --tester=<name>` for the shortest useful first testing block.
5. Run `npm run qa:today -- --date=yyyy-mm-dd --tester=<name>` for the active testing-day sheet.
6. Run `npm run qa:readiness` to confirm the packet is ready to start and the ledger state is understood.
7. Run `npm run qa:brief -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` for the active testing card.
8. Run `npm run qa:risk-board` to see the highest-value journey to prove or fix first.
9. Run `npm run qa:next` to see the next incomplete session.
10. Run `npm run qa:session -- day1` for the active testing session.
11. Run `npm run qa:session-status` after logging results to see session readiness.
12. Run `npm run qa:day -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` for the compact daily driver.
13. Run `npm run qa:tester-packet -- day1 --device=phone --date=yyyy-mm-dd --tester=<name>` for a session/device run order.
14. Run `npm run qa:journey -- <journey-id>` for the specific journey you are walking.
15. Run `npm run qa:live-card -- <journey-id> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` when you are ready to execute and record the journey.
16. Run `npm run qa:device-card -- phone` or the device being tested so viewport-specific risks stay explicit.
17. Run `npm run qa:device-ledger -- phone --date=yyyy-mm-dd --tester=<name>` to print rows for the device pass.
18. Run `npm run qa:device-status -- phone` after logging results to see whether device evidence is actually covered.
19. Run `npm run qa:route-review -- /coach` or the route you are currently testing to see what the page should prove.
20. Run `npm run qa:tier -- player` or the tier being tested to keep role expectations clear.
21. Run `npm run qa:tier-status` after logging results to see tier readiness.
22. Run `npm run qa:access-review -- player` or the tier being tested to confirm unlock and protected-control expectations.
23. Open `docs/customer-journey-weekly-runbook.md`.
24. For Day 1, run `npm run qa:day1`.
25. Run `npm run qa:week-plan -- --date=yyyy-mm-dd --tester=<name>` to map the week into device-specific tester packets.
26. Run `npm run qa:fixtures` while confirming test accounts and safe data.
27. Run `npm run qa:fixture-status -- day1` or the active day before opening the browser.
28. Run `npm run qa:fixture-review -- coach_primary` or the fixture being used to see dependent journeys and setup needs.
29. Run `npm run qa:session-ledger -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` for the rows you need in the current session, or `npm run qa:ledger` for every journey.
30. Paste starter rows into `docs/customer-journey-test-results.md`.
31. Run `npm run qa:flows` before walking a tier end to end.
32. Run `npm run qa:trace -- <tier | journey | feature | route>` when reviewing tier promise, pain point, feature access, proving journeys, and ledger state together.
33. Run `npm run qa:focus -- <tier-or-journey>` while testing one journey at a time.
34. Run `npm run qa:handoffs` before testing linked or shared-role workflows.
35. Run `npm run qa:matrix` to keep tier features tied to pain points.
36. Run `npm run qa:feature-review -- player-level-up` or another feature when a specific tool needs a focused contract check.
37. Run `npm run qa:coverage -- <tier>` to confirm each feature has a proving journey and logged evidence.
38. Run `git diff --name-only <last-tested-sha-or-tag>..HEAD`, then `npm run qa:change-impact -- --files=<comma-separated-files>` after a commit or deploy to see which journeys need fresh evidence.
39. Run `npm run qa:evidence-index` to confirm where screenshots/videos go and what the ledger evidence cell should prove.
40. Run `npm run qa:evidence-pack -- <day1-day5> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` before saving screenshots or videos.
41. Run focused commands as needed: `npm run qa:gaps`, `npm run qa:evidence`, `npm run qa:triage`, or `npm run qa:issue`.
42. Run `npm run qa:ledger-check` after adding or editing result rows.
43. Run `npm run qa:results` after each testing block.
44. Run `npm run qa:action-list` to turn open rows into the next fix list.
45. Run `npm run qa:retest -- <day-or-journey>` after fixes to know exactly what needs a clean rerun.
46. Run `npm run qa:daily-summary -- <yyyy-mm-dd>` at the end of each testing day.
47. Run `npm run qa:close-day -- <day1-day5> --date=yyyy-mm-dd` before calling that testing day done.
48. Run `npm run qa:tester-handoff -- <day1-day5>` before another tester or future session picks up the work.
49. Run `npm run qa:scorecard` for the compact meeting/status view across every journey.
50. Run `npm run qa:signoff` to confirm journey owners, evidence, and blockers.
51. Run `npm run qa:launch` only after the ledger has real pass evidence.
52. Run `npm run verify:closeout:live` after the latest deploy.

## Core Docs

| Doc | Use |
| --- | --- |
| `docs/customer-journey-test-week-quickstart.md` | Short daily operating guide, pass rules, stuck paths, and closeout order. |
| `docs/customer-journey-issue-decision-guide.md` | Issue result, category, severity, next action, and retest decision guide. |
| `docs/customer-journey-weekly-runbook.md` | Day-by-day testing sequence. |
| `docs/customer-journey-day-one-runbook.md` | First session focused on Level Up mobile and Coach-to-player assignment. |
| `docs/customer-journey-test-plan.md` | Ordered typed agenda with journey IDs, fixtures, routes, and pass signals. |
| `docs/customer-journey-test-results.md` | Result ledger, issue categories, severity, and daily summary. |
| `docs/qa-evidence/README.md` | Evidence folder pattern, capture standard, and ledger proof rules. |
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
- Use `npm run qa:control` when you need the compact meeting view before deciding where to test next.
- Use `npm run qa:start -- --date=yyyy-mm-dd --tester=<name>` when you want one short first testing block instead of the full command list.
- Use `npm run qa:today -- --date=yyyy-mm-dd --tester=<name>` when you want the active testing day, required devices, proof targets, and closeout gates together.
- Use `npm run qa:readiness` before manual testing to separate packet readiness from launch readiness.
- Use `npm run qa:brief -- <day1-day5>` as the one-screen morning card for focus, fixtures, ledger rows, and closeout commands.
- Use `npm run qa:risk-board` before broad testing to rank blocker, evidence, and risk priorities.
- Use `npm run qa:next` after logging results to decide the next session or high-priority fix.
- Use `npm run qa:session -- day1` through `day5` to keep each manual testing block focused.
- Use `npm run qa:session-status` after logging results to see whether each testing day is ready to move forward.
- Use `npm run qa:day -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` when you want one compact daily testing card.
- Use `npm run qa:tester-packet -- day1 --device=phone --date=yyyy-mm-dd --tester=<name>` when one tester is about to run a specific session/device pass.
- Use `npm run qa:journey -- player-level-up-mobile-loop` or another journey id when you need one field card with the route, fixture, pass signal, fail-fast list, and evidence.
- Use `npm run qa:live-card -- player-level-up-mobile-loop --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` when you want the route, task, screenshot names, paste-ready ledger row, and blocked-state commands on one screen.
- Use `npm run qa:device-card -- phone`, `tablet`, `desktop`, or a journey id before a viewport pass so mobile, iPad, and desktop expectations are not generic.
- Use `npm run qa:device-ledger -- phone --date=yyyy-mm-dd --tester=<name>` or another device/journey filter to create the exact rows needed for device coverage.
- Use `npm run qa:device-status -- phone`, `tablet`, `desktop`, or a journey id after logging results so missing device evidence stays visible.
- Use `npm run qa:route-review -- /mylab` or another route when you are already on a page and need its feature, journey, fixture, and evidence contract.
- Use `npm run qa:tier -- coach` or another tier when checking whether that role is test-ready across its features and journeys.
- Use `npm run qa:tier-status` after logging results to see which role-based tiers are still blocked by missing pass evidence or open p0/p1 rows.
- Use `npm run qa:access-review -- coach` or another tier when checking what should unlock, what must stay hidden, and which journey proves it.
- Use `npm run qa:week-plan -- --date=yyyy-mm-dd --tester=<name>` before broad testing so each day has the required phone, iPad/tablet, and desktop tester packets.
- Use `npm run qa:trace -- player` or another tier/search term when you need the promise, pain point, access rule, features, proving journeys, handoffs, and ledger evidence in one trace.
- Use `npm run qa:fixtures` before testing account-dependent journeys; missing fixture means `fixture-gap`, not pass.
- Use `npm run qa:fixture-status -- day1` through `day5` before a testing block so required fixtures and fixture-gap blockers are visible.
- Use `npm run qa:fixture-review -- level-up-assignment` or another fixture when checking setup shape, dependent journeys, and ledger evidence.
- Use `npm run qa:session-ledger -- day1 --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` through `day5` to avoid copying rows for journeys you are not testing that session.
- Use `npm run qa:flows` when checking the entry, action, proof, handoff, and return state for a tier.
- Use `npm run qa:focus -- coach` or another tier/flow query when you only want the one path currently under test.
- Use `npm run qa:handoffs` when checking whether shared work reaches the right role and avoids the wrong one.
- Treat `sync-gap`, `access-gap`, `gating-gap`, and `data-propagation-gap` as product logic until proven otherwise.
- Treat `fixture-gap` as blocked, not passed.
- Do not close a journey until the result is `pass` and the evidence shows the pain point was solved.
- Use `npm run qa:matrix` when checking whether a tier feature actually solves the documented pain point.
- Use `npm run qa:feature-review -- coach-invite-link` or another feature when you need the route, proof journey, connected flow, and evidence state together.
- Use `npm run qa:coverage -- <tier>` when checking whether every feature has a proving journey and logged pass evidence.
- Use `npm run qa:change-impact -- --files=<comma-separated-files>` after product changes so fresh retests are tied to changed files instead of memory.
- Use `npm run qa:gaps` when deciding which account, fixture, manual, or local-sync evidence still needs attention.
- Use `npm run qa:evidence` before marking a journey `pass`, especially for sync, access, mobile, and fixture-sensitive flows.
- Use `npm run qa:evidence-index` before capture so evidence is saved under `docs/qa-evidence` and stays traceable from the ledger.
- Use `npm run qa:evidence-pack -- <day1-day5>` to keep screenshot/video names and ledger evidence cells consistent.
- Use `npm run qa:triage` when choosing the result category, severity, and next action for an issue.
- Use `npm run qa:issue` when deciding whether to stop wider testing, how to score severity, and what retest command belongs in the next action.
- Use `npm run qa:ledger-check` before trusting summaries, daily recaps, or launch readiness.
- Use `npm run qa:results` at the end of each testing day to see missing journeys and open high-priority issues.
- Use `npm run qa:action-list` after `qa:results` to list every logged fix, blocker, and follow-up by severity and missing next action.
- Use `npm run qa:retest -- day1` or a journey id after fixing issues so reruns stay tied to the original journey.
- Use `npm run qa:daily-summary -- <yyyy-mm-dd>` after `qa:action-list` to record the day-level recap and the top fix to start with next.
- Use `npm run qa:close-day -- <day1-day5>` after the daily summary to confirm pass evidence, screenshots/video, open next actions, and the retest queue.
- Use `npm run qa:tester-handoff -- <day1-day5>` before handing work to another tester so open rows, missing evidence, fixture-gap blockers, and next commands are visible.
- Use `npm run qa:scorecard` before signoff meetings to see each tier, session, evidence state, blockers, and next command in one table.
- Use `npm run qa:signoff` before launch readiness to see which journey owners can call their flow done.
- Use `npm run qa:launch` as the final manual-evidence gate; it is expected to fail until every journey has a pass row.
