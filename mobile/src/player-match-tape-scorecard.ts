import type {PlayerPerformanceData} from './player-performance-data'
import type {RecentMatchRow} from './recent-results'
import {matchupOutcome} from '../../lib/matchup-outcome'

export function matchTapeScorecard(data:PlayerPerformanceData,id:string,playerId:string):RecentMatchRow|null {
 if(data.matchesLimited||!playerId)return null
 const matches=data.matches.filter(match=>match.id===id)
 if(matches.length!==1)return null
 const match=matches[0],row=match.scorecard
 if(!row||row.id!==id||row.match_date!==match.date||row.match_type!==match.matchType||row.score!==(match.score??null)||!Array.isArray(row.match_players)||row.match_players.length!==1)return null
 const selected=row.match_players[0],outcome=matchupOutcome(selected.side,row.winner_side)
 if(selected.player_id!==playerId||!outcome||(outcome==='A'?'W':'L')!==match.result)return null
 return {...row,match_players:row.match_players.map(player=>({...player}))}
}
