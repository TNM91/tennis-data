import {ChatActionError,type ChatAction} from './team-chat-send'
import type {TeamScope} from './team-room-data'
import {html} from './match-details'
type Announcement=Extract<ChatAction,{action:'send'}> & {announcement:true}
export class TeamAnnouncement {
 text=''
 reviewed=''
 pending:Announcement|null=null
 sending=false
 notice=''
 private disposed=false
 constructor(private readonly send:(action:Announcement)=>Promise<unknown>,private readonly newId:()=>string=()=>crypto.randomUUID()){}
 review(){if(this.disposed||this.sending||this.pending)return false;const text=this.text.trim();if(!text||text.length>2400){this.notice='Write an announcement up to 2,400 characters.';return false}this.reviewed=text;this.notice='';return true}
 edit(){if(!this.pending&&!this.sending){this.reviewed='';this.notice=''}}
 async submit(){
  if(this.disposed||this.sending||!this.reviewed&&!this.pending)return false
  if(!this.pending)this.pending={action:'send',announcement:true,clientMessageId:this.newId(),body:this.reviewed,replyToMessageId:''}
  this.sending=true;this.notice='Posting announcement…'
  try{await this.send(this.pending);if(this.disposed)return false;this.text='';this.reviewed='';this.pending=null;this.notice='Announcement posted.';return true}
  catch(cause){if(!this.disposed){this.notice=cause instanceof ChatActionError&&!cause.uncertain?cause.message:'Couldn’t confirm your announcement. Retry the same post.';if(cause instanceof ChatActionError&&!cause.uncertain){this.pending=null;this.reviewed=''}}return false}
  finally{this.sending=false}
 }
 dispose(){this.disposed=true;this.text='';this.reviewed='';this.pending=null;this.notice=''}
}
export function openAnnouncement(scope:TeamScope,save:(action:Announcement)=>Promise<unknown>,current:()=>boolean,onSaved:(messageId:string)=>void,onUncertainClose:(messageId:string)=>void=()=>{}){
 const dialog=document.createElement('dialog');dialog.className='chat-post-dialog';dialog.setAttribute('aria-label','Captain announcement');document.body.append(dialog)
 let disposed=false,postedId=''
 const draft=new TeamAnnouncement(action=>{postedId=action.clientMessageId;return save(action)}),valid=()=>!disposed&&current(),close=(checkPending=false)=>{const pendingId=checkPending&&valid()?draft.pending?.clientMessageId:'';disposed=true;draft.dispose();dialog.remove();if(pendingId)onUncertainClose(pendingId)}
 const render=()=>{
  if(!valid())return
  const review=!!draft.reviewed||!!draft.pending
  dialog.innerHTML=`<h2>Captain announcement</h2><p><strong>${html(scope.teamName)}</strong><br>${html(scope.leagueName)} · ${html(scope.flight||'Flight unavailable')}</p>${review?`<h3 tabindex="-1">Review your announcement</h3><p class="announcement-preview">${html(draft.pending?.body||draft.reviewed)}</p><p>This posts to the team conversation as a captain announcement. Teammates may receive their enabled team alerts. Muted teammates stay muted.</p><button type="button" id="announcement-post" ${draft.sending?'disabled':''}>${draft.sending?'Posting…':draft.pending?'Retry same announcement':'Post announcement'}</button><button type="button" class="secondary" id="announcement-edit" ${draft.pending||draft.sending?'disabled':''}>Keep editing</button>`:`<label for="announcement-text">What does your team need to know?</label><textarea id="announcement-text" maxlength="2400" rows="5" placeholder="Practice plans, court changes, or team news…">${html(draft.text)}</textarea><p class="rating-context" id="announcement-count">${draft.text.length}/2400</p><button type="button" id="announcement-review">Review announcement</button>`}<p role="status">${html(draft.notice)}</p><button type="button" class="secondary" id="announcement-close">${draft.pending?'Close and check conversation':'Cancel'}</button>`
  dialog.querySelector<HTMLButtonElement>('#announcement-close')!.onclick=()=>close(true)
  dialog.querySelector<HTMLTextAreaElement>('#announcement-text')?.addEventListener('input',e=>{draft.text=(e.currentTarget as HTMLTextAreaElement).value;dialog.querySelector('#announcement-count')!.textContent=`${draft.text.length}/2400`})
  dialog.querySelector<HTMLButtonElement>('#announcement-review')?.addEventListener('click',()=>{draft.review();render();dialog.querySelector<HTMLElement>('h3')?.focus()})
  dialog.querySelector<HTMLButtonElement>('#announcement-edit')?.addEventListener('click',()=>{draft.edit();render();dialog.querySelector<HTMLTextAreaElement>('textarea')?.focus()})
  dialog.querySelector<HTMLButtonElement>('#announcement-post')?.addEventListener('click',()=>{if(!valid())return;const task=draft.submit();render();void task.then(saved=>{if(!valid())return;if(saved){close();onSaved(postedId)}else render()})})
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();close(true)});render();dialog.showModal();dialog.querySelector<HTMLTextAreaElement>('textarea')?.focus();return {dispose:()=>close(),isOpen:()=>!disposed}
}
