import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {appendRecentHistory,loadOlderResults} from '../../mobile/src/recent-results-history'
import type {RecentMatchRow} from '../../mobile/src/recent-results'
const player='11111111-1111-4111-8111-111111111111'
const row=(i:number):RecentMatchRow=>({id:'22222222-2222-4222-8222-'+String(999-i).padStart(12,'0'),match_date:'2026-10-01',match_type:'Doubles',league_name:'Synthetic League',score:'6-4',winner_side:'A',match_players:[{player_id:player,side:'A'}]})
const rows=(start:number,count:number)=>Array.from({length:count},(_,i)=>row(start+i))
describe('bounded older My Lab matches',()=>{
 it('appends twenty rows and withholds the lookahead without mutating loaded results',()=>{
  const loaded=rows(0,10),copy=structuredClone(loaded)
  const result=appendRecentHistory(loaded,rows(10,21),player,20)
  expect(result.rows).toHaveLength(30);expect(result.hasMore).toBe(true);expect(result.rows.at(-1)?.id).toBe(row(29).id);expect(loaded).toEqual(copy)
 })
 it('supports end-of-history and caps the loaded sample at100',()=>{
  expect(appendRecentHistory(rows(0,10),[],player,20)).toMatchObject({hasMore:false})
  expect(appendRecentHistory(rows(0,90),rows(90,11),player,10)).toMatchObject({hasMore:false})
  expect(appendRecentHistory(rows(0,90),rows(90,11),player,10).rows).toHaveLength(100)
  expect(()=>appendRecentHistory(rows(0,100),[],player,0)).toThrow()
 })
 it('rejects overlaps, reordered pages, malformed dates, mismatched players and oversized pages',()=>{
  for(const page of [[row(9)],[row(11),row(10)],[{...row(10),match_date:'2026-02-30'}],[{...row(10),match_players:[{player_id:'other',side:'A'}]}],rows(10,22),[{...row(10),id:'bad'}]])expect(()=>appendRecentHistory(rows(0,10),page,player,20)).toThrow()
 })
 it('keeps undated results last and maintains descending ID ties',()=>{
  const loaded=rows(0,10),undated={...row(10),match_date:null}
  expect(appendRecentHistory(loaded,[undated],player,20).rows.at(-1)).toEqual(undated)
  expect(()=>appendRecentHistory([...loaded,undated],[row(11)],player,20)).toThrow()
 })
 it('uses the existing exact player join and bounded ordered range with a timeout',async()=>{
  const q={select:vi.fn(),eq:vi.fn(),in:vi.fn(),order:vi.fn(),range:vi.fn(),abortSignal:vi.fn().mockResolvedValue({data:rows(10,21),error:null})}
  q.select.mockReturnValue(q);q.eq.mockReturnValue(q);q.in.mockReturnValue(q);q.order.mockReturnValue(q);q.range.mockReturnValue(q)
  const client={from:vi.fn().mockReturnValue(q)} as unknown as SupabaseClient
  expect((await loadOlderResults(client,player,rows(0,10))).rows).toHaveLength(30)
  expect(client.from).toHaveBeenCalledWith('matches');expect(q.eq).toHaveBeenCalledWith('match_players.player_id',player);expect(q.range).toHaveBeenCalledWith(10,30);expect(q.order).toHaveBeenCalledWith('match_date',{ascending:false,nullsFirst:false});expect(q.order).toHaveBeenCalledWith('id',{ascending:false});expect(q.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
  q.abortSignal.mockResolvedValue({data:null,error:{message:'private error'}})
  await expect(loadOlderResults(client,player,rows(0,10))).rejects.toThrow('Older matches unavailable')
  const calls=client.from as ReturnType<typeof vi.fn>;const count=calls.mock.calls.length
  await expect(loadOlderResults(client,'bad',rows(0,10))).rejects.toThrow();expect(calls).toHaveBeenCalledTimes(count)
 })
})
