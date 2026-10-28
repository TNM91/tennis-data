begin;
-- Automated erasure is opt-in per future, recently authenticated in-app request.
alter table public.account_deletion_requests
 add column account_key_hash text check(account_key_hash ~ '^[0-9a-f]{64}$'),
 add column automatic_consent boolean not null default false,
 add column phase text not null default 'queued' check(phase in ('queued','waiting','billing','files','data','auth','confirmation','completed')),
 add column not_before timestamptz,
 add column lease_token uuid,
 add column lease_until timestamptz,
 add column attempts integer not null default 0 check(attempts between 0 and 10),
 add column next_attempt_at timestamptz not null default clock_timestamp(),
 add column alerted_at timestamptz,
 add column last_error text check(last_error in ('preflight','auth','billing','storage','schema','verify','mail','provider')),
 add column stripe_customer_id text,
 add column stripe_subscription_id text;
create index account_erasure_due on public.account_deletion_requests(next_attempt_at,id)
 where automatic_consent and status<>'completed';

-- These fields record authorship, not ownership of other members' records.
-- Existing client insert/update predicates still require the current author's UUID.
alter table public.captain_availability_requests alter column created_by drop not null;
alter table public.captain_availability_requests drop constraint captain_availability_requests_created_by_fkey;
alter table public.captain_availability_requests add constraint captain_availability_requests_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.captain_lineup_reviews alter column created_by drop not null;
alter table public.captain_lineup_reviews drop constraint captain_lineup_reviews_created_by_fkey;
alter table public.captain_lineup_reviews add constraint captain_lineup_reviews_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.captain_practice_invites alter column created_by_user_id drop not null;
alter table public.captain_practice_invites drop constraint captain_practice_invites_created_by_user_id_fkey;
alter table public.captain_practice_invites add constraint captain_practice_invites_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id) on delete set null;
alter table public.club_clinic_attendance alter column updated_by_user_id drop not null;
alter table public.club_clinic_attendance drop constraint club_clinic_attendance_updated_by_user_id_fkey;
alter table public.club_clinic_attendance add constraint club_clinic_attendance_updated_by_user_id_fkey foreign key (updated_by_user_id) references auth.users(id) on delete set null;
alter table public.club_clinic_sessions alter column created_by_user_id drop not null;
alter table public.club_clinic_sessions drop constraint club_clinic_sessions_created_by_user_id_fkey;
alter table public.club_clinic_sessions add constraint club_clinic_sessions_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id) on delete set null;
alter table public.club_clinic_sessions alter column updated_by_user_id drop not null;
alter table public.club_clinic_sessions drop constraint club_clinic_sessions_updated_by_user_id_fkey;
alter table public.club_clinic_sessions add constraint club_clinic_sessions_updated_by_user_id_fkey foreign key (updated_by_user_id) references auth.users(id) on delete set null;
alter table public.club_competition_templates alter column created_by_user_id drop not null;
alter table public.club_competition_templates drop constraint club_competition_templates_created_by_user_id_fkey;
alter table public.club_competition_templates add constraint club_competition_templates_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id) on delete set null;
alter table public.club_group_renewals alter column created_by_user_id drop not null;
alter table public.club_group_renewals drop constraint club_group_renewals_created_by_user_id_fkey;
alter table public.club_group_renewals add constraint club_group_renewals_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id) on delete set null;
alter table public.club_groups alter column created_by_user_id drop not null;
alter table public.club_groups drop constraint club_groups_created_by_user_id_fkey;
alter table public.club_groups add constraint club_groups_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id) on delete set null;
alter table public.internal_conversations alter column created_by_user_id drop not null;
alter table public.internal_conversations drop constraint internal_conversations_created_by_user_id_fkey;
alter table public.internal_conversations add constraint internal_conversations_created_by_user_id_fkey foreign key (created_by_user_id) references public.profiles(id) on delete set null;
alter table public.internal_schedule_events alter column created_by_user_id drop not null;
alter table public.internal_schedule_events drop constraint internal_schedule_events_created_by_user_id_fkey;
alter table public.internal_schedule_events add constraint internal_schedule_events_created_by_user_id_fkey foreign key (created_by_user_id) references public.profiles(id) on delete set null;
alter table public.season_availability_invites alter column created_by drop not null;
alter table public.season_availability_invites drop constraint season_availability_invites_created_by_fkey;
alter table public.season_availability_invites add constraint season_availability_invites_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.team_chat_rooms alter column created_by drop not null;
alter table public.team_chat_rooms drop constraint team_chat_rooms_created_by_fkey;
alter table public.team_chat_rooms add constraint team_chat_rooms_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;
alter table public.team_room_member_removals alter column removed_by_user_id drop not null;
alter table public.team_room_member_removals drop constraint team_room_member_removals_removed_by_user_id_fkey;
alter table public.team_room_member_removals add constraint team_room_member_removals_removed_by_user_id_fkey foreign key (removed_by_user_id) references public.profiles(id) on delete set null;
alter table public.tiq_individual_league_suggestions alter column created_by_user_id drop not null;
alter table public.tiq_individual_league_suggestions drop constraint tiq_individual_league_suggestions_created_by_user_id_fkey;
alter table public.tiq_individual_league_suggestions add constraint tiq_individual_league_suggestions_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id) on delete set null;
alter table public.tiq_individual_league_suggestions alter column updated_by_user_id drop not null;
alter table public.tiq_individual_league_suggestions drop constraint tiq_individual_league_suggestions_updated_by_user_id_fkey;
alter table public.tiq_individual_league_suggestions add constraint tiq_individual_league_suggestions_updated_by_user_id_fkey foreign key (updated_by_user_id) references auth.users(id) on delete set null;
alter table public.tiq_league_weekly_sessions alter column created_by_user_id drop not null;
alter table public.tiq_league_weekly_sessions drop constraint tiq_league_weekly_sessions_created_by_user_id_fkey;
alter table public.tiq_league_weekly_sessions add constraint tiq_league_weekly_sessions_created_by_user_id_fkey foreign key (created_by_user_id) references auth.users(id) on delete set null;

create function public.account_erasure_catalog_ready() returns boolean
language sql stable security definer set search_path='' as $$
 with actual as (
 select c.relname::text as t,a.attname::text as c,ref.relname::text as p,f.confdeltype::text as d,not a.attnotnull as n
 from pg_catalog.pg_constraint f
 join pg_catalog.pg_class c on c.oid=f.conrelid
 join pg_catalog.pg_namespace ns on ns.oid=c.relnamespace
 join pg_catalog.pg_class ref on ref.oid=f.confrelid
 join pg_catalog.pg_namespace rn on rn.oid=ref.relnamespace
 cross join lateral unnest(f.conkey) with ordinality k(num,pos)
 join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attnum=k.num
 where f.contype='f' and ns.nspname='public'
 and ((rn.nspname='auth' and ref.relname='users') or (rn.nspname='public' and ref.relname='profiles'))
 ), expected as (select * from jsonb_to_recordset('[{"t":"admin_audit_events","c":"actor_user_id","p":"users","d":"n","n":true},{"t":"calendar_feed_tokens","c":"owner_user_id","p":"users","d":"c","n":false},{"t":"calendar_feed_tokens","c":"viewer_user_id","p":"users","d":"n","n":true},{"t":"calendar_venue_directory","c":"verified_by","p":"users","d":"n","n":true},{"t":"calendar_venue_preferences","c":"owner_user_id","p":"users","d":"c","n":false},{"t":"calendar_venue_preferences","c":"reviewed_by","p":"users","d":"n","n":true},{"t":"captain_availability_link_snapshots","c":"created_by","p":"users","d":"n","n":true},{"t":"captain_availability_requests","c":"created_by","p":"users","d":"n","n":true},{"t":"captain_lineup_calibrations","c":"user_id","p":"users","d":"c","n":false},{"t":"captain_lineup_drafts","c":"user_id","p":"users","d":"c","n":false},{"t":"captain_lineup_reviews","c":"created_by","p":"users","d":"n","n":true},{"t":"captain_pilot_redemptions","c":"profile_id","p":"profiles","d":"c","n":false},{"t":"captain_practice_invitees","c":"captain_confirmed_by_user_id","p":"users","d":"n","n":true},{"t":"captain_practice_invitees","c":"profile_id","p":"profiles","d":"n","n":true},{"t":"captain_practice_invites","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"captain_roster_aliases","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"captain_roster_contacts","c":"captain_user_id","p":"users","d":"c","n":false},{"t":"captain_share_links","c":"created_by_user_id","p":"users","d":"c","n":false},{"t":"captain_workspace_preferences","c":"user_id","p":"users","d":"c","n":false},{"t":"club_announcement_history","c":"author_user_id","p":"users","d":"n","n":true},{"t":"club_billing_accounts","c":"owner_user_id","p":"users","d":"c","n":false},{"t":"club_clinic_attendance","c":"updated_by_user_id","p":"users","d":"n","n":true},{"t":"club_clinic_sessions","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"club_clinic_sessions","c":"updated_by_user_id","p":"users","d":"n","n":true},{"t":"club_communication_reads","c":"user_id","p":"users","d":"c","n":false},{"t":"club_competition_templates","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"club_group_messages","c":"author_user_id","p":"users","d":"c","n":false},{"t":"club_group_renewals","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"club_groups","c":"closed_by_user_id","p":"users","d":"n","n":true},{"t":"club_groups","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"club_groups","c":"lead_user_id","p":"users","d":"n","n":true},{"t":"club_invites","c":"accepted_by_user_id","p":"users","d":"n","n":true},{"t":"club_invites","c":"invited_by_user_id","p":"users","d":"c","n":false},{"t":"club_memberships","c":"user_id","p":"users","d":"n","n":true},{"t":"club_roster_contact_shares","c":"shared_by_user_id","p":"users","d":"c","n":false},{"t":"clubs","c":"owner_user_id","p":"users","d":"r","n":false},{"t":"coach_assignments","c":"coach_user_id","p":"users","d":"c","n":false},{"t":"coach_player_links","c":"coach_user_id","p":"users","d":"c","n":false},{"t":"coach_player_links","c":"player_user_id","p":"users","d":"n","n":true},{"t":"coach_student_invites","c":"accepted_by_user_id","p":"users","d":"n","n":true},{"t":"coach_student_invites","c":"coach_user_id","p":"users","d":"c","n":false},{"t":"coach_workspace_preferences","c":"user_id","p":"users","d":"c","n":false},{"t":"compete_workspace_preferences","c":"user_id","p":"users","d":"c","n":false},{"t":"competition_schedule_reminders","c":"organizer_user_id","p":"users","d":"c","n":false},{"t":"competition_schedule_reminders","c":"player_user_id","p":"users","d":"c","n":false},{"t":"data_assist_batches","c":"reviewed_by_user_id","p":"profiles","d":"n","n":true},{"t":"data_assist_batches","c":"submitted_by_user_id","p":"profiles","d":"c","n":false},{"t":"data_assist_contributor_stats","c":"profile_id","p":"profiles","d":"c","n":false},{"t":"data_assist_contributor_stats","c":"upload_suspended_by_user_id","p":"profiles","d":"n","n":true},{"t":"data_assist_drafts","c":"reviewed_by_user_id","p":"profiles","d":"n","n":true},{"t":"data_assist_drafts","c":"submitted_by_user_id","p":"profiles","d":"c","n":false},{"t":"data_assist_ocr_jobs","c":"requested_by_user_id","p":"profiles","d":"c","n":false},{"t":"data_assist_screenshots","c":"submitted_by_user_id","p":"profiles","d":"c","n":false},{"t":"explore_workspace_preferences","c":"user_id","p":"users","d":"c","n":false},{"t":"internal_conversation_participants","c":"profile_id","p":"profiles","d":"c","n":false},{"t":"internal_conversations","c":"assigned_admin_user_id","p":"profiles","d":"n","n":true},{"t":"internal_conversations","c":"created_by_user_id","p":"profiles","d":"n","n":true},{"t":"internal_messages","c":"sender_user_id","p":"profiles","d":"c","n":false},{"t":"internal_notification_preferences","c":"profile_id","p":"profiles","d":"c","n":false},{"t":"internal_notifications","c":"actor_user_id","p":"profiles","d":"n","n":true},{"t":"internal_notifications","c":"recipient_profile_id","p":"profiles","d":"c","n":false},{"t":"internal_schedule_event_responses","c":"profile_id","p":"profiles","d":"c","n":false},{"t":"internal_schedule_events","c":"created_by_user_id","p":"profiles","d":"n","n":true},{"t":"league_coordinator_workspace_preferences","c":"user_id","p":"users","d":"c","n":false},{"t":"level_up_custom_quest_completions","c":"user_id","p":"users","d":"c","n":false},{"t":"level_up_custom_quests","c":"user_id","p":"users","d":"c","n":false},{"t":"level_up_sessions","c":"coach_user_id","p":"users","d":"n","n":true},{"t":"level_up_sessions","c":"player_user_id","p":"users","d":"c","n":false},{"t":"level_up_weekly_plans","c":"coach_user_id","p":"users","d":"n","n":true},{"t":"level_up_weekly_plans","c":"player_user_id","p":"users","d":"c","n":false},{"t":"lineup_prediction_snapshots","c":"user_id","p":"users","d":"c","n":true},{"t":"lineup_scenarios","c":"owner_user_id","p":"users","d":"c","n":true},{"t":"match_accuracy_reports","c":"reporter_user_id","p":"profiles","d":"c","n":false},{"t":"match_accuracy_reports","c":"resolved_by_user_id","p":"profiles","d":"n","n":true},{"t":"match_accuracy_reports","c":"source_uploader_user_id","p":"profiles","d":"n","n":true},{"t":"match_calendar_shares","c":"owner_user_id","p":"users","d":"c","n":false},{"t":"my_lab_feed","c":"user_id","p":"users","d":"c","n":true},{"t":"my_lab_goals","c":"user_id","p":"users","d":"c","n":false},{"t":"native_push_devices","c":"profile_id","p":"profiles","d":"c","n":false},{"t":"personal_achievements","c":"user_id","p":"users","d":"c","n":false},{"t":"personal_daily_logs","c":"user_id","p":"users","d":"c","n":false},{"t":"personal_daily_quest_completions","c":"user_id","p":"users","d":"c","n":false},{"t":"personal_measurements","c":"user_id","p":"users","d":"c","n":false},{"t":"personal_progress_photos","c":"user_id","p":"users","d":"c","n":false},{"t":"personal_quest_profiles","c":"user_id","p":"users","d":"c","n":false},{"t":"personal_streak_freezes","c":"user_id","p":"users","d":"c","n":false},{"t":"personal_weekly_reviews","c":"user_id","p":"users","d":"c","n":false},{"t":"platform_resume_suppressions","c":"user_id","p":"users","d":"c","n":false},{"t":"player_calendar_items","c":"player_user_id","p":"users","d":"c","n":false},{"t":"player_improve_workspace_preferences","c":"user_id","p":"users","d":"c","n":false},{"t":"player_reflections","c":"player_user_id","p":"users","d":"c","n":false},{"t":"player_schedule_responses","c":"player_user_id","p":"users","d":"c","n":false},{"t":"portal_shortcut_preferences","c":"user_id","p":"users","d":"c","n":false},{"t":"profile_access_change_events","c":"changed_by_user_id","p":"users","d":"n","n":true},{"t":"profile_access_change_events","c":"profile_id","p":"profiles","d":"c","n":false},{"t":"profile_sync_review_events","c":"reviewed_by_user_id","p":"profiles","d":"n","n":true},{"t":"profiles","c":"id","p":"users","d":"c","n":false},{"t":"season_availability_invites","c":"created_by","p":"users","d":"n","n":true},{"t":"tactical_scenarios","c":"user_id","p":"users","d":"c","n":false},{"t":"team_chat_blocks","c":"blocked_user_id","p":"profiles","d":"c","n":false},{"t":"team_chat_blocks","c":"owner_user_id","p":"profiles","d":"c","n":false},{"t":"team_chat_poll_votes","c":"profile_id","p":"profiles","d":"a","n":false},{"t":"team_chat_polls","c":"created_by","p":"profiles","d":"a","n":false},{"t":"team_chat_reports","c":"reported_user_id","p":"profiles","d":"c","n":false},{"t":"team_chat_reports","c":"reporter_user_id","p":"profiles","d":"c","n":false},{"t":"team_chat_reports","c":"reviewed_by","p":"profiles","d":"n","n":true},{"t":"team_chat_rooms","c":"created_by","p":"profiles","d":"n","n":true},{"t":"team_profile_links","c":"profile_user_id","p":"profiles","d":"c","n":false},{"t":"team_profile_links","c":"source_actor_user_id","p":"users","d":"n","n":true},{"t":"team_room_access_operations","c":"actor_id","p":"profiles","d":"c","n":false},{"t":"team_room_access_operations","c":"target_id","p":"profiles","d":"c","n":false},{"t":"team_room_invites","c":"created_by_user_id","p":"profiles","d":"c","n":false},{"t":"team_room_lineup_acknowledgments","c":"profile_id","p":"profiles","d":"c","n":false},{"t":"team_room_member_preferences","c":"profile_id","p":"profiles","d":"c","n":false},{"t":"team_room_member_removals","c":"profile_id","p":"profiles","d":"c","n":false},{"t":"team_room_member_removals","c":"removed_by_user_id","p":"profiles","d":"n","n":true},{"t":"team_room_message_reactions","c":"profile_id","p":"profiles","d":"c","n":false},{"t":"team_room_message_responses","c":"profile_id","p":"profiles","d":"c","n":false},{"t":"team_room_push_subscriptions","c":"profile_id","p":"profiles","d":"c","n":false},{"t":"team_room_reminder_schedules","c":"created_by_user_id","p":"profiles","d":"c","n":false},{"t":"tennisrecord_collector_settings","c":"updated_by_user_id","p":"profiles","d":"n","n":true},{"t":"tennisrecord_player_identities","c":"reviewed_by_user_id","p":"profiles","d":"n","n":true},{"t":"tennisrecord_sync_runs","c":"requested_by_user_id","p":"profiles","d":"n","n":true},{"t":"tiq_awards","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_awards","c":"updated_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_individual_league_results","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_individual_league_results","c":"updated_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_individual_league_suggestions","c":"claimed_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_individual_league_suggestions","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_individual_league_suggestions","c":"updated_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_league_delegate_invites","c":"accepted_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_league_delegate_invites","c":"invited_by_user_id","p":"users","d":"c","n":false},{"t":"tiq_league_delegates","c":"user_id","p":"users","d":"c","n":false},{"t":"tiq_league_schedule_items","c":"confirmed_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_league_schedule_items","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_league_schedule_items","c":"proposed_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_league_schedule_items","c":"updated_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_league_weekly_deliveries","c":"recipient_profile_id","p":"users","d":"c","n":false},{"t":"tiq_league_weekly_plan_revisions","c":"actor_user_id","p":"users","d":"n","n":true},{"t":"tiq_league_weekly_score_history","c":"actor_user_id","p":"users","d":"n","n":true},{"t":"tiq_league_weekly_sessions","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_league_weekly_set_results","c":"approved_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_leagues","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_leagues","c":"updated_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_player_league_entries","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_player_league_entries","c":"eligibility_reviewed_by","p":"users","d":"n","n":true},{"t":"tiq_player_league_entries","c":"updated_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_team_league_entries","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_team_league_entries","c":"updated_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_team_league_match_events","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_team_league_match_events","c":"updated_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_team_league_match_lines","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_team_league_match_lines","c":"updated_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_tournament_alerts","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_tournament_contacts","c":"updated_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_tournament_entries","c":"eligibility_reviewed_by","p":"users","d":"n","n":true},{"t":"tiq_tournament_entries","c":"submitted_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_tournaments","c":"created_by_user_id","p":"users","d":"n","n":true},{"t":"tiq_tournaments","c":"updated_by_user_id","p":"users","d":"n","n":true},{"t":"user_follows","c":"user_id","p":"users","d":"c","n":false},{"t":"account_deletion_requests","c":"reviewed_by","p":"profiles","d":"n","n":true}]'::jsonb) e(t text,c text,p text,d text,n boolean))
 select (select md5(string_agg(table_name||'|'||column_name||'|'||data_type||'|'||is_nullable,E'\n' order by table_name collate "C",column_name collate "C")) from information_schema.columns where table_schema='public' and table_name not in ('account_deletion_requests','native_email_auth_limits'))='31de6ea163c8a5eab415cf59492abddf'
 and (select coalesce(jsonb_agg(to_jsonb(x) order by t,c,p),'[]'::jsonb) from actual x)=
 (select jsonb_agg(to_jsonb(x) order by t,c,p) from expected x)
 -- A newly introduced user-delete trigger needs review before automated erasure.
 and not exists(select 1 from pg_catalog.pg_trigger tr join pg_catalog.pg_class c on c.oid=tr.tgrelid
 join pg_catalog.pg_namespace ns on ns.oid=c.relnamespace
 where not tr.tgisinternal and (tr.tgtype & 8)=8 and ns.nspname in ('public','auth')
 and not (ns.nspname='public' and ((c.relname='internal_messages' and tr.tgname='internal_messages_team_chat_signal')
 or (c.relname='team_room_message_reactions' and tr.tgname='team_room_reactions_chat_signal'))
 and md5(pg_catalog.pg_get_functiondef(tr.tgfoid))='a713e288cd360feee271a7fde4504834'));
$$;
revoke all on function public.account_erasure_catalog_ready() from public,anon,authenticated;
grant execute on function public.account_erasure_catalog_ready() to service_role;

create function public.account_erasure_blocker(p_owner uuid,p_email text) returns text
language plpgsql stable security definer set search_path='' as $$
declare p public.profiles%rowtype;
begin
 if not public.account_erasure_catalog_ready() then return 'schema'; end if;
 select * into p from public.profiles where id=p_owner;
 if not found or not exists(select 1 from auth.users where id=p_owner and lower(email)=lower(p_email) and email_confirmed_at is not null) then return 'identity'; end if;
 if p.role='admin' and not exists(select 1 from public.profiles where role='admin' and id<>p_owner and not exists(select 1 from public.account_deletion_requests d where d.account_id=profiles.id and d.automatic_consent)) then return 'last_admin'; end if;
 if exists(select 1 from public.clubs where owner_user_id=p_owner) then return 'ownership'; end if;
 if nullif(p.stripe_subscription_id,'') is not null and nullif(p.stripe_customer_id,'') is null then return 'billing'; end if;
 if (p.captain_subscription_status in ('active','trial','past_due') or p.player_plus_subscription_status in ('active','trial','past_due') or p.coach_subscription_status in ('active','trial','past_due')) and nullif(p.stripe_customer_id,'') is null then return 'billing'; end if;
 if nullif(p.stripe_customer_id,'') is not null and (exists(select 1 from public.profiles where id<>p_owner and stripe_customer_id=p.stripe_customer_id)
 or exists(select 1 from public.club_billing_accounts where stripe_customer_id=p.stripe_customer_id)) then return 'billing'; end if;
 if exists(select 1 from storage.objects o where (o.owner_id=p_owner::text or split_part(o.name,'/',1)=p_owner::text
 or (o.bucket_id='team-room-files' and split_part(o.name,'/',2)=p_owner::text))
 and o.bucket_id not in ('profile-photos','data-assist-screenshots','personal-quest-photos','team-room-files','tiq-league-photos','club-branding')) then return 'storage'; end if;
 return null;
end;$$;
revoke all on function public.account_erasure_blocker(uuid,text) from public,anon,authenticated;
grant execute on function public.account_erasure_blocker(uuid,text) to service_role;

create or replace function public.native_account_lifecycle_config() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('version',2,'deletionReviewDays',7,'fulfillment','automated','queueReady',public.account_erasure_catalog_ready());
$$;
drop function public.native_account_deletion_request(uuid,text,boolean);
create function public.native_account_deletion_request(p_owner uuid,p_email text,p_create boolean default false,p_automatic boolean default false,p_billing_ready boolean default false) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='8s' set lock_timeout='3s' as $$
declare item public.account_deletion_requests%rowtype; blocked text;
begin
 if p_owner is null or p_email is null or length(p_email) not between 3 and 320 then return jsonb_build_object('ok',false); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('erase-admin-ownership',0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('erase:'||p_owner::text,0));
 if p_create and not exists(select 1 from public.account_deletion_requests where account_id=p_owner) then
  if not p_automatic then return jsonb_build_object('ok',false); end if;
  blocked:=public.account_erasure_blocker(p_owner,p_email);
  if blocked is not null then return jsonb_build_object('ok',false,'blocked',blocked); end if;
  if not p_billing_ready and exists(select 1 from public.profiles where id=p_owner and (nullif(stripe_customer_id,'') is not null or nullif(stripe_subscription_id,'') is not null)) then return jsonb_build_object('ok',false,'blocked','billing'); end if;
  insert into public.account_deletion_requests(account_id,verified_email,automatic_consent,stripe_customer_id,stripe_subscription_id,account_key_hash)
  select p_owner,p_email,true,nullif(stripe_customer_id,''),nullif(stripe_subscription_id,''),encode(sha256(convert_to(p_owner::text,'UTF8')),'hex') from public.profiles where id=p_owner;
 end if;
 select * into item from public.account_deletion_requests where account_id=p_owner;
 return jsonb_build_object('ok',true,'reviewDays',7,'fulfillment','automated','request',case when item.id is null then null else
 jsonb_build_object('id',item.id,'status',item.status,'requestedAt',item.requested_at,'dueAt',item.due_at,'phase',item.phase) end);
end;$$;
revoke all on function public.native_account_deletion_request(uuid,text,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.native_account_deletion_request(uuid,text,boolean,boolean,boolean) to service_role;

-- Remove the superseded manual certification path: admins may observe, not attest to erasure.
create or replace function public.admin_account_deletion_request(p_actor uuid,p_action text,p_id uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare rows jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin') or p_action<>'list' then return jsonb_build_object('ok',false,'status',403); end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from
 (select id,status,phase,requested_at,due_at,attempts,next_attempt_at,last_error from public.account_deletion_requests
 where automatic_consent and status<>'completed' order by due_at,id limit 25) x;
 return jsonb_build_object('ok',true,'rows',rows,'limit',25);
end;$$;

-- A helper for structured caches only; no public player/match records are touched.
create function public.account_erasure_scrub(value jsonb,tokens text[],p_root boolean default true) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb;
begin
 if jsonb_typeof(value)='object' then
  if not p_root and exists(select 1 from jsonb_each(value) pair where lower(pair.key) in
   ('id','profileid','profile_id','userid','user_id','senderid','sender_user_id','authorid','author','sender','messageid','message_id')
   and jsonb_typeof(pair.value)='string' and lower(pair.value#>>'{}')=any(select lower(t) from unnest(tokens) t)) then return 'null'::jsonb; end if;
  select coalesce(jsonb_object_agg(key,public.account_erasure_scrub(v,tokens,false)),'{}') into result from jsonb_each(value) e(key,v);return result;
 elsif jsonb_typeof(value)='array' then
  select coalesce(jsonb_agg(public.account_erasure_scrub(v,tokens,false) order by ord),'[]') into result from jsonb_array_elements(value) with ordinality e(v,ord);return result;
 elsif jsonb_typeof(value)='string' and exists(select 1 from unnest(tokens) token where length(token)>0 and strpos(lower(value#>>'{}'),lower(token))>0) then return 'null'::jsonb;
 end if;return value;
end;$$;
revoke all on function public.account_erasure_scrub(jsonb,text[],boolean) from public,anon,authenticated;
grant execute on function public.account_erasure_scrub(jsonb,text[],boolean) to service_role;

create function public.automated_account_erasure(p_action text,p_id uuid default null,p_lease uuid default null,p_value text default null) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='15s' set lock_timeout='3s' as $$
declare j public.account_deletion_requests%rowtype; blocked text; objects jsonb; r record; tokens text[]; other integer;
begin
 if p_action='claim' then
  select * into j from public.account_deletion_requests where automatic_consent and status<>'completed'
   and attempts<10 and next_attempt_at<=clock_timestamp() and (not_before is null or not_before<=clock_timestamp())
   and (lease_until is null or lease_until<clock_timestamp()) and (p_id is null or id=p_id)
   order by next_attempt_at,id limit 1 for update skip locked;
  if not found then return jsonb_build_object('ok',true,'job',null); end if;
  update public.account_deletion_requests set lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes' where id=j.id returning * into j;
  return jsonb_build_object('ok',true,'job',to_jsonb(j));
 end if;
 select * into j from public.account_deletion_requests where id=p_id and automatic_consent and status<>'completed'
 and lease_token=p_lease and lease_until>clock_timestamp() for update;
 if not found then return jsonb_build_object('ok',false); end if;
 if p_action='retry' then
  if p_value not in ('preflight','auth','billing','storage','schema','verify','mail','provider') then return jsonb_build_object('ok',false); end if;
  if j.attempts>=2 and j.alerted_at is null then
   insert into public.internal_notifications(recipient_profile_id,notification_type,title,body,href)
    select id,'system','Account deletion needs attention','An automatic deletion step has failed repeatedly. Reference: '||j.id::text,'/admin/account-deletions'
    from public.profiles where role='admin' and id<>j.account_id;
   update public.account_deletion_requests set alerted_at=clock_timestamp() where id=j.id;
  end if;
  update public.account_deletion_requests set attempts=least(attempts+1,10),last_error=p_value,
   next_attempt_at=clock_timestamp()+make_interval(secs=>least(21600,900*(2^least(attempts,5))::int)),lease_token=null,lease_until=null where id=j.id;
 elsif p_action='release' then
  update public.account_deletion_requests set next_attempt_at=clock_timestamp()+interval '15 minutes',lease_token=null,lease_until=null where id=j.id;
 elsif p_action='preflight' and j.phase='queued' then
  blocked:=public.account_erasure_blocker(j.account_id,j.verified_email);
  if blocked is not null then return jsonb_build_object('ok',false,'blocked',blocked); end if;
  if not exists(select 1 from public.profiles where id=j.account_id and nullif(stripe_customer_id,'') is not distinct from j.stripe_customer_id
    and nullif(stripe_subscription_id,'') is not distinct from j.stripe_subscription_id) then return jsonb_build_object('ok',false); end if;
 elsif p_action='freeze' and j.phase='queued' then
  if p_value is null or p_value !~ '^[0-9]{3,5}$' or p_value::int not between 300 and 86400 then return jsonb_build_object('ok',false); end if;
  -- Called only after the Auth provider has blocked new sign-ins. Revoke all exact-owner refresh sessions.
  delete from auth.sessions where user_id=j.account_id;
  update public.account_deletion_requests set status='reviewing',phase='waiting',not_before=clock_timestamp()+make_interval(secs=>p_value::int+120),
    next_attempt_at=clock_timestamp()+make_interval(secs=>p_value::int+120),lease_token=null,lease_until=null,attempts=0,last_error=null,alerted_at=null where id=j.id;
 elsif p_action='ready' and j.phase='waiting' and j.not_before<=clock_timestamp() then
  blocked:=public.account_erasure_blocker(j.account_id,j.verified_email);
  if blocked is not null or exists(select 1 from auth.sessions where user_id=j.account_id) then return jsonb_build_object('ok',false); end if;
  update public.account_deletion_requests set phase='billing',attempts=0,last_error=null,alerted_at=null where id=j.id;
 elsif p_action='advance' and ((j.phase='billing' and p_value='files') or (j.phase='files' and p_value='data')) then
  if j.phase='files' and exists(select 1 from storage.objects o where o.owner_id=j.account_id::text or split_part(o.name,'/',1)=j.account_id::text
    or (o.bucket_id='team-room-files' and split_part(o.name,'/',2)=j.account_id::text)) then return jsonb_build_object('ok',false); end if;
  update public.account_deletion_requests set phase=p_value,attempts=0,last_error=null,alerted_at=null where id=j.id;
 elsif p_action='files' and j.phase='files' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into objects from
  (select o.bucket_id,o.name from storage.objects o where o.owner_id=j.account_id::text or split_part(o.name,'/',1)=j.account_id::text
   or (o.bucket_id='team-room-files' and split_part(o.name,'/',2)=j.account_id::text) order by o.bucket_id,o.name limit 100) x;
  return jsonb_build_object('ok',true,'objects',objects);
 elsif p_action='erase_data' and j.phase='data' then
  if not public.account_erasure_catalog_ready() or j.not_before>clock_timestamp() or exists(select 1 from auth.sessions where user_id=j.account_id)
   or exists(select 1 from storage.objects where owner_id=j.account_id::text or split_part(name,'/',1)=j.account_id::text or (bucket_id='team-room-files' and split_part(name,'/',2)=j.account_id::text)) then return jsonb_build_object('ok',false); end if;
  select array[j.account_id::text,j.verified_email]||coalesce(array_agg(id::text),'{}') into tokens from public.internal_messages where sender_user_id=j.account_id;
  -- Erase authored content and cached quotes/mentions, retaining other members' messages.
  update public.internal_messages set metadata=public.account_erasure_scrub(metadata,tokens) where metadata::text ilike any(select '%'||token||'%' from unnest(tokens) token);
  update public.internal_conversations set subject='Conversation',metadata=public.account_erasure_scrub(metadata,tokens) where created_by_user_id=j.account_id;
  update public.internal_schedule_events set metadata=public.account_erasure_scrub(metadata,tokens),title='Team event' where created_by_user_id=j.account_id;
  delete from public.club_announcement_history where author_user_id=j.account_id;
  delete from public.coach_player_links where player_user_id=j.account_id or lower(player_email)=lower(j.verified_email);
  delete from public.captain_practice_invitees where profile_id=j.account_id;
  delete from public.internal_notifications where actor_user_id=j.account_id;
  update public.admin_audit_events set metadata='{}'::jsonb,target_label='' where actor_user_id=j.account_id;
  update public.admin_audit_events set metadata=public.account_erasure_scrub(metadata,tokens) where metadata::text ilike '%'||j.account_id::text||'%';
  delete from public.club_memberships where user_id=j.account_id or lower(email)=lower(j.verified_email);
  delete from public.club_invites where accepted_by_user_id=j.account_id or lower(email)=lower(j.verified_email);
  delete from public.coach_student_invites where accepted_by_user_id=j.account_id or lower(invite_email)=lower(j.verified_email);
  delete from public.captain_roster_contacts where lower(email)=lower(j.verified_email);
  delete from public.tiq_league_delegate_invites where accepted_by_user_id=j.account_id or lower(email)=lower(j.verified_email);
  delete from public.tiq_league_delegates where lower(email)=lower(j.verified_email);
  delete from public.tiq_tournament_contacts c using public.tiq_tournament_entries e
   where c.tournament_id=e.tournament_id and c.entrant_name=e.player_name and lower(e.email)=lower(j.verified_email);
  delete from public.tiq_tournament_preference_events v using public.tiq_tournament_entries e
   where (v.tournament_entry_id=e.id or (v.tournament_id=e.tournament_id and v.player_name=e.player_name)) and lower(e.email)=lower(j.verified_email);
  update public.tiq_tournaments t set contacts=t.contacts-e.player_name from public.tiq_tournament_entries e
   where t.id=e.tournament_id and lower(e.email)=lower(j.verified_email);
  update public.tiq_tournament_entries set email='',phone='',sms_opt_in=false,consent_note='',player_request_note='',
   preference_token_hash=null,preference_token_expires_at=null where lower(email)=lower(j.verified_email);
  update public.clubs set contact_email='' where lower(contact_email)=lower(j.verified_email);
  update public.tiq_tournaments set registration_email='' where lower(registration_email)=lower(j.verified_email);
  update public.club_competition_templates set schedule_notes='' where created_by_user_id=j.account_id;
  update public.club_clinic_attendance set note='' where updated_by_user_id=j.account_id;
  update public.club_clinic_sessions set plan='',focus='',player_next_step='' where created_by_user_id=j.account_id;
  update public.club_groups set description='' where created_by_user_id=j.account_id;
  delete from public.tiq_individual_league_suggestions where created_by_user_id=j.account_id;
  update public.tiq_individual_league_suggestions set claimed_by_label='' where claimed_by_user_id=j.account_id;
  delete from public.native_email_auth_limits where scope in ('email-minute','email-hour')
   and key_hash=encode(sha256(convert_to('email:'||lower(j.verified_email),'UTF8')),'hex');
  delete from public.import_queue where strpos(payload::text,j.account_id::text)>0 or strpos(lower(payload::text),lower(j.verified_email))>0;
  delete from public.product_usage_events where user_id=j.account_id;
  delete from public.upgrade_requests where requester_user_id=j.account_id or lower(requester_email)=lower(j.verified_email);
  -- Keep financial event IDs/timestamps only; remove the account pointer and raw provider payload.
  update public.stripe_billing_events set profile_id=null,event_object=null,message='' where profile_id=j.account_id or stripe_customer_id=j.stripe_customer_id;
  delete from public.team_chat_poll_votes where profile_id=j.account_id;
  delete from public.team_chat_polls where created_by=j.account_id;
  -- Null reviewed shared-record author references before Auth's personal-data cascades.
  update public.captain_availability_requests set created_by=null where created_by=j.account_id;
  update public.captain_lineup_reviews set created_by=null where created_by=j.account_id;
  update public.captain_practice_invites set created_by_user_id=null where created_by_user_id=j.account_id;
  update public.club_clinic_attendance set updated_by_user_id=null where updated_by_user_id=j.account_id;
  update public.club_clinic_sessions set created_by_user_id=null where created_by_user_id=j.account_id;
  update public.club_clinic_sessions set updated_by_user_id=null where updated_by_user_id=j.account_id;
  update public.club_competition_templates set created_by_user_id=null where created_by_user_id=j.account_id;
  update public.club_group_renewals set created_by_user_id=null where created_by_user_id=j.account_id;
  update public.club_groups set created_by_user_id=null where created_by_user_id=j.account_id;
  update public.internal_conversations set created_by_user_id=null where created_by_user_id=j.account_id;
  update public.internal_schedule_events set created_by_user_id=null where created_by_user_id=j.account_id;
  update public.season_availability_invites set created_by=null where created_by=j.account_id;
  update public.team_chat_rooms set created_by=null where created_by=j.account_id;
  update public.team_room_member_removals set removed_by_user_id=null where removed_by_user_id=j.account_id;
  update public.tiq_individual_league_suggestions set created_by_user_id=null where created_by_user_id=j.account_id;
  update public.tiq_individual_league_suggestions set updated_by_user_id=null where updated_by_user_id=j.account_id;
  update public.tiq_league_weekly_sessions set created_by_user_id=null where created_by_user_id=j.account_id;
  update public.account_deletion_requests set phase='auth',attempts=0,last_error=null,alerted_at=null where id=j.id;
 elsif p_action='authorize_auth' and j.phase='auth' then
  if not public.account_erasure_catalog_ready() or exists(select 1 from storage.objects where owner_id=j.account_id::text or split_part(name,'/',1)=j.account_id::text or (bucket_id='team-room-files' and split_part(name,'/',2)=j.account_id::text)) then return jsonb_build_object('ok',false); end if;
 elsif p_action='verify' and j.phase in ('auth','confirmation') then
  if exists(select 1 from auth.users where id=j.account_id) or exists(select 1 from public.profiles where id=j.account_id)
   or exists(select 1 from auth.sessions where user_id=j.account_id)
   or exists(select 1 from storage.objects where owner_id=j.account_id::text or split_part(name,'/',1)=j.account_id::text or (bucket_id='team-room-files' and split_part(name,'/',2)=j.account_id::text))
   or exists(select 1 from public.product_usage_events where user_id=j.account_id)
   or exists(select 1 from public.upgrade_requests where requester_user_id=j.account_id) then return jsonb_build_object('ok',false); end if;
  update public.account_deletion_requests set phase='confirmation',status='erased',attempts=case when phase='auth' then 0 else attempts end,last_error=case when phase='auth' then null else last_error end,alerted_at=case when phase='auth' then null else alerted_at end where id=j.id;
 elsif p_action='complete' and j.phase='confirmation' and j.status='erased' then
  update public.account_deletion_requests set phase='completed',status='completed',account_id=null,verified_email=null,stripe_customer_id=null,stripe_subscription_id=null,
   completed_at=clock_timestamp(),lease_token=null,lease_until=null,last_error=null,attempts=0 where id=j.id;
 else return jsonb_build_object('ok',false);
 end if;
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.automated_account_erasure(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.automated_account_erasure(text,uuid,uuid,text) to service_role;
commit;
