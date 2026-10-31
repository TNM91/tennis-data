import {describe,it,expect,vi} from 'vitest'
import {createClient} from '@supabase/supabase-js'
import {calendarDraft,calendarIntent,calendarRange,personalDraft,type NativeCalendar} from '../native-calendar-contract'
import {calendarWindow,calendarOccurrences,calendarExport,readCalendar,calendarRequest} from '../../mobile/src/calendar-data'
import {writeCalendarPersonal,loadNativeCalendar,respondNativeCalendar} from '../native-calendar'
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',stamp='2026-10-31T10:00:00.123456+00:00'
const draft=()=>({id:'player-calendar-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'Serve + first ball',date:'2026-10-31',time:'18:00',location:'Court 2',kind:'practice' as const,recurrenceRule:'' as const,availabilityStatus:'' as const,venueDirectoryId:'',venuePreferenceId:''})
const item=()=>({...draft(),createdAt:stamp,updatedAt:stamp})
const snapshot=():NativeCalendar=>({owner,range:{from:'2026-10-26',to:'2026-11-01'},personal:[item()],competitions:[],coach:[],warnings:[]})
const row=()=>({id:draft().id,player_user_id:owner,title:draft().title,scheduled_date:draft().date,scheduled_time:draft().time,location:draft().location,kind:'practice',recurrence_rule:'',availability_status:'',venue_directory_id:null,venue_preference_id:null,created_at:stamp,updated_at:stamp})
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
function db(reply:(call:{url:URL;method:string;body:Record<string,unknown>|null;headers:Headers})=>Response){const calls:{url:URL;method:string;body:Record<string,unknown>|null;headers:Headers}[]=[];const client=createClient('https://calendar.example.test','synthetic-anon',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{const call={url:new URL(String(input)),method:init?.method||'GET',body:init?.body?JSON.parse(String(init.body)):null,headers:new Headers(init?.headers)};calls.push(call);return reply(call)}}});return {client,calls}}
describe('native calendar intent and recurrence',()=>{
 it('rejects impossible dates, oversized ranges and owner/permission fields',()=>{
  for(const value of [{...draft(),date:'2026-02-30'},{...draft(),time:'24:00'},{...draft(),kind:'team'},{...draft(),recurrenceRule:'FREQ=SECONDLY'},{...draft(),title:'x'.repeat(161)},{...draft(),player_user_id:other},{...draft(),availabilityStatus:'available'}])expect(()=>calendarDraft(value)).toThrow()
  expect(()=>calendarRange('2026-01-01','2026-03-04')).toThrow();expect(()=>calendarRange('2026-02-01','2026-01-01')).toThrow()
  expect(()=>calendarIntent({action:'create',item:{...draft(),id:'someone-elses-id'}})).toThrow()
  expect(()=>calendarIntent({action:'update',item:draft(),expectedUpdatedAt:'today'})).toThrow()
  expect(calendarIntent({action:'update',item:draft(),expectedUpdatedAt:stamp})).toMatchObject({expectedUpdatedAt:stamp})
 })
 it('uses Monday weeks and leap-year months without local DST arithmetic',()=>{
  expect(calendarWindow('2026-11-01','week')).toEqual({from:'2026-10-26',to:'2026-11-01'})
  expect(calendarWindow('2028-02-25','month')).toEqual({from:'2028-02-01',to:'2028-02-29'})
  const c=snapshot();c.range={from:'2026-10-30',to:'2026-11-03'};c.personal=[{...item(),date:'2020-01-01',recurrenceRule:'FREQ=DAILY'}]
  expect(calendarOccurrences(c).map(e=>e.date)).toEqual(['2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03'])
 })
 it('expands monthly anchors only on valid days and never repeats a one-off',()=>{
  const c=snapshot();c.personal=[{...item(),date:'2026-01-31',recurrenceRule:'FREQ=MONTHLY'}];c.range={from:'2026-02-01',to:'2026-03-31'}
  expect(calendarOccurrences(c).map(e=>e.date)).toEqual(['2026-03-31'])
  c.personal=[{...item(),date:'2026-10-24',recurrenceRule:'FREQ=WEEKLY'},item()];c.range={from:'2026-10-26',to:'2026-11-08'};expect(calendarOccurrences(c)).toHaveLength(3)
 })
 it('exports shown occurrences without URLs, recurrence rules or calendar permissions',()=>{
  const c=snapshot();c.coach=[{id:'lesson-1',title:'Lesson, return',date:'2026-10-31',time:'10:00',location:'Court 1',kind:'lesson',detail:'First line\nSecond line'}];c.personal=[{...item(),time:'',recurrenceRule:'FREQ=DAILY'}]
  const feed=calendarExport(calendarOccurrences(c),'America/Chicago')
  expect(feed).toContain('DTSTART;VALUE=DATE:20261031');expect(feed).toContain('DTEND;TZID=America/Chicago:20261031T110000');expect(feed).toContain('Lesson\\, return');expect(feed).toContain('First line\\nSecond line');expect(feed).not.toContain('URL:');expect(feed).not.toContain('RRULE:')
  expect(()=>calendarExport([],"America/Chicago\r\nATTENDEE:evil")).toThrow()
 })
 it('checks owner, range, unique records, revisions and source flags before display',()=>{
  const c=snapshot();expect(readCalendar({ok:true,...c},owner,c.range).personal).toHaveLength(1)
  for(const change of [{owner:other},{range:{from:'2020-01-01',to:'2020-02-01'}},{personal:[item(),item()]},{personal:[{...item(),updatedAt:'x'}]},{coach:[{id:'x',date:'2020-01-01'}]}])expect(()=>readCalendar({ok:true,...c,...change},owner,c.range)).toThrow()
 })
})
describe('calendar transport and owned writes',()=>{
 it('pins the original token, disables redirects, and rejects an account switch after transport',async()=>{
  const c=db(()=>json([]));const session=vi.spyOn(c.client.auth,'getSession').mockResolvedValue({data:{session:{user:{id:owner},access_token:'token-A'}},error:null} as never)
  const send=vi.fn(async(options:import('@capacitor/core').HttpOptions)=>({status:200,data:{ok:true,...snapshot()},headers:{},url:options.url}));await calendarRequest(c.client,owner,()=>true,snapshot().range,undefined,send)
  expect(send.mock.calls[0][0]).toMatchObject({disableRedirects:true,headers:{Authorization:'Bearer token-A','Cache-Control':'no-store'},readTimeout:30000})
  send.mockImplementation(async()=>{session.mockResolvedValue({data:{session:{user:{id:other},access_token:'token-B'}},error:null} as never);return {status:200,data:{ok:true,...snapshot()},headers:{},url:''}})
  await expect(calendarRequest(c.client,owner,()=>true,{},undefined,send)).rejects.toThrow('Sign in again')
 })
 it('does not send from an expired view or treat an HTTP error as saved',async()=>{
  const c=db(()=>json([]));vi.spyOn(c.client.auth,'getSession').mockResolvedValue({data:{session:{user:{id:owner},access_token:'token-A'}},error:null} as never)
  const send=vi.fn(async(options:import('@capacitor/core').HttpOptions)=>({status:409,data:{ok:false},headers:{},url:options.url}));await expect(calendarRequest(c.client,owner,()=>false,{},undefined,send)).rejects.toThrow();expect(send).not.toHaveBeenCalled();await expect(calendarRequest(c.client,owner,()=>true,{},undefined,send)).rejects.toThrow('date changed')
 })
 it('creates once, confirms owned read-back, and replays the same ID without duplicating',async()=>{
  let saved:ReturnType<typeof row>|null=null
  const h=db(call=>{if(call.method==='POST'){saved={...row(),...call.body} as ReturnType<typeof row>;return json(null,201)}return json(saved)})
  const result=await writeCalendarPersonal(h.client,owner,{action:'create',item:draft(),expectedUpdatedAt:''});expect(personalDraft(result.item!)).toEqual(draft())
  await writeCalendarPersonal(h.client,owner,{action:'create',item:draft(),expectedUpdatedAt:''});expect(h.calls.filter(c=>c.method==='POST')).toHaveLength(1)
  for(const c of h.calls.filter(c=>c.method==='GET'))expect(c.url.searchParams.get('player_user_id')).toBe('eq.'+owner)
  expect(h.calls.find(c=>c.method==='POST')?.body?.player_user_id).toBe(owner)
 })
 it('protects an edited record with its full PostgreSQL revision and detects empty updates',async()=>{
  const h=db(call=>json(call.method==='PATCH'?[]:row()));await expect(writeCalendarPersonal(h.client,owner,{action:'update',item:{...draft(),title:'New title'},expectedUpdatedAt:stamp})).rejects.toMatchObject({status:409})
  const patch=h.calls.find(c=>c.method==='PATCH')!;expect(patch.url.searchParams.get('updated_at')).toBe('eq.'+stamp);expect(patch.url.searchParams.get('player_user_id')).toBe('eq.'+owner)
  expect(patch.body?.updated_at).not.toBe(stamp)
 })
 it('rejects stale edits/deletes and foreign read-backs before any mutation',async()=>{
  for(const action of ['update','delete'] as const){const h=db(()=>json(row()));await expect(writeCalendarPersonal(h.client,owner,action==='update'?{action,item:{...draft(),title:'Change'},expectedUpdatedAt:'2020-01-01T00:00:00Z'}:{action,id:draft().id,expectedUpdatedAt:'2020-01-01T00:00:00Z'})).rejects.toMatchObject({status:409});expect(h.calls.every(c=>c.method==='GET')).toBe(true)}
  const foreign=db(()=>json({...row(),player_user_id:other}));await expect(writeCalendarPersonal(foreign.client,owner,{action:'delete',id:draft().id,expectedUpdatedAt:stamp})).rejects.toThrow('owner changed')
 })
 it('confirms deletion is absent and never claims a failed personal source is empty',async()=>{
  let removed=false;const h=db(c=>{if(c.method==='DELETE'){removed=true;return json([{id:draft().id}])}return json(removed?null:row())})
  expect(await writeCalendarPersonal(h.client,owner,{action:'delete',id:draft().id,expectedUpdatedAt:stamp})).toEqual({item:null})
  const bad=db(c=>c.url.pathname.endsWith('player_calendar_items')?json({message:'outage'},400):json([]));await expect(loadNativeCalendar(bad.client,owner,snapshot().range)).rejects.toThrow('Personal calendar unavailable')
 })
 it('keeps personal dates usable and labels failed competition/Coach sources',async()=>{
  const h=db(c=>c.url.pathname.endsWith('player_calendar_items')?json([row()]):json({message:'unavailable'},400));const result=await loadNativeCalendar(h.client,owner,snapshot().range);expect(result.personal).toHaveLength(1);expect(result.warnings).toHaveLength(2);expect(h.calls[0].url.searchParams.get('limit')).toBe('501');expect(h.calls[0].url.searchParams.get('or')).toContain('FREQ=WEEKLY')
 })
 it('refuses availability for an absent/unapproved event before writing any reply',async()=>{
  const h=db(()=>json([]));await expect(respondNativeCalendar(h.client,owner,{action:'respond',eventId:'league:x:y',response:'available',snapshot:{title:'Match',date:'2026-10-31',time:'18:00',location:'Court'},expectedResponseUpdatedAt:'',requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})).rejects.toMatchObject({status:409});expect(h.calls.every(c=>c.method==='GET')).toBe(true)
 })
 it('checks the reviewed schedule, saves one owned reply, and sends at most one organizer alert on replay',async()=>{
  let saved:Record<string,unknown>|null=null
  const eventId='league:city:match-one',review={title:'City League: vs Riverside',date:'2026-10-31',time:'18:00',location:'Court 2'}
  const h=db(c=>{
   const table=c.url.pathname.split('/').at(-1)
   if(table==='player_schedule_responses'){
    if(c.method==='POST'){saved={id:'reply-one',...c.body};return json(null,201)}
    return json(c.url.searchParams.has('competition_kind')?saved:saved?[saved]:[])
   }
   if(table==='tiq_tournament_entries')return json([])
   if(table==='tiq_player_league_entries')return json(c.url.searchParams.get('select')==='player_name'?{player_name:'Jordan'}:[{id:'entry-one',league_id:'city',player_name:'Jordan',player_id:'player-one',created_by_user_id:owner}])
   if(table==='tiq_leagues')return json(c.url.searchParams.get('select')==='created_by_user_id'?{created_by_user_id:other}:[{id:'city',league_name:'City League',season_label:'Fall',starts_on:'2026-10-01',location_label:'Court 2',default_facility:'Court 2'}])
   if(table==='tiq_league_schedule_items')return json([{id:'match-one',league_id:'city',participant_a_name:'Jordan',participant_a_id:'player-one',participant_b_name:'Riverside',scheduled_date:review.date,scheduled_time:review.time,facility:review.location,status:'confirmed',notes:''}])
   if(table==='internal_notifications')return json(null,201)
   return json([])
  })
  const intent={action:'respond' as const,eventId,response:'available' as const,snapshot:review,expectedResponseUpdatedAt:'',requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}
  await expect(respondNativeCalendar(h.client,owner,{...intent,snapshot:{...review,time:'17:00'}})).rejects.toMatchObject({status:409});expect(h.calls.every(c=>c.method==='GET')).toBe(true)
  expect(await respondNativeCalendar(h.client,owner,intent)).toMatchObject({eventId,response:'available',warning:''})
  await respondNativeCalendar(h.client,owner,intent)
  expect(h.calls.filter(c=>c.method==='POST'&&c.url.pathname.endsWith('player_schedule_responses'))).toHaveLength(1)
  const alerts=h.calls.filter(c=>c.url.pathname.endsWith('internal_notifications'));expect(alerts).toHaveLength(1);expect(alerts[0].body).toMatchObject({id:intent.requestId,recipient_profile_id:other,actor_user_id:owner})
  const replyReads=h.calls.filter(c=>c.url.pathname.endsWith('player_schedule_responses')&&c.method==='GET');expect(replyReads.every(c=>c.url.searchParams.get('player_user_id')==='eq.'+owner)).toBe(true)
  await expect(respondNativeCalendar(h.client,owner,{...intent,response:'unavailable'})).rejects.toMatchObject({status:409})
 })
})
