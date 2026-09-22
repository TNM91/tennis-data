'use client'

import { supabase } from '@/lib/supabase'

export type PlayerEntryTrackerKind = 'tournament' | 'league'
export type PlayerEntryTrackerStatus = 'submitted' | 'needs_information' | 'approved' | 'not_approved'

export type PlayerEntryTrackerRecord = {
  id: string
  kind: PlayerEntryTrackerKind
  competitionId: string
  competitionName: string
  detail: string
  href: string
  playerName: string
  status: PlayerEntryTrackerStatus
  requestNote: string
  rating: number | null
  mixedPairRole: string
  ageDivision: string
  createdAt: string
  updatedAt: string
}

type TournamentEntryRow = {
  id?: string | null
  tournament_id?: string | null
  player_name?: string | null
  status?: string | null
  player_action_required?: boolean | null
  player_request_note?: string | null
  eligibility_rating?: number | string | null
  eligibility_mixed_pair_role?: string | null
  eligibility_age_division?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type LeagueEntryRow = {
  id?: string | null
  league_id?: string | null
  player_name?: string | null
  entry_status?: string | null
  player_action_required?: boolean | null
  player_request_note?: string | null
  eligibility_rating?: number | string | null
  eligibility_mixed_pair_role?: string | null
  eligibility_age_division?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type CompetitionRow = {
  id?: string | null
  name?: string | null
  league_name?: string | null
  starts_on?: string | null
  season_label?: string | null
  flight?: string | null
  location_label?: string | null
}

function cleanText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function normalizeRating(value: number | string | null | undefined) {
  const rating = Number(value)
  return Number.isFinite(rating) && rating >= 1 && rating <= 7 ? rating : null
}

function tournamentStatus(row: TournamentEntryRow): PlayerEntryTrackerStatus {
  if (row.player_action_required) return 'needs_information'
  if (row.status === 'approved') return 'approved'
  if (row.status === 'declined') return 'not_approved'
  return 'submitted'
}

function leagueStatus(row: LeagueEntryRow): PlayerEntryTrackerStatus {
  if (row.player_action_required) return 'needs_information'
  if (row.entry_status === 'active') return 'approved'
  if (row.entry_status === 'rejected' || row.entry_status === 'removed') return 'not_approved'
  return 'submitted'
}

function competitionDetail(row: CompetitionRow | undefined, kind: PlayerEntryTrackerKind) {
  if (!row) return kind === 'tournament' ? 'Tournament entry' : 'League entry'
  const dateOrSeason = cleanText(row.starts_on) || cleanText(row.season_label)
  return [dateOrSeason, cleanText(row.flight), cleanText(row.location_label)].filter(Boolean).join(' · ')
    || (kind === 'tournament' ? 'Tournament entry' : 'League entry')
}

export async function loadPlayerEntryTracker(userId: string): Promise<PlayerEntryTrackerRecord[]> {
  const profileId = cleanText(userId)
  if (!profileId) return []

  const [tournamentResult, leagueResult] = await Promise.all([
    supabase
      .from('tiq_tournament_entries')
      .select('id,tournament_id,player_name,status,player_action_required,player_request_note,eligibility_rating,eligibility_mixed_pair_role,eligibility_age_division,created_at,updated_at')
      .eq('submitted_by_user_id', profileId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('tiq_player_league_entries')
      .select('id,league_id,player_name,entry_status,player_action_required,player_request_note,eligibility_rating,eligibility_mixed_pair_role,eligibility_age_division,created_at,updated_at')
      .eq('created_by_user_id', profileId)
      .order('updated_at', { ascending: false }),
  ])

  if (tournamentResult.error && leagueResult.error) {
    throw new Error('Your entry status could not be loaded. Try again in a moment.')
  }

  const tournamentRows = (tournamentResult.data || []) as TournamentEntryRow[]
  const leagueRows = (leagueResult.data || []) as LeagueEntryRow[]
  const tournamentIds = Array.from(new Set(tournamentRows.map((row) => cleanText(row.tournament_id)).filter(Boolean)))
  const leagueIds = Array.from(new Set(leagueRows.map((row) => cleanText(row.league_id)).filter(Boolean)))

  const [tournamentDetails, leagueDetails] = await Promise.all([
    tournamentIds.length
      ? supabase.from('tiq_tournaments').select('id,name,starts_on,location_label').in('id', tournamentIds)
      : Promise.resolve({ data: [], error: null }),
    leagueIds.length
      ? supabase.from('tiq_leagues').select('id,league_name,season_label,flight,location_label').in('id', leagueIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const tournamentById = new Map(((tournamentDetails.data || []) as CompetitionRow[]).map((row) => [cleanText(row.id), row]))
  const leagueById = new Map(((leagueDetails.data || []) as CompetitionRow[]).map((row) => [cleanText(row.id), row]))

  const entries: PlayerEntryTrackerRecord[] = [
    ...tournamentRows.map((row) => {
      const competitionId = cleanText(row.tournament_id)
      const competition = tournamentById.get(competitionId)
      return {
        id: cleanText(row.id),
        kind: 'tournament' as const,
        competitionId,
        competitionName: cleanText(competition?.name) || 'TIQ tournament',
        detail: competitionDetail(competition, 'tournament'),
        href: `/tournaments/${encodeURIComponent(competitionId)}`,
        playerName: cleanText(row.player_name),
        status: tournamentStatus(row),
        requestNote: cleanText(row.player_request_note),
        rating: normalizeRating(row.eligibility_rating),
        mixedPairRole: cleanText(row.eligibility_mixed_pair_role),
        ageDivision: cleanText(row.eligibility_age_division),
        createdAt: cleanText(row.created_at),
        updatedAt: cleanText(row.updated_at),
      }
    }),
    ...leagueRows.map((row) => {
      const competitionId = cleanText(row.league_id)
      const competition = leagueById.get(competitionId)
      return {
        id: cleanText(row.id),
        kind: 'league' as const,
        competitionId,
        competitionName: cleanText(competition?.league_name) || 'TIQ league',
        detail: competitionDetail(competition, 'league'),
        href: `/explore/leagues/tiq/${encodeURIComponent(competitionId)}`,
        playerName: cleanText(row.player_name),
        status: leagueStatus(row),
        requestNote: cleanText(row.player_request_note),
        rating: normalizeRating(row.eligibility_rating),
        mixedPairRole: cleanText(row.eligibility_mixed_pair_role),
        ageDivision: cleanText(row.eligibility_age_division),
        createdAt: cleanText(row.created_at),
        updatedAt: cleanText(row.updated_at),
      }
    }),
  ]

  return entries
    .filter((entry) => entry.id && entry.competitionId)
    .sort((a, b) => {
      if (a.status === 'needs_information' && b.status !== 'needs_information') return -1
      if (b.status === 'needs_information' && a.status !== 'needs_information') return 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
}

export async function resolvePlayerEntryInformation(input: {
  kind: PlayerEntryTrackerKind
  entryId: string
  rating?: number | null
  mixedPairRole?: string | null
  ageDivision?: string | null
}) {
  const { data, error } = await supabase.rpc('resolve_tiq_entry_information', {
    p_entry_kind: input.kind,
    p_entry_id: cleanText(input.entryId),
    p_rating: typeof input.rating === 'number' ? input.rating : null,
    p_mixed_pair_role: cleanText(input.mixedPairRole) || null,
    p_age_division: cleanText(input.ageDivision) || null,
  })

  if (error) throw new Error(error.message)
  if (!data) throw new Error('This entry is no longer waiting for player information.')
}
