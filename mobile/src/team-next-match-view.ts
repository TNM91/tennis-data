import type {SupabaseClient} from '@supabase/supabase-js'
import {teamLeagueLabel} from '../../lib/private-team-contract'
import {eventCalendarStart,formatCalendarDay} from '../../lib/calendar-date'
import {readTeamNextMatchChange,type ReviewedNextMatch,type TeamNextMatchChange} from '../../lib/team-fixtures-contract'
import {maxTeamLineupCourts,readTeamLineupChange,type MatchLineupCourt,type TeamLineupChange} from '../../lib/team-match-lineup-contract'
import {isTeamMatchChoice,teamReplyLabels,type TeamMatchReplies,type TeamMatchReplyChange} from '../../lib/team-match-replies-contract'
import {todayDateKey} from '../../lib/team-room-match-flow'
import {html} from './match-details'
import {calendarMatchExport,calendarMatchVenueHref,shiftCalendarDay} from './calendar-data'
import {Browser} from './native-browser'
import {exportCoachFile} from './native-coach-files'
import {matchLineupFields,matchLineupMessage,plannedLineupHtml} from './team-match-lineup'
import {saveTeamMatchLineupRequest,teamMatchRepliesRequest} from './team-match-replies-data'
import {teamNextMatchRequest,TeamNextMatchError,type TeamMatchRoom,type TeamNextMatchSchedule} from './team-room-data'

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
  <h3 id="team-match-replies-title">Can you play?</h3>
  <div class="team-match-reply-actions">${choices.map(([choice,label])=>
   `<button type="button" class="secondary" data-match-reply="${choice}" aria-pressed="${replies.own?.choice===choice}" ${busy||pending?'disabled':''}>${label}</button>`).join('')}</div>
  ${matchReplyRosterHtml(replies,expanded,canRemind)}
 </section>`
}

export function openTeamNextMatch(client:SupabaseClient,owner:string,room:TeamMatchRoom,current:()=>boolean,
 onClose:(changed:boolean,message?:string,kind?:'lineup'|'schedule')=>void,canDraftUpdate:()=>boolean,
 {previousMatch,calendarSchedule,openResults}:{
  previousMatch?:ReviewedNextMatch;calendarSchedule?:TeamNextMatchSchedule;openResults?:()=>void
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
 let pendingLineup:TeamLineupChange|null=null,lineupConflict=false
 let previousSlot:ReviewedNextMatch|null=null
 let scheduleAnnouncement:{revision:string;previous:ReviewedNextMatch}|null=null
 let rosterExpanded=false
 const active=()=>!disposed&&current()
 const dispose=()=>{disposed=true;dialog.remove()}
 const close=()=>{if(!disposed&&!busy){dispose();onClose(changed)}}
 const focus=(target='h2')=>dialog.querySelector<HTMLElement>(target)?.focus({preventScroll:true})
 const focusFeedback=()=>dialog.querySelector<HTMLElement>('[role="status"]')?.focus()
 const captain=room.manualFixture&&room.canScheduleMatch
 let startNew=Boolean(captain&&previousMatch)
 const blankMatch=():ReviewedNextMatch=>({opponent:'',date:'',time:'',timeZone:localZone,facility:''})
 const refreshReplies=async(snapshot:TeamNextMatchSchedule)=>{
  replies=null
  if(!room.manualFixture||!snapshot.nextMatch||!snapshot.revision||!active())return
  try{replies=await teamMatchRepliesRequest(client,owner,active,room,snapshot.revision)}
  catch(cause){notice=cause instanceof TeamNextMatchError?cause.message:'Availability couldn’t load. Reload the match.'}
 }
 const reviewScheduleChange=(before:TeamNextMatchSchedule|undefined,latest:TeamNextMatchSchedule)=>{
  if(!before?.nextMatch||(before.revision===latest.revision&&latest.nextMatch))return
  changed=true
  previousSlot=latest.nextMatch?before.nextMatch:null
  notice=latest.nextMatch?'The team schedule changed. Review the latest match.':'This match is no longer upcoming.'
 }
 const load=async()=>{
  if(busy||!active())return
  const before=schedule??calendarSchedule
  busy=true;pending=null;pendingReply=null;pendingLineup=null;lineupConflict=false;lineup=null
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
  finally{if(active()){busy=false;render();focus(draft?'[name="opponent"]':notice?'[role="status"]':'h2')}}
 }
 const save=async(change:TeamNextMatchChange)=>{
  if(busy||!active())return
  const before=schedule?.nextMatch
  busy=true;pending=change;notice='Saving the team schedule…';render()
  try{
   schedule=await teamNextMatchRequest(client,owner,active,room,change)
   changed=true;pending=null;draft=null;removing=false
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
  busy=true;pendingReply=change;notice='Saving your reply…';render()
  try{
   const result=await teamMatchRepliesRequest(client,owner,active,room,change.revision,change)
   const refreshTeam=Boolean(replies?.team)
   replies=result;pendingReply=null;notice='Your reply is saved.'
   if(refreshTeam)await refreshReplies(schedule)
  }catch(cause){
   notice=cause instanceof TeamNextMatchError?cause.message:'Your reply could not be confirmed. Retry the same reply.'
   if(cause instanceof TeamNextMatchError&&!cause.uncertain){
    pendingReply=null;replies=null
    if(cause.status===409){
     const before=schedule
     try{
      schedule=await teamNextMatchRequest(client,owner,active,room)
      notice='Your reply changed. Review the latest reply.'
      reviewScheduleChange(before,schedule)
      await refreshReplies(schedule)
     }catch{
      schedule=null;notice='Couldn’t check the latest match. Reload the match.'
     }
    }
   }
  }finally{if(active()){busy=false;render();focus('[role="status"]')}}
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
 const saveLineup=async()=>{
  const revision=schedule?.revision,roster=replies?.lineupRoster
  if(!active()||!captain||busy||lineupConflict||!lineup||!revision||!roster)return
  const change=pendingLineup??readTeamLineupChange({revision,expected:replies?.savedLineup?.version??null,
   version:crypto.randomUUID(),courts:lineup})
  if(!change){notice='Fill every court and choose each teammate only once.';render();focusFeedback();return}
  const eligible=new Set(roster.filter(player=>player.choice!=='out').map(player=>player.id))
  if(!pendingLineup&&change.courts.some(court=>court.players.some(id=>!eligible.has(id)))){
   notice='Replace unavailable players before saving.';render();focusFeedback();return
  }
  busy=true;pendingLineup=change;notice='Saving your lineup…';render()
  try{
   const savedLineup=await saveTeamMatchLineupRequest(client,owner,active,room,change)
   if(!active()||!replies)return
   replies={...replies,savedLineup};pendingLineup=null;lineup=null;notice='Lineup saved for captains.'
  }catch(cause){
   notice=cause instanceof TeamNextMatchError?cause.message:'The lineup save could not be confirmed. Retry the same lineup.'
   if(cause instanceof TeamNextMatchError&&!cause.uncertain){pendingLineup=null;lineupConflict=true}
  }finally{if(active()){busy=false;render();focusFeedback()}}
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
  const zones=draft?[...new Set([draft.timeZone,localZone,'America/New_York','America/Chicago','America/Denver','America/Phoenix','America/Los_Angeles','America/Anchorage','Pacific/Honolulu'])]:[]
  const reusableVenue=draft&&!schedule?.nextMatch&&previousMatch?.facility?previousMatch:null
  const reusableTime=draft&&!schedule?.nextMatch?previousMatch?.time:''
  const mapsUrl=schedule?.nextMatch&&calendarMatchVenueHref({location:schedule.nextMatch.facility})
  if(reusableVenue&&!zones.includes(reusableVenue.timeZone))zones.push(reusableVenue.timeZone)
  dialog.innerHTML=`<header class="team-invite-heading"><h2 tabindex="-1">Next match</h2></header>
   <p>${html(room.teamName)} · ${html(teamLeagueLabel(room))}${room.flight?' · '+html(room.flight):''}</p>
   ${lineup&&schedule?.nextMatch?`<div class="team-invite-preview">${teamNextMatchHtml(schedule.nextMatch)}</div>
    <form data-match-lineup>
     <h3 tabindex="-1">Plan lineup</h3><p>Pick players by court. Confirm any Maybe or unanswered replies with your teammates.</p>
     <fieldset class="team-lineup-editor" aria-label="Court assignments" ${busy||pendingLineup||lineupConflict?'disabled':''}>
      ${matchLineupFields(lineup,replies?.lineupRoster??[])}
      ${lineup.length<maxTeamLineupCourts?`<div class="team-result-actions">
       <button type="button" class="secondary" data-add-lineup-court="singles">Add singles court</button>
       <button type="button" class="secondary" data-add-lineup-court="doubles">Add doubles court</button>
      </div>`:''}
      ${lineup.length?'<button type="submit" data-save-lineup>Save lineup</button><button type="submit" class="secondary">Draft lineup in chat</button>':''}
     </fieldset>
     ${!busy&&!pendingLineup&&!lineupConflict?'<button type="button" class="secondary" data-discard-lineup>Cancel edit</button>':''}
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
    ${replies&&!removing?matchRepliesHtml(replies,busy,Boolean(pendingReply),rosterExpanded,
     Boolean(captain&&!busy&&!pendingReply&&replies.awaitingTeammates)):''}
    ${captain&&schedule.nextMatch&&scheduleAnnouncement?.revision===schedule.revision&&!removing?
     `<button type="button" class="secondary" data-draft-match-change ${busy||pendingReply?'disabled':''}>Draft schedule update in chat</button>`:''}
    ${schedule.nextMatch&&!removing?`<button type="button" class="secondary" data-share-match-calendar ${busy||pendingReply?'disabled':''}>Share calendar file</button>
     <p class="rating-context">One-time copy. ${schedule.nextMatch.time?'Reserves 90 minutes.':'Adds an all-day entry.'}</p>`:''}
    ${!removing&&replies?.savedLineup?plannedLineupHtml(replies.savedLineup):''}
    ${captain&&!busy&&!pendingReply&&!removing&&(replies?.savedLineup||replies?.lineupRoster?.some(player=>player.choice!=='out'))?
     `<button type="button" class="secondary" data-plan-lineup>${replies?.savedLineup?'Edit saved lineup':'Plan lineup'}</button>`:''}
    ${removing?`<p>Remove this match from the team schedule?</p><button type="button" data-match-remove-confirm>Remove from schedule</button><button type="button" class="secondary" data-match-cancel>Keep match</button>`
     :captain&&!busy&&!pendingReply?`<button type="button" data-match-edit>${schedule.nextMatch?'Edit match':'Add match'}</button>
      ${schedule.nextMatch?'<button type="button" class="secondary" data-match-remove>Remove match</button>':''}`:''}`:''}
   <p role="status" tabindex="-1">${html(notice)}</p>
   ${!busy&&pending?'<button type="button" data-match-retry>Retry same change</button>':''}
   ${!busy&&pendingReply?'<button type="button" data-match-reply-retry>Retry same reply</button>':''}
   ${!busy&&pendingLineup?'<button type="button" data-match-lineup-retry>Retry same lineup</button>':''}
   ${!busy&&!draft&&(!lineup||pendingLineup||lineupConflict)?'<button type="button" class="secondary" data-match-load>Reload match</button>':''}
   ${!lineup?`<button type="button" class="secondary" data-match-close ${busy?'disabled':''}>Close</button>`:''}`
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
  dialog.querySelector<HTMLButtonElement>('[data-draft-match-reminder]')?.addEventListener('click',()=>{void draftAvailabilityMessage('reminder')})
  dialog.querySelector<HTMLButtonElement>('[data-draft-match-change]')?.addEventListener('click',()=>{void draftAvailabilityMessage('schedule')})
  dialog.querySelector<HTMLButtonElement>('[data-open-match-maps]')?.addEventListener('click',()=>{void openMatchAction('maps')})
  dialog.querySelector<HTMLButtonElement>('[data-share-match-calendar]')?.addEventListener('click',()=>{void openMatchAction('calendar')})
  dialog.querySelector('[data-plan-lineup]')?.addEventListener('click',()=>{
   lineup=structuredClone(replies?.savedLineup?.courts??[]);notice='';render();dialog.scrollTop=0;focus('[data-match-lineup] h3')
  })
  dialog.querySelector('[data-discard-lineup]')?.addEventListener('click',()=>{
   lineup=null;notice='';render();(dialog.querySelector<HTMLElement>('[data-plan-lineup]')??dialog.querySelector<HTMLElement>('h2'))?.focus()
  })
  dialog.querySelectorAll<HTMLButtonElement>('[data-add-lineup-court]').forEach(button=>{button.onclick=()=>{
   if(!lineup||lineup.length>=maxTeamLineupCourts)return
   const format=button.dataset.addLineupCourt==='singles'?'singles':'doubles'
   lineup.push({format,players:format==='singles'?['']:['','']});notice='';render()
   dialog.querySelector<HTMLElement>(`[data-match-lineup-player="${lineup.length-1}:0"]`)?.focus()
  }})
  dialog.querySelectorAll<HTMLButtonElement>('[data-remove-lineup-court]').forEach(button=>{button.onclick=()=>{
   if(!lineup)return
   const index=Number(button.dataset.removeLineupCourt)
   lineup.splice(index,1);notice='';render()
   const target=lineup.length?`[data-match-lineup-player="${Math.min(index,lineup.length-1)}:0"]`:'[data-add-lineup-court]'
   dialog.querySelector<HTMLElement>(target)?.focus()
  }})
  dialog.querySelectorAll<HTMLSelectElement>('[data-match-lineup-player]').forEach(select=>{select.onchange=()=>{
   if(!lineup)return
   const [court,slot]=select.dataset.matchLineupPlayer!.split(':').map(Number)
   lineup[court].players[slot]=select.value
  }})
  dialog.querySelector<HTMLFormElement>('[data-match-lineup]')?.addEventListener('submit',event=>{
   event.preventDefault()
   if(event.submitter?.hasAttribute('data-save-lineup'))void saveLineup()
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
   notice='';draft=schedule?.nextMatch??blankMatch();render();focus('[name="opponent"]')
  })
  dialog.querySelector<HTMLButtonElement>('[data-match-cancel]')?.addEventListener('click',()=>{
   const target=removing?'[data-match-remove]':'[data-match-edit]'
   draft=null;removing=false;notice='';render();focus(target)
  })
  dialog.querySelector<HTMLButtonElement>('[data-match-remove]')?.addEventListener('click',()=>{
   removing=true;notice='';render();focus('[data-match-remove-confirm]')
  })
  dialog.querySelector<HTMLButtonElement>('[data-match-remove-confirm]')?.addEventListener('click',()=>{
   if(schedule?.revision)void save({expected:schedule.revision,revision:crypto.randomUUID(),nextMatch:null})
  })
  const form=dialog.querySelector<HTMLFormElement>('[data-match-form]')
  form?.querySelectorAll<HTMLButtonElement>('[data-match-date-offset]').forEach(button=>{button.onclick=()=>{
   const zone=form.querySelector<HTMLSelectElement>('[name="timeZone"]')!.value
   const day=shiftCalendarDay(todayDateKey(new Date(),zone),Number(button.dataset.matchDateOffset))
   form.querySelector<HTMLInputElement>('[name="date"]')!.value=day
   dialog.querySelector('[role="status"]')!.textContent=formatCalendarDay(day)
  }})
  form?.querySelector<HTMLButtonElement>('[data-reuse-match-time]')?.addEventListener('click',()=>{
   if(!reusableTime)return
   form.querySelector<HTMLInputElement>('[name="time"]')!.value=reusableTime
   dialog.querySelector('[role="status"]')!.textContent='Last start time filled in.'
  })
  dialog.querySelector('[data-reuse-match-venue]')?.addEventListener('click',()=>{
   if(!form||!reusableVenue)return
   form.querySelector<HTMLInputElement>('[name="facility"]')!.value=reusableVenue.facility
   form.querySelector<HTMLSelectElement>('[name="timeZone"]')!.value=reusableVenue.timeZone
   dialog.querySelector('[role="status"]')!.textContent='Last venue and time zone filled in.'
  })
  form?.addEventListener('submit',event=>{
   event.preventDefault()
   if(!schedule||busy)return
   const nextMatch=Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement))
   const change=readTeamNextMatchChange({revision:crypto.randomUUID(),expected:schedule.revision,nextMatch})
   if(change&&JSON.stringify(change.nextMatch)===JSON.stringify(schedule.nextMatch)){
    draft=null;notice='Match details are already up to date.';render();focus('[role="status"]');return
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
