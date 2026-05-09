import { describe, expect, it } from 'vitest'
import {
  assessDataAssistScorecardDraft,
  buildDataAssistOcrQualitySummary,
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

  it('can expose the Tesseract provider when explicitly enabled', () => {
    const readiness = getDataAssistOcrReadiness({
      NEXT_PUBLIC_DATA_ASSIST_OCR_PROVIDER: 'tesseract',
    })

    expect(readiness.provider).toBe('tesseract')
    expect(readiness.canRun).toBe(true)
    expect(readiness.reason).toContain('Scorecard reading')
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
    expect(draft.parserWarnings[0]).toContain('Trusted verification')
    expect(draft.ocrQuality).toMatchObject({
      provider: 'mock_review',
      parsedLineCount: 1,
      reviewPriority: 'needs_manual_review',
    })
  })

  it('marks parsed drafts with the OCR provider that supplied the text', () => {
    const draft = buildScorecardOcrDraftFromText(
      'Match ID: USTA-246810\nMatch Date: 05/01/2026\nHome Team: Dallas Indoor Aces\nAway Team: Plano Net Rush\n1S Jane Ace def. Molly Baseline 6-1 6-0',
      [],
      'tesseract',
    )

    expect(draft.provider).toBe('tesseract')
    expect(draft.externalMatchId).toBe('USTA-246810')
    expect(draft.lines[0].lineLabel).toBe('1 Singles')
  })

  it('summarizes OCR quality for review triage', () => {
    expect(buildDataAssistOcrQualitySummary({
      provider: 'tesseract',
      rawText: '',
      parserWarnings: [],
      parsedLineCount: 0,
      ocrConfidenceScore: 0,
      parserConfidenceScore: 0,
    }).reviewPriority).toBe('blocked')

    expect(buildDataAssistOcrQualitySummary({
      provider: 'tesseract',
      rawText: '1S Jane Ace def. Molly Baseline 6-1 6-0',
      parserWarnings: ['Missing TennisLink match id.'],
      parsedLineCount: 1,
      ocrConfidenceScore: 0.72,
      parserConfidenceScore: 0.7,
    }).reviewPriority).toBe('needs_manual_review')
  })

  it('auto-assesses high-confidence complete scorecards without admin review', () => {
    const draft = buildScorecardOcrDraftFromText(
      [
        'Match ID: USTA-246810',
        'Match Date: 05/01/2026',
        'Home Team: Dallas Indoor Aces',
        'Away Team: Plano Net Rush',
        '1S Jane Ace def. Molly Baseline 6-1 6-0',
        '2S Tina Topspin def. Sara Slice 6-4 6-4',
        '1D John Smith / Bob Lee def. Adam Roe / Tim Fox 6-4 6-3',
      ].join('\n'),
      [],
      'tesseract',
    )
    draft.ocrQuality = buildDataAssistOcrQualitySummary({
      provider: 'tesseract',
      rawText: draft.rawTextPreview,
      parserWarnings: [],
      parsedLineCount: draft.lineCount,
      ocrConfidenceScore: 0.86,
      parserConfidenceScore: 0.88,
    })

    const assessment = assessDataAssistScorecardDraft(draft)

    expect(assessment.decision).toBe('auto_ready')
    expect(assessment.adminReviewRequired).toBe(false)
  })

  it('routes incomplete scorecard identity to admin exception review', () => {
    const draft = buildScorecardOcrDraftFromText(
      '1S Jane Ace def. Molly Baseline 6-1 6-0',
      [],
      'tesseract',
    )
    draft.ocrQuality = buildDataAssistOcrQualitySummary({
      provider: 'tesseract',
      rawText: draft.rawTextPreview,
      parserWarnings: [],
      parsedLineCount: draft.lineCount,
      ocrConfidenceScore: 0.82,
      parserConfidenceScore: 0.82,
    })

    const assessment = assessDataAssistScorecardDraft(draft)

    expect(assessment.decision).toBe('admin_exception')
    expect(assessment.adminReviewRequired).toBe(true)
    expect(assessment.reasons).toContain('Missing TennisLink match id.')
  })
})
