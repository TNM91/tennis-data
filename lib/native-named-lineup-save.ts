import type {SupabaseClient} from '@supabase/supabase-js'
import {loadNativeLineup} from './native-captain-lineup'
import {readNamedLineupRequest,namedLineupPayload,namedLineupMatches,assertNamedLineupBaseline} from './native-named-lineup-contract'
const fields='id,owner_user_id,scenario_name,team_name,league_name,flight,match_date,opponent_team,slots_json,opponent_slots_json,known_defaults_json,notes'
export async function saveNativeNamedLineup(service:SupabaseClient,caller:SupabaseClient,owner:string,value:unknown){
 const r=readNamedLineupRequest(value),lookup=()=>caller.from('lineup_scenarios').select(fields).eq('id',r.id).eq('owner_user_id',owner).maybeSingle()
 // A confirmed identical retry does not depend on the working plan remaining unchanged.
 const prior=await lookup();if(prior.error)return {ok:false as const,status:503}
 if(prior.data)return namedLineupMatches(prior.data,r,owner)?{ok:true as const,status:200,id:r.id,name:r.name,replayed:true}:{ok:false as const,status:409}
 const base=await loadNativeLineup(service,owner,r.scope,r.match.id);if(!base.ok)return base
 try{assertNamedLineupBaseline(r,base)}catch{return {ok:false as const,status:409}}
 // Caller JWT/RLS owns the insert. No service-role library write, update or upsert.
 const inserted=await caller.from('lineup_scenarios').insert(namedLineupPayload(r,owner)).select(fields).single()
 if(inserted.error){if(inserted.error.code==='23505'){const found=await lookup();if(!found.error&&found.data&&namedLineupMatches(found.data,r,owner))return {ok:true as const,status:200,id:r.id,name:r.name,replayed:true};return {ok:false as const,status:409}}return {ok:false as const,status:inserted.error.code==='42501'?403:503}}
 if(!namedLineupMatches(inserted.data,r,owner))return {ok:false as const,status:503}
 return {ok:true as const,status:200,id:r.id,name:r.name,replayed:false}
}
