import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {TeamScope} from './team-room-data'
import {parsePracticeSnapshot,type NativePractice} from './captain-practices-data'
import {validPracticeEditId} from '../../lib/native-practice-edit'
export type PracticeCancellation=Readonly<{owner:string;eventId:string;expectedUpdatedAt:string;requestId:string}>
export function freezePracticeCancellation(p:NativePractice,requestId:string):PracticeCancellation{
 if(!['proposed','confirmed'].includes(p.status)||!validPracticeEditId(requestId))throw Error('Refresh this practice before cancelling.')
 return Object.freeze({owner:p.owner,eventId:p.id,expectedUpdatedAt:p.updatedAt,requestId})
}
export function practiceCancellationMatches(c:PracticeCancellation,p:NativePractice){return p.owner===c.owner&&p.id===c.eventId&&p.status==='cancelled'&&p.cancelReceipt?.requestId===c.requestId&&p.cancelReceipt.expectedUpdatedAt===c.expectedUpdatedAt}
export class PracticeCancellationError extends Error{constructor(public conflict=false){super('Cancellation not confirmed.')}}
export type CancelSend=(method:'GET'|'PATCH',options:HttpOptions)=>Promise<HttpResponse>
export async function sendPracticeCancellation(client:SupabaseClient,current:()=>boolean,scope:TeamScope,c:PracticeCancellation,lookup=false,send:CancelSend=(m,o)=>m==='GET'?CapacitorHttp.get(o):CapacitorHttp.patch(o)){
 const own=async()=>{const {data,error}=await client.auth.getSession();if(error||!current()||data.session?.user.id!==c.owner)throw Error('Sign in again to open practices.');return data.session}
 const session=await own(),query=new URLSearchParams({team:scope.teamName,league:scope.leagueName,flight:scope.flight,...(lookup?{eventId:c.eventId}:{})}),r=await send(lookup?'GET':'PATCH',{url:'https://www.tenaceiq.com/api/mobile/captain/practices?'+query,headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json','Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000,...(lookup?{}:{data:{action:'cancel_occurrence',eventId:c.eventId,expectedUpdatedAt:c.expectedUpdatedAt,requestId:c.requestId}})});await own()
 if(r.status!==200)throw new PracticeCancellationError(r.status===409||r.status===403)
 const raw=r.data as {ok?:boolean;practice?:unknown},p=(lookup?parsePracticeSnapshot(raw,c.owner,scope):parsePracticeSnapshot({ok:raw.ok,owner:c.owner,scope,more:false,practices:[raw.practice]},c.owner,scope)).practices.find(p=>practiceCancellationMatches(c,p))
 if(!p)throw new PracticeCancellationError(true)
 return p
}
