import {describe,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {CapacitorHttp} from '@capacitor/core'
import type {LeagueCard} from '../league-summary'
import {collectTeams,loadTeamRecords,searchTeams,filterLeagues} from '../../mobile/src/directory-data'
import {leagueDetails} from '../../mobile/src/directory-view'

const league={key:'league',leagueName:'City League',flight:'4.0',ustaSection:'Midwest',districtArea:'North',year:'2026',season:'Fall',matchCount:5,teamCount:3,latestMatchDate:'2026-10-20'} as LeagueCard
const row={id:'one',home_team:'Aces',away_team:'Rallies',league_name:'City League',flight:'4.0',match_date:'2026-10-20',score:'3-2',status:'Complete',source:'schedule'}
function fakeClient(results:{data:unknown[]|null;error:object|null}[]) {
  let index=0
  const queries:Record<string,ReturnType<typeof vi.fn>>[]=[]
  const client={from:vi.fn(()=>{
    const result=results[index++]
    const query:Record<string,ReturnType<typeof vi.fn>>={}
    for(const key of ['select','is','eq','ilike','order','limit'])query[key]=vi.fn(()=>query)
    query.abortSignal=vi.fn().mockResolvedValue(result)
    queries.push(query);return query
  })} as unknown as SupabaseClient
  return {client,queries}
}
describe('native team and league discovery',()=>{
  it('keeps same-name teams separate across league/flight and rejects source headings',()=>{
    const teams=collectTeams([row,{...row,flight:'4.5'},{...row,home_team:'Match results',source:'tennisrecord'}],[{team_name:'Aces',league_name:'City League',flight:'4.0'}],'Aces')
    expect(teams).toHaveLength(2)
    expect(teams.every(team=>team.source==='recorded')).toBe(true)
    expect(collectTeams([{...row,home_team:'Match results',source:'tennisrecord'}],[],'Match')).toEqual([])
  })
  it('bounds each search source and treats wildcard characters literally',async()=>{
    const {client,queries}=fakeClient([{data:[],error:null},{data:[],error:null},{data:[],error:{message:'Source unavailable'}}])
    const result=await searchTeams(client,'A_%')
    expect(result).toEqual({teams:[],limited:false,partial:true})
    expect(queries).toHaveLength(3)
    for(const query of queries){expect(query.limit).toHaveBeenCalledWith(20);expect(query.abortSignal).toHaveBeenCalled()}
    expect(queries[0].ilike).toHaveBeenCalledWith('home_team','%A\\_\\%%')
    expect(queries[1].ilike).toHaveBeenCalledWith('away_team','%A\\_\\%%')
    await expect(searchTeams(client,'a')).rejects.toThrow()
  })
  it('requires a usable source rather than claiming an empty directory on total failure',async()=>{
    const {client}=fakeClient(Array.from({length:3},()=>({data:null,error:{message:'offline'}})))
    await expect(searchTeams(client,'Aces')).rejects.toThrow('unavailable')
  })
  it('scopes both sides of team fixtures and deduplicates parent records',async()=>{
    const {client,queries}=fakeClient([{data:[row],error:null},{data:[row],error:null}])
    expect(await loadTeamRecords(client,{name:'Aces',league:'City League',flight:'4.0',source:'recorded'})).toEqual([row])
    for(const query of queries){expect(query.eq).toHaveBeenCalledWith('league_name','City League');expect(query.eq).toHaveBeenCalledWith('flight','4.0');expect(query.is).toHaveBeenCalledWith('line_number',null);expect(query.limit).toHaveBeenCalledWith(10)}
  })
  it('filters league summaries without combining distinct records and escapes detail fields',()=>{
    expect(filterLeagues([league,{...league,key:'other',flight:'4.5'}],'4.0')).toEqual([league])
    expect(filterLeagues([league],'north')).toEqual([league])
    const markup=leagueDetails({...league,leagueName:'<img src=x>',teamCount:Infinity})
    expect(markup).not.toContain('<img')
    expect(markup).toContain('Unavailable')
    expect(markup).toContain('not a complete season record')
  })
  it('uses one fixed public HTTPS endpoint, shares pending loads, and caches only success',async()=>{
    vi.resetModules()
    const {loadLeagues}=await import('../../mobile/src/directory-data')
    const request=vi.fn<typeof CapacitorHttp.get>().mockResolvedValue({status:200,data:{leagues:[league],notice:null},headers:{},url:''})
    const [a,b]=await Promise.all([loadLeagues(request),loadLeagues(request)])
    expect(a.rows).toEqual([league]);expect(b).toEqual(a)
    await loadLeagues(request)
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith({url:'https://www.tenaceiq.com/api/leagues/summary',responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000})
    vi.resetModules()
    const fresh=await import('../../mobile/src/directory-data')
    request.mockResolvedValueOnce({status:500,data:{error:'offline'},headers:{},url:''})
    await expect(fresh.loadLeagues(request)).rejects.toThrow('unavailable')
    expect((await fresh.loadLeagues(request)).rows).toEqual([league])
  })
})
