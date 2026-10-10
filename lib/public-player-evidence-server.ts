import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './supabase-public-config'
import {
  buildPublicPlayerEvidence, hasDiscoverablePlayerEvidence, isPublicPlayerId,
  type PublicMatchRow, type PublicParticipantRow, type PublicPlayerIdentity,
} from './public-player-evidence'

export const PUBLIC_PLAYER_REVALIDATE_SECONDS = 86400
const MATCH_SCAN_LIMIT = 96
const DISCOVERY_LIMIT = 12
const MATCH_FIELDS = 'id, match_date, match_type, score, winner_side, public_history_eligible, league_name'

// Always anonymous: no session cookies, service-role key, private fields, or paid insights.
export function createPublicEvidenceClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        cache: 'force-cache',
        next: { revalidate: PUBLIC_PLAYER_REVALIDATE_SECONDS },
        signal: init?.signal || AbortSignal.timeout(8000),
      }),
    },
  })
}

async function loadEvidence(playerIds?: string[]) {
  const client = createPublicEvidenceClient()
  const today = new Date().toISOString().slice(0, 10)
  let matches: PublicMatchRow[]
  if (playerIds) {
    // Start from the indexed player references. Filtering the global match feed
    // by an embedded player caused measured database statement timeouts.
    const { data, error } = await client.from('match_players')
      .select(`match_id, matches!inner(${MATCH_FIELDS})`)
      .in('player_id', playerIds)
      .eq('matches.public_history_eligible', true)
      .in('matches.match_type', ['singles', 'doubles'])
      .not('matches.score', 'is', null)
      .in('matches.winner_side', ['A', 'B'])
      .lte('matches.match_date', today)
      .order('matches(match_date)', { ascending: false })
      .order('match_id', { ascending: false })
      .limit(MATCH_SCAN_LIMIT)
    if (error) throw new Error('Public match evidence is unavailable', { cause: error })
    const refs = (data || []) as unknown as Array<{ matches: PublicMatchRow | PublicMatchRow[] | null }>
    matches = refs.flatMap((row) => Array.isArray(row.matches) ? row.matches : row.matches ? [row.matches] : [])
  } else {
    const { data, error } = await client.from('matches')
      .select(MATCH_FIELDS)
      .eq('public_history_eligible', true)
      .in('match_type', ['singles', 'doubles'])
      .not('score', 'is', null)
      .in('winner_side', ['A', 'B'])
      .lte('match_date', today)
      .order('match_date', { ascending: false })
      .order('id', { ascending: false })
      .limit(MATCH_SCAN_LIMIT)
    if (error) throw new Error('Public match evidence is unavailable', { cause: error })
    matches = (data || []) as unknown as PublicMatchRow[]
  }
  if (matches.length === 0) return []
  const participants = await client.from('match_players')
    .select('match_id, player_id, side, players(id, name, location)')
    .in('match_id', [...new Set(matches.map(({ id }) => id))])
    .limit(MATCH_SCAN_LIMIT * 4)
  if (participants.error) throw new Error('Public match participants are unavailable', { cause: participants.error })
  return buildPublicPlayerEvidence(matches, (participants.data || []) as unknown as PublicParticipantRow[])
}

export const getPublicPlayerDiscovery = cache(async () => {
  const recent = await loadEvidence()
  const candidateIds = recent.slice(0, 16).map(({ player }) => player.id)
  if (!candidateIds.length) return []
  const evidence = await loadEvidence(candidateIds)
  return evidence.filter((row) => candidateIds.includes(row.player.id) && hasDiscoverablePlayerEvidence(row))
    .sort((a, b) => b.results[0].date.localeCompare(a.results[0].date) || a.player.name.localeCompare(b.player.name) || a.player.id.localeCompare(b.player.id))
    .slice(0, DISCOVERY_LIMIT)
})

export const getPublicPlayerEvidenceForIds = cache(async (ids: string[]) => {
  const selected = [...new Set(ids.filter(isPublicPlayerId))].slice(0, 24)
  return selected.length ? loadEvidence(selected) : []
})

export const getPublicPlayerProfile = cache(async (id: string) => {
  if (!isPublicPlayerId(id)) return null
  const { data, error } = await createPublicEvidenceClient().from('players').select('id, name, location').eq('id', id).maybeSingle()
  if (error) throw new Error('Public player identity is unavailable', { cause: error })
  if (!data || !data.name?.trim()) return null
  const player = data as PublicPlayerIdentity
  const evidence = (await loadEvidence([id])).find((row) => row.player.id === id)
  return evidence || { player: { ...player, name: player.name.trim(), location: player.location?.trim() || null }, results: [] }
})
