import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp} from '@capacitor/core'
import type {TeamScope} from './team-room-data'
export type CaptainMatch={id:string;date:string;time:string;facility:string;opponent:string}
export type CaptainDraft={matchDate:string;opponent:string;status:string;sent:boolean;updatedAt:string;notes:string;location:string;arrivalTime:string;courts:{label:string;players:string[]}[]}
export type CaptainData={scope:TeamScope;checkedAt:string;moreMatches:boolean;moreDrafts:boolean;roster:{id:string;name:string}[];matches:CaptainMatch[];drafts:CaptainDraft[]}
export type CaptainReplies={people:{key:string;name:string;status:'available'|'maybe'|'unavailable'|'waiting';source:string;selected:boolean}[];selection:string;dayScopedAnswersOmitted:boolean}
const record=(value:unknown):Record<string,unknown>=>value && typeof value==='object' && !Array.isArray(value)?value as Record<string,unknown>:{}
const text=(value:unknown,max=160)=>typeof value==='string'?value.slice(0,max):''
const same=(value:unknown,scope:TeamScope)=>{const row=record(value);return row.teamName===scope.teamName && row.leagueName===scope.leagueName && row.flight===scope.flight}
export function parseCaptainData(value:unknown,scope:TeamScope):CaptainData{
 const row=record(value)
 if(row.ok!==true || !same(row.scope,scope) || !Array.isArray(row.roster) || row.roster.length>250 || !Array.isArray(row.matches) || row.matches.length>40 || !Array.isArray(row.drafts) || row.drafts.length>20)throw Error('Captain data could not be confirmed.')
 return {scope:{...scope},checkedAt:text(row.checkedAt,80),moreMatches:row.moreMatches===true,moreDrafts:row.moreDrafts===true,
  roster:row.roster.map(value=>{const player=record(value);return {id:text(player.id,120),name:text(player.name)}}),
  matches:row.matches.map(value=>{const match=record(value);return {id:text(match.id,120),date:text(match.date,10),time:text(match.time,80),facility:text(match.facility,240),opponent:text(match.opponent)}}),
  drafts:row.drafts.map(value=>{const draft=record(value);return {matchDate:text(draft.matchDate,10),opponent:text(draft.opponent),status:draft.status==='final'?'final':'working',sent:draft.sent===true,updatedAt:text(draft.updatedAt,80),notes:text(draft.notes,1200),location:text(draft.location,240),arrivalTime:text(draft.arrivalTime,80),courts:(Array.isArray(draft.courts)?draft.courts:[]).slice(0,30).map(value=>{const court=record(value);return {label:text(court.label,120),players:(Array.isArray(court.players)?court.players:[]).slice(0,2).map(value=>text(value))}})}})}
}
async function getCaptain(client:SupabaseClient,owner:string,current:()=>boolean,url:URL,send:typeof CapacitorHttp.get){
 const {data,error}=await client.auth.getSession()
 if(error || data.session?.user.id!==owner || !current())throw Error('Sign in again to open Captain tools.')
 let response
 try{response=await send({url:url.toString(),headers:{Authorization:`Bearer ${data.session.access_token}`},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:30000})}catch{throw Error('Captain tools are unavailable. Check your connection.')}
 if(!current())throw Error('This team is no longer open.')
 if(response.status===403)throw Error('Captain access is required for this team. Refresh your account and team connection.')
 if(response.status===409)throw Error('More than one fixture may match this date. Replies can’t be combined safely.')
 if(response.status!==200)throw Error('Captain tools are unavailable. Try refreshing.')
 return response.data as unknown
}
export async function loadCaptainData(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,send:typeof CapacitorHttp.get=options=>CapacitorHttp.get(options)){
 const url=new URL('https://www.tenaceiq.com/api/mobile/captain');for(const [key,value] of [['team',scope.teamName],['league',scope.leagueName],['flight',scope.flight]])url.searchParams.set(key,value)
 return parseCaptainData(await getCaptain(client,owner,current,url,send),scope)
}
export async function loadCaptainReplies(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,match:CaptainMatch,send:typeof CapacitorHttp.get=options=>CapacitorHttp.get(options)):Promise<CaptainReplies>{
 const url=new URL('https://www.tenaceiq.com/api/captain/team-availability-summary');for(const [key,value] of [['team',scope.teamName],['league',scope.leagueName],['flight',scope.flight],['date',match.date],['opponent',match.opponent]])url.searchParams.set(key,value)
 const row=record(await getCaptain(client,owner,current,url,send)),returned=record(row.match),returnedScope=record(row.scope),summary=record(row.summary)
 if((returned.home_team!==scope.teamName && returned.away_team!==scope.teamName) || (returned.home_team===scope.teamName?returned.away_team:returned.home_team)!==match.opponent || returned.id!==match.id || returned.match_date!==match.date || returnedScope.team!==scope.teamName || returnedScope.league!==scope.leagueName || returnedScope.flight!==scope.flight || !Array.isArray(summary.people) || summary.people.length>250)throw Error('These replies do not match the selected fixture.')
 const seen=new Set<string>()
 return {selection:text(row.selection,40),dayScopedAnswersOmitted:row.dayScopedAnswersOmitted===true,people:summary.people.map(value=>{const person=record(value),status=person.status;if(typeof person.key!=='string'||!person.key||person.key.length>120||seen.has(person.key)||typeof person.name!=='string'||!person.name.trim()||person.name.length>160||!['available','maybe','unavailable','waiting'].includes(String(status))||person.source!=null&&!['','season','captain','player','saved'].includes(String(person.source)))throw Error('Replies could not be confirmed.');seen.add(person.key);return {key:person.key,name:person.name,status:status as CaptainReplies['people'][number]['status'],source:text(person.source,40),selected:person.selected===true}})}
}
