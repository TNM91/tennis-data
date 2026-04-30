import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { recalculateDynamicRatings } from '@/lib/recalculateRatings'
import { supabaseUrl } from '@/lib/supabase'
import {
  createImportEngine,
  type ImportEngineOptions,
  type ScheduleImportRow,
  type ScorecardImportRow,
  type TeamSummaryImportRow,
} from './importEngine'
import {
  normalizeCapturedSchedulePayload,
  normalizeCapturedScorecardPayload,
  normalizeCapturedTeamSummaryPayload,
  type NormalizationWarning,
} from './normalizeCapturedImports'
import { buildScorecardCommitRows, buildScorecardPreviewModels } from './scorecardReview'

export type AutoImportPageType = 'scorecard' | 'season_schedule' | 'team_summary'
export type AutoImportStatus = 'imported' | 'skipped_duplicate' | 'needs_review' | 'failed'
type ConfidenceLevel = 'high' | 'medium' | 'low'

export type AutoImportRequest = {
  pageType: AutoImportPageType
  payload: unknown
}

export type AutoImportResponse = {
  status: AutoImportStatus
  message: string
  details?: Record<string, unknown>
}

type ReviewQueuePayload = {
  pageType: AutoImportPageType
  payload: unknown
  reason: string
  details?: Record<string, unknown>
}

type ExistingMatchRow = {
  external_match_id: string | null
  match_date: string | null
  match_time: string | null
  home_team: string | null
  away_team: string | null
  league_name: string | null
  flight: string | null
  status: string | null
}

const AUTO_IMPORT_ENGINE_OPTIONS: ImportEngineOptions = {
  hasNormalizedPlayerNameColumn: true,
  matchPlayersDeleteBeforeInsert: true,
  scorecardLinesTable: null,
  scorecardReviewTable: null,
}

export function createServerSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for automated imports')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export function normalizeImportName(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return ''
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+\/+$/g, '')
    .replace(/\/+$/g, '')
    .trim()
}

function normalizeLookupKey(value: unknown): string {
  return normalizeImportName(value).replace(/\s*\/\s*/g, '/').toLowerCase()
}

function normalizePlayerNames(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const cleaned = normalizeImportName(value)
    const key = cleaned.toLowerCase()
    if (!cleaned || seen.has(key)) continue
    seen.add(key)
    result.push(cleaned)
  }

  return result
}

function isPlaceholderTeamName(value: unknown): boolean {
  const key = normalizeLookupKey(value)
  return key === 'team name' || key === 'team' || key === 'teams'
}

function isMalformedTeamName(value: unknown): boolean {
  const cleaned = normalizeImportName(value)
  const lower = cleaned.toLowerCase()

  if (!cleaned) return true
  if (isPlaceholderTeamName(cleaned)) return true
  if (lower === 'unknown' || lower === 'unknown team') return true
  if (lower === 'singles' || lower === 'doubles') return true
  if (/^#?\s*\d+\s*#?\s*(singles|doubles)$/i.test(cleaned)) return true
  if (/\bvs\.?\b|\bv\.?\b/i.test(cleaned)) return true
  if (/https?:\/\//i.test(cleaned)) return true
  if (cleaned.includes('\n') || cleaned.includes('\t')) return true

  return false
}

function normalizeScheduleRows(rows: ScheduleImportRow[]): ScheduleImportRow[] {
  return rows.map((row) => ({
    ...row,
    homeTeam: normalizeImportName(row.homeTeam),
    awayTeam: normalizeImportName(row.awayTeam),
    leagueName: normalizeImportName(row.leagueName) || null,
    flight: normalizeImportName(row.flight) || null,
    ustaSection: normalizeImportName(row.ustaSection) || null,
    districtArea: normalizeImportName(row.districtArea) || null,
  }))
}

function normalizeScorecardRows(rows: ScorecardImportRow[]): ScorecardImportRow[] {
  return rows.map((row) => ({
    ...row,
    homeTeam: normalizeImportName(row.homeTeam),
    awayTeam: normalizeImportName(row.awayTeam),
    leagueName: normalizeImportName(row.leagueName) || null,
    flight: normalizeImportName(row.flight) || null,
    ustaSection: normalizeImportName(row.ustaSection) || null,
    districtArea: normalizeImportName(row.districtArea) || null,
    lines: row.lines.map((line) => ({
      ...line,
      sideAPlayers: normalizePlayerNames(line.sideAPlayers),
      sideBPlayers: normalizePlayerNames(line.sideBPlayers),
    })),
  }))
}

function normalizeTeamSummaryRows(rows: TeamSummaryImportRow[]): TeamSummaryImportRow[] {
  return rows.map((row) => {
    const teams = row.teams.map((team) => ({
      ...team,
      name: normalizeImportName(team.name),
    })).filter((team) => !isPlaceholderTeamName(team.name))

    const canonicalTeamMap: Record<string, string> = {}
    for (const [key, value] of Object.entries(row.canonicalTeamMap ?? {})) {
      if (!isPlaceholderTeamName(key) && !isPlaceholderTeamName(value)) {
        canonicalTeamMap[normalizeLookupKey(key)] = normalizeImportName(value)
      }
    }
    for (const team of teams) {
      const key = normalizeLookupKey(team.name)
      if (key && !canonicalTeamMap[key]) canonicalTeamMap[key] = team.name
    }

    return {
      ...row,
      leagueName: normalizeImportName(row.leagueName) || null,
      flight: normalizeImportName(row.flight) || null,
      ustaSection: normalizeImportName(row.ustaSection) || null,
      districtArea: normalizeImportName(row.districtArea) || null,
      rosterTeamName: normalizeImportName(row.rosterTeamName) || null,
      teams,
      canonicalTeamMap,
      players: row.players.map((player) => ({
      ...player,
      name: normalizeImportName(player.name),
      teamName: normalizeImportName(player.teamName) || null,
      })),
    }
  })
}

async function enqueueForReview(
  supabase: SupabaseClient,
  request: ReviewQueuePayload,
): Promise<AutoImportResponse> {
  const { error } = await supabase.from('import_queue').insert({
    page_type: request.pageType,
    payload: request.payload,
    status: 'pending',
    reason: request.reason,
  })

  if (error) {
    return {
      status: 'failed',
      message: `Import failed - could not queue review: ${error.message}`,
      details: { reason: request.reason, error: error.message, ...request.details },
    }
  }

  return {
    status: 'needs_review',
    message: `Needs review - ${request.reason}`,
    details: request.details,
  }
}

async function fetchExistingMatches(
  supabase: SupabaseClient,
  externalMatchIds: string[],
): Promise<Map<string, ExistingMatchRow>> {
  const ids = Array.from(new Set(externalMatchIds.map(normalizeImportName).filter(Boolean)))
  const existing = new Map<string, ExistingMatchRow>()
  if (ids.length === 0) return existing

  const { data, error } = await supabase
    .from('matches')
    .select('external_match_id, match_date, match_time, home_team, away_team, league_name, flight, status')
    .in('external_match_id', ids)

  if (error) throw new Error(error.message)

  for (const row of (data ?? []) as ExistingMatchRow[]) {
    if (row.external_match_id) existing.set(row.external_match_id, row)
  }

  return existing
}

function scheduleDedupeKey(row: ScheduleImportRow): string {
  return [
    row.matchDate,
    normalizeLookupKey(row.homeTeam),
    normalizeLookupKey(row.awayTeam),
    normalizeImportName(row.matchTime),
  ].join('__')
}

async function findExistingScheduleKeys(
  supabase: SupabaseClient,
  rows: ScheduleImportRow[],
): Promise<Set<string>> {
  const dates = Array.from(new Set(rows.map((row) => row.matchDate).filter(Boolean)))
  const existing = new Set<string>()
  if (dates.length === 0) return existing

  const { data, error } = await supabase
    .from('matches')
    .select('match_date, match_time, home_team, away_team')
    .in('match_date', dates)
    .is('line_number', null)

  if (error) throw new Error(error.message)

  for (const row of (data ?? []) as ExistingMatchRow[]) {
    existing.add(scheduleDedupeKey({
      externalMatchId: '',
      matchDate: normalizeImportName(row.match_date),
      matchTime: row.match_time,
      homeTeam: normalizeImportName(row.home_team),
      awayTeam: normalizeImportName(row.away_team),
    }))
  }

  return existing
}

function buildScorecardLabel(row: ScorecardImportRow | undefined): string {
  if (!row) return 'scorecard'
  return `${row.homeTeam} vs ${row.awayTeam}`
}

function buildScheduleLabel(result: { successCount: number; updatedCount: number; skippedCount: number }) {
  const imported = result.successCount + result.updatedCount
  if (imported === 1) return 'Imported 1 scheduled match'
  return `Imported ${imported} scheduled matches`
}

function hasOnlyDuplicateRows(rows: Array<{ status: string }>) {
  return rows.length > 0 && rows.every((row) => row.status === 'skipped')
}

function scheduleConfidence(rows: ScheduleImportRow[], warnings: NormalizationWarning[]): {
  confidence: ConfidenceLevel
  validRows: ScheduleImportRow[]
  invalidReasons: string[]
} {
  const invalidReasons: string[] = [...warnings.map((warning) => warning.message)]
  const validRows: ScheduleImportRow[] = []

  for (const row of rows) {
    if (isMalformedTeamName(row.homeTeam) || isMalformedTeamName(row.awayTeam)) {
      invalidReasons.push(`Invalid team names for ${row.externalMatchId || row.matchDate || 'schedule row'}`)
      continue
    }
    validRows.push(row)
  }

  const totalSeen = rows.length + warnings.length
  if (totalSeen === 0) {
    return { confidence: 'low', validRows, invalidReasons: ['No valid schedule rows found'] }
  }

  const passRate = validRows.length / totalSeen
  return {
    confidence: passRate >= 0.9 && validRows.length > 0 ? 'high' : passRate >= 0.5 ? 'medium' : 'low',
    validRows,
    invalidReasons,
  }
}

async function importScheduleAuto(
  supabase: SupabaseClient,
  payload: unknown,
): Promise<AutoImportResponse> {
  const normalized = normalizeCapturedSchedulePayload(payload)
  const rows = normalizeScheduleRows(normalized.rows)
  const assessment = scheduleConfidence(rows, normalized.warnings)

  if (assessment.confidence !== 'high') {
    return enqueueForReview(supabase, {
      pageType: 'season_schedule',
      payload,
      reason: `${assessment.invalidReasons.length} schedule rows failed validation`,
      details: {
        confidence: assessment.confidence,
        normalizedRowCount: rows.length,
        invalidReasons: assessment.invalidReasons,
      },
    })
  }

  const existingExternalIds = await fetchExistingMatches(
    supabase,
    assessment.validRows.map((row) => row.externalMatchId),
  )
  const existingScheduleKeys = await findExistingScheduleKeys(supabase, assessment.validRows)
  const rowsToCommit = assessment.validRows.filter((row) => {
    if (existingExternalIds.has(row.externalMatchId)) return false
    return !existingScheduleKeys.has(scheduleDedupeKey(row))
  })
  const duplicateCount = assessment.validRows.length - rowsToCommit.length

  if (rowsToCommit.length === 0) {
    return {
      status: 'skipped_duplicate',
      message: 'Skipped - already imported',
      details: { duplicateCount, normalizedRowCount: rows.length },
    }
  }

  const result = await createImportEngine(supabase, AUTO_IMPORT_ENGINE_OPTIONS).importSchedule(rowsToCommit, 'commit')
  if (result.failedCount > 0) {
    return {
      status: 'failed',
      message: `Import failed - ${result.errors[0]?.message ?? 'schedule rows failed'}`,
      details: { result, duplicateCount },
    }
  }

  return {
    status: 'imported',
    message: buildScheduleLabel(result),
    details: {
      importedCount: result.successCount + result.updatedCount,
      skippedDuplicateCount: duplicateCount,
      skippedInvalidCount: assessment.invalidReasons.length,
      result,
    },
  }
}

function scorecardHasResolvableWinners(row: ScorecardImportRow): boolean {
  if (!Array.isArray(row.lines) || row.lines.length === 0) return false
  return row.lines.every((line) => Boolean(line.winnerSide))
}

async function importScorecardAuto(
  supabase: SupabaseClient,
  payload: unknown,
): Promise<AutoImportResponse> {
  const normalized = normalizeCapturedScorecardPayload(payload)
  const rows = normalizeScorecardRows(normalized.rows)

  if (rows.length === 0) {
    return {
      status: 'failed',
      message: normalized.warnings[0]?.message
        ? `Import failed - ${normalized.warnings[0].message}`
        : 'Import failed - missing matchId',
      details: { warnings: normalized.warnings },
    }
  }

  const malformedTeams = rows.filter((row) => isMalformedTeamName(row.homeTeam) || isMalformedTeamName(row.awayTeam))
  if (malformedTeams.length > 0) {
    return enqueueForReview(supabase, {
      pageType: 'scorecard',
      payload,
      reason: `${malformedTeams.length} scorecard matches had invalid team names`,
      details: { warnings: normalized.warnings },
    })
  }

  const existing = await fetchExistingMatches(supabase, rows.map((row) => row.externalMatchId))
  const duplicateRows = rows.filter((row) => existing.get(row.externalMatchId)?.status === 'completed')
  const rowsNeedingCommit = rows.filter((row) => existing.get(row.externalMatchId)?.status !== 'completed')

  if (rowsNeedingCommit.length === 0) {
    return {
      status: 'skipped_duplicate',
      message: 'Skipped - already imported',
      details: { duplicateCount: duplicateRows.length },
    }
  }

  const previews = buildScorecardPreviewModels(rowsNeedingCommit)
  const commitRows = buildScorecardCommitRows(previews, 'clean_only')
  const allSafe =
    commitRows.length === rowsNeedingCommit.length &&
    commitRows.every(scorecardHasResolvableWinners)

  if (!allSafe) {
    return enqueueForReview(supabase, {
      pageType: 'scorecard',
      payload,
      reason: 'one or more scorecard lines need winner review',
      details: {
        confidence: 'low',
        warnings: normalized.warnings,
        previews: previews.map((preview) => ({
          externalMatchId: preview.externalMatchId,
          status: preview.status,
          issues: preview.issues,
        })),
      },
    })
  }

  const result = await createImportEngine(supabase, AUTO_IMPORT_ENGINE_OPTIONS).importScorecards(commitRows, 'commit')
  if (result.failedCount > 0) {
    return {
      status: 'failed',
      message: `Import failed - ${result.errors[0]?.message ?? 'scorecard rows failed'}`,
      details: { result },
    }
  }

  try {
    await recalculateDynamicRatings(undefined, supabase)
  } catch (error) {
    return {
      status: 'failed',
      message: `Import failed - scorecard imported but ratings did not recalculate: ${
        error instanceof Error ? error.message : 'unknown rating error'
      }`,
      details: { result },
    }
  }

  return {
    status: hasOnlyDuplicateRows(result.rows) ? 'skipped_duplicate' : 'imported',
    message: `Imported scorecard: ${buildScorecardLabel(commitRows[0])}`,
    details: {
      duplicateCount: duplicateRows.length,
      result,
    },
  }
}

async function fetchScheduleTeamKeys(supabase: SupabaseClient, rows: TeamSummaryImportRow[]) {
  const leagues = Array.from(new Set(rows.map((row) => normalizeImportName(row.leagueName)).filter(Boolean)))
  const keys = new Set<string>()

  let query = supabase
    .from('matches')
    .select('home_team, away_team, league_name')
    .is('line_number', null)

  if (leagues.length > 0) {
    query = query.in('league_name', leagues)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  for (const row of (data ?? []) as Array<{ home_team: string | null; away_team: string | null; league_name: string | null }>) {
    const leagueKey = normalizeLookupKey(row.league_name)
    const home = normalizeLookupKey(row.home_team)
    const away = normalizeLookupKey(row.away_team)
    if (home) keys.add(`${leagueKey}__${home}`)
    if (away) keys.add(`${leagueKey}__${away}`)
  }

  return keys
}

function scheduleHasTeam(scheduleTeamKeys: Set<string>, leagueKey: string, teamName: string): boolean {
  const teamKey = normalizeLookupKey(teamName)
  if (!teamKey) return false
  if (scheduleTeamKeys.has(`${leagueKey}__${teamKey}`)) return true

  for (const key of scheduleTeamKeys) {
    if (key.endsWith(`__${teamKey}`)) return true
  }

  return false
}

function collectTeamSummaryValidationIssues(rows: TeamSummaryImportRow[], scheduleTeamKeys: Set<string>) {
  const issues: string[] = []
  const warnings: string[] = []

  for (const row of rows) {
    const leagueKey = normalizeLookupKey(row.leagueName)
    const rosterNames = new Set<string>()

    for (const team of row.teams) {
      if (isMalformedTeamName(team.name)) {
        issues.push(`Invalid team name in team summary: ${team.name || 'blank'}`)
        continue
      }

      if (scheduleTeamKeys.size > 0 && !scheduleHasTeam(scheduleTeamKeys, leagueKey, team.name)) {
        warnings.push(`Team summary team does not match schedule: ${team.name}`)
      }
    }

    for (const player of row.players) {
      const playerName = normalizeImportName(player.name)
      const playerKey = playerName.toLowerCase()
      if (!playerName) issues.push('Blank roster player name')
      if (rosterNames.has(playerKey)) issues.push(`Duplicate roster player: ${playerName}`)
      rosterNames.add(playerKey)

      const playerTeam = normalizeImportName(player.teamName ?? row.rosterTeamName)
      if (playerTeam) {
        if (scheduleTeamKeys.size > 0 && !scheduleHasTeam(scheduleTeamKeys, leagueKey, playerTeam)) {
          warnings.push(`Roster team does not match schedule: ${playerTeam}`)
        }
      }
    }
  }

  return { issues, warnings }
}

async function importTeamSummaryAuto(
  supabase: SupabaseClient,
  payload: unknown,
): Promise<AutoImportResponse> {
  const normalized = normalizeCapturedTeamSummaryPayload(payload)
  const rows = normalizeTeamSummaryRows(normalized.rows)

  if (rows.length === 0) {
    return enqueueForReview(supabase, {
      pageType: 'team_summary',
      payload,
      reason: normalized.warnings[0]?.message ?? 'no valid team summary rows found',
      details: { warnings: normalized.warnings },
    })
  }

  const scheduleTeamKeys = await fetchScheduleTeamKeys(supabase, rows)
  const validation = collectTeamSummaryValidationIssues(rows, scheduleTeamKeys)
  const issues = validation.issues
  const advisoryWarnings = [...validation.warnings]

  if (scheduleTeamKeys.size === 0) {
    advisoryWarnings.push('No matching schedule teams found for this team summary')
  }

  if (issues.length > 0) {
    return enqueueForReview(supabase, {
      pageType: 'team_summary',
      payload,
      reason: `${issues.length} team summary checks need review`,
      details: { confidence: 'low', issues, warnings: [...normalized.warnings, ...advisoryWarnings] },
    })
  }

  const result = await createImportEngine(supabase, AUTO_IMPORT_ENGINE_OPTIONS).importTeamSummary(rows, 'commit')
  if (result.failedCount > 0) {
    return {
      status: 'failed',
      message: `Import failed - ${result.errors[0]?.message ?? 'team summary rows failed'}`,
      details: { result },
    }
  }

  return {
    status: 'imported',
    message: `Imported team summary: ${rows[0]?.leagueName ?? rows[0]?.rosterTeamName ?? 'roster'}`,
    details: {
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      warnings: advisoryWarnings,
      result,
    },
  }
}

export async function runAutoImport(
  supabase: SupabaseClient,
  request: AutoImportRequest,
): Promise<AutoImportResponse> {
  if (
    request.pageType !== 'scorecard' &&
    request.pageType !== 'season_schedule' &&
    request.pageType !== 'team_summary'
  ) {
    return {
      status: 'failed',
      message: 'Import failed - invalid pageType',
    }
  }

  if (request.payload === null || typeof request.payload !== 'object') {
    return {
      status: 'failed',
      message: 'Import failed - payload must be an object',
    }
  }

  try {
    if (request.pageType === 'scorecard') {
      return await importScorecardAuto(supabase, request.payload)
    }

    if (request.pageType === 'season_schedule') {
      return await importScheduleAuto(supabase, request.payload)
    }

    return await importTeamSummaryAuto(supabase, request.payload)
  } catch (error) {
    return {
      status: 'failed',
      message: `Import failed - ${error instanceof Error ? error.message : 'unknown error'}`,
    }
  }
}
