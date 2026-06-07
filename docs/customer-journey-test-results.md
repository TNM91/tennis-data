# TenAceIQ Customer Journey Test Results

Use this during next-week testing to record what passed, what failed, what was blocked, and what needs another pass. The typed source of truth for statuses and issue categories is `lib/customer-journey-test-results.ts`.

## Statuses

| Status | Meaning |
| --- | --- |
| `pass` | Journey solved the stated pain point with the expected tier, fixture, and evidence. |
| `fail` | Journey was testable but did not meet the pass signal. |
| `blocked` | Journey could not be tested because access, fixture, environment, or data was missing. |
| `needs-follow-up` | Journey mostly worked, but one issue needs a targeted retest before closeout. |

## Issue Categories

| Category | Use When |
| --- | --- |
| `sync-gap` | UI implies account, coach, or cross-device sync but the signal only exists locally. |
| `access-gap` | Correct-tier user sees a lock, redirect, or missing workspace. |
| `gating-gap` | Lower-tier user can use paid controls or protected workflows. |
| `fixture-gap` | Account, linked state, or safe data fixture is missing. |
| `data-propagation-gap` | Saved result, access change, assignment, or import does not appear in the expected surface. |
| `mobile-ux-gap` | Phone flow works technically but requires too much scrolling or hides the next action. |
| `content-quality-gap` | Copy, drill, planner, or recommendation feels generic or does not help the tennis user act. |
| `return-state-gap` | User returns later and cannot tell what happened or what to do next. |
| `visual-polish` | Spacing, alignment, wrapping, or hierarchy makes a working feature feel rough. |
| `product-logic` | Workflow solves the wrong job, creates tier confusion, or asks for unnecessary work. |

## Severity

| Severity | Meaning |
| --- | --- |
| `p0` | Blocks launch or risks wrong access/data visibility. |
| `p1` | Breaks a core paid journey or trust loop. |
| `p2` | Important usability/content issue that should be fixed before broad testing ends. |
| `p3` | Polish or follow-up improvement that does not block the journey. |

## Result Ledger

Copy one row per journey attempt. Keep credentials and private customer data out of this file.

Run `npm run qa:ledger` to print starter rows for every planned journey.
Run `npm run qa:control` when you need the compact test-week scoreboard, next block, session state, tier state, and blockers.
Run `npm run qa:start -- --date=yyyy-mm-dd --tester=<name>` when you want the shortest first testing block and closeout commands.
Run `npm run qa:today -- --date=yyyy-mm-dd --tester=<name>` when you want the active testing-day sheet with required devices, proof targets, and closeout gates.
Run `npm run qa:readiness` before a manual testing block to confirm packet health, current ledger state, missing pass evidence, and first commands.
Run `npm run qa:session-ledger -- <day1-day5>` to print starter rows only for the active testing session. Add `--date=yyyy-mm-dd --tester=<name> --device=<device/browser>` to prefill repeated fields.
Run `npm run qa:week-plan -- --date=yyyy-mm-dd --tester=<name>` when planning the full week across required phone, iPad/tablet, and desktop passes.
Run `npm run qa:tester-packet -- <day1-day5> --device=<phone|tablet|desktop>` when one tester needs the run order for a specific session and device.
Run `npm run qa:kickoff -- <journey-id>` when a tester is ready to walk one journey and needs fixtures, route, evidence, paste-ready row, and closeout gates together.
Run `npm run qa:live-card -- <journey-id>` when you want the route, task, evidence filenames, paste-ready ledger row, and blocked-state commands for one journey.
Run `npm run qa:device-card -- <phone|tablet|desktop>` when deciding what the current viewport must prove before a pass row is trusted.
Run `npm run qa:device-ledger -- <phone|tablet|desktop>` to print paste-ready rows for required device passes with evidence filenames prefilled.
Run `npm run qa:device-status -- <phone|tablet|desktop>` after logging rows to see which required device passes still need evidence.
Run `npm run qa:evidence-index` before capture to confirm the evidence folder, capture standard, and ledger proof rule.
Run `npm run qa:evidence-pack -- <day1-day5>` before saving screenshots or videos so evidence filenames match the ledger.
Run `npm run qa:next` after logging results to see the next incomplete journey or p0/p1 item.
Run `npm run qa:session-status` after testing to summarize readiness by Day 1 through Day 5 session.
Run `npm run qa:triage` when choosing issue category, severity, and next action.
Run `npm run qa:issue` when deciding the result, category, severity, stop/continue call, and retest path for a discovered issue.
Run `npm run qa:proof-gaps -- <day1-day5>` after testing to see missing pass rows, missing screenshot/video, open blockers, and follow-up proof before signoff.
Run `npm run qa:ledger-check` after editing rows to catch invalid status, category, severity, fixture, route, evidence, or next-action fields.
Run `npm run qa:route-review -- <route>` when a result is about what the current page should prove.
Run `npm run qa:access-review -- <tier>` when a result is about wrong access, missing unlocks, stale locks, or protected controls.
Run `npm run qa:tier-board -- <tier>` when a result needs the tier promise, feature pain points, proving journeys, evidence state, blockers, and next command together.
Run `npm run qa:feature-review -- <feature>` when a result is about one feature's route, pain point, proving journey, connected flow, or handoff.
Run `npm run qa:trace -- <tier|journey|feature|route>` when a result needs to be reviewed against tier promise, access rule, proving journeys, handoffs, and ledger evidence together.
Run `npm run qa:fixture-board` when a result is blocked by account access, player/coach link state, safe data setup, or fixture readiness across multiple journeys.
Run `npm run qa:fixture-status -- <day1-day5>` when checking whether a testing block has required fixtures or open fixture-gap blockers.
Run `npm run qa:fixture-review -- <fixture>` when a result is blocked by account setup, linked state, test data, or safe fixture shape.
Run `npm run qa:week-dashboard -- <day1-day5>` when you need the compact week state by tier, fixture, access check, evidence proof, blocker state, and next command.
Run `npm run qa:results` after testing to summarize status counts, missing journeys, and open p0/p1 rows.
Run `npm run qa:action-list` after testing to list the concrete fixes, blockers, and follow-ups by priority.
Run `npm run qa:owner-board` after action review so every open journey or blocker has a named owner lane and next command.
Run `npm run qa:retest -- <day-or-journey>` after fixes to list the exact journeys that need fresh pass evidence.
Run `npm run qa:change-impact -- --files=<comma-separated-files>` after product changes so impacted journeys get fresh evidence.
Run `npm run qa:daily-summary -- <yyyy-mm-dd>` after testing to recap the day and name the top fix.
Run `npm run qa:close-day -- <day1-day5>` before calling a testing day done so missing pass evidence, screenshots/video, next actions, and retests are visible.
Run `npm run qa:tester-handoff -- <day1-day5>` before handing a session to another tester so open rows, missing evidence, fixture-gap blockers, and next commands are visible.
Run `npm run qa:tier-status` after testing to summarize readiness by role-based tier.
Run `npm run qa:scorecard` before signoff meetings to see each tier, session, evidence state, blocker count, and next command in one table.
Run `npm run qa:signoff` before launch readiness so every journey owner, evidence state, and blocker is visible.
Run `npm run qa:launch-board` before the hard launch gate to separate product blockers, fixture/test blockers, quality follow-ups, and missing evidence.
Run `npm run qa:launch` after testing is logged. It should fail until every journey has a `pass` row and no p0/p1 row remains open.

| Date | Tester | Device/browser | Account fixture | Journey ID | Entry route | Result | Category | Severity | Screenshot/video | Notes | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  | pass / fail / blocked / needs-follow-up |  | p0 / p1 / p2 / p3 |  |  |  |
| 2026-06-07 | Codex | Phone 390x844 Chromium production | player_plus_linked | player-level-up-mobile-loop | /player-development/relentless-competitor-4-0/level-up | pass |  |  | docs/qa-evidence/2026-06-07/day1/2026-06-07-day1-player-level-up-mobile-loop-active-card-phone-codex.png; docs/qa-evidence/2026-06-07/day1/2026-06-07-day1-player-level-up-mobile-loop-saved-proof-phone-codex.png | Production Playwright verifier passed: active card visible, proof rating and tiny note saved, next-practice and coach-update copy rendered, local completion persisted. | Continue Day 1 with coach-player-assigned-challenge retest. |

## Daily Summary

| Date | Journeys tested | Passed | Failed | Blocked | Needs follow-up | Top fix |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

## Closeout Use

- A `sync-gap`, `access-gap`, `gating-gap`, or `data-propagation-gap` should be treated as product logic until proven otherwise.
- A `fixture-gap` does not mean the product passed. Create the fixture and rerun.
- Use `qa:control` at the start of a testing conversation so everyone sees the same scoreboard, next block, blockers, and launch gate.
- Use `qa:start` when the full QA command list feels too broad and you need the first useful block.
- Use `qa:today` when a tester needs one day sheet that says which devices to run, which journeys to prove, and how to close the block.
- Use `qa:readiness` to confirm the packet can start even when the ledger is not launch-ready yet.
- Use `qa:week-plan` before broad testing so required device coverage is planned before evidence rows are logged.
- Use `qa:live-card` while actively testing one journey so the same screen tells you what to open, what to prove, what to capture, and what to paste.
- Use `qa:tester-packet` before a device testing block so one tester has the session command, device checks, evidence-pack command, ledger rows, and closeout checks together.
- Use `qa:kickoff` before opening one journey so fixture readiness, evidence capture, paste-ready row, and closeout gates stay on the same card.
- Use `qa:device-card` before logging device-sensitive passes so the row names the device/browser and the evidence proves the viewport-specific risk.
- Use `qa:device-ledger` to avoid hand-building separate phone, iPad/tablet, and desktop rows.
- Use `qa:device-status` after logging results so missing phone, iPad/tablet, or desktop evidence does not get lost in the broader scorecard.
- Use `qa:evidence-index` so screenshots/videos stay under `docs/qa-evidence` and remain traceable from the result ledger.
- Use `qa:route-review` when a page loads but the tester is unsure which feature, journey, or evidence the route is meant to prove.
- Use `qa:access-review` for access, gating, and stale-lock questions before deciding whether the issue is `access-gap`, `gating-gap`, or fixture setup.
- Use `qa:tier-board` when signing off a role so the tier promise, feature pain points, proving journeys, evidence state, blockers, and next command stay visible together.
- Use `qa:feature-review` before closing a feature-specific issue so the fix is tied to the proving journey and connected flow.
- Use `qa:trace` before a tier signoff conversation so promise, pain point, feature access, proving journeys, handoffs, and ledger evidence stay connected.
- Use `qa:fixture-board` before broad testing so account access, player/coach links, safe data fixtures, dependent journeys, and fixture-gap rows are visible together.
- Use `qa:fixture-status` before a testing block so fixture gaps do not get mistaken for product failures or passes.
- Use `qa:fixture-review` before marking `fixture-gap` so the dependent journeys, setup shape, and rerun command are clear.
- A `mobile-ux-gap` in Level Up should be retested on phone-width viewport after the fix.
- A `content-quality-gap` should be fixed against the tennis behavior, proof signal, and next action.
- `qa:ledger-check` should pass before `qa:launch` is used as a sign-off signal.
- Use `qa:evidence-pack` before capture so screenshot/video names prove the journey signal and stay easy to paste into the ledger.
- Use `qa:issue` when an observation needs to become a clean ledger row with a result, category, severity, next action, and retest command.
- Use `qa:proof-gaps` after result rows are logged so missing pass evidence, missing screenshot/video, and open p0/p1 blockers are visible before signoff.
- Use `qa:week-dashboard` when the question is broader than one tier or proof gap: what is the test week state, what evidence is missing, and what should run next?
- Use `qa:owner-board` when a testing issue needs a named owner, backup lane, and next command before handoff.
- Use `qa:retest` after every fix pass so missing or stale pass evidence does not slip through.
- Use `qa:change-impact` after commits or deploys so stale pass evidence is not trusted when product files changed.
- Use `qa:close-day` before ending a testing block so open retests and missing evidence are not carried forward silently.
- Use `qa:tester-handoff` before another tester picks up so they can see what was tested, what is blocked, what evidence exists, and what command to run next.
- Use `qa:scorecard` before signoff so status conversations stay tied to tier, session, evidence, blockers, and the next command.
- Use `qa:signoff` before launch readiness so "done" means pass evidence, screenshot/video evidence, and no open p0/p1.
- Use `qa:launch-board` before `qa:launch` so product blockers, fixture/test blockers, quality follow-ups, and missing evidence are not mixed together.
- A journey closes only when the result is `pass` and the evidence shows the pain point was actually solved.
