-- Queue the reviewed public national directory only after the Missouri campaign
-- has exhausted its own frontier. This preserves Missouri-first priority.
insert into public.tennisrecord_campaigns (slug, name, region_label, starts_on, ends_on, status, seed_provenance)
values ('us-2025-current', 'United States historical seed', 'United States', date '2025-01-01', current_date, 'planned', 'public_league_directory')
on conflict (slug) do update
set ends_on = excluded.ends_on,
    status = case
      when public.tennisrecord_campaigns.status = 'completed' then 'completed'
      when public.tennisrecord_campaigns.status = 'active' then 'active'
      else 'planned'
    end,
    updated_at = timezone('utc', now());
