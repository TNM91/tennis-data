'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import FollowButton from '@/app/components/follow-button'
import QuickMessageComposer from '@/app/components/quick-message-composer'
import ScheduleMessageComposer from '@/app/components/schedule-message-composer'
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
import {
  getTiqLeagueScoringSystemLabel,
  getTiqLeagueSchedulingModeDescription,
  getTiqLeagueSchedulingModeLabel,
  type TiqLeagueRecord,
} from '@/lib/tiq-league-registry'
import { buildScheduleCalendarDays } from '@/lib/tiq-league-schedule-calendar'
import { buildIndividualResultCue, buildTeamResultCue } from '@/lib/league-result-cues'
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
  listTiqTeamMatchLinesForEvents,
  type TiqTeamMatchEventRecord,
  type TiqTeamMatchLineRecord,
  type TiqTeamStandingRow,
} from '@/lib/tiq-team-results-service'
import {
  listTiqLeagueScheduleItems,
  saveTiqLeagueScheduleItem,
  updateTiqLeagueScheduleStatus,
  type TiqLeagueScheduleItem,
  type TiqLeagueScheduleSource,
} from '@/lib/tiq-league-schedule-service'
import {
  calculateDynamicPointsForSides,
  getDynamicPointsRulesSummary,
  validateTiqTennisMatchScore,
} from '@/lib/tiq-scoring'
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
  leaguePoints: number
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

type TeamMatchPublicSummary = {
  total: number
  completed: number
  pending: number
  teamAWins: number
  teamBWins: number
  teamAPoints: number
  teamBPoints: number
  scoreReviewCount: number
}

type HubNavItem = {
  href: string
  label: string
  detail: string
}

type ScheduleDisplayMode = 'calendar' | 'list'

type LeagueLeaderRow = {
  rank: number
  name: string
  record: string
  detail: string
  href: string | null
}

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

function isEditedIndividualResult(result: TiqIndividualLeagueResultRecord) {
  const createdTime = result.createdAt ? new Date(result.createdAt).getTime() : 0
  const updatedTime = result.updatedAt ? new Date(result.updatedAt).getTime() : 0
  if (!createdTime || !updatedTime) return false

  return updatedTime - createdTime > 1000
}

function resultOpponentName(result: TiqIndividualLeagueResultRecord) {
  return result.winnerPlayerName === result.playerAName ? result.playerBName : result.playerAName
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
  return `/mylab?playerA=${encodeURIComponent(playerAId)}&playerB=${encodeURIComponent(playerBId)}`
}

function buildPrefilledResultHref(
  leagueId: string,
  playerAValue: string,
  playerBValue: string,
  options?: {
    scheduleItemId?: string
    resultDate?: string
  },
) {
  const params = new URLSearchParams({
    leagueId,
    suggest_player_a: playerAValue,
    suggest_player_b: playerBValue,
  })
  if (options?.scheduleItemId) params.set('scheduleItemId', options.scheduleItemId)
  if (options?.resultDate) params.set('resultDate', options.resultDate)
  return `/league-coordinator/individual-results?${params.toString()}#player-result-entry`
}

function buildIndividualResultEntryHref(leagueId: string, anchor = 'player-result-entry') {
  const params = new URLSearchParams({ leagueId })
  return `/league-coordinator/individual-results?${params.toString()}#${anchor}`
}

function buildTeamResultEntryHref(leagueId: string, anchor = 'team-match-entry') {
  const params = new URLSearchParams({ leagueId })
  return `/league-coordinator/results?${params.toString()}#${anchor}`
}

function buildScheduledTeamResultEntryHref(leagueId: string, item: TiqLeagueScheduleItem) {
  const params = new URLSearchParams({
    leagueId,
    scheduleItemId: item.id,
    teamA: item.participantAName,
    teamB: item.participantBName,
  })
  if (item.scheduledDate) params.set('matchDate', item.scheduledDate)
  if (item.facility) params.set('facility', item.facility)
  if (item.notes) params.set('notes', item.notes)
  return `/league-coordinator/results?${params.toString()}#team-match-entry`
}

function buildTeamMatchPublicSummary(
  lines: TiqTeamMatchLineRecord[],
  scoringSystem: TiqLeagueRecord['scoringSystem'],
): TeamMatchPublicSummary {
  return lines.reduce<TeamMatchPublicSummary>(
    (summary, line) => {
      const completed = Boolean(line.winnerSide)
      const points =
        completed && scoringSystem === 'dynamic_points'
          ? calculateDynamicPointsForSides(line.score, line.winnerSide)
          : null

      return {
        total: summary.total + 1,
        completed: summary.completed + (completed ? 1 : 0),
        pending: summary.pending + (completed ? 0 : 1),
        teamAWins: summary.teamAWins + (line.winnerSide === 'A' ? 1 : 0),
        teamBWins: summary.teamBWins + (line.winnerSide === 'B' ? 1 : 0),
        teamAPoints: summary.teamAPoints + (points?.sideAPoints ?? 0),
        teamBPoints: summary.teamBPoints + (points?.sideBPoints ?? 0),
        scoreReviewCount:
          summary.scoreReviewCount +
          (scoringSystem === 'dynamic_points' && completed && line.score && !points?.valid ? 1 : 0),
      }
    },
    {
      total: 0,
      completed: 0,
      pending: 0,
      teamAWins: 0,
      teamBWins: 0,
      teamAPoints: 0,
      teamBPoints: 0,
      scoreReviewCount: 0,
    },
  )
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
  const [scheduleItems, setScheduleItems] = useState<TiqLeagueScheduleItem[]>([])
  const [scheduleSource, setScheduleSource] = useState<TiqLeagueScheduleSource>('local')
  const [scheduleStatus, setScheduleStatus] = useState('')
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleParticipantA, setScheduleParticipantA] = useState('')
  const [scheduleParticipantB, setScheduleParticipantB] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleFacility, setScheduleFacility] = useState('')
  const [scheduleNotes, setScheduleNotes] = useState('')
  const [scheduleDisplayMode, setScheduleDisplayMode] = useState<ScheduleDisplayMode>('calendar')

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
        const result = await listTiqTeamLeagueEntries(league.id, { includeAllStatuses: true })
        if (!active) return
        setTeamEntries(result.entries)
        setPlayerEntries([])
        if (result.warning) {
          setStorageWarning((current) => current || result.warning || '')
        }
        return
      }

      const result = await listTiqPlayerLeagueEntries(league.id, { includeAllStatuses: true })
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
        if (active) {
          setTeamMatchEvents([])
          setTeamStandings([])
          setMatchEventLines({})
        }
        return
      }
      if (active) setTeamMatchEventsLoading(true)
      const [{ events }, { standings }] = await Promise.all([
        listTiqTeamMatchEvents({ leagueId: league.id }),
        computeTiqTeamLeagueStandings(league.id),
      ])
      const { lines } = await listTiqTeamMatchLinesForEvents(events.map((event) => event.id))
      const nextMatchEventLines = events.reduce<Record<string, TiqTeamMatchLineRecord[]>>((lineMap, event) => {
        lineMap[event.id] = []
        return lineMap
      }, {})
      lines.forEach((line) => {
        nextMatchEventLines[line.eventId] = [...(nextMatchEventLines[line.eventId] || []), line]
      })
      if (!active) return
      setTeamMatchEvents(events)
      setTeamStandings(standings)
      setMatchEventLines(nextMatchEventLines)
      setTeamMatchEventsLoading(false)
    }

    void loadTeamMatchEvents()

    return () => {
      active = false
    }
  }, [league])

  useEffect(() => {
    let active = true

    async function loadScheduleItems() {
      if (!league) {
        if (active) setScheduleItems([])
        return
      }

      const result = await listTiqLeagueScheduleItems(league.id)
      if (!active) return
      setScheduleItems(result.items)
      setScheduleSource(result.source)
      if (result.warning) {
        setStorageWarning((current) => current || result.warning || '')
      }
    }

    void loadScheduleItems()

    return () => {
      active = false
    }
  }, [league])

  useEffect(() => {
    if (!league) return
    setScheduleTime(league.defaultMatchTime || '')
    setScheduleFacility(league.defaultFacility || '')
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
  const scoringRulesText =
    league?.scoringSystem === 'dynamic_points'
      ? getDynamicPointsRulesSummary()
      : 'Best 2 of 3 sets. The third set may be played out or entered as a 10-point match tiebreak, such as 1-0 or 10-8. Standings use match wins, losses, ties, and line wins.'
  const scheduleRulesText = league
    ? [
        getTiqLeagueSchedulingModeDescription(league.schedulingMode),
        league.defaultMatchDay || league.defaultMatchTime || league.defaultFacility
          ? `Default: ${[league.defaultMatchDay, league.defaultMatchTime, league.defaultFacility].filter(Boolean).join(', ')}.`
          : '',
        league.schedulingNotes,
      ].filter(Boolean).join(' ')
    : ''
  const individualFormatExperience = getTiqIndividualCompetitionFormatExperience(
    league?.individualCompetitionFormat,
  )
  const entryEnabled = league?.leagueFormat === 'team' ? access.canEnterTiqTeamLeague : access.canJoinTiqIndividualLeague
  const entryLabel = league?.leagueFormat === 'team' ? 'Request Team Entry' : 'Request to Join'
  const entryPlaceholder =
    league?.leagueFormat === 'team' ? 'North Dallas Aces' : deriveDefaultParticipantName(userEmail) || 'Player name'
  const entryMessage =
    league?.leagueFormat === 'team' ? access.teamLeagueMessage : access.individualLeagueMessage
  const canLogIndividualResults = league?.leagueFormat === 'individual' && access.canCreateTiqIndividualLeague
  const resultEntryDisabled = resultSaving || !canLogIndividualResults
  const seasonWindowText =
    league?.startsOn || league?.endsOn
      ? [league.startsOn || 'Start TBD', league.endsOn || 'End TBD'].join(' to ')
      : 'Season window not set'
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
  const scheduleParticipantOptions = useMemo<ResultParticipantOption[]>(() => {
    if (!league) return []

    if (league.leagueFormat === 'team') {
      return visibleTeamEntries.map((entry) => ({
        value: entry.teamEntityId || `name:${entry.teamName}`,
        playerId: entry.teamEntityId,
        playerName: entry.teamName,
      }))
    }

    return visiblePlayerEntries.map((entry) => ({
      value: entry.playerId || `name:${entry.playerName}`,
      playerId: entry.playerId,
      playerName: entry.playerName,
    }))
  }, [league, visiblePlayerEntries, visibleTeamEntries])
  const activeEntryCount =
    league?.leagueFormat === 'team'
      ? visibleTeamEntries.length
      : league?.leagueFormat === 'individual'
        ? visiblePlayerEntries.length
        : 0
  const pendingEntries =
    league?.leagueFormat === 'team'
      ? teamEntries.filter((entry) => entry.entryStatus === 'pending')
      : playerEntries.filter((entry) => entry.entryStatus === 'pending')
  const rejectedEntries =
    league?.leagueFormat === 'team'
      ? teamEntries.filter((entry) => entry.entryStatus === 'rejected')
      : playerEntries.filter((entry) => entry.entryStatus === 'rejected')
  const pendingEntryCount = pendingEntries.length
  const rejectedEntryCount = rejectedEntries.length
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
  const scheduleParticipantAOption =
    scheduleParticipantOptions.find((option) => option.value === scheduleParticipantA) || null
  const scheduleParticipantBOption =
    scheduleParticipantOptions.find((option) => option.value === scheduleParticipantB) || null
  const resultWinnerOptions = [resultPlayerAOption, resultPlayerBOption].filter(
    (option): option is ResultParticipantOption => Boolean(option),
  )
  const individualResultBookStats = useMemo(() => {
    const pairKeys = new Set(
      individualResults.map((result) =>
        [result.playerAName.toLowerCase(), result.playerBName.toLowerCase()].sort().join('::'),
      ),
    )
    const possiblePairs =
      visiblePlayerEntries.length > 1
        ? (visiblePlayerEntries.length * (visiblePlayerEntries.length - 1)) / 2
        : 0
    const latestResult = individualResults[0] || null
    const recentCount = individualResults.filter((result) => isRecentResult(result.resultDate, 14)).length
    const correctionCount = individualResults.filter(isEditedIndividualResult).length

    return {
      total: individualResults.length,
      latestResult,
      recentCount,
      correctionCount,
      uniquePairCount: pairKeys.size,
      possiblePairs,
      coverageRate: possiblePairs > 0 ? pairKeys.size / possiblePairs : null,
    }
  }, [individualResults, visiblePlayerEntries])
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
            primaryLabel: targetAbove ? 'Open My Lab' : 'Player page',
            secondaryHref:
              targetAbove && targetValue
                ? buildPrefilledResultHref(league.id, entryValue, targetValue)
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
                ? buildPrefilledResultHref(league.id, entryValue, nearestValue)
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
                ? buildPrefilledResultHref(league.id, entryValue, peerValue)
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
  }, [individualCompetitionFormat, individualResults, individualStandings, league])

  const scheduledTeamEvents = useMemo(
    () =>
      [...teamMatchEvents].sort((left, right) => {
        const leftTime = left.matchDate ? new Date(left.matchDate).getTime() : Number.MAX_SAFE_INTEGER
        const rightTime = right.matchDate ? new Date(right.matchDate).getTime() : Number.MAX_SAFE_INTEGER
        return leftTime - rightTime
      }),
    [teamMatchEvents],
  )
  const nextTeamEvent = useMemo(() => {
    const now = Date.now()
    return (
      scheduledTeamEvents.find((event) => {
        const eventTime = event.matchDate ? new Date(event.matchDate).getTime() : 0
        return eventTime >= now
      }) ||
      scheduledTeamEvents[0] ||
      null
    )
  }, [scheduledTeamEvents])
  const visibleScheduleItems = useMemo(
    () =>
      scheduleItems.filter((item) => item.status !== 'cancelled').sort((left, right) => {
        const leftKey = `${left.scheduledDate || '9999-12-31'} ${left.scheduledTime || '99:99'}`
        const rightKey = `${right.scheduledDate || '9999-12-31'} ${right.scheduledTime || '99:99'}`
        return leftKey.localeCompare(rightKey)
      }),
    [scheduleItems],
  )
  const pendingScheduleItemCount = visibleScheduleItems.filter((item) => item.status === 'proposed').length
  const confirmedScheduleItemCount = visibleScheduleItems.filter((item) =>
    item.status === 'confirmed' || item.status === 'coordinator_set',
  ).length
  const completedScheduleItemCount = visibleScheduleItems.filter((item) => item.status === 'completed').length
  const scheduleCalendarDays = useMemo(
    () => buildScheduleCalendarDays(visibleScheduleItems),
    [visibleScheduleItems],
  )
  const upcomingScheduleItems = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const datedItems = visibleScheduleItems.filter(
      (item) => item.status !== 'completed' && item.scheduledDate && item.scheduledDate >= today,
    )
    const fallbackItems = visibleScheduleItems.filter((item) => item.status !== 'completed')
    return (datedItems.length > 0 ? datedItems : fallbackItems).slice(0, 4)
  }, [visibleScheduleItems])
  const individualResultByScheduleItemId = useMemo(() => {
    const resultMap = new Map<string, TiqIndividualLeagueResultRecord>()
    individualResults.forEach((result) => {
      if (result.scheduleItemId) resultMap.set(result.scheduleItemId, result)
    })
    return resultMap
  }, [individualResults])
  const teamEventByScheduleItemId = useMemo(() => {
    const eventMap = new Map<string, TiqTeamMatchEventRecord>()
    teamMatchEvents.forEach((event) => {
      if (event.scheduleItemId) eventMap.set(event.scheduleItemId, event)
    })
    return eventMap
  }, [teamMatchEvents])
  const hubNavItems = useMemo<HubNavItem[]>(() => {
    if (!league) return []

    return [
      {
        href: '#league-overview',
        label: 'Overview',
        detail: `${activeEntryCount} active`,
      },
      {
        href: '#league-schedule',
        label: 'Schedule',
        detail:
          visibleScheduleItems.length > 0
            ? `${visibleScheduleItems.length} items`
            : league.leagueFormat === 'team'
              ? `${teamMatchEvents.length} matches`
              : `${competitionOpportunities.length} prompts`,
      },
      {
        href: '#league-requests',
        label: 'Requests',
        detail: `${pendingEntryCount} pending`,
      },
      {
        href: '#league-participants',
        label: 'Participants',
        detail: `${activeEntryCount} active`,
      },
      {
        href: league.leagueFormat === 'team' ? '#league-team-results' : '#league-individual-results',
        label: 'Results',
        detail:
          league.leagueFormat === 'team'
            ? `${teamMatchEvents.length} events`
            : `${individualResultBookStats.total} logged`,
      },
      {
        href: '#league-standings',
        label: 'Standings',
        detail:
          league.leagueFormat === 'team'
            ? `${teamStandings.length} rows`
            : `${individualStandings.length} rows`,
      },
      {
        href: '#league-settings',
        label: 'Settings',
        detail: getTiqLeagueSchedulingModeLabel(league.schedulingMode),
      },
    ]
  }, [
    activeEntryCount,
    competitionOpportunities.length,
    individualResultBookStats.total,
    individualStandings.length,
    league,
    pendingEntryCount,
    teamMatchEvents.length,
    teamStandings.length,
    visibleScheduleItems.length,
  ])

  const teamResultCue = useMemo(() => {
    const summaries = teamMatchEvents.map((event) =>
      buildTeamMatchPublicSummary(matchEventLines[event.id] || [], league?.scoringSystem || 'standard'),
    )
    const completeMatchCount = summaries.filter((summary) => summary.total > 0 && summary.completed === summary.total).length

    return buildTeamResultCue({
      leagueCount: league?.leagueFormat === 'team' ? 1 : 0,
      selectedLeagueName: league?.leagueFormat === 'team' ? league.leagueName : '',
      teamCount: visibleTeamEntries.length,
      matchCount: teamMatchEvents.length,
      completeMatchCount,
      completedLineCount: summaries.reduce((total, summary) => total + summary.completed, 0),
      totalLineCount: summaries.reduce((total, summary) => total + summary.total, 0),
      scoreReviewCount: summaries.reduce((total, summary) => total + summary.scoreReviewCount, 0),
    })
  }, [league, matchEventLines, teamMatchEvents, visibleTeamEntries.length])

  const individualResultCue = useMemo(
    () =>
      buildIndividualResultCue({
        leagueCount: league?.leagueFormat === 'individual' ? 1 : 0,
        selectedLeagueName: league?.leagueFormat === 'individual' ? league.leagueName : '',
        playerCount: visiblePlayerEntries.length,
        resultCount: individualResultBookStats.total,
        nextPairingLabel: competitionOpportunities[0]?.title || '',
      }),
    [competitionOpportunities, individualResultBookStats.total, league, visiblePlayerEntries.length],
  )
  const individualCuePrimaryHref =
    league?.leagueFormat === 'individual'
      ? competitionOpportunities[0]?.secondaryHref ||
        buildIndividualResultEntryHref(league.id, individualResultBookStats.total > 0 ? 'player-result-review' : 'player-result-entry')
      : '/league-coordinator/individual-results#player-result-entry'
  const teamCuePrimaryHref =
    league?.leagueFormat === 'team'
      ? buildTeamResultEntryHref(league.id, teamMatchEvents.length > 0 ? 'team-match-review' : 'team-match-entry')
      : '/league-coordinator/results#team-match-entry'
  const individualLeader = league?.leagueFormat === 'individual' ? individualStandings[0] || null : null
  const teamLeader = league?.leagueFormat === 'team' ? teamStandings[0] || null : null
  const leaderName = individualLeader?.playerName || teamLeader?.teamName || ''
  const leaderRows = useMemo<LeagueLeaderRow[]>(() => {
    if (!league) return []

    if (league.leagueFormat === 'individual') {
      return individualStandings.slice(0, 5).map((entry) => ({
        rank: entry.rank,
        name: entry.playerName,
        record: `${entry.leagueWins}-${entry.leagueLosses}`,
        detail:
          league.scoringSystem === 'dynamic_points'
            ? `${entry.leaguePoints} pts`
            : `${entry.leagueMatches} result${entry.leagueMatches === 1 ? '' : 's'}`,
        href: entry.playerId ? `/players/${encodeURIComponent(entry.playerId)}` : null,
      }))
    }

    return teamStandings.slice(0, 5).map((entry, index) => ({
      rank: index + 1,
      name: entry.teamName,
      record: `${entry.wins}-${entry.losses}${entry.ties ? `-${entry.ties}` : ''}`,
      detail:
        league.scoringSystem === 'dynamic_points'
          ? `${entry.points} pts`
          : `${entry.lineWins} line win${entry.lineWins === 1 ? '' : 's'}`,
      href: `/team/${encodeURIComponent(entry.teamName)}?layer=tiq&league=${encodeURIComponent(league.leagueName)}`,
    }))
  }, [individualStandings, league, teamStandings])
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
          const leaguePoints =
            league.scoringSystem === 'dynamic_points'
              ? playerResults.reduce((sum, result) => {
                  const playerAName = result.playerAName.toLowerCase()
                  const playerBName = result.playerBName.toLowerCase()
                  const winnerName = result.winnerPlayerName.toLowerCase()
                  const playerIsSideA = playerAName === normalizedEntryName
                  const winnerSide = winnerName === playerAName ? 'A' : winnerName === playerBName ? 'B' : null
                  const points = calculateDynamicPointsForSides(result.score, winnerSide)
                  return sum + (playerIsSideA ? points.sideAPoints : points.sideBPoints)
                }, 0)
              : leagueWins
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
            leaguePoints,
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
          if (league.scoringSystem === 'dynamic_points' && right.leaguePoints !== left.leaguePoints) {
            return right.leaguePoints - left.leaguePoints
          }

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

  async function refreshScheduleItems(leagueId: string) {
    const latest = await listTiqLeagueScheduleItems(leagueId)
    setScheduleItems(latest.items)
    setScheduleSource(latest.source)
    setStorageWarning((current) => current || latest.warning || '')
  }

  async function handleScheduleSubmit() {
    if (!league) return

    if (!scheduleParticipantAOption || !scheduleParticipantBOption) {
      setScheduleStatus('Choose both participants before scheduling this match.')
      return
    }

    if (scheduleParticipantAOption.value === scheduleParticipantBOption.value) {
      setScheduleStatus('Choose two different participants before scheduling this match.')
      return
    }

    if (!scheduleDate) {
      setScheduleStatus('Choose a match date before saving this schedule item.')
      return
    }

    if (!userId) {
      setScheduleStatus('Sign in before scheduling this league match.')
      return
    }

    setScheduleSaving(true)
    setScheduleStatus('')

    try {
      const result = await saveTiqLeagueScheduleItem({
        leagueId: league.id,
        leagueFormat: league.leagueFormat,
        participantAName: scheduleParticipantAOption.playerName,
        participantAId: scheduleParticipantAOption.playerId,
        participantBName: scheduleParticipantBOption.playerName,
        participantBId: scheduleParticipantBOption.playerId,
        scheduledDate: scheduleDate,
        scheduledTime: scheduleTime,
        facility: scheduleFacility || league.defaultFacility,
        status: league.schedulingMode === 'coordinator_fixed' && access.canUseLeagueTools ? 'coordinator_set' : 'proposed',
        notes: scheduleNotes,
      })

      await refreshScheduleItems(league.id)
      setScheduleSource(result.source)
      setStorageWarning((current) => current || result.warning || '')
      setScheduleStatus(
        league.schedulingMode === 'coordinator_fixed' && access.canUseLeagueTools
          ? 'Published this match slot to the league schedule.'
          : 'Proposed this match time. A coordinator or participant can confirm it.',
      )
      setScheduleParticipantA('')
      setScheduleParticipantB('')
      setScheduleDate('')
      setScheduleTime(league.defaultMatchTime || '')
      setScheduleFacility(league.defaultFacility || '')
      setScheduleNotes('')
    } catch (error) {
      setScheduleStatus(error instanceof Error ? error.message : 'Unable to save this schedule item.')
    } finally {
      setScheduleSaving(false)
    }
  }

  async function handleScheduleStatusChange(
    scheduleItemId: string,
    status: 'confirmed' | 'completed' | 'cancelled',
  ) {
    if (!league) return

    setScheduleSaving(true)
    setScheduleStatus('')

    try {
      const result = await updateTiqLeagueScheduleStatus({ scheduleItemId, status })
      await refreshScheduleItems(league.id)
      setScheduleSource(result.source)
      setStorageWarning((current) => current || result.warning || '')
      setScheduleStatus(
        status === 'confirmed'
          ? 'Confirmed this match time.'
          : status === 'completed'
            ? 'Marked this scheduled match complete.'
            : 'Cancelled this schedule item.',
      )
    } catch (error) {
      setScheduleStatus(error instanceof Error ? error.message : 'Unable to update this schedule item.')
    } finally {
      setScheduleSaving(false)
    }
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

    if (!canLogIndividualResults) {
      setResultStatus(access.individualLeagueMessage)
      return
    }

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

    const winnerSide = winnerOption.value === resultPlayerAOption.value ? 'A' : 'B'
    const scoreValidation = validateTiqTennisMatchScore(resultScore, winnerSide)
    if (!scoreValidation.valid) {
      setResultStatus(scoreValidation.message)
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

    const currentRequests = league.leagueFormat === 'team' ? teamEntries : playerEntries
    const existingRequest = currentRequests.find((entry) => {
      const name = 'teamName' in entry ? entry.teamName : entry.playerName
      return name.toLowerCase() === normalizedEntry.toLowerCase()
    })
    if (existingRequest?.entryStatus === 'pending') {
      setStatus(`${normalizedEntry} already has a pending request. The coordinator needs to approve it before it appears in the league.`)
      return
    }
    if (existingRequest?.entryStatus === 'rejected') {
      setStatus(`${normalizedEntry} was previously declined. Contact the coordinator before requesting again.`)
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
          ? `${normalizedEntry} requested entry. The coordinator must approve it before the team appears in this league.`
          : `${normalizedEntry} requested entry. The coordinator must approve it before the player appears in this league.`,
      )
      if (league.leagueFormat === 'individual') {
        setEntryValue(normalizedEntry)
        const latestEntries = await listTiqPlayerLeagueEntries(league.id, { includeAllStatuses: true })
        setPlayerEntries(latestEntries.entries)
      }
      if (league.leagueFormat === 'team') {
        const latestEntries = await listTiqTeamLeagueEntries(league.id, { includeAllStatuses: true })
        setTeamEntries(latestEntries.entries)
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Unable to update league participation.')
    } finally {
      setSaving(false)
    }
  }

  function renderScheduleItemRow(item: TiqLeagueScheduleItem, mode: 'calendar' | 'list' = 'list') {
    if (!league) return null

    const individualScheduleResult = individualResultByScheduleItemId.get(item.id) || null
    const teamScheduleEvent = teamEventByScheduleItemId.get(item.id) || null
    const scheduleOutcomeText = individualScheduleResult
      ? `${individualScheduleResult.winnerPlayerName} def. ${resultOpponentName(individualScheduleResult)}${
          individualScheduleResult.score ? `, ${individualScheduleResult.score}` : ''
        }`
      : teamScheduleEvent
        ? `${teamScheduleEvent.teamAName} vs ${teamScheduleEvent.teamBName}${
            teamScheduleEvent.winnerTeamName ? `, winner ${teamScheduleEvent.winnerTeamName}` : ''
          }`
        : ''
    const resultHref =
      league.leagueFormat === 'team'
        ? buildScheduledTeamResultEntryHref(league.id, item)
        : buildPrefilledResultHref(
            league.id,
            item.participantAId || `name:${item.participantAName}`,
            item.participantBId || `name:${item.participantBName}`,
            {
              scheduleItemId: item.id,
              resultDate: item.scheduledDate,
            },
          )
    const messageSubject = `${item.participantAName} vs ${item.participantBName}`
    const messageBody = [
      `Hi ${item.participantBName},`,
      '',
      `Checking in about our ${league.leagueName} match${item.scheduledDate ? ` on ${item.scheduledDate}` : ''}.`,
    ].join('\n')
    const supportSubject = `Question about ${league.leagueName}: ${item.participantAName} vs ${item.participantBName}`
    const supportBody = [
      `League: ${league.leagueName}`,
      `Match: ${item.participantAName} vs ${item.participantBName}`,
      item.scheduledDate ? `Date: ${item.scheduledDate}` : '',
      item.scheduledTime ? `Time: ${item.scheduledTime}` : '',
      item.facility ? `Site: ${item.facility}` : '',
      '',
      'What I need help with:',
    ].filter(Boolean).join('\n')
    const statusLabel =
      item.status === 'coordinator_set'
        ? 'Published'
        : item.status === 'completed'
          ? 'Completed'
          : item.status
    const isCompact = mode === 'calendar'

    return (
      <div key={item.id} style={isCompact ? scheduleCalendarItemStyle : scheduleRowStyle}>
        <div>
          <div style={isCompact ? scheduleCalendarItemTitleStyle : listTitle}>
            {item.participantAName} vs {item.participantBName}
          </div>
          <div style={listMeta}>
            {[
              isCompact ? null : item.scheduledDate,
              item.scheduledTime,
              item.facility,
              item.notes,
            ]
              .filter(Boolean)
              .join(' | ')}
          </div>
          {scheduleOutcomeText ? (
            <div style={{ ...listMeta, color: '#bbf7d0', marginTop: 6 }}>
              Result: {scheduleOutcomeText}
            </div>
          ) : null}
        </div>
        <div style={isCompact ? scheduleCalendarActionsStyle : scheduleRowActionsStyle}>
          <span style={item.status === 'proposed' ? pillAmber : pillGreen}>
            {statusLabel}
          </span>
          {item.status !== 'completed' ? (
            <GhostLink href={resultHref}>Log result</GhostLink>
          ) : null}
          {item.participantBName ? (
            <QuickMessageComposer
              mode="direct"
              triggerLabel="Message opponent"
              recipientName={item.participantBName}
              recipientPlayerId={item.participantBId}
              subject={messageSubject}
              body={messageBody}
              entityType="tiq_schedule_item"
              entityId={item.id}
            />
          ) : null}
          <QuickMessageComposer
            mode="support"
            triggerLabel="Ask support"
            category="league"
            subject={supportSubject}
            body={supportBody}
            entityType="tiq_schedule_item"
            entityId={item.id}
          />
          {item.status === 'proposed' ? (
            <button
              type="button"
              onClick={() => void handleScheduleStatusChange(item.id, 'confirmed')}
              disabled={scheduleSaving || !userId}
              style={{
                ...ghostActionButton,
                ...(scheduleSaving || !userId ? disabledButton : {}),
              }}
            >
              Confirm
            </button>
          ) : null}
          {item.status !== 'completed' ? (
            <button
              type="button"
              onClick={() => void handleScheduleStatusChange(item.id, 'cancelled')}
              disabled={scheduleSaving || !userId}
              style={{
                ...ghostActionButton,
                ...(scheduleSaving || !userId ? disabledButton : {}),
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    )
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
              <GhostLink href="/league-coordinator">Open League Coordinator</GhostLink>
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
                    <span style={pillSlate}>{getTiqLeagueSchedulingModeLabel(league.schedulingMode)}</span>
                    <span style={pillSlate}>{getTiqLeagueScoringSystemLabel(league.scoringSystem)}</span>
                    <span style={storageSource === 'supabase' ? pillGreen : pillBlue}>
                      {storageSource === 'supabase' ? 'Live data' : 'Saved preview'}
                    </span>
                  </div>
                  <p style={heroText}>
                    {[league.seasonLabel, league.flight, league.locationLabel].filter(Boolean).join(' | ') ||
                      'TIQ competition details'}
                  </p>

                  <div style={heroHintRow}>
                    <span style={hintPill}>
                      {activeEntryCount} {league.leagueFormat === 'team' ? 'active teams' : 'active players'}
                    </span>
                    {pendingEntryCount > 0 ? <span style={hintPill}>{pendingEntryCount} requests pending</span> : null}
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
                  {league.photoUrl ? (
                    <div style={leaguePhotoWrap}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={league.photoUrl} alt={`${league.leagueName} league`} style={leaguePhoto} />
                    </div>
                  ) : null}
                  <div style={sideLabel}>League race</div>
                  <div style={sideValue}>{leaderRows.length > 0 ? 'Leaders' : 'Standings pending'}</div>
                  {leaderRows.length > 0 ? (
                    <div style={leaderTableStyle} aria-label="League leaders">
                      {leaderRows.slice(0, 5).map((row) => (
                        <div key={`${row.rank}-${row.name}`} style={leaderRowStyle}>
                          <span style={row.rank === 1 ? leaderRankAccentStyle : leaderRankMiniStyle}>
                            {row.rank}
                          </span>
                          <div style={leaderNameCellStyle}>
                            <strong>{row.name}</strong>
                            <span>{row.detail}</span>
                          </div>
                          <span style={leaderRecordStyle}>{row.record}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={sideText}>
                      The table wakes up as soon as approved participants and results are in.
                    </div>
                  )}
                  <div style={actionRow}>
                    <GhostLink href="#league-standings">Standings</GhostLink>
                    <GhostLink href={league.leagueFormat === 'team' ? '#league-team-results' : '#league-individual-results'}>
                      Results
                    </GhostLink>
                    <QuickMessageComposer
                      mode="league"
                      triggerLabel="League room"
                      subject={`${league.leagueName} league room`}
                      body={[
                        `League: ${league.leagueName}`,
                        league.flight ? `Flight: ${league.flight}` : '',
                        '',
                        'Update:',
                      ].filter(Boolean).join('\n')}
                      leagueId={league.id}
                      leagueName={league.leagueName}
                      entityType="tiq_league"
                      entityId={league.id}
                      participantPlayerIds={
                        league.leagueFormat === 'individual'
                          ? visiblePlayerEntries.map((entry) => entry.playerId).filter(Boolean)
                          : []
                      }
                      participantNames={
                        league.leagueFormat === 'individual'
                          ? visiblePlayerEntries.map((entry) => entry.playerName)
                          : visibleTeamEntries.map((entry) => entry.teamName)
                      }
                    />
                    <QuickMessageComposer
                      mode="support"
                      triggerLabel="Ask support"
                      category="league"
                      subject={`Question about ${league.leagueName}`}
                      body={[
                        `League: ${league.leagueName}`,
                        league.flight ? `Flight: ${league.flight}` : '',
                        '',
                        'What I need help with:',
                      ].filter(Boolean).join('\n')}
                      entityType="tiq_league"
                      entityId={league.id}
                    />
                  </div>
                </div>
              </div>

              {storageWarning ? <div style={statusBanner}>{storageWarning}</div> : null}
            </section>

            <section id="league-overview" style={leagueHubPanelStyle}>
              <div style={leagueHubHeaderStyle}>
                <div>
                  <div style={sectionEyebrow}>Season pulse</div>
                  <h2 style={sectionTitle}>Check the table. See what changed. Know what to play next.</h2>
                  <p style={sectionText}>
                    This page should feel like the league scoreboard first. Admin tools stay nearby, but results,
                    standings, schedule, and the next useful tennis move lead the experience.
                  </p>
                </div>
                <div style={leagueHubScoreStyle}>
                  <strong>{leaderName || activeEntryCount}</strong>
                  <span>{leaderName ? 'currently first' : `active ${league.leagueFormat === 'team' ? 'teams' : 'players'}`}</span>
                </div>
              </div>

              <nav style={hubNavStyle} aria-label="TIQ league hub sections">
                {hubNavItems.map((item) => (
                  <a key={item.href} href={item.href} style={hubNavItemStyle}>
                    <span>{item.label}</span>
                    <small>{item.detail}</small>
                  </a>
                ))}
              </nav>

              <div style={seasonPulseGridStyle}>
                <div style={seasonPulseWideCardStyle}>
                  <div style={seasonPulseCardHeaderStyle}>
                    <span style={pillGreen}>Leaders</span>
                    <GhostLink href="#league-standings">Full table</GhostLink>
                  </div>
                  {leaderRows.length > 0 ? (
                    <div style={leaderTableStyle}>
                      {leaderRows.map((row) => (
                        <div key={`pulse-${row.rank}-${row.name}`} style={leaderRowStyle}>
                          <span style={row.rank === 1 ? leaderRankAccentStyle : leaderRankMiniStyle}>
                            {row.rank}
                          </span>
                          <div style={leaderNameCellStyle}>
                            <strong>{row.name}</strong>
                            <span>{row.detail}</span>
                          </div>
                          <span style={leaderRecordStyle}>{row.record}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Log the first result to start the standings race.</p>
                  )}
                </div>
                <div style={seasonPulseCardStyle}>
                  <span style={pillBlue}>Latest</span>
                  <strong>
                    {league.leagueFormat === 'individual'
                      ? individualResultBookStats.latestResult?.winnerPlayerName || 'No result yet'
                      : teamMatchEvents[0]?.winnerTeamName || teamMatchEvents[0]?.teamAName || 'No team event yet'}
                  </strong>
                  <p>
                    {league.leagueFormat === 'individual' && individualResultBookStats.latestResult
                      ? `def. ${resultOpponentName(individualResultBookStats.latestResult)}`
                      : league.leagueFormat === 'team' && teamMatchEvents[0]
                        ? `${teamMatchEvents.length} team events logged.`
                        : 'Results will become the heartbeat of the league.'}
                  </p>
                </div>
                <div style={seasonPulseWideCardStyle}>
                  <div style={seasonPulseCardHeaderStyle}>
                    <span style={pillSlate}>Upcoming matches</span>
                    <GhostLink href="#league-schedule">Schedule</GhostLink>
                  </div>
                  {upcomingScheduleItems.length > 0 ? (
                    <div style={upcomingMatchListStyle}>
                      {upcomingScheduleItems.map((item) => (
                        <div key={`upcoming-${item.id}`} style={upcomingMatchRowStyle}>
                          <div>
                            <strong>{item.participantAName} vs {item.participantBName}</strong>
                            <span>
                              {[item.scheduledDate, item.scheduledTime, item.facility || league.defaultFacility]
                                .filter(Boolean)
                                .join(' | ') || 'Time and site TBD'}
                            </span>
                          </div>
                          <span style={item.status === 'proposed' ? pillAmber : pillGreen}>
                            {item.status === 'coordinator_set' ? 'Published' : item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>
                      {league.schedulingMode === 'coordinator_fixed'
                        ? 'The coordinator has not published match times yet.'
                        : 'Players can propose times here; confirmed matches will appear at the top.'}
                    </p>
                  )}
                </div>
                {!access.canUseAdvancedPlayerInsights ? (
                  <div style={seasonPulseUpgradeStyle}>
                    <span style={pillAmber}>Player unlock</span>
                    <strong>Want to climb from here?</strong>
                    <p>Player adds My Lab, follows, and matchup insight so this table turns into better match prep.</p>
                    <GhostLink href="/pricing#player_plus">Unlock Player</GhostLink>
                  </div>
                ) : null}
              </div>
            </section>

            <section style={formatCallout}>
              <div style={formatCalloutTitle}>
                Scoring: {getTiqLeagueScoringSystemLabel(league.scoringSystem)}
              </div>
              <div style={formatCalloutText}>{scoringRulesText}</div>
            </section>

            <section id="league-schedule" style={schedulePanelStyle}>
              <div style={leagueHubHeaderStyle}>
                <div>
                  <div style={sectionEyebrow}>Schedule</div>
                  <h2 style={sectionTitle}>
                    {league.schedulingMode === 'coordinator_fixed'
                      ? 'Coordinator-set schedule'
                      : 'Player-arranged schedule'}
                  </h2>
                  <p style={sectionText}>{scheduleRulesText}</p>
                </div>
                <span style={pillSlate}>{seasonWindowText}</span>
              </div>

              <div style={scheduleMetaGridStyle}>
                <div style={scheduleMetaCardStyle}>
                  <span>Default day</span>
                  <strong>{league.defaultMatchDay || 'TBD'}</strong>
                </div>
                <div style={scheduleMetaCardStyle}>
                  <span>Default time</span>
                  <strong>{league.defaultMatchTime || 'TBD'}</strong>
                </div>
                <div style={scheduleMetaCardStyle}>
                  <span>Default site</span>
                  <strong>{league.defaultFacility || 'TBD'}</strong>
                </div>
                <div style={scheduleMetaCardStyle}>
                  <span>Time zone</span>
                  <strong>{league.scheduleTimeZone || 'America/Chicago'}</strong>
                </div>
              </div>

              <div style={scheduleActionPanelStyle}>
                <div style={leagueHubHeaderStyle}>
                  <div>
                    <div style={formatCalloutTitle}>
                      {league.schedulingMode === 'coordinator_fixed' && access.canUseLeagueTools
                        ? 'Publish a match slot'
                        : 'Propose a match time'}
                    </div>
                    <div style={formatCalloutText}>
                      {league.schedulingMode === 'coordinator_fixed'
                        ? 'Coordinator-set leagues can publish dates, times, and sites so the season schedule is visible before match week.'
                        : 'Player-arranged leagues let members propose the date, time, and site through TenAceIQ before the result is recorded.'}
                    </div>
                  </div>
                  <span style={scheduleSource === 'supabase' ? pillGreen : pillSlate}>
                    {scheduleSource === 'supabase' ? 'Live schedule' : 'Local schedule'}
                  </span>
                </div>

                <div style={dynamicResultFormGrid}>
                  <label style={fieldLabel}>
                    <span>{league.leagueFormat === 'team' ? 'Team A' : 'Player A'}</span>
                    <select
                      value={scheduleParticipantA}
                      onChange={(event) => setScheduleParticipantA(event.target.value)}
                      style={inputStyle}
                      disabled={scheduleSaving}
                    >
                      <option value="">Choose participant A</option>
                      {scheduleParticipantOptions.map((option) => (
                        <option key={`schedule-a-${option.value}`} value={option.value}>
                          {option.playerName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={fieldLabel}>
                    <span>{league.leagueFormat === 'team' ? 'Team B' : 'Player B'}</span>
                    <select
                      value={scheduleParticipantB}
                      onChange={(event) => setScheduleParticipantB(event.target.value)}
                      style={inputStyle}
                      disabled={scheduleSaving}
                    >
                      <option value="">Choose participant B</option>
                      {scheduleParticipantOptions.map((option) => (
                        <option key={`schedule-b-${option.value}`} value={option.value}>
                          {option.playerName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={fieldLabel}>
                    <span>Date</span>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(event) => setScheduleDate(event.target.value)}
                      style={inputStyle}
                      disabled={scheduleSaving}
                    />
                  </label>

                  <label style={fieldLabel}>
                    <span>Time</span>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(event) => setScheduleTime(event.target.value)}
                      style={inputStyle}
                      disabled={scheduleSaving}
                    />
                  </label>

                  <label style={{ ...fieldLabel, gridColumn: '1 / -1' }}>
                    <span>Site</span>
                    <input
                      value={scheduleFacility}
                      onChange={(event) => setScheduleFacility(event.target.value)}
                      placeholder={league.defaultFacility || 'Club, park, or court block'}
                      style={inputStyle}
                      disabled={scheduleSaving}
                    />
                  </label>

                  <label style={{ ...fieldLabel, gridColumn: '1 / -1' }}>
                    <span>Notes</span>
                    <textarea
                      value={scheduleNotes}
                      onChange={(event) => setScheduleNotes(event.target.value)}
                      placeholder="Court instructions, rain plan, contact notes, or make-up match context."
                      style={textareaStyle}
                      disabled={scheduleSaving}
                    />
                  </label>
                </div>

                {scheduleStatus ? <div style={statusBanner}>{scheduleStatus}</div> : null}

                <div style={actionRow}>
                  <button
                    type="button"
                    onClick={handleScheduleSubmit}
                    disabled={scheduleSaving || !userId || scheduleParticipantOptions.length < 2}
                    style={{
                      ...primaryButton,
                      ...(scheduleSaving || !userId || scheduleParticipantOptions.length < 2 ? disabledButton : {}),
                    }}
                  >
                    {scheduleSaving
                      ? 'Saving schedule...'
                      : league.schedulingMode === 'coordinator_fixed' && access.canUseLeagueTools
                        ? 'Publish Match Slot'
                        : 'Propose Match Time'}
                  </button>
                  {scheduleParticipantAOption && scheduleParticipantBOption ? (
                    <ScheduleMessageComposer
                      mode="tiq-league-match"
                      triggerLabel="Schedule in Messages"
                      leagueId={league.id}
                      leagueName={league.leagueName}
                      leagueFormat={league.leagueFormat}
                      participantAName={scheduleParticipantAOption.playerName}
                      participantAId={scheduleParticipantAOption.playerId}
                      participantBName={scheduleParticipantBOption.playerName}
                      participantBId={scheduleParticipantBOption.playerId}
                      defaultDate={scheduleDate}
                      defaultTime={scheduleTime || league.defaultMatchTime}
                      defaultFacility={scheduleFacility || league.defaultFacility}
                      participantNames={[scheduleParticipantAOption.playerName, scheduleParticipantBOption.playerName]}
                      participantPlayerIds={[scheduleParticipantAOption.playerId, scheduleParticipantBOption.playerId].filter(Boolean)}
                    />
                  ) : null}
                  <span style={metaPill}>
                    {confirmedScheduleItemCount} confirmed | {pendingScheduleItemCount} proposed | {completedScheduleItemCount} done
                  </span>
                </div>
              </div>

              {visibleScheduleItems.length > 0 ? (
                <div style={schedulePublishedPanelStyle}>
                  <div style={scheduleViewHeaderStyle}>
                    <div>
                      <div style={formatCalloutTitle}>Published season schedule</div>
                      <div style={formatCalloutText}>
                        Calendar view groups matches by date. List view is faster for status review and result entry.
                      </div>
                    </div>
                    <div style={scheduleViewToggleStyle} aria-label="Schedule view">
                      {(['calendar', 'list'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setScheduleDisplayMode(mode)}
                          style={scheduleDisplayMode === mode ? scheduleViewToggleActiveStyle : scheduleViewToggleButtonStyle}
                        >
                          {mode === 'calendar' ? 'Calendar' : 'List'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {scheduleDisplayMode === 'calendar' ? (
                    <div style={scheduleCalendarGridStyle}>
                      {scheduleCalendarDays.map((day) => (
                        <div key={day.date} style={scheduleCalendarDayStyle}>
                          <div style={scheduleCalendarDateStyle}>
                            <span>{day.dayLabel}</span>
                            <strong>{day.label}</strong>
                          </div>
                          <div style={scheduleCalendarItemGridStyle}>
                            {day.items.map((item) => renderScheduleItemRow(item, 'calendar'))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={scheduleListStyle}>
                      {visibleScheduleItems.map((item) => renderScheduleItemRow(item))}
                    </div>
                  )}
                </div>
              ) : league.leagueFormat === 'team' ? (
                scheduledTeamEvents.length === 0 ? (
                  <div style={emptyCard}>
                    No match dates are published yet. Once the coordinator adds team match events, members can see
                    who plays, when, where, and which scores are still missing.
                  </div>
                ) : (
                  <div style={scheduleListStyle}>
                    {scheduledTeamEvents.slice(0, 5).map((event) => (
                      <div key={event.id} style={scheduleRowStyle}>
                        <div>
                          <div style={listTitle}>{event.teamAName} vs {event.teamBName}</div>
                          <div style={listMeta}>
                            {[formatDateTime(event.matchDate), event.facility || league.defaultFacility]
                              .filter(Boolean)
                              .join(' | ')}
                          </div>
                        </div>
                        <span style={nextTeamEvent?.id === event.id ? pillGreen : metaPill}>
                          {nextTeamEvent?.id === event.id ? 'Next up' : 'Scheduled'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : competitionOpportunities.length === 0 ? (
                <div style={emptyCard}>
                  Add approved players and results to unlock player-arranged match prompts for this individual season.
                </div>
              ) : (
                <div style={scheduleListStyle}>
                  {competitionOpportunities.slice(0, 5).map((item) => (
                    <div key={item.key} style={scheduleRowStyle}>
                      <div>
                        <div style={listTitle}>{item.title}</div>
                        <div style={listMeta}>{item.body}</div>
                      </div>
                      {item.secondaryHref ? <GhostLink href={item.secondaryHref}>Log result</GhostLink> : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div style={dynamicContentGrid}>
              <section id="league-requests" style={dynamicPanelCard}>
                <div style={sectionEyebrow}>Entry workflow</div>
                <h2 style={sectionTitle}>
                  {league.leagueFormat === 'team'
                    ? 'Request team entry'
                    : 'Request to join'}
                </h2>
                <p style={sectionText}>
                  {league.leagueFormat === 'team'
                    ? 'Submit your team for coordinator approval. Approved teams appear in participants, schedules, results, and standings.'
                    : `Submit your player entry for coordinator approval. ${getTiqIndividualCompetitionFormatDescription(league.individualCompetitionFormat)}`}
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
                    <GhostLink href="/league-coordinator">Manage TIQ Seasons</GhostLink>
                  ) : null}
                </div>
              </section>

              <section id="league-participants" style={dynamicPanelCard}>
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
                <div style={participantStatusGridStyle}>
                  <span style={pillGreen}>{activeEntryCount} active</span>
                  <span style={pendingEntryCount > 0 ? pillAmber : pillSlate}>{pendingEntryCount} pending</span>
                  <span style={rejectedEntryCount > 0 ? pillSlate : pillGreen}>{rejectedEntryCount} declined</span>
                </div>
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

                {pendingEntries.length > 0 ? (
                  <div style={requestPreviewStyle}>
                    <div style={formatCalloutTitle}>Waiting for coordinator approval</div>
                    <div style={requestPreviewGridStyle}>
                      {pendingEntries.slice(0, 4).map((entry) => {
                        const entryName = 'teamName' in entry ? entry.teamName : entry.playerName
                        const detail =
                          'teamName' in entry
                            ? [entry.sourceLeagueName, entry.sourceFlight].filter(Boolean).join(' | ')
                            : entry.playerLocation

                        return (
                          <div key={`${entry.leagueId}-${entryName}`} style={requestPreviewCardStyle}>
                            <strong>{entryName}</strong>
                            <span>{detail || 'Request submitted'}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            </div>

            {league.leagueFormat === 'individual' ? (
              <section id="league-standings" style={dynamicPanelCard}>
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
                                    league.scoringSystem === 'dynamic_points' ? `${entry.leaguePoints} points` : null,
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
                                {league.scoringSystem === 'dynamic_points' ? (
                                  <div style={standingMetric}>
                                    <span style={standingMetricLabel}>Points</span>
                                    <span style={standingMetricValueAccent}>{entry.leaguePoints}</span>
                                  </div>
                                ) : null}
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
                                  <GhostLink href="/mylab">My Lab</GhostLink>
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
              <section id="league-individual-results" style={dynamicPanelCard}>
                <div style={sectionEyebrow}>Result book</div>
                <h2 style={sectionTitle}>Current player-result status.</h2>
                <p style={sectionText}>
                  Check the logged result volume, recent activity, pair coverage, and corrections before sharing
                  the table or opening Coordinator for updates.
                </p>

                <div style={resultCuePanelStyle}>
                  <div>
                    <div style={resultCueKickerStyle}>Result entry readiness</div>
                    <div style={resultCueTitleStyle}>{individualResultCue.title}</div>
                    <div style={resultCueTextStyle}>{individualResultCue.detail}</div>
                    <div style={resultCueActionRowStyle}>
                      <GhostLink href={individualCuePrimaryHref}>
                        {competitionOpportunities[0]?.secondaryHref ? 'Log next result' : 'Open Player Results'}
                      </GhostLink>
                      <GhostLink href={`/league-coordinator?leagueId=${encodeURIComponent(league.id)}#league-setup-form`}>
                        Manage league
                      </GhostLink>
                    </div>
                  </div>
                  <div style={resultCueGridStyle}>
                    {individualResultCue.items.map((item) => (
                      <div
                        key={item.label}
                        style={item.complete ? resultCueItemCompleteStyle : resultCueItemStyle}
                      >
                        <span style={item.complete ? pillGreen : metaPill}>{item.complete ? 'Ready' : 'Next'}</span>
                        <div>
                          <div style={resultCueItemLabelStyle}>{item.label}</div>
                          <div style={resultCueItemTextStyle}>{item.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={resultBookGrid}>
                  <div style={resultBookTile}>
                    <div style={resultBookLabel}>Logged results</div>
                    <div style={resultBookValue}>{individualResultBookStats.total}</div>
                    <div style={resultBookText}>
                      {individualResultBookStats.recentCount} in the last 14 days
                    </div>
                  </div>
                  <div style={resultBookTile}>
                    <div style={resultBookLabel}>Pair coverage</div>
                    <div style={resultBookValue}>
                      {individualResultBookStats.coverageRate !== null
                        ? `${Math.round(individualResultBookStats.coverageRate * 100)}%`
                        : '-'}
                    </div>
                    <div style={resultBookText}>
                      {individualResultBookStats.uniquePairCount}/{individualResultBookStats.possiblePairs} pairings logged
                    </div>
                  </div>
                  <div style={resultBookTile}>
                    <div style={resultBookLabel}>Corrections</div>
                    <div style={resultBookValue}>{individualResultBookStats.correctionCount}</div>
                    <div style={resultBookText}>
                      {individualResultBookStats.correctionCount === 1 ? 'Edited result' : 'Edited results'}
                    </div>
                  </div>
                  <div style={resultBookTile}>
                    <div style={resultBookLabel}>Latest result</div>
                    <div style={{ ...resultBookValue, fontSize: '20px' }}>
                      {individualResultBookStats.latestResult
                        ? individualResultBookStats.latestResult.winnerPlayerName
                        : '-'}
                    </div>
                    <div style={resultBookText}>
                      {individualResultBookStats.latestResult
                        ? `def. ${resultOpponentName(individualResultBookStats.latestResult)}`
                        : 'No result logged yet'}
                    </div>
                  </div>
                </div>

                <div style={standingActionRow}>
                  <GhostLink href={`/league-coordinator/individual-results?leagueId=${encodeURIComponent(league.id)}`}>
                    Open Player Results
                  </GhostLink>
                  {individualResultBookStats.latestResult?.winnerPlayerId ? (
                    <GhostLink href={`/players/${encodeURIComponent(individualResultBookStats.latestResult.winnerPlayerId)}`}>
                      Latest Winner
                    </GhostLink>
                  ) : null}
                </div>
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
                {!canLogIndividualResults ? (
                  <UpgradePrompt
                    planId="league"
                    compact
                    headline="Coordinator access records player results"
                    body={access.individualLeagueMessage}
                    ctaLabel="Run Your League on TIQ"
                    ctaHref="/pricing"
                    secondaryLabel="Open Player Results"
                    secondaryHref={`/league-coordinator/individual-results?leagueId=${encodeURIComponent(league.id)}`}
                    footnote="Players can still read standings, results, and prompts from this page."
                  />
                ) : null}

                <div style={dynamicResultFormGrid}>
                  <label style={fieldLabel}>
                    <span>Player A</span>
                    <select
                      value={resultPlayerA}
                      onChange={(event) => setResultPlayerA(event.target.value)}
                      style={inputStyle}
                      disabled={resultEntryDisabled}
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
                      disabled={resultEntryDisabled}
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
                      disabled={resultEntryDisabled}
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
                      disabled={resultEntryDisabled}
                    />
                    <small style={scoreHelpStyle}>
                      Use completed sets only: 6-4, 7-6, or a deciding 10-point tiebreak like 10-8.
                    </small>
                  </label>

                  <label style={fieldLabel}>
                    <span>Result date</span>
                    <input
                      type="date"
                      value={resultDate}
                      onChange={(event) => setResultDate(event.target.value)}
                      style={inputStyle}
                      disabled={resultEntryDisabled}
                    />
                  </label>

                  <label style={{ ...fieldLabel, gridColumn: '1 / -1' }}>
                    <span>Notes</span>
                    <textarea
                      value={resultNotes}
                      onChange={(event) => setResultNotes(event.target.value)}
                      placeholder={individualFormatExperience.notesPlaceholder}
                      style={textareaStyle}
                      disabled={resultEntryDisabled}
                    />
                  </label>
                </div>

                {resultStatus ? <div style={statusBanner}>{resultStatus}</div> : null}

                <div style={actionRow}>
                  <button
                    type="button"
                    onClick={handleResultSubmit}
                    disabled={resultEntryDisabled}
                    style={{
                      ...primaryButton,
                      ...(resultEntryDisabled ? disabledButton : {}),
                    }}
                  >
                    {resultSaving
                      ? 'Saving result...'
                      : canLogIndividualResults
                        ? individualFormatExperience.actionLabel
                        : 'Coordinator Required'}
                  </button>
                  <span style={metaPill}>
                    {canLogIndividualResults
                      ? resultStorageSource === 'supabase'
                        ? 'Live results'
                        : 'Saved preview results'
                      : 'Read-only results'}
                  </span>
                </div>

                {individualResults.length === 0 ? (
                  <div style={emptyCard}>{individualFormatExperience.emptyResults}</div>
                ) : (
                  <div style={listWrap}>
                    {individualResults.map((result) => {
                      const opponentName = resultOpponentName(result)
                      const opponentId = result.winnerPlayerId === result.playerAId ? result.playerBId : result.playerAId
                      const resultMessageSubject = `${result.winnerPlayerName} vs ${opponentName}`
                      const resultMessageBody = [
                        `Hi ${opponentName},`,
                        '',
                        `Following up on our ${league.leagueName} result${result.resultDate ? ` from ${formatDateTime(result.resultDate)}` : ''}.`,
                      ].join('\n')
                      const resultSupportBody = [
                        `League: ${league.leagueName}`,
                        `Result: ${result.winnerPlayerName} def. ${opponentName}`,
                        result.score ? `Score: ${result.score}` : '',
                        result.resultDate ? `Date: ${result.resultDate}` : '',
                        '',
                        'What I need help with:',
                      ].filter(Boolean).join('\n')
                      return (
                      <div key={result.id} style={dynamicListCard}>
                        <div>
                          <div style={listTitle}>
                            {result.winnerPlayerName} def.{' '}
                            {opponentName}
                          </div>
                          <div style={listMeta}>
                            {[result.score, formatDateTime(result.resultDate), result.notes].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <div style={dynamicResultMetaStack}>
                          {isEditedIndividualResult(result) ? (
                            <span style={pillAmber}>Edited</span>
                          ) : null}
                          <span style={metaPill}>
                            {result.score || individualFormatExperience.actionLabel}
                          </span>
                          <QuickMessageComposer
                            mode="direct"
                            triggerLabel="Message opponent"
                            recipientName={opponentName}
                            recipientPlayerId={opponentId}
                            subject={resultMessageSubject}
                            body={resultMessageBody}
                            entityType="tiq_individual_result"
                            entityId={result.id}
                          />
                          <QuickMessageComposer
                            mode="support"
                            triggerLabel="Ask support"
                            category="result"
                            subject={`Question about ${league.leagueName} result`}
                            body={resultSupportBody}
                            entityType="tiq_individual_result"
                            entityId={result.id}
                          />
                          {result.winnerPlayerId ? (
                            <GhostLink href={`/players/${encodeURIComponent(result.winnerPlayerId)}`}>Winner</GhostLink>
                          ) : null}
                        </div>
                      </div>
                      )
                    })}
                  </div>
                )}
              </section>
            ) : null}

            {league.leagueFormat === 'team' ? (
              <section id="league-standings" style={panelCard}>
                <div style={sectionEyebrow}>Standings</div>
                <h2 style={sectionTitle}>Team records for this league.</h2>
                <p style={sectionText}>
                  {league.scoringSystem === 'dynamic_points'
                    ? 'Teams are ranked by dynamic points earned from each completed line.'
                    : 'Event wins are determined by line majority. Line wins are the tiebreaker.'}
                </p>

                {teamStandings.length === 0 ? (
                  <div style={emptyCard}>
                    Standings will appear after the first team match result is entered and reviewed.
                  </div>
                ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr>
                        {[
                          '#',
                          'Team',
                          ...(league.scoringSystem === 'dynamic_points' ? ['Pts'] : []),
                          'W',
                          'L',
                          'T',
                          'Line W',
                          'Line L',
                          'Line %',
                        ].map((h) => (
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
                            {league.scoringSystem === 'dynamic_points' ? (
                              <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800, color: '#9be11d' }}>{row.points}</td>
                            ) : null}
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#9be11d' }}>{row.wins}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>{row.losses}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#64748b' }}>{row.ties}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#93c5fd' }}>{row.lineWins}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>{row.lineLosses}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: linePct !== null && linePct >= 50 ? '#9be11d' : '#94a3b8' }}>
                              {linePct !== null ? `${linePct}%` : '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </section>
            ) : null}

            {league.leagueFormat === 'team' ? (
              <section id="league-team-results" style={panelCard}>
                <div style={sectionEyebrow}>Match Results</div>
                <h2 style={sectionTitle}>Team match events and line-by-line results.</h2>
                <p style={sectionText}>
                  Results are entered by coordinators or admins and feed the TIQ rating engine automatically.
                  Expand an event to see individual line scores.
                </p>

                <div style={resultCuePanelStyle}>
                  <div>
                    <div style={resultCueKickerStyle}>Result entry readiness</div>
                    <div style={resultCueTitleStyle}>{teamResultCue.title}</div>
                    <div style={resultCueTextStyle}>{teamResultCue.detail}</div>
                    <div style={resultCueActionRowStyle}>
                      <GhostLink href={teamCuePrimaryHref}>
                        {teamMatchEvents.length > 0 ? 'Review team results' : 'Create match'}
                      </GhostLink>
                      <GhostLink href={`/league-coordinator?leagueId=${encodeURIComponent(league.id)}#league-setup-form`}>
                        Manage league
                      </GhostLink>
                    </div>
                  </div>
                  <div style={resultCueGridStyle}>
                    {teamResultCue.items.map((item) => (
                      <div
                        key={item.label}
                        style={item.complete ? resultCueItemCompleteStyle : resultCueItemStyle}
                      >
                        <span style={item.complete ? pillGreen : metaPill}>{item.complete ? 'Ready' : 'Next'}</span>
                        <div>
                          <div style={resultCueItemLabelStyle}>{item.label}</div>
                          <div style={resultCueItemTextStyle}>{item.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

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
                      const publicSummary = buildTeamMatchPublicSummary(lines, league.scoringSystem)

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
                                {linesLoaded && publicSummary.total > 0 && (
                                  <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={metaPill}>{publicSummary.completed}/{publicSummary.total} lines complete</span>
                                    <span style={teamAWins > teamBWins ? pillGreen : metaPill}>{event.teamAName}: {publicSummary.teamAWins}</span>
                                    <span style={teamBWins > teamAWins ? pillGreen : metaPill}>{event.teamBName}: {publicSummary.teamBWins}</span>
                                    {publicSummary.pending > 0 ? <span style={metaPill}>{publicSummary.pending} pending</span> : null}
                                    {league.scoringSystem === 'dynamic_points' ? (
                                      <>
                                        <span style={publicSummary.teamAPoints > publicSummary.teamBPoints ? pillGreen : metaPill}>
                                          {event.teamAName} pts: {publicSummary.teamAPoints}
                                        </span>
                                        <span style={publicSummary.teamBPoints > publicSummary.teamAPoints ? pillGreen : metaPill}>
                                          {event.teamBName} pts: {publicSummary.teamBPoints}
                                        </span>
                                        {publicSummary.scoreReviewCount > 0 ? <span style={pillAmber}>{publicSummary.scoreReviewCount} score review</span> : null}
                                      </>
                                    ) : null}
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

            <section id="league-settings" style={panelCard}>
              <div style={sectionEyebrow}>Coordinator context</div>
              <h2 style={sectionTitle}>Use TIQ league context without losing the command center.</h2>
              <p style={sectionText}>
                Team leagues hand off into result entry and weekly captain tools. Individual leagues keep the
                organizer loop focused on entry, standings, prompts, and player results.
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
                  Individual TIQ leagues stay in the Coordinator lane: participants, standings, prompts,
                  and player results without weekly captain workflow.
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </SiteShell>
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

const pillAmber: CSSProperties = {
  ...pillBase,
  minHeight: '30px',
  background: 'rgba(251,191,36,0.14)',
  color: '#fde68a',
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

const leaguePhotoWrap: CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 9',
  overflow: 'hidden',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(255,255,255,0.05)',
}

const leaguePhoto: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block',
  objectFit: 'cover',
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

const leaderTableStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
}

const leaderRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '34px minmax(0, 1fr) auto',
  gap: '10px',
  alignItems: 'center',
  padding: '10px',
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(7,17,33,0.48)',
  color: '#f8fbff',
}

const leaderRankMiniStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 34,
  height: 34,
  borderRadius: '999px',
  background: 'rgba(142,161,189,0.18)',
  color: '#e7eefb',
  fontWeight: 900,
  fontSize: '13px',
}

const leaderRankAccentStyle: CSSProperties = {
  ...leaderRankMiniStyle,
  background: '#9be11d',
  color: '#06121a',
}

const leaderNameCellStyle: CSSProperties = {
  display: 'grid',
  gap: '2px',
  minWidth: 0,
}

const leaderRecordStyle: CSSProperties = {
  color: '#dffad5',
  fontWeight: 950,
  fontSize: '14px',
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

const leagueHubPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '18px',
  padding: '24px',
  borderRadius: '26px',
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(15,34,62,0.94), rgba(17,42,39,0.86))',
  boxShadow: '0 22px 48px rgba(2,10,24,0.24)',
}

const leagueHubHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  flexWrap: 'wrap',
}

const leagueHubScoreStyle: CSSProperties = {
  minWidth: '156px',
  display: 'grid',
  gap: '2px',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(155,225,29,0.2)',
  background: 'rgba(155,225,29,0.08)',
  color: '#e7ffd1',
  textAlign: 'right',
}

const hubNavStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
  gap: '10px',
}

const hubNavItemStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  minHeight: '68px',
  padding: '12px 14px',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e7eefb',
  textDecoration: 'none',
  fontWeight: 900,
}

const seasonPulseGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
}

const seasonPulseCardStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(7,17,34,0.52)',
  color: '#dbeafe',
}

const seasonPulseWideCardStyle: CSSProperties = {
  ...seasonPulseCardStyle,
  gridColumn: '1 / -1',
}

const seasonPulseCardHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  flexWrap: 'wrap',
}

const seasonPulseUpgradeStyle: CSSProperties = {
  ...seasonPulseCardStyle,
  border: '1px solid rgba(251,191,36,0.18)',
  background: 'linear-gradient(135deg, rgba(251,191,36,0.10), rgba(7,17,34,0.56))',
}

const upcomingMatchListStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
}

const upcomingMatchRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: '10px',
  alignItems: 'center',
  padding: '10px',
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
}

const schedulePanelStyle: CSSProperties = {
  display: 'grid',
  gap: '16px',
  padding: '24px',
  borderRadius: '26px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(14,31,57,0.90), rgba(8,18,35,0.94))',
}

const scheduleMetaGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '10px',
}

const scheduleMetaCardStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  padding: '14px',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: '#dbeafe',
}

const scheduleActionPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '16px',
  borderRadius: '20px',
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(155,225,29,0.06)',
}

const scheduleListStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const schedulePublishedPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
}

const scheduleViewHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '14px',
  flexWrap: 'wrap',
}

const scheduleViewToggleStyle: CSSProperties = {
  display: 'inline-flex',
  gap: '6px',
  padding: '5px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(7,17,33,0.56)',
}

const scheduleViewToggleButtonStyle: CSSProperties = {
  minHeight: '34px',
  padding: '0 12px',
  borderRadius: '999px',
  border: 'none',
  background: 'transparent',
  color: 'rgba(229,238,251,0.74)',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 900,
}

const scheduleViewToggleActiveStyle: CSSProperties = {
  ...scheduleViewToggleButtonStyle,
  background: 'linear-gradient(135deg, rgba(155,225,29,0.22), rgba(74,163,255,0.14))',
  color: '#f8fbff',
}

const scheduleCalendarGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
  gap: '12px',
}

const scheduleCalendarDayStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  alignContent: 'start',
  minHeight: '190px',
  padding: '14px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
}

const scheduleCalendarDateStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '10px',
  color: 'rgba(229,238,251,0.70)',
  fontSize: '12px',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const scheduleCalendarItemGridStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
}

const scheduleCalendarItemStyle: CSSProperties = {
  display: 'grid',
  gap: '9px',
  padding: '12px',
  borderRadius: '14px',
  border: '1px solid rgba(155,225,29,0.12)',
  background: 'rgba(7,17,33,0.48)',
}

const scheduleCalendarItemTitleStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '14px',
  lineHeight: 1.25,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const scheduleCalendarActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  flexWrap: 'wrap',
}

const scheduleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '14px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
}

const scheduleRowActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '8px',
  flexWrap: 'wrap',
}

const participantStatusGridStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '12px',
}

const requestPreviewStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  marginTop: '14px',
  padding: '14px',
  borderRadius: '18px',
  border: '1px solid rgba(251,191,36,0.14)',
  background: 'rgba(251,191,36,0.06)',
}

const requestPreviewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '10px',
}

const requestPreviewCardStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  padding: '12px',
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(8,18,35,0.6)',
  color: '#e7eefb',
}

const resultBookGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: '12px',
}

const resultCuePanelStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '14px',
  alignItems: 'start',
  padding: '16px',
  borderRadius: '16px',
  border: '1px solid rgba(155,225,29,0.20)',
  background: 'rgba(8,18,35,0.50)',
}

const resultCueKickerStyle: CSSProperties = {
  color: '#9be11d',
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const resultCueTitleStyle: CSSProperties = {
  marginTop: '6px',
  color: '#f8fbff',
  fontSize: '18px',
  lineHeight: 1.25,
  fontWeight: 850,
}

const resultCueTextStyle: CSSProperties = {
  marginTop: '6px',
  color: 'rgba(214,228,246,0.74)',
  fontSize: '13px',
  lineHeight: 1.5,
}

const resultCueActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginTop: '12px',
}

const resultCueGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '8px',
}

const resultCueItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: '10px',
  alignItems: 'start',
  padding: '10px',
  borderRadius: '12px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.035)',
}

const resultCueItemCompleteStyle: CSSProperties = {
  ...resultCueItemStyle,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.06)',
}

const resultCueItemLabelStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '13px',
  lineHeight: 1.25,
  fontWeight: 850,
}

const resultCueItemTextStyle: CSSProperties = {
  marginTop: '3px',
  color: 'rgba(214,228,246,0.68)',
  fontSize: '12px',
  lineHeight: 1.35,
}

const resultBookTile: CSSProperties = {
  display: 'grid',
  gap: '6px',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
}

const resultBookLabel: CSSProperties = {
  color: '#93c5fd',
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const resultBookValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.05,
  fontWeight: 900,
}

const resultBookText: CSSProperties = {
  color: 'rgba(214,228,246,0.72)',
  fontSize: '13px',
  lineHeight: 1.5,
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

const scoreHelpStyle: CSSProperties = {
  color: 'rgba(214,228,246,0.66)',
  fontSize: '12px',
  lineHeight: 1.45,
  fontWeight: 650,
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
