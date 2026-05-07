create table if not exists public.internal_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid null references public.profiles(id) on delete set null,
  notification_type text not null default 'message'
    check (notification_type in ('message', 'schedule', 'support', 'system')),
  title text not null default '',
  body text not null default '',
  href text not null default '',
  conversation_id uuid null references public.internal_conversations(id) on delete cascade,
  schedule_event_id uuid null references public.internal_schedule_events(id) on delete cascade,
  read_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists internal_notifications_recipient_idx
  on public.internal_notifications (recipient_profile_id, read_at, created_at desc);

create index if not exists internal_notifications_conversation_idx
  on public.internal_notifications (conversation_id);

alter table public.internal_notifications enable row level security;

drop policy if exists "Users can create internal notifications" on public.internal_notifications;
create policy "Users can create internal notifications"
  on public.internal_notifications for insert to authenticated
  with check (
    actor_user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Recipients and admins can read internal notifications" on public.internal_notifications;
create policy "Recipients and admins can read internal notifications"
  on public.internal_notifications for select to authenticated
  using (
    recipient_profile_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Recipients can update internal notifications" on public.internal_notifications;
create policy "Recipients can update internal notifications"
  on public.internal_notifications for update to authenticated
  using (
    recipient_profile_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    recipient_profile_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
