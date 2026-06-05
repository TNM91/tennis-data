# TenAceIQ Customer Journey Test Plan

Use this as the next-week testing agenda. The typed source of truth is `lib/customer-journey-test-plan.ts`; the feature source of truth remains `lib/platform-closeout-inventory.ts`.

## How To Run The Week

1. Start with the lowest-device-tolerance work: Level Up on a phone.
2. Then test the linked Coach to Player loop because it is the highest trust workflow.
3. Record evidence for every pass, fail, blocked fixture, and sync gap.
4. Keep each result tied to the pain point in `docs/customer-journey-process-map.md`.
5. Update the typed plan first when a journey, fixture, or fail-fast signal changes.

Automation rule: every entry route in this agenda must be covered by `scripts/verify-platform-routes.mjs` so live closeout smoke keeps matching the journeys we plan to test.

## Testing Agenda

| Order | Journey | Tier | Entry | Risk | Persona | Success Signal |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Player Level Up mobile loop | Player | `/player-development/relentless-competitor-4-0/level-up` | critical | `player_plus_linked` | Active training becomes the main screen, proof saves honestly, and the next action is obvious. |
| 2 | Coach to player assigned challenge | Coach | `/coach` | critical | `coach_primary` | Invite, assignment, player challenge, proof, and coach review close the loop without manual cleanup. |
| 3 | Coach lesson support | Coach | `/player-development/relentless-competitor-4-0/coach-planner` | high | `coach_primary` | The planner is coach-facing, practical, and connected to the player Level Up path. |
| 4 | Player My Lab return state | Player | `/mylab` | high | `player_plus_linked` | My Lab makes the player identity, linked profile, and next action clear after refresh. |
| 5 | Captain week flow | Captain | `/captain` | high | `captain_primary` | Captain can make a weekly decision and produce a useful team-facing update. |
| 6 | League result to public context | League | `/league-coordinator` | high | `league_coordinator` | Coordinator operation and member-facing league context stay connected without exposing private controls. |
| 7 | Full-Court access pass | Full-Court | `/pricing` | medium | `full_court_operator` | All paid workspaces open cleanly and the user can tell which workspace fits the job. |
| 8 | Admin access and data quality | Admin/Internal | `/admin/access` | high | `admin_test` | Access/data repair is understandable, fixture-safe, and reflected in affected product surfaces. |
| 9 | Free public discovery | Free | `/explore` | medium | `free_viewer` | Public tennis intelligence is visible first, and upgrade/data-assist paths are clear. |

## Fail-Fast Themes

| Theme | Watch For |
| --- | --- |
| Sync trust | Local proof, favorites, or copied updates being presented as account sync. |
| Access trust | Correct-tier users seeing locks, or unpaid users seeing paid controls. |
| Mobile action | Level Up requiring too much scrolling before the active drill or proof action. |
| Tennis value | Drill or planner copy feeling generic instead of tied to a tennis behavior. |
| Fixture safety | Admin, league, and data-assist tests touching unsafe live data. |
| Return state | Player, coach, captain, or coordinator returning later with no clear next action. |

## Evidence To Capture

Use the evidence template in `docs/customer-journey-test-scripts.md`. For every journey, capture:

- Device/browser.
- Account fixture.
- Entry URL.
- Pass/fail/blocked result.
- Screenshot or video for visual issues.
- Data fixture used.
- Sync/access status text when relevant.
- One sentence on whether the pain point was actually solved.

## Closeout Rule

A journey is not test-ready just because the route loads. It is test-ready when the right tier can enter, act, save or share the important signal, return later, and understand the next useful tennis action.
