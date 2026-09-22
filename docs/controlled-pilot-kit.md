# TenAceIQ Controlled Pilot Kit

Use this kit for a two-week, payment-free pilot before the wider public launch. The goal is to prove that each role reaches useful tennis work quickly and that a club can connect its existing programs without replacing booking, registration, or payment systems.

## Pilot group

- 1 tennis club or multi-site racquet program.
- 1 club administrator or director.
- 2 coaches.
- 2 captains using different team formats when possible.
- 10-20 players, including at least 4 who primarily use a phone.
- No live checkout. Grant time-limited access through `/admin/access`.

## What the pilot proves

1. A player can connect a record, open My Lab, complete one useful rep, and return to a clear next step.
2. A coach can add or invite a player, run a lesson or clinic workflow, assign the next action, and review follow-through.
3. A captain can add a team, import a Player Roster and schedule, confirm availability, build the correct match format, send the plan, capture results, send the recap, and close the week.
4. A coordinator can create a league or tournament, select the correct format, publish the schedule, record results, and update standings or draws.
5. Club staff can brand a club home, connect staff and members, and reach coaching, clinics, leagues, and tournaments without confusing TenAceIQ with the club's booking or registration system.

## Set up before day one

1. Create the club and upload its logo.
2. Add the club administrator and two coaches.
3. Add the two pilot teams and link the captains as both captain/co-captain and player when applicable.
4. Import each Player Roster first so names, emails, and phone numbers become the shared team contact source.
5. Import the schedule and confirm the detected match format. Include one standard USTA format and one other applicable format such as doubles-only, mixed, singles/flex, or custom.
6. Create one clinic or training group and one league or tournament.
7. Grant the required pilot access with an end date. Do not collect payment information.
8. Run `npm run qa:fixture-auth-smoke -- all` and the production health checks before invitations are sent.

## Two-week path

### Days 1-2: first useful action

- Player: connect the correct record and complete one My Lab or Level Up action.
- Coach: connect one player, open the player plan, and assign one next step.
- Captain: open the linked team, confirm the format, and review imported contacts and schedule.
- Club admin: open the branded Club home and confirm staff, programs, and competition links.

Ask: **What were you trying to do, where did you hesitate, and what would have made the next step obvious?**

### Days 3-5: connected work

- Coach runs one lesson or clinic session and records attendance or follow-through.
- Captain creates a projected lineup, asks for availability, updates the lineup, and sends the match plan.
- Player responds or records availability and sees the correct next action.
- Coordinator publishes one schedule or draw and records one result.

### Days 6-7: owner review

- Group repeated hesitation by role and route.
- Fix any repeated blocker before widening the pilot.
- Confirm product events are recording without API errors.
- Confirm no role is shown an offer for access already granted.

### Days 8-11: repeat without directions

- Each participant returns through the same role lane.
- The most recent/default team, player, group, league, or club context should open first.
- First-time guidance should remain hidden after completion and stay available through Help.
- Captain completes another match week through results, recap, and close week.

### Days 12-14: decision

- Run one 20-minute group feedback call.
- Score the pilot with the table below.
- Ship only repeated, launch-blocking issues before the wider launch.
- Keep isolated ideas in the post-launch backlog.

## Pilot scorecard

| Measure | Launch target | Record |
| --- | --- | --- |
| Participants reach their role home | 90% without owner intervention | |
| First useful action completed | 80% within the first session | |
| Mobile participants complete the primary action | 90% without horizontal scroll or blocked controls | |
| Captain roster contacts import correctly | 100% of valid exported contacts | |
| Correct court structure persists | 100% across tested formats | |
| Saved work is visible after refresh or return | 100% | |
| Cross-role handoff reaches the right context | 90% without reselecting the record/team | |
| Repeated critical blockers | 0 open at launch decision | |
| Product-event API errors | 0 after the repaired release | |
| Participants who would use TenAceIQ again | 70% or more | |

## Feedback prompts by role

### Player

- Did My Lab make the next tennis action obvious?
- Did the page remember the player and progress you expected?
- What would bring you back before your next match or practice?

### Coach

- Could you move from player context to lesson, clinic, assignment, and review without losing the player?
- Which note or update would you otherwise have sent in a separate text or spreadsheet?
- What information was missing when deciding the player's next step?

### Captain

- Did the correct team and match format open first?
- Did roster contacts, availability, projected lineup, message, result, recap, and close-week actions feel like one flow?
- Where did you have to scroll, search, or repeat a selection?

### Coordinator or club staff

- Could you see what TenAceIQ supports without mistaking it for court booking, registration, or payments?
- Could staff reach coaching, clinics, leagues, tournaments, and member communication from the branded club context?
- What recurring administrative work was actually reduced?

## Invitation templates

### Club administrator

We are opening a small TenAceIQ pilot for your club. It connects players, coaches, clinics, teams, leagues, and tournaments in one branded tennis experience. It does not replace your booking or registration system. The pilot is free and focused on finding where the next action still feels harder than it should.

### Coach or captain

You have been invited to test TenAceIQ with your real player or team workflow. Start from your Coach or Captain lane, complete one normal tennis task, and tell us where you hesitated. No payment information is required.

### Player

Your club invited you to try TenAceIQ. Connect your player record, open My Lab, and complete one useful next step for your tennis. The pilot is free; we want your honest feedback on what is clear and what is not.

## Go / hold decision

**Go** when every critical role can complete its primary path, saved context survives refresh and return, representative formats keep the correct court structure, mobile primary actions are reachable, and production telemetry stays healthy.

**Hold** when a user can lose saved work, a granted tier shows the wrong offer, contacts or formats produce the wrong decisions, a role handoff opens the wrong context, or a primary mobile action is blocked.

Payments are a separate gate. Keep the launch free-first until the business bank account and Stripe live-readiness checks are complete.
