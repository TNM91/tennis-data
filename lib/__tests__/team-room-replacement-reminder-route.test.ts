import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
const m=vi.hoisted(()=>({create:vi.fn(),push:vi.fn()}))
vi.mock('@supabase/supabase-js',()=>({createClient:m.create}))
vi.mock('@/lib/supabase',()=>({supabaseUrl:'https://synthetic.supabase.co'}))
vi.mock('@/lib/team-room-push-server',()=>({sendTeamRoomPush:m.push}))
import {GET} from '../../app/api/team-rooms/reminders/route'
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('CRON_SECRET','synthetic-cron');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-service');vi.stubEnv('RESEND_API_KEY','')})
afterEach(()=>vi.unstubAllEnvs())
function database(mode='current'){
 const state={metadata:{cardType:'projected_lineup',lineupChangedAt:'2026-10-24T11:00:00Z',lineupChangeNotice:{pending:false,response:'',publishedAnnouncementMessageId:mode==='current'?'old-request':'new-request',replacementPlayerName:'Riley',courtLabel:'D1'}} as Record<string,unknown>,raceOnWrite:false}
 const mutations:{table:string;method:string}[]=[]
 const schedule={id:'schedule',conversation_id:'room',message_id:'card',created_by_user_id:'captain',updated_at:'2026-10-24T10:00:00Z',targets:[{profileId:'old-player',needsLineupChangeResponse:true,needsResponse:mode==='mixed',...(mode!=='legacy'?{lineupChangeRequestId:'old-request'}:{})}]}
 const service={from:(table:string)=>{
  let action='read',payload:Record<string,unknown>={},expected=''
  const result=(single=false)=>{
   if(table==='internal_messages'&&action==='update'){
    if(expected&&expected!==JSON.stringify(state.metadata))return {data:null,error:null}
    state.metadata=payload.metadata as Record<string,unknown>;return {data:{id:'card'},error:null}
   }
   if(table==='team_room_reminder_schedules')return {data:single?{id:'schedule'}:[schedule],error:null}
   if(table==='internal_messages')return {data:{metadata:state.metadata},error:null}
   if(table==='internal_conversations')return {data:{subject:'Aces Team Room',metadata:{}},error:null}
   if(table==='internal_notifications')return {data:[{id:'notification',recipient_profile_id:'old-player'}],error:null}
   return {data:[],error:null}
  }
  const q:Record<string,unknown>={then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(resolve(result())),maybeSingle:async()=>result(true)}
  for(const method of ['select','eq','lte','order','limit','is','filter','update','insert'])q[method]=(...args:unknown[])=>{
   if(method==='filter')expected=String(args[2])
   if(method==='update'||method==='insert'){
    action=method;payload=args[0] as Record<string,unknown>;mutations.push({table,method})
    if(table==='internal_messages'&&method==='update'&&state.raceOnWrite)state.metadata={...state.metadata,newCourt:'Must survive',lineupChangeNotice:{pending:false,response:'',publishedAnnouncementMessageId:'new-request'}}
   }
   return q
  }
  return q
 }}
 m.create.mockReturnValue(service)
 return {state,mutations}
}
const run=()=>GET(new Request('https://local/api/team-rooms/reminders',{headers:{Authorization:'Bearer synthetic-cron'}}))
describe('replacement reminder runner request safety',()=>{
 it.each(['bound','legacy','mixed'])('does not notify or rewrite a new replacement from an old %s schedule',async mode=>{
  const db=database(mode),response=await run();expect(response.status).toBe(200);expect(await response.json()).toMatchObject({notifications:0});expect(m.push).not.toHaveBeenCalled();expect(db.mutations.every(m=>m.table==='team_room_reminder_schedules')).toBe(true)
 })
 it('still sends an unchanged bound reminder and records its status',async()=>{
  const db=database(),response=await run();expect(await response.json()).toMatchObject({notifications:1});expect(m.push).toHaveBeenCalledTimes(1);expect(m.push.mock.calls[0][1]).toEqual(['old-player']);expect(db.state.metadata.lineupChangeNotice).toMatchObject({publishedAnnouncementMessageId:'old-request',deadlineStatus:'reminded'})
 })
 it('does not mark the new request reminded when a replacement changes while the old alert is in flight',async()=>{
  const db=database();m.push.mockImplementationOnce(()=>{db.state.metadata={...db.state.metadata,lineupChangeNotice:{pending:false,response:'',publishedAnnouncementMessageId:'new-request'}}});await run();expect(db.state.metadata.lineupChangeNotice).toEqual({pending:false,response:'',publishedAnnouncementMessageId:'new-request'});expect(db.mutations.filter(m=>m.table==='internal_messages'&&m.method==='update')).toEqual([])
 })
 it('uses metadata CAS to preserve a court changed between the last read and bookkeeping write',async()=>{
  const db=database();db.state.raceOnWrite=true;await run();expect(db.state.metadata.newCourt).toBe('Must survive');expect(db.state.metadata.lineupChangeNotice).toMatchObject({publishedAnnouncementMessageId:'new-request'});expect(db.state.metadata.lineupChangeNotice).not.toHaveProperty('deadlineStatus')
 })
})
