import type {
  MatchSide,
  MatchType,
  ScheduleImportRow,
  ScorecardImportRow,
  ScorecardLineImportRow,
} from './importEngine'

export type NormalizationWarning = {
  rowIndex: number
  message: string
}

export type NormalizeScheduleResult = {
  rows: ScheduleImportRow[]
  warnings: NormalizationWarning[]
}

export type NormalizeScorecardResult = {
  rows: ScorecardImportRow[]
  warnings: NormalizationWarning[]
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanString(value: unknown): string {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function nullableString(value: unknown): string | null {
  const cleaned = cleanString(value)
  return cleaned.length > 0 ? cleaned : null
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function pickFirst(record: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) return record[key]
  }
  return undefined
}

function normalizeDate(value: unknown): string {
  const cleaned = cleanString(value)
  if (!cleaned) return ''

  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  const parsed = new Date(cleaned)
  if (Number.isNaN(parsed.getTime())) return ''

  const y = parsed.getFullYear()
  const m = `${parsed.getMonth() + 1}`.padStart(2, '0')
  const d = `${parsed.getDate()}`.padStart(2, '0')

  return `${y}-${m}-${d}`
}

function normalizeMatchType(value: unknown): MatchType | null {
  const cleaned = cleanString(value).toLowerCase()
  if (cleaned.includes('single')) return 'singles'
  if (cleaned.includes('double')) return 'doubles'
  return null
}

function normalizeWinnerSide(value: unknown): MatchSide | null {
  const cleaned = cleanString(value).toUpperCase()
  if (cleaned === 'A' || cleaned === 'HOME') return 'A'
  if (cleaned === 'B' || cleaned === 'AWAY') return 'B'
  return null
}

function splitPlayerList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => cleanString(entry)).filter(Boolean)
  }

  const cleaned = cleanString(value)
  if (!cleaned) return []

  return cleaned
    .split(/\s*(?:\/|&|,|\band\b)\s*/i)
    .map((entry) => cleanString(entry))
    .filter(Boolean)
}

function unwrapRootRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!isRecord(payload)) return []

  if (isRecord(payload.seasonSchedule) && Array.isArray(payload.seasonSchedule.matches)) {
    return payload.seasonSchedule.matches
  }

  if (isRecord(payload.scorecard) && Array.isArray(payload.scorecard.lines)) {
    return [payload.scorecard]
  }

  const directCandidates = [
    payload.rows,
    payload.matches,
    payload.schedule,
    payload.scorecards,
    payload.data,
    payload.items,
    payload.records,
    payload.results,
    payload.scheduleRows,
    payload.scorecardRows,
    payload.scheduleData,
  ]

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) return candidate
  }

  const nestedCandidates = [
    payload.payload,
    payload.result,
    payload.response,
    payload.export,
    payload.seasonSchedule,
    payload.scorecard,
  ]

  for (const nested of nestedCandidates) {
    if (!isRecord(nested)) continue

    if (Array.isArray(nested.matches)) return nested.matches
    if (Array.isArray(nested.rows)) return nested.rows
    if (Array.isArray(nested.schedule)) return nested.schedule
    if (Array.isArray(nested.scorecards)) return nested.scorecards
    if (Array.isArray(nested.data)) return nested.data
    if (Array.isArray(nested.items)) return nested.items
    if (Array.isArray(nested.records)) return nested.records
    if (Array.isArray(nested.results)) return nested.results
    if (Array.isArray(nested.scheduleRows)) return nested.scheduleRows
    if (Array.isArray(nested.scorecardRows)) return nested.scorecardRows
    if (Array.isArray(nested.scheduleData)) return nested.scheduleData
  }

  return [payload]
}

function normalizeExternalMatchId(record: UnknownRecord): string {
  const direct = cleanString(
    pickFirst(record, [
      'externalMatchId',
      'external_match_id',
      'matchId',
      'match_id',
      'scorecardKey',
      'scorecard_key',
      'id',
    ]),
  )

  if (direct) return direct

  const nestedMatch = isRecord(record.match) ? record.match : null
  const nestedMeta = isRecord(record.meta) ? record.meta : null

  const nested = cleanString(
    pickFirst((nestedMatch ?? nestedMeta ?? {}) as UnknownRecord, [
      'externalMatchId',
      'external_match_id',
      'matchId',
      'match_id',
      'scorecardKey',
      'scorecard_key',
      'id',
    ]),
  )

  return nested
}

function normalizeLeagueName(record: UnknownRecord): string | null {
  return nullableString(pickFirst(record, ['leagueName', 'league_name', 'league']))
}

function normalizeFlight(record: UnknownRecord): string | null {
  return nullableString(pickFirst(record, ['flight']))
}

function normalizeSection(record: UnknownRecord): string | null {
  return nullableString(pickFirst(record, ['ustaSection', 'usta_section', 'section']))
}

function normalizeDistrict(record: UnknownRecord): string | null {
  return nullableString(
    pickFirst(record, ['districtArea', 'district_area', 'district', 'area']),
  )
}

function normalizeFacility(record: UnknownRecord): string | null {
  return nullableString(pickFirst(record, ['facility', 'site', 'location', 'club']))
}

function normalizeTime(record: UnknownRecord): string | null {
  return nullableString(
    pickFirst(record, ['matchTime', 'match_time', 'scheduleTime', 'schedule_time', 'time']),
  )
}

function normalizeScheduleRow(
  record: UnknownRecord,
  rowIndex: number,
  warnings: NormalizationWarning[],
): ScheduleImportRow | null {
  const externalMatchId = normalizeExternalMatchId(record)
  const matchDate = normalizeDate(
    pickFirst(record, ['matchDate', 'match_date', 'scheduleDate', 'schedule_date', 'date']),
  )
  const homeTeam = cleanString(
    pickFirst(record, ['homeTeam', 'home_team', 'teamA', 'home']),
  )
  const awayTeam = cleanString(
    pickFirst(record, ['awayTeam', 'away_team', 'teamB', 'away']),
  )

  if (!externalMatchId) {
    warnings.push({ rowIndex, message: 'Skipped schedule row: missing external match id' })
    return null
  }

  if (!matchDate) {
    warnings.push({
      rowIndex,
      message: `Skipped schedule row ${externalMatchId}: missing or invalid date`,
    })
    return null
  }

  if (!homeTeam || !awayTeam) {
    warnings.push({
      rowIndex,
      message: `Skipped schedule row ${externalMatchId}: missing home or away team`,
    })
    return null
  }

  return {
    externalMatchId,
    matchDate,
    matchTime: normalizeTime(record),
    homeTeam,
    awayTeam,
    facility: normalizeFacility(record),
    leagueName: normalizeLeagueName(record),
    flight: normalizeFlight(record),
    ustaSection: normalizeSection(record),
    districtArea: normalizeDistrict(record),
    source: 'tennislink_schedule',
  }
}

function normalizeScorecardLine(
  line: UnknownRecord,
  rowIndex: number,
  lineIndex: number,
  externalMatchId: string,
  warnings: NormalizationWarning[],
): ScorecardLineImportRow | null {
  const rawLineNumber = pickFirst(line, ['lineNumber', 'line_number', 'court', 'position'])
  const numericLineNumber =
    typeof rawLineNumber === 'number'
      ? rawLineNumber
      : Number.parseInt(cleanString(rawLineNumber), 10)

  const matchType = normalizeMatchType(
    pickFirst(line, ['matchType', 'match_type', 'type']),
  )

  const sideAPlayers = splitPlayerList(
    pickFirst(line, ['homePlayers', 'sideAPlayers', 'side_a_players', 'playersA', 'teamAPlayers']),
  )

  const sideBPlayers = splitPlayerList(
    pickFirst(line, ['awayPlayers', 'sideBPlayers', 'side_b_players', 'playersB', 'teamBPlayers']),
  )

  const winnerSide = normalizeWinnerSide(
    pickFirst(line, ['winnerSide', 'winner_side', 'winner']),
  )

  const score = nullableString(
    pickFirst(line, ['score', 'setScores', 'set_scores', 'result']),
  )

  if (!Number.isFinite(numericLineNumber)) {
    warnings.push({
      rowIndex,
      message: `Skipped scorecard line ${lineIndex + 1} for ${externalMatchId}: invalid line number`,
    })
    return null
  }

  if (!matchType) {
    warnings.push({
      rowIndex,
      message: `Skipped scorecard line ${numericLineNumber} for ${externalMatchId}: invalid match type`,
    })
    return null
  }

  if (matchType === 'singles') {
    if (sideAPlayers.length === 0 || sideBPlayers.length === 0) {
      warnings.push({
        rowIndex,
        message: `Skipped singles line ${numericLineNumber} for ${externalMatchId}: missing player names`,
      })
      return null
    }
  }

  if (matchType === 'doubles') {
    if (sideAPlayers.length < 2 || sideBPlayers.length < 2) {
      warnings.push({
        rowIndex,
        message: `Skipped doubles line ${numericLineNumber} for ${externalMatchId}: missing player names`,
      })
      return null
    }
  }

  return {
    lineNumber: numericLineNumber,
    matchType,
    sideAPlayers,
    sideBPlayers,
    winnerSide,
    score,
  }
}

function normalizeScorecardRow(
  record: UnknownRecord,
  rowIndex: number,
  warnings: NormalizationWarning[],
): ScorecardImportRow | null {
  const externalMatchId = normalizeExternalMatchId(record)
  const matchDate = normalizeDate(
    pickFirst(record, ['playedDate', 'played_date', 'matchDate', 'match_date', 'date']),
  )
  const homeTeam = cleanString(
    pickFirst(record, ['homeTeam', 'home_team', 'teamA', 'home']),
  )
  const awayTeam = cleanString(
    pickFirst(record, ['awayTeam', 'away_team', 'teamB', 'away']),
  )

  if (!externalMatchId) {
    warnings.push({ rowIndex, message: 'Skipped scorecard row: missing external match id' })
    return null
  }

  if (!matchDate) {
    warnings.push({
      rowIndex,
      message: `Skipped scorecard row ${externalMatchId}: missing or invalid played date`,
    })
    return null
  }

  if (!homeTeam || !awayTeam) {
    warnings.push({
      rowIndex,
      message: `Skipped scorecard row ${externalMatchId}: missing home or away team`,
    })
    return null
  }

  const candidateLines = toArray(
    pickFirst(record, ['lines', 'scorecardLines', 'scorecard_lines', 'matches']),
  )

  const lines = candidateLines
    .map((entry, lineIndex) => {
      if (!isRecord(entry)) {
        warnings.push({
          rowIndex,
          message: `Skipped scorecard line ${lineIndex + 1} for ${externalMatchId}: invalid line object`,
        })
        return null
      }

      return normalizeScorecardLine(entry, rowIndex, lineIndex, externalMatchId, warnings)
    })
    .filter((line): line is ScorecardLineImportRow => Boolean(line))

  if (lines.length === 0) {
    warnings.push({
      rowIndex,
      message: `Skipped scorecard row ${externalMatchId}: no valid lines found`,
    })
    return null
  }

  return {
    externalMatchId,
    matchDate,
    homeTeam,
    awayTeam,
    lines,
    leagueName: normalizeLeagueName(record),
    flight: normalizeFlight(record),
    ustaSection: normalizeSection(record),
    districtArea: normalizeDistrict(record),
    facility: normalizeFacility(record),
    matchTime: normalizeTime(record),
    source: 'tennislink_scorecard',
  }
}

export function normalizeCapturedSchedulePayload(payload: unknown): NormalizeScheduleResult {
  const warnings: NormalizationWarning[] = []
  const sourceRows = unwrapRootRows(payload)

  const rows = sourceRows
    .map((entry, rowIndex) => {
      if (!isRecord(entry)) {
        warnings.push({
          rowIndex,
          message: 'Skipped schedule row: invalid object',
        })
        return null
      }

      return normalizeScheduleRow(entry, rowIndex, warnings)
    })
    .filter((row): row is ScheduleImportRow => Boolean(row))

  return { rows, warnings }
}

export function normalizeCapturedScorecardPayload(payload: unknown): NormalizeScorecardResult {
  const warnings: NormalizationWarning[] = []
  const sourceRows = unwrapRootRows(payload)

  const rows = sourceRows
    .map((entry, rowIndex) => {
      if (!isRecord(entry)) {
        warnings.push({
          rowIndex,
          message: 'Skipped scorecard row: invalid object',
        })
        return null
      }

      return normalizeScorecardRow(entry, rowIndex, warnings)
    })
    .filter((row): row is ScorecardImportRow => Boolean(row))

  return { rows, warnings }
}