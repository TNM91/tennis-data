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
| Improve | Level Up, development paths, training sessions, goals/progress, resources | Not implemented as a connected native flow | High-priority player feature gap; port real storage/workflows rather than decorative cards |
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
