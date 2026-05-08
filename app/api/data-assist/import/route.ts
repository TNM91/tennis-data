import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import { runDataAssistScorecardImportAction } from '@/lib/data-assist-import-runner'
import type { DataAssistScorecardParsedDraft } from '@/lib/data-assist-ocr'

export const runtime = 'nodejs'
export const maxDuration = 60

type ImportRequestBody = {
  batchId?: unknown
  draftId?: unknown
  action?: unknown
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

  let body: ImportRequestBody
  try {
    body = (await request.json()) as ImportRequestBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid Data Assist import request.' }, { status: 400 })
  }

  const batchId = cleanText(body.batchId)
  const draftId = cleanText(body.draftId)
  const action = cleanText(body.action)
  if (!batchId || !draftId || (action !== 'preview' && action !== 'commit')) {
    return Response.json({ ok: false, message: 'Missing Data Assist import details.' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return Response.json(
      { ok: false, message: 'SUPABASE_SERVICE_ROLE_KEY is required for Data Assist import.' },
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
      .select('submitted_by_user_id, status, parsed_payload, validation_summary')
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
    parsed_payload?: unknown
    validation_summary?: Record<string, unknown> | null
  } | null

  if (!batch || !draft) {
    return Response.json({ ok: false, message: 'Data Assist draft was not found.' }, { status: 404 })
  }
  if (cleanText(batch.submitted_by_user_id) !== requester.userId || cleanText(draft.submitted_by_user_id) !== requester.userId) {
    return Response.json({ ok: false, message: 'You can only import your own verified Data Assist upload.' }, { status: 403 })
  }

  const batchStatus = cleanText(batch.status)
  const draftStatus = cleanText(draft.status)
  if (action === 'commit' && (batchStatus !== 'verified' || draftStatus !== 'verified')) {
    return Response.json({ ok: false, message: 'Confirm the OCR read before committing this scorecard.' }, { status: 400 })
  }
  if (action === 'preview' && !['ready_to_import', 'verified', 'imported'].includes(batchStatus)) {
    return Response.json({ ok: false, message: 'Run and confirm OCR before previewing this import.' }, { status: 400 })
  }

  const parsedDraft = toParsedDraft(draft.parsed_payload)
  if (!parsedDraft) {
    return Response.json({ ok: false, message: 'This Data Assist draft does not have a parsed scorecard payload.' }, { status: 400 })
  }

  const importResult = await runDataAssistScorecardImportAction({
    supabase,
    parsedDraft,
    batchId,
    draftId,
    reviewedBy: requester.userId,
    action,
    validationSummary: draft.validation_summary,
  })

  if (!importResult.ok) {
    return Response.json(importResult, { status: 400 })
  }

  return Response.json(importResult)
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

function toParsedDraft(value: unknown): DataAssistScorecardParsedDraft | null {
  if (!value || typeof value !== 'object') return null
  const draft = value as Partial<DataAssistScorecardParsedDraft>
  if (!draft.externalMatchId || !draft.matchDate || !draft.homeTeam || !draft.awayTeam || !Array.isArray(draft.lines)) return null
  return draft as DataAssistScorecardParsedDraft
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
