create or replace function public.has_current_player_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.profiles profile
    where profile.id = target_user_id
      and (
        (
          profile.player_plus_subscription_active = true
          and profile.player_plus_subscription_status in ('trial', 'active')
          and (profile.player_plus_access_expires_at is null or profile.player_plus_access_expires_at > timezone('utc', now()))
        )
        or (
          profile.coach_subscription_active = true
          and profile.coach_subscription_status in ('trial', 'active')
          and (profile.coach_access_expires_at is null or profile.coach_access_expires_at > timezone('utc', now()))
        )
        or (
          profile.captain_subscription_active = true
          and profile.captain_subscription_status in ('trial', 'active')
          and (profile.captain_access_expires_at is null or profile.captain_access_expires_at > timezone('utc', now()))
        )
      )
  );
$$;

create or replace function public.is_storage_upload_within_quota(
  target_bucket_id text,
  target_name text,
  target_size_bytes bigint,
  maximum_objects integer,
  maximum_bytes bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) < greatest(maximum_objects, 1)
    and coalesce(sum(
      case
        when coalesce(object.metadata ->> 'size', '') ~ '^[0-9]+$'
          then (object.metadata ->> 'size')::bigint
        else 0
      end
    ), 0) + greatest(target_size_bytes, 0) <= greatest(maximum_bytes, 1)
  from storage.objects object
  where object.bucket_id = target_bucket_id
    and (storage.foldername(object.name))[1] = auth.uid()::text
    and object.name <> target_name;
$$;

revoke all on function public.has_current_player_access(uuid) from public;
revoke all on function public.is_storage_upload_within_quota(text, text, bigint, integer, bigint) from public;
grant execute on function public.has_current_player_access(uuid) to authenticated, service_role;
grant execute on function public.is_storage_upload_within_quota(text, text, bigint, integer, bigint) to authenticated, service_role;

drop policy if exists "Authenticated users can upload profile photos" on storage.objects;
create policy "Paid players can upload profile photos within quota"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.has_current_player_access(auth.uid())
  and public.is_storage_upload_within_quota(
    bucket_id,
    name,
    case when coalesce(metadata ->> 'size', '') ~ '^[0-9]+$' then (metadata ->> 'size')::bigint else 0 end,
    8,
    41943040
  )
);

drop policy if exists "Authenticated users can update their profile photos" on storage.objects;
create policy "Paid players can update profile photos within quota"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.has_current_player_access(auth.uid())
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.has_current_player_access(auth.uid())
  and public.is_storage_upload_within_quota(
    bucket_id,
    name,
    case when coalesce(metadata ->> 'size', '') ~ '^[0-9]+$' then (metadata ->> 'size')::bigint else 0 end,
    8,
    41943040
  )
);

drop policy if exists "Authenticated users can upload TIQ league photos" on storage.objects;
create policy "League organizers can upload league photos within quota"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tiq-league-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.has_current_league_access(auth.uid())
  and public.is_storage_upload_within_quota(
    bucket_id,
    name,
    case when coalesce(metadata ->> 'size', '') ~ '^[0-9]+$' then (metadata ->> 'size')::bigint else 0 end,
    24,
    125829120
  )
);

drop policy if exists "Authenticated users can update their TIQ league photos" on storage.objects;
create policy "League organizers can update league photos within quota"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'tiq-league-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.has_current_league_access(auth.uid())
)
with check (
  bucket_id = 'tiq-league-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.has_current_league_access(auth.uid())
  and public.is_storage_upload_within_quota(
    bucket_id,
    name,
    case when coalesce(metadata ->> 'size', '') ~ '^[0-9]+$' then (metadata ->> 'size')::bigint else 0 end,
    24,
    125829120
  )
);

drop policy if exists "Users can upload own personal quest photos" on storage.objects;
create policy "Paid players can upload personal quest photos within quota"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'personal-quest-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.has_current_player_access(auth.uid())
  and public.is_storage_upload_within_quota(
    bucket_id,
    name,
    case when coalesce(metadata ->> 'size', '') ~ '^[0-9]+$' then (metadata ->> 'size')::bigint else 0 end,
    100,
    524288000
  )
);

drop policy if exists "Users can update own personal quest photos" on storage.objects;
create policy "Paid players can update personal quest photos within quota"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'personal-quest-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.has_current_player_access(auth.uid())
)
with check (
  bucket_id = 'personal-quest-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.has_current_player_access(auth.uid())
  and public.is_storage_upload_within_quota(
    bucket_id,
    name,
    case when coalesce(metadata ->> 'size', '') ~ '^[0-9]+$' then (metadata ->> 'size')::bigint else 0 end,
    100,
    524288000
  )
);

drop policy if exists "Authenticated users can upload Data Assist screenshots" on storage.objects;
create policy "Authenticated users can upload Data Assist screenshots within quota"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'data-assist-screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_storage_upload_within_quota(
    bucket_id,
    name,
    case when coalesce(metadata ->> 'size', '') ~ '^[0-9]+$' then (metadata ->> 'size')::bigint else 0 end,
    100,
    524288000
  )
);
