export type DataAssistOcrProvider = 'disabled' | 'manual_review' | 'future_ocr'

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

export const DATA_ASSIST_OCR_PROVIDER: DataAssistOcrProvider = 'disabled'

export function getDataAssistOcrReadiness(): DataAssistOcrReadiness {
  return {
    provider: DATA_ASSIST_OCR_PROVIDER,
    status: 'disabled',
    canRun: false,
    reason: 'OCR is intentionally disabled until TennisLink scorecard layout verification is stable.',
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
