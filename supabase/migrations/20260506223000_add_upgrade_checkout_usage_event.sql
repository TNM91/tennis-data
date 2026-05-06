alter table public.product_usage_events
  drop constraint if exists product_usage_events_event_name_check;

alter table public.product_usage_events
  add constraint product_usage_events_event_name_check
  check (
    event_name in (
      'billing_portal_opened',
      'upgrade_checkout_started',
      'profile_player_linked',
      'mylab_match_plan_action',
      'mylab_goal_template_applied',
      'captain_closeout_action',
      'captain_team_scope_selected'
    )
  );
