import type {SupabaseClient} from '@supabase/supabase-js'
import type {ReviewedNextMatch} from '../../lib/team-fixtures-contract'
import {teamReplyLabels,type TeamMatchReplies} from '../../lib/team-match-replies-contract'
import {lineupReplyLabels} from '../../lib/team-match-lineup-contract'
import {html} from './html'
import {lineupConfirmationSummary} from './team-lineup-publication'
import {teamMatchRepliesRequest} from './team-match-replies-data'
import {teamNextMatchRequest,type TeamMatchRoom,type TeamNextMatchSchedule} from './team-room-data'
import './team-match-brief.css'

export function teamMatchBriefLineupHtml(replies:TeamMatchReplies|null,owner:string,captain:boolean){
 if(!replies)return '<p>Open Next match to check the team’s plan.</p>'
 const shared=replies.sharedLineup
 if(captain){
  if(!replies.lineupRoster)return '<p>Open Next match to check lineup access.</p>'
  if(!shared)return `<p>${replies.savedLineup?'Your private lineup is saved. Publish it when ready for your teammates.':'No court assignments published yet.'}</p>`
  const summary=lineupConfirmationSummary(replies)
  return `${summary.checked?`<p>${summary.confirmed} of ${summary.rows.length} assignments confirmed.</p>
   <dl class="chat-match-brief-counts"><div><dt>To confirm</dt><dd>${summary.awaiting}</dd></div><div><dt>Needs review</dt><dd>${summary.review}</dd></div></dl>`:
   '<p>Assignment confirmations could not be checked.</p>'}
   ${summary.unknown?`<p>${summary.unknown} ${summary.unknown===1?'assignment needs':'assignments need'} rechecking.</p>`:''}
   ${replies.savedLineup&&replies.savedLineup.version!==shared.version?'<p>Private edits are not published yet.</p>':''}`
 }
 const availability=replies.own?teamReplyLabels[replies.own.choice]:'Not replied'
 if(!shared)return `<p>Your availability · ${availability}</p><p>Your captain hasn’t published court assignments yet.</p>`
 let singles=0,doubles=0
 const own=shared.courts.map(court=>({court,label:court.format==='singles'?`Singles ${++singles}`:`Doubles ${++doubles}`}))
  .find(({court})=>court.players.includes(owner))
 if(!own)return '<p>You’re not assigned in the published lineup. Check with your captain.</p>'
 const status=replies.own?.choice==='out'?'You’re marked Out. Update availability if you can play.':
  replies.lineupReply?.version===shared.version?lineupReplyLabels[replies.lineupReply.choice]:'Confirm your assignment in Next match.'
 return `<p class="chat-match-brief-court"><strong>Your court · ${own.label}</strong>${own.court.format==='doubles'?
  `<span>Partner · ${own.court.players.filter(id=>id!==owner).map(id=>html(shared.names[id])).join(' &amp; ')}</span>`:''}</p><p>${status}</p>`
}

export function createTeamMatchBrief(client:SupabaseClient,owner:string,current:()=>boolean,matchHtml:(match:ReviewedNextMatch)=>string){
 let epoch=0,key='',room:TeamMatchRoom|null=null,root:HTMLDetailsElement|null=null
 let schedule:TeamNextMatchSchedule|null=null,replies:TeamMatchReplies|null=null,checkedAt:Date|null=null
 let state:'idle'|'loading'|'ready'|'error'='idle',notice='',opened=false,locked=false,disposed=false
 let openMatch:((trigger:HTMLButtonElement,publication:boolean)=>void)|null=null
 const active=()=>!disposed&&current()
 const paint=()=>{
  if(!active()||!root?.isConnected)return
  const body=root.querySelector<HTMLElement>('[data-match-brief-body]')!
  const detail=root.querySelector<HTMLElement>('summary small')!
  detail.textContent=schedule?.nextMatch?'vs '+schedule.nextMatch.opponent:'Time, court & lineup'
  body.innerHTML=state==='loading'?'<p role="status">Checking your next match…</p>':state==='error'?`<p role="status">${html(notice)}</p>`:
   state==='ready'?schedule?.nextMatch?`${matchHtml(schedule.nextMatch)}${teamMatchBriefLineupHtml(replies,owner,Boolean(room?.canScheduleMatch))}`:
    '<p>No upcoming match is scheduled.</p>':'<p>Check your next match and court assignments.</p>'
  root.querySelector<HTMLButtonElement>('[data-match-brief-open]')!.disabled=locked
  const recheck=root.querySelector<HTMLButtonElement>('[data-match-brief-recheck]')!
  recheck.disabled=state==='loading'||locked
  recheck.textContent=state==='loading'?'Checking…':state==='error'?'Retry match brief':'Recheck'
  root.querySelector<HTMLElement>('[data-match-brief-checked]')!.textContent=checkedAt?
   'Checked '+checkedAt.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):''
 }
 const reset=()=>{
  epoch++;key='';room=null;schedule=null;replies=null;checkedAt=null;state='idle';notice='';opened=false
  if(root)root.open=false
  paint()
 }
 const load=async()=>{
  if(!active()||!room||!root?.isConnected||state==='loading'||document.visibilityState!=='visible')return
  const version=++epoch,scope=key,selected={...room}
  const valid=()=>active()&&version===epoch&&key===scope&&document.visibilityState==='visible'
  state='loading';schedule=null;replies=null;checkedAt=null;notice='';paint()
  try{
   const latest=await teamNextMatchRequest(client,owner,valid,selected)
   if(!valid())return
   const response=selected.manualFixture&&latest.nextMatch&&latest.revision?
    await teamMatchRepliesRequest(client,owner,valid,selected,latest.revision):null
   if(!valid())return
   schedule=latest;replies=response;checkedAt=new Date();state='ready'
  }catch{
   if(!valid())return
   state='error';notice='Couldn’t check the match brief. Retry or open Next match.'
  }finally{if(valid())paint()}
 }
 const invalidate=()=>{
  epoch++;schedule=null;replies=null;checkedAt=null;state='idle';notice='';paint()
  if(opened)void load()
 }
 const onVisibility=()=>{
  if(document.visibilityState==='visible')return
  opened=false
  if(root)root.open=false
  invalidate()
 }
 document.addEventListener('visibilitychange',onVisibility)
 return {
  mount(host:HTMLElement,selected:TeamMatchRoom,isLocked:boolean,onOpen:(trigger:HTMLButtonElement,publication:boolean)=>void){
   const nextKey=JSON.stringify([selected.id,selected.teamName,selected.leagueName,selected.flight,Boolean(selected.manualFixture),Boolean(selected.canScheduleMatch)])
   if(nextKey!==key)reset()
   key=nextKey;room={...selected};locked=isLocked;openMatch=onOpen
   host.innerHTML=`<details class="chat-match-brief"><summary><span>Match brief</span><small>Time, court &amp; lineup</small><span aria-hidden="true">⌄</span></summary>
    <div class="chat-match-brief-content" role="region" aria-label="Team match brief"><div data-match-brief-body></div><div class="chat-match-brief-actions">
     <button type="button" class="secondary" data-match-brief-open aria-haspopup="dialog">Open match</button>
     <button type="button" class="secondary" data-match-brief-recheck>Recheck</button></div><p class="chat-match-brief-checked" data-match-brief-checked></p></div></details>`
   const details=host.querySelector<HTMLDetailsElement>('details')!
   root=details;details.open=opened;paint()
   details.ontoggle=()=>{
    if(!active()||root!==details||!details.isConnected)return
    opened=details.open
    if(opened&&state==='idle')void load()
   }
   details.querySelector<HTMLButtonElement>('[data-match-brief-open]')!.onclick=event=>{
    if(active()&&!locked)openMatch?.(event.currentTarget as HTMLButtonElement,Boolean(replies?.sharedLineup))
   }
   details.querySelector<HTMLButtonElement>('[data-match-brief-recheck]')!.onclick=()=>{if(!locked)void load()}
  },
  reset,invalidate,
  dispose(){disposed=true;epoch++;schedule=null;replies=null;room=null;root=null;openMatch=null;document.removeEventListener('visibilitychange',onVisibility)},
 }
}
