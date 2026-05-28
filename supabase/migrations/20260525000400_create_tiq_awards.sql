create table if not exists public.tiq_awards (
  id text primary key,
  source_type text not null default 'tournament',
  source_id text not null,
  source_name text not null,
  recipient_name text not null,
  recipient_player_id text,
  placement text not null default 'first',
  title text not null,
  subtitle text not null default '',
  badge_label text not null,
  badge_code text not null,
  coordinator_name text not null default '',
  notes text not null default '',
  issued_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tiq_awards_source_type_check check (source_type in ('tournament', 'league')),
  constraint tiq_awards_placement_check check (placement in ('first', 'second', 'third'))
);

create index if not exists tiq_awards_source_idx on public.tiq_awards (source_type, source_id);
create index if not exists tiq_awards_recipient_player_idx on public.tiq_awards (recipient_player_id);
create index if not exists tiq_awards_recipient_name_idx on public.tiq_awards (recipient_name);
create index if not exists tiq_awards_issued_at_idx on public.tiq_awards (issued_at desc);

alter table public.tiq_awards enable row level security;

drop policy if exists "TIQ awards are publicly readable" on public.tiq_awards;
create policy "TIQ awards are publicly readable"
on public.tiq_awards for select
using (true);

drop policy if exists "Authenticated users can create TIQ awards" on public.tiq_awards;
create policy "Authenticated users can create TIQ awards"
on public.tiq_awards for insert
with check (auth.uid() = created_by_user_id);

drop policy if exists "Creators can update TIQ awards" on public.tiq_awards;
create policy "Creators can update TIQ awards"
on public.tiq_awards for update
using (auth.uid() = created_by_user_id)
with check (auth.uid() = created_by_user_id);

drop policy if exists "Creators can delete TIQ awards" on public.tiq_awards;
create policy "Creators can delete TIQ awards"
on public.tiq_awards for delete
using (auth.uid() = created_by_user_id);
