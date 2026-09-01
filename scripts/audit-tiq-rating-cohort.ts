import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  recalculateDynamicRatings,
  type RatingRecalculationResult,
} from '../lib/recalculateRatings'
import { supabaseUrl } from '../lib/supabase'

type RatingBandAudit = {
  baseline: string
  players: number
  belowBaseline: number
  nearBaseline: number
  buildingAboveBaseline: number
  moveUpSignal: number
  insufficientEvidence: number
}

const MIN_EVIDENCE_MATCHES = 6
const BASELINE_TOLERANCE = 0.06
const MOVE_UP_BUFFER = 0.05
const QUERY_CHUNK_SIZE = 100

function chunk<T>(values: T[], size = QUERY_CHUNK_SIZE) {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size))
  return chunks
}

type EligibleMatch = {
  id: string
  match_type: 'singles' | 'doubles' | null
  source: string | null
  match_source: string | null
  external_match_id: string | null
}

type Participant = {
  match_id: string
  side: 'A' | 'B' | null
}

type StagedMatch = {
  fingerprint: string
  participants: unknown
}

type StagedPlayer = {
  id: string
  source_player_key: string
}

type PlayerIdentity = {
  staged_player_id: string
  canonical_player_id: string | null
  status: string | null
}

type PersistedRating = {
  id: string
  singles_dynamic_rating: number | null
  doubles_dynamic_rating: number | null
  overall_dynamic_rating: number | null
  singles_usta_dynamic_rating: number | null
  doubles_usta_dynamic_rating: number | null
  overall_usta_dynamic_rating: number | null
}

function bandLabel(value: number) {
  return value.toFixed(1)
}

function nextHalfPoint(value: number) {
  return Math.min(7, Math.floor(value * 2 + 1) / 2)
}

export function buildRatingCohortAudit(result: RatingRecalculationResult) {
  const bands = new Map<string, RatingBandAudit>()
  let eligiblePlayers = 0
  let belowBaseline = 0
  let moveUpSignal = 0
  let insufficientEvidence = 0

  for (const player of result.players) {
    const baseline = player.overallBase
    const projected = player.overallDynamic
    const key = bandLabel(baseline)
    const band = bands.get(key) ?? {
      baseline: key,
      players: 0,
      belowBaseline: 0,
      nearBaseline: 0,
      buildingAboveBaseline: 0,
      moveUpSignal: 0,
      insufficientEvidence: 0,
    }

    band.players += 1
    if (player.matchesProcessed < MIN_EVIDENCE_MATCHES) {
      band.insufficientEvidence += 1
      insufficientEvidence += 1
    } else {
      eligiblePlayers += 1
      if (projected < baseline - BASELINE_TOLERANCE) {
        band.belowBaseline += 1
        belowBaseline += 1
      } else if (projected >= nextHalfPoint(baseline) - MOVE_UP_BUFFER) {
        band.moveUpSignal += 1
        moveUpSignal += 1
      } else if (projected > baseline + BASELINE_TOLERANCE) {
        band.buildingAboveBaseline += 1
      } else {
        band.nearBaseline += 1
      }
    }

    bands.set(key, band)
  }

  return {
    calculatedAt: new Date().toISOString(),
    dryRun: result.dryRun,
    playerCount: result.playerCount,
    eligibleMatchCount: result.eligibleMatchCount,
    snapshotCount: result.snapshotCount,
    minimumEvidenceMatches: MIN_EVIDENCE_MATCHES,
    playersWithEnoughEvidence: eligiblePlayers,
    belowBaseline,
    moveUpSignal,
    insufficientEvidence,
    bands: [...bands.values()].sort((a, b) => Number(a.baseline) - Number(b.baseline)),
  }
}

async function verifyPersistedRatings(client: SupabaseClient, result: RatingRecalculationResult) {
  const persistedPlayers: PersistedRating[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from('players')
      .select(`
        id,
        singles_dynamic_rating,
        doubles_dynamic_rating,
        overall_dynamic_rating,
        singles_usta_dynamic_rating,
        doubles_usta_dynamic_rating,
        overall_usta_dynamic_rating
      `)
      .range(offset, offset + 999)
    if (error) throw new Error(`Failed to verify persisted ratings: ${error.message}`)
    const page = (data ?? []) as PersistedRating[]
    persistedPlayers.push(...page)
    if (page.length < 1000) break
  }

  const persistedById = new Map(persistedPlayers.map((player) => [player.id, player]))
  const round = (value: number) => Math.round(value * 1000) / 1000
  let mismatchedPlayers = 0
  for (const player of result.players) {
    const persisted = persistedById.get(player.id)
    if (!persisted ||
      persisted.singles_dynamic_rating !== round(player.singlesDynamic) ||
      persisted.doubles_dynamic_rating !== round(player.doublesDynamic) ||
      persisted.overall_dynamic_rating !== round(player.overallDynamic) ||
      persisted.singles_usta_dynamic_rating !== round(player.singlesUstaDynamic) ||
      persisted.doubles_usta_dynamic_rating !== round(player.doublesUstaDynamic) ||
      persisted.overall_usta_dynamic_rating !== round(player.overallUstaDynamic)) {
      mismatchedPlayers += 1
    }
  }

  return {
    persistedPlayers: persistedById.size,
    matchesCurrentCalculation: mismatchedPlayers === 0,
    mismatchedPlayers,
  }
}

async function getParticipantIntegrity(client: SupabaseClient) {
  const eligibleMatches: EligibleMatch[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from('matches')
      .select('id, match_type, source, match_source, external_match_id')
      .eq('rating_eligible', true)
      .not('match_type', 'is', null)
      .not('winner_side', 'is', null)
      .range(offset, offset + 999)
    if (error) throw new Error(`Failed to fetch eligible matches: ${error.message}`)
    const page = (data ?? []) as EligibleMatch[]
    eligibleMatches.push(...page)
    if (page.length < 1000) break
  }

  const eligibleIds = new Set(eligibleMatches.map((match) => match.id))
  const participantResponses = await Promise.all(chunk(eligibleMatches.map((match) => match.id)).map((values) => client
    .from('match_players')
    .select('match_id, side')
    .in('match_id', values)))
  const participantsError = participantResponses.find((response) => response.error)?.error
  if (participantsError) throw new Error(`Failed to fetch match participants: ${participantsError.message}`)
  const participants = participantResponses.flatMap((response) => response.data ?? [])

  const countsByMatch = new Map<string, { A: number; B: number }>()
  for (const participant of (participants ?? []) as Participant[]) {
    if (!eligibleIds.has(participant.match_id) || (participant.side !== 'A' && participant.side !== 'B')) continue
    const counts = countsByMatch.get(participant.match_id) ?? { A: 0, B: 0 }
    counts[participant.side] += 1
    countsByMatch.set(participant.match_id, counts)
  }

  const result = {
    eligibleMatches: eligibleMatches.length,
    ratingReady: 0,
    incompleteSingles: 0,
    incompleteDoubles: 0,
    invalidMatchType: 0,
    incompleteBySource: {} as Record<string, number>,
  }

  for (const match of eligibleMatches) {
    const counts = countsByMatch.get(match.id) ?? { A: 0, B: 0 }
    if (match.match_type === 'singles') {
      if (counts.A === 1 && counts.B === 1) result.ratingReady += 1
      else {
        result.incompleteSingles += 1
        const source = match.source || match.match_source || 'unknown'
        result.incompleteBySource[source] = (result.incompleteBySource[source] ?? 0) + 1
      }
    } else if (match.match_type === 'doubles') {
      if (counts.A === 2 && counts.B === 2) result.ratingReady += 1
      else {
        result.incompleteDoubles += 1
        const source = match.source || match.match_source || 'unknown'
        result.incompleteBySource[source] = (result.incompleteBySource[source] ?? 0) + 1
      }
    } else {
      result.invalidMatchType += 1
    }
  }

  const incompleteTennisRecordMatches = eligibleMatches.filter((match) => {
    if (match.source !== 'tennisrecord') return false
    const counts = countsByMatch.get(match.id) ?? { A: 0, B: 0 }
    const expectedPerSide = match.match_type === 'singles' ? 1 : 2
    return counts.A !== expectedPerSide || counts.B !== expectedPerSide
  })

  const fingerprints = incompleteTennisRecordMatches
    .map((match) => match.external_match_id?.match(/^tennisrecord:([^:]+)::line:/)?.[1] || '')
    .filter(Boolean)
  const stagedMatchResponses = await Promise.all(chunk(fingerprints).map((values) => client
    .from('tennisrecord_staged_matches')
    .select('fingerprint, participants')
    .in('fingerprint', values)))
  const stagedMatchesError = stagedMatchResponses.find((response) => response.error)?.error
  if (stagedMatchesError) throw new Error(`Failed to fetch staged TennisRecord matches: ${stagedMatchesError.message}`)
  const stagedMatches = stagedMatchResponses.flatMap((response) => response.data ?? [])

  const stagedByFingerprint = new Map(
    ((stagedMatches ?? []) as StagedMatch[]).map((match) => [match.fingerprint, match]),
  )
  const sourceKeys = new Set<string>()
  for (const match of stagedByFingerprint.values()) {
    for (const participant of Array.isArray(match.participants) ? match.participants : []) {
      if (typeof participant === 'object' && participant && 'sourcePlayerKey' in participant) {
        const key = (participant as { sourcePlayerKey?: unknown }).sourcePlayerKey
        if (typeof key === 'string') sourceKeys.add(key)
      }
    }
  }

  const stagedPlayerResponses = await Promise.all(chunk([...sourceKeys]).map((values) => client
    .from('tennisrecord_staged_players')
    .select('id, source_player_key')
    .in('source_player_key', values)))
  const stagedPlayersError = stagedPlayerResponses.find((response) => response.error)?.error
  if (stagedPlayersError) throw new Error(`Failed to fetch staged TennisRecord players: ${stagedPlayersError.message}`)
  const stagedPlayers = stagedPlayerResponses.flatMap((response) => response.data ?? [])

  const stagedPlayerRows = (stagedPlayers ?? []) as StagedPlayer[]
  const identityResponses = await Promise.all(chunk(stagedPlayerRows.map((player) => player.id)).map((values) => client
    .from('tennisrecord_player_identities')
    .select('staged_player_id, canonical_player_id, status')
    .in('staged_player_id', values)))
  const identitiesError = identityResponses.find((response) => response.error)?.error
  if (identitiesError) throw new Error(`Failed to fetch TennisRecord identities: ${identitiesError.message}`)
  const identities = identityResponses.flatMap((response) => response.data ?? [])

  const stagedIdBySourceKey = new Map(stagedPlayerRows.map((player) => [player.source_player_key, player.id]))
  const identityByStagedId = new Map(
    ((identities ?? []) as PlayerIdentity[]).map((identity) => [identity.staged_player_id, identity]),
  )
  const repairCoverage = {
    incompleteTennisRecordMatches: incompleteTennisRecordMatches.length,
    stagedEvidenceFound: 0,
    completeStagedParticipants: 0,
    completeAndResolved: 0,
    needsParserReplay: 0,
    needsIdentityResolution: 0,
  }

  for (const match of incompleteTennisRecordMatches) {
    const fingerprint = match.external_match_id?.match(/^tennisrecord:([^:]+)::line:/)?.[1] || ''
    const staged = stagedByFingerprint.get(fingerprint)
    if (!staged) {
      repairCoverage.needsParserReplay += 1
      continue
    }

    repairCoverage.stagedEvidenceFound += 1
    const rawParticipants = Array.isArray(staged.participants) ? staged.participants : []
    const expectedPerSide = match.match_type === 'singles' ? 1 : 2
    const validParticipants = rawParticipants.filter((participant): participant is { sourcePlayerKey: string; side: 'A' | 'B'; seat: number } => {
      if (typeof participant !== 'object' || !participant) return false
      const value = participant as { sourcePlayerKey?: unknown; side?: unknown; seat?: unknown }
      return typeof value.sourcePlayerKey === 'string' && (value.side === 'A' || value.side === 'B') && typeof value.seat === 'number' && value.seat > 0
    })
    const sideA = validParticipants.filter((participant) => participant.side === 'A').length
    const sideB = validParticipants.filter((participant) => participant.side === 'B').length
    if (sideA !== expectedPerSide || sideB !== expectedPerSide) {
      repairCoverage.needsParserReplay += 1
      continue
    }

    repairCoverage.completeStagedParticipants += 1
    const fullyResolved = validParticipants.every((participant) => {
      const stagedId = stagedIdBySourceKey.get(participant.sourcePlayerKey)
      const identity = stagedId ? identityByStagedId.get(stagedId) : null
      return identity?.status === 'matched' && Boolean(identity.canonical_player_id)
    })
    if (fullyResolved) repairCoverage.completeAndResolved += 1
    else repairCoverage.needsIdentityResolution += 1
  }

  return { ...result, repairCoverage }
}

async function main() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.')
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const originalWarn = console.warn
  console.warn = () => undefined
  let result: RatingRecalculationResult
  try {
    result = await recalculateDynamicRatings(undefined, client, { dryRun: true })
  } finally {
    console.warn = originalWarn
  }

  console.log(JSON.stringify({
    ...buildRatingCohortAudit(result),
    participantIntegrity: await getParticipantIntegrity(client),
    persistenceVerification: await verifyPersistedRatings(client, result),
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
