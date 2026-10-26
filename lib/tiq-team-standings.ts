import {calculateDynamicPointsForSides,compareTiqTeamStandings} from './tiq-scoring'
import type {CompetitionStandingsRule} from './competition-rules'
export type TiqTeamStandingRow={teamName:string;wins:number;losses:number;ties:number;lineWins:number;lineLosses:number;points:number}
export function buildTiqTeamStandings(events:ReadonlyArray<{id:string;team_a_name:string;team_b_name:string}>,lines:ReadonlyArray<{event_id:string;winner_side:string;score:string|null}>,useDynamicPoints:boolean,standingsRule:CompetitionStandingsRule='auto'):TiqTeamStandingRow[]{
    const lineCountsByEvent: Record<string, { a: number; b: number; aPoints: number; bPoints: number }> = Object.create(null)
    for (const line of lines) {
      if (!lineCountsByEvent[line.event_id]) lineCountsByEvent[line.event_id] = { a: 0, b: 0, aPoints: 0, bPoints: 0 }
      if (line.winner_side === 'A') lineCountsByEvent[line.event_id].a++
      else if (line.winner_side === 'B') lineCountsByEvent[line.event_id].b++

      if (useDynamicPoints) {
        const points = calculateDynamicPointsForSides(
          line.score,
          line.winner_side === 'A' || line.winner_side === 'B' ? line.winner_side : null,
        )
        lineCountsByEvent[line.event_id].aPoints += points.sideAPoints
        lineCountsByEvent[line.event_id].bPoints += points.sideBPoints
      }
    }

    const records: Record<string, TiqTeamStandingRow> = Object.create(null)

    function ensureTeam(name: string) {
      if (!records[name]) records[name] = { teamName: name, wins: 0, losses: 0, ties: 0, lineWins: 0, lineLosses: 0, points: 0 }
    }

    for (const event of events) {
      const counts = lineCountsByEvent[event.id] || { a: 0, b: 0, aPoints: 0, bPoints: 0 }
      ensureTeam(event.team_a_name)
      ensureTeam(event.team_b_name)

      if (counts.a > counts.b) {
        records[event.team_a_name].wins++
        records[event.team_b_name].losses++
      } else if (counts.b > counts.a) {
        records[event.team_b_name].wins++
        records[event.team_a_name].losses++
      } else if (counts.a > 0 || counts.b > 0) {
        records[event.team_a_name].ties++
        records[event.team_b_name].ties++
      }

      records[event.team_a_name].lineWins += counts.a
      records[event.team_a_name].lineLosses += counts.b
      records[event.team_a_name].points += useDynamicPoints ? counts.aPoints : counts.a
      records[event.team_b_name].lineWins += counts.b
      records[event.team_b_name].lineLosses += counts.a
      records[event.team_b_name].points += useDynamicPoints ? counts.bPoints : counts.b
    }

    const standings = Object.values(records).sort((a, b) =>
      compareTiqTeamStandings(a, b, useDynamicPoints ? 'dynamic_points' : 'standard', standingsRule),
    )

 return standings
}
