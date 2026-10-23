import type { SupabaseClient } from '@supabase/supabase-js'
import { getRatingViewLabel, type RatingView } from '../../lib/player-rating-display'
import { html } from './match-details'
import { showExplore as showPlayer } from './explore'
import { createRankingLoader, type RankingRow } from './rankings-data'

export function rankingCards(rows:RankingRow[]) {
  return `<ol class="player-choices rankings-list">${rows.map((row,index)=>`<li><div class="ranking-heading"><h2>${index+1}. ${html(row.player.name)}</h2><strong class="ranking-value">${html(row.display)}</strong></div><p>${html(row.player.location || 'Location unavailable')}</p><p class="ranking-note">${row.fallback?'Overall TIQ rating used; no separate rating recorded for this view.':'Recorded TIQ rating.'}${row.player.rating_source==='self'?' Self-rated record.':row.player.rating_source==null?' Rating source unavailable.':''}</p><button type="button" class="secondary" data-ranking-player="${index}">View player<span class="sr-only"> ${html(row.player.name)}</span></button></li>`).join('')}</ol>`
}
export function showRankings(app:HTMLElement,client:SupabaseClient,isCurrent:()=>boolean) {
  let disposed=false,request=0,view:RatingView='overall',selected=false,scroll=0
  let player:ReturnType<typeof showPlayer>|null=null
  let previousFocus:HTMLElement|null=null
  const valid=()=>!disposed && isCurrent()
  const fetchRankings=createRankingLoader(client)
  app.innerHTML='<div id="rankings-list"><small>Tennis intelligence</small><h1 tabindex="-1">Rankings</h1><p>Explore recorded TIQ rating leaders.</p><div class="match-filters" role="group" aria-label="Ranking view"><button class="secondary" type="button" data-rating="overall" aria-pressed="true">Overall</button><button class="secondary" type="button" data-rating="singles" aria-pressed="false">Singles</button><button class="secondary" type="button" data-rating="doubles" aria-pressed="false">Doubles</button></div><form><label>Location (optional)<input type="search" name="location" minlength="2" maxlength="80" autocomplete="off" placeholder="City or area"></label><button>Apply location</button></form><p role="status" id="rankings-status"></p><p role="alert" id="rankings-error"></p><div id="rankings-rows"></div></div><div id="rankings-player" hidden></div>'
  app.querySelector<HTMLElement>('h1')!.focus()
  const list=app.querySelector<HTMLElement>('#rankings-list')!
  const detail=app.querySelector<HTMLElement>('#rankings-player')!
  const form=list.querySelector<HTMLFormElement>('form')!
  const input=form.querySelector<HTMLInputElement>('input')!
  const submit=form.querySelector<HTMLButtonElement>('button')!
  const status=list.querySelector<HTMLElement>('#rankings-status')!
  const error=list.querySelector<HTMLElement>('#rankings-error')!
  const content=list.querySelector<HTMLElement>('#rankings-rows')!
  const back=()=>{player?.dispose();player=null;selected=false;detail.hidden=true;detail.innerHTML='';list.hidden=false;window.scrollTo(0,scroll);previousFocus?.focus({preventScroll:true})}
  const load=async()=>{
    if(!valid())return
    const area=input.value.trim().replace(/\s+/g,' ')
    if(area && (area.length<2 || area.length>80)){error.textContent='Enter at least two characters of a location, or clear it for all areas.';return}
    const version=++request,currentView=view
    submit.disabled=true;error.textContent='';content.innerHTML='';status.textContent='Loading recorded TIQ ratings…'
    try {
      const rows=await fetchRankings(currentView,area)
      if(!valid() || version!==request)return
      status.textContent=`${getRatingViewLabel(currentView)} · ${area || 'All areas'} · ${rows.length} record${rows.length===1?'':'s'} shown. Ordered by recorded TIQ rating, up to 24 records. This is not an official USTA ranking.`
      content.innerHTML=rows.length?rankingCards(rows):'<p>No recorded TIQ ratings matched this view. Try another view or clear the location.</p>'
      content.querySelectorAll<HTMLButtonElement>('[data-ranking-player]').forEach(button=>{button.onclick=()=>{
        if(!valid())return
        selected=true;scroll=window.scrollY;previousFocus=document.activeElement as HTMLElement|null;list.hidden=true;detail.hidden=false
        player=showPlayer(detail,client,valid,{player:rows[Number(button.dataset.rankingPlayer)].player,back})
      }})
    } catch {
      if(!valid() || version!==request)return
      status.textContent='';error.textContent='Can’t load rankings. Check your connection and apply the location to try again.'
    } finally {if(valid() && version===request)submit.disabled=false}
  }
  list.querySelectorAll<HTMLButtonElement>('[data-rating]').forEach(button=>{button.onclick=()=>{
    const next=button.dataset.rating as RatingView
    if(view===next)return
    view=next
    list.querySelectorAll<HTMLButtonElement>('[data-rating]').forEach(control=>control.setAttribute('aria-pressed',String(control===button)))
    void load()
  }})
  input.oninput=()=>{request++;submit.disabled=false;content.innerHTML='';status.textContent='Apply the location to update rankings.';error.textContent=''}
  form.onsubmit=event=>{event.preventDefault();if(!submit.disabled)void load()}
  void load()
  return {dispose:()=>{disposed=true;request++;player?.dispose()},back:()=>{if(!selected)return false;if(player?.isMatchOpen()){history.back();return true}back();return true}}
}
