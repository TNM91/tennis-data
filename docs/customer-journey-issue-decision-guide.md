# TenAceIQ Issue Decision Guide

Use this when a tester finds something that might block the journey. The job is to turn the observation into a useful ledger row, a clear owner action, and the right retest path.

## First Decision

| If this happened | Result | Category | Severity starting point | Next action shape |
| --- | --- | --- | --- | --- |
| The tester cannot run the journey because the account, linked state, or safe data is missing. | `blocked` | `fixture-gap` | `p2`, unless access/data risk is present | Create or repair the fixture, then rerun the same journey. |
| The correct paid tier cannot reach the promised workspace or control. | `fail` | `access-gap` | `p0` or `p1` | Fix entitlement/access mapping and retest the tier journey. |
| A lower tier can use paid or protected controls. | `fail` | `gating-gap` | `p0` | Fix gating and retest both lower-tier and correct-tier states. |
| A saved assignment, proof, result, or access change does not appear where the journey expects it. | `fail` | `data-propagation-gap` | `p1` | Trace the source of truth, refresh behavior, cache, and destination surface. |
| UI says or implies sync, but the value only exists locally. | `needs-follow-up` or `fail` | `sync-gap` | `p1` for coach/player or access flows, otherwise `p2` | Clarify the UI or connect real sync, then retest the handoff. |
| The journey works but the player or operator has to scroll, hunt, or decode the next action. | `needs-follow-up` | `mobile-ux-gap` | `p1` for Level Up mobile, otherwise `p2` | Simplify the screen, move the action forward, and retest the required viewport. |
| Drill, planner, recommendation, or copy feels generic and does not help a tennis user act. | `needs-follow-up` | `content-quality-gap` | `p2` | Rewrite around the tennis behavior, proof signal, and next rep. |
| User returns later and cannot tell what changed or what to do next. | `needs-follow-up` | `return-state-gap` | `p1` for paid journeys, otherwise `p2` | Pull recent status, next action, and proof forward. |
| Spacing, wrapping, or visual hierarchy makes a working feature feel rough. | `needs-follow-up` | `visual-polish` | `p2` if usability suffers, otherwise `p3` | Fix layout and rerun the affected viewport. |
| The flow solves the wrong job or creates tier confusion. | `fail` | `product-logic` | `p1` | Rework the flow against the tier pain point before visual polish. |

## Severity Check

Use the highest severity that honestly applies.

| Severity | Use when |
| --- | --- |
| `p0` | Launch risk, wrong data visibility, protected controls exposed, or destructive admin/data behavior. |
| `p1` | A core paid journey or trust loop breaks: Level Up proof, coach assignment, captain lineup, access, sync, or data propagation. |
| `p2` | Important usability, content, fixture, return-state, or visual issue that should be fixed before broad testing ends. |
| `p3` | Polish or follow-up that does not block a journey and does not confuse the tier promise. |

## Ledger Row Formula

Use this formula in `docs/customer-journey-test-results.md`.

```text
Result: pass | fail | blocked | needs-follow-up
Category: one issue category only
Severity: p0 | p1 | p2 | p3
Screenshot/video: evidence filename, even for fail/follow-up rows when the issue is visible
Notes: what happened, where, and why it matters
Next action: owner-style action plus retest command
```

Good next actions:

- Fix coach assignment proof destination, then run `npm run qa:retest -- coach-player-assigned-challenge`.
- Repair `player_plus_linked` fixture, then run `npm run qa:fixture-review -- player_plus_linked` and rerun Day 1 phone packet.
- Collapse prior Level Up selections on mobile, then run `npm run qa:device-card -- phone` and `npm run qa:retest -- player-level-up-mobile-loop`.

Weak next actions:

- Look into it.
- Fix later.
- Needs polish.

## Stop Or Continue

Stop wider testing when:

- There is any open `p0`.
- There is an open `p1` in the Day 1 player/coach trust loop.
- The issue affects access, gating, data visibility, or cross-role sync.
- The fixture is missing for the journey you are trying to prove.

Continue narrower testing when:

- The issue is `p2` or `p3` and does not affect the next journey's fixture, access, or data.
- You can log a specific next action and isolate the retest to one journey or viewport.
- The same day still has another required device pass that does not depend on the broken state.

## Command Path

1. Use `npm run qa:issue` to print this decision shape in the terminal.
2. Use `npm run qa:triage` if you need category definitions.
3. Use `npm run qa:live-card -- <journey-id>` to get the ledger row and evidence names.
4. Use `npm run qa:ledger-check` after editing the row.
5. Use `npm run qa:action-list` to confirm the next action is visible.
6. Use `npm run qa:retest -- <day-or-journey>` after the fix.

The rule: every issue row should tell the next tester exactly what broke, why it matters, what to fix or decide, and which journey proves the fix.
