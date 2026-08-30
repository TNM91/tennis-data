import { describe, expect, it } from 'vitest'
import {
  buildCaptainScorecardPhotoPrefill,
  captainScorecardPhotoPrefillStorageKey,
  getCaptainScorecardPhotoPrefillIssue,
  isCaptainScorecardPhotoPrefill,
} from '../captain-scorecard-photo-prefill'

describe('captain scorecard photo prefill', () => {
  const parsedDraft = {
    externalMatchId: 'ocr-scorecard:1',
    leagueName: 'STL Tri-Level',
    homeTeam: 'SuperSmash Bros',
    awayTeam: 'Hamilton',
    matchDate: '2026-08-31',
    lineCount: 2,
    parserWarnings: [],
    rawTextPreview: 'scorecard',
    sourceScreenshotCount: 1,
    provider: 'tesseract' as const,
    confidenceScore: 0.86,
    lines: [
      {
        lineLabel: 'Doubles 1',
        homePlayers: ['Nathan Meinert', 'Michael Ho'],
        awayPlayers: ['Player One', 'Player Two'],
        score: '6-4 3-6 1-0',
        winner: 'away',
        confidenceScore: 0.9,
      },
      {
        lineLabel: 'Singles 2',
        homePlayers: ['Brendan Czaicki'],
        awayPlayers: ['Player Three'],
        score: '6-3 6-4',
        winner: 'home',
        confidenceScore: 0.9,
      },
    ],
  }

  it('orients the OCR read to the captain team and preserves the photo reference', () => {
    const prefill = buildCaptainScorecardPhotoPrefill({
      teamName: 'SuperSmash Bros',
      dataAssistBatchId: 'batch-1',
      dataAssistDraftId: 'draft-1',
      parsedDraft,
    })

    expect(prefill).toMatchObject({
      version: 1,
      dataAssistBatchId: 'batch-1',
      dataAssistDraftId: 'draft-1',
      opponentTeam: 'Hamilton',
      matchDate: '2026-08-31',
      courts: [
        {
          courtNumber: 1,
          matchType: 'doubles',
          teamPlayers: ['Nathan Meinert', 'Michael Ho'],
          opponentPlayers: ['Player One', 'Player Two'],
          outcome: 'opponent',
        },
        {
          courtNumber: 2,
          matchType: 'singles',
          outcome: 'team',
        },
      ],
    })
    expect(isCaptainScorecardPhotoPrefill(prefill)).toBe(true)
    expect(captainScorecardPhotoPrefillStorageKey('batch-1')).toContain('batch-1')
  })

  it('flips players and winner when the captain team is the visiting side', () => {
    const prefill = buildCaptainScorecardPhotoPrefill({
      teamName: 'Hamilton',
      dataAssistBatchId: 'batch-1',
      dataAssistDraftId: 'draft-1',
      parsedDraft,
    })

    expect(prefill?.opponentTeam).toBe('SuperSmash Bros')
    expect(prefill?.courts[0]).toMatchObject({
      teamPlayers: ['Player One', 'Player Two'],
      opponentPlayers: ['Nathan Meinert', 'Michael Ho'],
      outcome: 'team',
    })
  })

  it('refuses an unsafe handoff when the scan cannot identify the captain team or a court winner', () => {
    expect(getCaptainScorecardPhotoPrefillIssue({
      teamName: 'A different team',
      dataAssistBatchId: 'batch-1',
      dataAssistDraftId: 'draft-1',
      parsedDraft,
    })).toContain('could not confirm A different team')

    const incompleteWinner = {
      ...parsedDraft,
      lines: [{ ...parsedDraft.lines[0], winner: 'unknown' }],
    }
    expect(getCaptainScorecardPhotoPrefillIssue({
      teamName: 'SuperSmash Bros',
      dataAssistBatchId: 'batch-1',
      dataAssistDraftId: 'draft-1',
      parsedDraft: incompleteWinner,
    })).toContain('could not confirm every court winner')
    expect(buildCaptainScorecardPhotoPrefill({
      teamName: 'SuperSmash Bros',
      dataAssistBatchId: 'batch-1',
      dataAssistDraftId: 'draft-1',
      parsedDraft: incompleteWinner,
    })).toBeNull()
  })
})
