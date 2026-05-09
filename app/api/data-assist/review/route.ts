import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import {
  runDataAssistScheduleImportAction,
  runDataAssistScorecardImportAction,
  runDataAssistTeamSummaryImportAction,
  type DataAssistScheduleImportActionResult,
  type DataAssistScorecardImportActionResult,
  type DataAssistTeamSummaryImportActionResult,
} from '@/lib/data-assist-import-runner'
import type { DataAssistScorecardParsedDraft } from '@/lib/data-assist-ocr'
import type { DataAssistScheduleParsedDraft } from '@/lib/data-assist-schedule-parser'
import type { DataAssistTeamSummaryParsedDraft } from '@/lib/data-assist-team-summary-parser'

export const runtime = 'nodejs'
export const maxDuration = 60

type ReviewRequestBody = {
  batchId?: unknown
  draftId?: unknown
  decision?: unknown
}

type DataAssistStatsBatchRow = {
  status?: string | null
  reviewed_at?: string | null
}

export async function POST(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Sign in required.' }, { status: 401 })
  }

  const requester = await getRequester(token)
  if (!requester.ok) {
    return Response.json({ ok: false, message: requester.message }, { status: requester.status })
  }

  let body: ReviewRequestBody
  try {
    body = (await request.json()) as ReviewRequestBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid Data Assist review request.' }, { status: 400 })
  }

  const batchId = cleanText(body.batchId)
  const draftId = cleanText(body.draftId)
  const decision = cleanText(body.decision)
  if (!batchId || !draftId || (decision !== 'confirmed' && decision !== 'flagged')) {
    return Response.json({ ok: false, message: 'Missing Data Assist review details.' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return Response.json(
      { ok: false, message: 'SUPABASE_SERVICE_ROLE_KEY is required for Data Assist review updates.' },
      { status: 500 },
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const [batchResult, draftResult] = await Promise.all([
    supabase
      .from('data_assist_batches')
      .select('submitted_by_user_id, status')
      .eq('id', batchId)
      .maybeSingle(),
    supabase
      .from('data_assist_drafts')
      .select('submitted_by_user_id, status, ocr_status, parsed_payload, validation_summary')
      .eq('id', draftId)
      .eq('batch_id', batchId)
      .maybeSingle(),
  ])

  if (batchResult.error) return Response.json({ ok: false, message: batchResult.error.message }, { status: 500 })
  if (draftResult.error) return Response.json({ ok: false, message: draftResult.error.message }, { status: 500 })

  const batch = batchResult.data as { submitted_by_user_id?: string | null; status?: string | null } | null
  const draft = draftResult.data as {
    submitted_by_user_id?: string | null
    status?: string | null
    ocr_status?: string | null
    parsed_payload?: Record<string, unknown> | null
    validation_summary?: Record<string, unknown> | null
  } | null

  if (!batch || !draft) {
    return Response.json({ ok: false, message: 'Data Assist draft was not found.' }, { status: 404 })
  }
  if (cleanText(batch.submitted_by_user_id) !== requester.userId || cleanText(draft.submitted_by_user_id) !== requester.userId) {
    return Response.json({ ok: false, message: 'You can only review your own Data Assist upload.' }, { status: 403 })
  }
  if (cleanText(draft.ocr_status) !== 'processed') {
    return Response.json({ ok: false, message: 'Run OCR before reviewing this Data Assist draft.' }, { status: 400 })
  }

  const reviewedAt = new Date().toISOString()
  const parsedLineCount = getParsedLineCount(draft.parsed_payload)
  if (decision === 'confirmed' && parsedLineCount <= 0) {
    return Response.json({ ok: false, message: 'This OCR draft has no parsed scorecard lines to confirm.' }, { status: 400 })
  }

  if (decision === 'confirmed') {
    const parsedDraft = toParsedDraft(draft.parsed_payload)
    if (!parsedDraft) {
      return Response.json({ ok: false, message: 'This OCR draft does not have a complete parsed payload to import.' }, { status: 400 })
    }

    const verifiedNote = 'Uploader confirmed the OCR scorecard read.'
    const [batchUpdate, draftUpdate] = await Promise.all([
      supabase
        .from('data_assist_batches')
        .update({
          status: 'verified',
          review_note: verifiedNote,
          reviewed_by_user_id: requester.userId,
          reviewed_at: reviewedAt,
        })
        .eq('id', batchId),
      supabase
        .from('data_assist_drafts')
        .update({
          status: 'verified',
          review_note: verifiedNote,
          reviewed_by_user_id: requester.userId,
          reviewed_at: reviewedAt,
        })
        .eq('id', draftId),
    ])

    if (batchUpdate.error) return Response.json({ ok: false, message: batchUpdate.error.message }, { status: 500 })
    if (draftUpdate.error) return Response.json({ ok: false, message: draftUpdate.error.message }, { status: 500 })

    const autoImport = await runConfirmedReviewImport({
      supabase,
      parsedDraft,
      batchId,
      draftId,
      reviewedBy: requester.userId,
      validationSummary: draft.validation_summary,
    })

    if (!autoImport.ok) {
      const exceptionNote = `Confirmed read, but import paused: ${autoImport.message}`
      const [exceptionBatchUpdate, exceptionDraftUpdate] = await Promise.all([
        supabase
          .from('data_assist_batches')
          .update({
            status: 'needs_review',
            review_note: exceptionNote,
            reviewed_by_user_id: requester.userId,
            reviewed_at: reviewedAt,
          })
          .eq('id', batchId),
        supabase
          .from('data_assist_drafts')
          .update({
            status: 'ready_for_verification',
            review_note: exceptionNote,
            validation_summary: {
              ...(draft.validation_summary || {}),
              autoImport,
              importLocked: true,
            },
            reviewed_by_user_id: requester.userId,
            reviewed_at: reviewedAt,
          })
          .eq('id', draftId),
      ])

      if (exceptionBatchUpdate.error) return Response.json({ ok: false, message: exceptionBatchUpdate.error.message }, { status: 500 })
      if (exceptionDraftUpdate.error) return Response.json({ ok: false, message: exceptionDraftUpdate.error.message }, { status: 500 })
    }

    await refreshContributorStats(supabase, requester.userId)

    return Response.json({
      ok: true,
      status: autoImport.ok ? 'imported' : 'needs_review',
      autoImport,
      message: autoImport.ok
        ? autoImport.message
        : `Read confirmed, but TenAceIQ needs one exception check before import: ${autoImport.message}`,
    })
  }

  const reviewNote = 'Uploader flagged the OCR scorecard read for exception review.'
  const [batchUpdate, draftUpdate] = await Promise.all([
    supabase
      .from('data_assist_batches')
      .update({
        status: 'needs_review',
        review_note: reviewNote,
        reviewed_by_user_id: requester.userId,
        reviewed_at: reviewedAt,
      })
      .eq('id', batchId),
    supabase
      .from('data_assist_drafts')
      .update({
        status: 'needs_review',
        review_note: reviewNote,
        reviewed_by_user_id: requester.userId,
        reviewed_at: reviewedAt,
      })
      .eq('id', draftId),
  ])

  if (batchUpdate.error) return Response.json({ ok: false, message: batchUpdate.error.message }, { status: 500 })
  if (draftUpdate.error) return Response.json({ ok: false, message: draftUpdate.error.message }, { status: 500 })

  await refreshContributorStats(supabase, requester.userId)

  return Response.json({
    ok: true,
    status: 'needs_review',
    message: 'Scorecard flagged for exception review.',
  })
}

async function runConfirmedReviewImport(input: {
  supabase: SupabaseClient
  parsedDraft: DataAssistScorecardParsedDraft | DataAssistScheduleParsedDraft | DataAssistTeamSummaryParsedDraft
  batchId: string
  draftId: string
  reviewedBy: string
  validationSummary?: Record<string, unknown> | null
}): Promise<DataAssistScorecardImportActionResult | DataAssistScheduleImportActionResult | DataAssistTeamSummaryImportActionResult> {
  try {
    if (isTeamSummaryParsedDraft(input.parsedDraft)) {
      return await runDataAssistTeamSummaryImportAction({
        supabase: input.supabase,
        parsedDraft: input.parsedDraft,
        batchId: input.batchId,
        draftId: input.draftId,
        reviewedBy: input.reviewedBy,
        action: 'commit',
        validationSummary: {
          ...(input.validationSummary || {}),
          memberConfirmedAt: new Date().toISOString(),
        },
      })
    }

    if (isScheduleParsedDraft(input.parsedDraft)) {
      return await runDataAssistScheduleImportAction({
        supabase: input.supabase,
        parsedDraft: input.parsedDraft,
        batchId: input.batchId,
        draftId: input.draftId,
        reviewedBy: input.reviewedBy,
        action: 'commit',
        validationSummary: {
          ...(input.validationSummary || {}),
          memberConfirmedAt: new Date().toISOString(),
        },
      })
    }

    return await runDataAssistScorecardImportAction({
      supabase: input.supabase,
      parsedDraft: input.parsedDraft,
      batchId: input.batchId,
      draftId: input.draftId,
      reviewedBy: input.reviewedBy,
      action: 'commit',
      validationSummary: {
        ...(input.validationSummary || {}),
        memberConfirmedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    return {
      ok: false,
      action: 'commit',
      message: error instanceof Error ? error.message : 'Confirmed scorecard import failed.',
    }
  }
}

async function getRequester(token: string): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; message: string }
> {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)

  if (userError || !userData.user) {
    return { ok: false, status: 401, message: 'Sign in required.' }
  }

  return { ok: true, userId: userData.user.id }
}

async function refreshContributorStats(
  supabase: SupabaseClient,
  profileId: string,
) {
  const { data, error } = await supabase
    .from('data_assist_batches')
    .select('status, reviewed_at')
    .eq('submitted_by_user_id', profileId)

  if (error) throw new Error(error.message)

  const rows = (data || []) as DataAssistStatsBatchRow[]
  const verifiedRows = rows.filter((row) => row.status === 'verified' || row.status === 'imported')
  const rejectedRows = rows.filter((row) => row.status === 'rejected')
  const pendingRows = rows.filter((row) => row.status !== 'verified' && row.status !== 'imported' && row.status !== 'rejected')
  const reviewedCount = verifiedRows.length + rejectedRows.length
  const accuracyScore = reviewedCount ? Math.round((verifiedRows.length / reviewedCount) * 100) / 100 : 0
  const badges = getContributorBadges(verifiedRows.length, accuracyScore)

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

function getContributorBadges(verifiedImportCount: number, accuracyScore: number) {
  const badges: Array<{ id: string; label: string; detail: string }> = []
  if (verifiedImportCount >= 1) {
    badges.push({
      id: 'first_import',
      label: 'First Import',
      detail: 'First verified Data Assist upload.',
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

function toParsedDraft(value: unknown): DataAssistScorecardParsedDraft | DataAssistScheduleParsedDraft | DataAssistTeamSummaryParsedDraft | null {
  if (!value || typeof value !== 'object') return null
  if (isTeamSummaryParsedDraft(value)) return value
  if (isScheduleParsedDraft(value)) return value
  const draft = value as Partial<DataAssistScorecardParsedDraft>
  if (!draft.externalMatchId || !draft.matchDate || !draft.homeTeam || !draft.awayTeam || !Array.isArray(draft.lines)) return null
  return draft as DataAssistScorecardParsedDraft
}

function getParsedLineCount(value: unknown) {
  if (!value || typeof value !== 'object') return 0
  if (isTeamSummaryParsedDraft(value)) return value.players.length
  if (isScheduleParsedDraft(value)) return value.matches.length
  const draft = value as { lineCount?: unknown; lines?: unknown }
  if (typeof draft.lineCount === 'number' && Number.isFinite(draft.lineCount)) return draft.lineCount
  return Array.isArray(draft.lines) ? draft.lines.length : 0
}

function isScheduleParsedDraft(value: unknown): value is DataAssistScheduleParsedDraft {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as Partial<DataAssistScheduleParsedDraft>).matches))
}

function isTeamSummaryParsedDraft(value: unknown): value is DataAssistTeamSummaryParsedDraft {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as Partial<DataAssistTeamSummaryParsedDraft>).players))
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
