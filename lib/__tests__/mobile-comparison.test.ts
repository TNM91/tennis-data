import {describe,expect,it,vi,beforeEach} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
const state=vi.hoisted(()=>({ratings:vi.fn(),results:vi.fn()}))
vi.mock('../../mobile/src/player-ratings-data',async importOriginal=>({...await importOriginal<typeof import('../../mobile/src/player-ratings-data')>(),loadPlayerRatings:state.ratings}))
vi.mock('../../mobile/src/recent-results',async importOriginal=>({...await importOriginal<typeof import('../../mobile/src/recent-results')>(),loadRecentResults:state.results}))
import {comparisonCard,loadComparison,type ComparedPlayer} from '../../mobile/src/comparison-data'
const player=(id:string)=>({id,name:id,location:'North',flight:'4.0'})
const data:ComparedPlayer={player:{...player('a'),name:'<Alex>'},ratings:{overall_dynamic_rating:4.499,singles_dynamic_rating:null,doubles_dynamic_rating:null,rating_source:'self'},matches:[{id:'one',match_date:'2026-10-20',match_type:'Singles',league_name:null,score:'6-4',winner_side:'A',match_players:[{player_id:'a',side:'A'}]},{id:'two',match_date:null,match_type:'Doubles',league_name:null,score:null,winner_side:null,match_players:[{player_id:'a',side:'B'}]}]}
describe('native recorded player comparison',()=>{
 beforeEach(()=>{state.ratings.mockReset().mockResolvedValue(data.ratings);state.results.mockReset().mockResolvedValue({data:data.matches,error:null})})
 it('loads both exact selected players and retains their identity',async()=>{
  const client={} as SupabaseClient,result=await loadComparison(client,[player('a'),player('b')])
  expect(result.map(row=>row.player.id)).toEqual(['a','b']);expect(state.ratings).toHaveBeenCalledTimes(2);expect(state.results).toHaveBeenCalledWith(client,'b')
 })
 it('rejects duplicate players before issuing comparison reads',async()=>{
  await expect(loadComparison({} as SupabaseClient,[player('a'),player('a')])).rejects.toThrow('different players');expect(state.ratings).not.toHaveBeenCalled()
 })
 it('fails the whole comparison when one result read fails',async()=>{
  state.results.mockResolvedValueOnce({data:[],error:null}).mockResolvedValueOnce({data:null,error:{message:'denied'}})
  await expect(loadComparison({} as SupabaseClient,[player('a'),player('b')])).rejects.toThrow('Comparison unavailable')
 })
 it('escapes identities, labels fallback, and filters only within the bounded recent sample',()=>{
  const markup=comparisonCard(data,'singles',0)
  expect(markup).toContain('&lt;Alex&gt;');expect(markup).not.toContain('<Alex>');expect(markup).toContain('4.49');expect(markup).toContain('Overall TIQ used');expect(markup).toContain('Self-rated record');expect(markup).toContain('1 singles match in the latest 2 connected results');expect(markup).toContain('<dt>Wins</dt><dd>1</dd>');expect(markup).toContain('<dt>Pending</dt><dd>0</dd>')
 })
 it('does not invent a rating or a result for incomplete data',()=>{
  const markup=comparisonCard({...data,ratings:null},'doubles',1)
  expect(markup).toContain('Rating not recorded');expect(markup).toContain('<dt>Pending</dt><dd>1</dd>');expect(markup).not.toContain('3.50')
 })
})
