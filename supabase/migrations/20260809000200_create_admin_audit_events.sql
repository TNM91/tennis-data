create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  target_label text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists admin_audit_events_created_at_idx
  on public.admin_audit_events (created_at desc);
alter table public.admin_audit_events enable row level security;
create policy "Admins can read audit events"
on public.admin_audit_events
for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);
comment on table public.admin_audit_events is 'Persistent audit trail for destructive or security-sensitive platform admin actions.';
