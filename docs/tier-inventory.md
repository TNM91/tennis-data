# TenAceIQ Tier Inventory

Captured locally on 2026-05-19 from the current repo.

## Source Of Truth

- Product tier language: `lib/product-story.ts`
- Pricing and entitlement grants: `lib/pricing-plans.ts`
- Runtime access model: `lib/access-model.ts`
- Primary navigation gates: `lib/primary-nav-access.ts`
- Navigation/tool surfaces: `lib/site-navigation.ts`
- Pricing page: `app/pricing/page.tsx`
- Upgrade prompts and locked pages: `app/components/upgrade-prompt.tsx`, `app/components/locked-plan-page.tsx`
- Billing policy: `lib/billing-policy.ts`

## Product North Star

TenAceIQ helps tennis players, captains, and league coordinators spend less time guessing, more time understanding, and more time playing.

## Tier Summary

| Tier | Plan id | Price | Billing model | Checkout mode | Quantity mode | Audience |
| --- | --- | ---: | --- | --- | --- | --- |
| Free | `free` | `$0` | Free account | None | Account | Players, captains, and fans getting oriented |
| Player | `player_plus` | `$4.99/month` | Monthly subscription | Subscription | Account | Players who want clearer prep and a personalized tennis home |
| Captain | `captain` | `$9.99/month` | Monthly subscription | Subscription | Account | Captains managing lineups, readiness, and weekly decisions |
| TIQ League Coordinator | `league` | `$25/season per league` | Season fee | One-time | League | League coordinators and admins running players or teams |

Discount rule:

- `captain_first_league_half_off`: active Captains get 50% off their first League plan purchase.

## Free

Short promise: Explore the tennis landscape.

Upgrade cue: Start with public tennis intelligence.

Pricing:

- `$0`
- Free account
- No checkout

Entitlements granted:

- No paid entitlement flags.
- Free access is always available through `hasPlanAccess(..., 'free')`.

Features and tools:

- Search players, teams, leagues, and rankings.
- View public tennis context.
- Explore public navigation: Explore, Players, Teams, Leagues, Rankings, Pricing, public profile/team/league pages.
- Contribute TennisLink exports through Data Assist.
- Use public account surfaces such as Profile, Messages, and Data Assist where allowed by auth/workflow.
- Sponsored placements may show when no paid Player, Captain, or League tools are active.

Primary value props:

- Search players, teams, leagues, and rankings.
- View public tennis context.
- Contribute TennisLink exports through Data Assist.
- Understand the landscape before upgrading.

## Player

Short promise: Personalize TenAceIQ around your game.

Upgrade cue: Unlock My Lab, follows, matchups, and player-linked insight.

Pricing:

- `$4.99/month`
- Monthly subscription
- Account quantity

Entitlements granted:

- `playerPlus: true`
- `captain: false`
- `leagueCoordinator: false`
- `tiqTeamLeagueEntry: false`
- `tiqIndividualLeagueCreator: false`

Runtime access:

- `canUseAdvancedPlayerInsights: true`
- `canUsePlayerProjections: true`
- Captain access also includes Player access.

Features and tools:

- My Lab.
- Player-linked profile identity.
- Follows for players, teams, leagues, and rankings.
- Matchup insight and projections.
- Personalized match prep around the linked player.
- Personal scorecard, ratings, recent results, team/league context, goals, notebook, and followed feed inside My Lab.
- Compare against linked player from public player/search surfaces when available.
- Player-level prompts on Players, Rankings, Matchup, My Lab, and Explore Search.

Primary gated routes:

- `/mylab`
- `/matchup`

Primary value props:

- Unlock My Lab.
- Follow players, teams, leagues, and rankings.
- Compare how you and others may fare in matchups.
- Connect your player identity to TenAceIQ.

## Captain

Short promise: Make team decisions with more clarity.

Upgrade cue: Add captain tools on top of Player features.

Pricing:

- `$9.99/month`
- Monthly subscription
- Account quantity
- Marked as `Most Popular` in pricing.

Entitlements granted:

- `playerPlus: true`
- `captain: true`
- `leagueCoordinator: false`
- `tiqTeamLeagueEntry: false`
- `tiqIndividualLeagueCreator: false`

Runtime access:

- `canUseAdvancedPlayerInsights: true`
- `canUsePlayerProjections: true`
- `canUseCaptainWorkflow: true`
- Does not grant League Coordinator access by itself.

Features and tools:

- All Player tools.
- Captain hub.
- Availability.
- Lineup builder.
- Scenario builder.
- Team messaging.
- Weekly brief.
- Lineup projection.
- Match availability.
- Captain IQ / analytics.
- Team brief.
- Team readiness and match-week status.
- Roster, pair, player signal, opponent scouting, and lineup decision support.
- Data Assist handoff for schedules, rosters, scorecards, and match-week context.
- Captain prompts on Teams, Leagues, Compete Teams, Compete Schedule, Compete Results, and Captain pages.

Primary gated routes:

- `/captain`
- `/captain/availability`
- `/captain/lineup-builder`
- `/captain/scenario-builder`
- `/captain/messaging`
- `/captain/weekly-brief`
- `/captain/lineup-projection`
- `/captain/lineup-availability`
- `/captain/analytics`
- `/captain/team-brief`

Primary value props:

- Build and compare lineups.
- Scout players and teams.
- Track availability and readiness.
- Use Data Assist uploads to keep match-week context fresh.
- Make weekly team decisions with less guesswork.

## TIQ League Coordinator

Short promise: Run the season from one place.

Upgrade cue: Give coordinators and members one place for requests, schedules, results, and standings.

Pricing:

- `$25/season per league`
- One-time season fee
- League quantity

Season policy:

- Standard season is capped at 12 weeks unless TenAceIQ approves an extension.
- Standard season supports up to 120 match events or result entries before a new season should be created.
- Season fees are generally refundable only before the league is published, scheduled, or used for result activity.

Entitlements granted:

- `playerPlus: false`
- `captain: false`
- `leagueCoordinator: true`
- `tiqTeamLeagueEntry: true`
- `tiqIndividualLeagueCreator: true`

Runtime access:

- `canUseLeagueTools: true`
- `canCreateTiqTeamLeague: true` when `tiqTeamLeagueEntryEnabled` is active.
- `canEnterTiqTeamLeague: true` when `tiqTeamLeagueEntryEnabled` is active.
- `canCreateTiqIndividualLeague: true` when `tiqIndividualLeagueCreatorEnabled` is active.
- `canJoinTiqIndividualLeague: true` for signed-in members.
- Coordinator activation stays independent from Player and Captain access.

Features and tools:

- League Coordinator overview.
- League setup and draft creation.
- Team league entry/approval workflows.
- Individual league creator workflows.
- Team results workspace.
- Player results workspace.
- Schedules, sites, match details, result tracking, standings, and visibility.
- Data Assist uploads for schedules, rosters, and official scorecards.
- TIQ league detail coordinator actions such as schedule/result management where league access is active.
- Coordinator prompts on League Coordinator, TIQ league detail, Team Results, Player Results, Teams, Leagues, and Compete pages.

Primary gated routes:

- `/league-coordinator`
- `/league-coordinator/results`
- `/league-coordinator/individual-results`

Coordinator navigation:

- Overview
- Setup
- Team Results
- Player Results
- Data Assist
- My Leagues
- Browse
- Plan

Primary value props:

- Approve teams or players before they enter the season.
- Keep schedules, sites, and match details in one league home.
- Use Data Assist uploads for schedules, rosters, and official scorecards.
- Turn results into standings without spreadsheet cleanup.
- Give members a clear place to know who, when, where, and what happened.

## Admin/Internal Role

Admin is present in the product north star as part of the Coordinator/Admin operating layer, but it is not a priced public plan in `PRICING_PLANS`.

Runtime behavior:

- Role-backed Admin access turns on Player access.
- Role-backed Admin access turns on League tools.
- Role-backed Admin access does not automatically set `captainSubscriptionActive`, though admin pages and internal tools may still expose operational workflows.

Internal/admin surfaces found in the repo:

- `/admin`
- `/admin/access`
- `/admin/upgrade-requests`
- `/admin/product-events`
- `/admin/data-assist`
- `/admin/import`
- `/admin/import-queue`
- `/admin/missing-scorecards`
- `/admin/match-reports`
- `/admin/manage-players`
- `/admin/manage-matches`
- `/admin/add-match`
- `/admin/tiq-team-matches`
- `/admin/lineup-availability`
- `/admin/anomalies`
- `/admin/deduplicate`

Admin workflows:

- Review and activate upgrade requests.
- Manage product/access entitlements.
- Review imports, scorecards, OCR/data assist drafts, and data quality.
- Manage players and matches.
- Review match accuracy reports.
- Operate internal TIQ team match and lineup availability tooling.

## Access Model Notes

- Active plan ids always include `free`.
- Player access is satisfied by either `player_plus` or `captain`.
- Captain access requires `captain`.
- League access requires `league`.
- Current plan precedence is Captain, then League, then Player, then Free.
- Recommended next plan:
  - Public/member without paid access: Player.
  - Captain without League tools: League.
  - Admin: no recommendation.
  - Users with active League tools: no recommendation.

## Billing Policy Notes

- Player and Captain renew monthly until canceled.
- Cancellation stops future renewals; access normally continues through the paid period.
- Monthly subscription charges are generally non-refundable after the billing period begins.
- Refund exceptions may include duplicate charges, billing errors, accidental same-day purchases, or support-approved cases.
- Stripe processes payments; TenAceIQ does not store full card numbers.

## Premium Redesign Rollout Map

Updated locally on 2026-05-20 after the platform-wide visual uplift.

Design direction:

- Single dark premium TenAceIQ look across desktop, tablet, and mobile.
- Role language organized around Find, You, Team, and League.
- More showing, less telling: command panels, suite panels, action cards, icon-led steps, and scannable state.
- Tier value is shown as workflows: explore, personalize, lead the team week, operate the season.
- Paid unlock moments connect back to the same tier language and app destinations.

Completed rollout surfaces:

- Global shell, header, brand wordmark, navigation, theme provider, and single-theme styling.
- Homepage and preview homepage role modes.
- Pricing and upgrade flow with tier cards, unlock map, checkout/activation handoff, and selected/active plan clarity.
- Join and Login onboarding with Free, Player, Captain, and Coordinator path pickers.
- Profile, My Lab, and Matchup connected through the Player Suite panel.
- Captain hub and Captain subnav connected through the Captain Suite panel.
- League Coordinator, team results, individual results, and coordinator subnav connected through the League Suite panel.
- Find and Explore surfaces connected through Find mode bridges across players, teams, rankings, leagues, and detail pages.
- Compete section upgraded with icon/action navigation and cards.
- Data Assist upgraded with command-panel flow.
- Messages and Contact upgraded with action lanes and support cards.
- About, How It Works, FAQ, and Methodology upgraded with shared visual action cards.
- Legal pages upgraded with shared legal quick links.
- Account recovery pages upgraded with icon-led reset steps.
- Admin hub upgraded with branded tool icons.
- Global navigation labels tightened to Find, You, Prep, Team, League, and Plans so the app reads as a simple product flow instead of an internal feature list.
- Shared shell logic now treats public player, team, ranking, and league pages as Find mode, while reserving League mode for the league operations workspace.
- Older visible directory links in Captain, Data Assist, Matchup, Compete Results, and How It Works now route through `/explore/*` so users stay in the new Find flow.
- Pricing, upgrade, locked-plan, and shared product-story copy now use the clearer Find / You / Team / League language while preserving the formal TIQ League Coordinator plan name where needed.
- Single-theme cleanup removed the remaining theme toggle surface, made leftover native controls explicitly dark, and renamed old theme test descriptions to match the dark premium shell.

Key shared design components added:

- `app/components/captain-suite-panel.tsx`
- `app/components/league-suite-panel.tsx`
- `app/components/player-suite-panel.tsx`
- `app/components/find-mode-bridge.tsx`
- `app/components/info-action-grid.tsx`

Current user-facing tier flow:

| User job | Entry language | Main surfaces | Paid unlock cue |
| --- | --- | --- | --- |
| Find tennis context | Find | `/explore`, `/players`, `/teams`, `/rankings`, `/explore/leagues` | Free is useful before upgrade |
| Improve my game | You / Prep | `/profile`, `/mylab`, `/matchup` | Player unlocks My Lab, follows, and matchup prep |
| Lead a team week | Team / Captain | `/captain`, `/captain/*` | Captain unlocks lineup, readiness, scenarios, messaging, and briefs |
| Run a season | League / Coordinator | `/league-coordinator`, `/league-coordinator/results`, `/league-coordinator/individual-results` | Coordinator unlocks setup, participants, schedules, results, standings, and visibility |

Verification during rollout:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

All redesign slices recorded above passed the three checks when applied.

Preview/deploy note:

- Local browser views such as `http://127.0.0.1:3004/` may not show the latest redesign until the dev server is restarted or the app is deployed.
- A site backup was created before the major redesign at `backups/tenaceiq-site-backup-20260519-162136.zip`.
