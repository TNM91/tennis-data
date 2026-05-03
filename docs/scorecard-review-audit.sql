-- Optional Supabase schema support for scorecard review persistence.
-- Safe to review and apply manually if you want committed review metadata
-- stored server-side instead of only flowing through import payloads.

-- 1. Extend matches with review metadata columns.
alter table public.matches
  add column if not exists review_status text,
  add column if not exists needs_review boolean default false,
  add column if not exists data_conflict boolean default false,
  add column if not exists conflict_type text,
  add column if not exists reviewer_note text,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists raw_capture_json jsonb,
  add column if not exists validated_capture_json jsonb,
  add column if not exists repair_log jsonb,
  add column if not exists capture_engine jsonb;

create index if not exists matches_review_status_idx
  on public.matches (review_status);

create index if not exists matches_needs_review_idx
  on public.matches (needs_review)
  where needs_review = true;

-- 2. Optional append-friendly audit table for import/review history.
create table if not exists public.scorecard_review_audit (
  id bigint generated always as identity primary key,
  match_id uuid null references public.matches(id) on delete set null,
  external_match_id text not null unique,
  review_status text null,
  needs_review boolean not null default false,
  data_conflict boolean not null default false,
  conflict_type text null,
  reviewer_note text null,
  reviewed_by text null,
  reviewed_at timestamptz null,
  raw_capture_json jsonb null,
  validated_capture_json jsonb null,
  repair_log jsonb null,
  capture_engine jsonb null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists scorecard_review_audit_review_status_idx
  on public.scorecard_review_audit (review_status);

create index if not exists scorecard_review_audit_needs_review_idx
  on public.scorecard_review_audit (needs_review)
  where needs_review = true;

-- 3. Keep updated_at fresh on upsert/update if you use this table.
create or replace function public.set_scorecard_review_audit_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists scorecard_review_audit_set_updated_at
  on public.scorecard_review_audit;

create trigger scorecard_review_audit_set_updated_at
before update on public.scorecard_review_audit
for each row
execute function public.set_scorecard_review_audit_updated_at();

-- 4. RLS policy examples.
-- Replace these with your real admin policy strategy before applying in production.
alter table public.scorecard_review_audit enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'scorecard_review_audit'
      and policyname = 'scorecard_review_audit_admin_all'
  ) then
    create policy scorecard_review_audit_admin_all
      on public.scorecard_review_audit
      for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end;
$$;
