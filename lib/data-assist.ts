'use client'

import { getClientAuthState } from './auth'
import { buildEmptyScorecardDraftFields, getDataAssistOcrReadiness } from './data-assist-ocr'
import { supabase } from './supabase'

export type DataAssistImportType = 'scorecard' | 'schedule' | 'team_summary'
export type DataAssistLayout =
  | 'pending'
  | 'tennislink_scorecard'
  | 'tennislink_schedule'
  | 'tennislink_team_summary'
  | 'unsupported'
export type DataAssistScreenshotStatus = 'pending' | 'supported' | 'needs_review' | 'rejected'
export type DataAssistBatchStatus =
  | 'uploaded'
  | 'layout_detected'
  | 'needs_review'
  | 'ready_to_import'
  | 'rejected'
  | 'verified'
  | 'imported'
export type DataAssistDraftStatus = 'needs_review' | 'blocked' | 'ready_for_verification' | 'verified' | 'imported'

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

export type DataAssistAdminBatch = {
  id: string
  submittedByUserId: string
  requestedImportType: DataAssistImportType
  detectedLayout: DataAssistLayout
  status: DataAssistBatchStatus
  screenshotCount: number
  confidenceScore: number
  rejectionReason: string
  contributionValue: string
  reviewNote: string
  reviewedByUserId: string
  reviewedAt: string
  createdAt: string
  updatedAt: string
}

export type DataAssistAdminScreenshot = {
  id: string
  batchId: string
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
  createdAt: string
}

export type DataAssistAdminDraft = {
  id: string
  batchId: string
  draftType: DataAssistImportType
  status: DataAssistDraftStatus
  confidenceScore: number
  validationSummary: Record<string, unknown>
  impactSummary: Record<string, unknown>
  reviewNote: string
  reviewedByUserId: string
  reviewedAt: string
  ocrStatus: string
  externalMatchId: string
  homeTeam: string
  awayTeam: string
  matchDate: string
  lineCount: number
  parserWarnings: string[]
  createdAt: string
  updatedAt: string
}

type DataAssistBatchRow = {
  id?: string | null
  submitted_by_user_id?: string | null
  requested_import_type?: string | null
  detected_layout?: string | null
  status?: string | null
  screenshot_count?: number | null
  confidence_score?: number | null
  rejection_reason?: string | null
  contribution_value?: string | null
  review_note?: string | null
  reviewed_by_user_id?: string | null
  reviewed_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type DataAssistScreenshotRow = {
  id?: string | null
  batch_id?: string | null
  upload_order?: number | null
  file_name?: string | null
  mime_type?: string | null
  file_size_bytes?: number | null
  image_width?: number | null
  image_height?: number | null
  client_fingerprint?: string | null
  detection_status?: string | null
  detected_layout?: string | null
  confidence_score?: number | null
  visual_signals?: unknown
  rejection_reason?: string | null
  created_at?: string | null
}

type DataAssistDraftRow = {
  id?: string | null
  batch_id?: string | null
  draft_type?: string | null
  status?: string | null
  confidence_score?: number | null
  validation_summary?: Record<string, unknown> | null
  impact_summary?: Record<string, unknown> | null
  review_note?: string | null
  reviewed_by_user_id?: string | null
  reviewed_at?: string | null
  ocr_status?: string | null
  external_match_id?: string | null
  home_team?: string | null
  away_team?: string | null
  match_date?: string | null
  line_count?: number | null
  parser_warnings?: unknown
  created_at?: string | null
  updated_at?: string | null
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

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function normalizeImportType(value: string | null | undefined): DataAssistImportType {
  if (value === 'schedule' || value === 'team_summary') return value
  return 'scorecard'
}

function normalizeLayout(value: string | null | undefined): DataAssistLayout {
  if (value === 'tennislink_scorecard' || value === 'tennislink_schedule' || value === 'tennislink_team_summary' || value === 'unsupported') return value
  return 'pending'
}

function normalizeBatchStatus(value: string | null | undefined): DataAssistBatchStatus {
  if (
    value === 'layout_detected' ||
    value === 'needs_review' ||
    value === 'ready_to_import' ||
    value === 'rejected' ||
    value === 'verified' ||
    value === 'imported'
  ) return value
  return 'uploaded'
}

function normalizeDraftStatus(value: string | null | undefined): DataAssistDraftStatus {
  if (value === 'blocked' || value === 'ready_for_verification' || value === 'verified' || value === 'imported') return value
  return 'needs_review'
}

function normalizeScreenshotStatus(value: string | null | undefined): DataAssistScreenshotStatus {
  if (value === 'supported' || value === 'needs_review' || value === 'rejected') return value
  return 'pending'
}

function normalizeSignals(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    : []
}

function toAdminBatch(row: DataAssistBatchRow): DataAssistAdminBatch | null {
  const id = cleanText(row.id)
  if (!id) return null

  return {
    id,
    submittedByUserId: cleanText(row.submitted_by_user_id),
    requestedImportType: normalizeImportType(row.requested_import_type),
    detectedLayout: normalizeLayout(row.detected_layout),
    status: normalizeBatchStatus(row.status),
    screenshotCount: row.screenshot_count ?? 0,
    confidenceScore: row.confidence_score ?? 0,
    rejectionReason: cleanText(row.rejection_reason),
    contributionValue: cleanText(row.contribution_value),
    reviewNote: cleanText(row.review_note),
    reviewedByUserId: cleanText(row.reviewed_by_user_id),
    reviewedAt: cleanText(row.reviewed_at),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  }
}

function toAdminScreenshot(row: DataAssistScreenshotRow): DataAssistAdminScreenshot | null {
  const id = cleanText(row.id)
  const batchId = cleanText(row.batch_id)
  if (!id || !batchId) return null

  return {
    id,
    batchId,
    uploadOrder: row.upload_order ?? 0,
    fileName: cleanText(row.file_name),
    mimeType: cleanText(row.mime_type),
    fileSizeBytes: row.file_size_bytes ?? 0,
    imageWidth: row.image_width ?? 0,
    imageHeight: row.image_height ?? 0,
    clientFingerprint: cleanText(row.client_fingerprint),
    detectionStatus: normalizeScreenshotStatus(row.detection_status),
    detectedLayout: normalizeLayout(row.detected_layout),
    confidenceScore: row.confidence_score ?? 0,
    visualSignals: normalizeSignals(row.visual_signals),
    rejectionReason: cleanText(row.rejection_reason),
    createdAt: cleanText(row.created_at),
  }
}

function toAdminDraft(row: DataAssistDraftRow): DataAssistAdminDraft | null {
  const id = cleanText(row.id)
  const batchId = cleanText(row.batch_id)
  if (!id || !batchId) return null

  return {
    id,
    batchId,
    draftType: normalizeImportType(row.draft_type),
    status: normalizeDraftStatus(row.status),
    confidenceScore: row.confidence_score ?? 0,
    validationSummary: row.validation_summary || {},
    impactSummary: row.impact_summary || {},
    reviewNote: cleanText(row.review_note),
    reviewedByUserId: cleanText(row.reviewed_by_user_id),
    reviewedAt: cleanText(row.reviewed_at),
    ocrStatus: cleanText(row.ocr_status) || 'not_started',
    externalMatchId: cleanText(row.external_match_id),
    homeTeam: cleanText(row.home_team),
    awayTeam: cleanText(row.away_team),
    matchDate: cleanText(row.match_date),
    lineCount: row.line_count ?? 0,
    parserWarnings: normalizeSignals(row.parser_warnings),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  }
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

  const emptyScorecardFields = summary.requestedImportType === 'scorecard'
    ? buildEmptyScorecardDraftFields()
    : null
  const ocrReadiness = getDataAssistOcrReadiness()
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
      ocr_status: ocrReadiness.status,
      external_match_id: emptyScorecardFields?.externalMatchId || '',
      home_team: emptyScorecardFields?.homeTeam || '',
      away_team: emptyScorecardFields?.awayTeam || '',
      match_date: emptyScorecardFields?.matchDate || '',
      line_count: emptyScorecardFields?.lineCount || 0,
      parser_warnings: emptyScorecardFields?.parserWarnings || [],
    })
    .select('id')
    .single()

  if (draftError) throw new Error(draftError.message)
  const draftId = (draft as { id?: string | null } | null)?.id
  if (!draftId) throw new Error('Data Assist draft could not be created.')

  return { batchId, draftId }
}

export async function listDataAssistAdminBatches() {
  const { data, error } = await supabase
    .from('data_assist_batches')
    .select('id, submitted_by_user_id, requested_import_type, detected_layout, status, screenshot_count, confidence_score, rejection_reason, contribution_value, review_note, reviewed_by_user_id, reviewed_at, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(80)

  if (error) throw new Error(error.message)
  return ((data || []) as DataAssistBatchRow[])
    .map(toAdminBatch)
    .filter((batch): batch is DataAssistAdminBatch => Boolean(batch))
}

export async function loadDataAssistAdminBatchDetail(batchId: string) {
  const normalizedBatchId = cleanText(batchId)
  if (!normalizedBatchId) return { screenshots: [], drafts: [] }

  const [screenshotsResult, draftsResult] = await Promise.all([
    supabase
      .from('data_assist_screenshots')
      .select('id, batch_id, upload_order, file_name, mime_type, file_size_bytes, image_width, image_height, client_fingerprint, detection_status, detected_layout, confidence_score, visual_signals, rejection_reason, created_at')
      .eq('batch_id', normalizedBatchId)
      .order('upload_order', { ascending: true }),
    supabase
      .from('data_assist_drafts')
      .select('id, batch_id, draft_type, status, confidence_score, validation_summary, impact_summary, review_note, reviewed_by_user_id, reviewed_at, ocr_status, external_match_id, home_team, away_team, match_date, line_count, parser_warnings, created_at, updated_at')
      .eq('batch_id', normalizedBatchId)
      .order('created_at', { ascending: true }),
  ])

  if (screenshotsResult.error) throw new Error(screenshotsResult.error.message)
  if (draftsResult.error) throw new Error(draftsResult.error.message)

  return {
    screenshots: ((screenshotsResult.data || []) as DataAssistScreenshotRow[])
      .map(toAdminScreenshot)
      .filter((screenshot): screenshot is DataAssistAdminScreenshot => Boolean(screenshot)),
    drafts: ((draftsResult.data || []) as DataAssistDraftRow[])
      .map(toAdminDraft)
      .filter((draft): draft is DataAssistAdminDraft => Boolean(draft)),
  }
}

export async function reviewDataAssistBatch(input: {
  batchId: string
  draftId?: string
  status: Extract<DataAssistBatchStatus, 'needs_review' | 'ready_to_import' | 'rejected'>
  reviewNote: string
}) {
  const authState = await getClientAuthState()
  const userId = authState.user?.id?.trim()
  if (!userId) throw new Error('Sign in as an admin to review Data Assist batches.')

  const reviewedAt = new Date().toISOString()
  const batchUpdate = await supabase
    .from('data_assist_batches')
    .update({
      status: input.status,
      review_note: input.reviewNote.trim(),
      reviewed_by_user_id: userId,
      reviewed_at: reviewedAt,
    })
    .eq('id', input.batchId)

  if (batchUpdate.error) throw new Error(batchUpdate.error.message)

  if (input.draftId) {
    const draftStatus: DataAssistDraftStatus =
      input.status === 'ready_to_import'
        ? 'ready_for_verification'
        : input.status === 'rejected'
          ? 'blocked'
          : 'needs_review'
    const draftUpdate = await supabase
      .from('data_assist_drafts')
      .update({
        status: draftStatus,
        ocr_status: input.status === 'needs_review' ? 'not_started' : 'disabled',
        review_note: input.reviewNote.trim(),
        reviewed_by_user_id: userId,
        reviewed_at: reviewedAt,
      })
      .eq('id', input.draftId)

    if (draftUpdate.error) throw new Error(draftUpdate.error.message)
  }
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
