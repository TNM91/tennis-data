alter table public.captain_practice_invitees
  add column if not exists captain_confirmed_at timestamptz null,
  add column if not exists captain_confirmed_by_user_id uuid null references auth.users(id) on delete set null;

create index if not exists captain_practice_invitees_confirmation_idx
  on public.captain_practice_invitees (invite_id, captain_confirmed_at)
  where captain_confirmed_at is not null;
