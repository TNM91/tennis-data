
import { supabase } from '@/lib/supabase'
import { recalculateDynamicRatings } from '@/lib/recalculateRatings'

export type MatchType = 'singles' | 'doubles'
export type MatchSide = 'A' | 'B'

export type PlayerRecord = {
  id: string
  name: string
  location?: string | null
  flight?: string | null
  singles_rating?: number | null
  singles_dynamic_rating?: number | null
  doubles_rating?: number | null
  doubles_dynamic_rating?: number | null
  overall_rating?: number | null
  overall_dynamic_rating?: number | null
}

export type PreparedImportRow = {
  sourceIndex: number
  sideA: string[]
  sideB: string[]
  rawResult: string
  score: string
  winnerSide: MatchSide
  date: string
  matchType: MatchType
  source: string

  /**
   * Locked to accept both strings and numbers from parser outputs.
   * The engine normalizes these to strings before inserting.
   */
  externalMatchId?: string | number | null
  lineNumber?: string | number | null

  /**
   * Optional extra match fields for workflows like scorecard import.
   * These are merged directly into the matches insert payload.
   */
  matchInsertOverrides?: Record<string, unknown>

  /**
   * Optional defaults applied when a missing player must be created.
   */
  createPlayerDefaults?: Partial<PlayerRecord>
}

export type InvalidImportRow = {
  sourceIndex: number
  raw: string
  reason: string
}

export type PreviewRowStatus = 'ready' | 'duplicate_in_file' | 'duplicate_in_db'

export type PreviewRow = {
  sourceIndex: number
  sideA: string[]
  sideB: string[]
  rawResult: string
  score: string
  winnerSide: MatchSide
  date: string
  matchType: MatchType
  status: PreviewRowStatus
  reason: string
  dedupeKey: string
}

export type ImportPreview = {
  preparedRows: PreparedImportRow[]
  previewRows: PreviewRow[]
  invalidRows: InvalidImportRow[]
  missingNames: string[]
  parsedCount: number
  invalidCount: number
  participantRowCount: number
  uniqueMatchCount: number
  duplicateInFileCount: number
  duplicateInDbCount: number
  readyRows: PreparedImportRow[]
}

export type CommitImportResult = {
  parsedCount: number
  participantRowCount: number
  uniqueMatchCount: number
  insertedMatchCount: number
  skippedDuplicateMatchCount: number
  failedRowCount: number
  createdPlayerCount: number
  ratingsRecalculated: boolean
}

export type CreatePlayersOptions = {
  playerDefaults?: Partial<PlayerRecord>
  updateExistingFlightIfMissing?: boolean
}

export type CommitImportOptions = {
  createMissingPlayers?: boolean
  recalculateRatings?: boolean
  failFast?: boolean
}

export type CommitImportWithFailuresResult = CommitImportResult & {
  rowFailures: InvalidImportRow[]
}

type MatchInsertPayload = {
  match_date: string
  match_type: MatchType
  score: string
  winner_side: MatchSide
  line_number: string | null
  source: string
  external_match_id: string | null
  dedupe_key: string
} & Record<string, unknown>

const DEFAULT_STARTING_RATING = 3.5

export async function buildImportPreview(
  preparedRows: PreparedImportRow[],
  invalidRows: InvalidImportRow[] = []
): Promise<ImportPreview> {
  const allNames = [
    ...new Set(preparedRows.flatMap((row) => [...row.sideA, ...row.sideB]).map(normalizeName)),
  ]

  const playerMap = await fetchPlayersByNames(allNames)
  const missingNames = allNames.filter((name) => !playerMap[name.toLowerCase()])

  const fileDuplicateKeys = new Set<string>()
  const fileSeenKeys = new Set<string>()
  const uniqueRowMap = new Map<string, PreparedImportRow>()

  for (const row of preparedRows) {
    const dedupeKey = buildDedupeKey(row)

    if (fileSeenKeys.has(dedupeKey)) {
      fileDuplicateKeys.add(dedupeKey)
    } else {
      fileSeenKeys.add(dedupeKey)
      uniqueRowMap.set(dedupeKey, row)
    }
  }

  const dedupedRows = [...uniqueRowMap.values()]
  const dbDuplicateKeys = await findExistingMatchDedupeKeys(
    dedupedRows.map((row) => buildDedupeKey(row))
  )

  const previewRows: PreviewRow[] = preparedRows.map((row) => {
    const dedupeKey = buildDedupeKey(row)

    let status: PreviewRowStatus = 'ready'
    let reason = 'Will be imported'

    if (fileDuplicateKeys.has(dedupeKey)) {
      status = 'duplicate_in_file'
      reason = 'Duplicate inside this import payload'
    } else if (dbDuplicateKeys.has(dedupeKey)) {
      status = 'duplicate_in_db'
      reason = 'Already exists in database'
    }

    return {
      sourceIndex: row.sourceIndex,
      sideA: row.sideA,
      sideB: row.sideB,
      rawResult: row.rawResult,
      score: row.score,
      winnerSide: row.winnerSide,
      date: row.date,
      matchType: row.matchType,
      status,
      reason,
      dedupeKey,
    }
  })

  const readyRows = dedupedRows.filter((row) => !dbDuplicateKeys.has(buildDedupeKey(row)))

  return {
    preparedRows,
    previewRows,
    invalidRows,
    missingNames,
    parsedCount: preparedRows.length,
    invalidCount: invalidRows.length,
    participantRowCount: preparedRows.reduce(
      (sum, row) => sum + row.sideA.length + row.sideB.length,
      0
    ),
    uniqueMatchCount: dedupedRows.length,
    duplicateInFileCount: previewRows.filter((row) => row.status === 'duplicate_in_file').length,
    duplicateInDbCount: previewRows.filter((row) => row.status === 'duplicate_in_db').length,
    readyRows,
  }
}

export async function commitImportPreview(
  preview: ImportPreview,
  options: CommitImportOptions = {}
): Promise<CommitImportWithFailuresResult> {
  const {
    createMissingPlayers: shouldCreateMissingPlayers = true,
    recalculateRatings = true,
    failFast = false,
  } = options

  const rowFailures: InvalidImportRow[] = []
  const duplicateSkipIds = new Set<number>()

  if (preview.missingNames.length > 0 && !shouldCreateMissingPlayers) {
    throw new Error(`Missing players: ${preview.missingNames.join(', ')}`)
  }

  let createdPlayers: PlayerRecord[] = []
  if (preview.missingNames.length > 0 && shouldCreateMissingPlayers) {
    const groupedDefaults = groupPlayerDefaultsByName(preview.readyRows)

    const namesWithoutSpecificDefaults = preview.missingNames.filter(
      (name) => !groupedDefaults[name.toLowerCase()]
    )
    const namesWithSpecificDefaults = preview.missingNames.filter(
      (name) => !!groupedDefaults[name.toLowerCase()]
    )

    if (namesWithoutSpecificDefaults.length > 0) {
      const created = await createPlayersByNames(namesWithoutSpecificDefaults)
      createdPlayers.push(...created)
    }

    for (const name of namesWithSpecificDefaults) {
      const defaults = groupedDefaults[name.toLowerCase()]
      const created = await createPlayersByNames([name], {
        playerDefaults: defaults,
        updateExistingFlightIfMissing: true,
      })
      createdPlayers.push(...created)
    }
  }

  const allNames = [
    ...new Set(preview.readyRows.flatMap((row) => [...row.sideA, ...row.sideB]).map(normalizeName)),
  ]
  const playerMap = await fetchPlayersByNames(allNames)

  let insertedMatchCount = 0

  for (const row of preview.readyRows) {
    try {
      const dedupeKey = buildDedupeKey(row)

      const sideAPlayerIds = row.sideA.map((name) => {
        const player = playerMap[normalizeName(name).toLowerCase()]
        if (!player) throw new Error(`Missing player after create/fetch: ${name}`)
        return player.id
      })

      const sideBPlayerIds = row.sideB.map((name) => {
        const player = playerMap[normalizeName(name).toLowerCase()]
        if (!player) throw new Error(`Missing player after create/fetch: ${name}`)
        return player.id
      })

      const insertPayload: MatchInsertPayload = {
        match_date: normalizeDate(row.date),
        match_type: row.matchType,
        score: normalizeResult(row.score),
        winner_side: row.winnerSide,
        line_number: normalizeOptionalStringLike(row.lineNumber),
        source: normalizeSource(row.source, 'import'),
        external_match_id: normalizeOptionalStringLike(row.externalMatchId),
        dedupe_key: dedupeKey,
        ...(row.matchInsertOverrides || {}),
      }

      const { data: insertedMatch, error: matchError } = await supabase
        .from('matches')
        .insert(insertPayload)
        .select('id')
        .single()

      if (matchError) {
        const alreadyExists =
          matchError.code === '23505' ||
          matchError.message.toLowerCase().includes('duplicate') ||
          matchError.message.toLowerCase().includes('unique')

        if (alreadyExists) {
          duplicateSkipIds.add(row.sourceIndex)
          continue
        }

        throw new Error(matchError.message)
      }

      const participantRows = [
        ...sideAPlayerIds.map((playerId, index) => ({
          match_id: insertedMatch.id,
          player_id: playerId,
          side: 'A' as const,
          seat: index + 1,
        })),
        ...sideBPlayerIds.map((playerId, index) => ({
          match_id: insertedMatch.id,
          player_id: playerId,
          side: 'B' as const,
          seat: index + 1,
        })),
      ]

      const { error: participantsError } = await supabase
        .from('match_players')
        .insert(participantRows)

      if (participantsError) {
        await supabase.from('matches').delete().eq('id', insertedMatch.id)
        throw new Error(participantsError.message)
      }

      insertedMatchCount += 1
    } catch (error) {
      const rowFailure: InvalidImportRow = {
        sourceIndex: row.sourceIndex,
        raw: row.rawResult,
        reason: error instanceof Error ? error.message : 'Import failed for row',
      }

      rowFailures.push(rowFailure)

      if (failFast) {
        throw new Error(`${rowFailure.reason} (row ${rowFailure.sourceIndex})`)
      }
    }
  }

  let ratingsRecalculated = false

  if (insertedMatchCount > 0 && recalculateRatings) {
    try {
      await recalculateDynamicRatings()
      ratingsRecalculated = true
    } catch (error) {
      console.error('Rating recalculation failed:', error)
      ratingsRecalculated = false
    }
  }

  return {
    parsedCount: preview.parsedCount,
    participantRowCount: preview.participantRowCount,
    uniqueMatchCount: preview.uniqueMatchCount,
    insertedMatchCount,
    skippedDuplicateMatchCount: duplicateSkipIds.size,
    failedRowCount: rowFailures.length,
    createdPlayerCount: createdPlayers.length,
    ratingsRecalculated,
    rowFailures,
  }
}

export function formatImportSummary(result: CommitImportWithFailuresResult) {
  const parts = [
    `Imported ${result.insertedMatchCount} matches.`,
    `Skipped ${result.skippedDuplicateMatchCount} duplicates.`,
    `Failed ${result.failedRowCount} rows.`,
    `Created ${result.createdPlayerCount} players.`,
  ]

  if (result.insertedMatchCount > 0) {
    parts.push(
      result.ratingsRecalculated
        ? 'Ratings recalculated.'
        : 'Matches imported, but ratings were not recalculated.'
    )
  }

  return parts.join(' ')
}

export async function fetchPlayersByNames(
  names: string[]
): Promise<Record<string, PlayerRecord>> {
  const playerMap: Record<string, PlayerRecord> = {}
  const uniqueNames = [...new Set(names.map(normalizeName).filter(Boolean))]

  for (const chunk of chunkArray(uniqueNames, 500)) {
    const { data, error } = await supabase
      .from('players')
      .select(`
        id,
        name,
        location,
        flight,
        singles_rating,
        singles_dynamic_rating,
        doubles_rating,
        doubles_dynamic_rating,
        overall_rating,
        overall_dynamic_rating
      `)
      .in('name', chunk)

    if (error) {
      throw new Error(error.message)
    }

    for (const player of (data || []) as PlayerRecord[]) {
      playerMap[normalizeName(player.name).toLowerCase()] = player
    }
  }

  return playerMap
}

export async function createPlayersByNames(
  names: string[],
  options: CreatePlayersOptions = {}
): Promise<PlayerRecord[]> {
  const { playerDefaults = {}, updateExistingFlightIfMissing = false } = options
  const uniqueNames = [...new Set(names.map(normalizeName).filter(Boolean))]

  if (uniqueNames.length === 0) return []

  const alreadyExisting = await fetchPlayersByNames(uniqueNames)
  const missingNames = uniqueNames.filter((name) => !alreadyExisting[name.toLowerCase()])

  if (
    updateExistingFlightIfMissing &&
    typeof playerDefaults.flight === 'string' &&
    playerDefaults.flight.trim()
  ) {
    const desiredFlight = playerDefaults.flight.trim()

    for (const existingName of uniqueNames.filter((name) => alreadyExisting[name.toLowerCase()])) {
      const existing = alreadyExisting[existingName.toLowerCase()]
      if (existing && !existing.flight) {
        await supabase
          .from('players')
          .update({ flight: desiredFlight })
          .eq('id', existing.id)
      }
    }
  }

  if (missingNames.length === 0) return []

  const payload = missingNames.map((name) => ({
    name,
    location: playerDefaults.location ?? null,
    flight: playerDefaults.flight ?? null,
    singles_rating: playerDefaults.singles_rating ?? DEFAULT_STARTING_RATING,
    singles_dynamic_rating:
      playerDefaults.singles_dynamic_rating ?? DEFAULT_STARTING_RATING,
    doubles_rating: playerDefaults.doubles_rating ?? DEFAULT_STARTING_RATING,
    doubles_dynamic_rating:
      playerDefaults.doubles_dynamic_rating ?? DEFAULT_STARTING_RATING,
    overall_rating: playerDefaults.overall_rating ?? DEFAULT_STARTING_RATING,
    overall_dynamic_rating:
      playerDefaults.overall_dynamic_rating ?? DEFAULT_STARTING_RATING,
  }))

  const { data, error } = await supabase
    .from('players')
    .insert(payload)
    .select(`
      id,
      name,
      location,
      flight,
      singles_rating,
      singles_dynamic_rating,
      doubles_rating,
      doubles_dynamic_rating,
      overall_rating,
      overall_dynamic_rating
    `)

  if (error) {
    const alreadyExists =
      error.code === '23505' ||
      error.message.toLowerCase().includes('duplicate') ||
      error.message.toLowerCase().includes('unique')

    if (!alreadyExists) {
      throw new Error(error.message)
    }

    const reloaded = await fetchPlayersByNames(uniqueNames)
    return missingNames
      .map((name) => reloaded[name.toLowerCase()])
      .filter((player): player is PlayerRecord => !!player)
  }

  return (data || []) as PlayerRecord[]
}

export async function findExistingMatchDedupeKeys(keys: string[]): Promise<Set<string>> {
  const existingKeys = new Set<string>()
  const uniqueKeys = [...new Set(keys.filter(Boolean))]

  for (const chunk of chunkArray(uniqueKeys, 200)) {
    const { data, error } = await supabase
      .from('matches')
      .select('dedupe_key')
      .in('dedupe_key', chunk)

    if (error) {
      throw new Error(error.message)
    }

    for (const row of data || []) {
      if (row?.dedupe_key) {
        existingKeys.add(row.dedupe_key)
      }
    }
  }

  return existingKeys
}

export function validatePreparedImportRow(row: PreparedImportRow) {
  if (!row.date.trim()) {
    throw new Error('Match date is required.')
  }

  normalizeDate(row.date)

  if (!normalizeResult(row.score)) {
    throw new Error('Score is required.')
  }

  if (row.matchType === 'singles') {
    if (row.sideA.length !== 1 || row.sideB.length !== 1) {
      throw new Error('Singles requires exactly 1 player on each side.')
    }
  }

  if (row.matchType === 'doubles') {
    if (row.sideA.length !== 2 || row.sideB.length !== 2) {
      throw new Error('Doubles requires exactly 2 players on each side.')
    }
  }

  const allNames = [...row.sideA, ...row.sideB].map(normalizeName)

  if (allNames.some((name) => !name)) {
    throw new Error('All player names are required.')
  }

  const duplicates = findDuplicateNames(allNames)
  if (duplicates.length > 0) {
    throw new Error(`A player appears more than once in the same match: ${duplicates.join(', ')}`)
  }
}

export function buildDedupeKey(row: {
  date: string
  matchType: MatchType
  score: string
  winnerSide: MatchSide
  sideA: string[]
  sideB: string[]
}) {
  const winningTeam =
    row.winnerSide === 'A'
      ? normalizeTeamForKey(row.sideA)
      : normalizeTeamForKey(row.sideB)

  const losingTeam =
    row.winnerSide === 'A'
      ? normalizeTeamForKey(row.sideB)
      : normalizeTeamForKey(row.sideA)

  return [
    normalizeDate(row.date),
    row.matchType,
    normalizeScoreForKey(row.score),
    winningTeam,
    losingTeam,
  ].join('|')
}

export function determineMatchType(
  rawMatchType: string,
  sideA: string[],
  sideB: string[]
): MatchType {
  const normalized = rawMatchType.trim().toLowerCase()

  if (normalized) {
    if (normalized !== 'singles' && normalized !== 'doubles') {
      throw new Error('match_type must be singles or doubles')
    }
    return normalized as MatchType
  }

  if (sideA.length === 1 && sideB.length === 1) return 'singles'
  if (sideA.length === 2 && sideB.length === 2) return 'doubles'

  throw new Error('Could not infer match type. Add singles or doubles explicitly.')
}

export function parsePrefixedResult(
  result: string
): { winnerSide: MatchSide; score: string } | null {
  const trimmed = normalizeResult(result)

  if (!trimmed) return null

  if (/^W\b/i.test(trimmed)) {
    const score = trimmed.replace(/^W\b/i, '').trim()
    return score ? { winnerSide: 'A', score } : null
  }

  if (/^L\b/i.test(trimmed)) {
    const score = trimmed.replace(/^L\b/i, '').trim()
    return score ? { winnerSide: 'B', score } : null
  }

  return null
}

export function normalizeWinnerSide(value: string): MatchSide | null {
  const normalized = value.trim().toUpperCase()
  if (normalized === 'A') return 'A'
  if (normalized === 'B') return 'B'
  return null
}

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export function normalizeResult(result: string) {
  return result.trim().replace(/\s+/g, ' ')
}

export function normalizeNullableText(value: string | null | undefined) {
  const normalized = (value ?? '').trim()
  return normalized ? normalized : null
}

export function normalizeOptionalStringLike(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized ? normalized : null
}

export function normalizeSource(value: string, fallback = 'manual') {
  const normalized = value.trim()
  return normalized || fallback
}

export function normalizeDate(date: string) {
  const value = date.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${date}`)
  }

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function splitSide(value: string) {
  return value
    .split('/')
    .map((name) => normalizeName(name))
    .filter(Boolean)
}

export function findDuplicateNames(names: string[]) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const name of names) {
    const key = normalizeName(name).toLowerCase()

    if (seen.has(key)) {
      duplicates.add(name)
    } else {
      seen.add(key)
    }
  }

  return [...duplicates]
}

export function normalizeTeamForKey(names: string[]) {
  return [...names]
    .map((name) => normalizeName(name).toLowerCase())
    .sort()
    .join('+')
}

export function normalizeScoreForKey(score: string) {
  return normalizeResult(score).toLowerCase()
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function groupPlayerDefaultsByName(rows: PreparedImportRow[]) {
  const grouped: Record<string, Partial<PlayerRecord>> = {}

  for (const row of rows) {
    const defaults = row.createPlayerDefaults
    if (!defaults) continue

    for (const name of [...row.sideA, ...row.sideB]) {
      const key = normalizeName(name).toLowerCase()
      grouped[key] = {
        ...(grouped[key] || {}),
        ...defaults,
      }
    }
  }

  return grouped
}
