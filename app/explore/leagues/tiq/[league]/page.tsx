'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import FollowButton from '@/app/components/follow-button'
import SiteShell from '@/app/components/site-shell'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { getClientAuthState } from '@/lib/auth'
import { buildCaptainScopedHref } from '@/lib/captain-memory'
import { getCompetitionLayerLabel, getLeagueFormatLabel } from '@/lib/competition-layers'
import { buildScopedTeamEntityId } from '@/lib/entity-ids'
import { buildScopedLeagueEntityId } from '@/lib/entity-ids'
import { appendMyLabEvents } from '@/lib/my-lab-events'
import {
  listTiqIndividualLeagueResults,
  saveTiqIndividualLeagueResult,
  type TiqIndividualLeagueResultRecord,
  type TiqLeagueStorageSource as TiqResultStorageSource,
} from '@/lib/tiq-individual-results-service'
import {
  buildTiqSuggestionPairKey,
  claimTiqIndividualSuggestion,
  completeTiqIndividualSuggestionsForPair,
  listTiqIndividualSuggestions,
  saveTiqIndividualSuggestion,
  updateTiqIndividualSuggestionStatus,
  type TiqIndividualSuggestionRecord,
  type TiqIndividualSuggestionStatus,
  type TiqLeagueStorageSource as TiqSuggestionStorageSource,
} from '@/lib/tiq-individual-suggestions-service'
import {
  getTiqIndividualCompetitionFormatDescription,
  getTiqIndividualCompetitionFormatExperience,
  getTiqIndividualCompetitionFormatLabel,
  normalizeTiqIndividualCompetitionFormat,
  type TiqIndividualCompetitionFormat,
} from '@/lib/tiq-individual-format'
import { formatRating, cleanText } from '@/lib/captain-formatters'
import { listPlayerDirectoryOptions, type PlayerDirectoryOption } from '@/lib/player-directory'
import { getTiqRating, getUstaRating } from '@/lib/player-rating-display'
import { supabase } from '@/lib/supabase'
import { listTeamDirectoryOptions, type TeamDirectoryOption } from '@/lib/team-directory'
import { type TiqLeagueRecord } from '@/lib/tiq-league-registry'
import {
  addTiqPlayerLeagueEntry,
  addTiqTeamLeagueEntry,
  getTiqLeagueById,
  listTiqPlayerLeagueEntries,
  listTiqTeamLeagueEntries,
  type TiqTeamLeagueEntryRecord,
  type TiqLeagueStorageSource,
  type TiqPlayerLeagueEntryRecord,
} from '@/lib/tiq-league-service'
import {
  computeTiqTeamLeagueStandings,
  listTiqTeamMatchEvents,
  listTiqTeamMatchLines,
  type TiqTeamMatchEventRecord,
  type TiqTeamMatchLineRecord,
  type TiqTeamStandingRow,
} from '@/lib/tiq-team-results-service'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

function formatDateTime(value: string | null | undefined) {
  const parsed = value ? new Date(value) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return value || 'Not available'

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function deriveDefaultParticipantName(email: string | null | undefined) {
  const localPart = cleanText(email).split('@')[0] || ''
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}

function toOptionalRating(value: number | string | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

type PlayerProfileSummary = {
  id: string
  name: string
  location: string | null
  overall_rating?: number | string | null
  overall_dynamic_rating?: number | null
  overall_usta_dynamic_rating?: number | null
  singles_rating?: number | string | null
  singles_dynamic_rating?: number | null
  singles_usta_dynamic_rating?: number | null
  doubles_rating?: number | string | null
  doubles_dynamic_rating?: number | null
  doubles_usta_dynamic_rating?: number | null
}

type IndividualStanding = {
  rank: number
  playerId: string
  playerName: string
  location: string
  ustaRating: number | null
  tiqRating: number | null
  trackedMatches: number
  leagueWins: number
  leagueLosses: number
  leagueMatches: number
  recentForm: Array<'W' | 'L'>
  uniqueOpponentsPlayed: number
  possibleOpponents: number
  completionRate: number | null
  recentResultsCount: number
  momentumScore: number
  ratingGap: number | null
}

type ResultParticipantOption = {
  value: string
  playerId: string
  playerName: string
}

type CompetitionOpportunity = {
  key: string
  suggestionType: string
  title: string
  body: string
  playerAName: string
  playerAId: string
  playerBName: string
  playerBId: string
  primaryHref: string | null
  primaryLabel: string
  secondaryHref: string | null
  secondaryLabel: string
}

type LeagueRatingStatus = 'Bump Up Pace' | 'Trending Up' | 'Holding' | 'At Risk' | 'Drop Watch'

function getLeagueRatingStatus(gap: number | null): LeagueRatingStatus | null {
  if (gap === null) return null
  if (gap >= 0.15) return 'Bump Up Pace'
  if (gap >= 0.07) return 'Trending Up'
  if (gap > -0.07) return 'Holding'
  if (gap > -0.15) return 'At Risk'
  return 'Drop Watch'
}

function getLeagueStatusStyle(status: LeagueRatingStatus): CSSProperties {
  switch (status) {
    case 'Bump Up Pace': return { background: 'rgba(155,225,29,0.12)', color: '#d9f84a', border: '1px solid rgba(155,225,29,0.24)' }
    case 'Trending Up':  return { background: 'rgba(52,211,153,0.12)', color: '#a7f3d0', border: '1px solid rgba(52,211,153,0.22)' }
    case 'Holding':      return { background: 'rgba(63,167,255,0.10)', color: '#bfdbfe', border: '1px solid rgba(63,167,255,0.20)' }
    case 'At Risk':      return { background: 'rgba(251,146,60,0.12)', color: '#fed7aa', border: '1px solid rgba(251,146,60,0.22)' }
    case 'Drop Watch':   return { background: 'rgba(239,68,68,0.12)', color: '#fecaca', border: '1px solid rgba(239,68,68,0.22)' }
  }
}

function isRecentResult(value: string | null | undefined, windowDays: number) {
  const parsed = value ? new Date(value) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return false
  const windowStart = Date.now() - windowDays * 24 * 60 * 60 * 1000
  return parsed.getTime() >= windowStart
}

function getStandingMetricConfig(
  entry: IndividualStanding,
  format: TiqIndividualCompetitionFormat,
) {
  if (format === 'ladder') {
    return {
      subtitle: `${entry.uniqueOpponentsPlayed} opponents played`,
      primaryLabel: 'Active',
      primaryValue: String(entry.recentResultsCount),
      secondaryLabel: 'Opponents',
      secondaryValue: String(entry.uniqueOpponentsPlayed),
    }
  }

  if (format === 'round_robin') {
    return {
      subtitle:
        entry.completionRate !== null
          ? `${Math.round(entry.completionRate * 100)}% field coverage`
          : 'Waiting for field coverage',
      primaryLabel: 'Coverage',
      primaryValue: entry.completionRate !== null ? `${Math.round(entry.completionRate * 100)}%` : '—',
      secondaryLabel: 'Opponents',
      secondaryValue: String(entry.uniqueOpponentsPlayed),
    }
  }

  if (format === 'challenge') {
    return {
      subtitle: `${entry.recentResultsCount} recent challenges`,
      primaryLabel: 'Recent',
      primaryValue: String(entry.recentResultsCount),
      secondaryLabel: 'Momentum',
      secondaryValue: String(entry.momentumScore),
    }
  }

  return {
    subtitle: `${entry.leagueMatches} TIQ results`,
    primaryLabel: 'Form',
    primaryValue: entry.recentForm.length ? entry.recentForm.join('') : '—',
    secondaryLabel: 'Matches',
    secondaryValue: String(entry.leagueMatches),
  }
}

function buildPlayerHref(playerId: string) {
  return playerId ? `/players/${encodeURIComponent(playerId)}` : null
}

function buildMatchupHref(playerAId: string, playerBId: string) {
  if (!playerAId || !playerBId) return null
  return `/matchup?playerA=${encodeURIComponent(playerAId)}&playerB=${encodeURIComponent(playerBId)}`
}

function buildPrefilledResultHref(
  routeSlug: string,
  leagueId: string,
  playerAValue: string,
  playerBValue: string,
) {
  const params = new URLSearchParams({
    league_id: leagueId,
    suggest_player_a: playerAValue,
    suggest_player_b: playerBValue,
  })
  return `/explore/leagues/tiq/${encodeURIComponent(routeSlug || leagueId)}?${params.toString()}`
}

export default function TiqLeagueDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const routeSlug = decodeURIComponent(
    Array.isArray(params.league) ? params.league[0] || '' : (params.league as string) || '',
  )
  const leagueIdParam = searchParams.get('league_id') || ''
  const suggestedResultPlayerA = searchParams.get('suggest_player_a') || ''
  const suggestedResultPlayerB = searchParams.get('suggest_player_b') || ''

  const [league, setLeague] = useState<TiqLeagueRecord | null>(null)
  const [storageSource, setStorageSource] = useState<TiqLeagueStorageSource>('local')
  const [storageWarning, setStorageWarning] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [entryValue, setEntryValue] = useState('')
  const [selectedTeamKey, setSelectedTeamKey] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [role, setRole] = useState<'public' | 'member' | 'captain' | 'admin'>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [userId, setUserId] = useState('')
  const [teamOptions, setTeamOptions] = useState<TeamDirectoryOption[]>([])
  const [playerOptions, setPlayerOptions] = useState<PlayerDirectoryOption[]>([])
  const [teamEntries, setTeamEntries] = useState<TiqTeamLeagueEntryRecord[]>([])
  const [playerEntries, setPlayerEntries] = useState<TiqPlayerLeagueEntryRecord[]>([])
  const [individualStandings, setIndividualStandings] = useState<IndividualStanding[]>([])
  const [individualResults, setIndividualResults] = useState<TiqIndividualLeagueResultRecord[]>([])
  const [resultStorageSource, setResultStorageSource] = useState<TiqResultStorageSource>('local')
  const [savedSuggestions, setSavedSuggestions] = useState<TiqIndividualSuggestionRecord[]>([])
  const [suggestionStorageSource, setSuggestionStorageSource] = useState<TiqSuggestionStorageSource>('local')
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [resultPlayerA, setResultPlayerA] = useState('')
  const [resultPlayerB, setResultPlayerB] = useState('')
  const [resultWinner, setResultWinner] = useState('')
  const [resultScore, setResultScore] = useState('')
  const [resultDate, setResultDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [resultNotes, setResultNotes] = useState('')
  const [resultSaving, setResultSaving] = useState(false)
  const [resultStatus, setResultStatus] = useState('')
  const [suggestionStatus, setSuggestionStatus] = useState('')
  const [suggestionSavingKey, setSuggestionSavingKey] = useState('')
  const [appliedSuggestedResultKey, setAppliedSuggestedResultKey] = useState('')
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const [teamMatchEvents, setTeamMatchEvents] = useState<TiqTeamMatchEventRecord[]>([])
  const [teamMatchEventsLoading, setTeamMatchEventsLoading] = useState(false)
  const [expandedMatchEventId, setExpandedMatchEventId] = useState<string | null>(null)
  const [matchEventLines, setMatchEventLines] = useState<Record<string, TiqTeamMatchLineRecord[]>>({})
  const [matchEventLinesLoading, setMatchEventLinesLoading] = useState<Record<string, boolean>>({})
  const [teamStandings, setTeamStandings] = useState<TiqTeamStandingRow[]>([])

  useEffect(() => {
    let active = true

    async function loadPage() {
      setLoading(true)
      setError('')

      try {
        const [authState, leagueResult, loadedTeamOptions, loadedPlayerOptions] = await Promise.all([
          getClientAuthState(),
          getTiqLeagueById(leagueIdParam || routeSlug),
          listTeamDirectoryOptions().catch(() => []),
          listPlayerDirectoryOptions().catch(() => []),
        ])

        if (!active) return

        setRole(authState.role)
        setEntitlements(authState.entitlements)
        setUserId(authState.user?.id || '')
        setUserEmail(authState.user?.email || '')
        setTeamOptions(loadedTeamOptions)
        setPlayerOptions(loadedPlayerOptions)
        setStorageSource(leagueResult.source)
        setStorageWarning(leagueResult.warning || '')

        const matchedLeague =
          leagueResult.record ||
          null

        if (!matchedLeague) {
          setLeague(null)
          setError('This TIQ league could not be found in the current registry.')
          return
        }

        setLeague(matchedLeague)
        setEntryValue(
          matchedLeague.leagueFormat === 'team'
            ? matchedLeague.captainTeamName || ''
            : deriveDefaultParticipantName(authState.user?.email),
        )
        setSelectedTeamKey('')
        setSelectedPlayerId('')
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load this TIQ league.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadPage()

    return () => {
      active = false
    }
  }, [leagueIdParam, routeSlug])

  useEffect(() => {
    let active = true

    async function loadTeamEntries() {
      if (!league) {
        if (active) {
          setTeamEntries([])
          setPlayerEntries([])
        }
        return
      }

      if (league.leagueFormat === 'team') {
        const result = await listTiqTeamLeagueEntries(league.id)
        if (!active) return
        setTeamEntries(result.entries)
        setPlayerEntries([])
        if (result.warning) {
          setStorageWarning((current) => current || result.warning || '')
        }
        return
      }

      const result = await listTiqPlayerLeagueEntries(league.id)
      if (!active) return
      setPlayerEntries(result.entries)
      setTeamEntries([])
      if (result.warning) {
        setStorageWarning((current) => current || result.warning || '')
      }
    }

    void loadTeamEntries()

    return () => {
      active = false
    }
  }, [league])

  useEffect(() => {
    let active = true

    async function loadTeamMatchEvents() {
      if (!league || league.leagueFormat !== 'team') {
        if (active) { setTeamMatchEvents([]); setTeamStandings([]) }
        return
      }
      if (active) setTeamMatchEventsLoading(true)
      const [{ events }, { standings }] = await Promise.all([
        listTiqTeamMatchEvents({ leagueId: league.id }),
        computeTiqTeamLeagueStandings(league.id),
      ])
      if (!active) return
      setTeamMatchEvents(events)
      setTeamStandings(standings)
      setTeamMatchEventsLoading(false)
    }

    void loadTeamMatchEvents()

    return () => {
      active = false
    }
  }, [league])

  async function handleExpandMatchEvent(eventId: string) {
    if (expandedMatchEventId === eventId) {
      setExpandedMatchEventId(null)
      return
    }
    setExpandedMatchEventId(eventId)
    if (matchEventLines[eventId]) return
    setMatchEventLinesLoading((prev) => ({ ...prev, [eventId]: true }))
    const { lines } = await listTiqTeamMatchLines(eventId)
    setMatchEventLines((prev) => ({ ...prev, [eventId]: lines }))
    setMatchEventLinesLoading((prev) => ({ ...prev, [eventId]: false }))
  }

  const access = useMemo(() => buildProductAccessState(role, entitlements), [entitlements, role])
  const individualCompetitionFormat = normalizeTiqIndividualCompetitionFormat(
    league?.individualCompetitionFormat,
  )
  const individualFormatExperience = getTiqIndividualCompetitionFormatExperience(
    league?.individualCompetitionFormat,
  )
  const entryEnabled = league?.leagueFormat === 'team' ? access.canEnterTiqTeamLeague : access.canJoinTiqIndividualLeague
  const entryLabel = league?.leagueFormat === 'team' ? 'Enter Team' : 'Join League'
  const entryPlaceholder =
    league?.leagueFormat === 'team' ? 'North Dallas Aces' : deriveDefaultParticipantName(userEmail) || 'Player name'
  const entryMessage =
    league?.leagueFormat === 'team' ? access.teamLeagueMessage : access.individualLeagueMessage
  const participants = league?.leagueFormat === 'team' ? league.teams || [] : league?.players || []
  const tiqSignals = league
    ? [
        {
          label: 'Competition layer',
          value: getCompetitionLayerLabel('tiq'),
          note: 'TIQ leagues should feel interactive and strategic, not like official browse-only contexts.',
        },
        {
          label: 'League format',
          value:
            league.leagueFormat === 'individual'
              ? getTiqIndividualCompetitionFormatLabel(league.individualCompetitionFormat)
              : getLeagueFormatLabel(league.leagueFormat),
          note:
            league.leagueFormat === 'team'
              ? 'Team leagues connect participation directly into captain workflow and seasonal operations.'
              : 'Individual leagues connect entry, standings, prompts, and results into one internal competition loop.',
        },
        {
          label: 'Season activity',
          value: `${participants.length} participants`,
          note:
            league.leagueFormat === 'team'
              ? 'Use this page to enter teams and move quickly into availability, lineups, scenarios, and messaging.'
              : 'Use this page to join, compare entrants, log results, and act on the next TIQ opportunity.',
        },
      ]
    : []
  const visibleTeamEntries = useMemo(() => {
    if (!league || league.leagueFormat !== 'team') return []

    const knownEntries = teamEntries.filter((entry) => entry.entryStatus === 'active')
    if (knownEntries.length > 0) return knownEntries

    return (league.teams || []).map((teamName) => ({
      leagueId: league.id,
      teamName,
      teamEntityId: '',
      sourceLeagueName: '',
      sourceFlight: '',
      entryStatus: 'active' as const,
    }))
  }, [league, teamEntries])
  const availableTeamOptions = useMemo(() => {
    if (!league || league.leagueFormat !== 'team') return []

    return teamOptions.filter((option) => {
      if (visibleTeamEntries.some((entry) => entry.teamName.toLowerCase() === option.team.toLowerCase())) {
        return false
      }

      if (league.flight && option.flight && option.flight !== league.flight) return false
      return true
    })
  }, [league, teamOptions, visibleTeamEntries])
  const visiblePlayerEntries = useMemo(() => {
    if (!league || league.leagueFormat !== 'individual') return []

    const knownEntries = playerEntries.filter((entry) => entry.entryStatus === 'active')
    if (knownEntries.length > 0) return knownEntries

    return (league.players || []).map((playerName) => ({
      leagueId: league.id,
      playerName,
      playerId: '',
      playerLocation: '',
      entryStatus: 'active' as const,
    }))
  }, [league, playerEntries])
  const availablePlayerOptions = useMemo(() => {
    if (!league || league.leagueFormat !== 'individual') return []

    return playerOptions.filter((option) => {
      if (visiblePlayerEntries.some((entry) => entry.playerName.toLowerCase() === option.name.toLowerCase())) {
        return false
      }
      return true
    })
  }, [league, playerOptions, visiblePlayerEntries])
  const resultParticipantOptions = useMemo<ResultParticipantOption[]>(
    () =>
      visiblePlayerEntries.map((entry) => ({
        value: entry.playerId || `name:${entry.playerName}`,
        playerId: entry.playerId,
        playerName: entry.playerName,
      })),
    [visiblePlayerEntries],
  )
  const captainLinks =
    league?.leagueFormat === 'team'
      ? [
          {
            href: buildCaptainScopedHref('/captain/availability', {
              competitionLayer: 'tiq',
              league: league.leagueName,
              flight: league.flight,
            }),
            label: 'Availability',
          },
          {
            href: buildCaptainScopedHref('/captain/lineup-builder', {
              competitionLayer: 'tiq',
              league: league.leagueName,
              flight: league.flight,
            }),
            label: 'Lineup Builder',
          },
          {
            href: buildCaptainScopedHref('/captain/scenario-builder', {
              competitionLayer: 'tiq',
              league: league.leagueName,
              flight: league.flight,
            }),
            label: 'Scenario Builder',
          },
          {
            href: buildCaptainScopedHref('/captain/messaging', {
              competitionLayer: 'tiq',
              league: league.leagueName,
              flight: league.flight,
            }),
            label: 'Messaging',
          },
        ]
      : []
  const selectedTeamOption = teamOptions.find((item) => item.key === selectedTeamKey) || null
  const selectedPlayerOption = playerOptions.find((item) => item.id === selectedPlayerId) || null
  const resultPlayerAOption =
    resultParticipantOptions.find((option) => option.value === resultPlayerA) || null
  const resultPlayerBOption =
    resultParticipantOptions.find((option) => option.value === resultPlayerB) || null
  const resultWinnerOptions = [resultPlayerAOption, resultPlayerBOption].filter(
    (option): option is ResultParticipantOption => Boolean(option),
  )
  const suggestedResultKey = `${suggestedResultPlayerA}::${suggestedResultPlayerB}`
  const savedSuggestionByOpportunityKey = useMemo(() => {
    const map = new Map<string, TiqIndividualSuggestionRecord>()
    savedSuggestions.forEach((suggestion) => {
      const key = `${suggestion.suggestionType}::${suggestion.pairKey}`
      if (!map.has(key)) {
        map.set(key, suggestion)
      }
    })
    return map
  }, [savedSuggestions])
  const dynamicHeroCard: CSSProperties = {
    ...heroCard,
    padding: isMobile ? '22px 18px' : '28px',
  }
  const dynamicHeroGrid: CSSProperties = {
    ...heroGrid,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.08fr) minmax(320px, 0.92fr)',
    gap: isMobile ? '16px' : '20px',
  }
  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '42px' : '56px',
    lineHeight: isMobile ? 1.02 : 0.98,
  }
  const dynamicMetricGrid: CSSProperties = {
    ...metricGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isMobile
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(auto-fit, minmax(180px, 1fr))',
  }
  const dynamicSignalGrid: CSSProperties = {
    ...signalGridStyle,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isMobile
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(auto-fit, minmax(220px, 1fr))',
  }
  const dynamicContentGrid: CSSProperties = {
    ...contentGrid,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
  }
  const dynamicPanelCard: CSSProperties = {
    ...panelCard,
    padding: isMobile ? '20px 18px' : '24px',
  }
  const dynamicListCard: CSSProperties = {
    ...listCard,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'flex-start' : 'center',
  }
  const dynamicStandingCard: CSSProperties = {
    ...standingCard,
    gridTemplateColumns: isSmallMobile ? '1fr' : '56px minmax(0, 1fr)',
  }
  const dynamicStandingRank: CSSProperties = {
    ...standingRank,
    minHeight: isSmallMobile ? '56px' : undefined,
  }
  const dynamicStandingMetrics: CSSProperties = {
    ...standingMetrics,
    justifyContent: isSmallMobile ? 'flex-start' : 'flex-end',
  }
  const dynamicResultMetaStack: CSSProperties = {
    ...resultMetaStack,
    justifyItems: isSmallMobile ? 'start' : 'end',
  }
  const dynamicOpportunityGrid: CSSProperties = {
    ...opportunityGrid,
    gridTemplateColumns: isTablet ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }
  const dynamicResultFormGrid: CSSProperties = {
    ...resultFormGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }
  const dynamicQuickGrid: CSSProperties = {
    ...quickGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
  }
  const competitionOpportunities = useMemo<CompetitionOpportunity[]>(() => {
    if (!league || league.leagueFormat !== 'individual' || individualStandings.length === 0) return []

    const normalizedResults = individualResults.map((result) => ({
      playerAName: result.playerAName.toLowerCase(),
      playerBName: result.playerBName.toLowerCase(),
    }))

    const hasPlayed = (leftName: string, rightName: string) =>
      normalizedResults.some(
        (result) =>
          (result.playerAName === leftName && result.playerBName === rightName) ||
          (result.playerAName === rightName && result.playerBName === leftName),
      )

    if (individualCompetitionFormat === 'ladder') {
      return individualStandings
        .filter((entry) => entry.rank > 1)
        .slice(0, 4)
        .map((entry) => {
          const playerKey = entry.playerName.toLowerCase()
          const targetAbove = individualStandings.find((candidate) => candidate.rank === entry.rank - 1) || null
          const lastPlayedAbove = targetAbove ? hasPlayed(playerKey, targetAbove.playerName.toLowerCase()) : false

          const entryValue = entry.playerId || `name:${entry.playerName}`
          const targetValue = targetAbove?.playerId || `name:${targetAbove?.playerName || ''}`

          return {
            key: `ladder-${entry.playerName}`,
            suggestionType: 'ladder_target',
            title: `${entry.playerName} has a ladder target above`,
            body: targetAbove
              ? `${targetAbove.playerName} sits one spot higher. ${lastPlayedAbove ? 'A rematch could decide whether the climb is real.' : 'They have not logged a TIQ result against each other yet.'}`
              : `${entry.playerName} is already at the top of the active ladder.`,
            playerAName: entry.playerName,
            playerAId: entry.playerId,
            playerBName: targetAbove?.playerName || '',
            playerBId: targetAbove?.playerId || '',
            primaryHref: targetAbove ? buildMatchupHref(entry.playerId, targetAbove.playerId) : buildPlayerHref(entry.playerId),
            primaryLabel: targetAbove ? 'Compare matchup' : 'Player page',
            secondaryHref:
              targetAbove && targetValue
                ? buildPrefilledResultHref(routeSlug || league.id, league.id, entryValue, targetValue)
                : null,
            secondaryLabel: targetAbove ? 'Log result' : '',
          }
        })
    }

    if (individualCompetitionFormat === 'round_robin') {
      return individualStandings
        .map((entry) => {
          const playerKey = entry.playerName.toLowerCase()
          const unplayedOpponents = individualStandings.filter(
            (candidate) =>
              candidate.playerName !== entry.playerName &&
              !hasPlayed(playerKey, candidate.playerName.toLowerCase()),
          )
          const nearestUnplayed =
            unplayedOpponents.sort((left, right) => Math.abs(left.rank - entry.rank) - Math.abs(right.rank - entry.rank))[0] ||
            null

          return {
            entry,
            unplayedOpponents,
            nearestUnplayed,
          }
        })
        .filter((item) => item.unplayedOpponents.length > 0)
        .sort((left, right) => right.unplayedOpponents.length - left.unplayedOpponents.length)
        .slice(0, 4)
        .map(({ entry, unplayedOpponents, nearestUnplayed }) => {
          const entryValue = entry.playerId || `name:${entry.playerName}`
          const nearestValue = nearestUnplayed?.playerId || `name:${nearestUnplayed?.playerName || ''}`

          return {
            key: `round-robin-${entry.playerName}`,
            suggestionType: 'round_robin_gap',
            title: `${entry.playerName} still has round-robin work left`,
            body: nearestUnplayed
              ? `${unplayedOpponents.length} unplayed opponents remain. ${nearestUnplayed.playerName} is the nearest table neighbor without a logged result.`
              : `${unplayedOpponents.length} unplayed opponents remain in the field.`,
            playerAName: entry.playerName,
            playerAId: entry.playerId,
            playerBName: nearestUnplayed?.playerName || '',
            playerBId: nearestUnplayed?.playerId || '',
            primaryHref: nearestUnplayed
              ? buildMatchupHref(entry.playerId, nearestUnplayed.playerId)
              : buildPlayerHref(entry.playerId),
            primaryLabel: nearestUnplayed ? 'Compare pairing' : 'Player page',
            secondaryHref:
              nearestUnplayed && nearestValue
                ? buildPrefilledResultHref(routeSlug || league.id, league.id, entryValue, nearestValue)
                : null,
            secondaryLabel: nearestUnplayed ? 'Log result' : '',
          }
        })
    }

    if (individualCompetitionFormat === 'challenge') {
      return individualStandings
        .filter((entry) => entry.recentResultsCount < 2)
        .slice(0, 4)
        .map((entry) => {
          const nearestMomentumPeer =
            individualStandings
              .filter((candidate) => candidate.playerName !== entry.playerName)
              .sort(
                (left, right) =>
                  Math.abs(left.momentumScore - entry.momentumScore) -
                  Math.abs(right.momentumScore - entry.momentumScore),
              )[0] || null

          const entryValue = entry.playerId || `name:${entry.playerName}`
          const peerValue = nearestMomentumPeer?.playerId || `name:${nearestMomentumPeer?.playerName || ''}`

          return {
            key: `challenge-${entry.playerName}`,
            suggestionType: 'challenge_peer',
            title: `${entry.playerName} could use a fresh challenge`,
            body: nearestMomentumPeer
              ? `${entry.recentResultsCount} recent TIQ challenges are logged. ${nearestMomentumPeer.playerName} is the closest momentum peer to keep the board active.`
              : `${entry.recentResultsCount} recent TIQ challenges are logged, so a fresh result would help the board move.`,
            playerAName: entry.playerName,
            playerAId: entry.playerId,
            playerBName: nearestMomentumPeer?.playerName || '',
            playerBId: nearestMomentumPeer?.playerId || '',
            primaryHref: nearestMomentumPeer
              ? buildMatchupHref(entry.playerId, nearestMomentumPeer.playerId)
              : buildPlayerHref(entry.playerId),
            primaryLabel: nearestMomentumPeer ? 'Compare challenge' : 'Player page',
            secondaryHref:
              nearestMomentumPeer && peerValue
                ? buildPrefilledResultHref(routeSlug || league.id, league.id, entryValue, peerValue)
                : null,
            secondaryLabel: nearestMomentumPeer ? 'Log result' : '',
          }
        })
    }

    return individualStandings.slice(0, 4).map((entry) => ({
      key: `standard-${entry.playerName}`,
      suggestionType: 'standard_momentum',
      title: `${entry.playerName} is shaping this TIQ season`,
      body: `${entry.leagueWins}-${entry.leagueLosses} in TIQ play with ${entry.recentResultsCount} recent logged results. Use TIQ momentum here for strategy and keep USTA as separate outside status.`,
      playerAName: entry.playerName,
      playerAId: entry.playerId,
      playerBName: '',
      playerBId: '',
      primaryHref: buildPlayerHref(entry.playerId),
      primaryLabel: 'Player page',
      secondaryHref: null,
      secondaryLabel: '',
    }))
  }, [individualCompetitionFormat, individualResults, individualStandings, league, routeSlug])

  useEffect(() => {
    if (!league || league.leagueFormat !== 'individual') return
    if (!suggestedResultPlayerA || !suggestedResultPlayerB) return
    if (suggestedResultPlayerA === suggestedResultPlayerB) return
    if (appliedSuggestedResultKey === suggestedResultKey) return
    if (resultParticipantOptions.length === 0) return

    const playerAOption =
      resultParticipantOptions.find((option) => option.value === suggestedResultPlayerA) || null
    const playerBOption =
      resultParticipantOptions.find((option) => option.value === suggestedResultPlayerB) || null

    if (!playerAOption || !playerBOption) return

    setResultPlayerA(playerAOption.value)
    setResultPlayerB(playerBOption.value)
    setResultWinner('')
    setResultStatus(
      `Prefilled the TIQ result log for ${playerAOption.playerName} vs ${playerBOption.playerName}.`,
    )
    setAppliedSuggestedResultKey(suggestedResultKey)
  }, [
    appliedSuggestedResultKey,
    league,
    resultParticipantOptions,
    suggestedResultKey,
    suggestedResultPlayerA,
    suggestedResultPlayerB,
  ])

  useEffect(() => {
    let active = true

    async function loadIndividualStandings() {
      if (!league || league.leagueFormat !== 'individual') {
        if (active) setIndividualStandings([])
        return
      }

      const normalizedEntries = visiblePlayerEntries.filter((entry) => cleanText(entry.playerName))
      if (!normalizedEntries.length) {
        if (active) setIndividualStandings([])
        return
      }

      const playerIds = Array.from(
        new Set(normalizedEntries.map((entry) => cleanText(entry.playerId)).filter(Boolean)),
      )
      const playerNames = Array.from(
        new Set(normalizedEntries.map((entry) => cleanText(entry.playerName)).filter(Boolean)),
      )

      const [profilesByIdResult, profilesByNameResult] = await Promise.all([
        playerIds.length
          ? supabase
              .from('players')
              .select(
                'id, name, location, overall_rating, overall_dynamic_rating, overall_usta_dynamic_rating, singles_rating, singles_dynamic_rating, singles_usta_dynamic_rating, doubles_rating, doubles_dynamic_rating, doubles_usta_dynamic_rating',
              )
              .in('id', playerIds)
          : Promise.resolve({ data: [], error: null }),
        playerNames.length
          ? supabase
              .from('players')
              .select(
                'id, name, location, overall_rating, overall_dynamic_rating, overall_usta_dynamic_rating, singles_rating, singles_dynamic_rating, singles_usta_dynamic_rating, doubles_rating, doubles_dynamic_rating, doubles_usta_dynamic_rating',
              )
              .in('name', playerNames)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (!active) return

      const firstError = profilesByIdResult.error || profilesByNameResult.error
      if (firstError) {
        setStorageWarning((current) => current || firstError.message)
      }

      const profiles = [
        ...(((profilesByIdResult.data || []) as PlayerProfileSummary[]) || []),
        ...(((profilesByNameResult.data || []) as PlayerProfileSummary[]) || []),
      ]
      const profileById = new Map<string, PlayerProfileSummary>()
      const profileByName = new Map<string, PlayerProfileSummary>()

      for (const profile of profiles) {
        if (!profileById.has(profile.id)) profileById.set(profile.id, profile)
        const normalizedName = cleanText(profile.name).toLowerCase()
        if (normalizedName && !profileByName.has(normalizedName)) profileByName.set(normalizedName, profile)
      }

      const resolvedProfileIds = Array.from(profileById.keys())
      const matchCountMap = new Map<string, number>()

      if (resolvedProfileIds.length > 0) {
        const { data: matchRows, error: matchError } = await supabase
          .from('match_players')
          .select('player_id, match_id')
          .in('player_id', resolvedProfileIds)

        if (!active) return

        if (matchError) {
          setStorageWarning((current) => current || matchError.message)
        } else {
          const uniqueMatchesByPlayer = new Map<string, Set<string>>()
          for (const row of matchRows || []) {
            const playerId = cleanText((row as { player_id?: string | null }).player_id)
            const matchId = cleanText((row as { match_id?: string | null }).match_id)
            if (!playerId || !matchId) continue
            const existing = uniqueMatchesByPlayer.get(playerId) ?? new Set<string>()
            existing.add(matchId)
            uniqueMatchesByPlayer.set(playerId, existing)
          }

          for (const [playerId, matches] of uniqueMatchesByPlayer.entries()) {
            matchCountMap.set(playerId, matches.size)
          }
        }
      }

      const totalEntrants = normalizedEntries.length
      const competitionFormat = normalizeTiqIndividualCompetitionFormat(league.individualCompetitionFormat)
      const standings = normalizedEntries
        .map((entry) => {
          const profile =
            (entry.playerId ? profileById.get(entry.playerId) : null) ||
            profileByName.get(entry.playerName.toLowerCase()) ||
            null
          const ustaRating = profile ? toOptionalRating(getUstaRating(profile, 'overall')) : null
          const tiqRating = profile ? toOptionalRating(getTiqRating(profile, 'overall')) : null
          const trackedMatches = profile ? matchCountMap.get(profile.id) || 0 : 0
          const normalizedEntryName = entry.playerName.toLowerCase()
          const playerResults = individualResults.filter((result) => {
            const playerAName = result.playerAName.toLowerCase()
            const playerBName = result.playerBName.toLowerCase()
            return playerAName === normalizedEntryName || playerBName === normalizedEntryName
          })
          const leagueWins = playerResults.filter(
            (result) => result.winnerPlayerName.toLowerCase() === normalizedEntryName,
          ).length
          const leagueLosses = playerResults.length - leagueWins
          const recentForm = playerResults
            .slice(0, 5)
            .map((result) =>
              result.winnerPlayerName.toLowerCase() === normalizedEntryName ? ('W' as const) : ('L' as const),
            )
          const uniqueOpponentsPlayed = new Set(
            playerResults.map((result) =>
              result.playerAName.toLowerCase() === normalizedEntryName ? result.playerBName : result.playerAName,
            ),
          ).size
          const possibleOpponents = Math.max(totalEntrants - 1, 0)
          const completionRate =
            possibleOpponents > 0 ? uniqueOpponentsPlayed / possibleOpponents : null
          const recentResultsCount = playerResults.filter((result) =>
            isRecentResult(result.resultDate, 21),
          ).length
          const momentumScore = leagueWins * 3 - leagueLosses + recentResultsCount

          return {
            rank: 0,
            playerId: profile?.id || entry.playerId,
            playerName: entry.playerName,
            location: cleanText(profile?.location) || entry.playerLocation || '',
            ustaRating,
            tiqRating,
            trackedMatches,
            leagueWins,
            leagueLosses,
            leagueMatches: playerResults.length,
            recentForm,
            uniqueOpponentsPlayed,
            possibleOpponents,
            completionRate,
            recentResultsCount,
            momentumScore,
            ratingGap:
              typeof ustaRating === 'number' && typeof tiqRating === 'number'
                ? tiqRating - ustaRating
                : null,
          }
        })
        .sort((left, right) => {
          if (right.leagueWins !== left.leagueWins) return right.leagueWins - left.leagueWins

          if (competitionFormat === 'challenge') {
            if (right.recentResultsCount !== left.recentResultsCount) {
              return right.recentResultsCount - left.recentResultsCount
            }
            if (right.momentumScore !== left.momentumScore) {
              return right.momentumScore - left.momentumScore
            }
          }

          if (competitionFormat === 'round_robin') {
            const rightCoverage = right.completionRate ?? Number.NEGATIVE_INFINITY
            const leftCoverage = left.completionRate ?? Number.NEGATIVE_INFINITY
            if (rightCoverage !== leftCoverage) return rightCoverage - leftCoverage
            if (right.uniqueOpponentsPlayed !== left.uniqueOpponentsPlayed) {
              return right.uniqueOpponentsPlayed - left.uniqueOpponentsPlayed
            }
          }

          if (competitionFormat === 'ladder') {
            if (right.recentResultsCount !== left.recentResultsCount) {
              return right.recentResultsCount - left.recentResultsCount
            }
            if (right.uniqueOpponentsPlayed !== left.uniqueOpponentsPlayed) {
              return right.uniqueOpponentsPlayed - left.uniqueOpponentsPlayed
            }
          }

          if (left.leagueLosses !== right.leagueLosses) return left.leagueLosses - right.leagueLosses

          const rightTiq = right.tiqRating ?? Number.NEGATIVE_INFINITY
          const leftTiq = left.tiqRating ?? Number.NEGATIVE_INFINITY
          if (rightTiq !== leftTiq) return rightTiq - leftTiq

          if (right.leagueMatches !== left.leagueMatches) return right.leagueMatches - left.leagueMatches

          const rightTrackedMatches = right.trackedMatches ?? 0
          const leftTrackedMatches = left.trackedMatches ?? 0
          if (rightTrackedMatches !== leftTrackedMatches) return rightTrackedMatches - leftTrackedMatches

          return left.playerName.localeCompare(right.playerName)
        })
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }))

      if (active) setIndividualStandings(standings)
    }

    void loadIndividualStandings()

    return () => {
      active = false
    }
  }, [league, visiblePlayerEntries, individualResults])

  useEffect(() => {
    let active = true

    async function loadIndividualResults() {
      if (!league || league.leagueFormat !== 'individual') {
        if (active) {
          setIndividualResults([])
          setResultStorageSource('local')
        }
        return
      }

      const result = await listTiqIndividualLeagueResults({ leagueId: league.id })
      if (!active) return
      setIndividualResults(result.results)
      setResultStorageSource(result.source)
      if (result.warning) {
        setStorageWarning((current) => current || result.warning || '')
      }
    }

    void loadIndividualResults()

    return () => {
      active = false
    }
  }, [league])

  useEffect(() => {
    let active = true

    async function loadSuggestions() {
      if (!league || league.leagueFormat !== 'individual') {
        if (active) {
          setSavedSuggestions([])
          setSuggestionStorageSource('local')
        }
        return
      }

      const result = await listTiqIndividualSuggestions({ leagueId: league.id, status: 'all' })
      if (!active) return
      setSavedSuggestions(result.suggestions)
      setSuggestionStorageSource(result.source)
      if (result.warning) {
        setStorageWarning((current) => current || result.warning || '')
      }
    }

    void loadSuggestions()

    return () => {
      active = false
    }
  }, [league])

  function handleSelectExistingTeam(nextKey: string) {
    setSelectedTeamKey(nextKey)
    const option = teamOptions.find((item) => item.key === nextKey)
    if (!option) return
    setEntryValue(option.team)
  }

  function handleSelectExistingPlayer(nextId: string) {
    setSelectedPlayerId(nextId)
    const option = playerOptions.find((item) => item.id === nextId)
    if (!option) return
    setEntryValue(option.name)
  }

  async function refreshSuggestionState(leagueId: string) {
    const latest = await listTiqIndividualSuggestions({ leagueId, status: 'all' })
    setSavedSuggestions(latest.suggestions)
    setSuggestionStorageSource(latest.source)
    setStorageWarning((current) => current || latest.warning || '')
  }

  async function handleSaveSuggestion(opportunity: CompetitionOpportunity) {
    if (!league || league.leagueFormat !== 'individual') return

    setSuggestionSavingKey(opportunity.key)
    setSuggestionStatus('')

    try {
      const result = await saveTiqIndividualSuggestion({
        leagueId: league.id,
        individualCompetitionFormat,
        suggestionType: opportunity.suggestionType,
        title: opportunity.title,
        body: opportunity.body,
        playerAName: opportunity.playerAName,
        playerAId: opportunity.playerAId,
        playerBName: opportunity.playerBName,
        playerBId: opportunity.playerBId,
      })

      await refreshSuggestionState(league.id)
      await appendMyLabEvents([
        {
          event_type: 'tiq_prompt_saved',
          entity_type: 'league',
          entity_id: buildScopedLeagueEntityId({
            competitionLayer: 'tiq',
            leagueName: league.leagueName,
            flight: league.flight,
            section: null,
            district: null,
          }),
          entity_name: league.leagueName,
          subtitle: [
            getTiqIndividualCompetitionFormatLabel(individualCompetitionFormat),
            league.flight,
          ]
            .filter(Boolean)
            .join(' · '),
          title: `Saved TIQ prompt in ${league.leagueName}`,
          body: result.suggestion.title,
        },
      ])
      setSuggestionStatus(
        `Saved TIQ prompt: ${result.suggestion.title}.`,
      )
      setStorageWarning((current) => current || result.warning || '')
    } catch (error) {
      setSuggestionStatus(
        error instanceof Error ? error.message : 'Unable to save this TIQ prompt.',
      )
    } finally {
      setSuggestionSavingKey('')
    }
  }

  async function handleSuggestionStatusChange(
    suggestionId: string,
    status: TiqIndividualSuggestionStatus,
  ) {
    if (!league || league.leagueFormat !== 'individual') return

    setSuggestionSavingKey(suggestionId)
    setSuggestionStatus('')

    try {
      const result = await updateTiqIndividualSuggestionStatus({ suggestionId, status })
      await refreshSuggestionState(league.id)
      setSuggestionStatus(
        status === 'dismissed'
          ? 'Dismissed this TIQ prompt.'
          : 'Updated this TIQ prompt.',
      )
      setStorageWarning((current) => current || result.warning || '')
    } catch (error) {
      setSuggestionStatus(
        error instanceof Error ? error.message : 'Unable to update this TIQ prompt.',
      )
    } finally {
      setSuggestionSavingKey('')
    }
  }

  async function handleClaimSuggestion(suggestionId: string) {
    if (!league || league.leagueFormat !== 'individual') return

    setSuggestionSavingKey(suggestionId)
    setSuggestionStatus('')

    try {
      const result = await claimTiqIndividualSuggestion({ suggestionId })
      await refreshSuggestionState(league.id)
      if (result.suggestion) {
        await appendMyLabEvents([
          {
            event_type: 'tiq_prompt_claimed',
            entity_type: 'league',
            entity_id: buildScopedLeagueEntityId({
              competitionLayer: 'tiq',
              leagueName: league.leagueName,
              flight: league.flight,
              section: null,
              district: null,
            }),
            entity_name: league.leagueName,
            subtitle: result.suggestion.claimedByLabel || null,
            title: `Claimed TIQ prompt in ${league.leagueName}`,
            body: result.suggestion.title,
          },
        ])
      }
      setSuggestionStatus('Claimed this TIQ prompt.')
      setStorageWarning((current) => current || result.warning || '')
    } catch (error) {
      setSuggestionStatus(
        error instanceof Error ? error.message : 'Unable to claim this TIQ prompt.',
      )
    } finally {
      setSuggestionSavingKey('')
    }
  }

  async function handleResultSubmit() {
    if (!league || league.leagueFormat !== 'individual') return

    if (!resultPlayerAOption || !resultPlayerBOption) {
      setResultStatus('Choose two players before logging a TIQ individual result.')
      return
    }

    if (resultPlayerAOption.value === resultPlayerBOption.value) {
      setResultStatus('A TIQ individual result needs two different players.')
      return
    }

    const winnerOption = resultWinnerOptions.find((option) => option.value === resultWinner) || null
    if (!winnerOption) {
      setResultStatus('Choose the winner before saving this TIQ individual result.')
      return
    }

    setResultSaving(true)
    setResultStatus('')

    try {
      const result = await saveTiqIndividualLeagueResult({
        leagueId: league.id,
        playerAName: resultPlayerAOption.playerName,
        playerAId: resultPlayerAOption.playerId,
        playerBName: resultPlayerBOption.playerName,
        playerBId: resultPlayerBOption.playerId,
        winnerPlayerName: winnerOption.playerName,
        winnerPlayerId: winnerOption.playerId,
        score: resultScore,
        resultDate: resultDate ? new Date(`${resultDate}T12:00:00`).toISOString() : new Date().toISOString(),
        notes: resultNotes,
      })

      const latestResults = await listTiqIndividualLeagueResults({ leagueId: league.id })
      setIndividualResults(latestResults.results)
      setResultStorageSource(result.source)
      setStorageWarning(latestResults.warning || result.warning || '')
      const completion = await completeTiqIndividualSuggestionsForPair({
        leagueId: league.id,
        playerAName: resultPlayerAOption.playerName,
        playerBName: resultPlayerBOption.playerName,
      })
      await refreshSuggestionState(league.id)
      if (completion.completedSuggestions.length > 0) {
        await appendMyLabEvents(
          completion.completedSuggestions.map((suggestion) => ({
            event_type: 'tiq_prompt_completed',
            entity_type: 'league' as const,
            entity_id: buildScopedLeagueEntityId({
              competitionLayer: 'tiq',
              leagueName: league.leagueName,
              flight: league.flight,
              section: null,
              district: null,
            }),
            entity_name: league.leagueName,
            subtitle: [
              suggestion.playerAName,
              suggestion.playerBName,
            ]
              .filter(Boolean)
              .join(' vs '),
            title: `Completed TIQ prompt in ${league.leagueName}`,
            body: suggestion.title,
          })),
        )
      }
      if (completion.warning) {
        setStorageWarning((current) => current || completion.warning || '')
      }
      setResultStatus(`Saved TIQ result: ${winnerOption.playerName} over ${winnerOption.value === resultPlayerAOption.value ? resultPlayerBOption.playerName : resultPlayerAOption.playerName}.`)
      setResultScore('')
      setResultNotes('')
      setResultWinner('')
    } catch (error) {
      setResultStatus(error instanceof Error ? error.message : 'Unable to save this TIQ result.')
    } finally {
      setResultSaving(false)
    }
  }

  async function handleEntrySubmit() {
    if (!league) return

    const normalizedEntry = cleanText(entryValue)
    if (!normalizedEntry) {
      setStatus(
        league.leagueFormat === 'team'
          ? 'Team name is required before entering this TIQ team league.'
          : 'Player name is required before joining this TIQ individual league.',
      )
      return
    }

    if (!entryEnabled) {
      setStatus(entryMessage)
      return
    }

    const currentList = league.leagueFormat === 'team' ? league.teams : league.players
    if (currentList.some((item) => item.toLowerCase() === normalizedEntry.toLowerCase())) {
      setStatus(
        league.leagueFormat === 'team'
          ? `${normalizedEntry} is already entered in this TIQ team league.`
          : `${normalizedEntry} is already part of this TIQ individual league.`,
      )
      return
    }

    setSaving(true)
    setStatus('')

    try {
      const result =
        league.leagueFormat === 'team'
          ? await addTiqTeamLeagueEntry({
              leagueId: league.id,
              teamName: normalizedEntry,
              teamEntityId: selectedTeamOption
                ? buildScopedTeamEntityId({
                    competitionLayer: 'tiq',
                    teamName: normalizedEntry,
                    leagueName: selectedTeamOption.league || '',
                    flight: selectedTeamOption.flight || '',
                  })
                : '',
              sourceLeagueName: selectedTeamOption?.league || '',
              sourceFlight: selectedTeamOption?.flight || '',
            })
          : await addTiqPlayerLeagueEntry({
              leagueId: league.id,
              playerName: normalizedEntry,
              playerId: selectedPlayerOption?.id || '',
              playerLocation: selectedPlayerOption?.location || '',
            })

      if (result.record) {
        setLeague(result.record)
      }
      setStorageSource(result.source)
      setStorageWarning(result.warning || '')
      setStatus(
        league.leagueFormat === 'team'
          ? `${normalizedEntry} was added to this TIQ team league.`
          : `${normalizedEntry} joined this TIQ individual league.`,
      )
      if (league.leagueFormat === 'individual') {
        setEntryValue(normalizedEntry)
        const latestEntries = await listTiqPlayerLeagueEntries(league.id)
        setPlayerEntries(latestEntries.entries)
      }
      if (league.leagueFormat === 'team') {
        const latestEntries = await listTiqTeamLeagueEntries(league.id)
        setTeamEntries(latestEntries.entries)
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Unable to update league participation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SiteShell active="/explore">
      <section style={pageWrap}>
        {loading ? (
          <div style={stateCard}>Loading TIQ league detail...</div>
        ) : error || !league ? (
          <div style={stateCard}>
            <div style={stateTitle}>TIQ league unavailable</div>
            <div style={stateText}>{error || 'This TIQ league could not be loaded right now.'}</div>
            <div style={actionRow}>
              <GhostLink href="/explore/leagues">Back to Explore Leagues</GhostLink>
              <GhostLink href="/captain/season-dashboard">Open Season Dashboard</GhostLink>
            </div>
          </div>
        ) : (
          <>
            <section style={dynamicHeroCard}>
              <div style={dynamicHeroGrid}>
                <div>
                  <div style={eyebrow}>TIQ League Detail</div>
                  <h1 style={dynamicHeroTitle}>{league.leagueName}</h1>
                  <div style={pillRow}>
                    <span style={pillGreen}>{getCompetitionLayerLabel('tiq')}</span>
                    <span style={pillSlate}>{getLeagueFormatLabel(league.leagueFormat)}</span>
                    {league.leagueFormat === 'individual' ? (
                      <span style={pillSlate}>
                        {getTiqIndividualCompetitionFormatLabel(league.individualCompetitionFormat)}
                      </span>
                    ) : null}
                    <span style={storageSource === 'supabase' ? pillGreen : pillBlue}>
                      {storageSource === 'supabase' ? 'Supabase-backed' : 'Local fallback'}
                    </span>
                  </div>
                  <p style={heroText}>
                    {[league.seasonLabel, league.flight, league.locationLabel].filter(Boolean).join(' | ') ||
                      'Internal TIQ competition container'}
                  </p>

                  <div style={heroHintRow}>
                    <span style={hintPill}>
                      {participants.length} {league.leagueFormat === 'team' ? 'participants teams' : 'participants players'}
                    </span>
                    <span style={hintPill}>Updated {formatDateTime(league.updatedAt)}</span>
                  </div>

                  <div style={actionRow}>
                    <FollowButton
                      entityType="league"
                      entityId={`tiq__${league.id}`}
                      entityName={league.leagueName}
                      subtitle={[league.seasonLabel, league.flight].filter(Boolean).join(' · ')}
                    />
                    <GhostLink href="/explore/leagues">Back to Explore</GhostLink>
                    <GhostLink href="/compete/leagues">Open Compete</GhostLink>
                  </div>
                </div>

                <div style={sideCard}>
                  <div style={sideLabel}>Participation</div>
                  <div style={sideValue}>
                    {league.leagueFormat === 'team'
                      ? 'Enter a team'
                      : individualFormatExperience.participationCta}
                  </div>
                  <div style={sideText}>{entryMessage}</div>
                  <div style={{ ...statusBanner, ...(entryEnabled ? infoBanner : warningBanner) }}>
                    {entryEnabled
                      ? league.leagueFormat === 'team'
                        ? 'Team entry is enabled for this signed-in captain context.'
                        : individualFormatExperience.enabledMessage
                      : entryMessage}
                  </div>
                </div>
              </div>

              {storageWarning ? <div style={statusBanner}>{storageWarning}</div> : null}
            </section>

            <div style={dynamicMetricGrid}>
              <MetricCard label="Season" value={league.seasonLabel || 'TIQ Season'} />
              <MetricCard label="Flight / Tier" value={league.flight || 'Open'} />
              <MetricCard label="Market" value={league.locationLabel || 'Unassigned'} />
              <MetricCard
                label="Individual format"
                value={
                  league.leagueFormat === 'individual'
                    ? getTiqIndividualCompetitionFormatLabel(league.individualCompetitionFormat)
                    : 'Team'
                }
              />
              <MetricCard label="Participants" value={String(participants.length)} accent />
            </div>

            <section style={dynamicSignalGrid}>
              {tiqSignals.map((signal) => (
                <article key={signal.label} style={signalCardStyle}>
                  <div style={signalLabelStyle}>{signal.label}</div>
                  <div style={signalValueStyle}>{signal.value}</div>
                  <div style={signalNoteStyle}>{signal.note}</div>
                </article>
              ))}
            </section>

            <div style={dynamicContentGrid}>
              <section style={dynamicPanelCard}>
                <div style={sectionEyebrow}>Entry workflow</div>
                <h2 style={sectionTitle}>
                  {league.leagueFormat === 'team'
                    ? 'Add your team to this TIQ league'
                    : individualFormatExperience.entryTitle}
                </h2>
                <p style={sectionText}>
                  {league.leagueFormat === 'team'
                    ? 'This is the monetization seam for the low-friction seasonal team entry layer. Captains can bring a team into TIQ competition without blending that action into USTA browse pages.'
                    : `${individualFormatExperience.entryDescription} ${getTiqIndividualCompetitionFormatDescription(league.individualCompetitionFormat)}`}
                </p>

                <label style={fieldLabel}>
                  <span>{league.leagueFormat === 'team' ? 'Team name' : 'Player name'}</span>
                  <input
                    value={entryValue}
                    onChange={(event) => setEntryValue(event.target.value)}
                    placeholder={entryPlaceholder}
                    style={inputStyle}
                    disabled={saving}
                  />
                </label>

                {league.leagueFormat === 'team' ? (
                  <label style={fieldLabel}>
                    <span>Choose an existing TenAceIQ team</span>
                    <select
                      value={selectedTeamKey}
                      onChange={(event) => handleSelectExistingTeam(event.target.value)}
                      style={inputStyle}
                      disabled={saving}
                    >
                      <option value="">Use a custom team name</option>
                      {availableTeamOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {[
                            option.team,
                            option.league || null,
                            option.flight || null,
                            `${option.matchCount} matches`,
                          ]
                            .filter(Boolean)
                            .join(' | ')}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label style={fieldLabel}>
                    <span>Choose an existing TenAceIQ player</span>
                    <select
                      value={selectedPlayerId}
                      onChange={(event) => handleSelectExistingPlayer(event.target.value)}
                      style={inputStyle}
                      disabled={saving}
                    >
                      <option value="">Use a custom player name</option>
                      {availablePlayerOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {status ? <div style={statusBanner}>{status}</div> : null}

                {league.leagueFormat === 'team' && !entryEnabled ? (
                  <UpgradePrompt
                    planId="league"
                    compact
                    headline="Ready to run this team season without spreadsheets?"
                    body="League tools unlock organized TIQ team entry, season structure, standings, and league-wide coordination without making every player manage the admin work."
                    ctaLabel="Run Your League on TIQ"
                    ctaHref="/pricing"
                    secondaryLabel="See league plan"
                    secondaryHref="/pricing"
                    footnote={entryMessage}
                  />
                ) : null}

                <div style={actionRow}>
                  <button
                    type="button"
                    onClick={handleEntrySubmit}
                    disabled={!entryEnabled || saving}
                    style={{
                      ...primaryButton,
                      ...(!entryEnabled || saving ? disabledButton : {}),
                    }}
                  >
                    {saving ? 'Saving...' : entryLabel}
                  </button>
                  {league.leagueFormat === 'team' ? (
                    <GhostLink href="/captain/season-dashboard">Manage TIQ Seasons</GhostLink>
                  ) : null}
                </div>
              </section>

              <section style={dynamicPanelCard}>
                <div style={sectionEyebrow}>Participants</div>
                <h2 style={sectionTitle}>
                  {league.leagueFormat === 'team'
                    ? 'Entered Teams'
                    : individualFormatExperience.participantsTitle}
                </h2>
                <p style={sectionText}>
                  {league.leagueFormat === 'team'
                    ? 'Teams are the participant unit here, separate from the league container itself.'
                    : individualFormatExperience.participantsDescription}
                </p>
                {league.leagueFormat === 'individual' ? (
                  <div style={formatCallout}>
                    <div style={formatCalloutTitle}>{individualFormatExperience.participantsHintTitle}</div>
                    <div style={formatCalloutText}>{individualFormatExperience.participantsHintText}</div>
                  </div>
                ) : null}

                {(league.leagueFormat === 'team' ? visibleTeamEntries.length === 0 : visiblePlayerEntries.length === 0) ? (
                  <div style={emptyCard}>
                    {league.leagueFormat === 'team'
                      ? 'No teams have been added yet.'
                      : individualFormatExperience.emptyParticipants}
                  </div>
                ) : (
                  <div style={listWrap}>
                    {league.leagueFormat === 'team'
                      ? visibleTeamEntries.map((entry, index) => (
                          <div key={`${entry.teamName}-${index}`} style={dynamicListCard}>
                            <div>
                              <div style={listTitle}>{entry.teamName}</div>
                              <div style={listMeta}>
                                {[entry.sourceLeagueName, entry.sourceFlight, 'Team participant']
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                            </div>
                            <GhostLink href={`/team/${encodeURIComponent(entry.teamName)}?layer=tiq&league=${encodeURIComponent(entry.sourceLeagueName || league.leagueName)}${entry.sourceFlight || league.flight ? `&flight=${encodeURIComponent(entry.sourceFlight || league.flight || '')}` : ''}`}>
                              Team Page
                            </GhostLink>
                          </div>
                        ))
                      : visiblePlayerEntries.map((entry, index) => (
                      <div key={`${entry.playerName}-${index}`} style={dynamicListCard}>
                        <div>
                          <div style={listTitle}>{entry.playerName}</div>
                          <div style={listMeta}>
                            {[entry.playerLocation, 'Individual participant'].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        {entry.playerId ? (
                          <GhostLink href={`/players/${encodeURIComponent(entry.playerId)}`}>Player Page</GhostLink>
                        ) : (
                          <span style={metaPill}>Player</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {league.leagueFormat === 'individual' ? (
              <section style={dynamicPanelCard}>
                <div style={sectionEyebrow}>{individualFormatExperience.standingsEyebrow}</div>
                <h2 style={sectionTitle}>{individualFormatExperience.standingsTitle}</h2>
                <p style={sectionText}>{individualFormatExperience.standingsDescription}</p>
                <div style={formatCallout}>
                  <div style={formatCalloutTitle}>{individualFormatExperience.standingsHintTitle}</div>
                  <div style={formatCalloutText}>{individualFormatExperience.standingsHintText}</div>
                </div>

                {individualStandings.length === 0 ? (
                  <div style={emptyCard}>{individualFormatExperience.emptyStandings}</div>
                ) : (
                  <div style={listWrap}>
                    {individualStandings.map((entry) => {
                      const metricConfig = getStandingMetricConfig(entry, individualCompetitionFormat)

                      return (
                        <div key={`${entry.playerName}-${entry.playerId || entry.rank}`} style={dynamicStandingCard}>
                          <div style={dynamicStandingRank}>{entry.rank}</div>
                          <div style={standingBody}>
                            <div style={standingHeader}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                                  <div style={listTitle}>{entry.playerName}</div>
                                  {(() => {
                                    const status = getLeagueRatingStatus(entry.ratingGap)
                                    if (!status) return null
                                    return (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: '0.03em', ...getLeagueStatusStyle(status) }}>
                                        {status}
                                      </span>
                                    )
                                  })()}
                                </div>
                                <div style={listMeta}>
                                  {[
                                    entry.location,
                                    `${entry.leagueWins}-${entry.leagueLosses} in TIQ play`,
                                    metricConfig.subtitle,
                                    `${entry.trackedMatches} tracked matches`,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ') || 'TIQ individual entrant'}
                                </div>
                              </div>
                              <div style={dynamicStandingMetrics}>
                                <div style={standingMetric}>
                                  <span style={standingMetricLabel}>Record</span>
                                  <span style={standingMetricValue}>
                                    {entry.leagueWins}-{entry.leagueLosses}
                                  </span>
                                </div>
                                <div style={standingMetric}>
                                  <span style={standingMetricLabel}>{metricConfig.primaryLabel}</span>
                                  <span style={standingMetricValue}>{metricConfig.primaryValue}</span>
                                </div>
                                <div style={standingMetric}>
                                  <span style={standingMetricLabel}>{metricConfig.secondaryLabel}</span>
                                  <span style={standingMetricValue}>{metricConfig.secondaryValue}</span>
                                </div>
                                <div style={standingMetric}>
                                  <span style={standingMetricLabel}>USTA</span>
                                  <span style={standingMetricValue}>{formatRating(entry.ustaRating)}</span>
                                </div>
                                <div style={standingMetric}>
                                  <span style={standingMetricLabel}>TIQ</span>
                                  <span style={standingMetricValueAccent}>{formatRating(entry.tiqRating)}</span>
                                </div>
                                <div style={standingMetric}>
                                  <span style={standingMetricLabel}>Gap</span>
                                  <span style={standingMetricValue}>
                                    {typeof entry.ratingGap === 'number'
                                      ? `${entry.ratingGap >= 0 ? '+' : ''}${entry.ratingGap.toFixed(2)}`
                                      : '—'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={standingActionRow}>
                              {entry.playerId ? (
                                <>
                                  <GhostLink href={`/players/${encodeURIComponent(entry.playerId)}`}>Player Page</GhostLink>
                                  <GhostLink href={`/matchup?playerA=${encodeURIComponent(entry.playerId)}`}>Matchup</GhostLink>
                                </>
                              ) : (
                                <span style={metaPill}>Needs linked player record</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            ) : null}

            {league.leagueFormat === 'individual' ? (
              <section style={dynamicPanelCard}>
                <div style={sectionEyebrow}>Next actions</div>
                <h2 style={sectionTitle}>What should move next in this format?</h2>
                <p style={sectionText}>
                  These suggestions come from the current TIQ standings and TIQ result log, so each
                  individual format points toward the next useful comparison instead of only reporting
                  the table.
                </p>
                {suggestionStatus ? <div style={statusBanner}>{suggestionStatus}</div> : null}

                {competitionOpportunities.length === 0 ? (
                  <div style={emptyCard}>
                    Add more TIQ individual entrants and logged results to unlock stronger format-specific suggestions.
                  </div>
                ) : (
                  <div style={dynamicOpportunityGrid}>
                    {competitionOpportunities.map((item) => (
                      <div key={item.key} style={opportunityCard}>
                        <div style={opportunityTitleRow}>
                          <div style={opportunityTitle}>{item.title}</div>
                          {(() => {
                            const pairKey = buildTiqSuggestionPairKey(item.playerAName, item.playerBName)
                            const saved = savedSuggestionByOpportunityKey.get(
                              `${item.suggestionType}::${pairKey}`,
                            )
                            return saved ? (
                              <span style={metaPill}>
                                {saved.status === 'completed' ? 'Completed prompt' : 'Saved prompt'}
                              </span>
                            ) : null
                          })()}
                        </div>
                        <div style={opportunityText}>{item.body}</div>
                        <div style={standingActionRow}>
                          {item.primaryHref ? (
                            <GhostLink href={item.primaryHref}>{item.primaryLabel}</GhostLink>
                          ) : null}
                          {item.secondaryHref ? (
                            <GhostLink href={item.secondaryHref}>{item.secondaryLabel}</GhostLink>
                          ) : null}
                          {item.playerAName && item.playerBName ? (
                            <button
                              type="button"
                              onClick={() => void handleSaveSuggestion(item)}
                              disabled={suggestionSavingKey === item.key}
                              style={{
                                ...ghostActionButton,
                                ...(suggestionSavingKey === item.key ? disabledButton : {}),
                              }}
                            >
                              {suggestionSavingKey === item.key ? 'Saving...' : 'Save prompt'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {league.leagueFormat === 'individual' ? (
              <section style={dynamicPanelCard}>
                <div style={sectionEyebrow}>Saved prompts</div>
                <h2 style={sectionTitle}>Track TIQ suggestions as real workflow objects.</h2>
                <p style={sectionText}>
                  Saved TIQ prompts let the app remember which ladder targets, round-robin gaps, and
                  challenge peers you wanted to act on, even before a result is logged.
                </p>

                {savedSuggestions.length === 0 ? (
                  <div style={emptyCard}>
                    Save a prompt from the recommendation cards to keep that TIQ opportunity visible
                    across your workflow surfaces.
                  </div>
                ) : (
                  <div style={listWrap}>
                    {savedSuggestions.map((suggestion) => (
                      <div key={suggestion.id} style={dynamicListCard}>
                        <div>
                          <div style={listTitle}>{suggestion.title}</div>
                          <div style={listMeta}>
                            {[
                              getTiqIndividualCompetitionFormatLabel(
                                suggestion.individualCompetitionFormat,
                              ),
                              suggestion.playerAName && suggestion.playerBName
                                ? `${suggestion.playerAName} vs ${suggestion.playerBName}`
                                : null,
                              formatDateTime(suggestion.updatedAt || suggestion.createdAt),
                            ]
                              .filter(Boolean)
                              .join(' - ')}
                          </div>
                          <div style={opportunityText}>{suggestion.body}</div>
                        </div>
                        <div style={dynamicResultMetaStack}>
                          <span style={metaPill}>
                            {suggestion.status === 'completed'
                              ? 'Completed'
                              : suggestion.status === 'dismissed'
                                ? 'Dismissed'
                                : suggestion.claimedByLabel
                                  ? `Claimed by ${suggestion.claimedByLabel}`
                                  : suggestionStorageSource === 'supabase'
                                    ? 'Open prompt'
                                    : 'Open local prompt'}
                          </span>
                          {suggestion.status === 'open' ? (
                            <>
                              <GhostLink href={buildPrefilledResultHref(
                                  routeSlug || league.id,
                                  league.id,
                                  suggestion.playerAId || `name:${suggestion.playerAName}`,
                                  suggestion.playerBId || `name:${suggestion.playerBName}`,
                                )}>
                                Log result
                              </GhostLink>
                              {!suggestion.claimedByUserId ? (
                                <button
                                  type="button"
                                  onClick={() => void handleClaimSuggestion(suggestion.id)}
                                  disabled={suggestionSavingKey === suggestion.id}
                                  style={{
                                    ...ghostActionButton,
                                    ...(suggestionSavingKey === suggestion.id ? disabledButton : {}),
                                  }}
                                >
                                  {suggestionSavingKey === suggestion.id ? 'Saving...' : 'Claim'}
                                </button>
                              ) : suggestion.claimedByUserId === userId ? (
                                <span style={metaPill}>Claimed by you</span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  void handleSuggestionStatusChange(suggestion.id, 'dismissed')
                                }
                                disabled={suggestionSavingKey === suggestion.id}
                                style={{
                                  ...ghostActionButton,
                                  ...(suggestionSavingKey === suggestion.id ? disabledButton : {}),
                                }}
                              >
                                {suggestionSavingKey === suggestion.id ? 'Saving...' : 'Dismiss'}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {league.leagueFormat === 'individual' ? (
              <section style={panelCard}>
                <div style={sectionEyebrow}>{individualFormatExperience.activityEyebrow}</div>
                <h2 style={sectionTitle}>{individualFormatExperience.activityTitle}</h2>
                <p style={sectionText}>{individualFormatExperience.activityDescription}</p>
                <div style={formatCallout}>
                  <div style={formatCalloutTitle}>{individualFormatExperience.activityHintTitle}</div>
                  <div style={formatCalloutText}>{individualFormatExperience.activityHintText}</div>
                </div>

                <div style={dynamicResultFormGrid}>
                  <label style={fieldLabel}>
                    <span>Player A</span>
                    <select
                      value={resultPlayerA}
                      onChange={(event) => setResultPlayerA(event.target.value)}
                      style={inputStyle}
                      disabled={resultSaving}
                    >
                      <option value="">Choose player A</option>
                      {resultParticipantOptions.map((option) => (
                        <option key={`a-${option.value}`} value={option.value}>
                          {option.playerName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={fieldLabel}>
                    <span>Player B</span>
                    <select
                      value={resultPlayerB}
                      onChange={(event) => setResultPlayerB(event.target.value)}
                      style={inputStyle}
                      disabled={resultSaving}
                    >
                      <option value="">Choose player B</option>
                      {resultParticipantOptions.map((option) => (
                        <option key={`b-${option.value}`} value={option.value}>
                          {option.playerName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={fieldLabel}>
                    <span>Winner</span>
                    <select
                      value={resultWinner}
                      onChange={(event) => setResultWinner(event.target.value)}
                      style={inputStyle}
                      disabled={resultSaving}
                    >
                      <option value="">Choose winner</option>
                      {resultWinnerOptions.map((option) => (
                        <option key={`w-${option.value}`} value={option.value}>
                          {option.playerName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={fieldLabel}>
                    <span>Score</span>
                    <input
                      value={resultScore}
                      onChange={(event) => setResultScore(event.target.value)}
                      placeholder={individualFormatExperience.scorePlaceholder}
                      style={inputStyle}
                      disabled={resultSaving}
                    />
                  </label>

                  <label style={fieldLabel}>
                    <span>Result date</span>
                    <input
                      type="date"
                      value={resultDate}
                      onChange={(event) => setResultDate(event.target.value)}
                      style={inputStyle}
                      disabled={resultSaving}
                    />
                  </label>

                  <label style={{ ...fieldLabel, gridColumn: '1 / -1' }}>
                    <span>Notes</span>
                    <textarea
                      value={resultNotes}
                      onChange={(event) => setResultNotes(event.target.value)}
                      placeholder={individualFormatExperience.notesPlaceholder}
                      style={textareaStyle}
                      disabled={resultSaving}
                    />
                  </label>
                </div>

                {resultStatus ? <div style={statusBanner}>{resultStatus}</div> : null}

                <div style={actionRow}>
                  <button
                    type="button"
                    onClick={handleResultSubmit}
                    disabled={resultSaving}
                    style={{
                      ...primaryButton,
                      ...(resultSaving ? disabledButton : {}),
                    }}
                  >
                    {resultSaving ? 'Saving result...' : individualFormatExperience.actionLabel}
                  </button>
                  <span style={metaPill}>
                    {resultStorageSource === 'supabase' ? 'Supabase-backed results' : 'Local fallback results'}
                  </span>
                </div>

                {individualResults.length === 0 ? (
                  <div style={emptyCard}>{individualFormatExperience.emptyResults}</div>
                ) : (
                  <div style={listWrap}>
                    {individualResults.map((result) => (
                      <div key={result.id} style={dynamicListCard}>
                        <div>
                          <div style={listTitle}>
                            {result.winnerPlayerName} def.{' '}
                            {result.winnerPlayerName === result.playerAName ? result.playerBName : result.playerAName}
                          </div>
                          <div style={listMeta}>
                            {[result.score, formatDateTime(result.resultDate), result.notes].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <div style={dynamicResultMetaStack}>
                          <span style={metaPill}>
                            {result.score || individualFormatExperience.actionLabel}
                          </span>
                          {result.winnerPlayerId ? (
                            <GhostLink href={`/players/${encodeURIComponent(result.winnerPlayerId)}`}>Winner</GhostLink>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {league.leagueFormat === 'team' && teamStandings.length > 0 ? (
              <section style={panelCard}>
                <div style={sectionEyebrow}>Standings</div>
                <h2 style={sectionTitle}>Team records for this league.</h2>
                <p style={sectionText}>
                  Event wins are determined by line majority. Line wins are the tiebreaker.
                </p>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr>
                        {['#', 'Team', 'W', 'L', 'T', 'Line W', 'Line L', 'Line %'].map((h) => (
                          <th key={h} style={{ textAlign: h === 'Team' ? 'left' : 'center', padding: '8px 10px', color: '#64748b', fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teamStandings.map((row, i) => {
                        const totalLines = row.lineWins + row.lineLosses
                        const linePct = totalLines > 0 ? Math.round((row.lineWins / totalLines) * 100) : null
                        const isLeader = i === 0
                        return (
                          <tr key={row.teamName} style={{ background: isLeader ? 'rgba(155,225,29,0.04)' : undefined }}>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>{i + 1}</td>
                            <td style={{ padding: '10px', fontWeight: isLeader ? 700 : 500, color: isLeader ? '#9be11d' : '#e2e8f0' }}>{row.teamName}</td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#9be11d' }}>{row.wins}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>{row.losses}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#64748b' }}>{row.ties}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#93c5fd' }}>{row.lineWins}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>{row.lineLosses}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: linePct !== null && linePct >= 50 ? '#9be11d' : '#94a3b8' }}>
                              {linePct !== null ? `${linePct}%` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {league.leagueFormat === 'team' ? (
              <section style={panelCard}>
                <div style={sectionEyebrow}>Match Results</div>
                <h2 style={sectionTitle}>Team match events and line-by-line results.</h2>
                <p style={sectionText}>
                  Results are entered by captains or admins and feed the TIQ rating engine automatically.
                  Expand an event to see individual line scores.
                </p>

                {teamMatchEventsLoading ? (
                  <div style={emptyCard}>Loading match events…</div>
                ) : teamMatchEvents.length === 0 ? (
                  <div style={emptyCard}>No team match events have been logged for this league yet.</div>
                ) : (
                  <div style={listWrap}>
                    {teamMatchEvents.map((event) => {
                      const isExpanded = expandedMatchEventId === event.id
                      const lines = matchEventLines[event.id] || []
                      const linesLoaded = Boolean(matchEventLines[event.id])
                      const linesLoading = matchEventLinesLoading[event.id] || false
                      const teamAWins = lines.filter((l) => l.winnerSide === 'A').length
                      const teamBWins = lines.filter((l) => l.winnerSide === 'B').length
                      const completedLines = lines.filter((l) => l.winnerSide)

                      return (
                        <div key={event.id} style={dynamicListCard}>
                          <div style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                              <div>
                                <div style={listTitle}>
                                  {event.teamAName} <span style={{ color: '#64748b', fontWeight: 400 }}>vs</span> {event.teamBName}
                                </div>
                                <div style={listMeta}>
                                  {[formatDateTime(event.matchDate), event.facility].filter(Boolean).join(' · ')}
                                </div>
                                {linesLoaded && completedLines.length > 0 && (
                                  <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={teamAWins > teamBWins ? pillGreen : metaPill}>{event.teamAName}: {teamAWins}</span>
                                    <span style={teamBWins > teamAWins ? pillGreen : metaPill}>{event.teamBName}: {teamBWins}</span>
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleExpandMatchEvent(event.id)}
                                style={ghostActionButton}
                              >
                                {isExpanded ? 'Collapse' : `Lines${linesLoaded ? ` (${lines.length})` : ''}`}
                              </button>
                            </div>

                            {isExpanded && (
                              <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                                {linesLoading ? (
                                  <p style={listMeta}>Loading lines…</p>
                                ) : lines.length === 0 ? (
                                  <p style={listMeta}>No lines recorded yet.</p>
                                ) : (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                                    {lines.map((line) => (
                                      <div key={line.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                          <span style={{ fontWeight: 700, fontSize: 13 }}>Line {line.lineNumber}</span>
                                          <div style={{ display: 'flex', gap: 4 }}>
                                            <span style={metaPill}>{line.matchType}</span>
                                            {line.winnerSide ? (
                                              <span style={pillGreen}>
                                                {line.winnerSide === 'A' ? event.teamAName : event.teamBName} won
                                              </span>
                                            ) : (
                                              <span style={metaPill}>Pending</span>
                                            )}
                                          </div>
                                        </div>
                                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                          <div>A: {line.sideAPlayer1Name}{line.sideAPlayer2Name ? ` / ${line.sideAPlayer2Name}` : ''}</div>
                                          <div>B: {line.sideBPlayer1Name}{line.sideBPlayer2Name ? ` / ${line.sideBPlayer2Name}` : ''}</div>
                                          {line.score && <div style={{ marginTop: 3, color: '#cbd5e1' }}>{line.score}</div>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            ) : null}

            <section style={panelCard}>
              <div style={sectionEyebrow}>Captain context</div>
              <h2 style={sectionTitle}>Use TIQ league context without losing the command center.</h2>
              <p style={sectionText}>
                Team-based TIQ leagues should still hand off cleanly into availability, lineups, scenarios,
                and messaging. Individual leagues stay lighter-weight and participation-focused.
              </p>

              {captainLinks.length > 0 ? (
                <div style={dynamicQuickGrid}>
                  {captainLinks.map((item) => (
                    <Link key={item.href} href={item.href} style={quickButton}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <div style={emptyCard}>
                  Individual TIQ leagues stay out of the captain workflow unless you later add organizer-specific tools.
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </SiteShell>
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
    <div style={{ ...metricCard, ...(accent ? metricCardAccent : {}) }}>
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
    </div>
  )
}

const pageWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - 40px))',
  margin: '0 auto',
  padding: '18px 0 30px',
  display: 'grid',
  gap: '18px',
}

const heroCard: CSSProperties = {
  display: 'grid',
  gap: '16px',
  padding: '28px',
  borderRadius: '30px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(16,38,70,0.78) 0%, rgba(8,19,38,0.94) 100%)',
  boxShadow: '0 28px 60px rgba(2,10,24,0.22)',
}

const heroGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.08fr) minmax(320px, 0.92fr)',
  gap: '20px',
}

const eyebrow: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#93c5fd',
}

const heroTitle: CSSProperties = {
  margin: '10px 0 0',
  color: '#f8fbff',
  fontSize: '56px',
  lineHeight: 0.98,
  letterSpacing: '-0.04em',
}

const heroText: CSSProperties = {
  margin: '14px 0 0',
  color: 'rgba(229,238,251,0.78)',
  fontSize: '16px',
  lineHeight: 1.75,
}

const pillRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '14px',
}

const pillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '32px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const pillGreen: CSSProperties = {
  ...pillBase,
  background: 'rgba(155,225,29,0.14)',
  color: '#e7ffd1',
}

const pillBlue: CSSProperties = {
  ...pillBase,
  background: 'rgba(74,163,255,0.14)',
  color: '#dfeeff',
}

const pillSlate: CSSProperties = {
  ...pillBase,
  background: 'rgba(142, 161, 189, 0.14)',
  color: '#dfe8f8',
}

const hintPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '10px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(137,182,255,0.14)',
  background: 'rgba(43,78,138,0.34)',
  color: '#e2efff',
  fontSize: '13px',
  fontWeight: 700,
}

const heroHintRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '18px',
}

const sideCard: CSSProperties = {
  display: 'grid',
  gap: '12px',
  padding: '22px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(14,30,58,0.82) 0%, rgba(8,18,35,0.96) 100%)',
}

const sideLabel: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: '#93c5fd',
}

const sideValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const sideText: CSSProperties = {
  color: 'rgba(229,238,251,0.76)',
  fontSize: '14px',
  lineHeight: 1.7,
}

const actionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '18px',
}

const ghostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e7eefb',
  textDecoration: 'none',
  fontWeight: 800,
}

const ghostActionButton: CSSProperties = {
  ...ghostButton,
  cursor: 'pointer',
}

const statusBanner: CSSProperties = {
  padding: '12px 14px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(255,255,255,0.05)',
  color: '#dbeafe',
  fontWeight: 700,
}

const infoBanner: CSSProperties = {
  border: '1px solid rgba(74,222,128,0.16)',
  background: 'rgba(17, 39, 27, 0.58)',
  color: '#dcfce7',
}

const warningBanner: CSSProperties = {
  border: '1px solid rgba(245, 158, 11, 0.2)',
  background: 'rgba(120, 53, 15, 0.34)',
  color: '#fde68a',
}

const metricGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '16px',
}

const signalGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
}

const signalCardStyle: CSSProperties = {
  padding: '18px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(28,56,101,0.22) 0%, rgba(10,22,44,0.86) 100%)',
  boxShadow: '0 14px 34px rgba(7,18,40,0.16)',
}

const signalLabelStyle: CSSProperties = {
  color: '#8fb7ff',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const signalValueStyle: CSSProperties = {
  marginTop: '10px',
  color: '#f8fbff',
  fontSize: '1.28rem',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const signalNoteStyle: CSSProperties = {
  marginTop: '8px',
  color: 'rgba(224,234,247,0.74)',
  lineHeight: 1.6,
  fontSize: '.94rem',
}

const metricCard: CSSProperties = {
  padding: '18px',
  borderRadius: '24px',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.32) 0%, rgba(28,49,95,0.46) 100%)',
  boxShadow: '0 14px 34px rgba(9,25,54,0.14), inset 0 1px 0 rgba(255,255,255,0.05)',
}

const metricCardAccent: CSSProperties = {
  border: '1px solid rgba(111, 236, 168, 0.34)',
}

const metricLabel: CSSProperties = {
  color: 'rgba(198,216,248,0.78)',
  fontSize: '13px',
  fontWeight: 750,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const metricValue: CSSProperties = {
  marginTop: '8px',
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const contentGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
  gap: '18px',
}

const panelCard: CSSProperties = {
  display: 'grid',
  gap: '16px',
  padding: '24px',
  borderRadius: '28px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(14,30,58,0.82) 0%, rgba(8,18,35,0.96) 100%)',
}

const sectionEyebrow: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#93c5fd',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.08,
  letterSpacing: '-0.03em',
}

const sectionText: CSSProperties = {
  color: 'rgba(229,238,251,0.76)',
  fontSize: '14px',
  lineHeight: 1.72,
}

const formatCallout: CSSProperties = {
  display: 'grid',
  gap: '6px',
  padding: '14px 16px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(19,40,75,0.76) 0%, rgba(10,21,41,0.96) 100%)',
}

const formatCalloutTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const formatCalloutText: CSSProperties = {
  color: 'rgba(229,238,251,0.76)',
  fontSize: '13px',
  lineHeight: 1.65,
}

const fieldLabel: CSSProperties = {
  display: 'grid',
  gap: '8px',
  color: '#e7eefb',
  fontSize: '13px',
  fontWeight: 700,
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '48px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(7,17,33,0.72)',
  color: '#f8fbff',
  padding: '0 14px',
  outline: 'none',
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: '108px',
  paddingTop: '14px',
  resize: 'vertical',
}

const resultFormGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '14px',
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
  padding: '0 16px',
  borderRadius: '999px',
  border: 'none',
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  color: '#04121a',
  fontWeight: 900,
  cursor: 'pointer',
}

const disabledButton: CSSProperties = {
  opacity: 0.58,
  cursor: 'not-allowed',
  boxShadow: 'none',
}

const emptyCard: CSSProperties = {
  padding: '18px',
  borderRadius: '20px',
  border: '1px dashed rgba(116,190,255,0.18)',
  color: 'rgba(229,238,251,0.76)',
  background: 'rgba(255,255,255,0.04)',
  lineHeight: 1.7,
}

const listWrap: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const listCard: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  padding: '16px',
  borderRadius: '20px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
}

const standingCard: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '56px minmax(0, 1fr)',
  gap: '14px',
  alignItems: 'stretch',
  padding: '16px',
  borderRadius: '22px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
}

const standingRank: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '18px',
  background: 'linear-gradient(180deg, rgba(74,163,255,0.18) 0%, rgba(9,24,48,0.94) 100%)',
  color: '#f8fbff',
  fontSize: '20px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const standingBody: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const standingHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

const standingMetrics: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  justifyContent: 'flex-end',
}

const standingMetric: CSSProperties = {
  display: 'grid',
  gap: '4px',
  minWidth: '74px',
  padding: '10px 12px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(7, 17, 33, 0.55)',
}

const standingMetricLabel: CSSProperties = {
  color: 'rgba(214,228,246,0.64)',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const standingMetricValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '18px',
  fontWeight: 800,
  lineHeight: 1,
}

const standingMetricValueAccent: CSSProperties = {
  ...standingMetricValue,
  color: '#dffad5',
}

const standingActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
}

const resultMetaStack: CSSProperties = {
  display: 'grid',
  justifyItems: 'end',
  gap: '8px',
}

const opportunityGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px',
}

const opportunityCard: CSSProperties = {
  display: 'grid',
  gap: '10px',
  padding: '16px',
  borderRadius: '20px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
}

const opportunityTitleRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '10px',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

const opportunityTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '17px',
  fontWeight: 800,
  lineHeight: 1.25,
}

const opportunityText: CSSProperties = {
  color: 'rgba(214,228,246,0.76)',
  fontSize: '13px',
  lineHeight: 1.65,
}

const listTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '18px',
  fontWeight: 800,
}

const listMeta: CSSProperties = {
  marginTop: '4px',
  color: 'rgba(214,228,246,0.72)',
  fontSize: '13px',
  lineHeight: 1.6,
}

const metaPill: CSSProperties = {
  ...pillSlate,
  minHeight: '30px',
}

const quickGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '10px',
}

const quickButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  padding: '0 12px',
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(7, 17, 33, 0.7)',
  color: '#eef5ff',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '13px',
}

const stateCard: CSSProperties = {
  padding: '24px',
  borderRadius: '28px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(14,30,58,0.82) 0%, rgba(8,18,35,0.96) 100%)',
  color: '#dbeafe',
}

const stateTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '24px',
  fontWeight: 900,
  lineHeight: 1.08,
}

const stateText: CSSProperties = {
  marginTop: '10px',
  color: 'rgba(229,238,251,0.76)',
  fontSize: '14px',
  lineHeight: 1.72,
}

function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      style={{ ...ghostButton, ...(hovered ? { background: 'rgba(255,255,255,0.10)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(2,10,24,0.28)' } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  )
}
