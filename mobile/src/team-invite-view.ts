import type {SupabaseClient} from '@supabase/supabase-js'
import {teamLeagueLabel} from '../../lib/private-team-contract'
import {nativeInviteToken,type NativeInviteReview} from '../../lib/native-team-invite-contract'
import {inviteRequest,InviteError} from './team-invite-data'
import {html} from './match-details'
import type {TeamChatDestination} from './team-room-data'
export function openTeamInvite(client:SupabaseClient,owner:string,current:()=>boolean,joined:(destination:TeamChatDestination)=>void,closed:(needsRefresh:boolean)=>void,initialLink=''){
 const dialog=document.createElement('dialog');dialog.className='team-invite-dialog';dialog.setAttribute('aria-label','Join a team');document.body.append(dialog)
 let disposed=false,busy=false,uncertain=false,token='',input=nativeInviteToken(initialLink)?initialLink:'',notice='',review:NativeInviteReview|null=null
 const valid=()=>!disposed && current()
 const dispose=()=>{disposed=true;dialog.remove()}
 const close=()=>{if(busy&&review)return;dispose();closed(uncertain)}
 const enterTeam=({teamName,leagueName,flight,roomId}:NativeInviteReview,newMember:boolean)=>{
  dispose()
  joined({teamName,leagueName,flight,...(newMember?{joinedRoomId:roomId}:{})})
 }
 const render=()=>{
  if(!valid())return
  dialog.innerHTML=`<header class="team-invite-heading"><h2 tabindex="-1">Join your team</h2>
   <button type="button" class="secondary" id="team-invite-close" ${busy&&review?'disabled':''}>Close</button></header>
   ${review?`<section class="team-invite-preview" aria-labelledby="team-invite-name">
    <small class="stat-eyebrow">Invite preview</small>
    <h3 id="team-invite-name" tabindex="-1">${html(review.teamName)}</h3>
    <dl><div><dt>League</dt><dd>${html(teamLeagueLabel(review))}</dd></div><div><dt>Flight</dt><dd>${html(review.flight||'Not listed')}</dd></div></dl>
    <p class="rating-context">Invite expires ${html(new Date(review.expiresAt).toLocaleDateString(undefined,{dateStyle:'medium'}))}.</p>
   </section>
   <p>${review.alreadyJoined?'You’re already connected to this team.':'Your first team becomes your default. Teammates will see a join notice.'}</p>
   ${review.alreadyJoined?'':'<p class="rating-context">Alerts use your iPhone and email settings.</p>'}
   <button type="button" id="team-invite-join" ${busy?'disabled':''}>${busy?'Joining…':uncertain?'Retry same join':review.alreadyJoined?'Open team':'Join as player'}</button>
   ${busy||uncertain?'':'<button type="button" class="secondary" data-invite-change>Use a different invite</button>'}`
   :`<p>Paste the invite link or code your captain shared. You’ll see the team before you join.</p>
    <form data-invite-form><label>Team invite<input id="team-invite-input" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="600" value="${html(input)}" ${busy?'disabled':''}></label>
    <button type="submit" ${busy?'disabled':''}>${busy?'Checking…':'Review invite'}</button></form>`}
   <p role="status" tabindex="-1" data-invite-feedback>${html(notice)}</p>`
  const field=dialog.querySelector<HTMLInputElement>('#team-invite-input')
  if(field)field.oninput=()=>{input=field.value;notice='';dialog.querySelector('[data-invite-feedback]')!.textContent=''}
  dialog.querySelector<HTMLButtonElement>('#team-invite-close')!.onclick=close
  dialog.querySelector('[data-invite-form]')?.addEventListener('submit',event=>{event.preventDefault();void preview()})
  dialog.querySelector('[data-invite-change]')?.addEventListener('click',()=>{
   review=null;token='';notice='';render();dialog.querySelector<HTMLInputElement>('input')?.focus()
  })
  dialog.querySelector<HTMLButtonElement>('#team-invite-join')?.addEventListener('click',()=>{void (async()=>{
   if(busy||!review)return
   if(review.alreadyJoined){enterTeam(review,false);return}
   busy=true;notice='';render()
   try{const result=await inviteRequest(client,owner,valid,token,review);if(valid())enterTeam(result,true)}catch(cause){if(valid()){uncertain=cause instanceof InviteError && cause.uncertain;notice=cause instanceof Error?cause.message:'Join unavailable.';if(!uncertain)review=null}}finally{if(valid()){busy=false;render();focusFeedback()}}
  })()})
 }
 const focusFeedback=()=>dialog.querySelector<HTMLElement>('[data-invite-feedback]')?.focus()
 async function preview(){
  if(busy||!valid())return
  token=nativeInviteToken(input)
  if(!token){notice='Paste a valid TenAceIQ team invite.';render();focusFeedback();return}
  busy=true;notice='';render()
  try{const result=await inviteRequest(client,owner,valid,token,null);if(valid())review=result}
  catch(cause){if(valid())notice=cause instanceof Error?cause.message:'Invite unavailable.'}
  finally{
   if(valid()){
    busy=false;render()
    if(review)dialog.querySelector<HTMLElement>('#team-invite-name')?.focus()
    else focusFeedback()
   }
  }
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();close()});render();dialog.showModal();dialog.querySelector<HTMLElement>('h2')?.focus();if(input)void preview()
 return {dispose,close,isOpen:()=>!disposed}
}
