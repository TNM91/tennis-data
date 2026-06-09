# TenAceIQ Customer Journey Day 1 Runbook

Use this as the first testing session checklist. The goal is not to test every route. The goal is to prove the two highest-trust journeys before moving wider.

Primary references:

- Agenda: `docs/customer-journey-test-plan.md`
- Manual scripts: `docs/customer-journey-test-scripts.md`
- Fixtures: `docs/customer-journey-test-fixtures.md`
- Result ledger: `docs/customer-journey-test-results.md`
- Level Up sync audit: `docs/level-up-sync-audit.md`
- Verification log: `docs/platform-closeout-verification-log.md`

## Before Testing

1. Run `npm run qa:day1` to print the Day 1 checklist.
2. Run `npm run verify:closeout:live` against production after the latest deploy.
3. Confirm the latest pass is recorded in `docs/platform-closeout-verification-log.md`.
4. Open `docs/customer-journey-test-results.md` and prepare one ledger row per journey attempt.
5. Confirm these fixture IDs exist or mark the session blocked:
   - `player_plus_linked`
   - `coach_primary`
   - `coach-invite-token`
   - `level-up-assignment`
   - `level-up-completion`
6. Use a phone or phone-width viewport for Level Up first.

## Journey 1: Player Level Up Mobile Loop

Journey ID: `player-level-up-mobile-loop`

Entry route: `/player-development/relentless-competitor-4-0/level-up`

Pass question: Can a player start useful tennis work on a phone, score proof, and know the next rep without extra scrolling?

Steps:

1. Sign in as `player_plus_linked` or use the intended coach-invited player account.
2. Open the entry route on a phone-width viewport.
3. Start from a direct card or choose a focus lane and card.
4. Confirm prior selection context collapses once active training starts.
5. Complete the active drill flow: timer/reps if available, proof rating, and one tiny note.
6. Save proof.
7. Confirm the save status is honest: local, Player+ synced, or coach-invited synced.
8. Confirm the Level Up local sync proof cue explains saved-first, connected-sync, and local-only v1 behavior.
9. Confirm next practice and coach update copy are useful and visible.
10. Refresh Level Up, open `/mylab`, and confirm the Level Up return-state panel matches the expected local or synced mode.

Capture:

- Phone screenshot of the active card.
- Saved proof status text.
- Level Up local sync proof cue.
- Proof rating and tiny note.
- Next recommendation.
- My Lab Level Up return-state panel.
- Any scroll/tap friction.

Fail fast:

- Mark `mobile-ux-gap` if the active card is buried or the player must keep scrolling through old choices.
- Mark `sync-gap` if local proof is presented as cloud or coach-visible sync.
- Mark `content-quality-gap` if the card does not clearly connect to a tennis behavior.
- Mark `return-state-gap` if refresh loses the player context, Level Up proof, or next action.

## Journey 2: Coach To Player Assigned Challenge

Journey ID: `coach-player-assigned-challenge`

Entry route: `/coach`

Pass question: Can a coach assign one useful tool and see the player proof come back through the linked relationship?

Steps:

1. Sign in as `coach_primary`.
2. Confirm or create a disposable `coach-invite-token`.
3. Link the intended player account if the relationship does not already exist.
4. Assign one Level Up card or module with a short coach note and proof requirement.
5. Sign in as the linked player.
6. Open Level Up and confirm the assigned challenge is easy to find.
7. Complete the assigned challenge with proof rating and one tiny note.
8. Share or sync proof according to the intended access mode.
9. Return to the coach account.
10. Confirm the proof appears in the coach review context and creates a next lesson/focus decision.

Capture:

- Invite or linked-player status.
- Linking proof privacy cue.
- Invite acceptance proof cue.
- Coach invite account proof cue.
- Assignment id or visible assignment details.
- Player challenge screen.
- Player proof result.
- Coach review proof sync cue.
- Next lesson or next focus handoff.

Fail fast:

- Mark `access-gap` if the coach/player has the right tier but cannot reach the workspace.
- Mark `gating-gap` if an unrelated player can see the assignment.
- Mark `sync-gap` if the player UI says synced but the coach cannot review proof.
- Mark `data-propagation-gap` if assignment completion does not update coach-visible status.
- Mark `product-logic` if the workflow technically works but does not help the coach decide the next lesson action.

## End Of Day 1 Triage

Record a daily summary in `docs/customer-journey-test-results.md`.

Use this order:

1. Fix any `p0` access, gating, sync, or data propagation issue first.
2. Fix `p1` Level Up mobile or coach-player loop breaks before testing the wider platform.
3. Convert any `fixture-gap` into a concrete fixture setup task.
4. Put `visual-polish` issues behind product logic, unless the polish issue blocks phone use.
5. Move to Player My Lab and Coach Lesson Support only after both Day 1 journeys are pass or have clear non-blocking follow-up.
