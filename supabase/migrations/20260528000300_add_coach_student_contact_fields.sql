alter table public.coach_player_links
  add column if not exists player_email text not null default '',
  add column if not exists player_phone text not null default '',
  add column if not exists contact_preference text not null default 'in_app',
  add column if not exists setup_status text not null default 'manual';

alter table public.coach_player_links
  drop constraint if exists coach_player_links_contact_preference_check;

alter table public.coach_player_links
  add constraint coach_player_links_contact_preference_check
  check (contact_preference in ('in_app', 'text', 'both'));

alter table public.coach_player_links
  drop constraint if exists coach_player_links_setup_status_check;

alter table public.coach_player_links
  add constraint coach_player_links_setup_status_check
  check (setup_status in ('manual', 'invited', 'linked'));
