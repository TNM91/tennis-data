import {html,matchParticipantChoice} from './match-details'
import {matchScorecardSide} from './match-set-scores'
import {matchDate, type matchResult, type RecentMatchRow} from './recent-results'

export function scorecardOpponents(row:RecentMatchRow,playerId:string) {
  const lineup=row.participants
  if(!Array.isArray(lineup)||lineup.length>4||lineup.some(player=>!player))return ''
  const side=matchScorecardSide(row,playerId)
  if(!side||!lineup.some(player=>player.player_id===playerId&&player.side===side))return ''
  const otherSide=side==='A'?'B':'A'
  const opponents=lineup.map((player,index)=>({player,index})).filter(({player})=>player.side===otherSide)
  const format=row.match_type?.toLowerCase()
  const expected=format==='singles'?1:format==='doubles'?2:0
  if(opponents.length!==expected)return ''
  const names=opponents.sort((a,b)=>(a.player.seat??99)-(b.player.seat??99)).map(({index})=>matchParticipantChoice(lineup,index)?.name)
  return names.every(Boolean)?names.join(' & '):''
}

export function recentScorecardRow(
  row: RecentMatchRow,
  index: number,
  result: ReturnType<typeof matchResult>,
  playerId: string,
  group?: {label: string; includeLeague: boolean},
) {
  const tone = result === 'Won' ? 'won' : result === 'Lost' ? 'lost' : 'pending'
  const opponents=scorecardOpponents(row,playerId)
  return `<li><button type="button" class="secondary match-open recent-scorecard" data-index="${index}">
    ${group ? `<span class="sr-only">Open ${html(group.label)} scorecard </span>` : ''}
    <span class="app-tool-copy">
      <span class="recent-scorecard-meta"><b class="result-${tone}">${result}</b><span class="recent-scorecard-date">${html(row.match_type || 'Match')} · ${html(matchDate(row.match_date))}</span></span>
      ${opponents?`<span class="recent-scorecard-opponent">vs ${html(opponents)}</span>`:''}
      <strong>${html(row.score || 'Score unavailable')}</strong>
      ${!group || group.includeLeague ? `<span>${html(row.league_name || 'League unavailable')}</span>` : ''}
    </span>
    <span class="app-tool-arrow" aria-hidden="true">›</span>
  </button></li>`
}
