# TenAceIQ Test Week Quickstart

Use this when you are testing next week and need the simplest path from "what should I test now?" to "can we trust this journey?"

The goal is not to run every command. The goal is to prove each tier journey with the right fixture, the right access, the right device evidence, and a clear result in `docs/customer-journey-test-results.md`.

## Daily Rhythm

1. Open `docs/customer-journey-qa-index.md`.
2. Run `npm run qa:prep`.
3. Run `npm run qa:control`.
4. Run `npm run qa:start -- --date=yyyy-mm-dd --tester=<name>`.
5. Run `npm run qa:today -- --date=yyyy-mm-dd --tester=<name>`.
6. Run `npm run qa:week-dashboard` to see the week state by day, tier, fixture, evidence, blocker, and next command.
7. Pick the day and device: `npm run qa:tester-packet -- <day1-day5> --device=<phone|tablet|desktop> --date=yyyy-mm-dd --tester=<name>`.
8. Run `npm run qa:kickoff -- <journey-id> --device=<phone|tablet|desktop> --date=yyyy-mm-dd --tester=<name>` when you are ready to walk one journey.
9. Run `npm run qa:fixture-board` when account access, linked-player/coach state, or safe data setup needs a full readiness view.
10. Run `npm run qa:fixture-status -- <day1-day5>` to confirm required fixtures before opening the browser.
11. Run `npm run qa:evidence-index` to confirm the evidence folder and capture standard.
12. Capture proof names before saving screenshots or video: `npm run qa:evidence-pack -- <day1-day5> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>`.
13. Paste or update rows in `docs/customer-journey-test-results.md`.
14. Run `npm run qa:ledger-check`.
15. Run `npm run qa:session-status -- <day1-day5>`.
16. Run `npm run qa:close-day -- <day1-day5> --date=yyyy-mm-dd`.
17. Run `git diff --name-only <last-tested-sha-or-tag>..HEAD`, then `npm run qa:change-impact -- --files=<comma-separated-files>` after any code change or deploy.
18. Run `npm run qa:tester-handoff -- <day1-day5> --date=yyyy-mm-dd`.
19. Run `npm run qa:control` again before deciding the next block.

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
| What is this tier's promise, feature proof, and next command? | `npm run qa:tier-board -- <tier>` |
| What is the whole test week status? | `npm run qa:week-dashboard -- <day1-day5|tier|journey>` |
| What feature is this supposed to validate? | `npm run qa:feature-review -- <feature|tier|route>` |
| What is the full promise, pain point, and proof path? | `npm run qa:trace -- <tier|journey|feature|route>` |
| What do I need before testing one journey? | `npm run qa:kickoff -- <journey-id>` |
| What account or data setup is missing? | `npm run qa:fixture-review -- <fixture|tier|journey|route>` |
| Are account access and safe data fixtures ready? | `npm run qa:fixture-board` |
| Is this testing block fixture-ready? | `npm run qa:fixture-status -- <day1-day5>` |
| Where should screenshots/videos go? | `npm run qa:evidence-index` |
| How should I log this issue? | `npm run qa:issue` |
| What proof is still missing? | `npm run qa:proof-gaps -- <day-or-journey>` |
| What should be fixed next? | `npm run qa:action-list` |
| Who owns this journey or blocker? | `npm run qa:owner-board -- <owner|tier|day1-day5|journey>` |
| What needs a rerun after a fix? | `npm run qa:retest -- <day-or-journey>` |
| What changed and needs fresh evidence? | `npm run qa:change-impact -- --files=<comma-separated-files>` |
| What should the next tester pick up? | `npm run qa:tester-handoff -- <day1-day5>` |
| What actually blocks launch? | `npm run qa:launch-board` |

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
3. `npm run qa:issue` if any row needs a result/category/severity decision.
4. `npm run qa:evidence-index` if any row is missing screenshot/video proof.
5. `npm run qa:proof-gaps -- <day1-day5>`
6. `npm run qa:week-dashboard -- <day1-day5>`
7. `npm run qa:tier-board`
8. `npm run qa:action-list`
9. `npm run qa:owner-board`
10. `npm run qa:daily-summary -- <yyyy-mm-dd>`
11. `npm run qa:close-day -- <day1-day5> --date=yyyy-mm-dd`
12. `npm run qa:change-impact -- --files=<comma-separated-files>` after code changes or deploys.
13. `npm run qa:tester-handoff -- <day1-day5> --date=yyyy-mm-dd`
14. `npm run qa:scorecard`

Use this order before launch readiness.

1. `npm run qa:signoff`
2. `npm run qa:launch-board`
3. `npm run qa:launch`
4. `npm run verify:closeout`
5. `npm run verify:closeout:live`

`npm run qa:launch` fails until every planned journey has pass evidence and no open p0 or p1 row remains. It should stay green for the current signed-off ledger.

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
