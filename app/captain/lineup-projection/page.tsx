'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import LockedPlanPage from '@/app/components/locked-plan-page'
import SiteShell from '@/app/components/site-shell'
import CaptainSuitePanel from '@/app/components/captain-suite-panel'
import { useAuth } from '@/app/components/auth-provider'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { readCaptainResumeState, writeCaptainResumeState } from '@/lib/captain-memory'
import { formatDate, formatRating, normalizeTeamName, safeText } from '@/lib/captain-formatters'
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

type PlayerRelation =
  | {
      id: string
      name: string
      flight: string | null
      overall_rating: number | null
      overall_dynamic_rating: number | null
      overall_usta_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      singles_usta_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
      doubles_usta_dynamic_rating: number | null
      preferred_role: string | null
      lineup_notes: string | null
    }
  | {
      id: string
      name: string
      flight: string | null
      overall_rating: number | null
      overall_dynamic_rating: number | null
      overall_usta_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      singles_usta_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
      doubles_usta_dynamic_rating: number | null
      preferred_role: string | null
      lineup_notes: string | null
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

type ProjectionRatingStatus = 'Bump Up Pace' | 'Trending Up' | 'Holding' | 'At Risk' | 'Drop Watch'

type RosterPlayer = {
  id: string
  name: string
  flight: string | null
  appearances: number
  overallBase: number | null
  singlesDynamic: number | null
  singlesUstaDynamic: number | null
  doublesDynamic: number | null
  doublesUstaDynamic: number | null
  overallDynamic: number | null
  overallUstaDynamic: number | null
  preferredRole: string | null
  lineupNotes: string | null
  availabilityStatus: AvailabilityStatus
  availabilityNotes: string
}

type LeagueOption = {
  leagueName: string
  flight: string
}

type DoublesPair = {
  player1: RosterPlayer
  player2: RosterPlayer
  combinedDoubles: number
  notes: string[]
}

type ProjectionActionCard = {
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

function getAvailabilityLabel(status: AvailabilityStatus) {
  if (status === 'available') return 'Available'
  if (status === 'unavailable') return 'Unavailable'
  if (status === 'singles_only') return 'Singles Only'
  if (status === 'doubles_only') return 'Doubles Only'
  return 'Limited'
}

function canPlaySingles(player: RosterPlayer) {
  return player.availabilityStatus !== 'unavailable' && player.availabilityStatus !== 'doubles_only'
}

function canPlayDoubles(player: RosterPlayer) {
  return player.availabilityStatus !== 'unavailable' && player.availabilityStatus !== 'singles_only'
}

function limitedPenalty(player: RosterPlayer) {
  return player.availabilityStatus === 'limited' ? 0.03 : 0
}

function preferredRoleBonusSingles(player: RosterPlayer) {
  if (player.preferredRole === 'singles') return 0.03
  if (player.preferredRole === 'doubles') return -0.03
  return 0
}

function preferredRoleBonusDoubles(player: RosterPlayer) {
  if (player.preferredRole === 'doubles') return 0.03
  if (player.preferredRole === 'singles') return -0.03
  return 0
}

function adjustedSinglesScore(player: RosterPlayer) {
  const base = typeof player.singlesDynamic === 'number' ? player.singlesDynamic : -999
  return base + preferredRoleBonusSingles(player) - limitedPenalty(player)
}

function adjustedDoublesScore(player: RosterPlayer) {
  const base = typeof player.doublesDynamic === 'number' ? player.doublesDynamic : -999
  return base + preferredRoleBonusDoubles(player) - limitedPenalty(player)
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function readInitialLineupProjectionContext() {
  if (typeof window === 'undefined') {
    return {
      competitionLayer: '',
      selectedLeagueKey: '',
      selectedTeam: '',
      selectedDate: '',
      opponentTeam: '',
    }
  }

  const params = new URLSearchParams(window.location.search)
  const resumeState = readCaptainResumeState()
  const league = params.get('league') ?? resumeState?.league ?? ''
  const flight = params.get('flight') ?? resumeState?.flight ?? ''

  return {
    competitionLayer: params.get('layer') ?? resumeState?.competitionLayer ?? '',
    selectedLeagueKey: league || flight ? buildLeagueKey(league, flight) : '',
    selectedTeam: params.get('team') ?? resumeState?.team ?? '',
    selectedDate: params.get('date') ?? resumeState?.eventDate ?? '',
    opponentTeam: params.get('opponent') ?? resumeState?.opponentTeam ?? '',
  }
}

export default function LineupProjectionPage() {
  return (
    <SiteShell active="/captain">
      <LineupProjectionContent />
    </SiteShell>
  )
}

function LineupProjectionContent() {
  const router = useRouter()
  const { role, entitlements, authResolved } = useAuth()
  const initialContext = readInitialLineupProjectionContext()

  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [competitionLayer] = useState(initialContext.competitionLayer)
  const [selectedLeagueKey, setSelectedLeagueKey] = useState(initialContext.selectedLeagueKey)
  const [selectedTeam, setSelectedTeam] = useState(initialContext.selectedTeam)
  const [selectedDate, setSelectedDate] = useState(initialContext.selectedDate)
  const [opponentTeam] = useState(initialContext.opponentTeam)

  const [rosterLoading, setRosterLoading] = useState(false)
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [refreshTick, setRefreshTick] = useState(0)
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  useEffect(() => {
    if (!authResolved || role !== 'public') {
      return
    }
    router.replace('/login?next=/captain/lineup-projection')
  }, [authResolved, role, router])

  useEffect(() => {
    if (!authResolved || role === 'public') return
    void loadLeaguesAndTeams()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authResolved, role, refreshTick])

  useEffect(() => {
    if (!selectedLeagueKey || !selectedTeam) {
      setRoster([])
      return
    }

    if (!authResolved || role === 'public') return
    void loadTeamRoster()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeagueKey, selectedTeam, selectedDate, authResolved, role])

  useEffect(() => {
    const [leagueName = '', flight = ''] = selectedLeagueKey.split('___')
    writeCaptainResumeState({
      competitionLayer: competitionLayer || undefined,
      team: selectedTeam || undefined,
      league: leagueName || undefined,
      flight: flight || undefined,
      eventDate: selectedDate || undefined,
      opponentTeam: opponentTeam || undefined,
      lastTool: 'lineup-projection',
      lastToolLabel: 'Lineup Projection',
    })
  }, [competitionLayer, opponentTeam, selectedLeagueKey, selectedTeam, selectedDate])

  const loadLeaguesAndTeams = useCallback(async () => {
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
      setError(err instanceof Error ? err.message : 'Failed to load lineup data.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTeamRoster = useCallback(async () => {
    setRosterLoading(true)
    setError('')

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
            overall_rating,
            overall_dynamic_rating,
            overall_usta_dynamic_rating,
            singles_dynamic_rating,
            singles_usta_dynamic_rating,
            doubles_dynamic_rating,
            doubles_usta_dynamic_rating,
            preferred_role,
            lineup_notes
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
        if (safeText(match.home_team) === selectedTeam) sideByMatchId.set(match.id, 'A')
        if (safeText(match.away_team) === selectedTeam) sideByMatchId.set(match.id, 'B')
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
          appearances: 0,
          overallBase: player?.overall_rating ?? row.ntrp,
          singlesDynamic: player?.singles_dynamic_rating ?? row.ntrp,
          singlesUstaDynamic: player?.singles_usta_dynamic_rating ?? null,
          doublesDynamic: player?.doubles_dynamic_rating ?? row.ntrp,
          doublesUstaDynamic: player?.doubles_usta_dynamic_rating ?? null,
          overallDynamic: player?.overall_dynamic_rating ?? row.ntrp,
          overallUstaDynamic: player?.overall_usta_dynamic_rating ?? null,
          preferredRole: player?.preferred_role ?? null,
          lineupNotes: player?.lineup_notes ?? 'No imported match history yet',
          availabilityStatus: 'available',
          availabilityNotes: '',
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
              overall_rating,
              overall_dynamic_rating,
              overall_usta_dynamic_rating,
              singles_dynamic_rating,
              singles_usta_dynamic_rating,
              doubles_dynamic_rating,
              doubles_usta_dynamic_rating,
              preferred_role,
              lineup_notes
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
              appearances: 0,
              overallBase: player.overall_rating,
              singlesDynamic: player.singles_dynamic_rating,
              singlesUstaDynamic: player.singles_usta_dynamic_rating,
              doublesDynamic: player.doubles_dynamic_rating,
              doublesUstaDynamic: player.doubles_usta_dynamic_rating,
              overallDynamic: player.overall_dynamic_rating,
              overallUstaDynamic: player.overall_usta_dynamic_rating,
              preferredRole: player.preferred_role,
              lineupNotes: player.lineup_notes,
              availabilityStatus: 'available',
              availabilityNotes: '',
            })
          }

          rosterMap.get(player.id)!.appearances += 1
        }
      }

      const rosterList = [...rosterMap.values()]

      if (selectedDate) {
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
        const availabilityByPlayerId = new Map<string, AvailabilityRow>(
          typedAvailability.map((row) => [row.player_id, row])
        )

        for (const player of rosterList) {
          const availability = availabilityByPlayerId.get(player.id)
          if (availability) {
            player.availabilityStatus = availability.status
            player.availabilityNotes = availability.notes || ''
          }
        }
      }

      rosterList.sort((a, b) => {
        const aSingles = typeof a.singlesDynamic === 'number' ? a.singlesDynamic : -999
        const bSingles = typeof b.singlesDynamic === 'number' ? b.singlesDynamic : -999

        if (bSingles !== aSingles) return bSingles - aSingles
        if (b.appearances !== a.appearances) return b.appearances - a.appearances
        return a.name.localeCompare(b.name)
      })

      setRoster(rosterList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team roster.')
    } finally {
      setRosterLoading(false)
    }
  }, [selectedLeagueKey, selectedTeam, selectedDate])

  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])

  const leagueOptions = useMemo<LeagueOption[]>(() => {
    const map = new Map<string, LeagueOption>()

    for (const row of matches) {
      const leagueName = safeText(row.league_name)
      const flight = safeText(row.flight)
      const key = buildLeagueKey(leagueName, flight)

      if (!map.has(key)) {
        map.set(key, { leagueName, flight })
      }
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
      if (safeText(row.league_name) !== leagueName) continue
      if (safeText(row.flight) !== flight) continue

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
      if (safeText(row.league_name) !== leagueName) continue
      if (safeText(row.flight) !== flight) continue

      const teamMatch =
        safeText(row.home_team) === selectedTeam || safeText(row.away_team) === selectedTeam

      if (teamMatch && row.match_date) {
        dateSet.add(row.match_date)
      }
    }

    return [...dateSet].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  }, [matches, selectedLeagueKey, selectedTeam])

  const singlesProjection = useMemo(() => {
    return [...roster]
      .filter(canPlaySingles)
      .sort((a, b) => {
        const aValue = adjustedSinglesScore(a)
        const bValue = adjustedSinglesScore(b)
        if (bValue !== aValue) return bValue - aValue
        return b.appearances - a.appearances
      })
      .slice(0, 6)
  }, [roster])

  const doublesPairs = useMemo<DoublesPair[]>(() => {
    const players = [...roster]
      .filter(canPlayDoubles)
      .filter((player) => typeof player.doublesDynamic === 'number')
      .sort((a, b) => {
        const aValue = adjustedDoublesScore(a)
        const bValue = adjustedDoublesScore(b)
        if (bValue !== aValue) return bValue - aValue
        return b.appearances - a.appearances
      })

    const pairs: DoublesPair[] = []

    for (let i = 0; i < players.length; i += 1) {
      for (let j = i + 1; j < players.length; j += 1) {
        const player1 = players[i]
        const player2 = players[j]
        const notes: string[] = []

        if (player1.availabilityStatus === 'limited' || player2.availabilityStatus === 'limited') {
          notes.push('Includes limited-availability player')
        }

        if (player1.preferredRole === 'doubles' && player2.preferredRole === 'doubles') {
          notes.push('Strong doubles-role fit')
        }

        if (player1.preferredRole === 'singles' && player2.preferredRole === 'singles') {
          notes.push('Lower doubles-role fit')
        }

        const combinedDoubles = (adjustedDoublesScore(player1) + adjustedDoublesScore(player2)) / 2

        pairs.push({
          player1,
          player2,
          combinedDoubles,
          notes,
        })
      }
    }

    return pairs.sort((a, b) => b.combinedDoubles - a.combinedDoubles).slice(0, 8)
  }, [roster])

  const suggestedLineup = useMemo(() => {
    const topSingles = singlesProjection.slice(0, 2)
    const usedIds = new Set<string>(topSingles.map((player) => player.id))
    const topPairs: DoublesPair[] = []

    for (const pair of doublesPairs) {
      if (usedIds.has(pair.player1.id) || usedIds.has(pair.player2.id)) continue

      topPairs.push(pair)
      usedIds.add(pair.player1.id)
      usedIds.add(pair.player2.id)

      if (topPairs.length === 3) break
    }

    const notes: string[] = []

    if (roster.some((player) => player.availabilityStatus === 'unavailable')) {
      notes.push('Unavailable players were excluded.')
    }

    if (roster.some((player) => player.availabilityStatus === 'limited')) {
      notes.push('Limited players were included only if they still graded out strongly.')
    }

    if (roster.some((player) => player.availabilityStatus === 'singles_only')) {
      notes.push('Singles-only players were kept out of doubles pairings.')
    }

    if (roster.some((player) => player.availabilityStatus === 'doubles_only')) {
      notes.push('Doubles-only players were kept out of singles lines.')
    }

    return {
      singles: topSingles,
      doubles: topPairs,
      notes,
    }
  }, [singlesProjection, doublesPairs, roster])

  const selectedLeagueDisplayLabel = useMemo(() => {
    if (!selectedLeagueKey) return ''
    const [leagueName, flight] = selectedLeagueKey.split('___')
    return `${leagueName} - ${flight}`
  }, [selectedLeagueKey])

  const availabilitySummary = useMemo(() => {
    let available = 0
    let unavailable = 0
    let singlesOnly = 0
    let doublesOnly = 0
    let limited = 0

    for (const player of roster) {
      if (player.availabilityStatus === 'available') available += 1
      if (player.availabilityStatus === 'unavailable') unavailable += 1
      if (player.availabilityStatus === 'singles_only') singlesOnly += 1
      if (player.availabilityStatus === 'doubles_only') doublesOnly += 1
      if (player.availabilityStatus === 'limited') limited += 1
    }

    return { available, unavailable, singlesOnly, doublesOnly, limited }
  }, [roster])

  const lineupStrength = useMemo(() => {
    const singles = suggestedLineup.singles
      .map((player) => player.singlesDynamic)
      .filter((value): value is number => typeof value === 'number')
    const doubles = suggestedLineup.doubles.map((pair) => pair.combinedDoubles)

    const all = [...singles, ...doubles]
    return all.length ? average(all) : 0
  }, [suggestedLineup])

  const confidenceLabel = useMemo(() => {
    if (lineupStrength >= 4.5) return 'Strong'
    if (lineupStrength >= 4.0) return 'Balanced'
    return 'Risky'
  }, [lineupStrength])

  const projectionActionCards = useMemo<ProjectionActionCard[]>(() => {
    const playableCount = roster.filter((player) => player.availabilityStatus !== 'unavailable').length
    const singlesCount = roster.filter(canPlaySingles).length
    const doublesPairCount = Math.floor(roster.filter(canPlayDoubles).length / 2)
    const restrictionCount = availabilitySummary.singlesOnly + availabilitySummary.doublesOnly + availabilitySummary.limited

    return [
      {
        label: 'Trust level',
        value: confidenceLabel,
        detail:
          confidenceLabel === 'Strong'
            ? 'This projection is a useful starting point. Take it into the builder and fine-tune courts.'
            : confidenceLabel === 'Balanced'
              ? 'Good enough for a first pass. Check availability restrictions before saving.'
              : 'Treat this as a warning read. Fix availability or roster depth before trusting the lineup.',
        tone: confidenceLabel === 'Strong' ? 'green' : confidenceLabel === 'Balanced' ? 'amber' : 'red',
      },
      {
        label: 'Lineup cover',
        value: `${playableCount} playable`,
        detail:
          playableCount >= 7
            ? 'You have enough playable players for a normal lineup plus movement.'
            : playableCount >= 5
              ? 'You can build, but the bench is thin.'
              : 'Too few playable players for a comfortable lineup.',
        tone: playableCount >= 7 ? 'green' : playableCount >= 5 ? 'amber' : 'red',
      },
      {
        label: 'Court shape',
        value: `${singlesCount} S / ${doublesPairCount} D`,
        detail:
          singlesCount >= 2 && doublesPairCount >= 3
            ? 'Singles and doubles both have enough eligible options.'
            : 'One court group is tight. Review role-only players before sending to the builder.',
        tone: singlesCount >= 2 && doublesPairCount >= 3 ? 'green' : 'amber',
      },
      {
        label: 'Next move',
        value: restrictionCount ? 'Resolve flags' : 'Build it',
        detail: restrictionCount
          ? `${restrictionCount} restriction${restrictionCount === 1 ? '' : 's'} could change the suggested lineup.`
          : 'No restrictions are blocking the projection. Move it into the builder.',
        tone: restrictionCount ? 'blue' : 'green',
      },
    ]
  }, [availabilitySummary, confidenceLabel, roster])

  const builderHrefResolved = useMemo(() => {
    const params = new URLSearchParams()
    if (selectedLeagueKey) {
      const [leagueName, flight] = selectedLeagueKey.split('___')
      if (leagueName) params.set('league', leagueName)
      if (flight) params.set('flight', flight)
    }
    if (competitionLayer) params.set('layer', competitionLayer)
    if (selectedTeam) params.set('team', selectedTeam)
    if (selectedDate) params.set('date', selectedDate)
    if (opponentTeam) params.set('opponent', opponentTeam)
    const query = params.toString()
    return query ? `/captain/lineup-builder?${query}` : '/captain/lineup-builder'
  }, [competitionLayer, opponentTeam, selectedLeagueKey, selectedTeam, selectedDate])

  if (!authResolved) {
    return (
      <main style={pageStyle}>
        <div style={orbOne} />
        <div style={orbTwo} />
        <div style={gridGlow} />
        <section style={{ maxWidth: '1240px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div style={stateBox}>Loading lineup projection...</div>
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
        headline="Need schedule context to become lineup prep?"
        body="Unlock Captain to turn match context, team scope, and player availability into a lineup projection you can take straight into the builder."
        ctaLabel="Unlock Captain"
        secondaryLabel="Back to Captain"
        secondaryHref="/captain"
      />
    )
  }

  return (
    <div style={pageWrap}>
      <CaptainSuitePanel active="projection" teamLabel={selectedTeam || 'Team week'} />
      <section style={toolControlShellResponsive(isTablet, isMobile)} aria-label="Projection controls">
        <span aria-hidden="true" style={watermarkStyle} />
        <div>
          <div style={toolControlHeaderStyle}>
            <div>
              <p style={sectionKicker}>Projection controls</p>
              <h1 style={toolControlTitleStyle}>Preview a lineup.</h1>
            </div>
            <span style={roster.length ? miniPillGreen : miniPillSlate}>
              {roster.length ? confidenceLabel : 'Set context'}
            </span>
          </div>

          <div style={toolControlButtonRowStyle}>
            <PrimaryLink href={builderHrefResolved}>Build in Lineup Builder</PrimaryLink>
            <GhostLink href="/captain">Back to Captain</GhostLink>
            <GhostBtn onClick={() => setRefreshTick((current) => current + 1)}>
              {loading || rosterLoading ? 'Refreshing...' : 'Refresh data'}
            </GhostBtn>
          </div>
        </div>

        <div style={captainReadCard}>
          <div style={captainReadTop}>
            <div>
              <p style={sectionKicker}>Projection status</p>
              <h2 style={captainReadTitle}>{selectedTeam || 'Choose a team'}</h2>
              <p style={captainReadText}>{selectedLeagueDisplayLabel || 'League and flight pending'}</p>
            </div>
            <span style={roster.length ? miniPillGreen : miniPillSlate}>
              {roster.length ? 'Ready' : 'Set context'}
            </span>
          </div>

          <div style={heroBadgeRowStyleCompact}>
            <span style={miniPillSlate}>{selectedLeagueKey ? 'League selected' : 'Pick a league'}</span>
            <span style={miniPillSlate}>{selectedTeam ? 'Team selected' : 'Pick a team'}</span>
            <span style={miniPillSlate}>{roster.length ? `${roster.length} loaded` : 'Roster pending'}</span>
          </div>

          <p style={captainReadText}>
            The projection updates from the filters below, then opens straight into Lineup Builder when the read is useful.
          </p>
        </div>
      </section>

      <section style={contentWrap}>
        <section style={surfaceCardStrong}>
          <div style={sectionHeaderStyle}>
            <div>
              <p style={sectionKicker}>Filters</p>
              <h2 style={sectionTitle}>Choose your team context</h2>
              <p style={sectionBodyTextStyle}>
                Start with league, team, and optional match date. Then the page will rebuild your current projection.
              </p>
            </div>
          </div>

          <div style={filterGridResponsive(isTablet)}>
            <div>
              <label style={labelStyle}>League / Flight</label>
              <select
                value={selectedLeagueKey}
                onChange={(e) => {
                  setSelectedLeagueKey(e.target.value)
                  setSelectedTeam('')
                  setSelectedDate('')
                  setRoster([])
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
              <label style={labelStyle}>Match Date (optional)</label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={inputStyle}
                disabled={!selectedTeam}
              >
                <option value="">No date filter</option>
                {relevantDates.map((date) => (
                  <option key={date} value={date}>{formatDate(date)}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={stateBox}>Loading lineup data...</div>
          ) : error ? (
            <div style={errorBox}>
              <div>{error}</div>
              <div style={stateHelperTextStyle}>
                Refresh the projection data to retry without leaving the page.
              </div>
              <div style={{ marginTop: 12 }}>
                <GhostBtn onClick={() => setRefreshTick((current) => current + 1)}>Retry projection load</GhostBtn>
              </div>
            </div>
          ) : !selectedLeagueKey || !selectedTeam ? (
            <div style={stateBox}>
              Choose a league and team to generate a projected lineup.
              <div style={stateHelperTextStyle}>
                Start broad, then optionally narrow by match date if you want this estimate to reflect a specific availability snapshot.
              </div>
            </div>
          ) : rosterLoading ? (
            <div style={stateBox}>Loading roster...</div>
          ) : roster.length === 0 ? (
            <div style={stateBox}>
              No roster usage found for this team yet.
              <div style={stateHelperTextStyle}>
                Try another team, remove the date filter, or open the lineup builder to start a manual scenario while roster history catches up.
              </div>
            </div>
          ) : (
            <>
              <div style={heroBadgeRowStyleCompact}>
                <span style={miniPillBlue}><strong>{selectedTeam}</strong></span>
                <span style={miniPillSlate}><strong>{selectedLeagueDisplayLabel}</strong></span>
                {selectedDate ? <span style={miniPillSlate}>Date: <strong>{formatDate(selectedDate)}</strong></span> : null}
                <span style={miniPillGreen}><strong>{roster.length}</strong> players</span>
              </div>

              <div style={heroBadgeRowStyleCompact}>
                <SummaryPill label="Available" value={availabilitySummary.available} tone="green" />
                <SummaryPill label="Unavailable" value={availabilitySummary.unavailable} tone="red" />
                <SummaryPill label="Singles Only" value={availabilitySummary.singlesOnly} tone="blue" />
                <SummaryPill label="Doubles Only" value={availabilitySummary.doublesOnly} tone="purple" />
                <SummaryPill label="Limited" value={availabilitySummary.limited} tone="amber" />
              </div>
            </>
          )}
        </section>

        {!!roster.length && !rosterLoading ? (
          <>
            <section style={projectionGridResponsive(isSmallMobile, isTablet)}>
              <ProjectionCard
                label="Projected lineup strength"
                value={lineupStrength.toFixed(2)}
                subtext="Average of projected singles and doubles strength scores."
              />
              <ProjectionCard
                label="Confidence"
                value={confidenceLabel}
                subtext="Simple confidence read based on the projected lineup strength."
              />
              <ProjectionCard
                label="Builder ready"
                value={selectedTeam && roster.length ? 'Yes' : 'No'}
                subtext="Carry this scoped estimate into the full Lineup Builder when you are ready to save a scenario."
                accent
              />
            </section>

            <section style={sectionCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Captain action read</p>
                  <h2 style={sectionTitle}>What to do with this projection</h2>
                  <p style={sectionBodyTextStyle}>
                    Use this as the bridge between availability and a saved lineup scenario.
                  </p>
                </div>
                <PrimaryLink href={builderHrefResolved}>Open Builder</PrimaryLink>
              </div>

              <div style={actionReadGridResponsive(isSmallMobile, isTablet)}>
                {projectionActionCards.map((card) => (
                  <div key={card.label} style={actionReadCardStyle}>
                    <div style={actionReadTopStyle}>
                      <span style={actionReadLabelStyle}>{card.label}</span>
                      <span style={summaryPillStyle(card.tone)}>{card.value}</span>
                    </div>
                    <p style={actionReadDetailStyle}>{card.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section style={surfaceCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Projection readiness</p>
                  <h2 style={sectionTitle}>What this estimate is based on</h2>
                </div>
              </div>
              <div style={projectionGridResponsive(isSmallMobile, isTablet)}>
                <ProjectionCard
                  label="League context"
                  value={selectedLeagueKey ? 'Ready' : 'Missing'}
                  subtext={selectedLeagueDisplayLabel || 'Choose the exact league and flight first.'}
                />
                <ProjectionCard
                  label="Team context"
                  value={selectedTeam ? 'Ready' : 'Missing'}
                  subtext={selectedTeam || 'Select the roster you want to project.'}
                />
                <ProjectionCard
                  label="Roster confidence"
                  value={roster.length ? confidenceLabel : 'Low'}
                  subtext={roster.length ? `${roster.length} players are informing this estimate.` : 'No team roster is loaded into the projection yet.'}
                />
              </div>
            </section>

            <section style={sectionCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Suggested lineup</p>
                  <h2 style={sectionTitle}>Best current estimate</h2>
                  <p style={sectionBodyTextStyle}>Uses ratings, availability, and role preferences.</p>
                </div>
              </div>

              <div style={compareGridResponsive(isTablet)}>
                <div style={surfaceCard}>
                  <div style={cardTitleStyle}>Projected Singles</div>
                  {suggestedLineup.singles.length ? (
                    suggestedLineup.singles.map((player, index) => (
                      <div key={player.id} style={lineItemStyle}>
                        <div style={lineMainStyle}>
                          <strong>S{index + 1}:</strong> {player.name}
                        </div>
                        <div style={lineMetaStyle}>
                          Singles DR: {formatRating(player.singlesDynamic)} - {getAvailabilityLabel(player.availabilityStatus)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={emptyMiniStyle}>Not enough eligible singles players.</div>
                  )}
                </div>

                <div style={surfaceCard}>
                  <div style={cardTitleStyle}>Projected Doubles</div>
                  {suggestedLineup.doubles.length ? (
                    suggestedLineup.doubles.map((pair, index) => (
                      <div key={`${pair.player1.id}-${pair.player2.id}`} style={lineItemStyle}>
                        <div style={lineMainStyle}>
                          <strong>D{index + 1}:</strong> {pair.player1.name} / {pair.player2.name}
                        </div>
                        <div style={lineMetaStyle}>Pair DR: {pair.combinedDoubles.toFixed(2)}</div>
                        {pair.notes.length ? <div style={lineNoteStyle}>{pair.notes.join(' - ')}</div> : null}
                      </div>
                    ))
                  ) : (
                    <div style={emptyMiniStyle}>Not enough eligible doubles players.</div>
                  )}
                </div>
              </div>

              {suggestedLineup.notes.length ? (
                <div style={surfaceCardStrongInset}>
                  <div style={notesTitleStyle}>Captain suggestions</div>
                  <div style={notesListStyle}>
                    {suggestedLineup.notes.map((note) => (
                      <div key={note} style={noteRowStyle}>- {note}</div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section style={sectionCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Roster pool</p>
                  <h2 style={sectionTitle}>Available team pool</h2>
                  <p style={sectionBodyTextStyle}>Current roster after applying match-date availability.</p>
                </div>
              </div>

              <div style={rosterGridResponsive(isSmallMobile, isTablet)}>
                {roster.map((player) => {
                  const rStatus = getProjectionRatingStatus(player)
                  return (
                  <div key={player.id} style={surfaceCard}>
                    <div style={playerNameStyle}>{player.name}</div>
                    <div style={playerMetaStyle}>
                      {player.appearances} appearances - Flight {safeText(player.flight)}
                    </div>

                    <div style={pillRowStyle}>
                      <span style={statusPillFor(player.availabilityStatus)}>{getAvailabilityLabel(player.availabilityStatus)}</span>
                      {player.preferredRole ? <span style={miniPillSlate}>Prefers {player.preferredRole}</span> : null}
                      {rStatus ? <span style={getProjectionStatusStyle(rStatus)}>{rStatus}</span> : null}
                    </div>

                    <div style={miniGridResponsive(isSmallMobile)}>
                      <MiniStat label="TIQ OVR" value={formatRating(player.overallDynamic)} />
                      <MiniStat label="USTA OVR" value={formatRating(player.overallUstaDynamic)} />
                      <MiniStat label="Singles" value={formatRating(player.singlesDynamic)} />
                      <MiniStat label="Doubles" value={formatRating(player.doublesDynamic)} />
                    </div>

                    {player.availabilityNotes ? (
                      <div style={noteBoxStyle}><strong>Availability:</strong> {player.availabilityNotes}</div>
                    ) : null}

                    {player.lineupNotes ? (
                      <div style={noteBoxStyle}><strong>Captain note:</strong> {player.lineupNotes}</div>
                    ) : null}
                  </div>
                  )
                })}
              </div>
            </section>

            <section style={sectionCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Singles depth</p>
                  <h2 style={sectionTitle}>Top singles options</h2>
                  <p style={sectionBodyTextStyle}>
                    Ranked by singles dynamic rating, adjusted for availability and role preference.
                  </p>
                </div>
              </div>

              <div style={listCardStyle}>
                {(() => {
                  const maxSingles = Math.max(...singlesProjection.map((p) => p.singlesDynamic ?? 0), 1)
                  return singlesProjection.map((player, index) => {
                    const rStatus = getProjectionRatingStatus(player)
                    const barPct = maxSingles > 0 ? Math.round(((player.singlesDynamic ?? 0) / maxSingles) * 100) : 0
                    return (
                      <div key={player.id} style={{ ...listRowResponsive(isMobile), flexDirection: 'column' as const, gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                          <div style={listMainStyle}><strong>{index + 1}.</strong> {player.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                            {rStatus ? <span style={getProjectionStatusStyle(rStatus)}>{rStatus}</span> : null}
                            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--foreground)' }}>{formatRating(player.singlesDynamic)}</span>
                          </div>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ width: `${barPct}%`, height: '100%', background: 'linear-gradient(90deg,rgba(116,190,255,0.5),rgba(63,167,255,0.8))', borderRadius: 999, transition: 'width 400ms ease' }} />
                        </div>
                        <div style={listMetaStyle}>{getAvailabilityLabel(player.availabilityStatus)} - USTA {formatRating(player.overallUstaDynamic)}</div>
                      </div>
                    )
                  })
                })()}
              </div>
            </section>

            <section style={sectionCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Doubles depth</p>
                  <h2 style={sectionTitle}>Top doubles pairings</h2>
                  <p style={sectionBodyTextStyle}>
                    Ranked by average doubles dynamic rating, adjusted for availability and role preference.
                  </p>
                </div>
              </div>

              <div style={listCardStyle}>
                {(() => {
                  const maxDoubles = Math.max(...doublesPairs.map((p) => p.combinedDoubles), 1)
                  return doublesPairs.map((pair, index) => {
                    const barPct = maxDoubles > 0 ? Math.round((pair.combinedDoubles / maxDoubles) * 100) : 0
                    return (
                      <div key={`${pair.player1.id}-${pair.player2.id}`} style={{ ...listRowResponsive(isMobile), flexDirection: 'column' as const, gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                          <div style={listMainStyle}><strong>{index + 1}.</strong> {pair.player1.name} / {pair.player2.name}</div>
                          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--foreground)' }}>{pair.combinedDoubles.toFixed(2)}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ width: `${barPct}%`, height: '100%', background: 'linear-gradient(90deg,rgba(155,225,29,0.4),rgba(74,222,128,0.7))', borderRadius: 999, transition: 'width 400ms ease' }} />
                        </div>
                        {pair.notes.length ? <div style={pairNoteInlineStyle}>{pair.notes.join(' - ')}</div> : null}
                      </div>
                    )
                  })
                })()}
              </div>
            </section>
          </>
        ) : null}
      </section>

    </div>
  )
}

function ProjectionCard({
  label,
  value,
  subtext,
  accent = false,
}: {
  label: string
  value: string
  subtext: string
  accent?: boolean
}) {
  return (
    <div style={{ ...surfaceCard, ...(accent ? projectionCardAccentStyle : {}) }}>
      <p style={sectionKicker}>{label}</p>
      <div style={projectionValueStyle}>{value}</div>
      <p style={sectionBodyTextStyle}>{subtext}</p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniStatStyle}>
      <div style={miniStatLabelStyle}>{label}</div>
      <div style={miniStatValueStyle}>{value}</div>
    </div>
  )
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'green' | 'red' | 'blue' | 'purple' | 'amber'
}) {
  return <span style={summaryPillStyle(tone)}>{label}: {value}</span>
}

function toolControlShellResponsive(isTablet: boolean, isMobile: boolean): CSSProperties {
  return {
    ...toolControlShell,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1.15fr) minmax(min(100%, 280px), 360px)',
    gap: isMobile ? '18px' : '24px',
    padding: isMobile ? '20px 18px' : '24px 22px',
    minWidth: 0,
  }
}

function filterGridResponsive(isTablet: boolean): CSSProperties {
  return {
    ...filterGridStyle,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))',
    minWidth: 0,
  }
}

function projectionGridResponsive(isSmallMobile: boolean, isTablet: boolean): CSSProperties {
  return {
    ...projectionGridStyle,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
    minWidth: 0,
  }
}

function actionReadGridResponsive(isSmallMobile: boolean, isTablet: boolean): CSSProperties {
  return {
    ...actionReadGridStyle,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
    minWidth: 0,
  }
}

function compareGridResponsive(isTablet: boolean): CSSProperties {
  return {
    ...compareGridStyle,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
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

function miniGridResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...miniGridStyle,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))',
    minWidth: 0,
  }
}

function listRowResponsive(isMobile: boolean): CSSProperties {
  return {
    ...listRowStyle,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'flex-start' : 'center',
    minWidth: 0,
  }
}

function summaryPillStyle(tone: 'green' | 'red' | 'blue' | 'purple' | 'amber'): CSSProperties {
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
    minWidth: 0,
    maxWidth: '100%',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    textAlign: 'center',
  }

  if (tone === 'green') {
    return { ...base, background: 'rgba(34, 197, 94, 0.12)', color: '#dffad5', borderColor: 'rgba(34, 197, 94, 0.18)' }
  }
  if (tone === 'red') {
    return { ...base, background: 'rgba(239, 68, 68, 0.12)', color: '#fecaca', borderColor: 'rgba(239, 68, 68, 0.18)' }
  }
  if (tone === 'blue') {
    return { ...base, background: 'rgba(37, 99, 235, 0.12)', color: '#c7dbff', borderColor: 'rgba(37, 99, 235, 0.18)' }
  }
  if (tone === 'purple') {
    return { ...base, background: 'rgba(109, 40, 217, 0.12)', color: '#ddd6fe', borderColor: 'rgba(109, 40, 217, 0.18)' }
  }
  return { ...base, background: 'rgba(245, 158, 11, 0.14)', color: '#fde68a', borderColor: 'rgba(245, 158, 11, 0.18)' }
}

function statusPillFor(status: AvailabilityStatus): CSSProperties {
  if (status === 'available') return summaryPillStyle('green')
  if (status === 'unavailable') return summaryPillStyle('red')
  if (status === 'singles_only') return summaryPillStyle('blue')
  if (status === 'doubles_only') return summaryPillStyle('purple')
  return summaryPillStyle('amber')
}

const pageStyle: CSSProperties = {
  minHeight: 0,
  position: 'relative',
  overflow: 'visible',
  background: 'transparent',
  padding: '12px 18px 56px',
  minWidth: 0,
}

const pageWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  padding: '18px 0 64px',
  display: 'grid',
  gap: 18,
  minWidth: 0,
  overflowX: 'clip',
  boxSizing: 'border-box',
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
  display: 'grid',
  borderRadius: '28px',
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2,8,23,0.42), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  overflow: 'hidden',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: 'clamp(-92px, -7vw, -34px)',
  bottom: 'clamp(-112px, -10vw, -52px)',
  width: 'clamp(230px, 30vw, 420px)',
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
  opacity: 0.14,
  pointerEvents: 'none',
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
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 12,
  marginTop: 14,
  minWidth: 0,
}

const captainReadCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(8,13,28,0.60)',
  padding: '20px',
  minWidth: 0,
}

const captainReadTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '14px',
  flexWrap: 'wrap',
  marginBottom: '16px',
  minWidth: 0,
}

const captainReadTitle: CSSProperties = {
  margin: '6px 0',
  color: 'var(--foreground)',
  fontSize: '26px',
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainReadText: CSSProperties = {
  margin: '0 0 16px',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
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
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(8,13,28,0.64)',
  boxShadow: '0 18px 45px rgba(2,8,23,0.30)',
  minWidth: 0,
}

const surfaceCard: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(8,13,28,0.60)',
  boxShadow: '0 16px 42px rgba(2,8,23,0.26)',
  minWidth: 0,
}

const surfaceCardStrongInset: CSSProperties = {
  marginTop: '16px',
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  boxShadow: '0 18px 40px rgba(2, 8, 23, 0.10)',
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

const sectionBodyTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  maxWidth: 780,
  overflowWrap: 'anywhere',
}

const filterGridStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  minWidth: 0,
}

const stateBox: CSSProperties = {
  marginTop: '16px',
  borderRadius: '18px',
  padding: '18px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  color: '#dbeafe',
  fontSize: '15px',
  lineHeight: 1.7,
  fontWeight: 600,
  textAlign: 'center',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  overflowWrap: 'anywhere',
}

const stateHelperTextStyle: CSSProperties = {
  marginTop: '10px',
  color: 'rgba(219,234,254,0.82)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
  overflowWrap: 'anywhere',
}

const errorBox: CSSProperties = {
  marginTop: '16px',
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.18)',
  color: '#fecaca',
  fontWeight: 700,
  fontSize: '14px',
  overflowWrap: 'anywhere',
}

const heroBadgeRowStyleCompact: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '14px',
  minWidth: 0,
}

const badgeBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const miniPillSlate: CSSProperties = {
  ...badgeBase,
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
}

const miniPillBlue: CSSProperties = {
  ...badgeBase,
  background: 'rgba(37, 91, 227, 0.16)',
  color: 'var(--foreground)',
}

const miniPillGreen: CSSProperties = {
  ...badgeBase,
  background: 'rgba(96, 221, 116, 0.14)',
  color: '#dffad5',
}

function getProjectionRatingStatus(player: RosterPlayer): ProjectionRatingStatus | null {
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

function getProjectionStatusStyle(status: ProjectionRatingStatus): CSSProperties {
  switch (status) {
    case 'Bump Up Pace': return { ...miniPillSlate, background: 'rgba(155,225,29,0.12)', color: '#d9f84a', border: '1px solid rgba(155,225,29,0.24)' }
    case 'Trending Up':  return { ...miniPillSlate, background: 'rgba(52,211,153,0.12)', color: '#a7f3d0', border: '1px solid rgba(52,211,153,0.22)' }
    case 'Holding':      return { ...miniPillSlate, background: 'rgba(63,167,255,0.10)', color: '#bfdbfe', border: '1px solid rgba(63,167,255,0.20)' }
    case 'At Risk':      return { ...miniPillSlate, background: 'rgba(251,146,60,0.12)', color: '#fed7aa', border: '1px solid rgba(251,146,60,0.22)' }
    case 'Drop Watch':   return { ...miniPillSlate, background: 'rgba(239,68,68,0.12)', color: '#fecaca', border: '1px solid rgba(239,68,68,0.22)' }
  }
}

const projectionGridStyle: CSSProperties = {
  display: 'grid',
  gap: '16px',
  minWidth: 0,
}

const actionReadGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 16,
  minWidth: 0,
}

const actionReadCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minHeight: 150,
  minWidth: 0,
}

const actionReadTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const actionReadLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '0.76rem',
  fontWeight: 900,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const actionReadDetailStyle: CSSProperties = {
  margin: '14px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: '0.92rem',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const projectionCardAccentStyle: CSSProperties = {
  border: '1px solid rgba(111, 236, 168, 0.34)',
}

const projectionValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '36px',
  lineHeight: 1,
  letterSpacing: 0,
  marginTop: '8px',
  marginBottom: '10px',
  overflowWrap: 'anywhere',
}

const compareGridStyle: CSSProperties = {
  display: 'grid',
  gap: '16px',
  minWidth: 0,
}

const cardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.15rem',
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: 0,
  marginBottom: '0.85rem',
  overflowWrap: 'anywhere',
}

const lineItemStyle: CSSProperties = {
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  borderRadius: '1rem',
  padding: '0.9rem 0.95rem',
  marginBottom: '0.75rem',
  minWidth: 0,
}

const lineMainStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '0.96rem',
  lineHeight: 1.55,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const lineMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '0.82rem',
  lineHeight: 1.55,
  marginTop: '0.25rem',
  fontWeight: 600,
  overflowWrap: 'anywhere',
}

const lineNoteStyle: CSSProperties = {
  color: '#fde68a',
  fontSize: '0.78rem',
  lineHeight: 1.5,
  marginTop: '0.35rem',
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const emptyMiniStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '0.94rem',
  lineHeight: 1.6,
  fontWeight: 600,
  overflowWrap: 'anywhere',
}

const notesTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1rem',
  fontWeight: 800,
  marginBottom: '0.55rem',
  overflowWrap: 'anywhere',
}

const notesListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  minWidth: 0,
}

const noteRowStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '0.92rem',
  lineHeight: 1.6,
  fontWeight: 600,
  overflowWrap: 'anywhere',
}

const rosterGridStyle: CSSProperties = {
  display: 'grid',
  gap: '16px',
  minWidth: 0,
}

const playerNameStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.22rem',
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const playerMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '0.92rem',
  lineHeight: 1.6,
  marginTop: '0.35rem',
  marginBottom: '0.9rem',
  fontWeight: 500,
  overflowWrap: 'anywhere',
}

const pillRowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginBottom: '0.9rem',
  minWidth: 0,
}

const miniGridStyle: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  minWidth: 0,
}

const miniStatStyle: CSSProperties = {
  padding: '0.8rem 0.85rem',
  minWidth: 0,
  borderRadius: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const miniStatLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '0.76rem',
  marginBottom: '0.25rem',
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const miniStatValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  fontSize: '0.98rem',
  lineHeight: 1.2,
  overflowWrap: 'anywhere',
}

const noteBoxStyle: CSSProperties = {
  marginTop: '0.75rem',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  borderRadius: '0.9rem',
  padding: '0.75rem 0.8rem',
  color: 'var(--shell-copy-muted)',
  fontSize: '0.84rem',
  lineHeight: 1.55,
  fontWeight: 500,
  overflowWrap: 'anywhere',
}

const listCardStyle: CSSProperties = {
  overflow: 'hidden',
  padding: 0,
  borderRadius: '28px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const listRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.85rem',
  padding: '0.95rem 1rem',
  borderBottom: '1px solid var(--shell-panel-border)',
  flexWrap: 'wrap',
  minWidth: 0,
}

const listMainStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '0.96rem',
  lineHeight: 1.55,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const listMetaStyle: CSSProperties = {
  color: '#8fb7ff',
  fontSize: '0.88rem',
  lineHeight: 1.3,
  fontWeight: 800,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const pairNoteInlineStyle: CSSProperties = {
  color: '#fde68a',
  fontSize: '0.78rem',
  lineHeight: 1.45,
  marginTop: '0.28rem',
  fontWeight: 800,
  overflowWrap: 'anywhere',
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

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...primaryButton,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 22px 40px rgba(39,205,110,0.30)' : primaryButton.boxShadow,
        transition: 'transform 150ms ease, box-shadow 150ms ease',
      }}
    >
      {children}
    </Link>
  )
}

function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      style={{ ...ghostButton, ...(hovered ? { background: 'rgba(30,50,80,0.95)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(2,10,24,0.28)' } : {}) }}
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
      style={{ ...ghostButton, cursor: 'pointer', ...(hovered && !disabled ? { background: 'rgba(30,50,80,0.95)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(2,10,24,0.28)' } : {}), ...(disabled ? { opacity: 0.55, cursor: 'not-allowed' } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}
