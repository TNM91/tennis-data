create table if not exists public.platform_resume_suppressions (
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint_hash text not null check (char_length(fingerprint_hash) = 64),
  fingerprint text not null check (char_length(fingerprint) between 1 and 2400),
  mode text not null check (mode in ('later', 'hidden')),
  saved_at timestamptz not null,
  until_at timestamptz null,
  updated_at timestamptz not null default now(),
  primary key (user_id, fingerprint_hash),
  check (
    (mode = 'hidden' and until_at is null)
    or (mode = 'later' and until_at is not null)
  )
);

create index if not exists platform_resume_suppressions_user_saved_idx
  on public.platform_resume_suppressions (user_id, saved_at desc);

alter table public.platform_resume_suppressions enable row level security;

drop policy if exists "Players can read own resume suppressions" on public.platform_resume_suppressions;
create policy "Players can read own resume suppressions"
  on public.platform_resume_suppressions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Players can add own resume suppressions" on public.platform_resume_suppressions;
create policy "Players can add own resume suppressions"
  on public.platform_resume_suppressions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Players can update own resume suppressions" on public.platform_resume_suppressions;
create policy "Players can update own resume suppressions"
  on public.platform_resume_suppressions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Players can delete own resume suppressions" on public.platform_resume_suppressions;
create policy "Players can delete own resume suppressions"
  on public.platform_resume_suppressions for delete to authenticated
  using (auth.uid() = user_id);

comment on table public.platform_resume_suppressions is
  'Account-level Later and Hide choices for the shared resume shortcut across devices.';
