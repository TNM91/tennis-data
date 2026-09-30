alter table public.tiq_league_delegates
  add column if not exists email text not null default '',
  add column if not exists display_name text not null default '';

create table if not exists public.tiq_league_delegate_invites (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.tiq_leagues(id) on delete cascade,
  email text not null,
  invite_token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  accepted_by_user_id uuid null references auth.users(id) on delete set null,
  accepted_at timestamptz null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tiq_league_delegate_invites_email_check check (position('@' in email) > 1)
);

create unique index if not exists tiq_league_delegate_invites_pending_email_idx
  on public.tiq_league_delegate_invites (league_id, lower(email))
  where status = 'pending';

create index if not exists tiq_league_delegate_invites_token_idx
  on public.tiq_league_delegate_invites (invite_token);

alter table public.tiq_league_delegate_invites enable row level security;

create or replace function public.owns_tiq_league(target_league_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tiq_leagues league
    where league.id = target_league_id
      and league.created_by_user_id = auth.uid()
  );
$$;

revoke all on function public.owns_tiq_league(text) from public;
grant execute on function public.owns_tiq_league(text) to authenticated;

drop policy if exists "League owners manage delegates" on public.tiq_league_delegates;
drop policy if exists "League managers read delegates" on public.tiq_league_delegates;
drop policy if exists "League owners add delegates" on public.tiq_league_delegates;
drop policy if exists "League owners update delegates" on public.tiq_league_delegates;
drop policy if exists "League owners remove delegates" on public.tiq_league_delegates;

create policy "League managers read delegates"
on public.tiq_league_delegates for select to authenticated
using (public.can_manage_tiq_league(league_id));

create policy "League owners add delegates"
on public.tiq_league_delegates for insert to authenticated
with check (public.owns_tiq_league(league_id));

create policy "League owners update delegates"
on public.tiq_league_delegates for update to authenticated
using (public.owns_tiq_league(league_id))
with check (public.owns_tiq_league(league_id));

create policy "League owners remove delegates"
on public.tiq_league_delegates for delete to authenticated
using (public.owns_tiq_league(league_id));

drop policy if exists "League owners manage delegate invites" on public.tiq_league_delegate_invites;
create policy "League owners manage delegate invites"
on public.tiq_league_delegate_invites for all to authenticated
using (public.owns_tiq_league(league_id))
with check (public.owns_tiq_league(league_id));

drop policy if exists "League delegates can read managed leagues" on public.tiq_leagues;
create policy "League delegates can read managed leagues"
on public.tiq_leagues for select to authenticated
using (
  exists (
    select 1
    from public.tiq_league_delegates delegate
    where delegate.league_id = id
      and delegate.user_id = auth.uid()
  )
);

create or replace function public.set_tiq_league_delegate_invite_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tiq_league_delegate_invites_set_updated_at on public.tiq_league_delegate_invites;
create trigger tiq_league_delegate_invites_set_updated_at
before update on public.tiq_league_delegate_invites
for each row execute function public.set_tiq_league_delegate_invite_updated_at();
