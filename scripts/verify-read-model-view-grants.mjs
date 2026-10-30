// Disposable PostgreSQL only; never reads credentials or contacts production.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const columns = {
  internal_message_directory: 'id,role,display_name,linked_player_id,tiq_public_id,tiq_admin_id',
  tennisrecord_annual_label_candidates: 'canonical_player_id,season,ntrp,distinct_levels,unambiguous,first_captured_at,evidence_rows',
  tennisrecord_admin_coverage_summary: 'staged_player_count,filterable_team_count,filterable_league_count,filterable_flight_count,source_roster_listing_count,source_team_history_count,unpromoted_team_history_count,promoted_match_count',
  team_match_results: 'id,external_match_id,home_team,away_team,match_date,match_time,facility,status,match_type,winner_side,score,flight,league_name,usta_section,district_area,line_number,source,source_url,season_year',
  tennisrecord_public_team_context: 'source_team_key,team_name,league_name,flight,season_year,source_url,first_seen_at,last_seen_at,source',
  tennisrecord_public_team_match_history: 'source_match_key,team_name,opponent_team,played_on,league_name,flight,discipline,court_number,score_text,winner_side,team_side,source_url,canonical_match_id,first_seen_at,last_seen_at,source',
  tennisrecord_public_team_roster_context: 'team_name,normalized_team_name,player_name,canonical_player_id,source_url,first_seen_at,last_seen_at,source,season_year,league_name,flight',
  tennisrecord_public_team_roster_counts: 'normalized_team_name,listed_player_count,season_year',
  tennisrecord_public_team_events: 'id,source_event_id,source_url,season_year,played_on,league_name,flight,home_team,away_team,home_courts,away_courts,captured_at',
}
const privateViews = new Set(['tennisrecord_admin_coverage_summary', 'tennisrecord_annual_label_candidates'])
const db = new PGlite()
const migration = await readFile(new URL('../supabase/migrations/20261030000200_harden_read_model_view_grants.sql', import.meta.url), 'utf8')
const owner = async () => db.exec('reset role')
const role = async name => { await owner(); await db.exec(`set role ${name}`) }
const denied = async sql => assert.rejects(db.query(sql), /permission denied/)
const anonDirectory = () => db.query("select has_table_privilege('anon','internal_message_directory','SELECT') ok")
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema fixture;
    grant usage on schema fixture to anon,authenticated,service_role;
    create function public.account_erasure_catalog_ready() returns boolean language sql as
      $$select coalesce(nullif(current_setting('test.catalog_ready',true),''),'true')::boolean$$;
    create table public.profiles(id text,role text,display_name text,linked_player_id text,tiq_public_id text,tiq_admin_id text,message_search_enabled boolean);
    alter table public.profiles enable row level security;
    create policy self_only on public.profiles for select to authenticated using (id=current_setting('test.owner',true));
    grant select on public.profiles to authenticated,service_role;
    insert into public.profiles values
      ('self','member','Self','p1','TIQ-1',null,true),
      ('other','captain','Other','p2','TIQ-2',null,true),
      ('hidden','member','Hidden','p3','TIQ-3',null,false);
    create view public.internal_message_directory as select id,coalesce(role,'member') as role,display_name,linked_player_id,tiq_public_id,tiq_admin_id
      from public.profiles where tiq_public_id is not null and message_search_enabled=true;
    grant all on public.internal_message_directory to anon,authenticated,service_role;
  `)
  for (const [name, fields] of Object.entries(columns)) {
    if (name === 'internal_message_directory') continue
    await db.exec(`create table fixture.${name}(${fields.split(',').map(field => `${field} text`).join(',')});
      insert into fixture.${name} values(${fields.split(',').map(() => "'synthetic'").join(',')});
      grant select on fixture.${name} to service_role;
      create view public.${name} as select ${fields} from fixture.${name};
      grant all on public.${name} to service_role;
      ${['team_match_results','tennisrecord_annual_label_candidates'].includes(name) ? `alter view public.${name} set (security_invoker=true);` : ''}
      ${name === 'team_match_results' ? `grant select on fixture.${name} to anon,authenticated;` : ''}
      ${name === 'tennisrecord_annual_label_candidates' ? '' : `grant all on public.${name} to anon,authenticated;`}`)
  }
  // Column grants can survive a table-level REVOKE and must be removed too.
  await db.exec('grant select(id),update(linked_player_id) on internal_message_directory to public; grant select(staged_player_count) on tennisrecord_admin_coverage_summary to public')
  await role('anon')
  assert.equal((await db.query("update internal_message_directory set linked_player_id='unsafe' where id='other' returning id")).rows.length, 1, 'fixture reproduces legacy definer-view write access')
  await owner()
  await db.exec("update profiles set linked_player_id='p2' where id='other'")

  // A late schema mismatch must roll back earlier grants in the same migration.
  await db.exec('alter view tennisrecord_public_team_roster_counts rename column listed_player_count to unexpected_column')
  await assert.rejects(db.exec(migration), /Unexpected read-model columns/)
  await db.exec('rollback')
  assert.equal((await anonDirectory()).rows[0].ok, true)
  await db.exec('alter view tennisrecord_public_team_roster_counts rename column unexpected_column to listed_player_count')
  await db.exec("select set_config('test.catalog_ready','false',false)")
  await assert.rejects(db.exec(migration), /erasure catalog must be ready/)
  await db.exec('rollback')
  assert.equal((await anonDirectory()).rows[0].ok, true)
  await db.exec("select set_config('test.catalog_ready','true',false)")
  const definitions = (await db.query("select relname,pg_get_viewdef(oid,true) definition from pg_class where relnamespace='public'::regnamespace and relkind='v' order by relname")).rows
  await db.exec(migration)
  await db.exec(migration)
  assert.deepEqual((await db.query("select relname,pg_get_viewdef(oid,true) definition from pg_class where relnamespace='public'::regnamespace and relkind='v' order by relname")).rows, definitions)

  let reads = 0, blockedWrites = 0
  for (const caller of ['anon','authenticated','service_role']) {
    await role(caller)
    for (const name of Object.keys(columns)) {
      const readable = caller === 'service_role' || (!privateViews.has(name) && (caller !== 'anon' || name !== 'internal_message_directory'))
      if (readable) { assert.ok((await db.query(`select * from public.${name}`)).rows.length > 0); reads++ }
      else await denied(`select ${columns[name].split(',')[0]} from public.${name}`)
      if (caller !== 'service_role') {
        const field = columns[name].split(',')[0]
        await denied(`update public.${name} set ${field}=${field} where false`)
        await denied(`delete from public.${name} where false`)
        await denied(`insert into public.${name}(${field}) values('blocked')`)
        blockedWrites += 3
      }
    }
  }
  await role('authenticated')
  await db.exec("select set_config('test.owner','self',false)")
  assert.equal((await db.query('select id from profiles')).rows.length, 1, 'profile owner RLS remains in force')
  assert.equal((await db.query('select id from internal_message_directory order by id')).rows.length, 2, 'signed-in lookup still finds opted-in teammates across owner RLS')
  assert.equal((await db.query("select id from internal_message_directory where id='hidden'")).rows.length, 0)
  await owner()
  assert.equal((await db.query("select 'security_invoker=true'=any(reloptions) ok from pg_class where oid='tennisrecord_admin_coverage_summary'::regclass")).rows[0].ok, true)
  assert.equal((await db.query("select 'security_barrier=true'=any(reloptions) ok from pg_class where oid='internal_message_directory'::regclass")).rows[0].ok, true)
  assert.equal((await db.query("select count(*)::int n from pg_class where relnamespace='public'::regnamespace and relname like 'tennisrecord_public_%' and 'security_barrier=true'=any(reloptions)")).rows[0].n, 0, 'public read-model planning options remain unchanged')
  assert.equal((await db.query("select has_any_column_privilege('anon','internal_message_directory','SELECT,INSERT,UPDATE,REFERENCES') ok")).rows[0].ok, false)
  console.log(JSON.stringify({passed:true,views:9,roleReadChecks:reads,blockedWrites,repeatMigration:true,columnGrantLeakBlocked:true,profileRlsPreserved:true,optedInDirectoryPreserved:true,lateSchemaMismatchRollsBack:true,erasureGuardPreserved:true,viewDefinitionsUnchanged:true}))
} finally { await db.close() }
