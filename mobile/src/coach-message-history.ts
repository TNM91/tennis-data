import {html} from './match-details'

export type CoachHistoryMessage={id:string;mine:boolean;body:string;createdAt:string}

// Match the original string so Unicode case folding cannot move highlight offsets.
export function coachMessageRanges(body:string,query:string):{start:number;end:number}[]{
 const term=query.trim().slice(0,120)
 if(!term)return []
 const literal=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
 return Array.from(body.matchAll(new RegExp(literal,'giu')),hit=>({start:hit.index!,end:hit.index!+hit[0].length}))
}
export function coachMessageText(body:string,query:string){
 let position=0,result=''
 for(const range of coachMessageRanges(body,query)){result+=html(body.slice(position,range.start))+'<mark>'+html(body.slice(range.start,range.end))+'</mark>';position=range.end}
 return result+html(body.slice(position))
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
