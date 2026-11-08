import {readPlayerMatchSets} from '../../lib/player-set-score-grid'
import type {RecentMatchRow} from './recent-results'

export function matchScorecardSide(row: RecentMatchRow, playerId: string) {
  const sides = new Set(row.match_players.filter(p => p.player_id === playerId).map(p => p.side))
  const [side] = sides
  return sides.size === 1 && (side === 'A' || side === 'B') ? side : null
}

function matchSetsForSide(row: RecentMatchRow, side: 'A' | 'B' | null) {
  if (!side || (row.winner_side !== 'A' && row.winner_side !== 'B')) return null
  return readPlayerMatchSets(row.score, side === row.winner_side ? 'W' : 'L')
}

export function matchSetScores(row: RecentMatchRow, playerId: string) {
  return matchSetsForSide(row, matchScorecardSide(row, playerId))
}

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export function renderMatchSetScores(row: RecentMatchRow, playerId: string | null, sideLabel = 'Your side') {
  const neutral = playerId === null
  const firstSide = neutral ? 'A' : matchScorecardSide(row, playerId)
  const sets = matchSetsForSide(row, firstSide)
  if (!firstSide || !sets) return ''
  const secondSide = firstSide === 'A' ? 'B' : 'A'
  const caption = neutral ? 'Scores for Side A and Side B' : `Scores for ${escape(sideLabel)} and the opposing side`
  const headings = sets.map((set, i) => `<th scope="col">${set.kind === 'match_tiebreak' ? '<abbr title="Match tiebreak">TB</abbr>' : `<span class="sr-only">Set </span>${i + 1}`}</th>`).join('')
  const rows = [firstSide, secondSide].map(side => {
    const first = side === firstSide
    const winner = side === row.winner_side
    const label = neutral ? `Side ${side}` : first ? sideLabel : 'Opponent'
    const scores = sets.map(set => {
      const value = first ? set.gamesFor : set.gamesAgainst
      const won = value > (first ? set.gamesAgainst : set.gamesFor)
      return `<td>${won ? `<strong>${value}</strong>` : value}</td>`
    }).join('')
    return `<tr${winner ? ' data-match-winner' : ''}>
      <th scope="row"><span data-scorecard-side="${side}">${escape(label)}</span>${winner ? ' <span class="match-winner-marker">Winner</span>' : ''}</th>
      ${scores}
    </tr>`
  }).join('')
  return `<section class="match-set-scores" aria-label="Set scores">
    <div class="match-section-heading">
      <h2 data-match-section="sets">Set by set</h2>
      <button type="button" class="secondary" data-match-jump="lineup">View lineup <span aria-hidden="true">↓</span></button>
    </div>
    <table>
      <caption class="sr-only">${caption}</caption>
      <thead><tr><th scope="col">Side</th>${headings}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${sets.some(set => set.kind === 'match_tiebreak') ? '<p>TB = deciding match tiebreak</p>' : ''}
  </section>`
}
