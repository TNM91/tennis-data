import type { SupabaseClient } from '@supabase/supabase-js'
import { CapacitorHttp } from '@capacitor/core'
import { isPublicTeamDirectoryName, isPublicTeamDirectoryMatch } from '../../lib/team-directory-rules'
import type { LeagueCard } from '../../lib/league-summary'
import { playerSearchTerm } from './player-connection'

export type TeamChoice = {name:string;league:string|null;flight:string|null;source:'recorded'|'observation'}
export type TeamRecord = {id:string;home_team:string|null;away_team:string|null;league_name:string|null;flight:string|null;match_date:string|null;score:string|null;status:string|null;source?:string|null}
type Context = {team_name:string|null;league_name:string|null;flight:string|null}
export const teamKey = (team:TeamChoice)=>JSON.stringify([team.name.trim().toLowerCase(),team.league?.trim().toLowerCase() || '',team.flight?.trim().toLowerCase() || ''])
export function collectTeams(matches: Pick<TeamRecord,'home_team'|'away_team'|'league_name'|'flight'|'source'>[],contexts:Context[],term:string) {
  const teams=new Map<string,TeamChoice>()
  const add=(name:string|null,league:string|null,flight:string|null,source:TeamChoice['source'])=>{
    if(!name || !isPublicTeamDirectoryName(name,league) || !name.toLowerCase().includes(term.toLowerCase()))return
    const team={name:name.trim(),league,flight,source}
    if(!teams.has(teamKey(team)))teams.set(teamKey(team),team)
  }
  for(const row of matches) {
    if(!isPublicTeamDirectoryMatch({homeTeam:row.home_team,awayTeam:row.away_team,league:row.league_name,source:row.source}))continue
    for(const name of [row.home_team,row.away_team])add(name,row.league_name,row.flight,'recorded')
  }
  for(const row of contexts)add(row.team_name,row.league_name,row.flight,'observation')
  return [...teams.values()].sort((a,b)=>a.name.localeCompare(b.name)||teamKey(a).localeCompare(teamKey(b)))
}
export async function searchTeams(client:SupabaseClient,value:string) {
  const text=value.trim().replace(/\s+/g,' '),term=playerSearchTerm(text)
  const query=(column:string)=>client.from('team_match_results').select('home_team,away_team,league_name,flight,source').is('line_number',null).ilike(column,`%${term}%`).order('match_date',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).limit(20).abortSignal(AbortSignal.timeout(12000))
  const results=await Promise.all([query('home_team'),query('away_team'),client.from('tennisrecord_public_team_context').select('team_name,league_name,flight').ilike('team_name',`%${term}%`).order('team_name').order('league_name').order('flight').limit(20).abortSignal(AbortSignal.timeout(12000))])
  if(results.every(result=>result.error))throw Error('Team search unavailable')
  const teams=collectTeams([...(results[0].data || []),...(results[1].data || [])],results[2].data || [],text)
  return {teams:teams.slice(0,12),limited:teams.length>12||results.some(result=>result.data?.length===20),partial:results.some(result=>!!result.error)}
}
export async function loadTeamRecords(client:SupabaseClient,team:TeamChoice) {
  const query=(column:string)=>{
    let request=client.from('team_match_results').select('id,home_team,away_team,league_name,flight,match_date,score,status,source').is('line_number',null).eq(column,team.name)
    request=team.league===null?request.is('league_name',null):request.eq('league_name',team.league)
    request=team.flight===null?request.is('flight',null):request.eq('flight',team.flight)
    return request.order('match_date',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).limit(10).abortSignal(AbortSignal.timeout(12000))
  }
  const results=await Promise.all([query('home_team'),query('away_team')])
  if(results.some(result=>result.error))throw Error('Team records unavailable')
  return [...new Map(results.flatMap(result=>(result.data || []) as TeamRecord[]).filter(row=>isPublicTeamDirectoryMatch({homeTeam:row.home_team,awayTeam:row.away_team,league:row.league_name,source:row.source})).map(row=>[row.id,row])).values()].sort((a,b)=>(b.match_date || '').localeCompare(a.match_date || '')||b.id.localeCompare(a.id)).slice(0,10)
}
type LeagueDirectory = {rows:LeagueCard[];notice:string;at:number}
let leagueCache:LeagueDirectory|null=null
let pendingLeagues:Promise<LeagueDirectory>|null=null
export async function loadLeagues(request:typeof CapacitorHttp.get=options=>CapacitorHttp.get(options)):Promise<LeagueDirectory> {
  if(leagueCache && Date.now()-leagueCache.at<300000)return leagueCache
  if(pendingLeagues)return pendingLeagues
  pendingLeagues=(async()=>{
    const response=await request({url:'https://www.tenaceiq.com/api/leagues/summary',responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000})
    if(response.status!==200 || !Array.isArray(response.data?.leagues))throw Error('League directory unavailable')
    const rows=response.data.leagues.filter((row:LeagueCard)=>row && typeof row.key==='string' && typeof row.leagueName==='string' && row.leagueName.trim()) as LeagueCard[]
    const result:LeagueDirectory={rows,notice:typeof response.data.notice==='string'?response.data.notice:'',at:Date.now()}
    leagueCache=result
    return result
  })()
  try{return await pendingLeagues}finally{pendingLeagues=null}
}
export function filterLeagues(rows:LeagueCard[],value:string) {
  const term=value.trim().toLowerCase()
  return rows.filter(row=>[row.leagueName,row.flight,row.ustaSection,row.districtArea,row.year,row.season].some(field=>typeof field==='string' && field.toLowerCase().includes(term))).sort((a,b)=>a.leagueName.localeCompare(b.leagueName)||a.key.localeCompare(b.key))
}
