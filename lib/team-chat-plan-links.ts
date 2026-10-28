import {pollId} from './team-poll-contract'
import {resolvePracticeToken,practiceRsvpPath} from './captain-practice-rsvp'
import {tokenizeTeamRoomMessageBody} from './team-room-message-links'
export type ChatPlan={kind:'poll'|'practice';id:string}
export function chatPlanLink(value:string):ChatPlan|null{
 if(value.length>2048||/[\\\s\u0000-\u001f\u007f]/.test(value))return null
 let valid:string;try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;valid=u.href}catch{return null}
 const u=new URL(valid);if(u.origin!=='https://www.tenaceiq.com'||u.hash)return null
 if(u.pathname==='/team-room'&&Array.from(u.searchParams).length===1&&pollId(u.searchParams.get('poll')))return {kind:'poll',id:u.searchParams.get('poll')!}
 if(!u.search&&/^\/(?:pr|practice)\/[^/]+$/.test(u.pathname)){const token=resolvePracticeToken(u.pathname.split('/')[2]);if(token&&practiceRsvpPath(token)===u.pathname)return {kind:'practice',id:token}}
 return null
}

/** Descriptor only; opening still authorizes the exact team, room and player. */
export function firstChatPlan(body:string,kind?:ChatPlan['kind']):ChatPlan|null{for(const part of tokenizeTeamRoomMessageBody(body)){const plan=part.href&&chatPlanLink(part.href);if(plan&&(!kind||plan.kind===kind))return plan}return null}
export function parseChatPlan(value:unknown):ChatPlan|null{
 if(value===undefined||value===null)return null
 if(typeof value!=='object'||Array.isArray(value))throw Error('Team plan unavailable.')
 const p=value as Record<string,unknown>
 if(typeof p.id!=='string'||!p.id||!(p.kind==='poll'&&pollId(p.id)||p.kind==='practice'&&resolvePracticeToken(p.id)===p.id))throw Error('Team plan unavailable.')
 return {kind:p.kind as ChatPlan['kind'],id:p.id}
}
