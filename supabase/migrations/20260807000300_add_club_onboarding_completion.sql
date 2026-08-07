alter table public.clubs
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.clubs.onboarding_completed_at is
  'When the club owner completes the guided identity, staff, player, program, and sharing setup.';
