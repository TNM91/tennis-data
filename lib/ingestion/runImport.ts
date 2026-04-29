import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createImportEngine,
  type ImportEngineOptions,
  type ImportMode,
  type ScheduleImportResult,
  type ScorecardImportResult,
  type TeamSummaryImportResult,
} from './importEngine'
import {
  normalizeCapturedSchedulePayload,
  normalizeCapturedScorecardPayload,
  normalizeCapturedTeamSummaryPayload,
  type NormalizationWarning,
} from './normalizeCapturedImports'

export type CapturedImportKind = 'schedule' | 'scorecard' | 'team_summary'

export type RunImportRequest = {
  kind: CapturedImportKind
  payload: unknown
  mode?: ImportMode
  engineOptions?: ImportEngineOptions
}

export type RunImportSuccess =
  | {
      ok: true
      kind: 'schedule'
      mode: ImportMode
      normalizedRowCount: number
      warnings: NormalizationWarning[]
      result: ScheduleImportResult
    }
  | {
      ok: true
      kind: 'scorecard'
      mode: ImportMode
      normalizedRowCount: number
      warnings: NormalizationWarning[]
      result: ScorecardImportResult
    }
  | {
      ok: true
      kind: 'team_summary'
      mode: ImportMode
      normalizedRowCount: number
      warnings: NormalizationWarning[]
      result: TeamSummaryImportResult
    }

export type RunImportFailure = {
  ok: false
  kind: CapturedImportKind
  mode: ImportMode
  normalizedRowCount: number
  warnings: NormalizationWarning[]
  error: string
}

export type RunImportResponse = RunImportSuccess | RunImportFailure

export type ImportSummary = {
  ok: boolean
  kind: CapturedImportKind
  mode: ImportMode
  normalizedRowCount: number
  warningCount: number
  successCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
  createdPlayersCount: number
  linkedPlayersCount: number
  skippedLinesCount?: number
  error?: string
}

function getMode(mode?: ImportMode): ImportMode {
  return mode === 'preview' ? 'preview' : 'commit'
}

function unknownToMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error.trim()
  return 'Unknown import error'
}

export async function runImport(
  supabase: SupabaseClient,
  request: RunImportRequest,
): Promise<RunImportResponse> {
  const mode = getMode(request.mode)
  const engine = createImportEngine(supabase, request.engineOptions)

  try {
    if (request.kind === 'schedule') {
      const normalized = normalizeCapturedSchedulePayload(request.payload)
      const result = await engine.importSchedule(normalized.rows, mode)

      return {
        ok: true,
        kind: 'schedule',
        mode,
        normalizedRowCount: normalized.rows.length,
        warnings: normalized.warnings,
        result,
      }
    }

    if (request.kind === 'team_summary') {
      const normalized = normalizeCapturedTeamSummaryPayload(request.payload)
      const result = await engine.importTeamSummary(normalized.rows, mode)

      return {
        ok: true,
        kind: 'team_summary',
        mode,
        normalizedRowCount: normalized.rows.length,
        warnings: normalized.warnings,
        result,
      }
    }

    const normalized = normalizeCapturedScorecardPayload(request.payload)
    const result = await engine.importScorecards(normalized.rows, mode)
    const warnings = await filterResolvedScorecardLeagueWarnings(
      supabase,
      normalized.rows,
      normalized.warnings,
    )

    return {
      ok: true,
      kind: 'scorecard',
      mode,
      normalizedRowCount: normalized.rows.length,
      warnings,
      result,
    }
  } catch (error) {
    return {
      ok: false,
      kind: request.kind,
      mode,
      normalizedRowCount: 0,
      warnings: [],
      error: unknownToMessage(error),
    }
  }
}

async function filterResolvedScorecardLeagueWarnings(
  supabase: SupabaseClient,
  rows: ReturnType<typeof normalizeCapturedScorecardPayload>['rows'],
  warnings: NormalizationWarning[],
): Promise<NormalizationWarning[]> {
  const missingLeagueWarnings = warnings.filter((warning) =>
    warning.message.includes('missing a visible league name'),
  )
  if (missingLeagueWarnings.length === 0) return warnings

  const rowIndexes = new Set(missingLeagueWarnings.map((warning) => warning.rowIndex))
  const externalMatchIds = rows
    .filter((_, index) => rowIndexes.has(index))
    .map((row) => row.externalMatchId)
    .filter((id): id is string => Boolean(id))

  if (externalMatchIds.length === 0) return warnings

  const { data, error } = await supabase
    .from('matches')
    .select('external_match_id, league_name')
    .in('external_match_id', externalMatchIds)

  if (error) return warnings

  const idsWithExistingLeague = new Set(
    ((data ?? []) as Array<{ external_match_id: string | null; league_name: string | null }>)
      .filter((row) => row.external_match_id && row.league_name?.trim())
      .map((row) => row.external_match_id as string),
  )

  if (idsWithExistingLeague.size === 0) return warnings

  return warnings.filter((warning) => {
    if (!warning.message.includes('missing a visible league name')) return true
    const row = rows[warning.rowIndex]
    return !row?.externalMatchId || !idsWithExistingLeague.has(row.externalMatchId)
  })
}

export async function runScheduleImport(
  supabase: SupabaseClient,
  payload: unknown,
  mode: ImportMode = 'commit',
  engineOptions?: ImportEngineOptions,
): Promise<RunImportResponse> {
  return runImport(supabase, {
    kind: 'schedule',
    payload,
    mode,
    engineOptions,
  })
}

export async function runScorecardImport(
  supabase: SupabaseClient,
  payload: unknown,
  mode: ImportMode = 'commit',
  engineOptions?: ImportEngineOptions,
): Promise<RunImportResponse> {
  return runImport(supabase, {
    kind: 'scorecard',
    payload,
    mode,
    engineOptions,
  })
}

export async function runTeamSummaryImport(
  supabase: SupabaseClient,
  payload: unknown,
  mode: ImportMode = 'commit',
  engineOptions?: ImportEngineOptions,
): Promise<RunImportResponse> {
  return runImport(supabase, {
    kind: 'team_summary',
    payload,
    mode,
    engineOptions,
  })
}

export function summarizeImportResponse(response: RunImportResponse): ImportSummary {
  if (!response.ok) {
    return {
      ok: false,
      kind: response.kind,
      mode: response.mode,
      normalizedRowCount: response.normalizedRowCount,
      warningCount: response.warnings.length,
      successCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      createdPlayersCount: 0,
      linkedPlayersCount: 0,
      error: response.error,
    }
  }

  if (response.kind === 'schedule') {
    return {
      ok: true,
      kind: 'schedule',
      mode: response.mode,
      normalizedRowCount: response.normalizedRowCount,
      warningCount: response.warnings.length,
      successCount: response.result.successCount,
      updatedCount: response.result.updatedCount,
      skippedCount: response.result.skippedCount,
      failedCount: response.result.failedCount,
      createdPlayersCount: 0,
      linkedPlayersCount: 0,
    }
  }

  if (response.kind === 'team_summary') {
    const r = response.result
    return {
      ok: true,
      kind: 'team_summary',
      mode: response.mode,
      normalizedRowCount: response.normalizedRowCount,
      warningCount: response.warnings.length,
      successCount: r.createdCount + r.updatedCount,
      updatedCount: r.updatedCount,
      skippedCount: r.skippedCount,
      failedCount: r.failedCount,
      createdPlayersCount: r.createdCount,
      linkedPlayersCount: 0,
    }
  }

  return {
    ok: true,
    kind: 'scorecard',
    mode: response.mode,
    normalizedRowCount: response.normalizedRowCount,
    warningCount: response.warnings.length,
    successCount: response.result.successCount,
    updatedCount: response.result.updatedCount,
    skippedCount: response.result.skippedCount,
    failedCount: response.result.failedCount,
    createdPlayersCount: response.result.createdPlayersCount,
    linkedPlayersCount: response.result.linkedPlayersCount,
    skippedLinesCount: response.result.skippedLinesCount,
  }
}

export function importResponseToUiLines(response: RunImportResponse): string[] {
  const summary = summarizeImportResponse(response)

  const isTeamSummaryPreview = summary.kind === 'team_summary' && summary.mode === 'preview'

  const lines = [
    `Import type: ${summary.kind}`,
    `Mode: ${summary.mode}`,
    `Normalized rows: ${summary.normalizedRowCount}`,
    `Warnings: ${summary.warningCount}`,
    ...(!isTeamSummaryPreview ? [`Imported: ${summary.successCount}`] : []),
    ...(!isTeamSummaryPreview ? [`Updated: ${summary.updatedCount}`] : []),
    `Skipped: ${summary.skippedCount}`,
    `Failed: ${summary.failedCount}`,
  ]

  if (summary.kind === 'scorecard') {
    lines.push(`Created players: ${summary.createdPlayersCount}`)
    lines.push(`Linked players: ${summary.linkedPlayersCount}`)
  }

  if (summary.kind === 'team_summary') {
    if (summary.mode === 'preview') {
      lines.push(`Would create: ${summary.createdPlayersCount} new players`)
      lines.push(`Would update: ${summary.updatedCount} existing player baselines`)
    } else {
      lines.push(`Created players: ${summary.createdPlayersCount}`)
    }
  }

  if (!summary.ok && summary.error) {
    lines.push(`Error: ${summary.error}`)
  }

  return lines
}

export function collectImportMessages(response: RunImportResponse): string[] {
  const messages: string[] = []

  messages.push(...importResponseToUiLines(response))

  if (response.warnings.length > 0) {
    messages.push('Warnings:')
    for (const warning of response.warnings) {
      messages.push(`- Row ${warning.rowIndex + 1}: ${warning.message}`)
    }
  }

  if (response.ok && response.kind === 'schedule') {
    if (response.result.errors.length > 0) {
      messages.push('Import errors:')
      for (const error of response.result.errors) {
        messages.push(
          `- Row ${error.rowIndex + 1}${error.externalMatchId ? ` (${error.externalMatchId})` : ''}: ${error.message}`,
        )
      }
    }
  }

  if (response.ok && response.kind === 'scorecard') {
    if (response.result.errors.length > 0) {
      messages.push('Import errors:')
      for (const error of response.result.errors) {
        messages.push(
          `- Row ${error.rowIndex + 1}${error.externalMatchId ? ` (${error.externalMatchId})` : ''}: ${error.message}`,
        )
      }
    }
  }

  if (response.ok && response.kind === 'team_summary') {
    if (response.result.errors.length > 0) {
      messages.push('Import errors:')
      for (const error of response.result.errors) {
        messages.push(`- ${error.message}`)
      }
    }
  }

  return messages
}
