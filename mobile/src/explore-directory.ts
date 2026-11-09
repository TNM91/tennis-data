import type {PublicBrowseAccess} from './public-browse-access'
import websiteUi from '../generated/website-ui.json'
import type { SupabaseClient } from '@supabase/supabase-js'
import { showExplore as showPlayers } from './explore'
import { showDirectory } from './directory-view'
import { showRankings } from './rankings-view'
import type {RatingView} from '../../lib/player-rating-display'

const searchModes={
 Players:{label:'Player name',placeholder:'Search by tennis name',required:true},
 Teams:{label:'Team name',placeholder:'Search by team name',required:true},
 Leagues:{label:'League or area (optional)',placeholder:'All leagues',required:false},
 Rankings:{label:'City or area (optional)',placeholder:'All areas',required:false},
} as const
type ExploreCategory=keyof typeof searchModes
export type ExploreSearchState={category:ExploreCategory;term:string}
export type ExploreResultPosition={key?:string;view?:RatingView}
export type ExploreVisit=ExploreSearchState & {results?:ExploreResultPosition}
type ExploreOptions={
 access?:PublicBrowseAccess
 onCompetitions?:(trigger:HTMLElement)=>void
 search?:ExploreSearchState
 resume?:ExploreVisit
 onLeave?:(state:ExploreSearchState)=>void
}
function exploreHomeHtml(competitions:boolean){
 return `<div class="native-explore-hero">
  <header class="tab-hero tab-hero-court explore-spotlight"><small class="stat-eyebrow">Explore</small><h1 tabindex="-1">Find players, teams, leagues.</h1></header>
  <div class="explore-search-panel">
   <div class="explore-categories" role="group" aria-label="Explore categories">
    ${Object.keys(searchModes).map(category=>`<button type="button" data-category="${category}">${category}</button>`).join('')}
   </div>
   <form id="native-search" role="search" aria-label="Explore tennis">
    <label for="native-search-term"></label>
    <input id="native-search-term" type="search" autocomplete="off" minlength="2" maxlength="80">
    <button class="tab-primary-action" type="submit">Search</button>
   </form>
  </div>
  ${competitions?`<button type="button" class="secondary app-tool explore-competitions" data-open-competitions>
   <span class="app-tool-icon" aria-hidden="true">${websiteUi.icons.compete}</span>
   <span class="app-tool-copy"><strong>Competitions</strong><span>TiQ leagues · schedules · standings</span></span>
   <span class="app-tool-arrow" aria-hidden="true">›</span>
  </button>`:''}
 </div>`
}
export function showExplore(app:HTMLElement,client:SupabaseClient,isCurrent:()=>boolean,{access,onCompetitions,search,resume,onLeave}:ExploreOptions={}) {
  let disposed=false
  let category:ExploreCategory=(resume??search)?.category??'Players'
  let active:ReturnType<typeof showPlayers>|ReturnType<typeof showDirectory>|ReturnType<typeof showRankings>|null=null
  let overviewScroll=0
  app.dataset.state='explore'
  app.innerHTML='<button type="button" class="secondary explore-back" hidden>Back to Explore</button><div id="explore-content"></div>'
  const backButton=app.querySelector<HTMLButtonElement>('.explore-back')!
  const content=app.querySelector<HTMLElement>('#explore-content')!
  const template=document.createElement('template')
  template.innerHTML=exploreHomeHtml(Boolean(onCompetitions))
  const overview=template.content.firstElementChild as HTMLElement
  const categoryButtons=overview.querySelectorAll<HTMLButtonElement>('[data-category]')
  const form=overview.querySelector<HTMLFormElement>('#native-search')!
  const input=form.querySelector<HTMLInputElement>('input')!
  const label=form.querySelector<HTMLLabelElement>('label')!
  const submit=form.querySelector<HTMLButtonElement>('button')!
  const valid=()=>!disposed && isCurrent()
  const overviewActive=()=>valid()&&overview.isConnected
  const showOverview=(restore=false)=>{
    if(!valid())return
    if(active)input.value=active.searchTerm()
    active?.dispose();active=null
    backButton.hidden=true
    content.replaceChildren(overview)
    window.scrollTo(0,restore?overviewScroll:0)
    const target=restore?submit:overview.querySelector<HTMLElement>('h1')
    target?.focus({preventScroll:true})
  }
  const openResults=(term:string,position?:ExploreResultPosition)=>{
    backButton.hidden=false
    window.scrollTo(0,0)
    if(category==='Players')active=showPlayers(content,client,valid,undefined,term,access,position?.key)
    else if(category==='Rankings')active=showRankings(content,client,valid,term,access,position)
    else active=showDirectory(content,category,client,valid,term,undefined,access,position?.key)
  }
  const selectMode=(mode:ExploreCategory)=>{
    category=mode
    const spec=searchModes[mode]
    label.textContent=spec.label
    input.placeholder=spec.placeholder
    input.required=spec.required
    input.setCustomValidity('')
    submit.textContent=mode==='Rankings'?'View':mode==='Leagues'?'Find':'Search'
    submit.setAttribute('aria-label',`${submit.textContent} ${mode.toLowerCase()}`)
    categoryButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===mode)))
  }
  categoryButtons.forEach(button=>{button.onclick=()=>{if(overviewActive())selectMode(button.dataset.category as ExploreCategory)}})
  overview.querySelector<HTMLButtonElement>('[data-open-competitions]')?.addEventListener('click',e=>{
    if(overviewActive())onCompetitions?.(e.currentTarget as HTMLElement)
  })
  backButton.onclick=()=>showOverview(true)
  input.oninput=()=>input.setCustomValidity('')
  form.onsubmit=event=>{
    event.preventDefault()
    if(!overviewActive())return
    const term=input.value.trim()
    if(((term||input.required)&&term.length<2)||term.length>80){
      input.setCustomValidity('Enter between 2 and 80 characters.')
      input.reportValidity()
      return
    }
    overviewScroll=window.scrollY
    openResults(term)
  }
  const visit=():ExploreVisit=>({category,term:(active?.searchTerm()??input.value).slice(0,80),results:active?.resultPosition()})
  input.value=(resume??search)?.term??''
  selectMode(category)
  if(resume?.results)openResults(resume.term,resume.results)
  else showOverview()
  return {visit,dispose:()=>{
    if(valid()&&onLeave){const {category,term}=visit();onLeave({category,term})}
    disposed=true;active?.dispose()
  },back:()=>{
    if(!valid()||overview.isConnected)return false
    if(!active?.back())showOverview(true)
    return true
  }}
}
