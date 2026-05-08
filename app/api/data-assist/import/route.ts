import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import {
  buildDataAssistScorecardImportRow,
  collectDataAssistImportPlayerNames,
  type DataAssistImportPlayerMapping,
} from '@/lib/data-assist-import'
import type { DataAssistScorecardParsedDraft } from '@/lib/data-assist-ocr'
import { runScorecardImport } from '@/lib/ingestion/runImport'
import type { RunImportSuccess } from '@/lib/ingestion/runImport'
import { recalculateDynamicRatings } from '@/lib/recalculateRatings'

export const runtime = 'nodejs'
export const maxDuration = 60

type ImportRequestBody = {
  batchId?: unknown
  draftId?: unknown
  action?: unknown
}

type PlayerRow = {
  id?: string | null
  name?: string | null
  normalized_name?: string | null
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

  const importPreview = buildDataAssistScorecardImportRow(parsedDraft, {
    reviewedBy: requester.userId,
    sourceBatchId: batchId,
  })
  const playerMappings = await buildPlayerMappings(supabase, collectDataAssistImportPlayerNames(importPreview.row))
  importPreview.playerMappings = playerMappings
  const unresolvedPlayerCount = playerMappings.filter((mapping) => mapping.status === 'unknown').length

  const importResult = await runScorecardImport(
    supabase,
    [importPreview.row],
    action === 'preview' ? 'preview' : 'commit',
    {
      hasNormalizedPlayerNameColumn: true,
      matchPlayersDeleteBeforeInsert: true,
      scorecardLinesTable: null,
      scorecardReviewTable: null,
    },
  )

  if (!importResult.ok) {
    return Response.json({ ok: false, message: importResult.error, importPreview }, { status: 400 })
  }
  const scorecardImportResult = importResult as Extract<RunImportSuccess, { kind: 'scorecard' }>

  if (action === 'commit') {
    if (importPreview.unresolvedWinnerCount > 0) {
      return Response.json(
        { ok: false, message: 'Resolve line winners before committing this Data Assist scorecard.', importPreview },
        { status: 400 },
      )
    }
    if (unresolvedPlayerCount > 0) {
      return Response.json(
        { ok: false, message: 'Resolve unknown players before committing this Data Assist scorecard.', importPreview },
        { status: 400 },
      )
    }
    if (scorecardImportResult.result.failedCount > 0 || scorecardImportResult.result.successCount + scorecardImportResult.result.updatedCount === 0) {
      return Response.json(
        { ok: false, message: scorecardImportResult.result.errors[0]?.message || 'Scorecard import did not commit.', importPreview, importResult: scorecardImportResult },
        { status: 400 },
      )
    }

    await recalculateDynamicRatings(undefined, supabase)
    const validationSummary = {
      ...(draft.validation_summary || {}),
      importSummary: {
        importedAt: new Date().toISOString(),
        importResult: scorecardImportResult,
        playerMappings,
      },
    }
    const [batchUpdate, draftUpdate] = await Promise.all([
      supabase
        .from('data_assist_batches')
        .update({ status: 'imported', review_note: 'Confirmed Data Assist scorecard committed to TenAceIQ.' })
        .eq('id', batchId),
      supabase
        .from('data_assist_drafts')
        .update({ status: 'imported', validation_summary: validationSummary })
        .eq('id', draftId),
    ])

    if (batchUpdate.error) return Response.json({ ok: false, message: batchUpdate.error.message }, { status: 500 })
    if (draftUpdate.error) return Response.json({ ok: false, message: draftUpdate.error.message }, { status: 500 })
  }

  return Response.json({
    ok: true,
    action,
    importPreview,
    importResult: scorecardImportResult,
    message: action === 'commit'
      ? 'Data Assist scorecard committed to TenAceIQ.'
      : buildPreviewMessage(importPreview.unresolvedWinnerCount, unresolvedPlayerCount),
  })
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

async function buildPlayerMappings(
  supabase: SupabaseClient,
  names: string[],
): Promise<DataAssistImportPlayerMapping[]> {
  if (!names.length) return []

  const { data } = await supabase
    .from('players')
    .select('id, name, normalized_name')
    .limit(5000)

  const players = ((data || []) as PlayerRow[])
    .map((player) => ({
      id: cleanText(player.id),
      name: cleanText(player.name),
      normalizedName: cleanText(player.normalized_name) || normalizeName(cleanText(player.name)),
    }))
    .filter((player) => player.id && player.name)

  return names.map((name) => {
    const normalized = normalizeName(name)
    const exact = players.find((player) => player.normalizedName === normalized || normalizeName(player.name) === normalized)
    if (exact) {
      return {
        name,
        status: 'exact',
        matchedPlayerId: exact.id,
        matchedPlayerName: exact.name,
      }
    }

    const likely = players.find((player) =>
      player.normalizedName.includes(normalized) ||
      normalized.includes(player.normalizedName) ||
      levenshteinDistance(player.normalizedName, normalized) <= 2,
    )
    if (likely) {
      return {
        name,
        status: 'likely',
        matchedPlayerId: likely.id,
        matchedPlayerName: likely.name,
      }
    }

    return {
      name,
      status: 'unknown',
      matchedPlayerId: '',
      matchedPlayerName: '',
    }
  })
}

function toParsedDraft(value: unknown): DataAssistScorecardParsedDraft | null {
  if (!value || typeof value !== 'object') return null
  const draft = value as Partial<DataAssistScorecardParsedDraft>
  if (!draft.externalMatchId || !draft.matchDate || !draft.homeTeam || !draft.awayTeam || !Array.isArray(draft.lines)) return null
  return draft as DataAssistScorecardParsedDraft
}

function buildPreviewMessage(unresolvedWinnerCount: number, unresolvedPlayerCount: number) {
  if (unresolvedWinnerCount || unresolvedPlayerCount) {
    return `Import preview ready, but ${unresolvedWinnerCount} winner${unresolvedWinnerCount === 1 ? '' : 's'} and ${unresolvedPlayerCount} player${unresolvedPlayerCount === 1 ? '' : 's'} need resolution before commit.`
  }
  return 'Import preview ready. This scorecard can be committed.'
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

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function levenshteinDistance(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }

  return matrix[a.length][b.length]
}
