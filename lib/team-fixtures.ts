import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamRoomScope} from './team-room'
import {checkTeamChatAccess} from './team-chat-updates'
import {fixtureId,fixtureDate,fixtureWindow,type TeamFixture} from './team-fixtures-contract'
const text=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):''
export function publicTeamFixture(row:Record<string,unknown>,scope:TeamRoomScope):TeamFixture|null{
 if(!fixtureId(row.id)||!fixtureDate(row.match_date)||row.league_name!==scope.leagueName||(row.flight||'')!==scope.flight||row.line_number!=null&&row.line_number!==''||row.match_type||row.home_team!==scope.teamName&&row.away_team!==scope.teamName||row.home_team===row.away_team||typeof row.home_team!=='string'||typeof row.away_team!=='string'||!row.home_team.trim()||!row.away_team.trim())return null
 return {id:row.id,date:row.match_date,time:text(row.match_time,80),home:text(row.home_team,160),away:text(row.away_team,160),facility:text(row.facility,240),status:text(row.status,80),score:text(row.score,160)}
}
/** Accepted exact team scope and existing conversation are resolved by caller. No writes, storage or roster reads. */
export async function loadTeamFixtures(service:SupabaseClient,owner:string,room:string,scope:TeamRoomScope,today:string,requested=''){
 if(requested&&!fixtureId(requested))return {ok:false as const,status:400}
 const access=await checkTeamChatAccess(service,owner,room,false);if(!access.ok)return access
 const window=fixtureWindow(today)
 const base=(column:string)=>{let q=service.from('matches').select('id,match_date,match_time,home_team,away_team,facility,status,score,league_name,flight,line_number,match_type').eq('league_name',scope.leagueName).eq(column,scope.teamName).is('line_number',null);q=scope.flight?q.eq('flight',scope.flight).or('match_type.is.null,match_type.eq.'):q.or('and(flight.is.null,match_type.is.null),and(flight.eq.,match_type.is.null),and(flight.is.null,match_type.eq.),and(flight.eq.,match_type.eq.)');return q}
 if(requested){const results=await Promise.all(['home_team','away_team'].map(column=>base(column).eq('id',requested).gte('match_date',window.from).lte('match_date',window.until).limit(1)));if(results.some(row=>row.error))return {ok:false as const,status:503};const rows=results.flatMap(result=>result.data||[]).map(row=>publicTeamFixture(row,scope)).filter((row):row is TeamFixture=>!!row);if(rows.length!==1||rows[0].id!==requested||rows[0].date<window.from||rows[0].date>window.until)return {ok:false as const,status:404};return {ok:true as const,teamFixtures:1,scope,requestedId:requested,today,...window,fixture:rows[0]}}
 const queries=['home_team','away_team'].flatMap(column=>[base(column).gte('match_date',today).lte('match_date',window.until).order('match_date').order('id').limit(41),base(column).gte('match_date',window.from).lt('match_date',today).order('match_date',{ascending:false}).order('id',{ascending:false}).limit(41)])
 const results=await Promise.all(queries);if(results.some(row=>row.error))return {ok:false as const,status:503}
 const section=(indices:number[],older:boolean)=>{const raw=indices.flatMap(index=>results[index].data||[]),rows=[...new Map(raw.map(row=>publicTeamFixture(row,scope)).filter((row):row is TeamFixture=>!!row&&row.date>=window.from&&row.date<=window.until&&(older?row.date<today:row.date>=today)).map(row=>[row.id,row])).values()].sort((a,b)=>(older?b.date.localeCompare(a.date):a.date.localeCompare(b.date))||(older?b.id.localeCompare(a.id):a.id.localeCompare(b.id)));return {rows:rows.slice(0,40),more:rows.length>40||indices.some(index=>(results[index].data?.length||0)>40)}}
 const upcoming=section([0,2],false),earlier=section([1,3],true)
 return {ok:true as const,teamFixtures:1,scope,today,...window,upcoming:upcoming.rows,earlier:earlier.rows,moreUpcoming:upcoming.more,moreEarlier:earlier.more}
}
