# TenAceIQ Customer Journey Test Fixtures

Use this with `docs/customer-journey-test-scripts.md` during next-week testing. Keep credentials outside the repo. This file records the roles, access expectations, and data fixtures needed to make each journey repeatable. Use `docs/level-up-sync-audit.md` when testing Level Up local, Player+, and coach-invited sync behavior.

Use `docs/customer-journey-fixture-provisioning-packet.md` when handing the blocked journeys to the person creating test accounts and safe data fixtures.

Run `npm run qa:fixtures` to print the account, data fixture, and setup-order checklist.
Run `npm run qa:fixture-gate -- coach-player-assigned-challenge` to print the executable Day 1 coach-player fixture gate.
Run `npm run qa:fixture-auth-smoke -- --env` to print the local auth env contract without requiring or printing credential values.
Run `npm run qa:fixture-auth-smoke` after setting `TENACEIQ_QA_BASE_URL`, `TENACEIQ_QA_COACH_EMAIL`, `TENACEIQ_QA_COACH_PASSWORD`, `TENACEIQ_QA_PLAYER_EMAIL`, and `TENACEIQ_QA_PLAYER_PASSWORD` in `.env.local` to prove `coach_primary` and `player_plus_linked` can authenticate without printing credentials. Use `TENACEIQ_QA_BASE_URL=https://www.tenaceiq.com` for production QA, or `http://localhost:3000` only when a local dev server is running.
Run `npm run qa:fixture-auth-smoke -- coach_primary` or `npm run qa:fixture-auth-smoke -- player_plus_linked` when only one Day 1 account is ready.
Run `npm run qa:fixture-board` to group account access, player/coach links, team/league data, admin/data safety, dependent journeys, and fixture-gap rows.
Run `npm run qa:fixture-status -- <day1-day5>` to see the fixtures, dependent journeys, and current fixture-gap blockers for a testing block.
Run `npm run qa:fixture-review -- <fixture>` to inspect one fixture's setup needs, dependent journeys, routes, pass signals, and current ledger evidence.

## Account Set

| Fixture | Tier/role | Purpose | Required access | Setup notes |
| --- | --- | --- | --- | --- |
| `free_viewer` | Free / signed out or basic account | Public discovery and upgrade path | Public Explore, players, teams, leagues, rankings, Data Assist entry | Can be signed out for most tests; use a basic account only when auth entry is part of the test. |
| `player_plus_linked` | Player | My Lab, Level Up, player-linked return state | Player access, linked player profile, Level Up local/completion state | Use for Player journey and for the invited-player side of coach tests. |
| `coach_primary` | Coach | Coach hub, invite, assignment, review | Coach access, student list, assignment ability | Must be able to create an invite and see `player_plus_linked` after linking. |
| `captain_primary` | Captain | Captain week flow | Captain access plus Player access | Needs a team fixture with roster, availability, and at least one lineup scenario. |
| `league_coordinator` | League | League Office operations | League coordinator access | Needs a league workspace with participants, schedule, and safe result fixture. |
| `full_court_operator` | Full-Court | Multi-role access pass | Player, Coach, Captain, League workspaces | Use to confirm no stale locks or redundant upgrade prompts across all workspaces. |
| `admin_test` | Admin/Internal | Access repair and data quality | Admin access | Use only with safe test profiles and test import fixtures. |

## Fixture ID Reference

Use these IDs when logging results against `docs/customer-journey-test-plan.md`.

| Fixture ID | Meaning |
| --- | --- |
| `free_viewer` | Signed-out or basic Free/public tester. |
| `player_plus_linked` | Player test account with Player access and a linked tennis profile. |
| `coach_primary` | Coach test account that can invite, assign, and review player work. |
| `captain_primary` | Captain test account with a safe team-week fixture. |
| `league_coordinator` | League test account with safe coordinator workspace data. |
| `full_court_operator` | Full-Court test account with all paid workspaces unlocked. |
| `admin_test` | Admin-only test account for access and data repair checks. |
| `linked-player-profile` | Player profile, identity slug, and recent context fixture. |
| `coach-invite-token` | Fresh disposable coach invite token. |
| `level-up-assignment` | Coach-assigned card or module fixture. |
| `level-up-completion` | Proof rating, tiny note, completion date, and optional assignment link. |
| `captain-team-week` | Roster, availability, opponent/context, and lineup scenario fixture. |
| `league-week` | League schedule, result, standings, and public-page expectation fixture. |
| `data-assist-upload` | Safe scorecard or schedule upload fixture. |
| `full-court-access-state` | All-workspace access fixture with no stale upgrade locks. |
| `admin-access-repair` | Test profile with starting access, target access, and rollback note. |

## Core Data Fixtures

| Fixture | Used by | Purpose | Minimum shape |
| --- | --- | --- | --- |
| Linked player profile | Player, Coach | Validate personalized context and coach-player link | Player profile, identity slug, recent context if available |
| Coach invite token | Coach, Player | Validate coach invite to linked player | Fresh invite token, expected coach id, expected player email |
| Level Up assignment | Coach, Player | Validate assigned challenge and proof loop | One card assignment, one module assignment, due date, coach note, proof requirement |
| Level Up completion | Player, Coach | Validate player proof and coach review | Proof rating 0-5, one tiny note, completed date, assignment link when available |
| Captain team week | Captain | Validate availability to lineup to communication | Team roster, availability states, one opponent/context, one lineup scenario |
| League week | League | Validate coordinator result flow to public context | League, teams/players, schedule, result fixture, standings/public page expectation |
| Data Assist upload | Free, Admin, League | Validate upload/review/import handoff | Safe scorecard or schedule fixture, expected review status, expected product surface |
| Full-Court access state | Full-Court | Validate all-workspace access | One account with all paid workspaces and no stale upgrade locks |
| Admin access repair | Admin | Validate entitlement changes propagate | Test profile, starting access state, intended target access state, rollback note |

## Journey Fixture Matrix

| Journey | Required accounts | Required fixtures | Pass evidence |
| --- | --- | --- | --- |
| Free discovery | `free_viewer` | Optional public seeded detail page | Public context visible before upgrade prompts |
| Data Assist entry | `free_viewer`, `admin_test` if reviewing | Data Assist upload | Upload/review status is clear and unreviewed data is not treated as trusted |
| Player My Lab | `player_plus_linked` | Linked player profile | Player sees personal context and next action after refresh |
| Player Level Up | `player_plus_linked` | Level Up completion | Player starts on phone, scores proof, saves tiny note, sees next action |
| Coach invite/link | `coach_primary`, `player_plus_linked` | Coach invite token | Player links to coach and coach sees linked state |
| Coach assignment/proof | `coach_primary`, `player_plus_linked` | Level Up assignment, Level Up completion | Assignment appears to player, proof returns to coach |
| Coach lesson planner | `coach_primary` | Linked player profile, Level Up assignment if available | Lesson plan supports identity and assigned work |
| Captain week | `captain_primary` | Captain team week | Captain moves from availability to lineup to communication |
| League operations | `league_coordinator` | League week | Result entry/update connects to standings/public context where intended |
| Full-Court access | `full_court_operator` | Full-Court access state | Player, Coach, Captain, and League workspaces open without stale locks |
| Admin access/data | `admin_test` | Admin access repair, Data Assist upload | Access/data repair is reflected in affected product surfaces |

## Fail-Fast Checks

1. If a test requires account sync but only localStorage changes, mark `sync gap`.
2. If a user has the correct tier but sees an upgrade lock, mark `access gap`.
3. If a user lacks the tier but sees paid workflow controls, mark `gating gap`.
4. If data changes in admin/coordinator tools but does not appear in the expected public/member surface, mark `data propagation gap`.
5. If a journey requires a fixture that does not exist, mark `fixture gap`, not product pass/fail.

## Fixture Setup Order

1. Confirm `admin_test` can inspect and repair test profiles.
2. Confirm paid access states for `player_plus_linked`, `coach_primary`, `captain_primary`, `league_coordinator`, and `full_court_operator`.
3. Create or verify linked player profile.
4. Create coach invite token and link player.
5. Create Level Up assignment and completion fixture.
6. Create captain team week fixture.
7. Create league week fixture.
8. Prepare safe Data Assist upload fixture.

## Day 1 Coach-Player Fixture Gate

Use this gate before retesting `coach-player-assigned-challenge`. Do not mark the journey pass until every row below has visible evidence in the browser or test ledger.

| Fixture | Provisioning action | Ready signal | Evidence to capture |
| --- | --- | --- | --- |
| `coach_primary` | Sign in as the coach test account and open `/coach`; if you land on `/login?next=/coach`, authenticate before scoring readiness. | Coach Hub loads with student management, assignment creation, and review queue controls. | Coach Hub screen with no stale upgrade lock. |
| `player_plus_linked` | Sign in as the intended player and confirm the profile link used by My Lab and Level Up. | Player can open `/mylab` and `/player-development/relentless-competitor-4-0/level-up`. | My Lab linked-player cue or Level Up player context. |
| `coach-invite-token` | From `coach_primary`, create a disposable invite and accept it as `player_plus_linked`. | The invite page names the relationship and the coach sees the linked player. | Invite/link state, Linking proof privacy cue, Invite acceptance proof cue, and Coach invite account proof cue. |
| `level-up-assignment` | From `coach_primary`, assign one exact Level Up card with a due date, coach note, and proof requirement. | My Lab shows the assignment for the linked player only, with the exact card handoff. | Assignment id or assignment card with proof required. |
| `level-up-completion` | As `player_plus_linked`, open the assigned card, save a 0-5 proof rating, and add one tiny note. | Save status is honest: local, Player+ synced, or coach-invited synced. | Player challenge screen and proof rating/note state. |
| Coach review proof | Return to `coach_primary` after completion. | Coach review queue shows the same proof signal, note, due state, and next lesson implication. | Coach review proof sync cue and next-focus/next-assignment handoff. |

If a ready signal is missing:

| Fixture | Keep blocked until this is repaired | Ledger category |
| --- | --- | --- |
| `coach_primary` | Repair coach authentication, access, or Coach Hub entitlement before creating invites or assignments. | `fixture-gap` |
| `player_plus_linked` | Repair Player access or linked-player profile before accepting a coach invite. | `fixture-gap` |
| `coach-invite-token` | Create a fresh invite token, accept it with the intended player account, and confirm Coach Hub linked-player state. | `fixture-gap` |
| `level-up-assignment` | Create one exact assigned card after the coach-player link exists; do not substitute a generic drill screenshot. | `fixture-gap` |
| `level-up-completion` | Complete the assigned card as the linked player and capture the save/sync status before coach review. | `fixture-gap` |
| Coach review proof | If the player UI says synced but Coach Hub cannot review it, log `sync-gap` or `data-propagation-gap` instead of `fixture-gap`. | `sync-gap` or `data-propagation-gap` when sync is claimed; otherwise `fixture-gap` |

If any ready signal is missing, log `blocked` with `fixture-gap` unless the UI clearly loaded but failed the product promise. If the UI says proof synced and the coach cannot find it, log `sync-gap` or `data-propagation-gap` instead.

## Daily Fixture Log

| Date | Fixture | Action | Result | Notes |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Do Not Store Here

- Passwords
- Test account secret values, including `TENACEIQ_QA_COACH_PASSWORD`
- Test account secret values, including `TENACEIQ_QA_PLAYER_PASSWORD`
- Live customer credentials
- Stripe secrets
- Personal data beyond fixture labels
- Private league or player data that is not safe for repo history
