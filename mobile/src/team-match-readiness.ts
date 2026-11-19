import type {MatchLineupCourt, SavedTeamLineup} from '../../lib/team-match-lineup-contract'
import type {TeamMatchReplies} from '../../lib/team-match-replies-contract'
import {html} from './html'
import type {CaptainMatchStatus} from './captain-match-status'

export type TeamMatchSection='publication'|'availability'|'lineup'|'time'|'venue'

export function teamMatchReadiness(courts: MatchLineupCourt[] | undefined, replies: TeamMatchReplies | null) {
 const roster = replies?.lineupRoster
 const players = new Map(roster?.map(player => [player.id, player]))
 const selected = (courts ?? []).flatMap(court => court.players).filter(Boolean)
 const unique = [...new Set(selected)]
 const seats = (courts ?? []).reduce((total, court) => total + (court.format === 'singles' ? 1 : 2), 0)
 const attention = roster ? unique.flatMap(id => {
  const player = players.get(id)
  return player?.choice === 'in' ? [] : [{id, name: player?.name ?? (replies?.rosterComplete ? 'Player no longer on roster' : 'Assigned player'),
   reason: !player ? replies?.rosterComplete ? 'No longer on roster' : 'Not in loaded roster' : player.choice === 'out' ? 'Can’t play' : player.choice === 'maybe' ? 'Maybe' : 'Awaiting reply'}]
 }) : []
 return {seats, filled: selected.length, open: Math.max(0, seats - selected.length),
  duplicates: selected.length - unique.length, attention,
  confirmed: roster ? unique.filter(id => players.get(id)?.choice === 'in').length : null,
  awaiting: replies?.awaiting?.length ?? null, complete: replies?.rosterComplete === true,
  hasLineup: Boolean(courts?.length)}
}

export type ReadinessAction = {key: 'time' | 'venue' | 'availability' | 'lineup' | 'publication' | 'reload'; label: string}
export function teamReadinessHtml(replies: TeamMatchReplies | null, courts: MatchLineupCourt[] | undefined, editing = false, actions: ReadinessAction[] = [], status?:CaptainMatchStatus) {
 const ready = teamMatchReadiness(courts, replies)
 const selected = ready.hasLineup ? ready.confirmed === null ? 'Not checked' : `${ready.confirmed} of ${ready.seats}` : 'Not planned'
 const actionHtml=(items:ReadinessAction[],primary=false)=>items.length?`<div class="team-readiness-actions${primary?' team-readiness-primary':''}">${items.map(action=>`<button type="button" class="secondary" data-readiness-action="${action.key}">${html(action.label)}<span aria-hidden="true">›</span></button>`).join('')}</div>`:''
 return `<section class="team-readiness" aria-label="${editing ? 'Lineup readiness' : 'Match readiness'}">
  <h3>${editing ? 'Check your court plan' : 'Match readiness'}</h3>
  ${status?`<p class="team-readiness-status" data-match-readiness-state="${status.state}"><strong>${html(status.label)}</strong></p><p>${html(status.detail)}</p>`:''}
  ${status?actionHtml(actions.slice(0,1),true):''}
  <dl><div><dt>${status?status.published?'Published players In':'Private players In':'Assigned players in'}</dt><dd>${selected}</dd></div><div><dt>${status?'Assignment confirmations':'Awaiting replies'}</dt><dd>${status?html(status.confirmations):ready.awaiting ?? 'Not checked'}</dd></div></dl>
  ${status&&ready.awaiting!==0?`<p>Awaiting team availability replies · ${ready.awaiting ?? 'Not checked'}</p>`:''}
  ${ready.complete ? '' : `<p class="team-readiness-caveat">${replies ? 'Availability covers the teammates loaded here.' : 'Reload the match to check availability.'}</p>`}
  ${ready.hasLineup ? `<p>${ready.seats} playing ${ready.seats === 1 ? 'spot' : 'spots'} in ${editing ? 'this court plan' : status?status.published?'the published lineup':'your private lineup':'the saved lineup'}. Availability can change.</p>` : '<p>No court assignments saved yet.</p>'}
  ${ready.open ? `<p class="team-readiness-warning">${ready.open} playing ${ready.open === 1 ? 'spot needs' : 'spots need'} a teammate.</p>` : ''}
  ${ready.duplicates ? '<p class="team-readiness-warning">A teammate is assigned more than once. Use each player once.</p>' : ''}
  ${ready.attention.length ? `<ul class="team-readiness-attention" aria-label="Assigned players to review">${ready.attention.map(player =>
   `<li><strong>${html(player.name)}</strong><span>${player.reason}</span></li>`).join('')}</ul>` : ''}
  ${actionHtml(status?actions.slice(1):actions)}
 </section>`
}

export function ownSharedCourtHtml(lineup: SavedTeamLineup | undefined, owner: string) {
 if (!lineup) return ''
 let singles = 0, doubles = 0
 const assignment = lineup.courts.map(court => ({court, label: court.format === 'singles' ? `Singles ${++singles}` : `Doubles ${++doubles}`}))
  .find(({court}) => court.players.includes(owner))
 return `<section class="team-own-court" aria-label="Your shared court"><h3>Your court</h3>${assignment ?
  `<p><strong>${assignment.label}</strong>${assignment.court.format === 'doubles' ? `<span>Partner · ${assignment.court.players.filter(id => id !== owner).map(id => html(lineup.names[id] || 'Teammate')).join(' &amp; ')}</span>` : '<span>Singles</span>'}</p>` :
  '<p>You don’t have a court assignment in this shared plan. Check with your captain.</p>'}<p>From your captain’s shared lineup.</p></section>`
}
