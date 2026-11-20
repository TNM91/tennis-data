import type {SupabaseClient} from '@supabase/supabase-js'
import {teamLeagueLabel} from '../../lib/private-team-contract'
import {eventCalendarStart,formatCalendarDay} from '../../lib/calendar-date'
import {readTeamNextMatchChange,type ReviewedNextMatch,type TeamNextMatchChange} from '../../lib/team-fixtures-contract'
import {maxTeamLineupCourts,readTeamLineupChange,type MatchLineupCourt,type TeamLineupChange,type TeamLineupReplyChange,type LineupReplyChoice} from '../../lib/team-match-lineup-contract'
import {isTeamMatchChoice,teamReplyLabels,type TeamMatchReplies,type TeamMatchReplyChange} from '../../lib/team-match-replies-contract'
import {todayDateKey} from '../../lib/team-room-match-flow'
import {html} from './match-details'
import {calendarMatchExport,calendarMatchVenueHref,shiftCalendarDay} from './calendar-data'
import {Browser} from './native-browser'
import {exportCoachFile} from './native-coach-files'
import {matchLineupFields,matchLineupMessage,plannedLineupHtml} from './team-match-lineup'
import {saveTeamLineupReplyRequest,saveTeamMatchLineupRequest,teamMatchRepliesRequest} from './team-match-replies-data'
import {teamNextMatchRequest,TeamNextMatchError,type TeamMatchRoom,type TeamNextMatchSchedule} from './team-room-data'
import type {TacticalBoardReference} from '../../lib/tactical/board-reference'
import {TacticsLibrary} from './coach-tactics-data'
import {openSharedTactics} from './shared-tactics-view'
import {ownSharedCourtHtml, teamMatchReadiness, teamReadinessHtml, type ReadinessAction, type TeamMatchSection} from './team-match-readiness'
import {availableLineupReserves,lineupConfirmationReminder,lineupPublicationHtml,lineupPublishPreviewHtml,setLineupResponseView,type LineupResponseView} from './team-lineup-publication'
import {lineupReplacementContext,lineupReplacementHtml,lineupReplacementTarget,replaceLineupPlayer,type LineupReplacementTarget} from './team-lineup-replacement'
import {captainMatchStatus} from './captain-match-status'
import {playerAssignmentSnapshot,playerAssignmentChanges,playerAssignmentUpdateHtml,type PlayerAssignmentUpdate} from './player-assignment-review'
import './team-match-readiness.css'

export function nextMatchTime(match:ReviewedNextMatch){
 const start=eventCalendarStart(match.date,match.time,match.timeZone)
 return start?new Intl.DateTimeFormat(undefined,{
  timeZone:match.timeZone,hour:'numeric',minute:'2-digit',timeZoneName:'short',
 }).format(start):''
}

export function teamNextMatchHtml(match:ReviewedNextMatch){
 return `<strong>vs ${html(match.opponent)}</strong>
  <p>${html(formatCalendarDay(match.date,false))} · ${html(nextMatchTime(match)||'Time to be confirmed')}</p>
  <p>${html(match.facility||'Court to be confirmed')}</p>`
}

const matchSlot=(match:ReviewedNextMatch)=>[
 formatCalendarDay(match.date,false),nextMatchTime(match)||'Time to be confirmed',match.facility||'Court to be confirmed',
].join(' · ')

function matchReplyRosterHtml(replies:TeamMatchReplies,expanded:boolean,canRemind:boolean){
 if(!replies.team)return ''
 const totals={in:0,maybe:0,out:0}
 for(const reply of replies.team)totals[reply.choice]++
 const counts:[number,string][]=Object.entries(teamReplyLabels).map(([choice,label])=>[totals[choice as keyof typeof totals],label])
 if(replies.awaiting)counts.push([replies.awaiting.length,'Awaiting'])
 const rows=[
  ...(replies.awaiting??[]).map(name=>({name,status:'Awaiting reply'})),
  ...replies.team.map(({name,choice})=>({name,status:teamReplyLabels[choice]})),
 ]
 return `<div class="team-match-reply-roster">
  <h4>Team availability</h4>
  <ul class="team-match-reply-counts" role="list" aria-label="Team availability totals">${counts.map(([count,label])=>
   `<li><strong>${count}</strong> <span>${label}</span></li>`).join('')}</ul>
  ${replies.rosterComplete===false?'<p>Counts cover the teammates shown here.</p>':''}
  <details data-match-reply-roster ${expanded?'open':''}><summary>View teammates</summary>
   ${rows.length?`<ul role="list" aria-label="Teammate availability">${rows.map(({name,status})=>
    `<li><strong>${html(name)}</strong><span>${status}</span></li>`).join('')}</ul>`:'<p>Teammate availability will appear here.</p>'}
  </details>
  ${canRemind?'<button type="button" class="secondary" data-draft-match-reminder>Draft team reminder</button>':''}
 </div>`
}

function matchRepliesHtml(replies:TeamMatchReplies,busy:boolean,pending:boolean,expanded:boolean,canRemind:boolean){
 const choices=Object.entries(teamReplyLabels)
 return `<section class="team-match-replies" aria-labelledby="team-match-replies-title">
  <h3 id="team-match-replies-title" tabindex="-1">Can you play?</h3>
  <div class="team-match-reply-actions">${choices.map(([choice,label])=>
   `<button type="button" class="secondary" data-match-reply="${choice}" aria-pressed="${replies.own?.choice===choice}" ${busy||pending?'disabled':''}>${label}</button>`).join('')}</div>
  ${matchReplyRosterHtml(replies,expanded,canRemind)}
 </section>`
}

export function openTeamNextMatch(client:SupabaseClient,owner:string,room:TeamMatchRoom,current:()=>boolean,
 onClose:(changed:boolean,message?:string,kind?:'lineup'|'schedule')=>void,canDraftUpdate:()=>boolean,
 {previousMatch,calendarSchedule,openResults,focusSection}:{
  previousMatch?:ReviewedNextMatch;calendarSchedule?:TeamNextMatchSchedule;openResults?:()=>void;focusSection?:TeamMatchSection
 }={}){
 const dialog=document.createElement('dialog')
 dialog.className='team-invite-dialog team-next-match-dialog'
 dialog.setAttribute('aria-label','Next match')
 document.body.append(dialog)
 const localZone=Intl.DateTimeFormat().resolvedOptions().timeZone
 let disposed=false,busy=false,changed=false,notice='',removing=false
 let schedule:TeamNextMatchSchedule|null=null,draft:ReviewedNextMatch|null=null,pending:TeamNextMatchChange|null=null
 let replies:TeamMatchReplies|null=null,pendingReply:TeamMatchReplyChange|null=null
 let lineup:MatchLineupCourt[]|null=null
 let replacementTarget:LineupReplacementTarget|null=null
 let pendingLineup:TeamLineupChange|null=null,lineupConflict=false
 let publicationReview:TeamLineupChange|null=null,confirmationReview:TeamLineupReplyChange|null=null,pendingConfirmation:TeamLineupReplyChange|null=null
 let assignmentUpdate:PlayerAssignmentUpdate|null=null
 let returnFromOwnAvailability=false
 let previousSlot:ReviewedNextMatch|null=null
 let scheduleAnnouncement:{revision:string;previous:ReviewedNextMatch}|null=null
 let rosterExpanded=false
 let responseView:LineupResponseView='attention'
 let responseViewRevision:string|null=null
 let entrySection=focusSection
 let readinessReturn: 'time'|'venue'|'lineup'|'confirmations'|null=null
 let tacticsChoice:TacticalBoardReference|null|undefined
 let boardOptions:{name:string;reference:TacticalBoardReference}[]|undefined
 let tacticsViewer:ReturnType<typeof openSharedTactics>|null=null
 let editingDirty=false,leavePrompt:HTMLDialogElement|null=null
 const active=()=>!disposed&&current()
 const dispose=()=>{disposed=true;leavePrompt?.remove();leavePrompt=null;tacticsViewer?.dispose();dialog.remove()}
 const returnToMatch=()=>{
  const source=readinessReturn
  draft=null;lineup=null;replacementTarget=null;publicationReview=null;confirmationReview=null;editingDirty=false;readinessReturn=null;notice='';render()
  focus(source==='confirmations'?'.team-lineup-publication h3':source?`[data-readiness-action="${source}"]`:'h2')
 }
 const close=()=>{
  if(!active()){dispose();return}
  if(tacticsViewer?.isOpen()){tacticsViewer.dispose();return}
  if(leavePrompt){leavePrompt.querySelector<HTMLButtonElement>('[data-keep]')?.click();return}
  if(busy)return
  if(pending||pendingReply||pendingLineup||pendingConfirmation){notice='Retry the same change or reload the match to check whether it saved.';render();focusFeedback();return}
  if(replacementTarget){cancelReplacement();return}
  if(confirmationReview){confirmationReview=null;notice='';render();focus('.team-lineup-publication h3');return}
  if(publicationReview){publicationReview=null;notice='';render();focus('[data-review-publication]');return}
  if((draft||lineup)&&editingDirty){
   const previous=document.activeElement instanceof HTMLElement?document.activeElement:null
   const prompt=document.createElement('dialog');leavePrompt=prompt
   prompt.className='team-invite-dialog team-readiness-discard';prompt.setAttribute('aria-label','Keep match edits')
   prompt.innerHTML='<h2>Keep your edits?</h2><p>Your unsaved match details or court assignments will be discarded.</p><button type="button" data-keep>Keep editing</button><button type="button" class="secondary" data-discard>Discard edits and return to match</button>'
   const keep=()=>{prompt.remove();leavePrompt=null;if(active()&&previous?.isConnected)previous.focus({preventScroll:true})}
   prompt.querySelector<HTMLButtonElement>('[data-keep]')!.onclick=keep
   prompt.querySelector<HTMLButtonElement>('[data-discard]')!.onclick=()=>{prompt.remove();leavePrompt=null;if(active())returnToMatch()}
   prompt.oncancel=event=>{event.preventDefault();keep()}
   dialog.append(prompt);prompt.showModal();prompt.querySelector<HTMLButtonElement>('[data-keep]')!.focus();return
  }
  if(draft||lineup){returnToMatch();return}
  dispose();onClose(changed)
 }
 const focus=(target='h2')=>(dialog.querySelector<HTMLElement>(target)??dialog.querySelector<HTMLElement>('h2'))?.focus({preventScroll:true})
 const focusFeedback=()=>dialog.querySelector<HTMLElement>('[role="status"]')?.focus()
 const cancelReplacement=()=>{
  const target=replacementTarget
  replacementTarget=null;notice='';render()
  focus(target?`[data-match-lineup-player="${target.court}:${target.slot}"]`:'[data-match-lineup] h3')
 }
 const captain=room.manualFixture&&room.canScheduleMatch
 let startNew=Boolean(captain&&previousMatch)
 const blankMatch=():ReviewedNextMatch=>({opponent:'',date:'',time:'',timeZone:localZone,facility:''})
 const refreshReplies=async(snapshot:TeamNextMatchSchedule)=>{
  replies=null
  if(!room.manualFixture||!snapshot.nextMatch||!snapshot.revision||!active())return
  try{replies=await teamMatchRepliesRequest(client,owner,active,room,snapshot.revision)}
  catch(cause){notice=cause instanceof TeamNextMatchError?cause.message:'Availability couldn’t load. Reload the match.';return cause instanceof Error?cause:new Error(notice)}
  return null
 }
 const reviewScheduleChange=(before:TeamNextMatchSchedule|undefined,latest:TeamNextMatchSchedule)=>{
  if(!before?.nextMatch||(before.revision===latest.revision&&latest.nextMatch))return
  changed=true
  previousSlot=latest.nextMatch?before.nextMatch:null
  notice=latest.nextMatch?'The team schedule changed. Review the latest match.':'This match is no longer upcoming.'
 }
 const enterFromBrief=()=>{
  const section=entrySection;entrySection=undefined
  if(!schedule?.nextMatch)return 'h2'
  if(section==='time'||section==='venue'||section==='lineup'){
   if(!captain||!replies?.lineupRoster){notice='Captain access could not be confirmed. Review the match before editing.';return '[role="status"]'}
   if(section==='lineup'){
    if(!replies.savedLineup&&!replies.lineupRoster.some(player=>player.choice!=='out')){
     notice='Availability changed. Review the latest replies before planning.';return '[role="status"]'
    }
    lineup=structuredClone(replies.savedLineup?.courts??[]);readinessReturn='confirmations'
    return '[data-match-lineup] h3'
   }
   if(section==='time'?schedule.nextMatch.time:schedule.nextMatch.facility){
    notice=section==='time'?'The start time is already set. Review the latest match.':'The venue is already set. Review the latest match.'
    return '[role="status"]'
   }
   draft={...schedule.nextMatch};readinessReturn=section
   return section==='time'?'[name="time"]':'[name="facility"]'
  }
  if(section==='availability'&&replies)return '#team-match-replies-title'
  return section==='publication'?'.team-lineup-publication h3':'h2'
 }
 const load=async()=>{
  if(busy||!active())return
  const before=schedule??calendarSchedule
  busy=true;pending=null;pendingReply=null;pendingLineup=null;lineupConflict=false;lineup=null;replacementTarget=null;editingDirty=false
  publicationReview=null;confirmationReview=null;pendingConfirmation=null;assignmentUpdate=null;returnFromOwnAvailability=false
  tacticsChoice=undefined;boardOptions=undefined
  replies=null;draft=null;removing=false;schedule=null;notice='Loading your next match…';render()
  try{
   schedule=await teamNextMatchRequest(client,owner,active,room);notice=''
   reviewScheduleChange(before,schedule)
   if(startNew){
    startNew=false
    if(schedule.nextMatch)notice='Your next match is already scheduled.'
    else draft=blankMatch()
   }
   await refreshReplies(schedule)
  }
  catch(cause){notice=cause instanceof TeamNextMatchError?cause.message:'Couldn’t load the next match. Try again.'}
  finally{if(active()){
   busy=false
   const fromBrief=Boolean(entrySection)
   const target=draft?'[name="opponent"]':notice?'[role="status"]':enterFromBrief()
   render()
   focus(target)
   if(fromBrief)dialog.querySelector<HTMLElement>(target)?.scrollIntoView({block:'start'})
  }}
 }
 const save=async(change:TeamNextMatchChange)=>{
  if(busy||!active())return
  const before=schedule?.nextMatch
  busy=true;pending=change;notice='Saving the team schedule…';render()
  try{
   schedule=await teamNextMatchRequest(client,owner,active,room,change)
   changed=true;pending=null;draft=null;removing=false;editingDirty=false;readinessReturn=null
   previousSlot=change.nextMatch&&before?before:null
   scheduleAnnouncement=previousSlot&&schedule.revision?{revision:schedule.revision,previous:previousSlot}:null
   notice=change.nextMatch?(before?'Match updated. Teammates need to reply again.':'Match shared with your team.'):'Match removed from the team schedule.'
   await refreshReplies(schedule)
  }catch(cause){
   notice=cause instanceof TeamNextMatchError?cause.message:'The save could not be confirmed. Retry the same change.'
   if(cause instanceof TeamNextMatchError&&!cause.uncertain){
    pending=null;removing=false
    if(cause.status===400)draft=change.nextMatch
    else{draft=null;schedule=null}
   }
  }finally{if(active()){busy=false;render();focus('[role="status"]')}}
 }
 const reply=async(change:TeamMatchReplyChange)=>{
  if(busy||!active()||!schedule)return
  const before=playerAssignmentSnapshot(schedule,replies,owner)
  const refreshContext=Boolean(replies?.team||replies?.sharedLineup||returnFromOwnAvailability)
  let assignmentReady=false,matchChanged=false
  busy=true;pendingReply=change;notice='Saving your reply…';render()
  try{
   const result=await teamMatchRepliesRequest(client,owner,active,room,change.revision,change)
   if(!active())return
   replies=result;pendingReply=null;changed=true;notice='Your reply is saved.'
   const refreshError=refreshContext?await refreshReplies(schedule):null
   if(!active())return
   if(refreshError){
    if(refreshError instanceof TeamNextMatchError&&refreshError.status===409){
     try{
      schedule=await teamNextMatchRequest(client,owner,active,room)
      if(!active())return
      const error=await refreshReplies(schedule)
      if(!active())return
      if(error)throw error
      assignmentUpdate={before,after:playerAssignmentSnapshot(schedule,replies,owner)};matchChanged=true
      notice='The match changed after your reply. Review the latest details and availability.'
     }catch{schedule=null;replies=null;assignmentUpdate=null;notice='Your reply was saved. Reload to check the latest match.'}
    }else{
     replies=refreshError instanceof TeamNextMatchError&&refreshError.status===403?null:result
     if(!replies)schedule=null
     assignmentUpdate=null;notice='Your reply is saved. Reload the match to check your current assignment.'
    }
   }else if(replies?.sharedLineup){
    const after=playerAssignmentSnapshot(schedule,replies,owner)
    if(before.version!==after.version){assignmentUpdate={before,after};matchChanged=true;notice='Your reply is saved. The published lineup changed; review your current assignment.'}
    else{
     if(assignmentUpdate)assignmentUpdate={...assignmentUpdate,after}
     assignmentReady=replies.own?.choice==='in'&&Boolean(after.court)&&(!captain||returnFromOwnAvailability)
     if(assignmentReady)notice='Your reply is saved. Review your current court assignment next.'
    }
   }
   returnFromOwnAvailability=false
  }catch(cause){
   notice=cause instanceof TeamNextMatchError?cause.message:'Your reply could not be confirmed. Retry the same reply.'
   if(cause instanceof TeamNextMatchError&&!cause.uncertain){
    pendingReply=null;replies=null
    if(cause.status===409){
     const before=schedule
     try{
      schedule=await teamNextMatchRequest(client,owner,active,room)
      notice='Your reply changed. Review the latest reply.'
      reviewScheduleChange(before??undefined,schedule)
      await refreshReplies(schedule)
     }catch{
      schedule=null;notice='Couldn’t check the latest match. Reload the match.'
     }
    }
   }
  }finally{if(active()){
   busy=false;render()
   const target=matchChanged?'.team-assignment-updates h3':assignmentReady?'.team-lineup-publication h3':null
   if(target){focus(target);dialog.querySelector<HTMLElement>(matchChanged?'.team-assignment-updates':target)?.scrollIntoView({block:'start'})}
   else focusFeedback()
  }}
 }
 const draftAvailabilityMessage=async(kind:'reminder'|'schedule')=>{
  if(!active()||!captain||busy||pendingReply||!schedule?.nextMatch||!schedule.revision)return
  const {nextMatch,revision}=schedule
  const previous=kind==='schedule'&&scheduleAnnouncement?.revision===revision?scheduleAnnouncement.previous:null
  if(kind==='schedule'?!previous:!replies?.awaitingTeammates)return
  const draftNotice=kind==='schedule'?'Finish your current chat draft before drafting a schedule update.':'Finish your current chat draft before drafting a reminder.'
  if(!canDraftUpdate()){notice=draftNotice;render();focusFeedback();return}
  busy=true;notice='Checking the latest replies…';render()
  try{
   const latest=await teamMatchRepliesRequest(client,owner,active,room,revision)
   if(!active())return
   replies=latest
   if(!latest.team){notice='Captain access is required to draft a team update.';return}
   if(!previous&&!latest.awaitingTeammates){
    notice=latest.rosterComplete?'Your teammates have replied.':'The teammates shown here have replied.'
    return
   }
   if(!canDraftUpdate()){notice=draftNotice;return}
   const time=nextMatchTime(nextMatch)
   const when=formatCalendarDay(nextMatch.date,false)+(time?' at '+time:'')
   const where=nextMatch.facility?' ('+nextMatch.facility+')':''
   const message=previous
    ?`Match update vs ${nextMatch.opponent}\nPreviously · ${matchSlot(previous)}\nNow · ${matchSlot(nextMatch)}\nPlease open Team → Next match and confirm whether you can play.`
    :`Quick availability check for our match vs ${nextMatch.opponent} on ${when}${where}. If you haven’t replied yet, open Team → Next match and tap In, Maybe, or Out.`
   dispose()
   onClose(changed,message,previous?'schedule':undefined)
  }catch(cause){
   notice=cause instanceof TeamNextMatchError?cause.message:'Couldn’t check the latest replies. Reload the match.'
  }finally{if(active()){busy=false;render();focus('[role="status"]')}}
 }
 const draftLineup=async()=>{
  const roster=replies?.lineupRoster,match=schedule?.nextMatch,revision=schedule?.revision
  if(!active()||!captain||busy||pendingReply||pendingLineup||!lineup?.length||!roster||!match||!revision)return
  const draftNotice='Finish your current chat draft before drafting a lineup.'
  if(!canDraftUpdate()){notice=draftNotice;render();focusFeedback();return}
  const when=formatCalendarDay(match.date,false)
  const time=nextMatchTime(match)
  const matchLabel=`our match vs ${match.opponent} on ${when}${time?' at '+time:''}${match.facility?' ('+match.facility+')':''}`
  let reviewedMessage:string
  try{reviewedMessage=matchLineupMessage(lineup,roster,matchLabel)}
  catch(cause){notice=cause instanceof Error?cause.message:'Check the court assignments.';render();focusFeedback();return}
  busy=true;notice='Checking the latest replies…';render()
  try{
   const latest=await teamMatchRepliesRequest(client,owner,active,room,revision)
   if(!active())return
   replies=latest
   if(!latest.lineupRoster){notice='Captain access is required to draft a lineup.';return}
   const currentChoices=new Map(latest.lineupRoster.map(player=>[player.id,player.choice]))
   const previousChoices=new Map(roster.map(player=>[player.id,player.choice]))
   const lineupChanged=lineup.some(court=>court.players.some(id=>currentChoices.get(id)!==previousChoices.get(id)))
   if(lineupChanged||matchLineupMessage(lineup,latest.lineupRoster,matchLabel)!==reviewedMessage){
    notice='Availability or roster details changed. Review your picks before drafting.';return
   }
   if(!canDraftUpdate()){notice=draftNotice;return}
   dispose();onClose(changed,reviewedMessage,'lineup')
  }catch(cause){
   notice=cause instanceof TeamNextMatchError?cause.message:'Couldn’t check the latest lineup. Try again.'
  }finally{if(active()){busy=false;render();focusFeedback()}}
 }
 const reviewPublication=async()=>{
  if(!active()||!captain||busy||pendingLineup||lineupConflict||!lineup||!schedule?.revision||!replies?.lineupRoster)return
  const change=readTeamLineupChange({revision:schedule.revision,expected:replies.savedLineup?.version??null,
   version:crypto.randomUUID(),courts:structuredClone(lineup),tactics:tacticsChoice,publish:true})
  if(!change){notice='Fill every court and choose each teammate only once.';render();focusFeedback();return}
  const previous=new Map(replies.lineupRoster.map(player=>[player.id,player.choice]))
  busy=true;notice='Checking the latest court assignments and availability…';render()
  try{
   const latest=await teamMatchRepliesRequest(client,owner,active,room,change.revision)
   if(!active())return
   replies=latest
   if((latest.savedLineup?.version??null)!==change.expected){lineupConflict=true;notice='Another captain updated the draft. Reload the match before publishing.';return}
   const roster=latest.lineupRoster
   if(!roster){lineupConflict=true;notice='Captain access could not be confirmed. Reload the match.';return}
   const current=new Map(roster.map(player=>[player.id,player.choice]))
   if(change.courts.some(court=>court.players.some(id=>!current.has(id)||current.get(id)==='out'||current.get(id)!==previous.get(id)))){
    notice='Availability or roster details changed. Review your picks before publishing.';return
   }
   publicationReview=change;notice=''
  }catch(cause){notice=cause instanceof TeamNextMatchError?cause.message:'Couldn’t check the lineup. Reload the match.'}
  finally{if(active()){busy=false;render();if(publicationReview)dialog.scrollTop=0;focus(publicationReview?'.team-lineup-publish-preview h3':'[role="status"]')}}
 }
 const reviewConfirmation=async(choice:LineupReplyChoice)=>{
  if(!active()||busy||pendingConfirmation||!schedule?.revision||!replies?.sharedLineup)return
  const before=playerAssignmentSnapshot(schedule,replies,owner)
  const version=replies.sharedLineup.version,expected=replies.lineupReply?.id??null
  let assignmentChanged=false
  busy=true;notice='Checking your current assignment…';render()
  try{
   const latestSchedule=await teamNextMatchRequest(client,owner,active,room)
   if(!active())return
   const latest=latestSchedule.revision&&latestSchedule.nextMatch?await teamMatchRepliesRequest(client,owner,active,room,latestSchedule.revision):null
   if(!active())return
   const update={before,after:playerAssignmentSnapshot(latestSchedule,latest,owner)}
   schedule=latestSchedule;replies=latest
   if(before.revision!==schedule.revision||latest?.sharedLineup?.version!==version||(latest?.lineupReply?.id??null)!==expected||playerAssignmentChanges(update,nextMatchTime).length){
    changed=true;assignmentChanged=true;assignmentUpdate=update;notice='The match or your assignment changed. Review the latest details before responding.';return
   }
   if(!latest?.sharedLineup||!schedule.revision)return
   if(!Object.hasOwn(latest.sharedLineup.names,owner)||choice==='confirmed'&&latest.own?.choice==='out'){
    notice='Check your current assignment and match availability before confirming.';return
   }
   confirmationReview={revision:schedule.revision,version,id:crypto.randomUUID(),expected,choice};notice=''
  }catch(cause){
   if(cause instanceof TeamNextMatchError&&cause.status===403){schedule=null;replies=null;assignmentUpdate=null}
   notice=cause instanceof TeamNextMatchError?cause.message:'Couldn’t check your assignment. Reload the match.'
  }
  finally{if(active()){
   busy=false;render();if(confirmationReview)dialog.scrollTop=0
   if(confirmationReview||assignmentChanged)focus(confirmationReview?'[data-confirmation-heading]':'.team-assignment-updates h3')
   else focusFeedback()
   if(confirmationReview)dialog.querySelector<HTMLElement>('[data-confirmation-heading]')?.scrollIntoView({block:'start'})
   if(assignmentChanged&&!confirmationReview)dialog.querySelector<HTMLElement>('.team-assignment-updates')?.scrollIntoView({block:'start'})
  }}
 }
 const confirmAssignment=async()=>{
  const change=pendingConfirmation??confirmationReview
  if(!active()||busy||!change||!schedule)return
  const before=playerAssignmentSnapshot(schedule,replies,owner)
  busy=true;pendingConfirmation=change;notice='Saving your lineup response…';render()
  try{
   await saveTeamLineupReplyRequest(client,owner,active,room,change)
   if(!active())return
   changed=true;pendingConfirmation=null;confirmationReview=null;assignmentUpdate=null
   notice=change.choice==='confirmed'?'Your assignment is confirmed.':'Your captain can see your change request.'
   await refreshReplies(schedule)
  }catch(cause){
   notice=cause instanceof TeamNextMatchError?cause.message:'Your confirmation could not be confirmed. Retry the same confirmation.'
   if(cause instanceof TeamNextMatchError&&!cause.uncertain){
    pendingConfirmation=null;confirmationReview=null;replies=null;assignmentUpdate=null
    if(cause.status===409){
     try{
      const latestSchedule=await teamNextMatchRequest(client,owner,active,room)
      if(!active())return
      const latest=latestSchedule.nextMatch&&latestSchedule.revision?await teamMatchRepliesRequest(client,owner,active,room,latestSchedule.revision):null
      if(!active())return
      schedule=latestSchedule;replies=latest;changed=true
      assignmentUpdate={before,after:playerAssignmentSnapshot(schedule,replies,owner)}
      notice='The match, published lineup, or your reply changed. Review the latest details before responding.'
     }catch{schedule=null;notice='Couldn’t check the latest match. Reload before responding.'}
    }else if(cause.status===403)schedule=null
   }
  }finally{if(active()){
   busy=false;render();if(assignmentUpdate)focus('.team-assignment-updates h3');else focusFeedback()
   if(assignmentUpdate)dialog.querySelector<HTMLElement>('.team-assignment-updates')?.scrollIntoView({block:'start'})
  }}
 }
 const draftPublishedLineup=async()=>{
  if(!active()||!captain||busy||!schedule?.revision||!schedule.nextMatch||!replies?.sharedLineup)return
  if(!canDraftUpdate()){notice='Finish your current chat draft before drafting a lineup update.';render();focusFeedback();return}
  const version=replies.sharedLineup.version,match=schedule.nextMatch
  busy=true;notice='Checking the published lineup…';render()
  try{
   const latest=await teamMatchRepliesRequest(client,owner,active,room,schedule.revision)
   if(!active())return
   replies=latest
   if(latest.sharedLineup?.version!==version||!latest.lineupRoster){notice='The published lineup changed. Review the latest plan.';return}
   const when=formatCalendarDay(match.date,false),time=nextMatchTime(match)
   const message=matchLineupMessage(latest.sharedLineup.courts,latest.lineupRoster,
    `our match vs ${match.opponent} on ${when}${time?' at '+time:''}${match.facility?' ('+match.facility+')':''}`)+
    '\n\nOpen Team → Next match to confirm your assignment or request a change.'
   if(message.length>2400){notice='This published lineup is too long for one chat message.';return}
   if(!canDraftUpdate()){notice='Finish your current chat draft before drafting a lineup update.';return}
   dispose();onClose(changed,message,'lineup')
  }catch(cause){notice=cause instanceof Error?cause.message:'Couldn’t check the published lineup. Reload the match.'}
  finally{if(active()){busy=false;render();focusFeedback()}}
 }
 const draftConfirmationReminder=async()=>{
  if(!active()||!captain||busy||pending||pendingReply||pendingLineup||pendingConfirmation||!schedule?.revision||!schedule.nextMatch||!replies?.sharedLineup)return
  const draftNotice='Finish your current chat draft before drafting a confirmation reminder.'
  if(!canDraftUpdate()){notice=draftNotice;render();focusFeedback();return}
  const version=replies.sharedLineup.version,{revision,nextMatch:match}=schedule
  busy=true;notice='Checking assignment confirmations…';render()
  try{
   const latest=await teamMatchRepliesRequest(client,owner,active,room,revision)
   if(!active())return
   replies=latest
   if(latest.sharedLineup?.version!==version){notice='The published lineup changed. Review the latest assignments before reminding your team.';return}
   const time=nextMatchTime(match)
   const message=lineupConfirmationReminder(latest,`our match vs ${match.opponent} on ${formatCalendarDay(match.date,false)}${time?' at '+time:''}${match.facility?' ('+match.facility+')':''}`)
   if(!message){notice='No checked assignments are awaiting confirmation. Review any remaining changes.';return}
   if(!canDraftUpdate()){notice=draftNotice;return}
   dispose();onClose(changed,message,'lineup')
  }catch(cause){notice=cause instanceof Error?cause.message:'Couldn’t check the assignment responses. Reload the match.'}
  finally{if(active()){busy=false;render();focusFeedback()}}
 }
 const saveLineup=async(publish=false)=>{
  const revision=schedule?.revision,roster=replies?.lineupRoster
  if(!active()||!captain||busy||lineupConflict||!lineup||!revision||!roster)return
  const change=pendingLineup??(publish?publicationReview:readTeamLineupChange({revision,expected:replies?.savedLineup?.version??null,
   version:crypto.randomUUID(),courts:structuredClone(lineup),tactics:tacticsChoice,publish:false}))
  if(!change){notice='Fill every court and choose each teammate only once.';render();focusFeedback();return}
  const eligible=new Set(roster.filter(player=>player.choice!=='out').map(player=>player.id))
  if(!pendingLineup&&change.courts.some(court=>court.players.some(id=>!eligible.has(id)))){
   notice='Replace unavailable players before saving.';render();focusFeedback();return
  }
  busy=true;pendingLineup=change;notice='Saving your lineup…';render()
  try{
   const result=await saveTeamMatchLineupRequest(client,owner,active,room,change)
   if(!active()||!replies)return
   replies={...replies,...result};changed=true;pendingLineup=null;lineup=null;publicationReview=null;editingDirty=false;readinessReturn=null
   notice=change.publish?'Lineup published. Assigned players can confirm in Next match.':'Private lineup saved. Your published lineup is unchanged.'
   if(schedule)await refreshReplies(schedule)
  }catch(cause){
   notice=cause instanceof TeamNextMatchError?cause.message:'The lineup save could not be confirmed. Retry the same lineup.'
   if(cause instanceof TeamNextMatchError&&!cause.uncertain){pendingLineup=null;publicationReview=null;lineupConflict=true}
  }finally{if(active()){busy=false;render();focusFeedback()}}
 }
 const chooseReplacement=async(player:string)=>{
  if(!active()||!captain||busy||pending||pendingReply||pendingLineup||lineupConflict||!lineup||!replacementTarget||!schedule?.revision||!replies?.lineupRoster)return
  const target={...replacementTarget},revision=schedule.revision,version=replies.savedLineup?.version??null
  busy=true;notice='Checking availability before changing this court…';render()
  try{
   const latest=await teamMatchRepliesRequest(client,owner,active,room,revision)
   if(!active())return
   replies=latest
   if(!latest.lineupRoster){lineupConflict=true;replacementTarget=null;notice='Captain access could not be confirmed. Reload the match.';return}
   if((latest.savedLineup?.version??null)!==version){lineupConflict=true;replacementTarget=null;notice='Another captain updated the private lineup. Reload the match before replacing a player.';return}
   const context=lineupReplacementContext(lineup,latest.lineupRoster,target)
   const candidate=context?.candidates.find(candidate=>candidate.id===player)
   lineup=replaceLineupPlayer(lineup,latest.lineupRoster,target,player)
   replacementTarget=null;editingDirty=true
   notice=`${candidate!.name} selected for ${context!.label}. Review and publish when you’re ready.`
  }catch(cause){
   if(cause instanceof TeamNextMatchError){
    if(cause.status===409||cause.status===403){lineupConflict=true;replacementTarget=null;notice=cause.message}
    else notice='Couldn’t check availability. Choose a teammate again to retry.'
   }else notice=cause instanceof Error?cause.message:'Couldn’t check availability. Choose a teammate again to retry.'
  }
  finally{if(active()){busy=false;render();focusFeedback()}}
 }
 async function chooseTactics() {
  if (!active() || !captain || !lineup || busy || pendingLineup) return
  busy=true;notice='Loading saved boards…';render()
  try {
   const {scenarios}=await new TacticsLibrary(client,owner,active).load()
   if (!active()) return
   boardOptions=scenarios.map(board=>({name:board.name,reference:{id:board.id,updatedAt:board.updatedAt}}))
   notice=boardOptions.length?'':'Save a board in Tactics before attaching it.'
  } catch { if(active())notice='Saved boards couldn’t load. Try again.' }
  finally { if(active()){busy=false;render();focus(boardOptions?.length?'[data-tactics-choice]':'[role=status]')} }
 }
 const openMatchAction=async(action:'maps'|'calendar')=>{
  if(!active()||busy||pendingReply||!schedule?.nextMatch)return
  const shown=schedule
  busy=true;notice=action==='maps'?'Checking the latest venue…':'Checking the match before sharing…';render()
  try{
   const latest=await teamNextMatchRequest(client,owner,active,room)
   if(!active())return
   if(!latest.nextMatch||latest.revision!==shown.revision||JSON.stringify(latest.nextMatch)!==JSON.stringify(shown.nextMatch)){
    schedule=latest
    reviewScheduleChange(shown,latest)
    await refreshReplies(latest)
    notice=action==='maps'
     ?latest.nextMatch?'The match changed. Review the updated venue.':'There’s no upcoming match.'
     :latest.nextMatch?'The match changed. Review the updated details before sharing.':'There’s no upcoming match to export.'
    return
   }
   const match=latest.nextMatch
   if(action==='maps'){
    const url=calendarMatchVenueHref({location:match.facility})
    if(!url){notice='The venue is still to be confirmed.';return}
    notice=''
    try{await Browser.open({url})}
    catch{notice='Couldn’t open Apple Maps. Try again.'}
    return
   }
   const fingerprint=new TextEncoder().encode(JSON.stringify([room.id,match.date,match.opponent]))
   const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',fingerprint))
   const key='team-match-'+Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('')
   const ics=calendarMatchExport({
    key,title:room.teamName+' vs '+match.opponent,date:match.date,time:match.time,location:match.facility,
   },match.timeZone,{allowDateOnly:true})
   if(!ics){notice='The match start time is invalid in the venue time zone.';return}
   await exportCoachFile(owner,active,new Blob([ics],{type:'text/calendar'}),'TenAceIQ-team-match.ics')
   if(active())notice='Calendar file prepared. Add it to your preferred calendar.'
  }catch{
   if(active())notice=action==='maps'?'Couldn’t check the latest venue. Try again.':'Couldn’t share the calendar file. Try again.'
  }finally{if(active()){busy=false;render();focus(notice?'[role="status"]':'[data-open-match-maps]')}}
 }
 const render=()=>{
  if(!active())return
  if(schedule?.revision&&schedule.revision!==responseViewRevision){responseView='attention';responseViewRevision=schedule.revision}
  const zones=draft?[...new Set([draft.timeZone,localZone,'America/New_York','America/Chicago','America/Denver','America/Phoenix','America/Los_Angeles','America/Anchorage','Pacific/Honolulu'])]:[]
  const reusableVenue=draft&&!schedule?.nextMatch&&previousMatch?.facility?previousMatch:null
  const reusableTime=draft&&!schedule?.nextMatch?previousMatch?.time:''
  const mapsUrl=schedule?.nextMatch&&calendarMatchVenueHref({location:schedule.nextMatch.facility})
  const savedTactics=replies?.savedLineup?.tactics
  const shared=replies?.sharedLineup
  const boardChoice=tacticsChoice===undefined?savedTactics?.reference:tacticsChoice
  const boardIndex=boardChoice?boardOptions?.findIndex(item=>item.reference.id===boardChoice.id&&item.reference.updatedAt===boardChoice.updatedAt)??-1:-1
  const boardChoiceName=boardIndex>=0?boardOptions?.[boardIndex].name:tacticsChoice===undefined?savedTactics?.board.name:undefined
  const reserves=lineup&&replies?.lineupRoster?availableLineupReserves(lineup,replies.lineupRoster):[]
  const savedCourts=replies?.savedLineup?.courts
  const readinessCourts=shared?.courts??savedCourts
  const readiness=teamMatchReadiness(readinessCourts,replies)
  const matchStatus=captainMatchStatus(schedule,replies)
  const readinessActions:ReadinessAction[]=[]
  if(captain&&schedule?.nextMatch&&!busy&&!pendingReply&&!pendingLineup){
   if(matchStatus.next)readinessActions.push(matchStatus.next)
   if(!schedule.nextMatch.time)readinessActions.push({key:'time',label:'Set the start time'})
   if(!schedule.nextMatch.facility)readinessActions.push({key:'venue',label:'Add the venue'})
   if(!replies||!replies.lineupRoster)readinessActions.push({key:'reload',label:'Recheck availability'})
   else {
    if(shared&&replies.savedLineup&&shared.version!==replies.savedLineup.version)readinessActions.push({key:'lineup',label:'Review private lineup'})
    else if(readiness.attention.length)readinessActions.push({key:'lineup',label:'Review assigned players'})
    if(readiness.awaiting)readinessActions.push({key:'availability',label:'Review unanswered replies'})
    if(!readiness.hasLineup&&replies.lineupRoster.some(player=>player.choice!=='out'))readinessActions.push({key:'lineup',label:'Add court assignments'})
   }
  }
  const uniqueReadinessActions=readinessActions.filter((action,index)=>readinessActions.findIndex(other=>other.key===action.key)===index)
  if(reusableVenue&&!zones.includes(reusableVenue.timeZone))zones.push(reusableVenue.timeZone)
  dialog.innerHTML=`<header class="team-invite-heading"><h2 tabindex="-1">Next match</h2></header>
   <p>${html(room.teamName)} · ${html(teamLeagueLabel(room))}${room.flight?' · '+html(room.flight):''}</p>
   ${assignmentUpdate?playerAssignmentUpdateHtml(assignmentUpdate,nextMatchTime,!confirmationReview&&!busy):''}
   ${confirmationReview&&schedule?.nextMatch?`<h3 tabindex="-1" data-confirmation-heading>${confirmationReview.choice==='confirmed'?'Confirm your assignment':'Request an assignment change'}</h3>
    <div class="team-invite-preview">${teamNextMatchHtml(schedule.nextMatch)}</div>${ownSharedCourtHtml(shared,owner)}
    <p>Your availability · ${replies?.own?teamReplyLabels[replies.own.choice]:'Not replied'}</p>
    <p>${confirmationReview.choice==='confirmed'?'Confirm that you have checked this court, partner and match time. Your availability stays as shown above.':'Your captain will see that you need a different assignment. Use Can you play? to change match availability.'}</p>
    <button type="button" data-confirm-assignment ${busy||pendingConfirmation?'disabled':''}>${confirmationReview.choice==='confirmed'?'Confirm assignment':'Send change request'}</button>
    ${!busy&&!pendingConfirmation?'<button type="button" class="secondary" data-cancel-confirmation>Back to match</button>':''}`
    :publicationReview&&schedule?.nextMatch?`<div class="team-invite-preview">${teamNextMatchHtml(schedule.nextMatch)}</div>
    ${lineupPublishPreviewHtml(publicationReview.courts,replies?.lineupRoster??[],shared)}
    <p>${boardChoice?'Includes your selected tactics board.':'Court assignments only. You can add tactics later.'}</p>
    <button type="button" data-publish-lineup ${busy||pendingLineup?'disabled':''}>Publish lineup</button>
    ${!busy&&!pendingLineup?'<button type="button" class="secondary" data-back-publication>Back to editing</button>':''}`
    :lineup&&schedule?.nextMatch?`<div class="team-invite-preview">${teamNextMatchHtml(schedule.nextMatch)}</div>
    <form data-match-lineup>
     <h3 tabindex="-1" ${replacementTarget?'hidden':''}>Plan lineup</h3><p ${replacementTarget?'hidden':''}>Pick players by court. Confirm any Maybe or unanswered replies with your teammates.</p>
     <div data-lineup-readiness ${replacementTarget?'hidden':''}>${teamReadinessHtml(replies,lineup,true)}</div>
     <fieldset class="team-lineup-editor" aria-label="Court assignments" ${busy||pendingLineup||lineupConflict?'disabled':''}>
      ${replacementTarget?lineupReplacementHtml(lineup,replies?.lineupRoster??[],replacementTarget,replies?.rosterComplete===true):''}
      <div ${replacementTarget?'hidden':''}>
      ${matchLineupFields(lineup,replies?.lineupRoster??[])}
      <section class="team-lineup-reserves" aria-label="Available teammates"><h3>Available teammates</h3><p>${reserves.length?reserves.map(player=>html(player.name)).join(' · '):'No unassigned teammates marked In.'}</p><p>Choose a replacement in the court’s player list, then review and publish the update.</p></section>
      ${lineup.length<maxTeamLineupCourts?`<div class="team-result-actions">
       <button type="button" class="secondary" data-add-lineup-court="singles">Add singles court</button>
       <button type="button" class="secondary" data-add-lineup-court="doubles">Add doubles court</button>
      </div>`:''}
      <section class="team-lineup-tactics">
       <h4>Tactics board</h4>
       ${boardOptions?.length?`<label>Saved tactics board<select data-tactics-choice>
        <option value="" ${!boardChoice?'selected':''}>No tactics board</option>
        ${savedTactics?`<option value="keep" ${boardChoice&&boardIndex<0?'selected':''}>Keep shared board · ${html(savedTactics.board.name)}</option>`:''}
        ${boardOptions.map((board,index)=>`<option value="${index}" ${index===boardIndex?'selected':''}>${html(board.name)}</option>`).join('')}
       </select></label>`:`<button type="button" class="secondary" data-load-tactics>Choose saved board</button>
        ${boardChoiceName?`<p>${html(boardChoiceName)}</p><button type="button" class="secondary" data-detach-tactics>Remove board</button>`:''}`}
       <p class="rating-context">Optional. Publish court assignments with or without a board.</p>
      </section>
      ${lineup.length?`<button type="submit" data-review-publication>Review &amp; publish lineup</button>
       <button type="submit" class="secondary" data-save-lineup>Save lineup</button>
       <button type="submit" class="secondary" data-draft-lineup>Draft lineup in chat</button>`:''}
      <p class="rating-context">Save lineup keeps your edits private. Publish when you’re ready for teammates to see them.</p>
      </div>
     </fieldset>
     ${!busy&&!pendingLineup&&!lineupConflict&&!replacementTarget?'<button type="button" class="secondary" data-discard-lineup>Cancel edit</button>':''}
    </form>`:!pending&&draft?`<form data-match-form>
    <label>Opponent<input name="opponent" type="text" maxlength="120" required value="${html(draft.opponent)}"></label>
    <label>Match date<input name="date" type="date" required value="${html(draft.date)}"></label>
    <div class="team-match-date-shortcuts" role="group" aria-label="Date shortcuts">
     <button type="button" class="secondary" data-match-date-offset="0">Today</button>
     <button type="button" class="secondary" data-match-date-offset="1">Tomorrow</button>
     <button type="button" class="secondary" data-match-date-offset="7">In 7 days</button>
    </div>
    <label>Start time<input name="time" type="time" value="${html(draft.time)}"></label>
    ${reusableTime?'<button type="button" class="secondary" data-reuse-match-time>Use last start time</button>':''}
    <label>Venue time zone<select name="timeZone">${zones.map(zone=>`<option value="${html(zone)}" ${zone===draft?.timeZone?'selected':''}>${html(zone.replaceAll('_',' '))}</option>`).join('')}</select></label>
    <label>Court or facility<input name="facility" type="text" maxlength="160" value="${html(draft.facility)}"></label>
    ${reusableVenue?`<button type="button" class="secondary" data-reuse-match-venue>Use last venue<span class="sr-only"> (${html(reusableVenue.facility)})</span></button>`:''}
    ${schedule?.nextMatch?'<p>Saving changes asks teammates to reply again.</p>':''}
    <button type="submit">Save for team</button><button type="button" class="secondary" data-match-cancel>Cancel edit</button>
   </form>`:!pending&&schedule?`
    ${schedule.nextMatch?`<div class="team-invite-preview">${teamNextMatchHtml(schedule.nextMatch)}
     ${previousSlot?`<p>Previously · ${html(matchSlot(previousSlot))}</p>`:''}</div>
     ${mapsUrl&&!removing?`<button type="button" class="secondary" data-open-match-maps ${busy||pendingReply?'disabled':''}>Find in Apple Maps <span aria-hidden="true">↗</span></button>`:''}`:
     `<p>No upcoming match is scheduled.</p>
      ${captain&&openResults&&!busy?'<button type="button" class="secondary" data-match-open-results>Open team results</button>':''}`}
    ${schedule.nextMatch&&!removing?(captain?teamReadinessHtml(replies,readinessCourts,false,uniqueReadinessActions,matchStatus):''):''}
    ${schedule.nextMatch&&!removing?lineupPublicationHtml(replies,owner,Boolean(captain),busy||Boolean(pendingReply||pendingConfirmation),responseView):''}
    ${captain&&shared&&!removing?`<button type="button" class="secondary" data-draft-published-lineup ${busy||pendingReply?'disabled':''}>Draft published lineup in chat</button>`:''}
    ${replies&&!removing?matchRepliesHtml(replies,busy,Boolean(pendingReply),rosterExpanded,
     Boolean(captain&&!busy&&!pendingReply&&replies.awaitingTeammates)):''}
    ${captain&&schedule.nextMatch&&scheduleAnnouncement?.revision===schedule.revision&&!removing?
     `<button type="button" class="secondary" data-draft-match-change ${busy||pendingReply?'disabled':''}>Draft schedule update in chat</button>`:''}
    ${schedule.nextMatch&&!removing?`<button type="button" class="secondary" data-share-match-calendar ${busy||pendingReply?'disabled':''}>Share calendar file</button>
     <p class="rating-context">One-time copy. ${schedule.nextMatch.time?'Reserves 90 minutes.':'Adds an all-day entry.'}</p>`:''}
    ${!removing&&shared?`<section class="team-lineup-tactics"><h3>Shared match plan</h3>
      ${plannedLineupHtml(shared)}${shared.tactics?`<button type="button" class="secondary" data-view-match-tactics>Open tactics board · ${html(shared.tactics.board.name)}</button>`:''}</section>`
      :!removing&&replies?.savedLineup?plannedLineupHtml(replies.savedLineup):''}
    ${captain&&!busy&&!pendingReply&&!removing&&(replies?.savedLineup||replies?.lineupRoster?.some(player=>player.choice!=='out'))?
     `<button type="button" class="secondary" data-plan-lineup>${replies?.savedLineup?'Edit saved lineup':'Plan lineup'}</button>`:''}
    ${removing?`<p>Remove this match from the team schedule?</p><button type="button" data-match-remove-confirm>Remove from schedule</button><button type="button" class="secondary" data-match-cancel>Keep match</button>`
     :captain&&!busy&&!pendingReply?`<button type="button" data-match-edit>${schedule.nextMatch?'Edit match':'Add match'}</button>
      ${schedule.nextMatch?'<button type="button" class="secondary" data-match-remove>Remove match</button>':''}`:''}`:''}
   <p role="status" tabindex="-1">${html(notice)}</p>
   ${!busy&&pending?'<button type="button" data-match-retry>Retry same change</button>':''}
   ${!busy&&pendingReply?'<button type="button" data-match-reply-retry>Retry same reply</button>':''}
   ${!busy&&pendingLineup?'<button type="button" data-match-lineup-retry>Retry same lineup</button>':''}
   ${!busy&&pendingConfirmation?'<button type="button" data-confirmation-retry>Retry same confirmation</button>':''}
   ${!busy&&!draft&&(!lineup||pendingLineup||lineupConflict)&&(!confirmationReview||pendingConfirmation)&&(!publicationReview||pendingLineup)?'<button type="button" class="secondary" data-match-load>Reload match</button>':''}
   ${!lineup&&!confirmationReview?`<button type="button" class="secondary" data-match-close ${busy?'disabled':''}>${draft?'Back to match':'Close'}</button>`:''}`
  dialog.querySelector('[data-match-close]')?.addEventListener('click',close)
  dialog.querySelector('[data-match-open-results]')?.addEventListener('click',()=>{
   if(!active()||busy||!openResults)return
   close()
   openResults()
  })
  dialog.querySelector<HTMLButtonElement>('[data-match-load]')?.addEventListener('click',()=>{void load()})
  dialog.querySelector<HTMLButtonElement>('[data-match-retry]')?.addEventListener('click',()=>{if(pending)void save(pending)})
  dialog.querySelector<HTMLButtonElement>('[data-match-reply-retry]')?.addEventListener('click',()=>{if(pendingReply)void reply(pendingReply)})
  dialog.querySelector('[data-match-lineup-retry]')?.addEventListener('click',()=>{if(pendingLineup)void saveLineup()})
  dialog.querySelector('[data-publish-lineup]')?.addEventListener('click',()=>{void saveLineup(true)})
  dialog.querySelector('[data-back-publication]')?.addEventListener('click',()=>{publicationReview=null;render();focus('[data-review-publication]')})
  dialog.querySelector('[data-confirm-assignment]')?.addEventListener('click',()=>{void confirmAssignment()})
  dialog.querySelector('[data-confirmation-retry]')?.addEventListener('click',()=>{void confirmAssignment()})
  dialog.querySelector('[data-draft-published-lineup]')?.addEventListener('click',()=>{void draftPublishedLineup()})
  dialog.querySelector('[data-draft-confirmation-reminder]')?.addEventListener('click',()=>{void draftConfirmationReminder()})
  dialog.querySelectorAll<HTMLButtonElement>('[data-assignment-view]').forEach(button=>{button.onclick=()=>{
   if(!active()||!captain||busy||pendingReply||pendingLineup||pendingConfirmation)return
   const view=button.dataset.assignmentView
   if(view!=='attention'&&view!=='all')return
   responseView=view
   const host=dialog.querySelector<HTMLElement>('[data-lineup-followups]')
   if(host)setLineupResponseView(host,responseView)
  }})
  dialog.querySelector('[data-cancel-confirmation]')?.addEventListener('click',()=>{confirmationReview=null;render();focus('.team-lineup-publication h3')})
  dialog.querySelectorAll<HTMLButtonElement>('[data-lineup-reply]').forEach(button=>{button.onclick=()=>{void reviewConfirmation(button.dataset.lineupReply as LineupReplyChoice)}})
  dialog.querySelector<HTMLButtonElement>('[data-open-own-availability]')?.addEventListener('click',()=>{
   if(!active()||busy||pendingReply||pendingConfirmation)return
   returnFromOwnAvailability=true
   focus('#team-match-replies-title');dialog.querySelector<HTMLElement>('.team-match-replies')?.scrollIntoView({block:'start'})
  })
  dialog.querySelector<HTMLButtonElement>('[data-draft-match-reminder]')?.addEventListener('click',()=>{void draftAvailabilityMessage('reminder')})
  dialog.querySelector<HTMLButtonElement>('[data-draft-match-change]')?.addEventListener('click',()=>{void draftAvailabilityMessage('schedule')})
  dialog.querySelector<HTMLButtonElement>('[data-open-match-maps]')?.addEventListener('click',()=>{void openMatchAction('maps')})
  dialog.querySelector<HTMLButtonElement>('[data-share-match-calendar]')?.addEventListener('click',()=>{void openMatchAction('calendar')})
  const startLineup=(player?:string)=>{
   if(!active()||!captain||busy||pendingReply||pendingLineup)return
   lineup=structuredClone(replies?.savedLineup?.courts??[]);replacementTarget=null;tacticsChoice=undefined;editingDirty=false;notice='';render();dialog.scrollTop=0;focus('[data-match-lineup] h3')
   if(player){
    const court=lineup.findIndex(court=>court.players.includes(player))
    if(court>=0){
     const slot=lineup[court].players.indexOf(player)
     replacementTarget=lineupReplacementTarget(lineup,court,slot);render()
     const heading=dialog.querySelector<HTMLElement>('.team-lineup-replacement h3')
     heading?.focus();heading?.scrollIntoView({block:'start'})
    }else{
     notice='This player is already outside your private lineup. Review and publish your edits when ready.';render();focus('[role="status"]')
    }
   }
  }
  dialog.querySelector('[data-review-private-lineup]')?.addEventListener('click',()=>{readinessReturn='confirmations';startLineup()})
  dialog.querySelectorAll<HTMLButtonElement>('[data-review-lineup-player]').forEach(button=>{button.onclick=()=>{
   readinessReturn='confirmations';startLineup(button.dataset.reviewLineupPlayer)
  }})
  dialog.querySelectorAll<HTMLButtonElement>('[data-find-lineup-replacement]').forEach(button=>{button.onclick=()=>{
   if(!active()||!captain||busy||pendingLineup||lineupConflict||!lineup)return
   const [court,slot]=button.dataset.findLineupReplacement!.split(':').map(Number)
   replacementTarget=lineupReplacementTarget(lineup,court,slot);notice='';render()
   const heading=dialog.querySelector<HTMLElement>('.team-lineup-replacement h3')
   heading?.focus();heading?.scrollIntoView({block:'start'})
  }})
  dialog.querySelector('[data-cancel-lineup-replacement]')?.addEventListener('click',cancelReplacement)
  dialog.querySelectorAll<HTMLButtonElement>('[data-choose-lineup-replacement]').forEach(button=>{button.onclick=()=>{void chooseReplacement(button.dataset.chooseLineupReplacement!)}})
  dialog.querySelectorAll<HTMLButtonElement>('[data-readiness-action]').forEach(button=>{button.onclick=()=>{
   if(!active()||busy||pendingReply||pendingLineup)return
   const key=button.dataset.readinessAction
   if(key==='reload'){void load();return}
   if(key==='publication'){
    const heading=dialog.querySelector<HTMLElement>('.team-lineup-publication h3')
    heading?.focus({preventScroll:true});heading?.scrollIntoView({block:'start'});return
   }
   if(key==='availability'){
    rosterExpanded=true
    const details=dialog.querySelector<HTMLDetailsElement>('[data-match-reply-roster]')
    if(details){details.open=true;details.querySelector('summary')?.focus()}
    return
   }
   if(key==='lineup'){readinessReturn='lineup';startLineup();return}
   if((key==='time'||key==='venue')&&schedule?.nextMatch){
    readinessReturn=key;editingDirty=false;notice='';draft={...schedule.nextMatch};render();focus(key==='time'?'[name="time"]':'[name="facility"]')
   }
  }})
  dialog.querySelector('[data-plan-lineup]')?.addEventListener('click',()=>{
   readinessReturn=null;startLineup()
  })
  dialog.querySelector('[data-discard-lineup]')?.addEventListener('click',()=>{
   lineup=null;editingDirty=false;notice='';render();focus(readinessReturn==='confirmations'?'.team-lineup-publication h3':readinessReturn==='lineup'?'[data-readiness-action="lineup"]':'[data-plan-lineup]');readinessReturn=null
  })
  dialog.querySelector('[data-load-tactics]')?.addEventListener('click',()=>{void chooseTactics()})
  dialog.querySelector('[data-detach-tactics]')?.addEventListener('click',()=>{tacticsChoice=null;editingDirty=true;render();focus('[data-load-tactics]')})
  const tacticsSelect=dialog.querySelector<HTMLSelectElement>('[data-tactics-choice]')
  if(tacticsSelect)tacticsSelect.onchange=()=>{
   const value=tacticsSelect.value
   tacticsChoice=value==='keep'?undefined:value?boardOptions?.[Number(value)]?.reference??null:null
   editingDirty=true
   render();focus('[data-tactics-choice]')
  }
  const openBoard=dialog.querySelector<HTMLButtonElement>('[data-view-match-tactics]')
  if(openBoard&&shared?.tactics){
   const board=shared.tactics.board
   openBoard.onclick=()=>{if(active()&&!tacticsViewer?.isOpen())tacticsViewer=openSharedTactics(openBoard,active,async()=>board)}
  }
  dialog.querySelectorAll<HTMLButtonElement>('[data-add-lineup-court]').forEach(button=>{button.onclick=()=>{
   if(!lineup||lineup.length>=maxTeamLineupCourts)return
   const format=button.dataset.addLineupCourt==='singles'?'singles':'doubles'
   lineup.push({format,players:format==='singles'?['']:['','']});editingDirty=true;notice='';render()
   dialog.querySelector<HTMLElement>(`[data-match-lineup-player="${lineup.length-1}:0"]`)?.focus()
  }})
  dialog.querySelectorAll<HTMLButtonElement>('[data-remove-lineup-court]').forEach(button=>{button.onclick=()=>{
   if(!lineup)return
   const index=Number(button.dataset.removeLineupCourt)
   lineup.splice(index,1);editingDirty=true;notice='';render()
   const target=lineup.length?`[data-match-lineup-player="${Math.min(index,lineup.length-1)}:0"]`:'[data-add-lineup-court]'
   dialog.querySelector<HTMLElement>(target)?.focus()
  }})
  dialog.querySelectorAll<HTMLSelectElement>('[data-match-lineup-player]').forEach(select=>{select.onchange=()=>{
   if(!lineup)return
   const [court,slot]=select.dataset.matchLineupPlayer!.split(':').map(Number)
   lineup[court].players[slot]=select.value
   editingDirty=true
   const preview=dialog.querySelector('[data-lineup-readiness]')
   if(preview)preview.innerHTML=teamReadinessHtml(replies,lineup,true)
   const reserveCopy=dialog.querySelector('.team-lineup-reserves p')
   const available=availableLineupReserves(lineup,replies?.lineupRoster??[])
   if(reserveCopy)reserveCopy.textContent=available.length?available.map(player=>player.name).join(' · '):'No unassigned teammates marked In.'
  }})
  dialog.querySelector<HTMLFormElement>('[data-match-lineup]')?.addEventListener('submit',event=>{
   event.preventDefault()
   if(event.submitter?.hasAttribute('data-review-publication'))void reviewPublication()
   else if(event.submitter?.hasAttribute('data-save-lineup'))void saveLineup()
   else void draftLineup()
  })
  const roster=dialog.querySelector<HTMLDetailsElement>('[data-match-reply-roster]')
  if(roster)roster.ontoggle=()=>{if(roster.isConnected)rosterExpanded=roster.open}
  dialog.querySelectorAll<HTMLButtonElement>('[data-match-reply]').forEach(button=>{button.onclick=()=>{
   const choice=button.dataset.matchReply
   if(!schedule?.revision||!replies||!isTeamMatchChoice(choice)||choice===replies.own?.choice)return
   void reply({choice,revision:schedule.revision,id:crypto.randomUUID(),expected:replies.own?.id??null})
  }})
  dialog.querySelector<HTMLButtonElement>('[data-match-edit]')?.addEventListener('click',()=>{
   notice='';readinessReturn=null;editingDirty=false;draft=schedule?.nextMatch??blankMatch();render();focus('[name="opponent"]')
  })
  dialog.querySelector<HTMLButtonElement>('[data-match-cancel]')?.addEventListener('click',()=>{
   const target=removing?'[data-match-remove]':'[data-match-edit]'
   draft=null;removing=false;editingDirty=false;notice='';render();focus(readinessReturn?`[data-readiness-action="${readinessReturn}"]`:target);readinessReturn=null
  })
  dialog.querySelector<HTMLButtonElement>('[data-match-remove]')?.addEventListener('click',()=>{
   removing=true;notice='';render();focus('[data-match-remove-confirm]')
  })
  dialog.querySelector<HTMLButtonElement>('[data-match-remove-confirm]')?.addEventListener('click',()=>{
   if(schedule?.revision)void save({expected:schedule.revision,revision:crypto.randomUUID(),nextMatch:null})
  })
  const form=dialog.querySelector<HTMLFormElement>('[data-match-form]')
  form?.addEventListener('input',()=>{editingDirty=true})
  form?.querySelectorAll<HTMLButtonElement>('[data-match-date-offset]').forEach(button=>{button.onclick=()=>{
   const zone=form.querySelector<HTMLSelectElement>('[name="timeZone"]')!.value
   const day=shiftCalendarDay(todayDateKey(new Date(),zone),Number(button.dataset.matchDateOffset))
   form.querySelector<HTMLInputElement>('[name="date"]')!.value=day
   editingDirty=true
   dialog.querySelector('[role="status"]')!.textContent=formatCalendarDay(day)
  }})
  form?.querySelector<HTMLButtonElement>('[data-reuse-match-time]')?.addEventListener('click',()=>{
   if(!reusableTime)return
   form.querySelector<HTMLInputElement>('[name="time"]')!.value=reusableTime
   editingDirty=true
   dialog.querySelector('[role="status"]')!.textContent='Last start time filled in.'
  })
  dialog.querySelector('[data-reuse-match-venue]')?.addEventListener('click',()=>{
   if(!form||!reusableVenue)return
   form.querySelector<HTMLInputElement>('[name="facility"]')!.value=reusableVenue.facility
   form.querySelector<HTMLSelectElement>('[name="timeZone"]')!.value=reusableVenue.timeZone
   editingDirty=true
   dialog.querySelector('[role="status"]')!.textContent='Last venue and time zone filled in.'
  })
  form?.addEventListener('submit',event=>{
   event.preventDefault()
   if(!schedule||busy)return
   const nextMatch=Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement))
   const change=readTeamNextMatchChange({revision:crypto.randomUUID(),expected:schedule.revision,nextMatch})
   if(change&&JSON.stringify(change.nextMatch)===JSON.stringify(schedule.nextMatch)){
    draft=null;editingDirty=false;readinessReturn=null;notice='Match details are already up to date.';render();focus('[role="status"]');return
   }
   if(change){void save(change);return}
   dialog.querySelector('[role="status"]')!.textContent='Check the opponent, date, time, and venue.'
   focus('[role="status"]')
  })
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()})
 void load()
 dialog.showModal()
 focus()
 return {isOpen:()=>!disposed,close,dispose}
}
