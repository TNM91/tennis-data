import type {SupabaseClient} from '@supabase/supabase-js'
import type {ScenarioSend} from './captain-scenarios-data'
import {tournamentEntryCanSend,tournamentEntryAction,type TournamentEntrySnapshot,type TournamentEntryDraft,type TournamentEntryReceipt} from '../../lib/native-tournament-entry-contract'
import {tournamentEntryRequest} from './tournament-entry-data'
import {loadTournaments} from './tournaments-data'
import {tournamentMyEvent} from './tournament-my-event'
import {openCalendar} from './calendar-view'
import {Browser} from './native-browser'
import {html} from './match-details'
const label=(e:TournamentEntryReceipt)=>e.status==='pending'?'Awaiting organizer approval':e.status==='declined'?'Not approved':e.inDraw?'Approved · in the draw':'Approved · awaiting draw placement'
const levels=(name:string,value:number|null,disabled:boolean)=>'<select name="'+name+'" aria-label="'+(name==='rating'?'Your self-rated level':'Partner self-rated level')+'" required '+(disabled?'disabled':'')+'><option value="">Choose a level</option>'+Array.from({length:13},(_,i)=>1+i*.5).map(n=>'<option value="'+n+'" '+(value===n?'selected':'')+'>'+n.toFixed(1)+'</option>').join('')+'</select>'
function receiptHtml(e:TournamentEntryReceipt){return '<section class="entry-receipts" aria-label="Your entry"><article data-entry-state="'+e.status+'"><small>Saved entry</small><strong>'+html(e.name)+'</strong><span class="entry-state">'+html(label(e))+'</span>'+(e.note?'<p>Organizer: '+html(e.note)+'</p>':'')+(e.legacy?'<p>Contact the organizer to change this existing entry.</p>':'')+'</article></section>'}
export function tournamentEntryHtml(s:TournamentEntrySnapshot,d:TournamentEntryDraft,busy:boolean,organizer=false,selected=''){
 const c=s.context
 if(organizer){const e=s.queue.find(x=>x.id===selected)
  return '<h3 tabindex="-1">App entry requests</h3><p>Review self-reported player details before adding anyone to the draw.</p>'+(e?'<article class="entry-receipts"><strong>'+html(e.name)+'</strong><p>'+html(e.one)+' · self-rated '+e.rating?.toFixed(1)+(e.two?'<br>'+html(e.two)+' · self-rated '+e.partnerRating?.toFixed(1):'')+'</p><form data-tournament-decision><label for="tournament-decision-note">Note to player</label><textarea id="tournament-decision-note" name="note" maxlength="600" required '+(busy?'disabled':'')+'></textarea><label class="entry-check"><input type="checkbox" name="confirmed" '+(busy||!c.canApprove?'disabled':'')+'><span>I checked '+(c.paired?'both players’':'this player’s')+' eligibility and can add '+'them'+' to this draw.</span></label><p>No payment is collected here. Arrange any entry fee with the organizer.</p><div class="decision-actions"><button type="submit" name="decision" value="approve" '+(busy||!c.canApprove?'disabled':'')+'>Approve and add to draw</button><button type="submit" class="secondary" name="decision" value="decline" '+(busy?'disabled':'')+'>Decline request</button><button type="button" class="secondary" data-request-list '+(busy?'disabled':'')+'>← Requests</button></div></form></article>':
   '<ul class="decision-list">'+s.queue.map(e=>'<li><button type="button" class="secondary" data-request="'+html(e.id)+'">'+html(e.name)+'<span>Review request →</span></button></li>').join('')+'</ul>'+(s.queue.length?'':'<p>No pending app entry requests.</p>')+(s.more?'<p>Showing the first 50 requests. Review these, then refresh for more.</p>':''))+(c.locked?'<p class="entry-note">The draw has results or assigned courts. New approvals are paused. You can still decline a pending request.</p>':'')
 }
 if(s.receipt)return receiptHtml(s.receipt)
 if(c.mode!=='native')return '<p class="entry-note">'+(c.mode==='director'?'Enter through the tournament director: '+html(c.director):c.mode==='unsupported'?'Contact the organizer to enter this draw format.':'Entry requests are closed for this division.')+'</p>'
 return '<p>Request a place'+(c.paired?' with your doubles partner':'')+'. The organizer reviews entries before adding players to the draw.</p><form data-tournament-entry><fieldset class="entry-fields"><legend>Your player details</legend><label for="tournament-entry-one">Your player name</label><input id="tournament-entry-one" name="one" maxlength="90" required value="'+html(d.one)+'" '+(c.playerLocked?'readonly':'')+' '+(busy?'disabled':'')+'><p class="rating-context">'+(c.playerLocked?'Using your linked player name.':'Use the name you play under. This request does not link a player profile.')+'</p><label>Your self-rated level'+levels('rating',d.rating,busy)+'</label></fieldset>'+
 (c.paired?'<fieldset class="entry-fields"><legend>Your doubles partner</legend><label for="tournament-entry-two">Partner name</label><input id="tournament-entry-two" name="two" maxlength="90" required value="'+html(d.two)+'" '+(busy?'disabled':'')+'><label>Partner self-rated level'+levels('partnerRating',d.partnerRating,busy)+'</label></fieldset>':'')+
 '<fieldset class="entry-fields entry-confirmations"><legend>Before you send</legend><label class="entry-check"><input type="checkbox" name="attested" '+(d.attested?'checked':'')+' '+(busy?'disabled':'')+'><span>I meet this division’s requirements and my details are accurate.</span></label>'+
 (c.paired?'<label class="entry-check"><input type="checkbox" name="partnerAttested" '+(d.partnerAttested?'checked':'')+' '+(busy?'disabled':'')+'><span>My partner agrees to enter. Their details are accurate and they meet this division’s requirements.</span></label>':'')+
 '<p class="entry-note">Levels are self-reported. Entry fees, if any, are arranged with the organizer. No payment is collected here.</p></fieldset><button type="submit" data-entry-send '+(busy||!tournamentEntryCanSend(c,d)?'disabled':'')+'>Request entry</button></form>'
}
type TournamentEntryOptions={allowCalendar?:boolean;backLabel?:string;existingEntry?:boolean}
export function openTournamentEntry(client:SupabaseClient,owner:string,current:()=>boolean,parent:string,division:string,onClose:(changed:boolean)=>void,send?:ScenarioSend,trigger?:HTMLElement,{allowCalendar=true,backLabel='← Division',existingEntry=false}:TournamentEntryOptions={}){
 const previous=trigger||(document.activeElement instanceof HTMLElement?document.activeElement:null),dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog competitions-dialog league-entry-dialog tournament-entry-dialog';dialog.setAttribute('aria-label','Tournament entry')
 let disposed=false,version=0,busy=false,uncertain=false,organizer=false,selected='',snapshot:TournamentEntrySnapshot|null=null,notice='',revision='',draft:TournamentEntryDraft={one:'',two:'',rating:null,partnerRating:null,attested:false,partnerAttested:false}
 let calendar:ReturnType<typeof openCalendar>|null=null
 let needsScheduleRefresh=false
 const active=()=>!disposed&&current(),dispose=()=>{if(disposed)return;disposed=true;version++;calendar?.dispose();calendar=null;snapshot=null;document.removeEventListener('visibilitychange',hidden);dialog.remove();onClose(needsScheduleRefresh);if(current()&&previous?.isConnected)previous.focus({preventScroll:true})},hidden=()=>{if(document.visibilityState==='hidden')dispose()},focus=()=>dialog.querySelector<HTMLElement>('[data-registration-notice]')?.focus({preventScroll:true})
 const approvedEntry=()=>!organizer&&snapshot?.receipt?.status==='approved'&&snapshot.receipt.inDraw?snapshot.receipt:null
 const render=()=>{
  if(!active())return
  const entry=approvedEntry()
  const title=entry||existingEntry?'My event':organizer?'Review entries':'Tournament entry'
  const eventName=entry&&snapshot?.context.eventName!==snapshot?.context.name?snapshot?.context.eventName:''
  dialog.setAttribute('aria-label',entry||existingEntry?'My event':'Tournament entry')
  dialog.innerHTML=`<header class="competition-header">
   <button type="button" class="secondary" data-entry-back>${organizer?'← Your entry':html(backLabel)}</button>
   <button type="button" class="secondary" data-entry-refresh ${busy?'disabled':''}${entry?' aria-label="Refresh entry and match details"':''}>${entry?'Refresh':'Refresh entry status'}</button>
  </header>
  <div class="competition-hero entry-hero${entry?' tournament-pass-hero':''}">
   <small>${entry?html(eventName||'Tournament entry'):'Tournament registration'}</small><h2 tabindex="-1">${title}</h2>
   ${snapshot?`<p>${html(snapshot.context.name)}${entry?` <span aria-hidden="true">·</span> ${html(entry.name)}`:''}</p>`:''}
  </div>
  ${entry?'<div data-tournament-pass aria-busy="true"><p role="status">Checking the published draw…</p></div>':''}
  ${snapshot?`${snapshot.context.deadline&&!entry?`<p class="rating-context">Entry deadline: ${html(snapshot.context.deadline)} · ${html(snapshot.context.zone)}</p>`:''}
   ${existingEntry&&!snapshot.receipt?'<p class="entry-note">Your approved entry is unavailable. Refresh to check your registration.</p>':tournamentEntryHtml(snapshot,draft,busy,organizer,selected)}
   ${!existingEntry&&!organizer&&snapshot.context.canManage?`<button type="button" class="secondary" data-organizer-entries ${busy?'disabled':''}>Review app entries</button>`:''}`:''}
  <p role="${notice&&!busy&&(!snapshot?.receipt||uncertain)?'alert':'status'}" tabindex="-1" data-registration-notice>${html(notice)}</p>
  ${uncertain?'<p class="entry-note">Refresh entry status before trying again. A lost connection does not mean the change was not saved.</p>':''}`
  dialog.querySelector('[data-entry-back]')?.addEventListener('click',()=>{back()})
  dialog.querySelector('[data-entry-refresh]')?.addEventListener('click',()=>{void load()})
  dialog.querySelector('[data-organizer-entries]')?.addEventListener('click',()=>{organizer=true;selected='';void load()})
  dialog.querySelector('[data-request-list]')?.addEventListener('click',()=>{selected='';render()})
  dialog.querySelectorAll<HTMLButtonElement>('[data-request]').forEach(b=>{b.onclick=()=>{selected=b.dataset.request||'';render();dialog.querySelector<HTMLElement>('h3')?.focus({preventScroll:true})}})
  const form=dialog.querySelector<HTMLFormElement>('[data-tournament-entry]')
  const read=()=>{if(!form)return;const f=new FormData(form);draft={one:String(f.get('one')||''),two:String(f.get('two')||''),rating:f.get('rating')?Number(f.get('rating')):null,partnerRating:f.get('partnerRating')?Number(f.get('partnerRating')):null,attested:f.get('attested')==='on',partnerAttested:f.get('partnerAttested')==='on'}}
  form?.addEventListener('input',()=>{read();const b=form.querySelector<HTMLButtonElement>('[data-entry-send]');if(b&&snapshot)b.disabled=busy||uncertain||!tournamentEntryCanSend(snapshot.context,draft)})
  form?.addEventListener('submit',e=>{e.preventDefault();read();if(snapshot&&form.reportValidity()&&tournamentEntryCanSend(snapshot.context,draft))void write({parent,division,action:'submit',data:{...draft,revision:snapshot.context.revision}})})
  dialog.querySelector<HTMLFormElement>('[data-tournament-decision]')?.addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget as HTMLFormElement,b=(e as SubmitEvent).submitter as HTMLButtonElement|null,item=snapshot?.queue.find(x=>x.id===selected);if(!snapshot||!item||!f.reportValidity()||!b)return;const values=new FormData(f),confirmed=values.get('confirmed')==='on';if(b.value==='approve'&&!confirmed){notice='Confirm eligibility before adding players to the draw.';const n=dialog.querySelector<HTMLElement>('[data-registration-notice]')!;n.textContent=notice;n.setAttribute('role','alert');focus();return}void write({parent,division,action:'decide',data:{revision:snapshot.context.revision,entryId:item.id,updatedAt:item.updatedAt,decision:b.value as 'approve'|'decline',note:String(values.get('note')||''),confirmed}})})
  if(uncertain)dialog.querySelectorAll<HTMLButtonElement>('form button[type=submit]').forEach(b=>b.disabled=true)
 }
 const loadPass=async(attempt:number,entry:TournamentEntryReceipt,host:HTMLElement)=>{
  const currentPass=()=>active()&&attempt===version&&host.isConnected
  let pass:ReturnType<typeof tournamentMyEvent>|undefined
  try{
   const result=await loadTournaments(client,owner,currentPass,'',parent||division,parent?division:'',send)
   if(result.detail)pass=tournamentMyEvent(result.detail,entry.name,allowCalendar)
  }catch{ /* The entry receipt is still available if the public draw can't be loaded. */ }
  if(!currentPass())return
  host.innerHTML=pass?.content??'<p role="status">Your draw details are unavailable. Refresh or check with the event desk.</p>'
  host.setAttribute('aria-busy','false')
  const button=host.querySelector<HTMLButtonElement>('[data-event-calendar]'),match=pass?.calendarMatch
  if(button&&match)button.onclick=()=>{
   if(!currentPass()||calendar?.isOpen())return
   calendar=openCalendar(client,owner,currentPass,button,{tournamentMatch:match,onClose:changed=>{
    calendar=null
    if(changed&&currentPass()){needsScheduleRefresh=true;void load()}
   }})
  }
  const venueButton=host.querySelector<HTMLButtonElement>('[data-event-venue]'),url=pass?.venueHref
  const venueStatus=host.querySelector<HTMLElement>('[data-event-venue-status]')
  if(venueButton&&url&&venueStatus)venueButton.onclick=async()=>{
   if(!currentPass()||venueButton.disabled||calendar?.isOpen())return
   venueStatus.textContent='';venueButton.disabled=true
   try{await Browser.open({url})}
   catch{if(currentPass())venueStatus.textContent='Couldn’t open Apple Maps. Try again.'}
   finally{if(currentPass())venueButton.disabled=false}
  }
 }
 const showEntry=(attempt:number)=>{
  render()
  const entry=approvedEntry(),host=dialog.querySelector<HTMLElement>('[data-tournament-pass]')
  if(existingEntry&&snapshot&&!entry){needsScheduleRefresh=true;dialog.querySelector<HTMLElement>('h2')?.focus();return}
  if(!entry||!host){focus();return}
  dialog.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})
  void loadPass(attempt,entry,host)
 }
 const load=async()=>{if(!active()||busy)return;const attempt=++version;busy=true;snapshot=null;selected='';notice='Checking entry status…';render();try{const s=await tournamentEntryRequest(client,owner,()=>active()&&attempt===version,parent,division,organizer,undefined,send);if(active()&&attempt===version){snapshot=s;uncertain=false;if(revision!==s.context.revision){draft={one:s.context.playerName,two:'',rating:null,partnerRating:null,attested:false,partnerAttested:false};revision=s.context.revision}notice=''}}catch(e){if(active()&&attempt===version)notice=e instanceof Error?e.message:'Registration unavailable.'}finally{if(active()&&attempt===version){busy=false;showEntry(attempt)}}}
 const write=async(action:ReturnType<typeof tournamentEntryAction>)=>{if(!active()||busy||uncertain||!snapshot)return;const attempt=++version;busy=true;notice='Saving entry…';render();let reload=false;try{const s=await tournamentEntryRequest(client,owner,()=>active()&&attempt===version,parent,division,organizer,action,send);if(active()&&attempt===version){if(organizer){snapshot=null;reload=true}else snapshot=s;notice=organizer?'Decision saved.':s.receipt?.status==='pending'?'Request saved. The organizer will review your entry.':'Your saved entry is shown above.'}}catch(e){if(active()&&attempt===version){snapshot=null;uncertain=true;notice=e instanceof Error?e.message:'The change could not be confirmed. Refresh entry status.'}}finally{if(active()&&attempt===version){busy=false;if(reload)void load();else showEntry(attempt)}}}
 const back=()=>{
  if(calendar?.isOpen()){calendar.back();return true}
  if(organizer){version++;busy=false;organizer=false;selected='';void load()}
  else dispose()
  return true
 }
 dialog.oncancel=e=>{e.preventDefault();back()};document.addEventListener('visibilitychange',hidden);document.body.append(dialog);dialog.showModal();void load()
 return {dispose,isOpen:()=>!disposed,back}
}
