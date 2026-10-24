import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import type {CaptainMatch} from './captain-data'
import {html} from './match-details'
import {matchDate} from './recent-results'
import {PublicationError} from './captain-publication-data'
import {loadReplacementReview,sendReplacement,type ReplacementReview,type ReplacementChoice} from './captain-replacement-data'
export function replacementReviewHtml(r:ReplacementReview){return `<h2>Replace a lineup player</h2><p>${html(matchDate(r.matchDate))} · ${html(r.opponent)}</p><ul class="team-courts">${r.lineup.map(c=>`<li><h3>${html(c.label)}</h3><p>${c.defaulted?'Default':c.players.map(html).join(' &amp; ')}</p></li>`).join('')}</ul>${r.currentChange?`<p>Current change · ${html(r.currentChange.courtLabel)}: ${html(r.currentChange.replacementPlayerName)} · ${r.currentChange.pending?'Delivery pending':r.currentChange.response==='accepted'?'Accepted':r.currentChange.response==='declined'?'Can’t play':'Waiting for a reply'}</p>`:''}${r.pending?'<p>A replacement delivery is pending. Complete the same update below.</p>':r.canReplace?`<label>Player coming out<select id="replacement-out"><option value="">Choose a court player</option>${r.lineup.flatMap((c,i)=>c.defaulted?[]:c.players.map((name,j)=>`<option value="${i}:${j}">${html(c.label)} · ${html(name)}</option>`)).join('')}</select></label><label>Replacement<select id="replacement-in"><option value="">Choose an unassigned player</option>${r.candidates.map((p,i)=>`<option value="${i}">${html(p.name)}</option>`).join('')}</select></label><div id="replacement-preview" aria-live="polite"></div>`:`<p>${html(r.reason)}</p>`}<p class="rating-context">This updates one shared court and asks the replacement to accept. Affected team members with alerts on receive an update. Your saved working lineup stays as it is.</p><button type="button" id="replacement-send" ${r.pending?'':'disabled'}>${r.pending?'Complete pending replacement':'Review and send replacement'}</button><p role="status" aria-live="polite"></p><button type="button" class="secondary" id="replacement-close">Close</button>`}
export function openReplacementReview(client:SupabaseClient,owner:string,scope:TeamScope,match:CaptainMatch,isCurrent:()=>boolean,onDone:(message:string)=>void){
 const dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog';dialog.setAttribute('aria-label','Replace a lineup player');dialog.innerHTML='<p role="status">Checking the published lineup and roster…</p>';document.body.append(dialog);dialog.showModal()
 let disposed=false,busy=false,intent:ReplacementChoice|null=null
 const current=()=>!disposed&&isCurrent(),dispose=()=>{disposed=true;intent=null;dialog.close();dialog.remove()}
 dialog.addEventListener('cancel',event=>{event.preventDefault();if(!busy)dispose()})
 void(async()=>{try{
  const review=await loadReplacementReview(client,owner,current,scope,match);if(!current())return
  dialog.innerHTML=replacementReviewHtml(review);intent=review.pending
  const out=dialog.querySelector<HTMLSelectElement>('#replacement-out'),incoming=dialog.querySelector<HTMLSelectElement>('#replacement-in'),preview=dialog.querySelector<HTMLElement>('#replacement-preview'),send=dialog.querySelector<HTMLButtonElement>('#replacement-send')!,close=dialog.querySelector<HTMLButtonElement>('#replacement-close')!,status=dialog.querySelector<HTMLElement>('[role=status]')!
  const selection=()=>{if(!out?.value||!incoming?.value)return null;const [courtIndex,seat]=out.value.split(':').map(Number),court=review.lineup[courtIndex],replacement=review.candidates[Number(incoming.value)];return court&&replacement?{court,seat,replacement}:null}
  const update=()=>{const selected=selection();send.disabled=!selected;if(preview)preview.innerHTML=selected?`<h3>Review · ${html(selected.court.label)}</h3><p>${html(selected.court.players[selected.seat])} → ${html(selected.replacement.name)}</p><p>New court: ${selected.court.players.map((name,i)=>html(i===selected.seat?selected.replacement.name:name)).join(' &amp; ')}</p>`:''}
  if(out)out.onchange=update;if(incoming)incoming.onchange=update;close.onclick=()=>{if(!busy)dispose()}
  send.onclick=()=>{void(async()=>{if(busy||!current())return
   if(!intent){const selected=selection();if(!selected)return;intent={publicationId:crypto.randomUUID(),expectedCardToken:review.expectedCardToken,courtLabel:selected.court.label,outgoingPlayerName:selected.court.players[selected.seat],replacementKey:selected.replacement.key}}
   busy=true;send.disabled=true;close.disabled=true;if(out)out.disabled=true;if(incoming)incoming.disabled=true;status.textContent='Confirming the replacement update…'
   try{await sendReplacement(client,owner,current,review,intent);if(!current())return;dispose();onDone('Replacement sent. Watch Match day for the player’s reply.')}
   catch(cause){if(!current())return;status.textContent=cause instanceof Error?cause.message:'Delivery could not be confirmed.';const code=cause instanceof PublicationError?cause.status:0;if(![400,401,403,409].includes(code)){send.disabled=false;send.textContent='Retry same replacement'}close.disabled=false}
   finally{busy=false}
  })()}
 }catch(cause){if(current()){dialog.innerHTML=`<h2>Replacement review unavailable</h2><p role="alert">${html(cause instanceof Error?cause.message:'Refresh your team.')}</p><button type="button">Close</button>`;dialog.querySelector('button')!.onclick=dispose}}})()
 return {dispose}
}
