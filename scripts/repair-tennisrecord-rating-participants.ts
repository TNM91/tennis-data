import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseUrl } from '../lib/supabase'

type EligibleMatch = {
  id: string
  match_type: 'singles' | 'doubles'
  external_match_id: string | null
  source: string | null
  match_source: string | null
}

type ExistingParticipant = {
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

type RepairRow = {
  matchId: string
  participants: Array<{ match_id: string; player_id: string; side: 'A' | 'B'; seat: number }>
}

type RepairPlan = {
  candidateMatches: number
  incompleteMatches: number
  repairs: RepairRow[]
}

const QUERY_CHUNK_SIZE = 100

function chunk<T>(values: T[], size = QUERY_CHUNK_SIZE) {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size))
  return chunks
}

function tennisRecordFingerprint(externalMatchId: string | null) {
  return externalMatchId?.match(/^tennisrecord:([^:]+)::line:/)?.[1] || null
}

function validStagedParticipants(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((participant): participant is { sourcePlayerKey: string; side: 'A' | 'B'; seat: number } => {
    if (typeof participant !== 'object' || !participant) return false
    const candidate = participant as { sourcePlayerKey?: unknown; side?: unknown; seat?: unknown }
    return typeof candidate.sourcePlayerKey === 'string' &&
      (candidate.side === 'A' || candidate.side === 'B') &&
      typeof candidate.seat === 'number' && candidate.seat > 0
  })
}

async function buildRepairs(client: SupabaseClient): Promise<RepairPlan> {
  const { data: matches, error: matchesError } = await client
    .from('matches')
    .select('id, match_type, external_match_id, source, match_source')
    .eq('rating_eligible', true)
    .in('match_type', ['singles', 'doubles'])
  if (matchesError) throw new Error(`Failed to fetch TennisRecord matches: ${matchesError.message}`)

  const eligibleMatches = ((matches ?? []) as EligibleMatch[])
    .filter((match) => match.source === 'tennisrecord' || match.match_source === 'tennisrecord')
  const participantResponses = await Promise.all(chunk(eligibleMatches.map((match) => match.id)).map((ids) => client
    .from('match_players')
    .select('match_id, side')
    .in('match_id', ids)))
  const participantError = participantResponses.find((response) => response.error)?.error
  if (participantError) throw new Error(`Failed to fetch match participants: ${participantError.message}`)

  const countsByMatch = new Map<string, { A: number; B: number }>()
  for (const participant of participantResponses.flatMap((response) => response.data ?? []) as ExistingParticipant[]) {
    if (participant.side !== 'A' && participant.side !== 'B') continue
    const counts = countsByMatch.get(participant.match_id) ?? { A: 0, B: 0 }
    counts[participant.side] += 1
    countsByMatch.set(participant.match_id, counts)
  }

  const incomplete = eligibleMatches.filter((match) => {
    const expected = match.match_type === 'singles' ? 1 : 2
    const counts = countsByMatch.get(match.id) ?? { A: 0, B: 0 }
    return counts.A !== expected || counts.B !== expected
  })
  const fingerprints = incomplete
    .map((match) => tennisRecordFingerprint(match.external_match_id))
    .filter((fingerprint): fingerprint is string => Boolean(fingerprint))
  if (fingerprints.length !== incomplete.length) throw new Error('Incomplete TennisRecord match is missing its canonical fingerprint.')

  const stagedResponses = await Promise.all(chunk(fingerprints).map((values) => client
    .from('tennisrecord_staged_matches')
    .select('fingerprint, participants')
    .in('fingerprint', values)))
  const stagedError = stagedResponses.find((response) => response.error)?.error
  if (stagedError) throw new Error(`Failed to fetch staged TennisRecord matches: ${stagedError.message}`)
  const stagedByFingerprint = new Map(
    (stagedResponses.flatMap((response) => response.data ?? []) as StagedMatch[])
      .map((match) => [match.fingerprint, match]),
  )

  const sourceKeys = new Set<string>()
  for (const staged of stagedByFingerprint.values()) {
    for (const participant of validStagedParticipants(staged.participants)) sourceKeys.add(participant.sourcePlayerKey)
  }
  const stagedPlayerResponses = await Promise.all(chunk([...sourceKeys]).map((values) => client
    .from('tennisrecord_staged_players')
    .select('id, source_player_key')
    .in('source_player_key', values)))
  const stagedPlayerError = stagedPlayerResponses.find((response) => response.error)?.error
  if (stagedPlayerError) throw new Error(`Failed to fetch staged TennisRecord players: ${stagedPlayerError.message}`)
  const stagedPlayers = stagedPlayerResponses.flatMap((response) => response.data ?? []) as StagedPlayer[]
  const stagedIdBySourceKey = new Map(stagedPlayers.map((player) => [player.source_player_key, player.id]))

  const identityResponses = await Promise.all(chunk(stagedPlayers.map((player) => player.id)).map((values) => client
    .from('tennisrecord_player_identities')
    .select('staged_player_id, canonical_player_id, status')
    .in('staged_player_id', values)))
  const identityError = identityResponses.find((response) => response.error)?.error
  if (identityError) throw new Error(`Failed to fetch TennisRecord identities: ${identityError.message}`)
  const identityByStagedId = new Map(
    (identityResponses.flatMap((response) => response.data ?? []) as PlayerIdentity[])
      .map((identity) => [identity.staged_player_id, identity]),
  )

  const repairs = incomplete.map((match) => {
    const fingerprint = tennisRecordFingerprint(match.external_match_id)
    const staged = fingerprint ? stagedByFingerprint.get(fingerprint) : null
    const rawParticipants = validStagedParticipants(staged?.participants)
    const expectedPerSide = match.match_type === 'singles' ? 1 : 2
    const sideA = rawParticipants.filter((participant) => participant.side === 'A')
    const sideB = rawParticipants.filter((participant) => participant.side === 'B')
    if (sideA.length !== expectedPerSide || sideB.length !== expectedPerSide) {
      throw new Error(`Match ${match.id} does not have complete staged participant evidence.`)
    }

    const participants = rawParticipants.map((participant) => {
      const stagedId = stagedIdBySourceKey.get(participant.sourcePlayerKey)
      const identity = stagedId ? identityByStagedId.get(stagedId) : null
      if (!identity?.canonical_player_id || identity.status !== 'matched') {
        throw new Error(`Match ${match.id} has an unresolved TennisRecord participant.`)
      }
      return {
        match_id: match.id,
        player_id: identity.canonical_player_id,
        side: participant.side,
        seat: participant.seat,
      }
    })

    return { matchId: match.id, participants }
  })

  return {
    candidateMatches: eligibleMatches.length,
    incompleteMatches: incomplete.length,
    repairs,
  }
}

async function main() {
  if (!process.argv.includes('--apply')) {
    throw new Error('This repair is dry by default. Re-run with --apply after reviewing the audit.')
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.')
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const plan = await buildRepairs(client)
  const repairs = plan.repairs
  if (!repairs.length) {
    console.log(JSON.stringify({
      candidateMatches: plan.candidateMatches,
      incompleteMatches: plan.incompleteMatches,
      repairedMatches: 0,
      repairedParticipants: 0,
    }, null, 2))
    return
  }

  const matchIds = repairs.map((repair) => repair.matchId)
  const participantRows = repairs.flatMap((repair) => repair.participants)

  // Keep a match out of the rating pool while its participant links are replaced.
  for (const ids of chunk(matchIds)) {
    const { error } = await client.from('matches').update({ rating_eligible: false }).in('id', ids)
    if (error) throw new Error(`Failed to pause rating eligibility: ${error.message}`)
  }
  for (const ids of chunk(matchIds)) {
    const { error } = await client.from('match_players').delete().in('match_id', ids)
    if (error) throw new Error(`Failed to clear legacy participant links: ${error.message}`)
  }
  for (const rows of chunk(participantRows, 500)) {
    const { error } = await client.from('match_players').insert(rows)
    if (error) throw new Error(`Failed to restore canonical participant links: ${error.message}`)
  }
  for (const ids of chunk(matchIds)) {
    const { error } = await client.from('matches').update({ rating_eligible: true }).in('id', ids)
    if (error) throw new Error(`Failed to restore rating eligibility: ${error.message}`)
  }

  console.log(JSON.stringify({
    repairedMatches: repairs.length,
    repairedParticipants: participantRows.length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
