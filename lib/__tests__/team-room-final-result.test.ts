import { describe, expect, it } from 'vitest'
import {
  buildTeamRoomFinalResult,
  buildTeamRoomFinalResultLines,
  selectTeamRoomCompletedMatch,
  type TeamRoomCompletedMatch,
} from '../team-room-final-result'

const matches: TeamRoomCompletedMatch[] = [
  {
    id: 'match-1',
    external_match_id: '1011650664',
    home_team: 'Baseline Crew',
    away_team: 'SuperSmash Bros/Pottebaum-Meinart',
    match_date: '2026-08-08',
    league_name: '2026 Tri-Level',
    flight: '3.5/4.0/4.5',
    winner_side: 'B',
    score: '1-2',
    status: 'completed',
    line_number: null,
  },
]

describe('Team Room final result', () => {
  it('matches a completed scorecard to the Team Room match context', () => {
    expect(selectTeamRoomCompletedMatch(matches, {
      teamName: 'SuperSmash Bros/Pottebaum-Meinart',
      leagueName: '2026 Tri-Level',
      flight: '3.5 / 4.0 / 4.5',
      matchDate: '2026-08-08',
      opponent: 'Baseline Crew',
    })?.id).toBe('match-1')
  })

  it('orients the score and outcome to the linked team', () => {
    expect(buildTeamRoomFinalResult(matches[0], 'SuperSmash Bros/Pottebaum-Meinart')).toEqual({
      matchId: 'match-1',
      externalMatchId: '1011650664',
      teamName: 'SuperSmash Bros/Pottebaum-Meinart',
      opponentName: 'Baseline Crew',
      teamScore: '2',
      opponentScore: '1',
      score: '1-2',
      outcome: 'win',
      lines: [],
      unresolvedPlayerCount: 0,
    })
  })

  it('builds court results with team-oriented players, winners, and lineup labels', () => {
    expect(buildTeamRoomFinalResultLines({
      teamSide: 'B',
      lineupLabels: ['4.5 Doubles', '4.0 Doubles'],
      matches: [
        { id: 'line-2', external_match_id: '1011650664::line:2', line_number: '2', match_type: 'doubles', winner_side: 'A', score: '6-3, 6-4', status: 'completed' },
        { id: 'line-1', external_match_id: '1011650664::line:1', line_number: '1', match_type: 'doubles', winner_side: 'B', score: '4-6, 6-3, 10-7', status: 'completed' },
      ],
      matchPlayers: [
        { match_id: 'line-1', player_id: 'opponent-1', side: 'A', seat: 1 },
        { match_id: 'line-1', player_id: 'team-2', side: 'B', seat: 2 },
        { match_id: 'line-1', player_id: 'team-1', side: 'B', seat: 1 },
        { match_id: 'line-1', player_id: 'opponent-2', side: 'A', seat: 2 },
      ],
      players: [
        { id: 'team-1', name: 'Alex Ace' },
        { id: 'team-2', name: 'Blair Baseline' },
        { id: 'opponent-1', name: 'Casey Court' },
        { id: 'opponent-2', name: 'Drew Deuce' },
      ],
    })).toEqual([
      {
        id: 'line-1',
        label: '4.5 Doubles',
        teamPlayers: ['Alex Ace', 'Blair Baseline'],
        opponentPlayers: ['Casey Court', 'Drew Deuce'],
        score: '4-6, 6-3, 10-7',
        winner: 'team',
        teamMissingPlayerCount: 0,
        opponentMissingPlayerCount: 0,
      },
      {
        id: 'line-2',
        label: '4.0 Doubles',
        teamPlayers: [],
        opponentPlayers: [],
        score: '6-3, 6-4',
        winner: 'opponent',
        teamMissingPlayerCount: 2,
        opponentMissingPlayerCount: 2,
      },
    ])
  })

  it('rejects an ambiguous same-day result instead of guessing', () => {
    expect(selectTeamRoomCompletedMatch([...matches, { ...matches[0], id: 'match-2', external_match_id: '1011650665' }], {
      teamName: 'SuperSmash Bros/Pottebaum-Meinart',
      leagueName: '',
      flight: '',
      matchDate: '2026-08-08',
      opponent: '',
    })).toBeNull()
  })

  it('prefers an exact TennisLink match ID when one is available', () => {
    const second = { ...matches[0], id: 'match-2', external_match_id: '1011650665' }
    expect(selectTeamRoomCompletedMatch([...matches, second], {
      teamName: 'SuperSmash Bros/Pottebaum-Meinart',
      leagueName: '',
      flight: '',
      matchDate: '2026-08-08',
      opponent: '',
      externalMatchId: '1011650665',
    })?.id).toBe('match-2')
  })

  it('prefers the exact scheduled match record carried from lineup setup', () => {
    const second = { ...matches[0], id: 'match-2', external_match_id: '1011650665' }
    expect(selectTeamRoomCompletedMatch([...matches, second], {
      matchId: 'match-2',
      teamName: 'SuperSmash Bros/Pottebaum-Meinart',
      leagueName: '',
      flight: '',
      matchDate: '2026-08-08',
      opponent: '',
    })?.id).toBe('match-2')
  })
})
