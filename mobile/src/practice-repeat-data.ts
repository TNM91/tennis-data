import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {TeamScope} from './team-room-data'
import {parsePracticeSnapshot,type NativePractice} from './captain-practices-data'
import {parsePracticeRepeatPreview,validPracticeRepeatDraft,practiceRepeatId,type PracticeRepeatPreview,type PracticeRepeatDraft} from '../../lib/native-practice-repeat-contract'
export type RepeatReview={preview:PracticeRepeatPreview}|{existing:NativePractice}|{notDue:string}
export class PracticeRepeatError extends Error{constructor(public conflict=false){super('Next practice not confirmed.')}}
export type RepeatSend=(method:'GET'|'POST',options:HttpOptions)=>Promise<HttpResponse>
const transport:RepeatSend=(m,o)=>m==='GET'?CapacitorHttp.get(o):CapacitorHttp.post(o)
async function request(client:SupabaseClient,owner:string,scope:TeamScope,current:()=>boolean,sourceId:string,draft:PracticeRepeatDraft|null,lookup:boolean,send:RepeatSend){
 const own=async()=>{const {data,error}=await client.auth.getSession();if(error||!current()||data.session?.user.id!==owner)throw new PracticeRepeatError(true);return data.session}
 const session=await own(),r=await send(draft?'POST':'GET',{url:'https://www.tenaceiq.com/api/mobile/captain/practices/repeat?'+new URLSearchParams({team:scope.teamName,league:scope.leagueName,flight:scope.flight,eventId:sourceId}),headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json','Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000,...(draft?{data:{action:lookup?'lookup':'create',draft}}:{})});await own()
 if(r.status!==200)throw new PracticeRepeatError([401,403,409].includes(r.status))
 const raw=r.data as {ok?:boolean;owner?:string;scope?:TeamScope;sourceId?:string;preview?:unknown;existing?:boolean;notDue?:boolean;sourceDate?:string;practice?:unknown;requestId?:string}
 if(raw.ok!==true||raw.owner!==owner||raw.sourceId!==sourceId||raw.scope?.teamName!==scope.teamName||raw.scope.leagueName!==scope.leagueName||raw.scope.flight!==scope.flight)throw new PracticeRepeatError()
 return raw
}
export async function loadPracticeRepeat(client:SupabaseClient,owner:string,scope:TeamScope,current:()=>boolean,sourceId:string,send:RepeatSend=transport):Promise<RepeatReview>{
 const r=await request(client,owner,scope,current,sourceId,null,false,send)
 if(r.preview){const preview=parsePracticeRepeatPreview(r.preview);if(preview.sourceId!==sourceId)throw new PracticeRepeatError();return {preview}}
 if(r.notDue===true&&typeof r.sourceDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.sourceDate)&&Number.isFinite(Date.parse(r.sourceDate))&&new Date(r.sourceDate).toISOString().slice(0,10)===r.sourceDate)return {notDue:r.sourceDate}
 if(r.existing===true){const p=parsePracticeSnapshot({ok:true,owner,scope,more:false,practices:[r.practice]},owner,scope).practices[0];if(!practiceRepeatId(p.id)||p.id===sourceId)throw new PracticeRepeatError();return {existing:p}}
 throw new PracticeRepeatError()
}
export async function submitPracticeRepeat(client:SupabaseClient,owner:string,scope:TeamScope,current:()=>boolean,draft:PracticeRepeatDraft,lookup=false,send:RepeatSend=transport){
 if(!validPracticeRepeatDraft(draft))throw new PracticeRepeatError()
 const r=await request(client,owner,scope,current,draft.sourceId,draft,lookup,send),practice=parsePracticeSnapshot({ok:true,owner,scope,more:false,practices:[r.practice]},owner,scope).practices[0]
 if(r.requestId!==draft.requestId||practice.id!==draft.requestId)throw new PracticeRepeatError()
 return practice
}
