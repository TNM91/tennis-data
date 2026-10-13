import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const { PGlite } = await import(process.env.TIQ_PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
const captain = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table auth.users(id uuid primary key);
    create table public.profiles(id uuid primary key, role text);
    create table public.internal_conversations(id uuid primary key);
    create table public.internal_conversation_participants(conversation_id uuid, profile_id uuid);
    insert into auth.users values ('${captain}'), ('${other}');
    insert into profiles values ('${captain}', 'captain'), ('${other}', 'captain');
    insert into internal_conversations values ('${captain}');
  `)
  for (const file of ['20260507223000_create_internal_schedule_events.sql', '20260909000100_create_captain_practice_invites.sql', '20260914000100_add_practice_captain_confirmations.sql', '20261013000100_advance_captain_practices.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
  }
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [captain])
  const seed = async (days, repeat = 'weekly', status = 'proposed', owner = captain) => {
    const { rows: [event] } = await db.query(`insert into internal_schedule_events(conversation_id,scheduled_date,recurrence_rule,status,created_by_user_id,metadata)
      values($1,(now() at time zone 'America/Chicago')::date - $2::int,$3,$4,$5,'{"practiceEndTime":"22:00","practiceNotes":"Returns"}') returning id`, [captain, days, repeat, status, owner])
    const { rows: [invite] } = await db.query('insert into captain_practice_invites(event_id,created_by_user_id,capacity) values($1,$2,8) returning id,public_token', [event.id, owner])
    await db.query(`insert into captain_practice_invitees(invite_id,event_id,player_id,profile_id,player_name,normalized_name,response_status,note,captain_confirmed_at)
      values($1,$2,'player',$3,'Player','player','in','old reply',now())`, [invite.id, event.id, owner])
    await db.query("insert into internal_schedule_event_responses(event_id,profile_id,response_status,note) values($1,$2,'in','old reply')", [event.id, owner])
    return { ...event, ...{ inviteId: invite.id, publicToken: invite.public_token } }
  }
  const weekly = await seed(6)
  const biweekly = await seed(8, 'biweekly')
  const missed = await seed(40)
  await seed(6, '', 'proposed')
  await seed(6, 'weekly', 'cancelled')
  await seed(6, 'weekly', 'proposed', other)
  await db.exec('select advance_captain_practices(); select advance_captain_practices();')
  const { rows } = await db.query(`select e.*, (scheduled_date - (now() at time zone 'America/Chicago')::date)::int days,
    i.public_token, i.capacity, p.response_status, p.note, p.captain_confirmed_at
    from internal_schedule_events e join captain_practice_invites i on i.event_id=e.id
    join captain_practice_invitees p on p.event_id=e.id where e.metadata ? 'previousPracticeId'`)
  assert.equal(rows.length, 3, 'only own active repeating practices advance, once')
  for (const [source, days] of [[weekly, 1], [biweekly, 6], [missed, 2]]) {
    const next = rows.find(row => row.metadata.previousPracticeId === source.id)
    assert.equal(next.days, days)
    assert.notEqual(next.public_token, source.publicToken)
    assert.equal(next.metadata.publicToken, next.public_token)
    assert.equal(next.metadata.practiceEndTime, '22:00')
    assert.equal(next.metadata.practiceNotes, 'Returns')
    assert.equal(next.capacity, 8)
    assert.equal(next.response_status, 'unanswered')
    assert.equal(next.note, '')
    assert.equal(next.captain_confirmed_at, null)
  }
  const { rows: [past] } = await db.query('select response_status,note,captain_confirmed_at from captain_practice_invitees where event_id=$1', [weekly.id])
  assert.equal(past.response_status, 'in'); assert.equal(past.note, 'old reply'); assert.ok(past.captain_confirmed_at)
  assert.equal((await db.query("select count(*)::int n from internal_schedule_event_responses where response_status='unanswered'")).rows[0].n, 3)
  assert.equal((await db.query("select has_function_privilege('anon','advance_captain_practices()','execute') ok")).rows[0].ok, false)
  await db.query("select set_config('request.jwt.claim.sub', '', false)")
  await assert.rejects(db.exec('select advance_captain_practices()'), /Sign in/)
  console.log('PASS: PostgreSQL recurrence migration; weekly/biweekly dates, missed weeks, idempotence, captain scope, cancelled/one-time exclusions, fresh replies, preserved history and anonymous access.')
} finally { await db.close() }
