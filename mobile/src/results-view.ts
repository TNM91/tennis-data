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
export function recentPulseHtml(rows:RecentMatchRow[],playerId:string) {
  const form=recentForm(rows,playerId),decided=form.wins+form.losses
  const percent=decided?Math.round(form.wins/decided*100):null
  return `<div class="match-pulse"><div class="match-pulse-rate"><span>Decided win rate</span><strong>${percent===null?'—':percent+'<small>%</small>'}</strong>${percent===null?'<p>No decided results yet.</p>':`<meter min="0" max="100" value="${percent}" aria-label="Win percentage in loaded recent results">${percent}%</meter><p>${form.wins} ${form.wins===1?'win':'wins'} · ${form.losses} ${form.losses===1?'loss':'losses'}</p>`}</div><div class="match-pulse-form"><span>Latest form</span><ol aria-label="Latest results, newest first">${rows.slice(0,5).map(row=>{const result=matchResult(row,playerId),symbol=result==='Won'?'W':result==='Lost'?'L':'—';return `<li data-outcome="${symbol}" aria-label="${html(matchDate(row.match_date))}: ${result}">${symbol}</li>`}).join('')}</ol><p>Newest first · ${form.pending} pending</p></div></div>`
}
export function resultsHtml(rows: RecentMatchRow[], playerId: string, filter: MatchFilter, owner = 'your', compact=false) {
  const shown = filteredMatches(rows, filter)
  const form = recentForm(shown, playerId)
  return `<div class="match-filters" role="group" aria-label="Match type">${filters.map(value => `<button type="button" class="secondary" data-match-filter="${value}" aria-pressed="${value === filter}">${value}</button>`).join('')}</div><div role="status" class="form-status"><p>${shown.length} ${filter === 'All' ? 'match' : filter.toLowerCase() + ' match'}${shown.length === 1 ? '' : 'es'} in ${html(owner)} latest ${rows.length} connected results.</p>${shown.length ? `${recentPulseHtml(shown,playerId)}<dl class="recent-form" aria-label="Recent form"><div><dt>Wins</dt><dd>${form.wins}</dd></div><div><dt>Losses</dt><dd>${form.losses}</dd></div><div><dt>Pending</dt><dd>${form.pending}</dd></div></dl>` : `<p>No matches of this type in ${html(owner)} latest results. Try All.</p>`}</div>${shown.length ? `${compact?'<details class="recent-match-list"><summary>View recent match list</summary>':''}<ol class="matches">${shown.map((row, index) => `<li><div class="match-heading"><strong class="result-${matchResult(row, playerId) === 'Won' ? 'won' : matchResult(row, playerId) === 'Lost' ? 'lost' : 'pending'}">${html(matchResult(row, playerId))}</strong><span>${html(matchDate(row.match_date))}</span></div><p>${html(row.match_type || 'Match')} · ${html(row.league_name || 'League unavailable')}</p><p class="score">${html(row.score || 'Score unavailable')}</p><button type="button" class="secondary match-open" data-index="${index}" aria-label="View match details, ${html(matchDate(row.match_date))}, ${html(row.match_type || 'match')}">View match</button></li>`).join('')}</ol><small>Scores are shown as recorded, in the source’s court order.</small>${compact?'</details>':''}` : ''}`
}
export function showRecentResults(content: HTMLElement, rows: RecentMatchRow[], playerId: string, open: (row: RecentMatchRow) => void, owner = 'your', compact=false) {
  if (!rows.length) {
    content.innerHTML = '<p>No matches are connected to this player record yet. Results will appear here as scores are added.</p>'
    return
  }
  const render = (filter: MatchFilter, restoreFocus = false) => {
    content.innerHTML = resultsHtml(rows, playerId, filter, owner,compact)
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
