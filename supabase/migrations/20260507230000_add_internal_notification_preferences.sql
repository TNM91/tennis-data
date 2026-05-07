create table if not exists public.internal_notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  message_alerts_enabled boolean not null default true,
  schedule_alerts_enabled boolean not null default true,
  support_alerts_enabled boolean not null default true,
  system_alerts_enabled boolean not null default true,
  email_fallback_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.internal_notifications
  add column if not exists email_fallback_requested_at timestamptz null,
  add column if not exists email_fallback_sent_at timestamptz null,
  add column if not exists email_fallback_error text not null default '';

create or replace function public.set_internal_notification_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists internal_notification_preferences_set_updated_at
  on public.internal_notification_preferences;

create trigger internal_notification_preferences_set_updated_at
before update on public.internal_notification_preferences
for each row
execute function public.set_internal_notification_preferences_updated_at();

alter table public.internal_notification_preferences enable row level security;

drop policy if exists "Users can read notification preferences" on public.internal_notification_preferences;
create policy "Users can read notification preferences"
  on public.internal_notification_preferences for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Users can create notification preferences" on public.internal_notification_preferences;
create policy "Users can create notification preferences"
  on public.internal_notification_preferences for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "Users can update notification preferences" on public.internal_notification_preferences;
create policy "Users can update notification preferences"
  on public.internal_notification_preferences for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
