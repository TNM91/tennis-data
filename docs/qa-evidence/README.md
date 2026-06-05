# TenAceIQ QA Evidence Index

Store customer journey screenshots and short videos here during manual testing. Keep credentials, private customer data, and real customer identifiers out of evidence captures.

Run `npm run qa:evidence-index` when you need this guide in the terminal.

## Folder Pattern

Use the folder printed by `npm run qa:evidence-pack`.

```text
docs/qa-evidence/yyyy-mm-dd/day1
docs/qa-evidence/yyyy-mm-dd/day2
docs/qa-evidence/yyyy-mm-dd/day3
docs/qa-evidence/yyyy-mm-dd/day4
docs/qa-evidence/yyyy-mm-dd/day5
```

Example:

```text
docs/qa-evidence/2026-06-08/day1/2026-06-08-day1-player-level-up-mobile-loop-active-card-phone-nick.png
```

## Capture Standard

Each evidence file should prove the journey signal, not just show that a page loaded.

Good captures show:

- The action the tester completed.
- The tier, fixture, route, or linked state when that matters.
- The saved proof, returned status, assignment, lineup, access, or public context the journey promises.
- The device/viewport risk for phone, tablet, or desktop-sensitive journeys.

Weak captures show:

- A homepage or route with no completed action.
- A generic card that does not prove the tier promise.
- A screen with credentials, tokens, private data, or real customer identifiers.

## Ledger Rule

Paste the generated filenames into the `Screenshot/video` cell in `docs/customer-journey-test-results.md`.

For a pass row, the evidence cell must prove the pain point was solved.

For a fail or needs-follow-up row, add the visible issue evidence when possible. Then run:

```text
npm run qa:issue
npm run qa:ledger-check
npm run qa:action-list
```

## Command Path

1. `npm run qa:evidence-pack -- <day1-day5> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>`
2. Save captures under the printed `docs/qa-evidence/yyyy-mm-dd/dayX` folder.
3. Paste generated filenames into `docs/customer-journey-test-results.md`.
4. Run `npm run qa:ledger-check`.
5. Run `npm run qa:scorecard`.

The closeout question: can someone open the ledger row, find the evidence, and understand why the journey passed or failed without asking the tester?
