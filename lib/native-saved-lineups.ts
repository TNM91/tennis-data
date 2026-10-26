import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamRoomScope} from './team-room'
import {loadNativeLineup} from './native-captain-lineup'
import {readSavedLineups} from './native-saved-lineups-contract'
import {scenarioBaselineSignature} from './native-captain-scenario-contract'
export async function loadNativeSavedLineups(service:SupabaseClient,caller:SupabaseClient,owner:string,scope:TeamRoomScope,matchId:string){
 const base=await loadNativeLineup(service,owner,scope,matchId);if(!base.ok)return base
 // Caller RLS remains authoritative for private scenarios. Never scan this table with service role.
 const r=await caller.from('lineup_scenarios').select('id,owner_user_id,scenario_name,team_name,league_name,flight,match_date,opponent_team,slots_json,known_defaults_json').eq('team_name',scope.teamName).eq('league_name',scope.leagueName).eq('flight',scope.flight).eq('match_date',base.match.date).eq('opponent_team',base.match.opponent).or('owner_user_id.is.null,owner_user_id.eq.'+owner).order('scenario_name',{ascending:true}).order('id',{ascending:true}).limit(21)
 if(r.error||!Array.isArray(r.data)||r.data.length>21)return {ok:false as const,status:503}
 for(const row of r.data)if(row.owner_user_id!==null&&row.owner_user_id!==undefined&&row.owner_user_id!==owner||row.team_name!==scope.teamName||row.league_name!==scope.leagueName||row.flight!==scope.flight||row.match_date!==base.match.date||row.opponent_team!==base.match.opponent)throw Error('Saved lineup scope changed.')
 const rows=readSavedLineups(r.data.slice(0,20).map(row=>{if(row.known_defaults_json!==null&&row.known_defaults_json!==undefined&&!Array.isArray(row.known_defaults_json))throw Error('Saved default rules unavailable.');return {id:row.id,name:row.scenario_name,slots:row.slots_json,hasDefaults:Boolean(row.known_defaults_json?.length),visibility:row.owner_user_id===owner?'account':'legacy'}}))
 return {ok:true as const,status:200,owner,scope:{...base.scope},match:{...base.match},baseline:scenarioBaselineSignature(base),rows,more:r.data.length>20,checkedAt:new Date().toISOString()}
}
