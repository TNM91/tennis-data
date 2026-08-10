# Launch Data Reset Log - 20260724T2242Z

Scope confirmed by owner:

`I confirm resetting imported tennis data only, preserving accounts, profiles, billing, entitlements, and messages.`

## Backup Tables

Remote backup schema: `launch_backup`

- `reset_20260724T2242Z_profiles_player_links`: 8 rows
- `reset_20260724T2242Z_coach_player_link_refs`: 1 row
- `reset_20260724T2242Z_tiq_player_entry_refs`: 0 rows
- `reset_20260724T2242Z_data_assist_ocr_jobs`: 16 rows
- `reset_20260724T2242Z_data_assist_drafts`: 16 rows
- `reset_20260724T2242Z_data_assist_screenshots`: 16 rows
- `reset_20260724T2242Z_data_assist_batches`: 16 rows
- `reset_20260724T2242Z_import_queue`: 3 rows
- `reset_20260724T2242Z_rating_snapshots`: 4 rows
- `reset_20260724T2242Z_match_accuracy_reports`: 0 rows
- `reset_20260724T2242Z_team_roster_members`: 95 rows
- `reset_20260724T2242Z_match_players`: 125 rows
- `reset_20260724T2242Z_team_summary_teams`: 6 rows
- `reset_20260724T2242Z_matches`: 65 rows
- `reset_20260724T2242Z_players`: 81 rows

## Reset Verification

Reset tables after execution:

- `public.data_assist_ocr_jobs`: 0 rows
- `public.data_assist_drafts`: 0 rows
- `public.data_assist_screenshots`: 0 rows
- `public.data_assist_batches`: 0 rows
- `public.import_queue`: 0 rows
- `public.rating_snapshots`: 0 rows
- `public.match_accuracy_reports`: 0 rows
- `public.team_roster_members`: 0 rows
- `public.match_players`: 0 rows
- `public.team_summary_teams`: 0 rows
- `public.matches`: 0 rows
- `public.players`: 0 rows

Preserved tables checked:

- `public.profiles`: 14 rows
- `public.upgrade_requests`: 49 rows
- `public.stripe_billing_events`: 2 rows

Detached stale imported-data references:

- Profiles with linked player/team fields: 0 rows
- Coach player links with imported `player_id`: 0 rows
- TIQ player entries with imported player references: 0 rows

## Rebuild Order

1. Import Team Summary.
2. Import Season Schedule.
3. Import Scorecards.
4. Run rating recalculation.
5. Spot-check `/players`, `/teams`, `/leagues`, `/rankings`, `/matchup`, `/admin/import-queue`.
