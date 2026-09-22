alter table public.captain_lineup_drafts
  add column if not exists delivery_status text not null default 'not_sent';

alter table public.captain_lineup_drafts
  drop constraint if exists captain_lineup_drafts_delivery_status_check;

alter table public.captain_lineup_drafts
  add constraint captain_lineup_drafts_delivery_status_check
  check (delivery_status in ('not_sent', 'sent'));

alter table public.captain_lineup_drafts
  add column if not exists delivered_at timestamptz;

alter table public.captain_lineup_drafts
  add column if not exists team_room_message_id uuid;

comment on column public.captain_lineup_drafts.delivery_status is
  'Tracks whether the confirmed lineup was actually sent to Team Chat; separate from confirmation status.';

comment on column public.captain_lineup_drafts.team_room_message_id is
  'Match-card message used to restore the captain delivery receipt after navigation or refresh.';
