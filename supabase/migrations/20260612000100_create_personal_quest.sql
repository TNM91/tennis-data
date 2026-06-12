create extension if not exists pgcrypto;

create table if not exists public.personal_quest_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  season_slug text not null default 'operation-visible-abs',
  display_name text not null default 'Nathan',
  started_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  ipa_count integer not null default 0 check (ipa_count >= 0 and ipa_count <= 30),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create table if not exists public.personal_daily_quest_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_on date not null,
  quest_id text not null,
  xp_awarded integer not null check (xp_awarded > 0 and xp_awarded <= 100),
  created_at timestamptz not null default now(),
  unique (user_id, completed_on, quest_id),
  constraint personal_daily_quest_completions_quest_id_check check (
    quest_id in (
      'protein_breakfast',
      'no_chips_lunch',
      'creamer_goal',
      'water_80_oz',
      'activity_20_min',
      'core_workout',
      'alcohol_limit',
      'no_food_after_8'
    )
  )
);

create table if not exists public.personal_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  waist_inches numeric(5, 2) null check (waist_inches is null or (waist_inches >= 20 and waist_inches <= 80)),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

create table if not exists public.personal_progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_type text not null check (photo_type in ('front', 'side', 'flex')),
  storage_bucket text not null default 'personal-quest-photos',
  storage_path text not null,
  captured_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table if not exists public.personal_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);

create table if not exists public.personal_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  waist_inches numeric(5, 2) null check (waist_inches is null or (waist_inches >= 20 and waist_inches <= 80)),
  weekly_xp integer not null default 0 check (weekly_xp >= 0),
  ipa_count integer not null default 0 check (ipa_count >= 0),
  chip_free_lunches integer not null default 0 check (chip_free_lunches >= 0 and chip_free_lunches <= 7),
  biggest_win text not null default '',
  biggest_miss text not null default '',
  focus_next_week text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.personal_quest_profiles enable row level security;
alter table public.personal_daily_logs enable row level security;
alter table public.personal_daily_quest_completions enable row level security;
alter table public.personal_measurements enable row level security;
alter table public.personal_progress_photos enable row level security;
alter table public.personal_achievements enable row level security;
alter table public.personal_weekly_reviews enable row level security;

drop policy if exists "Users can select own personal quest profiles" on public.personal_quest_profiles;
drop policy if exists "Users can insert own personal quest profiles" on public.personal_quest_profiles;
drop policy if exists "Users can update own personal quest profiles" on public.personal_quest_profiles;
drop policy if exists "Users can delete own personal quest profiles" on public.personal_quest_profiles;

create policy "Users can select own personal quest profiles"
  on public.personal_quest_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own personal quest profiles"
  on public.personal_quest_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own personal quest profiles"
  on public.personal_quest_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own personal quest profiles"
  on public.personal_quest_profiles for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can select own personal daily logs" on public.personal_daily_logs;
drop policy if exists "Users can insert own personal daily logs" on public.personal_daily_logs;
drop policy if exists "Users can update own personal daily logs" on public.personal_daily_logs;
drop policy if exists "Users can delete own personal daily logs" on public.personal_daily_logs;

create policy "Users can select own personal daily logs"
  on public.personal_daily_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own personal daily logs"
  on public.personal_daily_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own personal daily logs"
  on public.personal_daily_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own personal daily logs"
  on public.personal_daily_logs for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can select own personal daily quest completions" on public.personal_daily_quest_completions;
drop policy if exists "Users can insert own personal daily quest completions" on public.personal_daily_quest_completions;
drop policy if exists "Users can update own personal daily quest completions" on public.personal_daily_quest_completions;
drop policy if exists "Users can delete own personal daily quest completions" on public.personal_daily_quest_completions;

create policy "Users can select own personal daily quest completions"
  on public.personal_daily_quest_completions for select
  using (auth.uid() = user_id);

create policy "Users can insert own personal daily quest completions"
  on public.personal_daily_quest_completions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own personal daily quest completions"
  on public.personal_daily_quest_completions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own personal daily quest completions"
  on public.personal_daily_quest_completions for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can select own personal measurements" on public.personal_measurements;
drop policy if exists "Users can insert own personal measurements" on public.personal_measurements;
drop policy if exists "Users can update own personal measurements" on public.personal_measurements;
drop policy if exists "Users can delete own personal measurements" on public.personal_measurements;

create policy "Users can select own personal measurements"
  on public.personal_measurements for select
  using (auth.uid() = user_id);

create policy "Users can insert own personal measurements"
  on public.personal_measurements for insert
  with check (auth.uid() = user_id);

create policy "Users can update own personal measurements"
  on public.personal_measurements for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own personal measurements"
  on public.personal_measurements for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can select own personal progress photos" on public.personal_progress_photos;
drop policy if exists "Users can insert own personal progress photos" on public.personal_progress_photos;
drop policy if exists "Users can update own personal progress photos" on public.personal_progress_photos;
drop policy if exists "Users can delete own personal progress photos" on public.personal_progress_photos;

create policy "Users can select own personal progress photos"
  on public.personal_progress_photos for select
  using (auth.uid() = user_id);

create policy "Users can insert own personal progress photos"
  on public.personal_progress_photos for insert
  with check (auth.uid() = user_id);

create policy "Users can update own personal progress photos"
  on public.personal_progress_photos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own personal progress photos"
  on public.personal_progress_photos for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can select own personal achievements" on public.personal_achievements;
drop policy if exists "Users can insert own personal achievements" on public.personal_achievements;
drop policy if exists "Users can update own personal achievements" on public.personal_achievements;
drop policy if exists "Users can delete own personal achievements" on public.personal_achievements;

create policy "Users can select own personal achievements"
  on public.personal_achievements for select
  using (auth.uid() = user_id);

create policy "Users can insert own personal achievements"
  on public.personal_achievements for insert
  with check (auth.uid() = user_id);

create policy "Users can update own personal achievements"
  on public.personal_achievements for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own personal achievements"
  on public.personal_achievements for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can select own personal weekly reviews" on public.personal_weekly_reviews;
drop policy if exists "Users can insert own personal weekly reviews" on public.personal_weekly_reviews;
drop policy if exists "Users can update own personal weekly reviews" on public.personal_weekly_reviews;
drop policy if exists "Users can delete own personal weekly reviews" on public.personal_weekly_reviews;

create policy "Users can select own personal weekly reviews"
  on public.personal_weekly_reviews for select
  using (auth.uid() = user_id);

create policy "Users can insert own personal weekly reviews"
  on public.personal_weekly_reviews for insert
  with check (auth.uid() = user_id);

create policy "Users can update own personal weekly reviews"
  on public.personal_weekly_reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own personal weekly reviews"
  on public.personal_weekly_reviews for delete
  using (auth.uid() = user_id);

create index if not exists personal_daily_logs_user_date_idx
  on public.personal_daily_logs (user_id, log_date desc);

create index if not exists personal_daily_quest_completions_user_date_idx
  on public.personal_daily_quest_completions (user_id, completed_on desc);

create index if not exists personal_daily_quest_completions_user_quest_idx
  on public.personal_daily_quest_completions (user_id, quest_id, completed_on desc);

create index if not exists personal_measurements_user_date_idx
  on public.personal_measurements (user_id, measured_on desc);

create index if not exists personal_progress_photos_user_date_idx
  on public.personal_progress_photos (user_id, captured_on desc);

create index if not exists personal_achievements_user_idx
  on public.personal_achievements (user_id, achievement_id);

create index if not exists personal_weekly_reviews_user_week_idx
  on public.personal_weekly_reviews (user_id, week_start desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'personal-quest-photos',
  'personal-quest-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own personal quest photos" on storage.objects;
create policy "Users can read own personal quest photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'personal-quest-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload own personal quest photos" on storage.objects;
create policy "Users can upload own personal quest photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'personal-quest-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own personal quest photos" on storage.objects;
create policy "Users can update own personal quest photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'personal-quest-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'personal-quest-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own personal quest photos" on storage.objects;
create policy "Users can delete own personal quest photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'personal-quest-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
