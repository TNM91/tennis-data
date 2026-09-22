alter table public.players
  add column if not exists external_source text,
  add column if not exists external_source_key text,
  add column if not exists is_external_provisional boolean not null default false;

alter table public.players
  drop constraint if exists players_external_source_key_unique;

alter table public.players
  add constraint players_external_source_key_unique unique (external_source, external_source_key);

comment on column public.players.is_external_provisional is
'True for an external-source identity created without a linked TenAceIQ account. It may only merge with a local identity after verification.';
