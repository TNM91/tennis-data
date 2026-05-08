insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'data-assist-screenshots',
  'data-assist-screenshots',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.data_assist_screenshots
  add column if not exists storage_bucket text not null default 'data-assist-screenshots',
  add column if not exists storage_path text not null default '',
  add column if not exists storage_uploaded_at timestamptz null;

create index if not exists data_assist_screenshots_storage_path_idx
  on public.data_assist_screenshots (storage_bucket, storage_path)
  where storage_path <> '';

drop policy if exists "Data Assist screenshots are readable by owners and admins" on storage.objects;
create policy "Data Assist screenshots are readable by owners and admins"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'data-assist-screenshots'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  )
);

drop policy if exists "Authenticated users can upload Data Assist screenshots" on storage.objects;
create policy "Authenticated users can upload Data Assist screenshots"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'data-assist-screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
);
