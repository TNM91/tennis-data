import type {SupabaseClient} from '@supabase/supabase-js'
import {html} from './match-details'
import type {CoachSend} from './coach-workspace-data'
import {coachConnectionRequest,CoachConnectionError} from './coach-connection-data'
import {coachInvitationToken,type CoachConnection} from '../../lib/native-coach-connection-contract'

export function openCoachConnection(client:SupabaseClient,owner:string,current:()=>boolean,trigger?:HTMLElement,send?:CoachSend,initialLink=''){
 const dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog coach-workspace-dialog';dialog.setAttribute('aria-label','Accept coach invitation')
 let disposed=false,busy=false,leaving=false,attempted=false,uncertain=false,link='',token='',notice='',data:CoachConnection|null=null,pendingLeave:(()=>void)|null=null
 const active=()=>!disposed&&current(),focus=()=>dialog.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})
 const dispose=()=>{if(disposed)return;disposed=true;link=token=notice='';data=null;pendingLeave=null;dialog.close();dialog.remove();if(current()&&trigger?.isConnected)trigger.focus({preventScroll:true})}
 const exit=()=>{const next=pendingLeave;dispose();next?.()}
 const requestLeave=(next:()=>void)=>{if(busy)return;if(link&&data?.state!=='connected'){pendingLeave=next;leaving=true;render();focus()}else{dispose();next()}}
 const back=()=>{if(busy)return true;if(leaving){pendingLeave=null;leaving=false;render();focus()}else requestLeave(()=>{});return true}
 const read=async()=>{
  if(!active()||busy)return
  try{token=coachInvitationToken(link)}catch{notice='Paste the complete TenAceIQ invitation link from your coach.';render();focus();return}
  busy=true;notice=attempted?'Checking your connection…':'Loading invitation…';render()
  try{const found=await coachConnectionRequest(client,owner,active,{action:'preview',token},send);if(!active())return;data=found;uncertain=false;notice=found.state==='connected'?'Your account is connected. Open Your coach & weekly plans to see your assignments.':found.state==='reserved'?'Your invitation was accepted, but the student connection still needs to finish. Review the details below before continuing.':attempted?'Your account is not connected yet. Review the current invitation before trying again.':'';attempted=false}
  catch(error){if(active()){data=null;notice=error instanceof CoachConnectionError?error.message:'The invitation could not be checked. Try again when connected.'}}
  finally{if(active()){busy=false;render();focus()}}
 }
 const accept=async()=>{
  if(!data||data.state==='connected'||busy||uncertain||!active())return
  const revision=data.revision;busy=attempted=uncertain=true;notice='Connecting your account…';render()
  try{const found=await coachConnectionRequest(client,owner,active,{action:'accept',token,revision},send);if(!active())return;data=found;if(found.state==='connected'){uncertain=false;notice='Your account is connected. Open Your coach & weekly plans to see your assignments.'}else notice='The connection is not finished. Check its status before trying again.'}
  catch(error){if(active())notice=error instanceof CoachConnectionError?error.message:'Connection not confirmed. Check its status before trying again.'}
  finally{if(active()){busy=false;render();focus()}}
 }
 const render=()=>{
  if(!active())return
  let content=''
  if(leaving)content=`<p>${attempted?'Your invitation may already be accepted. Check this link again before trying another connection.':'The invitation link will be cleared from this screen.'}</p><button type="button" data-connection-stay>Keep reviewing</button><button type="button" class="secondary" data-connection-leave>Leave invitation</button>`
  else if(data)content=`<article class="coach-plan"><small>${data.state==='connected'?'Connected':'Invited student'}</small><h3>${html(data.name)}</h3>${data.level?`<p>${html(data.level)}</p>`:''}${data.message?`<p class="coach-written">${html(data.message)}</p>`:''}${data.expiresAt&&data.state==='ready'?`<p>Accept by ${html(new Date(data.expiresAt).toLocaleDateString())}.</p>`:''}</article>${data.state==='connected'?'<p>Your coach can now share assignments with this account and review the check-ins you send.</p>':`<p>Connect this student record to the TenAceIQ account you’re signed in with. Your coach will see the practice check-ins you send.</p><button type="button" data-connection-accept ${busy||uncertain?'disabled':''}>${data.state==='reserved'?'Finish connection':'Connect my account'}</button>`}${data.state!=='connected'?`<button type="button" class="secondary" data-connection-check ${busy?'disabled':''}>${attempted?'Check connection':'Review invitation again'}</button>`:''}`
  else content=`<p>Paste the invitation link your coach shared. Sign in with the email address they invited.</p><form data-connection-form><label for="coach-connection-link">Invitation link</label><textarea id="coach-connection-link" name="link" maxlength="1024" autocomplete="off" autocapitalize="none" spellcheck="false" required ${busy?'disabled':''}>${html(link)}</textarea><button type="submit" ${busy?'disabled':''}>${attempted?'Check connection':'Review invitation'}</button></form>`
  dialog.innerHTML=`<header class="coach-workspace-header"><small>Coach & training</small><h2 tabindex="-1">${leaving?'Leave invitation?':data?.state==='connected'?'You’re connected':data?'Review invitation':'Accept coach invitation'}</h2><button type="button" class="secondary" data-connection-close ${busy?'disabled':''}>Close</button></header>${content}<p role="status">${html(notice)}</p>`
  dialog.querySelector('[data-connection-close]')?.addEventListener('click',back)
  dialog.querySelector('[data-connection-stay]')?.addEventListener('click',()=>{leaving=false;pendingLeave=null;render();focus()})
  dialog.querySelector('[data-connection-leave]')?.addEventListener('click',exit)
  dialog.querySelector<HTMLTextAreaElement>('[name="link"]')?.addEventListener('input',e=>{link=(e.target as HTMLTextAreaElement).value})
  dialog.querySelector<HTMLFormElement>('[data-connection-form]')?.addEventListener('submit',e=>{e.preventDefault();void read()})
  dialog.querySelector('[data-connection-check]')?.addEventListener('click',()=>{void read()})
  dialog.querySelector('[data-connection-accept]')?.addEventListener('click',()=>{void accept()})
 }
 if(initialLink){try{coachInvitationToken(initialLink);link=initialLink}catch{/* Keep the manual review form for an invalid link. */}}
 dialog.oncancel=e=>{e.preventDefault();back()};document.body.append(dialog);render();dialog.showModal();focus();if(link)void read()
 return {dispose,back,requestLeave,isOpen:()=>!disposed}
}
