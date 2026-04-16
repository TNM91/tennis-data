import type {
  MatchSide,
  MatchType,
  ScheduleImportRow,
  ScorecardImportRow,
  ScorecardLineImportRow,
  TeamSummaryImportRow,
  TeamSummaryPlayerRow,
  TeamSummaryTeamRow,
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

export type NormalizeTeamSummaryResult = {
  rows: TeamSummaryImportRow[]
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

function normalizeScoreEventType(
  value: unknown,
): 'standard' | 'third_set_match_tiebreak' | 'timed_match' | null {
  const cleaned = cleanString(value).toLowerCase()
  if (cleaned === 'standard') return 'standard'
  if (cleaned === 'third_set_match_tiebreak') return 'third_set_match_tiebreak'
  if (cleaned === 'timed_match') return 'timed_match'
  return null
}

function normalizeWinnerSource(
  value: unknown,
): 'dom_marker' | 'winner_column' | 'set_math' | 'inferred_missing_third_set' | 'unknown' {
  const cleaned = cleanString(value).toLowerCase()
  if (cleaned === 'dom_marker') return 'dom_marker'
  if (cleaned === 'winner_column') return 'winner_column'
  if (cleaned === 'set_math') return 'set_math'
  if (cleaned === 'inferred_missing_third_set') return 'inferred_missing_third_set'
  return 'unknown'
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  const cleaned = cleanString(value).toLowerCase()
  return cleaned === 'true' || cleaned === 'yes' || cleaned === '1'
}

function normalizeConfidence(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(Math.max(0, Math.min(1, value)).toFixed(2))
  }

  const cleaned = cleanString(value)
  if (!cleaned) return undefined
  const numeric = Number(cleaned)
  if (!Number.isFinite(numeric)) return undefined
  return Number(Math.max(0, Math.min(1, numeric)).toFixed(2))
}

function normalizeScorecardSets(value: unknown): Array<{
  homeGames?: number | null
  awayGames?: number | null
  isMatchTiebreak?: boolean
  isTimed?: boolean
}> {
  const normalized: Array<{
    homeGames?: number | null
    awayGames?: number | null
    isMatchTiebreak?: boolean
    isTimed?: boolean
  }> = []

  for (const entry of toArray(value)) {
    if (!isRecord(entry)) continue
    const homeGames = pickFirst(entry, ['homeGames', 'home_games'])
    const awayGames = pickFirst(entry, ['awayGames', 'away_games'])
    normalized.push({
      homeGames: typeof homeGames === 'number' ? homeGames : Number.parseInt(cleanString(homeGames), 10),
      awayGames: typeof awayGames === 'number' ? awayGames : Number.parseInt(cleanString(awayGames), 10),
      isMatchTiebreak: normalizeBoolean(pickFirst(entry, ['isMatchTiebreak', 'is_match_tiebreak'])),
      isTimed: normalizeBoolean(pickFirst(entry, ['isTimed', 'is_timed'])),
    })
  }

  return normalized
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

  if (isRecord(payload.teamSummary)) {
    return [payload.teamSummary]
  }

  if (Array.isArray(payload.matches)) {
    return payload.matches
  }

  if (Array.isArray(payload.rows)) {
    return payload.rows
  }

  // Detect a plain scorecard row (ScorecardImportRow or ReviewedScorecardRow).
  // This handles the case where already-normalised rows are passed back through
  // the pipeline (e.g. from the scorecard review panel commit buttons).
  if (typeof payload.externalMatchId === 'string' && Array.isArray(payload.lines)) {
    return [payload]
  }

  return []
}

function getRootMeta(payload: unknown): UnknownRecord | null {
  if (!isRecord(payload)) return null
  if (isRecord(payload.seasonSchedule)) return payload.seasonSchedule
  if (isRecord(payload.scorecard)) return payload.scorecard
  if (isRecord(payload.teamSummary)) return payload.teamSummary
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
  const explicitOverride = sanitizeLeagueNameCandidate(
    pickFirst(record, ['leagueNameOverride', 'league_name_override', '__leagueNameOverride']),
  )
  if (explicitOverride) return explicitOverride

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

function normalizeTeamToken(value: string): string {
  return cleanString(value)
    .replace(/\(\s*F\s*\)?/gi, ' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeRawTeamValue(value: unknown): string {
  return normalizeTeamToken(cleanString(value))
}

function extractTeamsFromScheduleFields(record: UnknownRecord): { home: string; away: string } {
  const rawHome = normalizeTeamToken(
    cleanString(pickFirst(record, ['homeTeam', 'home_team', 'teamA', 'home'])),
  )
  const rawAway = normalizeTeamToken(
    cleanString(pickFirst(record, ['awayTeam', 'away_team', 'teamB', 'away'])),
  )

  if (rawHome && rawAway) {
    return {
      home: rawHome,
      away: rawAway,
    }
  }

  const combined = normalizeTeamToken(
    cleanString(
      pickFirst(record, [
        'teams',
        'matchup',
        'matchUp',
        'teamMatchup',
        'team_matchup',
        'title',
        'heading',
      ]),
    ),
  )

  if (!combined) {
    return {
      home: rawHome,
      away: rawAway,
    }
  }

  const flagParts = combined
    .split(/\(\s*F\s*\)?/i)
    .map((part) => normalizeTeamToken(part))
    .filter(Boolean)

  if (flagParts.length >= 2) {
    return {
      home: flagParts[0] || rawHome,
      away: flagParts[1] || rawAway,
    }
  }

  const vsMatch = combined.match(/^(.+?)\s+(?:vs\.?|v\.?)\s+(.+)$/i)
  if (vsMatch) {
    return {
      home: normalizeTeamToken(vsMatch[1]),
      away: normalizeTeamToken(vsMatch[2]),
    }
  }

  return {
    home: rawHome,
    away: rawAway,
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
  type: 'schedule' | 'scorecard' | 'team_summary',
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

  if (type === 'scorecard') {
    if (leagueName && externalMatchId) {
      return `tennislink_scorecard | ${leagueName} | match-${externalMatchId}`
    }
    return 'tennislink_scorecard'
  }

  if (leagueName) {
    return `tennislink_team_summary | ${leagueName}`
  }

  return 'tennislink_team_summary'
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
    playerRatingSeeds: extractPlayerRatingSeeds(record),
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
    rawScoreText: nullableString(pickFirst(line, ['rawScoreText', 'raw_score_text'])) ?? score,
    visibleSetScores: toArray(pickFirst(line, ['visibleSetScores', 'visible_set_scores']))
      .map((entry) => cleanString(entry))
      .filter(Boolean),
    explicitWinnerMarker: nullableString(
      pickFirst(line, ['explicitWinnerMarker', 'explicit_winner_marker']),
    ),
    explicitWinnerSide: normalizeWinnerSide(
      pickFirst(line, ['explicitWinnerSide', 'explicit_winner_side', 'markerWinnerSide']),
    ),
    winnerColumnSide: normalizeWinnerSide(
      pickFirst(line, ['winnerColumnSide', 'winner_column_side', 'textWinnerSide']),
    ),
    captureConfidence: normalizeConfidence(
      pickFirst(line, ['captureConfidence', 'capture_confidence']),
    ),
    winnerSource: normalizeWinnerSource(
      pickFirst(line, ['winnerSource', 'winner_source']),
    ),
    scoreEventType:
      normalizeScoreEventType(pickFirst(line, ['scoreEventType', 'score_event_type'])) ?? 'standard',
    timedMatch: normalizeBoolean(pickFirst(line, ['timedMatch', 'timed_match'])),
    hasThirdSetMatchTiebreak: normalizeBoolean(
      pickFirst(line, ['hasThirdSetMatchTiebreak', 'has_third_set_match_tiebreak']),
    ),
    parseNotes: toArray(pickFirst(line, ['parseNotes', 'parse_notes']))
      .map((entry) => cleanString(entry))
      .filter(Boolean),
    isLocked: normalizeBoolean(pickFirst(line, ['isLocked', 'is_locked'])),
    sets: normalizeScorecardSets(pickFirst(line, ['sets', 'setResults', 'set_results'])),
  }
}



function normalizeSeedRatingValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const cleaned = cleanString(value)
  if (!cleaned) return null

  const match = cleaned.match(/(?:^|\b)([1-7](?:\.[05])?)(?:\b|$)/)
  if (!match) return null

  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

function extractPlayerRatingSeedsFromObject(
  value: unknown,
  seeds: Record<string, number>,
): void {
  if (!isRecord(value)) return

  for (const [key, entry] of Object.entries(value)) {
    const playerName = cleanString(key)
    const rating = normalizeSeedRatingValue(entry)

    if (playerName && rating !== null) {
      seeds[playerName] = rating
    }
  }
}

function extractPlayerRatingSeedsFromPlayersArray(
  value: unknown,
  seeds: Record<string, number>,
): void {
  for (const entry of toArray(value)) {
    if (!isRecord(entry)) continue

    const playerName = cleanString(
      pickFirst(entry, ['name', 'playerName', 'player_name', 'fullName', 'full_name']),
    )
    const rating = normalizeSeedRatingValue(
      pickFirst(entry, ['ntrp', 'rating', 'baseRating', 'base_rating', 'level']),
    )

    if (playerName && rating !== null) {
      seeds[playerName] = rating
    }
  }
}

function extractPlayerRatingSeeds(record: UnknownRecord): Record<string, number> | undefined {
  const seeds: Record<string, number> = {}

  extractPlayerRatingSeedsFromObject(
    pickFirst(record, ['playerRatingSeeds', 'player_rating_seeds']),
    seeds,
  )

  extractPlayerRatingSeedsFromObject(
    pickNested(record, [
      ['metadata', 'playerRatingSeeds'],
      ['metadata', 'player_rating_seeds'],
      ['context', 'playerRatingSeeds'],
      ['context', 'player_rating_seeds'],
      ['teamSummary', 'playerRatingSeeds'],
      ['teamSummary', 'player_rating_seeds'],
      ['team_summary', 'playerRatingSeeds'],
      ['team_summary', 'player_rating_seeds'],
    ]),
    seeds,
  )

  extractPlayerRatingSeedsFromPlayersArray(
    pickFirst(record, ['players', 'roster', 'playerRows', 'player_rows']),
    seeds,
  )

  extractPlayerRatingSeedsFromPlayersArray(
    pickNested(record, [
      ['teamSummary', 'players'],
      ['team_summary', 'players'],
      ['metadata', 'players'],
    ]),
    seeds,
  )

  return Object.keys(seeds).length > 0 ? seeds : undefined
}


function normalizeSummaryLookupKey(value: string): string {
  return cleanString(value).replace(/\s*\/\s*/g, '/').toLowerCase()
}

function normalizeTeamSummaryTeam(
  entry: UnknownRecord,
  rowIndex: number,
  teamIndex: number,
  warnings: NormalizationWarning[],
): TeamSummaryTeamRow | null {
  const name = cleanString(
    pickFirst(entry, ['name', 'teamName', 'team_name', 'team', 'displayName', 'display_name']),
  )
  if (!name) {
    warnings.push({ rowIndex, message: `Skipped team summary team ${teamIndex + 1}: missing team name` })
    return null
  }
  return {
    name,
    wins: normalizeSeedRatingValue(pickFirst(entry, ['wins', 'w'])),
    losses: normalizeSeedRatingValue(pickFirst(entry, ['losses', 'l'])),
  }
}

function normalizeTeamSummaryPlayer(
  entry: UnknownRecord,
  rowIndex: number,
  playerIndex: number,
  warnings: NormalizationWarning[],
): TeamSummaryPlayerRow | null {
  const name = cleanString(
    pickFirst(entry, ['name', 'playerName', 'player_name', 'fullName', 'full_name']),
  )
  if (!name) {
    warnings.push({ rowIndex, message: `Skipped team summary player ${playerIndex + 1}: missing player name` })
    return null
  }
  return {
    name,
    ntrp: normalizeSeedRatingValue(
      pickFirst(entry, ['ntrp', 'rating', 'baseRating', 'base_rating', 'level']),
    ),
    teamName: nullableString(pickFirst(entry, ['teamName', 'team_name', 'team'])),
  }
}

function normalizeTeamSummaryRow(
  record: UnknownRecord,
  rowIndex: number,
  warnings: NormalizationWarning[],
): TeamSummaryImportRow | null {
  const teamEntries = toArray(pickFirst(record, ['teams', 'teamStandings', 'team_standings', 'standings']))
  const playerEntries = toArray(pickFirst(record, ['players', 'roster', 'playerRows', 'player_rows']))

  const teams = teamEntries
    .map((entry, teamIndex) => isRecord(entry) ? normalizeTeamSummaryTeam(entry, rowIndex, teamIndex, warnings) : null)
    .filter((entry): entry is TeamSummaryTeamRow => Boolean(entry))

  const players = playerEntries
    .map((entry, playerIndex) => isRecord(entry) ? normalizeTeamSummaryPlayer(entry, rowIndex, playerIndex, warnings) : null)
    .filter((entry): entry is TeamSummaryPlayerRow => Boolean(entry))

  if (teams.length === 0 && players.length === 0) {
    warnings.push({ rowIndex, message: 'Skipped team summary row: no valid teams or players found' })
    return null
  }

  const canonicalTeamMap: Record<string, string> = {}
  for (const team of teams) {
    const key = normalizeSummaryLookupKey(team.name)
    if (key && !canonicalTeamMap[key]) canonicalTeamMap[key] = team.name
  }

  const playerRatingSeeds = extractPlayerRatingSeeds({ ...record, players })

  return {
    leagueName: resolveLeagueName(record),
    flight: normalizeFlight(record),
    ustaSection: normalizeSection(record),
    districtArea: normalizeDistrict(record),
    source: buildUnifiedSource('team_summary', record),
    teams,
    players,
    canonicalTeamMap,
    playerRatingSeeds,
    raw_capture_json: record,
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
    totalTeamScore: isRecord(pickFirst(record, ['totalTeamScore', 'total_team_score']))
      ? {
          home: typeof (pickFirst(record, ['totalTeamScore', 'total_team_score']) as UnknownRecord).home === 'number'
            ? ((pickFirst(record, ['totalTeamScore', 'total_team_score']) as UnknownRecord).home as number)
            : Number.parseInt(cleanString((pickFirst(record, ['totalTeamScore', 'total_team_score']) as UnknownRecord).home), 10) || null,
          away: typeof (pickFirst(record, ['totalTeamScore', 'total_team_score']) as UnknownRecord).away === 'number'
            ? ((pickFirst(record, ['totalTeamScore', 'total_team_score']) as UnknownRecord).away as number)
            : Number.parseInt(cleanString((pickFirst(record, ['totalTeamScore', 'total_team_score']) as UnknownRecord).away), 10) || null,
        }
      : null,
    captureEngine: isRecord(pickFirst(record, ['captureEngine', 'capture_engine']))
      ? {
          version:
            cleanString((pickFirst(record, ['captureEngine', 'capture_engine']) as UnknownRecord).version) ||
            'capture',
          captureQuality:
            normalizeConfidence((pickFirst(record, ['captureEngine', 'capture_engine']) as UnknownRecord).captureQuality) ??
            0,
          diagnostics: toArray((pickFirst(record, ['captureEngine', 'capture_engine']) as UnknownRecord).diagnostics)
            .map((entry) => cleanString(entry))
            .filter(Boolean),
        }
      : null,
    dataConflict: normalizeBoolean(pickFirst(record, ['dataConflict', 'data_conflict'])),
    conflictType: nullableString(pickFirst(record, ['conflictType', 'conflict_type'])),
    needsReview: normalizeBoolean(pickFirst(record, ['needsReview', 'needs_review'])),
    playerRatingSeeds: extractPlayerRatingSeeds(record),
    raw_capture_json: record,
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


export function normalizeCapturedTeamSummaryPayload(payload: unknown): NormalizeTeamSummaryResult {
  const warnings: NormalizationWarning[] = []
  const sourceRows = collectRootRowEntries(payload)

  const rows = sourceRows
    .map((entry, rowIndex) => {
      if (!isRecord(entry.row)) {
        warnings.push({ rowIndex, message: 'Skipped team summary row: invalid object' })
        return null
      }

      const merged = mergeWithRoot(entry.row, entry.rootMeta)
      return normalizeTeamSummaryRow(merged, rowIndex, warnings)
    })
    .filter((row): row is TeamSummaryImportRow => Boolean(row))

  return { rows, warnings }
}
