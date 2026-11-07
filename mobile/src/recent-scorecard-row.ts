import {html} from './match-details'
import {matchDate, type matchResult, type RecentMatchRow} from './recent-results'

export function recentScorecardRow(
  row: RecentMatchRow,
  index: number,
  result: ReturnType<typeof matchResult>,
  group?: {label: string; includeLeague: boolean},
) {
  const tone = result === 'Won' ? 'won' : result === 'Lost' ? 'lost' : 'pending'
  return `<li><button type="button" class="secondary match-open recent-scorecard" data-index="${index}">
    ${group ? `<span class="sr-only">Open ${html(group.label)} scorecard </span>` : ''}
    <span class="app-tool-copy">
      <span class="recent-scorecard-meta"><b class="result-${tone}">${result}</b><span class="recent-scorecard-date">${html(row.match_type || 'Match')} · ${html(matchDate(row.match_date))}</span></span>
      <strong>${html(row.score || 'Score unavailable')}</strong>
      ${!group || group.includeLeague ? `<span>${html(row.league_name || 'League unavailable')}</span>` : ''}
    </span>
    <span class="app-tool-arrow" aria-hidden="true">›</span>
  </button></li>`
}
