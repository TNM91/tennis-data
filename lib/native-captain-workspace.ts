import {buildTeamSeasonCalendars} from './team-season-calendar'
import {summarizeCaptainLineupDraft} from './captain-lineup-draft-summary'
import type {SupabaseClient} from '@supabase/supabase-js'
import {canManageTeamRoom,normalizeTeamRoomKey,buildTeamRoomScopeId,type TeamRoomScope} from './team-room'
import {checkTeamChatAccess} from './team-chat-updates'
import {loadSeasonRoster,seasonToday} from './season-kickoff-server'
const text=(value:unknown,max=160)=>typeof value==='string'?value.trim().slice(0,max):''
/** Caller verifies Captain account entitlement. All service-role reads stay within an accepted exact captain team. */
export async function authorizeNativeCaptainScope(service:SupabaseClient,owner:string,scope:TeamRoomScope){
 if(!scope.teamName || !scope.leagueName || scope.teamName.length>160 || scope.leagueName.length>160 || scope.flight.length>120)return {ok:false as const,status:400}
 const links=await service.from('team_profile_links').select('team_role,team_roles').eq('profile_user_id',owner).eq('normalized_team_name',normalizeTeamRoomKey(scope.teamName)).eq('league_name',scope.leagueName).eq('flight',scope.flight).eq('status','accepted').is('archived_at',null).limit(2)
 if(links.error)return {ok:false as const,status:503}
 if(links.data?.length!==1 || !canManageTeamRoom(links.data[0].team_roles?.length?links.data[0].team_roles:[links.data[0].team_role]))return {ok:false as const,status:403}
 const conversation=await service.from('internal_conversations').select('id').eq('related_entity_type','team_room').eq('related_entity_id',buildTeamRoomScopeId(scope)).maybeSingle()
 if(conversation.error)return {ok:false as const,status:503}
 if(!conversation.data)return {ok:false as const,status:403}
 const access=await checkTeamChatAccess(service,owner,conversation.data.id,true)
 if(!access.ok)return access
 return {ok:true as const,status:200}
}
export async function loadNativeCaptainWorkspace(service:SupabaseClient,owner:string,scope:TeamRoomScope){
 const access=await authorizeNativeCaptainScope(service,owner,scope)
 if(!access.ok)return access
 const today=seasonToday(),until=new Date(today+'T12:00:00Z');until.setUTCDate(until.getUTCDate()+120)
 const escaped=scope.teamName.replace(/\\/g,'\\\\').replace(/"/g,'\\"')
 const [roster,matches,drafts]=await Promise.all([
  loadSeasonRoster(service,{team:scope.teamName,league:scope.leagueName,flight:scope.flight,seasonKey:''}),
  service.from('matches').select('id,home_team,away_team,match_date,match_time,facility,league_name,flight,line_number,match_type,status').eq('league_name',scope.leagueName).eq('flight',scope.flight).is('line_number',null).or(`home_team.eq."${escaped}",away_team.eq."${escaped}"`).gte('match_date',today).lte('match_date',until.toISOString().slice(0,10)).order('match_date').order('id').limit(41),
  service.from('captain_lineup_drafts').select('team_name,league_name,flight,match_date,opponent_team,slots_json,status,delivery_status,updated_at,notes,match_location,arrival_time').eq('user_id',owner).eq('team_name',scope.teamName).eq('league_name',scope.leagueName).eq('flight',scope.flight).order('updated_at',{ascending:false}).limit(21),
 ])
 if(matches.error || drafts.error)return {ok:false as const,status:503}
 return {ok:true as const,status:200,scope,checkedAt:new Date().toISOString(),roster:roster.map(player=>({id:player.key,name:player.name})),moreMatches:(matches.data?.length || 0)>40,moreDrafts:(drafts.data?.length || 0)>20,
  matches:buildTeamSeasonCalendars(scope.teamName,matches.data || [],'').flatMap(season=>season.matches).sort((a,b)=>String(a.match_date).localeCompare(String(b.match_date))).slice(0,40).map(row=>({id:text(row.id,120),date:text(row.match_date,10),time:text(row.match_time,80),facility:text(row.facility,240),opponent:text(row.home_team===scope.teamName?row.away_team:row.home_team)})),
  drafts:(drafts.data || []).slice(0,20).filter(row=>!row.match_date || row.match_date>=today).map(row=>({matchDate:text(row.match_date,10),opponent:text(row.opponent_team),status:summarizeCaptainLineupDraft(row)?.status || 'working',sent:summarizeCaptainLineupDraft(row)?.deliveryStatus==='sent',updatedAt:text(row.updated_at,80),notes:text(row.notes,1200),location:text(row.match_location,240),arrivalTime:text(row.arrival_time,80),courts:(Array.isArray(row.slots_json)?row.slots_json:[]).slice(0,30).map((slot:Record<string,unknown>,index:number)=>({label:text(slot?.label,120)||`Court ${index+1}`,players:(Array.isArray(slot?.players)?slot.players:[]).slice(0,2).map((player:Record<string,unknown>)=>text(player?.playerName)).map((name:string)=>name || 'Not assigned')}))}))}
}
