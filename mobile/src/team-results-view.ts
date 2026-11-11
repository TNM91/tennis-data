import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {teamLeagueLabel} from '../../lib/private-team-contract'
import {formatCalendarDay} from '../../lib/calendar-date'
import type {ReviewedNextMatch} from '../../lib/team-fixtures-contract'
import {isTeamCourtDefault,maxTeamResultCourts,readTeamCourtScore,readTeamCourtTally,readTeamResults,readTeamResultChange,readTeamResultPlayers,
 teamCourtDefaults,teamResultOutcome,teamResultScorecardKey,type TeamRecord,type TeamResultChange,type TeamResultEntry,
 type TeamResultPlayer,type TeamResultScore,type TeamResults} from '../../lib/team-results-contract'
import {firstPartyTeamRooms,matchesTeamReleaseScope} from './first-party-team-transport'
import {localCalendarDate} from './calendar-data'
import {html} from './match-details'
import {plannedLineupHtml} from './team-match-lineup'
import {loadSavedTeamScores,teamScoreDiffers,type CalendarScorecardSeed,type TeamScore} from './personal-match-data'
import type {CourtDraft,ScoreDraft,TeamScoreDraftSession} from './team-score-drafts'
import {teamNextMatchHtml} from './team-next-match-view'
import {TeamNextMatchError,type NativeTeamRoom} from './team-room-data'

const resultLabels={wins:'Won',losses:'Lost',ties:'Tied'} as const
const courtOutcomeLabels={played:'Played',...teamCourtDefaults} as const
const resultFilters={all:'All matches',mine:'Your courts'} as const
const openInLab='Open in My Lab'
const duplicatePlayerMessage='Choose each teammate only once.'
const resultChatHint='View the score in Team → Team results.'
type ResultFilter = keyof typeof resultFilters
export type TeamResultsPosition = { filter:ResultFilter; fixtureId:string }
export type TeamResultsEntryPoint = {position:TeamResultsPosition}|{chatMatch:string}
function courtDraft(score='',players:string[]=[],plannedPlayers?:string[]):CourtDraft{
 return isTeamCourtDefault(score)?{score:'',outcome:score,players:[],plannedPlayers}:{score,outcome:'played',players,plannedPlayers}
}
function recordedCourts({score,plannedLineup}:TeamResultEntry){
 const planned=plannedLineup?.courts
 if(!score?.courtScores)return
 const scores=score.courtScores
 return scores.map((value,index)=>courtDraft(value,
  score.courtPlayers?.[index].flatMap(player=>player.id?[player.id]:[]),
  planned?.length===scores.length?planned[index].players:undefined))
}

function myPlayedCourt(score:TeamResultScore|null){
 if(!score?.myCourt)return
 const number=score.myCourt
 const court=readTeamCourtScore(score.courtScores?.[number-1])
 if(!court||court.defaulted)return
 return {number,score:court.score,outcome:court.won?'Won':'Lost'} as const
}

function myCourtScorecard(roomId:string,entry:TeamResultEntry):CalendarScorecardSeed|undefined{
 const {fixtureId,match,score}=entry
 const court=myPlayedCourt(score)
 if(!court||match.date>localCalendarDate())return
 return {calendarMatchId:teamResultScorecardKey(roomId,fixtureId),date:match.date,
  opponent:[...match.opponent.replace(/\p{Cc}/gu,'').trim()].slice(0,100).join(''),
  format:score?.courtPlayers?.[court.number-1].length===2?'doubles':undefined,score:court.score,outcome:court.outcome}
}
const resultChatMatchLabel=(match:ReviewedNextMatch)=>`${match.opponent} on ${formatCalendarDay(match.date)}`
export function sharedTeamResult(body:string,teamName:string){
 const prefix=`${teamName} `,suffix=`. ${resultChatHint}`
 if(!body.startsWith(prefix)||!body.endsWith(suffix))return
 const match=/^(?:won|lost|tied) \d{1,2}–\d{1,2} on courts vs (.+)$/.exec(body.slice(prefix.length,-suffix.length))
 if(match)return {summary:body.slice(0,-resultChatHint.length).trimEnd(),matchLabel:match[1]}
}
const courtTally=(courts:CourtDraft[])=>readTeamCourtTally(courts.map(({score,outcome})=>{
 if(outcome!=='played')return outcome
 return isTeamCourtDefault(score)?'':score
}))

function courtTallyText(courts:CourtDraft[]){
 const tally=courtTally(courts)
 return tally?`Team tally ${tally.won}–${tally.lost}`:'Enter a score or choose a default for each court.'
}

function courtScoreList(courts:string[]|undefined,players:TeamResultPlayer[][]|undefined){
 if(!courts?.length)return ''
 return `<details class="team-result-court-list">
  <summary>Court scores (${courts.length})</summary>
  <ol>${courts.map((score,index)=>{
   const court=readTeamCourtScore(score)
   if(!court)return ''
   const label=court.defaulted?teamCourtDefaults[court.score]:court.won?'Won':'Lost'
   const names=players?.[index].map(player=>player.name).join(' & ')
   return `<li><strong>Court ${index+1} · ${label}</strong>${court.defaulted?'':`<span>${html(court.score)}</span>`}
    ${names?`<p class="team-result-player-names">${html(names)}</p>`:''}</li>`
  }).join('')}</ol>
 </details>`
}

function scorePairs(score:string):[string,string][]|null{
 const sets=score.trim().split(/[,\s]+/).filter(Boolean)
 if(sets.length>3)return null
 const pairs:[string,string][]=[]
 for(const set of sets){
  const pair=/^(\d{0,2})[-–](\d{0,2})$/.exec(set)
  if(!pair)return null
  pairs.push([pair[1],pair[2]])
 }
 while(pairs.length<3)pairs.push(['',''])
 return pairs
}

function courtScoreFields(index:number,score:string,bySet:boolean){
 const court='Court '+(index+1),pairs=bySet?scorePairs(score):null
 if(!pairs)return `<label>${court} score<input type="text" data-court-score="${index}" maxlength="64" required value="${html(score)}"></label>`
 return `<div class="team-result-set-grid" role="group" aria-label="${court} set scores">
  <span aria-hidden="true"></span><span class="team-result-set-side" aria-hidden="true">Us</span><span class="team-result-set-side" aria-hidden="true">Them</span>
  ${pairs.map((pair,set)=>`<span aria-hidden="true">Set ${set+1}</span>${pair.map((value,side)=>
   `<input type="text" inputmode="numeric" autocomplete="off" maxlength="2"
    aria-label="${court} set ${set+1}, ${side===0?'your team':'opponent'}" data-court-set="${index}:${set}:${side}" value="${value}">`).join('')}`).join('')}
 </div>`
}

function courtFields(courts:CourtDraft[],roster:TeamResultPlayer[],showPlayers:boolean,assigningPlayers:boolean,bySet:boolean){
 const nameCounts=new Map<string,number>()
 const names=new Map(roster.map(({id,name})=>[id,name]))
 for(const player of roster){const key=player.name.toLowerCase();nameCounts.set(key,(nameCounts.get(key)??0)+1)}
 return courts.map(({score,outcome,players},index)=>`<div>
  ${assigningPlayers?`<p class="team-result-locked-score"><strong>Court ${index+1}</strong> · ${outcome==='played'?html(score):teamCourtDefaults[outcome]}</p>`:`
  <label>Court ${index+1} result<select data-court-outcome="${index}">${Object.entries(courtOutcomeLabels).map(([value,label])=>
   `<option value="${value}" ${outcome===value?'selected':''}>${label}</option>`).join('')}</select></label>
  ${outcome==='played'?courtScoreFields(index,score,bySet):''}`}
  ${outcome==='played'&&showPlayers?`<div class="team-result-player-fields">${[0,1].map(seat=>`
   <label>Court ${index+1} player ${seat+1}<select data-result-player="${index}:${seat}"><option value="">No player selected</option>
    ${roster.map(player=>`<option value="${html(player.id!)}" ${players[seat]===player.id?'selected':''}>${html(player.name)}${nameCounts.get(player.name.toLowerCase())!>1?' ('+html(player.id!.slice(-4).toUpperCase())+')':''}</option>`).join('')}
   </select></label>`).join('')}</div>`:outcome==='played'?`<p class="team-result-player-names">${html(players.map(id=>names.get(id)).filter(Boolean).join(' & ')||'No players assigned')}</p>`:''}
  ${!assigningPlayers&&courts.length>1?`<button type="button" class="secondary" data-remove-result-court="${index}" aria-label="Remove court ${index+1}">Remove</button>`:''}
 </div>`).join('')
}

function paintPlayerCoverage(form:HTMLFormElement,courts:CourtDraft[]){
 const played=courts.filter(court=>court.outcome==='played')
 const assigned=played.filter(court=>court.players.some(Boolean)).length
 const seen=new Set<string>(),duplicates=new Set<string>()
 for(const court of played)for(const id of court.players){
  if(!id)continue
  if(seen.has(id))duplicates.add(id)
  seen.add(id)
 }
 const coverage=form.querySelector<HTMLElement>('#result-player-coverage')!
 const text=duplicates.size?duplicatePlayerMessage:played.length?`Players assigned on ${assigned} of ${played.length} played ${played.length===1?'court':'courts'}.`:''
 if(coverage.textContent!==text)coverage.textContent=text
 coverage.classList.toggle('has-duplicate-players',Boolean(duplicates.size))
 for(const select of form.querySelectorAll<HTMLSelectElement>('[data-result-player]')){
  const duplicate=duplicates.has(select.value)
  select.setCustomValidity(duplicate?duplicatePlayerMessage:'')
  if(duplicate){
   select.setAttribute('aria-invalid','true')
   select.setAttribute('aria-describedby',coverage.id)
  }else{
   select.removeAttribute('aria-invalid')
   select.removeAttribute('aria-describedby')
  }
 }
}

function teamRecordHtml(record:TeamRecord|undefined){
 if(!record||record.wins+record.losses+record.ties===0)return ''
 return `<section class="team-record" aria-labelledby="team-record-title">
  <h3 id="team-record-title">Team record</h3>
  <dl><div><dt>Wins</dt><dd>${record.wins}</dd></div><div><dt>Losses</dt><dd>${record.losses}</dd></div>
   <div><dt>Ties</dt><dd>${record.ties}</dd></div></dl>
 </section>`
}

function teamResultsListHtml(data:TeamResults,filter:ResultFilter,busy:boolean,canOpenPersonal:boolean,getDraft:(entry:TeamResultEntry)=>ScoreDraft|undefined){
 const rows=data.entries.map((entry,index)=>({entry,index,court:myPlayedCourt(entry.score),draft:data.canEdit?getDraft(entry):undefined}))
 const mine=filter==='mine'
 const visible=mine?rows.filter(row=>row.court):rows
 const hasResults=rows.some(({entry})=>entry.score)
 const canFilter=mine||hasResults
 const today=canOpenPersonal?localCalendarDate():''
 const captainView=!mine&&data.canEdit
 const unfinished=captainView?visible.filter(({entry,draft})=>draft||!entry.score)
  .sort((a,b)=>Number(Boolean(b.draft))-Number(Boolean(a.draft))):[]
 const history=captainView?visible.filter(({entry,draft})=>entry.score&&!draft):visible
 const renderRow=({entry,index,court,draft}:typeof rows[number])=>{
  const {match,score,fixtureId}=entry
  const canLog=canOpenPersonal&&court&&match.date<=today
  const unassigned=data.canEdit&&!mine?score?.courtScores?.filter((value,position)=>!isTeamCourtDefault(value)&&!score.courtPlayers?.[position].length).length??0:0
  return `<li class="team-invite-preview" data-result-fixture="${fixtureId}" tabindex="-1">${teamNextMatchHtml(match)}
   ${mine&&court?`<p class="team-result-own-score"><strong>Court ${court.number} · ${court.outcome}</strong><span>${html(court.score)}</span></p>`:
    `${score?`<p><strong>${score.won}–${score.lost}</strong> · ${resultLabels[teamResultOutcome(score)]}</p>`:'<p>Score pending</p>'}
     ${courtScoreList(score?.courtScores,score?.courtPlayers)}`}
   ${unassigned?`<p class="team-result-assignment-note">${unassigned} played ${unassigned===1?'court needs':'courts need'} players</p>`:''}
   ${!busy&&(data.canEdit||canLog)?`<div class="team-result-actions">
    ${canLog?`<button type="button" class="secondary" data-log-court="${fixtureId}"><span>${openInLab}</span><span class="sr-only"> vs ${html(match.opponent)}</span></button>`:''}
    ${unassigned&&!draft?`<button type="button" class="secondary" data-result-edit="${index}" data-result-assign>Add players<span class="sr-only"> vs ${html(match.opponent)}</span></button>`:''}
    ${data.canEdit?`<button type="button" ${score&&!draft?'class="secondary" ':''}data-result-edit="${index}">${draft?(draft.assigningPlayers?'Resume player assignments':'Resume score draft'):score?'Correct score':'Enter score'}<span class="sr-only"> vs ${html(match.opponent)}</span></button>`:''}
    ${data.canEdit&&score?`<button type="button" class="secondary" data-result-draft="${index}">Draft result in chat<span class="sr-only"> vs ${html(match.opponent)}</span></button>`:''}
   </div>`:''}</li>`
 }
 return `${canFilter?`<div class="team-result-filters" role="group" aria-label="Results view">
  ${Object.entries(resultFilters).map(([key,label])=>`<button type="button" class="secondary" data-result-filter="${key}"
   aria-pressed="${filter===key}" ${busy?'disabled':''}>${label}</button>`).join('')}
 </div>`:''}
 ${unfinished.length?`<div class="team-result-queue">
  <h3 id="team-scores-to-finish">Scores to finish</h3>
  <ul class="team-result-list" role="list" aria-labelledby="team-scores-to-finish">${unfinished.map(renderRow).join('')}</ul>
 </div>`:''}
 ${mine?'':teamRecordHtml(data.record)}
 ${history.length?`<ul class="team-result-list" role="list" aria-label="${mine?'Your recent courts':'Recent team matches'}">${history.map(renderRow).join('')}</ul>`:''}
 ${visible.length?'':mine?`<p>No confirmed courts for you in these matches.</p>${hasResults?'<p>Ask your captain to add your name to the court you played.</p>':''}`:'<p>No team results yet.</p>'}
 ${data.more?`<p>${mine?'Showing your courts from the 20 most recent matches.':'Showing the 20 most recent matches.'}</p>`:''}`
}

async function requestTeamResultResponse(client:SupabaseClient,owner:string,room:NativeTeamRoom,active:()=>boolean,
 operation:'team-results'|'result-roster',change?:TeamResultChange){
 const {data,error}=await client.auth.getSession()
 if(error||data.session?.user.id!==owner||!active())throw new TeamNextMatchError('Your team access could not be confirmed.')
 const {teamName,leagueName,flight}=room
 const headers={Authorization:'Bearer '+data.session.access_token}
 const options={responseType:'json' as const,disableRedirects:true,connectTimeout:12000,readTimeout:15000}
 const query=new URLSearchParams({op:operation,team:teamName,league:leagueName,flight})
 const unavailable=()=>new TeamNextMatchError(change?'The score could not be confirmed. Retry the same score.':
  operation==='result-roster'?'Couldn’t load the team roster. Try again.':'Couldn’t load team results. Try again.',Boolean(change))
 let response
 try{
  response=change
   ?await CapacitorHttp.post({...options,url:firstPartyTeamRooms,headers:{...headers,'Content-Type':'application/json'},
    data:{action:'save_team_result',teamName,leagueName,flight,roomId:room.id,...change}})
   :await CapacitorHttp.get({...options,url:firstPartyTeamRooms+'?'+query,headers})
 }catch{throw unavailable()}
 if(!active())throw unavailable()
 if(response.status===409)throw new TeamNextMatchError('The match, score, or team roster changed. Reload the team results.',false,409)
 if(response.status===403||response.status===401)throw new TeamNextMatchError('Your team access could not be confirmed.',false,403)
 if(response.status===400&&change)throw new TeamNextMatchError('Check the court results and team tally.',false,400)
 const result=response.data
 if(response.status!==200||result?.ok!==true||result.roomId!==room.id||!matchesTeamReleaseScope(result,owner))throw unavailable()
 if(change&&(result.fixtureId!==change.fixtureId||result.score?.revision!==change.revision||
    result.score.won!==change.won||result.score.lost!==change.lost||
    change.courtScores!==undefined&&JSON.stringify(result.score.courtScores)!==JSON.stringify(change.courtScores)||
    change.courtPlayerIds!==undefined&&JSON.stringify(result.score.courtPlayerIds)!==JSON.stringify(change.courtPlayerIds)))throw unavailable()
 return result
}

export function openTeamResults(client:SupabaseClient,owner:string,room:NativeTeamRoom,current:()=>boolean,drafts:TeamScoreDraftSession,
 onClose:(message?:string)=>void,canDraft:()=>boolean,onScheduleNext:(previous:ReviewedNextMatch)=>void,
 openPersonal?:(seed:CalendarScorecardSeed,position:TeamResultsPosition)=>void,entry?:TeamResultsEntryPoint){
 const dialog=document.createElement('dialog')
 dialog.className='team-invite-dialog team-next-match-dialog'
 dialog.setAttribute('aria-label','Team results')
 document.body.append(dialog)
 let disposed=false,busy=false,notice=''
 const position=entry&&'position' in entry?entry.position:undefined
 let chatMatch=entry&&'chatMatch' in entry?entry.chatMatch:undefined
 let filter:ResultFilter=position?.filter??'all'
 let returnFixture=position?.fixtureId
 let data:TeamResults|null=null,edit:TeamResultEntry|null=null,pending:TeamResultChange|null=null
 let won='',lost=''
 let courts:CourtDraft[]|null=null
 let roster:TeamResultPlayer[]|null=null,showPlayers=false,loadingPlayers=false,confirmedPlayers=false
 let assigningPlayers=false,scoreBySet=false
 let restoredPlayers:TeamResultPlayer[]=[],dirty=false
 let plannedLineupExpanded=false
 let postedMatch:ReviewedNextMatch|null=null
 let savedScores:ReadonlyMap<string,TeamScore|null>|undefined
 const active=()=>!disposed&&current()
 const draftKey=(entry:TeamResultEntry)=>teamResultScorecardKey(room.id,entry.fixtureId)
 const currentDraft=(entry:TeamResultEntry)=>{
  const draft=drafts.get(draftKey(entry))
  return draft?.expected===(entry.score?.revision??null)?draft:undefined
 }
 const dispose=()=>{if(!disposed){remember();void drafts.flush();disposed=true;dialog.remove()}}
 const close=()=>{if(!disposed&&!busy){dispose();onClose()}}
 const focus=(target='h2')=>dialog.querySelector<HTMLElement>(target)?.focus({preventScroll:true})
 const loadResults=async()=>readTeamResults((await requestTeamResultResponse(client,owner,room,active,'team-results')).results)
 const availablePlayers=()=>[...new Map([...(edit?.score?.courtPlayers?.flat()??[]),...restoredPlayers,...(roster??[])]
  .filter(player=>player.id).map(player=>[player.id,player])).values()]
 function remember(){
  if(!edit||!dirty)return
  const selected=new Set(courts?.flatMap(court=>court.players))
  drafts.set(draftKey(edit),{expected:edit.score?.revision??null,lineupVersion:edit.plannedLineup?.version,won,lost,
   courts:courts&&structuredClone(courts),assigningPlayers,confirmedPlayers,players:availablePlayers().filter(player=>selected.has(player.id!)),pending,
   ...(scoreBySet?{scoreBySet:true}:{})})
 }
 const changed=()=>{dirty=true;remember()}
 const paintScorecardLabels=()=>{
  for(const button of dialog.querySelectorAll<HTMLButtonElement>('[data-log-court]')){
   const entry=data?.entries.find(item=>item.fixtureId===button.dataset.logCourt)
   if(!entry)continue
   const court=myPlayedCourt(entry.score)
   const saved=savedScores?.get(teamResultScorecardKey(room.id,entry.fixtureId))
   button.firstElementChild!.textContent=saved===null?'Log my court in My Lab':
    saved&&court?(teamScoreDiffers(saved,court)?'Review team score in My Lab':'View saved scorecard in My Lab'):openInLab
  }
 }
 const refreshSavedScores=async()=>{
  const entries=data?.entries
  if(!openPersonal||!entries)return
  const today=localCalendarDate()
  const keys=entries.filter(entry=>entry.match.date<=today&&myPlayedCourt(entry.score))
   .map(entry=>teamResultScorecardKey(room.id,entry.fixtureId))
  if(!keys.length)return
  const currentEntries=()=>active()&&data?.entries===entries
  try{
   const saved=await loadSavedTeamScores(client,owner,keys,currentEntries)
   if(currentEntries()){savedScores=saved;paintScorecardLabels()}
  }catch{
   // Opening My Lab still checks the individual scorecard before offering a new entry.
  }
 }
 const load=async()=>{
  if(busy||!active())return
  busy=true;notice='Loading team results…';edit=null;pending=null;data=null;postedMatch=null;roster=null;savedScores=undefined;render()
  try{
   data=await loadResults()
   if(data.canEdit)await drafts.load()
   if(!active())return
   notice=''
   let changed=false,posted=''
   if(data.canEdit)for(const entry of data.entries){
    const key=draftKey(entry),draft=drafts.get(key)
    if(!draft||currentDraft(entry))continue
    drafts.delete(key)
    if(draft.pending&&draft.pending.revision===entry.score?.revision)posted=draft.assigningPlayers?'Player assignments saved.':'Your score was posted for the team.'
    else changed=true
   }
   if(changed)notice='A team score changed while you were editing. Review the latest result before making changes.'
   else if(posted)notice=posted
   if(changed||posted)void drafts.flush()
   void refreshSavedScores()
  }
  catch(cause){notice=cause instanceof TeamNextMatchError?cause.message:'Couldn’t load team results. Try again.'}
  finally{if(active()){
   busy=false;render()
   const target=returnFixture&&dialog.querySelector<HTMLButtonElement>(`[data-log-court="${returnFixture}"]`)
   const matches=chatMatch&&data?.entries.filter(({match,score})=>score&&resultChatMatchLabel(match)===chatMatch)
   const row=matches&&matches.length===1&&dialog.querySelector<HTMLElement>(`[data-result-fixture="${matches[0].fixtureId}"]`)
   if(target)target.focus()
   else if(row){
    const scores=row.querySelector<HTMLDetailsElement>('.team-result-court-list')
    if(scores)scores.open=true
    row.focus()
   }
   else focus(notice?'[role="status"]':'h2')
   if(data){returnFixture=undefined;chatMatch=undefined}
  }}
 }
 const confirmPlayers=async()=>{
  if(!active()||busy||loadingPlayers||!edit||!courts)return
  const entry=edit
  loadingPlayers=true;notice='Loading your team roster…';render()
  try{
   roster??=readTeamResultPlayers((await requestTeamResultResponse(client,owner,room,active,'result-roster')).players,true)
   if(!active()||edit!==entry||!courts)return
   if(!confirmedPlayers&&!entry.score?.courtPlayers){
    const eligible=new Set(roster.map(player=>player.id))
    for(const court of courts)if(court.outcome==='played'&&court.plannedPlayers)court.players=court.plannedPlayers.filter(id=>eligible.has(id))
   }
   showPlayers=confirmedPlayers=true;changed();notice=''
  }catch(cause){notice=cause instanceof TeamNextMatchError?cause.message:'Couldn’t load the team roster. Try again.'}
  finally{if(active()){
   loadingPlayers=false;render()
   const missing=assigningPlayers?(courts?.findIndex(court=>court.outcome==='played'&&!court.players.some(Boolean))??-1):-1
   const target=notice?'[role="status"]':missing>=0?`[data-result-player="${missing}:0"]`:'[data-result-player]'
   if(assigningPlayers)dialog.querySelector<HTMLElement>(target)?.focus()
   else focus(target)
  }}
 }
 const save=async(change:TeamResultChange)=>{
  if(!active()||busy||loadingPlayers||!edit||!data?.canEdit)return
  busy=dirty=true;pending=change;remember();notice=assigningPlayers?'Saving player assignments…':'Posting the team score…';render()
  try{
   await drafts.flush()
   if(!active())return
   await requestTeamResultResponse(client,owner,room,active,'team-results',change)
   if(!active())return
   if(data.record){
    if(edit.score)data.record[teamResultOutcome(edit.score)]--
    data.record[teamResultOutcome(change)]++
   }
   const players=new Map(availablePlayers().map(player=>[player.id,player]))
   const courtPlayers=change.courtPlayerIds?.map(ids=>ids.flatMap(id=>{
    const player=players.get(id)
    return player?[player]:[]
   }))
   const myCourt=(change.courtPlayerIds?.findIndex(ids=>ids.includes(owner))??-1)+1
   data.entries=data.entries.map(entry=>entry.fixtureId===change.fixtureId
    ?{...entry,score:{revision:change.revision,won:change.won,lost:change.lost,
     ...(change.courtScores===undefined?{}:{courtScores:change.courtScores}),...(courtPlayers?.some(players=>players.length)?{courtPlayers}:{}),
     ...(myCourt?{myCourt}:{})}}:entry)
   if(!edit.score&&room.canScheduleMatch)postedMatch=edit.match
   drafts.delete(draftKey(edit))
   void drafts.flush()
   pending=null;edit=null;notice=assigningPlayers?'Player assignments saved.':'Result posted for your team.'
   void refreshSavedScores()
  }catch(cause){
   if(!active())return
   notice=cause instanceof TeamNextMatchError?cause.message:'The score could not be confirmed. Retry the same score.'
   if(assigningPlayers&&cause instanceof TeamNextMatchError&&cause.uncertain)notice='Couldn’t confirm the player assignments. Retry the same update.'
   if(cause instanceof TeamNextMatchError&&!cause.uncertain){
    pending=null
    remember()
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
   const latest=await loadResults()
   if(!active())return
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
   const message=`${room.teamName} ${outcome} ${score.won}–${score.lost} on courts vs ${resultChatMatchLabel(match)}. ${resultChatHint}`
   dispose()
   onClose(message)
  }catch(cause){
   notice=cause instanceof TeamNextMatchError?cause.message:'Couldn’t check the latest score. Reload the results.'
  }finally{if(active()){busy=false;render();focus('[role="status"]')}}
 }
 const logMyCourt=async(entry:TeamResultEntry)=>{
  if(!active()||busy||!openPersonal||!myCourtScorecard(room.id,entry))return
  let seed:CalendarScorecardSeed|undefined
  busy=true;postedMatch=null;notice='Checking your court result…';render()
  try{
   const latest=await loadResults()
   if(!active())return
   data=latest
   const result=latest.entries.find(item=>item.fixtureId===entry.fixtureId)
   if(!result?.score||result.score.revision!==entry.score?.revision||result.score.myCourt!==entry.score?.myCourt){
    notice='Your court result changed. Review the latest score before opening it.';void refreshSavedScores();return
   }
   seed=myCourtScorecard(room.id,result)
   notice=seed?'':'This court result is unavailable to log.'
  }catch(cause){notice=cause instanceof TeamNextMatchError?cause.message:'Couldn’t check your court result. Reload the results.'}
  finally{if(active()){busy=false;if(!seed){render();focus('[role="status"]')}}}
  if(seed&&active()){dispose();onClose();openPersonal(seed,{filter,fixtureId:entry.fixtureId})}
 }
 const render=()=>{
  if(!active())return
  const hasPlayedCourt=courts?.some(court=>court.outcome==='played')
  const status=`<p role="status" tabindex="-1" data-invite-feedback>${html(notice)}</p>`
  dialog.innerHTML=`<header class="team-invite-heading"><h2 tabindex="-1">Team results</h2></header>
   <p>${html(room.teamName)} · ${html(teamLeagueLabel(room))}${room.flight?' · '+html(room.flight):''}</p>
   ${postedMatch?`<div class="team-invite-preview">${status}
    <button type="button" data-schedule-next-match>Schedule next match</button></div>`:''}
   ${!pending&&edit?`<div class="team-invite-preview">${teamNextMatchHtml(edit.match)}
    ${edit.plannedLineup?plannedLineupHtml(edit.plannedLineup,plannedLineupExpanded):''}</div>
    <form data-result-form>
     ${courts?`${assigningPlayers?'':`<div class="team-result-filters" role="group" aria-label="Score entry">
      <button type="button" class="secondary" data-score-entry="text" aria-pressed="${!scoreBySet}">Type score</button>
      <button type="button" class="secondary" data-score-entry="sets" aria-pressed="${scoreBySet}">By set</button>
     </div><p>${scoreBySet?'Use Set 3 for a deciding set or match tiebreak.':'Enter your team’s score first in each set. Use completed best-of-three scores like 6-4, 4-6, 10-8.'}</p>`}
      ${hasPlayedCourt?`<p>Assign players so they can find their scores under Your courts.${showPlayers?' Leave player 2 empty for singles.':''}</p>
       ${showPlayers?'':`<button type="button" class="secondary" data-result-players ${loadingPlayers?'disabled':''}>${confirmedPlayers||edit.score?.courtPlayers?'Edit who played':'Confirm who played'}</button>`}`:''}
      <div class="team-result-court-fields">${courtFields(courts,availablePlayers(),showPlayers,assigningPlayers,scoreBySet)}</div>
      <p data-court-tally aria-live="polite">${courtTallyText(courts)}</p>
      <p id="result-player-coverage" aria-live="polite"></p>
      ${assigningPlayers?'':`${courts.length<maxTeamResultCourts?'<button type="button" class="secondary" data-add-result-court>Add another court</button>':''}
      <button type="button" class="secondary" data-result-totals-only>Use totals only</button>`}`:
      `<p>Enter the final court tally from your team’s perspective.</p>
     <label>Courts won<input name="won" type="number" min="0" max="99" step="1" required value="${html(won)}"></label>
     <label>Courts lost<input name="lost" type="number" min="0" max="99" step="1" required value="${html(lost)}"></label>
     ${edit.score?.courtScores?.length?'<p>Posting totals clears the saved court scores.</p>':''}
     <button type="button" class="secondary" data-result-court-mode>Add court scores</button>`}
     <button type="submit" ${loadingPlayers||assigningPlayers&&!showPlayers?'disabled':''}>${assigningPlayers?'Save player assignments':'Post team score'}</button><button type="button" class="secondary" data-result-cancel>Discard changes</button>
    </form>`:!pending&&data?teamResultsListHtml(data,filter,busy,Boolean(openPersonal),currentDraft):''}
   ${postedMatch?'':status}
   ${!busy&&pending?`<button type="button" data-result-retry>${assigningPlayers?'Retry player assignments':'Retry same score'}</button>`:''}
   ${!busy&&!edit?'<button type="button" class="secondary" data-result-load>Reload results</button>':''}
   <button type="button" class="secondary" data-result-close ${busy?'disabled':''}>Close</button>`
  dialog.querySelector<HTMLButtonElement>('[data-result-close]')!.onclick=close
  const plannedLineup=dialog.querySelector<HTMLDetailsElement>('[data-planned-lineup]')
  if(plannedLineup)plannedLineup.ontoggle=()=>{if(plannedLineup.isConnected)plannedLineupExpanded=plannedLineup.open}
  const focusCourt=(index:number)=>{
   focus(courts?.[index]?.outcome==='played'
    ?`[data-court-score="${index}"],[data-court-set="${index}:0:0"]`
    :`[data-court-outcome="${index}"]`)
  }
  dialog.querySelectorAll<HTMLButtonElement>('[data-score-entry]').forEach(button=>{button.onclick=()=>{
   const bySet=button.dataset.scoreEntry==='sets'
   if(bySet===scoreBySet)return
   scoreBySet=bySet
   remember()
   render();focus(`[data-score-entry="${bySet?'sets':'text'}"]`)
  }})
  dialog.querySelector('[data-schedule-next-match]')?.addEventListener('click',()=>{
   if(!active()||busy||!postedMatch)return
   const previous=postedMatch
   dispose();onScheduleNext(previous)
  })
  dialog.querySelector('[data-result-load]')?.addEventListener('click',()=>{void load()})
  dialog.querySelector('[data-result-retry]')?.addEventListener('click',()=>{if(pending)void save(pending)})
  dialog.querySelectorAll<HTMLButtonElement>('[data-result-filter]').forEach(button=>{button.onclick=()=>{
   const next=button.dataset.resultFilter
   if(busy||(next!=='all'&&next!=='mine')||next===filter)return
   filter=next;notice='';render()
   const selected=dialog.querySelector<HTMLButtonElement>(`[data-result-filter="${next}"]`)
   if(selected)selected.focus({preventScroll:true})
   else focus()
  }})
  dialog.querySelectorAll<HTMLButtonElement>('[data-log-court]').forEach(button=>{button.onclick=()=>{
   const entry=data?.entries.find(item=>item.fixtureId===button.dataset.logCourt)
   if(entry)void logMyCourt(entry)
  }})
  paintScorecardLabels()
  dialog.querySelector('[data-result-cancel]')?.addEventListener('click',()=>{
   if(!edit)return
   const index=data?.entries.indexOf(edit)
   drafts.delete(draftKey(edit))
   void drafts.flush()
   edit=null;notice='';render()
   const selector=`[data-result-edit="${index}"]`
   focus(selector+(assigningPlayers?'[data-result-assign]':':not([data-result-assign])'))
  })
  dialog.querySelectorAll<HTMLButtonElement>('[data-result-edit]').forEach(button=>{button.onclick=()=>{
   edit=data?.entries[Number(button.dataset.resultEdit)]??null
   if(!edit)return
   postedMatch=null
   plannedLineupExpanded=false
   const draft=currentDraft(edit)
   assigningPlayers=draft?.assigningPlayers??button.hasAttribute('data-result-assign')
   scoreBySet=draft?.scoreBySet??false
   showPlayers=false
   confirmedPlayers=draft?.confirmedPlayers??false
   restoredPlayers=draft?.players??[]
   dirty=Boolean(draft)
   pending=draft?.pending??null
   won=draft?.won??(edit.score?String(edit.score.won):'')
   lost=draft?.lost??(edit.score?String(edit.score.lost):'')
   notice=pending?(assigningPlayers?'Couldn’t confirm the player assignments. Retry the same update.':'Couldn’t confirm your score was posted. Retry the same score.'):''
   courts=draft?structuredClone(draft.courts):recordedCourts(edit)??null
   if(draft&&draft.lineupVersion!==edit.plannedLineup?.version){
    for(const court of courts??[])delete court.plannedPlayers
   }
   if(courts&&!courts.length)courts=null
   render()
   if(pending)focus('[role="status"]')
   else if(assigningPlayers)void confirmPlayers()
   else if(courts)focusCourt(0)
   else focus('[name="won"]')
  }})
  dialog.querySelectorAll<HTMLButtonElement>('[data-result-draft]').forEach(button=>{button.onclick=()=>{
   const entry=data?.entries[Number(button.dataset.resultDraft)]
   if(entry){postedMatch=null;void draftResult(entry)}
  }})
  const form=dialog.querySelector<HTMLFormElement>('[data-result-form]')
  if(form&&courts)paintPlayerCoverage(form,courts)
  dialog.querySelector('[data-result-players]')?.addEventListener('click',()=>{void confirmPlayers()})
  dialog.querySelector('[data-result-court-mode]')?.addEventListener('click',()=>{
   if(!form||!edit)return
   const fields=new FormData(form)
   won=String(fields.get('won')??'');lost=String(fields.get('lost')??'')
   courts=edit.score?.courtScores?.length?recordedCourts(edit)!:edit.plannedLineup?.courts.map(({players})=>courtDraft('',[],players))??[courtDraft()]
   changed()
   notice='';render();focusCourt(0)
  })
  dialog.querySelector('[data-result-totals-only]')?.addEventListener('click',()=>{
   const tally=courts&&courtTally(courts)
   if(tally){won=String(tally.won);lost=String(tally.lost)}
   courts=null;showPlayers=confirmedPlayers=false;restoredPlayers=[];changed();notice='';render();focus('[name="won"]')
  })
  dialog.querySelector('[data-add-result-court]')?.addEventListener('click',()=>{
   if(!courts||courts.length>=maxTeamResultCourts)return
   courts.push(courtDraft());changed();notice='';render();focusCourt(courts.length-1)
  })
  dialog.querySelectorAll<HTMLButtonElement>('[data-remove-result-court]').forEach(button=>{button.onclick=()=>{
   if(!courts||courts.length<2)return
   const index=Number(button.dataset.removeResultCourt)
   courts.splice(index,1);changed();notice='';render();focusCourt(Math.min(index,courts.length-1))
  }})
  dialog.querySelectorAll<HTMLSelectElement>('[data-court-outcome]').forEach(select=>{select.onchange=()=>{
   if(!courts)return
   const index=Number(select.dataset.courtOutcome)
   courts[index].outcome=isTeamCourtDefault(select.value)?select.value:'played'
   changed()
   notice='';render();focus(`[data-court-outcome="${index}"]`)
  }})
  dialog.querySelectorAll<HTMLSelectElement>('[data-result-player]').forEach(select=>{select.onchange=()=>{
   if(!form||!courts)return
   const [index,seat]=select.dataset.resultPlayer!.split(':').map(Number)
   courts[index].players[seat]=select.value
   changed()
   paintPlayerCoverage(form,courts)
  }})
  const updateCourtScore=(index:number,value:string)=>{
   if(!courts)return
   courts[index].score=value
   changed()
   const tally=dialog.querySelector('[data-court-tally]')!
   const text=courtTallyText(courts)
   if(tally.textContent!==text)tally.textContent=text
  }
  dialog.querySelectorAll<HTMLInputElement>('[data-court-score]').forEach(input=>{
   input.oninput=()=>updateCourtScore(Number(input.dataset.courtScore),input.value)
  })
  dialog.querySelectorAll<HTMLInputElement>('[data-court-set]').forEach(input=>{input.oninput=()=>{
   if(!courts)return
   const [index,set,side]=input.dataset.courtSet!.split(':').map(Number)
   const pairs=scorePairs(courts[index].score)
   if(!pairs)return
   const value=input.value.replace(/[^0-9]/g,'').slice(0,2)
   if(input.value!==value)input.value=value
   pairs[set][side]=value
   while(pairs.length&&pairs.at(-1)?.every(game=>!game))pairs.pop()
   updateCourtScore(index,pairs.map(pair=>pair.join('-')).join(', '))
  }})
  form?.querySelectorAll<HTMLInputElement>('input[name="won"],input[name="lost"]').forEach(input=>{input.oninput=()=>{
   if(input.name==='won')won=input.value
   else lost=input.value
   changed()
  }})
  form?.addEventListener('submit',event=>{
   event.preventDefault()
   if(!edit||busy||loadingPlayers||assigningPlayers&&!showPlayers)return
   let tally:{won:number;lost:number;courtScores?:string[]}|null
   if(assigningPlayers&&edit.score){
    const {won,lost,courtScores}=edit.score
    tally={won,lost,courtScores}
   }else if(courts)tally=courtTally(courts)
   else{
    const fields=new FormData(event.currentTarget as HTMLFormElement)
    won=String(fields.get('won')??'');lost=String(fields.get('lost')??'')
    tally=won&&lost?{won:Number(won),lost:Number(lost),...(edit.score?.courtScores?.length?{courtScores:[]}: {})}:null
   }
   const courtPlayerIds=courts&&(confirmedPlayers||edit.score?.courtPlayers)?courts.map(court=>
    court.outcome==='played'?court.players.filter(Boolean):[]):undefined
   if(assigningPlayers&&courtPlayerIds?.every((ids,index)=>
    JSON.stringify(ids)===JSON.stringify(edit?.score?.courtPlayers?.[index].map(player=>player.id)??[]))){
    dialog.querySelector('[role="status"]')!.textContent='Update a player assignment before saving.'
    focus('[role="status"]')
    return
   }
   const change=tally&&readTeamResultChange({fixtureId:edit.fixtureId,revision:crypto.randomUUID(),
    expected:edit.score?.revision??null,...tally,...(courtPlayerIds?{courtPlayerIds}:{})})
   if(change){void save(change);return}
   dialog.querySelector('[role="status"]')!.textContent=tally&&courtPlayerIds?duplicatePlayerMessage:
    courts?'Enter a completed best-of-three score or choose a default for each court.':'Enter the final number of courts won and lost.'
   focus('[role="status"]')
  })
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()})
 void load()
 dialog.showModal()
 focus()
 return {isOpen:()=>!disposed,close,dispose}
}
