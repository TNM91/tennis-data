import {labResultBreakdownHtml,type BreakdownView} from './lab-result-breakdown'
import {playerRecentRecord} from '../../lib/player-recent-record'
import {filterMatchbookEntries} from '../../lib/player-matchbook'
import { matchDate, matchResult, type RecentMatchRow } from './recent-results'
import { html } from './match-details'

export type MatchFilter = 'All' | 'Singles' | 'Doubles'
const filters: MatchFilter[] = ['All', 'Singles', 'Doubles']
export function filteredMatches(rows: RecentMatchRow[], filter: MatchFilter) {
  return filterMatchbookEntries(rows.map(row=>({row,matchType:row.match_type})),filter.toLowerCase() as 'all'|'singles'|'doubles').map(entry=>entry.row)
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
export function recentStatsHtml(rows:RecentMatchRow[],playerId:string,filter:MatchFilter){
 const record=(matches:RecentMatchRow[])=>playerRecentRecord(matches.map(row=>({date:row.match_date,result:matchResult(row,playerId)==='Won'?'W':matchResult(row,playerId)==='Lost'?'L':'pending'})))
 const stats=record(filteredMatches(rows,filter))
 return `<section class="lab-recent-stats" aria-label="Recent result insights"><h3>Build your next run</h3><dl class="lab-streak-grid"><div><dt>Current win streak</dt><dd>${stats.currentWinStreak}<small> decided ${stats.currentWinStreak===1?'win':'wins'}</small></dd></div><div><dt>Best win streak</dt><dd>${stats.bestWinStreak}<small> in this sample</small></dd></div></dl><p class="rating-context">${filter==='All'?'All formats':filter} · latest ${rows.length} connected results. Pending results do not end a decided-result streak. This is not your full-history record.</p><h3>Singles &amp; doubles</h3><div class="lab-format-grid">${(['Singles','Doubles'] as const).map(mode=>{const matches=filteredMatches(rows,mode),r=record(matches);return `<div><h4>${mode}</h4><strong>${r.winRate===null?'—':r.winRate+'%'}</strong><span> decided win rate</span>${r.winRate===null?'':`<meter min="0" max="100" value="${r.winRate}" aria-label="${mode} decided win percentage in loaded recent results">${r.winRate}%</meter>`}<p>${r.wins} ${r.wins===1?'win':'wins'} · ${r.losses} ${r.losses===1?'loss':'losses'} · ${r.pending} pending</p><small>${matches.length?'From your loaded recent results.':'No '+mode.toLowerCase()+' results in this sample.'}</small></div>`}).join('')}</div><p class="rating-context">Format comparison always uses the same loaded sample. Use the filters above for the form strip, streaks and match list.</p></section>`
}
export function resultsHtml(rows: RecentMatchRow[], playerId: string, filter: MatchFilter, owner = 'your', compact=false,breakdown:BreakdownView='leagues') {
  const shown = filteredMatches(rows, filter)
  const form = recentForm(shown, playerId)
  return `<div class="match-filters" role="group" aria-label="Match type">${filters.map(value => `<button type="button" class="secondary" data-match-filter="${value}" aria-pressed="${value === filter}">${value}</button>`).join('')}</div><div role="status" class="form-status"><p>${shown.length} ${filter === 'All' ? 'match' : filter.toLowerCase() + ' match'}${shown.length === 1 ? '' : 'es'} in ${html(owner)} latest ${rows.length} connected results.</p>${shown.length ? `${recentPulseHtml(shown,playerId)}<dl class="recent-form" aria-label="Recent form"><div><dt>Wins</dt><dd>${form.wins}</dd></div><div><dt>Losses</dt><dd>${form.losses}</dd></div><div><dt>Pending</dt><dd>${form.pending}</dd></div></dl>` : `<p>No matches of this type in ${html(owner)} latest results. Try All.</p>`}</div>${compact?recentStatsHtml(rows,playerId,filter)+labResultBreakdownHtml(shown,playerId,breakdown,rows.length,filter==='All'?'All formats':filter):''}${shown.length ? `${compact?'<details class="recent-match-list"><summary>View recent match list</summary>':''}<ol class="matches">${shown.map((row, index) => `<li><div class="match-heading"><strong class="result-${matchResult(row, playerId) === 'Won' ? 'won' : matchResult(row, playerId) === 'Lost' ? 'lost' : 'pending'}">${html(matchResult(row, playerId))}</strong><span>${html(matchDate(row.match_date))}</span></div><p>${html(row.match_type || 'Match')} · ${html(row.league_name || 'League unavailable')}</p><p class="score">${html(row.score || 'Score unavailable')}</p><button type="button" class="secondary match-open" data-index="${index}" aria-label="View match details, ${html(matchDate(row.match_date))}, ${html(row.match_type || 'match')}">View match</button></li>`).join('')}</ol><small>Scores are shown as recorded, in the source’s court order.</small>${compact?'</details>':''}` : ''}`
}
export function showRecentResults(content: HTMLElement, rows: RecentMatchRow[], playerId: string, open: (row: RecentMatchRow) => void, owner = 'your', compact=false) {
  if (!rows.length) {
    content.innerHTML = '<p>No matches are connected to this player record yet. Results will appear here as scores are added.</p>'
    return
  }
  let breakdown:BreakdownView='leagues'
  const render = (filter: MatchFilter, restoreFocus = false,breakdownFocus=false) => {
    content.innerHTML = resultsHtml(rows, playerId, filter, owner,compact,breakdown)
    content.querySelectorAll<HTMLButtonElement>('[data-result-breakdown]').forEach(button=>{button.onclick=()=>{breakdown=button.dataset.resultBreakdown as BreakdownView;render(filter,false,true)}})
    content.querySelectorAll<HTMLButtonElement>('[data-match-filter]').forEach(button => {
      button.onclick = () => render(button.dataset.matchFilter as MatchFilter, true)
    })
    const shown = filteredMatches(rows, filter)
    content.querySelectorAll<HTMLButtonElement>('.match-open').forEach(button => {
      button.onclick = () => open(shown[Number(button.dataset.index)])
    })
    if (restoreFocus) content.querySelector<HTMLButtonElement>('[data-match-filter][aria-pressed="true"]')?.focus({preventScroll:true})
    if (breakdownFocus) content.querySelector<HTMLButtonElement>('[data-result-breakdown][aria-pressed="true"]')?.focus({preventScroll:true})
  }
  render('All')
}
