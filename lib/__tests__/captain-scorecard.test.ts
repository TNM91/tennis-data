import { describe, expect, it } from 'vitest'
import {
  buildCaptainScorecardExternalMatchId,
  buildCaptainScorecardImportRow,
  buildCaptainScorecardObservations,
  hasHigherPriorityCaptainScorecardConflict,
  validateCaptainScorecardInput,
} from '../captain-scorecard'

const input = {
  teamName: 'SuperSmash Bros',
  opponentTeam: 'Hamilton',
  matchDate: '2026-08-31',
  leagueName: '2026 STL Tri-Level 18 & Over',
  flight: 'Men 3.5/4.0/4.5',
  lines: [{
    courtNumber: 1,
    matchType: 'doubles' as const,
    teamPlayers: ['Nathan Meinert', 'Michael Ho'],
    opponentPlayers: ['Player One', 'Player Two'],
    outcome: 'opponent' as const,
    score: '6-4 3-6 1-0',
  }],
}

describe('captain scorecard capture', () => {
  it('builds one deterministic, rating-ready scorecard row', () => {
    const row = buildCaptainScorecardImportRow(input)
    expect(row.externalMatchId).toMatch(/^captain-scorecard:/)
    expect(row.source).toBe('captain_scorecard')
    expect(row.totalTeamScore).toEqual({ home: 0, away: 1 })
    expect(row.lines[0]).toMatchObject({
      matchType: 'doubles',
      winnerSide: 'B',
      score: '6-4 3-6 1-0',
      scoreEventType: 'third_set_match_tiebreak',
      evidenceClass: 'locked',
    })
  })

  it('keeps canonical match identity stable when a captain corrects the score', () => {
    const corrected = { ...input, lines: [{ ...input.lines[0], score: '6-4 4-6 10-8' }] }
    expect(buildCaptainScorecardExternalMatchId(input)).toBe(buildCaptainScorecardExternalMatchId(corrected))
    expect(buildCaptainScorecardObservations(input)[0].fingerprint).toBe(buildCaptainScorecardObservations(corrected)[0].fingerprint)
  })

  it('requires complete named courts before committing', () => {
    expect(validateCaptainScorecardInput({ ...input, lines: [{ ...input.lines[0], opponentPlayers: ['Only one'] }] }))
      .toBe('Court 1 needs two opponents.')
  })

  it('never silently replaces an admin verified disagreement', () => {
    const observation = buildCaptainScorecardObservations(input)[0]
    expect(hasHigherPriorityCaptainScorecardConflict({ source: 'admin_verified', scoreText: '6-4 6-4' }, observation)).toBe(true)
    expect(hasHigherPriorityCaptainScorecardConflict({ source: 'tennisrecord', scoreText: '6-4 6-4' }, observation)).toBe(false)
  })
})
