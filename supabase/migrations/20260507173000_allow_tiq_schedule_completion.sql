drop policy if exists "Participants can update TIQ league schedule proposals" on public.tiq_league_schedule_items;

create policy "Participants can update TIQ league schedule proposals"
on public.tiq_league_schedule_items
for update
to authenticated
using (
  proposed_by_user_id = auth.uid()
  or created_by_user_id = auth.uid()
)
with check (
  updated_by_user_id = auth.uid()
  and status in ('confirmed', 'completed', 'cancelled')
);
