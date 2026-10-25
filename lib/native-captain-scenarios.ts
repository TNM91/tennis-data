import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamRoomScope} from './team-room'
import {loadNativeLineup} from './native-captain-lineup'
import {readLineupPlan} from './native-captain-lineup-contract'
import {scenarioRatings} from './native-captain-scenario-contract'
export async function loadNativeCaptainScenarios(service:SupabaseClient,owner:string,scope:TeamRoomScope,matchId:string){
 const result=await loadNativeLineup(service,owner,scope,matchId);if(!result.ok)return result
 // Only the existing owner's exact fixture plan and connected roster ratings; no scenario library/service-role scan.
 const lineup={ok:true as const,scope:result.scope,match:result.match,version:result.version,sent:result.sent,roster:result.roster,plan:readLineupPlan(result.plan,result.roster)},ids=[...new Set(lineup.roster.map(p=>p.playerId).filter(Boolean))]
 if(ids.length>250)throw Error('Review the roster.')
 const r=ids.length?await service.from('players').select('id,singles_dynamic_rating,doubles_dynamic_rating,overall_dynamic_rating').in('id',ids).limit(251):{data:[],error:null}
 if(r.error||!Array.isArray(r.data))return {ok:false as const,status:503}
 return {ok:true as const,status:200,owner,lineup,ratings:scenarioRatings(r.data,lineup.roster),checkedAt:new Date().toISOString()}
}
