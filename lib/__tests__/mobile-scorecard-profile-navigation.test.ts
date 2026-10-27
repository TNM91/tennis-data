import {afterEach,describe,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
const opened=vi.hoisted(()=>vi.fn())
vi.mock('../../mobile/src/roster-player-profile',()=>({openRosterPlayerProfile:opened}))
import {createMatchDetails} from '../../mobile/src/match-details'
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks()})
function fixture(deferred=false){
 let current=true,detail:Record<string,unknown>|null=null,resolve!:(value:unknown)=>void
 const profileButton={dataset:{matchPlayer:'0'},onclick:null as null|(()=>void)},backButton={onclick:null as null|(()=>void)}
 const content={dataset:{},innerHTML:'',querySelectorAll:()=>[profileButton]},history={pushState:vi.fn(),replaceState:vi.fn(),back:vi.fn()}
 const app={dataset:{} as Record<string,string>,querySelector:()=>detail,append:(value:Record<string,unknown>)=>{detail=value}}
 vi.stubGlobal('history',history);vi.stubGlobal('location',{hash:'#match'});vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn(),scrollY:0,scrollTo:vi.fn()})
 vi.stubGlobal('document',{activeElement:null,createElement:()=>({innerHTML:'',isConnected:true,remove:()=>{detail=null},querySelector:(selector:string)=>selector==='#back-matches'?backButton:selector==='h1'?{focus:vi.fn()}:content})})
 const response={data:[{player_id:'canonical',side:'B',seat:1,players:{name:'Opponent'}}],error:null}
 const q={select:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn(),abortSignal:vi.fn(()=>deferred?new Promise(r=>{resolve=r}):Promise.resolve(response))}
 for(const method of [q.select,q.eq,q.order,q.limit])method.mockReturnValue(q)
 const child={isOpen:()=>true,back:vi.fn(),dispose:vi.fn()};opened.mockReturnValue(child)
 const controller=createMatchDetails(app as unknown as HTMLElement,{from:()=>q} as unknown as SupabaseClient,()=>current)
 controller.open({id:'match',match_date:'2026-10-25',match_type:'Singles',league_name:'City',score:'6-4 6-3',winner_side:'A',match_players:[{player_id:'me',side:'A'}]},'me')
 return {controller,content,profileButton,child,history,q,closeVisit:()=>{current=false},finish:()=>resolve(response)}
}
describe('scorecard child profiles',()=>{
 it('opens the exact selected participant and gives the child a match-specific return label',async()=>{
  const f=fixture();await Promise.resolve();f.profileButton.onclick!()
  expect(opened.mock.calls[0][1]).toEqual({id:'canonical',name:'Opponent',location:null,flight:null});expect(opened.mock.calls[0][3]).toBe('Back to match details');expect(opened.mock.calls[0][2]()).toBe(true)
 })
 it('routes Back into the child before leaving the match',async()=>{
  const f=fixture();await Promise.resolve();f.profileButton.onclick!();expect(f.controller.back()).toBe(true);expect(f.child.back).toHaveBeenCalledOnce();expect(f.history.back).not.toHaveBeenCalled()
 })
 it('disposes the child with its parent and invalidates its visit guard',async()=>{
  const f=fixture();await Promise.resolve();f.profileButton.onclick!();const current=opened.mock.calls[0][2];f.controller.dispose();expect(f.child.dispose).toHaveBeenCalledOnce();expect(current()).toBe(false);f.profileButton.onclick!();expect(opened).toHaveBeenCalledOnce()
 })
 it('does not open a profile after the account/visit changes',async()=>{
  const f=fixture();await Promise.resolve();f.closeVisit();f.profileButton.onclick!();expect(opened).not.toHaveBeenCalled()
 })
 it('discards late participant reads after parent disposal',async()=>{
  const f=fixture(true);f.controller.dispose();f.finish();await Promise.resolve();expect(f.profileButton.onclick).toBeNull();expect(opened).not.toHaveBeenCalled()
 })
 it('reuses the bounded participant query without a profile read until tapped',async()=>{
  const f=fixture();await Promise.resolve();expect(f.q.eq).toHaveBeenCalledWith('match_id','match');expect(f.q.limit).toHaveBeenCalledWith(8);expect(f.q.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));expect(opened).not.toHaveBeenCalled()
 })
})
