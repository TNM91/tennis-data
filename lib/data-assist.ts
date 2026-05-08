'use client'

import { getClientAuthState } from './auth'
import { supabase } from './supabase'

export type DataAssistImportType = 'scorecard' | 'schedule' | 'team_summary'
export type DataAssistLayout =
  | 'pending'
  | 'tennislink_scorecard'
  | 'tennislink_schedule'
  | 'tennislink_team_summary'
  | 'unsupported'
export type DataAssistScreenshotStatus = 'pending' | 'supported' | 'needs_review' | 'rejected'
export type DataAssistBatchStatus = 'uploaded' | 'layout_detected' | 'needs_review' | 'ready_to_import' | 'rejected'

export type DataAssistPreparedScreenshot = {
  id: string
  file: File
  previewUrl: string
  uploadOrder: number
  fileName: string
  mimeType: string
  fileSizeBytes: number
  imageWidth: number
  imageHeight: number
  clientFingerprint: string
  detectionStatus: DataAssistScreenshotStatus
  detectedLayout: DataAssistLayout
  confidenceScore: number
  visualSignals: string[]
  rejectionReason: string
}

export type DataAssistBatchSummary = {
  requestedImportType: DataAssistImportType
  detectedLayout: DataAssistLayout
  status: DataAssistBatchStatus
  confidenceScore: number
  rejectionReason: string
  contributionValue: string
  screenshots: DataAssistPreparedScreenshot[]
}

export type DataAssistSaveResult = {
  batchId: string
  draftId: string
}

const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024
const MAX_BATCH_SIZE = 8
const ALLOWED_SCREENSHOT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const IMPORT_TYPE_LAYOUT: Record<DataAssistImportType, DataAssistLayout> = {
  scorecard: 'tennislink_scorecard',
  schedule: 'tennislink_schedule',
  team_summary: 'tennislink_team_summary',
}

const IMPORT_TYPE_LABEL: Record<DataAssistImportType, string> = {
  scorecard: 'TennisLink scorecard',
  schedule: 'TennisLink schedule',
  team_summary: 'TennisLink team summary',
}

const FILE_HINTS: Record<DataAssistImportType, string[]> = {
  scorecard: ['scorecard', 'score-card', 'scores', 'match-card', 'matchcard'],
  schedule: ['schedule', 'sched', 'match-list', 'matchlist'],
  team_summary: ['team-summary', 'teamsummary', 'team_summary', 'roster', 'lineup', 'players'],
}

export function getDataAssistImportTypeLabel(importType: DataAssistImportType) {
  return IMPORT_TYPE_LABEL[importType]
}

export function getDataAssistContributionValue(importType: DataAssistImportType) {
  if (importType === 'schedule') {
    return 'Schedule uploads help captains and players see who plays next, where, and when.'
  }
  if (importType === 'team_summary') {
    return 'Team summaries improve roster identity, matchup context, and captain scouting.'
  }
  return 'Scorecards refresh player trends, matchup reads, team intelligence, and local tennis history.'
}

export function validateDataAssistFiles(files: File[]) {
  if (!files.length) return 'Choose at least one TennisLink screenshot.'
  if (files.length > MAX_BATCH_SIZE) return `Upload ${MAX_BATCH_SIZE} screenshots or fewer in one batch.`

  const unsupported = files.find((file) => !ALLOWED_SCREENSHOT_TYPES.has(file.type))
  if (unsupported) return 'Data Assist only accepts TennisLink screenshots as JPG, PNG, or WebP images.'

  const tooLarge = files.find((file) => file.size > MAX_SCREENSHOT_BYTES)
  if (tooLarge) return 'Each TennisLink screenshot needs to be 10 MB or smaller.'

  return ''
}

export async function prepareDataAssistBatch(
  files: File[],
  requestedImportType: DataAssistImportType,
): Promise<DataAssistBatchSummary> {
  const validation = validateDataAssistFiles(files)
  if (validation) {
    return {
      requestedImportType,
      detectedLayout: 'unsupported',
      status: 'rejected',
      confidenceScore: 0,
      rejectionReason: validation,
      contributionValue: getDataAssistContributionValue(requestedImportType),
      screenshots: [],
    }
  }

  const screenshots = await Promise.all(
    files.map(async (file, index) => prepareDataAssistScreenshot(file, index + 1, requestedImportType)),
  )
  return summarizeDataAssistBatch(requestedImportType, screenshots)
}

export function summarizeDataAssistBatch(
  requestedImportType: DataAssistImportType,
  screenshots: DataAssistPreparedScreenshot[],
): DataAssistBatchSummary {
  if (!screenshots.length) {
    return {
      requestedImportType,
      detectedLayout: 'unsupported',
      status: 'rejected',
      confidenceScore: 0,
      rejectionReason: 'Choose at least one TennisLink screenshot.',
      contributionValue: getDataAssistContributionValue(requestedImportType),
      screenshots,
    }
  }

  const rejected = screenshots.filter((screenshot) => screenshot.detectionStatus === 'rejected')
  const averageConfidence = screenshots.reduce((sum, screenshot) => sum + screenshot.confidenceScore, 0) / screenshots.length
  const hasStrongLayoutSignal = screenshots.some((screenshot) => screenshot.detectionStatus === 'supported')
  const status: DataAssistBatchStatus = rejected.length === screenshots.length
    ? 'rejected'
    : hasStrongLayoutSignal
      ? 'layout_detected'
      : 'needs_review'

  return {
    requestedImportType,
    detectedLayout: status === 'rejected' ? 'unsupported' : IMPORT_TYPE_LAYOUT[requestedImportType],
    status,
    confidenceScore: roundConfidence(averageConfidence),
    rejectionReason: status === 'rejected'
      ? rejected[0]?.rejectionReason || 'These screenshots do not look like a supported TennisLink page yet.'
      : '',
    contributionValue: getDataAssistContributionValue(requestedImportType),
    screenshots,
  }
}

export function reorderDataAssistScreenshots(
  screenshots: DataAssistPreparedScreenshot[],
  fromIndex: number,
  toIndex: number,
) {
  const nextScreenshots = [...screenshots]
  const [item] = nextScreenshots.splice(fromIndex, 1)
  if (!item) return screenshots
  nextScreenshots.splice(toIndex, 0, item)
  return nextScreenshots.map((screenshot, index) => ({ ...screenshot, uploadOrder: index + 1 }))
}

export async function saveDataAssistDraftBatch(summary: DataAssistBatchSummary): Promise<DataAssistSaveResult> {
  const authState = await getClientAuthState()
  const userId = authState.user?.id?.trim()
  if (!userId) throw new Error('Sign in to save a Data Assist draft.')
  if (summary.status === 'rejected') throw new Error(summary.rejectionReason || 'This batch is not supported.')

  const { data: batch, error: batchError } = await supabase
    .from('data_assist_batches')
    .insert({
      submitted_by_user_id: userId,
      source_system: 'tennislink',
      requested_import_type: summary.requestedImportType,
      detected_layout: summary.detectedLayout,
      status: summary.status,
      screenshot_count: summary.screenshots.length,
      confidence_score: summary.confidenceScore,
      rejection_reason: summary.rejectionReason,
      contribution_value: summary.contributionValue,
    })
    .select('id')
    .single()

  if (batchError) throw new Error(batchError.message)
  const batchId = (batch as { id?: string | null } | null)?.id
  if (!batchId) throw new Error('Data Assist batch could not be created.')

  const screenshotPayload = summary.screenshots.map((screenshot) => ({
    batch_id: batchId,
    submitted_by_user_id: userId,
    upload_order: screenshot.uploadOrder,
    file_name: screenshot.fileName,
    mime_type: screenshot.mimeType,
    file_size_bytes: screenshot.fileSizeBytes,
    image_width: screenshot.imageWidth || null,
    image_height: screenshot.imageHeight || null,
    client_fingerprint: screenshot.clientFingerprint,
    detection_status: screenshot.detectionStatus,
    detected_layout: screenshot.detectedLayout,
    confidence_score: screenshot.confidenceScore,
    visual_signals: screenshot.visualSignals,
    rejection_reason: screenshot.rejectionReason,
  }))
  const screenshotResult = await supabase.from('data_assist_screenshots').insert(screenshotPayload)
  if (screenshotResult.error) throw new Error(screenshotResult.error.message)

  const { data: draft, error: draftError } = await supabase
    .from('data_assist_drafts')
    .insert({
      batch_id: batchId,
      submitted_by_user_id: userId,
      draft_type: summary.requestedImportType,
      status: summary.status === 'layout_detected' ? 'needs_review' : 'blocked',
      confidence_score: summary.confidenceScore,
      validation_summary: {
        message:
          summary.status === 'layout_detected'
            ? 'Supported TennisLink layout signals found. OCR parsing and verification come next.'
            : 'Saved for review, but this batch needs stronger TennisLink layout confidence before parsing.',
        screenshotCount: summary.screenshots.length,
        visualSignals: Array.from(new Set(summary.screenshots.flatMap((screenshot) => screenshot.visualSignals))),
      },
      parsed_payload: {},
      impact_summary: {
        value: summary.contributionValue,
        improves: impactAreasForImportType(summary.requestedImportType),
      },
    })
    .select('id')
    .single()

  if (draftError) throw new Error(draftError.message)
  const draftId = (draft as { id?: string | null } | null)?.id
  if (!draftId) throw new Error('Data Assist draft could not be created.')

  return { batchId, draftId }
}

async function prepareDataAssistScreenshot(
  file: File,
  uploadOrder: number,
  requestedImportType: DataAssistImportType,
): Promise<DataAssistPreparedScreenshot> {
  const previewUrl = URL.createObjectURL(file)
  const dimensions = await readImageDimensions(previewUrl).catch(() => ({ width: 0, height: 0 }))
  const visualSignals = detectVisualSignals(file, dimensions)
  const layoutSignals = detectLayoutSignals(file, requestedImportType)
  const rejectionReason = buildScreenshotRejectionReason(file, dimensions)
  const confidenceScore = rejectionReason ? 0 : calculateConfidence(visualSignals, layoutSignals)
  const detectionStatus: DataAssistScreenshotStatus = rejectionReason
    ? 'rejected'
    : confidenceScore >= 0.72
      ? 'supported'
      : 'needs_review'

  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${uploadOrder}`,
    file,
    previewUrl,
    uploadOrder,
    fileName: file.name,
    mimeType: file.type,
    fileSizeBytes: file.size,
    imageWidth: dimensions.width,
    imageHeight: dimensions.height,
    clientFingerprint: await buildFileFingerprint(file),
    detectionStatus,
    detectedLayout: rejectionReason ? 'unsupported' : IMPORT_TYPE_LAYOUT[requestedImportType],
    confidenceScore,
    visualSignals: [...visualSignals, ...layoutSignals],
    rejectionReason,
  }
}

function detectVisualSignals(file: File, dimensions: { width: number; height: number }) {
  const signals: string[] = []
  const lowerName = file.name.toLowerCase()
  if (lowerName.includes('tennislink') || lowerName.includes('usta')) signals.push('TennisLink or USTA filename hint')
  if (dimensions.width > 0 && dimensions.height > 0) signals.push('Readable screenshot dimensions')
  if (dimensions.height >= dimensions.width * 1.2) signals.push('Mobile screenshot shape')
  if (dimensions.width >= 900 || dimensions.height >= 1200) signals.push('High enough resolution for OCR review')
  if (file.type.startsWith('image/')) signals.push('Image screenshot format')
  return signals
}

function detectLayoutSignals(file: File, requestedImportType: DataAssistImportType) {
  const lowerName = file.name.toLowerCase()
  return FILE_HINTS[requestedImportType]
    .filter((hint) => lowerName.includes(hint))
    .map((hint) => `${getDataAssistImportTypeLabel(requestedImportType)} filename hint: ${hint}`)
}

function buildScreenshotRejectionReason(file: File, dimensions: { width: number; height: number }) {
  if (!ALLOWED_SCREENSHOT_TYPES.has(file.type)) return 'Only JPG, PNG, or WebP TennisLink screenshots are supported.'
  if (file.size > MAX_SCREENSHOT_BYTES) return 'This screenshot is over 10 MB.'
  if (!dimensions.width || !dimensions.height) return 'This image could not be read as a screenshot.'
  if (dimensions.width < 280 || dimensions.height < 280) return 'This image is too small to safely review.'
  return ''
}

function calculateConfidence(visualSignals: string[], layoutSignals: string[]) {
  const base = 0.34
  const visualScore = Math.min(0.3, visualSignals.length * 0.06)
  const layoutScore = Math.min(0.34, layoutSignals.length * 0.17)
  return roundConfidence(base + visualScore + layoutScore)
}

function readImageDimensions(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Image could not be read.'))
    image.src = src
  })
}

async function buildFileFingerprint(file: File) {
  const head = await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', head)
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return `${hash.slice(0, 24)}-${file.size}`
}

function impactAreasForImportType(importType: DataAssistImportType) {
  if (importType === 'schedule') return ['upcoming schedule', 'captain planning', 'player reminders']
  if (importType === 'team_summary') return ['roster identity', 'captain scouting', 'team intelligence']
  return ['matchup insights', 'player trends', 'team results', 'local tennis history']
}

function roundConfidence(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}
