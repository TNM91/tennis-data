alter table public.tiq_tournament_entries
  add column if not exists eligibility_rating numeric,
  add column if not exists eligibility_rating_source text not null default 'self',
  add column if not exists eligibility_mixed_pair_role text not null default 'unknown',
  add column if not exists eligibility_mixed_pair_role_source text not null default 'unknown',
  add column if not exists eligibility_age_division text,
  add column if not exists eligibility_age_division_source text not null default 'unknown',
  add column if not exists eligibility_submitted_at timestamptz not null default now(),
  add column if not exists submitted_by_user_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.tiq_player_league_entries
  add column if not exists eligibility_rating numeric,
  add column if not exists eligibility_rating_source text not null default 'unknown',
  add column if not exists eligibility_mixed_pair_role text not null default 'unknown',
  add column if not exists eligibility_mixed_pair_role_source text not null default 'unknown',
  add column if not exists eligibility_age_division text,
  add column if not exists eligibility_age_division_source text not null default 'unknown',
  add column if not exists eligibility_submitted_at timestamptz not null default now();
alter table public.tiq_tournament_entries
  drop constraint if exists tiq_tournament_entries_eligibility_evidence_source_check;
alter table public.tiq_tournament_entries
  add constraint tiq_tournament_entries_eligibility_evidence_source_check
  check (
    eligibility_rating_source in ('verified', 'self', 'unknown')
    and eligibility_mixed_pair_role_source in ('verified', 'self', 'unknown')
    and eligibility_age_division_source in ('verified', 'self', 'unknown')
    and eligibility_mixed_pair_role in ('man', 'woman', 'unknown')
  );
alter table public.tiq_player_league_entries
  drop constraint if exists tiq_player_league_entries_eligibility_evidence_source_check;
alter table public.tiq_player_league_entries
  add constraint tiq_player_league_entries_eligibility_evidence_source_check
  check (
    eligibility_rating_source in ('verified', 'self', 'unknown')
    and eligibility_mixed_pair_role_source in ('verified', 'self', 'unknown')
    and eligibility_age_division_source in ('verified', 'self', 'unknown')
    and eligibility_mixed_pair_role in ('man', 'woman', 'unknown')
  );
comment on column public.tiq_tournament_entries.eligibility_submitted_at is
'When the player supplied or connected the eligibility evidence used by the director approval queue.';
comment on column public.tiq_player_league_entries.eligibility_submitted_at is
'When the player supplied or connected the eligibility evidence used by the League Office approval queue.';
drop policy if exists "Public can submit TIQ tournament entries" on public.tiq_tournament_entries;
create policy "Public can submit TIQ tournament entries"
on public.tiq_tournament_entries for insert
with check (
  status = 'pending'
  and exists (
    select 1 from public.tiq_tournaments t
    where t.id = tournament_id
      and t.is_public = true
  )
  and (
    linked_player_id is null
    or (
      auth.uid() is not null
      and submitted_by_user_id = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.linked_player_id::text = linked_player_id::text
      )
    )
  )
);
drop policy if exists "Authenticated users can request TIQ player entry" on public.tiq_player_league_entries;
create policy "Authenticated users can request TIQ player entry"
on public.tiq_player_league_entries
for insert
to authenticated
with check (
  auth.uid() is not null
  and created_by_user_id = auth.uid()
  and updated_by_user_id = auth.uid()
  and entry_status = 'pending'
  and (
    nullif(player_id, '') is null
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.linked_player_id::text = player_id::text
    )
  )
);
