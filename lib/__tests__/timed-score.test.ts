import { describe, expect, it } from 'vitest'
import { formatTimedScore, validateTimedScore, type TimedScoreInput } from '../timed-score'
import { parseScoreMetrics } from '../recalculateRatings'
import { buildCaptainScorecardImportRow, buildCaptainScorecardObservations, buildCaptainScorecardRecap, buildCaptainScorecardTeamRoomDraft, validateCaptainScorecardInput } from '../captain-scorecard'
import { buildScorecardPreviewModel } from '../ingestion/scorecardReview'

const loss: TimedScoreInput = {
  score: '4-6 5-4',
  outcome: 'opponent',
  timedSets: [{ setNumber: 2, decidedBy: 'tiebreak', winner: 'opponent', tiebreakScore: '5-7' }],
}

describe('timed sets', () => {
  it('records a 5-4 lead followed by a set-tiebreak loss without inventing games', () => {
    expect(validateTimedScore(loss)).toBeNull()
    expect(formatTimedScore(loss)).toBe('4-6 5-4 (timed: opponents won by tiebreak 5-7)')
    const metrics = parseScoreMetrics(formatTimedScore(loss), 'B')
    expect(metrics).toMatchObject({ parsed: true, totalGamesA: 9, totalGamesB: 10, totalGames: 19, tiebreakSets: 1, straightSetsWin: true })
  })

  it('preserves a winning result even when the winner won fewer games overall', () => {
    const score = formatTimedScore({ ...loss, score: '4-5', timedSets: [{ setNumber: 1, decidedBy: 'tiebreak', winner: 'team' }] })
    expect(parseScoreMetrics(score, 'A')).toMatchObject({ parsed: true, totalGamesA: 4, totalGamesB: 5, tiebreakSets: 1 })
  })

  it('accepts a two-game lead below six games and rejects the wrong winner', () => {
    const input: TimedScoreInput = { score: '4-2', outcome: 'team', timedSets: [{ setNumber: 1, decidedBy: 'two_game_lead', winner: 'team' }] }
    expect(validateTimedScore(input)).toBeNull()
    expect(validateTimedScore({ ...input, timedSets: [{ ...input.timedSets![0], winner: 'opponent' }] })).toContain('two-game lead')
    expect(validateTimedScore({ ...input, score: '5-4' })).toContain('two-game lead')
  })

  it('requires an explicit tiebreak winner and checks any entered points', () => {
    expect(validateTimedScore({ ...loss, timedSets: [{ ...loss.timedSets![0], winner: '' }] })).toContain('Choose who won set 2')
    for (const tiebreakScore of ['7-5', '6-7', 'bad', '4-5']) {
      expect(validateTimedScore({ ...loss, timedSets: [{ ...loss.timedSets![0], tiebreakScore }] })).not.toBeNull()
    }
    expect(validateTimedScore({ ...loss, timedSets: [{ ...loss.timedSets![0], tiebreakScore: '' }] })).toBeNull()
  })

  it('checks the court winner using timed-set winners rather than game leads', () => {
    expect(validateTimedScore({ ...loss, outcome: 'team' })).toContain('court winner')
    expect(validateTimedScore({ ...loss, score: '6-4 5-4' })).toContain('deciding set')
    expect(validateTimedScore({ ...loss, score: '6-4 5-4 8-10' })).toBeNull()
  })

  it('handles multiple timed sets and keeps match-tiebreak points out of games', () => {
    const input: TimedScoreInput = { score: '3-1 4-5 10-8', outcome: 'team', timedSets: [
      { setNumber: 1, decidedBy: 'two_game_lead', winner: 'team' },
      { setNumber: 2, decidedBy: 'tiebreak', winner: 'opponent', tiebreakScore: '2-7' },
    ] }
    expect(validateTimedScore(input)).toBeNull()
    expect(parseScoreMetrics(formatTimedScore(input), 'A')).toMatchObject({ parsed: true, totalGamesA: 7, totalGamesB: 6, totalGames: 13, tiebreakSets: 1, decidingSetPlayed: true })
  })

  it('rejects malformed timed metadata and incomplete ordinary sets', () => {
    for (const input of [
      { ...loss, timedSets: [] },
      { ...loss, timedSets: [loss.timedSets![0], loss.timedSets![0]] },
      { ...loss, timedSets: [{ ...loss.timedSets![0], setNumber: 4 }] },
      { ...loss, score: '3-4 5-4' },
      { ...loss, score: '4-6 10-8' },
    ]) expect(validateTimedScore(input)).not.toBeNull()
    expect(validateTimedScore({ ...loss, timedSets: null } as unknown as TimedScoreInput)).not.toBeNull()
  })

  it('carries timed results through import, review, recap, observations, and Team Chat', () => {
    const input = { teamName: 'The Other Guys', opponentTeam: 'Hodge-Kamman', matchDate: '2026-10-18', lines: [{ courtNumber: 1, matchType: 'doubles' as const, teamPlayers: ['David', 'Chris'], opponentPlayers: ['Opponent One', 'Opponent Two'], ...loss }] }
    expect(validateCaptainScorecardInput(input)).toBeNull()
    const row = buildCaptainScorecardImportRow(input)
    expect(row.lines[0]).toMatchObject({ winnerSide: 'B', scoreEventType: 'timed_match', timedMatch: true, score: formatTimedScore(loss) })
    expect(buildScorecardPreviewModel(row)).toMatchObject({ commitEligible: true, derivedTeamTotal: { home: 0, away: 1 } })
    expect(buildCaptainScorecardObservations(input)[0]).toMatchObject({ winnerSide: 'B', scoreText: formatTimedScore(loss) })
    expect(buildCaptainScorecardRecap(input).lines[0]).toMatchObject({ timedSets: loss.timedSets, score: formatTimedScore(loss), outcome: 'opponent' })
    expect(buildCaptainScorecardTeamRoomDraft(input).lines[0]).toMatchObject({ winner: 'away', score: formatTimedScore(loss), scoreEventType: 'timed_match' })
  })
  it('keeps default and retirement results separate from timed scoring', () => {
    const input = { teamName: 'Team', opponentTeam: 'Opponent', matchDate: '2026-10-18', lines: [{ courtNumber: 1, matchType: 'doubles' as const, teamPlayers: ['David', 'Chris'], opponentPlayers: ['One', 'Two'], ...loss }] }
    for (const resultType of ['default', 'retired'] as const) {
      expect(validateCaptainScorecardInput({ ...input, lines: [{ ...input.lines[0], resultType }] })).toContain('Timed sets apply to played courts only')
    }
    expect(validateCaptainScorecardInput({ ...input, lines: [{ ...input.lines[0], resultType: 'played' }] })).toBeNull()
  })

})
