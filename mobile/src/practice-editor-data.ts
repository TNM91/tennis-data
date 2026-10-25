import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {TeamScope} from './team-room-data'
import {parsePracticeSnapshot,type NativePractice} from './captain-practices-data'
import {validPracticeEditFields,validPracticeEditId,samePracticeEditFields,type PracticeEditFields} from '../../lib/native-practice-edit'
export type PracticeEdit={owner:string;eventId:string;expectedUpdatedAt:string;requestId:string;fields:PracticeEditFields}
export function freezePracticeEdit(p:NativePractice,fields:PracticeEditFields,requestId:string):PracticeEdit{
 if((p.status==='completed'||p.status==='cancelled')||!validPracticeEditFields(fields)||!validPracticeEditId(requestId))throw Error('Check the date, times and practice details.')
 return Object.freeze({owner:p.owner,eventId:p.id,expectedUpdatedAt:p.updatedAt,requestId,fields:Object.freeze({...fields})})
}
export function practiceEditMatches(edit:PracticeEdit,p:NativePractice){return p.owner===edit.owner&&p.id===edit.eventId&&p.status!=='completed'&&p.status!=='cancelled'&&p.editReceipt?.requestId===edit.requestId&&p.editReceipt.expectedUpdatedAt===edit.expectedUpdatedAt&&samePracticeEditFields(edit.fields,p)}
export class PracticeEditError extends Error{constructor(public conflict=false){super('Practice details not confirmed.')}}
export type EditSend=(options:HttpOptions)=>Promise<HttpResponse>
export async function savePracticeEdit(client:SupabaseClient,current:()=>boolean,scope:TeamScope,edit:PracticeEdit,send:EditSend=o=>CapacitorHttp.patch(o)){
 const own=async()=>{const {data,error}=await client.auth.getSession();if(error||!current()||data.session?.user.id!==edit.owner)throw Error('Sign in again to edit this practice.');return data.session}
 const session=await own(),r=await send({url:'https://www.tenaceiq.com/api/mobile/captain/practices?'+new URLSearchParams({team:scope.teamName,league:scope.leagueName,flight:scope.flight}),headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json','Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000,data:{action:'edit_details',eventId:edit.eventId,expectedUpdatedAt:edit.expectedUpdatedAt,requestId:edit.requestId,fields:edit.fields}});await own()
 if(r.status!==200)throw new PracticeEditError(r.status===409)
 const raw=r.data as {ok?:boolean;practice?:unknown},p=parsePracticeSnapshot({ok:raw.ok,owner:edit.owner,scope,more:false,practices:[raw.practice]},edit.owner,scope).practices[0]
 if(!practiceEditMatches(edit,p))throw new PracticeEditError()
 return p
}
