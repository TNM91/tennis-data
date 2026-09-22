import { describe, expect, it } from 'vitest'
import {
  buildCaptainScorecardExternalMatchId,
  buildCaptainScorecardImportRow,
  buildCaptainScorecardObservations,
  buildCaptainScorecardRecap,
  buildCaptainScorecardTeamRoomDraft,
  hasHigherPriorityCaptainScorecardConflict,
  isCaptainScorecardSavedRecap,
  resolveCaptainScorecardSaveTarget,
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

  it('reuses one canonical match for corrections and stops ambiguous duplicates', () => {
    const existingId = 'tennislink-scorecard:existing-match'
    expect(resolveCaptainScorecardSaveTarget(input, [existingId, existingId])).toEqual({
      ok: true,
      externalMatchId: existingId,
      reusesExistingMatch: true,
    })
    expect(resolveCaptainScorecardSaveTarget(input, ['match-a', 'match-b'])).toEqual({
      ok: false,
      message: 'This scorecard matches more than one existing match. Nothing was changed; review the duplicate match records first.',
    })
    expect(resolveCaptainScorecardSaveTarget(input, [])).toMatchObject({
      ok: true,
      reusesExistingMatch: false,
    })
  })

  it('requires complete named courts before committing', () => {
    expect(validateCaptainScorecardInput({ ...input, lines: [{ ...input.lines[0], opponentPlayers: ['Only one'] }] }))
      .toBe('Court 1 needs two opponents.')
  })

  it('records a USTA default without inventing players or a 6-0 score', () => {
    const defaulted = {
      ...input,
      lines: [{
        ...input.lines[0],
        teamPlayers: [],
        opponentPlayers: [],
        outcome: 'team' as const,
        score: '',
        resultType: 'default' as const,
        defaultKnownBeforeMatch: true,
      }],
    }
    expect(validateCaptainScorecardInput(defaulted)).toBeNull()
    expect(buildCaptainScorecardObservations(defaulted)[0].scoreText).toBe('DEFAULT')
    expect(buildCaptainScorecardImportRow(defaulted).lines[0]).toMatchObject({
      winnerSide: 'A',
      score: 'DEFAULT',
      sideAPlayers: [],
      sideBPlayers: [],
    })
    expect(buildCaptainScorecardRecap(defaulted).lines[0]).toMatchObject({
      resultType: 'default',
      defaultKnownBeforeMatch: true,
      score: 'Default',
    })
  })

  it('records an in-match retirement with the partial score and no invented games', () => {
    const retired = {
      ...input,
      lines: [{
        ...input.lines[0],
        outcome: 'team' as const,
        score: '6-4 2-1',
        resultType: 'retired' as const,
        retiredPlayer: 'Player One',
        retirementReason: 'injury' as const,
        retirementKnownBeforeMatch: false,
      }],
    }
    expect(validateCaptainScorecardInput(retired)).toBeNull()
    expect(buildCaptainScorecardObservations(retired)[0].scoreText).toBe('6-4 2-1 RET')
    expect(buildCaptainScorecardImportRow(retired).lines[0]).toMatchObject({
      winnerSide: 'A',
      score: '6-4 2-1 RET',
      sideAPlayers: ['Nathan Meinert', 'Michael Ho'],
      sideBPlayers: ['Player One', 'Player Two'],
    })
    expect(buildCaptainScorecardRecap(retired).lines[0]).toMatchObject({
      resultType: 'retired',
      retiredPlayer: 'Player One',
      retirementReason: 'injury',
      retirementKnownBeforeMatch: false,
      score: '6-4 2-1',
    })
  })

  it('requires the retiring player to come from the side that lost the court', () => {
    const invalidRetirement = {
      ...input,
      lines: [{
        ...input.lines[0],
        outcome: 'team' as const,
        resultType: 'retired' as const,
        retiredPlayer: 'Nathan Meinert',
        retirementReason: 'injury' as const,
        retirementKnownBeforeMatch: false,
      }],
    }
    expect(validateCaptainScorecardInput(invalidRetirement)).toBe('Choose who retired on court 1.')
    expect(validateCaptainScorecardInput({
      ...invalidRetirement,
      lines: [{ ...invalidRetirement.lines[0], score: 'RET' }],
    })).toBe('Add the score when play stopped on court 1.')
  })

  it('requires both photo evidence references when a captain uses a scorecard read', () => {
    expect(validateCaptainScorecardInput({ ...input, dataAssistBatchId: 'batch-1' }))
      .toBe('The scorecard photo reference is incomplete. Reopen the photo read and try again.')
    expect(validateCaptainScorecardInput({ ...input, dataAssistBatchId: 'batch-1', dataAssistDraftId: 'draft-1' }))
      .toBeNull()
  })

  it('never silently replaces an admin verified disagreement', () => {
    const observation = buildCaptainScorecardObservations(input)[0]
    expect(hasHigherPriorityCaptainScorecardConflict({ source: 'admin_verified', scoreText: '6-4 6-4' }, observation)).toBe(true)
    expect(hasHigherPriorityCaptainScorecardConflict({ source: 'tennisrecord', scoreText: '6-4 6-4' }, observation)).toBe(false)
  })

  it('summarizes the final court record for an immediate captain recap', () => {
    const recap = buildCaptainScorecardRecap({
      ...input,
      lines: [
        input.lines[0],
        { ...input.lines[0], courtNumber: 2, outcome: 'team', score: '6-3 6-4' },
      ],
    })
    expect(recap).toMatchObject({
      outcome: 'split',
      teamCourts: 1,
      opponentCourts: 1,
    })
    expect(recap.lines[0]).toMatchObject({ label: 'Doubles 1', score: '6-4 3-6 1-0' })
  })

  it('keeps a competition-specific court label from the confirmed lineup', () => {
    const recap = buildCaptainScorecardRecap({
      ...input,
      lines: [{ ...input.lines[0], label: '4.0 Doubles' }],
    })
    expect(recap.lines[0].label).toBe('4.0 Doubles')
  })

  it('recognizes the stored recap shape before a captain reopens it', () => {
    const storedRecap = {
      ...buildCaptainScorecardRecap(input),
      ratingChanges: [{
        playerId: 'player-1',
        playerName: 'Nathan Meinert',
        side: 'team' as const,
        matchType: 'doubles' as const,
        before: 4.5,
        after: 4.51,
        delta: 0.01,
      }],
      sourceConflictCount: 0,
    }
    expect(isCaptainScorecardSavedRecap(storedRecap)).toBe(true)
    expect(isCaptainScorecardSavedRecap({ outcome: 'won' })).toBe(false)
  })

  it('turns a verified captain entry into an announcement-ready Team Chat result', () => {
    const draft = buildCaptainScorecardTeamRoomDraft({
      teamName: 'SuperSmash',
      opponentTeam: 'Hamilton',
      matchDate: '2026-08-31',
      leagueName: 'STL Tri-Level',
      lines: [{
        courtNumber: 1,
        matchType: 'doubles',
        teamPlayers: ['Nathan Meinert', 'Michael Ho'],
        opponentPlayers: ['Player One', 'Player Two'],
        outcome: 'team',
        score: '6-4 3-6 1-0',
      }],
    }, 'captain-scorecard:test')

    expect(draft).toMatchObject({
      externalMatchId: 'captain-scorecard:test',
      homeTeam: 'SuperSmash',
      awayTeam: 'Hamilton',
      matchDate: '2026-08-31',
      provider: 'manual_review',
      lines: [{
        lineLabel: 'Doubles 1',
        winner: 'home',
        score: '6-4 3-6 1-0',
        scoreEventType: 'third_set_match_tiebreak',
      }],
    })
  })
})
