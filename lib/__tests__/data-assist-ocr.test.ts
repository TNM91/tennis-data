import { describe, expect, it } from 'vitest'
import {
  buildScorecardOcrDraftFromText,
  buildMockScorecardOcrDraft,
  buildEmptyScorecardDraftFields,
  getDataAssistOcrReadiness,
  getScorecardDraftReadiness,
  queueScorecardOcrDraft,
} from '../data-assist-ocr'

describe('Data Assist OCR boundary', () => {
  it('keeps OCR disabled until a verified provider is implemented', () => {
    const readiness = getDataAssistOcrReadiness()

    expect(readiness.provider).toBe('disabled')
    expect(readiness.canRun).toBe(false)
    expect(readiness.reason).toContain('disabled')
  })

  it('creates an empty scorecard draft that cannot be imported', () => {
    const fields = buildEmptyScorecardDraftFields()
    const readiness = getScorecardDraftReadiness(fields)

    expect(readiness.ready).toBe(false)
    expect(readiness.warnings).toContain('Missing TennisLink match id.')
    expect(fields.parserWarnings[0]).toContain('OCR not run')
  })

  it('returns a queued timestamp without pretending OCR ran', () => {
    const result = queueScorecardOcrDraft()

    expect(result.canRun).toBe(false)
    expect(result.status).toBe('disabled')
    expect(new Date(result.queuedAt).toString()).not.toBe('Invalid Date')
  })

  it('builds a review-only mock OCR draft from stored screenshots', () => {
    const draft = buildMockScorecardOcrDraft([
      {
        fileName: 'tennislink-scorecard-2.png',
        uploadOrder: 2,
        imageWidth: 1200,
        imageHeight: 2400,
        confidenceScore: 0.8,
        visualSignals: ['Readable screenshot dimensions'],
      },
      {
        fileName: 'tennislink-scorecard-1.png',
        uploadOrder: 1,
        imageWidth: 1200,
        imageHeight: 2400,
        confidenceScore: 0.82,
        visualSignals: ['Readable screenshot dimensions'],
      },
    ])

    expect(draft.provider).toBe('mock_review')
    expect(draft.sourceScreenshotCount).toBe(2)
    expect(draft.rawTextPreview.split('\n')[0]).toContain('tennislink-scorecard-1.png')
    expect(draft.parserWarnings[0]).toContain('Mock OCR boundary')
    expect(draft.lines).toEqual([])
    expect(draft.confidenceScore).toBe(0)
  })

  it('builds a review-only parsed draft from OCR text when a provider supplies text', () => {
    const draft = buildScorecardOcrDraftFromText(
      `
        TennisLink Scorecard
        Match ID: USTA-246810
        Match Date: 05/01/2026
        Home Team: Dallas Indoor Aces
        Away Team: Plano Net Rush
        1D John Smith / Bob Lee def. Adam Roe / Tim Fox 6-4 6-3
      `,
      [
        {
          fileName: 'tennislink-scorecard.png',
          uploadOrder: 1,
          imageWidth: 1200,
          imageHeight: 2400,
          confidenceScore: 0.84,
          visualSignals: ['Readable screenshot dimensions'],
        },
      ],
    )

    expect(draft.provider).toBe('mock_review')
    expect(draft.externalMatchId).toBe('USTA-246810')
    expect(draft.homeTeam).toBe('Dallas Indoor Aces')
    expect(draft.lineCount).toBe(1)
    expect(draft.lines[0]).toMatchObject({
      lineLabel: '1 Doubles',
      score: '6-4 6-3',
      winner: 'home',
    })
    expect(draft.sourceScreenshotCount).toBe(1)
    expect(draft.confidenceScore).toBeGreaterThan(0.7)
    expect(draft.parserWarnings[0]).toContain('Review-only')
  })
})
