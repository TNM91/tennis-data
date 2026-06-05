# TenAceIQ Platform Closeout QA

Use this when the platform is ready for a full quality pass by tier, feature, and connected workflow. The goal is not to add more surface area. The goal is to prove that every role can land, act, save, share, and return without the product feeling disconnected.

## Source Of Truth

- Product story and tier language: `lib/product-story.ts`
- Runtime access model: `lib/access-model.ts`
- Pricing and checkout plans: `lib/pricing-plans.ts`
- Primary navigation access: `lib/primary-nav-access.ts`
- Navigation surfaces: `lib/site-navigation.ts`
- Existing tier inventory: `docs/tier-inventory.md`
- Deploy checklist: `docs/deploy-checklist.md`
- Upgrade request rollout: `docs/upgrade-requests-rollout.md`

## Current Tier Model

| Tier | Product job | Primary surfaces | Closeout question |
| --- | --- | --- | --- |
| Free | Find public tennis context | `/`, `/explore`, `/players`, `/teams`, `/rankings`, `/explore/leagues`, `/pricing` | Can a visitor understand the tennis landscape and know what unlocks next? |
| Player | Make TenAceIQ personal | `/mylab`, `/profile`, `/matchup`, `/messages`, `/player-development`, `/level-up` | Can a player see their plan, train, log proof, and understand progress? |
| Coach | Develop players between lessons | `/coach`, `/coach/invite/[token]`, `/player-development/[identity]/level-up`, `/player-development/[identity]/coach-planner`, `/tactics` | Can a coach invite, assign, review proof, and plan the next lesson? |
| Captain | Run the team week | `/captain`, `/captain/*`, `/teams`, `/compete/teams`, `/compete/schedule`, `/compete/results` | Can a captain move from availability to lineup to weekly team communication? |
| League | Run a league, ladder, or tournament | `/league-coordinator`, `/league-coordinator/results`, `/league-coordinator/individual-results`, `/league-coordinator/tournaments`, `/leagues/[league]` | Can a coordinator create structure, collect results, and keep standings visible? |
| Full-Court | Run the full tennis operation | All paid workspaces | Can a multi-role user move across Player, Coach, Captain, and League without tier confusion? |
| Admin/Internal | Operate data and access | `/admin`, `/admin/*`, Data Assist APIs, import queues | Can internal users review data, activate access, and recover from bad imports? |

## Closeout Principles

- Every paid surface should answer: what can I do here, what did I last do, what should I do next?
- Every gated surface should explain the relevant tier with current `lib/product-story.ts` language.
- Every coach/player workflow should create a short proof signal, not a long journal.
- Every on-court player surface should be phone-first: minimal scrolling, large tap targets, and one obvious next action.
- Every mock/local-only feature should be labeled in this QA doc as `mock`, `local`, `backend-backed`, or `blocked`.
- Every workflow should have at least one smoke check or manual checklist item before closeout.

## Level Up Closeout Loop

Status: high-priority closeout candidate. Feature depth is strong; trust depends on sync, tier behavior, and mobile QA.

| Step | Expected behavior | Current check | Status |
| --- | --- | --- | --- |
| Identity entry | Identity page and CTAs lead to Level Up as the daily-use home. | `/player-development/[identity]/level-up` exists and loads for known identities. | Needs final route QA |
| Player chooses focus | Player can choose lanes such as serve, return, movement, forehand, backhand, volley, singles, doubles, fitness, pressure. | Focus lanes exist in the Level Up portal. | Needs mobile QA |
| Player starts card | Prior choices collapse enough that the active card is the main screen. | Active card mode exists and smoke checks pass. | Needs phone visual QA |
| Player tracks work | Reps, missed reps, timer, rounds, quick notes, and proof rating support on-court use. | `scripts/verify-level-up-player-loop.mjs` validates direct-card mobile start, proof rating, tiny note, and local persistence. | Needs visual QA |
| Player saves proof | Proof score creates next action, first rep, finish recap, and coach update copy. | Player-loop smoke validates run-next, next-practice, coach ask, and copy-update surfaces. | Backend sync review needed |
| Coach assignment | Coach can assign card/module and player sees a challenge. | `scripts/verify-coach-player-loop.mjs` validates the shared assignment/session/check-in contract. | Needs backend E2E test account |
| Coach review | Coach receives useful proof and next-rep signal. | Coach-player loop validates proof recap, review priority, and coach next-focus storage. | Needs coach UI QA |
| Progress returns later | Player sees lane progress, trends, recent proof, recommendations, favorites. | Portal has progress surfaces and local persistence. | Needs persistence audit |

## Player Tier QA

| Feature | Route/surface | Expected loop | Verification |
| --- | --- | --- | --- |
| Player home | `/mylab` | Player sees identity, current tennis context, next useful action. | Manual route + access check |
| Match prep | `/matchup` | Player compares matchup, reads edge, knows what to watch. | Manual route + gated/free states |
| Level Up | `/player-development/[identity]/level-up`, `/level-up/[identity]` | Player trains, scores proof, gets next rep. | Existing smoke + mobile manual |
| Profile link | `/profile` | Player links or confirms their tennis identity. | Manual auth/data check |
| Messages | `/messages` | Player can see tennis communication surface or clear locked/empty state. | Manual route check |

## Coach Tier QA

| Feature | Route/surface | Expected loop | Verification |
| --- | --- | --- | --- |
| Coach hub | `/coach` | Coach sees students, invites, assignments, sessions. | Manual + API smoke |
| Invite player | `/coach/invite/[token]` | Player registers or links account to coach. | Needs end-to-end test account |
| Assign work | `/coach`, Level Up assignment panel | Coach assigns one useful tool, not generic homework. | Manual + API route check |
| Player challenge | Level Up portal | Player sees assigned challenge and sends proof. | Existing smoke + manual linked account |
| Lesson support | `/player-development/[identity]/coach-planner` | Coach gets 1-hour support plan based on identity/readiness. | Manual print/digital check |
| Tactical Studio | `/tactics` | Coach can create/review practical court boards. | Manual gated-state check |

## Captain Tier QA

| Feature | Route/surface | Expected loop | Verification |
| --- | --- | --- | --- |
| Captain hub | `/captain` | Captain sees weekly state and next action. | Manual route check |
| Availability | `/captain/availability`, `/captain/lineup-availability` | Captain knows who can play. | Manual + local persistence check |
| Lineup | `/captain/lineup-builder`, `/captain/lineup-projection` | Captain builds and compares lineup choices. | Manual scenario check |
| Scenario | `/captain/scenario-builder` | Captain tests alternatives before sending. | Manual route check |
| Team messaging | `/captain/messaging`, `/captain/weekly-brief`, `/captain/team-brief` | Captain closes the loop with team communication. | Manual copy/share check |
| Compete bridge | `/compete/*` | Captain can move from public context to team work. | Route/nav check |

## League Tier QA

| Feature | Route/surface | Expected loop | Verification |
| --- | --- | --- | --- |
| League office | `/league-coordinator` | Coordinator sees setup, results, and next operating action. | Manual route check |
| Team results | `/league-coordinator/results` | Coordinator records team results and updates standings context. | Manual data check |
| Individual results | `/league-coordinator/individual-results` | Coordinator records individual results. | Manual data check |
| Tournaments | `/league-coordinator/tournaments`, `/tournaments/*` | Organizer manages event preferences and visibility. | Manual route check |
| League public page | `/leagues/[league]`, `/explore/leagues/*` | Members can see schedule/result/standing context. | Manual public check |
| Data Assist handoff | `/data-assist` | Uploaded schedules/results can refresh league context. | Existing rollout checklist + manual import |

## Free/Public QA

| Feature | Route/surface | Expected loop | Verification |
| --- | --- | --- | --- |
| Home | `/` | Visitor understands product roles and next entry. | Browser route check |
| Explore | `/explore`, `/explore/*` | Visitor finds players, teams, leagues, rankings. | Browser route check |
| Public detail pages | `/players/[id]`, `/teams/[team]`, `/leagues/[league]`, `/team/[id]` | Visitor sees useful public context and upgrade cues. | Manual seeded-data check |
| Pricing | `/pricing` | Tiers match `lib/product-story.ts` and checkout links. | Manual + source check |
| Join/login | `/join`, `/login`, `/reset-password` | Auth entry is clear by role. | Manual auth check |

## Admin/Internal QA

| Feature | Route/surface | Expected loop | Verification |
| --- | --- | --- | --- |
| Access management | `/admin/access`, `/admin/upgrade-requests` | Admin can activate and review access safely. | `docs/upgrade-requests-rollout.md` |
| Data imports | `/admin/import`, `/admin/import-queue`, `/admin/data-assist` | Admin can review incoming data before it shapes product intelligence. | Manual import queue check |
| Data quality | `/admin/anomalies`, `/admin/deduplicate`, `/admin/missing-scorecards`, `/admin/match-reports` | Admin can resolve data issues. | Manual route check |
| Match/player management | `/admin/manage-players`, `/admin/manage-matches`, `/admin/add-match` | Admin can correct core tennis records. | Manual data check |

## Cross-Tier Integration Checks

| Flow | Acceptance criteria |
| --- | --- |
| Free to Player | Visitor sees useful public context, understands Player unlock, and can reach `/pricing#player_plus` or `/join`. |
| Player to Coach invite | Coach invite links player account, player sees assigned Level Up work, coach can review proof. |
| Player to Captain | Captain access includes Player value without confusing Player-only copy. |
| Captain to League | Captain can understand when League Office is needed for organized competition beyond team-week tools. |
| League to Public | League results and schedules create public/member-visible context where intended. |
| Full-Court | User with all workspaces sees coherent navigation and no redundant upgrade prompts. |
| Admin to Product | Admin activation changes access state and related gated pages respond correctly. |

## Automation Targets

Add or extend scripts after this checklist is accepted:

- `scripts/verify-platform-routes.mjs`: visit core public, player, coach, captain, league, admin routes and check title/body availability. Created 2026-06-04.
- `scripts/verify-platform-closeout.mjs`: run deterministic closeout checks, and include route, Level Up, and overflow browser smokes when base URL env vars are provided. Created 2026-06-04.
- `scripts/verify-tier-copy.mjs`: assert tier names, plan ids, access labels, primary-nav locks, and QA docs stay aligned with `lib/product-story.ts`. Created 2026-06-04.
- `scripts/verify-level-up-player-loop.mjs`: run the Level Up player card loop from direct card start to proof, tiny note, next recommendation, and local persistence. Created 2026-06-04.
- `scripts/verify-coach-player-loop.mjs`: exercise coach assignment payloads, Level Up session payloads, player proof check-ins, and coach review handoff with test fixtures. Created 2026-06-04.
- `scripts/portal-overflow-check.mjs`: keep as mobile/desktop layout guard for portal surfaces.

## Initial Findings

- 2026-06-04: Local route smoke surfaced an existing React development console warning on `/`: `A props object containing a "key" prop is being spread into JSX`. Fixed by keeping React keys out of spread preview-card props and removing the smoke-test ignore.

## Closeout Order

1. Update stale tier inventory to include Coach and Full-Court.
2. Build route smoke inventory by tier.
3. Run Level Up mobile/on-court QA first because it is the most interaction-heavy new feature.
4. Run Coach invite/assignment/proof loop with a test account.
5. Run Player, Captain, League, and Admin route passes.
6. Fix broken links, stale tier copy, confusing upgrade prompts, and mock/local-only surfaces that should be backend-backed.
7. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, route smoke, Level Up smoke, and overflow checks.
8. Deploy and verify production.
