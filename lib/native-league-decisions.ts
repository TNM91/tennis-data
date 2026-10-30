import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {entryLeague} from './native-league-entry-contract'
import {assessPlayerEligibility,buildPlayerEligibilityRequirement} from './player-eligibility'
import {decisionDraft,type DecisionEntry,type DecisionReview} from './native-league-decisions-contract'
type Row=Record<string,unknown>
const text=(v:unknown)=>typeof v==='string'?v.trim():''
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const timeout=()=>AbortSignal.timeout(12000)
const leagueFields='id,created_by_user_id,league_name,league_format,season_status,flight,notes,updated_at'
const common='id,league_id,entry_status,created_by_user_id,updated_at'
const playerFields='player_name,eligibility_rating,eligibility_rating_source,eligibility_age_division,eligibility_age_division_source,eligibility_mixed_pair_role,eligibility_mixed_pair_role_source,eligibility_status,eligibility_review_note,player_action_required,player_request_note'
async function owned(db:SupabaseClient,owner:string,id:string){const r=await db.from('tiq_leagues').select(leagueFields).eq('id',entryLeague(id)).eq('created_by_user_id',owner).abortSignal(timeout()).maybeSingle();if(r.error||!owner||!r.data||r.data.id!==id||r.data.created_by_user_id!==owner||!['team','individual'].includes(r.data.league_format))throw Error('League ownership unavailable');return r.data as Row}
const table=(l:Row)=>l.league_format==='team'?'tiq_team_league_entries':'tiq_player_league_entries'
const fields=(l:Row)=>common+','+(l.league_format==='team'?'team_name':playerFields)
function project(l:Row,e:Row,owner:string):DecisionEntry{
 const team=l.league_format==='team',rating=e.eligibility_rating===null||e.eligibility_rating===undefined?null:e.eligibility_rating
 if(e.league_id!==l.id||!text(e.id)||!Number.isFinite(Date.parse(text(e.updated_at)))||!['pending','active','rejected','removed'].includes(text(e.entry_status))||rating!==null&&(typeof rating!=='number'||!Number.isFinite(rating)||rating<1||rating>7))throw Error('Entry context unavailable')
 const assessment=assessPlayerEligibility(buildPlayerEligibilityRequirement(text(l.league_name),text(l.flight),text(l.notes)),{rating:rating as number|null,ratingSource:text(e.eligibility_rating_source),ageDivisions:[text(e.eligibility_age_division)],ageDivisionSource:text(e.eligibility_age_division_source),mixedPairRole:text(e.eligibility_mixed_pair_role),mixedPairRoleSource:text(e.eligibility_mixed_pair_role_source)})
 return {id:text(e.id),name:text(e[team?'team_name':'player_name']),status:e.entry_status as DecisionEntry['status'],review:hash({owner,league:l,entry:e}),updatedAt:text(e.updated_at),eligibility:team?'needs_confirmation':assessment.status,detail:team?'Confirm the team and its division before approval. This request does not establish captain status.':assessment.detail,rating:rating as number|null,ratingSource:text(e.eligibility_rating_source)||'unknown',age:text(e.eligibility_age_division),ageSource:text(e.eligibility_age_division_source)||'unknown',division:text(e.eligibility_mixed_pair_role)||'unknown',divisionSource:text(e.eligibility_mixed_pair_role_source)||'unknown',actionRequired:e.player_action_required===true,requestNote:text(e.player_request_note)}
}
/** Exact season creator and caller RLS. Read saved submission evidence, never upgrade self-attestations to verified. */
export async function loadNativeLeagueDecisions(db:SupabaseClient,owner:string,id:string):Promise<DecisionReview>{
 const l=await owned(db,owner,id),r=await db.from(table(l)).select(fields(l)).eq('league_id',id).eq('entry_status','pending').order('updated_at').order('id').limit(101).abortSignal(timeout())
 const data=r.data as unknown as Row[]|null
 if(r.error||!Array.isArray(data)||data.length>101||data.some(e=>e.league_id!==id||e.entry_status!=='pending'))throw Error('Requests unavailable')
 const latest=await owned(db,owner,id);if(JSON.stringify(latest)!==JSON.stringify(l))throw Error('League changed')
 const entries=data.slice(0,100).map(e=>project(l,e,owner));if(new Set(entries.map(e=>e.id)).size!==entries.length)throw Error('Ambiguous requests')
 return {owner,leagueId:id,leagueName:text(l.league_name),format:l.league_format as DecisionReview['format'],checkedAt:new Date().toISOString(),open:['draft','active'].includes(text(l.season_status)),entries,more:data.length>100}
}
const fail=(status:number,message:string)=>({ok:false as const,status,message})
export async function decideNativeLeagueEntry(db:SupabaseClient,owner:string,body:unknown){
 let input:ReturnType<typeof decisionDraft>;try{input=decisionDraft(body)}catch{return fail(400,'Check your entry decision.')}
 const l=await owned(db,owner,input.leagueId),r=await db.from(table(l)).select(fields(l)).eq('id',input.entryId).eq('league_id',input.leagueId).abortSignal(timeout()).maybeSingle()
 if(r.error)throw Error('Request unavailable');if(!r.data)return fail(409,'This entry changed. Refresh requests before deciding.')
 const source=r.data as unknown as Row,entry=project(l,source,owner)
 if(entry.status!=='pending'||entry.review!==input.review)return fail(409,'This entry changed. Refresh requests before deciding.')
 if(!['draft','active'].includes(text(l.season_status)))return fail(409,'This season is closed for entry decisions.')
 if(input.decision==='information'&&(l.league_format!=='individual'||!input.note))return fail(400,'Tell the player what information is missing.')
 if(input.decision==='active'&&(!input.confirmed||entry.eligibility==='ineligible'||entry.actionRequired||entry.eligibility==='needs_confirmation'&&!input.note))return fail(400,'Review and confirm eligibility before approval. Resolve missing information first.')
 const latest=await owned(db,owner,input.leagueId);if(JSON.stringify(latest)!==JSON.stringify(l))return fail(409,'League details changed. Refresh requests before deciding.')
 const now=new Date().toISOString(),payload:Row={updated_by_user_id:owner,...(input.decision==='information'?{player_action_required:true,player_request_note:input.note,eligibility_status:'needs_confirmation',eligibility_review_note:input.note}:{entry_status:input.decision,...(l.league_format==='individual'?{player_action_required:false,player_request_note:'',eligibility_status:input.decision==='active'?'verified':entry.eligibility,eligibility_review_note:input.note||entry.detail,eligibility_reviewed_at:now,eligibility_reviewed_by:owner}:{})})}
 // Compare the exact persisted timestamp in the UPDATE itself: a concurrent reply/decision returns no row.
 const saved=await db.from(table(l)).update(payload).eq('id',input.entryId).eq('league_id',input.leagueId).eq('entry_status','pending').eq('updated_at',source.updated_at).select(fields(l)).abortSignal(timeout()).maybeSingle()
 if(saved.error)throw Error('Decision outcome unavailable');if(!saved.data)return fail(409,'This entry changed. Refresh requests before deciding.')
 const receipt=project(l,saved.data as unknown as Row,owner)
 if(receipt.id!==entry.id||input.decision==='information'&&(!receipt.actionRequired||receipt.requestNote!==input.note)||input.decision!=='information'&&receipt.status!==input.decision)throw Error('Decision outcome unavailable')
 // Preserve website notifications; a notification failure never disguises a confirmed decision as unsaved.
 let notified=false;const recipient=text(source.created_by_user_id)
 if(recipient&&recipient!==owner){try{const n=await db.from('internal_notifications').insert({recipient_profile_id:recipient,actor_user_id:owner,notification_type:'system',title:input.decision==='active'?'League entry approved':input.decision==='information'?'League entry needs information':'League entry update',body:input.decision==='information'?text(l.league_name)+': '+input.note:entry.name+', your request for '+text(l.league_name)+(input.decision==='active'?' was approved.':' was not approved.'),href:'/compete#my-entries'}).abortSignal(timeout());notified=!n.error}catch{/* Saved receipt remains authoritative. */}}
 return {ok:true as const,status:200,owner,leagueId:input.leagueId,receipt,notified}
}
