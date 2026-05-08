import { describe, expect, it } from 'vitest'
import {
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
  })
})
