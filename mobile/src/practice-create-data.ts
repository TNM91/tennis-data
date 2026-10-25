import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {TeamScope} from './team-room-data'
import {parsePracticeSnapshot,type NativePractice} from './captain-practices-data'
import {practiceCreateRoster,type PracticeCreateDraft} from '../../lib/native-practice-create-contract'
import {samePracticeEditFields} from '../../lib/native-practice-edit'
import {practiceRsvpPath,resolvePracticeToken} from '../../lib/captain-practice-rsvp'
export type PracticeCreated={practice:NativePractice;rsvpPath:string}
export class PracticeCreateError extends Error{constructor(public conflict=false){super('Practice creation not confirmed.')}}
export type CreateSend=(method:'GET'|'POST',options:HttpOptions)=>Promise<HttpResponse>
const transport:CreateSend=(method,o)=>method==='GET'?CapacitorHttp.get(o):CapacitorHttp.post(o)
async function request(client:SupabaseClient,owner:string,scope:TeamScope,current:()=>boolean,draft:PracticeCreateDraft|null,lookup:boolean,send:CreateSend){
 const own=async()=>{const {data,error}=await client.auth.getSession();if(error||!current()||data.session?.user.id!==owner)throw Error('Sign in again to create a practice.');return data.session}
 const session=await own(),r=await send(draft?'POST':'GET',{url:'https://www.tenaceiq.com/api/mobile/captain/practices/create?'+new URLSearchParams({team:scope.teamName,league:scope.leagueName,flight:scope.flight}),headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json','Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000,...(draft?{data:{action:lookup?'lookup':'create',draft}}:{})});await own()
 if(r.status!==200)throw new PracticeCreateError(r.status===409||r.status===403)
 const raw=r.data as {ok?:boolean;owner?:string;scope?:TeamScope;roster?:unknown;requestId?:string;practice?:unknown;rsvpPath?:unknown}
 if(raw.ok!==true||raw.owner!==owner||!raw.scope||raw.scope.teamName!==scope.teamName||raw.scope.leagueName!==scope.leagueName||raw.scope.flight!==scope.flight)throw new PracticeCreateError()
 return raw
}
export async function loadPracticeCreateRoster(client:SupabaseClient,owner:string,scope:TeamScope,current:()=>boolean,send:CreateSend=transport){return practiceCreateRoster((await request(client,owner,scope,current,null,false,send)).roster)}
export async function submitPracticeCreate(client:SupabaseClient,owner:string,scope:TeamScope,current:()=>boolean,draft:PracticeCreateDraft,lookup=false,send:CreateSend=transport):Promise<PracticeCreated>{
 if(draft.owner!==owner)throw new PracticeCreateError()
 const r=await request(client,owner,scope,current,draft,lookup,send),practice=parsePracticeSnapshot({ok:r.ok,owner,scope,more:false,practices:[r.practice]},owner,scope).practices[0],path=typeof r.rsvpPath==='string'?r.rsvpPath:''
 const token=path.startsWith('/pr/')?resolvePracticeToken(path.slice(4)):path.startsWith('/practice/')?resolvePracticeToken(path.slice(10)):''
 if(r.requestId!==draft.requestId||practice.id!==draft.requestId||!samePracticeEditFields(practice,draft.fields)||practice.capacity!==draft.capacity||practice.roster.length!==draft.roster.length||!token||practiceRsvpPath(token)!==path)throw new PracticeCreateError()
 return {practice,rsvpPath:path}
}
