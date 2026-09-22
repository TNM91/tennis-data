-- Preserve whether the factual stated USTA NTRP came from the computer
-- rating (C) or a self rating (S).  TiQ uses this only to set confidence;
-- TennisRecord estimated dynamic ratings remain excluded.
alter table public.tennisrecord_ntrp_observations
  add column if not exists designation text not null default 'unknown';

alter table public.tennisrecord_ntrp_observations
  drop constraint if exists tennisrecord_ntrp_observations_designation_check;

alter table public.tennisrecord_ntrp_observations
  add constraint tennisrecord_ntrp_observations_designation_check
  check (designation in ('computer', 'self', 'unknown'));

comment on column public.tennisrecord_ntrp_observations.designation is
  'Source-stated USTA designation: computer-rated (C), self-rated (S), or unknown. Used for TiQ confidence only.';

-- Correct the earlier numeric-only classification for safely isolated source
-- records. Local, captain, and admin records are intentionally untouched.
update public.players as player
set rating_source = case
  when staged.ntrp_label ~* '(^|\\s)[1-7]\\.[05]\\s*C(\\s|$)' then 'verified'
  when staged.ntrp_label ~* '(^|\\s)[1-7]\\.[05]\\s*S(\\s|$)' then 'self'
  else player.rating_source
end
from public.tennisrecord_staged_players as staged
where player.external_source = 'tennisrecord'
  and player.is_external_provisional is true
  and player.external_source_key = staged.source_player_key
  and staged.ntrp_label ~* '(^|\\s)[1-7]\\.[05]\\s*[CS](\\s|$)';
