create table if not exists public.portal_shortcut_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shortcut_ids text[] not null,
  personalization_cue_dismissed boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint portal_shortcut_preferences_four_unique_shortcuts check (
    cardinality(shortcut_ids) = 4
    and shortcut_ids[1] <> shortcut_ids[2]
    and shortcut_ids[1] <> shortcut_ids[3]
    and shortcut_ids[1] <> shortcut_ids[4]
    and shortcut_ids[2] <> shortcut_ids[3]
    and shortcut_ids[2] <> shortcut_ids[4]
    and shortcut_ids[3] <> shortcut_ids[4]
  ),
  constraint portal_shortcut_preferences_allowed_shortcuts check (
    shortcut_ids <@ array[
      'lane:find',
      'lane:you',
      'lane:compete',
      'lane:team',
      'lane:coach',
      'lane:league',
      'lane:club',
      'action:mylab',
      'action:tactics',
      'action:level-up',
      'action:matchup',
      'action:availability',
      'action:lineup',
      'action:team-room',
      'action:messages'
    ]::text[]
  )
);
alter table public.portal_shortcut_preferences enable row level security;
drop policy if exists "Users can read own portal shortcuts" on public.portal_shortcut_preferences;
create policy "Users can read own portal shortcuts"
  on public.portal_shortcut_preferences for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Users can add own portal shortcuts" on public.portal_shortcut_preferences;
create policy "Users can add own portal shortcuts"
  on public.portal_shortcut_preferences for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "Users can update own portal shortcuts" on public.portal_shortcut_preferences;
create policy "Users can update own portal shortcuts"
  on public.portal_shortcut_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
comment on table public.portal_shortcut_preferences is
  'The four portal hubs or tennis actions a signed-in user pins across devices.';
