import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import type { MatchAccuracyIssueType, MatchAccuracyReportStatus } from '@/lib/match-accuracy-reports'

export const runtime = 'nodejs'

const REPORT_SELECT =
  'id, match_id, external_match_id, reporter_user_id, reporter_player_name, issue_type, description, match_snapshot, source_batch_id, source_draft_id, source_uploader_user_id, status, admin_notes, action_summary, resolved_by_user_id, resolved_at, created_at, updated_at'

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

type PostBody = {
  matchId?: unknown
  reporterPlayerName?: unknown
  issueType?: unknown
  description?: unknown
  context?: unknown
}

type PatchBody = {
  reportId?: unknown
  status?: unknown
  adminNotes?: unknown
  actionSummary?: unknown
  uploaderCanUploadScorecards?: unknown
  uploadSuspensionReason?: unknown
}

export async function GET(request: Request) {
  const token = getBearerToken(request)
  const auth = createAuthedClient(token)
  const user = await getAuthenticatedUser(auth)
  if (!user.userId) {
    return Response.json({ ok: false, message: 'Sign in as an admin to review match reports.' }, { status: 401 })
  }
  if (!(await isAdmin(auth, user.userId))) {
    return Response.json({ ok: false, message: 'Admin access is required.' }, { status: 403 })
  }

  const service = createServiceClient()
  if (!service) {
    return Response.json({ ok: false, message: 'Match report review is not configured.' }, { status: 500 })
  }

  const { data, error } = await service
    .from('match_accuracy_reports')
    .select(REPORT_SELECT)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
  return Response.json({ ok: true, reports: data || [] })
}

export async function POST(request: Request) {
  const token = getBearerToken(request)
  const auth = createAuthedClient(token)
  const user = await getAuthenticatedUser(auth)
  if (!user.userId) {
    return Response.json({ ok: false, message: 'Sign in to report a match accuracy issue.' }, { status: 401 })
  }

  let body: PostBody
  try {
    body = (await request.json()) as PostBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid report body.' }, { status: 400 })
  }

  const matchId = cleanText(body.matchId)
  const description = cleanText(body.description, 2000)
  const issueType = normalizeIssueType(body.issueType)
  if (!matchId) {
    return Response.json({ ok: false, message: 'Choose a match to report.' }, { status: 400 })
  }
  if (description.length < 8) {
    return Response.json({ ok: false, message: 'Add a short note explaining what looks wrong.' }, { status: 400 })
  }

  const service = createServiceClient()
  if (!service) {
    return Response.json({ ok: false, message: 'Match report capture is not configured.' }, { status: 500 })
  }

  const matchSnapshot = await loadMatchSnapshot(service, matchId)
  const externalMatchId = cleanText(matchSnapshot.external_match_id)
  const source = externalMatchId ? await loadSourceUpload(service, externalMatchId) : null

  const { data, error } = await service
    .from('match_accuracy_reports')
    .insert({
      match_id: matchId,
      external_match_id: externalMatchId,
      reporter_user_id: user.userId,
      reporter_player_name: cleanText(body.reporterPlayerName, 180),
      issue_type: issueType,
      description,
      match_snapshot: {
        ...matchSnapshot,
        reporterContext: isRecord(body.context) ? body.context : {},
      },
      source_batch_id: source?.batch_id || null,
      source_draft_id: source?.id || null,
      source_uploader_user_id: source?.submitted_by_user_id || null,
    })
    .select(REPORT_SELECT)
    .single()

  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
  return Response.json({ ok: true, report: data })
}

export async function PATCH(request: Request) {
  const token = getBearerToken(request)
  const auth = createAuthedClient(token)
  const user = await getAuthenticatedUser(auth)
  if (!user.userId) {
    return Response.json({ ok: false, message: 'Sign in as an admin to update match reports.' }, { status: 401 })
  }
  if (!(await isAdmin(auth, user.userId))) {
    return Response.json({ ok: false, message: 'Admin access is required.' }, { status: 403 })
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid review body.' }, { status: 400 })
  }

  const reportId = cleanText(body.reportId)
  const status = normalizeStatus(body.status)
  if (!reportId) {
    return Response.json({ ok: false, message: 'Missing report id.' }, { status: 400 })
  }

  const service = createServiceClient()
  if (!service) {
    return Response.json({ ok: false, message: 'Match report review is not configured.' }, { status: 500 })
  }

  const { data: existing, error: existingError } = await service
    .from('match_accuracy_reports')
    .select('id, source_uploader_user_id')
    .eq('id', reportId)
    .single()

  if (existingError) return Response.json({ ok: false, message: existingError.message }, { status: 500 })
  const sourceUploaderUserId = cleanText((existing as { source_uploader_user_id?: string | null } | null)?.source_uploader_user_id)
  const now = new Date().toISOString()

  const { data, error } = await service
    .from('match_accuracy_reports')
    .update({
      status,
      admin_notes: cleanText(body.adminNotes, 2000),
      action_summary: cleanText(body.actionSummary, 2000),
      resolved_by_user_id: status === 'resolved' || status === 'rejected' ? user.userId : null,
      resolved_at: status === 'resolved' || status === 'rejected' ? now : null,
    })
    .eq('id', reportId)
    .select(REPORT_SELECT)
    .single()

  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })

  if (sourceUploaderUserId && typeof body.uploaderCanUploadScorecards === 'boolean') {
    const canUpload = body.uploaderCanUploadScorecards
    const { error: trustError } = await service
      .from('data_assist_contributor_stats')
      .upsert({
        profile_id: sourceUploaderUserId,
        can_upload_scorecards: canUpload,
        upload_suspension_reason: canUpload ? '' : cleanText(body.uploadSuspensionReason, 1000),
        upload_suspended_by_user_id: canUpload ? null : user.userId,
        upload_suspended_at: canUpload ? null : now,
      }, { onConflict: 'profile_id' })

    if (trustError) return Response.json({ ok: false, message: trustError.message }, { status: 500 })
  }

  return Response.json({ ok: true, report: data })
}

async function loadMatchSnapshot(service: SupabaseClient, matchId: string): Promise<Record<string, unknown>> {
  const { data, error } = await service
    .from('matches')
    .select('id, external_match_id, home_team, away_team, match_date, match_type, score, winner_side, league_name, flight, usta_section, district_area, match_source')
    .eq('id', matchId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return isRecord(data) ? data : { id: matchId }
}

async function loadSourceUpload(service: SupabaseClient, externalMatchId: string) {
  const { data, error } = await service
    .from('data_assist_drafts')
    .select('id, batch_id, submitted_by_user_id')
    .eq('draft_type', 'scorecard')
    .eq('external_match_id', externalMatchId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return isRecord(data)
    ? {
        id: cleanText(data.id),
        batch_id: cleanText(data.batch_id),
        submitted_by_user_id: cleanText(data.submitted_by_user_id),
      }
    : null
}

async function getAuthenticatedUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.id) return { userId: '', email: '' }
  return { userId: data.user.id, email: data.user.email || '' }
}

async function isAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (error) return false
  return cleanText((data as { role?: string | null } | null)?.role) === 'admin'
}

function createAuthedClient(token: string) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
  })
}

function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}

function normalizeIssueType(value: unknown): MatchAccuracyIssueType {
  return ISSUE_TYPES.includes(value as MatchAccuracyIssueType) ? value as MatchAccuracyIssueType : 'other'
}

function normalizeStatus(value: unknown): MatchAccuracyReportStatus {
  return STATUSES.includes(value as MatchAccuracyReportStatus) ? value as MatchAccuracyReportStatus : 'pending'
}

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
