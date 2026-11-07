import { CapacitorHttp } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { nativeActionIcon } from './native-action-icons'
import { html } from './match-details'

export type PlayerChoice = {id: string; name: string; location: string | null; flight: string | null}
export function playerSearchTerm(value: string) {
  const term = value.trim().replace(/\s+/g, ' ')
  if (term.length < 2 || term.length > 80) throw new Error('Enter between 2 and 80 characters of your name.')
  return term.replace(/[\\%_]/g, '\\$&')
}
export async function findPlayers(client: SupabaseClient, value: string): Promise<PlayerChoice[]> {
  const term = playerSearchTerm(value)
  const {data, error} = await client.from('players').select('id,name,location,flight')
    .ilike('name', `%${term}%`).order('name', {ascending:true}).order('id', {ascending:true})
    .limit(12).abortSignal(AbortSignal.timeout(12000))
  if (error) throw new Error('Can’t search players. Check your connection and try again.')
  return (data || []) as PlayerChoice[]
}
export async function connectPlayer(client: SupabaseClient, playerId: string, userId: string, isCurrent: () => boolean, request: typeof CapacitorHttp.post = options => CapacitorHttp.post(options)) {
  if (!playerId.trim()) throw new Error('Choose a player record first.')
  const {data, error} = await client.auth.getSession()
  if (error || !data.session || data.session.user.id !== userId || !isCurrent()) throw new Error('Sign in again before connecting your player.')
  const response = await request({
    url:'https://www.tenaceiq.com/api/profile/link',
    headers:{Authorization:`Bearer ${data.session.access_token}`, 'Content-Type':'application/json'},
    data:{linkedPlayerId:playerId}, responseType:'json', disableRedirects:true,
    connectTimeout:12000, readTimeout:12000,
  }).catch(() => { throw new Error('Could not confirm your player connection. Return to My Lab and refresh before trying again.') })
  if (response.status === 401) throw new Error('Sign in again before connecting your player.')
  if (response.status < 200 || response.status >= 300 || response.data?.ok !== true || response.data?.profile?.linked_player_id !== playerId) {
    throw new Error('Couldn’t confirm your player connection. Return to My Lab and refresh before trying again.')
  }
}

type ConnectionActions = {search: (term: string) => Promise<PlayerChoice[]>; connect: (playerId: string) => Promise<void>}
export function showPlayerConnection(app: HTMLElement, actions: ConnectionActions, back: () => void, isCurrent: () => boolean) {
  let disposed = false
  let request = 0
  let saving = false
  let selected: PlayerChoice | null = null
  const valid = () => !disposed && isCurrent()
  app.dataset.state = 'connect-player'
  app.innerHTML = `<button type="button" class="secondary native-entry-back" id="back-lab"><span aria-hidden="true">‹</span> Back to My Lab</button>
    <div id="player-search-panel" class="tab-hero">
      <h1 tabindex="-1">Find your tennis record</h1>
      <p>Search the name you use in league or tournament results.</p>
      <form id="player-search">
        <label>Your tennis name<input name="player-name" type="search" autocomplete="name" minlength="2" maxlength="80" required></label>
        <button type="submit">Search players</button>
      </form>
      <p role="status" id="player-search-status"></p><p role="alert" id="player-link-error"></p>
    </div>
    <div id="player-choices"></div>
    <section id="player-confirm" aria-labelledby="player-confirm-title" hidden></section>`
  app.querySelector<HTMLElement>('h1')!.focus()
  const form = app.querySelector<HTMLFormElement>('#player-search')!
  const searchPanel = app.querySelector<HTMLElement>('#player-search-panel')!
  const searchButton = form.querySelector<HTMLButtonElement>('button')!
  const input = form.querySelector<HTMLInputElement>('input')!
  const status = app.querySelector<HTMLElement>('#player-search-status')!
  const error = app.querySelector<HTMLElement>('#player-link-error')!
  const choices = app.querySelector<HTMLElement>('#player-choices')!
  const confirmation = app.querySelector<HTMLElement>('#player-confirm')!
  const backButton = app.querySelector<HTMLButtonElement>('#back-lab')!
  const clearSelection = () => {selected = null; confirmation.hidden = true; confirmation.innerHTML = ''}
  input.oninput = () => {
    request++
    choices.innerHTML = ''
    status.textContent = ''
    error.textContent = ''
    clearSelection()
    searchButton.disabled = false
  }
  backButton.onclick = () => { if (!saving) back() }
  form.onsubmit = async event => {
    event.preventDefault()
    if (saving || !valid()) return
    const version = ++request
    error.textContent = ''
    choices.innerHTML = ''
    clearSelection()
    try { playerSearchTerm(input.value) } catch (failure) { error.textContent = (failure as Error).message; return }
    searchButton.disabled = true
    status.textContent = 'Finding player records…'
    try {
      const rows = await actions.search(input.value)
      if (!valid() || version !== request) return
      const summary = rows.length ? `${rows.length} record${rows.length === 1 ? '' : 's'} found.${rows.length === 12 ? ' Add more of your name to narrow the results.' : ''}` : 'No records found. Try the name used in your league results.'
      status.textContent = summary
      choices.innerHTML = rows.length?`<ul class="player-connect-results native-entry-list">${rows.map((row,index) => `
        <li><button type="button" class="secondary app-tool" data-player-choice="${index}" aria-label="Review this record for ${html(row.name)}" aria-describedby="player-choice-${index}">
          <span class="app-tool-icon" aria-hidden="true">${nativeActionIcon('profile')}</span>
          <span class="app-tool-copy"><strong>${html(row.name)}</strong><span id="player-choice-${index}">${html(row.location || 'Location not listed')} · ${row.flight?'Flight '+html(row.flight):'Flight not listed'}</span></span>
          <span aria-hidden="true">›</span>
        </button></li>`).join('')}</ul>`:''
      choices.querySelectorAll<HTMLButtonElement>('[data-player-choice]').forEach(button => {
        button.onclick = () => {
          if (saving || !valid()) return
          selected = rows[Number(button.dataset.playerChoice)]
          searchPanel.hidden = choices.hidden = true
          status.textContent = ''
          confirmation.hidden = false
          confirmation.innerHTML = `<h1 id="player-confirm-title" tabindex="-1">Is this your record?</h1>
            <div class="player-record-summary">
              <h2>${html(selected.name)}</h2>
              <dl><div><dt>Location</dt><dd>${html(selected.location || 'Not listed')}</dd></div>
              <div><dt>Flight</dt><dd>${html(selected.flight || 'Not listed')}</dd></div></dl>
            </div>
            <p>Connect your own record to see your TIQ scoreboard and recent matches.</p>
            <button type="button" id="confirm-player">Connect my player</button>
            <p role="status"></p><p role="alert" tabindex="-1"></p>
            <button type="button" class="secondary" id="change-player">Back to search results</button>`
          confirmation.querySelector<HTMLElement>('h1')!.focus()
          confirmation.querySelector<HTMLButtonElement>('#change-player')!.onclick = () => {
            clearSelection()
            searchPanel.hidden = choices.hidden = false
            error.textContent = ''
            status.textContent = summary
            button.focus()
          }
          confirmation.querySelector<HTMLButtonElement>('#confirm-player')!.onclick = async () => {
            if (saving || !selected || !valid()) return
            saving = true
            const feedback=confirmation.querySelector<HTMLElement>('[role="alert"]')!
            const progress=confirmation.querySelector<HTMLElement>('[role="status"]')!
            feedback.textContent = ''
            app.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button,input').forEach(control => {control.disabled = true})
            progress.textContent = 'Connecting your player…'
            try {
              await actions.connect(selected.id)
              if (valid()) back()
            } catch (failure) {
              if (!valid()) return
              feedback.textContent = failure instanceof Error ? failure.message : 'Couldn’t confirm the connection. Return to My Lab and refresh.'
              progress.textContent = ''
              app.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button,input').forEach(control => {control.disabled = false})
              feedback.focus()
            } finally { saving = false }
          }
        }
      })
    } catch (failure) {
      if (valid() && version === request) {status.textContent = ''; error.textContent = failure instanceof Error ? failure.message : 'Can’t search players. Try again.'}
    } finally { if (valid() && version === request) searchButton.disabled = false }
  }
  return {dispose: () => {disposed = true; request++}, isSaving: () => saving}
}
