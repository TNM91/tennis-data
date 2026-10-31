import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp} from '@capacitor/core'
import {scenarioOwner} from './captain-scenarios-data'
import {coachId,coachRecord,readNativeCoach,type NativeCoachSnapshot} from '../../lib/native-coach-contract'
import type {WeeklyLevelUpPlan} from '../../lib/level-up/weekly-plan'
import type {CoachSend} from './coach-workspace-data'
export type CoachResources={workspace:NativeCoachSnapshot;weeks:WeeklyLevelUpPlan[];proof:{id:string;title:string;focus:string;rating:number;note:string;completedAt:string;elapsedSeconds:number;feeling:string;starterRead:{starterProofCue:string;starterSmartNext:string}|null;assignmentId:string|null}[];feed:{created_at:string;last_used_at:string|null;updated_at:string}|null;moreWeeks:boolean;moreProof:boolean}
export async function coachResourceRequest(client:SupabaseClient,owner:string,current:()=>boolean,student:string,data?:Record<string,unknown>,send?:CoachSend){
 const session=await scenarioOwner(client,owner,current)
 const method=data?'POST':'GET',options={url:'https://www.tenaceiq.com/api/mobile/coach/resources?'+new URLSearchParams({student:coachId(student)}),headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json','Cache-Control':'no-store'},responseType:'json' as const,disableRedirects:true,webFetchExtra:{cache:'no-store' as const},connectTimeout:12000,readTimeout:30000,...(data?{data}:{})}
 const response=send?await send(method,options):data?await CapacitorHttp.post(options):await CapacitorHttp.get(options)
 await scenarioOwner(client,owner,current)
 const r=coachRecord(response.data)
 if(response.status!==200||r.ok!==true||r.owner!==owner||JSON.stringify(r).length>1200000)throw Error(response.status===409?'This record changed. Refresh before trying again.':'Coach records could not be confirmed. Refresh before retrying.')
 if(data)return r
 const workspace=readNativeCoach(r.workspace,owner,student)
 if(!Array.isArray(r.weeks)||r.weeks.length>50||!Array.isArray(r.proof)||r.proof.length>100||r.weeks.some(w=>!w||w.studentLinkId!==student||w.sharedWithCoach!==true||!Array.isArray(w.reps)||w.reps.length>12))throw Error('Shared work changed')
 return {...r,workspace} as unknown as CoachResources
}
