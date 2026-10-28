import {expect,it} from 'vitest'
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
type Result={ok:boolean;blocked?:string;job:{id:string;account_id:string;lease_token:string}|null;objects?:unknown[];request?:{id:string}}
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',room='33333333-3333-4333-8333-333333333333',message='44444444-4444-4444-8444-444444444444'
it.each(['LF','CRLF'] as const)('automates only consented exact-owner erasure across the audited FK graph (%s checkout)',async newline=>{
 const readSql=async(file:URL)=>{const text=(await readFile(file,'utf8')).replace(/\r\n/g,'\n');return newline==='CRLF'?text.replace(/\n/g,'\r\n'):text}
 const db=new PGlite()
 try{
  await db.exec(await readSql(new URL('./fixtures/account-erasure-audited-schema.sql',import.meta.url)))
  for(const file of ['20261028000100_native_account_requests.sql','20261028000200_automated_account_erasure.sql'])await db.exec(await readSql(new URL('../../supabase/migrations/'+file,import.meta.url)))
  await db.exec(`insert into auth.users values('${a}','a@example.test',now()),('${b}','b@example.test',now());insert into profiles(id,email,role) values('${a}','a@example.test','member'),('${b}','b@example.test','admin');insert into auth.sessions(user_id) values('${a}');insert into internal_conversations(id,created_by_user_id,metadata) values('${room}','${a}','{"teamName":"Aces"}');insert into internal_messages(id,conversation_id,sender_user_id,body) values('${message}','${room}','${b}','Keep my message');insert into internal_messages(conversation_id,sender_user_id,body) values('${room}','${a}','Erase my message');insert into internal_conversations(id,created_by_user_id) values('66666666-6666-4666-8666-666666666666','${a}');insert into team_chat_rooms(conversation_id,parent_conversation_id,created_by) values('66666666-6666-4666-8666-666666666666','${room}','${a}');insert into clubs(id,owner_user_id) values('55555555-5555-4555-8555-555555555555','${b}');insert into club_groups(club_id,created_by_user_id) values('55555555-5555-4555-8555-555555555555','${a}');insert into product_usage_events(user_id) values('${a}');`)

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
  await db.query("insert into tiq_tournament_contacts(tournament_id,entrant_name,phone) values('test-erasure','PlayerA','15550000001'),('test-erasure','PlayerB','15550000002')")
  await db.query("insert into tiq_tournament_preference_events(tournament_id,tournament_entry_id,player_name,phone) values('test-erasure','77777777-7777-4777-8777-777777777777','PlayerA','15550000001')")
  await db.query("insert into storage.objects(owner_id,bucket_id,name) values($1,'profile-photos',$1||'/avatar.jpg'),(null,'team-room-files','room/'||$1||'/photo.jpg'),($2,'profile-photos',$2||'/avatar.jpg')",[a,b])

  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role)
   await expect(db.query('select automated_account_erasure($1)',['claim'])).rejects.toThrow()
   await expect(db.query('select account_erasure_blocker($1,$2)',[a,'a@example.test'])).rejects.toThrow()
   await expect(db.query('select * from account_deletion_requests')).rejects.toThrow()
   await db.exec('reset role')
  }
  await db.exec('set role service_role')
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
  expect((await db.query('select body from internal_messages order by body')).rows).toEqual([{body:'Keep my message'},{body:'Keep this reply'}])
  expect((await db.query('select created_by_user_id,metadata from internal_conversations where id=$1',[room])).rows).toEqual([{created_by_user_id:null,metadata:{teamName:'Aces'}}])
  expect((await db.query('select created_by from team_chat_rooms')).rows).toEqual([{created_by:null}])
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

  await db.exec('set role service_role');expect(await action('verify',job.id,lease)).toMatchObject({ok:true})
  expect(await action('complete',job.id,lease)).toMatchObject({ok:true})
  expect((await db.query('select account_id,verified_email,stripe_customer_id,status from account_deletion_requests')).rows).toEqual([{account_id:null,verified_email:null,stripe_customer_id:null,status:'completed'}])
  // A new dependency disables future automated erasure rather than silently extending a cascade.
  await db.exec('reset role');await db.exec('create table unexpected_owner(user_id uuid references auth.users(id) on delete cascade)')
  expect((await db.query<{ok:boolean}>('select account_erasure_catalog_ready() ok')).rows[0].ok).toBe(false)
 }finally{await db.close()}
},30000)
