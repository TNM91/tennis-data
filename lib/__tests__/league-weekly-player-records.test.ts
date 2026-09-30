import { describe, expect, it } from 'vitest'
import { buildLeagueWeeklyPlayerRecords } from '../league-weekly-player-records'

const sessions = [
  { id: 'week-1', league_id: 'league-1', status: 'published' },
  { id: 'week-2', league_id: 'league-1', status: 'completed' },
]

describe('weekly league player records', () => {
  it('builds player records and standings from confirmed and league-approved sets', () => {
    const records = buildLeagueWeeklyPlayerRecords({
      participants: [{ leagueId: 'league-1', playerName: 'Alex Player' }],
      sessions,
      results: [
        { session_id: 'week-1', side_a_players: ['Alex Player', 'Blair'], side_b_players: ['Casey', 'Devon'], side_a_games: 6, side_b_games: 3, review_status: 'confirmed' },
        { session_id: 'week-2', side_a_players: ['Casey', 'Alex Player'], side_b_players: ['Blair', 'Devon'], side_a_games: 4, side_b_games: 6, review_status: 'approved' },
        { session_id: 'week-2', side_a_players: ['Blair', 'Casey'], side_b_players: ['Alex Player', 'Devon'], side_a_games: 2, side_b_games: 6, review_status: 'confirmed' },
      ],
    })

    expect(records).toEqual([{
      leagueId: 'league-1',
      playerName: 'Alex Player',
      wins: 2,
      losses: 1,
      setsPlayed: 3,
      weeksPlayed: 2,
      leagueSetCount: 3,
      leaderName: 'Alex Player',
      leaderWins: 2,
      leaderLosses: 1,
    }])
  })

  it('excludes pending, disputed, and unpublished scores', () => {
    const records = buildLeagueWeeklyPlayerRecords({
      participants: [{ leagueId: 'league-1', playerName: 'alex player' }],
      sessions: [...sessions, { id: 'week-draft', league_id: 'league-1', status: 'roster_confirmed' }],
      results: [
        { session_id: 'week-1', side_a_players: ['Alex Player'], side_b_players: ['Blair'], side_a_games: 6, side_b_games: 4, review_status: 'pending' },
        { session_id: 'week-2', side_a_players: ['Alex Player'], side_b_players: ['Blair'], side_a_games: 6, side_b_games: 4, review_status: 'disputed' },
        { session_id: 'week-draft', side_a_players: ['Alex Player'], side_b_players: ['Blair'], side_a_games: 6, side_b_games: 4, review_status: 'approved' },
      ],
    })

    expect(records).toEqual([])
  })

  it('keeps league standings visible before the linked player records a set', () => {
    const records = buildLeagueWeeklyPlayerRecords({
      participants: [{ leagueId: 'league-1', playerName: 'Alex Player' }],
      sessions,
      results: [
        { session_id: 'week-1', side_a_players: ['Blair', 'Casey'], side_b_players: ['Devon', 'Emery'], side_a_games: 6, side_b_games: 2, review_status: 'confirmed' },
      ],
    })

    expect(records[0]).toMatchObject({
      playerName: 'Alex Player',
      wins: 0,
      losses: 0,
      weeksPlayed: 0,
      leagueSetCount: 1,
      leaderName: 'Blair',
    })
  })
})
