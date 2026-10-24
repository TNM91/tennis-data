import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import {fixtureDate,fixtureId,fixtureOpponent,fixtureWindow,type TeamFixture} from '../../lib/team-fixtures-contract'
import {isPublicTeamDirectoryMatch,isPublicTeamDirectoryName} from '../../lib/team-directory-rules'
export type ScoutRecord={id:string;date:string;home:string;away:string;score:string;status:string;observation:boolean}
export type OpponentScout={opponent:string;before:string;from:string;records:ScoutRecord[];limited:boolean}
export function scoutingContext(scope:TeamScope,fixture:TeamFixture,today:string){
 const opponent=fixtureOpponent(fixture,scope),before=fixture.date<today?fixture.date:today
 if(!fixtureId(fixture.id)||!fixtureDate(fixture.date)||!fixtureDate(today)||fixture.home!==scope.teamName&&fixture.away!==scope.teamName||fixture.home===fixture.away||!isPublicTeamDirectoryName(opponent,scope.leagueName)||opponent.length>160||!scope.leagueName||scope.leagueName.length>160||scope.flight.length>120)throw Error('This opponent could not be confirmed.')
 return {opponent,before,from:fixtureWindow(before).from}
}
export function publicScoutRecord(value:unknown,scope:TeamScope,context:ReturnType<typeof scoutingContext>):ScoutRecord|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const row=value as Record<string,unknown>
 if(!fixtureId(row.id)||!fixtureDate(row.match_date)||row.match_date<context.from||row.match_date>=context.before||row.league_name!==scope.leagueName||(row.flight||'')!==scope.flight||row.line_number!=null||row.match_type!=null&&row.match_type!==''||row.home_team!==context.opponent&&row.away_team!==context.opponent||row.home_team===row.away_team||typeof row.home_team!=='string'||typeof row.away_team!=='string'||row.home_team.length>160||row.away_team.length>160||!isPublicTeamDirectoryMatch({homeTeam:row.home_team,awayTeam:row.away_team,league:scope.leagueName,source:typeof row.source==='string'?row.source:''}))return null
 for(const [key,max] of [['score',160],['status',80]] as const)if(row[key]!=null&&(typeof row[key]!=='string'||(row[key] as string).length>max))return null
 return {id:row.id,date:row.match_date,home:row.home_team,away:row.away_team,score:typeof row.score==='string'?row.score:'',status:typeof row.status==='string'?row.status:'',observation:typeof row.source==='string'&&row.source.toLowerCase().includes('tennisrecord')}
}
/** Explicit public team-record reads only. No roster, membership, private notes, storage or writes. */
export async function loadOpponentScout(client:SupabaseClient,scope:TeamScope,fixture:TeamFixture,today:string,current:()=>boolean):Promise<OpponentScout>{
 const context=scoutingContext(scope,fixture,today);if(!current())throw Error('This fixture is no longer open.')
 const query=(column:string)=>{let q=client.from('team_match_results').select('id,home_team,away_team,league_name,flight,match_date,score,status,source,line_number,match_type').eq(column,context.opponent).eq('league_name',scope.leagueName).is('line_number',null).gte('match_date',context.from).lt('match_date',context.before);q=scope.flight?q.eq('flight',scope.flight).or('match_type.is.null,match_type.eq.'):q.or('and(flight.is.null,match_type.is.null),and(flight.eq.,match_type.is.null),and(flight.is.null,match_type.eq.),and(flight.eq.,match_type.eq.)');return q.order('match_date',{ascending:false}).order('id',{ascending:false}).limit(21).abortSignal(AbortSignal.timeout(12000))}
 const results=await Promise.all([query('home_team'),query('away_team')]);if(!current())throw Error('This fixture is no longer open.');if(results.some(result=>result.error||!Array.isArray(result.data)||result.data.length>21))throw Error('Opponent records are unavailable. Try refreshing.')
 const rows=results.flatMap(result=>result.data||[]).map(row=>publicScoutRecord(row,scope,context)).filter((row):row is ScoutRecord=>!!row),records=[...new Map(rows.map(row=>[row.id,row])).values()].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id))
 return {...context,records:records.slice(0,20),limited:records.length>20||results.some(result=>result.data?.length===21)}
}
export const isScoredScoutRecord=(row:ScoutRecord)=>!!row.score.trim()&&!/cancel|postpon/i.test(row.status)
export function scoutRecords(data:OpponentScout,team:string,view:'all'|'meetings'|'scored',query=''){const term=query.trim().toLocaleLowerCase();return data.records.filter(row=>(view!=='meetings'||row.home===team||row.away===team)&&(view!=='scored'||isScoredScoutRecord(row))&&(!term||[row.home,row.away,row.date,row.status].some(text=>text.toLocaleLowerCase().includes(term))))}
