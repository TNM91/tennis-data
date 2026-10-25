import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamRoomScope} from './team-room'
import {authorizeNativeCaptainScope} from './native-captain-workspace'
import {loadNativeCaptainPractices} from './native-captain-practices'
import {validPracticeRepeatDraft,parsePracticeRepeatPreview,practiceRepeatId,type PracticeRepeatDraft} from './native-practice-repeat-contract'
export async function nativePracticeRepeat(service:SupabaseClient,owner:string,scope:TeamRoomScope,body:Record<string,unknown>){
 const action=body.action,draft=body.draft as PracticeRepeatDraft|undefined,sourceId=action==='preview'?body.sourceId:draft?.sourceId
 if(!['preview','create','lookup'].includes(String(action))||!practiceRepeatId(sourceId)||action!=='preview'&&!validPracticeRepeatDraft(draft))return {ok:false as const,status:400}
 const access=await authorizeNativeCaptainScope(service,owner,scope);if(!access.ok)return access
 const result=await service.rpc('native_repeat_practice',{p_owner:owner,p_team:scope.teamName,p_league:scope.leagueName,p_flight:scope.flight,p_action:action,p_source:sourceId,p_id:draft?.requestId||null,p_revision:draft?.sourceRevision||null,p_snapshot:draft?.snapshot||null,p_date:draft?.nextDate||null}),r=result.data
 if(result.error||r?.ok!==true)return {ok:false as const,status:[400,403,404,409].includes(r?.status)?r.status:503}
 if(r.status!==200||r.nativePracticeRepeat!==1)throw Error('Repeat receipt unavailable.')
 if(action==='preview'&&r.preview){const preview=parsePracticeRepeatPreview(r.preview);if(preview.sourceId!==sourceId)throw Error('Wrong source.');return {ok:true as const,status:200,owner,scope,sourceId,preview}}
 if(action==='preview'&&r.notDue===true){if(typeof r.sourceDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.sourceDate))throw Error('Repeat date unavailable.');return {ok:true as const,status:200,owner,scope,sourceId,notDue:true,sourceDate:r.sourceDate}}
 const id=action==='preview'?r.existingEventId:r.eventId
 if(!practiceRepeatId(id)||action!=='preview'&&(r.requestId!==draft?.requestId||id!==draft?.requestId||r.sourceId!==sourceId))throw Error('Repeat receipt unavailable.')
 const loaded=await loadNativeCaptainPractices(service,owner,scope,id);if(!loaded.ok)return loaded
 const practice=loaded.practices.find(p=>p.id===id);if(!practice)return {ok:false as const,status:409}
 return {ok:true as const,status:200,owner,scope,sourceId,practice,...(action==='preview'?{existing:true}:{requestId:draft!.requestId})}
}
