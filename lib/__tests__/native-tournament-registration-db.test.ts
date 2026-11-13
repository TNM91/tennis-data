import {expect,it} from 'vitest'
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import {testflightTournamentId} from '../testflight-tournament'
const organizer='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333'
type Reply={ok:boolean;status?:number;context:Record<string,unknown>;receipt:Record<string,unknown>|null;queue:Record<string,unknown>[];more:boolean;alreadySubmitted?:boolean}
const sql=(name:string)=>readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8')
async function setup(){
 const db=new PGlite()
 await db.exec(await readFile(new URL('./fixtures/account-erasure-audited-schema.sql',import.meta.url),'utf8'))
 await db.exec("create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$")
 for(const name of ['20261028000100_native_account_requests.sql','20261028000200_automated_account_erasure.sql','20261028000300_apple_purchase_records.sql','20261028000400_apple_purchase_erasure_guard.sql'])await db.exec(await sql(name))
 await db.exec("create function public.is_admin() returns boolean language sql stable security definer as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;create function public.can_run_club_competition(uuid) returns boolean language sql stable as $$select false$$;alter table public.api_rate_limits add unique(scope,key_hash,window_started_at);alter table public.tiq_tournament_entries add check(eligibility_status in ('','verified','needs_confirmation','ineligible'));")
 const functions=await sql('20260815000100_prelaunch_entitlements_and_tournament_privacy.sql')
 for(const name of ['consume_api_rate_limit','can_manage_tiq_tournament']){const source=functions.slice(functions.indexOf('create or replace function public.'+name));await db.exec(source.slice(0,source.indexOf('$$;',source.indexOf('as $$'))+3))}
 const desk=await sql('20261008000100_tournament_event_registration_desk.sql');await db.exec(desk.slice(desk.indexOf('create function public.save_'),desk.indexOf("notify pgrst")))
 await db.exec(await sql('20261030000100_native_tournament_registration.sql'))
 await db.exec("grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;revoke all on public.tiq_tournament_entries from authenticated,anon")
 await db.query("insert into auth.users values($1,'organizer@example.test',now()),($2,'member@example.test',now()),($3,'other@example.test',now());",[organizer,member,other])
 await db.query("insert into profiles(id,email,role) values($1,'organizer@example.test','member'),($2,'member@example.test','member'),($3,'other@example.test','member')",[organizer,member,other])
 await db.query("insert into tiq_tournaments(id,name,is_public,is_event,event_id,status,format,entrant_type,created_by_user_id,starts_on,event_details) values('event','Summer Open',true,true,null,'open','single_elimination','players',$1,'2099-06-01','{\"timeZone\":\"America/Chicago\",\"feePerTeam\":30}'),('division','Doubles',true,false,'event','open','single_elimination','teams',$1,'2099-06-01','{}'),('solo','Singles',true,false,null,'open','round_robin','players',$1,'2099-06-01','{}')",[organizer])
 const call=async(who:string|null,action:string|null,data:unknown={},parent='event',division='division')=>{
  await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[who||'']);await db.exec('set role authenticated')
  try{return (await db.query<{r:Reply}>('select public.native_tournament_registration($1,$2,$3,$4) r',[action,parent,division,JSON.stringify(data)])).rows[0].r}finally{await db.exec('reset role')}
 }
 return {db,call}
}
it('limits first-party registration to reviewed metadata and supports receipts across draw revisions',async()=>{
 const {db,call}=await setup()
 try{
  await db.exec(await sql('20261112000800_native_first_party_tournament_entry.sql'))
  await db.exec("update tiq_tournaments set registration_email='director@example.test' where id='event'")
  const publication=(await db.query<{value:object}>(`select jsonb_object_agg(id,to_jsonb(t)) value
    from (select id,event_id,is_event,name,format,entrant_type,status,starts_on,location_label,event_details,is_public,registration_email
      from tiq_tournaments where id in ('event','division')) t`)).rows[0].value
  async function scoped(actor:string, action:string, payload:object={}){
   await db.exec('set role service_role')
   try{return (await db.query<{r:Reply}>("select native_first_party_tournament_registration($1,$2,'event','division',$3,$4) r",
    [actor,action,JSON.stringify(publication),JSON.stringify(payload)])).rows[0].r}
   finally{await db.exec('reset role')}
  }
  expect(await call(member,'review')).toMatchObject({context:{mode:'director'}})
  await db.exec('set role authenticated')
  await expect(db.query("select native_first_party_tournament_registration(null,'review','','division','{}','{}')")).rejects.toThrow(/permission denied/)
  await db.exec('reset role')
  const review=await scoped(member,'review')
  expect(review).toMatchObject({ok:true,context:{owner:member,mode:'native',director:'',playerLocked:false}})
  const draft={revision:review.context.revision,one:'Alex Serve',two:'Sam Return',rating:4,partnerRating:3.5,attested:true,partnerAttested:true}
  await db.exec("update tiq_tournaments set name='Different event' where id='event'")
  expect(await scoped(member,'submit',draft)).toMatchObject({ok:false,status:404})
  await db.exec("update tiq_tournaments set name='Summer Open' where id='event'")
  const saved=await scoped(member,'submit',draft)
  expect(saved).toMatchObject({ok:true,receipt:{status:'pending'}})
  expect(await scoped(other,'queue')).toMatchObject({ok:false,status:403})
  expect(await scoped(other,'review')).toMatchObject({ok:true,receipt:null})
  const queue=await scoped(organizer,'queue')
  expect(await scoped(organizer,'decide',{revision:queue.context.revision,entryId:saved.receipt!.id,
   updatedAt:saved.receipt!.updatedAt,decision:'approve',note:'See you on court.',confirmed:true})).toMatchObject({ok:true,receipt:{status:'approved',inDraw:true}})
  await db.exec("update tiq_tournaments set schedule='{\"r1-m1\":{\"date\":\"2099-06-01\",\"time\":\"10:30\",\"court\":\"2\"}}' where id='division'")
  expect(await scoped(member,'review')).toMatchObject({ok:true,receipt:{status:'approved',inDraw:true}})
 }finally{await db.close()}
},30000)
it('allows only the private fixture owner to submit and approve a demo match',async()=>{
 const {db,call}=await setup()
 const id=testflightTournamentId(member)
 try{
  await db.exec(await sql('20261112000800_native_first_party_tournament_entry.sql'))
  await db.exec(await sql('20261113000100_native_testflight_tournament.sql'))
  await db.query(`insert into tiq_tournaments
   (id,name,is_public,is_event,status,format,entrant_type,created_by_user_id,starts_on,entrants)
   values($1,'TestFlight Doubles Demo',false,false,'open','round_robin','teams',$2,'2099-06-01',
   array['Demo Avery / Demo Robin','Demo Casey / Demo Morgan'])`,[id,member])
  async function scoped(actor:string, action:string, payload:object={}){
   const publication=(await db.query<{value:object}>(`select jsonb_object_agg(id,to_jsonb(t)) value
     from (select id,event_id,is_event,name,format,entrant_type,status,starts_on,location_label,event_details,is_public,registration_email
       from tiq_tournaments where id=$1) t`,[id])).rows[0].value
   await db.exec('set role service_role')
   try{return (await db.query<{r:Reply}>("select native_first_party_tournament_registration($1,$2,'',$3,$4,$5) r",
    [actor,action,id,JSON.stringify(publication),JSON.stringify(payload)])).rows[0].r}
   finally{await db.exec('reset role')}
  }
  expect(await call(member,'review',{},'',id)).toMatchObject({ok:false,status:404})
  expect(await scoped(other,'review')).toMatchObject({ok:false,status:404})
  const review=await scoped(member,'review')
  expect(review).toMatchObject({ok:true,context:{owner:member,mode:'native',canManage:true,paired:true}})
  const saved=await scoped(member,'submit',{revision:review.context.revision,one:'Alex Serve',two:'Sam Return',
   rating:4,partnerRating:3.5,attested:true,partnerAttested:true})
  expect(saved).toMatchObject({ok:true,receipt:{status:'pending'}})
  expect((await db.query('select schedule from tiq_tournaments where id=$1',[id])).rows).toEqual([{schedule:{}}])
  const queue=await scoped(member,'queue')
  expect(queue.queue).toHaveLength(1)
  expect(await scoped(member,'decide',{revision:queue.context.revision,entryId:saved.receipt!.id,
   updatedAt:saved.receipt!.updatedAt,decision:'approve',note:'Demo approved.',confirmed:true}))
   .toMatchObject({ok:true,receipt:{status:'approved',inDraw:true}})
  expect((await db.query('select is_public,status,schedule from tiq_tournaments where id=$1',[id])).rows).toEqual([
   {is_public:false,status:'scheduled',schedule:{'r1-m2':{date:'2099-06-01',time:'10:00',court:'Demo Court 2'}}},
  ])
  expect((await db.query('select id from internal_notifications')).rows).toEqual([])
 }finally{await db.close()}
},30000)
it('ties self-attested requests to the caller, approves once through the existing desk, and keeps private fields out of receipts',async()=>{
 const {db,call}=await setup();try{
  expect((await db.query<{ok:boolean}>('select account_erasure_catalog_ready() ok')).rows[0].ok).toBe(true)
  await db.exec('set role anon');await expect(db.query("select native_tournament_registration('review','event','division')")).rejects.toThrow();await db.exec('reset role')
  await db.exec('set role authenticated');await expect(db.query("select native_tournament_entry_context('event','division')")).rejects.toThrow();await expect(db.query('select * from tiq_tournament_entries')).rejects.toThrow();await db.exec('reset role')
  expect(await call(null,'review')).toMatchObject({ok:false,status:401})
  expect(await call(member,null)).toMatchObject({ok:false,status:400})
  expect(await call(member,'queue')).toMatchObject({ok:false,status:403})
  expect(await call(member,'decide')).toMatchObject({ok:false,status:403})
  const review=await call(member,'review'),draft={revision:review.context.revision,one:'Alex Serve',two:'Sam Return',rating:4,partnerRating:3.5,attested:true,partnerAttested:true}
  for(const invalid of [{...draft,owner:other},{...draft,partnerAttested:false},{...draft,two:'alex serve'},{...draft,rating:4.2},{...draft,attested:'true'},{...draft,one:'A / B'}])expect(await call(member,'submit',invalid)).toMatchObject({ok:false,status:400})
  expect(await call(member,'submit',{...draft,revision:'stale'})).toMatchObject({ok:false,status:409})
  const saved=await call(member,'submit',draft);expect(saved).toMatchObject({ok:true,alreadySubmitted:false,receipt:{status:'pending',name:'Alex Serve / Sam Return',inDraw:false}})
  expect((await db.query("select entrants from tiq_tournaments where id='division'")).rows).toEqual([{entrants:[]}])
  expect(await call(member,'submit',{...draft,revision:'stale',one:'Changed'})).toMatchObject({ok:true,alreadySubmitted:true,receipt:{id:saved.receipt!.id,name:'Alex Serve / Sam Return'}})
  expect((await db.query('select request_count from api_rate_limits')).rows).toEqual([{request_count:1}])
  expect((await db.query('select id from internal_notifications')).rows).toHaveLength(1)
  expect(await call(other,'review')).toMatchObject({ok:true,receipt:null,queue:[]})
  await db.query("update tiq_tournament_entries set email='secret@example.test',phone='15550000000',eligibility_review_note='Internal only' where id=$1",[saved.receipt!.id])
  expect(JSON.stringify(await call(member,'review'))).not.toMatch(/secret|15550000000|Internal only|submitted_by/)
  const queue=await call(organizer,'queue');expect(queue.queue).toHaveLength(1)
  const decision={revision:queue.context.revision,entryId:queue.queue[0].id,updatedAt:queue.queue[0].updatedAt,decision:'approve',note:'Welcome to the draw.',confirmed:true}
  expect(await call(organizer,'decide',{...decision,confirmed:false})).toMatchObject({ok:false,status:409})
  expect(await call(organizer,'decide',{...decision,updatedAt:'2000-01-01T00:00:00Z'})).toMatchObject({ok:false,status:409})
  expect(await call(organizer,'decide',decision)).toMatchObject({ok:true,receipt:{status:'approved',inDraw:true,note:'Welcome to the draw.'}})
  expect(await call(organizer,'decide',decision)).toMatchObject({ok:false,status:409})
  expect((await db.query('select entrant_name,fee_cents,paid_cents,status from tiq_event_registrations')).rows).toEqual([{entrant_name:'Alex Serve / Sam Return',fee_cents:3000,paid_cents:0,status:'confirmed'}])
  expect((await db.query("select eligibility_status,eligibility_rating_source from tiq_tournament_entries")).rows).toEqual([{eligibility_status:'verified',eligibility_rating_source:'self'}])
  expect((await db.query("select entrants from tiq_tournaments where id='division'")).rows).toEqual([{entrants:['Alex Serve / Sam Return']}])
  expect((await db.query('select id from internal_notifications')).rows).toHaveLength(2)
  expect(await call(member,'review')).toMatchObject({receipt:{status:'approved',inDraw:true}})
 }finally{await db.close()}
},30000)
it('rechecks public selection, deadlines, linked names, deletion holds, duplicates and locked fields',async()=>{
 const {db,call}=await setup();try{
  expect(await call(member,'review',{},'','division')).toMatchObject({status:404})
  await db.exec("update tiq_tournaments set is_public=false where id='event'")
  expect(await call(member,'review')).toMatchObject({status:404})
  await db.exec("update tiq_tournaments set is_public=true,registration_email='director@example.test' where id='event'")
  let r=await call(member,'review');expect(r.context.mode).toBe('director')
  const draft={one:'Alex Serve',two:'Sam Return',rating:4,partnerRating:4,attested:true,partnerAttested:true}
  expect(await call(member,'submit',{...draft,revision:r.context.revision})).toMatchObject({status:409})
  await db.exec("update tiq_tournaments set registration_email='',starts_on='2000-01-01' where id='event'")
  expect((await call(member,'review')).context.mode).toBe('closed')
  await db.exec("update tiq_tournaments set starts_on='2099-06-01' where id='event';update tiq_tournaments set schedule='{\"slot\":{\"court\":\"1\"}}' where id='division'")
  expect((await call(member,'review')).context).toMatchObject({mode:'closed',canApprove:false})
  await db.exec("update tiq_tournaments set schedule='{}' where id='division'")
  await db.query("insert into players(id,name) values($1,'Linked Player')",[other]);await db.query("update profiles set linked_player_id=$1 where id=$2",[other,member])
  r=await call(member,'review');expect(r.context).toMatchObject({playerLocked:true,playerName:'Linked Player'})
  expect(await call(member,'submit',{...draft,revision:r.context.revision})).toMatchObject({status:400})
  const saved=await call(member,'submit',{...draft,one:'Linked Player',revision:r.context.revision});expect(saved.ok).toBe(true)
  await db.exec("update tiq_tournaments set entrants=array['Sam Return / Another Player'] where id='division'")
  const q=await call(organizer,'queue'),decision={revision:q.context.revision,entryId:q.queue[0].id,updatedAt:q.queue[0].updatedAt,decision:'approve',note:'Approved',confirmed:true}
  await expect(call(organizer,'decide',decision)).rejects.toThrow(/already registered/)
  expect((await db.query('select status from tiq_tournament_entries')).rows).toEqual([{status:'pending'}])
  expect((await db.query('select id from tiq_event_registrations')).rows).toHaveLength(0)
  expect(await call(organizer,'decide',{...decision,decision:'decline',note:'Please contact the tournament desk.'})).toMatchObject({ok:true,receipt:{status:'declined',inDraw:false}})
  await db.query("insert into account_deletion_requests(account_id,verified_email,status) values($1,'member@example.test','requested')",[member])
  expect(await call(member,'review')).toMatchObject({status:401})
 }finally{await db.close()}
},30000)
it('handles standalone singles, inclusive deadlines, create-only retries, and rate limits without bypassing review',async()=>{
 const {db,call}=await setup();try{
  const single={one:'Alex Serve',two:'',rating:4,partnerRating:null,attested:true,partnerAttested:false}
  await db.exec("update tiq_tournaments set event_details=jsonb_build_object('timeZone','America/Chicago','registrationClosesOn',(clock_timestamp() at time zone 'America/Chicago')::date::text) where id='solo'")
  let r=await call(member,'review',{},'','solo');expect(r.context.mode).toBe('native')
  expect(await call(member,'submit',{...single,revision:r.context.revision},'','solo')).toMatchObject({ok:true,receipt:{status:'pending'}})
  await db.exec("update tiq_tournaments set starts_on='2000-01-01',event_details='{}' where id='solo'")
  expect(await call(member,'submit',{...single,revision:'old'},'','solo')).toMatchObject({ok:true,alreadySubmitted:true})
  let q=await call(organizer,'queue',{},'','solo')
  const data={revision:q.context.revision,entryId:q.queue[0].id,updatedAt:q.queue[0].updatedAt,decision:'approve',note:'Eligibility checked.',confirmed:true}
  expect(await call(organizer,'decide',data,'','solo')).toMatchObject({ok:true,receipt:{inDraw:true,status:'approved'}})
  expect((await db.query('select id from tiq_event_registrations')).rows).toHaveLength(0)
  for(let i=0;i<9;i++){
   await db.query("insert into tiq_tournaments(id,name,is_public,is_event,event_id,status,format,entrant_type,created_by_user_id,starts_on) values($1,'Singles',true,false,null,'open','round_robin','players',$2,'2099-06-01')",['rate'+i,organizer])
   r=await call(member,'review',{},'','rate'+i)
   const result=await call(member,'submit',{...single,revision:r.context.revision},'','rate'+i)
   expect(result).toMatchObject(i<7?{ok:true,receipt:{status:'pending'}}:{ok:false,status:429})
  }
  await db.query("insert into tiq_tournament_entries(tournament_id,player_name,status,submitted_by_user_id) values('division','Legacy Player','pending',$1)",[other])
  expect(await call(other,'review')).toMatchObject({receipt:{legacy:true,name:'Legacy Player'}})
  await db.query("insert into tiq_tournament_entries(tournament_id,player_name,status,submitted_by_user_id) values('division','Second Legacy','pending',$1)",[other])
  expect(await call(other,'review')).toMatchObject({ok:false,status:409})
  q=await call(organizer,'queue');expect(q.queue).toHaveLength(0)
 }finally{await db.close()}
},30000)
it('withholds stale manager decisions, preserves pending state on fee errors and caps the private app queue',async()=>{
 const {db,call}=await setup();try{
  const r=await call(member,'review'),draft={one:'Alex Serve',two:'Sam Return',rating:4,partnerRating:4,attested:true,partnerAttested:true,revision:r.context.revision}
  await call(member,'submit',draft)
  const q=await call(organizer,'queue'),data={revision:q.context.revision,entryId:q.queue[0].id,updatedAt:q.queue[0].updatedAt,decision:'approve',note:'Checked',confirmed:true}
  await db.exec("update tiq_tournaments set event_details='{\"feePerTeam\":\"unknown\"}' where id='event'")
  expect(await call(organizer,'decide',data)).toMatchObject({status:409})
  const fresh=await call(organizer,'queue')
  expect(await call(organizer,'decide',{...data,revision:fresh.context.revision})).toMatchObject({status:409})
  expect((await db.query('select id from tiq_event_registrations')).rows).toHaveLength(0)
  expect((await db.query("select status from tiq_tournament_entries")).rows).toEqual([{status:'pending'}])
  await db.exec("update tiq_tournaments set created_by_user_id=null where id='division'")
  expect(await call(organizer,'decide',data)).toMatchObject({status:403})
  await db.query("update tiq_tournaments set created_by_user_id=$1 where id='division'",[organizer])
  for(let i=0;i<51;i++)await db.query("insert into tiq_tournament_entries(tournament_id,player_name,status,native_registration) values('division',$1,'pending','{\"version\":\"1\",\"one\":\"App Player\",\"two\":\"Partner\",\"rating\":4,\"partnerRating\":4}')",['App Player'+i])
  const bounded=await call(organizer,'queue');expect(bounded.queue).toHaveLength(50);expect(bounded.more).toBe(true)
  expect(await call(other,'review')).toMatchObject({receipt:null,queue:[],more:false})
 }finally{await db.close()}
},30000)
it('rejects unauthorized decisions and private selections before taking tournament row locks',async()=>{
 const {db,call}=await setup();try{
  for(const [who,action,privateEvent] of [[other,'decide',false],[member,'submit',true]] as const){
   if(privateEvent)await db.exec("update tiq_tournaments set is_public=false where id='event'")
   await db.exec('begin')
   expect(await call(who,action)).toMatchObject({ok:false,status:privateEvent?404:403})
   const locks=(await db.query<{locked:boolean}>("select xmax::text=pg_current_xact_id()::text locked from public.tiq_tournaments where id in ('event','division')")).rows
   expect(locks).toEqual([{locked:false},{locked:false}])
   await db.exec('rollback')
  }
 }finally{await db.close()}
},30000)
