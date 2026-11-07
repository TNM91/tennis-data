import {playerResultBreakdown,resultBreakdownLabel} from '../../lib/player-result-breakdown'
import {matchResult,type RecentMatchRow} from './recent-results'
import {html} from './match-details'
import {recentScorecardRow} from './recent-scorecard-row'

export type BreakdownView='leagues'|'seasons'
export function labBreakdownMatches(rows:RecentMatchRow[],playerId:string,view:BreakdownView,label:string){
  return rows.flatMap((row,index)=>{
    const result=matchResult(row,playerId)
    const group=resultBreakdownLabel({date:row.match_date,result,leagueName:row.league_name},view)
    return result!=='Result pending'&&group===label?[{row,index,result}]:[]
  })
}

export function labResultBreakdownHtml(rows: RecentMatchRow[], playerId: string, view: BreakdownView, loaded: number, format = 'All formats', controls = true) {
  const groups = playerResultBreakdown(rows.map(row => {
    const result = matchResult(row, playerId)
    return {date:row.match_date, leagueName:row.league_name, result:result === 'Won' ? 'W' : result === 'Lost' ? 'L' : 'pending'}
  }))[view]
  const yearView = view === 'seasons'
  if (yearView) {
    const year = (label: string) => label === 'Connected' ? Number.MIN_SAFE_INTEGER : Number(label)
    groups.sort((a, b) => year(b.label) - year(a.label))
  }
  const cards = groups.map(group => {
    const unknownYear = yearView && group.label === 'Connected'
    const title = html(unknownYear ? 'Year unavailable' : group.label)
    const scorecards = labBreakdownMatches(rows, playerId, view, group.label).map(({row, index, result}) =>
      recentScorecardRow(row, index, result, {label:unknownYear ? 'unknown year' : group.label, includeLeague:yearView}),
    ).join('')
    return `<li>
      <div class="lab-breakdown-metrics">
        <div class="lab-breakdown-record"><h4>${title}</h4><strong aria-hidden="true">${group.winRate}% wins</strong></div>
        <meter min="0" max="100" value="${group.winRate}" aria-label="${title} decided win percentage">${group.winRate}%</meter>
        <p>${group.wins}W · ${group.losses}L</p>
      </div>
      <details class="lab-breakdown-matches">
        <summary><span>View ${group.total} ${group.total === 1 ? 'scorecard' : 'scorecards'}</span><span class="app-tool-arrow" aria-hidden="true">›</span></summary>
        <ol class="matches lab-sample-matches">${scorecards}</ol>
      </details>
    </li>`
  }).join('')
  return `<section class="lab-result-breakdown" aria-labelledby="lab-breakdown-title">
    <div class="lab-breakdown-heading">
      <h3 id="lab-breakdown-title">Results by ${yearView ? 'year' : 'league'}</h3>
      ${controls ? `<div class="match-filters" role="group" aria-label="Result breakdown"><button type="button" class="secondary" data-result-breakdown="leagues" aria-pressed="${!yearView}">Leagues</button><button type="button" class="secondary" data-result-breakdown="seasons" aria-pressed="${yearView}">Years</button></div>` : ''}
      <p>${html(format)} · Decided matches from the latest ${loaded} connected ${loaded === 1 ? 'result' : 'results'}.</p>
    </div>
    ${cards ? `<ol class="lab-breakdown-list">${cards}</ol><p class="lab-breakdown-note">${yearView ? 'Newest years first.' : 'Sorted by win rate. Small samples can rank first.'}</p>` : '<p class="lab-breakdown-note">No decided results for this format in the loaded sample.</p>'}
  </section>`
}
