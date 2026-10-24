import type {TeamMessage} from './team-room-data'
import {html} from './match-details'
export const chatReactions=[{reaction:'helpful' as const,label:'Helpful',emoji:'👍'},{reaction:'celebrate' as const,label:'Celebrate',emoji:'🎉'}]
export type ChatReactionKind=typeof chatReactions[number]['reaction']
export type ChatReaction={reaction:ChatReactionKind;count:number;reacted:boolean}
export function parseChatReactions(value:unknown):ChatReaction[]{
 if(!Array.isArray(value))return []
 return chatReactions.flatMap(({reaction})=>{
  const item=value.find(item=>item && typeof item==='object' && item.reaction===reaction)
  if(!item || !Number.isSafeInteger(item.count) || item.count<0 || item.count>1000000 || typeof item.reacted!=='boolean')return []
  return [{reaction,count:item.count,reacted:item.reacted && item.count>0}]
 })
}
export function chatReactionButtons(message:TeamMessage){
 return `<div class="chat-reactions" role="group" aria-label="Message reactions">${chatReactions.map(({reaction,label,emoji})=>{const item=message.reactions?.find(item=>item.reaction===reaction);return `<button type="button" class="secondary chat-reaction" data-chat-reaction="${reaction}" data-reaction-message="${html(message.id)}" aria-label="${label}: ${item?.count || 0} reactions" aria-pressed="${item?.reacted===true}"><span aria-hidden="true">${emoji}</span> ${label} <span>${item?.count || 0}</span></button>`}).join('')}</div>`
}
