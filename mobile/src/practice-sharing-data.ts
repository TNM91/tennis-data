import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {TeamScope} from './team-room-data'
import {parsePracticeSnapshot} from './captain-practices-data'
import {validPracticeRsvpPath,samePracticeShare,type PracticeShare,type PracticeAnnouncement} from '../../lib/native-practice-share-contract'
export type {PracticeShare,PracticeAnnouncement}
export class PracticeShareError extends Error{constructor(public conflict=false){super('Practice sharing not confirmed.')}}
export type PracticeShareSend=(method:'GET'|'POST',options:HttpOptions)=>Promise<HttpResponse>
export async function practiceShareOwner(client:SupabaseClient,owner:string,current:()=>boolean){const {data,error}=await client.auth.getSession();if(error||data.session?.user.id!==owner||!current())throw Error('Sign in again to share practice.');return data.session}
async function request(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,eventId:string,announcement:PracticeAnnouncement|null,lookup:boolean,send:PracticeShareSend){
 const session=await practiceShareOwner(client,owner,current),r=await send(announcement?'POST':'GET',{url:'https://www.tenaceiq.com/api/mobile/captain/practices/share?'+new URLSearchParams({team:scope.teamName,league:scope.leagueName,flight:scope.flight,eventId}),headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json','Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000,...(announcement?{data:{action:lookup?'lookup':'announce',...announcement}}:{})});await practiceShareOwner(client,owner,current)
 if(r.status!==200)throw new PracticeShareError([401,403,409].includes(r.status))
 const value=r.data as {ok?:boolean;owner?:string;scope?:TeamScope;practice?:unknown;rsvpPath?:unknown;eventId?:string;announcementId?:string;body?:string}
 if(value.ok!==true||value.owner!==owner||value.scope?.teamName!==scope.teamName||value.scope.leagueName!==scope.leagueName||value.scope.flight!==scope.flight)throw new PracticeShareError();return value
}
const transport:PracticeShareSend=(m,o)=>m==='GET'?CapacitorHttp.get(o):CapacitorHttp.post(o)
export async function readPracticeShare(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,eventId:string,send:PracticeShareSend=transport):Promise<PracticeShare>{const r=await request(client,owner,current,scope,eventId,null,false,send),p=parsePracticeSnapshot({ok:true,owner,scope,more:false,practices:[r.practice]},owner,scope).practices[0];if(p.status==='completed'||p.id!==eventId||!validPracticeRsvpPath(r.rsvpPath))throw new PracticeShareError();return {practice:p,rsvpPath:r.rsvpPath}}
export async function sendPracticeAnnouncement(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,a:PracticeAnnouncement,lookup=false,send:PracticeShareSend=transport){const r=await request(client,owner,current,scope,a.eventId,a,lookup,send);if(r.eventId!==a.eventId||r.announcementId!==a.clientMessageId||r.body!==a.body)throw new PracticeShareError();return a.clientMessageId}
export async function reviewedPracticeShare(reviewed:PracticeShare,load:()=>Promise<PracticeShare>,current:()=>boolean,share:(value:PracticeShare)=>Promise<void>){const fresh=await load();if(!current())throw Error('This practice is no longer open.');if(!samePracticeShare(reviewed,fresh))return {done:false,share:fresh};await share(fresh);return {done:true,share:fresh}}
