import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import {lineupRecord,type LineupEditorData,type LineupPlan} from '../../lib/native-captain-lineup-contract'
export type LineupTransport=(method:'GET'|'PUT',options:HttpOptions)=>Promise<HttpResponse>
const nativeSend:LineupTransport=(method,options)=>method==='GET'?CapacitorHttp.get(options):CapacitorHttp.put(options)
export class LineupFailure extends Error{constructor(message:string,public status:number){super(message)}}
async function request(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,match:string,body:unknown,send:LineupTransport){
 const {data,error}=await client.auth.getSession();if(error||data.session?.user.id!==owner||!current())throw new LineupFailure('Sign in again to plan a lineup.',401)
 const url=new URL('https://www.tenaceiq.com/api/mobile/captain/lineup');for(const [key,value] of [['team',scope.teamName],['league',scope.leagueName],['flight',scope.flight],['match',match]])url.searchParams.set(key,value)
 let response:HttpResponse
 try{response=await send(body?'PUT':'GET',{url:url.toString(),headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},...(body?{data:body}:{}),disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000})}catch{throw new LineupFailure('The save could not be confirmed. Check your connection and retry the same lineup.',0)}
 const latest=await client.auth.getSession();if(latest.error||latest.data.session?.user.id!==owner||!current())throw new LineupFailure('This lineup is no longer open.',401)
 const row=lineupRecord(response.data)
 if(response.status!==200||row.ok!==true)throw new LineupFailure(response.status===409?'This lineup changed. Keep your notes, then reopen the latest plan.':response.status===403?'Captain access is required for this team.':response.status===400&&typeof row.message==='string'?row.message.slice(0,240):'The request could not be confirmed. Retry when your connection is ready.',response.status)
 return row
}
export async function loadLineupEditor(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,matchId:string,send:LineupTransport=nativeSend):Promise<LineupEditorData>{
 return parseLineupEditor(await request(client,owner,current,scope,matchId,null,send),scope,matchId)
}
export function parseLineupEditor(value:unknown,scope:TeamScope,matchId:string):LineupEditorData{
 const row=lineupRecord(value),returned=lineupRecord(row.scope),match=lineupRecord(row.match),plan=lineupRecord(row.plan)
 if(returned.teamName!==scope.teamName||returned.leagueName!==scope.leagueName||returned.flight!==scope.flight||match.id!==matchId||typeof match.date!=='string'||typeof match.opponent!=='string'||typeof row.version!=='string'||!Array.isArray(row.roster)||row.roster.length>250||!Array.isArray(plan.courts)||!plan.courts.length||plan.courts.length>30)throw new LineupFailure('The selected fixture could not be confirmed.',503)
 const roster=row.roster.map(value=>{const p=lineupRecord(value);if(typeof p.key!=='string'||typeof p.playerId!=='string'||typeof p.name!=='string'||p.key.length>120||p.name.length>160)throw new LineupFailure('The roster could not be confirmed.',503);return {key:p.key,playerId:p.playerId,name:p.name}})
 if(roster.some(p=>!p.key||!p.name.trim()||p.playerId.length>120)||new Set(roster.map(p=>p.key)).size!==roster.length)throw new LineupFailure('The roster identities could not be confirmed.',503)
 const courts=plan.courts.map(value=>{const c=lineupRecord(value);if(typeof c.id!=='string'||typeof c.label!=='string'||!['singles','doubles'].includes(String(c.slotType))||!Array.isArray(c.players)||c.players.length!==(c.slotType==='doubles'?2:1)||c.players.some(p=>typeof p!=='string'))throw new LineupFailure('The court assignments could not be confirmed.',503);return {id:c.id,label:c.label,slotType:c.slotType as 'singles'|'doubles',defaulted:c.defaulted===true,players:c.players as string[],...(typeof c.ratingLevel==='number'?{ratingLevel:c.ratingLevel}:{})}})
 const text=(key:string,max:number)=>{if(typeof plan[key]!=='string'||(plan[key] as string).length>max)throw new LineupFailure('The lineup details could not be confirmed.',503);return plan[key] as string}
 return {ok:true,scope:{...scope},match:{id:matchId,date:match.date,opponent:match.opponent},version:row.version,sent:row.sent===true,roster,plan:{courts,notes:text('notes',1200),location:text('location',240),directions:text('directions',600),arrivalTime:text('arrivalTime',80),teamNotes:text('teamNotes',1200)}}
}
export async function saveLineupEditor(client:SupabaseClient,owner:string,current:()=>boolean,data:LineupEditorData,plan:LineupPlan,send:LineupTransport=nativeSend){
 const row=await request(client,owner,current,data.scope,data.match.id,{matchId:data.match.id,matchDate:data.match.date,opponent:data.match.opponent,version:data.version,plan},send)
 if(typeof row.updatedAt!=='string'||!Number.isFinite(Date.parse(row.updatedAt)))throw new LineupFailure('The save could not be confirmed. Retry the same lineup.',0)
 return row.updatedAt
}
