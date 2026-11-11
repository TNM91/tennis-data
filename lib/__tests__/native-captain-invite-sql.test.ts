import {PGlite} from '@electric-sql/pglite'
import {createClient} from '@supabase/supabase-js'
import {readFileSync} from 'node:fs'
import {beforeAll,afterAll,it,expect,vi} from 'vitest'
import {GET as teamRooms,POST as saveTeamMatch} from '../../app/api/mobile/first-party/team-rooms/route'
import {POST as teamInvites} from '../../app/api/mobile/first-party/team-invites/route'
import {GET as setup} from '../../app/api/mobile/first-party/setup/route'
import {buildProductAccessState} from '../access-model-core'
import type {CaptainInvite} from '../native-captain-invite-contract'
import {privateTeamLeagueKey} from '../private-team-contract'

const account = vi.hoisted(() => ({ verify: vi.fn(), client: vi.fn(), access: vi.fn() }))
vi.mock('../mobile-account-auth', async original => ({
  ...await original<typeof import('../mobile-account-auth')>(), verifiedAccount: account.verify, accountClient: account.client,
}))
vi.mock('../player-api-auth', () => ({ loadPlayerAccess: account.access }))
vi.mock('../native-coach-chat-unread', () => ({ nativeCoachChatUnread: vi.fn() }))
vi.mock('../native-captain-workspace', () => ({ authorizeNativeCaptainScope: () => { throw Error('Unexpected integrated captain scope') } }))

type Result={ok:boolean;status:number;invite:CaptainInvite;invites:CaptainInvite[]}
let db:PGlite
const owner='11111111-1111-4111-8111-111111111111',captain='22222222-2222-4222-8222-222222222222',room='33333333-3333-4333-8333-333333333333',one='55555555-5555-4555-8555-555555555555',two='66666666-6666-4666-8666-666666666666'
const sql=(s:string)=>db.exec(s)
async function call(action='list',id:string|null=null,who=captain,team='Aces'){return (await db.query<{value:Result}>('select native_captain_invites($1,$2,$3,$4,$5,$6) value',[who,team,'City','4.0',action,id])).rows[0].value}
async function firstPartyCall(action:string,id:string|null,expectedRoom=room){
 return (await db.query<{value:Result}>('select native_first_party_captain_invites($1,$2,$3,$4,$5,$6,$7) value',
  [captain,'Aces','City','4.0',action,id,expectedRoom])).rows[0].value
}
async function reset(){await sql(`truncate profiles,team_profile_links,internal_conversations,internal_conversation_participants,internal_messages,team_room_invites,team_room_member_removals,team_room_member_preferences cascade;
insert into profiles(id,message_display_name) values('${owner}','Alex'),('${captain}','Captain');
insert into internal_conversations(id,related_entity_type,related_entity_id) values('${room}','team_room','aces__city__4 0');
insert into team_profile_links(profile_user_id,normalized_team_name,team_name,league_name,flight,team_role,team_roles,status) values('${captain}','aces','Aces','City','4.0','captain',array['captain'],'accepted');
insert into internal_conversation_participants(conversation_id,profile_id,participant_role) values('${room}','${captain}','coordinator');`)}
beforeAll(async()=>{db=new PGlite();await sql("set timezone='UTC';create role anon;create role authenticated;create role service_role;\ncreate table profiles(id uuid primary key,message_display_name text default '',linked_player_name text,linked_team_name text,linked_league_name text,linked_flight text,linked_team_at timestamptz);\ncreate table internal_conversations(id uuid primary key,status text default 'open',related_entity_type text,related_entity_id text,updated_at timestamptz default now());\ncreate table team_profile_links(id uuid primary key default gen_random_uuid(),profile_user_id uuid references profiles(id),source_actor_user_id uuid,team_name text,normalized_team_name text,league_name text,flight text,team_role text,team_roles text[],declined_roles text[],role_accepted_at jsonb,source_type text,source_record_id uuid,status text,accepted_at timestamptz,unlinked_at timestamptz,archived_at timestamptz,is_default boolean default false,updated_at timestamptz default now(),unique(profile_user_id,normalized_team_name,league_name,flight));\ncreate unique index one_default on team_profile_links(profile_user_id) where is_default and status='accepted';\ncreate table team_room_invites(id uuid primary key default gen_random_uuid(),invite_token uuid unique default gen_random_uuid(),conversation_id uuid references internal_conversations(id),created_by_user_id uuid,team_name text,normalized_team_name text,league_name text,flight text,expires_at timestamptz,revoked_at timestamptz,accepted_count integer default 0,created_at timestamptz default now());\ncreate table team_room_member_removals(conversation_id uuid references internal_conversations(id),profile_id uuid,primary key(conversation_id,profile_id));\ncreate table internal_conversation_participants(conversation_id uuid references internal_conversations(id),profile_id uuid,participant_role text,last_read_at timestamptz,muted boolean default false,primary key(conversation_id,profile_id));\ncreate table internal_messages(id uuid default gen_random_uuid(),conversation_id uuid,sender_user_id uuid,body text,message_kind text);\ncreate table team_room_member_preferences(conversation_id uuid,profile_id uuid,season_availability text default 'ask_me',email_opt_in boolean default false,browser_opt_in boolean default false,primary key(conversation_id,profile_id));");for(const file of ['20261024000500_native_team_invite_join.sql','20261024000600_native_captain_invites.sql'])await sql(readFileSync('supabase/migrations/'+file,'utf8'))},30000)
afterAll(async()=>{await db?.close()})
it('lists without writing; creates exactly one link per identity and preserves the token on retry',async()=>{await reset();expect((await call()).invites).toEqual([]);const first=await call('create',one);expect(first.ok).toBe(true);expect((await call('create',one)).invite).toEqual(first.invite);expect((await call()).invites).toHaveLength(1);expect((await db.query('select * from internal_messages')).rows).toHaveLength(0)})
it('pins first-party invites to the reviewed room and an active first-party captain link',async()=>{
 await reset()
 await sql(readFileSync('supabase/migrations/20261110000500_native_first_party_captain_invites.sql','utf8'))
 expect((await firstPartyCall('create',one)).status).toBe(403)
 await sql("update team_profile_links set source_type='tiq_entry'")
 expect((await firstPartyCall('create',one,owner)).status).toBe(403)
 expect((await firstPartyCall('list',null)).invites).toEqual([])
 const created=await firstPartyCall('create',one)
 expect(created.ok).toBe(true)
 expect((await firstPartyCall('create',one)).invite).toEqual(created.invite)
 expect((await firstPartyCall('revoke',one)).invite.active).toBe(false)
 const grants=await db.query("select has_function_privilege('authenticated','native_first_party_captain_invites(uuid,text,text,text,text,uuid,uuid)','execute') allowed")
 expect(grants.rows).toEqual([{allowed:false}])
})
it('retries only the selected revocation and never revokes a newer link',async()=>{await reset();await call('create',one);await call('revoke',one);const second=await call('create',two);expect(second.invite.active).toBe(true);expect((await call('revoke',one)).invite.revokedAt).toBeTruthy();const replay=await call('create',one);expect(replay.invite.active).toBe(false);expect(replay.invite.revokedAt).toBeTruthy();expect((await call()).invites.find(i=>i.id===two)?.active).toBe(true)})
it('created links work with native joining; revocation blocks future use without removing a member',async()=>{await reset();const created=await call('create',one);const args=[owner,created.invite.token,false,null];const preview=(await db.query<{value:{review:{expected:unknown;linkVersion:string}}}>('select native_team_invite($1,$2,$3,$4) value',args)).rows[0].value.review;const joined=await db.query<{value:{ok:boolean}}>('select native_team_invite($1,$2,true,$3) value',[owner,created.invite.token,{invite:preview.expected,linkVersion:preview.linkVersion}]);expect(joined.rows[0].value.ok).toBe(true);await call('revoke',one);const denied=await db.query<{value:{status:number}}>('select native_team_invite($1,$2,false,null) value',[owner,created.invite.token]);expect(denied.rows[0].value.status).toBe(404);expect((await db.query('select status from team_profile_links where profile_user_id=$1',[owner])).rows[0]).toEqual({status:'accepted'})})
it.each([['player',`update team_profile_links set team_role='player',team_roles=array['player']`],['archived',`update team_profile_links set archived_at=now()`],['removed',`insert into team_room_member_removals values('${room}','${captain}')`],['not participant','delete from internal_conversation_participants'],['closed',`update internal_conversations set status='closed'`]])('denies %s before any invite write',async(_name,change)=>{await reset();await sql(change);expect((await call('create',one)).status).toBe(403);expect((await db.query('select * from team_room_invites')).rows).toHaveLength(0)})
it('denies cross-team and other-owner identities without changing the existing link',async()=>{await reset();const first=await call('create',one);expect((await call('revoke',one,captain,'Other')).status).toBe(403);await sql(`update team_room_invites set created_by_user_id='${owner}' where id='${one}'`);expect((await call('create',one)).status).toBe(409);expect((await call('revoke',one)).status).toBe(409);expect((await db.query('select invite_token,revoked_at from team_room_invites')).rows[0]).toEqual({invite_token:first.invite.token,revoked_at:null})})
it('caps active links and allows an existing identity to replay at the cap',async()=>{await reset();for(let i=0;i<5;i++)expect((await call('create',`77777777-7777-4777-8777-${String(i).padStart(12,'0')}`)).ok).toBe(true);expect((await call('create',one)).status).toBe(409);expect((await call('create','77777777-7777-4777-8777-000000000000')).ok).toBe(true)})
it('rolls back a failed create and retries the same identity',async()=>{await reset();await sql(`create function fail_invite() returns trigger language plpgsql as $$ begin raise exception 'fixture'; end $$;create trigger fail_invite before insert on team_room_invites for each row execute function fail_invite()`);expect((await call('create',one)).status).toBe(503);expect((await call()).invites).toHaveLength(0);await sql('drop trigger fail_invite on team_room_invites;drop function fail_invite()');expect((await call('create',one)).ok).toBe(true)})
it('keeps execution restricted to the existing server role',async()=>{for(const role of ['anon','authenticated','service_role']){const r=await db.query<{allowed:boolean}>("select has_function_privilege($1,'native_captain_invites(uuid,text,text,text,text,uuid)','execute') allowed",[role]);expect(r.rows[0].allowed).toBe(role==='service_role')}})

it('never recreates an expired create identity',async()=>{await reset();const first=await call('create',one);await sql(`update team_room_invites set expires_at=now()-interval '1 day' where id='${one}'`);const replay=await call('create',one);expect(replay.invite.active).toBe(false);expect(replay.invite.token).toBe(first.invite.token);expect((await db.query('select * from team_room_invites')).rows).toHaveLength(1)})
it('keeps active links visible ahead of bounded history',async()=>{await reset();await call('create',one);for(let i=0;i<23;i++){const id=`88888888-8888-4888-8888-${String(i).padStart(12,'0')}`;await call('create',id);await call('revoke',id)}const result=await call();expect(result.invites).toHaveLength(20);expect(result.invites[0].id).toBe(one);expect(result.invites[0].active).toBe(true)})

it('connects first-party invites, Team Rally, and captain fixtures to real team membership', async () => {
  await reset()
  await sql(readFileSync('supabase/migrations/20261110000500_native_first_party_captain_invites.sql', 'utf8'))
  await sql(readFileSync('supabase/migrations/20261110000700_native_team_next_fixtures.sql', 'utf8'))
  await sql(readFileSync('supabase/migrations/20261110000800_native_private_teams.sql', 'utf8'))
  // This fixture exercises runtime permissions. The audited erasure fixture applies the complete migration.
  const resultPlayersSql = readFileSync('supabase/migrations/20261110001000_native_team_result_players.sql', 'utf8')
  await sql(resultPlayersSql.slice(resultPlayersSql.indexOf('create table'), resultPlayersSql.indexOf('do $catalog$')))
  expect((await db.query(`select has_table_privilege('authenticated','native_team_next_fixtures','select') as reading,
    has_function_privilege('authenticated','set_native_team_next_fixture(uuid,uuid,text,text,text,uuid,uuid,jsonb,boolean)','execute') as writing,
    has_function_privilege('authenticated','save_native_team_lineup(uuid,uuid,text,text,text,uuid,uuid,uuid,jsonb)','execute') as lineup_writing`)).rows)
    .toEqual([{ reading: false, writing: false, lineup_writing: false }])
  await sql(`
    alter table profiles add column linked_player_id uuid;
    alter table internal_conversations add column conversation_type text, add column subject text,
      add column created_by_user_id uuid, add column metadata jsonb;
    create table native_personal_matches(id uuid, owner_user_id uuid);
    create table level_up_sessions(id uuid, player_user_id uuid);
    alter role service_role bypassrls;
    grant select, insert, update on all tables in schema public to service_role;
    set role service_role;
  `)
  const scope = { teamName: 'Aces', leagueName: 'City', flight: '4.0' }
  const base = 'https://example.test/api/mobile/first-party/'
  const captainToken = 'fixture-captain', teammateToken = 'fixture-teammate'
  const roles: Record<string, string> = { [captainToken]: captain, [teammateToken]: owner }
  const client = createClient('https://example.test', 'fixture', {
    auth: { persistSession: false }, global: { fetch: firstPartyFixtureFetch },
  })
  account.verify.mockImplementation(async (request: Request) => {
    const token = request.headers.get('authorization')?.slice('Bearer '.length) || ''
    return roles[token] ? { user: { id: roles[token] }, token } : null
  })
  account.client.mockReturnValue(client)
  account.access.mockImplementation(async (_client, userId) => buildProductAccessState('member', { captainSubscriptionActive: userId === captain }))
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture')
  vi.stubEnv('TIQ_FIRST_PARTY_TEAM_ROOMS', JSON.stringify([{ ...scope, roomId: room }]))
  vi.stubEnv('TIQ_FIRST_PARTY_LEAGUE_APPROVALS', '')
  vi.stubEnv('TIQ_FIRST_PARTY_TOURNAMENT_APPROVALS', '')

  const request = (path: string, token: string, body?: object) => new Request(base + path, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const ready = async () => (await teamRooms(request('team-rooms?op=captain-setup', captainToken))).json()
  const progress = async () => (await setup(request('setup', captainToken))).json()
  const invite = (token: string, body: object) => teamInvites(request('team-invites', token, body))
  try {
    expect(await ready()).toMatchObject({ captainChatSetup: 'needs-team' })
    await db.query("update team_profile_links set source_type='tiq_entry' where profile_user_id=$1", [captain])
    expect(await ready()).toEqual({
      ok: true, releaseScope: 'first-party', owner: captain, captainChatSetup: 'ready', captainInviteTeams: [scope],
    })
    expect(await progress()).toMatchObject({ tracks: expect.arrayContaining([{ tier: 'captain', done: ['team'] }]) })

    const created = await invite(captainToken, { ...scope, action: 'create', id: one })
    expect(created.status).toBe(200)
    const { invite: { token } } = await created.json()
    expect(await progress()).toMatchObject({ tracks: expect.arrayContaining([{ tier: 'captain', done: ['team', 'invite'] }]) })

    const preview = await invite(teammateToken, { action: 'preview', token })
    expect(preview.status).toBe(200)
    const { review } = await preview.json()
    expect(review).toMatchObject({ ...scope, roomId: room, alreadyJoined: false })
    expect((await db.query('select * from team_profile_links where profile_user_id=$1', [owner])).rows).toHaveLength(0)
    const join = { action: 'join', token, expected: { invite: review.expected, linkVersion: review.linkVersion } }
    expect(await (await invite(teammateToken, join)).json()).toMatchObject({ ok: true, owner, roomId: room, alreadyJoined: false })
    expect(await (await invite(teammateToken, join)).json()).toMatchObject({ ok: true, owner, roomId: room, alreadyJoined: true })
    expect(await (await teamRooms(request('team-rooms?op=teams', teammateToken))).json()).toMatchObject({ teams: [scope] })
    expect((await db.query('select source_type, team_role from team_profile_links where profile_user_id=$1', [owner])).rows)
      .toEqual([{ source_type: 'manual_invite', team_role: 'player' }])
    expect((await db.query('select accepted_count from team_room_invites')).rows).toEqual([{ accepted_count: 1 }])
    expect((await db.query('select message_kind from internal_messages')).rows).toEqual([{ message_kind: 'system' }])
    expect(await progress()).toMatchObject({ tracks: expect.arrayContaining([{ tier: 'captain', done: ['team', 'invite', 'teammate'] }]) })

    const fixtureUrl = 'team-rooms?' + new URLSearchParams({ op: 'next-match', team: scope.teamName, league: scope.leagueName, flight: scope.flight })
    const fixture = { opponent: 'Topspin Club', date: '2030-06-09', time: '18:00', facility: 'Court 2', timeZone: 'America/Chicago' }
    const change = { ...scope, action: 'set_next_match', roomId: room, expected: null, revision: one, nextMatch: fixture }
    const publish = (token: string, body: object) => saveTeamMatch(request('team-rooms', token, body))
    const match = async () => (await teamRooms(request(fixtureUrl, teammateToken))).json()
    expect(await match()).toMatchObject({ nextMatch: null, revision: null })
    expect((await publish(teammateToken, change)).status).toBe(403)
    expect((await publish(captainToken, { ...change, roomId: owner })).status).toBe(403)
    account.access.mockResolvedValueOnce(buildProductAccessState('member', { captainSubscriptionActive: false }))
    expect((await publish(captainToken, change)).status).toBe(403)
    expect((await publish(captainToken, { ...change, nextMatch: { ...fixture, date: '2020-01-01' } })).status).toBe(400)
    expect((await publish(captainToken, change)).status).toBe(200)
    expect((await publish(captainToken, change)).status).toBe(200)
    expect(await match()).toMatchObject({ owner, nextMatch: fixture, revision: one })
    const repliesUrl = fixtureUrl.replace('next-match', 'match-replies') + '&revision=' + one
    const availability = async (token: string) => (await teamRooms(request(repliesUrl, token))).json()
    const waiting = 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa'
    const removedMember = 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb'
    await db.query("insert into profiles(id,message_display_name) values ($1,'Casey'),($2,'Removed teammate')", [waiting, removedMember])
    await db.query(`insert into team_profile_links(profile_user_id,normalized_team_name,team_name,league_name,flight,team_role,team_roles,status,source_type)
      select member,'aces','Aces','City','4.0','player',array['player'],'accepted','manual_invite' from unnest($1::uuid[]) as member`, [[waiting, removedMember]])
    await db.query("insert into internal_conversation_participants(conversation_id,profile_id,participant_role) select $1::uuid,member,'member' from unnest($2::uuid[]) as member",
      [room, [waiting, removedMember]])
    await db.query('insert into team_room_member_removals(conversation_id,profile_id) values ($1,$2)', [room, removedMember])
    const replyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const updatedReplyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const reply = { ...scope, action: 'reply_next_match', roomId: room, revision: one, id: replyId, expected: null, choice: 'in' }
    const expectedRoster = (choice: 'in' | 'out' | null) => [
      { id: owner, name: 'Alex', choice }, { id: captain, name: 'Captain', choice: null }, { id: waiting, name: 'Casey', choice: null },
    ]
    expect((await availability(teammateToken)).replies).toEqual({ own: null })
    account.access.mockResolvedValueOnce(buildProductAccessState('member', { captainSubscriptionActive: false }))
    expect((await availability(captainToken)).replies).toEqual({ own: null })
    expect((await availability(captainToken)).replies).toEqual({
      own: null, team: [], awaiting: ['Alex', 'Casey', 'You'], awaitingTeammates: 2, rosterComplete: true, lineupRoster: expectedRoster(null),
    })
    expect((await publish(teammateToken, { ...reply, revision: two })).status).toBe(409)
    expect((await publish(teammateToken, reply)).status).toBe(200)
    expect((await publish(teammateToken, reply)).status).toBe(200)
    expect((await availability(teammateToken)).replies).toEqual({ own: { id: replyId, choice: 'in' } })
    expect((await availability(captainToken)).replies).toEqual({
      own: null, team: [{ name: 'Alex', choice: 'in' }], awaiting: ['Casey', 'You'], awaitingTeammates: 1, rosterComplete: true, lineupRoster: expectedRoster('in'),
    })
    expect((await publish(teammateToken, { ...reply, id: updatedReplyId, choice: 'out', expected: replyId })).status).toBe(200)
    expect((await publish(teammateToken, reply)).status).toBe(409)
    expect((await availability(captainToken)).replies).toEqual({
      own: null, team: [{ name: 'Alex', choice: 'out' }], awaiting: ['Casey', 'You'], awaitingTeammates: 1, rosterComplete: true, lineupRoster: expectedRoster('out'),
    })
    expect((await publish(captainToken, { ...change, revision: two })).status).toBe(409)
    const removed = { ...change, expected: one, revision: two, nextMatch: null }
    expect((await publish(captainToken, removed)).status).toBe(200)
    expect((await publish(captainToken, change)).status).toBe(409)
    expect(await match()).toMatchObject({ owner, nextMatch: null, revision: two })
    expect((await publish(teammateToken, reply)).status).toBe(409)
    expect((await db.query('select * from native_team_fixture_replies')).rows).toHaveLength(0)

    const played = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const upcoming = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    const resultRevision = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    const correctedRevision = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    const resultsUrl = fixtureUrl.replace('next-match', 'team-results')
    const results = async (token: string) => (await teamRooms(request(resultsUrl, token))).json()
    const postResult = { ...scope, action: 'save_team_result', roomId: room, fixtureId: played,
      revision: resultRevision, expected: null, won: 4, lost: 1 }
    expect((await publish(captainToken, { ...change, expected: two, revision: played })).status).toBe(200)
    const lineupVersion = '24242424-2424-4242-8242-242424242424'
    const lineup = { ...scope, action: 'save_match_lineup', roomId: room, revision: played, version: lineupVersion,
      expected: null, courts: [{ format: 'doubles', players: [owner, waiting] }] }
    const savedLineup = { version: lineupVersion, courts: lineup.courts, names: { [owner]: 'Alex', [waiting]: 'Casey' } }
    expect((await publish(teammateToken, lineup)).status).toBe(403)
    expect((await publish(captainToken, { ...lineup, courts: [{ format: 'doubles', players: [owner, owner] }] })).status).toBe(400)
    expect((await publish(captainToken, { ...lineup, courts: [{ format: 'doubles', players: [owner, removedMember] }] })).status).toBe(409)
    const freshReply = { ...reply, revision: played, choice: 'out' }
    expect((await publish(teammateToken, freshReply)).status).toBe(200)
    expect((await publish(captainToken, lineup)).status).toBe(409)
    expect((await publish(teammateToken, { ...freshReply, choice: 'in', expected: replyId, id: updatedReplyId })).status).toBe(200)
    expect(await (await publish(captainToken, lineup)).json()).toMatchObject({ ok: true, revision: played, lineup: savedLineup })
    expect(await (await publish(captainToken, lineup)).json()).toMatchObject({ lineup: savedLineup })
    expect((await publish(captainToken, { ...lineup, version: two })).status).toBe(409)
    const lineupRepliesUrl = fixtureUrl.replace('next-match', 'match-replies') + '&revision=' + played
    expect((await (await teamRooms(request(lineupRepliesUrl, captainToken))).json()).replies.savedLineup).toEqual(savedLineup)
    expect((await (await teamRooms(request(lineupRepliesUrl, teammateToken))).json()).replies).not.toHaveProperty('savedLineup')
    expect((await publish(captainToken, postResult)).status).toBe(409)
    await db.query("update native_team_next_fixtures set fixture = jsonb_set(fixture,'{date}','\"2020-01-01\"'::jsonb) where room_id=$1", [room])
    expect((await results(captainToken)).results).toMatchObject({ canEdit: true, entries: [{ fixtureId: played, score: null, plannedLineup: savedLineup }] })
    expect((await publish(captainToken, { ...change, expected: played, revision: upcoming })).status).toBe(200)
    expect((await results(captainToken)).results).toMatchObject({ entries: [{ fixtureId: played, score: null, plannedLineup: savedLineup }] })
    expect((await results(teammateToken)).results).toEqual({
      canEdit: false, entries: [], more: false, record: { wins: 0, losses: 0, ties: 0 },
    })
    expect((await publish(teammateToken, postResult)).status).toBe(403)
    expect((await publish(captainToken, postResult)).status).toBe(200)
    expect((await publish(captainToken, postResult)).status).toBe(200)
    const corrected = { ...postResult, expected: resultRevision, revision: correctedRevision, won: 3, lost: 2 }
    expect((await publish(captainToken, corrected)).status).toBe(200)
    expect((await publish(captainToken, postResult)).status).toBe(409)
    const teammateResults = (await results(teammateToken)).results
    expect(teammateResults).toMatchObject({ canEdit: false,
      entries: [{ fixtureId: played, score: { won: 3, lost: 2, revision: correctedRevision } }] })
    expect(teammateResults.entries[0]).not.toHaveProperty('plannedLineup')
    const courtsRevision = '12121212-1212-4212-8212-121212121212'
    const courtScores = ['6-3, 6-4', '4-6, 6-4, 10-8', 'W-DEFAULT', '4-6, 3-6', 'L-DEFAULT']
    const detailed = { ...corrected, expected: correctedRevision, revision: courtsRevision, courtScores }
    expect((await publish(captainToken, { ...detailed, courtScores: [...courtScores.slice(0, 4), 'DEFAULT'] })).status).toBe(400)
    expect((await publish(captainToken, { ...detailed, won: 4, lost: 1 })).status).toBe(400)
    const courtPlayerIds = [[owner, waiting], [], [], [captain], []]
    const confirmed = { ...detailed, courtPlayerIds }
    expect((await publish(captainToken, { ...confirmed, courtPlayerIds: [[owner, removedMember], [], [], [captain], []] })).status).toBe(409)
    expect((await results(captainToken)).results.entries[0].score.revision).toBe(correctedRevision)
    expect((await publish(captainToken, { ...confirmed, courtPlayerIds: [[owner], [], [waiting], [captain], []] })).status).toBe(400)
    expect((await publish(captainToken, confirmed)).status).toBe(200)
    expect((await publish(captainToken, confirmed)).status).toBe(200)
    expect((await publish(captainToken, { ...confirmed, courtPlayerIds: [[waiting], [], [], [captain], []] })).status).toBe(409)
    expect((await results(captainToken)).results.entries[0].score.courtPlayers).toEqual([
      [{ id: owner, name: 'Alex' }, { id: waiting, name: 'Casey' }], [], [], [{ id: captain, name: 'Captain' }], [],
    ])
    expect((await results(captainToken)).results.entries[0].score.myCourt).toBe(4)
    expect((await results(teammateToken)).results).toMatchObject({ entries: [
      { fixtureId: played, score: { won: 3, lost: 2, revision: courtsRevision, courtScores } },
    ] })
    expect((await results(teammateToken)).results.entries[0].score.courtPlayers).toEqual([
      [{ name: 'Alex' }, { name: 'Casey' }], [], [], [{ name: 'Captain' }], [],
    ])
    expect((await results(teammateToken)).results.entries[0].score.myCourt).toBe(1)
    const resultRosterUrl = fixtureUrl.replace('next-match', 'result-roster')
    expect((await teamRooms(request(resultRosterUrl, teammateToken))).status).toBe(403)
    expect((await (await teamRooms(request(resultRosterUrl, captainToken))).json()).players).toEqual([
      { id: owner, name: 'Alex' }, { id: captain, name: 'Captain' }, { id: waiting, name: 'Casey' },
    ])
    expect((await publish(captainToken, { ...corrected, expected: courtsRevision, revision: resultRevision, won: 4, lost: 1 })).status).toBe(409)
    const legacyRevision = '35353535-3535-4535-8535-353535353535'
    expect((await publish(captainToken, { ...detailed, expected: courtsRevision, revision: legacyRevision })).status).toBe(200)
    expect((await results(teammateToken)).results.entries[0].score.courtPlayers[0]).toEqual([{ name: 'Alex' }, { name: 'Casey' }])
    const clearedRevision = '46464646-4646-4646-8646-464646464646'
    expect((await publish(captainToken, { ...detailed, expected: legacyRevision, revision: clearedRevision, courtPlayerIds: [[], [], [], [], []] })).status).toBe(200)
    expect((await results(teammateToken)).results.entries[0].score).not.toHaveProperty('courtPlayers')
    expect((await results(teammateToken)).results.entries[0].score).not.toHaveProperty('myCourt')
    expect(await match()).toMatchObject({ nextMatch: fixture, revision: upcoming })
    expect((await publish(captainToken, { ...lineup, revision: upcoming })).status).toBe(200)
    await db.query("update native_team_next_fixtures set fixture = jsonb_set(fixture,'{date}','\"2020-02-01\"'::jsonb) where room_id=$1", [room])
    expect((await publish(captainToken, { ...postResult, fixtureId: upcoming, revision: one, won: 2, lost: 2 })).status).toBe(200)
    expect((await results(captainToken)).results.entries[0]).toMatchObject({ fixtureId: upcoming, plannedLineup: savedLineup })
    expect(await match()).toMatchObject({ nextMatch: null, revision: upcoming })
    expect((await results(teammateToken)).results).toMatchObject({ entries: [
      { fixtureId: upcoming, score: { won: 2, lost: 2 } }, { fixtureId: played, score: { won: 3, lost: 2 } },
    ], record: { wins: 1, losses: 0, ties: 1 } })
    await db.query(`insert into native_team_fixture_history(room_id,fixture_id,fixture,match_date,result_revision,won,lost)
      select $1::uuid, gen_random_uuid(), $2::jsonb, '2019-01-01'::date, gen_random_uuid(), 1, 4 from generate_series(1,21)`,
    [room, { ...fixture, date: '2019-01-01' }])
    const fullRecord = (await results(teammateToken)).results
    expect(fullRecord.entries).toHaveLength(20)
    expect(fullRecord).toMatchObject({ more: true, record: { wins: 1, losses: 21, ties: 1 } })
    expect((await results(captainToken)).results.record).toEqual(fullRecord.record)
    await db.query('insert into team_room_member_removals(conversation_id,profile_id) values ($1,$2)', [room, captain])
    expect((await publish(captainToken, { ...change, expected: two })).status).toBe(403)
    await sql('reset role')
    await db.query('delete from team_room_member_removals where conversation_id=$1', [room])
    await sql('set role service_role')

    expect((await invite(captainToken, { ...scope, action: 'revoke', id: one })).status).toBe(200)
    expect((await invite(teammateToken, { action: 'preview', token })).status).toBe(404)
    expect(await (await teamRooms(request('team-rooms?op=teams', teammateToken))).json()).toMatchObject({ teams: [scope] })
    vi.stubEnv('TIQ_FIRST_PARTY_TEAM_ROOMS', '')
    const privateTeamId = '77777777-7777-4777-8777-777777777777'
    const sameNameId = '88888888-8888-4888-8888-888888888888'
    const details = { teamName: 'The Other Guys', leagueLabel: 'USTA', flight: '4.5 Men’s' }
    const privateTeam = { ...details, leagueName: privateTeamLeagueKey(privateTeamId) }
    const create = (token: string, id = privateTeamId) => publish(token, { ...details, action: 'create_private_team', id })
    const teams = async (token: string) => (await teamRooms(request('team-rooms?op=teams', token))).json()
    expect((await create(teammateToken)).status).toBe(403)
    expect(await (await create(captainToken)).json()).toMatchObject({ owner: captain, roomId: privateTeamId, team: privateTeam })
    expect((await create(captainToken)).status).toBe(200)
    expect((await create(captainToken, sameNameId)).status).toBe(409)
    expect(await teams(teammateToken)).toMatchObject({ teams: [] })
    expect(await ready()).toMatchObject({ captainChatSetup: 'ready', captainInviteTeams: [privateTeam] })
    account.access.mockResolvedValueOnce(buildProductAccessState('member', { captainSubscriptionActive: true }))
    expect((await create(teammateToken, sameNameId)).status).toBe(200)
    expect(await teams(teammateToken)).toMatchObject({ teams: [{ ...details, leagueName: privateTeamLeagueKey(sameNameId) }] })

    const privateScope = { teamName: details.teamName, leagueName: privateTeam.leagueName, flight: details.flight }
    expect((await invite(teammateToken, { ...privateScope, action: 'list' })).status).toBe(403)
    const privateInvite = await invite(captainToken, { ...privateScope, action: 'create', id: two })
    expect(privateInvite.status).toBe(200)
    const { invite: { token: privateToken } } = await privateInvite.json()
    const { review: privateReview } = await (await invite(teammateToken, { action: 'preview', token: privateToken })).json()
    expect(privateReview).toMatchObject({ ...privateTeam, roomId: privateTeamId, alreadyJoined: false })
    expect((await invite(teammateToken, { action: 'join', token: privateToken,
      expected: { invite: privateReview.expected, linkVersion: privateReview.linkVersion } })).status).toBe(200)
    expect(await teams(teammateToken)).toMatchObject({ teams: expect.arrayContaining([
      { ...privateTeam, canManage: false }, { ...details, leagueName: privateTeamLeagueKey(sameNameId), canManage: false },
    ]) })
  } finally {
    vi.unstubAllEnvs()
    await sql('reset role')
  }
}, 15_000)

// A narrow PostgREST adapter for the local database. Sign-ins and plan entitlements are synthetic.
async function firstPartyFixtureFetch(input: RequestInfo | URL, options?: RequestInit) {
  const url = new URL(String(input))
  const name = url.pathname.split('/').at(-1) || ''
  if (options?.method === 'POST') {
    const keys = name === 'native_first_party_captain_invites'
      ? ['p_owner', 'p_team', 'p_league', 'p_flight', 'p_action', 'p_id', 'p_room_id']
      : name === 'native_team_invite' ? ['p_owner', 'p_token', 'p_join', 'p_expected']
      : name === 'set_native_team_next_fixture' ? ['p_owner', 'p_room', 'p_team', 'p_league', 'p_flight', 'p_expected', 'p_revision', 'p_fixture', 'p_archive']
      : name === 'reply_to_native_team_fixture' ? ['p_owner', 'p_room', 'p_team', 'p_league', 'p_flight', 'p_revision', 'p_expected', 'p_operation', 'p_choice']
      : name === 'save_native_team_lineup' ? ['p_owner', 'p_room', 'p_team', 'p_league', 'p_flight', 'p_revision', 'p_expected', 'p_version', 'p_courts']
      : name === 'save_native_team_result' ? ['p_owner', 'p_room', 'p_team', 'p_league', 'p_flight', 'p_fixture', 'p_expected', 'p_revision', 'p_won', 'p_lost', 'p_allow_current', 'p_court_scores']
      : name === 'save_native_team_result_with_players' ? ['p_owner', 'p_room', 'p_team', 'p_league', 'p_flight', 'p_fixture', 'p_expected', 'p_revision', 'p_won', 'p_lost', 'p_allow_current', 'p_court_scores', 'p_court_players']
      : name === 'read_native_team_results' ? ['p_room', 'p_can_edit']
      : name === 'read_native_team_result_players' ? ['p_room', 'p_fixtures']
      : name === 'create_native_private_team' ? ['p_owner', 'p_id', 'p_team', 'p_label', 'p_flight'] : []
    if (!keys.length) throw Error('Unexpected fixture RPC')
    const args = JSON.parse(String(options.body))
    const placeholders = keys.map((_, index) => '$' + (index + 1)).join(',')
    const result = await db.query<{ value: unknown }>(`select public.${name}(${placeholders}) as value`, keys.map(key => args[key]))
    return Response.json(result.rows[0].value)
  }
  const tables = ['team_profile_links', 'internal_conversations', 'internal_conversation_participants',
    'team_room_member_removals', 'team_room_invites', 'profiles', 'native_personal_matches', 'level_up_sessions', 'native_team_next_fixtures',
    'native_private_teams', 'native_team_fixture_replies']
  const fields = url.searchParams.get('select') || ''
  if (!tables.includes(name) || !/^[a-z_,]+$/.test(fields)) throw Error('Unexpected fixture relation')
  const values: unknown[] = [], conditions: string[] = []
  for (const [key, filter] of url.searchParams) {
    if (['select', 'order', 'limit'].includes(key)) continue
    if (!/^[a-z_]+$/.test(key)) throw Error('Unexpected fixture column')
    if (filter === 'is.null') conditions.push(key + ' is null')
    else if (filter.startsWith('eq.')) conditions.push(`${key} = $${values.push(filter.slice(3))}`)
    else if (filter.startsWith('in.(') && filter.endsWith(')')) {
      const list = filter.slice(4, -1).split(',').map(value => '$' + values.push(value))
      conditions.push(`${key} in (${list.join(',')})`)
    } else throw Error('Unexpected fixture filter')
  }
  const where = conditions.length ? ' where ' + conditions.join(' and ') : ''
  const order = url.searchParams.get('order')
  const orderSql = order === 'accepted_count.desc' ? ' order by accepted_count desc' : order === 'profile_id.asc' ? ' order by profile_id asc' : ''
  if (order && !orderSql) throw Error('Unexpected fixture sort')
  const limit = Number(url.searchParams.get('limit') || 51)
  if (!Number.isInteger(limit) || limit < 1 || limit > 101) throw Error('Unexpected fixture limit')
  const result = await db.query(`select ${fields} from ${name}${where}${orderSql} limit ${limit}`, values)
  return Response.json(result.rows)
}
