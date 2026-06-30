# TenAceIQ Fixture Provisioning Packet

Use this packet to provision, rotate, or repair production QA fixtures. Keep credentials out of git. Store secrets in `.env.local`, a password manager, or the production QA account system only. Use `docs/customer-journey-fixture-env-template.md` as the tracked non-secret env template.

Current state on 2026-06-29:

- 9/9 journeys are signed off with pass evidence.
- No open p0/p1 product blockers are logged.
- The launch ledger is ready; fixture credentials remain local-only and should be reprovisioned with this packet only when an account is missing, expired, or intentionally rotated.

## Reprovisioning Start

When rebuilding fixtures from zero, start with the Day 1 coach/player trust loop because it unlocks the most downstream proof.

1. Provision or confirm `player_plus_linked`.
2. Provision or confirm `coach_primary`.
3. Add these local-only values to `.env.local`:

```env
TENACEIQ_QA_BASE_URL=https://www.tenaceiq.com
TENACEIQ_QA_COACH_EMAIL=
TENACEIQ_QA_COACH_PASSWORD=
TENACEIQ_QA_PLAYER_EMAIL=
TENACEIQ_QA_PLAYER_PASSWORD=
```

4. Run:

```bash
npm run qa:fixture-auth-smoke -- --env
npm run qa:fixture-auth-smoke
npm run qa:fixture-auth-smoke -- coach_primary
npm run qa:fixture-auth-smoke -- player_plus_linked
npm run qa:fixture-gate -- coach-player-assigned-challenge
npm run qa:live-card -- coach-player-assigned-challenge --date=2026-06-29 --tester=<name> --device=phone
```

Do not mark the coach journey pass until Coach Hub, player My Lab or Level Up, invite/link state, assignment, player proof, and coach review are all visible with screenshots.

When later role accounts are ready, add only the needed local-only keys:

```env
TENACEIQ_QA_CAPTAIN_EMAIL=
TENACEIQ_QA_CAPTAIN_PASSWORD=
TENACEIQ_QA_LEAGUE_EMAIL=
TENACEIQ_QA_LEAGUE_PASSWORD=
TENACEIQ_QA_FULL_COURT_EMAIL=
TENACEIQ_QA_FULL_COURT_PASSWORD=
TENACEIQ_QA_ADMIN_EMAIL=
TENACEIQ_QA_ADMIN_PASSWORD=
```

Then run one of:

```bash
npm run qa:fixture-auth-smoke -- captain_primary
npm run qa:fixture-auth-smoke -- league_coordinator
npm run qa:fixture-auth-smoke -- full_court_operator
npm run qa:fixture-auth-smoke -- admin_test
npm run qa:fixture-auth-smoke -- paid
npm run qa:fixture-auth-smoke -- all
```

## Account Fixtures

| Fixture | Must prove | Unblocks |
| --- | --- | --- |
| `player_plus_linked` | Player access, linked profile, My Lab, Level Up completion/return state | `player-level-up-mobile-loop`, `player-my-lab-return-state`, coach journeys |
| `coach_primary` | Coach Hub access, student list, invite, assignment, review | `coach-player-assigned-challenge`, `coach-lesson-support` |
| `captain_primary` | Captain access plus team-week tools | `captain-week-flow` |
| `league_coordinator` | League Office access plus editable safe league | `league-result-to-public-context` |
| `full_court_operator` | Player, Coach, Captain, and League workspaces open without stale locks | `full-court-access-pass` |
| `admin_test` | Admin access limited to safe profiles/import fixtures | `admin-access-and-data-quality` |

## Data Fixtures

| Fixture | Minimum shape | Ready signal |
| --- | --- | --- |
| `linked-player-profile` | Player identity slug, profile context, recent tennis context if available | My Lab names the player and shows a useful next action after refresh |
| `coach-invite-token` | Fresh disposable invite between `coach_primary` and `player_plus_linked` | Coach sees the linked player after acceptance |
| `level-up-assignment` | One exact assigned card, due date, coach note, proof requirement | Player sees the assigned work; coach can find the assignment |
| `level-up-completion` | Proof rating, tiny note, completed date, assignment link when available | Coach review shows the same proof signal |
| `captain-team-week` | Roster, availability states, opponent/context, lineup scenario | Availability feeds lineup/scenario decisions |
| `league-week` | League, participants, schedule, result fixture, standings/public expectation | Safe result changes intended public/member context only |
| `full-court-access-state` | One account with all paid workspaces active | Pricing access pass and all workspaces show no upgrade locks |
| `admin-access-repair` | Test profile, starting access, target access, rollback note | Before/after access is audit-ready and reversible |
| `data-assist-upload` | Safe scorecard or schedule fixture, review status, affected surface | Unreviewed data stays untrusted until review action |

## Rerun Order

After fixtures exist, rerun in this order:

1. `npm run qa:fixture-auth-smoke -- coach_primary`
2. `npm run qa:fixture-auth-smoke -- player_plus_linked`
3. `npm run qa:live-card -- coach-player-assigned-challenge --date=2026-06-29 --tester=<name> --device=phone`
4. `npm run qa:live-card -- player-my-lab-return-state --date=2026-06-29 --tester=<name> --device=desktop`
5. `npm run qa:live-card -- coach-lesson-support --date=2026-06-29 --tester=<name> --device=desktop`
6. `npm run qa:fixture-auth-smoke -- captain_primary`
7. `npm run qa:live-card -- captain-week-flow --date=2026-06-29 --tester=<name> --device=desktop`
8. `npm run qa:fixture-auth-smoke -- league_coordinator`
9. `npm run qa:live-card -- league-result-to-public-context --date=2026-06-29 --tester=<name> --device=desktop`
10. `npm run qa:fixture-auth-smoke -- full_court_operator`
11. `npm run qa:live-card -- full-court-access-pass --date=2026-06-29 --tester=<name> --device=desktop`
12. `npm run qa:fixture-auth-smoke -- admin_test`
13. `npm run qa:live-card -- admin-access-and-data-quality --date=2026-06-29 --tester=<name> --device=desktop`
14. `npm run qa:ledger-check`
15. `npm run qa:scorecard`
16. `npm run qa:launch-board`

## Safety Rules

- Never commit passwords, tokens, private customer data, or real customer screenshots.
- Use only safe test profiles for admin access repair.
- Use only safe league/team/player fixtures for editable data tests.
- If a fixture is missing, log `fixture-gap`, not pass.
- If the UI claims synced or shared state and another role cannot see it, log `sync-gap` or `data-propagation-gap`.
- If a paid account sees stale locks, log `access-gap`.
- If a lower-tier account sees protected controls, log `gating-gap`.

## Current Blocker Summary

Use these commands for the live blocker view:

```bash
npm run qa:fixture-board
npm run qa:action-list
npm run qa:owner-board
npm run qa:launch-board
```
