import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamRoomScope} from './team-room'
import {loadNativeCaptainCourtScout} from './native-captain-court-scout'
import {opponentScenarioRatings} from './native-opponent-scenario-contract'
export async function loadNativeOpponentScenarios(service:SupabaseClient,owner:string,scope:TeamRoomScope,matchId:string){
 const ctx=await loadNativeCaptainCourtScout(service,owner,scope,matchId);if(!ctx.ok)return ctx
 const ids=ctx.records.players.map(p=>p.id),r=ids.length?await service.from('players').select('id,singles_dynamic_rating,doubles_dynamic_rating,overall_dynamic_rating').in('id',ids).limit(321):{data:[],error:null}
 if(r.error||!Array.isArray(r.data))return {ok:false as const,status:503}
 return {...ctx,ratings:opponentScenarioRatings(r.data,ctx)}
}
