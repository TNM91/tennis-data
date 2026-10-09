-- Private per-account, per-player goals. Null payloads remember removals across devices.
create table if not exists public.my_lab_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id text not null check (length(player_id) between 1 and 200),
  goal_id text not null check (length(goal_id) between 1 and 200),
  payload jsonb check (payload is null or (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 40000)),
  edited_at timestamptz not null,
  primary key (user_id, player_id, goal_id)
);
alter table public.my_lab_goals enable row level security;
create policy "Players read their own goals" on public.my_lab_goals for select to authenticated using (auth.uid() = user_id);
create policy "Players add their own goals" on public.my_lab_goals for insert to authenticated with check (auth.uid() = user_id);
create policy "Players update their own goals" on public.my_lab_goals for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on public.my_lab_goals to authenticated;

create or replace function public.sync_my_lab_goals(p_player_id text, p_goals jsonb)
returns setof public.my_lab_goals language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to save goals'; end if;
  if jsonb_typeof(p_goals) <> 'array' or jsonb_array_length(p_goals) > 500 then raise exception 'Invalid goals'; end if;
  insert into public.my_lab_goals (user_id, player_id, goal_id, payload, edited_at)
  select auth.uid(), p_player_id, item->>'goal_id', nullif(item->'payload', 'null'::jsonb), (item->>'edited_at')::timestamptz
  from jsonb_array_elements(p_goals) item
  on conflict (user_id, player_id, goal_id) do update
  set payload = excluded.payload, edited_at = excluded.edited_at
  where public.my_lab_goals.edited_at < excluded.edited_at
     or (public.my_lab_goals.edited_at = excluded.edited_at and excluded.payload is null);
  return query select * from public.my_lab_goals where user_id = auth.uid() and player_id = p_player_id;
end;
$$;
revoke all on function public.sync_my_lab_goals(text, jsonb) from public, anon;
grant execute on function public.sync_my_lab_goals(text, jsonb) to authenticated;
