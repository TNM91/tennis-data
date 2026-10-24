import type {SupabaseClient} from '@supabase/supabase-js'
import {nativeInviteToken,type NativeInviteReview} from '../../lib/native-team-invite-contract'
import {inviteRequest,InviteError} from './team-invite-data'
import {html} from './match-details'
import type {TeamScope} from './team-room-data'
export function openTeamInvite(client:SupabaseClient,owner:string,current:()=>boolean,joined:(scope:TeamScope)=>void,closed:()=>void){
 const dialog=document.createElement('dialog');dialog.className='team-invite-dialog';dialog.setAttribute('aria-label','Join a team');document.body.append(dialog)
 let disposed=false,busy=false,uncertain=false,token='',input='',notice='',review:NativeInviteReview|null=null
 const valid=()=>!disposed && current()
 const dispose=()=>{disposed=true;dialog.remove()}
 const close=()=>{dispose();closed()}
 const render=()=>{
  if(!valid())return
  dialog.innerHTML=`<h2>Join your team</h2><p>Paste the invite your captain shared.</p><label>Team invite<input id="team-invite-input" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="600" value="${html(input)}" ${busy||uncertain?'disabled':''}></label><button type="button" class="secondary" id="team-invite-review" ${busy||uncertain?'disabled':''}>${busy&&!review?'Checking…':'Review invite'}</button>${review?`<section><h3>${html(review.teamName)}</h3><p>${html(review.leagueName)} · ${html(review.flight||'Flight unavailable')}</p><p>${review.alreadyJoined?'You are already connected to this team.':'Join as a player. Your first team becomes your default team. Your existing teams and alert settings stay as they are.'}</p><p class="rating-context">Invite expires ${html(new Date(review.expiresAt).toLocaleDateString())}.</p>${!review.alreadyJoined?'<p class="rating-context">Your teammates will see a join notice. Team alerts use your current iPhone notification settings. Email alerts stay off unless you previously enabled them.</p>':''}<button type="button" id="team-invite-join" ${busy?'disabled':''}>${busy?'Joining…':uncertain?'Retry same join':review.alreadyJoined?'Open team':'Join as player'}</button></section>`:''}<p role="status">${html(notice)}</p><button type="button" class="secondary" id="team-invite-close">${uncertain?'Close and refresh teams':'Close'}</button>`
  dialog.querySelector<HTMLInputElement>('#team-invite-input')!.oninput=e=>{input=(e.currentTarget as HTMLInputElement).value;review=null;token='';dialog.querySelector('section')?.remove()}
  dialog.querySelector<HTMLButtonElement>('#team-invite-close')!.onclick=close
  dialog.querySelector<HTMLButtonElement>('#team-invite-review')!.onclick=()=>{void (async()=>{
   token=nativeInviteToken(input);if(!token){notice='Paste a valid TenAceIQ team invite.';review=null;render();return}
   busy=true;notice='';review=null;render()
   try{const result=await inviteRequest(client,owner,valid,token,null);if(valid())review=result}catch(cause){if(valid())notice=cause instanceof Error?cause.message:'Invite unavailable.'}finally{if(valid()){busy=false;render()}}
  })()}
  dialog.querySelector<HTMLButtonElement>('#team-invite-join')?.addEventListener('click',()=>{void (async()=>{
   if(busy||!review)return
   if(review.alreadyJoined){const scope=review;dispose();joined(scope);return}
   busy=true;notice='';render()
   try{const result=await inviteRequest(client,owner,valid,token,review);if(valid()){dispose();joined(result)}}catch(cause){if(valid()){uncertain=cause instanceof InviteError && cause.uncertain;notice=cause instanceof Error?cause.message:'Join unavailable.';if(!uncertain)review=null}}finally{if(valid()){busy=false;render()}}
  })()})
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();close()});render();dialog.showModal();dialog.querySelector<HTMLInputElement>('input')?.focus()
 return {dispose,isOpen:()=>!disposed}
}
