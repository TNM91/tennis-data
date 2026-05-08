import { describe, expect, it } from 'vitest'
import {
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
})
