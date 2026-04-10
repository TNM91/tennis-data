import type { SupabaseClient } from '@supabase/supabase-js'

export type MatchSide = 'A' | 'B'
export type MatchType = 'singles' | 'doubles'
export type ImportMode = 'preview' | 'commit'

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
}

export type ScorecardLineImportRow = {
  lineNumber: number
  matchType: MatchType
  sideAPlayers: string[]
  sideBPlayers: string[]
  winnerSide: MatchSide | null
  score?: string | null
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
}

export type PlayerRecord = {
  id: string
  name: string
  normalized_name?: string | null
}

export type ImportEngineOptions = {
  hasNormalizedPlayerNameColumn?: boolean
  matchPlayersDeleteBeforeInsert?: boolean
  scorecardLinesTable?: string | null
  log?: (message: string, meta?: Record<string, unknown>) => void
}

type MatchUpsertPayload = {
  external_match_id: string
  match_date: string
  match_time: string | null
  home_team: string
  away_team: string
  facility: string | null
  league_name: string | null
  flight: string | null
  usta_section: string | null
  district_area: string | null
  source: string
  status: string
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
}

const DEFAULT_SOURCE_SCHEDULE = 'tennislink_schedule'
const DEFAULT_SOURCE_SCORECARD = 'tennislink_scorecard'

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
  }
}

function toScorecardMatchUpsert(row: ScorecardImportRow): MatchUpsertPayload {
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
  private readonly supabase: SupabaseClient<any, any, any>
  private readonly options: Required<ImportEngineOptions>

  constructor(supabase: SupabaseClient<any, any, any>, options?: ImportEngineOptions) {
    this.supabase = supabase
    this.options = {
      hasNormalizedPlayerNameColumn: options?.hasNormalizedPlayerNameColumn ?? false,
      matchPlayersDeleteBeforeInsert: options?.matchPlayersDeleteBeforeInsert ?? true,
      scorecardLinesTable: options?.scorecardLinesTable ?? null,
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

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]
      const externalMatchId = cleanString(row?.externalMatchId)

      try {
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

        const existing = await this.findMatchByExternalMatchId(payload.external_match_id)

        const { data: upserted, error: upsertError } = await this.supabase
          .from('matches')
          .upsert(payload, { onConflict: 'external_match_id' })
          .select('id, external_match_id')
          .single()

        if (upsertError) {
          result.failedCount += 1
          result.rows.push({
            rowIndex,
            externalMatchId: payload.external_match_id,
            status: 'failed',
            message: upsertError.message,
          })
          result.errors.push({
            rowIndex,
            externalMatchId: payload.external_match_id,
            code: 'MATCH_UPSERT_FAILED',
            message: upsertError.message,
          })
          continue
        }

        const status = existing ? 'updated' : 'imported'
        if (status === 'updated') result.updatedCount += 1
        else result.successCount += 1

        result.rows.push({
          rowIndex,
          externalMatchId: payload.external_match_id,
          status,
          matchId: upserted?.id ?? null,
          message: status === 'updated' ? 'Updated existing scheduled match' : 'Imported scheduled match',
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown schedule import error'
        result.failedCount += 1
        result.rows.push({
          rowIndex,
          externalMatchId,
          status: 'failed',
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

        const matchPayload = toScorecardMatchUpsert(row)

        const linePeople = row.lines.flatMap(buildLinePlayerNames)
        const uniquePlayerNames = dedupeStrings(linePeople.map((entry) => entry.name))

        if (mode === 'preview') {
          result.successCount += 1
          result.rows.push({
            rowIndex,
            externalMatchId: matchPayload.external_match_id,
            status: 'preview',
            createdPlayerNames: [],
            linkedPlayerCount: linePeople.length,
            message: `Validated scorecard with ${row.lines.length} lines`,
          })
          continue
        }

        const existing = await this.findMatchByExternalMatchId(matchPayload.external_match_id)

        const { data: upsertedMatch, error: matchUpsertError } = await this.supabase
          .from('matches')
          .upsert(matchPayload, { onConflict: 'external_match_id' })
          .select('id, external_match_id')
          .single()

        if (matchUpsertError || !upsertedMatch?.id) {
          const message = matchUpsertError?.message ?? 'Failed to upsert completed match'
          result.failedCount += 1
          result.rows.push({
            rowIndex,
            externalMatchId: matchPayload.external_match_id,
            status: 'failed',
            createdPlayerNames: [],
            linkedPlayerCount: 0,
            message,
          })
          result.errors.push({
            rowIndex,
            externalMatchId: matchPayload.external_match_id,
            code: 'MATCH_UPSERT_FAILED',
            message,
          })
          continue
        }

        const matchId = upsertedMatch.id
        const resolvedPlayers = new Map<string, PlayerResolution>()
        const createdPlayerNames: string[] = []

        for (const name of uniquePlayerNames) {
          const resolved = await this.resolvePlayerByName(name)
          if (!resolved) {
            result.failedCount += 1
            result.rows.push({
              rowIndex,
              externalMatchId: matchPayload.external_match_id,
              status: 'failed',
              matchId,
              createdPlayerNames,
              linkedPlayerCount: 0,
              message: `Could not resolve player "${name}"`,
            })
            result.errors.push({
              rowIndex,
              externalMatchId: matchPayload.external_match_id,
              code: 'PLAYER_CREATE_FAILED',
              message: `Could not resolve player "${name}"`,
            })
            continue
          }

          resolvedPlayers.set(normalizeName(name), resolved)
          if (resolved.wasCreated) {
            createdPlayerNames.push(resolved.name)
          }
        }

        if (resolvedPlayers.size !== uniquePlayerNames.length) {
          continue
        }

        const matchPlayersToInsert: MatchPlayerInsertPayload[] = []

        for (const line of row.lines) {
          const linePlayers = buildLinePlayerNames(line)
          for (const playerEntry of linePlayers) {
            const resolved = resolvedPlayers.get(normalizeName(playerEntry.name))
            if (!resolved) {
              result.failedCount += 1
              result.rows.push({
                rowIndex,
                externalMatchId: matchPayload.external_match_id,
                status: 'failed',
                matchId,
                createdPlayerNames,
                linkedPlayerCount: matchPlayersToInsert.length,
                message: `Resolved player missing for "${playerEntry.name}"`,
              })
              result.errors.push({
                rowIndex,
                externalMatchId: matchPayload.external_match_id,
                code: 'PLAYER_LOOKUP_FAILED',
                message: `Resolved player missing for "${playerEntry.name}"`,
              })
              continue
            }

            matchPlayersToInsert.push({
              match_id: matchId,
              player_id: resolved.id,
              side: playerEntry.side,
              seat: playerEntry.seat,
            })
          }
        }

        if (this.options.matchPlayersDeleteBeforeInsert) {
          const { error: deleteError } = await this.supabase.from('match_players').delete().eq('match_id', matchId)

          if (deleteError) {
            result.failedCount += 1
            result.rows.push({
              rowIndex,
              externalMatchId: matchPayload.external_match_id,
              status: 'failed',
              matchId,
              createdPlayerNames,
              linkedPlayerCount: 0,
              message: deleteError.message,
            })
            result.errors.push({
              rowIndex,
              externalMatchId: matchPayload.external_match_id,
              code: 'MATCH_PLAYERS_DELETE_FAILED',
              message: deleteError.message,
            })
            continue
          }
        }

        if (matchPlayersToInsert.length > 0) {
          const { error: insertPlayersError } = await this.supabase.from('match_players').insert(matchPlayersToInsert)

          if (insertPlayersError) {
            result.failedCount += 1
            result.rows.push({
              rowIndex,
              externalMatchId: matchPayload.external_match_id,
              status: 'failed',
              matchId,
              createdPlayerNames,
              linkedPlayerCount: 0,
              message: insertPlayersError.message,
            })
            result.errors.push({
              rowIndex,
              externalMatchId: matchPayload.external_match_id,
              code: 'MATCH_PLAYERS_INSERT_FAILED',
              message: insertPlayersError.message,
            })
            continue
          }
        }

        if (this.options.scorecardLinesTable) {
          const scorecardLinesPayload: PersistedScorecardLinePayload[] = row.lines.map((line) => ({
            match_id: matchId,
            external_match_id: matchPayload.external_match_id,
            line_number: line.lineNumber,
            match_type: line.matchType,
            side_a_player_names: dedupeStrings(line.sideAPlayers),
            side_b_player_names: dedupeStrings(line.sideBPlayers),
            winner_side: line.winnerSide,
            score: nullableString(line.score),
          }))

          const scorecardLinesTable = this.options.scorecardLinesTable

          const { error: deleteLinesError } = await this.supabase.from(scorecardLinesTable).delete().eq('match_id', matchId)

          if (deleteLinesError) {
            result.failedCount += 1
            result.rows.push({
              rowIndex,
              externalMatchId: matchPayload.external_match_id,
              status: 'failed',
              matchId,
              createdPlayerNames,
              linkedPlayerCount: 0,
              message: deleteLinesError.message,
            })
            result.errors.push({
              rowIndex,
              externalMatchId: matchPayload.external_match_id,
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
                externalMatchId: matchPayload.external_match_id,
                status: 'failed',
                matchId,
                createdPlayerNames,
                linkedPlayerCount: 0,
                message: insertLinesError.message,
              })
              result.errors.push({
                rowIndex,
                externalMatchId: matchPayload.external_match_id,
                code: 'SCORECARD_LINES_UPSERT_FAILED',
                message: insertLinesError.message,
              })
              continue
            }
          }
        }

        result.createdPlayersCount += createdPlayerNames.length
        result.linkedPlayersCount += matchPlayersToInsert.length

        const status = existing ? 'updated' : 'imported'
        if (status === 'updated') result.updatedCount += 1
        else result.successCount += 1

        result.rows.push({
          rowIndex,
          externalMatchId: matchPayload.external_match_id,
          status,
          matchId,
          createdPlayerNames,
          linkedPlayerCount: matchPlayersToInsert.length,
          message:
            status === 'updated'
              ? `Updated completed match and linked ${matchPlayersToInsert.length} players`
              : `Imported completed match and linked ${matchPlayersToInsert.length} players`,
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

    return result
  }

  private async findMatchByExternalMatchId(externalMatchId: string): Promise<MatchRecord | null> {
    const { data, error } = await this.supabase
      .from('matches')
      .select(
        'id, external_match_id, home_team, away_team, match_date, match_time, facility, league_name, flight, usta_section, district_area, source, status',
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
    }
  }
}

export function createImportEngine(
  supabase: SupabaseClient<any, any, any>,
  options?: ImportEngineOptions,
): ImportEngine {
  return new ImportEngine(supabase, options)
}