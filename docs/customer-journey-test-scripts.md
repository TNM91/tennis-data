# TenAceIQ Customer Journey Test Scripts

Use this next week as the manual QA playbook. The companion process map is `docs/customer-journey-process-map.md`; the source of truth for feature status and pain points is `lib/platform-closeout-inventory.ts`; the account and data fixture plan is `docs/customer-journey-test-fixtures.md`.

## Test Rules

- Test the journey as the customer, not as the builder.
- Record the device, browser, tier/account, URL, expected result, actual result, and screenshot when something feels off.
- Mark each step as `pass`, `fail`, `blocked`, or `needs follow-up`.
- When a workflow is `local`, confirm whether the user understands that it is saved locally or whether the experience implies true account sync.
- When a workflow is `manual` or `needs-account`, capture exactly what account/data fixture is missing.
- A feature only passes if it solves the pain point listed here and in the process map.

## Evidence Template

| Field | Value |
| --- | --- |
| Date |  |
| Tester |  |
| Device/browser |  |
| Tier/account |  |
| Journey |  |
| Feature |  |
| Result | pass / fail / blocked / needs follow-up |
| Screenshot/video |  |
| Notes |  |
| Next action |  |

## Global Smoke Before Journey Testing

1. Open `/`.
2. Confirm primary navigation is visible and not duplicated.
3. Open `/pricing`.
4. Confirm Free, Player, Coach, Captain, League, and Full-Court tier language is understandable.
5. Open `/player-development`.
6. Confirm Player Development points clearly to Level Up, workbook, and coach/lesson plan routes.
7. Run `npm run verify:closeout:live` after deploy or `npm run verify:closeout -- --browser-base=<local-url>` for local browser smoke.

Pass signal: a tester can understand where to start, what tier unlocks what, and where the next tennis action lives.

## Fixture Readiness Before Manual Testing

Before walking journeys, open `docs/customer-journey-test-fixtures.md` and confirm:

1. Each required account fixture exists or is marked as missing.
2. Paid access states match the tier being tested.
3. Coach/player linked state can be created or inspected.
4. Captain and League data fixtures are safe to edit.
5. Admin tests use only safe test profiles and fixture uploads.

## Free Journey

Primary pain point: visitors do not know where to start or how to understand the tennis landscape around them.

### Public Explore

Route: `/explore`

1. Open `/explore` as a signed-out or Free user.
2. Navigate to players, teams, leagues, and rankings from the public surfaces.
3. Open at least one public detail page if seeded data is available.
4. Confirm the page gives tennis context before asking the user to upgrade.
5. Confirm upgrade prompts point to the relevant tier and do not overpromise.

Pass signal: the user can find public tennis context and understands what paid access adds.

### Data Assist Entry

Route: `/data-assist`

1. Open `/data-assist`.
2. Confirm the page explains what users can upload or contribute.
3. Try the upload/review entry using a safe fixture if one is available.
4. Confirm the workflow makes review status clear and does not imply unreviewed data is already trusted.
5. Record whether admin review is required to finish the flow.

Pass signal: a user with stale tennis context knows how to contribute data and understands the review handoff.

## Player Journey

Primary pain point: players need a simple way to turn lessons, goals, and practice time into visible progress.

### My Lab

Route: `/mylab`

1. Sign in with a Player account or a higher tier that includes Player access.
2. Open `/mylab`.
3. Confirm the player identity, linked tennis context, and next useful action are visible.
4. Open matchup/profile/message entry points if available.
5. Refresh the page and confirm the return state still makes sense.

Pass signal: the player has one personal home and can tell what to do next.

### Level Up Portal

Route: `/player-development/relentless-competitor-4-0/level-up`

1. Test on phone-width viewport first.
2. Open the portal and choose a focus area.
3. Choose on-court/off-court, training context, and a card.
4. Start the card and confirm prior selections collapse or stop dominating the screen.
5. Run timer/reps/round controls if the card supports them.
6. Enter a proof rating and one tiny note.
7. Save, copy/share the coach update if available, and choose the next recommendation.
8. Refresh and confirm local saved state behaves honestly.

Pass signal: a player can start training quickly on court, score proof, and know what to do next without excess scrolling.

### Level Up Content Library

Route: `/player-development/[identity]/level-up`

1. Open Relentless Competitor, Smart Attacker, Consistent Builder, Doubles Commander, and Net Confidence Builder identities.
2. Confirm recommended modules/cards change by identity.
3. Open serve, return, movement, forehand, backhand, volley, singles, doubles, pressure, fitness, and recovery lanes where available.
4. Inspect at least one card per lane for cue, routine, reward, proof, quality checks, common miss, regression, and progression.
5. Confirm drills feel tennis-specific, not generic.

Pass signal: the library feels like a useful tennis training tool, not a list of empty activities.

## Coach Journey

Primary pain point: coach and player alignment should continue between lessons without long journals or disconnected homework.

### Coach Hub

Route: `/coach`

1. Sign in with a Coach account.
2. Open `/coach`.
3. Confirm students, assignments, sessions, and next focus areas are visible or clearly empty.
4. Create or review a student fixture if available.
5. Confirm the coach can understand what needs attention next.

Pass signal: the coach sees enough student context to act between lessons.

### Coach Invite Link

Route: `/coach/invite/[token]`

1. Create a disposable coach invite.
2. Open the invite link as a player who is not linked yet.
3. Register or sign in.
4. Confirm the player is linked to the coach.
5. Confirm the player can see coach-assigned or coach-connected Level Up context.
6. Return to the coach account and confirm the player appears linked.

Pass signal: coach-player relationship is established without manual back-channel cleanup.

### Coach Lesson Planner

Route: `/player-development/[identity]/coach-planner`

Example: `/player-development/relentless-competitor-4-0/coach-planner`

1. Open the coach planner for Relentless Competitor.
2. Confirm language is coach-facing, not player-facing.
3. Review the one-hour lesson plan for warm-up, skill block, pressure block, and assignment handoff.
4. Confirm the planner supports Level Up work instead of feeling separate from it.
5. Repeat briefly for one attacking identity and one doubles/net identity.

Pass signal: the coach can use the planner to support the player’s Level Up journey.

## Coach-To-Player Assigned Challenge Journey

This is the highest-priority linked workflow.

1. Coach signs in.
2. Coach opens `/coach`.
3. Coach selects or creates a linked player.
4. Coach assigns one Level Up card or module with a short note and proof requirement.
5. Player signs in and opens Level Up.
6. Player sees the assigned challenge without hunting.
7. Player starts the challenge, completes proof rating, adds one tiny note, and sends/saves update.
8. Coach returns to review the proof.
9. Coach chooses the next focus or lesson support.

Pass signal: assignment, completion, proof, and next focus create a closed loop between coach and player.

Fail-fast signal: if any step only works through local state when the UI implies account sync, mark it as a sync gap.

## Captain Journey

Primary pain point: captains need to make lineup and communication decisions without rebuilding context in scattered tools.

### Captain Lineup Week

Route: `/captain`

1. Sign in with a Captain account.
2. Open `/captain`.
3. Review availability/readiness state.
4. Open lineup builder and create a plausible lineup.
5. Open lineup projection or scenario builder and compare one alternative.
6. Open messaging, weekly brief, or team brief.
7. Confirm the workflow leads from decision to communication.

Pass signal: the captain can move from availability to lineup to team communication without losing context.

### Compete Bridge

Route: `/compete`

1. Open `/compete`.
2. Visit compete teams, schedule, and results.
3. Confirm public/team context connects to captain actions where appropriate.
4. Confirm upgrade prompts are clear when the user lacks Captain access.

Pass signal: competition context helps the captain act rather than becoming a separate public page cluster.

## League Journey

Primary pain point: coordinators need one operating workspace for schedules, results, standings, and visibility.

### League Office

Route: `/league-coordinator`

1. Sign in with a League or Full-Court account.
2. Open `/league-coordinator`.
3. Confirm the coordinator can see structure, results, individual results, and tournaments.
4. Enter or review a safe result fixture if available.
5. Confirm the workflow indicates what becomes public/member-visible.

Pass signal: the coordinator can operate the league without unclear spreadsheet handoffs.

### Public League Context

Route: `/leagues/[league]`

1. Open a seeded public league page.
2. Confirm schedule/result/standing context is visible where intended.
3. Compare the public page against the coordinator source fixture.
4. Confirm no private admin-only controls appear publicly.

Pass signal: members can understand league context and coordinator updates show where expected.

## Full-Court Journey

Primary pain point: multi-role users need clean access across every workspace without tier confusion.

### Full-Court Navigation

Route: `/pricing`, then Player/Coach/Captain/League surfaces

1. Sign in with a Full-Court account.
2. Open `/pricing` and confirm Full-Court language is clear.
3. Visit `/mylab`, `/coach`, `/captain`, and `/league-coordinator`.
4. Confirm each workspace is available without stale locks or redundant upgrade prompts.
5. Confirm navigation does not bury the user in every possible tool at once.

Pass signal: the user can move across roles cleanly and knows which workspace fits the job.

## Admin/Internal Journey

Primary pain point: internal users need to keep access and tennis intelligence trustworthy without creating product drift.

### Admin Access Management

Route: `/admin/access`

1. Sign in with an admin account.
2. Open `/admin/access`.
3. Search or load a test profile.
4. Review current tier/access state.
5. Activate, repair, or inspect access using a safe test account.
6. Confirm affected gated pages respond to the access state.

Pass signal: admin access changes are understandable, reversible in test, and reflected in user-facing gates.

### Admin Data Quality

Route: `/admin/import-queue`

1. Open `/admin/import-queue`.
2. Review a safe import fixture.
3. Check anomaly, dedupe, missing scorecard, or match report handoff where relevant.
4. Confirm unreviewed data is not treated as trusted intelligence.
5. Confirm final accepted data appears in the intended product surface.

Pass signal: data quality workflows protect the product and leave a clear review path.

## Highest-Risk Closeout Items

1. Level Up local state versus account sync.
2. Coach invite token to linked player state.
3. Coach assignment to player challenge visibility.
4. Player proof to coach review.
5. Captain local scenario persistence.
6. League coordinator result entry to public league context.
7. Full-Court stale lock or redundant upgrade prompts.
8. Admin access activation affecting real gated pages.

## Daily Testing Wrap-Up

At the end of each testing day, record:

1. Which journeys passed.
2. Which journeys are blocked by account/data fixtures.
3. Which issues are UI polish versus product logic.
4. Which local-only workflows must become backend-backed before launch.
5. The top three fixes for the next build session.
