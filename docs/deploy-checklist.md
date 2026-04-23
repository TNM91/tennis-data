# TenAceIQ Deploy Checklist

Use this checklist before promoting the current redesign and product-architecture changes to production.

## Build

- Run `npm run build`
- Confirm the homepage, pricing page, explore routes, captain routes, and auth pages load locally

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

- Check dark and light mode header/footer branding
- Check homepage hero, Player+ matchup card, and footer CTAs
- Check mobile header menu
- Check `/pricing`
- Check `/explore`
- Check `/captain`
- Check `/preview-home`
