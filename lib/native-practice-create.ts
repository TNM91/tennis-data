import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamRoomScope} from './team-room'
import {authorizeNativeCaptainScope} from './native-captain-workspace'
import {practiceCreateRoster,validPracticeCreate,freezePracticeCreate} from './native-practice-create-contract'
import {practiceRsvpPath} from './captain-practice-rsvp'
import {nativeInviteToken} from './native-team-invite-contract'
import {loadNativeCaptainPractices} from './native-captain-practices'
import {samePracticeEditFields} from './native-practice-edit'
export async function nativePracticeCreate(service:SupabaseClient,owner:string,scope:TeamRoomScope,body:Record<string,unknown>){
 const action=body.action
 if(!['preview','create','lookup'].includes(String(action))||action!=='preview'&&(!validPracticeCreate(body.draft)||body.draft.owner!==owner))return {ok:false as const,status:400}
 const access=await authorizeNativeCaptainScope(service,owner,scope);if(!access.ok)return access
 const source=body.draft as import('./native-practice-create-contract').PracticeCreateDraft|undefined
 const draft=action==='preview'?null:freezePracticeCreate(owner,source!.requestId,source!.fields,source!.capacity,source!.roster)
 const result=await service.rpc('native_create_practice',{p_owner:owner,p_team:scope.teamName,p_league:scope.leagueName,p_flight:scope.flight,p_action:action,p_id:draft?.requestId||null,p_fields:draft?.fields||null,p_capacity:draft?.capacity??null,p_roster:draft?.roster||null}),r=result.data
 if(result.error||!r||r.ok!==true)return {ok:false as const,status:[400,403,404,409].includes(r?.status)?r.status:503}
 if(r.status!==200||r.nativePracticeCreate!==1)throw Error('Practice creation receipt unavailable.')
 if(action==='preview')return {ok:true as const,status:200,owner,scope,roster:practiceCreateRoster(r.roster)}
 if(!draft||r.eventId!==draft.requestId||!nativeInviteToken(r.publicToken)||r.rosterCount!==draft.roster.length)throw Error('Practice creation receipt unavailable.')
 const loaded=await loadNativeCaptainPractices(service,owner,scope,draft.requestId);if(!loaded.ok)return loaded
 const practice=loaded.practices.find(p=>p.id===draft.requestId)
 if(!practice||!samePracticeEditFields(practice,draft.fields)||practice.capacity!==draft.capacity||practice.roster.length!==draft.roster.length) return {ok:false as const,status:409}
 return {ok:true as const,status:200,owner,scope,requestId:draft.requestId,practice,rsvpPath:practiceRsvpPath(r.publicToken)}
}
