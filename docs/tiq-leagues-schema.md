# TIQ Leagues Schema

This project now has a frontend service boundary for TIQ league storage in
[lib/tiq-league-service.ts](/C:/Users/nmein/tennis-data/lib/tiq-league-service.ts)
and a matching Supabase migration in
[supabase/migrations/20260419_create_tiq_leagues.sql](/C:/Users/nmein/tennis-data/supabase/migrations/20260419_create_tiq_leagues.sql).

## Purpose

`tiq_leagues` is the durable internal competition container for:

- `Team League`
- `Individual League`

It is intentionally separate from imported USTA league context.

## Current App Contract

The current UI writes and reads these fields:

- `id`
- `competition_layer`
- `league_format`
- `individual_competition_format`
- `league_name`
- `season_label`
- `flight`
- `location_label`
- `captain_team_name`
- `notes`
- `teams`
- `players`
- `created_at`
- `updated_at`

The migration also adds:

- `is_public`
- `created_by_user_id`
- `updated_by_user_id`

These ownership fields are what later captain subscription, lightweight league-admin,
and season-fee entitlements should attach to.

## Rollout Notes

1. Apply the migration in Supabase.
2. Keep the app on the current service layer.
3. Once the table exists, the TIQ league service will start using Supabase instead of local fallback.
4. Participant tables now exist for:
   - team membership in TIQ team leagues
   - player membership in TIQ individual leagues
5. The next monetization step should attach entitlement checks to:
   - captain workflow access
   - TIQ team league entry
   - TIQ individual league creation

## Auth And Ownership

The current app write path now expects an authenticated user before it attempts
Supabase-backed create, update, or delete operations for `tiq_leagues`.

If no signed-in user is available on the client:

- reads can still use public Supabase rows when available
- TIQ league writes fall back to the local registry
- the UI receives a warning explaining that ownership policies require sign-in

That matches the migration's RLS contract, where durable writes should attach:

- `created_by_user_id`
- `updated_by_user_id`

## Profile Entitlements

The app now also supports durable profile-level access fields via
[supabase/migrations/20260419_add_profile_entitlements.sql](/C:/Users/nmein/tennis-data/supabase/migrations/20260419_add_profile_entitlements.sql).

These fields live on `public.profiles` and give the frontend a stable monetization
and access seam without hard-coding plan logic everywhere:

- `captain_subscription_active`
- `captain_subscription_status`
- `tiq_team_league_entry_enabled`
- `tiq_individual_league_creator_enabled`

Current frontend behavior is intentionally backward-compatible:

- if these profile columns exist, captain surfaces read and use them
- if they do not exist yet, the UI falls back to the current role-based behavior

That gives the product a safe rollout path from:

- role-based captain access

to:

- durable captain subscription state
- explicit TIQ team-league entry enablement
- explicit TIQ individual-league creator enablement

## Participation Tables

The app now also has dedicated participation tables in
[supabase/migrations/20260420_create_tiq_league_entries.sql](/C:/Users/nmein/tennis-data/supabase/migrations/20260420_create_tiq_league_entries.sql):

- `public.tiq_team_league_entries`
- `public.tiq_player_league_entries`

These tables are the new durable home for:

- captain-led team entry into TIQ team leagues
- player joins into TIQ individual leagues

The participation tables now also support richer optional identity references:

- team entries can store `team_entity_id`, `source_league_name`, and `source_flight`
- player entries can store `player_id` and `player_location`

The current frontend service merges these entry rows back into TIQ league detail and browse views,
while still falling back to the embedded `teams` / `players` arrays when the new tables are not
available yet.

## TIQ Individual Results

The app now also has a dedicated TIQ individual-results table in
[supabase/migrations/20260420_create_tiq_individual_results.sql](/C:/Users/nmein/tennis-data/supabase/migrations/20260420_create_tiq_individual_results.sql)
and a matching client service in
[lib/tiq-individual-results-service.ts](/C:/Users/nmein/tennis-data/lib/tiq-individual-results-service.ts).

This layer is the durable home for:

- TIQ individual-league match outcomes
- player-vs-player result history inside TIQ competition
- recent TIQ activity shown on league detail and `Compete > Results`

It keeps TIQ internal competition activity separate from imported USTA official match truth, while
still allowing the UI to fall back to local result storage if the new table is not available yet.

## TIQ Individual Suggestions

The app now also has a dedicated TIQ individual-suggestions table in
[supabase/migrations/20260420_create_tiq_individual_suggestions.sql](/C:/Users/nmein/tennis-data/supabase/migrations/20260420_create_tiq_individual_suggestions.sql)
and a matching client service in
[lib/tiq-individual-suggestions-service.ts](/C:/Users/nmein/tennis-data/lib/tiq-individual-suggestions-service.ts).

This layer is the durable home for:

- saved ladder targets
- saved round-robin pairing gaps
- saved challenge prompts
- open vs completed TIQ individual workflow suggestions
- claimed prompt ownership for lightweight execution flow

The current UI uses these suggestion objects on TIQ individual league detail, `Compete > Leagues`,
and `My Lab`, while still falling back to local suggestion storage if the new table is not available
yet.

## Individual Format Rules

The app now also supports a lightweight first-class individual format field via
[supabase/migrations/20260420_add_individual_format_to_tiq_leagues.sql](/C:/Users/nmein/tennis-data/supabase/migrations/20260420_add_individual_format_to_tiq_leagues.sql)
and the shared helper in
[lib/tiq-individual-format.ts](/C:/Users/nmein/tennis-data/lib/tiq-individual-format.ts).

Current supported TIQ individual formats:

- `standard`
- `ladder`
- `round_robin`
- `challenge`

This is intentionally additive. It gives season setup, browse, and league detail pages a clean way
to describe the individual competition model now, while leaving room for deeper format-specific
rules later.
