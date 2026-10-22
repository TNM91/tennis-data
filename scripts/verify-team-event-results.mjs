// Disposable PostgreSQL; no environment file or production credentials loaded.
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.env.TIQ_PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table tennisrecord_source_pages(id uuid primary key default gen_random_uuid(),source_url text,captured_at timestamptz,blocked boolean default false,http_status int default 200);
    create table matches(id uuid primary key default gen_random_uuid(),external_match_id text,home_team text,away_team text,
      match_date date,match_time text,facility text,status text,match_type text,winner_side text,score text,flight text,
      league_name text,usta_section text,district_area text,line_number text,source text);
    alter table matches enable row level security;
    create policy public_read on matches for select to anon,authenticated using(source <> 'private');
    grant select on matches to anon,authenticated,service_role;
    alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated;
  `)
  await db.exec(await readFile(new URL('../supabase/migrations/20261022000100_team_event_results.sql', import.meta.url), 'utf8'))
  const save = async (mid, overrides = {}, captured = '2026-10-21T12:00:00Z') => {
    const sourceUrl = `https://www.tennisrecord.com/adult/matchresults.aspx?year=2027&mid=${mid}`
    const event = {sourceEventId:`tennisrecord:2027:${mid}`,sourceUrl,seasonYear:2027,playedOn:'2026-09-20',
      leagueName:'2027 Adult Fall',flight:'4.0',homeTeam:'Home (F)',awayTeam:'Away (F)',homeCourts:3,awayCourts:2,...overrides}
    const capture = (await db.query('insert into tennisrecord_source_pages(source_url,captured_at) values($1,$2) returning id',[sourceUrl,captured])).rows[0].id
    await db.query('select save_tennisrecord_team_event($1,$2)',[JSON.stringify(event),capture])
    return event
  }
  await save(1)
  const stableId = (await db.query('select id from tennisrecord_team_events')).rows[0].id
  await save(1)
  assert.equal((await db.query('select id from tennisrecord_team_events')).rows[0].id,stableId)
  await save(1,{homeCourts:1,awayCourts:4},'2026-10-20T12:00:00Z')
  assert.equal((await db.query('select home_courts from tennisrecord_team_events')).rows[0].home_courts,3)
  await save(1,{homeCourts:1,awayCourts:4},'2026-10-22T12:00:00Z')
  assert.deepEqual((await db.query('select score,winner_side from team_match_results')).rows,[{score:'1-4',winner_side:'B'}])
  await assert.rejects(save(1,{awayTeam:'Different'},'2026-10-23T12:00:00Z'),/identity changed/)
  await assert.rejects(save(2,{sourceEventId:'tennisrecord:2027:3'}),/locator does not match/)
  // Two source events on one date remain two events, even with identical teams.
  await save(2)
  assert.equal((await db.query('select * from team_match_results')).rows.length,2)
  // Court parents and rating detail rows never contribute team wins/losses.
  await db.exec(`insert into matches(home_team,away_team,match_date,source,line_number,winner_side)
    select 'Home (F)','Away (F)','2026-09-20','tennisrecord',null,'A' from generate_series(1,5);
    insert into matches(home_team,away_team,match_date,source,line_number,winner_side) values('Home (F)','Away (F)','2026-09-20','tennisrecord','1','A');`)
  assert.equal((await db.query('select * from team_match_results')).rows.length,2)
  // A local overlap suppresses source totals without changing or merging them.
  await db.exec(`insert into matches(home_team,away_team,match_date,source,winner_side,score)
    values('Renamed opponent','Home (F)','2026-09-20','captain_upload','B','2-3');`)
  assert.equal((await db.query('select * from team_match_results')).rows.length,1)
  assert.equal((await db.query('select * from tennisrecord_team_events')).rows.length,2)
  // Unplayed local schedules cannot suppress a published team result.
  await save(4,{playedOn:'2026-09-27'})
  await db.exec(`insert into matches(home_team,away_team,match_date,source) values('Home (F)','Away (F)','2026-09-27','schedule');
    insert into matches(home_team,away_team,match_date,source,winner_side) values('Private','Other','2026-09-20','private','A');
    set role anon;`)
  assert.equal((await db.query('select * from team_match_results where source=\'tennisrecord\'')).rows.length,1)
  assert.equal((await db.query('select * from team_match_results where source=\'private\'')).rows.length,0)
  await assert.rejects(db.query('select * from tennisrecord_team_events'),/permission denied/)
  await assert.rejects(db.query('select save_tennisrecord_team_event(null,null)'),/permission denied/)
  await assert.rejects(db.query("insert into tennisrecord_public_team_events(id) values(gen_random_uuid())"),/permission denied/)
  await db.exec('reset role')
  assert.equal((await db.query('select count(*)::int as n from matches')).rows[0].n,9)
  console.log('PASS: event totals, source identity, stable IDs, stale capture protection, court exclusion, overlap holds, schedule handling and public RLS/grants.')
} finally { await db.close() }
