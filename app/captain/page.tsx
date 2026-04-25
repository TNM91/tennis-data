'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { CSSProperties, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import SiteShell from '@/app/components/site-shell'
import CaptainSubnav from '@/app/components/captain-subnav'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { useTheme } from '@/app/components/theme-provider'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { getClientAuthState } from '@/lib/auth'
import {
  buildCaptainScopedHref,
  readCaptainResumeState,
  writeCaptainResumeState,
} from '@/lib/captain-memory'
import {
  buildCaptainWeekNotesScopeKey,
  readCaptainWeekNotes,
  upsertCaptainWeekNotes,
} from '@/lib/captain-week-notes'
import {
  buildCaptainWeekStatusKey,
  getCaptainWeekStatusMeta,
  readCaptainWeekStatus,
  upsertCaptainWeekStatus,
  type CaptainWeekStatus,
} from '@/lib/captain-week-status'
import { supabase } from '@/lib/supabase'
import { isMember, type UserRole } from '@/lib/roles'
import {
  formatDate,
  formatRating,
  formatMonthDay as formatDateShort,
  formatDateTime as formatDateTimeShort,
  safeKey,
  safeText,
  average,
  winPct as getWinPct,
  formatPercent,
  readLocalItem as readLocalObject,
  readLocalArray,
} from '@/lib/captain-formatters'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type TeamMatch = {
  id: string
  league_name: string | null
  flight: string | null
  home_team: string | null
  away_team: string | null
  match_date: string
  match_type: 'singles' | 'doubles'
  score: string | null
  winner_side: 'A' | 'B'
}

type PlayerRelation =
  | {
      id: string
      name: string
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
      overall_rating: number | null
      overall_dynamic_rating: number | null
      overall_usta_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      singles_usta_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
      doubles_usta_dynamic_rating: number | null
    }[]
  | null

type MatchPlayer = {
  match_id: string
  side: 'A' | 'B'
  seat: number | null
  player_id: string
  players: PlayerRelation
}

type TeamOption = {
  team: string
  league: string
  flight: string
  matches: number
}

type TeamOptionMatchRow = {
  home_team: string | null
  away_team: string | null
  league_name: string | null
  flight: string | null
  match_date: string
  line_number?: string | null
}


type CaptainWorkspaceState = {
  lineupReady: boolean
  scenarioReady: boolean
  messagingReady: boolean
  briefReady: boolean
  currentEventKey: string
  lineupCount: number
  scenarioCount: number
  responseAlertCount: number
  pendingResponseCount: number
  latestResponseUpdateLabel: string
  lastUpdatedLabel: string
}

const WEEKLY_LINEUPS_STORAGE_KEY = 'tenaceiq_weekly_lineups'
const WEEKLY_EVENT_DETAILS_STORAGE_KEY = 'tenaceiq_weekly_event_details'
const WEEKLY_RESPONSES_STORAGE_KEY = 'tenaceiq_weekly_responses'

const CAPTAIN_COMMAND_SURFACES = [
  {
    label: 'Availability',
    text: 'See who is in, out, tentative, or still needs a response before lineup pressure starts.',
  },
  {
    label: 'Best lineup',
    text: 'Move from player pool to the strongest weekly shape without losing match context.',
  },
  {
    label: 'Scenario delta',
    text: 'Compare fallback options and understand what each move costs before you commit.',
  },
]


type RatingStatus = 'Bump Up Pace' | 'Trending Up' | 'Holding' | 'At Risk' | 'Drop Watch'

type TeamPlayerSummary = {
  id: string
  name: string
  appearances: number
  wins: number
  losses: number
  singlesDynamic: number | null
  doublesDynamic: number | null
  overallBase: number | null
  overallUstaDynamic: number | null
  ratingStatus: RatingStatus | null
}

type PairingSummary = {
  key: string
  names: string[]
  appearances: number
  wins: number
  losses: number
  avgDoublesRating: number | null
}

function normalizePlayerRelation(player: PlayerRelation) {
  if (!player) return null
  return Array.isArray(player) ? player[0] ?? null : player
}


export default function CaptainHubPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([])
  const [selectedCompetitionLayer, setSelectedCompetitionLayer] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedLeague, setSelectedLeague] = useState('')
  const [selectedFlight, setSelectedFlight] = useState('')

  const [matches, setMatches] = useState<TeamMatch[]>([])
  const [participants, setParticipants] = useState<MatchPlayer[]>([])

  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  const [scenarioCount, setScenarioCount] = useState(0)
  const [latestScenarioName, setLatestScenarioName] = useState('')
  const [workspaceState, setWorkspaceState] = useState<CaptainWorkspaceState>({
    lineupReady: false,
    scenarioReady: false,
    messagingReady: false,
    briefReady: false,
    currentEventKey: '',
    lineupCount: 0,
    scenarioCount: 0,
    responseAlertCount: 0,
    pendingResponseCount: 0,
    latestResponseUpdateLabel: 'Not updated yet',
    lastUpdatedLabel: 'Not updated yet',
  })
  const [rosterSortMode, setRosterSortMode] = useState<'appearances' | 'signal'>('appearances')
  const [weeklyPrepNotes, setWeeklyPrepNotes] = useState('')
  const [opponentScoutNotes, setOpponentScoutNotes] = useState('')
  const [notesUpdatedLabel, setNotesUpdatedLabel] = useState('Weekly notes not saved yet')
  const [loadedNotesScopeKey, setLoadedNotesScopeKey] = useState('')
  const [weekStatus, setWeekStatus] = useState<CaptainWeekStatus>('draft-lineup')

  const loadRole = useCallback(async (nextRole: UserRole) => {
    setRole(nextRole)
    setAuthLoading(false)

    if (!isMember(nextRole)) {
      router.replace('/login')
    }

    return nextRole
  }, [router])

  const loadTeamOptions = useCallback(async () => {
    setLoadingOptions(true)
    setError('')

    try {
      const { data, error: matchesError } = await supabase
        .from('matches')
        .select('home_team, away_team, league_name, flight, match_date, line_number')
        .is('line_number', null)
        .order('match_date', { ascending: false })
        .limit(600)

      if (matchesError) throw new Error(matchesError.message)

      const map = new Map<string, TeamOption>()

      for (const row of (data || []) as TeamOptionMatchRow[]) {
        const league = safeText(row.league_name, 'Unknown League')
        const flight = safeText(row.flight, 'Unknown Flight')

        for (const side of [safeText(row.home_team), safeText(row.away_team)]) {
          if (side === 'Unknown') continue

          const key = `${side}__${league}__${flight}`

          if (!map.has(key)) {
            map.set(key, {
              team: side,
              league,
              flight,
              matches: 0,
            })
          }

          map.get(key)!.matches += 1
        }
      }

      const next = [...map.values()].sort((a, b) => {
        if (b.matches !== a.matches) return b.matches - a.matches
        return a.team.localeCompare(b.team)
      })

      setTeamOptions(next)

      if (next.length > 0) {
        setSelectedTeam((current) => current || next[0].team)
        setSelectedLeague((current) => current || next[0].league)
        setSelectedFlight((current) => current || next[0].flight)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams')
    } finally {
      setLoadingOptions(false)
    }
  }, [])

  const loadSelectedTeam = useCallback(async () => {
    setLoadingTeam(true)
    setError('')

    try {
      let query = supabase
        .from('matches')
        .select(`
          id,
          league_name,
          flight,
          home_team,
          away_team,
          match_date,
          match_type,
          score,
          winner_side,
          line_number
        `)
        .is('line_number', null)
        .or(`home_team.eq.${selectedTeam},away_team.eq.${selectedTeam}`)
        .order('match_date', { ascending: false })
        .limit(400)

      if (selectedLeague) query = query.eq('league_name', selectedLeague)
      if (selectedFlight) query = query.eq('flight', selectedFlight)

      const { data: matchData, error: matchError } = await query
      if (matchError) throw new Error(matchError.message)

      const typedMatches = (matchData || []) as TeamMatch[]
      setMatches(typedMatches)

      const matchIds = typedMatches.map((match) => match.id)

      if (!matchIds.length) {
        setParticipants([])
        setScenarioCount(0)
        setLatestScenarioName('')
        return
      }

      let scenarioQuery = supabase
        .from('lineup_scenarios')
        .select('id, scenario_name, match_date')
        .order('match_date', { ascending: false })
        .order('scenario_name', { ascending: true })

      if (selectedTeam) scenarioQuery = scenarioQuery.eq('team_name', selectedTeam)
      if (selectedLeague) scenarioQuery = scenarioQuery.eq('league_name', selectedLeague)
      if (selectedFlight) scenarioQuery = scenarioQuery.eq('flight', selectedFlight)

      const [
        { data: participantData, error: participantError },
        { data: scenarioData, error: scenarioError },
      ] = await Promise.all([
        supabase
          .from('match_players')
          .select(`
            match_id,
            side,
            seat,
            player_id,
            players (
              id,
              name,
              overall_rating,
              overall_dynamic_rating,
              overall_usta_dynamic_rating,
              singles_dynamic_rating,
              singles_usta_dynamic_rating,
              doubles_dynamic_rating,
              doubles_usta_dynamic_rating
            )
          `)
          .in('match_id', matchIds),
        scenarioQuery,
      ])

      if (participantError) throw new Error(participantError.message)
      if (scenarioError) throw new Error(scenarioError.message)

      setParticipants((participantData || []) as MatchPlayer[])

      const typedScenarios = (scenarioData || []) as Array<{ id: string; scenario_name: string; match_date: string | null }>
      setScenarioCount(typedScenarios.length)
      setLatestScenarioName(typedScenarios[0]?.scenario_name || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load captain console')
    } finally {
      setLoadingTeam(false)
    }
  }, [selectedFlight, selectedLeague, selectedTeam])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const resumeState = readCaptainResumeState()
    setSelectedCompetitionLayer(params.get('layer') || resumeState?.competitionLayer || '')
    setSelectedTeam(params.get('team') || resumeState?.team || '')
    setSelectedLeague(params.get('league') || resumeState?.league || '')
    setSelectedFlight(params.get('flight') || resumeState?.flight || '')
  }, [])

  useEffect(() => {
    let active = true

    async function loadAuth() {
      const authState = await getClientAuthState()
      if (!active) return
      setEntitlements(authState.entitlements)
      await loadRole(authState.role)
    }

    void loadAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      if (!active) return
      const authState = await getClientAuthState()
      setEntitlements(authState.entitlements)
      void loadRole(authState.role)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadRole])

  useEffect(() => {
    void loadTeamOptions()
  }, [loadTeamOptions, refreshTick])

  useEffect(() => {
    if (!selectedTeam) return
    void loadSelectedTeam()
  }, [loadSelectedTeam, refreshTick, selectedTeam])

  const filteredTeamOptions = useMemo(() => {
    return teamOptions.filter((option) => option.team && option.league && option.flight)
  }, [teamOptions])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const currentMatch = matches[0] ?? null
    const currentEventKey = safeKey(
      selectedTeam,
      selectedLeague,
      selectedFlight,
      currentMatch?.match_date || null,
    )

    const lineupRows = readLocalArray<{ event_key?: string }>(WEEKLY_LINEUPS_STORAGE_KEY)
    const eventDetails = readLocalArray<{ key?: string; location?: string; arrivalTime?: string; notes?: string }>(
      WEEKLY_EVENT_DETAILS_STORAGE_KEY,
    )
    const responseRows = readLocalArray<{
      event_key?: string
      status?: string
      updated_at?: string
    }>(WEEKLY_RESPONSES_STORAGE_KEY)
    const selectedScenario = readLocalObject<{ id?: string; scenario_name?: string }>('tenace_selected_scenario')
    const resumeState = readCaptainResumeState()

    const lineupCount = lineupRows.filter((row) => (row.event_key || '') === currentEventKey).length
    const eventDetail = eventDetails.find((row) => (row.key || '') === currentEventKey) || null
    const eventResponses = responseRows.filter((row) => (row.event_key || '') === currentEventKey)
    const responseAlertCount = eventResponses.filter((row) =>
      ['running-late', 'need-sub'].includes((row.status || '').trim().toLowerCase()),
    ).length
    const pendingResponseCount = eventResponses.filter((row) => {
      const status = (row.status || '').trim().toLowerCase()
      return !status || status === 'no-response' || status === 'viewed'
    }).length
    const latestResponseUpdate =
      eventResponses
        .map((row) => row.updated_at || null)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null

    const lineupReady = lineupCount > 0
    const scenarioReady = !!selectedScenario?.id || scenarioCount > 0
    const messagingReady = !!(eventDetail && (eventDetail.location || eventDetail.arrivalTime || eventDetail.notes) && lineupReady)
    const briefReady = Boolean(lineupReady || eventDetail || eventResponses.length)

    setWorkspaceState({
      lineupReady,
      scenarioReady,
      messagingReady,
      briefReady,
      currentEventKey,
      lineupCount,
      scenarioCount,
      responseAlertCount,
      pendingResponseCount,
      latestResponseUpdateLabel: formatDateTimeShort(latestResponseUpdate),
      lastUpdatedLabel: formatDateTimeShort(resumeState?.lastVisitedAt || null),
    })
  }, [matches, selectedTeam, selectedLeague, selectedFlight, scenarioCount])

  useEffect(() => {
    if (!selectedTeam && !selectedLeague && !selectedFlight) return

    writeCaptainResumeState({
      competitionLayer: selectedCompetitionLayer || undefined,
      team: selectedTeam,
      league: selectedLeague,
      flight: selectedFlight,
    })
  }, [selectedCompetitionLayer, selectedFlight, selectedLeague, selectedTeam])

  const teamSideByMatchId = useMemo(() => {
    const map = new Map<string, 'A' | 'B'>()

    for (const match of matches) {
      if (safeText(match.home_team) === selectedTeam) map.set(match.id, 'A')
      if (safeText(match.away_team) === selectedTeam) map.set(match.id, 'B')
    }

    return map
  }, [matches, selectedTeam])

  const roster = useMemo<TeamPlayerSummary[]>(() => {
    const map = new Map<string, TeamPlayerSummary>()
    const matchById = new Map(matches.map((m) => [m.id, m]))

    for (const row of participants) {
      const side = teamSideByMatchId.get(row.match_id)
      if (!side || row.side !== side) continue

      const player = normalizePlayerRelation(row.players)
      if (!player) continue

      const match = matchById.get(row.match_id)
      if (!match) continue

      if (!map.has(player.id)) {
        const overallBase = player.overall_rating ?? null
        const overallUstaDynamic = player.overall_usta_dynamic_rating ?? null
        const ratingStatus =
          overallBase !== null && overallUstaDynamic !== null
            ? getCaptainRatingStatus(overallBase, overallUstaDynamic)
            : null
        map.set(player.id, {
          id: player.id,
          name: player.name,
          appearances: 0,
          wins: 0,
          losses: 0,
          singlesDynamic: player.singles_dynamic_rating,
          doublesDynamic: player.doubles_dynamic_rating,
          overallBase,
          overallUstaDynamic,
          ratingStatus,
        })
      }

      const item = map.get(player.id)!
      item.appearances += 1
      if (match.winner_side === side) item.wins += 1
      else item.losses += 1
    }

    return [...map.values()].sort((a, b) => {
      if (b.appearances !== a.appearances) return b.appearances - a.appearances
      return a.name.localeCompare(b.name)
    })
  }, [participants, matches, teamSideByMatchId])

  const pairings = useMemo<PairingSummary[]>(() => {
    const map = new Map<string, PairingSummary>()

    const participantsByMatchId = new Map<string, typeof participants>()
    for (const row of participants) {
      const existing = participantsByMatchId.get(row.match_id) ?? []
      existing.push(row)
      participantsByMatchId.set(row.match_id, existing)
    }

    for (const match of matches) {
      if (match.match_type !== 'doubles') continue

      const side = teamSideByMatchId.get(match.id)
      if (!side) continue

      const teamPlayers = (participantsByMatchId.get(match.id) ?? [])
        .filter((row) => row.side === side)
        .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
        .map((row) => normalizePlayerRelation(row.players))
        .filter(Boolean) as NonNullable<ReturnType<typeof normalizePlayerRelation>>[]

      if (teamPlayers.length < 2) continue

      const pair = teamPlayers.slice(0, 2).sort((a, b) => a.name.localeCompare(b.name))
      const key = `${pair[0].id}__${pair[1].id}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          names: [pair[0].name, pair[1].name],
          appearances: 0,
          wins: 0,
          losses: 0,
          avgDoublesRating: average(
            pair
              .map((player) => player.doubles_dynamic_rating)
              .filter((value): value is number => typeof value === 'number'),
          ),
        })
      }

      const item = map.get(key)!
      item.appearances += 1
      if (match.winner_side === side) item.wins += 1
      else item.losses += 1
    }

    return [...map.values()].sort((a, b) => {
      const pctDiff = getWinPct(b.wins, b.losses) - getWinPct(a.wins, a.losses)
      if (Math.abs(pctDiff) > 0.0001) return pctDiff
      if (b.appearances !== a.appearances) return b.appearances - a.appearances
      return a.names.join(' / ').localeCompare(b.names.join(' / '))
    })
  }, [matches, participants, teamSideByMatchId])

  const recommendedSingles = useMemo(() => {
    return [...roster]
      .sort(
        (a, b) =>
          ((b.singlesDynamic || 0) + b.appearances * 0.04) -
          ((a.singlesDynamic || 0) + a.appearances * 0.04),
      )
      .slice(0, 4)
  }, [roster])

  const statusOrder: Record<RatingStatus, number> = {
    'Bump Up Pace': 0,
    'Trending Up': 1,
    'Holding': 2,
    'At Risk': 3,
    'Drop Watch': 4,
  }

  const sortedRoster = useMemo(() => {
    const base = roster.slice(0, 8)
    if (rosterSortMode === 'appearances') return base
    return [...roster]
      .sort((a, b) => {
        const aOrder = a.ratingStatus != null ? statusOrder[a.ratingStatus] : 5
        const bOrder = b.ratingStatus != null ? statusOrder[b.ratingStatus] : 5
        if (aOrder !== bOrder) return aOrder - bOrder
        return b.appearances - a.appearances
      })
      .slice(0, 8)
  }, [roster, rosterSortMode])  // eslint-disable-line react-hooks/exhaustive-deps

  const quickStats = useMemo(() => {
    let wins = 0
    let losses = 0
    let doubles = 0
    let singles = 0

    for (const match of matches) {
      const side = teamSideByMatchId.get(match.id)
      if (!side) continue

      if (match.winner_side === side) wins += 1
      else losses += 1

      if (match.match_type === 'doubles') doubles += 1
      else singles += 1
    }

    return {
      matches: matches.length,
      wins,
      losses,
      singles,
      doubles,
      latest: matches[0]?.match_date || null,
      roster: roster.length,
      topPairWinPct: pairings[0] ? formatPercent(getWinPct(pairings[0].wins, pairings[0].losses)) : '—',
      singlesCore: recommendedSingles.length,
    }
  }, [matches, teamSideByMatchId, roster.length, pairings, recommendedSingles.length])

  const currentTeamHref = selectedTeam
    ? `/team/${encodeURIComponent(selectedTeam)}?${new URLSearchParams({
        ...(selectedCompetitionLayer ? { layer: selectedCompetitionLayer } : {}),
        league: selectedLeague,
        flight: selectedFlight,
      }).toString()}`
    : '/explore/teams'

  const lineupBuilderHref = buildCaptainScopedHref('/captain/lineup-builder', {
    competitionLayer: selectedCompetitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
  })

  const availabilityHref = buildCaptainScopedHref('/captain/availability', {
    competitionLayer: selectedCompetitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
  })

  const scenarioHref = buildCaptainScopedHref('/captain/scenario-builder', {
    competitionLayer: selectedCompetitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
  })

  const messagingHref = buildCaptainScopedHref('/captain/messaging', {
    competitionLayer: selectedCompetitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
  })

  const analyticsHref = buildCaptainScopedHref('/captain/analytics', {
    competitionLayer: selectedCompetitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
  })

  const captainResume = readCaptainResumeState()
  const weeklyBriefHref = buildCaptainScopedHref('/captain/weekly-brief', {
    competitionLayer: selectedCompetitionLayer || captainResume?.competitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
    date: captainResume?.eventDate,
    opponent: captainResume?.opponentTeam,
  })
  const teamBriefHref = buildCaptainScopedHref('/captain/team-brief', {
    competitionLayer: selectedCompetitionLayer || captainResume?.competitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
    date: captainResume?.eventDate,
    opponent: captainResume?.opponentTeam,
  })
  const seasonDashboardHref = '/captain/season-dashboard'
  const tiqTeamMatchesHref = '/captain/tiq-team-matches'
  const captainNotesScope = useMemo(
    () => ({
      team: selectedTeam || captainResume?.team,
      league: selectedLeague || captainResume?.league,
      flight: selectedFlight || captainResume?.flight,
      eventDate: captainResume?.eventDate,
      opponentTeam: captainResume?.opponentTeam,
    }),
    [captainResume?.eventDate, captainResume?.flight, captainResume?.league, captainResume?.opponentTeam, captainResume?.team, selectedFlight, selectedLeague, selectedTeam]
  )
  const captainNotesScopeKey = useMemo(() => buildCaptainWeekNotesScopeKey(captainNotesScope), [captainNotesScope])
  const captainWeekStatusScope = useMemo(
    () => ({
      team: selectedTeam || captainResume?.team,
      league: selectedLeague || captainResume?.league,
      flight: selectedFlight || captainResume?.flight,
      eventDate: captainResume?.eventDate || matches[0]?.match_date || '',
      opponentTeam: captainResume?.opponentTeam || '',
    }),
    [
      captainResume?.eventDate,
      captainResume?.flight,
      captainResume?.league,
      captainResume?.opponentTeam,
      captainResume?.team,
      matches,
      selectedFlight,
      selectedLeague,
      selectedTeam,
    ],
  )
  const captainWeekStatusKey = useMemo(
    () => buildCaptainWeekStatusKey(captainWeekStatusScope),
    [captainWeekStatusScope],
  )
  const weekStatusMeta = useMemo(() => getCaptainWeekStatusMeta(weekStatus), [weekStatus])

  useEffect(() => {
    const savedNotes = readCaptainWeekNotes(captainNotesScope)
    setWeeklyPrepNotes(savedNotes?.weeklyNotes || '')
    setOpponentScoutNotes(savedNotes?.opponentNotes || '')
    setNotesUpdatedLabel(savedNotes?.updatedAt ? formatDateTimeShort(savedNotes.updatedAt) : 'Weekly notes not saved yet')
    setLoadedNotesScopeKey(captainNotesScopeKey)
  }, [captainNotesScope, captainNotesScopeKey])

  useEffect(() => {
    if (loadedNotesScopeKey !== captainNotesScopeKey) return
    if (!captainNotesScope.team && !captainNotesScope.league && !captainNotesScope.eventDate) return

    const saved = upsertCaptainWeekNotes(captainNotesScope, {
      weeklyNotes: weeklyPrepNotes,
      opponentNotes: opponentScoutNotes,
    })

    if (saved?.updatedAt) {
      setNotesUpdatedLabel(formatDateTimeShort(saved.updatedAt))
    }
  }, [captainNotesScope, captainNotesScopeKey, loadedNotesScopeKey, opponentScoutNotes, weeklyPrepNotes])

  useEffect(() => {
    const saved = readCaptainWeekStatus(captainWeekStatusScope)
    setWeekStatus(saved?.status || 'draft-lineup')
  }, [captainWeekStatusKey, captainWeekStatusScope])

  const resumeHref = buildCaptainScopedHref(
    captainResume?.lastTool === 'availability'
      ? '/captain/availability'
      : captainResume?.lastTool === 'lineup-builder'
        ? '/captain/lineup-builder'
        : captainResume?.lastTool === 'lineup-projection'
          ? '/captain/lineup-projection'
          : captainResume?.lastTool === 'messaging'
            ? '/captain/messaging'
            : captainResume?.lastTool === 'analytics'
              ? '/captain/analytics'
                : captainResume?.lastTool === 'scenario-builder'
                  ? '/captain/scenario-builder'
                : captainResume?.lastTool === 'lineup-availability'
                  ? '/captain/lineup-availability'
                : captainResume?.lastTool === 'weekly-brief'
                  ? '/captain/weekly-brief'
                : captainResume?.lastTool === 'team-brief'
                  ? '/captain/team-brief'
                  : captainResume?.lastTool === 'season-dashboard'
                    ? '/captain/season-dashboard'
                  : '/captain',
    {
      competitionLayer: captainResume?.competitionLayer || selectedCompetitionLayer,
      team: captainResume?.team || selectedTeam,
      league: captainResume?.league || selectedLeague,
      flight: captainResume?.flight || selectedFlight,
      date: captainResume?.eventDate,
      opponent: captainResume?.opponentTeam,
    },
  )

  const productAccess = buildProductAccessState(role, entitlements)
  const premiumEnabled = productAccess.canUseCaptainWorkflow
  const hasTeamScope = Boolean(selectedTeam && selectedLeague && selectedFlight)
  const scopeStatusText = loadingOptions
    ? 'Loading your team options and recent match context.'
    : !filteredTeamOptions.length
      ? 'Team history is not ready yet. Add match data to unlock the weekly captain workflow.'
      : hasTeamScope
        ? `Active scope: ${selectedTeam} - ${selectedLeague} - ${selectedFlight}`
        : 'Choose a team, league, and flight to activate the weekly workflow.'

  const dynamicHeroCard: CSSProperties = {
    ...heroCard,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.02fr) minmax(380px, 0.98fr)',
    gap: isMobile ? 18 : 22,
    padding: isSmallMobile ? 18 : isMobile ? 20 : 24,
  }

const dynamicHeroRightCard: CSSProperties = {
  ...heroRightCard,
  position: 'relative',
  padding: isSmallMobile ? 16 : isMobile ? 18 : 20,
  minHeight: isTablet ? 320 : 100,
  overflow: 'hidden',
  background: 'var(--shell-panel-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
}

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '2.5rem' : isMobile ? '3rem' : heroTitle.fontSize,
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? 15 : 16,
  }

  const dynamicHeroControlRow: CSSProperties = {
    ...heroControlRow,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'stretch' : 'center',
  }

  const dynamicNextActionShell: CSSProperties = {
    ...nextActionShell,
    gridTemplateColumns: isTablet ? '1fr' : nextActionShell.gridTemplateColumns,
    padding: isSmallMobile ? 18 : isMobile ? 20 : nextActionShell.padding,
  }

  const dynamicStatusStrip: CSSProperties = {
    ...statusStrip,
    gridTemplateColumns: isSmallMobile ? '1fr' : statusStrip.gridTemplateColumns,
  }

  const dynamicNextActionButtonRow: CSSProperties = {
    ...nextActionButtonRow,
    display: isSmallMobile ? 'grid' : nextActionButtonRow.display,
    gridTemplateColumns: isSmallMobile ? '1fr' : undefined,
  }

  const dynamicGlanceActionRow: CSSProperties = {
    ...glanceActionRow,
    display: isSmallMobile ? 'grid' : glanceActionRow.display,
    gridTemplateColumns: isSmallMobile ? '1fr' : undefined,
  }

  const dynamicWeekStatusButtonRow: CSSProperties = {
    ...weekStatusButtonRow,
    display: isSmallMobile ? 'grid' : weekStatusButtonRow.display,
    gridTemplateColumns: isSmallMobile ? '1fr' : undefined,
  }

  const dynamicActionGrid: CSSProperties = {
    ...actionGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : actionGrid.gridTemplateColumns,
  }

  const dynamicCommandGrid: CSSProperties = {
    ...commandGrid,
    gridTemplateColumns: isTablet ? '1fr' : commandGrid.gridTemplateColumns,
  }

  const dynamicCommandButtonRow: CSSProperties = {
    ...commandButtonRow,
    display: isSmallMobile ? 'grid' : commandButtonRow.display,
    gridTemplateColumns: isSmallMobile ? '1fr' : undefined,
  }

  const dynamicInsightGrid: CSSProperties = {
    ...insightGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : insightGrid.gridTemplateColumns,
  }

  const dynamicSelectStyle: CSSProperties = {
    ...selectStyle,
    minWidth: isSmallMobile ? '100%' : selectStyle.minWidth,
    width: isSmallMobile ? '100%' : undefined,
  }

  const captainHeroVisualStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
  }

const captainHeroBoardGridStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(var(--page-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--page-grid-line) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
  opacity: 0.16,
  pointerEvents: 'none',
}

const captainHeroVisualMaskStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: isTablet ? 'var(--shell-hero-mask-mobile)' : 'var(--shell-hero-mask)',
  pointerEvents: 'none',
  zIndex: 1,
}

  const captainHeroVisualGlowStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: theme === 'dark'
      ? 'radial-gradient(circle at 68% 62%, rgba(155,225,29,0.14) 0%, rgba(155,225,29,0.04) 26%, rgba(155,225,29,0) 58%)'
      : 'radial-gradient(circle at 68% 62%, rgba(155,225,29,0.16) 0%, rgba(155,225,29,0.05) 26%, rgba(155,225,29,0) 58%)',
    pointerEvents: 'none',
    zIndex: 1,
  }

  const captainHeroVisualContentStyle: CSSProperties = {
    position: 'relative',
    zIndex: 2,
    display: 'grid',
    alignContent: 'space-between',
    gap: 16,
    minHeight: '100%',
  }

  const nextAction = useMemo(() => {
    if (!selectedTeam) {
      return {
        title: 'Choose your team scope',
        detail: 'Start by loading the correct team, league, and flight so the captain workflow stays tied to the right match week.',
        href: '/captain',
        cta: 'Select Team',
        tone: 'info' as const,
      }
    }

    if (!matches.length) {
      return {
        title: 'Open your team page',
        detail: 'This team needs more match context before the captain workflow can be fully useful.',
        href: currentTeamHref,
        cta: 'Open Team Page',
        tone: 'warn' as const,
      }
    }

    if (!workspaceState.lineupReady) {
      return {
        title: 'Build the weekly lineup',
        detail: 'No lineup is currently loaded for the active match context, so that is the highest-value next move.',
        href: lineupBuilderHref,
        cta: 'Open Lineup Builder',
        tone: 'info' as const,
      }
    }

    if (!workspaceState.scenarioReady) {
      return {
        title: 'Compare and lock scenarios',
        detail: 'A lineup exists, but it has not been anchored to a saved scenario yet.',
        href: scenarioHref,
        cta: 'Open Scenario Builder',
        tone: 'info' as const,
      }
    }

    if (!workspaceState.messagingReady) {
      return {
        title: 'Send the weekly plan',
        detail: 'Your lineup and scenario are in place. The next move is communicating the plan to the team.',
        href: messagingHref,
        cta: 'Open Messaging',
        tone: 'good' as const,
      }
    }

    return {
      title: 'Review captain intelligence',
      detail: 'Your week is in motion. Review the final signals and keep an eye on execution risk.',
      href: analyticsHref,
      cta: 'Open Captain IQ',
      tone: 'good' as const,
    }
  }, [selectedTeam, matches.length, workspaceState, currentTeamHref, lineupBuilderHref, scenarioHref, messagingHref, analyticsHref])

  const weeklyOpsStatus = useMemo(() => {
    if (!selectedTeam) {
      return {
        tone: 'info' as const,
        title: 'Weekly ops will appear after you choose a team scope.',
        detail:
          'Load the right team, league, and flight to surface weekly brief readiness, response risk, and follow-up actions.',
      }
    }

    if (workspaceState.responseAlertCount > 0) {
      return {
        tone: 'warn' as const,
        title: `${workspaceState.responseAlertCount} active match-week alert${workspaceState.responseAlertCount === 1 ? '' : 's'} need attention.`,
        detail:
          'Open the team brief or messaging flow to address late arrivals or substitution risk before match day.',
      }
    }

    if (workspaceState.pendingResponseCount > 0) {
      return {
        tone: 'info' as const,
        title: `${workspaceState.pendingResponseCount} player${workspaceState.pendingResponseCount === 1 ? '' : 's'} still need a clean response.`,
        detail:
          'Availability follow-up is the fastest way to tighten this week before you send the final team note.',
      }
    }

    if (workspaceState.briefReady) {
      return {
        tone: 'good' as const,
        title: 'Weekly brief is ready to review and share.',
        detail:
          'Your week has enough saved context to open the captain and team briefs as a true command sheet.',
      }
    }

    return {
      tone: 'info' as const,
      title: 'Start saving the week’s operating context.',
      detail:
        'Add lineup, event, or response details to unlock a stronger brief and week-at-a-glance operations view.',
    }
  }, [selectedTeam, workspaceState.briefReady, workspaceState.pendingResponseCount, workspaceState.responseAlertCount])

  const weekAtGlance = useMemo(() => {
    const currentMatch = matches[0] ?? null
    const eventDate = captainResume?.eventDate || currentMatch?.match_date || null
    const opponent =
      captainResume?.opponentTeam ||
      (currentMatch
        ? safeText(currentMatch.home_team) === selectedTeam
          ? safeText(currentMatch.away_team, 'Opponent not set')
          : safeText(currentMatch.home_team, 'Opponent not set')
        : 'Opponent not set')

    return {
      eventDateLabel: formatDate(eventDate),
      opponentLabel: opponent || 'Opponent not set',
      scopeLabel: hasTeamScope ? `${selectedLeague} - ${selectedFlight}` : 'Choose team scope',
      lineupLabel: workspaceState.lineupReady ? `${workspaceState.lineupCount} slots ready` : 'Lineup not saved',
      messagingLabel: workspaceState.messagingReady ? 'Ready to send' : 'Needs event details',
      briefLabel: workspaceState.briefReady ? 'Briefing ready' : 'Brief building',
    }
  }, [
    captainResume?.eventDate,
    captainResume?.opponentTeam,
    hasTeamScope,
    matches,
    selectedFlight,
    selectedLeague,
    selectedTeam,
    workspaceState.briefReady,
    workspaceState.lineupCount,
    workspaceState.lineupReady,
    workspaceState.messagingReady,
  ])

  function rememberCaptainResume(stage: 'lineup' | 'scenario' | 'messaging' | 'analytics' | 'availability' | 'team' | 'brief' | 'season-dashboard' | 'tiq-team-matches') {
    writeCaptainResumeState({
      competitionLayer: selectedCompetitionLayer || undefined,
      team: selectedTeam,
      league: selectedLeague,
      flight: selectedFlight,
      lastTool:
        stage === 'lineup'
          ? 'lineup-builder'
          : stage === 'scenario'
            ? 'scenario-builder'
            : stage === 'messaging'
              ? 'messaging'
              : stage === 'analytics'
                ? 'analytics'
                : stage === 'availability'
                  ? 'availability'
                  : stage === 'brief'
                    ? 'weekly-brief'
                    : stage === 'season-dashboard'
                      ? 'season-dashboard'
                      : stage === 'tiq-team-matches'
                        ? 'tiq-team-matches'
                        : 'hub',
      lastToolLabel:
        stage === 'lineup'
          ? 'Lineup Builder'
          : stage === 'scenario'
            ? 'Scenario Builder'
            : stage === 'messaging'
              ? 'Messaging'
              : stage === 'analytics'
                ? 'Captain IQ'
                : stage === 'availability'
                  ? 'Availability'
                  : stage === 'brief'
                    ? 'Weekly Brief'
                    : stage === 'season-dashboard'
                      ? 'Season Dashboard'
                      : stage === 'tiq-team-matches'
                        ? 'Team Match Results'
                        : 'Captain Console',
    })
  }

  function handleCaptainNav(
    href: string,
    stage: 'lineup' | 'scenario' | 'messaging' | 'analytics' | 'availability' | 'team' | 'brief' | 'season-dashboard' | 'tiq-team-matches',
  ) {
    rememberCaptainResume(stage)
    router.push(href)
  }

  function handleWeekStatusUpdate(nextStatus: CaptainWeekStatus) {
    setWeekStatus(nextStatus)
    upsertCaptainWeekStatus(captainWeekStatusScope, nextStatus)
  }

  if (authLoading) {
    return (
      <SiteShell active="/captain">
        <section style={loadingWrap}>
          <div style={stateCard}>Loading Captain dashboard...</div>
        </section>
      </SiteShell>
    )
  }

  if (role === 'public') return null

  return (
    <SiteShell active="/captain">
      <div style={pageWrap}>
        <section style={dynamicHeroCard}>
          <div style={heroLeft}>
            <div style={eyebrow}>Premium captain workflow</div>
            <h1 style={dynamicHeroTitle}>Captain Console</h1>
            <p style={dynamicHeroText}>
              A strategic command center for captains. Choose your team, review lineup intelligence,
              track availability, build match-day options, compare scenarios, communicate with your
              roster, and manage weekly decisions with real team context.
            </p>

            <div style={dynamicHeroControlRow}>
              <select
                value={selectedTeam}
                onChange={(e) => {
                  const option = filteredTeamOptions.find((item) => item.team === e.target.value)
                  setSelectedTeam(e.target.value)
                  if (option) {
                    setSelectedLeague(option.league)
                    setSelectedFlight(option.flight)
                  }
                }}
                style={dynamicSelectStyle}
              >
                {loadingOptions && !filteredTeamOptions.length ? (
                  <option>Loading teams...</option>
                ) : (
                  filteredTeamOptions.map((option) => (
                    <option
                      key={`${option.team}__${option.league}__${option.flight}`}
                      value={option.team}
                    >
                      {option.team} - {option.league} - {option.flight}
                    </option>
                  ))
                )}
              </select>

              <SecondarySmallBtn onClick={() => setRefreshTick((current) => current + 1)}>
                {loadingOptions || loadingTeam ? 'Refreshing...' : 'Refresh data'}
              </SecondarySmallBtn>

              <button
                type="button"
                style={{
                  ...primaryButtonButton,
                  ...(!hasTeamScope ? disabledButton : {}),
                }}
                onClick={() => {
                  if (!hasTeamScope) return
                  handleCaptainNav(lineupBuilderHref, 'lineup')
                }}
                disabled={!hasTeamScope}
              >
                {hasTeamScope ? 'Open Lineup Builder' : 'Choose Team Scope'}
              </button>
            </div>

            <div
              style={{
                ...scopeBanner,
                ...(!filteredTeamOptions.length && !loadingOptions ? scopeBannerWarn : {}),
              }}
            >
              {scopeStatusText}
            </div>

            <div style={heroBadgeRow}>
              <span style={badgeBlue}>{quickStats.matches} matches</span>
              <span style={badgeGreen}>
                {quickStats.wins}-{quickStats.losses} record
              </span>
              <span style={badgeSlate}>{quickStats.roster} active players</span>
              <span style={badgeBlue}>Top pair {quickStats.topPairWinPct}</span>
            </div>
          </div>

          <div style={dynamicHeroRightCard}>
            <div style={captainHeroVisualStyle}>
              <div style={captainHeroBoardGridStyle} />
              <div style={captainHeroVisualGlowStyle} />
              <div style={captainHeroVisualMaskStyle} />
            </div>

            <div style={captainHeroVisualContentStyle}>
              <div>
                <div style={miniKicker}>Captain quick start</div>
                <h2 style={quickStartTitle}>Run the full weekly workflow in one place</h2>
              </div>

              <div style={workflowStack}>
                {[
                  ['1', 'Check availability', 'Start with the right player pool before building anything.'],
                  ['2', 'Build and compare', 'Use lineup builder and scenario tools to pressure-test options.'],
                  ['3', 'Communicate and confirm', 'Send lineup, directions, and reminders from the weekly messaging console.'],
                  ['4', 'Review captain IQ', 'Use analytics to spot dependable players, pairings, and weekly risks.'],
                ].map(([step, title, text]) => (
                  <div key={step} style={workflowRow}>
                    <div style={workflowStep}>{step}</div>
                    <div>
                      <div style={workflowTitle}>{title}</div>
                      <div style={workflowText}>{text}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                  gap: 12,
                }}
              >
                {CAPTAIN_COMMAND_SURFACES.map((item) => (
                  <div key={item.label} style={captainQuickMetricCardStyle}>
                    <div style={miniKicker}>{item.label}</div>
                    <div style={captainQuickMetricValueStyle}>
                      {item.label === 'Availability'
                        ? `${quickStats.roster} ready`
                        : item.label === 'Best lineup'
                          ? `${quickStats.topPairWinPct} edge`
                          : workspaceState.responseAlertCount > 0
                            ? `+${workspaceState.responseAlertCount}`
                            : 'Stable'}
                    </div>
                    <div style={captainQuickMetricTextStyle}>{item.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <CaptainSubnav
          title="Move across the captain workflow"
          description="Keep availability, lineup, scenarios, messaging, and season management inside one cleaner command layer."
        />

        {error ? (
          <section style={errorCard}>
            <div>{error}</div>
            <div style={{ marginTop: 14 }}>
              <SecondarySmallBtn onClick={() => setRefreshTick((current) => current + 1)}>
                Retry captain hub load
              </SecondarySmallBtn>
            </div>
          </section>
        ) : null}

        <section style={dynamicNextActionShell}>
          <div style={nextActionIntro}>
            <div style={sectionKicker}>Captain memory</div>
            <h2 style={sectionTitle}>Resume your weekly workflow.</h2>
            <div style={sectionSub}>
              The captain suite now remembers your last active team scope and workflow so you can jump back into the exact part of the week you were working on.
            </div>
          </div>

          <div style={nextActionCard}>
            <div style={nextActionHeader}>
              <span style={badgeBlue}>{captainResume?.lastToolLabel || 'Captain Console'}</span>
              <span style={badgeSlate}>{captainResume?.lastVisitedAt ? formatDateTimeShort(captainResume.lastVisitedAt) : 'No saved workflow yet'}</span>
            </div>

            <div style={nextActionTitle}>
              {captainResume?.team
                ? `${captainResume.team}${captainResume.league ? ` - ${captainResume.league}` : ''}${captainResume.flight ? ` - ${captainResume.flight}` : ''}`
                : 'Choose a team scope to start building memory'}
            </div>

            <div style={nextActionText}>
              {captainResume?.team
                ? 'Resume the saved captain workflow instantly, or keep working below and your newest scope will stay in memory.'
                : 'Once you open availability, lineup, scenarios, messaging, or analytics, the suite will remember where you left off.'}
            </div>

            <div style={dynamicNextActionButtonRow}>
              <PrimaryLink href={resumeHref}>Resume workflow</PrimaryLink>
              <SecondarySmallLink href={availabilityHref}>Open availability</SecondarySmallLink>
              <SecondarySmallLink href={weeklyBriefHref}>Weekly brief</SecondarySmallLink>
            </div>
          </div>
        </section>

        <section style={sectionCard}>
          <div style={sectionHead}>
            <div>
              <div style={sectionKicker}>Weekly notes memory</div>
              <h2 style={sectionTitle}>Carry the plan through the whole week.</h2>
              <div style={sectionSub}>
                Save the weekly prep details and opponent scouting notes once, then reuse them as you move into lineup building and team messaging.
              </div>
            </div>
            <span style={badgeSlate}>{notesUpdatedLabel}</span>
          </div>

          <div style={notesScopeBanner}>
            {captainNotesScope.team
              ? `Saving notes for ${captainNotesScope.team}${captainNotesScope.league ? ` - ${captainNotesScope.league}` : ''}${captainNotesScope.flight ? ` - ${captainNotesScope.flight}` : ''}${captainNotesScope.eventDate ? ` - ${formatDateShort(captainNotesScope.eventDate)}` : ''}${captainNotesScope.opponentTeam ? ` - vs ${captainNotesScope.opponentTeam}` : ''}`
              : 'Pick a team scope above to start a saved weekly notes thread.'}
          </div>

          <div style={notesGrid}>
            <label style={notesField}>
              <span style={notesLabel}>Weekly prep notes</span>
              <span style={notesHint}>Travel, arrival plan, court prep, roster reminders, subs, weather, or anything your team needs this week.</span>
              <textarea
                value={weeklyPrepNotes}
                onChange={(e) => setWeeklyPrepNotes(e.target.value)}
                placeholder="Arrival time, balls, warm-up courts, weather plan, subs on standby..."
                style={notesTextarea}
                rows={5}
              />
            </label>

            <label style={notesField}>
              <span style={notesLabel}>Opponent scouting notes</span>
              <span style={notesHint}>Patterns to exploit, likely pairings, court tendencies, pressure points, or lineup traps to avoid.</span>
              <textarea
                value={opponentScoutNotes}
                onChange={(e) => setOpponentScoutNotes(e.target.value)}
                placeholder="Likely stack on D1, protect S1, target slower second serve pair, expect late lineup changes..."
                style={notesTextarea}
                rows={5}
              />
            </label>
          </div>
        </section>

        {premiumEnabled ? (
          <section style={premiumStrip}>
            <div>
              <div style={sectionKicker}>Captain tier</div>
              <h2 style={premiumTitle}>Captain is the command layer for this team.</h2>
              <div style={premiumText}>
                Save time, build smarter lineups, keep availability visible, and move the full week from planning to team communication in one place.
              </div>
            </div>
            <div style={pillGroupWrap}>
              <span style={badgeGreen}>{productAccess.captainTierLabel}</span>
              <span style={badgeBlue}>{role === 'admin' ? 'Admin access' : 'Captain access'}</span>
              <PrimarySmallLink href="/pricing">Review plans</PrimarySmallLink>
            </div>
          </section>
        ) : (
          <UpgradePrompt
            planId="captain"
            headline="Still juggling lineups in group texts?"
            body="Captain brings availability, lineup builder, scenario testing, projections, and team messaging into one weekly workflow."
            result="Spend less time chasing players and more time sending a lineup you actually trust."
            ctaLabel="Build Smarter Lineups"
            ctaHref="/pricing"
            compact
          />
        )}

        <section style={dynamicStatusStrip}>
          <StatusStripCard
            label="Lineup"
            value={workspaceState.lineupReady ? 'Built' : 'Not built'}
            detail={workspaceState.lineupReady ? `${workspaceState.lineupCount} lineup slot${workspaceState.lineupCount === 1 ? '' : 's'} loaded` : 'No weekly lineup stored yet'}
            tone={workspaceState.lineupReady ? 'good' : 'info'}
          />
          <StatusStripCard
            label="Scenario"
            value={workspaceState.scenarioReady ? 'Chosen' : 'Not chosen'}
            detail={workspaceState.scenarioReady ? `${workspaceState.scenarioCount} saved scenario${workspaceState.scenarioCount === 1 ? '' : 's'} available${latestScenarioName ? ` - latest: ${latestScenarioName}` : ''}` : 'No saved scenarios tied to this team yet'}
            tone={workspaceState.scenarioReady ? 'good' : 'info'}
          />
          <StatusStripCard
            label="Messaging"
            value={workspaceState.messagingReady ? 'Ready' : 'Not ready'}
            detail={workspaceState.messagingReady ? 'Weekly communication details are in place.' : 'Messaging prep still needs lineup or event details.'}
            tone={workspaceState.messagingReady ? 'good' : 'warn'}
          />
          <StatusStripCard
            label="Resume"
            value={workspaceState.lastUpdatedLabel}
            detail="Last captain workflow touchpoint"
            tone="neutral"
          />
        </section>

        <section style={dynamicNextActionShell}>
          <div style={nextActionIntro}>
            <div style={sectionKicker}>Next best action</div>
            <h2 style={sectionTitle}>What should you do right now?</h2>
            <div style={sectionSub}>
              The hub reads lineup state, saved scenarios, and messaging readiness to suggest the highest-leverage next move.
            </div>
          </div>

          <div style={nextActionCard}>
            <div style={nextActionHeader}>
              <span style={nextAction.tone === 'good' ? badgeGreen : nextAction.tone === 'warn' ? warnBadge : badgeBlue}>
                {nextAction.tone === 'good' ? 'Ready to move' : nextAction.tone === 'warn' ? 'Needs attention' : 'Recommended'}
              </span>
              <span style={badgeSlate}>Resume from hub</span>
            </div>

            <div style={nextActionTitle}>{nextAction.title}</div>
            <div style={nextActionText}>{nextAction.detail}</div>

            <div style={dynamicNextActionButtonRow}>
              <PrimaryBtn
                disabled={!hasTeamScope}
                onClick={() => handleCaptainNav(
                  nextAction.href,
                  nextAction.href === lineupBuilderHref
                    ? 'lineup'
                    : nextAction.href === scenarioHref
                      ? 'scenario'
                      : nextAction.href === messagingHref
                        ? 'messaging'
                        : nextAction.href === analyticsHref
                          ? 'analytics'
                          : 'team',
                )}
              >
                {nextAction.cta}
              </PrimaryBtn>
              <SecondarySmallBtn
                disabled={!hasTeamScope}
                onClick={() => {
                  if (!hasTeamScope) return
                  handleCaptainNav(messagingHref, 'messaging')
                }}
              >
                Continue Messaging
              </SecondarySmallBtn>
            </div>
          </div>
        </section>

        <section style={metricGrid}>
          <MetricCard label="Visible team" value={selectedTeam || '—'} />
          <MetricCard label="League" value={selectedLeague || '—'} />
          <MetricCard label="Flight" value={selectedFlight || '—'} />
          <MetricCard label="Latest match" value={formatDate(quickStats.latest)} accent />
          <MetricCard label="Singles core" value={String(quickStats.singlesCore)} />
          <MetricCard label="Top pair win rate" value={quickStats.topPairWinPct} />
          <MetricCard
            label="Weekly alerts"
            value={String(workspaceState.responseAlertCount)}
            accent={workspaceState.responseAlertCount > 0}
          />
          <MetricCard label="Pending replies" value={String(workspaceState.pendingResponseCount)} />
          <MetricCard
            label="Brief status"
            value={workspaceState.briefReady ? 'Ready' : 'Building'}
            accent={workspaceState.briefReady}
          />
          <MetricCard label="Responses updated" value={workspaceState.latestResponseUpdateLabel} />
        </section>

        <section
          style={{
            ...dynamicNextActionShell,
            borderColor:
              weeklyOpsStatus.tone === 'warn'
                ? 'rgba(251, 191, 36, 0.45)'
                : weeklyOpsStatus.tone === 'good'
                  ? 'rgba(163, 230, 53, 0.35)'
                  : 'rgba(96, 165, 250, 0.28)',
            boxShadow:
              weeklyOpsStatus.tone === 'warn'
                ? '0 18px 45px rgba(120, 53, 15, 0.26)'
                : weeklyOpsStatus.tone === 'good'
                  ? '0 18px 45px rgba(39, 84, 24, 0.22)'
                  : dynamicNextActionShell.boxShadow,
          }}
        >
          <div style={nextActionIntro}>
            <div style={sectionKicker}>Weekly risk watch</div>
            <h2 style={sectionTitle}>{weeklyOpsStatus.title}</h2>
            <div style={sectionSub}>{weeklyOpsStatus.detail}</div>
          </div>

          <div style={nextActionGrid}>
            <div style={nextActionCard}>
              <div style={nextActionLabel}>Captain brief</div>
              <div style={nextActionTitle}>
                {workspaceState.briefReady ? 'Command sheet is ready' : 'Still gathering week context'}
              </div>
              <div style={nextActionText}>
                Open the weekly brief for lineup, notes, opponent context, and final captain actions in one place.
              </div>
            </div>

            <div style={nextActionCardAccent}>
              <div style={nextActionLabel}>Team brief</div>
              <div style={nextActionTitle}>
                {workspaceState.responseAlertCount > 0 ? 'Risk-aware team note available' : 'Player-facing brief ready'}
              </div>
              <div style={nextActionText}>
                Use the team brief for a cleaner shareable summary with logistics, lineup, and live risk callouts.
              </div>
            </div>

            <div style={dynamicNextActionButtonRow}>
              <PrimaryLink href={weeklyBriefHref}>Open weekly brief</PrimaryLink>
              <SecondarySmallLink href={teamBriefHref}>Open team brief</SecondarySmallLink>
              <SecondarySmallLink
                href={workspaceState.pendingResponseCount > 0 ? availabilityHref : messagingHref}
              >
                {workspaceState.pendingResponseCount > 0 ? 'Follow up responses' : 'Open messaging'}
              </SecondarySmallLink>
            </div>
          </div>
        </section>

        <section style={sectionCard}>
          <div style={sectionHead}>
            <div>
              <div style={sectionKicker}>This week at a glance</div>
              <h2 style={sectionTitle}>One compact read on the current match week</h2>
              <div style={sectionSub}>
                See the opponent, scope, readiness, and fastest captain actions without leaving the hub.
              </div>
            </div>
          </div>

          <div style={glanceGrid}>
            <div style={glanceCardAccent}>
              <div style={glanceLabel}>Match week</div>
              <div style={glanceValue}>{weekAtGlance.eventDateLabel}</div>
              <div style={glanceHint}>Opponent: {weekAtGlance.opponentLabel}</div>
            </div>

            <div style={glanceCard}>
              <div style={glanceLabel}>Active scope</div>
              <div style={glanceValue}>{selectedTeam || 'Team not selected'}</div>
              <div style={glanceHint}>{weekAtGlance.scopeLabel}</div>
            </div>

            <div style={glanceCard}>
              <div style={glanceLabel}>Lineup</div>
              <div style={glanceValue}>{weekAtGlance.lineupLabel}</div>
              <div style={glanceHint}>Last captain visit: {workspaceState.lastUpdatedLabel}</div>
            </div>

            <div style={glanceCard}>
              <div style={glanceLabel}>Comms + brief</div>
              <div style={glanceValue}>{weekAtGlance.messagingLabel}</div>
              <div style={glanceHint}>{weekAtGlance.briefLabel}</div>
            </div>
          </div>

          <div style={dynamicGlanceActionRow}>
            <PrimaryLink href={weeklyBriefHref}>Open weekly brief</PrimaryLink>
            <SecondarySmallLink href={teamBriefHref}>Open team brief</SecondarySmallLink>
            <SecondarySmallLink href={lineupBuilderHref}>Edit lineup</SecondarySmallLink>
            <SecondarySmallLink href={messagingHref}>Send update</SecondarySmallLink>
          </div>

          <div style={weekStatusShell}>
            <div>
              <div style={glanceLabel}>Weekly workflow status</div>
              <div style={weekStatusValue}>{weekStatusMeta.label}</div>
              <div style={glanceHint}>{weekStatusMeta.detail}</div>
            </div>

            <div style={dynamicWeekStatusButtonRow}>
              {(['draft-lineup', 'ready-to-send', 'finalized'] as CaptainWeekStatus[]).map((status) => {
                const isActive = weekStatus === status
                const label = status === 'draft-lineup' ? 'Draft lineup' : status === 'ready-to-send' ? 'Ready to send' : 'Finalized'
                return isActive ? (
                  <PrimaryBtn key={status} onClick={() => handleWeekStatusUpdate(status)}>
                    {label}
                  </PrimaryBtn>
                ) : (
                  <SecondarySmallBtn key={status} onClick={() => handleWeekStatusUpdate(status)}>
                    {label}
                  </SecondarySmallBtn>
                )
              })}
            </div>
          </div>
        </section>

        <section style={sectionCard}>
          <div style={sectionHead}>
            <div>
              <div style={sectionKicker}>Quick actions</div>
              <h2 style={sectionTitle}>Captain toolkit</h2>
              <div style={sectionSub}>Everything important for match-week prep in one place.</div>
            </div>
          </div>

          <div style={dynamicActionGrid}>
            <ActionCard
              badge="Briefing"
              title="Weekly Brief"
              description="Open one printable command sheet with notes, lineup state, event details, and the next captain actions."
              href={weeklyBriefHref}
              cta="Open Weekly Brief"
              accent
              onAction={() => handleCaptainNav(weeklyBriefHref, 'brief')}
            />
            <ActionCard
              badge="Availability"
              title="Availability Tracker"
              description="Track who is in, out, tentative, or still needs follow-up before building anything."
              href={availabilityHref}
              cta="Open Availability"
              onAction={() => handleCaptainNav(availabilityHref, 'availability')}
            />
            <ActionCard
              badge="Strategy"
              title="Lineup Builder"
              description="Build your strongest options using actual team context and lineup intelligence."
              href={lineupBuilderHref}
              cta="Open Lineup Builder"
              accent
              premium
              premiumEnabled={premiumEnabled}
              onAction={() => handleCaptainNav(lineupBuilderHref, 'lineup')}
            />
            <ActionCard
              badge="Comparison"
              title="Scenario Builder"
              description="Review and compare likely opponent and saved lineup scenarios."
              href={scenarioHref}
              cta="Open Scenario Builder"
              premium
              premiumEnabled={premiumEnabled}
              onAction={() => handleCaptainNav(scenarioHref, 'scenario')}
            />
            <ActionCard
              badge="Messaging"
              title="Send Weekly Plan"
              description="Text availability checks, lineup announcements, directions, reminders, and follow-ups by team and session."
              href={messagingHref}
              cta="Send to Team"
              premium
              premiumEnabled={premiumEnabled}
              onAction={() => handleCaptainNav(messagingHref, 'messaging')}
            />
            <ActionCard
              badge="Captain IQ"
              title="Captain Analytics"
              description="Review dependability, pairings, roster usage, and lineup signals before finalizing decisions."
              href={analyticsHref}
              cta="Open Analytics"
              premium
              premiumEnabled={premiumEnabled}
              onAction={() => handleCaptainNav(analyticsHref, 'analytics')}
            />
            <ActionCard
              badge="Team Context"
              title="Open Team Page"
              description="Go deeper into roster usage, match history, and full team detail."
              href={currentTeamHref}
              cta="Open Team Page"
              onAction={() => handleCaptainNav(currentTeamHref, 'team')}
            />
            <ActionCard
              badge="TIQ Seasons"
              title="Season Dashboard"
              description={productAccess.teamLeagueMessage}
              href={seasonDashboardHref}
              cta="Open Season Dashboard"
              onAction={() => handleCaptainNav(seasonDashboardHref, 'season-dashboard')}
            />
            <ActionCard
              badge="TIQ Results"
              title="Team Match Results"
              description="Record team match events and enter line results. Completed lines automatically update TIQ dynamic ratings."
              href={tiqTeamMatchesHref}
              cta="Enter Match Results"
              onAction={() => handleCaptainNav(tiqTeamMatchesHref, 'tiq-team-matches')}
            />
          </div>
        </section>

        <section style={sectionCard}>
          <div style={sectionHead}>
            <div>
              <div style={sectionKicker}>Captain command flow</div>
              <h2 style={sectionTitle}>What to do next for {selectedTeam || 'your team'}</h2>
              <div style={sectionSub}>
                These are the highest-value pages to open as you move from planning to match-day execution.
              </div>
            </div>
          </div>

          <div style={dynamicCommandGrid}>
            <div style={commandCard}>
              <div style={commandStep}>Step 1</div>
              <div style={commandTitle}>Lock the player pool</div>
              <div style={commandText}>
                Check availability first so every later decision is based on the players who can actually play.
              </div>
              <SecondarySmallBtn onClick={() => handleCaptainNav(availabilityHref, 'availability')}>Go to Availability</SecondarySmallBtn>
            </div>
            <div style={commandCard}>
              <div style={commandStep}>Step 2</div>
              <div style={commandTitle}>Build and compare lineups</div>
              <div style={commandText}>
                Use lineup builder and scenario tools together to create the best version before you communicate it.
              </div>
              <div style={dynamicCommandButtonRow}>
                <PrimarySmallBtn onClick={() => handleCaptainNav(lineupBuilderHref, 'lineup')}>Lineup Builder</PrimarySmallBtn>
                <SecondarySmallBtn onClick={() => handleCaptainNav(scenarioHref, 'scenario')}>Compare Scenarios</SecondarySmallBtn>
              </div>
            </div>
            <div style={commandCardAccent}>
              <div style={commandStep}>Step 3</div>
              <div style={commandTitle}>Send the weekly plan</div>
              <div style={commandText}>
                Open messaging to send lineups, arrival time, directions, and reminders to the right group.
              </div>
              <div style={dynamicCommandButtonRow}>
                <PrimarySmallBtn onClick={() => handleCaptainNav(messagingHref, 'messaging')}>Open Messaging</PrimarySmallBtn>
                <SecondarySmallBtn onClick={() => handleCaptainNav(analyticsHref, 'analytics')}>Open Captain IQ</SecondarySmallBtn>
              </div>
            </div>
          </div>
        </section>

        <section style={sectionCard}>
          <div style={sectionHead}>
            <div>
              <div style={sectionKicker}>Lineup intelligence preview</div>
              <h2 style={sectionTitle}>Best signals for {selectedTeam || 'your team'}</h2>
              <div style={sectionSub}>
                A quick preview of the players and pairings you should be thinking about first.
              </div>
            </div>
          </div>

          {!hasTeamScope ? (
            <div style={stateCard}>
              Choose a team scope above to unlock lineup intelligence, pairings, and roster signals.
            </div>
          ) : loadingTeam ? (
            <div style={stateCard}>Loading captain insights...</div>
          ) : (
            <div style={dynamicInsightGrid}>
              <div style={insightCard}>
                <div style={insightLabel}>Top singles core</div>
                <div style={insightSub}>
                  Highest singles-ready players using singles dynamic rating plus actual team usage.
                </div>

                <div style={stackList}>
                  {recommendedSingles.length === 0 ? (
                    <div style={emptyLine}>No singles history yet.</div>
                  ) : (
                    recommendedSingles.map((player, index) => (
                      <div key={player.id} style={listCard}>
                        <div>
                          <div style={listTitle}>
                            #{index + 1} {player.name}
                          </div>
                          <div style={listMeta}>
                            {player.appearances} appearances · {player.wins}-{player.losses} when used
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 6 }}>
                          <div style={pillStrong}>{formatRating(player.singlesDynamic)}</div>
                          {player.ratingStatus ? (
                            <span style={{ ...captainStatusPill, ...getCaptainStatusStyle(player.ratingStatus) }}>
                              {player.ratingStatus}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={insightCard}>
                <div style={insightLabel}>Best doubles pairs</div>
                <div style={insightSub}>
                  Pairs ranked by win rate first, then sample size and average doubles dynamic
                  rating.
                </div>

                <div style={stackList}>
                  {pairings.length === 0 ? (
                    <div style={emptyLine}>No doubles pair history yet.</div>
                  ) : (
                    pairings.slice(0, 3).map((pair, index) => (
                      <div key={pair.key} style={listCard}>
                        <div>
                          <div style={listTitle}>
                            #{index + 1} {pair.names.join(' / ')}
                          </div>
                          <div style={listMeta}>
                            {pair.wins}-{pair.losses} together - {pair.appearances} doubles lines
                          </div>
                        </div>

                        <div style={pairMetricWrap}>
                          <div style={pillStrong}>{formatRating(pair.avgDoublesRating)}</div>
                          <div style={pillHelper}>{formatPercent(getWinPct(pair.wins, pair.losses))}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section style={sectionCard}>
          <div style={sectionHead}>
            <div>
              <div style={sectionKicker}>Team snapshot</div>
              <h2 style={sectionTitle}>Roster and match mix</h2>
              <div style={sectionSub}>
                Fast context for how this team has been used across singles and doubles.
              </div>
            </div>
            {roster.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setRosterSortMode('appearances')}
                  style={{
                    padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    background: rosterSortMode === 'appearances' ? 'rgba(255,255,255,0.10)' : 'transparent',
                    border: `1px solid ${rosterSortMode === 'appearances' ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)'}`,
                    color: rosterSortMode === 'appearances' ? 'var(--foreground)' : 'var(--shell-copy-muted)',
                  }}
                >
                  By usage
                </button>
                <button
                  type="button"
                  onClick={() => setRosterSortMode('signal')}
                  style={{
                    padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    background: rosterSortMode === 'signal' ? 'rgba(155,225,29,0.12)' : 'transparent',
                    border: `1px solid ${rosterSortMode === 'signal' ? 'rgba(155,225,29,0.28)' : 'rgba(255,255,255,0.08)'}`,
                    color: rosterSortMode === 'signal' ? '#d9f84a' : 'var(--shell-copy-muted)',
                  }}
                >
                  By signal
                </button>
              </div>
            ) : null}
          </div>

          <div style={summaryGrid}>
            <MiniStat label="Roster size" value={String(quickStats.roster)} />
            <MiniStat label="Total matches" value={String(quickStats.matches)} />
            <MiniStat label="Singles lines" value={String(quickStats.singles)} />
            <MiniStat label="Doubles lines" value={String(quickStats.doubles)} />
          </div>

          <div style={rosterTableWrap}>
            {!hasTeamScope ? (
              <div style={emptyLine}>Choose a team scope to see roster usage and match mix.</div>
            ) : roster.length === 0 ? (
              <div style={emptyLine}>No roster history found for this team selection.</div>
            ) : (
              <div style={rosterList}>
                {sortedRoster.map((player) => (
                  <div key={player.id} style={rosterRow}>
                    <div>
                      <div style={rosterName}>{player.name}</div>
                      <div style={rosterMeta}>
                        {player.appearances} appearances · {player.wins}-{player.losses} record
                      </div>
                    </div>

                    <div style={rosterRatingRow}>
                      <span style={subtlePill}>S {formatRating(player.singlesDynamic)}</span>
                      <span style={subtlePill}>D {formatRating(player.doublesDynamic)}</span>
                      {player.ratingStatus ? (
                        <span style={{ ...captainStatusPill, ...getCaptainStatusStyle(player.ratingStatus) }}>
                          {player.ratingStatus}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </SiteShell>
  )
}

function ActionCard({
  badge,
  title,
  description,
  href,
  cta,
  accent = false,
  premium = false,
  premiumEnabled = true,
  lockedMessage = 'Still building lineups manually? Unlock Captain to save time, reduce stress, and build smarter weekly plans.',
  onAction,
}: {
  badge: string
  title: string
  description: string
  href: string
  cta: string
  accent?: boolean
  premium?: boolean
  premiumEnabled?: boolean
  lockedMessage?: string
  onAction?: () => void
}) {
  const { isSmallMobile } = useViewportBreakpoints()
  const locked = premium && !premiumEnabled

  return (
    <article style={{ ...actionCard, ...(accent ? actionCardAccent : null), ...(locked ? actionCardLocked : null) }}>
      <div style={actionGlow} />
      <div style={actionCardTopRow}>
        <span style={badgePill}>{badge}</span>
        {premium ? (
          <span style={premiumEnabled ? badgeGreen : badgeSlate}>
            {premiumEnabled ? 'Captain tier' : 'Premium'}
          </span>
        ) : null}
      </div>
      <h3 style={actionTitle}>{title}</h3>
      <p style={actionText}>{description}</p>
      {locked ? (
        <div style={lockedText}>{lockedMessage}</div>
      ) : onAction ? (
        accent ? (
          <PrimarySmallBtn onClick={onAction} fullWidth={isSmallMobile}>{cta}</PrimarySmallBtn>
        ) : (
          <SecondarySmallBtn onClick={onAction} fullWidth={isSmallMobile}>{cta}</SecondarySmallBtn>
        )
      ) : (
        accent ? (
          <PrimarySmallLink href={href} fullWidth={isSmallMobile}>{cta}</PrimarySmallLink>
        ) : (
          <SecondarySmallLink href={href} fullWidth={isSmallMobile}>{cta}</SecondarySmallLink>
        )
      )}
    </article>
  )
}

function StatusStripCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: 'good' | 'warn' | 'info' | 'neutral'
}) {
  const toneStyle =
    tone === 'good' ? badgeGreen : tone === 'warn' ? warnBadge : tone === 'info' ? badgeBlue : badgeSlate

  return (
    <div style={statusCard}>
      <div style={statusTopRow}>
        <div style={metricLabel}>{label}</div>
        <span style={toneStyle}>{value}</span>
      </div>
      <div style={statusDetail}>{detail}</div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div style={{ ...metricCard, ...(accent ? metricCardAccent : null) }}>
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniStatCard}>
      <div style={miniStatLabel}>{label}</div>
      <div style={miniStatValue}>{value}</div>
    </div>
  )
}

function PrimaryLink({ href, children, fullWidth = false }: { href: string; children: ReactNode; fullWidth?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...primaryButton,
        width: fullWidth ? '100%' : undefined,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 22px 44px rgba(74,222,128,0.28)' : primaryButton.boxShadow,
        transition: 'transform 150ms ease, box-shadow 150ms ease',
      }}
    >
      {children}
    </Link>
  )
}

function PrimarySmallLink({ href, children, fullWidth = false }: { href: string; children: ReactNode; fullWidth?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...primaryButtonSmall,
        width: fullWidth ? '100%' : undefined,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 20px 38px rgba(74,222,128,0.28)' : primaryButton.boxShadow,
        transition: 'transform 150ms ease, box-shadow 150ms ease',
      }}
    >
      {children}
    </Link>
  )
}

function SecondarySmallLink({ href, children, fullWidth = false }: { href: string; children: ReactNode; fullWidth?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...secondaryButtonSmall,
        width: fullWidth ? '100%' : undefined,
        borderColor: hovered ? 'rgba(116,190,255,0.34)' : 'rgba(116,190,255,0.18)',
        background: hovered ? 'var(--surface-soft-strong)' : 'var(--shell-chip-bg)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'all 150ms ease',
      }}
    >
      {children}
    </Link>
  )
}

function PrimarySmallBtn({
  onClick,
  children,
  fullWidth = false,
}: {
  onClick: () => void
  children: ReactNode
  fullWidth?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        ...primaryButtonSmallButton,
        width: fullWidth ? '100%' : undefined,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 20px 38px rgba(74,222,128,0.28)' : primaryButton.boxShadow,
        transition: 'transform 150ms ease, box-shadow 150ms ease',
      }}
    >
      {children}
    </button>
  )
}

function SecondarySmallBtn({
  onClick,
  disabled,
  children,
  fullWidth = false,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
  fullWidth?: boolean
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
        ...secondaryButtonSmallButton,
        width: fullWidth ? '100%' : undefined,
        borderColor: hovered && !disabled ? 'rgba(116,190,255,0.34)' : 'rgba(116,190,255,0.18)',
        background: hovered && !disabled ? 'var(--surface-soft-strong)' : 'var(--shell-chip-bg)',
        transform: hovered && !disabled ? 'translateY(-1px)' : 'none',
        transition: 'all 150ms ease',
        ...(disabled ? disabledButtonSecondary : {}),
      }}
    >
      {children}
    </button>
  )
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
        ...primaryButtonButton,
        transform: hovered && !disabled ? 'translateY(-2px)' : 'none',
        boxShadow: hovered && !disabled ? '0 22px 44px rgba(74,222,128,0.28)' : primaryButton.boxShadow,
        transition: 'transform 150ms ease, box-shadow 150ms ease',
        ...(disabled ? disabledButton : {}),
      }}
    >
      {children}
    </button>
  )
}

const pageWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - 48px))',
  margin: '0 auto',
  display: 'grid',
  gap: 24,
  padding: '32px 0 72px',
}

const loadingWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - 48px))',
  margin: '0 auto',
  display: 'grid',
  gap: 20,
  padding: '32px 0 72px',
}

const heroCard: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)',
  gap: 22,
  padding: 24,
  borderRadius: 32,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
}

const heroLeft: CSSProperties = {
  display: 'grid',
  gap: 16,
  alignContent: 'start',
}

const heroRightCard: CSSProperties = {
  display: 'grid',
  gap: 16,
  alignContent: 'start',
  padding: 20,
  borderRadius: 24,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid var(--card-border-soft)',
  background: 'var(--surface-soft)',
  color: 'var(--foreground)',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const heroTitle: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(2.2rem, 4vw, 4rem)',
  lineHeight: 0.98,
  letterSpacing: '-0.05em',
  color: 'var(--foreground-strong)',
}

const heroText: CSSProperties = {
  margin: 0,
  maxWidth: 760,
  fontSize: 16,
  lineHeight: 1.7,
  color: 'var(--foreground)',
}

const heroControlRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
}

const selectStyle: CSSProperties = {
  minWidth: 280,
  flex: '1 1 320px',
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '13px 14px',
  outline: 'none',
  fontSize: 14,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '13px 16px',
  borderRadius: 16,
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: 14,
  color: '#04121a',
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  boxShadow: '0 16px 30px rgba(74,222,128,0.18)',
}

const primaryButtonSmall: CSSProperties = {
  ...primaryButton,
  padding: '11px 14px',
  fontSize: 13,
}

const secondaryButtonSmall: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '11px 14px',
  borderRadius: 14,
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: 13,
  color: 'var(--foreground-strong)',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const primaryButtonButton: CSSProperties = {
  ...primaryButton,
  border: 'none',
  cursor: 'pointer',
}

const primaryButtonSmallButton: CSSProperties = {
  ...primaryButtonSmall,
  border: 'none',
  cursor: 'pointer',
}

const secondaryButtonSmallButton: CSSProperties = {
  ...secondaryButtonSmall,
  border: '1px solid rgba(116,190,255,0.18)',
  cursor: 'pointer',
}

const disabledButton: CSSProperties = {
  opacity: 0.55,
  cursor: 'not-allowed',
  boxShadow: 'none',
}

const disabledButtonSecondary: CSSProperties = {
  opacity: 0.55,
  cursor: 'not-allowed',
}

const heroBadgeRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const badgeBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: '0.03em',
}

const badgeBlue: CSSProperties = {
  ...badgeBase,
  color: 'var(--foreground-strong)',
  border: '1px solid var(--shell-panel-border)',
  background: 'rgba(37,91,227,0.12)',
}

const badgeGreen: CSSProperties = {
  ...badgeBase,
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(74,222,128,0.2)',
  background: 'rgba(155,225,29,0.14)',
}

const badgeSlate: CSSProperties = {
  ...badgeBase,
  color: 'var(--foreground)',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const miniKicker: CSSProperties = {
  fontSize: 12,
  color: 'var(--brand-blue-2)',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  fontWeight: 800,
}

const quickStartTitle: CSSProperties = {
  margin: 0,
  fontSize: 24,
  lineHeight: 1.1,
  letterSpacing: '-0.04em',
  color: 'var(--foreground-strong)',
}

const workflowStack: CSSProperties = {
  display: 'grid',
  gap: 14,
}

const workflowRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '42px minmax(0, 1fr)',
  gap: 12,
  alignItems: 'start',
}

const workflowStep: CSSProperties = {
  width: 42,
  height: 42,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 14,
  fontWeight: 900,
  color: '#031018',
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
}

const workflowTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  fontSize: 15,
  marginBottom: 4,
}

const workflowText: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 14,
  lineHeight: 1.6,
}

const captainQuickMetricCardStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: '14px 14px 13px',
  boxShadow: 'var(--shadow-soft)',
  display: 'grid',
  gap: 8,
}

const captainQuickMetricValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: '-0.04em',
  lineHeight: 1,
}

const captainQuickMetricTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.6,
}

const errorCard: CSSProperties = {
  padding: 16,
  borderRadius: 20,
  border: '1px solid rgba(248,113,113,0.22)',
  background: 'rgba(60,16,24,0.76)',
  color: '#fecaca',
  fontWeight: 700,
}

const premiumStrip: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap',
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
}

const premiumTitle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.08,
  letterSpacing: '-0.03em',
}

const premiumText: CSSProperties = {
  marginTop: 8,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.65,
}

const pillGroupWrap: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center',
}

const statusStrip: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
}

const statusCard: CSSProperties = {
  padding: 16,
  borderRadius: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  display: 'grid',
  gap: 10,
}

const statusTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
}

const statusDetail: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.6,
}

const nextActionShell: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.9fr) minmax(320px, 1.1fr)',
  gap: 18,
  padding: 22,
  borderRadius: 28,
  border: '1px solid rgba(74,222,128,0.14)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16)',
}

const nextActionIntro: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
}

const nextActionGrid: CSSProperties = {
  display: 'grid',
  gap: 16,
}

const nextActionCard: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
}

const nextActionCardAccent: CSSProperties = {
  ...nextActionCard,
  border: '1px solid rgba(163,230,53,0.2)',
  background: 'var(--shell-chip-bg-strong)',
}

const nextActionLabel: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
}

const nextActionHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
}

const nextActionTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1.08,
  letterSpacing: '-0.03em',
}

const nextActionText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.7,
}

const nextActionButtonRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const warnBadge: CSSProperties = {
  ...badgeBase,
  color: '#fecaca',
  border: '1px solid rgba(248,113,113,0.22)',
  background: 'rgba(60,16,24,0.76)',
}

const stateCard: CSSProperties = {
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  color: 'var(--foreground)',
  fontWeight: 700,
}

const scopeBanner: CSSProperties = {
  marginTop: '12px',
  borderRadius: '18px',
  padding: '12px 14px',
  background: 'var(--surface-soft)',
  border: '1px solid var(--card-border-soft)',
  color: 'var(--foreground)',
  fontWeight: 700,
  fontSize: '14px',
  lineHeight: 1.55,
  maxWidth: '940px',
}

const scopeBannerWarn: CSSProperties = {
  background: 'rgba(245, 158, 11, 0.12)',
  border: '1px solid rgba(245, 158, 11, 0.2)',
  color: '#fde68a',
}

const metricGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 16,
}

const metricCard: CSSProperties = {
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: '0 10px 30px rgba(2,10,24,0.14)',
}

const glanceGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 16,
}

const glanceCard: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
}

const glanceCardAccent: CSSProperties = {
  ...glanceCard,
  border: '1px solid rgba(163,230,53,0.22)',
  background: 'var(--shell-chip-bg-strong)',
}

const glanceLabel: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
}

const glanceValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1.15,
  letterSpacing: '-0.03em',
}

const glanceHint: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.6,
}

const glanceActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 18,
}

const weekStatusShell: CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gap: 14,
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
}

const weekStatusValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
  marginTop: 6,
}

const weekStatusButtonRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const metricCardAccent: CSSProperties = {
  border: '1px solid rgba(74,222,128,0.18)',
  boxShadow: '0 10px 24px rgba(74,222,128,0.08)',
}

const metricLabel: CSSProperties = {
  fontSize: 12,
  color: 'var(--foreground)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 800,
}

const metricValue: CSSProperties = {
  marginTop: 10,
  color: 'var(--foreground-strong)',
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1.05,
  letterSpacing: '-0.04em',
}

const sectionCard: CSSProperties = {
  display: 'grid',
  gap: 18,
  padding: 22,
  borderRadius: 28,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16)',
}

const sectionHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'start',
  gap: 16,
  flexWrap: 'wrap',
}

const sectionKicker: CSSProperties = {
  fontSize: 12,
  color: 'var(--shell-copy-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 800,
}

const sectionTitle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 28,
  lineHeight: 1.06,
  letterSpacing: '-0.04em',
}

const sectionSub: CSSProperties = {
  marginTop: 8,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.7,
}

const notesScopeBanner: CSSProperties = {
  borderRadius: 18,
  padding: '12px 14px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  color: 'var(--foreground)',
  fontWeight: 700,
  fontSize: 14,
  lineHeight: 1.6,
}

const notesGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 16,
}

const notesField: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const notesLabel: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 800,
}

const notesHint: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.65,
}

const notesTextarea: CSSProperties = {
  width: '100%',
  minHeight: 148,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  padding: '14px 16px',
  outline: 'none',
  resize: 'vertical',
  lineHeight: 1.65,
}

const actionGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
}

const actionCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  gap: 12,
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}

const actionCardAccent: CSSProperties = {
  border: '1px solid rgba(74,222,128,0.18)',
  boxShadow: '0 14px 34px rgba(74,222,128,0.08)',
}

const actionGlow: CSSProperties = {
  position: 'absolute',
  inset: 'auto -10% -40% auto',
  width: 180,
  height: 180,
  borderRadius: 999,
  background: 'radial-gradient(circle, rgba(74,163,255,0.14), transparent 70%)',
  pointerEvents: 'none',
}

const actionCardLocked: CSSProperties = {
  opacity: 0.82,
}

const actionCardTopRow: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
}

const lockedText: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.6,
}

const badgePill: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'inline-flex',
  width: 'fit-content',
  padding: '7px 11px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--foreground)',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const actionTitle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const actionText: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.7,
}

const commandGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 16,
}

const commandCard: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const commandCardAccent: CSSProperties = {
  ...commandCard,
  border: '1px solid rgba(74,222,128,0.18)',
  boxShadow: '0 14px 34px rgba(74,222,128,0.08)',
}

const commandStep: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  padding: '7px 11px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  color: '#dcfce7',
  border: '1px solid rgba(74,222,128,0.2)',
  background: 'rgba(17,39,27,0.88)',
}

const commandTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 20,
  fontWeight: 900,
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const commandText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.7,
}

const commandButtonRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const insightGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 18,
}

const insightCard: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}

const insightLabel: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 18,
  fontWeight: 800,
}

const insightSub: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.65,
}

const stackList: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const listCard: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  padding: 14,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const listTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  fontSize: 15,
}

const listMeta: CSSProperties = {
  marginTop: 4,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
}

const pillStrong: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 62,
  padding: '8px 12px',
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 13,
  color: '#04121a',
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
}

const pillHelper: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  textAlign: 'center',
  color: 'var(--shell-copy-muted)',
  fontWeight: 700,
}

const pairMetricWrap: CSSProperties = {
  display: 'grid',
  justifyItems: 'end',
}

const emptyLine: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  color: 'var(--shell-copy-muted)',
  border: '1px dashed rgba(116,190,255,0.18)',
  background: 'var(--shell-chip-bg)',
}

const summaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 14,
}

const miniStatCard: CSSProperties = {
  padding: 16,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const miniStatLabel: CSSProperties = {
  fontSize: 12,
  color: 'var(--shell-copy-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 800,
}

const miniStatValue: CSSProperties = {
  marginTop: 8,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: 22,
  letterSpacing: '-0.03em',
}

const rosterTableWrap: CSSProperties = {
  display: 'grid',
}

const rosterList: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const rosterRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: 14,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const rosterName: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  fontSize: 15,
}

const rosterMeta: CSSProperties = {
  marginTop: 4,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
}

const rosterRatingRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const subtlePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 10px',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  color: 'var(--foreground)',
  background: 'var(--shell-chip-bg)',
  fontWeight: 700,
  fontSize: 12,
}

const captainStatusPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.03em',
  whiteSpace: 'nowrap' as const,
}

function getCaptainRatingStatus(base: number, dynamic: number): RatingStatus {
  const diff = dynamic - base
  if (diff >= 0.15) return 'Bump Up Pace'
  if (diff >= 0.07) return 'Trending Up'
  if (diff > -0.07) return 'Holding'
  if (diff > -0.15) return 'At Risk'
  return 'Drop Watch'
}

function getCaptainStatusStyle(status: RatingStatus): CSSProperties {
  switch (status) {
    case 'Bump Up Pace': return { background: 'rgba(155,225,29,0.12)', color: '#d9f84a', border: '1px solid rgba(155,225,29,0.24)' }
    case 'Trending Up':  return { background: 'rgba(52,211,153,0.12)', color: '#a7f3d0', border: '1px solid rgba(52,211,153,0.22)' }
    case 'Holding':      return { background: 'rgba(63,167,255,0.10)', color: '#bfdbfe', border: '1px solid rgba(63,167,255,0.20)' }
    case 'At Risk':      return { background: 'rgba(251,146,60,0.12)', color: '#fed7aa', border: '1px solid rgba(251,146,60,0.22)' }
    case 'Drop Watch':   return { background: 'rgba(239,68,68,0.12)', color: '#fecaca', border: '1px solid rgba(239,68,68,0.22)' }
  }
}
