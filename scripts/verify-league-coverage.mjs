// Disposable PostgreSQL only. No source HTTP or production credentials.
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.env.TIQ_PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table tennisrecord_campaigns(id uuid primary key default gen_random_uuid(),slug text unique);
    create table tennisrecord_crawl_queue(id uuid primary key default gen_random_uuid(),source_url text unique,page_kind text,status text,campaign_id uuid,refresh_season int,refresh_due_at timestamptz,deferred_retry_at timestamptz,completed_at timestamptz,failure_reason text,first_seen_at timestamptz default now());
    create table tennisrecord_source_pages(id uuid primary key default gen_random_uuid(),source_url text,captured_at timestamptz,blocked boolean,http_status int);
    create table tennisrecord_staged_team_memberships(source_url text);
    create table tennisrecord_staged_matches(source_url text,parse_status text,fingerprint text);
    create table tennisrecord_canonical_matches(fingerprint text primary key,canonical_match_id uuid);
    alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated;`)
  await db.exec(await readFile('supabase/migrations/20261022000200_weekly_league_coverage.sql','utf8'))
  await db.exec(await readFile('supabase/migrations/20261022000300_refresh_unposted_watched_scorecards.sql','utf8'))
  const year = new Date().getUTCFullYear()
  const league = `https://www.tennisrecord.com/adult/league.aspx?year=${year}&flightname=Men`
  const team = `https://www.tennisrecord.com/adult/teamprofile.aspx?year=${year}&teamname=Team`
  const card = `https://www.tennisrecord.com/adult/matchresults.aspx?year=${year}&mid=1`
  await db.query('insert into tennisrecord_league_watches(source_url,label,season_year) values($1,$2,$3)',[league,'League',year])
  await db.query("insert into tennisrecord_league_watch_pages(league_url,source_url,page_kind) values($1,$1,'league'),($1,$2,'team'),($1,$3,'match')",[league,team,card])
  await db.exec("insert into tennisrecord_campaigns(slug) values('us-2025-current')")
  // Missing roster, missing queue page, stale captures, unpublished results,
  // incomplete court detail and unpromoted identities remain distinct.
  await db.query("insert into tennisrecord_crawl_queue(source_url,page_kind,status,refresh_season,refresh_due_at) values($1,'team','pending',$3,now()),($2,'match','review',$3,now()-interval '20 days')",[team,card,year])
  assert.equal((await db.query('select source_url from next_tennisrecord_watched_page()')).rows[0].source_url,team)
  await db.query("update tennisrecord_crawl_queue set deferred_retry_at=now()+interval '1 day' where source_url=$1",[team])
  assert.equal((await db.query('select * from next_tennisrecord_watched_page()')).rows.length,0)
  await db.query("update tennisrecord_crawl_queue set deferred_retry_at=null where source_url=$1",[team])
  const capture = (await db.query('insert into tennisrecord_source_pages(source_url,captured_at,blocked,http_status) values($1,now(),false,200) returning id',[team])).rows[0].id
  await assert.rejects(db.query('select record_tennisrecord_watch_capture($1,$2,2,false,\'[]\')',[card,capture]),/retained capture/)
  await db.query('select record_tennisrecord_watch_capture($1,$2,2,false,$3)',[team,capture,JSON.stringify([{url:card,kind:'match'},{url:card.replace(String(year),String(year-1)),kind:'match'},{url:'https://evil.example/',kind:'team'}])])
  assert.equal((await db.query('select count(*)::int n from tennisrecord_league_watch_pages')).rows[0].n,3)
  assert.equal((await db.query('select status from tennisrecord_crawl_queue where source_url=$1',[card])).rows[0].status,'review')
  assert.equal((await db.query('select status from tennisrecord_crawl_queue where source_url=$1',[league])).rows[0].status,'pending')
  await db.query('delete from tennisrecord_crawl_queue where source_url=$1',[league])
  await db.query("update tennisrecord_league_watch_pages set expected_count=5,results_pending=true where source_url=$1",[card])
  await db.query("insert into tennisrecord_staged_matches values($1,'valid','court')",[card])
  assert.equal((await db.query('select check_tennisrecord_league_coverage() n')).rows[0].n,1)
  const report = (await db.query('select report from tennisrecord_league_watches')).rows[0].report
  assert.equal(report.knownTeams,1); assert.equal(report.missingPages,1)
  assert.equal(report.missingRosters,1); assert.equal(report.heldPages,1)
  assert.equal(report.incompleteScorecards,1); assert.equal(report.unpostedResults,1)
  assert.equal(report.unpromotedCourts,1); assert.equal(report.directoryVerified,false)
  assert.equal(report.mappingVerified,false)
  assert.equal((await db.query('select check_tennisrecord_league_coverage() n')).rows[0].n,0)
  const cardCapture = (await db.query('insert into tennisrecord_source_pages(source_url,captured_at,blocked,http_status) values($1,now(),false,200) returning id',[card])).rows[0].id
  await db.query('select record_tennisrecord_watch_capture($1,$2,null,true,\'[]\')',[card,cardCapture])
  await db.query("update tennisrecord_crawl_queue set failure_reason='Identity conflict' where source_url=$1",[card])
  assert.equal((await db.query('select release_tennisrecord_unposted_scorecard($1,$2) n',[card,cardCapture])).rows[0].n,0)
  await db.query("update tennisrecord_crawl_queue set failure_reason='No complete TennisRecord court results were parsed; page evidence was retained for review.' where source_url=$1",[card])
  assert.equal((await db.query('select release_tennisrecord_unposted_scorecard($1,$2) n',[card,cardCapture])).rows[0].n,1)
  assert.equal((await db.query('select status from tennisrecord_crawl_queue where source_url=$1',[card])).rows[0].status,'done')
  assert.equal((await db.query('select refresh_due_at>now() later from tennisrecord_crawl_queue where source_url=$1',[card])).rows[0].later,true)
  await db.exec('set role anon')
  await assert.rejects(db.query('select * from tennisrecord_league_watches'),/permission denied/)
  await assert.rejects(db.query('select check_tennisrecord_league_coverage()'),/permission denied/)
  await assert.rejects(db.query('select next_tennisrecord_watched_page()'),/permission denied/)
  await assert.rejects(db.query('select release_tennisrecord_unposted_scorecard(null,null)'),/permission denied/)
  await db.exec('reset role')
  console.log('PASS: exact-source priority, deferred retries and review holds, capture binding, safe discovery, weekly idempotency, incomplete data and private grants.')
} finally { await db.close() }
