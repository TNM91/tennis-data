alter table public.profiles
  add column if not exists preferred_role text
    check (preferred_role in ('singles', 'doubles', 'both')),
  add column if not exists availability_default text
    check (availability_default in ('ask-weekly', 'usually-available', 'limited'));
