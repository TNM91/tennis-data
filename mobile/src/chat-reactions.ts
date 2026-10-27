import {nativeActionIcon} from './native-action-icons'
import {teamChatReactions,maxTeamChatReactionCount} from '../../lib/team-chat-reaction-kinds'
import type {TeamMessage} from './team-room-data'
import {html} from './match-details'
export const chatReactions=teamChatReactions
export type ChatReactionKind=typeof chatReactions[number]['reaction']
export type ChatReaction={reaction:ChatReactionKind;count:number;reacted:boolean}
export function parseChatReactions(value:unknown):ChatReaction[]{
 if(!Array.isArray(value))return []
 return chatReactions.flatMap(({reaction})=>{
  const matches=value.filter(item=>item && typeof item==='object' && item.reaction===reaction)
  if(matches.length!==1)return []
  const item=matches[0]
  if(!item || !Number.isSafeInteger(item.count) || item.count<0 || item.count>maxTeamChatReactionCount || typeof item.reacted!=='boolean')return []
  return [{reaction,count:item.count,reacted:item.reacted && item.count>0}]
 })
}
export function chatReactionButtons(message:TeamMessage){
 const button=({reaction,label,emoji}:typeof chatReactions[number],picker=false)=>{
  const item=message.reactions?.find(item=>item.reaction===reaction),count=item?.count||0
  return `<button type="button" class="secondary chat-reaction${picker?' chat-reaction-choice':''}" data-chat-reaction="${reaction}" data-reaction-message="${html(message.id)}" aria-label="${label}: ${count} reactions" aria-pressed="${item?.reacted===true}"><span aria-hidden="true">${emoji}</span>${picker?`<span class="sr-only">${label}</span>`:''}${!picker||count>0?`<span>${count}</span>`:''}</button>`
 }
 return `<div class="chat-reactions" role="group" aria-label="Message reactions">${chatReactions.filter(kind=>(message.reactions?.find(item=>item.reaction===kind.reaction)?.count||0)>0).map(kind=>button(kind)).join('')}<details class="chat-reaction-picker"><summary aria-label="Add a reaction to ${html(message.senderName)}'s message">${nativeActionIcon('react')}<span class="sr-only">React</span></summary><div class="chat-reaction-choices" role="group" aria-label="Choose a message reaction">${chatReactions.map(kind=>button(kind,true)).join('')}</div></details></div>`
}
