import type { SupabaseClient } from '@supabase/supabase-js'
import { findPlayers, type PlayerChoice } from './player-connection'
import { createMatchDetails, html } from './match-details'
import { loadRecentResults, type RecentMatchRow } from './recent-results'
import { showRecentResults } from './results-view'

export function playerSummary(player: PlayerChoice) {
  return `<h1 tabindex="-1">${html(player.name)}</h1><dl><dt>Location</dt><dd>${html(player.location || 'Location unavailable')}</dd><dt>Flight</dt><dd>${html(player.flight || 'Flight unavailable')}</dd></dl>`
}

export function showExplore(app: HTMLElement, client: SupabaseClient, isCurrent: () => boolean) {
  let disposed = false
  let request = 0
  let selected: PlayerChoice | null = null
  let previousFocus: HTMLElement | null = null
  let searchScroll = 0
  let matchDetails: ReturnType<typeof createMatchDetails> | null = null
  const valid = () => !disposed && isCurrent()
  app.dataset.state = 'explore'
  app.innerHTML = '<div id="explore-intro"><small>Tennis intelligence</small><h1 tabindex="-1">Explore</h1><p>Find players. Get to know their game.</p></div><div id="explore-search"><form><label>Player name<input name="player" type="search" autocomplete="off" minlength="2" maxlength="80" required placeholder="Search by tennis name"></label><button>Search players</button></form><p role="status" id="explore-status">Search at least two characters to find a player.</p><p role="alert" id="explore-error"></p><div id="explore-choices"></div></div><section id="explore-player" hidden></section>'
  app.querySelector<HTMLElement>('h1')!.focus()
  const intro = app.querySelector<HTMLElement>('#explore-intro')!
  const search = app.querySelector<HTMLElement>('#explore-search')!
  const form = search.querySelector<HTMLFormElement>('form')!
  const input = form.querySelector<HTMLInputElement>('input')!
  const button = form.querySelector<HTMLButtonElement>('button')!
  const status = search.querySelector<HTMLElement>('#explore-status')!
  const error = search.querySelector<HTMLElement>('#explore-error')!
  const choices = search.querySelector<HTMLElement>('#explore-choices')!
  const playerPanel = app.querySelector<HTMLElement>('#explore-player')!
  const back = () => {
    request++
    selected = null
    matchDetails?.dispose()
    matchDetails = null
    playerPanel.hidden = true
    playerPanel.innerHTML = ''
    search.hidden = false
    intro.hidden = false
    window.scrollTo(0,searchScroll)
    previousFocus?.focus({preventScroll:true})
  }
  async function open(player: PlayerChoice) {
    if (!valid()) return
    selected = player
    const version = ++request
    previousFocus = document.activeElement as HTMLElement | null
    searchScroll = window.scrollY
    search.hidden = true
    intro.hidden = true
    playerPanel.hidden = false
    playerPanel.innerHTML = `<button type="button" class="secondary" id="back-explore">Back to search</button>${playerSummary(player)}<p>Public player record · Results below are for ${html(player.name)}.</p><h2>Recent matches</h2><div id="explore-results" aria-live="polite"></div>`
    playerPanel.querySelector<HTMLButtonElement>('#back-explore')!.onclick = back
    playerPanel.querySelector<HTMLElement>('h1')!.focus()
    window.scrollTo(0,0)
    matchDetails = createMatchDetails(app,client,valid,{backLabel:'Back to player',sideLabel:player.name})
    const content = playerPanel.querySelector<HTMLElement>('#explore-results')!
    const load = async () => {
      content.innerHTML = '<p role="status">Loading recent matches…</p>'
      try {
        const result = await loadRecentResults(client,player.id)
        if (!valid() || version !== request || !content.isConnected) return
        if (result.error) throw new Error('unavailable')
        showRecentResults(content,(result.data || []) as RecentMatchRow[],player.id,row=>matchDetails?.open(row,player.id),'this player’s')
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
      status.textContent = rows.length ? `${rows.length} player${rows.length===1?'':'s'} found. Showing up to 12; add more of the name to narrow your search.` : 'No players found. Try the name used in league results.'
      choices.innerHTML = `<ul class="player-choices">${rows.map((player,index)=>`<li><h2>${html(player.name)}</h2><p>${html(player.location || 'Location unavailable')} · ${html(player.flight || 'Flight unavailable')}</p><button type="button" class="secondary" data-explore-player="${index}">View player<span class="sr-only"> ${html(player.name)}</span></button></li>`).join('')}</ul>`
      choices.querySelectorAll<HTMLButtonElement>('[data-explore-player]').forEach(control=>{control.onclick=()=>{void open(rows[Number(control.dataset.explorePlayer)])}})
    } catch {
      if (!valid() || version !== request) return
      status.textContent = ''
      error.textContent = 'Can’t search players. Check your connection and try again.'
    } finally {if(valid() && version===request)button.disabled=false}
  }
  return {
    isMatchOpen:()=>matchDetails?.isOpen() || false,
    back:()=>{if(matchDetails?.isOpen()){history.back();return true}if(selected){back();return true}return false},
    dispose:()=>{disposed=true;request++;matchDetails?.dispose()},
  }
}
