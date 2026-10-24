import {ChatActionError} from './team-chat-send'
import type {NativeTeamRoom} from './team-room-data'
import type {MatchAction} from './team-match-actions'
import {currentTeamPlan,ownTeamCourt,teamMatchOverview} from './team-hub'
import {html} from './match-details'
import {matchDate} from './recent-results'
export function matchReplyReview(room:NativeTeamRoom,owner:string,action:MatchAction){
 const message=currentTeamPlan(room),card=message?.card
 const changed=()=>{throw new ChatActionError('The match or lineup changed. Close and refresh Match day.',false)}
 if(!message||!card||!room.chatReady) return changed()
 const match=teamMatchOverview(room)!,court=ownTeamCourt(room,owner)
 let choice='',alreadySaved=false
 if(action.action==='ack_final_lineup'){
  if(!card.published||room.finalLineupReview?.announcementMessageId!==action.messageId||!room.finalLineupReview.currentUserRequired)return changed()
  choice='I’ve seen the final lineup';alreadySaved=room.finalLineupReview.currentUserSeen
 }else{
  if(action.messageId!==message.id)return changed()
  if(action.action==='respond'){choice=action.response==='yes'?'I’m in':action.response==='no'?'Can’t play':'Maybe';alreadySaved=message.response===action.response}
  if(action.action==='acknowledge_lineup'){if(card.cardType!=='projected_lineup'||!action.lineupVersion||card.lineupVersion!==action.lineupVersion)return changed();choice=`I’ve reviewed lineup version ${card.lineupVersion}`;alreadySaved=card.acknowledged===true}
  if(action.action==='set_arrival_status'){if(!card.published||!court)return changed();choice=action.arrivalStatus==='here'?'Here':action.arrivalStatus==='on_my_way'?'On my way':'Running late';alreadySaved=card.arrivals?.some(arrival=>arrival.profileId===owner&&arrival.status===action.arrivalStatus&&arrival.courtLabel===court.courtLabel)===true}
  if(action.action==='respond_lineup_change'){const request=card.replacement;if(!request||request.token!==action.replacementToken)return changed();const response=action.response==='accepted'?'accepted':'declined';alreadySaved=request.response===response;if(!alreadySaved&&!request.canRespond)return changed();choice=action.response==='accepted'?'Accept replacement':'Can’t play replacement'}
 }
 if(!choice)return changed()
 return {choice,alreadySaved,match,court,version:card.lineupVersion||0,lineup:card.lineup,replacement:card.replacement,roomId:room.id,key:JSON.stringify([room.id,action,match,court,card.lineupVersion||0,card.published,card.lineup,action.action==='respond_lineup_change'?card.replacement:null,action.action==='ack_final_lineup'?room.finalLineupReview:null,alreadySaved])}
}
export async function confirmReviewedMatch(review:ReturnType<typeof matchReplyReview>,action:MatchAction,owner:string,roomId:string,read:()=>Promise<NativeTeamRoom>,save:(action:MatchAction)=>Promise<boolean>,already:(action:MatchAction)=>void,current:()=>boolean){
 const room=await read();if(!current())throw Error('This review is no longer open.');if(room.id!==roomId)throw new ChatActionError('This team changed. Close and reopen it.',false)
 const fresh=matchReplyReview(room,owner,action)
 if(fresh.alreadySaved){already(action);return 'saved' as const}
 if(fresh.key!==review.key)return 'changed' as const
 return await save(action)?'saved' as const:'not_confirmed' as const
}
/** Fresh room reads on open and explicit Confirm. Nothing posts until the reviewed context matches. Existing server target/version guards remain authoritative. */
export function openMatchReplyReview(action:MatchAction,owner:string,roomId:string,read:()=>Promise<NativeTeamRoom>,save:(action:MatchAction)=>Promise<boolean>,already:(action:MatchAction)=>void,current:()=>boolean,onSaved:()=>void,onStale:(action:MatchAction)=>void=()=>{}){
 action={...action}
 let disposed=false,version=0,busy=false
 const dialog=document.createElement('dialog');dialog.className='chat-post-dialog';dialog.setAttribute('aria-label','Review match reply')
 const active=()=>!disposed&&current(),close=()=>{disposed=true;version++;dialog.remove()}
 const load=async()=>{
  const attempt=++version;dialog.innerHTML='<h2>Review match reply</h2><p role="status">Checking the latest team plan…</p><button type="button" data-close>Cancel</button>';dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=close
  try{
   const room=await read();if(!active()||attempt!==version)return;if(room.id!==roomId)throw new ChatActionError('This team changed. Close and reopen it.',false)
   const review=matchReplyReview(room,owner,action)
   dialog.innerHTML=`<h2>Review match reply</h2><p><strong>${html(room.teamName)}</strong> · ${html(matchDate(review.match.matchDate))}</p><p>${html(review.match.opponent||'Opponent not recorded')} · ${html(review.match.matchTime||'Time not recorded')}</p><p>${html(review.match.facility||'Facility not recorded')}</p><h3>Your choice</h3><p><strong>${html(review.choice)}</strong></p>${review.court?`<p>Your court: ${html(review.court.courtLabel)}</p>`:''}${action.action==='acknowledge_lineup'||action.action==='ack_final_lineup'?`<ul class="team-courts">${review.lineup.map(court=>`<li><strong>${html(court.label)}</strong><p>${court.defaulted?'Defaulted court':court.players.map(html).join(' &amp; ')||'Not assigned'}</p></li>`).join('')}</ul>`:''}${action.action==='respond_lineup_change'&&review.replacement?`<p>${html(review.replacement.replacementPlayerName)} replaces ${html(review.replacement.outgoingPlayerName)} on ${html(review.replacement.courtLabel)}.</p><p>${review.replacement.afterPlayers.map(html).join(' &amp; ')}</p>`:''}<p class="rating-context">${review.alreadySaved?'This choice is already saved. No new reply is needed.':action.action==='respond'?'Your captain sees this reply. Availability does not guarantee a court assignment.':action.action==='set_arrival_status'&&action.arrivalStatus==='running_late'?'Your captains will be alerted that you’re running late.':'Confirm to save this reply for your team.'}</p><p role="status"></p>${review.alreadySaved?'':'<button type="button" data-confirm>Confirm reply</button><button type="button" class="secondary" data-refresh>Check latest plan</button>'}<button type="button" class="secondary" data-close>${review.alreadySaved?'Done':'Cancel'}</button>`
   const notice=dialog.querySelector<HTMLElement>('[role=status]')!,buttons=()=>dialog.querySelectorAll<HTMLButtonElement>('button')
   dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>{if(!busy){if(review.alreadySaved){already(action);onSaved()}close()}}
   dialog.querySelector<HTMLButtonElement>('[data-refresh]')?.addEventListener('click',()=>{if(!busy)void load()})
   dialog.querySelector<HTMLButtonElement>('[data-confirm]')?.addEventListener('click',()=>{if(!active()||busy)return;busy=true;buttons().forEach(button=>button.disabled=true);notice.textContent='Saving your match reply…';void (async()=>{try{const result=await confirmReviewedMatch(review,action,owner,roomId,read,save,already,active);if(!active())return;if(result==='changed'){notice.textContent='The plan changed. Check latest plan and review it before confirming.';dialog.querySelector('[data-confirm]')?.remove();return}if(result==='saved'){close();onSaved()}else{notice.textContent='Reply was not confirmed. Close and check Match day before trying again.';dialog.querySelector('[data-confirm]')?.remove();dialog.querySelector('[data-refresh]')?.remove()}}catch(cause){if(active()){if(cause instanceof ChatActionError&&!cause.uncertain)onStale(action);notice.textContent=cause instanceof ChatActionError?cause.message:'Couldn’t confirm this reply. Close and check Match day before trying again.';dialog.querySelector('[data-confirm]')?.remove()}}finally{if(active()){busy=false;buttons().forEach(button=>button.disabled=false)}}})()})
   dialog.querySelector<HTMLButtonElement>('[data-confirm],[data-close]')?.focus()
  }catch(cause){if(active()&&attempt===version){if(cause instanceof ChatActionError&&!cause.uncertain)onStale(action);dialog.innerHTML=`<h2>Review match reply</h2><p role="alert">${html(cause instanceof ChatActionError?cause.message:'Couldn’t check the latest plan. Your reply was not sent.')}</p><button type="button" data-close>Close</button>`;dialog.querySelector<HTMLButtonElement>('button')!.onclick=close}}
 }
 dialog.oncancel=event=>{event.preventDefault();if(!busy)close()};document.body.append(dialog);dialog.showModal();void load();return {isOpen:()=>!disposed,dispose:close}
}
