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
Run `npm run qa:next` after logging results to see the next incomplete journey or p0/p1 item.
Run `npm run qa:session-status` after testing to summarize readiness by Day 1 through Day 5 session.
Run `npm run qa:triage` when choosing issue category, severity, and next action.
Run `npm run qa:ledger-check` after editing rows to catch invalid status, category, severity, fixture, route, evidence, or next-action fields.
Run `npm run qa:results` after testing to summarize status counts, missing journeys, and open p0/p1 rows.
Run `npm run qa:action-list` after testing to list the concrete fixes, blockers, and follow-ups by priority.
Run `npm run qa:daily-summary -- <yyyy-mm-dd>` after testing to recap the day and name the top fix.
Run `npm run qa:tier-status` after testing to summarize readiness by role-based tier.
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
- A `mobile-ux-gap` in Level Up should be retested on phone-width viewport after the fix.
- A `content-quality-gap` should be fixed against the tennis behavior, proof signal, and next action.
- `qa:ledger-check` should pass before `qa:launch` is used as a sign-off signal.
- A journey closes only when the result is `pass` and the evidence shows the pain point was actually solved.
