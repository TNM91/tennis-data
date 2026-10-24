import {readTeamChatCursor} from './team-chat-cursor'
export const chatSearchKinds=['all','announcements','media','mentions'] as const
export type ChatSearchKind=typeof chatSearchKinds[number]
export function chatSearchInput(query:unknown,kind:unknown,before:unknown){
 if(typeof query!=='string'||query.length>120||/[\u0000-\u001f\u007f]/u.test(query)||typeof kind!=='string'||!chatSearchKinds.some(value=>value===kind)||typeof before!=='string'||before&&!readTeamChatCursor(before))return null
 const text=query.trim();if(text&&text.length<2)return null
 return {query:text,kind:kind as ChatSearchKind,before}
}
export type ChatSearchResult={id:string;senderName:string;preview:string;kind:'message'|'announcement'|'system';createdAt:string;photoMimeType:string}
export type ChatSearchPage={roomId:string;query:string;kind:ChatSearchKind;beforeCursor:string;nextCursor:string;results:ChatSearchResult[]}

export function chatSearchCursorProgress(next:string,before:string){
 if(!next)return true
 const left=readTeamChatCursor(next),right=before?readTeamChatCursor(before):null;if(!left||before&&!right)return false;if(!right)return true
 const stamp=(value:string)=>{const [date,fraction='']=value.replace(/(?:Z|\+00:00)$/,'').split('.');return date+'.'+fraction.padEnd(6,'0')}
 const l=stamp(left.createdAt),r=stamp(right.createdAt);return l<r||l===r&&left.id.toLowerCase()<right.id.toLowerCase()
}
