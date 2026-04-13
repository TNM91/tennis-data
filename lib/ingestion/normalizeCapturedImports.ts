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

function pickNested(record: UnknownRecord, pathGroups: string[][]): unknown {
  for (const path of pathGroups) {
    let current: unknown = record
    let valid = true

    for (const key of path) {
      if (!isRecord(current) || !(key in current)) {
        valid = false
        break
      }
      current = current[key]
    }

    if (valid) return current
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
    return value
      .map((entry) => cleanString(entry))
      .filter((entry) => Boolean(entry) && entry.toLowerCase() !== 'timed match')
  }

  const cleaned = cleanString(value)
  if (!cleaned) return []

  return cleaned
    .split(/\s*(?:\/|&|,|\band\b)\s*/i)
    .map((entry) => cleanString(entry))
    .filter((entry) => Boolean(entry) && entry.toLowerCase() !== 'timed match')
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

  if (Array.isArray(payload.matches)) {
    return payload.matches
  }

  if (Array.isArray(payload.rows)) {
    return payload.rows
  }

  return []
}

function getRootMeta(payload: unknown): UnknownRecord | null {
  if (!isRecord(payload)) return null
  if (isRecord(payload.seasonSchedule)) return payload.seasonSchedule
  if (isRecord(payload.scorecard)) return payload.scorecard
  return payload
}

function mergeWithRoot(record: UnknownRecord, root: UnknownRecord | null): UnknownRecord {
  if (!root) return record
  return {
    ...root,
    ...record,
  }
}

type RootRowEntry = {
  row: unknown
  rootMeta: UnknownRecord | null
}

function collectRootRowEntries(payload: unknown): RootRowEntry[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => collectRootRowEntries(entry))
  }

  const sourceRows = unwrapRootRows(payload)
  const rootMeta = getRootMeta(payload)

  return sourceRows.map((row) => ({
    row,
    rootMeta,
  }))
}

function normalizeExternalMatchId(record: UnknownRecord): string {
  return cleanString(
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
}

function normalizeLeagueName(record: UnknownRecord): string | null {
  const direct = nullableString(
    pickFirst(record, ['leagueName', 'league_name', 'league']),
  )
  if (direct) return direct

  const nested = nullableString(
    pickNested(record, [
      ['league', 'name'],
      ['league', 'leagueName'],
      ['league', 'league_name'],
      ['metadata', 'leagueName'],
      ['metadata', 'league_name'],
      ['metadata', 'league'],
      ['context', 'leagueName'],
      ['context', 'league_name'],
      ['context', 'league'],
    ]),
  )
  if (nested) return nested

  const districtFallback = nullableString(
    pickFirst(record, ['districtArea', 'district_area', 'district', 'area']),
  )

  const sectionFallback = nullableString(
    pickFirst(record, ['ustaSection', 'usta_section', 'section']),
  )

  const flightFallback = nullableString(pickFirst(record, ['flight']))

  if (districtFallback) return districtFallback
  if (sectionFallback && flightFallback) return `${sectionFallback} • ${flightFallback}`
  if (sectionFallback) return sectionFallback
  if (flightFallback) return `USTA ${flightFallback}`

  return null
}

function looksLikeLeagueName(value: string): boolean {
  const lower = cleanString(value).toLowerCase()
  if (!lower) return false

  return (
    lower.includes('adult') ||
    lower.includes('mixed') ||
    lower.includes('tri-level') ||
    lower.includes('combo') ||
    lower.includes('league') ||
    lower.includes('over') ||
    lower.includes('daytime') ||
    lower.includes('singles')
  )
}

function sanitizeLeagueNameCandidate(value: unknown): string | null {
  const cleaned = cleanString(value)
  if (!cleaned) return null

  const seasonMatch = cleaned.match(/\b\d{4}\s+.*?\b(Spring|Summer|Fall|Winter)\b/i)
  if (seasonMatch) {
    return seasonMatch[0].trim()
  }

  const stripped = cleaned
    .replace(/\b(season schedule|schedule|scorecard|match details|match detail|team roster)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return stripped || null
}

function collectSeasonLikeStrings(value: unknown, depth = 0, results: string[] = []): string[] {
  if (depth > 3) return results

  if (typeof value === 'string') {
    const candidate = sanitizeLeagueNameCandidate(value)
    if (candidate && looksLikeLeagueName(candidate)) {
      results.push(candidate)
    }
    return results
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectSeasonLikeStrings(entry, depth + 1, results)
    }
    return results
  }

  if (isRecord(value)) {
    for (const entry of Object.values(value)) {
      collectSeasonLikeStrings(entry, depth + 1, results)
    }
  }

  return results
}

function resolveLeagueName(record: UnknownRecord): string | null {
  const districtValue = nullableString(
    pickFirst(record, ['districtArea', 'district_area', 'district', 'area']),
  )

  const directCandidate = sanitizeLeagueNameCandidate(
    pickFirst(record, [
      'leagueName',
      'league_name',
      'leagueTitle',
      'league_title',
      'divisionName',
      'division_name',
      'seasonName',
      'season_name',
      'competitionName',
      'competition_name',
      'eventName',
      'event_name',
      'pageTitle',
      'page_title',
      'title',
      'headerTitle',
      'header_title',
      'heading',
    ]),
  )
  if (directCandidate && directCandidate !== districtValue) return directCandidate

  const nestedCandidate = sanitizeLeagueNameCandidate(
    pickNested(record, [
      ['league', 'name'],
      ['league', 'leagueName'],
      ['league', 'league_name'],
      ['league', 'title'],
      ['metadata', 'title'],
      ['metadata', 'pageTitle'],
      ['metadata', 'leagueName'],
      ['metadata', 'league_name'],
      ['metadata', 'divisionName'],
      ['metadata', 'seasonName'],
      ['metadata', 'eventName'],
      ['metadata', 'league'],
      ['context', 'title'],
      ['context', 'pageTitle'],
      ['context', 'leagueName'],
      ['context', 'league_name'],
      ['context', 'divisionName'],
      ['context', 'seasonName'],
      ['context', 'eventName'],
      ['context', 'league'],
    ]),
  )
  if (nestedCandidate && nestedCandidate !== districtValue) return nestedCandidate

  const original = normalizeLeagueName(record)
  if (original && original !== districtValue) return original

  const titleFallback = sanitizeLeagueNameCandidate(
    pickFirst(record, ['pageTitle', 'page_title', 'title', 'headerTitle', 'header_title', 'heading']),
  )
  if (titleFallback && titleFallback !== districtValue && looksLikeLeagueName(titleFallback)) {
    return titleFallback
  }

  const sectionFallback = nullableString(
    pickFirst(record, ['ustaSection', 'usta_section', 'section']),
  )
  const flightFallback = nullableString(pickFirst(record, ['flight']))
  if (sectionFallback && flightFallback) {
    const combined = `${sectionFallback} ${flightFallback}`
    if (looksLikeLeagueName(combined)) return combined
  }

  const discoveredCandidates = collectSeasonLikeStrings(record)
  const firstDistinctCandidate = discoveredCandidates.find((candidate) => candidate !== districtValue)
  if (firstDistinctCandidate) return firstDistinctCandidate

  return null
}

function normalizeFlight(record: UnknownRecord): string | null {
  const direct = nullableString(pickFirst(record, ['flight']))
  if (direct) return direct

  const nested = nullableString(
    pickNested(record, [
      ['league', 'flight'],
      ['metadata', 'flight'],
      ['context', 'flight'],
    ]),
  )
  if (nested) return nested

  return null
}

function normalizeSection(record: UnknownRecord): string | null {
  const direct = nullableString(
    pickFirst(record, ['ustaSection', 'usta_section', 'section']),
  )
  if (direct) return direct

  const nested = nullableString(
    pickNested(record, [
      ['league', 'section'],
      ['league', 'ustaSection'],
      ['league', 'usta_section'],
      ['metadata', 'section'],
      ['metadata', 'ustaSection'],
      ['metadata', 'usta_section'],
      ['context', 'section'],
      ['context', 'ustaSection'],
      ['context', 'usta_section'],
    ]),
  )
  if (nested) return nested

  return null
}

function normalizeDistrict(record: UnknownRecord): string | null {
  const direct = nullableString(
    pickFirst(record, ['districtArea', 'district_area', 'district', 'area']),
  )
  if (direct) return direct

  const nested = nullableString(
    pickNested(record, [
      ['league', 'district'],
      ['league', 'area'],
      ['league', 'districtArea'],
      ['league', 'district_area'],
      ['metadata', 'district'],
      ['metadata', 'area'],
      ['metadata', 'districtArea'],
      ['metadata', 'district_area'],
      ['context', 'district'],
      ['context', 'area'],
      ['context', 'districtArea'],
      ['context', 'district_area'],
    ]),
  )
  if (nested) return nested

  return null
}

function normalizeFacility(record: UnknownRecord): string | null {
  const direct = nullableString(pickFirst(record, ['facility', 'site', 'location', 'club']))
  if (direct) return direct

  const nested = nullableString(
    pickNested(record, [
      ['venue', 'name'],
      ['venue', 'facility'],
      ['facilityInfo', 'name'],
      ['metadata', 'facility'],
      ['metadata', 'site'],
      ['context', 'facility'],
      ['context', 'site'],
    ]),
  )
  if (nested) return nested

  return null
}

function normalizeTime(record: UnknownRecord): string | null {
  const direct = nullableString(
    pickFirst(record, ['matchTime', 'match_time', 'scheduleTime', 'schedule_time', 'time']),
  )
  if (direct) return direct

  const nested = nullableString(
    pickNested(record, [
      ['metadata', 'matchTime'],
      ['metadata', 'match_time'],
      ['metadata', 'scheduleTime'],
      ['metadata', 'schedule_time'],
      ['context', 'matchTime'],
      ['context', 'match_time'],
      ['context', 'time'],
    ]),
  )
  if (nested) return nested

  return null
}

function splitFlagDelimitedTeamParts(value: string): string[] {
  return value
    .split(/\(\s*F\s*\)?/i)
    .map((part) => cleanString(part))
    .filter(Boolean)
}

function normalizeRawTeamValue(value: unknown): string {
  return cleanString(value).replace(/\(\s*F\s*\)?/gi, ' ').replace(/\s+/g, ' ').trim()
}

function extractTeamsFromScheduleFields(record: UnknownRecord): { home: string; away: string } {
  const rawHome = cleanString(pickFirst(record, ['homeTeam', 'home_team', 'teamA', 'home']))
  const rawAway = cleanString(pickFirst(record, ['awayTeam', 'away_team', 'teamB', 'away']))

  const homeParts = splitFlagDelimitedTeamParts(rawHome)
  const awayParts = splitFlagDelimitedTeamParts(rawAway)

  const simpleHome = normalizeRawTeamValue(rawHome)
  const simpleAway = normalizeRawTeamValue(rawAway)

  if (simpleHome && simpleAway && homeParts.length <= 1 && awayParts.length <= 1) {
    return {
      home: simpleHome,
      away: simpleAway,
    }
  }

  if (homeParts.length >= 2 && awayParts.length === 0) {
    return {
      home: homeParts[0] || '',
      away: homeParts[1] || '',
    }
  }

  if (homeParts.length === 1 && awayParts.length === 1) {
    return {
      home: homeParts[0] || '',
      away: awayParts[0] || '',
    }
  }

  if (homeParts.length === 1 && awayParts.length >= 2) {
    return {
      home: `${homeParts[0]} ${awayParts[0]}`.trim(),
      away: awayParts[1] || '',
    }
  }

  return {
    home: simpleHome,
    away: simpleAway,
  }
}

function normalizeHomeTeam(record: UnknownRecord): string {
  const extracted = extractTeamsFromScheduleFields(record)
  return cleanString(extracted.home)
}

function normalizeAwayTeam(record: UnknownRecord): string {
  const extracted = extractTeamsFromScheduleFields(record)
  return cleanString(extracted.away)
}

function buildScoreFromSets(value: unknown): string | null {
  const sets = toArray(value)
  if (sets.length === 0) return null

  const formatted = sets
    .map((entry) => {
      if (!isRecord(entry)) return ''
      const homeGames = cleanString(pickFirst(entry, ['homeGames', 'home_games']))
      const awayGames = cleanString(pickFirst(entry, ['awayGames', 'away_games']))
      if (!homeGames || !awayGames) return ''
      return `${homeGames}-${awayGames}`
    })
    .filter(Boolean)

  return formatted.length > 0 ? formatted.join(' ') : null
}

function buildUnifiedSource(
  type: 'schedule' | 'scorecard',
  record: UnknownRecord,
): string {
  const directSource = nullableString(pickFirst(record, ['source']))
  if (directSource) return directSource

  const leagueName = resolveLeagueName(record)
  const externalMatchId = normalizeExternalMatchId(record)

  if (type === 'schedule') {
    if (leagueName && externalMatchId) {
      return `tennislink_schedule | ${leagueName} | match-${externalMatchId}`
    }
    return 'tennislink_schedule'
  }

  if (leagueName && externalMatchId) {
    return `tennislink_scorecard | ${leagueName} | match-${externalMatchId}`
  }

  return 'tennislink_scorecard'
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
  const homeTeam = normalizeHomeTeam(record)
  const awayTeam = normalizeAwayTeam(record)

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

  const leagueName = resolveLeagueName(record)
  if (!leagueName) {
    warnings.push({
      rowIndex,
      message: `Schedule row ${externalMatchId} is missing a visible league name. This match will import, but it will not appear as a league card until league mapping is corrected.`,
    })
  }

  return {
    externalMatchId,
    matchDate,
    matchTime: normalizeTime(record),
    homeTeam,
    awayTeam,
    facility: normalizeFacility(record),
    leagueName,
    flight: normalizeFlight(record),
    ustaSection: normalizeSection(record),
    districtArea: normalizeDistrict(record),
    source: buildUnifiedSource('schedule', record),
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

  const matchType = normalizeMatchType(pickFirst(line, ['matchType', 'match_type', 'type']))

  const sideAPlayers = splitPlayerList(
    pickFirst(line, ['homePlayers', 'sideAPlayers', 'side_a_players', 'playersA']),
  )

  const sideBPlayers = splitPlayerList(
    pickFirst(line, ['awayPlayers', 'sideBPlayers', 'side_b_players', 'playersB']),
  )

  const winnerSide = normalizeWinnerSide(pickFirst(line, ['winnerSide', 'winner_side', 'winner']))

  const score =
    nullableString(pickFirst(line, ['score', 'setScores', 'set_scores', 'result'])) ??
    buildScoreFromSets(pickFirst(line, ['sets', 'setResults', 'set_results']))

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
    pickFirst(record, [
      'dateMatchPlayed',
      'date_match_played',
      'playedDate',
      'played_date',
      'matchDate',
      'match_date',
      'date',
    ]),
  )
  const homeTeam = normalizeHomeTeam(record)
  const awayTeam = normalizeAwayTeam(record)

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

  const candidateLines = toArray(pickFirst(record, ['lines', 'scorecardLines', 'scorecard_lines']))

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

  const leagueName = resolveLeagueName(record)
  if (!leagueName) {
    warnings.push({
      rowIndex,
      message: `Scorecard row ${externalMatchId} is missing a visible league name. This result will import, but it will not appear under league views until league mapping is corrected.`,
    })
  }

  return {
    externalMatchId,
    matchDate,
    homeTeam,
    awayTeam,
    lines,
    leagueName,
    flight: normalizeFlight(record),
    ustaSection: normalizeSection(record),
    districtArea: normalizeDistrict(record),
    facility: normalizeFacility(record),
    matchTime: normalizeTime(record),
    source: buildUnifiedSource('scorecard', record),
  }
}

export function normalizeCapturedSchedulePayload(payload: unknown): NormalizeScheduleResult {
  const warnings: NormalizationWarning[] = []
  const sourceRows = collectRootRowEntries(payload)

  const rows = sourceRows
    .map((entry, rowIndex) => {
      if (!isRecord(entry.row)) {
        warnings.push({
          rowIndex,
          message: 'Skipped schedule row: invalid object',
        })
        return null
      }

      const merged = mergeWithRoot(entry.row, entry.rootMeta)
      return normalizeScheduleRow(merged, rowIndex, warnings)
    })
    .filter((row): row is ScheduleImportRow => Boolean(row))

  return { rows, warnings }
}

export function normalizeCapturedScorecardPayload(payload: unknown): NormalizeScorecardResult {
  const warnings: NormalizationWarning[] = []
  const sourceRows = collectRootRowEntries(payload)

  const rows = sourceRows
    .map((entry, rowIndex) => {
      if (!isRecord(entry.row)) {
        warnings.push({
          rowIndex,
          message: 'Skipped scorecard row: invalid object',
        })
        return null
      }

      const merged = mergeWithRoot(entry.row, entry.rootMeta)
      return normalizeScorecardRow(merged, rowIndex, warnings)
    })
    .filter((row): row is ScorecardImportRow => Boolean(row))

  return { rows, warnings }
}
