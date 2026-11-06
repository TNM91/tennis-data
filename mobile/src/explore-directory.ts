import type {PublicBrowseAccess} from './public-browse-access'
import websiteUi from '../generated/website-ui.json'
import type { SupabaseClient } from '@supabase/supabase-js'
import { showExplore as showPlayers } from './explore'
import { showDirectory } from './directory-view'
import { showRankings } from './rankings-view'
import {nativeActionIcon} from './native-action-icons'

export type ExploreCategory='Players'|'Teams'|'Leagues'|'Rankings'
type Category=ExploreCategory|'Overview'
export const exploreTools=[
 {category:'Players',title:'Find a player',detail:'Open ratings and recent matches.'},
 {category:'Teams',title:'Browse teams',detail:'Check rosters and team results.'},
 {category:'Leagues',title:'Find a league',detail:'Browse teams and league context.'},
 {category:'Rankings',title:'Check rankings',detail:'Compare the field by recorded TIQ rating.'},
] as const
export function exploreHomeHtml(competitions=false){
 return `<div class="native-explore-hero">
  <header class="tab-hero tab-hero-court explore-spotlight"><small class="stat-eyebrow">Your tennis, connected</small><h1 tabindex="-1">Find players, teams, leagues.</h1></header>
  <form id="native-search">
   <label class="sr-only" for="native-search-term">Search tennis</label>
   <input id="native-search-term" name="term" type="search" minlength="2" maxlength="80" required placeholder="Search a player, team, league or area">
   <label class="sr-only" for="native-search-kind">Search category</label>
   <div class="explore-search-category">
    <select id="native-search-kind" name="category"><option value="Players">Players</option><option value="Teams">Teams</option><option value="Leagues">Leagues</option><option value="Rankings">Rankings by location</option></select>
    <span aria-hidden="true">${nativeActionIcon('down')}</span>
   </div>
   <button class="tab-primary-action" type="submit">Search</button>
  </form>
  <div class="website-ui website-explore">${websiteUi.explore}</div>
  ${competitions?`<button type="button" class="secondary app-tool explore-competitions" data-open-competitions>
   <span class="app-tool-icon" aria-hidden="true">${websiteUi.icons.compete}</span>
   <span class="app-tool-copy"><strong>Competitions</strong><span>TiQ leagues · schedules · standings</span></span>
   <span class="app-tool-arrow" aria-hidden="true">›</span>
  </button>`:''}
 </div>`
}
export function showExplore(app:HTMLElement,client:SupabaseClient,isCurrent:()=>boolean,initial:Category='Overview',access?:PublicBrowseAccess,onCompetitions?:(trigger:HTMLElement)=>void) {
  let disposed=false
  let currentCategory:Category|null=null
  let active:ReturnType<typeof showPlayers>|ReturnType<typeof showDirectory>|ReturnType<typeof showRankings>|null=null
  let overviewReturn:{trigger:HTMLElement;scroll:number}|null=null
  app.dataset.state='explore'
  app.innerHTML='<div class="explore-categories" role="group" aria-label="Explore categories"><button type="button" data-category="Overview">Explore</button><button type="button" data-category="Players">Players</button><button type="button" data-category="Teams">Teams</button><button type="button" data-category="Leagues">Leagues</button><button type="button" data-category="Rankings">Rankings</button></div><div id="explore-content"></div>'
  const content=app.querySelector<HTMLElement>('#explore-content')!
  const template=document.createElement('template')
  template.innerHTML=exploreHomeHtml(Boolean(onCompetitions))
  const overview=template.content.firstElementChild as HTMLElement
  const valid=()=>!disposed && isCurrent()
  const overviewActive=()=>valid()&&currentCategory==='Overview'&&overview.isConnected
  const select=(category:Category,term='',trigger?:HTMLElement)=>{
    if(!valid() || currentCategory===category)return
    if(currentCategory==='Overview'&&trigger)overviewReturn={trigger,scroll:window.scrollY}
    currentCategory=category
    active?.dispose();active=null
    app.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===category)))
    if(category==='Overview'){
      content.replaceChildren(overview)
      const previous=overviewReturn
      overviewReturn=null
      window.scrollTo(0,previous?.scroll??0)
      const opener=previous?.trigger.isConnected?previous.trigger:overview.querySelector<HTMLElement>('h1')
      opener?.focus({preventScroll:true})
      return
    }
    active=category==='Players'?showPlayers(content,client,valid,undefined,term,access):category==='Rankings'?showRankings(content,client,valid,term,access):showDirectory(content,category,client,valid,term,undefined,access)
  }
  overview.querySelector<HTMLButtonElement>('[data-open-competitions]')?.addEventListener('click',e=>{
    if(overviewActive())onCompetitions?.(e.currentTarget as HTMLElement)
  })
  overview.querySelectorAll<HTMLButtonElement>('[data-native-ui-action]').forEach(button=>{
    button.onclick=()=>{
      if(!overviewActive())return
      const action=button.dataset.nativeUiAction||''
      if(action==='search'){overview.querySelector<HTMLInputElement>('#native-search-term')?.focus();return}
      if(action.startsWith('explore:'))select(action.slice(8) as ExploreCategory,'',button)
    }
  })
  const form=overview.querySelector<HTMLFormElement>('#native-search')!
  form.onsubmit=event=>{
    event.preventDefault()
    if(!overviewActive())return
    const fields=new FormData(form),term=String(fields.get('term')||'').trim()
    if(term.length<2||term.length>80)return
    const category=String(fields.get('category')) as ExploreCategory
    if(!['Players','Teams','Leagues','Rankings'].includes(category))return
    select(category,term,form.querySelector<HTMLButtonElement>('button[type="submit"]')!)
  }
  app.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button=>{button.onclick=()=>select(button.dataset.category as Category,'',button)})
  select(initial)
  return {dispose:()=>{disposed=true;active?.dispose()},back:()=>{if(active?.back())return true;if(currentCategory!=='Overview'){select('Overview');return true}return false}}
}
