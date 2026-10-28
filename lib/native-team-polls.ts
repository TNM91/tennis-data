import type {SupabaseClient} from '@supabase/supabase-js'
import {validPollAction,parseTeamPoll,pollId,type PollAction} from './team-poll-contract'
export async function nativeTeamPoll(service:SupabaseClient,owner:string,scope:{teamName:string;leagueName:string;flight:string},roomId:string,action:PollAction,notify?:(parentId:string)=>Promise<unknown>){
 if(!validPollAction(action)||!pollId(roomId)||!scope.teamName.trim()||!scope.leagueName.trim()||scope.teamName.length>160||scope.leagueName.length>160||scope.flight.length>120)return {ok:false as const,status:400}
 try{
 const r=await service.rpc('native_team_poll',{p_owner:owner,p_team:scope.teamName,p_league:scope.leagueName,p_flight:scope.flight,p_room:roomId,p_id:action.id,p_action:action.action,p_question:'question'in action?action.question:null,p_options:'options'in action?action.options:null,p_choice:'choice'in action?action.choice:null,p_expected:'expected'in action?action.expected:null})
 if(r.error||!r.data||r.data.ok!==true)return {ok:false as const,status:[400,403,404,409,429].includes(r.data?.status)?Number(r.data.status):503}
 if(typeof r.data.created!=='boolean'||!pollId(r.data.parentId)||r.data.teamPoll!==1||r.data.owner!==owner||r.data.scope?.teamName!==scope.teamName||r.data.scope?.leagueName!==scope.leagueName||r.data.scope?.flight!==scope.flight)return {ok:false as const,status:503}
 const poll=parseTeamPoll(r.data.poll,action.id,roomId)
 if('question'in action&&(poll.question!==action.question||poll.options.some((o,i)=>o.label!==action.options[i])||poll.options.length!==action.options.length))return {ok:false as const,status:409}
 if(action.action==='vote'&&poll.mine!==action.choice||action.action==='close'&&!poll.closed)return {ok:false as const,status:503}
 if(action.action==='create'&&r.data.created&&notify){try{await notify(r.data.parentId)}catch{/* Poll publication remains confirmed when alert delivery fails. */}}
 return {ok:true as const,status:200,teamPoll:1,owner,scope,poll}
 }catch{return {ok:false as const,status:503}}
}
