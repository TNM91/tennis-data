import type {SupabaseClient} from '@supabase/supabase-js'
import {buildTiqTeamStandings} from './tiq-team-standings'
import {normalizeTeamCompetitionRulesOverride} from './competition-rules'
import type {OfficeDetail,OfficeLeague,OfficeResult} from './native-league-office-contract'
export const nativeLeagueColumns='id,created_by_user_id,league_name,league_format,season_label,season_status,flight,location_label,starts_on,ends_on,schedule_time_zone,updated_at,scoring_system,competition_rules'
const str=(v:unknown)=>typeof v==='string'?v.trim():''
type Row=Record<string,unknown>
const checked=(r:{data:unknown;error:unknown},max:number):Row[]=>{if(r.error||!Array.isArray(r.data)||r.data.length>max)throw Error('League records unavailable');return r.data as Row[]}
function scoped(rows:Row[],id:string){if(rows.some(r=>r.league_id!==id)||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('League records changed');return rows}

/** Reads a season through the caller RLS client. The caller rechecks its original access predicate. */
export async function readNativeLeagueSeason(db:SupabaseClient,league:OfficeLeague,source:Row,recheck:()=>Promise<Row|null>,publicOnly=false):Promise<OfficeDetail>{
 const selected=league.id
 const team=league.format==='team',entryTable=team?'tiq_team_league_entries':'tiq_player_league_entries',entryName=team?'team_name':'player_name',resultTable=team?'tiq_team_league_match_events':'tiq_individual_league_results',resultColumns=team?'id,league_id,team_a_name,team_b_name,match_date,winner_team_name':'id,league_id,player_a_name,player_b_name,winner_player_name,score,result_date',dateColumn=team?'match_date':'result_date'
 const participantQuery=db.from(entryTable).select('league_id,'+entryName+',entry_status').eq('league_id',selected);if(publicOnly)participantQuery.eq('entry_status','active')
 const [p,f,e]=await Promise.all([participantQuery.order(entryName).limit(101).abortSignal(AbortSignal.timeout(12000)),db.from('tiq_league_schedule_items').select('id,league_id,league_format,participant_a_name,participant_b_name,scheduled_date,scheduled_time,facility,status').eq('league_id',selected).order('scheduled_date',{ascending:false}).order('id').limit(101).abortSignal(AbortSignal.timeout(12000)),db.from(resultTable).select(resultColumns).eq('league_id',selected).order(dateColumn,{ascending:false}).order('id').limit(101).abortSignal(AbortSignal.timeout(12000))])
 const participants=checked(p,101);if(participants.some(p=>p.league_id!==selected||publicOnly&&p.entry_status!=='active'))throw Error('Participant context changed');const fixtures=scoped(checked(f,101),selected);if(fixtures.some(f=>f.league_format!==league.format))throw Error('Schedule format changed');const events=scoped(checked(e,101),selected)
 const lines=team&&events.length?checked(await db.from('tiq_team_league_match_lines').select('id,event_id,line_number,match_type,side_a_player_1_name,side_a_player_2_name,side_b_player_1_name,side_b_player_2_name,winner_side,score').in('event_id',events.slice(0,100).map(e=>e.id)).order('id').limit(501).abortSignal(AbortSignal.timeout(12000)),501):[]
 if(lines.some(l=>!events.slice(0,100).some(e=>e.id===l.event_id))||new Set(lines.map(l=>l.id)).size!==lines.length)throw Error('Court context changed')
 // Recheck ownership and the reviewed season after dependent reads; never return a crossed season snapshot.
 const latest=await recheck();if(!latest||JSON.stringify(latest)!==JSON.stringify(source))throw Error('League changed while loading')
 const results:OfficeResult[]=events.slice(0,100).map(e=>({id:str(e.id),date:str(e[dateColumn]),a:str(e[team?'team_a_name':'player_a_name']),b:str(e[team?'team_b_name':'player_b_name']),winner:str(e[team?'winner_team_name':'winner_player_name']),score:team?'':str(e.score),courts:team?lines.filter(l=>l.event_id===e.id).sort((a,b)=>Number(a.line_number)-Number(b.line_number)).map(l=>({label:'Line '+str(String(l.line_number))+' · '+(l.match_type==='singles'?'Singles':'Doubles'),a:[str(l.side_a_player_1_name),str(l.side_a_player_2_name)].filter(Boolean).join(' & '),b:[str(l.side_b_player_1_name),str(l.side_b_player_2_name)].filter(Boolean).join(' & '),winner:l.winner_side==='A'?'Side A':l.winner_side==='B'?'Side B':'',score:str(l.score)})):[]}))
 if(results.some(r=>r.courts.length>30))throw Error('Court limit exceeded')
 const complete=team&&events.length<=100&&lines.length<=500
 const standings=complete?buildTiqTeamStandings(events as {id:string;team_a_name:string;team_b_name:string}[],lines.filter(l=>l.winner_side==='A'||l.winner_side==='B') as {event_id:string;winner_side:string;score:string|null}[],source.scoring_system==='dynamic_points',normalizeTeamCompetitionRulesOverride(source.competition_rules).standingsRule):[]
 return {league,participants:participants.slice(0,100).map(p=>({name:str(p[entryName]),status:str(p.entry_status)||'pending'})),fixtures:fixtures.slice(0,100).map(f=>({id:str(f.id),date:str(f.scheduled_date),time:str(f.scheduled_time),facility:str(f.facility),a:str(f.participant_a_name),b:str(f.participant_b_name),status:str(f.status)})),results,standings,moreParticipants:participants.length>100,moreFixtures:fixtures.length>100,moreResults:events.length>100||lines.length>500,standingsAvailable:complete}
}
