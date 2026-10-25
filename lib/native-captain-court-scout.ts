import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamRoomScope} from './team-room'
import {loadNativeLineup} from './native-captain-lineup'
import {seasonToday} from './season-kickoff-server'
import {fixtureDate,fixtureId,fixtureWindow} from './team-fixtures-contract'
import {readCourtScoutRecords} from './native-captain-court-scout-contract'
export async function loadNativeCaptainCourtScout(service:SupabaseClient,owner:string,scope:TeamRoomScope,matchId:string){
 const context=await loadNativeLineup(service,owner,scope,matchId);if(!context.ok)return context
 const before=seasonToday(),from=fixtureWindow(before).from,opponent=context.match.opponent
 if(!scope.flight||!fixtureDate(context.match.date)||context.match.date<before)return {ok:false as const,status:409}
 const query=(side:string)=>service.from('matches').select('id,league_name,flight,match_date,home_team,away_team,line_number,match_type,winner_side,score,source,match_time,facility').eq(side,opponent).eq('league_name',scope.leagueName).eq('flight',scope.flight).not('line_number','is',null).gte('match_date',from).lt('match_date',before).order('match_date',{ascending:false}).order('id').limit(81)
 const results=await Promise.all([query('home_team'),query('away_team')]);if(results.some(r=>r.error||!Array.isArray(r.data)||r.data.length>81))return {ok:false as const,status:503}
 const slots=context.plan.courts.map(({id,label,slotType})=>({id,label,slotType})),limited=results.some(r=>r.data!.length===81)
 const matches=readCourtScoutRecords({matches:results.flatMap(r=>r.data!.slice(0,80)),slots,links:[],players:[]},scope,opponent,from,before).matches
 if(matches.some(m=>!fixtureId(m.id)))throw Error('Court identities unavailable.')
 const linkResult=matches.length?await service.from('match_players').select('match_id,player_id,side,seat').in('match_id',matches.map(m=>m.id)).limit(641):{data:[],error:null}
 if(linkResult.error||!Array.isArray(linkResult.data)||linkResult.data.length>640)return {ok:false as const,status:503}
 const links=linkResult.data.filter(p=>{const m=matches.find(m=>m.id===p.match_id);return m&&p.side===(m.home_team===opponent?'A':'B')}),ids=[...new Set(links.map(p=>p.player_id))]
 if(ids.length>320||ids.some(id=>!fixtureId(id)))throw Error('Court players unavailable.')
 const playerResult=ids.length?await service.from('players').select('id,name').in('id',ids).limit(321):{data:[],error:null}
 if(playerResult.error||!Array.isArray(playerResult.data)||playerResult.data.length>320)return {ok:false as const,status:503}
 const records=readCourtScoutRecords({matches,links,players:playerResult.data,slots},scope,opponent,from,before)
 return {ok:true as const,status:200,owner,scope,match:context.match,before,from,checkedAt:new Date().toISOString(),limited,records}
}
