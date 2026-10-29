import type {TeamMessage} from './team-room-data'
import {nativeActionIcon as icon} from './native-action-icons'
import {html} from './match-details'

/** Keep the existing guarded actions as the single write path. */
export function chatMessageActionsHtml(message:TeamMessage){
 const id=html(message.id)
 return `<div class="chat-message-actions"><button type="button" class="secondary chat-message-menu-trigger" data-open-message-actions aria-label="Message actions for ${html(message.senderName)}">${icon('more')}</button><div class="chat-action-sources" hidden><button type="button" data-chat-reply="${id}">Reply</button><button type="button" data-chat-view="${id}">View message</button>${message.canManageOwn&&message.isMine?`<button type="button" data-chat-edit="${id}">Edit</button><button type="button" data-chat-remove="${id}">Remove</button>`:''}${!message.isMine?`<button type="button" data-chat-report="${id}">Report</button>${message.senderUserId?`<button type="button" data-chat-block="${html(message.senderUserId)}">Block</button>`:''}`:''}</div></div>`
}

type Options={current:()=>boolean;canOpen:()=>boolean;beforeOpen:()=>void;onClose:()=>void}
export function bindChatMessagePress(app:HTMLElement,options:Options){
 let disposed=false,dialog:HTMLDialogElement|null=null,trigger:HTMLElement|null=null
 let held:{pointer:number;x:number;y:number;post:HTMLElement}|null=null,timer:ReturnType<typeof setTimeout>|null=null
 let suppress:{post:HTMLElement;until:number}|null=null
 const cancelHold=()=>{if(timer!==null)clearTimeout(timer);timer=null;held=null}
 const close=(restore=true,notify=true)=>{
  const wasOpen=Boolean(dialog),previous=trigger
  dialog?.remove();dialog=null;trigger=null
  if(restore&&options.current()&&previous?.isConnected)previous.focus({preventScroll:true})
  if(wasOpen&&notify&&!disposed)options.onClose()
 }
 const open=(post:HTMLElement)=>{
  if(disposed||dialog||!post.isConnected||!options.current()||!options.canOpen()||document.querySelector('dialog[open]'))return false
  const sources=Array.from(post.querySelectorAll<HTMLButtonElement>('.chat-action-sources button,[data-chat-reaction-sources] button'))
  if(!sources.length)return false
  options.beforeOpen();trigger=post.querySelector<HTMLElement>('[data-open-message-actions]')
  const sheet=document.createElement('dialog');dialog=sheet;sheet.className='chat-message-sheet';sheet.setAttribute('aria-labelledby','chat-message-sheet-title')
  sheet.innerHTML=`<div class="chat-message-sheet-heading"><div><p>Message</p><h2 id="chat-message-sheet-title" tabindex="-1">${html(post.querySelector('.team-message-meta strong')?.textContent||'Teammate')}</h2></div><button type="button" class="secondary" data-close-message-actions aria-label="Close message actions">${icon('plus')}</button></div><div class="chat-press-reactions" role="group" aria-label="Choose a message reaction"></div><div class="chat-press-actions" role="group" aria-label="Message actions"></div>`
  for(const source of sources){
   const button=source.cloneNode(true) as HTMLButtonElement
   button.removeAttribute('id');button.removeAttribute('hidden');button.type='button';button.disabled=source.disabled
   if(source.matches('[data-chat-reaction]'))button.classList.add('chat-press-reaction')
   else{button.className='secondary';if(source.matches('[data-chat-remove],[data-chat-report],[data-chat-block]'))button.classList.add('chat-press-caution')}
   button.onclick=()=>{
    if(disposed||!options.current()||!post.isConnected||!source.isConnected){close(false);return}
    if(source.disabled||!options.canOpen()){close();return}
    const previous=trigger;close(false,false);if(previous?.isConnected)previous.focus({preventScroll:true});source.click()
   }
   sheet.querySelector(source.matches('[data-chat-reaction]')?'.chat-press-reactions':'.chat-press-actions')!.append(button)
  }
  sheet.querySelector<HTMLButtonElement>('[data-close-message-actions]')!.onclick=()=>close()
  sheet.oncancel=event=>{event.preventDefault();close()}
  sheet.onclick=event=>{if(event.target===sheet){const r=sheet.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close()}}
  document.body.append(sheet);sheet.showModal();sheet.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})
  return true
 }
 const postAt=(target:EventTarget|null)=>target instanceof Element?target.closest<HTMLElement>('[data-chat-message]'):null
 const blocked=(target:EventTarget|null)=>target instanceof Element&&!target.closest('[data-chat-photo]')&&Boolean(target.closest('button,a,input,textarea,select,summary,[contenteditable="true"],video,audio'))
 const down=(event:PointerEvent)=>{
  cancelHold();suppress=null;if(!event.isPrimary||event.button!==0||blocked(event.target)||!options.current()||!options.canOpen())return
  const post=postAt(event.target);if(!post)return
  held={pointer:event.pointerId,x:event.clientX,y:event.clientY,post}
  timer=setTimeout(()=>{const candidate=held;cancelHold();if(candidate&&open(candidate.post))suppress={post:candidate.post,until:Date.now()+1200}},500)
 }
 const move=(event:PointerEvent)=>{if(held&&(event.pointerId!==held.pointer||(event.clientX-held.x)**2+(event.clientY-held.y)**2>100))cancelHold()}
 const up=()=>cancelHold()
 const click=(event:MouseEvent)=>{
  const post=postAt(event.target)
  if(suppress&&event.detail!==0&&Date.now()<suppress.until&&post===suppress.post){suppress=null;event.preventDefault();event.stopImmediatePropagation();return}
  suppress=null
  if(event.target instanceof Element&&event.target.closest('[data-open-message-actions]')&&post){event.preventDefault();open(post)}
 }
 const context=(event:MouseEvent)=>{if(blocked(event.target))return;const post=postAt(event.target);if(post&&open(post)){event.preventDefault();cancelHold()}}
 const visibility=()=>{if(document.visibilityState!=='visible'){cancelHold();suppress=null;close(false,false)}}
 const blur=()=>cancelHold()
 app.addEventListener('pointerdown',down);app.addEventListener('click',click,true);app.addEventListener('contextmenu',context)
 window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerup',up,{passive:true});window.addEventListener('pointercancel',up,{passive:true});window.addEventListener('blur',blur)
 document.addEventListener('scroll',up,true);document.addEventListener('visibilitychange',visibility)
 return {isOpen:()=>Boolean(dialog),close:()=>close(),dispose:()=>{disposed=true;cancelHold();suppress=null;close(false,false);app.removeEventListener('pointerdown',down);app.removeEventListener('click',click,true);app.removeEventListener('contextmenu',context);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);window.removeEventListener('blur',blur);document.removeEventListener('scroll',up,true);document.removeEventListener('visibilitychange',visibility)}}
}
