alter table public.upgrade_requests
  add column if not exists price_label text not null default '',
  add column if not exists billing_amount_cents integer null,
  add column if not exists billing_currency text not null default 'usd',
  add column if not exists billing_interval text not null default 'none'
    check (billing_interval in ('none', 'month', 'season')),
  add column if not exists checkout_mode text not null default 'none'
    check (checkout_mode in ('none', 'subscription', 'one_time')),
  add column if not exists quantity_mode text not null default 'account'
    check (quantity_mode in ('account', 'league')),
  add column if not exists entitlement_grant jsonb not null default '{}'::jsonb,
  add column if not exists discount_rules jsonb not null default '[]'::jsonb;

create index if not exists upgrade_requests_checkout_mode_created_at_idx
  on public.upgrade_requests (checkout_mode, created_at desc);
