alter table public.captain_pilot_redemptions
  add column if not exists trial_ends_at timestamptz,
  add column if not exists billing_status text not null default 'not_collected',
  add column if not exists card_free_activated_at timestamptz,
  add column if not exists billing_collected_at timestamptz;

update public.captain_pilot_redemptions
set billing_status = 'collected',
    billing_collected_at = coalesce(converted_at, updated_at, created_at)
where status = 'converted'
  and billing_status = 'not_collected';

alter table public.captain_pilot_redemptions
  drop constraint if exists captain_pilot_redemptions_billing_status_check;

alter table public.captain_pilot_redemptions
  add constraint captain_pilot_redemptions_billing_status_check
  check (billing_status in ('not_collected', 'checkout_started', 'collected'));

create index if not exists captain_pilot_redemptions_billing_trial_idx
  on public.captain_pilot_redemptions (billing_status, trial_ends_at)
  where billing_status <> 'collected';

create or replace function public.activate_captain_pilot_card_free(
  p_profile_id uuid,
  p_redemption_id uuid,
  p_upgrade_request_id uuid,
  p_trial_ends_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.captain_pilot_redemptions
    where id = p_redemption_id
      and profile_id = p_profile_id
      and campaign_key = 'fall-2026-captain-pilot'
  ) then
    raise exception 'Captain Pilot redemption was not found.';
  end if;

  update public.profiles
  set player_plus_subscription_active = true,
      player_plus_subscription_status = case
        when player_plus_subscription_active = true and player_plus_access_expires_at is null
          then player_plus_subscription_status
        else 'trial'
      end,
      player_plus_access_expires_at = case
        when player_plus_subscription_active = true and player_plus_access_expires_at is null
          then null
        else greatest(coalesce(player_plus_access_expires_at, p_trial_ends_at), p_trial_ends_at)
      end,
      captain_subscription_active = true,
      captain_subscription_status = case
        when captain_subscription_active = true and captain_access_expires_at is null
          then captain_subscription_status
        else 'trial'
      end,
      captain_access_expires_at = case
        when captain_subscription_active = true and captain_access_expires_at is null
          then null
        else greatest(coalesce(captain_access_expires_at, p_trial_ends_at), p_trial_ends_at)
      end
  where id = p_profile_id;

  if not found then
    raise exception 'Captain profile was not found.';
  end if;

  update public.upgrade_requests
  set status = case when status = 'converted' then status else 'contacted' end,
      updated_at = timezone('utc', now())
  where id = p_upgrade_request_id
    and requester_user_id = p_profile_id;

  if not found then
    raise exception 'Captain Pilot request was not found.';
  end if;

  update public.captain_pilot_redemptions
  set upgrade_request_id = p_upgrade_request_id,
      status = 'converted',
      trial_ends_at = p_trial_ends_at,
      billing_status = case when billing_status = 'collected' then billing_status else 'not_collected' end,
      card_free_activated_at = coalesce(card_free_activated_at, timezone('utc', now())),
      converted_at = coalesce(converted_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where id = p_redemption_id
    and profile_id = p_profile_id;
end;
$$;

revoke all on function public.activate_captain_pilot_card_free(uuid, uuid, uuid, timestamptz) from public;
revoke all on function public.activate_captain_pilot_card_free(uuid, uuid, uuid, timestamptz) from anon;
revoke all on function public.activate_captain_pilot_card_free(uuid, uuid, uuid, timestamptz) from authenticated;
grant execute on function public.activate_captain_pilot_card_free(uuid, uuid, uuid, timestamptz) to service_role;

alter table public.product_usage_events
  drop constraint if exists product_usage_events_event_name_check;

alter table public.product_usage_events
  add constraint product_usage_events_event_name_check
  check (
    event_name in (
      'billing_portal_opened',
      'signup_confirmation_sent',
      'upgrade_page_viewed',
      'upgrade_checkout_clicked',
      'upgrade_checkout_started',
      'upgrade_checkout_failed',
      'captain_pilot_viewed',
      'captain_pilot_cta_clicked',
      'captain_pilot_team_preview_viewed',
      'captain_pilot_claimed',
      'captain_pilot_card_free_activated',
      'captain_pilot_activation_failed',
      'captain_pilot_billing_clicked',
      'profile_player_linked',
      'profile_cloud_sync_repair',
      'mylab_match_plan_action',
      'mylab_goal_template_applied',
      'matchup_prep_saved',
      'captain_closeout_action',
      'captain_team_scope_selected',
      'captain_default_team_saved',
      'search_submitted',
      'search_result_clicked',
      'search_category_selected',
      'zero_result_seen',
      'matchup_started',
      'player_a_selected',
      'player_b_selected',
      'matchup_preview_viewed',
      'matchup_unlock_clicked',
      'coach_page_viewed',
      'find_coach_clicked',
      'coach_hub_clicked',
      'coach_assignment_preview_clicked',
      'team_search_submitted',
      'captain_tools_clicked',
      'lineup_preview_clicked',
      'availability_clicked',
      'tournament_search_submitted',
      'run_tournament_clicked',
      'tournament_desk_clicked',
      'draw_preview_clicked',
      'league_search_submitted',
      'league_office_clicked',
      'schedule_preview_clicked',
      'standings_preview_clicked',
      'data_assist_opened',
      'upload_type_selected',
      'scorecard_upload_started',
      'schedule_upload_started',
      'team_summary_upload_started',
      'data_issue_reported',
      'portal_personalization_opened',
      'portal_personalization_saved',
      'portal_personalization_save_blocked',
      'portal_lane_opened',
      'portal_shortcut_opened',
      'product_tour_started',
      'product_tour_progressed',
      'product_tour_completed',
      'product_tour_cta_clicked',
      'product_tour_role_selected'
    )
  );
