import { describe, expect, it } from 'vitest'
import { buildDataAssistScorecardImportRow, collectDataAssistImportPlayerNames } from '../data-assist-import'
import type { DataAssistScorecardParsedDraft } from '../data-assist-ocr'

function parsedDraft(overrides: Partial<DataAssistScorecardParsedDraft> = {}): DataAssistScorecardParsedDraft {
  return {
    externalMatchId: '1011650664',
    homeTeam: 'Schnellaveria',
    awayTeam: 'Wily Wolverines',
    matchDate: '1/18/2026',
    lineCount: 2,
    parserWarnings: [],
    lines: [
      {
        lineLabel: '1 Singles',
        homePlayers: ['Kevin Chen'],
        awayPlayers: ['Ralf Nosic'],
        score: '6-2 6-1',
        winner: 'home',
        confidenceScore: 0.92,
      },
      {
        lineLabel: '1 Doubles',
        homePlayers: ['Neil Arora', 'Cyrus Mevorach'],
        awayPlayers: ['Stefan Nosic', 'Paul Gontarz'],
        score: '7-6 6-1',
        winner: 'unknown',
        confidenceScore: 0.76,
      },
    ],
    rawTextPreview: '',
    sourceScreenshotCount: 1,
    provider: 'tesseract',
    confidenceScore: 0.84,
    ...overrides,
  }
}

describe('Data Assist import transformer', () => {
  it('converts OCR scorecard drafts into scorecard import rows', () => {
    const preview = buildDataAssistScorecardImportRow(parsedDraft(), {
      sourceBatchId: 'batch-1',
      reviewedBy: 'member-1',
      reviewedAt: '2026-05-08T00:00:00.000Z',
    })

    expect(preview.row.externalMatchId).toBe('1011650664')
    expect(preview.row.source).toBe('tennislink_scorecard_data_assist')
    expect(preview.row.lines[0]).toMatchObject({
      lineNumber: 1,
      matchType: 'singles',
      sideAPlayers: ['Kevin Chen'],
      sideBPlayers: ['Ralf Nosic'],
      winnerSide: 'A',
    })
    expect(preview.row.lines[1].winnerSide).toBeNull()
    expect(preview.unresolvedWinnerCount).toBe(1)
    expect(collectDataAssistImportPlayerNames(preview.row)).toContain('Cyrus Mevorach')
  })
})
