alter table public.captain_share_links
  drop constraint if exists captain_share_links_kind_check;

alter table public.captain_share_links
  add constraint captain_share_links_kind_check
  check (
    kind in (
      'lineup',
      'final-result',
      'availability',
      'practice',
      'live-scorecard',
      'team-room',
      'team-invite'
    )
  );
