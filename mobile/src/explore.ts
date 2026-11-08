import {showPublicSignIn,type PublicBrowseAccess} from './public-browse-access'
import {showPlayerRosterTeams} from './player-roster-view'
import {showPlayerProfileHeader,type PlayerProfileSection} from './player-profile-header-view'
import {createPlayerProfileFormat} from './player-profile-format'
import { showPlayerPerformance } from './player-performance-view'
import { showPlayerJourney } from './player-journey-view'
import { showFollowControl } from './follow-control'
import type { SupabaseClient } from '@supabase/supabase-js'
import { findPlayers, type PlayerChoice } from './player-connection'
import { createMatchDetails, html } from './match-details'
import { loadRecentResults, type RecentMatchRow } from './recent-results'
import { showRecentResults } from './results-view'
import {showExploreSearchEmpty} from './explore-search-empty'
import {exploreResultCard} from './explore-result-card'
import {openRosterPlayerProfile,type RosterPlayerProfile} from './roster-player-profile'

export function playerSummary(player: PlayerChoice) {
  return `<h1 tabindex="-1">${html(player.name)}</h1><dl><dt>Location</dt><dd>${html(player.location || 'Location unavailable')}</dd><dt>Flight</dt><dd>${html(player.flight || 'Flight unavailable')}</dd></dl>`
}
const profileTargets:Record<PlayerProfileSection,string>={
  overview:'#explore-profile-header h1',
  journey:'#explore-journey h2',
  performance:'#explore-performance h2',
  results:'#explore-performance [data-match-history-title], #explore-results-title',
  recent:'#explore-results-title',
  opponents:'#explore-performance [data-repeat-opponents-title]',
}

export function showExplore(app: HTMLElement, client: SupabaseClient, isCurrent: () => boolean, initial?: {player:PlayerChoice;back:()=>void;backLabel?:string;localMatches?:boolean;scrollHost?:HTMLElement;setBackLabel?:(label:string)=>void},initialTerm='',access?:PublicBrowseAccess) {
  let roster:ReturnType<typeof showPlayerRosterTeams>|null=null
  let header:ReturnType<typeof showPlayerProfileHeader>|null=null
  let performance: ReturnType<typeof showPlayerPerformance> | null = null
  let journey: ReturnType<typeof showPlayerJourney> | null = null
  let opponentProfile:RosterPlayerProfile|null=null
  let disposed = false
  let request = 0
  let selected: PlayerChoice | null = null
  let previousFocus: HTMLElement | null = null
  let searchScroll = 0
  let matchDetails: ReturnType<typeof createMatchDetails> | null = null
  let stopRecentResults:(()=>void)|undefined
  const valid = () => !disposed && isCurrent()
  app.dataset.state = 'explore'
  app.innerHTML = '<div id="explore-intro"><small>Tennis intelligence</small><h1 tabindex="-1">Explore</h1><p>Find players. Get to know their game.</p></div><div id="explore-search"><form><label>Player name<input name="player" type="search" autocomplete="off" minlength="2" maxlength="80" required placeholder="Search by tennis name"></label><button>Search players</button></form><p role="status" id="explore-status">Search at least two characters to find a player.</p><p role="alert" id="explore-error"></p><div id="explore-choices"></div></div><section id="explore-player" hidden></section>'
  if(!initial)app.querySelector<HTMLElement>('h1')!.focus()
  const intro = app.querySelector<HTMLElement>('#explore-intro')!
  const search = app.querySelector<HTMLElement>('#explore-search')!
  const form = search.querySelector<HTMLFormElement>('form')!
  const input = form.querySelector<HTMLInputElement>('input')!
  const button = form.querySelector<HTMLButtonElement>('button')!
  const status = search.querySelector<HTMLElement>('#explore-status')!
  const error = search.querySelector<HTMLElement>('#explore-error')!
  const choices = search.querySelector<HTMLElement>('#explore-choices')!
  const playerPanel = app.querySelector<HTMLElement>('#explore-player')!
  const clearProfile=()=>{
    opponentProfile?.dispose();opponentProfile=null
    stopRecentResults?.();stopRecentResults=undefined
    roster?.dispose();roster=null
    header?.dispose();header=null
    performance?.dispose();performance=null
    journey?.dispose();journey=null
    matchDetails?.dispose();matchDetails=null
  }
  const back = () => {
    if(initial){initial.back();return}
    request++
    clearProfile()
    selected = null
    playerPanel.hidden = true
    playerPanel.innerHTML = ''
    search.hidden = false
    intro.hidden = false
    window.scrollTo(0,searchScroll)
    previousFocus?.focus({preventScroll:true})
  }
  function open(player: PlayerChoice,trigger?:HTMLElement) {
    if (!valid()) return
    clearProfile()
    selected = player
    const version = ++request
    previousFocus = trigger??null
    searchScroll = window.scrollY
    search.hidden = true
    intro.hidden = true
    playerPanel.hidden = false
    const backLabel=initial?.backLabel || (initial?'Back to rankings':'Back to search')
    const profileBack=initial?.setBackLabel?'':`<button type="button" class="secondary" id="back-explore">${html(backLabel)}</button>`
    playerPanel.innerHTML = `${profileBack}<div id="explore-profile-header">${playerSummary(player)}</div><div id="player-follow" aria-live="polite"></div><details id="explore-roster"><summary>Roster teams</summary><div id="explore-roster-content"></div></details><section id="explore-journey"></section><section id="explore-performance"></section><h2 id="explore-results-title" tabindex="-1">Recent matches</h2><div id="explore-results" aria-live="polite"></div>`
    const backButton=playerPanel.querySelector<HTMLButtonElement>('#back-explore')
    if(backButton)backButton.onclick=back
    initial?.setBackLabel?.(backLabel)
    if(initial?.scrollHost)initial.scrollHost.scrollTop=0
    else window.scrollTo(0,0)
    playerPanel.querySelector<HTMLElement>('h1')!.focus({preventScroll:true})
    const current=()=>valid()&&version===request
    matchDetails = createMatchDetails(app,client,current,{
      sideLabel:player.name,local:access?true:initial?.localMatches,
      scrollHost:initial?.scrollHost,publicBrowse:access,externalBack:Boolean(initial?.setBackLabel),
      onClose:()=>initial?.setBackLabel?.(backLabel),
    })
    const openScorecard=(row:RecentMatchRow,source='recent matches')=>{
      if(!current()||!matchDetails)return
      const scorecardBackLabel=`Back to ${source}`
      initial?.setBackLabel?.(scorecardBackLabel)
      matchDetails.open(row,player.id,scorecardBackLabel)
    }
    if(!access)showFollowControl(playerPanel.querySelector<HTMLElement>('#player-follow')!,client,player,()=>valid() && version===request)
    const rosterDisclosure=playerPanel.querySelector<HTMLDetailsElement>('#explore-roster')!
    rosterDisclosure.hidden=Boolean(access)
    if(access)showPublicSignIn(playerPanel.querySelector<HTMLElement>('#player-follow')!,access,()=>valid()&&version===request)
    rosterDisclosure.ontoggle=()=>{if(!access&&rosterDisclosure.open&&!roster&&valid()&&version===request)roster=showPlayerRosterTeams(playerPanel.querySelector<HTMLElement>('#explore-roster-content')!,client,player.id,()=>valid()&&version===request)}
    if(access)for(const selector of ['#explore-journey','#explore-performance'])playerPanel.querySelector<HTMLElement>(selector)!.hidden=true
    const format=createPlayerProfileFormat()
    header=showPlayerProfileHeader(playerPanel.querySelector<HTMLElement>('#explore-profile-header')!,client,player,()=>valid()&&version===request,format,target=>{
      if(!valid()||version!==request)return
      if(target==='results')performance?.showMatchHistory()
      const element=playerPanel.querySelector<HTMLElement>(profileTargets[target])
      if(!element)return
      element.tabIndex=-1
      element.scrollIntoView({block:'start'})
      element.focus({preventScroll:true})
    },Boolean(access))
    if(!access)journey=showPlayerJourney(playerPanel.querySelector<HTMLElement>('#explore-journey')!,client,player.id,()=>valid() && version===request,format,data=>{if(valid()&&version===request)header?.history(data)})
    if(!access)performance=showPlayerPerformance(playerPanel.querySelector<HTMLElement>('#explore-performance')!,client,player.id,current,(next,trigger)=>{
      if(!current()||next.id===player.id)return
      opponentProfile?.dispose()
      trigger.focus({preventScroll:true})
      opponentProfile=openRosterPlayerProfile(client,next,current,'Back to repeat opponents')
    },(data,state)=>{if(current())header?.performance(data,state)},format,player.name,openScorecard)
    const content = playerPanel.querySelector<HTMLElement>('#explore-results')!
    const load = async () => {
      content.innerHTML = '<p role="status">Loading recent matches…</p>'
      try {
        const result = await loadRecentResults(client,player.id)
        if (!valid() || version !== request || !content.isConnected) return
        if (result.error) throw new Error('unavailable')
        stopRecentResults=showRecentResults(content,(result.data || []) as RecentMatchRow[],player.id,openScorecard,'this player’s',false,undefined,format)
      } catch {
        if (!valid() || version !== request || !content.isConnected) return
        content.innerHTML = '<p role="alert">Can’t load this player’s matches. Check your connection and try again.</p><button type="button" class="secondary">Retry matches</button>'
        content.querySelector<HTMLButtonElement>('button')!.onclick = () => {void load()}
      }
    }
    void load()
  }
  input.oninput = () => {
    request++
    choices.innerHTML = ''
    status.textContent = 'Search at least two characters to find a player.'
    error.textContent = ''
    button.disabled = false
  }
  form.onsubmit = async event => {
    event.preventDefault()
    if (!valid() || button.disabled) return
    const term = input.value.trim().replace(/\s+/g,' ')
    if (term.length < 2 || term.length > 80) {error.textContent='Enter between 2 and 80 characters of a player name.';return}
    const version = ++request
    button.disabled = true
    error.textContent = ''
    choices.innerHTML = ''
    status.textContent = 'Finding players…'
    try {
      const rows = await findPlayers(client,term)
      if (!valid() || version !== request) return
      status.textContent = `${rows.length} player${rows.length===1?'':'s'} found.${rows.length===12?' Add more of the name to narrow your search.':''}`
      if(!rows.length){
        showExploreSearchEmpty(choices,input,status,{title:'No players found',detail:'Try a first or last name as it appears in league results.'})
        return
      }
      choices.innerHTML=`<ul class="explore-result-list" role="list">${rows.map((player,index)=>exploreResultCard('player',index,{
        title:player.name,
        context:`${player.location || 'Location unavailable'} · ${player.flight || 'Flight unavailable'}`,
      })).join('')}</ul>`
      choices.querySelectorAll<HTMLButtonElement>('[data-explore-result]').forEach(control=>{control.onclick=()=>open(rows[Number(control.dataset.exploreResult)],control)})
    } catch {
      if (!valid() || version !== request) return
      status.textContent = ''
      error.textContent = 'Can’t search players. Check your connection and try again.'
    } finally {if(valid() && version===request)button.disabled=false}
  }
  if(initialTerm){input.value=initialTerm;form.requestSubmit()}
  if(initial)open(initial.player)
  const closeOverlay=()=>{if(opponentProfile?.back())return true;if(roster?.closeTeam())return true;if(journey?.closeScorecard())return true;if(matchDetails?.back())return true;return false}
  return {
    closeOverlay,
    searchTerm:()=>input.value,
    isMatchOpen:()=>journey?.isScorecardOpen()||matchDetails?.isOpen() || false,
    back:()=>{if(closeOverlay())return true;if(selected){back();return true}return false},
    dispose:()=>{disposed=true;request++;clearProfile()},
  }
}
