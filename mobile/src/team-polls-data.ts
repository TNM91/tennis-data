import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import {parseTeamPoll,validPollAction,pollId,type PollAction} from '../../lib/team-poll-contract'
export class PollRequestError extends Error{constructor(readonly uncertain:boolean,readonly status=0){super('Poll action not confirmed.')}}
export type PollTransport=(method:'GET'|'POST',options:HttpOptions)=>Promise<HttpResponse>
export async function requestTeamPoll(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,roomId:string,action:PollAction,send:PollTransport=(m,o)=>m==='GET'?CapacitorHttp.get(o):CapacitorHttp.post(o)){
 if(!validPollAction(action)||!pollId(roomId)||scope.chatRoomId&&scope.chatRoomId!==roomId)throw new PollRequestError(false,400)
 const own=async()=>{const s=await client.auth.getSession();if(s.error||s.data.session?.user.id!==owner||!current())throw Error('This conversation is no longer open.');return s.data.session}
 const session=await own(),url=new URL('https://www.tenaceiq.com/api/team-rooms/polls');for(const [k,v] of Object.entries({team:scope.teamName,league:scope.leagueName,flight:scope.flight,room:roomId,...(action.action==='get'?{poll:action.id}:{})}))url.searchParams.set(k,v)
 let r:HttpResponse
 try{r=await send(action.action==='get'?'GET':'POST',{url:url.href,headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json','Cache-Control':'no-store'},disableRedirects:true,webFetchExtra:{cache:'no-store'},responseType:'json',connectTimeout:12000,readTimeout:30000,...(action.action==='get'?{}:{data:action})})}catch{throw new PollRequestError(action.action!=='get')}
 await own()
 if(r.status!==200)throw new PollRequestError(![400,401,403,404,409,429].includes(r.status),r.status)
 const v=r.data;if(v?.ok!==true||v.teamPoll!==1||v.owner!==owner||v.scope?.teamName!==scope.teamName||v.scope?.leagueName!==scope.leagueName||v.scope?.flight!==scope.flight)throw new PollRequestError(action.action!=='get')
 const poll=parseTeamPoll(v.poll,action.id,roomId)
 if('question'in action&&(poll.question!==action.question||poll.options.length!==action.options.length||poll.options.some((o,i)=>o.label!==action.options[i]))||action.action==='vote'&&poll.mine!==action.choice||action.action==='close'&&!poll.closed)throw new PollRequestError(true)
 return poll
}
