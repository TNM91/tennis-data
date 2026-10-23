import type { SupabaseClient } from '@supabase/supabase-js'
import { matchDate, matchResult, type RecentMatchRow } from './recent-results'

export const html = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
type Participant = { player_id: string; side: string | null; seat: number | null; players: { name: string | null } | { name: string | null }[] | null }

export function participantNames(rows: Participant[], side: 'A' | 'B') {
  return rows.filter(row => row.side === side).sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99)).map(row => {
    const player = Array.isArray(row.players) ? row.players[0] : row.players
    return player?.name?.trim() || 'Player name unavailable'
  })
}

export function createMatchDetails(app: HTMLElement, client: SupabaseClient, isCurrent: () => boolean, labels: {backLabel?: string; sideLabel?: string} = {}) {
  let selected: { row: RecentMatchRow; playerId: string } | null = null
  let request = 0
  let previousFocus: HTMLElement | null = null
  let scroll = 0
  let disposed = false
  const valid = () => !disposed && isCurrent()
  const close = () => {
    request++
    delete app.dataset.view
    app.querySelector('#match-detail')?.remove()
    window.scrollTo(0, scroll)
    previousFocus?.focus({preventScroll: true})
  }
  async function show(push: boolean) {
    if (!selected || !valid()) return
    const { row, playerId } = selected
    const version = ++request
    if (push) history.pushState({view: 'match'}, '', '#match')
    app.dataset.view = 'match'
    app.querySelector('#match-detail')?.remove()
    const detail = document.createElement('section')
    detail.id = 'match-detail'
    detail.innerHTML = `<button class="secondary" id="back-matches">${html(labels.backLabel || 'Back to My Lab')}</button><h1 tabindex="-1">Match details</h1><p>${html(matchDate(row.match_date))} · ${html(row.match_type || 'Match')}</p><dl><dt>Result</dt><dd>${html(matchResult(row, playerId))}</dd><dt>League</dt><dd>${html(row.league_name || 'League unavailable')}</dd><dt>Recorded score</dt><dd>${html(row.score || 'Score unavailable')}</dd></dl><p>Scores follow the source’s court order.</p><div id="match-players" aria-live="polite" data-state="loading"><p role="status">Loading the players…</p></div>`
    app.append(detail)
    detail.querySelector<HTMLButtonElement>('#back-matches')!.onclick = () => history.back()
    window.scrollTo(0, 0)
    detail.querySelector<HTMLElement>('h1')!.focus({preventScroll: true})
    const result = await client.from('match_players').select('player_id,side,seat,players(name)')
      .eq('match_id', row.id).order('seat', {ascending: true}).limit(8).abortSignal(AbortSignal.timeout(12000))
    if (version !== request || !valid() || !detail.isConnected) return
    const content = detail.querySelector<HTMLElement>('#match-players')!
    if (result.error) {
      content.dataset.state = 'unavailable'
      content.innerHTML = '<p role="alert">Can’t load the players. Check your connection and try again.</p><button id="retry-detail" class="secondary">Retry players</button>'
      content.querySelector<HTMLButtonElement>('button')!.onclick = () => { void show(false) }
      return
    }
    const rows = (result.data || []) as Participant[]
    content.dataset.state = rows.length ? 'ready' : 'empty'
    const yourSide = row.match_players.find(player => player.player_id === playerId)?.side
    content.innerHTML = (['A', 'B'] as const).map(side => {
      const names = participantNames(rows, side)
      return `<h2>Side ${side}${yourSide === side ? ' · ' + html(labels.sideLabel || 'Your side') : ''}</h2><p>${names.length ? names.map(html).join(' &amp; ') : 'Players unavailable'}</p>`
    }).join('')
  }
  const pop = () => {
    if (location.hash === '#match' && selected) void show(false)
    else close()
  }
  window.addEventListener('popstate', pop)
  return {
    isOpen: () => app.dataset.view === 'match',
    open(row: RecentMatchRow, playerId: string) {
      previousFocus = document.activeElement as HTMLElement | null
      scroll = window.scrollY
      selected = {row, playerId}
      void show(true)
    },
    dispose() {
      disposed = true
      request++
      selected = null
      window.removeEventListener('popstate', pop)
      delete app.dataset.view
      if (location.hash) history.replaceState(null, '', '/')
    },
  }
}
