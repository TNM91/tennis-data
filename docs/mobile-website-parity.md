# Website to iPhone parity

Updated October 24, 2026. Baseline: released website and iPhone build 45. The website defines product depth and role-based tasks; iPhone adaptations should improve those tasks without silently removing them. Team chat intentionally follows a GroupMe-style sports conversation model.

## Evidence and limits

Current-run captures: live public home and Explore, synthetic bundled iPhone My Lab and Explore. Private screenshot evidence stays outside this public document. Website My Lab, Captain and organizer functionality was inspected in source, not authenticated in production; this is an implementation inventory rather than proof of every live private flow. iPhone captures use synthetic linked player/team records and blocked external requests. No positive production mutations or notifications were used. Visual checks do not establish VoiceOver or physical-device acceptance.

Captured steps:
1. Website public home: clear role/task navigation and broad search; healthy entry hierarchy.
2. App My Lab: ratings and results work, but a tall identity card dominates the first screen and next actions are hidden in bottom navigation; needs task hierarchy.
3. App Explore: opens player search immediately; other directories exist but are less discoverable; needs a task entry.
4. Website Explore: named player, team, league and ranking entry cards; clear breadth. Universal search and guides exceed the native implementation.

## Parity register

“Partial” means a usable subset exists, not that the website feature is complete. Opening a website in the system browser does not count as native parity.

| Area | Website baseline | iPhone build 45 | Remaining work |
| --- | --- | --- | --- |
| Entry and navigation | Task/role lanes, personalized shortcuts, broad search | Five fixed tabs; signed-in My Lab | Align task hierarchy; guest Explore, personalized entry and cross-tool context remain gaps |
| My Lab | Connected identity, next action, training/progress, match prep, player context | Identity, recorded ratings, recent matches | Add useful task entry; bring training, progress and saved preparation into the same player loop |
| Explore | Search across tennis entities; player/team/league/ranking directories, guides | Separate player/team searches, league summary, ranking list | Universal search, fuller filters and directory/detail depth; guides; coach/tournament discovery |
| Player detail | Rich player context, history, team connections and signals | Recorded ratings, latest ten connected results, match detail and follow | Audit complete history, filters, rating trends and team/season context before claiming parity |
| Following | Personalized followed tennis context | Player following and player review | Compare supported entity types, ordering and useful updates |
| Matchup prep | Matchup intelligence and actionable preparation | Two-player rating/results comparison and recent encounters | Confidence, preparation, saved plans, opponent context and richer comparison need a full parity pass |
| Teams | Team context and match-week tools | Team chat, hub, schedule, recorded fixtures/courts | Compare team detail/roster/season depth and entry accessibility |
| Team messaging | Tennis messaging, team coordination | Photos/GIFs, reactions, replies, history, mentions, moderation, alerts | Preserve intentional mobile chat design; continue real-device keyboard, media and accessibility checks |
| Captain | Availability, lineups, scouting, scenario/projection tools, practice, briefs and messaging | Readiness, private working lineups, proposal/publication/replacements, roster/pair scouting, match center | Scenario/projection parity, practice, briefs, richer planning and direct discovery outside conversation |
| Improve | Level Up, development paths, training sessions, goals/progress, resources | Build 47 candidate: shared training cards, session timer, private self-guided account saves and latest account progress | Modules, identity/goal recommendations, coach assignments, quests, weekly plans, proof counters and durable unsaved-draft recovery remain gaps |
| Tactics and video | Court tools, tactical planning and video review | Not implemented as a native flow | Preserve editable court geometry, saved state and actual review workflows |
| League coordination | League/player/team results, structure, schedules, administration | Public league summary only | Coordinator/admin flows are a substantial gap; public browsing is not league management |
| Tournaments, coach, club | Dedicated discovery and role workflows | Not implemented | Keep separate scope and entitlement validation; do not label these complete |
| Account and onboarding | Join, recovery, linked identity, membership and profile tools | Sign-in/recovery, record linking, external help links | Native onboarding/profile management and store-compliant membership flow need a separate implementation pass |

## First correction: My Lab and Explore entry

Build 46 candidate compacts linked identity, adds working My Lab task cards (Matchup, My teams, Following, Explore), and opens Explore with four explicit directory actions. Existing search, details, access checks and data loaders remain the destinations. “Find a league” intentionally does not promise standings: the current native league view shows a directory summary. These entry changes add no idle requests or new server permissions.

Navigation also asks before discarding an unfinished team message or open team review. Cancel leaves the screen and draft intact. Android Back first gives nested team views a chance to close.

## Delivery order

1. Finish entry/navigation alignment, then compare actual player detail and matchup depth side by side. Reuse website contracts and data sources; preserve player/court context and back navigation.
2. Port the connected Improve loop: training choice, session execution, saved completion and progress. Pair this with richer My Lab next actions. Do not infer completed training from public results.
3. Close Captain planning/practice/scenario gaps and expose Captain tasks directly within authorized team context.
4. Port league coordinator/admin, tournaments and other role workflows as complete task groups.
5. Run physical iPhone acceptance, VoiceOver, large text, keyboard/media and offline/error-state checks across the connected flows before App Store submission.

Every batch should name website source screens/contracts, state preserved functionality and explicit gaps, show same-size before/after evidence, exercise failure/back/disposal behavior, and meet release checks. A growing list of isolated buttons is not sufficient evidence of product parity.

## Connected training — build 47 candidate

My Lab opens Level Up and account training progress directly. The catalogue imports `lib/level-up/level-up-cards.ts`; local search/setting filters cover all cards and render up to 24 at once. Card detail retains routines, goal, cue, proof anchors, quality checks, common-miss correction, progressions/regressions, equipment, reward and safety text. Active sessions keep instructions available in a disclosure above the timer.

Source behavior: `app/player-development/_components/player-live-workbench.tsx` supplies category/context conventions. Native training uses the existing `api/player/level-up-sessions` bearer-authenticated contract and `lib/level-up-sessions.ts` mapping, not a second training database. New sessions are self-guided Player saves; coach assignments and team messages are not modified. No personalized identity is inferred; the existing endpoint's default identity applies until native identity selection is ported.

The timer is local, pauses when backgrounded or leaving an unfinished session, and caps recorded time at two hours. Proof is an explicit self-rating from 0–5, separate from TIQ. Saving freezes the ID, completion timestamp and submitted fields. An unconfirmed save offers an exact retry or a history lookup for the same receipt. History is limited to the account's latest 80 records; malformed, duplicate or wrong-owner responses are withheld rather than shown as empty. No polling or training request runs on timer ticks or catalogue filters.

Closing an unfinished session requires a discard choice; keeping it preserves fields and timer state. Unsaved work exists only while the screen/app process remains open. A frozen save is not a durable offline queue; after intentionally discarding it or restarting the app, review account progress before logging the same work again. Native offline draft recovery, modules/quests, coach assignments, weekly-plan actions, proof counters and identity recommendations are not claimed as parity in this batch.

## Practice modules — build 48 candidate

Native Level Up now imports the same three `LEVEL_UP_MODULES` used by `app/level-up/level-up-page-content.tsx`, from `lib/level-up/level-up-cards.ts`. The separate richer `level-up-modules.ts` export is not the active website page source and is not substituted. Module details preserve description, duration, subtitle, proof and prescribed card order. Opening a drill retains a back-to-module action; a confirmed save returns to the module. Failed or uncertain saves stay in the existing exact-retry/receipt-lookup flow and do not mark a card saved.

Checkmarks represent confirmed card saves during the current Level Up visit only. They reset on close/disposal. Existing account history is never treated as module enrollment or completion. No module completion record, persistent block state, identity recommendation, coach assignment or quest is invented. Each drill still saves through the existing private session endpoint. Module navigation adds no network calls or polling. Physical iPhone acceptance remains pending.

## Training direction and development paths — build 49 candidate

Native Level Up imports the six playing styles, seven development focuses, identity action cues and six-week guides from `lib/player-development.ts`; recommended cards use the active website's `getRecommendedLevelUpCards` helper, and practice ideas reuse `getPlayerTrainingMenus`. Style and focus are separate explicit choices. Neither ratings nor old match/training history selects an identity. Returning players open their chosen direction with a direct recommended-drill action; every card and module remains available.

Choices persist under an account-scoped native-device key, separate from website local-storage/cookie preferences. Unknown or corrupt saved slugs are withheld; unavailable storage keeps a choice for the current visit and says so. Clearing choices does not change account session history. There is no cross-device preference synchronization. The chosen active identity freezes with each submitted session and must match the server receipt before confirmation, using the existing endpoint's `identitySlug` field. History retains the identity recorded for that session. Sessions with no explicit choice retain the endpoint's legacy default; this does not populate or imply a selected native style.

Weekly guides preserve objectives, main drills, pressure games, accountability and coach cues. They are readable training guidance, not tracked week completion, a coach assignment or editable tactics diagrams. Quests, proof counters, coach assignment workflows, durable offline drafts, synchronized preferences and physical iPhone accessibility/keyboard acceptance remain gaps. Direction selection and guide expansion add no network reads, polling or writes.

## Account training inbox — build 50 candidate

My Lab now opens a native training inbox. It reads the existing `api/player/level-up-weekly-plan` and `api/player/coach-assignments` contracts, with the same weekly-plan effective-rep/progress helpers and coach assignment summary, due-state, pack, review and check-in helpers used by the website. Saved weeks retain their recorded completion, coach changes and existing player replies. Coach work retains due dates, instructions, trackers, expected evidence, pack states, feedback and recorded check-ins. Direct section navigation keeps coach work reachable below saved weeks.

Inbox data is loaded only on first entry and manual section refresh, with no polling or read acknowledgments. Results are bounded to 12 plans, 20 coach links and 100 assignments. Each request verifies the signed-in owner/current screen before and after transport, disables redirects and bypasses caches. Coach assignments must reference a returned link owned by that player; weekly API rows do not include owner IDs, so their ownership remains enforced by the existing authenticated server query. Any nested player reply must match the signed-in account. Duplicate, malformed or oversized responses are withheld. Loading failures stay separate from valid empty results, and the two sections fail independently. Private inbox data stays in memory and is cleared on disposal.

Exact matching card IDs can open private self-guided practice, using the source's known identity without overwriting the player's device choices. A confirmed save returns to the inbox and remains in individual training history. It does not update weekly rep or assignment completion, share proof, send a coach reply/check-in, or change coach access. Unknown focuses remain written instructions rather than guessed drill matches. Native plan creation/editing/completion, coach replies and assignment check-ins remain gaps; explicit website actions open their existing My Quest or My Lab routes and do not count as native parity. Coach-invited saving for accounts without Player access is not added by this private-practice path. No API, database, permissions, encryption or notification changes.

## Weekly-plan actions — build 51 candidate

Native Level Up can create a private current-week plan from three canonical recommended cards for the explicitly chosen direction. Creation uses a create-only insert; an existing plan for that account, week and identity returns a conflict instead of being replaced. Saved weeks offer explicit Mark rep done and Reopen rep actions, including effective coach replacement instructions. A private session save never changes weekly completion automatically.

The existing weekly-plan route retains its website behavior and adds a narrow authenticated completion action. It checks account ownership, existing Player/active-coach access and the exact database revision, then changes only the selected completion flag and update timestamp using an atomic revision condition. Coach notes, sharing, player replies and unknown stored fields survive. Native responses preserve timestamp precision. These guarantees apply to the new native action; legacy full-plan website writers are not claimed to use revision checks.

Confirmation shows the affected rep and existing coach visibility. Failed or uncertain saves retain a frozen explicit desired state for manual exact retry or a scoped current-week lookup. Conflicts disable retry against the stale revision; discarding and refreshing reveals the latest plan. Close/discard controls explain that an uncertain request may already have saved. Pending changes remain in memory only, with owner/screen checks before and after transport. No polling, notification, migration, grant or new sharing permission is introduced.

Coach replies/check-ins, sharing changes and custom weekly-rep editing still open the website. Synthetic UI covers create, completion/reopening, interruption, exact retry and changed coach instructions; positive production mutations are excluded from QA. Physical iPhone acceptance remains pending.


## Coach assignment check-ins — build 52 candidate

The native training inbox now offers a recap/proof check-in for assigned coach work with no existing check-in. It reuses the website's coach-storage completion helper and existing authenticated coach-assignments PATCH contract. Review explicitly explains that the assignment and all non-skipped pack cards become complete; private sessions do not change. Completed work remains readable and cannot be resubmitted from this native flow. Coach weekly-plan replies, custom editing and sharing remain website actions.

Native requests add an optional exact database revision. The server verifies the existing player-to-coach link and assigned state, rejects a prior check-in or stale revision, and conditionally updates the same assignment/link/revision/status. It retains website completion semantics and existing service-side authorization; no credentials, new schema, grants, notifications or access roles are introduced. Legacy website requests remain supported without the optional revision and are not claimed to have native concurrency protection.

The app freezes reviewed input for manual exact retry or a current-work lookup. Confirmation requires matching account/link, assignment identity/instructions, exact recap/proof, valid completion time and the expected completed pack with coach feedback retained. Failed saves never automatically retry; conflicts disable stale retries. Closing a draft asks before discarding it; pending work is memory-only. Account/screen checks bracket transport; private data is disposed with its parent screen, and request generations prevent old refreshes from replacing newer saved work. Positive UI QA uses isolated synthetic responses only. Physical iPhone keyboard, VoiceOver and large-text acceptance remain pending.


## Weekly coach replies — build 53 candidate

Saved shared weeks now offer native Seen acknowledgments and questions up to 500 characters for coach updates without an existing player reply. Review includes the coach note and affected effective rep, plus the visibility and unchanged-completion explanation. Website question whitespace normalization is applied before review. Replies remain visible in the saved week; a new coach answer can clear the prior reply as on the website.

The existing weekly-plan API adds a separate native action using authenticated owner row permissions. It validates the matching active coach link and coach identity, shared plan, raw database revision and absence of any prior reply, then atomically writes only the nested player reply and update timestamp. Existing website acknowledge/question RPC behavior remains unchanged. Reps, sharing, original coach instructions and unknown stored fields are retained. No service-role expansion, schema, migration, grant, notification or encryption change is introduced.

Each reviewed reply freezes a UUID and original revision. These are retained in the nested reply JSON and exposed in owner-authenticated plan responses, so manual recovery confirms the exact request as well as the coach-update target, action, message and owner. Similar replies from another request cannot confirm a save. A newer coach response or a concurrent change blocks stale writes; conflicts disable retry against that revision. Uncertain saves offer exact manual retry or a scoped week lookup without automatic writes. Closing unsent or uncertain work asks before discarding it. Drafts remain memory-only, and account/screen disposal plus refresh generations prevent stale private results from resurfacing. This batch also corrects the check-in dialog's loading-text encoding. Physical iPhone VoiceOver, keyboard and large-text acceptance remains pending.


## Captain practice attendance — build 54 candidate

The authorized native Captain workspace now opens saved practices for its exact team, league and flight. It imports the website's practice date/time/focus formatting and assignPracticeDisplayStatuses capacity/confirmation ordering. Upcoming and Earlier filters, practice details, focus/recurrence, name search and RSVP rosters are native. In, waitlisted and captain-confirmed remain distinct. Completed practices are readable with no confirmation controls. Create/edit/cancel, RSVP sharing/calendar, out/reset actions and reminders remain explicit website workflows; native parity for those is not claimed.

The new mobile practice contract reuses Captain entitlement, accepted exact team-role/current room-access checks and existing creator ownership. Reads are bounded to 40 saved occurrences, 2,000 total invitees and 250 per practice. Malformed, duplicate, oversized, wrong-owner or crossed event/invite rows are withheld. It returns whitelisted fields only, with no public RSVP token, contact information or participant profile identifiers. Unlike the website management overview, native reads never call advance_captain_practices. Opening, filtering or refreshing cannot generate a recurrence, send a reminder or change an RSVP.

Captains can review and explicitly add/remove a confirmation for an In player, using existing authenticated invitee RLS permissions. The write compares the exact invitee revision and In status and touches only confirmation fields. It checks the owned practice revision before and after saving, then returns fresh practice state. A parent edit or cancellation after the child write is reported as unconfirmed/conflict; these checks do not claim a cross-table transaction or global capacity lock. The website's over-capacity confirmation behavior is retained, with an explicit review warning. Removing confirmation preserves In and recalculates placement. No messages or reminders are sent.

Pending actions freeze event/player identity, revisions and desired state for manual retry or current-state lookup. Conflicts disable stale retries; leaving an attempted action asks before discarding. Current-state recovery establishes the requested confirmation state, not proof of which device wrote it. A validated save reuses its returned fresh roster without another client GET; recovery reads once, with no polling. Captain tools close on background as before; pending changes are memory-only and users are told to refresh after leaving mid-save. No new schema, grants, roles, encryption or service-role write access. Positive QA is synthetic only; physical iPhone keyboard, background and VoiceOver acceptance remains pending.


### Build 55: native practice detail editing

Captain practice details can be edited on iPhone: date, start/end time, location, focus, and the website's one-time/weekly/biweekly recurrence choices. Review is explicit **Save details only**: RSVP responses, capacity and captain confirmations stay unchanged, and no message, notification or reminder is sent. The website editor still supplies its existing announcement behavior. This is partial practice parity; creation, cancellation, sharing, RSVP resets, calendar export and reminders remain website actions.

The API checks Captain entitlement, accepted exact team scope and creator ownership, then updates only the event through authenticated RLS with an exact raw revision. Existing private metadata and next-occurrence links are preserved server-side; other saved occurrences are not edited. A narrow UUID request receipt and original revision permit identical retries and scoped recovery without duplicate writes. Recovery requires matching receipt and every desired field, not merely similar schedule values. No schema, grants or service-write permissions change.

The app freezes the reviewed fields, checks account/screen ownership before and after transport, blocks stale retries, offers a current-state lookup and guards unsaved or uncertain close actions. Pending edits are memory-only and are cleared on screen/session disposal. Local and synthetic tests do not mutate production or send APNs tests. Physical iPhone acceptance remains pending.


### Build 56: native practice creation and RSVP sharing

Captains can create a practice from the exact team's complete roster, review its date/times, facility, focus, recurrence and capacity, then share or copy its RSVP link. The review lists every RSVP player and explicitly states that this create action sends no push/email notification. It creates the canonical practice room and first message for linked roster players; in-app room visibility is distinct from proactive notifications. The link is a bearer invitation: anyone holding it can view the public practice roster and submit an RSVP, so sharing remains a deliberate captain action. Ordinary practice list/detail responses still exclude public tokens; only the explicit creation/lookup response contains the RSVP path.

Migration `20261025000100_native_practice_create.sql` adds a service-only, SECURITY INVOKER transaction routine. It rechecks accepted Captain/co-Captain role, exact team/league/flight, active team-room participation and removals, locks the team boundary, compares the reviewed roster, then creates the conversation, participants, first message, event, responses, invite and invitees in one transaction. An exception rolls all of them back. A fixed UUID event/request identity with exact frozen fields, capacity and roster returns the existing receipt on identical replay without resetting RSVPs. Lookup never creates records. The function grants no new table access and is unavailable to anon/authenticated callers. API entitlement and scope checks precede the RPC. Roster and persisted fields are whitelisted; phone contacts are not copied. Directory linkage requires one unambiguous linked-player match.

The native review freezes the draft, uses manual exact retry or explicit lookup, checks account/screen ownership before and after requests, guards uncertain/unsaved closing and restores focus to the current practice. No automatic retry, background work, production test write or APNs test is used. Roster loading is bounded to 200 and the complete roster is required; empty, oversized, duplicate normalized names or drift require review. Recurrence generation remains in the website's existing workflow; native listing does not advance repeats. Cancellation, follow-up announcements and reminders remain website gaps. Physical iPhone acceptance remains pending.


### Build 57 — practice cancellation and history

- Captain → Manage practices supports reviewed cancellation of one owned occurrence, plus a Cancelled history filter in the bounded latest-40 list. RSVPs, capacity, confirmations, private tokens and links to already-saved future occurrences are preserved.
- The authenticated event update compares the exact original timestamp and open status. A whitelisted UUID receipt allows identical retries without another update; an exact-event GET can recover a lost response even if the event falls outside the list window. Completed/cancelled practices cannot be edited or confirmed through native controls.
- Cancellation is silent: no team message, email, internal notification or APNs test is sent. The review explicitly tells captains to announce in chat. Existing public RSVP handling rejects cancelled practices. Already-saved future occurrences remain unchanged; the canonical repeat worker excludes cancelled sources.
- This uses existing RLS and tables, with no migration or new grants. It is an event-row CAS, not a transaction with concurrent RSVP/confirmation writes. A request already in flight can race cancellation under the existing website RSVP behavior; ordinary new RSVP requests see cancellation. Native player RSVPs, announcements and repeat generation remain follow-up work.
- Local synthetic phone checks cover review, cancellation with a lost response, read-only recovery, disabled actions in cancelled history, narrow layout, exact retry/conflict paths. Production QA stays anonymous/invalid-auth only; no authenticated practice data reads/writes or notification tests. Physical iPhone acceptance remains pending.


### Build 58 — linked player practice RSVPs

Team hub and Match day open native Team practices. Accepted current team members see only practices whose invitation has exactly one roster entry linked to their signed-in account. Upcoming, Earlier and Cancelled views cover the team's latest 40 saved occurrences; unlinked/missing entries require captain review rather than name guessing. Each practice shows the player's own note/response, aggregate In/waitlist counts and distinct captain-confirmed status using the website's shared ordering helper. Other players' names, profile IDs, notes, phones and bearer tokens are withheld.

Players review In/Out/Maybe and an optional 300-character note before saving. The service-only SECURITY INVOKER routine `native_reply_practice` rechecks accepted exact scope, room/participant/removal access, linked invitee ownership, original parent and child revisions and open practice status. It locks parent then invitee and saves canonical RSVP + internal schedule response atomically. Out/Maybe clear confirmations; In preserves them. Identical current state is a read-only replay that preserves queue time, not a persistent UUID receipt. Recovery checks current exact event/person/schedule/response/note state, not which device saved it. The legacy public RSVP endpoint's existing race behavior is unchanged.

No new table grants, profile links, invitations, notification sends, polling or recurrence generation. The app guards account/screen ownership before and after transport; pending replies are memory-only and close on background/account/team changes. Conflicts disable stale retries; uncertain saves offer read-only lookup or explicit same-response retry. Cancelled/completed practices are read-only. Positive tests use local synthetic data and real local SQL fixtures; production QA remains anonymous/invalid-auth only, with no APNs tests. Physical iPhone acceptance pending.


### Build 59 — existing practice sharing and team announcements

Captain → Manage practices → Share or announce practice retrieves the exact owned active/cancelled practice and RSVP link on demand. Ordinary practice list/detail responses still omit bearer tokens. Share/Copy rechecks the reviewed details and current account before the native action; changed details require another review. The screen explains that anyone holding the link can view the public roster and reply while practice is open. Completed practices do not offer new sharing/announcement actions.

Captains review an invitation, update or cancellation with an optional 300-character team note and the complete generated message. The server compares the owned practice revision and canonical message before forwarding a new send through the existing team-room captain-announcement path. Existing membership, role, idempotent UUID insertion and team alert/mute handling stay in that path. This posts to the team conversation rather than the separate practice room. No practice/RSVP state is changed and cancellation affects only the named occurrence; saved future practices remain unchanged.

Explicit lookup checks the exact message UUID, sender, room, body, event-specific RSVP link, announcement kind, and absence of edit/removal/reply. It never posts or sends notifications. Identical post replay returns that receipt without another delivery, including after later practice completion or edits. A new post is checked for freshness but is not a transaction/lock spanning practice edits and message insertion; later changes need their own announcement. Notification delivery follows the existing best-effort announcement behavior; replay does not retry notifications separately.

Pending review/send state and bearer links are memory-only and disposed with the existing Captain screen on background/account/team changes. Uncertain saves offer lookup/manual same-post retry, conflicts disable stale retries, and attempted/unsaved closes ask before discard. No new schema, grants, notification provider, polling, recurring reminders or repeat generation. Positive QA remains local/synthetic; no real production message, authenticated positive QA or APNs test. Physical iPhone acceptance pending.


### Build 60 — reviewed practice calendar access

Saved Captain practices offer Review calendar options inside Share or announce practice. The review shows the date, exact calendar end time and court before opening the existing one-occurrence ICS export or Google Calendar template. It explains floating local time, the shared 90-minute end-time fallback (capped at 23:59), manual completion in the calendar, and no synchronization of future edits/cancellations. This is calendar-file/browser access, not native EventKit insertion, confirmed calendar persistence, or a subscription. Physical iPhone file handling and final calendar save acceptance remain pending.

Both actions recheck exact owned practice details and account/screen ownership immediately before the existing Browser plugin opens. Changed details require another review; closed practices have no calendar actions. The public ICS route now checks open status and blocks cancelled/completed occurrences even through an old bearer link. Shared calendar range validation rejects impossible dates and zero-duration fallback events. Calendar exports contain no attendees; Google gets team/date/time/court/focus, not an automatically appended RSVP token. No new plugin, calendar permission, database write, message, alert, polling or schema change.

Recurrence review confirmed the website advances owned weekly/biweekly practices through its existing worker. Native reads deliberately do not invoke that mutating worker. Explicit scoped repeat preparation remains future work. Positive QA stays local/synthetic; production checks use invalid tokens and invalid/anonymous authentication only.
