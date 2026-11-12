import type {ChatReportReason} from '../../lib/team-chat-safety'
import type {TeamMessage} from './team-room-data'
import type {ChatAction} from './team-chat-send'
import {firstPartyBuild} from './build-scope'
import {html} from './match-details'

export function openChatSafety(message:TeamMessage,report:boolean,save:(action:ChatAction)=>Promise<void>,current:()=>boolean,onClose:()=>void){
 const dialog=document.createElement('dialog')
 dialog.className='chat-post-dialog chat-safety-dialog'
 dialog.setAttribute('aria-labelledby','chat-safety-title')
 let step:'report'|'block'|'reported'|'blocked'=report?'report':'block'
 let saving=false

 function dispose(){
  dialog.close()
  dialog.remove()
 }

 function close(){
  if(saving)return
  dispose()
  onClose()
 }

 function render(){
  const title=step==='report'?'Report message':step==='block'?'Block chat posts':step==='reported'?'Report sent':'Chat posts blocked'
  const action=step==='report'?'Send report':step!=='blocked'&&message.senderUserId?'Block chat posts':''
  const blockEffect=`Hide ${html(message.senderName)}’s posts in your team chats. The team can still see your posts. Match updates may still arrive.`
  const description=step==='report'?'Send this message privately to TenAceIQ for review.':
   step==='reported'?`TenAceIQ received your private report. ${message.senderUserId?blockEffect:''}`:
   step==='blocked'?`You can undo this in Team → ${firstPartyBuild?'Chat safety':'Members & alerts'}.`:blockEffect
  dialog.innerHTML=`<h2 id="chat-safety-title" tabindex="-1">${title}</h2><p>${description}</p>
   ${step==='report'?'<label>Reason<select name="reason" required><option value="" selected disabled>Choose a reason</option><option value="other">Unsafe meetup or other</option><option value="harassment">Harassment or bullying</option><option value="spam">Spam</option><option value="inappropriate">Inappropriate content</option></select></label>':''}
   <p role="status"></p><div class="chat-safety-actions">
   ${action?`<button type="button" data-safety-save>${action}</button>`:''}
   <button type="button" class="secondary" data-safety-close>${step==='report'||step==='block'?'Cancel':'Done'}</button></div>`
  const confirm=dialog.querySelector<HTMLButtonElement>('[data-safety-save]')
  const cancel=dialog.querySelector<HTMLButtonElement>('[data-safety-close]')!
  const reason=dialog.querySelector<HTMLSelectElement>('select')
  const status=dialog.querySelector<HTMLElement>('[role="status"]')!
  cancel.onclick=close
  if(confirm)confirm.onclick=async()=>{
   if(saving||!current()||reason&&!reason.reportValidity())return
   const reporting=step==='report'
   const intent:ChatAction=reporting
    ?{action:'report_chat_message',messageId:message.id,reason:reason!.value as ChatReportReason}
    :{action:'block_chat_member',memberId:message.senderUserId}
   saving=true
   confirm.disabled=true
   cancel.disabled=true
   if(reason)reason.disabled=true
   status.textContent=reporting?'Sending report…':'Blocking chat posts…'
   try{
    await save(intent)
    if(!dialog.open||!current())return
    step=reporting?'reported':'blocked'
    render()
    dialog.querySelector('h2')?.focus({preventScroll:true})
   }catch{
    if(!dialog.open||!current())return
    status.textContent=reporting?'Couldn’t confirm your report. Retry the same report.':'Couldn’t confirm the block. Try again.'
    confirm.textContent=reporting?'Retry report':'Retry block'
    confirm.disabled=false
    cancel.disabled=false
    confirm.focus({preventScroll:true})
   }finally{saving=false}
  }
 }

 dialog.oncancel=event=>{event.preventDefault();close()}
 render()
 document.body.append(dialog)
 dialog.showModal()
 dialog.querySelector('h2')?.focus({preventScroll:true})
 return {dispose,close,isOpen:()=>dialog.open}
}
