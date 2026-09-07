// Isolated in-memory PostgreSQL check; never connects to Supabase/production.
// npm install --prefix artifacts/season-kickoff-test-runtime --no-save --package-lock=false --ignore-scripts @electric-sql/pglite
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { PGlite } from '../artifacts/season-kickoff-test-runtime/node_modules/@electric-sql/pglite/dist/index.js'

const db = new PGlite()
const captain = '11111111-1111-4111-8111-111111111111'
const player = '22222222-2222-4222-8222-222222222222'
const matchA = '33333333-3333-4333-8333-333333333333'
const matchB = '44444444-4444-4444-8444-444444444444'
const foreignMatch = '55555555-5555-4555-8555-555555555555'
const token = '66666666-6666-4666-8666-666666666666'
let checks = 0
const check = (condition) => { assert.ok(condition); checks++ }
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key); create table public.players(id uuid primary key);
    create table public.lineup_availability(id uuid primary key);
    create table public.matches(id uuid primary key,home_team text,away_team text,league_name text,flight text,line_number text,match_type text,status text,match_date date,match_time text);
    grant usage on schema public to service_role,anon,authenticated; grant select,update on public.matches to service_role;
    insert into auth.users values('${captain}'); insert into public.players values('${player}');
    insert into public.matches values('${matchA}','Aces','Volleys','2099 Fall','4.0',null,null,null,'2099-09-14','18:00:00'),
    ('${matchB}','Aces','Smash','2099 Fall','4.0',null,null,null,'2099-09-14','20:00:00'),
    ('${foreignMatch}','Other','Smash','2099 Fall','4.0',null,null,null,'2099-09-14','18:00:00');`)
  await db.exec(await readFile(new URL('../supabase/migrations/20260907200000_season_kickoff.sql', import.meta.url), 'utf8'))
  check(true)
  await db.query(`insert into season_availability_invites(created_by,team_name,league_name,flight,season_key,roster_key,player_id,player_name,response_token,match_ids)
    values($1,'Aces','2099 Fall','4.0','season','player',$2,'Jordan',$3,$4)`, [captain, player, token, [matchA, matchB]])
  const answer = (id, status = 'available', date = '2099-09-14', time = '18:00:00') => ({ matchId: id, status, matchDate: date, matchTime: time })
  const save = responses => db.query('select save_season_availability($1,$2::jsonb) as saved', [token, JSON.stringify(responses)])
  const rows = async () => (await db.query('select * from season_availability_responses order by match_id')).rows
  const originalMatches = (await db.query('select * from matches order by id')).rows
  const calendarToken = (await db.query('select calendar_token from season_availability_invites')).rows[0].calendar_token
  check(calendarToken !== token)
  await assert.rejects(db.query('select save_season_availability($1,$2::jsonb)', [calendarToken, JSON.stringify([answer(matchA)])])); checks++
  await db.exec('set role service_role')
  check((await save([answer(matchA)])).rows[0].saved === 1)
  check((await rows()).length === 1)
  check((await save([answer(matchA)])).rows[0].saved === 1)
  check((await rows()).length === 1)
  await save([answer(matchB, 'unavailable', '2099-09-14', '20:00:00')])
  check((await rows()).map(row => row.status).join(',') === 'available,unavailable')
  for (const answers of [[], [answer(foreignMatch)], [answer(matchA, 'confirmed')], [answer(matchA, 'available', '2099-09-15')], [answer(matchA, 'available', '2099-09-14', '19:00:00')]]) {
    await assert.rejects(save(answers)); checks++
  }
  // First change is rolled back when a later answer fails in the same save.
  await assert.rejects(save([answer(matchA, 'maybe'), answer(foreignMatch)])); checks++
  check((await rows())[0].status === 'available')
  await db.exec('reset role')
  check(JSON.stringify((await db.query('select * from matches order by id')).rows) === JSON.stringify(originalMatches))
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    await assert.rejects(db.query('select response_token from season_availability_invites')); checks++
    await assert.rejects(save([answer(matchA)])); checks++
    await db.exec('reset role')
  }
  await db.query('update season_availability_invites set revoked_at=now() where response_token=$1', [token])
  await db.exec('set role service_role')
  await assert.rejects(save([answer(matchA)])); checks++
  console.log(JSON.stringify({ ok: true, checks, database: 'isolated in-memory PostgreSQL', productionWrites: 0 }))
} catch (error) { console.error(JSON.stringify({ ok: false, checks, message: error.message, code: error.code })); process.exitCode = 1 }
finally { await db.close() }
