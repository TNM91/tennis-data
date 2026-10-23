import { matchDate, matchResult, type RecentMatchRow } from './recent-results'
import { html } from './match-details'

export type MatchFilter = 'All' | 'Singles' | 'Doubles'
const filters: MatchFilter[] = ['All', 'Singles', 'Doubles']
export function filteredMatches(rows: RecentMatchRow[], filter: MatchFilter) {
  return filter === 'All' ? rows : rows.filter(row => row.match_type?.trim().toLowerCase() === filter.toLowerCase())
}
export function recentForm(rows: RecentMatchRow[], playerId: string) {
  return rows.reduce((form, row) => {
    const result = matchResult(row, playerId)
    if (result === 'Won') form.wins++
    else if (result === 'Lost') form.losses++
    else form.pending++
    return form
  }, {wins: 0, losses: 0, pending: 0})
}
export function resultsHtml(rows: RecentMatchRow[], playerId: string, filter: MatchFilter, owner = 'your') {
  const shown = filteredMatches(rows, filter)
  const form = recentForm(shown, playerId)
  return `<div class="match-filters" role="group" aria-label="Match type">${filters.map(value => `<button type="button" class="secondary" data-match-filter="${value}" aria-pressed="${value === filter}">${value}</button>`).join('')}</div><div role="status" class="form-status"><p>${shown.length} ${filter === 'All' ? 'match' : filter.toLowerCase() + ' match'}${shown.length === 1 ? '' : 'es'} in ${html(owner)} latest ${rows.length} connected results.</p>${shown.length ? `<dl class="recent-form" aria-label="Recent form"><div><dt>Wins</dt><dd>${form.wins}</dd></div><div><dt>Losses</dt><dd>${form.losses}</dd></div><div><dt>Pending</dt><dd>${form.pending}</dd></div></dl>` : `<p>No matches of this type in ${html(owner)} latest results. Try All.</p>`}</div>${shown.length ? `<ol class="matches">${shown.map((row, index) => `<li><div class="match-heading"><strong class="result-${matchResult(row, playerId) === 'Won' ? 'won' : matchResult(row, playerId) === 'Lost' ? 'lost' : 'pending'}">${html(matchResult(row, playerId))}</strong><span>${html(matchDate(row.match_date))}</span></div><p>${html(row.match_type || 'Match')} · ${html(row.league_name || 'League unavailable')}</p><p class="score">${html(row.score || 'Score unavailable')}</p><button type="button" class="secondary match-open" data-index="${index}" aria-label="View match details, ${html(matchDate(row.match_date))}, ${html(row.match_type || 'match')}">View match</button></li>`).join('')}</ol><small>Scores are shown as recorded, in the source’s court order.</small>` : ''}`
}
export function showRecentResults(content: HTMLElement, rows: RecentMatchRow[], playerId: string, open: (row: RecentMatchRow) => void, owner = 'your') {
  if (!rows.length) {
    content.innerHTML = '<p>No matches are connected to this player record yet. Results will appear here as scores are added.</p>'
    return
  }
  const render = (filter: MatchFilter, restoreFocus = false) => {
    content.innerHTML = resultsHtml(rows, playerId, filter, owner)
    content.querySelectorAll<HTMLButtonElement>('[data-match-filter]').forEach(button => {
      button.onclick = () => render(button.dataset.matchFilter as MatchFilter, true)
    })
    const shown = filteredMatches(rows, filter)
    content.querySelectorAll<HTMLButtonElement>('.match-open').forEach(button => {
      button.onclick = () => open(shown[Number(button.dataset.index)])
    })
    if (restoreFocus) content.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({preventScroll:true})
  }
  render('All')
}
