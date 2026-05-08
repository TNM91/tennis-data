create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

grant execute on function public.is_current_user_admin() to authenticated;

drop policy if exists "Users and admins can read Data Assist batches" on public.data_assist_batches;
create policy "Users and admins can read Data Assist batches"
  on public.data_assist_batches for select to authenticated
  using (
    submitted_by_user_id = auth.uid()
    or public.is_current_user_admin()
  );

drop policy if exists "Admins can update Data Assist batches" on public.data_assist_batches;
create policy "Admins can update Data Assist batches"
  on public.data_assist_batches for update to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "Users and admins can read Data Assist screenshots" on public.data_assist_screenshots;
create policy "Users and admins can read Data Assist screenshots"
  on public.data_assist_screenshots for select to authenticated
  using (
    submitted_by_user_id = auth.uid()
    or public.is_current_user_admin()
  );

drop policy if exists "Users and admins can read Data Assist drafts" on public.data_assist_drafts;
create policy "Users and admins can read Data Assist drafts"
  on public.data_assist_drafts for select to authenticated
  using (
    submitted_by_user_id = auth.uid()
    or public.is_current_user_admin()
  );

drop policy if exists "Users and admins can read contributor stats" on public.data_assist_contributor_stats;
create policy "Users and admins can read contributor stats"
  on public.data_assist_contributor_stats for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_current_user_admin()
  );

drop policy if exists "Admins can update contributor stats" on public.data_assist_contributor_stats;
create policy "Admins can update contributor stats"
  on public.data_assist_contributor_stats for all to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "Admins can update Data Assist drafts" on public.data_assist_drafts;
create policy "Admins can update Data Assist drafts"
  on public.data_assist_drafts for update to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists "Users and admins can read stored Data Assist screenshots" on public.data_assist_screenshots;
create policy "Users and admins can read stored Data Assist screenshots"
  on public.data_assist_screenshots for select to authenticated
  using (
    submitted_by_user_id = auth.uid()
    or public.is_current_user_admin()
  );

drop policy if exists "Users and admins can read Data Assist OCR jobs" on public.data_assist_ocr_jobs;
create policy "Users and admins can read Data Assist OCR jobs"
  on public.data_assist_ocr_jobs for select to authenticated
  using (
    exists (
      select 1 from public.data_assist_batches
      where data_assist_batches.id = data_assist_ocr_jobs.batch_id
        and data_assist_batches.submitted_by_user_id = auth.uid()
    )
    or public.is_current_user_admin()
  );

drop policy if exists "Admins can create Data Assist OCR jobs" on public.data_assist_ocr_jobs;
create policy "Admins can create Data Assist OCR jobs"
  on public.data_assist_ocr_jobs for insert to authenticated
  with check (public.is_current_user_admin());

drop policy if exists "Admins can update Data Assist OCR jobs" on public.data_assist_ocr_jobs;
create policy "Admins can update Data Assist OCR jobs"
  on public.data_assist_ocr_jobs for update to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());
