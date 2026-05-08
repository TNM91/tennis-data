'use client'

import { getClientAuthState } from './auth'
import {
  buildEmptyScorecardDraftFields,
  buildMockScorecardOcrDraft,
  buildScorecardOcrDraftFromText,
  getDataAssistOcrReadiness,
  type DataAssistScorecardParsedDraft,
} from './data-assist-ocr'
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
  screenshotCount: number
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
  storageBucket: string
  storagePath: string
  storageUploadedAt: string
  signedImageUrl: string
  createdAt: string
}

export type DataAssistAdminDraft = {
  id: string
  batchId: string
  draftType: DataAssistImportType
  status: DataAssistDraftStatus
  confidenceScore: number
  validationSummary: Record<string, unknown>
  parsedPayload: DataAssistScorecardParsedDraft | Record<string, unknown>
  impactSummary: Record<string, unknown>
  reviewNote: string
  reviewedByUserId: string
  reviewedAt: string
  ocrStatus: string
  ocrJobId: string
  ocrProvider: string
  ocrProcessedAt: string
  externalMatchId: string
  homeTeam: string
  awayTeam: string
  matchDate: string
  lineCount: number
  parserWarnings: string[]
  createdAt: string
  updatedAt: string
}

export type DataAssistOcrJob = {
  id: string
  batchId: string
  draftId: string
  requestedByUserId: string
  provider: string
  status: 'queued' | 'blocked' | 'completed' | 'failed'
  screenshotCount: number
  confidenceScore: number
  warnings: string[]
  resultPayload: DataAssistScorecardParsedDraft | Record<string, unknown>
  errorMessage: string
  createdAt: string
  processedAt: string
}

export type DataAssistSubmission = {
  id: string
  requestedImportType: DataAssistImportType
  detectedLayout: DataAssistLayout
  status: DataAssistBatchStatus
  screenshotCount: number
  confidenceScore: number
  rejectionReason: string
  contributionValue: string
  reviewNote: string
  reviewedAt: string
  draftStatus: DataAssistDraftStatus
  draftOcrStatus: string
  draftReviewNote: string
  createdAt: string
  updatedAt: string
}

export type DataAssistContributorBadge = {
  id: string
  label: string
  detail: string
}

export type DataAssistContributorStats = {
  profileId: string
  verifiedImportCount: number
  rejectedImportCount: number
  pendingReviewCount: number
  contributionAccuracyScore: number
  captainVerifiedImports: number
  adminVerifiedImports: number
  badges: DataAssistContributorBadge[]
  lastVerifiedAt: string
  lastRejectedAt: string
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

type DataAssistContributorStatsRow = {
  profile_id?: string | null
  verified_import_count?: number | null
  rejected_import_count?: number | null
  pending_review_count?: number | null
  contribution_accuracy_score?: number | null
  captain_verified_imports?: number | null
  admin_verified_imports?: number | null
  badges?: unknown
  last_verified_at?: string | null
  last_rejected_at?: string | null
  updated_at?: string | null
}

type DataAssistStatsBatchRow = {
  id?: string | null
  status?: string | null
  reviewed_at?: string | null
}

type DataAssistSubmissionDraftRow = {
  batch_id?: string | null
  status?: string | null
  ocr_status?: string | null
  review_note?: string | null
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
  storage_bucket?: string | null
  storage_path?: string | null
  storage_uploaded_at?: string | null
  created_at?: string | null
}

type DataAssistDraftRow = {
  id?: string | null
  batch_id?: string | null
  draft_type?: string | null
  status?: string | null
  confidence_score?: number | null
  validation_summary?: Record<string, unknown> | null
  parsed_payload?: Record<string, unknown> | null
  impact_summary?: Record<string, unknown> | null
  review_note?: string | null
  reviewed_by_user_id?: string | null
  reviewed_at?: string | null
  ocr_status?: string | null
  ocr_job_id?: string | null
  ocr_provider?: string | null
  ocr_processed_at?: string | null
  external_match_id?: string | null
  home_team?: string | null
  away_team?: string | null
  match_date?: string | null
  line_count?: number | null
  parser_warnings?: unknown
  created_at?: string | null
  updated_at?: string | null
}

type DataAssistOcrJobRow = {
  id?: string | null
  batch_id?: string | null
  draft_id?: string | null
  requested_by_user_id?: string | null
  provider?: string | null
  status?: string | null
  screenshot_count?: number | null
  confidence_score?: number | null
  warnings?: unknown
  result_payload?: Record<string, unknown> | null
  error_message?: string | null
  created_at?: string | null
  processed_at?: string | null
}

const DATA_ASSIST_SCREENSHOT_BUCKET = 'data-assist-screenshots'
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

function normalizeBadges(value: unknown): DataAssistContributorBadge[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const badge = item as Partial<DataAssistContributorBadge>
      const id = cleanText(badge.id)
      const label = cleanText(badge.label)
      if (!id || !label) return null
      return {
        id,
        label,
        detail: cleanText(badge.detail),
      }
    })
    .filter((badge): badge is DataAssistContributorBadge => Boolean(badge))
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
    storageBucket: cleanText(row.storage_bucket) || DATA_ASSIST_SCREENSHOT_BUCKET,
    storagePath: cleanText(row.storage_path),
    storageUploadedAt: cleanText(row.storage_uploaded_at),
    signedImageUrl: '',
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
    parsedPayload: row.parsed_payload || {},
    impactSummary: row.impact_summary || {},
    reviewNote: cleanText(row.review_note),
    reviewedByUserId: cleanText(row.reviewed_by_user_id),
    reviewedAt: cleanText(row.reviewed_at),
    ocrStatus: cleanText(row.ocr_status) || 'not_started',
    ocrJobId: cleanText(row.ocr_job_id),
    ocrProvider: cleanText(row.ocr_provider) || 'disabled',
    ocrProcessedAt: cleanText(row.ocr_processed_at),
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

function normalizeOcrJobStatus(value: string | null | undefined): DataAssistOcrJob['status'] {
  if (value === 'queued' || value === 'blocked' || value === 'failed') return value
  return 'completed'
}

function toOcrJob(row: DataAssistOcrJobRow): DataAssistOcrJob | null {
  const id = cleanText(row.id)
  const batchId = cleanText(row.batch_id)
  const draftId = cleanText(row.draft_id)
  if (!id || !batchId || !draftId) return null

  return {
    id,
    batchId,
    draftId,
    requestedByUserId: cleanText(row.requested_by_user_id),
    provider: cleanText(row.provider) || 'mock_review',
    status: normalizeOcrJobStatus(row.status),
    screenshotCount: row.screenshot_count ?? 0,
    confidenceScore: row.confidence_score ?? 0,
    warnings: normalizeSignals(row.warnings),
    resultPayload: row.result_payload || {},
    errorMessage: cleanText(row.error_message),
    createdAt: cleanText(row.created_at),
    processedAt: cleanText(row.processed_at),
  }
}

function toContributorStats(row: DataAssistContributorStatsRow): DataAssistContributorStats | null {
  const profileId = cleanText(row.profile_id)
  if (!profileId) return null

  return {
    profileId,
    verifiedImportCount: row.verified_import_count ?? 0,
    rejectedImportCount: row.rejected_import_count ?? 0,
    pendingReviewCount: row.pending_review_count ?? 0,
    contributionAccuracyScore: row.contribution_accuracy_score ?? 0,
    captainVerifiedImports: row.captain_verified_imports ?? 0,
    adminVerifiedImports: row.admin_verified_imports ?? 0,
    badges: normalizeBadges(row.badges),
    lastVerifiedAt: cleanText(row.last_verified_at),
    lastRejectedAt: cleanText(row.last_rejected_at),
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

  const uploadedScreenshots = await uploadDataAssistScreenshots(userId, batchId, summary.screenshots)
  const screenshotPayload = uploadedScreenshots.map(({ screenshot, storagePath, storageUploadedAt }) => ({
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
    storage_bucket: DATA_ASSIST_SCREENSHOT_BUCKET,
    storage_path: storagePath,
    storage_uploaded_at: storageUploadedAt,
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

  return { batchId, draftId, screenshotCount: uploadedScreenshots.length }
}

export async function listMyDataAssistSubmissions() {
  const authState = await getClientAuthState()
  const userId = authState.user?.id?.trim()
  if (!userId) return []

  const { data: batchRows, error: batchError } = await supabase
    .from('data_assist_batches')
    .select('id, submitted_by_user_id, requested_import_type, detected_layout, status, screenshot_count, confidence_score, rejection_reason, contribution_value, review_note, reviewed_by_user_id, reviewed_at, created_at, updated_at')
    .eq('submitted_by_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40)

  if (batchError) throw new Error(batchError.message)

  const batches = ((batchRows || []) as DataAssistBatchRow[])
    .map(toAdminBatch)
    .filter((batch): batch is DataAssistAdminBatch => Boolean(batch))

  if (!batches.length) return []

  const batchIds = batches.map((batch) => batch.id)
  const { data: draftRows, error: draftError } = await supabase
    .from('data_assist_drafts')
    .select('batch_id, status, ocr_status, review_note')
    .in('batch_id', batchIds)

  if (draftError) throw new Error(draftError.message)

  const draftsByBatchId = new Map(
    ((draftRows || []) as DataAssistSubmissionDraftRow[])
      .map((draft) => [cleanText(draft.batch_id), draft] as const)
      .filter(([batchId]) => Boolean(batchId)),
  )

  return batches.map((batch): DataAssistSubmission => {
    const draft = draftsByBatchId.get(batch.id)
    return {
      id: batch.id,
      requestedImportType: batch.requestedImportType,
      detectedLayout: batch.detectedLayout,
      status: batch.status,
      screenshotCount: batch.screenshotCount,
      confidenceScore: batch.confidenceScore,
      rejectionReason: batch.rejectionReason,
      contributionValue: batch.contributionValue,
      reviewNote: batch.reviewNote,
      reviewedAt: batch.reviewedAt,
      draftStatus: normalizeDraftStatus(draft?.status),
      draftOcrStatus: cleanText(draft?.ocr_status) || 'not_started',
      draftReviewNote: cleanText(draft?.review_note),
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    }
  })
}

export async function getMyDataAssistContributorStats() {
  const authState = await getClientAuthState()
  const userId = authState.user?.id?.trim()
  if (!userId) return null

  const { data, error } = await supabase
    .from('data_assist_contributor_stats')
    .select('profile_id, verified_import_count, rejected_import_count, pending_review_count, contribution_accuracy_score, captain_verified_imports, admin_verified_imports, badges, last_verified_at, last_rejected_at, updated_at')
    .eq('profile_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return buildEmptyContributorStats(userId)
  return toContributorStats(data as DataAssistContributorStatsRow) || buildEmptyContributorStats(userId)
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
  if (!normalizedBatchId) return { screenshots: [], drafts: [], ocrJobs: [] }

  const [screenshotsResult, draftsResult, ocrJobsResult] = await Promise.all([
    supabase
      .from('data_assist_screenshots')
      .select('id, batch_id, upload_order, file_name, mime_type, file_size_bytes, image_width, image_height, client_fingerprint, detection_status, detected_layout, confidence_score, visual_signals, rejection_reason, storage_bucket, storage_path, storage_uploaded_at, created_at')
      .eq('batch_id', normalizedBatchId)
      .order('upload_order', { ascending: true }),
    supabase
      .from('data_assist_drafts')
      .select('id, batch_id, draft_type, status, confidence_score, validation_summary, parsed_payload, impact_summary, review_note, reviewed_by_user_id, reviewed_at, ocr_status, ocr_job_id, ocr_provider, ocr_processed_at, external_match_id, home_team, away_team, match_date, line_count, parser_warnings, created_at, updated_at')
      .eq('batch_id', normalizedBatchId)
      .order('created_at', { ascending: true }),
    supabase
      .from('data_assist_ocr_jobs')
      .select('id, batch_id, draft_id, requested_by_user_id, provider, status, screenshot_count, confidence_score, warnings, result_payload, error_message, created_at, processed_at')
      .eq('batch_id', normalizedBatchId)
      .order('created_at', { ascending: false }),
  ])

  if (screenshotsResult.error) throw new Error(screenshotsResult.error.message)
  if (draftsResult.error) throw new Error(draftsResult.error.message)
  if (ocrJobsResult.error) throw new Error(ocrJobsResult.error.message)

  const screenshots = ((screenshotsResult.data || []) as DataAssistScreenshotRow[])
    .map(toAdminScreenshot)
    .filter((screenshot): screenshot is DataAssistAdminScreenshot => Boolean(screenshot))

  return {
    screenshots: await addSignedScreenshotUrls(screenshots),
    drafts: ((draftsResult.data || []) as DataAssistDraftRow[])
      .map(toAdminDraft)
      .filter((draft): draft is DataAssistAdminDraft => Boolean(draft)),
    ocrJobs: ((ocrJobsResult.data || []) as DataAssistOcrJobRow[])
      .map(toOcrJob)
      .filter((job): job is DataAssistOcrJob => Boolean(job)),
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
  const { data: existingBatch, error: existingBatchError } = await supabase
    .from('data_assist_batches')
    .select('submitted_by_user_id')
    .eq('id', input.batchId)
    .single()

  if (existingBatchError) throw new Error(existingBatchError.message)
  const submittedByUserId = cleanText((existingBatch as { submitted_by_user_id?: string | null } | null)?.submitted_by_user_id)

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

  if (submittedByUserId) {
    await refreshDataAssistContributorStats(submittedByUserId)
  }
}

export async function queueDataAssistOcrVerification(input: {
  batchId: string
  draftId: string
  rawOcrText?: string
}) {
  if (!input.rawOcrText && getDataAssistOcrReadiness().provider === 'tesseract') {
    return queueDataAssistFreeOcrVerification(input)
  }

  const authState = await getClientAuthState()
  const userId = authState.user?.id?.trim()
  if (!userId) throw new Error('Sign in as an admin to queue OCR verification.')

  const [batchResult, screenshotsResult] = await Promise.all([
    supabase
      .from('data_assist_batches')
      .select('requested_import_type, status')
      .eq('id', input.batchId)
      .single(),
    supabase
      .from('data_assist_screenshots')
      .select('upload_order, file_name, image_width, image_height, confidence_score, visual_signals')
      .eq('batch_id', input.batchId)
      .order('upload_order', { ascending: true }),
  ])

  if (batchResult.error) throw new Error(batchResult.error.message)
  if (screenshotsResult.error) throw new Error(screenshotsResult.error.message)

  const batch = batchResult.data as { requested_import_type?: string | null; status?: string | null } | null
  if (batch?.requested_import_type !== 'scorecard') {
    throw new Error('OCR verification is currently scoped to TennisLink scorecard batches.')
  }

  const screenshots = ((screenshotsResult.data || []) as Array<{
    upload_order?: number | null
    file_name?: string | null
    image_width?: number | null
    image_height?: number | null
    confidence_score?: number | null
    visual_signals?: unknown
  }>).map((screenshot) => ({
    uploadOrder: screenshot.upload_order ?? 0,
    fileName: cleanText(screenshot.file_name),
    imageWidth: screenshot.image_width ?? 0,
    imageHeight: screenshot.image_height ?? 0,
    confidenceScore: screenshot.confidence_score ?? 0,
    visualSignals: normalizeSignals(screenshot.visual_signals),
  }))

  const rawOcrText = input.rawOcrText?.trim() || ''
  const parsedDraft = rawOcrText
    ? buildScorecardOcrDraftFromText(rawOcrText, screenshots)
    : buildMockScorecardOcrDraft(screenshots)
  const screenshotConfidence = screenshots.length
    ? screenshots.reduce((sum, screenshot) => sum + screenshot.confidenceScore, 0) / screenshots.length
    : 0
  const confidenceScore = roundConfidence(Math.max(parsedDraft.confidenceScore, screenshotConfidence))
  const processedAt = new Date().toISOString()

  const { data: job, error: jobError } = await supabase
    .from('data_assist_ocr_jobs')
    .insert({
      batch_id: input.batchId,
      draft_id: input.draftId,
      requested_by_user_id: userId,
      provider: parsedDraft.provider,
      status: 'completed',
      screenshot_count: screenshots.length,
      confidence_score: confidenceScore,
      warnings: parsedDraft.parserWarnings,
      result_payload: parsedDraft,
      processed_at: processedAt,
    })
    .select('id')
    .single()

  if (jobError) throw new Error(jobError.message)
  const jobId = cleanText((job as { id?: string | null } | null)?.id)
  if (!jobId) throw new Error('OCR verification job could not be created.')

  const draftUpdate = await supabase
    .from('data_assist_drafts')
    .update({
      status: 'ready_for_verification',
      ocr_status: 'processed',
      ocr_job_id: jobId,
      ocr_provider: parsedDraft.provider,
      ocr_processed_at: processedAt,
      parsed_payload: parsedDraft,
      external_match_id: parsedDraft.externalMatchId,
      home_team: parsedDraft.homeTeam,
      away_team: parsedDraft.awayTeam,
      match_date: parsedDraft.matchDate,
      line_count: parsedDraft.lineCount,
      parser_warnings: parsedDraft.parserWarnings,
      validation_summary: {
        message: rawOcrText
          ? 'Review-only OCR parser completed. Admin verification is required before import.'
          : 'Mock OCR boundary completed. No scorecard text has been extracted yet.',
        importLocked: true,
        sourceScreenshotCount: screenshots.length,
      },
    })
    .eq('id', input.draftId)

  if (draftUpdate.error) throw new Error(draftUpdate.error.message)

  return {
    jobId,
    parsedDraft,
  }
}

async function queueDataAssistFreeOcrVerification(input: {
  batchId: string
  draftId: string
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token?.trim()
  if (!token) throw new Error('Sign in as an admin to queue OCR verification.')

  const response = await fetch('/api/data-assist/ocr', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })
  const result = (await response.json().catch(() => null)) as {
    ok?: boolean
    message?: string
    jobId?: string
    parsedDraft?: DataAssistScorecardParsedDraft
  } | null

  if (!response.ok || !result?.ok || !result.jobId || !result.parsedDraft) {
    throw new Error(result?.message || 'Could not queue free OCR verification.')
  }

  return {
    jobId: result.jobId,
    parsedDraft: result.parsedDraft,
  }
}

async function uploadDataAssistScreenshots(
  userId: string,
  batchId: string,
  screenshots: DataAssistPreparedScreenshot[],
) {
  const uploaded: Array<{
    screenshot: DataAssistPreparedScreenshot
    storagePath: string
    storageUploadedAt: string
  }> = []

  for (const screenshot of screenshots) {
    const storagePath = `${userId}/${batchId}/${String(screenshot.uploadOrder).padStart(2, '0')}-${screenshot.clientFingerprint}.${getScreenshotExtension(screenshot.file)}`
    const { error } = await supabase.storage
      .from(DATA_ASSIST_SCREENSHOT_BUCKET)
      .upload(storagePath, screenshot.file, {
        cacheControl: '3600',
        contentType: screenshot.mimeType,
        upsert: false,
      })

    if (error) {
      throw new Error(error.message || `Could not upload ${screenshot.fileName}.`)
    }

    uploaded.push({
      screenshot,
      storagePath,
      storageUploadedAt: new Date().toISOString(),
    })
  }

  return uploaded
}

async function refreshDataAssistContributorStats(profileId: string) {
  const { data, error } = await supabase
    .from('data_assist_batches')
    .select('id, status, reviewed_at')
    .eq('submitted_by_user_id', profileId)

  if (error) throw new Error(error.message)

  const rows = (data || []) as DataAssistStatsBatchRow[]
  const verifiedRows = rows.filter((row) => row.status === 'ready_to_import' || row.status === 'verified' || row.status === 'imported')
  const rejectedRows = rows.filter((row) => row.status === 'rejected')
  const pendingRows = rows.filter((row) => row.status !== 'ready_to_import' && row.status !== 'verified' && row.status !== 'imported' && row.status !== 'rejected')
  const reviewedCount = verifiedRows.length + rejectedRows.length
  const accuracyScore = reviewedCount ? Math.round((verifiedRows.length / reviewedCount) * 100) / 100 : 0
  const badges = getDataAssistContributorBadges(verifiedRows.length, accuracyScore)

  const { error: upsertError } = await supabase
    .from('data_assist_contributor_stats')
    .upsert({
      profile_id: profileId,
      verified_import_count: verifiedRows.length,
      rejected_import_count: rejectedRows.length,
      pending_review_count: pendingRows.length,
      contribution_accuracy_score: accuracyScore,
      admin_verified_imports: verifiedRows.length,
      badges,
      last_verified_at: latestReviewedAt(verifiedRows),
      last_rejected_at: latestReviewedAt(rejectedRows),
    }, { onConflict: 'profile_id' })

  if (upsertError) throw new Error(upsertError.message)
}

export function getDataAssistContributorBadges(verifiedImportCount: number, accuracyScore: number): DataAssistContributorBadge[] {
  const badges: DataAssistContributorBadge[] = []

  if (verifiedImportCount >= 1) {
    badges.push({
      id: 'first_import',
      label: 'First Import',
      detail: 'First admin-approved Data Assist upload.',
    })
  }

  if (verifiedImportCount >= 3 && accuracyScore >= 0.75) {
    badges.push({
      id: 'verified_contributor',
      label: 'Verified Contributor',
      detail: 'Three approved uploads with strong accuracy.',
    })
  }

  if (verifiedImportCount >= 8 && accuracyScore >= 0.8) {
    badges.push({
      id: 'community_scout',
      label: 'Community Scout',
      detail: 'Consistently improves local tennis intelligence.',
    })
  }

  return badges
}

function latestReviewedAt(rows: DataAssistStatsBatchRow[]) {
  return rows
    .map((row) => cleanText(row.reviewed_at))
    .filter(Boolean)
    .sort()
    .at(-1) || null
}

function buildEmptyContributorStats(profileId: string): DataAssistContributorStats {
  return {
    profileId,
    verifiedImportCount: 0,
    rejectedImportCount: 0,
    pendingReviewCount: 0,
    contributionAccuracyScore: 0,
    captainVerifiedImports: 0,
    adminVerifiedImports: 0,
    badges: [],
    lastVerifiedAt: '',
    lastRejectedAt: '',
    updatedAt: '',
  }
}

async function addSignedScreenshotUrls(screenshots: DataAssistAdminScreenshot[]) {
  return Promise.all(
    screenshots.map(async (screenshot) => {
      if (!screenshot.storagePath) return screenshot

      const { data, error } = await supabase.storage
        .from(screenshot.storageBucket || DATA_ASSIST_SCREENSHOT_BUCKET)
        .createSignedUrl(screenshot.storagePath, 60 * 20)

      if (error || !data?.signedUrl) return screenshot

      return {
        ...screenshot,
        signedImageUrl: data.signedUrl,
      }
    }),
  )
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

function getScreenshotExtension(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'webp'].includes(fromName)) return fromName
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

function impactAreasForImportType(importType: DataAssistImportType) {
  if (importType === 'schedule') return ['upcoming schedule', 'captain planning', 'player reminders']
  if (importType === 'team_summary') return ['roster identity', 'captain scouting', 'team intelligence']
  return ['matchup insights', 'player trends', 'team results', 'local tennis history']
}

function roundConfidence(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}
