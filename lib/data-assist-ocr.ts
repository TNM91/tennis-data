import { parseDataAssistScorecardText } from './data-assist-scorecard-parser'

export type DataAssistOcrProvider = 'disabled' | 'manual_review' | 'mock_review' | 'tesseract' | 'future_ocr'

export type DataAssistOcrStatus = 'not_started' | 'queued' | 'processed' | 'failed' | 'disabled'

export type DataAssistScorecardDraftFields = {
  externalMatchId: string
  homeTeam: string
  awayTeam: string
  matchDate: string
  lineCount: number
  parserWarnings: string[]
}

export type DataAssistOcrReadiness = {
  provider: DataAssistOcrProvider
  status: DataAssistOcrStatus
  canRun: boolean
  reason: string
}

export type DataAssistOcrQueueResult = DataAssistOcrReadiness & {
  queuedAt: string
}

export type DataAssistOcrScreenshotInput = {
  fileName: string
  uploadOrder: number
  imageWidth: number
  imageHeight: number
  confidenceScore: number
  visualSignals: string[]
}

export type DataAssistScorecardParsedLine = {
  lineLabel: string
  homePlayers: string[]
  awayPlayers: string[]
  score: string
  winner: string
  confidenceScore: number
}

export type DataAssistScorecardParsedDraft = DataAssistScorecardDraftFields & {
  lines: DataAssistScorecardParsedLine[]
  rawTextPreview: string
  sourceScreenshotCount: number
  provider: DataAssistOcrProvider
  confidenceScore: number
}

export const DATA_ASSIST_OCR_PROVIDER: DataAssistOcrProvider = 'disabled'
export const DATA_ASSIST_MOCK_OCR_PROVIDER: DataAssistOcrProvider = 'mock_review'
export const DATA_ASSIST_TESSERACT_OCR_PROVIDER: DataAssistOcrProvider = 'tesseract'

export function getDataAssistOcrReadiness(env: Record<string, string | undefined> = getClientSafeEnv()): DataAssistOcrReadiness {
  const provider = normalizeDataAssistOcrProvider(env.NEXT_PUBLIC_DATA_ASSIST_OCR_PROVIDER)
  if (provider === DATA_ASSIST_TESSERACT_OCR_PROVIDER) {
    return {
      provider,
      status: 'queued',
      canRun: true,
      reason: 'Free Tesseract OCR is enabled for admin-triggered review drafts. Imports still require admin verification.',
    }
  }

  return {
    provider: DATA_ASSIST_OCR_PROVIDER,
    status: 'disabled',
    canRun: false,
    reason: 'OCR is intentionally disabled until a free provider is enabled for admin review.',
  }
}

export function getServerDataAssistOcrReadiness(env: Record<string, string | undefined> = process.env): DataAssistOcrReadiness {
  const provider = normalizeDataAssistOcrProvider(env.DATA_ASSIST_OCR_PROVIDER || env.NEXT_PUBLIC_DATA_ASSIST_OCR_PROVIDER)
  if (provider === DATA_ASSIST_TESSERACT_OCR_PROVIDER) {
    return {
      provider,
      status: 'queued',
      canRun: true,
      reason: 'Free Tesseract OCR is enabled for review-only scorecard drafts.',
    }
  }

  return {
    provider: DATA_ASSIST_OCR_PROVIDER,
    status: 'disabled',
    canRun: false,
    reason: 'Set DATA_ASSIST_OCR_PROVIDER=tesseract to enable free server-side OCR.',
  }
}

export function buildEmptyScorecardDraftFields(): DataAssistScorecardDraftFields {
  return {
    externalMatchId: '',
    homeTeam: '',
    awayTeam: '',
    matchDate: '',
    lineCount: 0,
    parserWarnings: ['OCR not run. Draft requires admin review before any import path is enabled.'],
  }
}

export function queueScorecardOcrDraft(): DataAssistOcrQueueResult {
  return {
    ...getDataAssistOcrReadiness(),
    queuedAt: new Date().toISOString(),
  }
}

export function buildMockScorecardOcrDraft(screenshots: DataAssistOcrScreenshotInput[]): DataAssistScorecardParsedDraft {
  const orderedScreenshots = [...screenshots].sort((a, b) => a.uploadOrder - b.uploadOrder)
  const parserWarnings = [
    'Mock OCR boundary only. No text extraction has run yet.',
    'Admin verification is required before any scorecard import path can be enabled.',
    orderedScreenshots.length
      ? `Queued ${orderedScreenshots.length} stored screenshot${orderedScreenshots.length === 1 ? '' : 's'} for future OCR.`
      : 'No stored screenshots were available for OCR.',
  ]

  return {
    ...buildEmptyScorecardDraftFields(),
    parserWarnings,
    lines: [],
    rawTextPreview: orderedScreenshots
      .map((screenshot) => `#${screenshot.uploadOrder} ${screenshot.fileName}`)
      .join('\n'),
    sourceScreenshotCount: orderedScreenshots.length,
    provider: DATA_ASSIST_MOCK_OCR_PROVIDER,
    confidenceScore: 0,
  }
}

export function buildScorecardOcrDraftFromText(
  rawText: string,
  screenshots: DataAssistOcrScreenshotInput[],
  provider: DataAssistOcrProvider = DATA_ASSIST_MOCK_OCR_PROVIDER,
): DataAssistScorecardParsedDraft {
  const parsedDraft = parseDataAssistScorecardText(rawText)
  const orderedScreenshots = [...screenshots].sort((a, b) => a.uploadOrder - b.uploadOrder)

  return {
    ...parsedDraft,
    parserWarnings: [
      'Review-only OCR draft. Admin verification is required before import.',
      ...parsedDraft.parserWarnings,
    ],
    sourceScreenshotCount: orderedScreenshots.length,
    provider,
  }
}

function normalizeDataAssistOcrProvider(value: string | undefined): DataAssistOcrProvider {
  const normalized = value?.trim().toLowerCase()
  return normalized === DATA_ASSIST_TESSERACT_OCR_PROVIDER ? DATA_ASSIST_TESSERACT_OCR_PROVIDER : DATA_ASSIST_OCR_PROVIDER
}

function getClientSafeEnv(): Record<string, string | undefined> {
  return typeof process === 'undefined' ? {} : process.env
}

export function getScorecardDraftReadiness(fields: DataAssistScorecardDraftFields) {
  const warnings: string[] = []
  if (!fields.externalMatchId.trim()) warnings.push('Missing TennisLink match id.')
  if (!fields.homeTeam.trim() || !fields.awayTeam.trim()) warnings.push('Missing team names.')
  if (!fields.matchDate.trim()) warnings.push('Missing match date.')
  if (fields.lineCount <= 0) warnings.push('No scorecard lines parsed yet.')

  return {
    ready: warnings.length === 0,
    warnings,
  }
}
