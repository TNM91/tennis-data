import type {PublicBrowseAccess} from './public-browse-access'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getRatingViewLabel, type RatingView } from '../../lib/player-rating-display'
import { showExplore as showPlayer } from './explore'
import { createRankingLoader, type RankingRow } from './rankings-data'
import {showExploreSearchEmpty} from './explore-search-empty'
import {exploreResultCard} from './explore-result-card'

export function rankingCards(rows:RankingRow[]) {
  return `<ol class="explore-result-list" role="list">${rows.map((row,index)=>{
    const ratingNote=row.fallback?'Overall TIQ rating used; no separate rating recorded for this view.':'Recorded TIQ rating.'
    const sourceNote=row.player.rating_source==='self'?' Self-rated record.':row.player.rating_source==null?' Rating source unavailable.':''
    return exploreResultCard('ranking',index,{
      title:`${index+1}. ${row.player.name}`,
      actionName:row.player.name,
      context:row.player.location || 'Location unavailable',
      rating:row.display,
      note:ratingNote+sourceNote,
    })
  }).join('')}</ol>`
}
export function showRankings(app:HTMLElement,client:SupabaseClient,isCurrent:()=>boolean,initialTerm='',access?:PublicBrowseAccess) {
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
      const summary=`${getRatingViewLabel(currentView)} · ${area || 'All areas'} · ${rows.length} record${rows.length===1?'':'s'} shown.`
      status.textContent=rows.length?`${summary} Ordered by recorded TIQ rating, up to 24 records. This is not an official USTA ranking.`:summary
      if(!rows.length){
        showExploreSearchEmpty(content,input,status,{
          title:'No ratings found',
          detail:area?'Try a different city or area, or switch the rating view.':'Try another rating view.',
          reset:area?{label:'Show all areas',search:()=>{void load()}}:undefined,
        })
        return
      }
      content.innerHTML=rankingCards(rows)
    content.querySelectorAll<HTMLButtonElement>('[data-explore-result]').forEach(button=>{button.onclick=()=>{
        if(!valid())return
        selected=true;scroll=window.scrollY;previousFocus=button;list.hidden=true;detail.hidden=false
        player=showPlayer(detail,client,valid,{player:rows[Number(button.dataset.exploreResult)].player,back},'',access)
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
  input.value=initialTerm
  void load()
  return {searchTerm:()=>input.value,dispose:()=>{disposed=true;request++;player?.dispose()},back:()=>{if(!selected)return false;if(player?.closeOverlay())return true;back();return true}}
}
