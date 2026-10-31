import {describe,it,expect,vi,afterEach} from 'vitest'
import {createClient} from '@supabase/supabase-js'
vi.mock('server-only',()=>({}))
vi.mock('../mobile-account-auth',()=>({verifiedAccount:vi.fn(),accountClient:vi.fn()}))
import {nativeCalendarPractices} from '../native-calendar-practices'
import {verifiedAccount,accountClient} from '../mobile-account-auth'
import {GET} from '../../app/api/mobile/calendar/practices/route'
const owner='11111111-1111-4111-8111-111111111111',room='22222222-2222-4222-8222-222222222222',event='44444444-4444-4444-8444-444444444444',person='55555555-5555-4555-8555-555555555555',invite='66666666-6666-4666-8666-666666666666',other='77777777-7777-4777-8777-777777777777',captain='88888888-8888-4888-8888-888888888888'
const scope={teamName:'Aces',leagueName:'City',flight:'4.0'},range={from:'2026-10-26',to:'2026-11-01'},stamp='2026-10-31T10:00:00.123456+00:00'
function fixture(){
 const own=[{id:person,event_id:event,invite_id:invite,profile_id:owner,event:{id:event,event_type:'captain_practice',title:'Return + first ball',scheduled_date:'2026-10-31',scheduled_time:'18:00',facility:'Court 2',status:'confirmed',metadata:{...scope,practiceEndTime:'20:15',publicToken:'private-token',practiceNotes:'Private coaching notes'},created_by_user_id:captain as string|null}}]
 const links=[{profile_user_id:owner,normalized_team_name:'aces',league_name:'City',flight:'4.0' as string|null,status:'accepted',archived_at:null as string|null}]
 const rooms=[{id:room,related_entity_type:'team_room',related_entity_id:'aces__city__4 0',status:'open'}]
 const participants=[{profile_id:owner,conversation_id:room}],removals:{profile_id:string;conversation_id:string}[]=[]
 const invites=[{id:invite,event_id:event,capacity:1 as number|null,created_by_user_id:captain as string|null}]
 const people=[{id:person,event_id:event,invite_id:invite,response_status:'in',responded_at:stamp,captain_confirmed_at:null as string|null,updated_at:stamp}]
 const calls:{url:URL;method:string}[]=[],errors=new Set<string>()
 const client=createClient('https://practice-calendar.example.test','synthetic-service-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input)),method=init?.method||'GET';calls.push({url,method});if(method!=='GET')throw Error('Unexpected write')
  const table=url.pathname.split('/').at(-1)!,rows=table==='captain_practice_invitees'?(url.searchParams.get('select')?.includes('event:')?own:people):({team_profile_links:links,internal_conversations:rooms,internal_conversation_participants:participants,team_room_member_removals:removals,captain_practice_invites:invites} as Record<string,unknown>)[table]
  return new Response(JSON.stringify(errors.has(table)?{message:'Synthetic unavailable'}:rows),{status:errors.has(table)?503:200,headers:{'Content-Type':'application/json'}})
 }}})
 return {client,own,links,rooms,participants,removals,invites,people,calls,errors}
}
afterEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs()})

describe('owned team practices in Calendar',()=>{
 it('filters owned invitations by date in the database, checks current access in batches and returns no roster/contact/notes/token fields',async()=>{
  const f=fixture();f.links.push({...f.links[0],flight:null});const reply=await nativeCalendarPractices(f.client,owner,range)
  expect(reply).toEqual({owner,range,practices:[{id:event,title:'Return + first ball',date:'2026-10-31',time:'18:00',endTime:'20:15',location:'Court 2',status:'confirmed',response:'in',captainConfirmed:false,scope}]})
  expect(f.calls).toHaveLength(7);expect(f.calls.every(c=>c.method==='GET')).toBe(true)
  const q=f.calls[0].url.searchParams;expect(q.get('profile_id')).toBe('eq.'+owner);expect(q.get('select')).toContain('event:internal_schedule_events!inner(');expect(q.get('event.scheduled_date')).toBe('gte.2026-10-26');expect(q.getAll('event.scheduled_date')).toEqual(['gte.2026-10-26','lte.2026-11-01']);expect(q.get('event.event_type')).toBe('eq.captain_practice');expect(q.get('limit')).toBe('101')
  expect(f.calls.find(c=>c.url.pathname.endsWith('/team_profile_links'))!.url.searchParams.get('status')).toBe('eq.accepted')
  const text=JSON.stringify(reply);for(const secret of ['private-token','Private coaching notes','profile_id','personId','capacity','phone','note'])expect(text).not.toContain(secret)
 })
 it('uses existing RSVP queue and captain-confirmation rules for the current player',async()=>{
  const f=fixture();f.people.unshift({...f.people[0],id:other,responded_at:'2026-10-30T10:00:00Z'})
  expect((await nativeCalendarPractices(f.client,owner,range)).practices[0].response).toBe('waitlist')
  f.people.find(p=>p.id===person)!.captain_confirmed_at=stamp
  expect((await nativeCalendarPractices(f.client,owner,range)).practices[0]).toMatchObject({response:'in',captainConfirmed:true})
 })
 it('excludes removed, closed, unlinked, archived and ambiguously linked scopes before reading RSVP rosters',async()=>{
  for(const change of [(f:ReturnType<typeof fixture>)=>f.removals.push({profile_id:owner,conversation_id:room}),(f:ReturnType<typeof fixture>)=>f.participants.splice(0),(f:ReturnType<typeof fixture>)=>{f.rooms[0].status='closed'},(f:ReturnType<typeof fixture>)=>f.links.splice(0),(f:ReturnType<typeof fixture>)=>{f.links[0].archived_at=stamp},(f:ReturnType<typeof fixture>)=>f.links.push({...f.links[0]})]){
   const f=fixture();change(f)
   // A server returning an archived row despite the filter is a source fault, never accessible data.
   if(f.links[0]?.archived_at)await expect(nativeCalendarPractices(f.client,owner,range)).rejects.toThrow()
   else expect((await nativeCalendarPractices(f.client,owner,range)).practices).toEqual([])
   expect(f.calls.some(c=>c.url.pathname.endsWith('/captain_practice_invites'))).toBe(false)
  }
 })
 it('keeps full league/flight scope and rejects malformed/cross-account join rows and duplicate invitations',async()=>{
  const different=fixture();different.links[0].flight='4.5';expect((await nativeCalendarPractices(different.client,owner,range)).practices).toEqual([])
  for(const change of [(f:ReturnType<typeof fixture>)=>{f.own[0].profile_id=other},(f:ReturnType<typeof fixture>)=>f.own.push({...f.own[0]}),(f:ReturnType<typeof fixture>)=>{f.own[0].event.id=other},(f:ReturnType<typeof fixture>)=>{f.own[0].event.scheduled_date='2026-11-02'},(f:ReturnType<typeof fixture>)=>{f.own[0].event.metadata.leagueName='Elsewhere'},(f:ReturnType<typeof fixture>)=>{f.invites[0].created_by_user_id=other},(f:ReturnType<typeof fixture>)=>{f.people[0].invite_id=other},(f:ReturnType<typeof fixture>)=>{f.people[0].response_status='bad'}]){
   const f=fixture();change(f)
   if(f.own[0].event.metadata.leagueName==='Elsewhere')expect((await nativeCalendarPractices(f.client,owner,range)).practices).toEqual([])
   else await expect(nativeCalendarPractices(f.client,owner,range)).rejects.toThrow()
  }
 })
 it('fails closed on source outages and overflow instead of silently publishing incomplete calendar dates',async()=>{
  const broken=fixture();broken.errors.add('team_room_member_removals');await expect(nativeCalendarPractices(broken.client,owner,range)).rejects.toThrow()
  const tooMany=fixture();tooMany.own.push(...Array(100).fill(tooMany.own[0]));await expect(nativeCalendarPractices(tooMany.client,owner,range)).rejects.toThrow()
  const links=fixture();links.links.push(...Array(50).fill(links.links[0]));await expect(nativeCalendarPractices(links.client,owner,range)).rejects.toThrow()
  const roster=fixture();roster.people.push(...Array(5000).fill(roster.people[0]));await expect(nativeCalendarPractices(roster.client,owner,range)).rejects.toThrow()
 })
 it('preserves retained practices with a deleted author and includes cancelled dates without creating memberships',async()=>{
  const f=fixture();f.own[0].event.created_by_user_id=null;f.invites[0].created_by_user_id=null;f.own[0].event.status='cancelled'
  expect((await nativeCalendarPractices(f.client,owner,range)).practices[0].status).toBe('cancelled')
  const empty=fixture();empty.own.splice(0);expect((await nativeCalendarPractices(empty.client,owner,range)).practices).toEqual([]);expect(empty.calls).toHaveLength(1)
 })
 it('keeps a fixed query count when more practices are included in the same date window',async()=>{
  const f=fixture();f.own.push({...f.own[0],id:other,event_id:other,invite_id:other,event:{...f.own[0].event,id:other}});f.invites.push({...f.invites[0],id:other,event_id:other});f.people.push({...f.people[0],id:other,event_id:other,invite_id:other})
  expect((await nativeCalendarPractices(f.client,owner,range)).practices).toHaveLength(2);expect(f.calls).toHaveLength(7)
 })
 it('authenticates before reading, rejects owner/duplicate/range overrides and returns private bounded data',async()=>{
  vi.mocked(verifiedAccount).mockResolvedValue(null);expect((await GET(new Request('https://www.tenaceiq.com/api/mobile/calendar/practices?owner='+owner))).status).toBe(401);expect(accountClient).not.toHaveBeenCalled()
  vi.mocked(verifiedAccount).mockResolvedValue({user:{id:owner}} as never)
  for(const query of ['from=2026-10-26&to=2026-11-01&owner=other','from=2026-10-26&from=2026-10-27&to=2026-11-01','from=2026-01-01&to=2026-11-01'])expect((await GET(new Request('https://www.tenaceiq.com/api/mobile/calendar/practices?'+query))).status).toBe(400)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-service-key');vi.mocked(accountClient).mockReturnValue(fixture().client)
  const response=await GET(new Request('https://www.tenaceiq.com/api/mobile/calendar/practices?'+new URLSearchParams(range)));expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(response.headers.get('referrer-policy')).toBe('no-referrer');expect(await response.json()).toMatchObject({ok:true,owner,practices:[{id:event}]})
 })
})
