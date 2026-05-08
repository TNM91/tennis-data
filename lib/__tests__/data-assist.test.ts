import { describe, expect, it, vi } from 'vitest'
import type { DataAssistPreparedScreenshot } from '../data-assist'

vi.mock('../auth', () => ({
  getClientAuthState: async () => ({ user: null }),
}))

vi.mock('../supabase', () => ({
  supabase: {},
}))

const {
  getDataAssistContributionValue,
  reorderDataAssistScreenshots,
  summarizeDataAssistBatch,
  validateDataAssistFiles,
} = await import('../data-assist')

function screenshot(
  overrides: Partial<DataAssistPreparedScreenshot> = {},
): DataAssistPreparedScreenshot {
  return {
    id: overrides.id || 'shot-1',
    file: {} as File,
    previewUrl: '',
    uploadOrder: overrides.uploadOrder || 1,
    fileName: overrides.fileName || 'tennislink-scorecard.png',
    mimeType: overrides.mimeType || 'image/png',
    fileSizeBytes: overrides.fileSizeBytes || 1000,
    imageWidth: overrides.imageWidth || 1200,
    imageHeight: overrides.imageHeight || 2400,
    clientFingerprint: overrides.clientFingerprint || 'fingerprint',
    detectionStatus: overrides.detectionStatus || 'supported',
    detectedLayout: overrides.detectedLayout || 'tennislink_scorecard',
    confidenceScore: overrides.confidenceScore ?? 0.82,
    visualSignals: overrides.visualSignals || ['TennisLink or USTA filename hint'],
    rejectionReason: overrides.rejectionReason || '',
  }
}

describe('Data Assist foundation helpers', () => {
  it('rejects unsupported batch file types', () => {
    const file = { type: 'application/pdf', size: 1200 } as File

    expect(validateDataAssistFiles([file])).toContain('screenshots')
  })

  it('summarizes a supported scorecard batch for layout review', () => {
    const summary = summarizeDataAssistBatch('scorecard', [
      screenshot({ id: 'one', uploadOrder: 1, confidenceScore: 0.9 }),
      screenshot({ id: 'two', uploadOrder: 2, confidenceScore: 0.78 }),
    ])

    expect(summary.status).toBe('layout_detected')
    expect(summary.detectedLayout).toBe('tennislink_scorecard')
    expect(summary.confidenceScore).toBe(0.84)
    expect(summary.contributionValue).toContain('Scorecards')
  })

  it('keeps weaker batches in review instead of importing', () => {
    const summary = summarizeDataAssistBatch('schedule', [
      screenshot({
        detectionStatus: 'needs_review',
        detectedLayout: 'tennislink_schedule',
        confidenceScore: 0.58,
      }),
    ])

    expect(summary.status).toBe('needs_review')
    expect(summary.detectedLayout).toBe('tennislink_schedule')
  })

  it('preserves and rewrites screenshot order when users reorder mobile captures', () => {
    const reordered = reorderDataAssistScreenshots(
      [
        screenshot({ id: 'first', uploadOrder: 1 }),
        screenshot({ id: 'second', uploadOrder: 2 }),
        screenshot({ id: 'third', uploadOrder: 3 }),
      ],
      2,
      1,
    )

    expect(reordered.map((item) => item.id)).toEqual(['first', 'third', 'second'])
    expect(reordered.map((item) => item.uploadOrder)).toEqual([1, 2, 3])
  })

  it('states contribution value without rewarding raw volume', () => {
    expect(getDataAssistContributionValue('team_summary')).toContain('roster identity')
  })
})
