import {beforeEach,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {weekFixture} from './fixtures/captain-week-brief'
import {briefWindow,briefFixtures,briefPractices,loadCaptainWeekBrief,checkBriefMatch,checkBriefMatches,type BriefMatchCheck} from '../../mobile/src/captain-week-brief-data'
import {parseTeamFixtures} from '../../mobile/src/team-fixtures-data'
import {matchCenterNext} from '../../mobile/src/captain-match-center-data'
const f=weekFixture(),session=()=>({data:{session:{user:{id:'owner'},access_token:'synthetic'}},error:null}),auth=vi.fn(session),client={auth:{getSession:auth}} as unknown as SupabaseClient
const reads=()=>({workspace:vi.fn(async()=>f.workspace),schedule:vi.fn(async()=>f.schedule),practices:vi.fn(async()=>({practices:[f.practice],more:false}))})
beforeEach(()=>{auth.mockReset();auth.mockImplementation(session)})
it('uses exactly seven calendar dates across DST and year boundaries',()=>{expect(briefWindow('2026-10-31')).toEqual({today:'2026-10-31',through:'2026-11-06'});expect(briefWindow('2026-12-29').through).toBe('2027-01-04');expect(()=>briefWindow('2026-02-30')).toThrow()})
it('caps the loaded match sample, excludes inactive entries and does not extend into day eight',()=>{const raw={...f.schedule,upcoming:[...Array.from({length:10},(_,i)=>({...f.fixture,id:'88888888-8888-4888-8888-'+String(i+1).padStart(12,'0')})),{...f.fixture,id:'88888888-8888-4888-8888-000000000021',status:'Postponed'},{...f.fixture,id:'88888888-8888-4888-8888-000000000022',date:'2026-11-01'}]};const r=briefFixtures(parseTeamFixtures(raw,f.scope));expect(r.matches).toHaveLength(8);expect(r.moreMatches).toBe(true);expect(r.excluded).toBe(1);expect(r.through).toBe('2026-10-31')})
it('keeps proposed/confirmed practices and sample limits distinct from cancellations and completion',()=>{const r=briefPractices({more:true,practices:[f.practice,{...f.practice,id:'cancelled',status:'cancelled'},{...f.practice,id:'complete',status:'completed'},{...f.practice,id:'next',date:'2026-11-01'}]},'owner','2026-10-25');expect(r.practices).toEqual([f.practice]);expect(r.morePractices).toBe(true);expect(()=>briefPractices({more:false,practices:[{...f.practice,owner:'other'}]},'owner','2026-10-25')).toThrow()})
it('checks Captain scope before dependent reads and does not automatically read match readiness',async()=>{const read=reads(),r=await loadCaptainWeekBrief(client,'owner',()=>true,f.scope,read);expect(r).toMatchObject({today:'2026-10-25',through:'2026-10-31',practiceState:'ready',matches:[f.fixture]});for(const fn of Object.values(read))expect(fn).toHaveBeenCalledTimes(1);read.workspace.mockRejectedValue(Error('denied'));read.schedule.mockClear();read.practices.mockClear();await expect(loadCaptainWeekBrief(client,'owner',()=>true,f.scope,read)).rejects.toThrow();expect(read.schedule).not.toHaveBeenCalled();expect(read.practices).not.toHaveBeenCalled()})
it('reports practice failure as unavailable while retaining the confirmed schedule',async()=>{const read=reads();read.practices.mockRejectedValue(Error('private'));expect(await loadCaptainWeekBrief(client,'owner',()=>true,f.scope,read)).toMatchObject({practiceState:'unavailable',practices:[],matches:[f.fixture]})})
it('does not invent a week date when the schedule fails or crosses scope',async()=>{const read=reads();read.schedule.mockRejectedValue(Error('down'));await expect(loadCaptainWeekBrief(client,'owner',()=>true,f.scope,read)).rejects.toThrow();read.schedule.mockResolvedValue({...f.schedule,scope:{...f.scope,flight:'3.5'}});await expect(loadCaptainWeekBrief(client,'owner',()=>true,f.scope,read)).rejects.toThrow()})
it('rejects account changes after reads and closed screens before issuing dependent requests',async()=>{let active=true;const read=reads();read.workspace.mockImplementation(async()=>{active=false;return f.workspace});await expect(loadCaptainWeekBrief(client,'owner',()=>active,f.scope,read)).rejects.toThrow();expect(read.schedule).not.toHaveBeenCalled();auth.mockReset();auth.mockResolvedValueOnce(session()).mockResolvedValueOnce(session()).mockResolvedValueOnce({data:{session:{user:{id:'other'},access_token:'x'}},error:null});await expect(loadCaptainWeekBrief(client,'owner',()=>true,f.scope,reads())).rejects.toThrow()})
it('checks only the chosen exact fixture and rejects changed time, location or status',async()=>{const read=vi.fn(async()=>structuredClone(f.center));expect(await checkBriefMatch(client,'owner',()=>true,f.scope,f.fixture,read)).toMatchObject({fixture:f.fixture});expect(read).toHaveBeenCalledTimes(1);expect(read.mock.calls[0]).toBeDefined();for(const patch of [{time:'20:00'},{facility:'Other'},{status:'Cancelled'}]){read.mockResolvedValueOnce({...f.center,fixture:{...f.fixture,...patch}});await expect(checkBriefMatch(client,'owner',()=>true,f.scope,f.fixture,read)).rejects.toThrow('fixture changed')}})
it('adds logistics before unshared publishing without replacing existing pending/final/proposal priorities',()=>{const c=structuredClone(f.center);c.lineup.plan.arrivalTime='';expect(matchCenterNext(c)).toMatchObject({action:'plan',label:'Add match logistics'});c.publication.shared.pendingFinal=true;expect(matchCenterNext(c).label).toBe('Review pending final update');c.publication.shared.pendingFinal=false;c.publication.shared.alreadyFinal=true;expect(matchCenterNext(c).action).toBe('day');c.publication.shared.alreadyFinal=false;c.publication.shared.active=true;expect(matchCenterNext(c).label).toBe('Check court confirmations')})

it('checks no more than eight matches in order, with one match read in flight',async()=>{
 const fixtures=Array.from({length:10},(_,i)=>({...f.fixture,id:'match-'+i})),results:BriefMatchCheck[]=[];let release!:()=>void,inFlight=0,maximum=0
 const read=vi.fn<typeof checkBriefMatch>(async()=>{inFlight++;maximum=Math.max(maximum,inFlight);if(read.mock.calls.length===1)await new Promise<void>(resolve=>{release=resolve});inFlight--;return structuredClone(f.center)})
 const pending=checkBriefMatches(client,'owner',()=>true,f.scope,fixtures,result=>results.push(result),read)
 expect(read).toHaveBeenCalledTimes(1);release();await pending
 expect(read.mock.calls.map(call=>call[4].id)).toEqual(fixtures.slice(0,8).map(row=>row.id));expect(maximum).toBe(1)
 expect(results.map(result=>[result.fixtureId,result.completed,result.total])).toEqual(fixtures.slice(0,8).map((row,i)=>[row.id,i+1,8]))
})
it('keeps failed match checks separate, continues to the next match and never retries automatically',async()=>{
 const fixtures=[f.fixture,{...f.fixture,id:'second'}],results:BriefMatchCheck[]=[]
 const read=vi.fn<typeof checkBriefMatch>().mockRejectedValueOnce(Error('unavailable')).mockResolvedValueOnce(structuredClone(f.center))
 await checkBriefMatches(client,'owner',()=>true,f.scope,fixtures,result=>results.push(result),read)
 expect(read).toHaveBeenCalledTimes(2);expect(results[0]).toEqual({fixtureId:f.fixture.id,completed:1,total:2,data:null});expect(results[1].data).toEqual(f.center)
})
it('stops before a read and ignores a held response after the caller stops or changes account',async()=>{
 const read=vi.fn<typeof checkBriefMatch>(),results:BriefMatchCheck[]=[]
 await checkBriefMatches(client,'owner',()=>false,f.scope,[f.fixture],result=>results.push(result),read);expect(read).not.toHaveBeenCalled()
 let current=true,release!:(value:typeof f.center)=>void;read.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve}))
 const pending=checkBriefMatches(client,'owner',()=>current,f.scope,[f.fixture,{...f.fixture,id:'second'}],result=>results.push(result),read)
 current=false;release(structuredClone(f.center));await pending
 expect(read).toHaveBeenCalledTimes(1);expect(results).toEqual([])
})
it('preserves completed results while stopping subsequent reads and does not swallow result-handler failures',async()=>{
 let current=true;const fixtures=[f.fixture,{...f.fixture,id:'second'}],results:BriefMatchCheck[]=[],read=vi.fn<typeof checkBriefMatch>().mockResolvedValue(structuredClone(f.center))
 await checkBriefMatches(client,'owner',()=>current,f.scope,fixtures,result=>{results.push(result);current=false},read)
 expect(results).toHaveLength(1);expect(read).toHaveBeenCalledTimes(1)
 read.mockClear();await expect(checkBriefMatches(client,'owner',()=>true,f.scope,fixtures,()=>{throw Error('handler failed')},read)).rejects.toThrow('handler failed');expect(read).toHaveBeenCalledTimes(1)
})
it('rejects duplicate or empty fixture identities before any read and handles an empty week without work',async()=>{
 const read=vi.fn<typeof checkBriefMatch>(),result=vi.fn()
 for(const fixtures of [[f.fixture,f.fixture],[{...f.fixture,id:' '}]])await expect(checkBriefMatches(client,'owner',()=>true,f.scope,fixtures,result,read)).rejects.toThrow('Match identities changed')
 await checkBriefMatches(client,'owner',()=>true,f.scope,[],result,read);expect(read).not.toHaveBeenCalled();expect(result).not.toHaveBeenCalled()
})
it('freezes the displayed fixture and team context for the duration of an explicit week check',async()=>{
 const scope={...f.scope},fixtures=[{...f.fixture},{...f.fixture,id:'second'}];let release!:()=>void
 const read=vi.fn<typeof checkBriefMatch>(async()=>{if(read.mock.calls.length===1)await new Promise<void>(resolve=>{release=resolve});return structuredClone(f.center)})
 const pending=checkBriefMatches(client,'owner',()=>true,scope,fixtures,()=>{},read);scope.flight='Other';fixtures[1].id='changed';release();await pending
 expect(read.mock.calls[1][3]).toEqual(f.scope);expect(read.mock.calls[1][4].id).toBe('second')
})
