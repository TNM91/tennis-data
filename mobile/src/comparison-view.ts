import { encountersHtml, recentEncounters } from './recent-encounters'
import type {SupabaseClient} from '@supabase/supabase-js'
import {MATCHUP_STORY,MEMBERSHIP_TIERS} from '../../lib/product-story'
import type {RatingView} from '../../lib/player-rating-display'
import {canFollowPlayers as canUsePlayerInsights} from './follows-data'
import {findPlayers,type PlayerChoice} from './player-connection'
import {loadComparison,comparisonCard,type ComparedPlayer} from './comparison-data'
import {showExplore as showPlayer} from './explore'
import {html,createMatchDetails} from './match-details'
export function showComparison(app:HTMLElement,client:SupabaseClient,isCurrent:()=>boolean) {
 let disposed=false,revision=0,view:RatingView='overall',data:ComparedPlayer[]|null=null,detail:ReturnType<typeof showPlayer>|null=null,scroll=0
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
  app.innerHTML=`<div id="comparison-list"><small>Matchup</small><h1 tabindex="-1">${html(MATCHUP_STORY.headline)}</h1><p>Compare two players’ recorded TIQ ratings and recent results.</p><div id="comparison-pickers"></div><button type="button" id="compare-players" disabled>Compare players</button><p role="status" id="comparison-status"></p><div id="comparison-result"></div></div><div id="comparison-player" hidden></div>`
  app.querySelector<HTMLElement>('h1')!.focus()
  const list=app.querySelector<HTMLElement>('#comparison-list')!,playerHost=app.querySelector<HTMLElement>('#comparison-player')!,result=list.querySelector<HTMLElement>('#comparison-result')!,status=list.querySelector<HTMLElement>('#comparison-status')!,compare=list.querySelector<HTMLButtonElement>('#compare-players')!
  const chosen:[PlayerChoice|null,PlayerChoice|null]=[null,null]
  const pickerRevision=[0,0]
  const pickers=list.querySelector<HTMLElement>('#comparison-pickers')!
  pickers.innerHTML=[0,1].map(index=>`<section data-picker="${index}"><h2>Player ${index+1}</h2><form><label>Player ${index+1} name<input type="search" minlength="2" maxlength="80" required autocomplete="off"></label><button class="secondary">Search player ${index+1}</button></form><p role="status"></p><div class="comparison-choices"></div></section>`).join('')
  const reset=()=>{meetings?.dispose();meetings=null;revision++;data=null;result.innerHTML='';status.textContent='';compare.disabled=!chosen[0]||!chosen[1]||chosen[0].id===chosen[1].id;if(chosen[0] && chosen[0].id===chosen[1]?.id)status.textContent='Choose two different players.'}
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
     choices.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(control=>{control.onclick=()=>{chosen[index]=players[Number(control.dataset.choice)];notice.textContent=`Selected: ${chosen[index]!.name}`;choices.innerHTML='';reset();compare.disabled=!chosen[0]||!chosen[1]||chosen[0].id===chosen[1].id}})
    }catch{if(valid() && request===pickerRevision[index])notice.textContent='Can’t find players. Check your connection and search again.'}
    finally{if(valid() && request===pickerRevision[index])button.disabled=false}
   }
  })
  const back=()=>{detail?.dispose();detail=null;playerHost.hidden=true;playerHost.innerHTML='';list.hidden=false;window.scrollTo(0,scroll);result.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})}
  const render=()=>{
   if(!data)return
   result.innerHTML=`<h2 tabindex="-1">Recorded comparison</h2><div class="match-filters" role="group" aria-label="Comparison view">${(['overall','singles','doubles'] as RatingView[]).map(value=>`<button type="button" class="secondary" data-view="${value}" aria-pressed="${view===value}">${value[0].toUpperCase()+value.slice(1)}</button>`).join('')}</div><p class="rating-context">TIQ ratings are estimates, not official USTA ratings. Singles and Doubles use Overall when a separate rating is missing. This comparison does not predict a winner.</p>${encountersHtml(data,view)}${data.map((player,index)=>comparisonCard(player,view,index)).join('')}`
   const encounters=recentEncounters(data,view).matches
   result.querySelectorAll<HTMLButtonElement>('[data-encounter]').forEach(button=>{button.onclick=()=>{if(!valid() || !data)return;meetings?.dispose();meetings=createMatchDetails(app,client,valid,{backLabel:'Back to comparison',sideLabel:data[0].player.name});meetings.open(encounters[Number(button.dataset.encounter)],data[0].player.id)}})
   result.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>{button.onclick=()=>{meetings?.dispose();meetings=null;view=button.dataset.view as RatingView;render();result.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({preventScroll:true})}})
   result.querySelectorAll<HTMLButtonElement>('[data-comparison-player]').forEach(button=>{button.onclick=()=>{if(!valid() || !data)return;meetings?.dispose();meetings=null;scroll=window.scrollY;list.hidden=true;playerHost.hidden=false;detail=showPlayer(playerHost,client,valid,{player:data[Number(button.dataset.comparisonPlayer)].player,back,backLabel:'Back to comparison'})}})
  }
  compare.onclick=async()=>{
   if(!valid() || !chosen[0] || !chosen[1] || compare.disabled)return
   meetings?.dispose();meetings=null
   const request=++revision,players:[PlayerChoice,PlayerChoice]=[chosen[0],chosen[1]]
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
 return {dispose:()=>{disposed=true;revision++;detail?.dispose();meetings?.dispose()},back:()=>{if(meetings?.isOpen()){history.back();return true}if(!detail)return false;if(detail.isMatchOpen()){history.back();return true}app.querySelector<HTMLButtonElement>('#back-explore')?.click();return true}}
}
