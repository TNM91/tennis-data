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
Run `npm run qa:session-ledger -- <day1-day5>` to print starter rows only for the active testing session. Add `--date=yyyy-mm-dd --tester=<name> --device=<device/browser>` to prefill repeated fields.
Run `npm run qa:live-card -- <journey-id>` when you want the route, task, evidence filenames, paste-ready ledger row, and blocked-state commands for one journey.
Run `npm run qa:device-card -- <phone|tablet|desktop>` when deciding what the current viewport must prove before a pass row is trusted.
Run `npm run qa:evidence-pack -- <day1-day5>` before saving screenshots or videos so evidence filenames match the ledger.
Run `npm run qa:next` after logging results to see the next incomplete journey or p0/p1 item.
Run `npm run qa:session-status` after testing to summarize readiness by Day 1 through Day 5 session.
Run `npm run qa:triage` when choosing issue category, severity, and next action.
Run `npm run qa:ledger-check` after editing rows to catch invalid status, category, severity, fixture, route, evidence, or next-action fields.
Run `npm run qa:route-review -- <route>` when a result is about what the current page should prove.
Run `npm run qa:access-review -- <tier>` when a result is about wrong access, missing unlocks, stale locks, or protected controls.
Run `npm run qa:feature-review -- <feature>` when a result is about one feature's route, pain point, proving journey, connected flow, or handoff.
Run `npm run qa:fixture-review -- <fixture>` when a result is blocked by account setup, linked state, test data, or safe fixture shape.
Run `npm run qa:results` after testing to summarize status counts, missing journeys, and open p0/p1 rows.
Run `npm run qa:action-list` after testing to list the concrete fixes, blockers, and follow-ups by priority.
Run `npm run qa:retest -- <day-or-journey>` after fixes to list the exact journeys that need fresh pass evidence.
Run `npm run qa:daily-summary -- <yyyy-mm-dd>` after testing to recap the day and name the top fix.
Run `npm run qa:close-day -- <day1-day5>` before calling a testing day done so missing pass evidence, screenshots/video, next actions, and retests are visible.
Run `npm run qa:tier-status` after testing to summarize readiness by role-based tier.
Run `npm run qa:scorecard` before signoff meetings to see each tier, session, evidence state, blocker count, and next command in one table.
Run `npm run qa:signoff` before launch readiness so every journey owner, evidence state, and blocker is visible.
Run `npm run qa:launch` after testing is logged. It should fail until every journey has a `pass` row and no p0/p1 row remains open.

| Date | Tester | Device/browser | Account fixture | Journey ID | Entry route | Result | Category | Severity | Screenshot/video | Notes | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  | pass / fail / blocked / needs-follow-up |  | p0 / p1 / p2 / p3 |  |  |  |

## Daily Summary

| Date | Journeys tested | Passed | Failed | Blocked | Needs follow-up | Top fix |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

## Closeout Use

- A `sync-gap`, `access-gap`, `gating-gap`, or `data-propagation-gap` should be treated as product logic until proven otherwise.
- A `fixture-gap` does not mean the product passed. Create the fixture and rerun.
- Use `qa:live-card` while actively testing one journey so the same screen tells you what to open, what to prove, what to capture, and what to paste.
- Use `qa:device-card` before logging device-sensitive passes so the row names the device/browser and the evidence proves the viewport-specific risk.
- Use `qa:route-review` when a page loads but the tester is unsure which feature, journey, or evidence the route is meant to prove.
- Use `qa:access-review` for access, gating, and stale-lock questions before deciding whether the issue is `access-gap`, `gating-gap`, or fixture setup.
- Use `qa:feature-review` before closing a feature-specific issue so the fix is tied to the proving journey and connected flow.
- Use `qa:fixture-review` before marking `fixture-gap` so the dependent journeys, setup shape, and rerun command are clear.
- A `mobile-ux-gap` in Level Up should be retested on phone-width viewport after the fix.
- A `content-quality-gap` should be fixed against the tennis behavior, proof signal, and next action.
- `qa:ledger-check` should pass before `qa:launch` is used as a sign-off signal.
- Use `qa:evidence-pack` before capture so screenshot/video names prove the journey signal and stay easy to paste into the ledger.
- Use `qa:retest` after every fix pass so missing or stale pass evidence does not slip through.
- Use `qa:close-day` before ending a testing block so open retests and missing evidence are not carried forward silently.
- Use `qa:scorecard` before signoff so status conversations stay tied to tier, session, evidence, blockers, and the next command.
- Use `qa:signoff` before launch readiness so “done” means pass evidence, screenshot/video evidence, and no open p0/p1.
- A journey closes only when the result is `pass` and the evidence shows the pain point was actually solved.
