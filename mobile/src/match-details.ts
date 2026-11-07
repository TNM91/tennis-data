import type {PublicBrowseAccess} from './public-browse-access'
import {openRosterPlayerProfile} from './roster-player-profile'
import type {PlayerChoice} from './player-connection'
import {renderMatchSetScores} from './match-set-scores'
import {openScorecardShare} from './match-scorecard-share'
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

export function matchParticipantChoice(rows: Participant[], index: number): PlayerChoice | null {
  const row = rows[index]
  if (!row || !['A', 'B'].includes(row.side || '') || typeof row.player_id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(row.player_id) || rows.filter(other => other.player_id === row.player_id).length !== 1) return null
  const player = Array.isArray(row.players) ? row.players.length === 1 ? row.players[0] : null : row.players
  if (!player || typeof player.name !== 'string' || !player.name.trim() || player.name.length > 200) return null
  return {id:row.player_id, name:player.name.trim(), location:null, flight:null}
}

export function createMatchDetails(app: HTMLElement, client: SupabaseClient, isCurrent: () => boolean, labels: {backLabel?: string; sideLabel?: string;local?: boolean;scrollHost?: HTMLElement;publicBrowse?:PublicBrowseAccess;neutral?:boolean;onClose?:()=>void} = {}) {
  let selected: { row: RecentMatchRow; playerId: string } | null = null
  let request = 0
  let previousFocus: HTMLElement | null = null
  let scroll = 0
  let disposed = false
  let profile:ReturnType<typeof openRosterPlayerProfile>|null=null
  let sharing:ReturnType<typeof openScorecardShare>|null=null
  const valid = () => !disposed && isCurrent()
  const close = () => {
    profile?.dispose();profile=null
    sharing?.dispose();sharing=null
    request++
    delete app.dataset.view
    app.querySelector('#match-detail')?.remove()
    if(labels.scrollHost)labels.scrollHost.scrollTop=scroll;else window.scrollTo(0, scroll)
    previousFocus?.focus({preventScroll: true})
  }
  async function show(push: boolean) {
    if (!selected || !valid()) return
    const { row, playerId } = selected
    profile?.dispose();profile=null
    sharing?.dispose();sharing=null
    const version = ++request
    if (push&&!labels.local) history.pushState({view: 'match'}, '', '#match')
    app.dataset.view = 'match'
    app.querySelector('#match-detail')?.remove()
    const detail = document.createElement('section')
    detail.id = 'match-detail'
    detail.className = 'match-detail-view'
    const resultLabel = labels.neutral ? (['A','B'].includes(row.winner_side || '') ? 'Side ' + row.winner_side + ' won' : 'Result pending') : matchResult(row, playerId)
    const outcome = resultLabel === 'Won' ? 'won' : resultLabel === 'Lost' ? 'lost' : 'recorded'
    detail.innerHTML = `
      <button type="button" class="secondary" id="back-matches"><span aria-hidden="true">‹</span>${html(labels.backLabel || 'Back to My Lab')}</button>
      <div class="match-scorecard-hero">
        <div class="match-scorecard-heading">
          <h1 tabindex="-1">Match scorecard</h1>
          <p class="match-result-label" data-outcome="${outcome}">${html(resultLabel)}</p>
        </div>
        <p class="scorecard-meta">${html(matchDate(row.match_date))} · ${html(row.match_type || 'Match')}</p>
        <p class="match-league-context">${html(row.league_name || 'League unavailable')}</p>
        ${renderMatchSetScores(row, playerId, labels.sideLabel || 'Your side')}
        <div class="scorecard-recorded">
          <dl class="match-result-summary">
            <dt>Recorded score</dt>
            <dd class="match-recorded-score">${html(row.score || 'Score unavailable')}</dd>
          </dl>
          ${row.score ? '<p class="scorecard-source-note">Listed in the original court order.</p>' : ''}
        </div>
      </div>
      <section class="match-court-players" aria-labelledby="match-court-players-title">
        <h2 id="match-court-players-title">Players on court</h2>
        <div id="match-players" aria-live="polite" data-state="loading"><p>Loading players…</p></div>
      </section>
      ${labels.publicBrowse || labels.neutral ? '' : `<button type="button" class="secondary" data-share-scorecard aria-labelledby="match-share-title" aria-describedby="match-share-detail">
        <span class="app-tool-copy"><strong id="match-share-title">Review scorecard sharing</strong><span id="match-share-detail">Check the public link before sharing</span></span>
        <span class="app-tool-arrow" aria-hidden="true">›</span>
      </button>`}`
    app.append(detail)
    const shareButton=detail.querySelector<HTMLButtonElement>('[data-share-scorecard]')
    if (shareButton) shareButton.onclick = () => {
      if (!valid() || version !== request || !detail.isConnected) return
      sharing?.dispose()
      shareButton.focus({preventScroll:true})
      sharing = openScorecardShare(client, row.id, playerId, () => valid() && version === request && detail.isConnected)
    }
    detail.querySelector<HTMLButtonElement>('#back-matches')!.onclick = () => {if(labels.local){close();labels.onClose?.()}else history.back()}
    if(labels.scrollHost)labels.scrollHost.scrollTop=0;else window.scrollTo(0, 0)
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
    if (!rows.some(player => player.side === 'A' || player.side === 'B')) {
      content.dataset.state = 'empty'
      content.innerHTML = '<p>No players are listed for this match.</p>'
      return
    }
    content.dataset.state = 'ready'
    const yourSide = labels.neutral ? null : row.match_players.find(player => player.player_id === playerId)?.side
    const sides = yourSide === 'B' ? ['B', 'A'] as const : ['A', 'B'] as const
    content.innerHTML = sides.map(side => {
      const entries = rows.map((player, index) => ({player, index}))
        .filter(({player}) => player.side === side)
        .sort((a, b) => (a.player.seat ?? 99) - (b.player.seat ?? 99))
      const players = entries.map(({player, index}) => {
        const name = html(participantNames([player], side)[0])
        if (!matchParticipantChoice(rows, index)) return `<li><p>${name}</p></li>`
        return `<li><button type="button" class="secondary" data-match-player="${index}">
          <span class="sr-only">View player profile for </span><span>${name}</span><span class="app-tool-arrow" aria-hidden="true">›</span>
        </button></li>`
      }).join('')
      return `<section class="match-side-card"${yourSide === side ? ' data-own-side' : ''}>
        <h3>Side ${side}${yourSide === side ? ` <span>${html(labels.sideLabel || 'Your side')}</span>` : ''}</h3>
        ${players ? `<ul class="match-participants">${players}</ul>` : '<p>Players unavailable</p>'}
      </section>`
    }).join('')
    content.querySelectorAll<HTMLButtonElement>('[data-match-player]').forEach(button=>{button.onclick=()=>{
      if(!valid()||version!==request||!detail.isConnected)return
      const choice=matchParticipantChoice(rows,Number(button.dataset.matchPlayer));if(!choice)return
      profile?.dispose()
      button.focus({preventScroll:true})
      profile=openRosterPlayerProfile(client,choice,()=>valid()&&version===request&&detail.isConnected,'Back to match details',labels.publicBrowse)
    }})
  }
  const pop = () => {
    if (location.hash === '#match' && selected) void show(false)
    else close()
  }
  if(!labels.local)window.addEventListener('popstate', pop)
  return {
    isOpen: () => app.dataset.view === 'match',
    back:()=>{if(profile?.isOpen()){profile.back();return true}if(sharing?.isOpen()){sharing.dispose();sharing=null;return true}if(app.dataset.view!=='match')return false;if(labels.local){close();labels.onClose?.()}else history.back();return true},
    open(row: RecentMatchRow, playerId: string) {
      previousFocus = document.activeElement as HTMLElement | null
      scroll = labels.scrollHost?.scrollTop??window.scrollY
      selected = {row, playerId}
      void show(true)
    },
    dispose() {
      disposed = true
      profile?.dispose();profile=null
      sharing?.dispose();sharing=null
      request++
      selected = null
      window.removeEventListener('popstate', pop)
      delete app.dataset.view
      if (!labels.local&&location.hash) history.replaceState(null, '', '/')
    },
  }
}
