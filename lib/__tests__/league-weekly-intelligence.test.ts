import { describe, expect, it } from 'vitest'
import { buildLeagueWeeklyCourts } from '../league-weekly-format'
import { buildBalancedLeagueWeeklyCourts, buildLeagueWeeklyCourtPlan, buildLeagueWeeklyDashboard, buildLeagueWeeklyScoreReview, buildLeagueWeeklySeasonScorecards, deriveLeagueWeeklyOfficialScore } from '../league-weekly-intelligence'

describe('weekly league score intelligence', () => {
  it('confirms matching submissions and flags conflicting ones', () => {
    const base = { courtNumber: 1, setNumber: 1, submittedAt: '2026-10-01T10:00:00Z' }
    expect(deriveLeagueWeeklyOfficialScore([
      { ...base, sideAGames: 6, sideBGames: 4, submittedByName: 'A' },
      { ...base, sideAGames: 6, sideBGames: 4, submittedByName: 'B' },
    ])?.reviewStatus).toBe('confirmed')
    expect(deriveLeagueWeeklyOfficialScore([
      { ...base, sideAGames: 6, sideBGames: 4, submittedByName: 'A' },
      { ...base, sideAGames: 4, sideBGames: 6, submittedByName: 'B' },
    ])?.reviewStatus).toBe('disputed')
  })

  it('tracks missing, pending, disputed, and accepted sets', () => {
    const courts = buildLeagueWeeklyCourts(['A', 'B', 'C', 'D'], { courtCount: 1 })
    const review = buildLeagueWeeklyScoreReview(courts, [
      { courtNumber: 1, setNumber: 1, sideAGames: 6, sideBGames: 4, reviewStatus: 'confirmed' },
      { courtNumber: 1, setNumber: 2, sideAGames: 6, sideBGames: 3, reviewStatus: 'disputed' },
    ], [{ courtNumber: 1, setNumber: 1, sideAGames: 6, sideBGames: 4, submittedByName: 'A' }])
    expect(review).toMatchObject({ expectedCount: 3, acceptedCount: 1, submittedPlayerCount: 1 })
    expect(review.missing).toEqual([{ courtNumber: 1, setNumber: 3 }])
    expect(review.disputed).toEqual([{ courtNumber: 1, setNumber: 2 }])
  })

  it('builds weekly leaders and season scorecards from accepted scores only', () => {
    const courts = buildLeagueWeeklyCourts(['A', 'B', 'C', 'D'], { courtCount: 1 })
    const results = [
      { courtNumber: 1, setNumber: 1, sideAGames: 6, sideBGames: 4, reviewStatus: 'approved' as const },
      { courtNumber: 1, setNumber: 2, sideAGames: 6, sideBGames: 2, reviewStatus: 'pending' as const },
    ]
    expect(buildLeagueWeeklyDashboard(courts, results)).toMatchObject({ completedSets: 1, totalGames: 10, closeSets: 1 })
    expect(buildLeagueWeeklySeasonScorecards([{ playOn: '2026-10-01', courts, results }]).find((item) => item.playerName === 'A')).toMatchObject({ weeksPlayed: 1, setsPlayed: 1, setsWon: 1, setWinPercentage: 100, currentWinStreak: 1 })
  })

  it('honors manual court locks and avoids repeating the latest court where possible', () => {
    const players = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const history = [buildLeagueWeeklyCourts(players, { courtCount: 2 })]
    const courts = buildBalancedLeagueWeeklyCourts({ playerNames: players, settings: { courtCount: 2, startTimes: ['08:00', '08:30'] }, scorecards: [], historyCourts: history, lockedCourts: { A: 2 } })
    expect(courts).toHaveLength(2)
    expect(courts.flatMap((court) => court.players).sort()).toEqual([...players].sort())
    expect(courts[1].players).toContain('A')
    expect(courts.map((court) => court.startTime)).toEqual(['08:00', '08:30'])
  })

  it('keeps overflow players on the waitlist when courts are full', () => {
    const players = ['A', 'B', 'C', 'D', 'E']
    const courts = buildBalancedLeagueWeeklyCourts({ playerNames: players, settings: { courtCount: 1 }, scorecards: [], historyCourts: [] })
    expect(courts).toHaveLength(1)
    expect(courts[0].players).toEqual(['A', 'B', 'C', 'D'])
  })

  it('explains a balanced recommendation using score history and recent courtmates', () => {
    const players = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const historyCourts = [buildLeagueWeeklyCourts(players, { courtCount: 2 })]
    const plan = buildLeagueWeeklyCourtPlan({
      playerNames: players,
      settings: { courtCount: 2, startTimes: ['08:00', '08:30'] },
      scorecards: [
        { playerName: 'A', setsPlayed: 6, setsWon: 5, gamesWon: 35, gamesLost: 22, gameDifferential: 13, weeksPlayed: 2, setWinPercentage: 83, currentWinStreak: 2 },
        { playerName: 'H', setsPlayed: 6, setsWon: 1, gamesWon: 21, gamesLost: 36, gameDifferential: -15, weeksPlayed: 2, setWinPercentage: 17, currentWinStreak: 0 },
      ],
      historyCourts,
      lockedCourts: { A: 2 },
    })

    expect(plan.strategy).toBe('balanced')
    expect(plan.courts).toHaveLength(2)
    expect(plan.courts[1].players).toContain('A')
    expect(plan.summary).toMatchObject({ trackedPlayers: 2, lockedPlayers: 1 })
    expect(plan.summary.movedPlayers).toBeGreaterThan(0)
    expect(plan.summary.freshConnections + plan.summary.repeatConnections).toBe(12)
    expect(plan.insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ courtNumber: 2, lockedPlayers: ['A'] }),
    ]))
  })

  it('honors court locks in manual mode and fills open spots in roster order', () => {
    const plan = buildLeagueWeeklyCourtPlan({
      playerNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      settings: { courtCount: 2, startTimes: ['08:00', '08:30'] },
      scorecards: [],
      historyCourts: [],
      lockedCourts: { A: 2 },
      strategy: 'manual',
    })

    expect(plan.strategy).toBe('manual')
    expect(plan.courts[0].players).toEqual(['B', 'C', 'D', 'E'])
    expect(plan.courts[1].players).toEqual(['A', 'F', 'G', 'H'])
    expect(plan.courts.map((court) => court.startTime)).toEqual(['08:00', '08:30'])
  })
})
