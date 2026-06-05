# TenAceIQ Deploy Checklist

Use this checklist before promoting the current redesign and product-architecture changes to production.

## Build

- Run `npm run build`
- Confirm the homepage, pricing page, explore routes, captain routes, and auth pages load locally
- Run `npm run qa:prep` for the customer journey prep packet and inventory guard
- Start journey QA from `docs/customer-journey-qa-index.md`
- Run `npm run qa:status` to confirm the customer journey QA packet is complete
- Run `npm run qa:next` to confirm the next incomplete session or high-priority fix
- Run `npm run qa:session -- <day1-day5>` before each manual testing block
- Run `npm run qa:session-status` after logging results to confirm testing-day blockers
- Run `npm run qa:journey -- <journey-id>` before walking one journey for route, fixture, pass signal, fail-fast, and evidence
- Run `npm run qa:tier -- <tier>` before signing off a role-based tier
- Run `npm run qa:tier-status` after logging results to confirm tier readiness blockers
- Run `npm run qa:week` before next week's full manual journey sweep
- Run `npm run qa:fixtures` to confirm account and safe data setup before journey testing
- Run `npm run qa:ledger` before logging fresh test passes or issues
- Run `npm run qa:flows` before testing a tier end to end
- Run `npm run qa:focus -- <tier-or-journey>` while testing one customer path at a time
- Run `npm run qa:handoffs` before testing linked or shared-role workflows
- Run `npm run qa:matrix` before tier-by-feature testing so every feature is checked against its pain point
- Run `npm run qa:gaps` to focus account, fixture, manual, and local-sync evidence before launch decisions
- Run `npm run qa:evidence` before marking journey results as pass/fail/blocked
- Run `npm run qa:triage` when classifying issue category, severity, and next action
- Run `npm run qa:results` to confirm missing journeys and open p0/p1 rows before launch decisions
- Run `npm run qa:launch` after testing is logged; it should pass before broad launch decisions
- Run `npm run verify:closeout` for deterministic tier and coach-player Level Up contract checks
- For local browser closeout checks, run `npm run verify:closeout -- --browser-base=http://localhost:3074`
- For production closeout checks after deploy, run `npm run verify:closeout:live`

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

## Assets

- Deleted legacy homepage and logo assets were audited against source files in `app`, `lib`, `docs`, and `supabase`
- No remaining source references were found for the removed public assets
- Header and footer branding now use:
  - `public/logo-header-dark.svg`
  - `public/logo-header-light.svg`

## Quick Smoke Test

- Start with `docs/customer-journey-qa-index.md` so the QA status, runbooks, ledger, fixtures, and closeout evidence stay connected
- `npm run verify:closeout` should pass before deploy
- Production closeout with `npm run verify:closeout:live` should pass after deploy
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
