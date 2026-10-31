import {beforeEach,describe,it,expect,vi} from 'vitest'
const state=vi.hoisted(()=>({verified:true,owner:'11111111-1111-4111-8111-111111111111',client:{}}))
vi.mock('../mobile-account-auth',async original=>({...await original<typeof import('../mobile-account-auth')>(),verifiedAccount:async()=>state.verified?{user:{id:state.owner},token:'test-token'}:null,accountClient:()=>state.client}))
vi.mock('../supabase-public-config',()=>({supabaseKey:'test-key'}))
vi.mock('../native-calendar',async original=>({...await original<typeof import('../native-calendar')>(),loadNativeCalendar:vi.fn(),calendarPersonal:vi.fn(),writeCalendarPersonal:vi.fn(),respondNativeCalendar:vi.fn()}))
import {GET,POST} from '../../app/api/mobile/calendar/route'
import {CalendarFault,loadNativeCalendar,calendarPersonal,writeCalendarPersonal,respondNativeCalendar} from '../native-calendar'
const base='https://synthetic.invalid/api/mobile/calendar',window='?from=2026-10-26&to=2026-11-01'
const draft={id:'player-calendar-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'Practice',date:'2026-10-31',time:'',location:'',kind:'practice',recurrenceRule:'',availabilityStatus:'',venueDirectoryId:'',venuePreferenceId:''}
const post=(body:unknown,query='',type='application/json')=>new Request(base+query,{method:'POST',headers:{'Content-Type':type},body:JSON.stringify(body)})
beforeEach(()=>{state.verified=true;vi.clearAllMocks();vi.mocked(loadNativeCalendar).mockResolvedValue({owner:state.owner,range:{from:'2026-10-26',to:'2026-11-01'},personal:[],competitions:[],coach:[],warnings:[]});vi.mocked(calendarPersonal).mockResolvedValue(null);vi.mocked(writeCalendarPersonal).mockResolvedValue({item:null})})
describe('native calendar API boundaries',()=>{
 it('requires a verified account for reads and writes and makes private responses non-cacheable',async()=>{
  state.verified=false
  for(const r of [await GET(new Request(base+window)),await POST(post({action:'create',item:draft}))]){expect(r.status).toBe(401);expect(r.headers.get('Cache-Control')).toBe('private, no-store');expect(r.headers.get('Referrer-Policy')).toBe('no-referrer')}
  expect(loadNativeCalendar).not.toHaveBeenCalled();expect(writeCalendarPersonal).not.toHaveBeenCalled()
 })
 it('binds range and exact-record recovery to the verified owner',async()=>{
  const result=await GET(new Request(base+window));expect(result.status).toBe(200);expect(loadNativeCalendar).toHaveBeenCalledWith(state.client,state.owner,{from:'2026-10-26',to:'2026-11-01'})
  expect((await (await GET(new Request(base+'?item='+draft.id))).json()).item).toBeNull();expect(calendarPersonal).toHaveBeenCalledWith(state.client,state.owner,draft.id)
 })
 it('rejects duplicate, injected and excessive ranges, wrong content types and oversized writes',async()=>{
  for(const query of [window+'&from=2026-10-25',window+'&owner=other',window+'&item=x','?from=2026-01-01&to=2026-12-31','?item=x&to=2026-10-31','?from=2026-02-30&to=2026-03-01'])expect((await GET(new Request(base+query))).status).toBe(400)
  for(const r of [post({action:'create',item:draft},'', 'text/plain'),post({action:'create',item:draft},window),post({action:'create',item:{...draft,player_user_id:'foreign'}}),post({action:'create',item:{...draft,title:'x'.repeat(15000)}})])expect((await POST(r)).status).toBe(400)
  expect(writeCalendarPersonal).not.toHaveBeenCalled()
 })
 it('accepts strict reviewed intents and does not leak database diagnostics on failure',async()=>{
  const request={action:'create',item:draft,expectedUpdatedAt:''};expect((await POST(post(request))).status).toBe(200);expect(writeCalendarPersonal).toHaveBeenCalledWith(state.client,state.owner,request)
  vi.mocked(writeCalendarPersonal).mockRejectedValueOnce(new CalendarFault(409,'This date changed.'));expect((await POST(post(request))).status).toBe(409)
  vi.mocked(writeCalendarPersonal).mockRejectedValueOnce(Error('private SQL table password diagnostic'));const failed=await POST(post(request));expect(failed.status).toBe(503);expect(await failed.text()).not.toContain('password')
  expect(respondNativeCalendar).not.toHaveBeenCalled()
 })
})
