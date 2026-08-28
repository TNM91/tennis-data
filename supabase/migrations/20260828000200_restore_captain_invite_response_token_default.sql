-- Earlier environments may already have this table from a pre-default schema.
-- Keep the database invariant aligned with the API's explicit token generation.
alter table if exists public.captain_availability_request_invites
  alter column response_token set default gen_random_uuid();
