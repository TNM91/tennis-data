import {describe,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {rankRows,type RankingPlayer} from '../../mobile/src/rankings-data'
import {rankingCards} from '../../mobile/src/rankings-view'
const player=(id:string,rating:number|null,singles:number|null=null):RankingPlayer=>({id,name:id,location:'North',flight:'4.0',rating_source:'verified',overall_dynamic_rating:rating,singles_dynamic_rating:singles,doubles_dynamic_rating:null})
function clientFor(results:{data:RankingPlayer[]|null;error:object|null}[]) {
  let next=0
  const queries:Record<string,ReturnType<typeof vi.fn>>[]=[]
  const client={from:vi.fn(()=>{
    const result=results[next++]
    const query:Record<string,ReturnType<typeof vi.fn>>={}
    for(const key of ['select','gte','lte','is','ilike','order','limit'])query[key]=vi.fn(()=>query)
    query.abortSignal=vi.fn().mockResolvedValue(result);queries.push(query);return query
  })} as unknown as SupabaseClient
  return {client,queries}
}
describe('native recorded TIQ rankings',()=>{
  it('uses the shared formatting and only falls back to an actually recorded overall value',()=>{
    const rows=rankRows([player('missing',null),player('fallback',4.499),player('specific',6,4.6),player('invalid',8),player('nan',NaN)],'singles')
    expect(rows.map(row=>[row.player.id,row.display,row.fallback])).toEqual([['specific','4.60',false],['fallback','4.49',true]])
    expect(rankRows([player('missing',null)],'overall')).toEqual([])
  })
  it('deduplicates candidate groups and keeps stable ties before bounding the display',()=>{
    const rows=Array.from({length:30},(_,index)=>player(String(index).padStart(2,'0'),4))
    const ranked=rankRows([...rows.reverse(),rows[0]],'overall')
    expect(ranked).toHaveLength(24)
    expect(ranked[0].player.id).toBe('00')
    expect(ranked.at(-1)?.player.id).toBe('23')
  })
  it('labels self-rated records and fallback values while escaping player fields',()=>{
    const row=rankRows([{...player('sample',4),name:'<img src=x>',rating_source:'self'}],'doubles')[0]
    const markup=rankingCards([row])
    expect(markup).not.toContain('<img')
    expect(markup).toContain('Self-rated record.')
    expect(markup).toContain('Overall TIQ rating used')
  })
  it('queries bounded disjoint specific/fallback groups with a literal location filter',async()=>{
    vi.resetModules()
    const {createRankingLoader}=await import('../../mobile/src/rankings-data')
    const {client,queries}=clientFor([{data:[player('specific',6,4.6)],error:null},{data:[player('fallback',4.8)],error:null}])
    const loadRankings=createRankingLoader(client)
    const rows=await loadRankings('singles','N_%')
    expect(rows.map(row=>row.player.id)).toEqual(['fallback','specific'])
    expect(queries).toHaveLength(2)
    expect(queries[0].gte).toHaveBeenCalledWith('singles_dynamic_rating',1.5)
    expect(queries[1].is).toHaveBeenCalledWith('singles_dynamic_rating',null)
    expect(queries[1].gte).toHaveBeenCalledWith('overall_dynamic_rating',1.5)
    for(const query of queries){expect(query.ilike).toHaveBeenCalledWith('location','%N\\_\\%%');expect(query.limit).toHaveBeenCalledWith(24);expect(query.abortSignal).toHaveBeenCalled()}
  })
  it('shares overlapping loads and reuses a successful public result',async()=>{
    vi.resetModules()
    const {createRankingLoader}=await import('../../mobile/src/rankings-data')
    const {client}=clientFor([{data:[player('one',4)],error:null}])
    const loadRankings=createRankingLoader(client)
    await Promise.all([loadRankings('overall',''),loadRankings('overall','')])
    await loadRankings('overall','')
    expect(client.from).toHaveBeenCalledTimes(1)
  })
  it('does not silently rank only one candidate group when another group fails',async()=>{
    vi.resetModules()
    const {createRankingLoader}=await import('../../mobile/src/rankings-data')
    const {client}=clientFor([{data:[],error:null},{data:null,error:{message:'unavailable'}},{data:[player('one',4)],error:null},{data:[],error:null}])
    const loadRankings=createRankingLoader(client)
    await expect(loadRankings('doubles','')).rejects.toThrow('unavailable')
    expect((await loadRankings('doubles','')).map(row=>row.player.id)).toEqual(['one'])
  })
})
