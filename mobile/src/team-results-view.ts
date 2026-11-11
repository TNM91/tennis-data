import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {teamLeagueLabel} from '../../lib/private-team-contract'
import {formatCalendarDay} from '../../lib/calendar-date'
import type {ReviewedNextMatch} from '../../lib/team-fixtures-contract'
import {isTeamCourtDefault,maxTeamResultCourts,readTeamCourtScore,readTeamCourtTally,readTeamResults,readTeamResultChange,
 teamCourtDefaults,teamResultOutcome,type TeamCourtDefault,type TeamRecord,type TeamResultChange,type TeamResultEntry,type TeamResults} from '../../lib/team-results-contract'
import {firstPartyTeamRooms,matchesTeamReleaseScope} from './first-party-team-transport'
import {html} from './match-details'
import {plannedLineupHtml} from './team-match-lineup'
import {teamNextMatchHtml} from './team-next-match-view'
import {TeamNextMatchError,type NativeTeamRoom} from './team-room-data'

const resultLabels={wins:'Won',losses:'Lost',ties:'Tied'} as const
const courtOutcomeLabels={played:'Played',...teamCourtDefaults} as const
type CourtDraft = { score:string; outcome:'played'|TeamCourtDefault }
const courtDraft=(score=''):CourtDraft=>isTeamCourtDefault(score)?{score:'',outcome:score}:{score,outcome:'played'}
const courtTally=(courts:CourtDraft[])=>readTeamCourtTally(courts.map(({score,outcome})=>{
 if(outcome!=='played')return outcome
 return isTeamCourtDefault(score)?'':score
}))

function courtTallyText(courts:CourtDraft[]){
 const tally=courtTally(courts)
 return tally?`Team tally ${tally.won}–${tally.lost}`:'Enter a score or choose a default for each court.'
}

function courtScoreList(courts:string[]|undefined){
 if(!courts?.length)return ''
 return `<details class="team-result-court-list">
  <summary>Court scores (${courts.length})</summary>
  <ol>${courts.map((score,index)=>{
   const court=readTeamCourtScore(score)
   if(!court)return ''
   const label=court.defaulted?teamCourtDefaults[court.score]:court.won?'Won':'Lost'
   return `<li><strong>Court ${index+1} · ${label}</strong>${court.defaulted?'':`<span>${html(court.score)}</span>`}</li>`
  }).join('')}</ol>
 </details>`
}

function courtFields(courts:CourtDraft[]){
 return courts.map(({score,outcome},index)=>`<div>
  <label>Court ${index+1} result<select data-court-outcome="${index}">${Object.entries(courtOutcomeLabels).map(([value,label])=>
   `<option value="${value}" ${outcome===value?'selected':''}>${label}</option>`).join('')}</select></label>
  ${outcome==='played'?`<label>Court ${index+1} score<input type="text" data-court-score="${index}" maxlength="64" required value="${html(score)}"></label>`:''}
  ${courts.length>1?`<button type="button" class="secondary" data-remove-result-court="${index}" aria-label="Remove court ${index+1}">Remove</button>`:''}
 </div>`).join('')
}

function teamRecordHtml(record:TeamRecord|undefined){
 if(!record||record.wins+record.losses+record.ties===0)return ''
 return `<section class="team-record" aria-labelledby="team-record-title">
  <h3 id="team-record-title">Team record</h3>
  <dl><div><dt>Wins</dt><dd>${record.wins}</dd></div><div><dt>Losses</dt><dd>${record.losses}</dd></div>
   <div><dt>Ties</dt><dd>${record.ties}</dd></div></dl>
 </section>`
}

async function requestTeamResults(client:SupabaseClient,owner:string,room:NativeTeamRoom,active:()=>boolean,change?:TeamResultChange){
 const {data,error}=await client.auth.getSession()
 if(error||data.session?.user.id!==owner||!active())throw new TeamNextMatchError('Your team access could not be confirmed.')
 const {teamName,leagueName,flight}=room
 const headers={Authorization:'Bearer '+data.session.access_token}
 const options={responseType:'json' as const,disableRedirects:true,connectTimeout:12000,readTimeout:15000}
 const query=new URLSearchParams({op:'team-results',team:teamName,league:leagueName,flight})
 const unavailable=()=>new TeamNextMatchError(change?'The score could not be confirmed. Retry the same score.':'Couldn’t load team results. Try again.',Boolean(change))
 let response
 try{
  response=change
   ?await CapacitorHttp.post({...options,url:firstPartyTeamRooms,headers:{...headers,'Content-Type':'application/json'},
    data:{action:'save_team_result',teamName,leagueName,flight,roomId:room.id,...change}})
   :await CapacitorHttp.get({...options,url:firstPartyTeamRooms+'?'+query,headers})
 }catch{throw unavailable()}
 if(!active())throw unavailable()
 if(response.status===409)throw new TeamNextMatchError('The match or score changed. Reload the team results.',false,409)
 if(response.status===403||response.status===401)throw new TeamNextMatchError('Your team access could not be confirmed.',false,403)
 if(response.status===400&&change)throw new TeamNextMatchError('Check the court results and team tally.',false,400)
 const result=response.data
 if(response.status!==200||result?.ok!==true||result.roomId!==room.id||!matchesTeamReleaseScope(result,owner))throw unavailable()
 if(!change)return readTeamResults(result.results)
 if(result.fixtureId!==change.fixtureId||result.score?.revision!==change.revision||
    result.score.won!==change.won||result.score.lost!==change.lost||
    change.courtScores!==undefined&&JSON.stringify(result.score.courtScores)!==JSON.stringify(change.courtScores))throw unavailable()
}

export function openTeamResults(client:SupabaseClient,owner:string,room:NativeTeamRoom,current:()=>boolean,
 onClose:(message?:string)=>void,canDraft:()=>boolean,onScheduleNext:(previous:ReviewedNextMatch)=>void){
 const dialog=document.createElement('dialog')
 dialog.className='team-invite-dialog team-next-match-dialog'
 dialog.setAttribute('aria-label','Team results')
 document.body.append(dialog)
 let disposed=false,busy=false,notice=''
 let data:TeamResults|null=null,edit:TeamResultEntry|null=null,pending:TeamResultChange|null=null
 let won='',lost=''
 let courts:CourtDraft[]|null=null
 let plannedLineupExpanded=false
 let postedMatch:ReviewedNextMatch|null=null
 const active=()=>!disposed&&current()
 const dispose=()=>{disposed=true;dialog.remove()}
 const close=()=>{if(!disposed&&!busy){dispose();onClose()}}
 const focus=(target='h2')=>dialog.querySelector<HTMLElement>(target)?.focus({preventScroll:true})
 const load=async()=>{
  if(busy||!active())return
  busy=true;notice='Loading team results…';edit=null;pending=null;data=null;postedMatch=null;render()
  try{data=(await requestTeamResults(client,owner,room,active))??null;notice=''}
  catch(cause){notice=cause instanceof TeamNextMatchError?cause.message:'Couldn’t load team results. Try again.'}
  finally{if(active()){busy=false;render();focus(notice?'[role="status"]':'h2')}}
 }
 const save=async(change:TeamResultChange)=>{
  if(!active()||busy||!edit||!data?.canEdit)return
  busy=true;pending=change;notice='Posting the team score…';render()
  try{
   await requestTeamResults(client,owner,room,active,change)
   if(!active())return
   if(data.record){
    if(edit.score)data.record[teamResultOutcome(edit.score)]--
    data.record[teamResultOutcome(change)]++
   }
   data.entries=data.entries.map(entry=>entry.fixtureId===change.fixtureId
    ?{...entry,score:{revision:change.revision,won:change.won,lost:change.lost,
     ...(change.courtScores===undefined?{}:{courtScores:change.courtScores})}}:entry)
   if(!edit.score&&room.canScheduleMatch)postedMatch=edit.match
   pending=null;edit=null;notice='Result posted for your team.'
  }catch(cause){
   notice=cause instanceof TeamNextMatchError?cause.message:'The score could not be confirmed. Retry the same score.'
   if(cause instanceof TeamNextMatchError&&!cause.uncertain){
    pending=null
    if(cause.status!==400){edit=null;data=null}
   }
  }finally{if(active()){
   busy=false;render()
   if(postedMatch)dialog.scrollTop=0
   focus('[role="status"]')
  }}
 }
 const draftResult=async(entry:TeamResultEntry)=>{
  if(!active()||busy||pending||!data?.canEdit||!entry.score)return
  const draftNotice='Finish your current chat draft before drafting a result.'
  if(!canDraft()){notice=draftNotice;render();focus('[role="status"]');return}
  busy=true;notice='Checking the latest score…';render()
  try{
   const latest=await requestTeamResults(client,owner,room,active)
   if(!active()||!latest)return
   data=latest
   if(!latest.canEdit){notice='Captain access is required to draft a team result.';return}
   const result=latest.entries.find(item=>item.fixtureId===entry.fixtureId)
   if(!result?.score||result.score.revision!==entry.score.revision){
    notice='The score changed. Review the latest result before drafting.'
    return
   }
   if(!canDraft()){notice=draftNotice;return}
   const {score,match}=result
   const outcome=resultLabels[teamResultOutcome(score)].toLowerCase()
   const message=`${room.teamName} ${outcome} ${score.won}–${score.lost} on courts vs ${match.opponent} on ${formatCalendarDay(match.date)}. View the score in Team → Team results.`
   dispose()
   onClose(message)
  }catch(cause){
   notice=cause instanceof TeamNextMatchError?cause.message:'Couldn’t check the latest score. Reload the results.'
  }finally{if(active()){busy=false;render();focus('[role="status"]')}}
 }
 const render=()=>{
  if(!active())return
  const status=`<p role="status" tabindex="-1" data-invite-feedback>${html(notice)}</p>`
  dialog.innerHTML=`<header class="team-invite-heading"><h2 tabindex="-1">Team results</h2></header>
   <p>${html(room.teamName)} · ${html(teamLeagueLabel(room))}${room.flight?' · '+html(room.flight):''}</p>
   ${postedMatch?`<div class="team-invite-preview">${status}
    <button type="button" data-schedule-next-match>Schedule next match</button></div>`:''}
   ${!pending&&edit?`<div class="team-invite-preview">${teamNextMatchHtml(edit.match)}
    ${edit.plannedLineup?plannedLineupHtml(edit.plannedLineup,plannedLineupExpanded):''}</div>
    <form data-result-form>
     ${courts?`<p>Enter your team’s score first in each set. Use completed best-of-three scores like 6-4, 4-6, 10-8.</p>
      <div class="team-result-court-fields">${courtFields(courts)}</div>
      <p data-court-tally aria-live="polite">${courtTallyText(courts)}</p>
      ${courts.length<maxTeamResultCourts?'<button type="button" class="secondary" data-add-result-court>Add another court</button>':''}
      <button type="button" class="secondary" data-result-totals-only>Use totals only</button>`:
      `<p>Enter the final court tally from your team’s perspective.</p>
     <label>Courts won<input name="won" type="number" min="0" max="99" step="1" required value="${html(won)}"></label>
     <label>Courts lost<input name="lost" type="number" min="0" max="99" step="1" required value="${html(lost)}"></label>
     ${edit.score?.courtScores?.length?'<p>Posting totals clears the saved court scores.</p>':''}
     <button type="button" class="secondary" data-result-court-mode>Add court scores</button>`}
     <button type="submit">Post team score</button><button type="button" class="secondary" data-result-cancel>Cancel edit</button>
    </form>`:!pending&&data?`${teamRecordHtml(data.record)}
    <ul class="team-result-list" role="list" aria-label="Recent team matches">${data.entries.map(({match,score},index)=>`
    <li class="team-invite-preview">${teamNextMatchHtml(match)}
     ${score?`<p><strong>${score.won}–${score.lost}</strong> · ${resultLabels[teamResultOutcome(score)]}</p>`:'<p>Score pending</p>'}
     ${courtScoreList(score?.courtScores)}
     ${data?.canEdit&&!busy?`<div class="team-result-actions">
      <button type="button" class="secondary" data-result-edit="${index}">${score?'Correct score':'Enter score'}<span class="sr-only"> vs ${html(match.opponent)}</span></button>
      ${score?`<button type="button" class="secondary" data-result-draft="${index}">Draft result in chat<span class="sr-only"> vs ${html(match.opponent)}</span></button>`:''}
     </div>`:''}</li>`).join('')}</ul>
     ${data.entries.length?'':'<p>No team results yet.</p>'}
     ${data.more?'<p>Showing the 20 most recent matches.</p>':''}`:''}
   ${postedMatch?'':status}
   ${!busy&&pending?'<button type="button" data-result-retry>Retry same score</button>':''}
   ${!busy&&!edit?'<button type="button" class="secondary" data-result-load>Reload results</button>':''}
   <button type="button" class="secondary" data-result-close ${busy?'disabled':''}>Close</button>`
  dialog.querySelector<HTMLButtonElement>('[data-result-close]')!.onclick=close
  const plannedLineup=dialog.querySelector<HTMLDetailsElement>('[data-planned-lineup]')
  if(plannedLineup)plannedLineup.ontoggle=()=>{if(plannedLineup.isConnected)plannedLineupExpanded=plannedLineup.open}
  const focusCourt=(index:number)=>{
   const field=courts?.[index]?.outcome==='played'?'score':'outcome'
   focus(`[data-court-${field}="${index}"]`)
  }
  dialog.querySelector('[data-schedule-next-match]')?.addEventListener('click',()=>{
   if(!active()||busy||!postedMatch)return
   const previous=postedMatch
   dispose();onScheduleNext(previous)
  })
  dialog.querySelector('[data-result-load]')?.addEventListener('click',()=>{void load()})
  dialog.querySelector('[data-result-retry]')?.addEventListener('click',()=>{if(pending)void save(pending)})
  dialog.querySelector('[data-result-cancel]')?.addEventListener('click',()=>{
   const index=data?.entries.indexOf(edit!)
   edit=null;notice='';render();focus('[data-result-edit="'+index+'"]')
  })
  dialog.querySelectorAll<HTMLButtonElement>('[data-result-edit]').forEach(button=>{button.onclick=()=>{
   edit=data?.entries[Number(button.dataset.resultEdit)]??null
   if(!edit)return
   postedMatch=null
   plannedLineupExpanded=false
   won=edit.score?String(edit.score.won):'';lost=edit.score?String(edit.score.lost):'';notice=''
   courts=edit.score?.courtScores?.length?edit.score.courtScores.map(courtDraft):null
   render();if(courts)focusCourt(0);else focus('[name="won"]')
  }})
  dialog.querySelectorAll<HTMLButtonElement>('[data-result-draft]').forEach(button=>{button.onclick=()=>{
   const entry=data?.entries[Number(button.dataset.resultDraft)]
   if(entry){postedMatch=null;void draftResult(entry)}
  }})
  const form=dialog.querySelector<HTMLFormElement>('[data-result-form]')
  dialog.querySelector('[data-result-court-mode]')?.addEventListener('click',()=>{
   if(!form)return
   const fields=new FormData(form)
   won=String(fields.get('won')??'');lost=String(fields.get('lost')??'')
   courts=edit?.score?.courtScores?.length?edit.score.courtScores.map(courtDraft):Array.from({length:edit?.plannedLineup?.courts.length??1},()=>courtDraft())
   notice='';render();focusCourt(0)
  })
  dialog.querySelector('[data-result-totals-only]')?.addEventListener('click',()=>{
   const tally=courts&&courtTally(courts)
   if(tally){won=String(tally.won);lost=String(tally.lost)}
   courts=null;notice='';render();focus('[name="won"]')
  })
  dialog.querySelector('[data-add-result-court]')?.addEventListener('click',()=>{
   if(!courts||courts.length>=maxTeamResultCourts)return
   courts.push(courtDraft());notice='';render();focusCourt(courts.length-1)
  })
  dialog.querySelectorAll<HTMLButtonElement>('[data-remove-result-court]').forEach(button=>{button.onclick=()=>{
   if(!courts||courts.length<2)return
   const index=Number(button.dataset.removeResultCourt)
   courts.splice(index,1);notice='';render();focusCourt(Math.min(index,courts.length-1))
  }})
  dialog.querySelectorAll<HTMLSelectElement>('[data-court-outcome]').forEach(select=>{select.onchange=()=>{
   if(!courts)return
   const index=Number(select.dataset.courtOutcome)
   courts[index].outcome=isTeamCourtDefault(select.value)?select.value:'played'
   notice='';render();focus(`[data-court-outcome="${index}"]`)
  }})
  dialog.querySelectorAll<HTMLInputElement>('[data-court-score]').forEach(input=>{input.oninput=()=>{
   if(!courts)return
   courts[Number(input.dataset.courtScore)].score=input.value
   const tally=dialog.querySelector('[data-court-tally]')!
   const text=courtTallyText(courts)
   if(tally.textContent!==text)tally.textContent=text
  }})
  form?.addEventListener('submit',event=>{
   event.preventDefault()
   if(!edit||busy)return
   let tally:{won:number;lost:number;courtScores?:string[]}|null
   if(courts)tally=courtTally(courts)
   else{
    const fields=new FormData(event.currentTarget as HTMLFormElement)
    won=String(fields.get('won')??'');lost=String(fields.get('lost')??'')
    tally=won&&lost?{won:Number(won),lost:Number(lost),...(edit.score?.courtScores?.length?{courtScores:[]}: {})}:null
   }
   const change=tally&&readTeamResultChange({fixtureId:edit.fixtureId,revision:crypto.randomUUID(),
    expected:edit.score?.revision??null,...tally})
   if(change){void save(change);return}
   dialog.querySelector('[role="status"]')!.textContent=courts?'Enter a completed best-of-three score or choose a default for each court.':'Enter the final number of courts won and lost.'
   focus('[role="status"]')
  })
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()})
 void load()
 dialog.showModal()
 focus()
 return {isOpen:()=>!disposed,close,dispose}
}
