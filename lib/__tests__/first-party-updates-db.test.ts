import { PGlite } from '@electric-sql/pglite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { practiceReminderHref } from '../native-practice-reminder-contract'

const owner = '11111111-1111-4111-8111-111111111111'
const coach = '22222222-2222-4222-8222-222222222222'
const outsider = '33333333-3333-4333-8333-333333333333'
const student = '44444444-4444-4444-8444-444444444444'
const support = '55555555-5555-4555-8555-555555555555'
const unrelated = '66666666-6666-4666-8666-666666666666'
const digest = createHash('sha256').update('tenaceiq:coach-direct:v1:' + student).digest('hex')
const thread = digest.slice(0,8)+'-'+digest.slice(8,12)+'-5'+digest.slice(13,16)+'-a'+digest.slice(17,20)+'-'+digest.slice(20,32)
const notice = (id: number) => 'aaaaaaaa-aaaa-4aaa-8aaa-' + String(id).padStart(12, '0')
const db = new PGlite()

beforeAll(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema private;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    create table internal_notifications(id uuid primary key default gen_random_uuid(), recipient_profile_id uuid, actor_user_id uuid, notification_type text,
      title text, body text, href text, conversation_id uuid, schedule_event_id uuid, read_at timestamptz, created_at timestamptz default now());
    create table internal_conversations(id uuid primary key, conversation_type text, status text, related_entity_type text,
      related_entity_id text, created_by_user_id uuid, assigned_admin_user_id uuid);
    create table internal_conversation_participants(conversation_id uuid, profile_id uuid, participant_role text, muted boolean default false);
    create table internal_messages(conversation_id uuid, sender_user_id uuid, message_kind text, deleted_at timestamptz, created_at timestamptz);
    create table coach_player_links(id text primary key, coach_user_id uuid, player_user_id uuid, status text);
    create table level_up_weekly_plans(id text primary key, student_link_id text, player_user_id uuid, coach_user_id uuid,
      shared_with_coach boolean, plan_json jsonb);
    create table native_private_teams(room_id uuid primary key, team_name text, flight text);
    create table internal_schedule_events(id uuid primary key, created_by_user_id uuid, event_type text,
      metadata jsonb, status text, scheduled_date date, updated_at timestamptz);
    create table captain_practice_invites(id uuid primary key, event_id uuid, created_by_user_id uuid);
    create table captain_practice_invitees(id uuid primary key, event_id uuid, invite_id uuid, profile_id uuid,
      player_name text, response_status text);
    create table team_profile_links(profile_user_id uuid, team_name text, league_name text, flight text, source_type text,
      status text, archived_at timestamptz, team_role text, team_roles text[]);
    create table team_room_member_removals(conversation_id uuid, profile_id uuid);
    create table team_chat_blocks(owner_user_id uuid, blocked_user_id uuid);
    create table internal_notification_preferences(profile_id uuid primary key, schedule_alerts_enabled boolean);
    grant select on all tables in schema public to authenticated;
    grant update on internal_notifications to authenticated;
    grant select, update on all tables in schema public to service_role;
    grant insert on internal_notifications to service_role;
    grant usage on schema private to authenticated,service_role;
    alter table internal_notifications enable row level security;
    create policy owner_notices on internal_notifications to authenticated using (recipient_profile_id = auth.uid());
  `)
  await db.exec(readFileSync('supabase/migrations/20261110000100_native_first_party_updates.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/20261112000700_native_practice_reminders.sql', 'utf8'))
}, 30000)
afterAll(async () => db.close())

beforeEach(async () => {
  await db.exec(`reset role; truncate internal_notifications, internal_conversations, internal_conversation_participants,
    internal_messages, coach_player_links, level_up_weekly_plans, native_practice_reminders, internal_schedule_events,
    native_private_teams, captain_practice_invites, captain_practice_invitees, team_profile_links, team_room_member_removals,
    team_chat_blocks, internal_notification_preferences;
    insert into coach_player_links values ('${student}', '${coach}', '${owner}', 'active');
    insert into level_up_weekly_plans values ('reviewed-week', '${student}', '${owner}', '${coach}', true,
      '{"coachResponse":{"coachUserId":"${coach}","action":"adjusted","note":"Raw coach note"}}');
    insert into internal_conversations values
      ('${thread}', 'direct', 'open', 'coach_student', '${student}', '${coach}', null),
      ('${support}', 'support', 'closed', 'account', '', '${owner}', '${coach}'),
      ('${unrelated}', 'league', 'open', 'team_room', '', '${owner}', null);
    insert into internal_conversation_participants(conversation_id,profile_id,participant_role) values ('${thread}', '${owner}', 'member'), ('${thread}', '${coach}', 'member'),
      ('${support}', '${owner}', 'member'), ('${support}', '${coach}', 'support'), ('${unrelated}', '${owner}', 'member');
    insert into internal_messages values ('${thread}', '${coach}', 'message', null, '2026-11-08'),
      ('${support}', '${coach}', 'message', null, '2026-11-08'), ('${unrelated}', '${coach}', 'message', null, '2026-11-08');
    insert into internal_notifications values
      ('${notice(1)}', '${owner}', '${coach}', 'message', 'Raw coach title', 'Raw coach body', '/messages?thread=${thread}', '${thread}', null, null, '2026-11-09'),
      ('${notice(2)}', '${owner}', '${coach}', 'message', 'Raw plan title', 'Raw plan body', '/level-up/my-quest?coachUpdate=reviewed-week#level-up-coach-update', null, null, null, '2026-11-09'),
      ('${notice(3)}', '${owner}', '${coach}', 'support', 'Raw support title', 'Raw support body', '/messages?thread=${support}', '${support}', null, null, '2026-11-09'),
      ('${notice(4)}', '${owner}', '${coach}', 'system', 'Imported fixture', 'Imported opponent', '/team-connections?source=import', null, null, null, '2026-11-09'),
      ('${notice(5)}', '${owner}', '${outsider}', 'message', 'Forged coach update', '', '/messages?thread=${thread}', '${thread}', null, null, '2026-11-09'),
      ('${notice(6)}', '${outsider}', '${coach}', 'message', 'Foreign coach update', '', '/messages?thread=${thread}', '${thread}', null, null, '2026-11-09'),
      ('${notice(7)}', '${owner}', '${coach}', 'message', 'Mixed room update', '', '/messages?thread=${unrelated}', '${unrelated}', null, null, '2026-11-09'),
      ('${notice(8)}', '${owner}', '${coach}', 'message', 'Mismatched destination', '', '/messages?thread=${thread}', '${unrelated}', null, null, '2026-11-09');
    set role authenticated; select set_config('request.jwt.claim.sub', '${owner}', false);`)
})

it('rechecks the previewed practice roster, saves one send, and only shows the verified recipient their reminder',async()=>{
  const room=notice(20), event=notice(21), invite=notice(22), revision='2026-11-12T17:00:00Z'
  const scope={teamName:'Aces & Friends',leagueName:'Private team '+room,flight:'4.5'}
  const requestId=notice(23),href=practiceReminderHref(scope,event,requestId)
  const recipients=[owner,outsider,student,support]
  await db.exec('reset role')
  await db.query("insert into internal_conversations values ($1,'league','open','team_room','',$2,null)",[room,coach])
  await db.query('insert into native_private_teams values ($1,$2,$3)',[room,scope.teamName,scope.flight])
  await db.query(`insert into internal_schedule_events values ($1,$2,'captain_practice',$3,'confirmed',current_date+1,$4)`,
    [event,coach,JSON.stringify(scope),revision])
  await db.query('insert into captain_practice_invites values ($1,$2,$3)',[invite,event,coach])
  for(const member of [coach,...recipients]){
    await db.query('insert into internal_conversation_participants values ($1,$2,$3,$4)',
      [room,member,'member',member===support])
    await db.query(`insert into team_profile_links values ($1,$2,$3,$4,'manual_invite','accepted',null,$5,null)`,
      [member,scope.teamName,scope.leagueName,scope.flight,member===coach?'captain':'player'])
  }
  for(const [index,member] of recipients.entries()){
    await db.query(`insert into captain_practice_invitees values ($1,$2,$3,$4,$5,'unanswered')`,
      [notice(30+index),event,invite,member,'Player '+index])
  }
  await db.query('insert into team_chat_blocks values ($1,$2)',[student,coach])
  const args=[coach,room,event,scope.teamName,scope.flight]
  const preview=()=>db.query<{result:unknown}>('select native_private_practice_reminder($1,$2,$3,$4,$5) result',args)
  const send=(id=requestId,stamp=revision)=>db.query<{result:unknown}>(
    'select native_private_practice_reminder($1,$2,$3,$4,$5,$6,$7,$8,$9) result',
    [...args,id,stamp,[notice(30),notice(31)],practiceReminderHref(scope,event,id)])
  await db.exec('set role service_role')
  expect((await preview()).rows[0].result).toMatchObject({status:200,alreadySent:false,
    recipients:[{id:notice(30),name:'Player 0'},{id:notice(31),name:'Player 1'}]})
  expect((await send(requestId,'2026-11-12T16:00:00Z')).rows[0].result).toEqual({status:409})
  await db.query("update captain_practice_invitees set response_status='in' where profile_id=$1",[outsider])
  expect((await send()).rows[0].result).toEqual({status:200,count:1})
  expect((await send()).rows[0].result).toEqual({status:200,count:1})
  expect((await send(notice(24))).rows[0].result).toEqual({status:409})
  expect((await db.query('select recipient_profile_id from internal_notifications where schedule_event_id=$1',[event])).rows)
    .toEqual([{recipient_profile_id:owner}])
  await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false)`)
  await expect(preview()).rejects.toMatchObject({code:'42501'})
  const reminders=()=>db.query<{id:string;href:string}>(
    "select id,href from native_first_party_updates where notification_type='schedule'")
  const rows=(await reminders()).rows
  expect(rows).toEqual([{id:expect.any(String),href}])
  const mark=()=>db.query('select * from native_first_party_mark_updates_read($1::uuid[])',[[rows[0].id]])
  expect((await mark()).rows).toHaveLength(1)
  await db.exec(`select set_config('request.jwt.claim.sub','${outsider}',false)`)
  expect((await reminders()).rows).toEqual([])
  await db.exec(`reset role; insert into team_room_member_removals values ('${room}','${owner}');
    set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false)`)
  expect((await reminders()).rows).toEqual([])
  await expect(mark()).rejects.toMatchObject({code:'P0001'})
})

it('projects only owned, verified sources and never returns the saved notice copy', async () => {
  const visible = await db.query('select id, title, body, href, notification_type from native_first_party_updates order by id')
  expect(visible.rows).toEqual([
    { id: notice(1), title: 'Coach conversation', body: 'Open Coach messages to catch up.', href: '/messages?coach='+student, notification_type: 'message' },
    { id: notice(2), title: 'Your coach updated your weekly plan', body: 'Review the guidance and plan your next rep.', href: '/level-up/my-quest?coachUpdate=reviewed-week#level-up-coach-update', notification_type: 'message' },
    { id: notice(3), title: 'TenAceIQ support update', body: 'There’s an update on your support request.', href: '', notification_type: 'support' },
  ])
  await db.exec(`select set_config('request.jwt.claim.sub', '${outsider}', false);`)
  expect((await db.query('select id from native_first_party_updates')).rows).toEqual([])
})

it('requires the current relationship for both reading and marking an update read', async () => {
  await db.exec('reset role; update coach_player_links set status = \'paused\'; set role authenticated;')
  expect((await db.query('select id from native_first_party_updates')).rows).toEqual([{ id: notice(3) }])
  await expect(db.query('select * from native_first_party_mark_updates_read($1::uuid[])', [[notice(1), notice(3)]])).rejects.toMatchObject({ code: 'P0001' })
  expect((await db.query('select read_at from internal_notifications where id = $1', [notice(3)])).rows).toEqual([{ read_at: null }])
})

it('rejects an entire mixed batch and returns stable receipts for successful retries', async () => {
  const mark = (ids: string[]) => db.query('select * from native_first_party_mark_updates_read($1::uuid[]) order by id', [ids])
  await expect(mark([notice(1), notice(4)])).rejects.toMatchObject({ code: 'P0001' })
  await expect(mark([notice(1), notice(6)])).rejects.toMatchObject({ code: 'P0001' })
  await expect(mark([notice(1), notice(1)])).rejects.toMatchObject({ code: '22023' })
  expect((await db.query('select id from native_first_party_updates where read_at is null')).rows).toHaveLength(3)
  const confirmed = await mark([notice(1), notice(3)])
  expect(confirmed.rows).toEqual([notice(1), notice(3)].map(id => ({ id, recipient_profile_id: owner, read_at: expect.any(Date) })))
  expect((await mark([notice(1), notice(3)])).rows).toEqual(confirmed.rows)
  expect((await db.query('select id from native_first_party_updates where read_at is null')).rows).toEqual([{ id: notice(2) }])
  await db.exec('reset role; set role anon;')
  await expect(db.query('select * from native_first_party_updates')).rejects.toMatchObject({ code: '42501' })
  await expect(mark([notice(2)])).rejects.toMatchObject({ code: '42501' })
})
