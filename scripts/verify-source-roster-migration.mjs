// Disposable PostgreSQL only; never loads .env or production credentials.
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.env.TIQ_PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
const sql = async name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table tennisrecord_staged_players(id uuid primary key default gen_random_uuid(), source_player_key text unique);
    create table tennisrecord_player_identities(staged_player_id uuid,canonical_player_id uuid,status text);
    create table tennisrecord_staged_matches(source_match_key text,home_team text,away_team text,played_on date,
      league_name text,flight text,discipline text,court_number integer,score_text text,winner_side text,source_url text,
      fingerprint text,parse_status text,first_seen_at timestamptz,last_seen_at timestamptz);
    create table tennisrecord_canonical_matches(fingerprint text,canonical_match_id uuid);
  `)
  await db.exec(await sql('20260821000500_add_tennisrecord_public_team_history.sql'))
  await db.exec(await sql('20260822000500_add_tennisrecord_public_team_roster_counts.sql'))
  await db.exec(`insert into tennisrecord_staged_players(source_player_key) values ('player');
    insert into tennisrecord_staged_team_memberships(team_name,normalized_team_name,source_player_key,player_name,source_url)
      values ('Example','example','player','Prior season','https://www.tennisrecord.com/adult/teamprofile.aspx?teamname=Example&year=2026');`)
  const migration = await sql('20261021000100_scope_source_rosters.sql')
  await db.exec(migration)
  await db.exec(migration)
  const currentUrl = 'https://www.tennisrecord.com/adult/teamprofile.aspx?teamname=Example&year=2027'
  const save = () => db.query(`insert into tennisrecord_staged_team_memberships
    (team_name,normalized_team_name,source_player_key,player_name,source_url,raw)
    values ('Example','example','player','Current season',$1,$2)
    on conflict(normalized_team_name,source_player_key,source_url) do update set player_name=excluded.player_name,raw=excluded.raw`,
    [currentUrl, JSON.stringify({ leagueName: '2027 Adult Fall', flight: 'Men 4.5 (F)' })])
  await save(); await save()
  const { rows } = await db.query('select player_name,season_year,league_name,flight from tennisrecord_public_team_roster_context order by season_year')
  assert.deepEqual(rows, [
    { player_name: 'Prior season', season_year: 2026, league_name: null, flight: null },
    { player_name: 'Current season', season_year: 2027, league_name: '2027 Adult Fall', flight: 'Men 4.5 (F)' },
  ])
  await db.exec(`insert into tennisrecord_staged_team_memberships(team_name,normalized_team_name,source_player_key,player_name,source_url)
    values ('Example','example','player','Unknown season','https://www.tennisrecord.com/adult/teamprofile.aspx?teamname=Example');`)
  const counts = await db.query('select season_year,listed_player_count from tennisrecord_public_team_roster_counts order by season_year nulls last')
  assert.deepEqual(counts.rows, [{season_year:2026,listed_player_count:1},{season_year:2027,listed_player_count:1},{season_year:null,listed_player_count:1}])
  await db.exec('set role anon')
  assert.equal((await db.query('select * from tennisrecord_public_team_roster_context where season_year=2027')).rows.length, 1)
  await assert.rejects(db.query('select * from tennisrecord_staged_team_memberships'), /permission denied/)
  await db.exec('reset role')
  const grants = await db.query(`select has_table_privilege('service_role','tennisrecord_staged_team_memberships','SELECT,INSERT,UPDATE') as service,
    has_table_privilege('authenticated','tennisrecord_public_team_roster_counts','SELECT') as member,
    has_table_privilege('anon','tennisrecord_staged_team_memberships','INSERT') as public_write`)
  assert.deepEqual(grants.rows, [{service:true,member:true,public_write:false}])
  assert.equal((await db.query('select * from tennisrecord_staged_matches')).rows.length,0)
  console.log('PASS: roster migration; retained prior seasons, idempotent captures, exact scope, isolated counts, read-only public views and explicit service grants.')
} finally { await db.close() }
