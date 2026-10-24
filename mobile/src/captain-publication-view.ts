import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import type {CaptainMatch} from './captain-data'
import {html} from './match-details'
import {matchDate} from './recent-results'
import {loadPublicationReview,sendPublication,PublicationError,type PublicationReview,type PublicationIntent,type PublishedCourt} from './captain-publication-data'
const courtHtml=(lineup:PublishedCourt[])=>`<ul class="team-courts">${lineup.map(c=>`<li><h3>${html(c.label)}</h3><p>${c.defaulted?'Default':c.players.map(html).join(' &amp; ')||'Not assigned'}</p></li>`).join('')}</ul>`
export function publicationReviewHtml(review:PublicationReview){const shared=review.shared;return `<h2>Review team lineup</h2><p>${html(matchDate(review.matchDate))} · ${html(review.opponent)}</p><h3>Your saved proposal</h3>${courtHtml(review.proposal.lineup)}<p>${html(review.proposal.arrivalTime||'Arrival time not set')} · ${html(review.proposal.facility||'Location not set')}</p><p class="rating-context">Sharing posts these courts, arrival time and location to team chat and alerts your team. Your saved notes stay private.</p>${review.proposal.reason?`<p>${html(review.proposal.reason)}</p>`:''}<button type="button" id="share-native-proposal" ${review.proposal.canShare?'':'disabled'}>Share proposal with team</button><hr><h3>Shared lineup</h3>${shared.active?`${courtHtml(shared.lineup)}<p>${shared.confirmedCount} of ${shared.totalCount} courts confirmed</p>${shared.courts.length?`<ul>${shared.courts.map(c=>`<li>${html(c.label)} · ${c.status==='waiting'?'Waiting for replies':'Needs captain attention'}</li>`).join('')}</ul>`:''}`:'<p>This fixture has no active shared lineup yet.</p>'}${shared.alreadyFinal?'<p>Final lineup sent to your team.</p>':shared.pendingFinal?'<p>A final update is pending. Complete it using the existing delivery receipt.</p>':'<p class="rating-context">Send the shared courts as final after every court is confirmed. This posts a final update and alerts your team.</p>'}<button type="button" id="send-native-final" ${shared.canFinalize&&!shared.alreadyFinal?'':'disabled'}>${shared.pendingFinal?'Complete pending final update':'Send confirmed final lineup'}</button><p role="status" aria-live="polite"></p><button type="button" class="secondary" id="publication-close">Close</button>`}
export function openPublicationReview(client:SupabaseClient,owner:string,scope:TeamScope,match:CaptainMatch,isCurrent:()=>boolean,onDone:(message:string)=>void){
 const dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog';dialog.setAttribute('aria-label','Review team lineup');dialog.innerHTML='<p role="status">Checking your saved plan and team confirmations…</p>';document.body.append(dialog);dialog.showModal()
 let disposed=false,busy=false,intent:PublicationIntent|null=null
 const current=()=>!disposed&&isCurrent(),dispose=()=>{disposed=true;intent=null;dialog.close();dialog.remove()}
 dialog.addEventListener('cancel',event=>{event.preventDefault();if(!busy)dispose()})
 void(async()=>{try{
  const review=await loadPublicationReview(client,owner,current,scope,match);if(!current())return
  dialog.innerHTML=publicationReviewHtml(review)
  const close=dialog.querySelector<HTMLButtonElement>('#publication-close')!,status=dialog.querySelector<HTMLElement>('[role=status]')!,proposal=dialog.querySelector<HTMLButtonElement>('#share-native-proposal')!,final=dialog.querySelector<HTMLButtonElement>('#send-native-final')!
  close.onclick=()=>{if(!busy)dispose()}
  const send=async(kind:'proposal'|'final')=>{
   if(busy||!current())return
   intent??={kind,publicationId:crypto.randomUUID(),review:structuredClone(review)}
   if(intent.kind!==kind)return
   busy=true;proposal.disabled=true;final.disabled=true;close.disabled=true;status.textContent='Confirming delivery to your team…'
   try{const result=await sendPublication(client,owner,current,intent);if(!current())return;dispose();onDone(kind==='proposal'?'Proposal shared with your team.':'Final lineup sent to your team.'+(result.draftFinalized?' Your saved lineup is marked Final.':' Your private working plan was kept as it is.'))}
   catch(cause){if(!current())return;status.textContent=cause instanceof Error?cause.message:'Delivery could not be confirmed.';const code=cause instanceof PublicationError?cause.status:0;if(![400,401,403,409].includes(code)){const button=kind==='proposal'?proposal:final;button.disabled=false;button.textContent='Retry same delivery'}close.disabled=false}
   finally{busy=false}
  }
  proposal.onclick=()=>{void send('proposal')};final.onclick=()=>{void send('final')}
 }catch(cause){if(current()){dialog.innerHTML=`<h2>Lineup review unavailable</h2><p role="alert">${html(cause instanceof Error?cause.message:'Try refreshing your team.')}</p><button type="button">Close</button>`;dialog.querySelector('button')!.onclick=dispose}}})()
 return {dispose}
}
