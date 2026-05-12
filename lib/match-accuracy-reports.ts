'use client'

import { supabase } from './supabase'

export type MatchAccuracyIssueType =
  | 'wrong_player'
  | 'wrong_score'
  | 'wrong_winner'
  | 'wrong_team'
  | 'duplicate_match'
  | 'missing_match'
  | 'other'

export type MatchAccuracyReportStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected'

export type MatchAccuracyReport = {
  id: string
  matchId: string
  externalMatchId: string
  reporterUserId: string
  reporterPlayerName: string
  issueType: MatchAccuracyIssueType
  description: string
  matchSnapshot: Record<string, unknown>
  sourceBatchId: string
  sourceDraftId: string
  sourceUploaderUserId: string
  status: MatchAccuracyReportStatus
  adminNotes: string
  actionSummary: string
  resolvedByUserId: string
  resolvedAt: string
  createdAt: string
  updatedAt: string
}

export type DataAssistUploaderTrust = {
  profileId: string
  canUploadScorecards: boolean
  uploadSuspensionReason: string
  uploadSuspendedByUserId: string
  uploadSuspendedAt: string
}

export type SubmitMatchAccuracyReportInput = {
  matchId: string
  reporterPlayerName?: string
  issueType: MatchAccuracyIssueType
  description: string
  context?: Record<string, unknown>
}

export type ReviewMatchAccuracyReportInput = {
  reportId: string
  status: MatchAccuracyReportStatus
  adminNotes: string
  actionSummary: string
  uploaderCanUploadScorecards?: boolean
  uploadSuspensionReason?: string
}

type MatchAccuracyReportRow = {
  id?: string | null
  match_id?: string | null
  external_match_id?: string | null
  reporter_user_id?: string | null
  reporter_player_name?: string | null
  issue_type?: string | null
  description?: string | null
  match_snapshot?: Record<string, unknown> | null
  source_batch_id?: string | null
  source_draft_id?: string | null
  source_uploader_user_id?: string | null
  status?: string | null
  admin_notes?: string | null
  action_summary?: string | null
  resolved_by_user_id?: string | null
  resolved_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

const ISSUE_TYPES: MatchAccuracyIssueType[] = [
  'wrong_player',
  'wrong_score',
  'wrong_winner',
  'wrong_team',
  'duplicate_match',
  'missing_match',
  'other',
]

const STATUSES: MatchAccuracyReportStatus[] = ['pending', 'reviewing', 'resolved', 'rejected']

export async function submitMatchAccuracyReport(input: SubmitMatchAccuracyReportInput) {
  const token = await getAccessToken()
  if (!token) throw new Error('Sign in to report a match issue.')

  const response = await fetch('/api/match-accuracy-reports', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })

  return readReportResponse(response, 'Could not submit this match report.')
}

export async function listMatchAccuracyReportsForAdmin() {
  const token = await getAccessToken()
  if (!token) throw new Error('Sign in as an admin to review match reports.')

  const response = await fetch('/api/match-accuracy-reports', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
  const result = (await response.json().catch(() => null)) as {
    ok?: boolean
    reports?: MatchAccuracyReportRow[]
    message?: string
  } | null

  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || 'Could not load match reports.')
  }

  return (result.reports || []).map(toMatchAccuracyReport).filter((report): report is MatchAccuracyReport => Boolean(report))
}

export async function reviewMatchAccuracyReport(input: ReviewMatchAccuracyReportInput) {
  const token = await getAccessToken()
  if (!token) throw new Error('Sign in as an admin to review match reports.')

  const response = await fetch('/api/match-accuracy-reports', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })

  return readReportResponse(response, 'Could not update this match report.')
}

export function getIssueTypeLabel(issueType: MatchAccuracyIssueType) {
  switch (issueType) {
    case 'wrong_player': return 'Wrong player'
    case 'wrong_score': return 'Wrong score'
    case 'wrong_winner': return 'Wrong winner'
    case 'wrong_team': return 'Wrong team'
    case 'duplicate_match': return 'Duplicate match'
    case 'missing_match': return 'Missing match'
    default: return 'Other'
  }
}

export function getReportStatusLabel(status: MatchAccuracyReportStatus) {
  switch (status) {
    case 'reviewing': return 'Reviewing'
    case 'resolved': return 'Resolved'
    case 'rejected': return 'Rejected'
    default: return 'Pending'
  }
}

export function getUploaderTrustLabel(trust: Pick<DataAssistUploaderTrust, 'canUploadScorecards' | 'uploadSuspensionReason'> | null) {
  if (!trust) return 'No uploader linked'
  if (trust.canUploadScorecards) return 'Scorecard uploads enabled'
  return trust.uploadSuspensionReason || 'Scorecard uploads paused'
}

function normalizeIssueType(value: unknown): MatchAccuracyIssueType {
  return ISSUE_TYPES.includes(value as MatchAccuracyIssueType) ? value as MatchAccuracyIssueType : 'other'
}

function normalizeStatus(value: unknown): MatchAccuracyReportStatus {
  return STATUSES.includes(value as MatchAccuracyReportStatus) ? value as MatchAccuracyReportStatus : 'pending'
}

function toMatchAccuracyReport(row: MatchAccuracyReportRow): MatchAccuracyReport | null {
  const id = cleanText(row.id)
  if (!id) return null

  return {
    id,
    matchId: cleanText(row.match_id),
    externalMatchId: cleanText(row.external_match_id),
    reporterUserId: cleanText(row.reporter_user_id),
    reporterPlayerName: cleanText(row.reporter_player_name),
    issueType: normalizeIssueType(row.issue_type),
    description: cleanText(row.description),
    matchSnapshot: row.match_snapshot || {},
    sourceBatchId: cleanText(row.source_batch_id),
    sourceDraftId: cleanText(row.source_draft_id),
    sourceUploaderUserId: cleanText(row.source_uploader_user_id),
    status: normalizeStatus(row.status),
    adminNotes: cleanText(row.admin_notes),
    actionSummary: cleanText(row.action_summary),
    resolvedByUserId: cleanText(row.resolved_by_user_id),
    resolvedAt: cleanText(row.resolved_at),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  }
}

async function readReportResponse(response: Response, fallbackMessage: string) {
  const result = (await response.json().catch(() => null)) as {
    ok?: boolean
    report?: MatchAccuracyReportRow
    message?: string
  } | null

  if (!response.ok || !result?.ok || !result.report) {
    throw new Error(result?.message || fallbackMessage)
  }

  const report = toMatchAccuracyReport(result.report)
  if (!report) throw new Error(fallbackMessage)
  return report
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token?.trim() || ''
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}
