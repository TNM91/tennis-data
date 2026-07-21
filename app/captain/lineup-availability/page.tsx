'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import LockedPlanPage from '@/app/components/locked-plan-page'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { readCaptainResumeState, writeCaptainResumeState } from '@/lib/captain-memory'
import { buildTeamEntityId } from '@/lib/entity-ids'
import { supabase } from '../../../lib/supabase'
import { formatDate, formatRating, cleanText, normalizeTeamName, safeText } from '@/lib/captain-formatters'
import { buildProductAccessState } from '@/lib/access-model'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type MatchRow = {
  id: string
  league_name: string | null
  flight: string | null
  home_team: string | null
  away_team: string | null
  match_date: string
  line_number: string | null
}

type AvailRatingStatus = 'Bump Up Pace' | 'Trending Up' | 'Holding' | 'At Risk' | 'Drop Watch'

type PlayerRelation =
  | {
      id: string
      name: string
      flight: string | null
      preferred_role: string | null
      lineup_notes: string | null
      overall_rating: number | null
      overall_dynamic_rating: number | null
      overall_usta_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      singles_usta_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
      doubles_usta_dynamic_rating: number | null
    }
  | {
      id: string
      name: string
      flight: string | null
      preferred_role: string | null
      lineup_notes: string | null
      overall_rating: number | null
      overall_dynamic_rating: number | null
      overall_usta_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      singles_usta_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
      doubles_usta_dynamic_rating: number | null
    }[]
  | null

type MatchPlayerRow = {
  match_id: string
  side: 'A' | 'B'
  player_id: string
  players: PlayerRelation
}

type TeamRosterMemberRow = {
  team_name: string | null
  player_id: string | null
  player_name: string | null
  league_name: string | null
  flight: string | null
  ntrp: number | null
  players: PlayerRelation
}

type RosterPlayer = {
  id: string
  name: string
  flight: string | null
  preferredRole: string | null
  lineupNotes: string | null
  appearances: number
  overallBase: number | null
  overallDynamic: number | null
  overallUstaDynamic: number | null
  singlesDynamic: number | null
  singlesUstaDynamic: number | null
  doublesDynamic: number | null
  doublesUstaDynamic: number | null
}

type AvailabilityStatus =
  | 'available'
  | 'unavailable'
  | 'singles_only'
  | 'doubles_only'
  | 'limited'

type AvailabilityRow = {
  id: string
  match_date: string
  team_name: string
  league_name: string | null
  flight: string | null
  player_id: string
  status: AvailabilityStatus
  notes: string | null
}

type LeagueOption = {
  leagueName: string
  flight: string
}

type AvailabilityReadinessCard = {
  label: string
  value: string
  detail: string
  tone: 'green' | 'amber' | 'red' | 'blue'
}

function normalizePlayerRelation(player: PlayerRelation) {
  if (!player) return null
  return Array.isArray(player) ? player[0] ?? null : player
}

function buildLeagueKey(leagueName: string, flight: string) {
  return `${leagueName}___${flight}`
}

function statusLabel(status: AvailabilityStatus) {
  switch (status) {
    case 'available':
      return 'Available'
    case 'unavailable':
      return 'Unavailable'
    case 'singles_only':
      return 'Singles Only'
    case 'doubles_only':
      return 'Doubles Only'
    case 'limited':
      return 'Limited'
    default:
      return status
  }
}

function summaryPillStyle(tone: 'green' | 'red' | 'blue' | 'purple' | 'amber' | 'slate'): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.55rem 0.8rem',
    borderRadius: '999px',
    fontSize: '0.78rem',
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: '0.02em',
    border: '1px solid transparent',
  }

  if (tone === 'green') return { ...base, background: 'rgba(34, 197, 94, 0.12)', color: '#dffad5', borderColor: 'rgba(34, 197, 94, 0.18)' }
  if (tone === 'red') return { ...base, background: 'rgba(239, 68, 68, 0.12)', color: '#fecaca', borderColor: 'rgba(239, 68, 68, 0.18)' }
  if (tone === 'blue') return { ...base, background: 'rgba(37, 99, 235, 0.12)', color: '#c7dbff', borderColor: 'rgba(37, 99, 235, 0.18)' }
  if (tone === 'purple') return { ...base, background: 'rgba(109, 40, 217, 0.12)', color: '#ddd6fe', borderColor: 'rgba(109, 40, 217, 0.18)' }
  if (tone === 'amber') return { ...base, background: 'rgba(245, 158, 11, 0.14)', color: '#fde68a', borderColor: 'rgba(245, 158, 11, 0.18)' }
  return { ...base, background: 'var(--shell-chip-bg)', color: '#dfe8f8', borderColor: 'var(--shell-panel-border)' }
}

function statusPillFor(status: AvailabilityStatus): CSSProperties {
  if (status === 'available') return summaryPillStyle('green')
  if (status === 'unavailable') return summaryPillStyle('red')
  if (status === 'singles_only') return summaryPillStyle('blue')
  if (status === 'doubles_only') return summaryPillStyle('purple')
  return summaryPillStyle('amber')
}

function viabilityLabel(available: number, unavailable: number, limited: number) {
  if (available >= 6 && unavailable === 0) return 'Strong'
  if (available >= 5 && limited <= 2) return 'Playable'
  return 'Thin'
}

export default function LineupAvailabilityPage() {
  return (
    <SiteShell active="/captain">
      <LineupAvailabilityContent />
    </SiteShell>
  )
}

function LineupAvailabilityContent() {
  const router = useRouter()

  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const [competitionLayer, setCompetitionLayer] = useState('')
  const [selectedLeagueKey, setSelectedLeagueKey] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  const [rosterLoading, setRosterLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [availabilityMap, setAvailabilityMap] = useState<
    Record<string, { status: AvailabilityStatus; notes: string }>
  >({})
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const { role, entitlements, authResolved } = useAuth()

  useEffect(() => {
    if (!authResolved || role !== 'public') return
    router.replace('/login?plan=captain&next=%2Fcaptain%2Flineup-availability')
  }, [authResolved, role, router])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const resumeState = readCaptainResumeState()
    const initialCompetitionLayer = params.get('layer') ?? resumeState?.competitionLayer ?? ''
    const initialLeague = params.get('league') ?? resumeState?.league ?? ''
    const initialFlight = params.get('flight') ?? resumeState?.flight ?? ''
    const initialTeam = params.get('team') ?? resumeState?.team ?? ''
    const initialDate = params.get('date') ?? resumeState?.eventDate ?? ''

    setCompetitionLayer(initialCompetitionLayer)
    if (initialLeague || initialFlight) {
      setSelectedLeagueKey(buildLeagueKey(initialLeague, initialFlight))
    }
    setSelectedTeam(initialTeam)
    setSelectedDate(initialDate)
  }, [])

  useEffect(() => {
    if (!authResolved || role === 'public') return
    void loadMatches()
  }, [authResolved, refreshTick, role])

  async function loadMatches() {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          league_name,
          flight,
          home_team,
          away_team,
          match_date,
          line_number
        `)
        .is('line_number', null)
        .order('match_date', { ascending: false })
        .limit(400)

      if (error) throw new Error(error.message)

      setMatches((data || []) as MatchRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load availability data.')
    } finally {
      setLoading(false)
    }
  }

  const loadRosterAndAvailability = useCallback(async () => {
    setRosterLoading(true)
    setError('')
    setStatus('')

    try {
      const [leagueName, flight] = selectedLeagueKey.split('___')

      const { data: teamMatchesData, error: teamMatchesError } = await supabase
        .from('matches')
        .select(`
          id,
          league_name,
          flight,
          home_team,
          away_team,
          match_date,
          line_number
        `)
        .eq('league_name', leagueName)
        .eq('flight', flight)
        .or(`home_team.eq.${selectedTeam},away_team.eq.${selectedTeam}`)
        .is('line_number', null)

      if (teamMatchesError) throw new Error(teamMatchesError.message)

      const typedTeamMatches = (teamMatchesData || []) as MatchRow[]
      const matchIds = typedTeamMatches.map((match) => match.id)

      const { data: rosterMemberData, error: rosterMemberError } = await supabase
        .from('team_roster_members')
        .select(`
          team_name,
          player_id,
          player_name,
          league_name,
          flight,
          ntrp,
          players (
            id,
            name,
            flight,
            preferred_role,
            lineup_notes,
            overall_rating,
            overall_dynamic_rating,
            overall_usta_dynamic_rating,
            singles_dynamic_rating,
            singles_usta_dynamic_rating,
            doubles_dynamic_rating,
            doubles_usta_dynamic_rating
          )
        `)
        .eq('normalized_team_name', normalizeTeamName(selectedTeam))
        .eq('league_name', leagueName)
        .eq('flight', flight)
        .limit(500)

      if (rosterMemberError) {
        console.warn('team_roster_members lookup skipped', rosterMemberError.message)
      }

      const sideByMatchId = new Map<string, 'A' | 'B'>()

      for (const match of typedTeamMatches) {
        if (cleanText(match.home_team) === selectedTeam) sideByMatchId.set(match.id, 'A')
        if (cleanText(match.away_team) === selectedTeam) sideByMatchId.set(match.id, 'B')
      }

      const rosterMap = new Map<string, RosterPlayer>()

      for (const row of (rosterMemberData || []) as TeamRosterMemberRow[]) {
        const player = normalizePlayerRelation(row.players)
        const playerId = player?.id || row.player_id
        const playerName = player?.name || row.player_name
        if (!playerId || !playerName || rosterMap.has(playerId)) continue

        rosterMap.set(playerId, {
          id: playerId,
          name: playerName,
          flight: player?.flight ?? row.flight,
          preferredRole: player?.preferred_role ?? null,
          lineupNotes: player?.lineup_notes ?? 'No imported match history yet',
          appearances: 0,
          overallBase: player?.overall_rating ?? row.ntrp,
          overallDynamic: player?.overall_dynamic_rating ?? row.ntrp,
          overallUstaDynamic: player?.overall_usta_dynamic_rating ?? null,
          singlesDynamic: player?.singles_dynamic_rating ?? row.ntrp,
          singlesUstaDynamic: player?.singles_usta_dynamic_rating ?? null,
          doublesDynamic: player?.doubles_dynamic_rating ?? row.ntrp,
          doublesUstaDynamic: player?.doubles_usta_dynamic_rating ?? null,
        })
      }

      if (matchIds.length) {
        const { data: participantData, error: participantError } = await supabase
          .from('match_players')
          .select(`
            match_id,
            side,
            player_id,
            players (
              id,
              name,
              flight,
              preferred_role,
              lineup_notes,
              overall_rating,
              overall_dynamic_rating,
              overall_usta_dynamic_rating,
              singles_dynamic_rating,
              singles_usta_dynamic_rating,
              doubles_dynamic_rating,
              doubles_usta_dynamic_rating
            )
          `)
          .in('match_id', matchIds)

        if (participantError) throw new Error(participantError.message)

        const typedParticipants = (participantData || []) as MatchPlayerRow[]

        for (const participant of typedParticipants) {
          const expectedSide = sideByMatchId.get(participant.match_id)
          if (!expectedSide || participant.side !== expectedSide) continue

          const player = normalizePlayerRelation(participant.players)
          if (!player) continue

          if (!rosterMap.has(player.id)) {
            rosterMap.set(player.id, {
              id: player.id,
              name: player.name,
              flight: player.flight,
              preferredRole: player.preferred_role,
              lineupNotes: player.lineup_notes,
              appearances: 0,
              overallBase: player.overall_rating,
              overallDynamic: player.overall_dynamic_rating,
              overallUstaDynamic: player.overall_usta_dynamic_rating,
              singlesDynamic: player.singles_dynamic_rating,
              singlesUstaDynamic: player.singles_usta_dynamic_rating,
              doublesDynamic: player.doubles_dynamic_rating,
              doublesUstaDynamic: player.doubles_usta_dynamic_rating,
            })
          }

          rosterMap.get(player.id)!.appearances += 1
        }
      }

      const rosterList = [...rosterMap.values()].sort((a, b) => {
        if (b.appearances !== a.appearances) return b.appearances - a.appearances
        return a.name.localeCompare(b.name)
      })

      setRoster(rosterList)

      if (!selectedDate) {
        const defaults: Record<string, { status: AvailabilityStatus; notes: string }> = {}
        for (const player of rosterList) {
          defaults[player.id] = { status: 'available', notes: '' }
        }
        setAvailabilityMap(defaults)
        setRosterLoading(false)
        return
      }

      const { data: availabilityData, error: availabilityError } = await supabase
        .from('lineup_availability')
        .select(`
          id,
          match_date,
          team_name,
          league_name,
          flight,
          player_id,
          status,
          notes
        `)
        .eq('match_date', selectedDate)
        .eq('team_name', selectedTeam)

      if (availabilityError) throw new Error(availabilityError.message)

      const typedAvailability = (availabilityData || []) as AvailabilityRow[]
      const nextMap: Record<string, { status: AvailabilityStatus; notes: string }> = {}

      for (const player of rosterList) {
        const existing = typedAvailability.find((row) => row.player_id === player.id)
        nextMap[player.id] = {
          status: existing?.status || 'available',
          notes: existing?.notes || '',
        }
      }

      setAvailabilityMap(nextMap)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roster or availability.')
    } finally {
      setRosterLoading(false)
    }
  }, [selectedDate, selectedLeagueKey, selectedTeam])

  useEffect(() => {
    if (!authResolved || role === 'public') return
    if (!selectedLeagueKey || !selectedTeam) {
      setRoster([])
      setAvailabilityMap({})
      return
    }

    void loadRosterAndAvailability()
  }, [authResolved, loadRosterAndAvailability, role, selectedLeagueKey, selectedTeam])

  useEffect(() => {
    const [leagueName = '', flight = ''] = selectedLeagueKey.split('___')
    writeCaptainResumeState({
      competitionLayer: competitionLayer || undefined,
      team: selectedTeam || undefined,
      league: leagueName || undefined,
      flight: flight || undefined,
      eventDate: selectedDate || undefined,
      lastTool: 'lineup-availability',
      lastToolLabel: 'Lineup Availability',
    })
  }, [competitionLayer, selectedDate, selectedLeagueKey, selectedTeam])

  async function writeCaptainAlerts(
    leagueName: string,
    flight: string,
    team: string,
    matchDate: string,
    rosterRows: RosterPlayer[],
    availabilityState: Record<string, { status: AvailabilityStatus; notes: string }>,
  ) {
    const availablePlayers = rosterRows.filter((player) => {
      const status = availabilityState[player.id]?.status || 'available'
      return status === 'available' || status === 'limited' || status === 'doubles_only' || status === 'singles_only'
    })

    const unavailableCount = rosterRows.filter((player) => {
      const status = availabilityState[player.id]?.status || 'available'
      return status === 'unavailable'
    }).length

    const limitedCount = rosterRows.filter((player) => {
      const status = availabilityState[player.id]?.status || 'available'
      return status === 'limited'
    }).length

    const doublesCapableCount = rosterRows.filter((player) => {
      const status = availabilityState[player.id]?.status || 'available'
      return status !== 'unavailable' && status !== 'singles_only'
    }).length

    const singlesReadyCount = rosterRows.filter((player) => {
      const status = availabilityState[player.id]?.status || 'available'
      const canPlaySingles = status !== 'unavailable' && status !== 'doubles_only'
      const singlesRating = typeof player.singlesDynamic === 'number' ? player.singlesDynamic : null
      return canPlaySingles && singlesRating !== null
    }).length

    const teamEntityId = buildTeamEntityId(team, leagueName, flight)
    const subtitle = [leagueName, flight, formatDate(matchDate)].filter(Boolean).join(' - ')

    const events = []

    if (availablePlayers.length < 5) {
      events.push({
        event_type: 'captain_alert_thin_roster',
        entity_type: 'team',
        entity_id: teamEntityId,
        entity_name: team,
        subtitle,
        title: 'Thin roster for upcoming match',
        body: `${availablePlayers.length} players are available or limited for ${formatDate(matchDate)}.`,
      })
    }

    if (doublesCapableCount < 4) {
      events.push({
        event_type: 'captain_alert_doubles_risk',
        entity_type: 'team',
        entity_id: teamEntityId,
        entity_name: team,
        subtitle,
        title: 'Doubles lineup risk',
        body: `${doublesCapableCount} doubles-capable players are available for ${formatDate(matchDate)}.`,
      })
    }

    if (unavailableCount >= Math.max(availablePlayers.length, 1)) {
      events.push({
        event_type: 'captain_alert_availability_risk',
        entity_type: 'team',
        entity_id: teamEntityId,
        entity_name: team,
        subtitle,
        title: 'High availability risk',
        body: `${unavailableCount} unavailable vs ${availablePlayers.length} available or limited for ${formatDate(matchDate)}.`,
      })
    }

    if (singlesReadyCount < 2) {
      events.push({
        event_type: 'captain_alert_singles_exposure',
        entity_type: 'team',
        entity_id: teamEntityId,
        entity_name: team,
        subtitle,
        title: 'Singles exposure risk',
        body: `${singlesReadyCount} realistic singles options are available for ${formatDate(matchDate)}.`,
      })
    }

    if (limitedCount >= 3) {
      events.push({
        event_type: 'captain_alert_limited_players',
        entity_type: 'team',
        entity_id: teamEntityId,
        entity_name: team,
        subtitle,
        title: 'Several players are limited',
        body: `${limitedCount} players are marked limited for ${formatDate(matchDate)}.`,
      })
    }

    const eventTypes = [
      'captain_alert_thin_roster',
      'captain_alert_doubles_risk',
      'captain_alert_availability_risk',
      'captain_alert_singles_exposure',
      'captain_alert_limited_players',
    ]

    const { error: deleteError } = await supabase
      .from('my_lab_feed')
      .delete()
      .eq('entity_type', 'team')
      .eq('entity_id', teamEntityId)
      .in('event_type', eventTypes)

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    if (events.length === 0) return

    const { error: insertError } = await supabase
      .from('my_lab_feed')
      .insert(events)

    if (insertError) {
      throw new Error(insertError.message)
    }
  }

  async function saveAvailability() {
    if (!selectedLeagueKey || !selectedTeam || !selectedDate) {
      setError('Please select a league, team, and match date first.')
      return
    }

    setSaving(true)
    setError('')
    setStatus('')

    try {
      const [leagueName, flight] = selectedLeagueKey.split('___')

      const payload = roster.map((player) => ({
        match_date: selectedDate,
        team_name: selectedTeam,
        league_name: leagueName,
        flight,
        player_id: player.id,
        status: availabilityMap[player.id]?.status || 'available',
        notes: availabilityMap[player.id]?.notes || null,
      }))

      const { error } = await supabase
        .from('lineup_availability')
        .upsert(payload, {
          onConflict: 'match_date,team_name,player_id',
        })

      if (error) throw new Error(error.message)

      await writeCaptainAlerts(
        leagueName,
        flight,
        selectedTeam,
        selectedDate,
        roster,
        availabilityMap,
      )

      setStatus('Availability saved and captain alerts updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save availability.')
    } finally {
      setSaving(false)
    }
  }

  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])

  const leagueOptions = useMemo<LeagueOption[]>(() => {
    const map = new Map<string, LeagueOption>()

    for (const row of matches) {
      const leagueName = cleanText(row.league_name)
      const flight = cleanText(row.flight)
      if (!leagueName || !flight) continue

      const key = buildLeagueKey(leagueName, flight)
      if (!map.has(key)) map.set(key, { leagueName, flight })
    }

    return [...map.values()].sort((a, b) => {
      if (a.leagueName !== b.leagueName) return a.leagueName.localeCompare(b.leagueName)
      return a.flight.localeCompare(b.flight)
    })
  }, [matches])

  const teamsForLeague = useMemo(() => {
    if (!selectedLeagueKey) return []

    const [leagueName, flight] = selectedLeagueKey.split('___')
    const teamSet = new Set<string>()

    for (const row of matches) {
      if (cleanText(row.league_name) !== leagueName) continue
      if (cleanText(row.flight) !== flight) continue

      if (row.home_team) teamSet.add(row.home_team.trim())
      if (row.away_team) teamSet.add(row.away_team.trim())
    }

    return [...teamSet].sort((a, b) => a.localeCompare(b))
  }, [matches, selectedLeagueKey])

  const relevantDates = useMemo(() => {
    if (!selectedLeagueKey || !selectedTeam) return []

    const [leagueName, flight] = selectedLeagueKey.split('___')
    const dateSet = new Set<string>()

    for (const row of matches) {
      if (cleanText(row.league_name) !== leagueName) continue
      if (cleanText(row.flight) !== flight) continue

      const teamMatch =
        cleanText(row.home_team) === selectedTeam || cleanText(row.away_team) === selectedTeam

      if (teamMatch && row.match_date) dateSet.add(row.match_date)
    }

    return [...dateSet].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  }, [matches, selectedLeagueKey, selectedTeam])

  const selectedLeagueLabel = useMemo(() => {
    if (!selectedLeagueKey) return ''
    const [leagueName, flight] = selectedLeagueKey.split('___')
    return `${leagueName} - ${flight}`
  }, [selectedLeagueKey])

  const availabilitySummary = useMemo(() => {
    const counts: Record<AvailabilityStatus, number> = {
      available: 0,
      unavailable: 0,
      singles_only: 0,
      doubles_only: 0,
      limited: 0,
    }

    for (const player of roster) {
      const current = availabilityMap[player.id]?.status || 'available'
      counts[current] += 1
    }

    return counts
  }, [roster, availabilityMap])

  const viability = useMemo(
    () => viabilityLabel(availabilitySummary.available, availabilitySummary.unavailable, availabilitySummary.limited),
    [availabilitySummary]
  )

  const availabilityReadiness = useMemo(() => {
    const playablePlayers = roster.filter((player) => {
      const playerStatus = availabilityMap[player.id]?.status || 'available'
      return playerStatus !== 'unavailable'
    })

    const singlesReadyPlayers = roster.filter((player) => {
      const playerStatus = availabilityMap[player.id]?.status || 'available'
      return playerStatus !== 'unavailable' && playerStatus !== 'doubles_only'
    })

    const doublesReadyPlayers = roster.filter((player) => {
      const playerStatus = availabilityMap[player.id]?.status || 'available'
      return playerStatus !== 'unavailable' && playerStatus !== 'singles_only'
    })

    const limitedPlayers = roster.filter((player) => {
      const playerStatus = availabilityMap[player.id]?.status || 'available'
      return playerStatus === 'limited' || playerStatus === 'singles_only' || playerStatus === 'doubles_only'
    })

    const playableCount = playablePlayers.length
    const singlesCount = singlesReadyPlayers.length
    const doublesPairs = Math.floor(doublesReadyPlayers.length / 2)

    const cards: AvailabilityReadinessCard[] = [
      {
        label: 'Lineup pool',
        value: `${playableCount} playable`,
        detail:
          playableCount >= 7
            ? 'Enough bodies for a normal five-line build with room for late movement.'
            : playableCount >= 5
              ? 'Playable, but every absence matters. Confirm maybes before setting the final lineup.'
              : 'Too thin for a reliable full lineup. Start chasing responses now.',
        tone: playableCount >= 7 ? 'green' : playableCount >= 5 ? 'amber' : 'red',
      },
      {
        label: 'Singles cover',
        value: `${singlesCount} options`,
        detail:
          singlesCount >= 3
            ? 'Singles has enough options to support lineup choices.'
            : singlesCount >= 2
              ? 'Singles can work, but one change could squeeze the lineup.'
              : 'Singles is exposed. Find another singles-capable player before building.',
        tone: singlesCount >= 3 ? 'green' : singlesCount >= 2 ? 'amber' : 'red',
      },
      {
        label: 'Doubles cover',
        value: `${doublesPairs} pair${doublesPairs === 1 ? '' : 's'}`,
        detail:
          doublesPairs >= 2
            ? 'Doubles has enough pair coverage for the expected lines.'
            : doublesPairs === 1
              ? 'One doubles pair is ready. You need another pair or a format adjustment.'
              : 'No doubles pair is currently safe to build around.',
        tone: doublesPairs >= 2 ? 'green' : doublesPairs === 1 ? 'amber' : 'red',
      },
      {
        label: 'Restrictions',
        value: `${limitedPlayers.length} flagged`,
        detail:
          limitedPlayers.length
            ? 'Resolve limited and role-only players before the builder locks in choices.'
            : 'No restrictions marked yet. This is clean if the responses are current.',
        tone: limitedPlayers.length ? 'blue' : 'green',
      },
    ]

    return { playableCount, singlesCount, doublesPairs, limitedCount: limitedPlayers.length, cards }
  }, [availabilityMap, roster])

  function updatePlayerStatus(playerId: string, status: AvailabilityStatus) {
    setAvailabilityMap((prev) => ({
      ...prev,
      [playerId]: {
        status,
        notes: prev[playerId]?.notes || '',
      },
    }))
  }

  function updatePlayerNotes(playerId: string, notes: string) {
    setAvailabilityMap((prev) => ({
      ...prev,
      [playerId]: {
        status: prev[playerId]?.status || 'available',
        notes,
      },
    }))
  }

  function applyBulkStatus(status: AvailabilityStatus) {
    const next: Record<string, { status: AvailabilityStatus; notes: string }> = {}
    for (const player of roster) {
      next[player.id] = {
        status,
        notes: availabilityMap[player.id]?.notes || '',
      }
    }
    setAvailabilityMap(next)
    setStatus(`Set all players to ${statusLabel(status)}.`)
  }

  function resetStatuses() {
    const next: Record<string, { status: AvailabilityStatus; notes: string }> = {}
    for (const player of roster) {
      next[player.id] = { status: 'available', notes: '' }
    }
    setAvailabilityMap(next)
    setStatus('Reset all players to Available.')
  }

  if (!authResolved) {
    return (
      <main style={pageStyle}>
        <div style={orbOne} />
        <div style={orbTwo} />
        <div style={gridGlow} />
        <section style={contentWrap}>
          <section style={surfaceCard}>
            <p style={mutedTextStyle}>Loading lineup availability...</p>
          </section>
        </section>
      </main>
    )
  }

  if (role === 'public') return null

  if (!access.canUseCaptainWorkflow) {
    return (
      <LockedPlanPage
        active="/captain"
        withinShell
        planId="captain"
        headline="Want availability to carry into lineup decisions?"
        body="Unlock Captain to save match-date availability, carry it into the builder, and stop guessing who is actually usable before you set the lineup."
        ctaLabel="Unlock Captain"
        secondaryLabel="Back to Captain"
        secondaryHref="/captain"
      />
    )
  }

  return (
    <main style={pageStyle}>
      <div style={orbOne} />
      <div style={orbTwo} />
      <div style={gridGlow} />

      <section style={toolControlShellResponsive(isTablet, isMobile)} aria-label="Availability controls">
        <div>
          <div style={toolControlHeaderStyle}>
            <div>
              <p style={sectionKicker}>Availability controls</p>
              <h1 style={toolControlTitleStyle}>Who can play?</h1>
            </div>
            <span style={summaryPillStyle(viability === 'Strong' ? 'green' : viability === 'Playable' ? 'amber' : 'red')}>
              {viability}
            </span>
          </div>

          <div style={toolControlButtonRowStyle}>
            <PrimaryBtn onClick={saveAvailability} disabled={saving || !selectedDate}>
              {saving ? 'Saving...' : 'Save Availability'}
            </PrimaryBtn>
            <GhostLink href="/captain/lineup-builder">Open Lineup Builder</GhostLink>
            <GhostBtn onClick={() => setRefreshTick((current) => current + 1)}>
              {loading || rosterLoading ? 'Refreshing...' : 'Refresh data'}
            </GhostBtn>
          </div>
        </div>

        <div style={captainReadCard}>
          <div style={captainReadTop}>
            <div>
              <p style={sectionKicker}>Availability read</p>
              <h2 style={captainReadTitle}>{viability}</h2>
              <p style={captainReadText}>
                {selectedTeam
                  ? `${availabilityReadiness.playableCount} playable, ${availabilityReadiness.doublesPairs} doubles pair${availabilityReadiness.doublesPairs === 1 ? '' : 's'}, ${availabilityReadiness.limitedCount} restriction${availabilityReadiness.limitedCount === 1 ? '' : 's'}.`
                  : 'Choose a team to see who can cover this match.'}
              </p>
            </div>
            <span style={summaryPillStyle(viability === 'Strong' ? 'green' : viability === 'Playable' ? 'amber' : 'red')}>
              {availabilitySummary.available} in
            </span>
          </div>

          <div style={heroBadgeRowStyleCompact}>
            <span style={miniPillSlate}>{selectedDate ? formatDate(selectedDate) : 'Pick match date'}</span>
            <span style={miniPillBlue}>{availabilityReadiness.singlesCount} singles options</span>
            <span style={miniPillSlate}>{availabilitySummary.unavailable} out</span>
          </div>
        </div>
      </section>

      <section style={contentWrap}>
        <section style={surfaceCardStrong}>
          <div style={sectionHeaderStyle}>
            <div>
              <p style={sectionKicker}>Match filters</p>
              <h2 style={sectionTitle}>Load the right roster and match context</h2>
              <p style={sectionBodyTextStyle}>
                Choose a league, team, and match date to manage availability for that lineup pool.
              </p>
            </div>
          </div>

          <div style={filtersGridResponsive(isTablet)}>
            <div>
              <label style={labelStyle}>League / Flight</label>
              <select
                value={selectedLeagueKey}
                onChange={(e) => {
                  setSelectedLeagueKey(e.target.value)
                  setSelectedTeam('')
                  setSelectedDate('')
                  setRoster([])
                  setAvailabilityMap({})
                }}
                style={inputStyle}
              >
                <option value="">Select league</option>
                {leagueOptions.map((option) => {
                  const key = buildLeagueKey(option.leagueName, option.flight)
                  return (
                    <option key={key} value={key}>
                      {option.leagueName} - {option.flight}
                    </option>
                  )
                })}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Team</label>
              <select
                value={selectedTeam}
                onChange={(e) => {
                  setSelectedTeam(e.target.value)
                  setSelectedDate('')
                  setRoster([])
                  setAvailabilityMap({})
                }}
                style={inputStyle}
                disabled={!selectedLeagueKey}
              >
                <option value="">Select team</option>
                {teamsForLeague.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Match Date</label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={inputStyle}
                disabled={!selectedTeam}
              >
                <option value="">Select date</option>
                {relevantDates.map((date) => (
                  <option key={date} value={date}>{formatDate(date)}</option>
                ))}
              </select>
            </div>
          </div>

          {!!selectedTeam && (
            <div style={heroBadgeRowStyleCompact}>
              <span style={miniPillSlate}>{selectedTeam}</span>
              {selectedLeagueLabel ? <span style={miniPillBlue}>{selectedLeagueLabel}</span> : null}
              <span style={miniPillSlate}>{selectedDate ? formatDate(selectedDate) : 'No match date selected'}</span>
            </div>
          )}
        </section>

        {loading ? (
          <section style={surfaceCard}>
            <p style={mutedTextStyle}>Loading availability inputs...</p>
          </section>
        ) : error ? (
          <section style={surfaceCard}>
            <p style={errorTextStyle}>{error}</p>
            <div style={{ marginTop: 12 }}>
              <GhostSmallBtn onClick={() => setRefreshTick((current) => current + 1)}>Retry availability load</GhostSmallBtn>
            </div>
          </section>
        ) : !selectedLeagueKey || !selectedTeam ? (
          <section style={surfaceCard}>
            <h3 style={sectionTitleSmall}>Start by selecting a league and team</h3>
            <p style={mutedTextStyle}>
              Choose a league and team to load roster usage history and set availability for the match date.
            </p>
          </section>
        ) : rosterLoading ? (
          <section style={surfaceCard}>
            <p style={mutedTextStyle}>Loading roster and saved availability...</p>
          </section>
        ) : roster.length === 0 ? (
          <section style={surfaceCard}>
            <h3 style={sectionTitleSmall}>Roster usage is not ready yet</h3>
            <p style={mutedTextStyle}>
              This team does not have enough prior match player history yet to build an availability roster.
            </p>
          </section>
        ) : (
          <>
            <section style={metricsGridResponsive(isSmallMobile, isTablet)}>
              <MetricCard label="Roster Size" value={String(roster.length)} />
              <MetricCard label="Available" value={String(availabilitySummary.available)} />
              <MetricCard label="Unavailable" value={String(availabilitySummary.unavailable)} />
              <MetricCard label="Singles Only" value={String(availabilitySummary.singles_only)} />
              <MetricCard label="Doubles Only" value={String(availabilitySummary.doubles_only)} />
              <MetricCard label="Limited" value={String(availabilitySummary.limited)} />
            </section>

            <section style={sectionCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Lineup readiness</p>
                  <h2 style={sectionTitle}>Can this roster cover the match?</h2>
                  <p style={sectionBodyTextStyle}>
                    Use this read before you move into the builder. It turns availability into lineup pressure points.
                  </p>
                </div>
                <span style={summaryPillStyle(viability === 'Strong' ? 'green' : viability === 'Playable' ? 'amber' : 'red')}>
                  {viability}
                </span>
              </div>

              <div style={readinessGridResponsive(isSmallMobile, isTablet)}>
                {availabilityReadiness.cards.map((card) => (
                  <div key={card.label} style={readinessCardStyle}>
                    <div style={readinessCardTopStyle}>
                      <span style={readinessLabelStyle}>{card.label}</span>
                      <span style={summaryPillStyle(card.tone)}>{card.value}</span>
                    </div>
                    <p style={readinessDetailStyle}>{card.detail}</p>
                  </div>
                ))}
              </div>

              <div style={noticeStyle}>
                Builder handoff: {availabilityReadiness.playableCount} playable, {availabilityReadiness.singlesCount} singles-capable, {availabilityReadiness.doublesPairs} doubles pair{availabilityReadiness.doublesPairs === 1 ? '' : 's'}, {availabilityReadiness.limitedCount} restriction{availabilityReadiness.limitedCount === 1 ? '' : 's'}.
              </div>
            </section>

            <section style={sectionCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Bulk actions</p>
                  <h2 style={sectionTitle}>Set the whole roster faster</h2>
                  <p style={sectionBodyTextStyle}>
                    Apply a quick baseline first, then fine-tune individual players below.
                  </p>
                </div>
              </div>

              <div style={bulkActionsWrapStyle}>
                <GhostSmallBtn onClick={() => applyBulkStatus('available')}>All Available</GhostSmallBtn>
                <GhostSmallBtn onClick={() => applyBulkStatus('unavailable')}>All Unavailable</GhostSmallBtn>
                <GhostSmallBtn onClick={resetStatuses}>Reset</GhostSmallBtn>
              </div>

              {!selectedDate ? (
                <div style={noticeStyle}>
                  Choose a match date before saving. You can still set statuses now, but they will not persist until a date is selected.
                </div>
              ) : null}

              {status ? <div style={successBoxStyle}>{status}</div> : null}
            </section>

            <section style={sectionCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Roster availability</p>
                  <h2 style={sectionTitle}>Set match-day status for each player</h2>
                  <p style={sectionBodyTextStyle}>
                    Update each player&apos;s status and add optional notes for lineup building context.
                  </p>
                </div>

                <PrimaryBtn onClick={saveAvailability} disabled={saving || !selectedDate}>
                  {saving ? 'Saving...' : 'Save Availability'}
                </PrimaryBtn>
              </div>

              <div style={rosterGridResponsive(isSmallMobile, isTablet)}>
                {roster.map((player) => {
                  const current = availabilityMap[player.id] || {
                    status: 'available' as AvailabilityStatus,
                    notes: '',
                  }

                  return (
                    <article key={player.id} style={surfaceCard}>
                      <div style={playerTopStyle}>
                        <div>
                          <div style={playerNameStyle}>{player.name}</div>
                          <div style={playerMetaStyle}>
                            {player.appearances} appearance{player.appearances === 1 ? '' : 's'}
                            {' - '}
                            Preferred: <strong>{safeText(player.preferredRole, 'either')}</strong>
                            {player.flight ? ` - ${player.flight}` : ''}
                          </div>
                        </div>

                        <div style={ratingsStackStyle}>
                          <span style={statusPillFor(current.status)}>{statusLabel(current.status)}</span>
                          <div style={miniPillSlate}>TIQ {formatRating(player.overallDynamic)}</div>
                          <div style={miniPillSlate}>USTA {formatRating(player.overallUstaDynamic)}</div>
                          {(() => {
                            const s = getAvailRatingStatus(player)
                            if (!s) return null
                            return <div style={getAvailStatusStyle(s)}>{s}</div>
                          })()}
                        </div>
                      </div>

                      <div style={pillRowStyle}>
                        <span style={miniPillSlate}>S {formatRating(player.singlesDynamic)}</span>
                        <span style={miniPillSlate}>D {formatRating(player.doublesDynamic)}</span>
                      </div>

                      {player.lineupNotes ? <p style={lineupNoteStyle}>{player.lineupNotes}</p> : null}

                      <div style={statusGridResponsive(isSmallMobile)}>
                        {(
                          [
                            'available',
                            'unavailable',
                            'singles_only',
                            'doubles_only',
                            'limited',
                          ] as AvailabilityStatus[]
                        ).map((statusOption) => {
                          const isActive = current.status === statusOption

                          return (
                            <button
                              key={statusOption}
                              type="button"
                              onClick={() => updatePlayerStatus(player.id, statusOption)}
                              style={{
                                ...statusButtonStyle,
                                ...(isActive ? activeStatusButtonStyle : {}),
                              }}
                            >
                              {statusLabel(statusOption)}
                            </button>
                          )
                        })}
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <label style={labelStyle}>Notes</label>
                        <textarea
                          value={current.notes}
                          onChange={(e) => updatePlayerNotes(player.id, e.target.value)}
                          placeholder="Optional notes like late arrival, doubles only, court preference, or limited match-day window."
                          style={textareaStyle}
                        />
                      </div>
                    </article>
                  )
                })}
              </div>

              <div style={saveFooterStyle}>
                <PrimaryBtn onClick={saveAvailability} disabled={saving || !selectedDate}>
                  {saving ? 'Saving...' : 'Save Availability'}
                </PrimaryBtn>
              </div>
            </section>
          </>
        )}
      </section>

    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={heroMetricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyleHero}>{value}</div>
    </div>
  )
}

function toolControlShellResponsive(isTablet: boolean, isMobile: boolean): CSSProperties {
  return {
    ...toolControlShell,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1.45fr) minmax(min(100%, 300px), 0.95fr)',
    gap: isMobile ? '18px' : '24px',
    padding: isMobile ? '20px 18px' : '24px 22px',
    minWidth: 0,
  }
}

function filtersGridResponsive(isTablet: boolean): CSSProperties {
  return {
    ...filtersGridStyle,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))',
    minWidth: 0,
  }
}

function metricsGridResponsive(isSmallMobile: boolean, isTablet: boolean): CSSProperties {
  return {
    ...availabilityMetricsStyle,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : isTablet ? 'repeat(3, minmax(0, 1fr))' : 'repeat(6, minmax(0, 1fr))',
    minWidth: 0,
  }
}

function readinessGridResponsive(isSmallMobile: boolean, isTablet: boolean): CSSProperties {
  return {
    ...readinessGridStyle,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
    minWidth: 0,
  }
}

function rosterGridResponsive(isSmallMobile: boolean, isTablet: boolean): CSSProperties {
  return {
    ...rosterGridStyle,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
    minWidth: 0,
  }
}

function statusGridResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...statusGridStyle,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
    minWidth: 0,
  }
}

const pageStyle: CSSProperties = {
  minHeight: 0,
  position: 'relative',
  overflow: 'visible',
  background: 'transparent',
  padding: '12px 18px 56px',
  minWidth: 0,
}

const orbOne: CSSProperties = {
  display: 'none',
  position: 'absolute',
  top: '-100px',
  right: '-60px',
  width: 'min(100%, 360px)',
  height: '360px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(122,255,98,0.16), rgba(122,255,98,0) 68%)',
  filter: 'blur(10px)',
  pointerEvents: 'none',
}

const orbTwo: CSSProperties = {
  display: 'none',
  position: 'absolute',
  top: '60px',
  left: '-100px',
  width: 'min(100%, 320px)',
  height: '320px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(37,91,227,0.18), rgba(37,91,227,0) 70%)',
  filter: 'blur(12px)',
  pointerEvents: 'none',
}

const gridGlow: CSSProperties = {
  display: 'none',
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(var(--page-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--page-grid-line) 1px, transparent 1px)',
  backgroundSize: '64px 64px',
  maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.16), rgba(0,0,0,0))',
  pointerEvents: 'none',
}

const toolControlShell: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto 18px',
  display: 'grid',
  borderRadius: '34px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--portal-tool-surface-bg)',
  boxShadow: '0 34px 80px rgba(2,10,24,0.28)',
  minWidth: 0,
}

const toolControlHeaderStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minWidth: 0,
}

const toolControlTitleStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: 'clamp(1.45rem, 2.5vw, 2.1rem)',
  lineHeight: 1.08,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const toolControlButtonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 14,
  minWidth: 0,
}

const heroMetricCardStyle: CSSProperties = {
  borderRadius: '22px',
  padding: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const metricLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '0.82rem',
  marginBottom: '0.42rem',
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const metricValueStyleHero: CSSProperties = {
  color: '#f8fbff',
  fontSize: '1.05rem',
  fontWeight: 800,
  lineHeight: 1.4,
  overflowWrap: 'anywhere',
}

const captainReadCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  padding: '20px',
  minWidth: 0,
}

const captainReadTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 14,
  flexWrap: 'wrap',
  marginBottom: 16,
  minWidth: 0,
}

const captainReadTitle: CSSProperties = {
  margin: '6px 0',
  color: '#ffffff',
  fontSize: '30px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainReadText: CSSProperties = {
  margin: 0,
  color: 'rgba(219, 234, 254, 0.88)',
  fontSize: '.95rem',
  lineHeight: 1.6,
  fontWeight: 600,
  overflowWrap: 'anywhere',
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '18px',
  minWidth: 0,
}

const surfaceCardStrong: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: '0 28px 60px rgba(2, 8, 23, 0.14)',
  minWidth: 0,
}

const surfaceCard: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: '0 18px 40px rgba(0,0,0,0.12)',
  minWidth: 0,
}

const sectionCard: CSSProperties = {
  ...surfaceCardStrong,
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  flexWrap: 'wrap',
  marginBottom: '16px',
  minWidth: 0,
}

const sectionKicker: CSSProperties = {
  color: '#8fb7ff',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: 0,
  overflowWrap: 'anywhere',
}

const sectionTitle: CSSProperties = {
  margin: '8px 0',
  color: 'var(--foreground)',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: 0,
  lineHeight: 1.1,
  overflowWrap: 'anywhere',
}

const sectionTitleSmall: CSSProperties = {
  margin: '8px 0',
  color: 'var(--foreground)',
  fontWeight: 900,
  fontSize: '22px',
  letterSpacing: 0,
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}

const sectionBodyTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  maxWidth: 760,
  overflowWrap: 'anywhere',
}

const filtersGridStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  minWidth: 0,
}

const heroBadgeRowStyleCompact: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '14px',
  minWidth: 0,
}


function getAvailRatingStatus(player: RosterPlayer): AvailRatingStatus | null {
  const base = player.overallBase
  const usta = player.overallUstaDynamic
  if (base == null || usta == null) return null
  const diff = usta - base
  if (diff >= 0.15) return 'Bump Up Pace'
  if (diff >= 0.07) return 'Trending Up'
  if (diff > -0.07) return 'Holding'
  if (diff > -0.15) return 'At Risk'
  return 'Drop Watch'
}

function getAvailStatusStyle(status: AvailRatingStatus): CSSProperties {
  const base: CSSProperties = { borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 800, letterSpacing: '0.03em', display: 'inline-flex', alignItems: 'center', minWidth: 0, maxWidth: '100%', whiteSpace: 'normal' as const, overflowWrap: 'anywhere', textAlign: 'center' }
  switch (status) {
    case 'Bump Up Pace': return { ...base, background: 'rgba(155,225,29,0.12)', color: '#d9f84a', border: '1px solid rgba(155,225,29,0.24)' }
    case 'Trending Up':  return { ...base, background: 'rgba(52,211,153,0.12)', color: '#a7f3d0', border: '1px solid rgba(52,211,153,0.22)' }
    case 'Holding':      return { ...base, background: 'rgba(63,167,255,0.10)', color: '#bfdbfe', border: '1px solid rgba(63,167,255,0.20)' }
    case 'At Risk':      return { ...base, background: 'rgba(251,146,60,0.12)', color: '#fed7aa', border: '1px solid rgba(251,146,60,0.22)' }
    case 'Drop Watch':   return { ...base, background: 'rgba(239,68,68,0.12)', color: '#fecaca', border: '1px solid rgba(239,68,68,0.22)' }
  }
}

const miniPillSlate: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '7px 10px',
  borderRadius: '999px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  color: 'var(--foreground)',
  fontSize: '12px',
  fontWeight: 800,
  lineHeight: 1,
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const miniPillBlue: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '7px 10px',
  borderRadius: '999px',
  background: 'rgba(37, 91, 227, 0.16)',
  border: '1px solid rgba(143, 183, 255, 0.24)',
  color: 'var(--foreground)',
  fontSize: '12px',
  fontWeight: 800,
  lineHeight: 1,
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const pillRowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '10px',
  minWidth: 0,
}

const availabilityMetricsStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  minWidth: 0,
}

const readinessGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 16,
  minWidth: 0,
}

const readinessCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minHeight: 150,
  minWidth: 0,
}

const readinessCardTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const readinessLabelStyle: CSSProperties = {
  color: 'rgba(217, 231, 255, 0.72)',
  fontSize: '0.76rem',
  fontWeight: 900,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const readinessDetailStyle: CSSProperties = {
  margin: '14px 0 0',
  color: 'rgba(217, 231, 255, 0.78)',
  fontSize: '0.92rem',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const bulkActionsWrapStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const noticeStyle: CSSProperties = {
  marginTop: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: 'rgba(255, 214, 102, 0.14)',
  border: '1px solid rgba(255, 214, 102, 0.34)',
  color: '#fde68a',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const successBoxStyle: CSSProperties = {
  marginTop: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: 'rgba(112, 255, 165, 0.12)',
  border: '1px solid rgba(112, 255, 165, 0.30)',
  color: '#dffad5',
  overflowWrap: 'anywhere',
}

const rosterGridStyle: CSSProperties = {
  display: 'grid',
  gap: '16px',
  minWidth: 0,
}

const playerTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '12px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const playerNameStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '1.15rem',
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const playerMetaStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  marginTop: '6px',
  fontSize: '0.92rem',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const ratingsStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '8px',
  minWidth: 0,
}

const lineupNoteStyle: CSSProperties = {
  marginTop: '12px',
  marginBottom: 0,
  color: '#e7eefb',
  lineHeight: 1.58,
  fontSize: '.95rem',
  overflowWrap: 'anywhere',
}

const statusGridStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  marginTop: '14px',
  minWidth: 0,
}

const statusButtonStyle: CSSProperties = {
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: '#dbeafe',
  padding: '10px 12px',
  borderRadius: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const activeStatusButtonStyle: CSSProperties = {
  background: 'color-mix(in srgb, var(--brand-blue-2) 26%, var(--shell-chip-bg) 74%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 42%, var(--shell-panel-border) 58%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
}

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: 92,
  borderRadius: '14px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: '#f8fbff',
  padding: '12px 14px',
  fontSize: '14px',
  outline: 'none',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const saveFooterStyle: CSSProperties = {
  marginTop: '22px',
  display: 'flex',
  justifyContent: 'flex-start',
  flexWrap: 'wrap',
  minWidth: 0,
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 800,
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const ghostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 800,
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  border: '1px solid var(--shell-panel-border)',
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const ghostButtonSmall: CSSProperties = {
  ...ghostButton,
  minHeight: '42px',
}

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const inputStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  borderRadius: '14px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  padding: '0 14px',
  fontSize: '14px',
  outline: 'none',
  minWidth: 0,
}

const mutedTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  margin: 0,
  lineHeight: 1.65,
  overflowWrap: 'anywhere',
}

const errorTextStyle: CSSProperties = {
  color: '#fecaca',
  margin: 0,
  lineHeight: 1.65,
  overflowWrap: 'anywhere',
}

function PrimaryBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        ...primaryButton,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transform: hovered && !disabled ? 'translateY(-2px)' : 'none',
        boxShadow: hovered && !disabled ? '0 22px 40px rgba(39,205,110,0.30)' : primaryButton.boxShadow,
        transition: 'transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease',
      }}
    >
      {children}
    </button>
  )
}

function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      style={{ ...ghostButton, textDecoration: 'none', ...(hovered ? { background: 'rgba(30,50,80,0.95)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(2,10,24,0.28)' } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  )
}

function GhostBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ ...ghostButton, cursor: disabled ? 'not-allowed' : 'pointer', ...(hovered && !disabled ? { background: 'rgba(30,50,80,0.95)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(2,10,24,0.28)' } : {}), ...(disabled ? { opacity: 0.55 } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

function GhostSmallBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...ghostButtonSmall, cursor: 'pointer', ...(hovered ? { background: 'rgba(30,50,80,0.95)', transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(2,10,24,0.28)' } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}
