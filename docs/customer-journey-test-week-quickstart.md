# TenAceIQ Test Week Quickstart

Use this when you are testing next week and need the simplest path from "what should I test now?" to "can we trust this journey?"

The goal is not to run every command. The goal is to prove each tier journey with the right fixture, the right access, the right device evidence, and a clear result in `docs/customer-journey-test-results.md`.

## Daily Rhythm

1. Open `docs/customer-journey-qa-index.md`.
2. Run `npm run qa:prep`.
3. Run `npm run qa:control`.
4. Run `npm run qa:start -- --date=yyyy-mm-dd --tester=<name>`.
5. Run `npm run qa:today -- --date=yyyy-mm-dd --tester=<name>`.
6. Pick the day and device: `npm run qa:tester-packet -- <day1-day5> --device=<phone|tablet|desktop> --date=yyyy-mm-dd --tester=<name>`.
7. Capture proof names before saving screenshots or video: `npm run qa:evidence-pack -- <day1-day5> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>`.
8. Paste or update rows in `docs/customer-journey-test-results.md`.
9. Run `npm run qa:ledger-check`.
10. Run `npm run qa:session-status -- <day1-day5>`.
11. Run `npm run qa:close-day -- <day1-day5> --date=yyyy-mm-dd`.
12. Run `npm run qa:control` again before deciding the next block.

## What Counts As Pass

- A pass must show that the documented pain point is solved for the intended tier.
- A pass needs screenshot or video evidence in the ledger.
- A pass needs the correct route, fixture, tier, device/browser, tester, date, and evidence fields.
- A pass cannot be based on a page loading by itself. The user has to complete the action the journey promises.
- A missing fixture is `fixture-gap`, not pass.
- Wrong access, missing gating, or protected controls appearing for the wrong tier are product gaps until proven otherwise.
- Sync and handoff journeys need both sides checked when the journey involves two roles.
- Any open p0 or p1 row needs a fix, retest, or explicit decision before launch readiness can pass.

## If You Get Stuck

Use the command that matches the question in front of you.

| Question | Command |
| --- | --- |
| What should this route prove? | `npm run qa:route-review -- <route>` |
| What should this tier unlock or hide? | `npm run qa:access-review -- <tier>` |
| What feature is this supposed to validate? | `npm run qa:feature-review -- <feature|tier|route>` |
| What is the full promise, pain point, and proof path? | `npm run qa:trace -- <tier|journey|feature|route>` |
| What account or data setup is missing? | `npm run qa:fixture-review -- <fixture|tier|journey|route>` |
| What should be fixed next? | `npm run qa:action-list` |
| What needs a rerun after a fix? | `npm run qa:retest -- <day-or-journey>` |

## Recommended Week Sweep

| Day | Focus | Proving journeys |
| --- | --- | --- |
| Day 1 | Player and coach trust loop | `player-level-up-mobile-loop`, `coach-player-assigned-challenge` |
| Day 2 | Coach support and Player return state | `coach-lesson-support`, `player-my-lab-return-state` |
| Day 3 | Captain decision flow | `captain-week-flow` |
| Day 4 | League, admin, and data quality | `league-result-to-public-context`, `admin-access-and-data-quality` |
| Day 5 | Access, Free/Public, and final regression | `full-court-access-pass`, `free-public-discovery` |

Each day should include the required phone, tablet, and desktop pass where the tester packet asks for it. Do not save mobile-sensitive journeys for the end of the day; start with the riskiest viewport.

## Closeout Order

Use this order at the end of each testing day.

1. `npm run qa:ledger-check`
2. `npm run qa:results`
3. `npm run qa:action-list`
4. `npm run qa:daily-summary -- <yyyy-mm-dd>`
5. `npm run qa:close-day -- <day1-day5> --date=yyyy-mm-dd`
6. `npm run qa:scorecard`

Use this order before launch readiness.

1. `npm run qa:signoff`
2. `npm run qa:launch`
3. `npm run verify:closeout`
4. `npm run verify:closeout:live`

`npm run qa:launch` is expected to fail until every planned journey has pass evidence and no open p0 or p1 row remains.

## Testing Standard

Keep notes short and action-oriented. Write what broke, what tier or fixture was involved, and what needs to happen next.

Good ledger notes:

- Player+ favorite saves locally, but coach assignment proof did not appear for coach review.
- Captain lineup page loads on phone, but the weekly readiness action is below unrelated content.
- Free user can see public rankings, but protected Player control is visible.

Weak ledger notes:

- Looks okay.
- Maybe broken.
- Needs work.

The closeout question is always: can the next person see the journey, the evidence, the pain point, and the next action without asking for context?
