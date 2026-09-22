alter table public.product_usage_events
  drop constraint if exists product_usage_events_event_name_check;

alter table public.product_usage_events
  add constraint product_usage_events_event_name_check
  check (
    event_name in (
      'billing_portal_opened',
      'upgrade_checkout_started',
      'profile_player_linked',
      'profile_cloud_sync_repair',
      'mylab_match_plan_action',
      'mylab_goal_template_applied',
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
      'product_tour_completed',
      'product_tour_cta_clicked'
    )
  );

alter table public.product_usage_events
  drop constraint if exists product_usage_events_surface_check;

alter table public.product_usage_events
  add constraint product_usage_events_surface_check
  check (
    surface in (
      'profile',
      'mylab',
      'captain',
      'billing',
      'upgrade',
      'public_site',
      'search',
      'matchup',
      'coach',
      'teams',
      'tournaments',
      'leagues',
      'data_assist',
      'portal'
    )
  );
