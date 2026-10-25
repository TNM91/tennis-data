import {loadHistoricalCheck,historicalCheckHtml} from './historical-rating-check'
import type {HistoricalCheck} from '../../lib/historical-rating-check'
import {loadOpponentMeetings,opposingMeetings,opponentHistoryHtml,type OpponentHistory} from './opponent-meetings'
import {sharedComparisonCards,loadComparisonRatingHistory,ratingHistoryHtml,type PlayerRatingHistory} from './comparison-rating-context'
import {comparisonPreparation,courtsideHtml,bindCourtside} from './matchup-preparation'
import {openLabGoals} from './lab-goals-view'
import type {SupabaseClient} from '@supabase/supabase-js'
import {MATCHUP_STORY,MEMBERSHIP_TIERS} from '../../lib/product-story'
import type {RatingView} from '../../lib/player-rating-display'
import {canFollowPlayers as canUsePlayerInsights} from './follows-data'
import {findPlayers,type PlayerChoice} from './player-connection'
import {loadComparison,comparisonCard,type ComparedPlayer} from './comparison-data'
import {showExplore as showPlayer} from './explore'
import {html,createMatchDetails} from './match-details'
export function showComparison(app:HTMLElement,client:SupabaseClient,isCurrent:()=>boolean) {
 let notes:ReturnType<typeof openLabGoals>|null=null,matchType:'singles'|'doubles'='singles';let disposed=false,revision=0,view:RatingView='overall',data:ComparedPlayer[]|null=null,detail:ReturnType<typeof showPlayer>|null=null,scroll=0
 let meetings:ReturnType<typeof createMatchDetails>|null=null
 const valid=()=>!disposed && isCurrent()
 app.innerHTML='<h1 tabindex="-1">Matchup</h1><p role="status">Checking your player access…</p>'
 app.querySelector<HTMLElement>('h1')!.focus()
 const start=async()=>{
  try {
   const allowed=await canUsePlayerInsights(client,valid)
   if(!valid())return
   if(!allowed){app.innerHTML=`<h1 tabindex="-1">Matchup</h1><p>Player comparison is included with ${html(MEMBERSHIP_TIERS.player_plus.name)} access.</p>`;return}
   setup()
  }catch{
   if(!valid())return
   app.innerHTML='<h1 tabindex="-1">Matchup</h1><p role="alert">Can’t check your access. Check your connection and try again.</p><button type="button" class="secondary">Retry access</button>'
   app.querySelector<HTMLButtonElement>('button')!.onclick=()=>{void start()}
  }
 }
 function setup(){
  let historical:HistoricalCheck|null=null,checkBusy=false,checkNotice=''
  let opponentHistory:OpponentHistory|null=null,opponentBusy=false,opponentNotice=''
  let histories:PlayerRatingHistory[]|null=null,historyBusy=false,historyNotice=''
  const updateHistory=()=>{const host=app.querySelector<HTMLElement>('[data-rating-history]');if(!host||!data)return;const restoreFocus=host.contains(document.activeElement);host.innerHTML='<h2>Rating history and form</h2><button type="button" class="secondary" data-load-history '+(historyBusy?'disabled':'')+'>'+(histories?'Refresh rating history':'Load rating history')+'</button><p role="status" tabindex="-1">'+html(historyNotice)+'</p>'+ratingHistoryHtml(data,histories);host.querySelector<HTMLButtonElement>('[data-load-history]')!.onclick=async()=>{if(historyBusy||!valid()||!data)return;const request=revision,players=data;historyBusy=true;histories=null;historyNotice='Loading rating snapshots…';updateHistory();try{const rows=await loadComparisonRatingHistory(client,players,()=>valid()&&request===revision);if(!valid()||request!==revision)return;histories=rows;historyNotice=rows.some(r=>r.unavailable)?'Some player histories are unavailable. Refresh to try again.':'History loaded. Form uses the last five saved split snapshots, not five matches.'}catch{if(valid()&&request===revision)historyNotice='Rating history unavailable. Check your connection and try again.'}finally{if(valid()&&request===revision){historyBusy=false;updateHistory()}}};if(restoreFocus)host.querySelector<HTMLElement>(historyBusy?'[role="status"]':'[data-load-history]')?.focus({preventScroll:true})}
  const updateOpponents=()=>{
   const host=app.querySelector<HTMLElement>('[data-opponent-history]');if(!host||!data)return
   const focus=host.contains(document.activeElement)
   host.innerHTML='<h2>Head-to-head</h2><button type="button" class="secondary" data-load-opponents '+(opponentBusy?'disabled':'')+'>'+(opponentHistory?'Refresh meeting history':'Load meeting history')+'</button><p role="status" tabindex="-1">'+html(opponentNotice)+'</p>'+opponentHistoryHtml(data,opponentHistory,view)
   host.querySelector<HTMLButtonElement>('[data-load-opponents]')!.onclick=async()=>{
    if(opponentBusy||!valid()||!data)return
    const request=revision,players=data;opponentBusy=true;opponentHistory=null;opponentNotice='Finding opposing meetings…';updateOpponents()
    try{const loaded=await loadOpponentMeetings(client,players,()=>valid()&&request===revision);if(!valid()||request!==revision)return;opponentHistory=loaded;opponentNotice='Meeting search complete. Unfinished results stay pending.'}
    catch{if(valid()&&request===revision)opponentNotice='Meeting history unavailable. Check your connection and try again.'}
    finally{if(valid()&&request===revision){opponentBusy=false;updateOpponents()}}
   }
   const rows=opponentHistory?opposingMeetings(opponentHistory.rows,data.map(p=>p.player.id),view):[]
   host.querySelectorAll<HTMLButtonElement>('[data-opponent-meeting]').forEach(button=>{button.onclick=()=>{if(!valid()||!data)return;meetings?.dispose();meetings=createMatchDetails(app,client,valid,{backLabel:'Back to comparison',sideLabel:data.slice(0,data.length/2).map(p=>p.player.name).join(' / ')});meetings.open(rows[Number(button.dataset.opponentMeeting)],data[0].player.id)}})
   if(focus)host.querySelector<HTMLElement>(opponentBusy?'[role="status"]':'[data-load-opponents]')?.focus({preventScroll:true})
  }
  const updateCheck=()=>{
   const host=app.querySelector<HTMLElement>('[data-historical-check]');if(!host||!data)return
   const focus=host.contains(document.activeElement)
   host.innerHTML='<h2>Historical rating check</h2><button type="button" class="secondary" data-load-check '+(checkBusy?'disabled':'')+'>'+(historical?'Refresh historical check':'Load historical check')+'</button><p role="status" tabindex="-1">'+html(checkNotice)+'</p>'+historicalCheckHtml(historical)
   host.querySelector<HTMLButtonElement>('[data-load-check]')!.onclick=async()=>{
    if(checkBusy||!valid()||!data)return;const request=revision;checkBusy=true;historical=null;checkNotice='Checking recent '+matchType+' results…';updateCheck()
    try{const report=await loadHistoricalCheck(client,matchType,()=>valid()&&request===revision);if(!valid()||request!==revision)return;historical=report;checkNotice=report.bands.overall.total?'Historical check loaded.':'No usable completed results in this sample.'}
    catch{if(valid()&&request===revision)checkNotice='Historical check unavailable. Check your connection and try again.'}
    finally{if(valid()&&request===revision){checkBusy=false;updateCheck()}}
   }
   if(focus)host.querySelector<HTMLElement>(checkBusy?'[role="status"]':'[data-load-check]')?.focus({preventScroll:true})
  }
  app.innerHTML=`<div id="comparison-list"><small>Matchup</small><h1 tabindex="-1">${html(MATCHUP_STORY.headline)}</h1><p>Compare singles or doubles, review the rating-based read, and save a courtside plan.</p><div role="group" aria-label="Match type"><button type="button" class="secondary" data-match-type="singles" aria-pressed="${matchType==='singles'}">Singles</button><button type="button" class="secondary" data-match-type="doubles" aria-pressed="${matchType==='doubles'}">Doubles</button></div><div id="comparison-pickers"></div><button type="button" id="compare-players" disabled>Compare players</button><p role="status" id="comparison-status"></p><div id="comparison-result"></div></div><div id="comparison-player" hidden></div>`
  app.querySelector<HTMLElement>('h1')!.focus()
  const list=app.querySelector<HTMLElement>('#comparison-list')!,playerHost=app.querySelector<HTMLElement>('#comparison-player')!,result=list.querySelector<HTMLElement>('#comparison-result')!,status=list.querySelector<HTMLElement>('#comparison-status')!,compare=list.querySelector<HTMLButtonElement>('#compare-players')!
  const chosen:Array<PlayerChoice|null>=Array.from({length:matchType==='doubles'?4:2},()=>null)
  const pickerRevision=chosen.map(()=>0)
  list.querySelectorAll<HTMLButtonElement>('[data-match-type]').forEach(b=>{b.onclick=()=>{if(!valid()||notes?.isOpen())return;revision++;data=null;meetings?.dispose();meetings=null;matchType=b.dataset.matchType as 'singles'|'doubles';view=matchType;setup();app.querySelector<HTMLElement>('[data-match-type="'+matchType+'"]')?.focus()}})
  const pickers=list.querySelector<HTMLElement>('#comparison-pickers')!
  pickers.innerHTML=chosen.map((_,index)=>`<section data-picker="${index}"><h2>${matchType==='doubles'?(index<2?'Your side':'Other side')+' · ':''}Player ${index+1}</h2><form><label>Player ${index+1} name<input type="search" minlength="2" maxlength="80" required autocomplete="off"></label><button class="secondary">Search player ${index+1}</button></form><p role="status"></p><div class="comparison-choices"></div></section>`).join('')
  const reset=()=>{historical=null;checkBusy=false;checkNotice='';opponentHistory=null;opponentBusy=false;opponentNotice='';histories=null;historyBusy=false;historyNotice='';meetings?.dispose();meetings=null;revision++;data=null;result.innerHTML='';status.textContent='';compare.disabled=chosen.some(p=>!p)||new Set(chosen.filter(p=>p).map(p=>p!.id)).size!==chosen.filter(p=>p).length;if(new Set(chosen.filter(p=>p).map(p=>p!.id)).size!==chosen.filter(p=>p).length)status.textContent='Choose different players for every slot.'}
  pickers.querySelectorAll<HTMLElement>('[data-picker]').forEach(panel=>{
   const index=Number(panel.dataset.picker),form=panel.querySelector<HTMLFormElement>('form')!,input=form.querySelector<HTMLInputElement>('input')!,button=form.querySelector<HTMLButtonElement>('button')!,notice=panel.querySelector<HTMLElement>('[role="status"]')!,choices=panel.querySelector<HTMLElement>('.comparison-choices')!
   input.oninput=()=>{pickerRevision[index]++;chosen[index]=null;notice.textContent='Search, then choose a player.';choices.innerHTML='';button.disabled=false;reset()}
   form.onsubmit=async event=>{
    event.preventDefault();if(button.disabled || !valid())return
    const request=++pickerRevision[index];chosen[index]=null;reset();button.disabled=true;choices.innerHTML='';notice.textContent='Finding players…'
    try{
     const players=await findPlayers(client,input.value)
     if(!valid() || request!==pickerRevision[index])return
     notice.textContent=players.length?'Choose a record below. Showing up to 12.':'No players found. Try the name used in league results.'
     choices.innerHTML=players.map((player,i)=>`<button type="button" class="secondary" data-choice="${i}">${html(player.name)} · ${html(player.location || 'Location unavailable')} · ${html(player.flight || 'Flight unavailable')}</button>`).join('')
     choices.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(control=>{control.onclick=()=>{chosen[index]=players[Number(control.dataset.choice)];notice.textContent=`Selected: ${chosen[index]!.name}`;choices.innerHTML='';reset()}})
    }catch{if(valid() && request===pickerRevision[index])notice.textContent='Can’t find players. Check your connection and search again.'}
    finally{if(valid() && request===pickerRevision[index])button.disabled=false}
   }
  })
  const back=()=>{detail?.dispose();detail=null;playerHost.hidden=true;playerHost.innerHTML='';list.hidden=false;window.scrollTo(0,scroll);result.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})}
  const render=()=>{
   if(!data)return
   const prep=comparisonPreparation(data)
   result.innerHTML=`<h2 tabindex="-1">Recorded comparison</h2><div class="match-filters" role="group" aria-label="Comparison view">${(['overall','singles','doubles'] as RatingView[]).map(value=>`<button type="button" class="secondary" data-view="${value}" aria-pressed="${view===value}">${value[0].toUpperCase()+value.slice(1)}</button>`).join('')}</div><p class="rating-context">TIQ ratings are estimates, not official USTA ratings. Singles and Doubles use Overall when a separate rating is missing. Ratings provide an estimate, not a guaranteed result. Model confidence is not measured prediction accuracy.</p>${sharedComparisonCards(data,view)}<section class="comparison-rating-history" data-rating-history></section>${prep?`<h2>${html(prep.title)}</h2><p>${html(prep.evidence)}</p><div data-courtside>${courtsideHtml(prep.context,prep.courtPlan,matchType==='doubles')}</div>`:'<p>Courtside preparation needs a valid recorded rating for every selected player.</p>'}<section class="comparison-rating-history" data-historical-check></section><section class="encounter-history" data-opponent-history></section>${data.map((player,index)=>comparisonCard(player,view,index,false)).join('')}`
   updateHistory()
   updateOpponents()
   updateCheck()
   const prepHost=result.querySelector<HTMLElement>('[data-courtside]')
   if(prepHost&&prep)bindCourtside(prepHost,()=>{void (async()=>{
    const prepVersion=revision,prepCurrent=()=>valid()&&prepVersion===revision&&prepHost.isConnected;const button=prepHost.querySelector<HTMLButtonElement>('[data-native-ui-action="prep-save"]')!;if(button.disabled||notes?.isOpen()||!valid())return;button.disabled=true;status.textContent='Checking your linked player…'
    try{const auth=await client.auth.getSession();if(auth.error||!prepCurrent()||!auth.data.session)throw Error();const owner=auth.data.session.user.id
     const profile=await client.from('profiles').select('linked_player_id').eq('id',owner).abortSignal(AbortSignal.timeout(12000)).maybeSingle();if(!prepCurrent())return;if(profile.error||!profile.data?.linked_player_id)throw Error('Connect your player in My Lab before saving match prep.')
     const again=await client.auth.getSession();if(!prepCurrent()||again.error||again.data.session?.user.id!==owner)return
     notes=openLabGoals(client,{owner,player:profile.data.linked_player_id},prepCurrent,()=>{},()=>{status.textContent='Your account notebook is closed. Saved plans are available in My Lab → Open goals and notes.'},prep)
    }catch(error){if(prepCurrent())status.textContent=error instanceof Error&&error.message?error.message:'Could not open your account notebook. Try again.'}
    finally{if(prepCurrent())button.disabled=false}
   })()})
   result.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>{button.onclick=()=>{meetings?.dispose();meetings=null;view=button.dataset.view as RatingView;render();result.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({preventScroll:true})}})
   result.querySelectorAll<HTMLButtonElement>('[data-comparison-player]').forEach(button=>{button.onclick=()=>{if(!valid() || !data)return;meetings?.dispose();meetings=null;scroll=window.scrollY;list.hidden=true;playerHost.hidden=false;detail=showPlayer(playerHost,client,valid,{player:data[Number(button.dataset.comparisonPlayer)].player,back,backLabel:'Back to comparison'})}})
  }
  compare.onclick=async()=>{
   if(!valid() || chosen.some(p=>!p) || compare.disabled)return
   meetings?.dispose();meetings=null
   historical=null;checkBusy=false;checkNotice=''
   opponentHistory=null;opponentBusy=false;opponentNotice=''
   histories=null;historyBusy=false;historyNotice=''
   const request=++revision,players=chosen.filter((p):p is PlayerChoice=>p!==null)
   compare.disabled=true;result.innerHTML='';status.textContent='Loading recorded comparison…'
   try{
    const eligible=await canUsePlayerInsights(client,valid)
    if(!valid() || request!==revision)return
    if(!eligible){status.textContent=`${MEMBERSHIP_TIERS.player_plus.name} access is required for comparison.`;return}
    const loaded=await loadComparison(client,players)
    if(!valid() || request!==revision)return
    data=loaded;status.textContent='Comparison ready.';render();result.querySelector<HTMLElement>('h2')!.focus();result.scrollIntoView({block:'start'})
   }catch{if(valid() && request===revision)status.textContent='Can’t load the comparison. Check your connection, then compare again.'}
   finally{if(valid() && request===revision)compare.disabled=false}
  }
 }
 void start()
 return {isNotebookOpen:()=>Boolean(notes?.isOpen()),dispose:()=>{disposed=true;revision++;notes?.dispose();notes=null;detail?.dispose();meetings?.dispose()},back:()=>{if(notes?.isOpen()){notes.back();return true}if(meetings?.isOpen()){history.back();return true}if(!detail)return false;if(detail.isMatchOpen()){history.back();return true}app.querySelector<HTMLButtonElement>('#back-explore')?.click();return true}}
}
