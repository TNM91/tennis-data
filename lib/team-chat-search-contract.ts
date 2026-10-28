import type {ChatPlan} from './team-chat-plan-links'
import {readTeamChatCursor} from './team-chat-cursor'
export const chatSearchKinds=['all','announcements','media','mentions','polls','plans','matches','practices'] as const
export type ChatSearchKind=typeof chatSearchKinds[number]
export function chatSearchInput(query:unknown,kind:unknown,before:unknown){
 if(typeof query!=='string'||query.length>120||/[\u0000-\u001f\u007f]/u.test(query)||typeof kind!=='string'||!chatSearchKinds.some(value=>value===kind)||typeof before!=='string'||before&&!readTeamChatCursor(before))return null
 const text=query.trim();if(text&&text.length<2)return null
 return {query:text,kind:kind as ChatSearchKind,before}
}
export type ChatSearchMatch={matchDate:string;opponent:string;kind:'availability'|'lineup'}
export function parseChatSearchMatch(value:unknown):ChatSearchMatch|null{
 if(value===undefined||value===null)return null
 if(typeof value!=='object'||Array.isArray(value))throw Error('Shared match unavailable.')
 const row=value as Record<string,unknown>,date=row.matchDate
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||typeof row.opponent!=='string'||row.opponent.length>160||!['availability','lineup'].includes(String(row.kind)))throw Error('Shared match unavailable.')
 return {matchDate:date,opponent:row.opponent,kind:row.kind as ChatSearchMatch['kind']}
}
export type ChatSearchResult={id:string;senderName:string;preview:string;kind:'message'|'announcement'|'system';createdAt:string;photoMimeType:string;plan?:ChatPlan;sharedMatch?:ChatSearchMatch}
export type ChatSearchPage={roomId:string;query:string;kind:ChatSearchKind;beforeCursor:string;nextCursor:string;results:ChatSearchResult[]}

export function chatSearchCursorProgress(next:string,before:string){
 if(!next)return true
 const left=readTeamChatCursor(next),right=before?readTeamChatCursor(before):null;if(!left||before&&!right)return false;if(!right)return true
 const stamp=(value:string)=>{const [date,fraction='']=value.replace(/(?:Z|\+00:00)$/,'').split('.');return date+'.'+fraction.padEnd(6,'0')}
 const l=stamp(left.createdAt),r=stamp(right.createdAt);return l<r||l===r&&left.id.toLowerCase()<right.id.toLowerCase()
}
