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
    detail.innerHTML = `<button class="secondary" id="back-matches">${html(labels.backLabel || 'Back to My Lab')}</button><h1 tabindex="-1">Match details</h1><p>${html(matchDate(row.match_date))} · ${html(row.match_type || 'Match')}</p><dl><dt>Result</dt><dd>${html(labels.neutral?(['A','B'].includes(row.winner_side||'')?'Side '+row.winner_side+' won':'Result pending'):matchResult(row, playerId))}</dd><dt>League</dt><dd>${html(row.league_name || 'League unavailable')}</dd><dt>Recorded score</dt><dd>${html(row.score || 'Score unavailable')}</dd></dl>${renderMatchSetScores(row, playerId, labels.sideLabel || 'Your side')}<p>The recorded score follows the source’s court order.</p>${labels.publicBrowse||labels.neutral?'':'<button type="button" class="secondary" data-share-scorecard>Review scorecard sharing</button>'}<div id="match-players" aria-live="polite" data-state="loading"><p role="status">Loading the players…</p></div>`
    app.append(detail)
    const shareButton=detail.querySelector<HTMLButtonElement>('[data-share-scorecard]')
    if(shareButton)shareButton.onclick=()=>{if(!valid()||version!==request||!detail.isConnected)return;sharing?.dispose();sharing=openScorecardShare(client,row.id,playerId,()=>valid()&&version===request&&detail.isConnected)}
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
    content.dataset.state = rows.length ? 'ready' : 'empty'
    const yourSide = row.match_players.find(player => player.player_id === playerId)?.side
    content.innerHTML = (['A', 'B'] as const).map(side => {
      const entries = rows.map((row,index)=>({row,index})).filter(entry=>entry.row.side===side).sort((a,b)=>(a.row.seat??99)-(b.row.seat??99))
      return `<h2>Side ${side}${yourSide === side ? ' &middot; ' + html(labels.sideLabel || 'Your side') : ''}</h2>${entries.length ? `<ul class="match-participants">${entries.map(({row,index})=>{const choice=matchParticipantChoice(rows,index);const name=participantNames([row],side)[0];return `<li>${choice?`<button type="button" class="secondary" data-match-player="${index}"><span>${html(name)}</span><small>View player profile</small></button>`:`<p>${html(name)}</p>`}</li>`}).join('')}</ul>` : '<p>Players unavailable</p>'}`
    }).join('')
    content.querySelectorAll<HTMLButtonElement>('[data-match-player]').forEach(button=>{button.onclick=()=>{
      if(!valid()||version!==request||!detail.isConnected)return
      const choice=matchParticipantChoice(rows,Number(button.dataset.matchPlayer));if(!choice)return
      profile?.dispose();profile=openRosterPlayerProfile(client,choice,()=>valid()&&version===request&&detail.isConnected,'Back to match details',labels.publicBrowse)
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
