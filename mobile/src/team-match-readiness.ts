import type {MatchLineupCourt, SavedTeamLineup} from '../../lib/team-match-lineup-contract'
import type {TeamMatchReplies} from '../../lib/team-match-replies-contract'
import {html} from './html'

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

export type ReadinessAction = {key: 'time' | 'venue' | 'availability' | 'lineup' | 'reload'; label: string}
export function teamReadinessHtml(replies: TeamMatchReplies | null, courts: MatchLineupCourt[] | undefined, editing = false, actions: ReadinessAction[] = []) {
 const ready = teamMatchReadiness(courts, replies)
 const selected = ready.hasLineup ? ready.confirmed === null ? 'Not checked' : `${ready.confirmed} of ${ready.seats}` : 'Not planned'
 return `<section class="team-readiness" aria-label="${editing ? 'Lineup readiness' : 'Match readiness'}">
  <h3>${editing ? 'Check your court plan' : 'Match readiness'}</h3>
  <dl><div><dt>Assigned players in</dt><dd>${selected}</dd></div><div><dt>Awaiting replies</dt><dd>${ready.awaiting ?? 'Not checked'}</dd></div></dl>
  ${ready.complete ? '' : `<p class="team-readiness-caveat">${replies ? 'Availability covers the teammates loaded here.' : 'Reload the match to check availability.'}</p>`}
  ${ready.hasLineup ? `<p>${ready.seats} playing ${ready.seats === 1 ? 'spot' : 'spots'} in ${editing ? 'this court plan' : 'the saved lineup'}. Availability can change.</p>` : '<p>No court assignments saved yet.</p>'}
  ${ready.open ? `<p class="team-readiness-warning">${ready.open} playing ${ready.open === 1 ? 'spot needs' : 'spots need'} a teammate.</p>` : ''}
  ${ready.duplicates ? '<p class="team-readiness-warning">A teammate is assigned more than once. Use each player once.</p>' : ''}
  ${ready.attention.length ? `<ul class="team-readiness-attention" aria-label="Assigned players to review">${ready.attention.map(player =>
   `<li><strong>${html(player.name)}</strong><span>${player.reason}</span></li>`).join('')}</ul>` : ''}
  ${actions.length ? `<div class="team-readiness-actions">${actions.map(action => `<button type="button" class="secondary" data-readiness-action="${action.key}">${html(action.label)}<span aria-hidden="true">›</span></button>`).join('')}</div>` : ''}
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
