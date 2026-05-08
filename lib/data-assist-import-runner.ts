import type { SupabaseClient } from '@supabase/supabase-js'
import {
  applyDataAssistPlayerMappingsToRow,
  buildDataAssistScorecardImportRow,
  collectDataAssistImportPlayerNames,
  type DataAssistImportPlayerMapping,
  type DataAssistImportPreview,
} from './data-assist-import'
import type { DataAssistScorecardParsedDraft } from './data-assist-ocr'
import { runScorecardImport, type RunImportSuccess } from './ingestion/runImport'
import { recalculateDynamicRatings } from './recalculateRatings'

export type DataAssistScorecardImportAction = 'preview' | 'commit'

export type DataAssistScorecardImportActionResult = {
  ok: boolean
  action: DataAssistScorecardImportAction
  message: string
  importPreview?: DataAssistImportPreview
  importResult?: Extract<RunImportSuccess, { kind: 'scorecard' }>
}

type PlayerRow = {
  id?: string | null
  name?: string | null
  normalized_name?: string | null
}

type StatsBatchRow = {
  status?: string | null
  reviewed_at?: string | null
}

export async function runDataAssistScorecardImportAction(input: {
  supabase: SupabaseClient
  parsedDraft: DataAssistScorecardParsedDraft
  batchId: string
  draftId: string
  reviewedBy: string
  action: DataAssistScorecardImportAction
  validationSummary?: Record<string, unknown> | null
}): Promise<DataAssistScorecardImportActionResult> {
  const importPreview = await buildDataAssistImportPreview({
    supabase: input.supabase,
    parsedDraft: input.parsedDraft,
    batchId: input.batchId,
    reviewedBy: input.reviewedBy,
  })

  if (input.action === 'commit' && importPreview.unresolvedWinnerCount > 0) {
    return {
      ok: false,
      action: input.action,
      message: 'Resolve line winners before committing this Data Assist scorecard.',
      importPreview,
    }
  }

  const importResult = await runScorecardImport(
    input.supabase,
    [importPreview.row],
    input.action === 'preview' ? 'preview' : 'commit',
    {
      hasNormalizedPlayerNameColumn: true,
      matchPlayersDeleteBeforeInsert: true,
      scorecardLinesTable: null,
      scorecardReviewTable: null,
    },
  )

  if (!importResult.ok) {
    return {
      ok: false,
      action: input.action,
      message: importResult.error,
      importPreview,
    }
  }

  const scorecardImportResult = importResult as Extract<RunImportSuccess, { kind: 'scorecard' }>

  if (input.action === 'commit') {
    if (
      scorecardImportResult.result.failedCount > 0 ||
      scorecardImportResult.result.successCount + scorecardImportResult.result.updatedCount === 0
    ) {
      return {
        ok: false,
        action: input.action,
        message: scorecardImportResult.result.errors[0]?.message || 'Scorecard import did not commit.',
        importPreview,
        importResult: scorecardImportResult,
      }
    }

    await recalculateDynamicRatings(undefined, input.supabase)
    const importedAt = new Date().toISOString()
    const validationSummary = {
      ...(input.validationSummary || {}),
      importSummary: {
        importedAt,
        importResult: scorecardImportResult,
        playerMappings: importPreview.playerMappings,
      },
    }
    const [batchUpdate, draftUpdate] = await Promise.all([
      input.supabase
        .from('data_assist_batches')
        .update({
          status: 'imported',
          review_note: buildImportedReviewNote(scorecardImportResult),
          reviewed_by_user_id: input.reviewedBy,
          reviewed_at: importedAt,
        })
        .eq('id', input.batchId),
      input.supabase
        .from('data_assist_drafts')
        .update({
          status: 'imported',
          validation_summary: validationSummary,
          reviewed_by_user_id: input.reviewedBy,
          reviewed_at: importedAt,
        })
        .eq('id', input.draftId),
    ])

    if (batchUpdate.error) {
      return { ok: false, action: input.action, message: batchUpdate.error.message, importPreview, importResult: scorecardImportResult }
    }
    if (draftUpdate.error) {
      return { ok: false, action: input.action, message: draftUpdate.error.message, importPreview, importResult: scorecardImportResult }
    }

    await refreshDataAssistContributorStats(input.supabase, input.reviewedBy)
  }

  return {
    ok: true,
    action: input.action,
    importPreview,
    importResult: scorecardImportResult,
    message: input.action === 'commit'
      ? buildImportedReviewNote(scorecardImportResult)
      : buildPreviewMessage(importPreview),
  }
}

async function buildDataAssistImportPreview(input: {
  supabase: SupabaseClient
  parsedDraft: DataAssistScorecardParsedDraft
  batchId: string
  reviewedBy: string
}): Promise<DataAssistImportPreview> {
  const importPreview = buildDataAssistScorecardImportRow(input.parsedDraft, {
    reviewedBy: input.reviewedBy,
    sourceBatchId: input.batchId,
  })
  const playerMappings = await buildPlayerMappings(input.supabase, collectDataAssistImportPlayerNames(importPreview.row))

  importPreview.playerMappings = playerMappings
  importPreview.row = applyDataAssistPlayerMappingsToRow(importPreview.row, playerMappings)

  return importPreview
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
        matchConfidence: 1,
        matchReason: 'Exact player name match',
      }
    }

    const likely = players
      .map((player) => {
        const distance = levenshteinDistance(player.normalizedName, normalized)
        const contains = player.normalizedName.includes(normalized) || normalized.includes(player.normalizedName)
        return {
          player,
          score: contains ? 0.88 : distance <= 2 ? 0.82 : 0,
          reason: contains ? 'Contained name match' : distance <= 2 ? 'Near spelling match' : '',
        }
      })
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)[0]

    if (likely) {
      return {
        name,
        status: 'likely',
        matchedPlayerId: likely.player.id,
        matchedPlayerName: likely.player.name,
        matchConfidence: likely.score,
        matchReason: likely.reason,
      }
    }

    return {
      name,
      status: 'unknown',
      matchedPlayerId: '',
      matchedPlayerName: '',
      matchConfidence: 0,
      matchReason: 'New player will be created if the scorecard is committed',
    }
  })
}

async function refreshDataAssistContributorStats(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from('data_assist_batches')
    .select('status, reviewed_at')
    .eq('submitted_by_user_id', profileId)

  if (error) throw new Error(error.message)

  const rows = (data || []) as StatsBatchRow[]
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
    })

  if (upsertError) throw new Error(upsertError.message)
}

function buildPreviewMessage(importPreview: DataAssistImportPreview) {
  const likelyPlayerCount = importPreview.playerMappings.filter((mapping) => mapping.status === 'likely').length
  const newPlayerCount = importPreview.playerMappings.filter((mapping) => mapping.status === 'unknown').length
  if (importPreview.unresolvedWinnerCount) {
    return `Import preview ready, but ${importPreview.unresolvedWinnerCount} winner${importPreview.unresolvedWinnerCount === 1 ? '' : 's'} need resolution before commit.`
  }
  if (likelyPlayerCount || newPlayerCount) {
    return `Import preview ready. ${likelyPlayerCount} likely player match${likelyPlayerCount === 1 ? '' : 'es'} and ${newPlayerCount} new player${newPlayerCount === 1 ? '' : 's'} were prepared.`
  }
  return 'Import preview ready. This scorecard can be committed.'
}

function buildImportedReviewNote(importResult: Extract<RunImportSuccess, { kind: 'scorecard' }>) {
  const createdPlayers = importResult.result.createdPlayersCount
  const linkedPlayers = importResult.result.linkedPlayersCount
  return `Data Assist scorecard imported to TenAceIQ. ${linkedPlayers} player link${linkedPlayers === 1 ? '' : 's'} refreshed${createdPlayers ? `; ${createdPlayers} new player${createdPlayers === 1 ? '' : 's'} created` : ''}.`
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

function latestReviewedAt(rows: StatsBatchRow[]) {
  return rows
    .map((row) => cleanText(row.reviewed_at))
    .filter(Boolean)
    .sort()
    .at(-1) || null
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
