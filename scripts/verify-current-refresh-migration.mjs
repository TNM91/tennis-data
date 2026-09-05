// Disposable local PostgreSQL only. Never loads .env or contacts production.
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.env.TIQ_PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table tennisrecord_collector_settings(id boolean primary key, enabled boolean);
    insert into tennisrecord_collector_settings values(true,true);
    create table tennisrecord_sync_runs(id uuid primary key default gen_random_uuid(),status text default 'running',trigger_kind text);
    create unique index tennisrecord_sync_runs_one_active_idx on tennisrecord_sync_runs((true)) where status='running';
    create table tennisrecord_crawl_queue(id uuid primary key default gen_random_uuid(),source_url text unique,status text,first_seen_at timestamptz default now(),completed_at timestamptz,deferred_retry_at timestamptz);
    create table tennisrecord_staged_teams(source_url text,season_year integer,league_name text);
    create table tennisrecord_staged_leagues(source_url text,season_year integer,name text);
    create table tennisrecord_staged_matches(source_url text,played_on date,league_name text);
  `)
  await db.exec(await readFile(new URL('../supabase/migrations/20260905000100_independent_current_season_refresh.sql', import.meta.url), 'utf8'))
  const { rows: [run] } = await db.query("insert into tennisrecord_sync_runs(trigger_kind) values('weekly') returning id")
  const prepare = seed => db.query('select prepare_tennisrecord_current_refresh($1,$2) as released', [run.id, seed])
  assert.equal((await prepare(false)).rows[0].released, 0, 'disabled by default')
  await db.exec(`
    update tennisrecord_collector_settings set current_refresh_enabled=true;
    insert into tennisrecord_crawl_queue(source_url,status,completed_at,refresh_season,refresh_due_at)
      select 'due-'||n,'done',now()-interval '8 days',extract(year from now()),now()-interval '1 day' from generate_series(1,250)n;
    insert into tennisrecord_crawl_queue(source_url,status,refresh_season,refresh_due_at) values
      ('review','review',extract(year from now()),now()-interval '1 day'),
      ('blocked','blocked',extract(year from now()),now()-interval '1 day'),
      ('error','error',extract(year from now()),now()-interval '1 day'),
      ('fresh','done',extract(year from now()),now()+interval '6 days'),
      ('old-season','done',extract(year from now())-1,now()-interval '1 day');
    insert into tennisrecord_crawl_queue(source_url,status,completed_at,refresh_season,refresh_due_at)
      values('recent-backfill','done',now()-interval '1 hour',extract(year from now()),now()-interval '1 day');
  `)
  assert.equal((await prepare(false)).rows[0].released, 100)
  assert.equal((await prepare(false)).rows[0].released, 100)
  assert.equal((await prepare(false)).rows[0].released, 50)
  assert.equal((await prepare(false)).rows[0].released, 0)
  assert.equal((await db.query("select count(*)::int n from tennisrecord_crawl_queue where status='pending'")).rows[0].n, 250)
  await db.exec(`
    insert into tennisrecord_crawl_queue(source_url,status,completed_at) values('mo','done',now()-interval '8 days'),('tx','done',now()-interval '8 days'),('section-only','done',now()-interval '8 days');
    insert into tennisrecord_staged_teams values('mo',extract(year from now()),'2026 Adult Missouri Valley Missouri St. Louis'),('tx',extract(year from now()),'2026 Texas Dallas'),('section-only',extract(year from now()),'Missouri Valley');
    insert into tennisrecord_staged_matches select 'match-'||n,current_date,'Adult Missouri Valley Missouri St. Louis' from generate_series(1,151)n;
    insert into tennisrecord_crawl_queue(source_url,status,completed_at) select source_url,'done',now()-interval '8 days' from tennisrecord_staged_matches;
  `)
  assert.equal((await prepare(true)).rows[0].released, 100)
  assert.equal((await prepare(false)).rows[0].released, 52, 'all 151 courts plus MO team, not first 100 source rows')
  assert.equal((await db.query("select count(*)::int n from tennisrecord_crawl_queue where source_url in('tx','section-only') and refresh_season is not null")).rows[0].n, 0)
  assert.equal((await db.query("select has_function_privilege('anon','prepare_tennisrecord_current_refresh(uuid,boolean)','execute') ok")).rows[0].ok, false)
  await assert.rejects(db.query("insert into tennisrecord_sync_runs(trigger_kind) values('ratings')"), /duplicate key/)
  await db.query("update tennisrecord_sync_runs set status='completed' where id=$1", [run.id])
  await assert.rejects(prepare(false), /active weekly checkpoint/)
  await db.query("insert into tennisrecord_sync_runs(trigger_kind) values('ratings')")
  await assert.rejects(db.query("insert into tennisrecord_sync_runs(trigger_kind) values('bootstrap')"), /duplicate key/)
  console.log('PASS: SQL migration, bounded/resumable refresh, >100-court coverage, regional scope, holds, permissions and shared job lock.')
} finally { await db.close() }
