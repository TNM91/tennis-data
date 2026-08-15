alter table public.tiq_tournament_entries
  add column if not exists player_action_required boolean not null default false,
  add column if not exists player_request_note text not null default '',
  add column if not exists player_responded_at timestamptz;
alter table public.tiq_player_league_entries
  add column if not exists player_action_required boolean not null default false,
  add column if not exists player_request_note text not null default '',
  add column if not exists player_responded_at timestamptz;
comment on column public.tiq_tournament_entries.player_request_note is
'The director-facing question shown to the player when an entry needs more information.';
comment on column public.tiq_player_league_entries.player_request_note is
'The League Office question shown to the player when an entry needs more information.';
drop policy if exists "Entrants can read their TIQ tournament entries" on public.tiq_tournament_entries;
create policy "Entrants can read their TIQ tournament entries"
on public.tiq_tournament_entries
for select
to authenticated
using (submitted_by_user_id = auth.uid());
create or replace function public.resolve_tiq_entry_information(
  p_entry_kind text,
  p_entry_id uuid,
  p_rating numeric default null,
  p_mixed_pair_role text default null,
  p_age_division text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
  clean_role text := lower(trim(coalesce(p_mixed_pair_role, '')));
  clean_age text := trim(coalesce(p_age_division, ''));
begin
  if auth.uid() is null then
    raise exception 'Sign in to update entry information.';
  end if;

  if p_rating is not null and (p_rating < 1.0 or p_rating > 7.0) then
    raise exception 'Rating must be between 1.0 and 7.0.';
  end if;

  if clean_role not in ('', 'man', 'woman', 'unknown') then
    raise exception 'Choose a supported mixed doubles role.';
  end if;

  if p_entry_kind = 'tournament' then
    update public.tiq_tournament_entries
    set
      eligibility_rating = coalesce(p_rating, eligibility_rating),
      eligibility_rating_source = case when p_rating is null then eligibility_rating_source else 'self' end,
      eligibility_mixed_pair_role = case when clean_role = '' then eligibility_mixed_pair_role else clean_role end,
      eligibility_mixed_pair_role_source = case when clean_role = '' then eligibility_mixed_pair_role_source else 'self' end,
      eligibility_age_division = case when clean_age = '' then eligibility_age_division else clean_age end,
      eligibility_age_division_source = case when clean_age = '' then eligibility_age_division_source else 'self' end,
      eligibility_submitted_at = now(),
      eligibility_status = 'needs_confirmation',
      eligibility_review_note = 'Player supplied updated eligibility information.',
      player_action_required = false,
      player_request_note = '',
      player_responded_at = now(),
      updated_at = now()
    where id = p_entry_id
      and submitted_by_user_id = auth.uid()
      and status = 'pending';
  elsif p_entry_kind = 'league' then
    update public.tiq_player_league_entries
    set
      eligibility_rating = coalesce(p_rating, eligibility_rating),
      eligibility_rating_source = case when p_rating is null then eligibility_rating_source else 'self' end,
      eligibility_mixed_pair_role = case when clean_role = '' then eligibility_mixed_pair_role else clean_role end,
      eligibility_mixed_pair_role_source = case when clean_role = '' then eligibility_mixed_pair_role_source else 'self' end,
      eligibility_age_division = case when clean_age = '' then eligibility_age_division else clean_age end,
      eligibility_age_division_source = case when clean_age = '' then eligibility_age_division_source else 'self' end,
      eligibility_submitted_at = now(),
      eligibility_status = 'needs_confirmation',
      eligibility_review_note = 'Player supplied updated eligibility information.',
      player_action_required = false,
      player_request_note = '',
      player_responded_at = now(),
      updated_at = now()
    where id = p_entry_id
      and created_by_user_id = auth.uid()
      and entry_status = 'pending';
  else
    raise exception 'Unsupported entry type.';
  end if;

  get diagnostics updated_count = row_count;

  if updated_count = 1 and p_entry_kind = 'tournament' then
    insert into public.internal_notifications (
      recipient_profile_id,
      actor_user_id,
      notification_type,
      title,
      body,
      href
    )
    select
      tournament.created_by_user_id,
      auth.uid(),
      'system',
      'Tournament entry information updated',
      entry.player_name || ' sent the requested entry information.',
      '/league-coordinator/tournaments#tournament-entries'
    from public.tiq_tournament_entries entry
    join public.tiq_tournaments tournament on tournament.id::text = entry.tournament_id::text
    where entry.id = p_entry_id
      and tournament.created_by_user_id is not null
      and tournament.created_by_user_id <> auth.uid();
  elsif updated_count = 1 and p_entry_kind = 'league' then
    insert into public.internal_notifications (
      recipient_profile_id,
      actor_user_id,
      notification_type,
      title,
      body,
      href
    )
    select
      league.created_by_user_id,
      auth.uid(),
      'system',
      'League entry information updated',
      entry.player_name || ' sent the requested entry information.',
      '/league-coordinator#league-registry'
    from public.tiq_player_league_entries entry
    join public.tiq_leagues league on league.id::text = entry.league_id::text
    where entry.id = p_entry_id
      and league.created_by_user_id is not null
      and league.created_by_user_id <> auth.uid();
  end if;

  return updated_count = 1;
end;
$$;
revoke all on function public.resolve_tiq_entry_information(text, uuid, numeric, text, text) from public;
grant execute on function public.resolve_tiq_entry_information(text, uuid, numeric, text, text) to authenticated;
