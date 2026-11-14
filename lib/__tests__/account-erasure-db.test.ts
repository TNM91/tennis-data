import {expect,it} from 'vitest'
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import {teamResultScorecardKey} from '../team-results-contract'
import {hittingPlanStart} from '../hitting-plan'
type Result={ok:boolean;blocked?:string;job:{id:string;account_id:string;lease_token:string}|null;objects?:unknown[];request?:{id:string}}
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',room='33333333-3333-4333-8333-333333333333',message='44444444-4444-4444-8444-444444444444'
it.each(['LF','CRLF'] as const)('automates only consented exact-owner erasure across the audited FK graph (%s checkout)',async newline=>{
 const readSql=async(file:URL)=>{const text=(await readFile(file,'utf8')).replace(/\r\n/g,'\n');return newline==='CRLF'?text.replace(/\n/g,'\r\n'):text}
 const db=new PGlite()
 try{
  await db.exec(await readSql(new URL('./fixtures/account-erasure-audited-schema.sql',import.meta.url)))
  await db.exec("create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$")
  await db.exec('create unique index fixture_participant_key on public.internal_conversation_participants(conversation_id,profile_id)')
  for(const file of ['20261028000100_native_account_requests.sql','20261028000200_automated_account_erasure.sql','20261028000300_apple_purchase_records.sql','20261028000400_apple_purchase_erasure_guard.sql','20261030000100_native_tournament_registration.sql','20261031000100_native_coach_alert_preferences.sql','20261110000100_native_first_party_updates.sql','20261110000200_restore_updates_erasure_catalog.sql','20261110000300_native_personal_matches.sql','20261110000400_native_captain_court_results.sql','20261110000700_native_team_next_fixtures.sql','20261110000800_native_private_teams.sql','20261110000900_native_team_erasure_catalog.sql','20261110001000_native_team_result_players.sql','20261112000100_native_personal_match_venues.sql','20261112000200_native_personal_court_feedback.sql'])await db.exec(await readSql(new URL('../../supabase/migrations/'+file,import.meta.url)))
  await db.exec(await readSql(new URL('../../supabase/migrations/20261112000300_native_hitting_plans.sql',import.meta.url)))
  await db.exec(await readSql(new URL('../../supabase/migrations/20261112000400_native_scorecard_practice.sql',import.meta.url)))
  await db.exec(await readSql(new URL('../../supabase/migrations/20261112000500_native_team_chat_display_names.sql',import.meta.url)))
  await db.exec(`create schema private;
    create function private.is_profile_team_member(uuid,text,text,text) returns boolean
      language sql as 'select false';
    alter table public.team_chat_rooms add unique (parent_conversation_id,name_key)`)
  await db.exec(await readSql(new URL('../../supabase/migrations/20261114000200_native_first_party_team_chats.sql',import.meta.url)))
  const reconcile=await readSql(new URL('../../supabase/migrations/20261114000600_reconcile_chat_account_erasure_catalog.sql',import.meta.url))
  expect((await db.query('select account_erasure_catalog_ready() ok')).rows).toEqual([{ok:false}])
  await db.exec('alter table profiles add column unexpected text')
  await expect(db.exec(reconcile)).rejects.toThrow('Review unexpected account deletion catalog changes')
  await db.exec('rollback; alter table profiles drop column unexpected')
  await db.exec(reconcile)
  await db.exec('alter table auth.users add column raw_user_meta_data jsonb; alter table public.team_chat_blocks add unique(owner_user_id,blocked_user_id)')
  for(const file of ['20261113001100_native_player_chats.sql','20261114000300_native_direct_chat_hits.sql','20261114000800_native_chat_hit_scorecards.sql','20261114000900_native_chat_hit_rematch.sql']){
   await db.exec(await readSql(new URL('../../supabase/migrations/'+file,import.meta.url)))
  }
  await db.exec(`insert into auth.users values('${a}','a@example.test',now()),('${b}','b@example.test',now());insert into profiles(id,email,role) values('${a}','a@example.test','member'),('${b}','b@example.test','admin');insert into auth.sessions(user_id) values('${a}');insert into internal_conversations(id,created_by_user_id,metadata) values('${room}','${a}','{"teamName":"Aces"}');insert into internal_messages(id,conversation_id,sender_user_id,body) values('${message}','${room}','${b}','Keep my message');insert into internal_messages(conversation_id,sender_user_id,body) values('${room}','${a}','Erase my message');insert into internal_conversations(id,created_by_user_id) values('66666666-6666-4666-8666-666666666666','${a}');insert into team_chat_rooms(conversation_id,parent_conversation_id,created_by) values('66666666-6666-4666-8666-666666666666','${room}','${a}');insert into clubs(id,owner_user_id) values('55555555-5555-4555-8555-555555555555','${b}');insert into club_groups(club_id,created_by_user_id) values('55555555-5555-4555-8555-555555555555','${a}');insert into product_usage_events(user_id) values('${a}');`)

  await db.query('insert into internal_notification_preferences(profile_id,native_coach_alerts_enabled) values($1,true),($2,false)',[a,b])
  await db.query("insert into team_room_member_preferences(conversation_id,profile_id,chat_display_name) values($1,$2,'Avery'),($1,$3,'Cam')",[room,a,b])
  await db.exec('update team_chat_rooms set first_party=true')
  await db.query("insert into internal_messages(conversation_id,sender_user_id,body,metadata) values($1,$2,'Keep this reply',$3)",[room,b,JSON.stringify({quote:{author:a,body:'Private copied message'},other:'Keep'})])
  await db.query("insert into team_room_member_removals(conversation_id,profile_id,removed_by_user_id) values($1,$2,$3)",[room,b,a])
  await db.query("insert into internal_notifications(recipient_profile_id,actor_user_id,body) values($1,$2,'Private copied message')",[b,a])
  await db.query("insert into captain_roster_contacts(captain_user_id,email,phone) values($1,'a@example.test','15550000001'),($1,'b@example.test','15550000002')",[b])
  await db.query("insert into coach_player_links(id,coach_user_id,player_user_id,player_email) values('private-link',$1,$2,'a@example.test')",[b,a])
  await db.query("insert into upgrade_requests(requester_email) values('a@example.test')")
  await db.query("insert into import_queue(payload) values($1)",[JSON.stringify({accountId:a,privateNote:'Remove'})])
  await db.query("insert into admin_audit_events(actor_user_id,target_label,metadata) values($1,'Private contact',$2)",[a,JSON.stringify({email:'a@example.test'})])
  await db.query("insert into native_email_auth_limits(scope,key_hash,window_started_at,hits) values('email-hour',encode(sha256(convert_to('email:a@example.test','UTF8')),'hex'),now(),1)")
  await db.query("insert into tiq_tournaments(id,created_by_user_id,contacts) values('test-erasure',$1,$2)",[b,JSON.stringify({PlayerA:{phone:'15550000001'},PlayerB:{phone:'15550000002'}})])
  await db.query("insert into tiq_tournament_entries(id,tournament_id,player_name,email,phone) values('77777777-7777-4777-8777-777777777777','test-erasure','PlayerA','a@example.test','15550000001'),('88888888-8888-4888-8888-888888888888','test-erasure','PlayerB','b@example.test','15550000002')")
  await db.query("insert into tiq_tournament_entries(tournament_id,player_name,status,submitted_by_user_id,native_registration) values('test-erasure','NativePending','pending',$1,'{\"version\":\"1\",\"one\":\"Private name\"}'),('test-erasure','NativeDeclined','declined',$1,'{\"version\":\"1\"}'),('test-erasure','NativeApproved','approved',$1,'{\"version\":\"1\",\"decisionNote\":\"Private note\"}'),('test-erasure','OtherPending','pending',$2,'{\"version\":\"1\"}')",[a,b])
  await db.query("insert into tiq_tournaments(id,is_event,created_by_user_id) values('test-event',true,$1)",[b])
  await db.exec("update tiq_tournaments set event_id='test-event',entrants=array['NativeApproved','Opponent'],results='{\"r1-m1\":{\"winner\":\"NativeApproved\",\"score\":\"6-4\"}}' where id='test-erasure';insert into tiq_event_registrations(event_id,tournament_id,player_one,entrant_name,status,fee_cents,paid_cents) values('test-event','test-erasure','NativeApproved','NativeApproved','confirmed',3000,0)")
  await db.exec("update tiq_tournament_entries set self_rating=4,eligibility_rating=4,eligibility_rating_source='self',eligibility_review_note='Private player note' where player_name='NativeApproved'")
  await db.query("insert into api_rate_limits(scope,key_hash,request_count) values('native-tournament-entry',encode(sha256(convert_to($1||':native-tournament-entry','UTF8')),'hex'),1)",[a])
  await db.query("insert into tiq_tournament_contacts(tournament_id,entrant_name,phone) values('test-erasure','PlayerA','15550000001'),('test-erasure','PlayerB','15550000002')")
  await db.query("insert into tiq_tournament_preference_events(tournament_id,tournament_entry_id,player_name,phone) values('test-erasure','77777777-7777-4777-8777-777777777777','PlayerA','15550000001')")
  await db.query("insert into storage.objects(owner_id,bucket_id,name) values($1,'profile-photos',$1||'/avatar.jpg'),(null,'team-room-files','room/'||$1||'/photo.jpg'),($2,'profile-photos',$2||'/avatar.jpg')",[a,b])
  const hittingId='player-calendar-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  await db.query(`insert into player_calendar_items(id,player_user_id,title,kind,scheduled_time,hitting_plan)
    values ($1,$2,'Hit at Vetta West','match','18:00','{"clubId":"vetta-west"}')`,[hittingId,a])
  await expect(db.query("update player_calendar_items set hitting_plan='{}' where id=$1",[hittingId])).rejects.toMatchObject({code:'23514'})
  const practiceId='player-calendar-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  await db.query(`insert into player_calendar_items(id,player_user_id,title,kind,practice_focus)
    values ($1,$2,'Return Depth Lane','practice','{"cardId":"return-depth-lane","target":"Land six deep returns"}')`,[practiceId,a])
  await expect(db.query("update player_calendar_items set practice_focus='{}' where id=$1",[practiceId])).rejects.toMatchObject({code:'23514'})

  const direct='87777777-7777-4777-8777-777777777771',playedHit='87777777-7777-4777-8777-777777777772'
  const cancelledHit='87777777-7777-4777-8777-777777777773',futureHit='87777777-7777-4777-8777-777777777774'
  const stranger='99999999-9999-4999-8999-999999999991'
  await db.query("insert into internal_conversations(id,created_by_user_id,conversation_type,related_entity_type,status) values($1,$2,'direct','player_chat','open')",[direct,a])
  await db.query("insert into internal_conversation_participants(conversation_id,profile_id) values($1,$2),($1,$3)",[direct,a,b])
  const pastDate=new Date(Date.now()-2*86400000).toISOString().slice(0,10)
  const futureDate=new Date(Date.now()+2*86400000).toISOString().slice(0,10)
  for(const [id,date,status] of [[playedHit,pastDate,'accepted'],[cancelledHit,pastDate,'cancelled'],[futureHit,futureDate,'accepted']]){
   await db.query(`insert into private.native_chat_hits(id,room_id,proposed_by,invited_player,club_id,play_date,play_time,starts_at,status)
     values($1,$2,$3,$4,'vetta-west',$5,'18:00',$6,$7)`,
     [id,direct,a,b,date,hittingPlanStart({date,time:'18:00'})!.toISOString(),status])
  }
  await db.exec('grant usage on schema auth to authenticated; set role authenticated')
  const matchId = '22222222-aaaa-4222-8222-222222222222'
  const scorecardKey = teamResultScorecardKey(room, matchId)
  const insertMatch = (owner:string,id=matchId) => db.query(`insert into native_personal_matches
    (owner_user_id,id,revision,calendar_match_id,match_date,opponent,format,outcome,score)
    values ($1,$2,gen_random_uuid(),$3,current_date,'Practice partner','singles','Won','6-4 6-3')`, [owner,id,scorecardKey])
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a])
  await insertMatch(a)
  expect((await db.query('select court_venue_key from native_personal_matches')).rows).toEqual([{court_venue_key:null}])
  await db.query("update native_personal_matches set court_venue_key='vetta-west'")
  expect((await db.query('select court_venue_key from native_personal_matches')).rows).toEqual([{court_venue_key:'vetta-west'}])
  for(const key of ['private-22222222-aaaa-4222-8222-222222222222','1330 Harvestowne Industrial Dr']){
   await expect(db.query('update native_personal_matches set court_venue_key=$1',[key])).rejects.toMatchObject({code:'23514'})
  }
  await expect(insertMatch(a)).rejects.toMatchObject({code:'23505'})
  await expect(insertMatch(a, '22222222-aaaa-4222-8222-222222222223')).rejects.toMatchObject({code:'23505'})
  await expect(db.query('update native_personal_matches set calendar_match_id=null')).rejects.toMatchObject({code:'42501'})
  await expect(insertMatch(b)).rejects.toMatchObject({code:'42501'})
  const insertHittingScorecard=()=>db.query(`insert into native_personal_matches
    (owner_user_id,id,revision,match_date,opponent,format,outcome,score,court_venue_key,hitting_calendar_id)
    values ($1,gen_random_uuid(),gen_random_uuid(),current_date,'Partner','doubles','Won','6-4 6-3','frontenac-racquet-club',$2)`,[a,hittingId])
  await insertHittingScorecard()
  await expect(insertHittingScorecard()).rejects.toMatchObject({code:'23505'})
  await expect(db.query('update native_personal_matches set hitting_calendar_id=null')).rejects.toMatchObject({code:'42501'})
  expect((await db.query('select court_venue_key from native_personal_matches order by court_venue_key')).rows)
   .toEqual([{court_venue_key:'frontenac-racquet-club'},{court_venue_key:'vetta-west'}])
  const courtFeedback = {surface:4,lighting:null,court_time:5}
  const rateMatch = (value:unknown) => db.query('update native_personal_matches set court_feedback=$2::jsonb where id=$1', [matchId,JSON.stringify(value)])
  await rateMatch(courtFeedback)
  const ratings = () => db.query('select court_feedback from native_personal_matches where id=$1',[matchId])
  expect((await ratings()).rows).toEqual([{court_feedback:courtFeedback}])
  for(const bad of [{...courtFeedback,surface:6},{...courtFeedback,lighting:'4'},{surface:4},[1,2,3],{surface:null,lighting:null,court_time:null}]){
   await expect(rateMatch(bad)).rejects.toMatchObject({code:'23514'})
  }
  await db.query("update native_personal_matches set court_venue_key='vetta-sunset' where id=$1",[matchId])
  expect((await ratings()).rows).toEqual([{court_feedback:null}])
  await db.query('update native_personal_matches set court_venue_key=null where id=$1',[matchId])
  await expect(rateMatch(courtFeedback)).rejects.toMatchObject({code:'23514'})
  await db.query("update native_personal_matches set court_venue_key='vetta-west' where id=$1",[matchId])
  await rateMatch(courtFeedback)
  const logHit = (owner:string,plan:string) => db.query(`insert into native_personal_matches
    (owner_user_id,id,revision,chat_hit_id,match_date,opponent,format,outcome,score,court_venue_key)
    values ($1,gen_random_uuid(),gen_random_uuid(),$2,$3,'Hitting partner','singles','Won','6-4 6-3','vetta-west')`,[owner,plan,pastDate])
  await logHit(a,playedHit)
  await expect(logHit(a,playedHit)).rejects.toMatchObject({code:'23505'})
  for(const unavailable of [cancelledHit,futureHit,stranger]) await expect(logHit(a,unavailable)).rejects.toMatchObject({code:'23514'})
  await expect(db.query('update native_personal_matches set chat_hit_id=null')).rejects.toMatchObject({code:'42501'})
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[stranger])
  await expect(logHit(stranger,playedHit)).rejects.toMatchObject({code:'23514'})
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b])
  expect((await db.query('select id from native_personal_matches')).rows).toEqual([])
  expect((await ratings()).rows).toEqual([])
  expect((await db.query('update native_personal_matches set court_feedback=$2::jsonb where id=$1 returning id',
   [matchId,JSON.stringify(courtFeedback)])).rows).toEqual([])
  expect((await db.query("update native_personal_matches set court_venue_key='vetta-sunset' where owner_user_id=$1 returning id",[a])).rows).toEqual([])
  expect((await db.query('delete from native_personal_matches where owner_user_id=$1 returning id',[a])).rows).toEqual([])
  await insertMatch(b)
  await expect(db.query('select public.native_chat_hit_rematch($1,$2)',[b,playedHit])).rejects.toMatchObject({code:'42501'})
  await expect(db.query('update native_personal_matches set owner_user_id=$1',[a])).rejects.toMatchObject({code:'42501'})
  await db.exec('reset role; set role service_role')
  const rematch = async (owner:string,hit=playedHit) =>
   (await db.query('select public.native_chat_hit_rematch($1,$2) destination',[owner,hit])).rows[0]
  expect(await rematch(a)).toEqual({destination:{room:direct,clubId:'vetta-west'}})
  for(const owner of [b,stranger]) expect(await rematch(owner)).toEqual({destination:null})
  expect(await rematch(a,futureHit)).toEqual({destination:null})
  await db.exec('reset role; set role authenticated')
  await logHit(b,playedHit)
  await db.exec('reset role')
  await db.query('insert into team_chat_blocks(owner_user_id,blocked_user_id) values ($1,$2)',[b,a])
  expect(await rematch(a)).toEqual({destination:null})
  expect(await rematch(b)).toEqual({destination:null})
  await db.query('delete from team_chat_blocks where owner_user_id=$1 and blocked_user_id=$2',[b,a])
  await db.exec('reset role; set role anon')
  await expect(db.query('select id from native_personal_matches')).rejects.toMatchObject({code:'42501'})
  await db.exec('reset role')
  const courtFixture='70000000-0000-4000-8000-000000000001', roomA='70000000-0000-4000-8000-000000000002', roomB='70000000-0000-4000-8000-000000000003'
  await db.query("insert into tiq_leagues(id) values('court-league')")
  await db.query("insert into tiq_league_schedule_items(id,league_id) values($1,'court-league')",[courtFixture])
  await db.query('insert into internal_conversations(id,created_by_user_id) values($1,$3),($2,$3)',[roomA,roomB,b])
  const savedLineup = (id:string,name:string) => ({version:roomA,courts:[{format:'singles',players:[id]}],names:{[id]:name}})
  const erasedLineup = savedLineup(a,'Private player'), retainedLineup = savedLineup(b,'Teammate')
  await db.query(`insert into native_team_next_fixtures(room_id,revision,fixture,lineup) values
    ($1,$3,'{}',$4::jsonb),($2,$3,'{}',$5::jsonb)`,[roomA,roomB,courtFixture,erasedLineup,retainedLineup])
  await db.query(`insert into native_team_fixture_history(room_id,fixture_id,fixture,match_date,result_revision,won,lost,court_scores,lineup)
    values($1,$2,'{}',current_date,$3,1,0,'["6-4, 6-3"]',$4)`,[roomA,courtFixture,roomA,erasedLineup])
  await db.query(`insert into native_team_result_players(room_id,fixture_id,result_revision,court_number,seat,profile_id)
    values($1,$2,$1,1,1,$3),($1,$2,$1,1,2,$4)`,[roomA,courtFixture,a,b])
  await db.exec('alter table profiles disable trigger native_team_lineup_profile_erasure')
  expect((await db.query<{ok:boolean}>('select account_erasure_catalog_ready() ok')).rows[0].ok).toBe(false)
  await db.exec('alter table profiles enable trigger native_team_lineup_profile_erasure')
  await db.exec('set role service_role')
  const postCourt = () => db.query(`insert into native_captain_court_results
    (fixture_id,court_number,league_id,match_date,room_a,room_b,a1,b1,posted_by,format,winner,score,revision)
    values ($1,1,'court-league',current_date,$2,$3,$4,$5,$4,'singles','A','6-4 6-3',gen_random_uuid())`,[courtFixture,roomA,roomB,a,b])
  await postCourt()
  await expect(postCourt()).rejects.toMatchObject({code:'23505'})
  await db.exec('reset role; set role authenticated')
  await expect(db.query('select score from native_captain_court_results')).rejects.toMatchObject({code:'42501'})
  await expect(db.query("update native_captain_court_results set score='1-0'")).rejects.toMatchObject({code:'42501'})
  await db.exec('reset role')

  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role)
   await expect(db.query('select profile_id from native_team_result_players')).rejects.toThrow()
   await expect(db.query('select read_native_team_result_players($1,$2)',[roomA,[courtFixture]])).rejects.toThrow()
   await expect(db.query('select automated_account_erasure($1)',['claim'])).rejects.toThrow()
   await expect(db.query('select account_erasure_blocker($1,$2)',[a,'a@example.test'])).rejects.toThrow()
   await expect(db.query('select * from account_deletion_requests')).rejects.toThrow()
   await db.exec('reset role')
  }
  await db.exec('set role service_role')
  expect((await db.query<{ok:boolean}>('select account_erasure_catalog_ready() ok')).rows[0].ok).toBe(true)
  await db.exec('reset role');await db.exec('alter table tenaceiq_private.apple_memberships add column unexpected text')
  expect((await db.query<{ok:boolean}>('select account_erasure_catalog_ready() ok')).rows[0].ok).toBe(false)
  await db.exec('alter table tenaceiq_private.apple_memberships drop column unexpected');await db.exec('set role service_role')
  expect((await db.query<{ok:boolean}>('select account_erasure_catalog_ready() ok')).rows[0].ok).toBe(true)
  const create=async(owner=a,email='a@example.test',consent=true)=>(await db.query<{r:Result}>('select native_account_deletion_request($1,$2,true,$3) r',[owner,email,consent])).rows[0].r
  expect(await create(a,'a@example.test',false)).toMatchObject({ok:false})
  expect(await create(b,'b@example.test')).toMatchObject({ok:false,blocked:'last_admin'})
  const first=await create(),again=await create();expect(again).toEqual(first)
  const action=async(name:string,id:string|null=null,lease:string|null=null,value:string|null=null)=>(await db.query<{r:Result}>('select automated_account_erasure($1,$2,$3,$4) r',[name,id,lease,value])).rows[0].r
  const {job:claimedJob}=await action('claim');const job=claimedJob!;expect(job.account_id).toBe(a)
  expect((await action('claim')).job).toBeNull()
  expect(await action('freeze',job.id,b,'300')).toMatchObject({ok:false})
  expect(await action('preflight',job.id,job.lease_token)).toMatchObject({ok:true})
  expect(await action('freeze',job.id,job.lease_token,'300')).toMatchObject({ok:true})
  await db.exec('reset role');expect((await db.query('select * from auth.sessions where user_id=$1',[a])).rows).toHaveLength(0)
  await db.query("update account_deletion_requests set not_before=now()-interval '1 minute',next_attempt_at=now()-interval '1 minute' where id=$1",[job.id]);await db.exec('set role service_role')
  const lease=(await action('claim')).job!.lease_token
  expect(await action('ready',job.id,lease)).toMatchObject({ok:true})
  expect(await action('advance',job.id,lease,'auth')).toMatchObject({ok:false})
  expect(await action('advance',job.id,lease,'files')).toMatchObject({ok:true})

  const objects=(await action('files',job.id,lease)).objects
  expect(objects).toHaveLength(2)
  expect(await action('advance',job.id,lease,'data')).toMatchObject({ok:false})
  // Simulate successful Storage API object removal. Production uses storage.remove(), never metadata SQL.
  await db.exec('reset role');await db.query("delete from storage.objects where owner_id=$1 or (bucket_id='team-room-files' and split_part(name,'/',2)=$1)",[a]);await db.exec('set role service_role')
  expect((await action('files',job.id,lease)).objects).toEqual([])

  expect(await action('advance',job.id,lease,'data')).toMatchObject({ok:true})
  expect(await action('erase_data',job.id,lease)).toMatchObject({ok:true})
  // Simulate the Auth provider's hard-delete transaction with the real reviewed FK actions.
  await db.exec('reset role');await db.query('delete from auth.users where id=$1',[a])
  expect((await db.query('select lineup from native_team_next_fixtures order by room_id')).rows)
   .toEqual([{lineup:null},{lineup:retainedLineup}])
  expect((await db.query('select won,lost,court_scores,lineup from native_team_fixture_history')).rows)
   .toEqual([{won:1,lost:0,court_scores:['6-4, 6-3'],lineup:null}])
  expect((await db.query('select profile_id,seat from native_team_result_players')).rows).toEqual([{profile_id:b,seat:2}])
  expect((await db.query('select owner_user_id,chat_hit_id from native_personal_matches order by chat_hit_id nulls first')).rows)
   .toEqual([{owner_user_id:b,chat_hit_id:null},{owner_user_id:b,chat_hit_id:playedHit}])
  expect((await db.query('select id from private.native_chat_hits')).rows).toEqual([])
  expect((await db.query('select id from player_calendar_items where id=$1',[hittingId])).rows).toEqual([])
  expect((await db.query('select id from player_calendar_items where id=$1',[practiceId])).rows).toEqual([])
  expect((await db.query('select a1,b1,posted_by from native_captain_court_results')).rows).toEqual([{a1:null,b1:b,posted_by:null}])
  expect((await db.query('select body from internal_messages order by body')).rows).toEqual([{body:'Keep my message'},{body:'Keep this reply'}])
  expect((await db.query('select created_by_user_id,metadata from internal_conversations where id=$1',[room])).rows).toEqual([{created_by_user_id:null,metadata:{teamName:'Aces'}}])
  expect((await db.query('select created_by,first_party from team_chat_rooms')).rows).toEqual([{created_by:null,first_party:true}])
  expect((await db.query('select profile_id,chat_display_name from team_room_member_preferences')).rows).toEqual([{profile_id:b,chat_display_name:'Cam'}])
  expect((await db.query('select created_by_user_id from club_groups')).rows).toEqual([{created_by_user_id:null}])
  expect((await db.query('select id from profiles')).rows).toEqual([{id:b}])

  expect((await db.query('select metadata from internal_messages where body=$1',['Keep this reply'])).rows).toEqual([{metadata:{quote:null,other:'Keep'}}])
  expect((await db.query('select removed_by_user_id from team_room_member_removals where profile_id=$1',[b])).rows).toEqual([{removed_by_user_id:null}])
  expect((await db.query('select email from captain_roster_contacts')).rows).toEqual([{email:'b@example.test'}])
  expect((await db.query('select * from coach_player_links')).rows).toHaveLength(0)
  expect((await db.query('select * from upgrade_requests')).rows).toHaveLength(0)
  expect((await db.query('select * from import_queue')).rows).toHaveLength(0)
  expect((await db.query('select * from internal_notifications')).rows).toHaveLength(0)
  expect((await db.query('select actor_user_id,target_label,metadata from admin_audit_events')).rows).toEqual([{actor_user_id:null,target_label:'',metadata:{}}])
  expect((await db.query('select * from native_email_auth_limits')).rows).toHaveLength(0)
  expect((await db.query('select name from storage.objects')).rows).toEqual([{name:b+'/avatar.jpg'}])
  expect((await db.query("select email,phone from tiq_tournament_entries where player_name='PlayerA'")).rows).toEqual([{email:'',phone:''}])
  expect((await db.query("select email,phone from tiq_tournament_entries where player_name='PlayerB'")).rows).toEqual([{email:'b@example.test',phone:'15550000002'}])
  expect((await db.query('select entrant_name,phone from tiq_tournament_contacts')).rows).toEqual([{entrant_name:'PlayerB',phone:'15550000002'}])
  expect((await db.query("select contacts from tiq_tournaments where id='test-erasure'")).rows).toEqual([{contacts:{PlayerB:{phone:'15550000002'}}}])

  expect((await db.query("select player_name,submitted_by_user_id,native_registration from tiq_tournament_entries where player_name like 'Native%' order by player_name")).rows).toEqual([])
  expect((await db.query("select entrants,results from tiq_tournaments where id='test-erasure'")).rows).toEqual([{entrants:['NativeApproved','Opponent'],results:{'r1-m1':{winner:'NativeApproved',score:'6-4'}}}])
  expect((await db.query("select entrant_name,status,fee_cents,paid_cents from tiq_event_registrations where event_id='test-event'")).rows).toEqual([{entrant_name:'NativeApproved',status:'confirmed',fee_cents:3000,paid_cents:0}])
  expect((await db.query("select submitted_by_user_id,native_registration from tiq_tournament_entries where player_name='OtherPending'")).rows).toEqual([{submitted_by_user_id:b,native_registration:{version:'1'}}])
  expect((await db.query("select * from api_rate_limits where scope='native-tournament-entry'")).rows).toHaveLength(0)
  await db.exec('set role service_role');expect(await action('verify',job.id,lease)).toMatchObject({ok:true})
  expect(await action('complete',job.id,lease)).toMatchObject({ok:true})
  expect((await db.query('select profile_id,native_coach_alerts_enabled from internal_notification_preferences')).rows).toEqual([{profile_id:b,native_coach_alerts_enabled:false}])
  expect((await db.query('select account_id,verified_email,stripe_customer_id,status from account_deletion_requests')).rows).toEqual([{account_id:null,verified_email:null,stripe_customer_id:null,status:'completed'}])
  // A new dependency disables future automated erasure rather than silently extending a cascade.
  await db.exec('reset role');await db.exec('create table unexpected_owner(user_id uuid references auth.users(id) on delete cascade)')
  expect((await db.query<{ok:boolean}>('select account_erasure_catalog_ready() ok')).rows[0].ok).toBe(false)
 }finally{await db.close()}
},30000)
