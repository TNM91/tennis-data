alter table public.captain_pilot_redemptions
  add column if not exists acquisition_source text not null default 'direct';

alter table public.captain_pilot_redemptions
  drop constraint if exists captain_pilot_redemptions_acquisition_source_check;

alter table public.captain_pilot_redemptions
  add constraint captain_pilot_redemptions_acquisition_source_check
  check (acquisition_source in ('text', 'flyer', 'email', 'referral', 'direct'));

create index if not exists captain_pilot_redemptions_campaign_source_created_at_idx
  on public.captain_pilot_redemptions (campaign_key, acquisition_source, created_at desc);
