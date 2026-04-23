import type { SupabaseClient } from '@supabase/supabase-js'
import { buildLeagueEntityId, buildTeamEntityId } from '@/lib/entity-ids'

export type MatchSide = 'A' | 'B'
export type MatchType = 'singles' | 'doubles'
export type ImportMode = 'preview' | 'commit'
export type ScoreEventType = 'standard' | 'third_set_match_tiebreak' | 'timed_match'
export type WinnerSource =
  | 'dom_marker'
  | 'winner_column'
  | 'set_math'
  | 'inferred_missing_third_set'
  | 'unknown'

export type TeamSummaryTeamRow = {
  name: string
  wins?: number | null
  losses?: number | null
}

export type TeamSummaryPlayerRow = {
  name: string
  ntrp?: number | null
  teamName?: string | null
}

export type TeamSummaryImportRow = {
  leagueName?: string | null
  flight?: string | null
  ustaSection?: string | null
  districtArea?: string | null
  source?: string | null
  teams: TeamSummaryTeamRow[]
  players: TeamSummaryPlayerRow[]
  canonicalTeamMap?: Record<string, string>
  playerRatingSeeds?: Record<string, number>
  raw_capture_json?: unknown
}

export type ScheduleImportRow = {
  externalMatchId: string
  matchDate: string
  matchTime?: string | null
  homeTeam: string
  awayTeam: string
  facility?: string | null
  leagueName?: string | null
  flight?: string | null
  ustaSection?: string | null
  districtArea?: string | null
  source?: string | null
  playerRatingSeeds?: Record<string, number>
}

export type ScorecardLineImportRow = {
  lineNumber: number
  matchType: MatchType
  sideAPlayers: string[]
  sideBPlayers: string[]
  winnerSide: MatchSide | null
  score?: string | null
  rawScoreText?: string | null
  visibleSetScores?: string[]
  explicitWinnerMarker?: string | null
  explicitWinnerSide?: MatchSide | null
  winnerColumnSide?: MatchSide | null
  captureConfidence?: number
  winnerSource?: WinnerSource
  scoreEventType?: ScoreEventType
  timedMatch?: boolean
  hasThirdSetMatchTiebreak?: boolean
  parseNotes?: string[]
  isLocked?: boolean
  evidenceClass?: 'locked' | 'inferred' | 'unresolved' | 'conflict_candidate'
  sets?: Array<{
    homeGames?: number | null
    awayGames?: number | null
    isMatchTiebreak?: boolean
    isTimed?: boolean
  }>
}

export type ScorecardImportRow = {
  externalMatchId: string
  matchDate: string
  homeTeam: string
  awayTeam: string
  lines: ScorecardLineImportRow[]
  leagueName?: string | null
  flight?: string | null
  ustaSection?: string | null
  districtArea?: string | null
  facility?: string | null
  matchTime?: string | null
  source?: string | null
  totalTeamScore?: {
    home: number | null
    away: number | null
  } | null
  captureEngine?: {
    version: string
    captureQuality: number
    diagnostics: string[]
  } | null
  dataConflict?: boolean
  conflictType?: string | null
  needsReview?: boolean
  reviewStatus?: 'clean' | 'repaired' | 'needs_review' | 'blocked'
  raw_capture_json?: unknown
  validated_capture_json?: unknown
  repair_log?: Array<{
    code: string
    label: string
    description: string
    autoApplied: boolean
  }>
  reviewer_note?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  playerRatingSeeds?: Record<string, number>
}

export type ImportIssueCode =
  | 'INVALID_ROW'
  | 'MATCH_UPSERT_FAILED'
  | 'MATCH_LOOKUP_FAILED'
  | 'PLAYER_LOOKUP_FAILED'
  | 'PLAYER_CREATE_FAILED'
  | 'MATCH_PLAYERS_DELETE_FAILED'
  | 'MATCH_PLAYERS_INSERT_FAILED'
  | 'SCORECARD_LINES_UPSERT_FAILED'
  | 'UNKNOWN'

export type ImportRowError = {
  rowIndex: number
  externalMatchId?: string | null
  code: ImportIssueCode
  message: string
}

export type ScheduleRowResult = {
  rowIndex: number
  externalMatchId: string
  status: 'preview' | 'imported' | 'updated' | 'skipped' | 'failed'
  matchId?: string | null
  message?: string
}

export type ScorecardRowResult = {
  rowIndex: number
  externalMatchId: string
  status: 'preview' | 'imported' | 'updated' | 'skipped' | 'failed'
  matchId?: string | null
  createdPlayerNames: string[]
  linkedPlayerCount: number
  message?: string
}

export type TeamSummaryPlayerResult = {
  name: string
  status: 'created' | 'updated' | 'skipped' | 'failed'
  ntrp: number | null
  message?: string
}

export type TeamSummaryImportResult = {
  mode: ImportMode
  totalPlayers: number
  createdCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
  players: TeamSummaryPlayerResult[]
  errors: ImportRowError[]
}

export type ScheduleImportResult = {
  mode: ImportMode
  totalRows: number
  successCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
  rows: ScheduleRowResult[]
  errors: ImportRowError[]
}

export type ScorecardImportResult = {
  mode: ImportMode
  totalRows: number
  successCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
  createdPlayersCount: number
  linkedPlayersCount: number
  rows: ScorecardRowResult[]
  errors: ImportRowError[]
}

function normalizeSummaryLookupKey(value: string): string {
  return cleanString(value).replace(/\s*\/\s*/g, '/').toLowerCase()
}

export function buildCanonicalTeamMapFromTeamSummaryRows(rows: TeamSummaryImportRow[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.canonicalTeamMap ?? {})) {
      const cleanKey = normalizeSummaryLookupKey(key)
      const cleanValue = cleanString(value)
      if (cleanKey && cleanValue) map[cleanKey] = cleanValue
    }
    for (const team of row.teams) {
      const cleanName = cleanString(team.name)
      const key = normalizeSummaryLookupKey(cleanName)
      if (key && cleanName && !map[key]) map[key] = cleanName
    }
  }
  return map
}

export function buildPlayerRatingSeedMapFromTeamSummaryRows(rows: TeamSummaryImportRow[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.playerRatingSeeds ?? {})) {
      const rating = typeof value === 'number' && Number.isFinite(value) ? value : null
      const cleanKey = cleanString(key)
      if (cleanKey && rating !== null) map[cleanKey] = rating
    }
    for (const player of row.players) {
      const cleanName = cleanString(player.name)
      const rating = typeof player.ntrp === 'number' && Number.isFinite(player.ntrp) ? player.ntrp : null
      if (cleanName && rating !== null && map[cleanName] === undefined) map[cleanName] = rating
    }
  }
  return map
}

function canonicalizeTeamName(name: string, canonicalMap: Record<string, string>): string {
  const cleanName = cleanString(name)
  const key = normalizeSummaryLookupKey(cleanName)
  return canonicalMap[key] ?? cleanName
}

export function applyTeamSummaryContextToScheduleRows(rows: ScheduleImportRow[], summaryRows: TeamSummaryImportRow[]): ScheduleImportRow[] {
  const canonicalMap = buildCanonicalTeamMapFromTeamSummaryRows(summaryRows)
  const ratingSeeds = buildPlayerRatingSeedMapFromTeamSummaryRows(summaryRows)
  return rows.map((row) => ({
    ...row,
    homeTeam: canonicalizeTeamName(row.homeTeam, canonicalMap),
    awayTeam: canonicalizeTeamName(row.awayTeam, canonicalMap),
    playerRatingSeeds: {
      ...(ratingSeeds ?? {}),
      ...(row.playerRatingSeeds ?? {}),
    },
  }))
}

export function applyTeamSummaryContextToScorecardRows(rows: ScorecardImportRow[], summaryRows: TeamSummaryImportRow[]): ScorecardImportRow[] {
  const canonicalMap = buildCanonicalTeamMapFromTeamSummaryRows(summaryRows)
  const ratingSeeds = buildPlayerRatingSeedMapFromTeamSummaryRows(summaryRows)
  return rows.map((row) => ({
    ...row,
    homeTeam: canonicalizeTeamName(row.homeTeam, canonicalMap),
    awayTeam: canonicalizeTeamName(row.awayTeam, canonicalMap),
    playerRatingSeeds: {
      ...(ratingSeeds ?? {}),
      ...(row.playerRatingSeeds ?? {}),
    },
  }))
}

export type MatchRecord = {
  id: string
  external_match_id: string | null
  home_team: string | null
  away_team: string | null
  match_date: string | null
  match_time?: string | null
  facility?: string | null
  league_name?: string | null
  flight?: string | null
  usta_section?: string | null
  district_area?: string | null
  source?: string | null
  status?: string | null
  winner_side?: MatchSide | null
  score?: string | null
  match_type?: MatchType | null
  line_number?: string | null
}

export type PlayerRecord = {
  id: string
  name: string
  normalized_name?: string | null
  singles_rating?: number | null
  singles_dynamic_rating?: number | null
  doubles_rating?: number | null
  doubles_dynamic_rating?: number | null
  overall_rating?: number | null
  overall_dynamic_rating?: number | null
}

export type ImportEngineOptions = {
  hasNormalizedPlayerNameColumn?: boolean
  matchPlayersDeleteBeforeInsert?: boolean
  scorecardLinesTable?: string | null
  scorecardReviewTable?: string | null
  persistReviewMetadata?: boolean
  log?: (message: string, meta?: Record<string, unknown>) => void
}

type MatchUpsertPayload = {
  external_match_id: string
  match_date: string
  match_time: string | null
  home_team: string | null
  away_team: string | null
  facility: string | null
  league_name: string | null
  flight: string | null
  usta_section: string | null
  district_area: string | null
  source: string
  status: string
  match_source: 'usta' | 'tiq_team' | 'tiq_individual'
  match_type?: MatchType | null
  winner_side?: MatchSide | null
  score?: string | null
  line_number?: string | null
  dedupe_key?: string | null
}

type MatchPlayerInsertPayload = {
  match_id: string
  player_id: string
  side: MatchSide
  seat: number
}

type PersistedScorecardLinePayload = {
  match_id: string
  external_match_id: string
  line_number: number
  match_type: MatchType
  side_a_player_names: string[]
  side_b_player_names: string[]
  winner_side: MatchSide | null
  score: string | null
}

type PlayerResolution = {
  id: string
  name: string
  wasCreated: boolean
  singlesRating: number | null
  doublesRating: number | null
  overallRating: number | null
  singlesDynamicRating: number | null
  doublesDynamicRating: number | null
  overallDynamicRating: number | null
}

type FeedInsert = {
  event_type: string
  entity_type: 'team' | 'league'
  entity_id: string
  entity_name: string
  subtitle: string | null
  title: string
  body: string | null
}

type ImportedScorecardEventContext = {
  matchId: string
  row: ScorecardImportRow
  rowIndex: number
  linkedPlayerCount: number
  createdPlayerNames: string[]
  status: 'imported' | 'updated'
}

const DEFAULT_SOURCE_SCHEDULE = 'tennislink_schedule'
const DEFAULT_SOURCE_SCORECARD = 'tennislink_scorecard'
const SCHEDULE_UPSERT_CHUNK_SIZE = 100
const DEFAULT_PLAYER_BASELINE = 3.5

function cleanString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
}

function nullableString(value: unknown): string | null {
  const cleaned = cleanString(value)
  return cleaned.length > 0 ? cleaned : null
}

function normalizeName(name: string): string {
  return cleanString(name).toLowerCase()
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const cleaned = cleanString(value)
    const normalized = cleaned.toLowerCase()

    if (!cleaned || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(cleaned)
  }

  return result
}

function normalizeDateInput(value: string): string {
  const cleaned = cleanString(value)
  if (!cleaned) return ''

  const isoDateMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoDateMatch) return `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`

  const parsed = new Date(cleaned)
  if (Number.isNaN(parsed.getTime())) return ''

  const year = parsed.getFullYear()
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0')
  const day = `${parsed.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildLineExternalMatchId(externalMatchId: string, lineNumber: number): string {
  return `${cleanString(externalMatchId)}::line:${lineNumber}`
}

function expectedLinkedPlayerCount(lines: ScorecardLineImportRow[]): number {
  return lines.reduce((sum, line) => sum + (line.matchType === 'singles' ? 2 : 4), 0)
}

function determineWinnerTeam(row: ScorecardImportRow): string | null {
  const winners = new Set<string>()

  for (const line of row.lines) {
    if (line.winnerSide === 'A') winners.add(cleanString(row.homeTeam))
    if (line.winnerSide === 'B') winners.add(cleanString(row.awayTeam))
  }

  if (winners.size !== 1) return null
  return [...winners][0] ?? null
}

function determineLoserTeam(row: ScorecardImportRow): string | null {
  const winner = determineWinnerTeam(row)
  if (!winner) return null
  const home = cleanString(row.homeTeam)
  const away = cleanString(row.awayTeam)
  return winner === home ? away : home
}

function lineOutcomeSummary(lines: ScorecardLineImportRow[]) {
  let sideAWins = 0
  let sideBWins = 0
  let completedLines = 0

  for (const line of lines) {
    if (line.winnerSide === 'A') {
      sideAWins += 1
      completedLines += 1
    } else if (line.winnerSide === 'B') {
      sideBWins += 1
      completedLines += 1
    }
  }

  return { sideAWins, sideBWins, completedLines }
}

function buildParentMatchScore(row: ScorecardImportRow): string | null {
  const officialScore = row.totalTeamScore
  if (officialScore?.home !== null && officialScore?.home !== undefined && officialScore?.away !== null && officialScore?.away !== undefined) {
    return `${officialScore.home}-${officialScore.away}`
  }
  const { sideAWins, sideBWins, completedLines } = lineOutcomeSummary(row.lines)
  if (completedLines === 0) return null
  return `${sideAWins}-${sideBWins}`
}

function parseRatingSeed(...values: Array<string | null | undefined>): number | null {
  for (const value of values) {
    const cleaned = cleanString(value)
    if (!cleaned) continue

    const match = cleaned.match(/(?:^|\b)([1-7](?:\.[05])?)(?:\b|$)/)
    if (!match) continue

    const parsed = Number(match[1])
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

function inferPlayerBaselineFromRow(row: ScorecardImportRow): number {
  return (
    parseRatingSeed(
      nullableString(row.flight),
      nullableString(row.leagueName),
      nullableString(row.ustaSection),
      nullableString(row.districtArea),
      nullableString(row.source),
    ) ?? DEFAULT_PLAYER_BASELINE
  )
}

function nullableRatingValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const cleaned = cleanString(value)
  if (!cleaned) return null

  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

type ScorecardReviewAuditPayload = {
  match_id: string
  external_match_id: string
  review_status: string | null
  needs_review: boolean
  data_conflict: boolean
  conflict_type: string | null
  reviewer_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  raw_capture_json: unknown
  validated_capture_json: unknown
  repair_log: unknown
  capture_engine: unknown
}

function buildParentWinnerSide(row: ScorecardImportRow): MatchSide | null {
  const officialScore = row.totalTeamScore
  if (officialScore?.home !== null && officialScore?.home !== undefined && officialScore?.away !== null && officialScore?.away !== undefined) {
    if (officialScore.home > officialScore.away) return 'A'
    if (officialScore.away > officialScore.home) return 'B'
  }
  const { sideAWins, sideBWins } = lineOutcomeSummary(row.lines)
  if (sideAWins > sideBWins) return 'A'
  if (sideBWins > sideAWins) return 'B'
  return null
}

function validateScheduleRow(row: ScheduleImportRow): string | null {
  if (!cleanString(row.externalMatchId)) return 'Missing externalMatchId'
  if (!normalizeDateInput(row.matchDate)) return 'Missing or invalid matchDate'
  if (!cleanString(row.homeTeam)) return 'Missing homeTeam'
  if (!cleanString(row.awayTeam)) return 'Missing awayTeam'
  return null
}

function validateScorecardRow(row: ScorecardImportRow): string | null {
  if (!cleanString(row.externalMatchId)) return 'Missing externalMatchId'
  if (!normalizeDateInput(row.matchDate)) return 'Missing or invalid matchDate'
  if (!cleanString(row.homeTeam)) return 'Missing homeTeam'
  if (!cleanString(row.awayTeam)) return 'Missing awayTeam'
  if (!Array.isArray(row.lines) || row.lines.length === 0) return 'Missing scorecard lines'

  for (const line of row.lines) {
    if (!line || typeof line !== 'object') return 'Invalid scorecard line'
    if (typeof line.lineNumber !== 'number' || !Number.isFinite(line.lineNumber)) {
      return 'Invalid lineNumber'
    }
    if (line.matchType !== 'singles' && line.matchType !== 'doubles') {
      return 'Invalid matchType'
    }
    if (!Array.isArray(line.sideAPlayers) || !Array.isArray(line.sideBPlayers)) {
      return 'Invalid players array'
    }
    if (
      line.scoreEventType &&
      line.scoreEventType !== 'standard' &&
      line.scoreEventType !== 'third_set_match_tiebreak' &&
      line.scoreEventType !== 'timed_match'
    ) {
      return 'Invalid scoreEventType'
    }
  }

  return null
}

function toScheduleMatchUpsert(row: ScheduleImportRow): MatchUpsertPayload {
  return {
    external_match_id: cleanString(row.externalMatchId),
    match_date: normalizeDateInput(row.matchDate),
    match_time: nullableString(row.matchTime),
    home_team: cleanString(row.homeTeam),
    away_team: cleanString(row.awayTeam),
    facility: nullableString(row.facility),
    league_name: nullableString(row.leagueName),
    flight: nullableString(row.flight),
    usta_section: nullableString(row.ustaSection),
    district_area: nullableString(row.districtArea),
    source: nullableString(row.source) ?? DEFAULT_SOURCE_SCHEDULE,
    status: 'scheduled',
    match_source: 'usta',
    match_type: null,
    winner_side: null,
    score: null,
    line_number: null,
    dedupe_key: null,
  }
}

function toScorecardParentMatchUpsert(row: ScorecardImportRow): MatchUpsertPayload {
  return {
    external_match_id: cleanString(row.externalMatchId),
    match_date: normalizeDateInput(row.matchDate),
    match_time: nullableString(row.matchTime),
    home_team: cleanString(row.homeTeam),
    away_team: cleanString(row.awayTeam),
    facility: nullableString(row.facility),
    league_name: nullableString(row.leagueName),
    flight: nullableString(row.flight),
    usta_section: nullableString(row.ustaSection),
    district_area: nullableString(row.districtArea),
    source: nullableString(row.source) ?? DEFAULT_SOURCE_SCORECARD,
    status: 'completed',
    match_source: 'usta',
    match_type: null,
    winner_side: buildParentWinnerSide(row),
    score: buildParentMatchScore(row),
    line_number: null,
    dedupe_key: null,
  }
}

function toScorecardLineMatchUpsert(row: ScorecardImportRow, line: ScorecardLineImportRow): MatchUpsertPayload {
  return {
    external_match_id: buildLineExternalMatchId(row.externalMatchId, line.lineNumber),
    match_date: normalizeDateInput(row.matchDate),
    match_time: nullableString(row.matchTime),
    home_team: null,
    away_team: null,
    facility: nullableString(row.facility),
    league_name: nullableString(row.leagueName),
    flight: nullableString(row.flight),
    usta_section: nullableString(row.ustaSection),
    district_area: nullableString(row.districtArea),
    source: nullableString(row.source) ?? DEFAULT_SOURCE_SCORECARD,
    status: 'completed',
    match_source: 'usta',
    match_type: line.matchType,
    winner_side: line.winnerSide,
    score: nullableString(line.score ?? line.rawScoreText),
    line_number: String(line.lineNumber),
    dedupe_key: null,
  }
}

function mergeScorecardRowWithExistingMatch(
  row: ScorecardImportRow,
  existingMatch: MatchRecord | null,
): ScorecardImportRow {
  if (!existingMatch) return row

  return {
    ...row,
    homeTeam: cleanString(row.homeTeam) || cleanString(existingMatch.home_team),
    awayTeam: cleanString(row.awayTeam) || cleanString(existingMatch.away_team),
    matchDate: normalizeDateInput(row.matchDate) || normalizeDateInput(existingMatch.match_date ?? ''),
    matchTime: nullableString(row.matchTime) ?? nullableString(existingMatch.match_time),
    facility: nullableString(row.facility) ?? nullableString(existingMatch.facility),
    leagueName: nullableString(row.leagueName) ?? nullableString(existingMatch.league_name),
    flight: nullableString(row.flight) ?? nullableString(existingMatch.flight),
    ustaSection: nullableString(row.ustaSection) ?? nullableString(existingMatch.usta_section),
    districtArea: nullableString(row.districtArea) ?? nullableString(existingMatch.district_area),
    source: nullableString(row.source) ?? nullableString(existingMatch.source) ?? DEFAULT_SOURCE_SCORECARD,
  }
}

function buildLinePlayerNames(line: ScorecardLineImportRow): { side: MatchSide; seat: number; name: string }[] {
  const aPlayers = dedupeStrings(line.sideAPlayers)
  const bPlayers = dedupeStrings(line.sideBPlayers)

  if (line.matchType === 'singles') {
    return [
      ...(aPlayers[0] ? [{ side: 'A' as const, seat: 1, name: aPlayers[0] }] : []),
      ...(bPlayers[0] ? [{ side: 'B' as const, seat: 1, name: bPlayers[0] }] : []),
    ]
  }

  return [
    ...(aPlayers[0] ? [{ side: 'A' as const, seat: 1, name: aPlayers[0] }] : []),
    ...(aPlayers[1] ? [{ side: 'A' as const, seat: 2, name: aPlayers[1] }] : []),
    ...(bPlayers[0] ? [{ side: 'B' as const, seat: 1, name: bPlayers[0] }] : []),
    ...(bPlayers[1] ? [{ side: 'B' as const, seat: 2, name: bPlayers[1] }] : []),
  ]
}

export class ImportEngine {
  private readonly supabase: SupabaseClient
  private readonly options: Required<ImportEngineOptions>

  constructor(supabase: SupabaseClient, options?: ImportEngineOptions) {
    this.supabase = supabase
    this.options = {
      hasNormalizedPlayerNameColumn: options?.hasNormalizedPlayerNameColumn ?? false,
      matchPlayersDeleteBeforeInsert: options?.matchPlayersDeleteBeforeInsert ?? true,
      scorecardLinesTable: options?.scorecardLinesTable ?? null,
      scorecardReviewTable: options?.scorecardReviewTable ?? null,
      persistReviewMetadata: options?.persistReviewMetadata ?? true,
      log: options?.log ?? (() => undefined),
    }
  }

  async importSchedule(
    rows: ScheduleImportRow[],
    mode: ImportMode = 'commit',
  ): Promise<ScheduleImportResult> {
    const result: ScheduleImportResult = {
      mode,
      totalRows: rows.length,
      successCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      rows: [],
      errors: [],
    }

    const validRows: Array<{ rowIndex: number; payload: MatchUpsertPayload }> = []

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]
      const externalMatchId = cleanString(row?.externalMatchId)

      const validationError = validateScheduleRow(row)
      if (validationError) {
        result.failedCount += 1
        result.rows.push({
          rowIndex,
          externalMatchId,
          status: 'failed',
          message: validationError,
        })
        result.errors.push({
          rowIndex,
          externalMatchId,
          code: 'INVALID_ROW',
          message: validationError,
        })
        continue
      }

      const payload = toScheduleMatchUpsert(row)

      if (mode === 'preview') {
        result.successCount += 1
        result.rows.push({
          rowIndex,
          externalMatchId: payload.external_match_id,
          status: 'preview',
          message: 'Validated for schedule import',
        })
        continue
      }

      validRows.push({ rowIndex, payload })
    }

    if (mode === 'preview' || validRows.length === 0) {
      return result
    }

    const existingIds = await this.findExistingMatchIdsByExternalMatchIds(
      validRows.map((entry) => entry.payload.external_match_id),
    )

    for (const chunk of this.chunkArray(validRows, SCHEDULE_UPSERT_CHUNK_SIZE)) {
      const chunkPayloads = chunk.map((entry) => entry.payload)

      try {
        const { data, error } = await this.supabase
          .from('matches')
          .upsert(chunkPayloads, { onConflict: 'external_match_id' })
          .select('id, external_match_id')

        if (error) {
          throw new Error(error.message)
        }

        const upsertedByExternalId = new Map<string, { id: string | null }>()
        for (const row of (data ?? []) as Array<{ id: string | null; external_match_id: string | null }>) {
          if (row.external_match_id) {
            upsertedByExternalId.set(row.external_match_id, { id: row.id })
          }
        }

        for (const entry of chunk) {
          const status = existingIds.has(entry.payload.external_match_id) ? 'updated' : 'imported'
          if (status === 'updated') result.updatedCount += 1
          else result.successCount += 1

          result.rows.push({
            rowIndex: entry.rowIndex,
            externalMatchId: entry.payload.external_match_id,
            status,
            matchId: upsertedByExternalId.get(entry.payload.external_match_id)?.id ?? null,
            message: status === 'updated' ? 'Updated existing scheduled match' : 'Imported scheduled match',
          })
        }
      } catch (error) {
        const chunkMessage = error instanceof Error ? error.message : 'Unknown schedule import error'

        for (const entry of chunk) {
          try {
            const { data: upserted, error: upsertError } = await this.supabase
              .from('matches')
              .upsert(entry.payload, { onConflict: 'external_match_id' })
              .select('id, external_match_id')
              .single()

            if (upsertError) {
              throw new Error(upsertError.message)
            }

            const status = existingIds.has(entry.payload.external_match_id) ? 'updated' : 'imported'
            if (status === 'updated') result.updatedCount += 1
            else result.successCount += 1

            result.rows.push({
              rowIndex: entry.rowIndex,
              externalMatchId: entry.payload.external_match_id,
              status,
              matchId: upserted?.id ?? null,
              message:
                status === 'updated'
                  ? 'Updated existing scheduled match after chunk retry'
                  : 'Imported scheduled match after chunk retry',
            })
          } catch (rowError) {
            const message = rowError instanceof Error ? rowError.message : chunkMessage
            result.failedCount += 1
            result.rows.push({
              rowIndex: entry.rowIndex,
              externalMatchId: entry.payload.external_match_id,
              status: 'failed',
              message,
            })
            result.errors.push({
              rowIndex: entry.rowIndex,
              externalMatchId: entry.payload.external_match_id,
              code: 'MATCH_UPSERT_FAILED',
              message,
            })
          }
        }
      }
    }

    return result
  }

  async importScorecards(
    rows: ScorecardImportRow[],
    mode: ImportMode = 'commit',
  ): Promise<ScorecardImportResult> {
    const result: ScorecardImportResult = {
      mode,
      totalRows: rows.length,
      successCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      createdPlayersCount: 0,
      linkedPlayersCount: 0,
      rows: [],
      errors: [],
    }

    const successfulImports: ImportedScorecardEventContext[] = []

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]
      const externalMatchId = cleanString(row?.externalMatchId)

      try {
        const validationError = validateScorecardRow(row)
        if (validationError) {
          result.failedCount += 1
          result.rows.push({
            rowIndex,
            externalMatchId,
            status: 'failed',
            createdPlayerNames: [],
            linkedPlayerCount: 0,
            message: validationError,
          })
          result.errors.push({
            rowIndex,
            externalMatchId,
            code: 'INVALID_ROW',
            message: validationError,
          })
          continue
        }

        const existingParent = await this.findMatchByExternalMatchId(externalMatchId)
        const hydratedRow = mergeScorecardRowWithExistingMatch(row, existingParent)
        const parentPayload = toScorecardParentMatchUpsert(hydratedRow)
        const linePeople = hydratedRow.lines.flatMap(buildLinePlayerNames)
        const uniquePlayerNames = dedupeStrings(linePeople.map((entry) => entry.name))

        if (mode === 'preview') {
          const completeLines = hydratedRow.lines.filter((line) => Boolean(line.winnerSide)).length
          const previewLinkedCount = hydratedRow.lines
            .filter((line) => Boolean(line.winnerSide))
            .flatMap(buildLinePlayerNames).length

          result.successCount += 1
          result.rows.push({
            rowIndex,
            externalMatchId: parentPayload.external_match_id,
            status: 'preview',
            createdPlayerNames: [],
            linkedPlayerCount: previewLinkedCount,
            message: `Validated scorecard with ${hydratedRow.lines.length} lines (${completeLines} completed for rating import)`,
          })
          continue
        }

        const { data: upsertedParentMatch, error: parentUpsertError } = await this.supabase
          .from('matches')
          .upsert(parentPayload, { onConflict: 'external_match_id' })
          .select('id, external_match_id')
          .single()

        if (parentUpsertError || !upsertedParentMatch?.id) {
          const message = parentUpsertError?.message ?? 'Failed to upsert completed match'
          result.failedCount += 1
          result.rows.push({
            rowIndex,
            externalMatchId: parentPayload.external_match_id,
            status: 'failed',
            createdPlayerNames: [],
            linkedPlayerCount: 0,
            message,
          })
          result.errors.push({
            rowIndex,
            externalMatchId: parentPayload.external_match_id,
            code: 'MATCH_UPSERT_FAILED',
            message,
          })
          continue
        }

        const parentMatchId = upsertedParentMatch.id

        let resolvedPlayers = new Map<string, PlayerResolution>()
        let createdPlayerNames: string[] = []

        try {
          const batch = await this.resolvePlayersBatch(
            uniquePlayerNames,
            inferPlayerBaselineFromRow(hydratedRow),
            hydratedRow.playerRatingSeeds,
          )
          resolvedPlayers = batch.map
          createdPlayerNames = batch.created
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to resolve scorecard players'

          result.failedCount += 1
          result.rows.push({
            rowIndex,
            externalMatchId: parentPayload.external_match_id,
            status: 'failed',
            matchId: parentMatchId,
            createdPlayerNames: [],
            linkedPlayerCount: 0,
            message,
          })
          result.errors.push({
            rowIndex,
            externalMatchId: parentPayload.external_match_id,
            code: 'PLAYER_CREATE_FAILED',
            message,
          })
          continue
        }

        if (resolvedPlayers.size !== uniquePlayerNames.length) {
          result.failedCount += 1
          result.rows.push({
            rowIndex,
            externalMatchId: parentPayload.external_match_id,
            status: 'failed',
            matchId: parentMatchId,
            createdPlayerNames,
            linkedPlayerCount: 0,
            message: 'Player resolution mismatch',
          })
          result.errors.push({
            rowIndex,
            externalMatchId: parentPayload.external_match_id,
            code: 'PLAYER_LOOKUP_FAILED',
            message: 'Player resolution mismatch',
          })
          continue
        }

        await this.deleteExistingScorecardLineMatches(parentPayload.external_match_id)

        let totalLinkedPlayerCount = 0
        let hadLineFailure = false

        for (const line of hydratedRow.lines) {
          if (!line.winnerSide) {
            this.options.log('Skipping incomplete scorecard line', {
              externalMatchId: hydratedRow.externalMatchId,
              lineNumber: line.lineNumber,
            })
            continue
          }

          const linePayload = toScorecardLineMatchUpsert(hydratedRow, line)

          const { data: upsertedLineMatch, error: lineUpsertError } = await this.supabase
            .from('matches')
            .upsert(linePayload, { onConflict: 'external_match_id' })
            .select('id, external_match_id')
            .single()

          if (lineUpsertError || !upsertedLineMatch?.id) {
            const message = lineUpsertError?.message ?? `Failed to upsert scorecard line ${line.lineNumber}`
            result.failedCount += 1
            result.rows.push({
              rowIndex,
              externalMatchId: parentPayload.external_match_id,
              status: 'failed',
              matchId: parentMatchId,
              createdPlayerNames,
              linkedPlayerCount: totalLinkedPlayerCount,
              message,
            })
            result.errors.push({
              rowIndex,
              externalMatchId: linePayload.external_match_id,
              code: 'MATCH_UPSERT_FAILED',
              message,
            })
            hadLineFailure = true
            break
          }

          const lineMatchId = upsertedLineMatch.id
          const linePlayers = buildLinePlayerNames(line)
          const matchPlayersToInsert: MatchPlayerInsertPayload[] = []

          for (const playerEntry of linePlayers) {
            const resolved = resolvedPlayers.get(normalizeName(playerEntry.name))
            if (!resolved) {
              result.failedCount += 1
              result.rows.push({
                rowIndex,
                externalMatchId: parentPayload.external_match_id,
                status: 'failed',
                matchId: parentMatchId,
                createdPlayerNames,
                linkedPlayerCount: totalLinkedPlayerCount,
                message: `Resolved player missing for "${playerEntry.name}"`,
              })
              result.errors.push({
                rowIndex,
                externalMatchId: linePayload.external_match_id,
                code: 'PLAYER_LOOKUP_FAILED',
                message: `Resolved player missing for "${playerEntry.name}"`,
              })
              hadLineFailure = true
              break
            }

            matchPlayersToInsert.push({
              match_id: lineMatchId,
              player_id: resolved.id,
              side: playerEntry.side,
              seat: playerEntry.seat,
            })
          }

          if (hadLineFailure) break

          if (this.options.matchPlayersDeleteBeforeInsert) {
            const { error: deleteError } = await this.supabase
              .from('match_players')
              .delete()
              .eq('match_id', lineMatchId)

            if (deleteError) {
              result.failedCount += 1
              result.rows.push({
                rowIndex,
                externalMatchId: parentPayload.external_match_id,
                status: 'failed',
                matchId: parentMatchId,
                createdPlayerNames,
                linkedPlayerCount: totalLinkedPlayerCount,
                message: deleteError.message,
              })
              result.errors.push({
                rowIndex,
                externalMatchId: linePayload.external_match_id,
                code: 'MATCH_PLAYERS_DELETE_FAILED',
                message: deleteError.message,
              })
              hadLineFailure = true
              break
            }
          }

          if (matchPlayersToInsert.length > 0) {
            const { error: insertPlayersError } = await this.supabase
              .from('match_players')
              .insert(matchPlayersToInsert)

            if (insertPlayersError) {
              result.failedCount += 1
              result.rows.push({
                rowIndex,
                externalMatchId: parentPayload.external_match_id,
                status: 'failed',
                matchId: parentMatchId,
                createdPlayerNames,
                linkedPlayerCount: totalLinkedPlayerCount,
                message: insertPlayersError.message,
              })
              result.errors.push({
                rowIndex,
                externalMatchId: linePayload.external_match_id,
                code: 'MATCH_PLAYERS_INSERT_FAILED',
                message: insertPlayersError.message,
              })
              hadLineFailure = true
              break
            }
          }

          totalLinkedPlayerCount += matchPlayersToInsert.length
        }

        if (hadLineFailure) {
          continue
        }

        const parentMatchPlayers: MatchPlayerInsertPayload[] = []
        const nextSeatBySide: Record<MatchSide, number> = { A: 1, B: 1 }

        for (const line of hydratedRow.lines) {
          if (!line.winnerSide) continue

          const linePlayers = buildLinePlayerNames(line)

          for (const playerEntry of linePlayers) {
            const resolved = resolvedPlayers.get(normalizeName(playerEntry.name))
            if (!resolved) continue

            parentMatchPlayers.push({
              match_id: parentMatchId,
              player_id: resolved.id,
              side: playerEntry.side,
              seat: nextSeatBySide[playerEntry.side]++,
            })
          }
        }

        const uniqueParentPlayers = Array.from(
          new Map(parentMatchPlayers.map((player) => [player.player_id, player])).values(),
        )

        const { error: deleteParentPlayersError } = await this.supabase
          .from('match_players')
          .delete()
          .eq('match_id', parentMatchId)

        if (deleteParentPlayersError) {
          result.failedCount += 1
          result.rows.push({
            rowIndex,
            externalMatchId: parentPayload.external_match_id,
            status: 'failed',
            matchId: parentMatchId,
            createdPlayerNames,
            linkedPlayerCount: totalLinkedPlayerCount,
            message: deleteParentPlayersError.message,
          })
          result.errors.push({
            rowIndex,
            externalMatchId: parentPayload.external_match_id,
            code: 'MATCH_PLAYERS_DELETE_FAILED',
            message: deleteParentPlayersError.message,
          })
          continue
        }

        if (uniqueParentPlayers.length > 0) {
          const { error: insertParentPlayersError } = await this.supabase
            .from('match_players')
            .insert(uniqueParentPlayers)

          if (insertParentPlayersError) {
            result.failedCount += 1
            result.rows.push({
              rowIndex,
              externalMatchId: parentPayload.external_match_id,
              status: 'failed',
              matchId: parentMatchId,
              createdPlayerNames,
              linkedPlayerCount: totalLinkedPlayerCount,
              message: `Failed to insert parent match players: ${insertParentPlayersError.message}`,
            })
            result.errors.push({
              rowIndex,
              externalMatchId: parentPayload.external_match_id,
              code: 'MATCH_PLAYERS_INSERT_FAILED',
              message: `Failed to insert parent match players: ${insertParentPlayersError.message}`,
            })
            continue
          }
        }

        if (this.options.scorecardLinesTable) {
          const scorecardLinesPayload: PersistedScorecardLinePayload[] = hydratedRow.lines.map((line) => ({
            match_id: parentMatchId,
            external_match_id: parentPayload.external_match_id,
            line_number: line.lineNumber,
            match_type: line.matchType,
            side_a_player_names: dedupeStrings(line.sideAPlayers),
            side_b_player_names: dedupeStrings(line.sideBPlayers),
            winner_side: line.winnerSide,
            score: nullableString(line.score),
          }))

          const scorecardLinesTable = this.options.scorecardLinesTable

          const { error: deleteLinesError } = await this.supabase
            .from(scorecardLinesTable)
            .delete()
            .eq('match_id', parentMatchId)

          if (deleteLinesError) {
            result.failedCount += 1
            result.rows.push({
              rowIndex,
              externalMatchId: parentPayload.external_match_id,
              status: 'failed',
              matchId: parentMatchId,
              createdPlayerNames,
              linkedPlayerCount: totalLinkedPlayerCount,
              message: deleteLinesError.message,
            })
            result.errors.push({
              rowIndex,
              externalMatchId: parentPayload.external_match_id,
              code: 'SCORECARD_LINES_UPSERT_FAILED',
              message: deleteLinesError.message,
            })
            continue
          }

          if (scorecardLinesPayload.length > 0) {
            const { error: insertLinesError } = await this.supabase
              .from(scorecardLinesTable)
              .insert(scorecardLinesPayload)

            if (insertLinesError) {
              result.failedCount += 1
              result.rows.push({
                rowIndex,
                externalMatchId: parentPayload.external_match_id,
                status: 'failed',
                matchId: parentMatchId,
                createdPlayerNames,
                linkedPlayerCount: totalLinkedPlayerCount,
                message: insertLinesError.message,
              })
              result.errors.push({
                rowIndex,
                externalMatchId: parentPayload.external_match_id,
                code: 'SCORECARD_LINES_UPSERT_FAILED',
                message: insertLinesError.message,
              })
              continue
            }
          }
        }

        if (this.options.persistReviewMetadata) {
          await this.persistScorecardReviewMetadata(parentMatchId, hydratedRow)
        }

        result.createdPlayersCount += createdPlayerNames.length
        result.linkedPlayersCount += totalLinkedPlayerCount + uniqueParentPlayers.length

        const status = existingParent ? 'updated' : 'imported'
        if (status === 'updated') result.updatedCount += 1
        else result.successCount += 1

        successfulImports.push({
          matchId: parentMatchId,
          row: hydratedRow,
          rowIndex,
          linkedPlayerCount: totalLinkedPlayerCount + uniqueParentPlayers.length,
          createdPlayerNames,
          status,
        })

        result.rows.push({
          rowIndex,
          externalMatchId: parentPayload.external_match_id,
          status,
          matchId: parentMatchId,
          createdPlayerNames,
          linkedPlayerCount: totalLinkedPlayerCount + uniqueParentPlayers.length,
          message:
            status === 'updated'
              ? `Updated completed match, created line-level rated matches, and linked ${totalLinkedPlayerCount} line players plus ${uniqueParentPlayers.length} parent match players`
              : `Imported completed match, created line-level rated matches, and linked ${totalLinkedPlayerCount} line players plus ${uniqueParentPlayers.length} parent match players`,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown scorecard import error'
        result.failedCount += 1
        result.rows.push({
          rowIndex,
          externalMatchId,
          status: 'failed',
          createdPlayerNames: [],
          linkedPlayerCount: 0,
          message,
        })
        result.errors.push({
          rowIndex,
          externalMatchId,
          code: 'UNKNOWN',
          message,
        })
      }
    }

    if (mode === 'commit' && successfulImports.length > 0) {
      await this.writeImportIntelligenceEvents(successfulImports)
    }

    return result
  }

  private async deleteExistingScorecardLineMatches(parentExternalMatchId: string) {
    const pattern = `${cleanString(parentExternalMatchId)}::line:%`

    const { data, error } = await this.supabase
      .from('matches')
      .select('id')
      .like('external_match_id', pattern)

    if (error) {
      this.options.log('deleteExistingScorecardLineMatches lookup failed', {
        parentExternalMatchId,
        error: error.message,
      })
      throw new Error(`Failed to find existing scorecard line matches: ${error.message}`)
    }

    const ids = ((data ?? []) as Array<{ id: string }>).map((row) => row.id).filter(Boolean)
    if (ids.length === 0) return

    const { error: deleteError } = await this.supabase
      .from('matches')
      .delete()
      .in('id', ids)

    if (deleteError) {
      this.options.log('deleteExistingScorecardLineMatches delete failed', {
        parentExternalMatchId,
        error: deleteError.message,
      })
      throw new Error(`Failed to clear existing scorecard line matches: ${deleteError.message}`)
    }
  }

  private buildScorecardReviewAuditPayload(
    matchId: string,
    row: ScorecardImportRow,
  ): ScorecardReviewAuditPayload {
    return {
      match_id: matchId,
      external_match_id: cleanString(row.externalMatchId),
      review_status: nullableString(row.reviewStatus),
      needs_review: Boolean(row.needsReview),
      data_conflict: Boolean(row.dataConflict),
      conflict_type: nullableString(row.conflictType),
      reviewer_note: nullableString(row.reviewer_note),
      reviewed_by: nullableString(row.reviewed_by),
      reviewed_at: nullableString(row.reviewed_at),
      raw_capture_json: row.raw_capture_json ?? null,
      validated_capture_json: row.validated_capture_json ?? null,
      repair_log: row.repair_log ?? [],
      capture_engine: row.captureEngine ?? null,
    }
  }

  private async persistScorecardReviewMetadata(matchId: string, row: ScorecardImportRow) {
    const payload = this.buildScorecardReviewAuditPayload(matchId, row)

    await this.tryPersistReviewMetadataOnMatch(matchId, payload)

    if (this.options.scorecardReviewTable) {
      await this.tryPersistReviewMetadataOnAuditTable(this.options.scorecardReviewTable, payload)
    }
  }

  private async tryPersistReviewMetadataOnMatch(
    matchId: string,
    payload: ScorecardReviewAuditPayload,
  ) {
    try {
      const { error } = await this.supabase
        .from('matches')
        .update({
          review_status: payload.review_status,
          needs_review: payload.needs_review,
          data_conflict: payload.data_conflict,
          conflict_type: payload.conflict_type,
          reviewer_note: payload.reviewer_note,
          reviewed_by: payload.reviewed_by,
          reviewed_at: payload.reviewed_at,
          raw_capture_json: payload.raw_capture_json,
          validated_capture_json: payload.validated_capture_json,
          repair_log: payload.repair_log,
          capture_engine: payload.capture_engine,
        })
        .eq('id', matchId)

      if (error) {
        this.options.log('persistScorecardReviewMetadata match update skipped', {
          matchId,
          error: error.message,
        })
      }
    } catch (error) {
      this.options.log('persistScorecardReviewMetadata match update failed', {
        matchId,
        error: error instanceof Error ? error.message : 'Unknown persistence error',
      })
    }
  }

  private async tryPersistReviewMetadataOnAuditTable(
    tableName: string,
    payload: ScorecardReviewAuditPayload,
  ) {
    try {
      const { error } = await this.supabase
        .from(tableName)
        .upsert(payload, { onConflict: 'external_match_id' })

      if (error) {
        this.options.log('persistScorecardReviewMetadata audit upsert skipped', {
          tableName,
          externalMatchId: payload.external_match_id,
          error: error.message,
        })
      }
    } catch (error) {
      this.options.log('persistScorecardReviewMetadata audit upsert failed', {
        tableName,
        externalMatchId: payload.external_match_id,
        error: error instanceof Error ? error.message : 'Unknown persistence error',
      })
    }
  }

  private async writeImportIntelligenceEvents(contexts: ImportedScorecardEventContext[]) {
    const events: FeedInsert[] = []

    for (const context of contexts) {
      const row = context.row
      const winner = determineWinnerTeam(row)
      const loser = determineLoserTeam(row)
      const leagueName = nullableString(row.leagueName)
      const flight = nullableString(row.flight)
      const ustaSection = nullableString(row.ustaSection)
      const districtArea = nullableString(row.districtArea)
      const lineSummary = lineOutcomeSummary(row.lines)
      const scoreSummary =
        lineSummary.completedLines > 0
          ? `${lineSummary.sideAWins}-${lineSummary.sideBWins} lines`
          : 'Result posted'

      if (winner) {
        events.push({
          event_type: 'match_result',
          entity_type: 'team',
          entity_id: buildTeamEntityId(winner, leagueName, flight),
          entity_name: winner,
          subtitle: [leagueName, flight].filter(Boolean).join(' • ') || null,
          title: `${winner} defeated ${loser ?? 'their opponent'}`,
          body: `${scoreSummary}${row.matchDate ? ` on ${normalizeDateInput(row.matchDate)}` : ''}${row.lines.some((line) => nullableString(line.score)) ? ` • ${row.lines.map((line) => nullableString(line.score)).filter(Boolean).join(' | ')}` : ''}`,
        })
      }

      if (leagueName) {
        events.push({
          event_type: 'league_result_posted',
          entity_type: 'league',
          entity_id: buildLeagueEntityId(leagueName, flight, ustaSection, districtArea),
          entity_name: leagueName,
          subtitle: [flight, ustaSection, districtArea].filter(Boolean).join(' • ') || null,
          title: `New result posted in ${leagueName}`,
          body: `${cleanString(row.homeTeam)} vs ${cleanString(row.awayTeam)} • ${scoreSummary}`,
        })
      }

      const expectedLinks = expectedLinkedPlayerCount(row.lines.filter((line) => Boolean(line.winnerSide)))
      if (context.linkedPlayerCount < expectedLinks) {
        events.push({
          event_type: 'captain_alert_missing_player_links',
          entity_type: 'team',
          entity_id: buildTeamEntityId(cleanString(row.homeTeam), leagueName, flight),
          entity_name: cleanString(row.homeTeam),
          subtitle: [leagueName, flight].filter(Boolean).join(' • ') || null,
          title: 'Captain alert: incomplete player linkage',
          body: `Expected ${expectedLinks} player links but only connected ${context.linkedPlayerCount} for ${cleanString(row.homeTeam)} vs ${cleanString(row.awayTeam)}.`,
        })
      }

      if (winner) {
        const streak = await this.computeTeamStreak(winner, leagueName, flight)
        if (streak >= 3) {
          events.push({
            event_type: 'team_win_streak',
            entity_type: 'team',
            entity_id: buildTeamEntityId(winner, leagueName, flight),
            entity_name: winner,
            subtitle: [leagueName, flight].filter(Boolean).join(' • ') || null,
            title: `${winner} is on a ${streak}-match win streak`,
            body: `${winner} has built real momentum in ${leagueName ?? 'league play'}.`,
          })
        }
      }

      if (loser) {
        const skid = await this.computeTeamSkid(loser, leagueName, flight)
        if (skid >= 3) {
          events.push({
            event_type: 'team_losing_streak',
            entity_type: 'team',
            entity_id: buildTeamEntityId(loser, leagueName, flight),
            entity_name: loser,
            subtitle: [leagueName, flight].filter(Boolean).join(' • ') || null,
            title: `${loser} is on a ${skid}-match skid`,
            body: `${loser} has dropped ${skid} straight in ${leagueName ?? 'league play'}.`,
          })
        }
      }
    }

    const burstCounts = new Map<string, { leagueName: string; flight: string | null; ustaSection: string | null; districtArea: string | null; count: number }>()

    for (const context of contexts) {
      const leagueName = nullableString(context.row.leagueName)
      if (!leagueName) continue

      const flight = nullableString(context.row.flight)
      const ustaSection = nullableString(context.row.ustaSection)
      const districtArea = nullableString(context.row.districtArea)
      const key = buildLeagueEntityId(leagueName, flight, ustaSection, districtArea)
      const current = burstCounts.get(key)

      if (current) {
        current.count += 1
      } else {
        burstCounts.set(key, {
          leagueName,
          flight,
          ustaSection,
          districtArea,
          count: 1,
        })
      }
    }

    for (const [key, burst] of burstCounts.entries()) {
      if (burst.count < 2) continue

      events.push({
        event_type: 'league_result_burst',
        entity_type: 'league',
        entity_id: key,
        entity_name: burst.leagueName,
        subtitle: [burst.flight, burst.ustaSection, burst.districtArea].filter(Boolean).join(' • ') || null,
        title: `${burst.count} new results posted`,
        body: `${burst.count} scorecards were committed in ${burst.leagueName} during this import run.`,
      })
    }

    const deduped = this.dedupeFeedEvents(events)
    if (deduped.length === 0) return

    for (const chunk of this.chunkArray(deduped, 200)) {
      const { error } = await this.supabase.from('my_lab_feed').insert(chunk)
      if (error) {
        this.options.log('writeImportIntelligenceEvents failed', { error: error.message })
        throw new Error(`Failed to insert import intelligence feed events: ${error.message}`)
      }
    }
  }

  private dedupeFeedEvents(events: FeedInsert[]): FeedInsert[] {
    const seen = new Set<string>()
    const result: FeedInsert[] = []

    for (const event of events) {
      const key = [
        event.event_type,
        event.entity_type,
        event.entity_id,
        event.title,
        event.body ?? '',
      ].join('::')

      if (seen.has(key)) continue
      seen.add(key)
      result.push(event)
    }

    return result
  }

  private async computeTeamStreak(teamName: string, leagueName?: string | null, flight?: string | null): Promise<number> {
    const recentMatches = await this.fetchRecentTeamMatches(teamName, leagueName, flight)
    let streak = 0

    for (const match of recentMatches) {
      const result = this.didTeamWin(match, teamName)
      if (result === true) streak += 1
      else break
    }

    return streak
  }

  private async computeTeamSkid(teamName: string, leagueName?: string | null, flight?: string | null): Promise<number> {
    const recentMatches = await this.fetchRecentTeamMatches(teamName, leagueName, flight)
    let streak = 0

    for (const match of recentMatches) {
      const result = this.didTeamWin(match, teamName)
      if (result === false) streak += 1
      else break
    }

    return streak
  }

  private async fetchRecentTeamMatches(teamName: string, leagueName?: string | null, flight?: string | null): Promise<MatchRecord[]> {
    let query = this.supabase
      .from('matches')
      .select('id, external_match_id, home_team, away_team, match_date, league_name, flight, usta_section, district_area, winner_side, score, status, line_number')
      .or(`home_team.eq.${teamName},away_team.eq.${teamName}`)
      .is('line_number', null)
      .order('match_date', { ascending: false })
      .limit(5)

    if (leagueName) {
      query = query.eq('league_name', leagueName)
    }
    if (flight) {
      query = query.eq('flight', flight)
    }

    const { data, error } = await query
    if (error) {
      this.options.log('fetchRecentTeamMatches failed', {
        teamName,
        leagueName,
        flight,
        error: error.message,
      })
      return []
    }

    return ((data ?? []) as MatchRecord[]).filter((match) => match.status === 'completed' || Boolean(match.winner_side))
  }

  private didTeamWin(match: MatchRecord, teamName: string): boolean | null {
    const home = cleanString(match.home_team)
    const away = cleanString(match.away_team)
    const winnerSide = match.winner_side

    if (!winnerSide) return null
    if (home === cleanString(teamName)) return winnerSide === 'A'
    if (away === cleanString(teamName)) return winnerSide === 'B'
    return null
  }

  private async findMatchByExternalMatchId(externalMatchId: string): Promise<MatchRecord | null> {
    const { data, error } = await this.supabase
      .from('matches')
      .select(
        'id, external_match_id, home_team, away_team, match_date, match_time, facility, league_name, flight, usta_section, district_area, source, status, winner_side, score, match_type, line_number',
      )
      .eq('external_match_id', externalMatchId)
      .maybeSingle()

    if (error) {
      this.options.log('findMatchByExternalMatchId failed', {
        externalMatchId,
        error: error.message,
      })
      return null
    }

    return (data as MatchRecord | null) ?? null
  }

  private async findExistingMatchIdsByExternalMatchIds(externalMatchIds: string[]): Promise<Set<string>> {
    const existingIds = new Set<string>()
    const uniqueIds = dedupeStrings(externalMatchIds)

    for (const chunk of this.chunkArray(uniqueIds, 200)) {
      const { data, error } = await this.supabase
        .from('matches')
        .select('external_match_id')
        .in('external_match_id', chunk)

      if (error) {
        this.options.log('findExistingMatchIdsByExternalMatchIds failed', {
          count: chunk.length,
          error: error.message,
        })
        continue
      }

      for (const row of (data ?? []) as Array<{ external_match_id: string | null }>) {
        if (row.external_match_id) existingIds.add(row.external_match_id)
      }
    }

    return existingIds
  }

  private async resolvePlayersBatch(
    names: string[],
    baselineRating = DEFAULT_PLAYER_BASELINE,
    playerRatingSeeds?: Record<string, number>,
  ): Promise<{
    map: Map<string, PlayerResolution>
    created: string[]
  }> {
    const unique = dedupeStrings(names)
    const map = new Map<string, PlayerResolution>()
    const created: string[] = []

    if (unique.length === 0) return { map, created }

    if (this.options.hasNormalizedPlayerNameColumn) {
      const normalizedNames = unique.map(normalizeName)

      const { data, error } = await this.supabase
        .from('players')
        .select('id, name, normalized_name, singles_rating, singles_dynamic_rating, doubles_rating, doubles_dynamic_rating, overall_rating, overall_dynamic_rating')
        .in('normalized_name', normalizedNames)

      if (error) {
        this.options.log('batch normalized player lookup failed', {
          names: unique,
          error: error.message,
        })
      } else {
        for (const row of (data ?? []) as PlayerRecord[]) {
          const key = normalizeName(row.normalized_name || row.name)
          map.set(key, {
            id: row.id,
            name: row.name,
            wasCreated: false,
            singlesRating: nullableRatingValue(row.singles_rating),
            doublesRating: nullableRatingValue(row.doubles_rating),
            overallRating: nullableRatingValue(row.overall_rating),
            singlesDynamicRating: nullableRatingValue(row.singles_dynamic_rating),
            doublesDynamicRating: nullableRatingValue(row.doubles_dynamic_rating),
            overallDynamicRating: nullableRatingValue(row.overall_dynamic_rating),
          })
        }
      }
    }

    const unresolvedNames = unique.filter((name) => !map.has(normalizeName(name)))

    if (unresolvedNames.length > 0) {
      const { data, error } = await this.supabase
        .from('players')
        .select('id, name, singles_rating, singles_dynamic_rating, doubles_rating, doubles_dynamic_rating, overall_rating, overall_dynamic_rating')
        .in('name', unresolvedNames)

      if (error) {
        this.options.log('batch player lookup failed', {
          names: unresolvedNames,
          error: error.message,
        })
      } else {
        for (const row of (data ?? []) as PlayerRecord[]) {
          const key = normalizeName(row.name)
          map.set(key, {
            id: row.id,
            name: row.name,
            wasCreated: false,
            singlesRating: nullableRatingValue(row.singles_rating),
            doublesRating: nullableRatingValue(row.doubles_rating),
            overallRating: nullableRatingValue(row.overall_rating),
            singlesDynamicRating: nullableRatingValue(row.singles_dynamic_rating),
            doublesDynamicRating: nullableRatingValue(row.doubles_dynamic_rating),
            overallDynamicRating: nullableRatingValue(row.overall_dynamic_rating),
          })
        }
      }
    }

    const missing = unique.filter((name) => !map.has(normalizeName(name)))

    if (missing.length > 0) {
      const insertPayload: Record<string, unknown>[] = missing.map((name) => {
        const cleanedName = cleanString(name)
        const normalized = normalizeName(cleanedName)
        const seededRating =
          playerRatingSeeds?.[normalized] ??
          playerRatingSeeds?.[cleanedName] ??
          baselineRating

        const payload: Record<string, unknown> = {
          name: cleanedName,
          singles_rating: seededRating,
          singles_dynamic_rating: seededRating,
          doubles_rating: seededRating,
          doubles_dynamic_rating: seededRating,
          overall_rating: seededRating,
          overall_dynamic_rating: seededRating,
        }

        if (this.options.hasNormalizedPlayerNameColumn) {
          payload.normalized_name = normalized
        }

        return payload
      })

      const { data: inserted, error: insertError } = await this.supabase
        .from('players')
        .insert(insertPayload)
        .select('id, name, singles_rating, singles_dynamic_rating, doubles_rating, doubles_dynamic_rating, overall_rating, overall_dynamic_rating')

      if (insertError) {
        this.options.log('batch player create failed', {
          names: missing,
          error: insertError.message,
        })
        throw new Error(insertError.message)
      }

      for (const row of (inserted ?? []) as PlayerRecord[]) {
        const key = normalizeName(row.name)
        map.set(key, {
          id: row.id,
          name: row.name,
          wasCreated: true,
          singlesRating: nullableRatingValue(row.singles_rating),
          doublesRating: nullableRatingValue(row.doubles_rating),
          overallRating: nullableRatingValue(row.overall_rating),
          singlesDynamicRating: nullableRatingValue(row.singles_dynamic_rating),
          doublesDynamicRating: nullableRatingValue(row.doubles_dynamic_rating),
          overallDynamicRating: nullableRatingValue(row.overall_dynamic_rating),
        })
        created.push(row.name)
      }
    }

    return { map, created }
  }

  private async resolvePlayerByName(name: string): Promise<PlayerResolution | null> {
    const cleanedName = cleanString(name)
    const normalized = normalizeName(cleanedName)

    if (!cleanedName) return null

    if (this.options.hasNormalizedPlayerNameColumn) {
      const { data, error } = await this.supabase
        .from('players')
        .select('id, name, normalized_name')
        .eq('normalized_name', normalized)
        .maybeSingle()

      if (error) {
        this.options.log('player normalized lookup failed', {
          name: cleanedName,
          error: error.message,
        })
      } else if (data?.id) {
        return {
          id: data.id as string,
          name: (data.name as string) ?? cleanedName,
          wasCreated: false,
          singlesRating: null,
          doublesRating: null,
          overallRating: null,
          singlesDynamicRating: null,
          doublesDynamicRating: null,
          overallDynamicRating: null,
        }
      }
    }

    const { data: exactData, error: exactError } = await this.supabase
      .from('players')
      .select('id, name')
      .ilike('name', cleanedName)
      .limit(10)

    if (exactError) {
      this.options.log('player lookup failed', {
        name: cleanedName,
        error: exactError.message,
      })
      return null
    }

    const exactMatch = ((exactData ?? []) as PlayerRecord[]).find(
      (player) => normalizeName(player.name) === normalized,
    )

    if (exactMatch) {
      return {
        id: exactMatch.id,
        name: exactMatch.name,
        wasCreated: false,
        singlesRating: nullableRatingValue(exactMatch.singles_rating),
        doublesRating: nullableRatingValue(exactMatch.doubles_rating),
        overallRating: nullableRatingValue(exactMatch.overall_rating),
        singlesDynamicRating: nullableRatingValue(exactMatch.singles_dynamic_rating),
        doublesDynamicRating: nullableRatingValue(exactMatch.doubles_dynamic_rating),
        overallDynamicRating: nullableRatingValue(exactMatch.overall_dynamic_rating),
      }
    }

    const insertPayload: Record<string, unknown> = {
      name: cleanedName,
    }

    if (this.options.hasNormalizedPlayerNameColumn) {
      insertPayload.normalized_name = normalized
    }

    const { data: created, error: createError } = await this.supabase
      .from('players')
      .insert(insertPayload)
      .select('id, name')
      .single()

    if (createError || !created?.id) {
      this.options.log('player create failed', {
        name: cleanedName,
        error: createError?.message ?? 'Unknown create error',
      })
      return null
    }

    return {
      id: created.id as string,
      name: (created.name as string) ?? cleanedName,
      wasCreated: true,
      singlesRating: null,
      doublesRating: null,
      overallRating: null,
      singlesDynamicRating: null,
      doublesDynamicRating: null,
      overallDynamicRating: null,
    }
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = []

    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size))
    }

    return chunks
  }

  // ---------------------------------------------------------------------------
  // importTeamSummary
  // Writes season-baseline ratings (singles_rating, doubles_rating,
  // overall_rating) from a TeamSummaryImportRow batch.  These are the TRUE
  // starting point for dynamic ratings — they only change once per season when
  // a new team summary is imported.  Dynamic ratings are also seeded to the
  // baseline if they were still at the 3.5 default or have no value yet.
  // ---------------------------------------------------------------------------
  async importTeamSummary(
    rows: TeamSummaryImportRow[],
    mode: ImportMode = 'commit',
  ): Promise<TeamSummaryImportResult> {
    const result: TeamSummaryImportResult = {
      mode,
      totalPlayers: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      players: [],
      errors: [],
    }

    // Collect all valid players (deduplicated by normalised name)
    const playerMap = new Map<string, { name: string; ntrp: number }>()
    for (const row of rows) {
      for (const player of row.players ?? []) {
        const name = cleanString(player.name)
        if (!name) continue
        const ntrp = typeof player.ntrp === 'number' && Number.isFinite(player.ntrp) ? player.ntrp : null
        if (ntrp === null) continue
        const key = normalizeName(name)
        if (!playerMap.has(key)) {
          playerMap.set(key, { name, ntrp })
        }
      }
      // Also pick up any explicit playerRatingSeeds map entries
      for (const [rawName, ntrp] of Object.entries(row.playerRatingSeeds ?? {})) {
        const name = cleanString(rawName)
        if (!name) continue
        if (typeof ntrp !== 'number' || !Number.isFinite(ntrp)) continue
        const key = normalizeName(name)
        if (!playerMap.has(key)) {
          playerMap.set(key, { name, ntrp })
        }
      }
    }

    result.totalPlayers = playerMap.size

    if (mode === 'preview') {
      // Dry-run: look up each player to report what would happen, but write nothing.
      for (const { name, ntrp } of playerMap.values()) {
        try {
          const { data: existing, error: lookupError } = await this.supabase
            .from('players')
            .select('id, name, singles_rating')
            .ilike('name', name)
            .maybeSingle()

          if (lookupError) {
            result.failedCount += 1
            result.players.push({ name, status: 'failed', ntrp, message: lookupError.message })
          } else if (existing) {
            result.updatedCount += 1
            result.players.push({ name, status: 'updated', ntrp, message: `Would update baseline from ${existing.singles_rating ?? 'unset'} → ${ntrp}` })
          } else {
            result.createdCount += 1
            result.players.push({ name, status: 'created', ntrp, message: `Would create new player with baseline ${ntrp}` })
          }
        } catch (err) {
          result.failedCount += 1
          result.players.push({ name, status: 'failed', ntrp, message: err instanceof Error ? err.message : 'Lookup failed' })
        }
      }
      return result
    }

    // Commit mode: look up each player, upsert baseline ratings
    for (const { name, ntrp } of playerMap.values()) {
      try {
        const normalizedKey = normalizeName(name)

        // Try to find existing player
        const { data: existing, error: lookupError } = await this.supabase
          .from('players')
          .select('id, name, singles_rating, doubles_rating, overall_rating, singles_dynamic_rating, doubles_dynamic_rating, overall_dynamic_rating')
          .ilike('name', name)
          .maybeSingle()

        if (lookupError) {
          result.failedCount += 1
          result.players.push({ name, status: 'failed', ntrp, message: lookupError.message })
          result.errors.push({ rowIndex: 0, code: 'PLAYER_LOOKUP_FAILED', message: `${name}: ${lookupError.message}` })
          continue
        }

        const roundedNtrp = Math.round(ntrp * 1000) / 1000

        if (existing) {
          // Only seed dynamic rating if it equals the old baseline (3.5 default)
          // or has no value — don't overwrite in-season progress.
          const oldBaseline = existing.singles_rating ?? DEFAULT_PLAYER_BASELINE
          const singlesWasDefault = (existing.singles_dynamic_rating ?? oldBaseline) === DEFAULT_PLAYER_BASELINE
          const doublesWasDefault = (existing.doubles_dynamic_rating ?? oldBaseline) === DEFAULT_PLAYER_BASELINE
          const overallWasDefault = (existing.overall_dynamic_rating ?? oldBaseline) === DEFAULT_PLAYER_BASELINE

          const update: Record<string, number> = {
            singles_rating: roundedNtrp,
            doubles_rating: roundedNtrp,
            overall_rating: roundedNtrp,
          }
          if (singlesWasDefault) update.singles_dynamic_rating = roundedNtrp
          if (doublesWasDefault) update.doubles_dynamic_rating = roundedNtrp
          if (overallWasDefault) update.overall_dynamic_rating = roundedNtrp

          const { error: updateError } = await this.supabase
            .from('players')
            .update(update)
            .eq('id', existing.id)

          if (updateError) {
            result.failedCount += 1
            result.players.push({ name, status: 'failed', ntrp, message: updateError.message })
            result.errors.push({ rowIndex: 0, code: 'PLAYER_LOOKUP_FAILED', message: `${name}: ${updateError.message}` })
          } else {
            result.updatedCount += 1
            result.players.push({ name, status: 'updated', ntrp })
          }
        } else {
          // Create the player with both baseline and dynamic ratings set
          const { error: insertError } = await this.supabase
            .from('players')
            .insert({
              name,
              normalized_name: normalizedKey,
              singles_rating: roundedNtrp,
              doubles_rating: roundedNtrp,
              overall_rating: roundedNtrp,
              singles_dynamic_rating: roundedNtrp,
              doubles_dynamic_rating: roundedNtrp,
              overall_dynamic_rating: roundedNtrp,
            })

          if (insertError) {
            result.failedCount += 1
            result.players.push({ name, status: 'failed', ntrp, message: insertError.message })
            result.errors.push({ rowIndex: 0, code: 'PLAYER_CREATE_FAILED', message: `${name}: ${insertError.message}` })
          } else {
            result.createdCount += 1
            result.players.push({ name, status: 'created', ntrp })
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        result.failedCount += 1
        result.players.push({ name, status: 'failed', ntrp, message: msg })
        result.errors.push({ rowIndex: 0, code: 'UNKNOWN', message: `${name}: ${msg}` })
      }
    }

    return result
  }
}

export function createImportEngine(
  supabase: SupabaseClient,
  options?: ImportEngineOptions,
): ImportEngine {
  return new ImportEngine(supabase, options)
}
