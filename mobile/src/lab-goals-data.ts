import type {SupabaseClient} from '@supabase/supabase-js'
import type {LabGoal} from '../../lib/my-lab-goal-sync'
import {canFollowPlayers} from './follows-data'
export type GoalScope={owner:string;player:string}
export type GoalSnapshot={id:string;revision:string;goal:LabGoal;payload:Record<string,unknown>}
export type GoalDraft={scope:GoalScope;id:string;expected:string|null;revision:string;payload:Record<string,unknown>;goal:LabGoal}
export const goalFields=['goal','progressUpdate','doingWell','improveNext','notes'] as const
const statuses=['not-started','in-progress','improving','completed']
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const bytes=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v)).length
export class GoalConflict extends Error{}
export function parseGoalSnapshot(value:unknown):GoalSnapshot{
 const r=object(value),p=object(r.payload)
 if(typeof r.goal_id!=='string'||!r.goal_id||r.goal_id.length>200||typeof r.edited_at!=='string'||!Number.isFinite(Date.parse(r.edited_at))||p.id!==r.goal_id||!statuses.includes(String(p.progressStatus))||goalFields.some(k=>typeof p[k]!=='string'||(p[k] as string).length>8000)||!(p.updatedAt===null||typeof p.updatedAt==='string'&&Number.isFinite(Date.parse(p.updatedAt)))||bytes(p)>39000)throw Error('This goal needs review on the website.')
 const goal:LabGoal={id:r.goal_id,goal:p.goal as string,progressStatus:p.progressStatus as LabGoal['progressStatus'],progressUpdate:p.progressUpdate as string,doingWell:p.doingWell as string,improveNext:p.improveNext as string,notes:p.notes as string,updatedAt:p.updatedAt as string|null}
 return {id:r.goal_id,revision:r.edited_at,goal,payload:JSON.parse(JSON.stringify(p)) as Record<string,unknown>}
}
export function freezeGoalDraft(scope:GoalScope,base:GoalSnapshot|null,fields:Partial<LabGoal>,id:string,now=new Date()):GoalDraft{
 if(!scope.owner||!scope.player||scope.player.length>200||(!base&&!/^native-goal-[0-9a-f-]{36}$/i.test(id))||base&&base.id!==id)throw Error('Refresh your linked player and goals.')
 const revision=new Date(Math.max(now.getTime(),base?Date.parse(base.revision)+1:0)).toISOString()
 const goal:LabGoal={id,goal:fields.goal??'',progressStatus:fields.progressStatus??'not-started',progressUpdate:fields.progressUpdate??'',doingWell:fields.doingWell??'',improveNext:fields.improveNext??'',notes:fields.notes??'',updatedAt:revision}
 if(!goal.goal.trim())throw Error('Name one tennis goal before reviewing it.')
 const payload={...(base?.payload||{}),...goal},parsed=parseGoalSnapshot({goal_id:id,edited_at:revision,payload})
 const draft:GoalDraft={scope:{...scope},id,expected:base?.revision||null,revision,payload:parsed.payload,goal:parsed.goal}
 function freeze(v:object){Object.values(v).forEach(x=>{if(x&&typeof x==='object')freeze(x)});Object.freeze(v)}freeze(draft);return draft
}
const stable=(v:unknown):string=>v&&typeof v==='object'?Array.isArray(v)?'['+v.map(stable).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable((v as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(v)
export function confirmsGoalDraft(draft:GoalDraft,row:unknown){try{const saved=parseGoalSnapshot(row);const fractional=saved.revision.match(/\.(\d+)(?:Z|[+-]\d\d:?\d\d)$/i)?.[1]||'';return !/[1-9]/.test(fractional.slice(3))&&saved.id===draft.id&&Date.parse(saved.revision)===Date.parse(draft.revision)&&stable(saved.payload)===stable(draft.payload)}catch{return false}}
async function own(client:SupabaseClient,scope:GoalScope,current:()=>boolean){
 const {data,error}=await client.auth.getSession();if(error||!current()||data.session?.user.id!==scope.owner)throw Error('This notebook is no longer open.')
 const result=await client.from('profiles').select('linked_player_id').eq('id',scope.owner).abortSignal(AbortSignal.timeout(12000)).maybeSingle()
 if(result.error||!current()||result.data?.linked_player_id!==scope.player)throw Error('Your linked player changed. Reopen My Lab.')
 const again=await client.auth.getSession();if(again.error||!current()||again.data.session?.user.id!==scope.owner)throw Error('This notebook is no longer open.')
}
async function access(client:SupabaseClient,scope:GoalScope,current:()=>boolean){await own(client,scope,current);if(!await canFollowPlayers(client,current))throw Error('Player access is required for account training notes.');await own(client,scope,current)}
const query=(client:SupabaseClient,scope:GoalScope)=>client.from('my_lab_goals').select('goal_id,payload,edited_at').eq('user_id',scope.owner).eq('player_id',scope.player)
export async function loadLabGoals(client:SupabaseClient,scope:GoalScope,current:()=>boolean){
 await access(client,scope,current)
 const result=await query(client,scope).not('payload','is',null).order('edited_at',{ascending:false}).order('goal_id').limit(101).abortSignal(AbortSignal.timeout(12000));await own(client,scope,current)
 if(result.error||!Array.isArray(result.data)||result.data.length>100)throw Error('Goals unavailable. If you have more than 100 goals, review them on the website.')
 const rows=result.data.map(parseGoalSnapshot);if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Goals unavailable.');return rows
}
async function lookup(client:SupabaseClient,draft:GoalDraft,current:()=>boolean){const r=await query(client,draft.scope).eq('goal_id',draft.id).abortSignal(AbortSignal.timeout(12000)).maybeSingle();await own(client,draft.scope,current);if(r.error)throw Error('Could not check this goal.');return r.data}
export async function checkLabGoal(client:SupabaseClient,draft:GoalDraft,current:()=>boolean){await access(client,draft.scope,current);return confirmsGoalDraft(draft,await lookup(client,draft,current))}
export async function saveLabGoal(client:SupabaseClient,draft:GoalDraft,current:()=>boolean){
 await access(client,draft.scope,current)
 const existing=await lookup(client,draft,current);if(confirmsGoalDraft(draft,existing))return parseGoalSnapshot(existing)
 if(existing&&(!draft.expected||object(existing).edited_at!==draft.expected)||!existing&&draft.expected)throw new GoalConflict('This goal changed. Reload it before editing again.')
 // A null payload is a website tombstone. Never resurrect it through an edit.
 if(existing&&object(existing).payload===null)throw new GoalConflict('This goal was removed on another device.')
 const write={payload:draft.payload,edited_at:draft.revision}
 const result=draft.expected?await client.from('my_lab_goals').update(write).eq('user_id',draft.scope.owner).eq('player_id',draft.scope.player).eq('goal_id',draft.id).eq('edited_at',draft.expected).not('payload','is',null).select('goal_id,payload,edited_at').abortSignal(AbortSignal.timeout(12000)).maybeSingle():await client.from('my_lab_goals').insert({...write,user_id:draft.scope.owner,player_id:draft.scope.player,goal_id:draft.id}).select('goal_id,payload,edited_at').abortSignal(AbortSignal.timeout(12000)).maybeSingle()
 await own(client,draft.scope,current)
 if(result.error)throw Error('Goal save not confirmed. Check this exact goal before retrying.')
 if(!result.data)throw new GoalConflict('This goal changed. Reload it before editing again.')
 if(!confirmsGoalDraft(draft,result.data))throw Error('Goal save not confirmed. Check this exact goal before retrying.')
 return parseGoalSnapshot(result.data)
}
