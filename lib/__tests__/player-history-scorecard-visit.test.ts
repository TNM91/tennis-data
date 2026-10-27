import {afterEach,describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {RecentMatchRow} from '../../mobile/src/recent-results'
const state=vi.hoisted(()=>({render:vi.fn(),unmount:vi.fn(),load:vi.fn()}))
vi.mock('react-dom/client',()=>({createRoot:()=>({render:state.render,unmount:state.unmount})}))
vi.mock('../../mobile/src/player-performance-data',async original=>({...await original<typeof import('../../mobile/src/player-performance-data')>(),loadPlayerPerformance:state.load}))
import {showPlayerPerformance} from '../../mobile/src/player-performance-view'
const row:RecentMatchRow={id:'match',match_date:'2025-10-20',match_type:'singles',score:'6-4 6-3',winner_side:'B',league_name:null,match_players:[{player_id:'selected',side:'A'}]}
afterEach(()=>vi.clearAllMocks())
async function fixture(){let current=true;state.load.mockResolvedValue({matches:[],snapshots:[],matchesLimited:false,ratingsLimited:false});const host={isConnected:true,innerHTML:'',replaceChildren:vi.fn()},open=vi.fn(),controller=showPlayerPerformance(host as unknown as HTMLElement,{} as SupabaseClient,'selected',()=>current,undefined,undefined,undefined,'Selected',open);await Promise.resolve();return {controller,open,closeVisit:()=>{current=false},props:()=>state.render.mock.calls.at(-1)![0].props as {onOpenScorecard:(row:RecentMatchRow)=>void;onRefresh:()=>void}}}
describe('public history scorecard visit guards',()=>{
 it('opens the selected loaded scorecard only during the current player visit',async()=>{const f=await fixture(),open=f.props().onOpenScorecard;open(row);expect(f.open).toHaveBeenCalledWith(row);f.closeVisit();open(row);expect(f.open).toHaveBeenCalledOnce()})
 it('invalidates retained actions on disposal',async()=>{const f=await fixture(),open=f.props().onOpenScorecard;f.controller.dispose();open(row);expect(f.open).not.toHaveBeenCalled();expect(state.unmount).toHaveBeenCalledOnce()})
 it('invalidates actions from the prior performance revision when refreshing',async()=>{const f=await fixture(),old=f.props();old.onRefresh();old.onOpenScorecard(row);expect(f.open).not.toHaveBeenCalled();await Promise.resolve();f.props().onOpenScorecard(row);expect(f.open).toHaveBeenCalledOnce()})
})
