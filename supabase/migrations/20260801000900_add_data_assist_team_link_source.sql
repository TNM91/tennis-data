alter table public.team_profile_links
  drop constraint if exists team_profile_links_source_type_check;
alter table public.team_profile_links
  add constraint team_profile_links_source_type_check
  check (source_type in ('roster_contact', 'roster_membership', 'tiq_entry', 'manual_invite', 'data_assist_import'));
