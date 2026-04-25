'use client'

export const dynamic = 'force-dynamic'

import Image from 'next/image'
import Link from 'next/link'
import CaptainSubnav from '@/app/components/captain-subnav'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { getClientAuthState } from '@/lib/auth'
import { readCaptainResumeState, writeCaptainResumeState } from '@/lib/captain-memory'
import { buildTeamEntityId } from '@/lib/entity-ids'
import { supabase } from '../../../lib/supabase'
import { formatDate, formatRating, cleanText, safeText } from '@/lib/captain-formatters'
import { type UserRole } from '@/lib/roles'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
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

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/players', label: 'Players' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/matchup', label: 'Matchup' },
  { href: '/leagues', label: 'Leagues' },
  { href: '/teams', label: 'Teams' },
  { href: '/captain', label: 'Captain Console' },
]

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
  return { ...base, background: 'rgba(255,255,255,0.08)', color: '#dfe8f8', borderColor: 'rgba(255,255,255,0.10)' }
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
  const router = useRouter()

  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

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

  useEffect(() => {
    let mounted = true

    async function loadRole() {
      try {
        const authState = await getClientAuthState()

        if (!authState.user) {
          if (mounted) {
            setRole('public')
            setAuthLoading(false)
          }
          router.replace('/login?next=/captain/lineup-availability')
          return
        }

        if (mounted) {
          setRole(authState.role)
          setEntitlements(authState.entitlements)
          setAuthLoading(false)
        }
      } catch {
        if (mounted) {
          setRole('public')
          setAuthLoading(false)
        }
        router.replace('/login?next=/captain/lineup-availability')
      }
    }

    void loadRole()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadRole()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

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
    void loadMatches()
  }, [refreshTick])

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

      if (!matchIds.length) {
        setRoster([])
        setAvailabilityMap({})
        setRosterLoading(false)
        return
      }

      const sideByMatchId = new Map<string, 'A' | 'B'>()

      for (const match of typedTeamMatches) {
        if (cleanText(match.home_team) === selectedTeam) sideByMatchId.set(match.id, 'A')
        if (cleanText(match.away_team) === selectedTeam) sideByMatchId.set(match.id, 'B')
      }

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
      const rosterMap = new Map<string, RosterPlayer>()

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
    if (!selectedLeagueKey || !selectedTeam) {
      setRoster([])
      setAvailabilityMap({})
      return
    }

    void loadRosterAndAvailability()
  }, [loadRosterAndAvailability, selectedLeagueKey, selectedTeam])

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

  const availabilitySignals = useMemo(
    () => [
      {
        label: 'Match scope',
        value: selectedDate ? formatDate(selectedDate) : 'Select match date',
        note: selectedTeam
          ? `${selectedTeam}${selectedLeagueLabel ? ` - ${selectedLeagueLabel}` : ''}`
          : 'Choose a team context before setting statuses.',
      },
      {
        label: 'Roster read',
        value: roster.length ? `${availabilitySummary.available} available / ${roster.length} total` : 'Roster pending',
        note:
          viability === 'Strong'
            ? 'You have enough playable options to build with flexibility.'
            : viability === 'Playable'
              ? 'Lineup decisions are workable, but the margin is tighter.'
              : 'This roster needs quick follow-up before lineup lock.',
      },
      {
        label: 'Best next move',
        value: !selectedLeagueKey
          ? 'Choose league context'
          : !selectedTeam
            ? 'Choose team'
            : !selectedDate
              ? 'Choose match date'
              : saving
                ? 'Saving availability'
                : 'Save and move to builder',
        note: selectedDate
          ? 'Saved availability feeds lineup projection and lineup builder.'
          : 'Lock the date so every status is tied to the right match.',
      },
    ],
    [availabilitySummary.available, roster.length, saving, selectedDate, selectedLeagueKey, selectedLeagueLabel, selectedTeam, viability]
  )

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

  if (authLoading) {
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

  return (
    <main style={pageStyle}>
      <div style={orbOne} />
      <div style={orbTwo} />
      <div style={gridGlow} />

      <header style={headerStyle}>
        <div style={headerInnerResponsive(isTablet)}>
          <Link href="/" style={brandWrap} aria-label="TenAceIQ home">
            <BrandWordmark compact={isMobile} top />
          </Link>

          <nav style={navStyleResponsive(isTablet)}>
            {NAV_LINKS.map((link) => {
              const isActive = link.href === '/captain'
              return (
                <Link key={link.href} href={link.href} style={{ ...navLink, ...(isActive ? activeNavLink : {}) }}>
                  {link.label}
                </Link>
              )
            })}
            <Link href="/admin" style={navLink}>Admin</Link>
          </nav>
        </div>
      </header>

      <section style={heroShellResponsive(isTablet, isMobile)}>
        <div>
          <div style={eyebrow}>Captain tools</div>
          <h1 style={heroTitleResponsive(isSmallMobile, isMobile)}>Lineup Availability</h1>
          <p style={heroTextStyle}>
            Set player availability for a team and match date so lineup decisions start from realistic
            captain inputs instead of guesswork.
          </p>

          <div style={heroButtonRowStyle}>
            <PrimaryBtn onClick={saveAvailability} disabled={saving || !selectedDate}>
              {saving ? 'Saving...' : 'Save Availability'}
            </PrimaryBtn>
            <GhostLink href="/captain/lineup-builder">Open Lineup Builder</GhostLink>
            <GhostBtn onClick={() => setRefreshTick((current) => current + 1)}>
              {loading || rosterLoading ? 'Refreshing...' : 'Refresh data'}
            </GhostBtn>
          </div>

          <div style={heroMetricGridStyle(isSmallMobile)}>
            <MetricStat label="League / Flight" value={selectedLeagueLabel || 'Not selected'} />
            <MetricStat label="Team" value={selectedTeam || 'Not selected'} />
            <MetricStat label="Viability" value={viability} />
          </div>

          <div style={signalGridStyle(isSmallMobile)}>
            {availabilitySignals.map((signal) => (
              <div key={signal.label} style={signalCardStyle}>
                <div style={signalLabelStyle}>{signal.label}</div>
                <div style={signalValueStyle}>{signal.value}</div>
                <div style={signalNoteStyle}>{signal.note}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={quickStartCard}>
          <div style={quickStartLabel}>Workflow</div>
          <div style={quickStartValue}>Choose, set, save</div>
          <div style={quickStartText}>
            Load the right roster, set each player’s status, capture notes, then save the match-date availability
            that feeds your builder and projection pages.
          </div>

          <div style={workflowListStyle}>
            {[
              ['1', 'Pick match context', 'Choose league, team, and date to pull the right roster usage pool.'],
              ['2', 'Set every player', 'Mark available, out, singles-only, doubles-only, or limited.'],
              ['3', 'Save once', 'Use the saved availability everywhere else in Captain’s Corner.'],
            ].map(([step, title, text]) => (
              <div key={step} style={workflowRowStyle}>
                <div style={workflowNumberStyle}>{step}</div>
                <div>
                  <div style={workflowTitleStyle}>{title}</div>
                  <div style={workflowTextStyle}>{text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {!access.canUseCaptainWorkflow ? (
        <section style={{ padding: '0 24px 24px' }}>
          <UpgradePrompt
            planId="captain"
            compact
            headline="Need lineup decisions that start from real availability?"
            body="Unlock Captain to save match-date availability, carry it into the builder, and stop guessing who is actually usable before you set the lineup."
            ctaLabel="Build Smarter Lineups"
            ctaHref="/pricing"
            secondaryLabel="See Captain plan"
            secondaryHref="/pricing"
            footnote="Best for captains who want one reliable workflow from roster status to final lineup."
          />
        </section>
      ) : null}

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
              Once selected, this page will load the roster usage history and let you set availability for the chosen match date.
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
                    Update each player’s status and add optional notes for lineup building context.
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

      <section style={{ padding: '0 24px 32px' }}>
        <CaptainSubnav
          title="Lineup Availability inside the captain command center"
          description="Jump between availability, lineup building, projection, messaging, and season management from any point in the captain workflow."
          tierLabel={access.captainTierLabel}
          tierActive={access.captainSubscriptionActive}
        />
      </section>

      <footer style={footerStyle}>
        <div style={footerInnerResponsive(isMobile)}>
          <div style={footerRowResponsive(isTablet)}>
            <Link href="/" style={footerBrandLink}>
              <BrandWordmark compact={false} footer />
            </Link>

            <div style={footerLinksResponsive(isTablet)}>
              <Link href="/players" style={footerUtilityLink}>Players</Link>
              <Link href="/rankings" style={footerUtilityLink}>Rankings</Link>
              <Link href="/matchup" style={footerUtilityLink}>Matchup</Link>
              <Link href="/leagues" style={footerUtilityLink}>Leagues</Link>
              <Link href="/teams" style={footerUtilityLink}>Teams</Link>
              <Link href="/captain" style={footerUtilityLink}>Captain Console</Link>
            </div>

            <div style={{ ...footerBottom, ...(isTablet ? {} : { marginLeft: 'auto' }) }}>
              © {new Date().getFullYear()} TenAceIQ
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}

function MetricStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={heroMetricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyleHero}>{value}</div>
    </div>
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

function BrandWordmark({
  compact = false,
  footer = false,
  top = false,
}: {
  compact?: boolean
  footer?: boolean
  top?: boolean
}) {
  const width = compact ? 176 : top ? 276 : footer ? 288 : 236
  const height = compact ? 30 : top ? 46 : footer ? 48 : 40

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: `${width}px`,
        height: `${height}px`,
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      <Image
        src="/logo-header-dark.svg"
        alt="TenAceIQ"
        fill
        priority
        sizes={`${width}px`}
        style={{
          objectFit: 'contain',
          objectPosition: 'left center',
          filter: footer
            ? 'drop-shadow(0 6px 14px rgba(5, 14, 30, 0.08))'
            : 'drop-shadow(0 6px 16px rgba(5, 14, 30, 0.10))',
        }}
      />
    </span>
  )
}

function headerInnerResponsive(isTablet: boolean): CSSProperties {
  return {
    ...headerInner,
    flexDirection: isTablet ? 'column' : 'row',
    alignItems: isTablet ? 'flex-start' : 'center',
    gap: isTablet ? '14px' : '18px',
  }
}

function navStyleResponsive(isTablet: boolean): CSSProperties {
  return {
    ...navStyle,
    width: isTablet ? '100%' : 'auto',
    justifyContent: isTablet ? 'flex-start' : 'flex-end',
    flexWrap: 'wrap',
  }
}

function heroShellResponsive(isTablet: boolean, isMobile: boolean): CSSProperties {
  return {
    ...heroShell,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.45fr) minmax(300px, 0.95fr)',
    gap: isMobile ? '18px' : '24px',
    padding: isMobile ? '26px 18px' : '34px 26px',
  }
}

function heroTitleResponsive(isSmallMobile: boolean, isMobile: boolean): CSSProperties {
  return {
    ...heroTitleStyle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '42px' : '50px',
  }
}

function heroMetricGridStyle(isSmallMobile: boolean): CSSProperties {
  return {
    ...heroMetricGridBaseStyle,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }
}

function filtersGridResponsive(isTablet: boolean): CSSProperties {
  return {
    ...filtersGridStyle,
    gridTemplateColumns: isTablet ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }
}

function metricsGridResponsive(isSmallMobile: boolean, isTablet: boolean): CSSProperties {
  return {
    ...availabilityMetricsStyle,
    gridTemplateColumns: isSmallMobile ? '1fr' : isTablet ? 'repeat(3, minmax(0, 1fr))' : 'repeat(6, minmax(0, 1fr))',
  }
}

function rosterGridResponsive(isSmallMobile: boolean, isTablet: boolean): CSSProperties {
  return {
    ...rosterGridStyle,
    gridTemplateColumns: isSmallMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
  }
}

function statusGridResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...statusGridStyle,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }
}

function footerInnerResponsive(isMobile: boolean): CSSProperties {
  return {
    ...footerInner,
    padding: isMobile ? '16px 16px 14px' : '16px 20px 14px',
  }
}

function footerRowResponsive(isTablet: boolean): CSSProperties {
  return {
    ...footerRow,
    flexDirection: isTablet ? 'column' : 'row',
    alignItems: isTablet ? 'flex-start' : 'center',
    gap: isTablet ? '12px' : '18px',
  }
}

function footerLinksResponsive(isTablet: boolean): CSSProperties {
  return {
    ...footerLinks,
    justifyContent: isTablet ? 'flex-start' : 'center',
  }
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  position: 'relative',
  overflow: 'hidden',
  background:
    'radial-gradient(circle at top, rgba(37,91,227,0.20), transparent 28%), linear-gradient(180deg, #050b17 0%, #071224 44%, #081527 100%)',
  padding: '24px 18px 56px',
}

const orbOne: CSSProperties = {
  position: 'absolute',
  top: '-100px',
  right: '-60px',
  width: '360px',
  height: '360px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(122,255,98,0.16), rgba(122,255,98,0) 68%)',
  filter: 'blur(10px)',
  pointerEvents: 'none',
}

const orbTwo: CSSProperties = {
  position: 'absolute',
  top: '60px',
  left: '-100px',
  width: '320px',
  height: '320px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(37,91,227,0.18), rgba(37,91,227,0) 70%)',
  filter: 'blur(12px)',
  pointerEvents: 'none',
}

const gridGlow: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
  backgroundSize: '64px 64px',
  maskImage: 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0))',
  pointerEvents: 'none',
}

const headerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto 18px',
}

const headerInner: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
}

const brandWrap: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  textDecoration: 'none',
}

const brandIQ: CSSProperties = {
  background: 'linear-gradient(135deg, #9ef767 0%, #55d8ae 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const navStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
}

const navLink: CSSProperties = {
  padding: '13px 18px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(12, 28, 52, 0.78)',
  color: '#e7eefb',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '15px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
}

const activeNavLink: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(29,60,108,0.94), rgba(25,92,78,0.82))',
  border: '1px solid rgba(130, 244, 118, 0.22)',
}

const heroShell: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto 18px',
  display: 'grid',
  borderRadius: '34px',
  border: '1px solid rgba(107, 162, 255, 0.18)',
  background: 'linear-gradient(135deg, rgba(7,29,61,0.96), rgba(7,20,39,0.96) 56%, rgba(18,58,50,0.9) 100%)',
  boxShadow: '0 34px 80px rgba(0,0,0,0.32)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  minHeight: '38px',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(130, 244, 118, 0.28)',
  background: 'rgba(89, 145, 73, 0.14)',
  color: '#d9e7ef',
  fontWeight: 800,
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
}

const heroTitleStyle: CSSProperties = {
  margin: 0,
  color: '#f7fbff',
  fontWeight: 900,
  lineHeight: 0.98,
  letterSpacing: '-0.055em',
  maxWidth: '760px',
}

const heroTextStyle: CSSProperties = {
  marginTop: 16,
  marginBottom: 0,
  maxWidth: 820,
  color: 'rgba(255,255,255,0.78)',
  fontSize: '1.02rem',
  lineHeight: 1.72,
}

const heroButtonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 22,
}

const heroMetricGridBaseStyle: CSSProperties = {
  marginTop: 22,
  display: 'grid',
  gap: '14px',
}

const heroMetricCardStyle: CSSProperties = {
  borderRadius: '22px',
  padding: '16px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.06)',
}

function signalGridStyle(isSmallMobile: boolean): CSSProperties {
  return {
    marginTop: 16,
    display: 'grid',
    gap: '12px',
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }
}

const signalCardStyle: CSSProperties = {
  borderRadius: '20px',
  padding: '16px 18px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.04))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const signalLabelStyle: CSSProperties = {
  color: 'rgba(217, 231, 255, 0.7)',
  fontSize: '0.72rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const signalValueStyle: CSSProperties = {
  marginTop: '0.45rem',
  color: '#f8fbff',
  fontSize: '1rem',
  fontWeight: 800,
  lineHeight: 1.35,
}

const signalNoteStyle: CSSProperties = {
  marginTop: '0.45rem',
  color: 'rgba(217, 231, 255, 0.72)',
  fontSize: '0.88rem',
  lineHeight: 1.5,
}

const metricLabelStyle: CSSProperties = {
  color: 'rgba(255,255,255,0.72)',
  fontSize: '0.82rem',
  marginBottom: '0.42rem',
  fontWeight: 700,
}

const metricValueStyleHero: CSSProperties = {
  color: '#f8fbff',
  fontSize: '1.05rem',
  fontWeight: 800,
  lineHeight: 1.4,
}

const quickStartCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'linear-gradient(180deg, rgba(37,56,84,0.88), rgba(21,37,64,0.88))',
  padding: '20px',
}

const quickStartLabel: CSSProperties = {
  color: 'rgba(217, 231, 255, 0.82)',
  fontSize: '12px',
  lineHeight: 1.5,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const quickStartValue: CSSProperties = {
  marginTop: 8,
  color: '#ffffff',
  fontSize: '30px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const quickStartText: CSSProperties = {
  marginTop: 10,
  color: 'rgba(219, 234, 254, 0.88)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
}

const workflowListStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 16,
}

const workflowRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
}

const workflowNumberStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: '.92rem',
  color: '#0f1632',
  background: 'linear-gradient(135deg, #c7ff5e 0%, #7dffb3 100%)',
  flexShrink: 0,
}

const workflowTitleStyle: CSSProperties = {
  fontWeight: 700,
  color: '#ffffff',
  marginBottom: 4,
}

const workflowTextStyle: CSSProperties = {
  color: 'rgba(255,255,255,0.72)',
  lineHeight: 1.55,
  fontSize: '.95rem',
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '18px',
}

const surfaceCardStrong: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: '0 28px 60px rgba(2, 8, 23, 0.14)',
}

const surfaceCard: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 18px 40px rgba(0,0,0,0.12)',
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
}

const sectionKicker: CSSProperties = {
  color: '#8fb7ff',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: 0,
}

const sectionTitle: CSSProperties = {
  margin: '8px 0',
  color: 'var(--foreground)',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: '-0.04em',
  lineHeight: 1.1,
}

const sectionTitleSmall: CSSProperties = {
  margin: '8px 0',
  color: 'var(--foreground)',
  fontWeight: 900,
  fontSize: '22px',
  letterSpacing: '-0.03em',
  lineHeight: 1.15,
}

const sectionBodyTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  maxWidth: 760,
}

const filtersGridStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
}

const heroBadgeRowStyleCompact: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '14px',
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
  const base: CSSProperties = { borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 800, letterSpacing: '0.03em', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' as const }
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
}

const pillRowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '10px',
}

const availabilityMetricsStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
}

const bulkActionsWrapStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
}

const noticeStyle: CSSProperties = {
  marginTop: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: 'rgba(255, 214, 102, 0.14)',
  border: '1px solid rgba(255, 214, 102, 0.34)',
  color: '#fde68a',
  lineHeight: 1.55,
}

const successBoxStyle: CSSProperties = {
  marginTop: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: 'rgba(112, 255, 165, 0.12)',
  border: '1px solid rgba(112, 255, 165, 0.30)',
  color: '#dffad5',
}

const rosterGridStyle: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const playerTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '12px',
}

const playerNameStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '1.15rem',
  fontWeight: 800,
}

const playerMetaStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  marginTop: '6px',
  fontSize: '0.92rem',
  lineHeight: 1.55,
}

const ratingsStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '8px',
}

const lineupNoteStyle: CSSProperties = {
  marginTop: '12px',
  marginBottom: 0,
  color: '#e7eefb',
  lineHeight: 1.58,
  fontSize: '.95rem',
}

const statusGridStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  marginTop: '14px',
}

const statusButtonStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)',
  color: '#dbeafe',
  padding: '10px 12px',
  borderRadius: '12px',
  fontWeight: 700,
  cursor: 'pointer',
}

const activeStatusButtonStyle: CSSProperties = {
  background: 'linear-gradient(135deg, #255BE3 0%, #3d7cff 100%)',
  color: '#ffffff',
  border: '1px solid #255BE3',
  boxShadow: '0 10px 24px rgba(37, 91, 227, 0.22)',
}

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: 92,
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#f8fbff',
  padding: '12px 14px',
  fontSize: '14px',
  outline: 'none',
}

const saveFooterStyle: CSSProperties = {
  marginTop: '22px',
  display: 'flex',
  justifyContent: 'flex-start',
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
  background: 'linear-gradient(135deg, #67f19a, #28cd6e)',
  color: '#071622',
  border: '1px solid rgba(133, 171, 255, 0.18)',
  boxShadow: '0 16px 32px rgba(26, 74, 196, 0.16)',
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
}

const mutedTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  margin: 0,
  lineHeight: 1.65,
}

const errorTextStyle: CSSProperties = {
  color: '#fecaca',
  margin: 0,
  lineHeight: 1.65,
}

const footerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  padding: '28px 0 0',
}

const footerInner: CSSProperties = {
  width: '100%',
  maxWidth: '1240px',
  margin: '0 auto',
  borderRadius: '22px',
  background: 'rgba(17,31,58,0.72)',
  border: '1px solid rgba(128,174,255,0.12)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const footerRow: CSSProperties = {
  display: 'flex',
  width: '100%',
}

const footerBrandLink: CSSProperties = {
  display: 'inline-flex',
  textDecoration: 'none',
  flexShrink: 0,
}

const footerLinks: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px 14px',
}

const footerUtilityLink: CSSProperties = {
  color: 'rgba(231,243,255,0.86)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
}

const footerBottom: CSSProperties = {
  color: 'rgba(190,205,224,0.74)',
  fontSize: '13px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
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
