# Team polls — production migration review

Candidate: chat coordination / intended iPhone build 142. This file describes a prepared change, not evidence it has been applied.

## Scope

Apply only `supabase/migrations/20261027000300_native_team_polls.sql`, after the existing named-room migration. It creates:

- `public.team_chat_polls`: fixed question/options, room, author, closed time and creation time; linked to the associated chat post.
- `public.team_chat_poll_votes`: one optional choice and a personal revision per poll/member. Removing a vote retains its revision so a stale device cannot restore an old vote silently.
- `public.native_team_poll(uuid,text,text,text,uuid,uuid,text,text,jsonb,integer,integer)`: service-only invoker function for create, lookup, get, vote and close.

Both tables enable RLS with no direct anon/authenticated policies or grants. Only service_role receives SELECT/INSERT/UPDATE. Only service_role can execute the new function. The authenticated HTTP endpoint supplies the verified bearer owner; callers cannot select another owner in a body. The function checks the exact accepted, nonarchived team link, open parent/room, current participation, explicit removals and named-room parent mapping on every operation. Current captains/co-captains can close polls but cannot vote as another member. Summaries return counts and the caller's own choice only.

No existing rows are rewritten. No existing table grant, policy, access predicate, notification setting, subscription or production job is changed. The migration runs in one transaction; an application error rolls it back. New chat posts and votes occur only through later explicit user actions.

## Approval and deployment order

1. Finish local checks and required PR CI on the exact candidate.
2. Obtain separate owner approval for this production schema/permission addition. Standing beta approval covers the eventual verified merge/build/release, not this migration.
3. Apply the exact reviewed SQL once through the authorized database administration path. If an earlier attempt has an unknown outcome, inspect the catalog before retrying.
4. Verify both tables, constraints, RLS, service-only grants and function definition. Do not create a production test poll, vote, RSVP or notification for QA.
5. Merge the same verified source, reuse its normal master Git deployment, and release the signed beta under standing authorization. Do not release a client that advertises polls before the migration is verified.

## Read-only catalog checks

```sql
select c.relname,c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('team_chat_polls','team_chat_poll_votes');

select grantee,table_name,privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name in ('team_chat_polls','team_chat_poll_votes')
order by table_name,grantee,privilege_type;

select r.rolname,
 has_function_privilege(r.oid,'public.native_team_poll(uuid,text,text,text,uuid,uuid,text,text,jsonb,integer,integer)','execute') as can_execute
from pg_roles r where r.rolname in ('anon','authenticated','service_role');

select p.prosecdef,pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='native_team_poll';
```

Expected: both RLS flags true; service_role SELECT/INSERT/UPDATE on the new tables, no anon/authenticated/PUBLIC access; execute true only for service_role among those three roles; `prosecdef=false`. Compare the complete function body with the reviewed migration, not just its name. Verify the primary/foreign/check constraints and room/created-time index in the catalog as well.

## Recovery and limits

If application fails, keep the prior client/API release and resolve the migration error; do not broaden grants. If a client release is rolled back after polls exist, preserve the poll tables and vote history. Older clients still show the ordinary chat post and its text/options; interactive voting is provided by the new native client, not claimed as website parity. Do not drop production poll data as a routine rollback.

Poll results refresh on explicit entry/action/refresh. New-poll alerts use existing iPhone delivery caps and mute/block checks, are best effort, and do not replay after a confirmed creation. There is no new notification outbox. The current native push sender caps candidate/device delivery; this change does not increase it. Counts exclude the viewer's blocked users and removed/noncurrent members, so totals can differ between viewers. Physical iPhone accessibility, keyboard and new-poll alert acceptance still require device checks.
