# TenAceIQ Deploy Checklist

Use this checklist before promoting the current redesign and product-architecture changes to production.

## Build

- Confirm the active release branch is `master`. GitHub default branch is `master`, but the Vercel Git production branch setting still reports `main`; do not rely on automatic production deploys from Git until that Vercel dashboard setting is changed to `master`.
- Run `npm run build`
- Run `npm run audit:artifacts` after local builds to confirm generated files, logs, zips, screenshots, and nested repo copies are not sitting in the workspace
- Confirm the homepage, pricing page, explore routes, captain routes, and auth pages load locally
- Run `npm run qa:prep` for the customer journey prep packet and inventory guard
- Start journey QA from `docs/customer-journey-qa-index.md`
- Open `docs/customer-journey-test-week-quickstart.md` for the daily test rhythm, pass rules, and closeout order
- Run `npm run qa:status` to confirm the customer journey QA packet is complete
- Run `npm run qa:control` for the compact mission-control scoreboard before choosing the next manual block
- Run `npm run qa:start -- --date=yyyy-mm-dd --tester=<name>` for the shortest first manual testing block
- Run `npm run qa:today -- --date=yyyy-mm-dd --tester=<name>` for the active testing-day sheet
- Run `npm run qa:readiness` before manual testing to confirm packet health, ledger state, and first commands
- Run `npm run qa:brief -- <day1-day5> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` as the daily testing start card
- Run `npm run qa:risk-board` before broad manual testing to rank the next highest-risk proof gap
- Run `npm run qa:next` to confirm the next incomplete session or high-priority fix
- Run `npm run qa:session -- <day1-day5>` before each manual testing block
- Run `npm run qa:session-status` after logging results to confirm testing-day blockers
- Run `npm run qa:day -- <day1-day5> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` for the compact daily testing driver
- Run `npm run qa:tester-packet -- <day1-day5> --device=<phone|tablet|desktop> --date=yyyy-mm-dd --tester=<name>` before a device-specific testing block
- Run `npm run qa:kickoff -- <journey-id> --device=<phone|tablet|desktop> --date=yyyy-mm-dd --tester=<name>` before opening one journey so fixtures, evidence, ledger row, and closeout gates stay aligned
- Run `npm run qa:journey -- <journey-id>` before walking one journey for route, fixture, pass signal, fail-fast, and evidence
- Run `npm run qa:live-card -- <journey-id> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` while executing a journey so capture names and ledger rows stay aligned
- Run `npm run qa:device-card -- <phone|tablet|desktop>` before device-sensitive passes so viewport checks and live-card commands stay explicit
- Run `npm run qa:device-ledger -- <phone|tablet|desktop> --date=yyyy-mm-dd --tester=<name>` before logging a device batch
- Run `npm run qa:device-status -- <phone|tablet|desktop>` after logging results so missing device evidence is visible before signoff
- Run `npm run qa:route-review -- <route>` while browser testing to confirm what the current page should prove
- Run `npm run qa:tier -- <tier>` before signing off a role-based tier
- Run `npm run qa:tier-status` after logging results to confirm tier readiness blockers
- Run `npm run qa:tier-board -- <tier>` when signing off a role so promise, feature pain points, proving journeys, evidence state, and next command are visible together
- Run `npm run qa:access-review -- <tier>` before tier signoff to confirm expected unlocks, protected controls, and proving journeys
- Run `npm run qa:week` before next week's full manual journey sweep
- Run `npm run qa:week-plan -- --date=yyyy-mm-dd --tester=<name>` before broad testing to schedule required device packets by day
- Run `npm run qa:fixtures` to confirm account and safe data setup before journey testing
- Run `npm run qa:fixture-board` before broad testing to confirm account access, player/coach links, safe data fixtures, dependent journeys, and fixture-gap rows
- Run `npm run qa:fixture-status -- <day1-day5>` before a testing block to see required fixtures and open fixture-gap blockers
- Run `npm run qa:fixture-review -- <fixture>` before logging fixture-gap or rerunning fixture-dependent journeys
- Run `npm run qa:ledger` before logging fresh test passes or issues
- Run `npm run qa:session-ledger -- <day1-day5> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` when logging only the active testing block
- Run `npm run qa:flows` before testing a tier end to end
- Run `npm run qa:trace -- <tier|journey|feature|route>` before tier signoff to connect promise, pain point, access, proving journeys, and evidence
- Run `npm run qa:focus -- <tier-or-journey>` while testing one customer path at a time
- Run `npm run qa:handoffs` before testing linked or shared-role workflows
- Run `npm run qa:matrix` before tier-by-feature testing so every feature is checked against its pain point
- Run `npm run qa:feature-review -- <feature>` before closing a feature-specific fix or regression
- Run `npm run qa:coverage -- <tier>` to confirm every feature has a proving journey and logged pass evidence
- Run `npm run qa:gaps` to focus account, fixture, manual, and local-sync evidence before launch decisions
- Run `git diff --name-only <last-tested-sha-or-tag>..HEAD`, then `npm run qa:change-impact -- --files=<comma-separated-files>` after product changes so impacted journeys get fresh evidence
- Run `npm run qa:evidence` before marking journey results as pass/fail/blocked
- Run `npm run qa:evidence-index` before capture so screenshots/videos stay under `docs/qa-evidence` and are traceable from the ledger
- Run `npm run qa:evidence-pack -- <day1-day5> --date=yyyy-mm-dd --tester=<name> --device=<device/browser>` before saving screenshots or videos
- Run `npm run qa:triage` when classifying issue category, severity, and next action
- Run `npm run qa:issue` when a tester needs the issue result, category, severity, stop/continue, and retest decision path
- Run `npm run qa:proof-gaps -- <day1-day5|tier|journey>` after logging rows to see missing pass evidence, missing screenshot/video, and open blockers before signoff
- Run `npm run qa:week-dashboard -- <day1-day5|tier|journey>` to see day, tier, fixture, evidence, blocker, and next-command status
- Run `npm run qa:ledger-check` to validate status, category, severity, fixture, route, evidence, and next-action fields
- Run `npm run qa:results` to confirm missing journeys and open p0/p1 rows before launch decisions
- Run `npm run qa:action-list` to confirm every logged fail, blocked, or follow-up row has a concrete next action
- Run `npm run qa:owner-board` to confirm every open journey or blocker has an owner lane before signoff
- Run `npm run qa:retest -- <day-or-journey>` after fixes to confirm the right journey gets fresh pass evidence
- Run `npm run qa:daily-summary -- <yyyy-mm-dd>` after each testing block so the daily pass/fail count and top fix are clear
- Run `npm run qa:close-day -- <day1-day5> --date=yyyy-mm-dd` before calling a testing day done
- Run `npm run qa:tester-handoff -- <day1-day5> --date=yyyy-mm-dd` before handing the testing block to another tester or future session
- Run `npm run qa:scorecard` before signoff meetings to review tier, session, evidence, blocker, and next-command status
- Run `npm run qa:signoff` before launch readiness to confirm every journey owner, evidence state, and blocker
- Run `npm run qa:launch-board` before launch readiness to separate product blockers, fixture/test blockers, quality follow-ups, and missing evidence
- Run `npm run qa:launch-owner-board -- --live --stripe-mode` before launch handoff to separate blocking product/code gates from owner-controlled Vercel and Stripe cutover actions
- Run `npm run qa:post-launch -- --live` after production deploys or launch announcements to keep production logs, SEO/share, AdSense, owner actions, and closeout checks in one monitoring cadence
- Run `npm run qa:launch` after testing is logged; it should pass before broad launch decisions
- Run `npm run qa:seo-share -- --live` before launch handoff to verify canonical metadata, social cards, structured data, sitemap, robots, and the social preview image against production
- Run `npm run verify:closeout` for deterministic tier and coach-player Level Up contract checks
- For local browser closeout checks, run `npm run verify:closeout -- --browser-base=http://localhost:3074`
- For production closeout checks after deploy, run `npm run verify:closeout:live`
- For production runtime health after deploy, run `npm run qa:prod-logs`
- Run `npm run qa:vercel-branch` to confirm Vercel's Git production branch is aligned to `master`; until it passes, keep production promotions explicit and verified. The dashboard setting is at `https://vercel.com/tennis-data/tennis-data/settings/git#connected-git-repository`.
- Before switching Stripe to live mode, run `npm run qa:stripe-live-readiness -- --vercel`

## Production Promotion

- Until Vercel's Git production branch setting is aligned from `main` to `master`, promote production intentionally from a verified deployment instead of assuming a `master` push becomes production.
- `npm run qa:vercel-branch` should pass after the Vercel dashboard setting is corrected at `https://vercel.com/tennis-data/tennis-data/settings/git#connected-git-repository`.
- Confirm `npx vercel project inspect tennis-data --scope tennis-data` before promotion; Node.js Version should be `22.x`.
- Confirm the deployment to promote is `Ready`, tied to the expected `master` commit, and has passed the relevant QA gates.
- After promotion, run `npm run verify:closeout:live` and `npm run qa:prod-logs` to confirm recent production runtime health.
- Vercel Web Analytics and Speed Insights are mounted in the root app shell; review `https://vercel.com/tennis-data/tennis-data/analytics` and `https://vercel.com/tennis-data/tennis-data/speed-insights` during the first hour and daily launch-week checks.

## Database

Apply the Supabase migrations in `supabase/migrations` before relying on the new TIQ league and entitlement flows in production.

Current migration set:

- `20260419_add_profile_entitlements.sql`
- `20260419_create_tiq_leagues.sql`
- `20260420_add_claim_fields_to_tiq_individual_suggestions.sql`
- `20260420_add_individual_format_to_tiq_leagues.sql`
- `20260420_add_player_refs_to_tiq_entries.sql`
- `20260420_add_team_refs_to_tiq_entries.sql`
- `20260420_create_tiq_individual_results.sql`
- `20260420_create_tiq_individual_suggestions.sql`
- `20260420_create_tiq_league_entries.sql`
- `20260421_rating_dual_track.sql`
- `20260421_tiq_team_match_results.sql`

## AdSense

The AdSense client is already wired in the app shell.

Production should define:

- `NEXT_PUBLIC_ADSENSE_SLOT_HOME_INLINE`

Optional inline slots already supported in `.env.example`:

- `NEXT_PUBLIC_ADSENSE_SLOT_EXPLORE_INLINE`
- `NEXT_PUBLIC_ADSENSE_SLOT_RANKINGS_INLINE`
- `NEXT_PUBLIC_ADSENSE_SLOT_PLAYERS_INLINE`
- `NEXT_PUBLIC_ADSENSE_SLOT_LEAGUES_INLINE`
- `NEXT_PUBLIC_ADSENSE_SLOT_TEAMS_INLINE`
- `NEXT_PUBLIC_ADSENSE_SLOT_MATCHUP_INLINE`

If a slot id is not set, the related ad surface safely stays hidden.

## Stripe Live Mode

- Keep Stripe in test mode until real paid upgrades should open.
- Run `npm run qa:stripe-live-cutover` to print the secret-free owner packet.
- Run `npm run qa:stripe-live-readiness` before changing credentials.
- Run `npm run qa:stripe-live-readiness -- --vercel` to verify Production env names are present without printing secret values.
- After replacing Production Stripe values with live keys, live webhook secret, and live price IDs, redeploy Production and run `npm run qa:stripe-live-mode`.

## Assets

- Deleted legacy homepage and logo assets were audited against source files in `app`, `lib`, `docs`, and `supabase`
- No remaining source references were found for the removed public assets
- Header and footer branding now use:
  - `public/tiq/logo/tiq-lockup-dark.png`
  - `public/tiq/logo/tiq-lockup-light.png`
  - `public/tiq/logo/tiq-app-icon.png`
  - `public/tiq/logo/tiq-q-icon-dark.png`
  - `public/tiq/logo/tiq-mark-dark.png`
  - `public/tiq/logo/tiq-mark-light.png`

## Quick Smoke Test

- Start with `docs/customer-journey-qa-index.md` and `docs/customer-journey-test-week-quickstart.md` so the QA status, runbooks, ledger, fixtures, daily rhythm, and closeout evidence stay connected
- `npm run verify:closeout` should pass before deploy
- `npm run audit:artifacts` should pass before deploy so local generated files stay out of the platform workspace
- Production closeout with `npm run verify:closeout:live` should pass after deploy
- Production runtime health with `npm run qa:prod-logs` should report zero recent errors, fatals, or HTTP 500s after deploy
- Post-launch monitoring with `npm run qa:post-launch -- --live` should pass after deploys or broad public announcements
- Vercel Web Analytics and Speed Insights should show expected public traffic and no material performance regression after broad public links are shared
- Production SEO/share readiness with `npm run qa:seo-share -- --live` should pass before sending broad public links
- `npm run qa:status` should show every journey QA doc and command present
- Check single dark-shell header/footer branding
- Check homepage hero, product preview cards, and footer CTAs
- Check mobile header menu
- Check `/pricing`
- Check `/explore`
- Check `/captain`
- Check `/coach`
- Check `/league-coordinator`
- Check `/player-development/relentless-competitor-4-0/level-up`
