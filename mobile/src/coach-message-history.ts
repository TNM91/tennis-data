import {html} from './match-details'
import {tokenizeTeamRoomMessageBody} from '../../lib/team-room-message-links'
import {chatWebLink} from './chat-web-link'

export type CoachHistoryMessage={id:string;mine:boolean;body:string;createdAt:string}

// Match the original string so Unicode case folding cannot move highlight offsets.
export function coachMessageRanges(body:string,query:string):{start:number;end:number}[]{
 const term=query.trim().slice(0,120)
 if(!term)return []
 const literal=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
 return Array.from(body.matchAll(new RegExp(literal,'giu')),hit=>({start:hit.index!,end:hit.index!+hit[0].length}))
}
export function coachMessageText(body:string,query:string){
 const ranges=coachMessageRanges(body,query)
 let position=0,links=0
 return tokenizeTeamRoomMessageBody(body).map(part=>{
  const start=position,end=start+part.text.length;position=end
  let cursor=start,result=''
  for(const range of ranges){
   const from=Math.max(start,range.start),to=Math.min(end,range.end)
   if(from>=to)continue
   result+=html(body.slice(cursor,from))+'<mark>'+html(body.slice(from,to))+'</mark>';cursor=to
  }
  result+=html(body.slice(cursor,end))
  const url=part.href&&links<8?chatWebLink(part.href):null
  if(!url)return result
  links++
  return `<button type="button" class="coach-message-link" data-coach-message-url="${html(url)}" aria-label="Review link to ${html(new URL(url).hostname)}">${result}</button>`
 }).join('')
}
export function coachMessageHistory(messages:CoachHistoryMessage[],name:string,query=''){
 let previous:CoachHistoryMessage|undefined,previousDay=''
 return messages.map(message=>{
  const date=new Date(message.createdAt),valid=Number.isFinite(date.getTime()),day=valid?[date.getFullYear(),date.getMonth(),date.getDate()].join('-'):'unknown'
  const dayLabel=valid?date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'}):'Date unavailable'
  const time=valid?date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'Time unavailable'
  const delta=previous?date.getTime()-Date.parse(previous.createdAt):Infinity
  const continuation=previous&&day===previousDay&&message.mine===previous.mine&&delta>=0&&delta<=5*60*1000
  const separator=day!==previousDay?`<p class="coach-message-day">${html(dayLabel)}</p>`:''
  previous=message;previousDay=day
  return separator+`<article tabindex="-1" data-coach-message-id="${html(message.id)}" aria-label="${html(message.mine?'You':name)}, ${html(dayLabel)}, ${html(time)}" class="coach-direct-message ${message.mine?'is-mine':''} ${continuation?'is-continuation':''}"><div class="coach-message-meta"><span ${continuation?'hidden':''}>${html(message.mine?'You':name)}</span><time ${valid?`datetime="${html(message.createdAt)}"`:''}>${html(time)}</time></div><p data-coach-message-text>${coachMessageText(message.body,query)}</p></article>`
 }).join('')||'<p>Your conversation starts here.</p>'
}
