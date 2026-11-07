import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'
import {requestPlayerPractices,PlayerPracticeError,type PlayerPractice,type PlayerPracticeReply} from './player-practices-data'
import {freezePlayerPracticeReply,playerPracticeReplyMatches,practiceId} from '../../lib/native-player-practice-contract'
import {formatCaptainPracticeDate,formatCaptainPracticeTimeRange,extractCaptainPracticeFocus} from '../../lib/captain-practice-invite'
import {html} from './match-details'
const label={in:'In',out:'Out',maybe:'Maybe',unanswered:'No reply',waitlist:'Waitlist'}
const practiceStatus={proposed:'Proposed',confirmed:'Scheduled',completed:'Completed',cancelled:'Cancelled'}
type LeaveDestination='close'|'refresh'|'list'
export function playerPracticeStatus(p:PlayerPractice){return `${label[p.mine.displayStatus]}${p.mine.response==='in'&&p.mine.confirmedAt?' · Captain-confirmed':''}`}

function practiceBrief(p:PlayerPractice){
 const date=formatCaptainPracticeDate(p.date)
 const time=formatCaptainPracticeTimeRange(p.time,p.endTime)||'Time not set'
 return `<section class="player-practice-brief" data-practice-state="${p.status}">
  <p class="stat-eyebrow">${practiceStatus[p.status]}</p>
  <h2>${html(p.title)}</h2>
  <dl>
   <div><dt>When</dt><dd>${html(date)} · ${html(time)}</dd></div>
   <div><dt>Where</dt><dd>${html(p.facility||'Location not set')}</dd></div>
  </dl>
 </section>`
}

function practiceReplyPanel(p:PlayerPractice,note:string,busy:boolean){
 const capacity=p.capacity===null?'Capacity not set':p.capacity+(p.capacity===1?' spot':' spots')
 const open=p.status==='proposed'||p.status==='confirmed'
 return `<section class="player-practice-reply">
  <h3>Your RSVP · ${html(p.mine.name)}</h3>
  <p class="player-practice-reply-status">${html(playerPracticeStatus(p))}</p>
  <p>${capacity} · ${p.inCount} In · ${p.waitlistCount} waitlisted</p>
  ${open?`<div class="player-practice-responses" role="group" aria-label="Your practice response">
    ${(['in','out','maybe'] as const).map(r=>`<button type="button" class="secondary" data-response="${r}" ${busy?'disabled':''}>${label[r]}</button>`).join('')}
   </div>
   <p>Review before saving. Your captain confirms spots separately.</p>
   <details class="player-practice-note" ${note||note!==p.mine.note?'open':''}>
    <summary>Note for your captain (optional)</summary>
    <textarea aria-label="Note for your captain" data-note maxlength="300" ${busy?'disabled':''}>${html(note)}</textarea>
   </details>`:`<p>This practice is ${p.status}. Replies are closed.</p>${p.mine.note?'<p class="training-note">'+html(p.mine.note)+'</p>':''}`}
 </section>`
}

export function openPlayerPractices(client:SupabaseClient,owner:string,scope:TeamScope,current:()=>boolean,onClose:(restore:boolean)=>void,invite='',backLabel='Back to team',initialEventId=''){
 if(initialEventId&&(!practiceId(initialEventId)||invite))throw Error('Choose a valid practice.')
 const dialog=document.createElement('dialog'),previous=document.activeElement as HTMLElement|null;dialog.className='captain-lineup-dialog training-dialog player-practice-dialog';dialog.setAttribute('aria-label','Team practices')
 let disposed=false,busy=false,version=0,data:{practices:PlayerPractice[];more:boolean}|null=null,selected=initialEventId,section:'upcoming'|'earlier'|'cancelled'='upcoming',note='',pending:PlayerPracticeReply|null=null,attempted=false,conflict=false,leaving:LeaveDestination|null=null,notice=''
 const active=()=>!disposed&&current(),focus=()=>dialog.querySelector<HTMLElement>('h1')?.focus(),dispose=(restore=false)=>{if(disposed)return;disposed=true;version++;pending=null;data=null;note='';dialog.remove();onClose(restore);if(restore&&current()&&previous?.isConnected)previous.focus({preventScroll:true})}
 const send=async(lookup:boolean)=>{if(!pending||busy||!active()||conflict&&!lookup)return;const reply=pending;busy=true;attempted=true;notice=lookup?'Checking your saved reply...':'Saving your RSVP...';render();try{const result=await requestPlayerPractices(client,owner,active,scope,reply.eventId,lookup?null:reply),saved=result.practices.find(p=>playerPracticeReplyMatches(reply,p));if(!active())return;busy=false;if(!saved)throw new PlayerPracticeError(true);data={practices:(data?.practices||[]).map(p=>p.id===saved.id?saved:p),more:data?.more||false};pending=null;attempted=false;conflict=false;note=saved.mine.note;notice='Your RSVP is saved. '+playerPracticeStatus(saved)+'.';render();focus()}catch(e){if(active()){busy=false;conflict=conflict||e instanceof PlayerPracticeError&&e.conflict;notice=conflict?'The practice or your RSVP changed. Check your saved reply, or discard and refresh before replying again.':'RSVP not confirmed. Check your saved reply before retrying the same response.';render();focus()}}}
 const load=async(id=initialEventId)=>{if(busy||!active())return;const epoch=++version;busy=true;notice='Loading your team practices...';render();try{const result=await requestPlayerPractices(client,owner,()=>active()&&epoch===version,scope,id,null,undefined,id?'':invite);if(active()&&epoch===version){data=id&&data?{practices:data.practices.map(p=>result.practices.find(x=>x.id===p.id)||p),more:data.more}:result;if(id&&!result.practices.some(p=>p.id===id)){selected='';notice='This practice is no longer available to your linked player.'}else notice='';if(invite&&!id&&data?.practices.length===1)selected=data.practices[0].id;note=data.practices.find(p=>p.id===selected)?.mine.note||''}}catch{if(active()&&epoch===version){data=null;notice='Practices could not be loaded. Check your team access and connection; this does not mean your list is empty.'}}finally{if(active()&&epoch===version){busy=false;render();focus()}}}
 const noteChanged=()=>note!==(data?.practices.find(p=>p.id===selected)?.mine.note||'')
 const showList=()=>{const id=selected;selected='';note='';notice='';render();const opener=dialog.querySelector<HTMLElement>('[data-practice="'+id+'"]');if(opener)opener.focus();else focus()}
 const leave=(destination:LeaveDestination)=>{if(busy||!active())return;if(pending||noteChanged()){leaving=destination;render();focus()}else if(destination==='close')dispose(true);else if(destination==='list')showList();else void load(selected)}
 const keepReply=()=>{if(busy||!active())return;leaving=null;render();const field=!pending&&noteChanged()?dialog.querySelector<HTMLTextAreaElement>('[data-note]'):null;if(field)field.focus();else focus()}
 const close=()=>{if(leaving)keepReply();else leave('close')}
 const discardReply=()=>{if(busy||!active()||!leaving)return;const destination=leaving;pending=null;attempted=false;conflict=false;leaving=null;note='';if(destination==='list')showList();else void load(selected)}
 const render=()=>{if(!active())return;const p=data?.practices.find(p=>p.id===selected),today=new Date(),day=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-'),items=data?.practices.filter(p=>section==='cancelled'?p.status==='cancelled':p.status!=='cancelled'&&(section==='upcoming'?p.date>=day&&p.status!=='completed':p.date<day||p.status==='completed')).sort((a,b)=>section==='upcoming'?a.date.localeCompare(b.date)||a.time.localeCompare(b.time):b.date.localeCompare(a.date))||[]
 if(leaving)dialog.innerHTML=`<h1 tabindex="-1">${leaving==='refresh'?'Refresh this practice?':leaving==='list'?'Back to practices?':'Leave this RSVP?'}</h1><p>${attempted?'Your reply may already be saved. Refresh the practice before replying again.':leaving==='close'?'Your unsaved reply will be discarded.':'Your unsaved note will be discarded.'}${leaving==='close'?' Pending replies stay only while this screen is open.':''}</p><button type="button" data-keep>Keep reply</button><button type="button" class="secondary" data-discard>${leaving==='list'?'Discard note and go back':'Discard and refresh'}</button>`
 else if(pending&&p)dialog.innerHTML=`<h1 tabindex="-1">Review your RSVP</h1>${practiceBrief(p)}<p>Replying as ${html(p.mine.name)}: <strong>${label[pending.response]}</strong></p><p class="training-note">${html(pending.note||'No note')}</p><p>In joins the RSVP queue. Your captain confirms spots separately. Out and Maybe remove any captain confirmation. Your captain can see your note.</p><p role="status">${html(notice)}</p><button type="button" data-save ${busy||conflict?'disabled':''}>${busy?'Working...':attempted?'Retry same RSVP':'Save RSVP'}</button>${attempted?`<button type="button" class="secondary" data-check ${busy?'disabled':''}>Check saved reply</button>`:'<button type="button" class="secondary" data-edit>Edit reply</button>'}<button type="button" class="secondary" data-close ${busy?'disabled':''}>Close RSVP</button>`
 else {
  const focusNote=p?extractCaptainPracticeFocus(p.focus):''
  dialog.innerHTML=`<header class="player-practice-header">
   <h1 tabindex="-1">Team practices</h1>
   <button type="button" class="secondary" data-close aria-label="${html(backLabel)}" ${busy?'disabled':''}>Back</button>
   <p>${html([scope.teamName,scope.leagueName,scope.flight].filter(Boolean).join(' · '))}</p>
  </header>
  <p role="status">${html(notice)}</p>
  ${p?`${!invite&&!initialEventId?'<button type="button" class="secondary" data-list>Back to practices</button>':''}
   ${practiceBrief(p)}${practiceReplyPanel(p,note,busy)}
   ${focusNote?`<section class="player-practice-focus"><h3>Practice focus</h3><p class="training-note">${html(focusNote)}</p></section>`:''}`
   :data?`<div class="match-filters" role="group" aria-label="Practice dates">${(['upcoming','earlier','cancelled'] as const).map(v=>`<button type="button" class="secondary" data-section="${v}" aria-pressed="${section===v}">${v==='upcoming'?'Upcoming':v==='earlier'?'Earlier':'Cancelled'}</button>`).join('')}</div><p>Practices linked to your account in the latest 40 saved for this team.${data.more?' Older practices may not appear.':''}</p>${items.length?`<ul class="matches">${items.map(p=>`<li><h2>${html(p.title)}</h2><p>${html(formatCaptainPracticeDate(p.date))} · ${html(formatCaptainPracticeTimeRange(p.time,p.endTime)||'Time not set')}</p><p>${html(playerPracticeStatus(p))}</p><button type="button" class="secondary" data-practice="${html(p.id)}">Open practice<span class="sr-only"> ${html(p.title)}</span></button></li>`).join('')}</ul>`:'<p>No linked practices are shown for these dates. Ask your captain to check your linked player on the roster if an invitation is missing.</p>'}`:''}
  <button type="button" class="secondary" data-refresh ${busy?'disabled':''}>Refresh practices</button>`
 }
 dialog.querySelector('[data-close]')?.addEventListener('click',close);dialog.querySelector('[data-keep]')?.addEventListener('click',keepReply);dialog.querySelector('[data-discard]')?.addEventListener('click',discardReply);dialog.querySelector('[data-edit]')?.addEventListener('click',()=>{pending=null;notice='';render();focus()});dialog.querySelector('[data-save]')?.addEventListener('click',()=>{void send(false)});dialog.querySelector('[data-check]')?.addEventListener('click',()=>{void send(true)});dialog.querySelector('[data-refresh]')?.addEventListener('click',()=>leave('refresh'));dialog.querySelector('[data-list]')?.addEventListener('click',()=>leave('list'));dialog.querySelector<HTMLTextAreaElement>('[data-note]')?.addEventListener('input',e=>{note=(e.target as HTMLTextAreaElement).value});dialog.querySelectorAll<HTMLButtonElement>('[data-section]').forEach(b=>{b.onclick=()=>{section=b.dataset.section as typeof section;render();focus()}});dialog.querySelectorAll<HTMLButtonElement>('[data-practice]').forEach(b=>{b.onclick=()=>{selected=b.dataset.practice||'';note=data?.practices.find(p=>p.id===selected)?.mine.note||'';notice='';render();focus()}});dialog.querySelectorAll<HTMLButtonElement>('[data-response]').forEach(b=>{b.onclick=()=>{if(!p)return;try{pending=freezePlayerPracticeReply(p,b.dataset.response as PlayerPracticeReply['response'],note);attempted=false;conflict=false;notice='';render();focus()}catch{notice='Check your reply, then refresh this practice.';render();focus()}}})
 }
 dialog.oncancel=e=>{e.preventDefault();close()};document.body.append(dialog);dialog.showModal();void load();return {dispose,back:close,isOpen:()=>!disposed}
}
