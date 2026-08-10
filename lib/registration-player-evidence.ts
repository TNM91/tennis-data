'use client'

import { normalizeMixedPairRole, normalizePlayerRatingSource, type PlayerEligibilityEvidence } from '@/lib/player-eligibility'
import { supabase } from '@/lib/supabase'
import { loadUserProfileLink } from '@/lib/user-profile'

export type RegistrationPlayerEvidence = {
  id: string
  name: string
  location: string
  evidence: PlayerEligibilityEvidence
}

type PlayerRow = {
  id?: string | null
  name?: string | null
  location?: string | null
  overall_rating?: number | null
  doubles_rating?: number | null
  singles_rating?: number | null
  rating_source?: string | null
  mixed_pair_role?: string | null
}

type RosterEvidenceRow = {
  age_division?: string | null
  mixed_pair_role?: string | null
  rating_source?: string | null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function loadRegistrationPlayerEvidence(
  userId: string | null | undefined,
): Promise<RegistrationPlayerEvidence | null> {
  if (!userId) return null
  const profileResult = await loadUserProfileLink(userId)
  const playerId = cleanText(profileResult.data?.linked_player_id)
  if (!playerId) return null

  const [playerResult, rosterResult] = await Promise.all([
    supabase
      .from('players')
      .select('id,name,location,overall_rating,doubles_rating,singles_rating,rating_source,mixed_pair_role')
      .eq('id', playerId)
      .maybeSingle(),
    supabase
      .from('team_roster_members')
      .select('age_division,mixed_pair_role,rating_source')
      .eq('player_id', playerId),
  ])
  if (playerResult.error || !playerResult.data) return null

  const player = playerResult.data as PlayerRow
  const rosterRows = rosterResult.error ? [] : (rosterResult.data || []) as RosterEvidenceRow[]
  const verifiedRosterRows = rosterRows.filter((row) => normalizePlayerRatingSource(row.rating_source) === 'verified')
  const verifiedRoster = verifiedRosterRows[0] || null
  const rosterRole = normalizeMixedPairRole(verifiedRoster?.mixed_pair_role)
  const playerRole = normalizeMixedPairRole(player.mixed_pair_role)
  const ageDivisions = Array.from(new Set(verifiedRosterRows.map((row) => cleanText(row.age_division)).filter(Boolean)))

  return {
    id: cleanText(player.id) || playerId,
    name: cleanText(player.name) || cleanText(profileResult.data?.linked_player_name),
    location: cleanText(player.location),
    evidence: {
      playerId,
      rating: player.overall_rating ?? player.doubles_rating ?? player.singles_rating ?? null,
      ratingSource: normalizePlayerRatingSource(player.rating_source),
      mixedPairRole: rosterRole !== 'unknown' ? rosterRole : playerRole,
      mixedPairRoleSource: rosterRole !== 'unknown' ? 'verified' : playerRole !== 'unknown' ? 'self' : 'unknown',
      ageDivisions,
      ageDivisionSource: verifiedRoster && ageDivisions.length ? 'verified' : 'unknown',
    },
  }
}
