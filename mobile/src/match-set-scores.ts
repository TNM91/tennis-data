import {readPlayerMatchSets} from '../../lib/player-set-score-grid'
import type {RecentMatchRow} from './recent-results'

export function matchSetScores(row: RecentMatchRow, playerId: string) {
  const sides = new Set(row.match_players.filter(p => p.player_id === playerId).map(p => p.side))
  if (sides.size !== 1 || !['A', 'B'].includes([...sides][0] || '') || !['A', 'B'].includes(row.winner_side || '')) return null
  return readPlayerMatchSets(row.score, [...sides][0] === row.winner_side ? 'W' : 'L')
}

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export function renderMatchSetScores(row: RecentMatchRow, playerId: string, sideLabel = 'Your side') {
  const sets = matchSetScores(row, playerId)
  if (!sets) return ''
  const headings = sets.map((set, i) => `<th scope="col">${set.kind === 'match_tiebreak' ? '<abbr title="Match tiebreak">TB</abbr>' : `<span class="sr-only">Set </span>${i + 1}`}</th>`).join('')
  const rows = [true, false].map(own => {
    const scores = sets.map(set => {
      const value = own ? set.gamesFor : set.gamesAgainst
      const won = value > (own ? set.gamesAgainst : set.gamesFor)
      return `<td>${won ? `<strong>${value}</strong>` : value}</td>`
    }).join('')
    return `<tr><th scope="row">${escape(own ? sideLabel : 'Opponent')}</th>${scores}</tr>`
  }).join('')
  return `<section class="match-set-scores" aria-label="Set scores">
    <h2>Set by set</h2>
    <table>
      <caption class="sr-only">Scores for ${escape(sideLabel)} and the opposing side</caption>
      <thead><tr><th scope="col">Side</th>${headings}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${sets.some(set => set.kind === 'match_tiebreak') ? '<p>TB = deciding match tiebreak</p>' : ''}
  </section>`
}
