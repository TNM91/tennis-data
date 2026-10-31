begin;
-- Keep existing account-owned RLS. Existing team-alert choices never opt in.
alter table public.internal_notification_preferences
 add column if not exists native_coach_alerts_enabled boolean not null default false;
comment on column public.internal_notification_preferences.native_coach_alerts_enabled is
 'Explicit account opt-in for private Coach/player iPhone alerts; registered devices, message preferences, current linkage, mute and block checks still apply.';
commit;
