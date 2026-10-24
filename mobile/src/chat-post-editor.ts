import {ChatActionError,type ChatAction} from './team-chat-send'
import type {TeamMessage} from './team-room-data'
import {html} from './match-details'
export function openChatPostEditor(message:TeamMessage,roomId:string,remove:boolean,save:(action:ChatAction)=>Promise<unknown>,onSaved:()=>void,isCurrent:()=>boolean){
 let disposed=false,sending=false,pending:Extract<ChatAction,{action:'edit_chat_post'|'remove_chat_post'}>|null=null
 const dialog=document.createElement('dialog');dialog.className='chat-post-dialog';dialog.setAttribute('aria-label',remove?'Remove your message':'Edit your message')
 dialog.innerHTML=`<h2>${remove?'Remove your message?':'Edit your message'}</h2>${remove?'<p>Your post will be hidden from the team conversation. A removed-message marker stays in its place.</p>':`<label for="chat-edit-text">Message${message.hasPhoto?' caption':''}</label><textarea id="chat-edit-text" maxlength="2400" rows="4">${html(message.body)}</textarea>`}<p role="status"></p><button type="button" data-save>${remove?'Remove message':'Save changes'}</button><button type="button" class="secondary" data-close>Cancel</button>`
 const close=()=>{disposed=true;pending=null;dialog.remove()}
 dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=close
 dialog.oncancel=event=>{event.preventDefault();close()}
 const button=dialog.querySelector<HTMLButtonElement>('[data-save]')!,text=dialog.querySelector<HTMLTextAreaElement>('textarea'),notice=dialog.querySelector<HTMLElement>('[role=status]')!
 button.onclick=()=>{void (async()=>{
  if(disposed || sending || !isCurrent())return
  const body=text?.value.trim() || ''
  if(!remove && !pending && !body){notice.textContent='Write a message first.';text?.focus();return}
  if(!pending)pending={action:remove?'remove_chat_post':'edit_chat_post',conversationId:roomId,messageId:message.id,body,expectedBody:message.body,expectedEditedAt:message.editedAt || ''}
  sending=true;button.disabled=true;if(text)text.readOnly=true;notice.textContent='Saving…'
  try{await save(pending);if(disposed || !isCurrent())return;close();onSaved()}
  catch(cause){if(disposed || !isCurrent())return
   if(cause instanceof ChatActionError && !cause.uncertain){pending=null;notice.textContent='This message changed or is unavailable. Close this view and refresh the conversation.';button.hidden=true}
   else{notice.textContent='Couldn’t confirm this change. Retry checks the same edit or removal.';button.textContent='Retry same change'}
  }finally{sending=false;if(!disposed)button.disabled=false}
 })()}
 document.body.append(dialog);if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','')
 if(text){text.focus();text.setSelectionRange(text.value.length,text.value.length)}else dialog.querySelector<HTMLButtonElement>('[data-close]')!.focus()
 return {dispose:close,isOpen:()=>!disposed}
}
