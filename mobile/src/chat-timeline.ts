import {firstChatPlan} from '../../lib/team-chat-plan-links'
import type {TeamMessage} from './team-room-data'

const regular=(message:TeamMessage)=>message.kind==='message'&&!message.deletedAt&&!message.card&&!message.replyToMessageId&&!message.hasAttachment&&!message.hasPhoto&&!firstChatPlan(message.body)
const dateOf=(value:string)=>{const date=new Date(value);return value&&Number.isFinite(date.getTime())?date:null}
const dayOf=(date:Date)=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')

/** Presentation follows the loaded order; hidden messages never join separate sender runs. */
export function chatTimeline(messages:TeamMessage[],visible=new Set(messages.map(message=>message.id)),runStarts=new Set<string>()){
 let previous:TeamMessage|undefined,previousIndex=-2,previousDay:string|undefined,previousRegular=false
 const dates=new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'}),times=new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}),full=new Intl.DateTimeFormat(undefined,{dateStyle:'full',timeStyle:'short'})
 return messages.flatMap((message,index)=>{
  if(!visible.has(message.id))return []
  const date=dateOf(message.createdAt),day=date?dayOf(date):'',prior=previous&&dateOf(previous.createdAt),simple=regular(message)
  const continuation=Boolean(previous&&index===previousIndex+1&&!runStarts.has(message.id)&&previousRegular&&simple&&message.senderUserId&&message.senderUserId===previous.senderUserId&&message.senderName===previous.senderName&&message.isMine===previous.isMine&&date&&prior&&day===dayOf(prior)&&date.getTime()>=prior.getTime()&&date.getTime()-prior.getTime()<=300000)
  const result={id:message.id,day,startsDay:day!==previousDay,continuation,
   dayLabel:date?dates.format(date):'Date unavailable',
   timeLabel:date?times.format(date):'Time unavailable',
   fullTime:date?full.format(date):'Time unavailable'}
  previous=message;previousIndex=index;previousDay=day;previousRegular=simple
  return [result]
 })
}

export function applyChatTimeline(list:HTMLElement,messages:TeamMessage[],runStarts=new Set<string>()){
 const elements=new Map(Array.from(list.querySelectorAll<HTMLElement>('[data-chat-message]')).map(item=>[item.dataset.chatMessage!,item]))
 const visible=new Set(Array.from(elements).filter(([,item])=>!item.hidden).map(([id])=>id))
 const dividers=new Map(Array.from(list.querySelectorAll<HTMLElement>('[data-chat-date-for]')).map(item=>[item.dataset.chatDateFor!,item]))
 const byId=new Map(messages.map(message=>[message.id,message]))
 for(const row of chatTimeline(messages,visible,runStarts)){
  const item=elements.get(row.id)!,message=byId.get(row.id)!
  item.classList.toggle('team-bubble-continuation',row.continuation)
  item.querySelector('.team-message-meta strong')?.classList.toggle('sr-only',row.continuation)
  const host=item.querySelector('.team-message-meta>span')
  if(host){
   let time=host.querySelector('time')
   if(!time){time=document.createElement('time');host.replaceChildren(time)}
   time.textContent=row.timeLabel+(message.editedAt&&!message.deletedAt?' · edited':'')
   time.setAttribute('aria-label',row.fullTime+(message.editedAt&&!message.deletedAt?' · edited':''))
   if(row.day)time.dateTime=message.createdAt;else time.removeAttribute('datetime')
  }
  if(row.startsDay){
   let divider=dividers.get(row.id)
   if(!divider){divider=document.createElement('li');divider.className='chat-date-divider';divider.dataset.chatDateFor=row.id;divider.setAttribute('role','presentation')}
   divider.textContent=row.dayLabel
   if(item.previousElementSibling!==divider)item.before(divider)
   dividers.delete(row.id)
  }
 }
 for(const divider of dividers.values())divider.remove()
}
