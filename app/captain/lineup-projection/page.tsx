'use client'

export const dynamic = 'force-dynamic'

import Image from 'next/image'
import Link from 'next/link'
import CaptainSubnav from '@/app/components/captain-subnav'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getClientAuthState } from '@/lib/auth'
import { readCaptainResumeState, writeCaptainResumeState } from '@/lib/captain-memory'
import { formatDate, formatRating, safeText } from '@/lib/captain-formatters'
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

export default function LineupProjectionPage() {
  const router = useRouter()

  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [competitionLayer, setCompetitionLayer] = useState('')
  const [selectedLeagueKey, setSelectedLeagueKey] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedDate, setSelectedDate] = useState('')

  const [rosterLoading, setRosterLoading] = useState(false)
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [refreshTick, setRefreshTick] = useState(0)
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
          router.replace('/login?next=/captain/lineup-projection')
          return
        }

        if (!mounted) return
        setRole(authState.role)
        setEntitlements(authState.entitlements)
      } finally {
        if (mounted) setAuthLoading(false)
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
      setSelectedLeagueKey(`${initialLeague}___${initialFlight}`)
    }
    setSelectedTeam(initialTeam)
    setSelectedDate(initialDate)
  }, [])

  useEffect(() => {
    if (authLoading || role === 'public') return
    void loadLeaguesAndTeams()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, role, refreshTick])

  useEffect(() => {
    if (!selectedLeagueKey || !selectedTeam) {
      setRoster([])
      return
    }

    if (authLoading || role === 'public') return
    void loadTeamRoster()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeagueKey, selectedTeam, selectedDate, authLoading, role])

  useEffect(() => {
    const [leagueName = '', flight = ''] = selectedLeagueKey.split('___')
    writeCaptainResumeState({
      competitionLayer: competitionLayer || undefined,
      team: selectedTeam || undefined,
      league: leagueName || undefined,
      flight: flight || undefined,
      eventDate: selectedDate || undefined,
      lastTool: 'lineup-projection',
      lastToolLabel: 'Lineup Projection',
    })
  }, [competitionLayer, selectedLeagueKey, selectedTeam, selectedDate])

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

      if (!matchIds.length) {
        setRoster([])
        setRosterLoading(false)
        return
      }

      const sideByMatchId = new Map<string, 'A' | 'B'>()

      for (const match of typedTeamMatches) {
        if (safeText(match.home_team) === selectedTeam) sideByMatchId.set(match.id, 'A')
        if (safeText(match.away_team) === selectedTeam) sideByMatchId.set(match.id, 'B')
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

  const selectedLeagueLabel = useMemo(() => {
    if (!selectedLeagueKey) return ''
    const [leagueName, flight] = selectedLeagueKey.split('___')
    return `${leagueName} - ${flight}`
  }, [selectedLeagueKey])

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

  const builderHref = useMemo(() => {
    const params = new URLSearchParams()
    if (selectedLeagueLabel) params.set('league', selectedLeagueLabel.split(' - ')[0])
    if (selectedLeagueKey) params.set('flight', selectedLeagueKey.split('___')[1] || '')
    if (selectedTeam) params.set('team', selectedTeam)
    if (selectedDate) params.set('date', selectedDate)
    const query = params.toString()
    return query ? `/captain/lineup-builder?${query}` : '/captain/lineup-builder'
  }, [selectedLeagueLabel, selectedLeagueKey, selectedTeam, selectedDate])

  const builderHrefResolved = useMemo(() => {
    const params = new URLSearchParams()
    if (selectedLeagueKey) {
      const [leagueName, flight] = selectedLeagueKey.split('___')
      if (leagueName) params.set('league', leagueName)
      if (flight) params.set('flight', flight)
    }
    if (selectedTeam) params.set('team', selectedTeam)
    if (selectedDate) params.set('date', selectedDate)
    const query = params.toString()
    return query ? `/captain/lineup-builder?${query}` : '/captain/lineup-builder'
  }, [selectedLeagueKey, selectedTeam, selectedDate])

  const projectionSignals = useMemo(
    () => [
      {
        label: 'Roster state',
        value: roster.length ? `${availabilitySummary.available} available now` : 'Load a team roster',
        note: selectedDate
          ? `Availability is scoped to ${formatDate(selectedDate)}.`
          : 'Add a match date for the most realistic projection read.',
      },
      {
        label: 'Projection read',
        value: suggestedLineup.singles.length || suggestedLineup.doubles.length ? confidenceLabel : 'Waiting on lineup pool',
        note: suggestedLineup.notes[0] ?? 'Ratings, availability, and role preference are all in the mix.',
      },
      {
        label: 'Best next move',
        value: !selectedLeagueKey
          ? 'Choose league context'
          : !selectedTeam
            ? 'Choose team'
            : !roster.length
              ? 'Refresh roster context'
              : 'Push into Lineup Builder',
        note: roster.length
          ? 'Use the builder to turn the estimate into a saved scenario.'
          : 'The projection sharpens once the roster pool is loaded.',
      },
    ],
    [availabilitySummary.available, confidenceLabel, roster.length, selectedDate, selectedLeagueKey, selectedTeam, suggestedLineup]
  )

  if (authLoading) {
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
          <h1 style={heroTitleResponsive(isSmallMobile, isMobile)}>Lineup Projection</h1>
          <p style={heroTextStyle}>
            Build a smarter lineup from the available roster. Pick a league, team, and optional
            match date to generate lineup suggestions using dynamic ratings, roster usage,
            preferences, and availability.
          </p>

          <div style={heroButtonRowStyle}>
            <PrimaryLink href={builderHrefResolved}>Build in Lineup Builder</PrimaryLink>
            <GhostLink href="/captain">Back to Captain Console</GhostLink>
            <GhostBtn onClick={() => setRefreshTick((current) => current + 1)}>
              {loading || rosterLoading ? 'Refreshing...' : 'Refresh data'}
            </GhostBtn>
          </div>

          <div style={heroMetricGridStyle(isSmallMobile)}>
            <MetricStat label="League / flight options" value={String(leagueOptions.length)} />
            <MetricStat label="Matches loaded" value={String(matches.length)} />
            <MetricStat label="Projection confidence" value={confidenceLabel} />
          </div>

          <div style={signalGridStyle(isSmallMobile)}>
            {projectionSignals.map((signal) => (
              <div key={signal.label} style={signalCardStyle}>
                <div style={signalLabelStyle}>{signal.label}</div>
                <div style={signalValueStyle}>{signal.value}</div>
                <div style={signalNoteStyle}>{signal.note}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={quickStartCard}>
          <div style={quickStartLabel}>Projection logic</div>
          <div style={quickStartValue}>Ratings + usage + availability</div>
          <div style={quickStartText}>
            Singles and doubles recommendations are adjusted for availability status and preferred role,
            then ranked from the most competitive options.
          </div>

          <div style={workflowListStyle}>
            {[
              ['1', 'Choose team context', 'Filter down to the exact league, team, and optional match date.'],
              ['2', 'Review projected lineup', 'See projected singles and doubles built from the available roster.'],
              ['3', 'Push into builder', 'Open the Lineup Builder to turn this estimate into a saved scenario.'],
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

          <div style={heroBadgeRowStyleCompact}>
            <span style={miniPillSlate}>{selectedLeagueKey ? 'League selected' : 'Pick a league'}</span>
            <span style={miniPillSlate}>{selectedTeam ? 'Team selected' : 'Pick a team'}</span>
            <span style={miniPillSlate}>{roster.length ? 'Roster loaded' : 'Roster pending'}</span>
          </div>
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

            {!access.canUseCaptainWorkflow ? (
              <UpgradePrompt
                planId="captain"
                compact
                headline="Want to turn this estimate into a lineup you can actually use?"
                body="Captain takes projection reads out of preview mode and moves them into saved lineup versions, scenario testing, and team communication."
                ctaLabel="Unlock Captain Tools"
                ctaHref="/pricing"
                secondaryLabel="See Captain plan"
                secondaryHref="/pricing"
              />
            ) : null}

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
                      <div key={note} style={noteRowStyle}>• {note}</div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            {!access.canUseCaptainWorkflow ? (
              <UpgradePrompt
                planId="captain"
                compact
                headline="Still hand-carrying projection notes into builder and scenarios?"
                body="Captain keeps the same team context flowing from projection into lineup builder, scenario comparison, and match-week messaging so the next step is obvious."
                ctaLabel="Build Smarter Lineups"
                ctaHref="/pricing"
                secondaryLabel="See how Captain works"
                secondaryHref="/pricing"
              />
            ) : null}

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
                {singlesProjection.map((player, index) => (
                  <div key={player.id} style={listRowResponsive(isMobile)}>
                    <div style={listMainStyle}>
                      <strong>{index + 1}.</strong> {player.name}
                    </div>
                    <div style={listMetaStyle}>Singles DR: {formatRating(player.singlesDynamic)}</div>
                  </div>
                ))}
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
                {doublesPairs.map((pair, index) => (
                  <div key={`${pair.player1.id}-${pair.player2.id}`} style={listRowResponsive(isMobile)}>
                    <div style={listMainStyle}>
                      <strong>{index + 1}.</strong> {pair.player1.name} / {pair.player2.name}
                      {pair.notes.length ? <div style={pairNoteInlineStyle}>{pair.notes.join(' - ')}</div> : null}
                    </div>
                    <div style={listMetaStyle}>Pair DR: {pair.combinedDoubles.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </section>

      <section style={{ padding: '0 24px 32px' }}>
        <CaptainSubnav
          title="Lineup Projection inside the captain command center"
          description="Stay connected to availability data, the full lineup builder, scenario planning, and team messaging while reviewing projected team sheets."
          tierLabel={access.captainTierLabel}
          tierActive={access.captainSubscriptionActive}
        />
        {!access.canUseCaptainWorkflow ? (
          <div style={{ marginTop: 18 }}>
            <UpgradePrompt
              planId="captain"
              headline="Want projection reads you can actually act on?"
              body="Captain turns availability and roster context into smarter lineup projections, then carries the result straight into builder, scenarios, and messaging."
              ctaLabel="Build Smarter Lineups"
              ctaHref="/pricing"
              secondaryLabel="Keep reviewing"
              compact
            />
          </div>
        ) : null}
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

function MetricStat({ label, value }: { label: string; value: string }) {
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
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.15fr) minmax(280px, 360px)',
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

function filterGridResponsive(isTablet: boolean): CSSProperties {
  return {
    ...filterGridStyle,
    gridTemplateColumns: isTablet ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }
}

function projectionGridResponsive(isSmallMobile: boolean, isTablet: boolean): CSSProperties {
  return {
    ...projectionGridStyle,
    gridTemplateColumns: isSmallMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
  }
}

function compareGridResponsive(isTablet: boolean): CSSProperties {
  return {
    ...compareGridStyle,
    gridTemplateColumns: isTablet ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }
}

function rosterGridResponsive(isSmallMobile: boolean, isTablet: boolean): CSSProperties {
  return {
    ...rosterGridStyle,
    gridTemplateColumns: isSmallMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
  }
}

function miniGridResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...miniGridStyle,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }
}

function listRowResponsive(isMobile: boolean): CSSProperties {
  return {
    ...listRowStyle,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'flex-start' : 'center',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: '0 34px 80px rgba(0,0,0,0.16)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  minHeight: '38px',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(130, 244, 118, 0.28)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 800,
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
}

const heroTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground)',
  fontWeight: 900,
  lineHeight: 0.98,
  letterSpacing: '-0.055em',
  maxWidth: '760px',
}

const heroTextStyle: CSSProperties = {
  marginTop: 16,
  marginBottom: 0,
  maxWidth: 820,
  color: 'var(--shell-copy-muted)',
  fontSize: '1.02rem',
  lineHeight: 1.72,
}

const heroButtonRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const signalLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '0.72rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const signalValueStyle: CSSProperties = {
  marginTop: '0.45rem',
  color: 'var(--foreground)',
  fontSize: '1rem',
  fontWeight: 800,
  lineHeight: 1.35,
}

const signalNoteStyle: CSSProperties = {
  marginTop: '0.45rem',
  color: 'var(--shell-copy-muted)',
  fontSize: '0.88rem',
  lineHeight: 1.5,
}

const metricLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '0.82rem',
  marginBottom: '0.42rem',
  fontWeight: 700,
}

const metricValueStyleHero: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: '1.05rem',
  fontWeight: 800,
  lineHeight: 1.4,
}

const quickStartCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: '20px',
}

const quickStartLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  lineHeight: 1.5,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const quickStartValue: CSSProperties = {
  marginTop: 8,
  color: 'var(--foreground)',
  fontSize: '30px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const quickStartText: CSSProperties = {
  marginTop: 10,
  color: 'var(--shell-copy-muted)',
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
  color: 'var(--foreground)',
  marginBottom: 4,
}

const workflowTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
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

const surfaceCardStrongInset: CSSProperties = {
  marginTop: '16px',
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 18px 40px rgba(2, 8, 23, 0.10)',
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

const sectionBodyTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  maxWidth: 780,
}

const filterGridStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
}

const stateBox: CSSProperties = {
  marginTop: '16px',
  borderRadius: '18px',
  padding: '18px',
  background: 'linear-gradient(180deg, rgba(38,67,118,0.46) 0%, rgba(22,40,78,0.58) 100%)',
  border: '1px solid rgba(128,174,255,0.14)',
  color: '#dbeafe',
  fontSize: '15px',
  lineHeight: 1.7,
  fontWeight: 600,
  textAlign: 'center',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const stateHelperTextStyle: CSSProperties = {
  marginTop: '10px',
  color: 'rgba(219,234,254,0.82)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
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
}

const heroBadgeRowStyleCompact: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '14px',
}

const badgeBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
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
}

const projectionCardAccentStyle: CSSProperties = {
  border: '1px solid rgba(111, 236, 168, 0.34)',
}

const projectionValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '36px',
  lineHeight: 1,
  letterSpacing: '-0.04em',
  marginTop: '8px',
  marginBottom: '10px',
}

const compareGridStyle: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const cardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.15rem',
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: '-0.02em',
  marginBottom: '0.85rem',
}

const lineItemStyle: CSSProperties = {
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  borderRadius: '1rem',
  padding: '0.9rem 0.95rem',
  marginBottom: '0.75rem',
}

const lineMainStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '0.96rem',
  lineHeight: 1.55,
  fontWeight: 700,
}

const lineMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '0.82rem',
  lineHeight: 1.55,
  marginTop: '0.25rem',
  fontWeight: 600,
}

const lineNoteStyle: CSSProperties = {
  color: '#fde68a',
  fontSize: '0.78rem',
  lineHeight: 1.5,
  marginTop: '0.35rem',
  fontWeight: 800,
}

const emptyMiniStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '0.94rem',
  lineHeight: 1.6,
  fontWeight: 600,
}

const notesTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1rem',
  fontWeight: 800,
  marginBottom: '0.55rem',
}

const notesListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
}

const noteRowStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '0.92rem',
  lineHeight: 1.6,
  fontWeight: 600,
}

const rosterGridStyle: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const playerNameStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.22rem',
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: '-0.02em',
}

const playerMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '0.92rem',
  lineHeight: 1.6,
  marginTop: '0.35rem',
  marginBottom: '0.9rem',
  fontWeight: 500,
}

const pillRowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginBottom: '0.9rem',
}

const miniGridStyle: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
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
}

const miniStatValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  fontSize: '0.98rem',
  lineHeight: 1.2,
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
}

const listCardStyle: CSSProperties = {
  overflow: 'hidden',
  padding: 0,
  borderRadius: '28px',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.20) 0%, rgba(28,49,95,0.38) 100%)',
  boxShadow: '0 18px 40px rgba(0,0,0,0.22)',
}

const listRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.85rem',
  padding: '0.95rem 1rem',
  borderBottom: '1px solid var(--shell-panel-border)',
}

const listMainStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '0.96rem',
  lineHeight: 1.55,
  fontWeight: 700,
}

const listMetaStyle: CSSProperties = {
  color: '#8fb7ff',
  fontSize: '0.88rem',
  lineHeight: 1.3,
  fontWeight: 800,
  whiteSpace: 'nowrap',
}

const pairNoteInlineStyle: CSSProperties = {
  color: '#fde68a',
  fontSize: '0.78rem',
  lineHeight: 1.45,
  marginTop: '0.28rem',
  fontWeight: 800,
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
