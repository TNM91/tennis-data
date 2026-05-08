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
  ocrQuality?: DataAssistOcrQualitySummary
}

export type DataAssistAutoAssessmentDecision = 'auto_ready' | 'member_confirm' | 'admin_exception' | 'blocked'

export type DataAssistAutoAssessment = {
  decision: DataAssistAutoAssessmentDecision
  label: string
  detail: string
  reasons: string[]
  importLocked: boolean
  adminReviewRequired: boolean
  memberConfirmationRequired: boolean
}

export type DataAssistOcrQualitySummary = {
  provider: DataAssistOcrProvider
  textLength: number
  nonEmptyLineCount: number
  duplicateLineCount?: number
  parserWarningCount: number
  parsedLineCount: number
  ocrConfidenceScore: number
  parserConfidenceScore: number
  reviewPriority: 'ready_for_review' | 'needs_manual_review' | 'blocked'
  autoAssessment?: DataAssistAutoAssessment
  screenshotSummaries?: DataAssistOcrScreenshotQualitySummary[]
}

export type DataAssistOcrScreenshotQualitySummary = {
  uploadOrder: number
  fileName: string
  confidenceScore: number
  textLength: number
  nonEmptyLineCount: number
  duplicateLineCount: number
}

export const DATA_ASSIST_OCR_PROVIDER: DataAssistOcrProvider = 'disabled'
export const DATA_ASSIST_MOCK_OCR_PROVIDER: DataAssistOcrProvider = 'mock_review'
export const DATA_ASSIST_TESSERACT_OCR_PROVIDER: DataAssistOcrProvider = 'tesseract'
const NEXT_PUBLIC_DATA_ASSIST_OCR_PROVIDER = process.env.NEXT_PUBLIC_DATA_ASSIST_OCR_PROVIDER

export function getDataAssistOcrReadiness(env: Record<string, string | undefined> = getClientSafeEnv()): DataAssistOcrReadiness {
  const provider = normalizeDataAssistOcrProvider(env.NEXT_PUBLIC_DATA_ASSIST_OCR_PROVIDER)
  if (provider === DATA_ASSIST_TESSERACT_OCR_PROVIDER) {
    return {
      provider,
      status: 'queued',
      canRun: true,
      reason: 'Free Tesseract OCR is enabled for trusted TennisLink scorecard drafts.',
    }
  }

  return {
    provider: DATA_ASSIST_OCR_PROVIDER,
    status: 'disabled',
    canRun: false,
    reason: 'OCR is intentionally disabled until a free provider is enabled.',
  }
}

export function getServerDataAssistOcrReadiness(env: Record<string, string | undefined> = process.env): DataAssistOcrReadiness {
  const provider = normalizeDataAssistOcrProvider(env.DATA_ASSIST_OCR_PROVIDER || env.NEXT_PUBLIC_DATA_ASSIST_OCR_PROVIDER)
  if (provider === DATA_ASSIST_TESSERACT_OCR_PROVIDER) {
    return {
      provider,
      status: 'queued',
      canRun: true,
      reason: 'Free Tesseract OCR is enabled for trusted scorecard drafts.',
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
    parserWarnings: ['OCR not run. Draft requires trusted verification before any import path is enabled.'],
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
    'Trusted verification is required before any scorecard import path can be enabled.',
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
      'OCR draft. Trusted verification is required before import.',
      ...parsedDraft.parserWarnings,
    ],
    sourceScreenshotCount: orderedScreenshots.length,
    provider,
    ocrQuality: buildDataAssistOcrQualitySummary({
      provider,
      rawText: parsedDraft.rawTextPreview,
      parserWarnings: parsedDraft.parserWarnings,
      parsedLineCount: parsedDraft.lineCount,
      ocrConfidenceScore: parsedDraft.confidenceScore,
      parserConfidenceScore: parsedDraft.confidenceScore,
    }),
  }
}

export function buildDataAssistOcrQualitySummary(input: {
  provider: DataAssistOcrProvider
  rawText: string
  parserWarnings: string[]
  parsedLineCount: number
  ocrConfidenceScore: number
  parserConfidenceScore: number
  duplicateLineCount?: number
  screenshotSummaries?: DataAssistOcrScreenshotQualitySummary[]
}): DataAssistOcrQualitySummary {
  const textLength = input.rawText.trim().length
  const nonEmptyLineCount = input.rawText.split('\n').filter((line) => line.trim()).length
  const reviewPriority: DataAssistOcrQualitySummary['reviewPriority'] =
    !textLength || !input.parsedLineCount
      ? 'blocked'
      : input.parserWarnings.length || input.parserConfidenceScore < 0.8 || input.ocrConfidenceScore < 0.65
        ? 'needs_manual_review'
        : 'ready_for_review'

  return {
    provider: input.provider,
    textLength,
    nonEmptyLineCount,
    duplicateLineCount: input.duplicateLineCount ?? 0,
    parserWarningCount: input.parserWarnings.length,
    parsedLineCount: input.parsedLineCount,
    ocrConfidenceScore: roundConfidence(input.ocrConfidenceScore),
    parserConfidenceScore: roundConfidence(input.parserConfidenceScore),
    reviewPriority,
    screenshotSummaries: input.screenshotSummaries,
  }
}

export function assessDataAssistScorecardDraft(draft: DataAssistScorecardParsedDraft): DataAssistAutoAssessment {
  const quality = draft.ocrQuality
  const readiness = getScorecardDraftReadiness(draft)
  const actionableWarnings = draft.parserWarnings.filter(isActionableParserWarning)
  const reasons = uniqueText([
    ...readiness.warnings,
    ...actionableWarnings,
  ])

  if (!quality || quality.reviewPriority === 'blocked' || !draft.rawTextPreview.trim() || draft.lineCount <= 0) {
    return {
      decision: 'blocked',
      label: 'Could not read this scorecard',
      detail: 'Upload a clearer TennisLink scorecard crop or the full scorecard area. Nothing was imported.',
      reasons: reasons.length ? reasons : ['No scorecard lines could be parsed from the OCR text.'],
      importLocked: true,
      adminReviewRequired: false,
      memberConfirmationRequired: false,
    }
  }

  const missingIdentity = readiness.warnings.some((warning) => {
    const lower = warning.toLowerCase()
    return lower.includes('match id') || lower.includes('team names') || lower.includes('match date')
  })

  if (missingIdentity || quality.ocrConfidenceScore < 0.55 || quality.parserConfidenceScore < 0.55) {
    return {
      decision: 'admin_exception',
      label: 'Needs exception review',
      detail: 'TenAceIQ read part of the scorecard, but key identity or confidence checks need an admin look.',
      reasons: reasons.length ? reasons : ['OCR confidence was below the safe auto-assessment threshold.'],
      importLocked: true,
      adminReviewRequired: true,
      memberConfirmationRequired: false,
    }
  }

  if (reasons.length || quality.ocrConfidenceScore < 0.76 || quality.parserConfidenceScore < 0.8 || draft.lineCount < 3) {
    return {
      decision: 'member_confirm',
      label: 'Check the read',
      detail: 'TenAceIQ found a usable scorecard draft. The uploader should confirm the teams, date, and lines before import.',
      reasons: reasons.length ? reasons : ['OCR confidence is good, but not high enough to skip member confirmation.'],
      importLocked: true,
      adminReviewRequired: false,
      memberConfirmationRequired: true,
    }
  }

  return {
    decision: 'auto_ready',
    label: 'Ready after auto-check',
    detail: 'Strong TennisLink signals and scorecard fields were found. This can move forward without exception review once import commit is wired.',
    reasons: ['Trusted TennisLink scorecard fields and lines were parsed with strong confidence.'],
    importLocked: true,
    adminReviewRequired: false,
    memberConfirmationRequired: false,
  }
}

function normalizeDataAssistOcrProvider(value: string | undefined): DataAssistOcrProvider {
  const normalized = value?.trim().toLowerCase()
  return normalized === DATA_ASSIST_TESSERACT_OCR_PROVIDER ? DATA_ASSIST_TESSERACT_OCR_PROVIDER : DATA_ASSIST_OCR_PROVIDER
}

function getClientSafeEnv(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_DATA_ASSIST_OCR_PROVIDER,
  }
}

function roundConfidence(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}

function isActionableParserWarning(value: string) {
  const warning = value.trim().toLowerCase()
  if (!warning) return false
  return ![
    'review-only',
    'admin verification',
    'trusted verification',
    'import path',
  ].some((guardrail) => warning.includes(guardrail))
}

function uniqueText(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
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
