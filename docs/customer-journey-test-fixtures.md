# TenAceIQ Customer Journey Test Fixtures

Use this with `docs/customer-journey-test-scripts.md` during next-week testing. Keep credentials outside the repo. This file records the roles, access expectations, and data fixtures needed to make each journey repeatable. Use `docs/level-up-sync-audit.md` when testing Level Up local, Player+, and coach-invited sync behavior.

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

## Daily Fixture Log

| Date | Fixture | Action | Result | Notes |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Do Not Store Here

- Passwords
- Live customer credentials
- Stripe secrets
- Personal data beyond fixture labels
- Private league or player data that is not safe for repo history
