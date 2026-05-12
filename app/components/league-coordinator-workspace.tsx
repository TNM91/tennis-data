'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import CoordinatorSubnav from '@/app/components/coordinator-subnav'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import SiteShell from '@/app/components/site-shell'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { getClientAuthState } from '@/lib/auth'
import { DATA_ASSIST_STORY, LEAGUE_COORDINATOR_STORY } from '@/lib/product-story'
import { getLeagueFormatLabel } from '@/lib/competition-layers'
import {
  getTiqIndividualCompetitionFormatDescription,
  getTiqIndividualCompetitionFormatLabel,
  TIQ_INDIVIDUAL_COMPETITION_FORMATS,
} from '@/lib/tiq-individual-format'
import {
  listTiqIndividualLeagueResults,
  type TiqIndividualLeagueResultRecord,
  type TiqLeagueStorageSource as TiqResultStorageSource,
} from '@/lib/tiq-individual-results-service'
import { buildTiqIndividualLeagueSummaries } from '@/lib/tiq-individual-results-summary'
import { uploadTiqLeaguePhoto } from '@/lib/tiq-league-photo-service'
import {
  computeTiqTeamLeagueStandings,
  listTiqTeamMatchEvents,
  listTiqTeamMatchLinesForEvents,
  type TiqTeamMatchEventRecord,
  type TiqTeamMatchLineRecord,
  type TiqTeamStandingRow,
} from '@/lib/tiq-team-results-service'
import {
  buildLeagueCardsFromRegistry,
  getTiqLeagueScoringSystemDescription,
  getTiqLeagueScoringSystemLabel,
  getTiqLeagueSchedulingModeDescription,
  getTiqLeagueSchedulingModeLabel,
  getTiqLeagueThirdSetRuleDescription,
  getTiqLeagueThirdSetRuleLabel,
  getTiqLeagueVisibilityDescription,
  getTiqLeagueVisibilityLabel,
  parseRegistryListInput,
  type TiqLeagueDraft,
  type TiqLeagueRecord,
} from '@/lib/tiq-league-registry'
import {
  calculateTiqLeagueEndsOn,
  DEFAULT_TIQ_LEAGUE_MAX_MATCH_EVENTS,
  DEFAULT_TIQ_LEAGUE_MAX_WEEKS,
  getTiqLeagueParticipantCount,
  getTiqLeagueScheduleCapacitySummary,
  getTiqLeagueSeasonSummary,
  MAX_TIQ_INDIVIDUAL_LEAGUE_PLAYERS,
  MAX_TIQ_LEAGUE_MATCH_EVENTS,
  MAX_TIQ_LEAGUE_WEEKS,
  MAX_TIQ_TEAM_LEAGUE_TEAMS,
  normalizeTiqLeagueMaxMatchEvents,
  normalizeTiqLeagueMaxWeeks,
  validateTiqLeagueParticipantLimit,
  validateTiqLeagueScheduleCapacity,
  validateTiqLeagueSeasonWindow,
} from '@/lib/tiq-league-limits'
import { type UserRole } from '@/lib/roles'
import {
  listTiqLeagues,
  listTiqPlayerLeagueEntries,
  listTiqTeamLeagueEntries,
  removeTiqLeague,
  saveTiqLeague,
  updateTiqLeagueEntryStatus,
  type TiqPlayerLeagueEntryRecord,
  type TiqTeamLeagueEntryRecord,
  type TiqLeagueStorageSource,
} from '@/lib/tiq-league-service'
import { cleanText as safeText } from '@/lib/captain-formatters'
import { mergeSeasonLabelOptions, normalizeSeasonLabel } from '@/lib/season-labels'
import { formatDynamicPointsForSides } from '@/lib/tiq-scoring'
import { buildTiqLeagueSchedulingPlanRows, getTiqLeagueSchedulingHandoffSummary } from '@/lib/tiq-league-calendar'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const EMPTY_DRAFT: TiqLeagueDraft = {
  leagueFormat: 'team',
  individualCompetitionFormat: 'standard',
  scoringSystem: 'standard',
  thirdSetRule: 'either',
  leagueName: '',
  seasonLabel: '',
  seasonStatus: 'draft',
  startsOn: '',
  endsOn: '',
  maxWeeks: DEFAULT_TIQ_LEAGUE_MAX_WEEKS,
  maxMatchEvents: DEFAULT_TIQ_LEAGUE_MAX_MATCH_EVENTS,
  isPublic: true,
  schedulingMode: 'coordinator_fixed',
  defaultMatchDay: '',
  defaultMatchTime: '',
  scheduleTimeZone: 'America/Chicago',
  defaultFacility: '',
  schedulingNotes: '',
  flight: '',
  locationLabel: '',
  photoUrl: '',
  captainTeamName: '',
  notes: '',
  teams: [],
  players: [],
}

const MATCH_DAY_OPTIONS = [
  { value: '', label: 'Choose day' },
  { value: 'Monday', label: 'Monday' },
  { value: 'Tuesday', label: 'Tuesday' },
  { value: 'Wednesday', label: 'Wednesday' },
  { value: 'Thursday', label: 'Thursday' },
  { value: 'Friday', label: 'Friday' },
  { value: 'Saturday', label: 'Saturday' },
  { value: 'Sunday', label: 'Sunday' },
]

const TIME_ZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Phoenix', label: 'Arizona Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
]

const CUSTOM_SEASON_VALUE = '__custom_season__'

const FLIGHT_OPTIONS = ['2.5', '3.0', '3.5', '4.0', '4.5', '5.0', 'Open', 'Advanced', 'Intermediate', 'Beginner']

const COORDINATOR_OPERATING_FLOW = [
  {
    label: '1',
    title: 'Set structure',
    text: 'Choose format, dates, scoring, and season limits before anything goes public.',
  },
  {
    label: '2',
    title: 'Approve participants',
    text: 'Add teams or players, then keep join requests in coordinator review.',
  },
  {
    label: '3',
    title: 'Publish schedule',
    text: 'Use recurring day, time, and facility defaults to make the season visible.',
  },
  {
    label: '4',
    title: 'Review uploads and results',
    text: 'Use Data Assist for reviewed schedules, rosters, and scorecards before standings move.',
  },
]

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function buildTeamResultEntryHref(leagueId?: string) {
  return leagueId ? `/league-coordinator/results?leagueId=${encodeURIComponent(leagueId)}` : '/league-coordinator/results'
}

function buildIndividualResultEntryHref(leagueId?: string) {
  if (!leagueId) return '/league-coordinator/individual-results'

  const encodedLeagueId = encodeURIComponent(leagueId)
  return `/league-coordinator/individual-results?leagueId=${encodedLeagueId}`
}

function buildLeagueResultEntryHref(record: TiqLeagueRecord) {
  return record.leagueFormat === 'team'
    ? buildTeamResultEntryHref(record.id)
    : buildIndividualResultEntryHref(record.id)
}

function buildTiqLeaguePageHref(record: TiqLeagueRecord) {
  const encodedId = encodeURIComponent(record.id)
  return `/explore/leagues/tiq/${encodedId}?league_id=${encodedId}`
}

function buildLeagueSetupHref(record: TiqLeagueRecord) {
  const encodedId = encodeURIComponent(record.id)
  return `/league-coordinator?leagueId=${encodedId}#league-setup-form`
}

function getLeagueResultEntryLabel(record: TiqLeagueRecord) {
  return record.leagueFormat === 'team' ? 'Record team results' : 'Log player results'
}

function isRecentResult(value: string, days: number) {
  const parsed = value ? new Date(value).getTime() : 0
  if (!parsed) return false

  return parsed >= Date.now() - days * 24 * 60 * 60 * 1000
}

function isEditedResult(result: TiqIndividualLeagueResultRecord) {
  const createdTime = result.createdAt ? new Date(result.createdAt).getTime() : 0
  const updatedTime = result.updatedAt ? new Date(result.updatedAt).getTime() : 0
  if (!createdTime || !updatedTime) return false

  return updatedTime - createdTime > 1000
}

type TeamResultLineSummary = {
  total: number
  completed: number
}

type PublicPageReadinessFilter = 'all' | 'ready' | 'needs_work'

function buildTeamResultLineSummaryMap(
  events: TiqTeamMatchEventRecord[],
  lines: TiqTeamMatchLineRecord[],
) {
  const summaries = new Map<string, TeamResultLineSummary>()
  for (const event of events) {
    summaries.set(event.id, { total: 0, completed: 0 })
  }

  for (const line of lines) {
    const summary = summaries.get(line.eventId)
    if (!summary) continue

    summary.total += 1
    if (line.winnerSide) summary.completed += 1
  }

  return summaries
}

export function LeagueCoordinatorWorkspace({ activeRoute = '/league-coordinator' }: { activeRoute?: string }) {
  const searchParams = useSearchParams()
  const { isMobile } = useViewportBreakpoints()
  const requestedEditLeagueId = searchParams.get('leagueId') || searchParams.get('league_id') || ''
  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [records, setRecords] = useState<TiqLeagueRecord[]>([])
  const [draft, setDraft] = useState<TiqLeagueDraft>(EMPTY_DRAFT)
  const [teamListInput, setTeamListInput] = useState('')
  const [playerListInput, setPlayerListInput] = useState('')
  const [participantQuickAddInput, setParticipantQuickAddInput] = useState('')
  const [editingId, setEditingId] = useState('')
  const [setupOpen, setSetupOpen] = useState(false)
  const [appliedEditHandoffId, setAppliedEditHandoffId] = useState('')
  const [status, setStatus] = useState('')
  const [lastSavedRecord, setLastSavedRecord] = useState<TiqLeagueRecord | null>(null)
  const [photoUploadStatus, setPhotoUploadStatus] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [storageSource, setStorageSource] = useState<TiqLeagueStorageSource>('local')
  const [storageWarning, setStorageWarning] = useState('')
  const [individualResults, setIndividualResults] = useState<TiqIndividualLeagueResultRecord[]>([])
  const [resultStorageSource, setResultStorageSource] = useState<TiqResultStorageSource>('local')
  const [resultStorageWarning, setResultStorageWarning] = useState('')
  const [teamMatchEvents, setTeamMatchEvents] = useState<TiqTeamMatchEventRecord[]>([])
  const [teamMatchLines, setTeamMatchLines] = useState<TiqTeamMatchLineRecord[]>([])
  const [teamStandingsByLeague, setTeamStandingsByLeague] = useState<Record<string, TiqTeamStandingRow[]>>({})
  const [teamResultWarning, setTeamResultWarning] = useState('')
  const [teamEntryRequests, setTeamEntryRequests] = useState<TiqTeamLeagueEntryRecord[]>([])
  const [playerEntryRequests, setPlayerEntryRequests] = useState<TiqPlayerLeagueEntryRecord[]>([])
  const [entryRequestStatus, setEntryRequestStatus] = useState('')
  const [publicPageFilter, setPublicPageFilter] = useState<PublicPageReadinessFilter>('all')
  const [customSeasonLabelOpen, setCustomSeasonLabelOpen] = useState(false)

  const refreshRegistry = useCallback(async () => {
    const result = await listTiqLeagues()
    setRecords(result.records)
    setStorageSource(result.source)
    setStorageWarning(result.warning || '')
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshRegistry()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [refreshRegistry])

  useEffect(() => {
    let active = true

    async function loadEntryRequests() {
      const teamLeagues = records.filter((record) => record.leagueFormat === 'team')
      const playerLeagues = records.filter((record) => record.leagueFormat === 'individual')

      const [teamResults, playerResults] = await Promise.all([
        Promise.all(teamLeagues.map((record) => listTiqTeamLeagueEntries(record.id, { includeAllStatuses: true }))),
        Promise.all(playerLeagues.map((record) => listTiqPlayerLeagueEntries(record.id, { includeAllStatuses: true }))),
      ])

      if (!active) return
      setTeamEntryRequests(teamResults.flatMap((result) => result.entries))
      setPlayerEntryRequests(playerResults.flatMap((result) => result.entries))
    }

    void loadEntryRequests()

    return () => {
      active = false
    }
  }, [records])

  useEffect(() => {
    let active = true

    async function loadAuth() {
      const authState = await getClientAuthState()
      if (!active) return
      setRole(authState.role)
      setEntitlements(authState.entitlements)
    }

    void loadAuth()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadIndividualResults() {
      const result = await listTiqIndividualLeagueResults()
      if (!active) return

      setIndividualResults(result.results)
      setResultStorageSource(result.source)
      setResultStorageWarning(result.warning || '')
    }

    void loadIndividualResults()

    return () => {
      active = false
    }
  }, [])

  const leagueCards = useMemo(() => buildLeagueCardsFromRegistry(records), [records])
  const access = useMemo(() => buildProductAccessState(role, entitlements), [entitlements, role])
  const teamLeagues = useMemo(
    () => records.filter((record) => record.leagueFormat === 'team'),
    [records],
  )
  useEffect(() => {
    let active = true

    async function loadTeamResultBooks() {
      if (teamLeagues.length === 0) {
        setTeamMatchEvents([])
        setTeamMatchLines([])
        setTeamStandingsByLeague({})
        setTeamResultWarning('')
        return
      }

      const eventsResult = await listTiqTeamMatchEvents()
      const [linesResult, standingsResults] = await Promise.all([
        listTiqTeamMatchLinesForEvents(eventsResult.events.map((event) => event.id)),
        Promise.all(
          teamLeagues.map(async (league) => ({
            leagueId: league.id,
            result: await computeTiqTeamLeagueStandings(league.id),
          })),
        ),
      ])

      if (!active) return

      setTeamMatchEvents(eventsResult.events)
      setTeamMatchLines(linesResult.lines)
      setTeamStandingsByLeague(
        standingsResults.reduce<Record<string, TiqTeamStandingRow[]>>((nextMap, item) => {
          nextMap[item.leagueId] = item.result.standings
          return nextMap
        }, {}),
      )
      setTeamResultWarning(
        [
          eventsResult.warning,
          linesResult.warning,
          ...standingsResults.map((item) => item.result.warning),
        ]
          .filter(Boolean)[0] || '',
      )
    }

    void loadTeamResultBooks()

    return () => {
      active = false
    }
  }, [teamLeagues])
  const latestTeamLeague = useMemo(
    () => [...teamLeagues].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0],
    [teamLeagues],
  )
  const teamLineSummaryByEvent = useMemo(
    () => buildTeamResultLineSummaryMap(teamMatchEvents, teamMatchLines),
    [teamMatchEvents, teamMatchLines],
  )
  const teamResultBookRows = useMemo(
    () =>
      teamLeagues.map((league) => {
        const events = teamMatchEvents.filter((event) => event.leagueId === league.id)
        const eventIds = new Set(events.map((event) => event.id))
        const standings = teamStandingsByLeague[league.id] || []
        const latestEvent = events[0] || null
        const recentCount = events.filter((event) => isRecentResult(event.matchDate, 14)).length
        const completedEvents = events.filter((event) => {
          const summary = teamLineSummaryByEvent.get(event.id)
          return Boolean(summary && summary.total > 0 && summary.completed === summary.total)
        }).length
        const missingLineEvents = events.filter((event) => {
          const summary = teamLineSummaryByEvent.get(event.id)
          return !summary || summary.total === 0 || summary.completed < summary.total
        }).length
        const emptyLineEvents = events.filter((event) => {
          const summary = teamLineSummaryByEvent.get(event.id)
          return !summary || summary.total === 0
        }).length
        const completedLines = events.reduce(
          (sum, event) => sum + (teamLineSummaryByEvent.get(event.id)?.completed ?? 0),
          0,
        )
        const totalLines = events.reduce(
          (sum, event) => sum + (teamLineSummaryByEvent.get(event.id)?.total ?? 0),
          0,
        )
        const scoreReviewLines =
          league.scoringSystem === 'dynamic_points'
            ? teamMatchLines.filter(
                (line) =>
                  eventIds.has(line.eventId) &&
                  line.winnerSide &&
                  line.score &&
                  !formatDynamicPointsForSides(line.score, line.winnerSide),
              )
            : []
        const scoreReviewEvents = new Set(scoreReviewLines.map((line) => line.eventId)).size
        const leader = standings[0] || null

        return {
          league,
          events,
          standings,
          latestEvent,
          recentCount,
          completedEvents,
          missingLineEvents,
          emptyLineEvents,
          completedLines,
          totalLines,
          scoreReviewEvents,
          scoreReviewLines: scoreReviewLines.length,
          leader,
        }
      }),
    [teamLeagues, teamLineSummaryByEvent, teamMatchEvents, teamMatchLines, teamStandingsByLeague],
  )
  const teamResultBooksNeedAttention = teamResultBookRows.filter(
    (row) =>
      row.league.teams.length > 1 &&
      (row.events.length === 0 || row.recentCount === 0 || row.missingLineEvents > 0 || row.scoreReviewEvents > 0),
  ).length
  const individualLeagues = useMemo(
    () => records.filter((record) => record.leagueFormat === 'individual'),
    [records],
  )
  const latestIndividualLeague = useMemo(
    () => [...individualLeagues].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0],
    [individualLeagues],
  )
  const canSaveCurrentDraft =
    draft.leagueFormat === 'team'
      ? access.canCreateTiqTeamLeague
      : access.canCreateTiqIndividualLeague
  const accessBannerText =
    draft.leagueFormat === 'team' ? access.teamLeagueMessage : access.individualLeagueMessage
  const shouldShowLeagueUpgradePrompt = !canSaveCurrentDraft
  const activeParticipantCount = records.reduce(
    (sum, record) => sum + (record.leagueFormat === 'team' ? record.teams.length : record.players.length),
    0,
  )
  const scheduleReadyLeagueCount = records.filter(
    (record) => getTiqLeagueParticipantCount(record) > 1 && !validateTiqLeagueScheduleCapacity(record),
  ).length
  const scheduleCapacityIssueCount = records.filter((record) => validateTiqLeagueScheduleCapacity(record)).length
  const scheduleReadinessDetail =
    records.length === 0
      ? 'Create a league before planning match weeks.'
      : scheduleCapacityIssueCount > 0
        ? `${scheduleCapacityIssueCount} league${scheduleCapacityIssueCount === 1 ? '' : 's'} need a larger match-event cap.`
        : scheduleReadyLeagueCount === records.length
          ? 'Each saved league can fit at least one round robin.'
          : 'Add at least two teams or players to estimate schedule capacity.'
  const latestRecord = [...records].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0]
  const knownTeamOptions = useMemo(
    () => Array.from(new Set(records.flatMap((record) => record.teams).filter(Boolean))).sort(),
    [records],
  )
  const knownPlayerOptions = useMemo(
    () => Array.from(new Set(records.flatMap((record) => record.players).filter(Boolean))).sort(),
    [records],
  )
  const knownFacilityOptions = useMemo(
    () => Array.from(new Set(records.map((record) => record.defaultFacility).filter(Boolean))).sort(),
    [records],
  )
  const knownLocationOptions = useMemo(
    () => Array.from(new Set(records.map((record) => record.locationLabel).filter(Boolean))).sort(),
    [records],
  )
  const seasonLabelOptions = useMemo(
    () => mergeSeasonLabelOptions(records.map((record) => record.seasonLabel)),
    [records],
  )
  const normalizedDraftSeasonLabel = normalizeSeasonLabel(draft.seasonLabel)
  const draftSeasonMatchesPreset = Boolean(
    normalizedDraftSeasonLabel && seasonLabelOptions.includes(normalizedDraftSeasonLabel),
  )
  const seasonSelectValue =
    customSeasonLabelOpen || (normalizedDraftSeasonLabel && !draftSeasonMatchesPreset)
      ? CUSTOM_SEASON_VALUE
      : normalizedDraftSeasonLabel
  const teamResultEntryHref = buildTeamResultEntryHref(latestTeamLeague?.id)
  const individualResultEntryHref = buildIndividualResultEntryHref(latestIndividualLeague?.id)
  const individualSummaryByLeague = useMemo(
    () => buildTiqIndividualLeagueSummaries(individualResults),
    [individualResults],
  )
  const individualResultBookRows = useMemo(
    () =>
      individualLeagues.map((league) => {
        const leagueResults = individualResults.filter((result) => result.leagueId === league.id)
        const summary = individualSummaryByLeague.get(league.id) || null
        const possiblePairs = league.players.length > 1 ? (league.players.length * (league.players.length - 1)) / 2 : 0
        const uniquePairs = new Set(
          leagueResults.map((result) =>
            [result.playerAName.toLowerCase(), result.playerBName.toLowerCase()].sort().join('::'),
          ),
        ).size
        const recentCount = leagueResults.filter((result) => isRecentResult(result.resultDate, 14)).length
        const correctionCount = leagueResults.filter(isEditedResult).length

        return {
          league,
          summary,
          resultCount: leagueResults.length,
          recentCount,
          correctionCount,
          uniquePairs,
          possiblePairs,
          coverageRate: possiblePairs > 0 ? uniquePairs / possiblePairs : null,
        }
      }),
    [individualLeagues, individualResults, individualSummaryByLeague],
  )
  const resultBookNeedsAttention = individualResultBookRows.filter(
    (row) => row.league.players.length > 1 && (row.resultCount === 0 || row.recentCount === 0),
  ).length
  const teamResultEventCount = teamResultBookRows.reduce((sum, row) => sum + row.events.length, 0)
  const teamCompletedEventCount = teamResultBookRows.reduce((sum, row) => sum + row.completedEvents, 0)
  const teamMissingLineEventCount = teamResultBookRows.reduce((sum, row) => sum + row.missingLineEvents, 0)
  const teamEmptyLineEventCount = teamResultBookRows.reduce((sum, row) => sum + row.emptyLineEvents, 0)
  const teamCompletedLineCount = teamResultBookRows.reduce((sum, row) => sum + row.completedLines, 0)
  const teamTotalLineCount = teamResultBookRows.reduce((sum, row) => sum + row.totalLines, 0)
  const teamScoreReviewEventCount = teamResultBookRows.reduce((sum, row) => sum + row.scoreReviewEvents, 0)
  const teamScoreReviewLineCount = teamResultBookRows.reduce((sum, row) => sum + row.scoreReviewLines, 0)
  const teamResultReviewCueCount = teamMissingLineEventCount + teamScoreReviewEventCount
  const individualResultCount = individualResultBookRows.reduce((sum, row) => sum + row.resultCount, 0)
  const individualRecentResultCount = individualResultBookRows.reduce((sum, row) => sum + row.recentCount, 0)
  const individualCorrectionCount = individualResultBookRows.reduce((sum, row) => sum + row.correctionCount, 0)
  const individualLoggedPairCount = individualResultBookRows.reduce((sum, row) => sum + row.uniquePairs, 0)
  const individualPossiblePairCount = individualResultBookRows.reduce((sum, row) => sum + row.possiblePairs, 0)
  const hasResultReadyLeague = teamLeagues.length > 0 || individualLeagues.length > 0
  const publicPageReadinessRows = useMemo(() => {
    const teamRows = teamResultBookRows.map((row) => {
      const participantsReady = row.league.teams.length > 1
      const resultsReady = row.events.length > 0 && row.missingLineEvents === 0 && row.scoreReviewEvents === 0

      return {
        league: row.league,
        participantsReady,
        resultsReady,
        publicReady: participantsReady && resultsReady,
        statusText: participantsReady
          ? resultsReady
            ? 'Ready to share'
            : row.events.length > 0
              ? 'Finish match lines'
              : 'Needs match results'
          : 'Needs teams',
        detail: participantsReady
          ? resultsReady
            ? `${row.completedEvents}/${row.events.length} matches complete`
            : row.events.length > 0
              ? `${row.missingLineEvents} match${row.missingLineEvents === 1 ? '' : 'es'} need lines`
              : 'Add the first team match'
          : 'Add at least two teams',
      }
    })

    const individualRows = individualResultBookRows.map((row) => {
      const participantsReady = row.league.players.length > 1
      const resultsReady = row.resultCount > 0

      return {
        league: row.league,
        participantsReady,
        resultsReady,
        publicReady: participantsReady && resultsReady,
        statusText: participantsReady
          ? resultsReady
            ? 'Ready to share'
            : 'Needs player results'
          : 'Needs players',
        detail: participantsReady
          ? resultsReady
            ? `${row.resultCount} result${row.resultCount === 1 ? '' : 's'} logged`
            : 'Log the first player result'
          : 'Add at least two players',
      }
    })

    return [...teamRows, ...individualRows].sort(
      (left, right) =>
        Number(left.publicReady) - Number(right.publicReady) ||
        new Date(right.league.updatedAt).getTime() - new Date(left.league.updatedAt).getTime(),
    )
  }, [individualResultBookRows, teamResultBookRows])
  const publicReadyLeagueCount = publicPageReadinessRows.filter((row) => row.publicReady).length
  const publicPageNeedsWorkCount = Math.max(publicPageReadinessRows.length - publicReadyLeagueCount, 0)
  const visiblePublicPageReadinessRows = publicPageReadinessRows.filter((row) => {
    if (publicPageFilter === 'ready') return row.publicReady
    if (publicPageFilter === 'needs_work') return !row.publicReady
    return true
  })
  const resultQueueItemCount =
    teamResultBooksNeedAttention +
    resultBookNeedsAttention +
    (individualCorrectionCount > 0 ? 1 : 0)
  const resultQueueHeadline =
    resultQueueItemCount > 0
      ? `${resultQueueItemCount} result review cue${resultQueueItemCount === 1 ? '' : 's'} need attention.`
      : hasResultReadyLeague
        ? 'Result books are ready to review.'
        : 'Create a league to start result review.'
  const resultEntryHref = hasResultReadyLeague
    ? latestTeamLeague
      ? teamResultEntryHref
      : individualResultEntryHref
    : '#league-setup-form'
  const resultReadinessDetail =
    teamLeagues.length > 0 && individualLeagues.length > 0
      ? 'Team and individual leagues are ready for result entry.'
      : teamLeagues.length > 0
        ? 'Team leagues are ready for team match result entry.'
        : individualLeagues.length > 0
          ? 'Individual leagues are ready for player result logging.'
          : 'Save a team or individual league before logging results.'
  const leagueOpsChecks = [
    {
      label: 'Access',
      complete: access.canUseLeagueTools,
      detail: access.canUseLeagueTools ? 'Coordinator tools are active.' : 'Coordinator access is not active yet.',
      href: '/pricing#league',
      cta: 'See plan',
    },
    {
      label: 'Setup',
      complete: records.length > 0,
      detail: records.length > 0 ? `${records.length} league setup${records.length === 1 ? '' : 's'} saved.` : 'Create the first league setup.',
      href: '#league-setup-form',
      cta: records.length > 0 ? 'Edit setup' : 'Add league',
    },
    {
      label: 'Participants',
      complete: activeParticipantCount > 0,
      detail: activeParticipantCount > 0 ? `${activeParticipantCount} participants tracked.` : 'Add teams or players to the league.',
      href: '#league-setup-form',
      cta: 'Add participants',
    },
    {
      label: 'Schedule',
      complete: records.length > 0 && scheduleReadyLeagueCount === records.length && scheduleCapacityIssueCount === 0,
      detail: scheduleReadinessDetail,
      href: '#league-setup-form',
      cta: scheduleCapacityIssueCount > 0 ? 'Fix cap' : 'Review schedule',
    },
    {
      label: 'Sync',
      complete: storageSource === 'supabase',
      detail: storageSource === 'supabase' ? 'League setup is synced.' : 'League setup is saved as a local preview.',
      href: '#league-registry',
      cta: 'Review registry',
    },
    {
      label: 'Results',
      complete: hasResultReadyLeague,
      detail: resultReadinessDetail,
      href: hasResultReadyLeague ? resultEntryHref : '#league-setup-form',
      cta: hasResultReadyLeague ? 'Record results' : 'Finish setup',
    },
  ]
  const leagueOpsCompleteCount = leagueOpsChecks.filter((item) => item.complete).length
  const leagueOpsReadinessScore = Math.round((leagueOpsCompleteCount / leagueOpsChecks.length) * 100)
  const nextLeagueOpsStep = leagueOpsChecks.find((item) => !item.complete) || leagueOpsChecks[leagueOpsChecks.length - 1]
  const coordinatorStartCards = [
    {
      label: 'Setup',
      title: records.length > 0 ? 'Manage league setup' : 'Create the first league',
      detail:
        records.length > 0
          ? `${records.length} league setup${records.length === 1 ? '' : 's'} saved. Keep format, season, and participants current.`
          : 'Choose team or individual format, name the season, and add the first teams or players.',
      href: '#league-setup-form',
      cta: records.length > 0 ? 'Edit setup' : 'Create league',
      complete: records.length > 0,
    },
    {
      label: 'Participants',
      title: activeParticipantCount > 0 ? 'Participant list is started' : 'Add teams or players',
      detail:
        activeParticipantCount > 0
          ? `${activeParticipantCount} participants are tracked across the Coordinator workspace.`
          : 'A league becomes usable once the competing teams or players are in the record.',
      href: '#league-setup-form',
      cta: activeParticipantCount > 0 ? 'Review participants' : 'Add participants',
      complete: activeParticipantCount > 0,
    },
    {
      label: 'Schedule',
      title: records.length > 0 && scheduleCapacityIssueCount === 0 ? 'Schedule capacity is clear' : 'Check schedule capacity',
      detail: scheduleReadinessDetail,
      href: '#league-setup-form',
      cta: scheduleCapacityIssueCount > 0 ? 'Fix cap' : 'Review schedule',
      complete: records.length > 0 && scheduleReadyLeagueCount === records.length && scheduleCapacityIssueCount === 0,
    },
    {
      label: 'Results',
      title: hasResultReadyLeague ? 'Open result entry' : 'Results unlock after setup',
      detail: resultReadinessDetail,
      href: resultEntryHref,
      cta: hasResultReadyLeague ? 'Record results' : 'Finish setup',
      complete: hasResultReadyLeague,
    },
    {
      label: 'Visibility',
      title: storageSource === 'supabase' ? 'Live league record' : 'Saved preview record',
      detail:
        storageSource === 'supabase'
          ? 'League setup is synced for public pages, standings, and coordinator review.'
          : 'This workspace is still using saved preview data until live sync is available.',
      href: records.length > 0 ? '/compete/leagues' : '#league-setup-form',
      cta: records.length > 0 ? 'View leagues' : 'Create first',
      complete: storageSource === 'supabase',
    },
  ]

  function resetDraft({ clearHandoff = true }: { clearHandoff?: boolean } = {}) {
    setDraft(EMPTY_DRAFT)
    setTeamListInput('')
    setPlayerListInput('')
    setParticipantQuickAddInput('')
    setEditingId('')
    setCustomSeasonLabelOpen(false)
    setPhotoUploadStatus('')
    if (clearHandoff) setLastSavedRecord(null)
  }

  function beginNewLeague(format: TiqLeagueDraft['leagueFormat']) {
    setEditingId('')
    setDraft({
      ...EMPTY_DRAFT,
      leagueFormat: format,
      individualCompetitionFormat: format === 'individual' ? 'round_robin' : 'standard',
    })
    setTeamListInput('')
    setPlayerListInput('')
    setParticipantQuickAddInput('')
    setCustomSeasonLabelOpen(false)
    setPhotoUploadStatus('')
    setLastSavedRecord(null)
    setSetupOpen(true)
    setStatus(
      format === 'individual'
        ? 'Starting a new individual league setup.'
        : 'Starting a new team league setup.',
    )
    window.requestAnimationFrame(() => {
      document.getElementById('league-setup-form')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }

  async function handlePhotoUpload(file: File | null) {
    if (!file) return

    setPhotoUploading(true)
    setPhotoUploadStatus('Uploading league photo...')

    const result = await uploadTiqLeaguePhoto({
      file,
      leagueName: draft.leagueName,
      existingLeagueId: editingId,
    })

    if (result.warning) {
      setPhotoUploadStatus(result.warning)
    } else {
      setDraft((current) => ({ ...current, photoUrl: result.publicUrl }))
      setPhotoUploadStatus('League photo uploaded.')
    }

    setPhotoUploading(false)
  }

  async function persistDraft() {
    if (!canSaveCurrentDraft) {
      setStatus(accessBannerText)
      return
    }

    const parsedTeams = parseRegistryListInput(teamListInput)
    const parsedPlayers = parseRegistryListInput(playerListInput)

    const nextDraft: TiqLeagueDraft = {
      ...draft,
      seasonLabel: normalizeSeasonLabel(draft.seasonLabel),
      teams: draft.leagueFormat === 'team' ? parsedTeams : [],
      players: draft.leagueFormat === 'individual' ? parsedPlayers : [],
      maxWeeks: normalizeTiqLeagueMaxWeeks(draft.maxWeeks),
      maxMatchEvents: normalizeTiqLeagueMaxMatchEvents(draft.maxMatchEvents),
    }
    nextDraft.endsOn = calculateTiqLeagueEndsOn(nextDraft.startsOn, nextDraft.maxWeeks)

    if (!safeText(nextDraft.leagueName) || !safeText(nextDraft.seasonLabel)) {
      setStatus('League name and season are required before saving.')
      return
    }

    if (nextDraft.leagueFormat === 'team' && nextDraft.teams.length === 0) {
      setStatus('Team leagues need at least one team in the participant list.')
      return
    }

    if (nextDraft.leagueFormat === 'individual' && nextDraft.players.length === 0) {
      setStatus('Individual leagues need at least one player in the participant list.')
      return
    }

    const participantLimitMessage = validateTiqLeagueParticipantLimit(nextDraft)
    if (participantLimitMessage) {
      setStatus(participantLimitMessage)
      return
    }

    const seasonWindowMessage = validateTiqLeagueSeasonWindow(nextDraft)
    if (seasonWindowMessage) {
      setStatus(seasonWindowMessage)
      return
    }

    const scheduleCapacityMessage = validateTiqLeagueScheduleCapacity(nextDraft)
    if (scheduleCapacityMessage) {
      setStatus(scheduleCapacityMessage)
      return
    }

    const saved = await saveTiqLeague(nextDraft, editingId || undefined)
    await refreshRegistry()
    setLastSavedRecord(saved.record)
    setStatus(
      editingId
        ? `${saved.record.leagueName} was updated in the TIQ season registry.`
        : `${saved.record.leagueName} was added to the TIQ season registry.`,
    )
    setStorageSource(saved.source)
    setStorageWarning(saved.warning || '')
    resetDraft({ clearHandoff: false })
  }

  function addParticipantFromInput() {
    const additions = parseRegistryListInput(participantQuickAddInput)
    if (additions.length === 0) {
      setStatus(`Enter a ${draft.leagueFormat === 'team' ? 'team' : 'player'} name before adding.`)
      return
    }

    const currentInput = draft.leagueFormat === 'team' ? teamListInput : playerListInput
    const nextInput = parseRegistryListInput([currentInput, additions.join('\n')].filter(Boolean).join('\n')).join('\n')

    if (draft.leagueFormat === 'team') {
      setTeamListInput(nextInput)
    } else {
      setPlayerListInput(nextInput)
    }

    setParticipantQuickAddInput('')
    setStatus(`${additions.length} ${draft.leagueFormat === 'team' ? 'team' : 'player'}${additions.length === 1 ? '' : 's'} added to this draft.`)
  }

  const startEditing = useCallback((record: TiqLeagueRecord, options: { scrollToForm?: boolean } = {}) => {
    const normalizedSeason = normalizeSeasonLabel(record.seasonLabel)
    setEditingId(record.id)
    setDraft({
      leagueFormat: record.leagueFormat,
      individualCompetitionFormat: record.individualCompetitionFormat,
      scoringSystem: record.scoringSystem,
      thirdSetRule: record.thirdSetRule,
      leagueName: record.leagueName,
      seasonLabel: normalizedSeason,
      seasonStatus: record.seasonStatus,
      startsOn: record.startsOn,
      endsOn: record.endsOn || calculateTiqLeagueEndsOn(record.startsOn, record.maxWeeks),
      maxWeeks: record.maxWeeks,
      maxMatchEvents: record.maxMatchEvents,
      isPublic: record.isPublic,
      schedulingMode: record.schedulingMode,
      defaultMatchDay: record.defaultMatchDay,
      defaultMatchTime: record.defaultMatchTime,
      scheduleTimeZone: record.scheduleTimeZone,
      defaultFacility: record.defaultFacility,
      schedulingNotes: record.schedulingNotes,
      flight: record.flight,
      locationLabel: record.locationLabel,
      photoUrl: record.photoUrl,
      captainTeamName: record.captainTeamName,
      notes: record.notes,
      teams: record.teams,
      players: record.players,
    })
    setTeamListInput(record.teams.join('\n'))
    setPlayerListInput(record.players.join('\n'))
    setParticipantQuickAddInput('')
    setCustomSeasonLabelOpen(Boolean(normalizedSeason && !seasonLabelOptions.includes(normalizedSeason)))
    setLastSavedRecord(null)
    setSetupOpen(true)
    setStatus(`Editing ${record.leagueName}.`)
    if (options.scrollToForm) {
      window.requestAnimationFrame(() => {
        document.getElementById('league-setup-form')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      })
    }
  }, [seasonLabelOptions])

  useEffect(() => {
    if (
      !requestedEditLeagueId ||
      records.length === 0 ||
      editingId === requestedEditLeagueId ||
      appliedEditHandoffId === requestedEditLeagueId
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const requestedRecord = records.find((record) => record.id === requestedEditLeagueId)
      if (!requestedRecord) {
        setAppliedEditHandoffId(requestedEditLeagueId)
        setStatus('That league setup is no longer available. Choose a saved league below.')
        return
      }

      startEditing(requestedRecord, { scrollToForm: true })
      setAppliedEditHandoffId(requestedEditLeagueId)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [appliedEditHandoffId, editingId, records, requestedEditLeagueId, startEditing])

  async function removeRecord(id: string) {
    const result = await removeTiqLeague(id)
    await refreshRegistry()
    if (editingId === id) resetDraft()
    if (lastSavedRecord?.id === id) setLastSavedRecord(null)
    setStatus(
      result.source === 'supabase'
        ? 'The TIQ league was removed from the TIQ season registry.'
        : 'The TIQ league was removed from the local TIQ season registry.',
    )
    setStorageSource(result.source)
    setStorageWarning(result.warning || '')
  }

  async function handleEntryRequestAction(
    league: TiqLeagueRecord,
    entryName: string,
    entryStatus: 'active' | 'rejected',
  ) {
    setEntryRequestStatus(entryStatus === 'active' ? `Approving ${entryName}...` : `Declining ${entryName}...`)
    const result = await updateTiqLeagueEntryStatus({
      leagueId: league.id,
      leagueFormat: league.leagueFormat,
      entryName,
      entryStatus,
    })
    await refreshRegistry()
    if (result.record) {
      setLastSavedRecord(result.record)
    }
    setStorageSource(result.source)
    setStorageWarning(result.warning || '')
    setEntryRequestStatus(
      entryStatus === 'active'
        ? `${entryName} was approved for ${league.leagueName}.`
        : `${entryName} was declined for ${league.leagueName}.`,
    )
  }

  async function copyPublicLeagueLink(record: TiqLeagueRecord) {
    const publicHref = buildTiqLeaguePageHref(record)
    const publicUrl =
      typeof window !== 'undefined'
        ? new URL(publicHref, window.location.origin).toString()
        : publicHref

    try {
      await navigator.clipboard.writeText(publicUrl)
      setStatus(`Copied public link for ${record.leagueName}.`)
    } catch {
      setStatus('Clipboard access was blocked by the browser.')
    }
  }

  const responsivePageWrap = isMobile ? { ...pageWrap, ...mobilePageWrap } : pageWrap
  const responsiveHeroCard = isMobile ? { ...heroCard, ...mobileHeroCard } : heroCard
  const responsiveHeroTitle = isMobile ? { ...heroTitle, ...mobileHeroTitle } : heroTitle
  const responsivePanelCard = isMobile ? { ...panelCard, ...mobilePanelCard } : panelCard
  const responsiveLayoutGrid = singleColumnGrid
  const responsiveFieldGrid = isMobile ? singleColumnGrid : fieldGrid
  const responsiveOutcomeInfoGrid = isMobile ? singleColumnGrid : outcomeInfoGrid
  const responsiveDetailsSummary = isMobile ? { ...detailsSummary, ...mobileDetailsSummary } : detailsSummary
  const responsiveHeroActionRowStyle = isMobile ? { ...heroActionRow, ...mobileStackedActionRowStyle } : heroActionRow
  const responsiveButtonRowStyle = isMobile ? { ...buttonRow, ...mobileStackedActionRowStyle } : buttonRow
  const responsiveParticipantBuilderStyle = isMobile
    ? { ...participantBuilderStyle, ...mobileParticipantBuilderStyle }
    : participantBuilderStyle
  const responsiveNextActionCardStyle = isMobile ? { ...nextActionCardStyle, ...mobileNextActionCardStyle } : nextActionCardStyle
  const responsiveNextActionButtonRowStyle = isMobile
    ? { ...nextActionButtonRowStyle, ...mobileStackedActionRowStyle, justifyContent: 'stretch' }
    : nextActionButtonRowStyle
  const responsiveStartScoreStyle = isMobile ? { ...startScoreStyle, ...mobileScoreStyle } : startScoreStyle
  const responsiveLeagueOpsScoreStyle = isMobile ? { ...leagueOpsScoreStyle, ...mobileScoreStyle } : leagueOpsScoreStyle
  const responsiveStartActionRowStyle = isMobile ? { ...startActionRowStyle, ...mobileActionRowStyle } : startActionRowStyle
  const calculatedEndsOn = calculateTiqLeagueEndsOn(draft.startsOn, draft.maxWeeks)
  const seasonWindowText = draft.startsOn
    ? calculatedEndsOn
      ? `${draft.startsOn} to ${calculatedEndsOn}`
      : 'Choose a valid start date.'
    : 'Choose a start date and TenAceIQ will calculate the end date.'
  const scheduleCapacityText = getTiqLeagueScheduleCapacitySummary(draft)
  const scheduleCapacityWarning = validateTiqLeagueScheduleCapacity(draft)
  const pendingTeamEntryRequests = teamEntryRequests.filter((entry) => entry.entryStatus === 'pending')
  const pendingPlayerEntryRequests = playerEntryRequests.filter((entry) => entry.entryStatus === 'pending')
  const pendingEntryRequestCount = pendingTeamEntryRequests.length + pendingPlayerEntryRequests.length
  const schedulingPlanRows = buildTiqLeagueSchedulingPlanRows(draft)
  const schedulingHandoffSummary = getTiqLeagueSchedulingHandoffSummary(draft)
  const participantOptions = draft.leagueFormat === 'team' ? knownTeamOptions : knownPlayerOptions
  const participantDatalistId = draft.leagueFormat === 'team' ? 'tiq-known-team-options' : 'tiq-known-player-options'

  return (
    <SiteShell active={activeRoute}>
      <section style={responsivePageWrap}>
        <div style={responsiveHeroCard}>
          <div style={heroEyebrow}>{LEAGUE_COORDINATOR_STORY.eyebrow}</div>
          <h1 style={responsiveHeroTitle}>{LEAGUE_COORDINATOR_STORY.headline}</h1>
          <p style={heroText}>
            {LEAGUE_COORDINATOR_STORY.body}
          </p>

          <div style={heroPillRow}>
            <span style={pillBlue}>{records.length} TIQ leagues</span>
            <span style={pillGreen}>{teamLeagues.length} team leagues</span>
            <span style={pillSlate}>{individualLeagues.length} individual leagues</span>
            <span style={storageSource === 'supabase' ? pillGreen : pillSlate}>
              {storageSource === 'supabase' ? 'Live data' : 'Saved preview'}
            </span>
            <span style={access.canUseLeagueTools ? pillGreen : pillSlate}>
              {access.leagueTierLabel}
            </span>
          </div>

          {storageWarning ? <div style={statusBanner}>{storageWarning}</div> : null}
          {!access.canUseLeagueTools ? <div style={noteBanner}>{access.leagueTierMessage}</div> : null}

          <div style={responsiveHeroActionRowStyle}>
            <GhostLink href={resultEntryHref}>Record results</GhostLink>
            <GhostLink href="/data-assist">Upload data</GhostLink>
            <GhostLink href="/compete/leagues">My leagues</GhostLink>
            <GhostLink href="/explore/leagues">Browse leagues</GhostLink>
          </div>
        </div>

        <CoordinatorSubnav
          title={LEAGUE_COORDINATOR_STORY.subnavTitle}
          description={LEAGUE_COORDINATOR_STORY.subnavDescription}
          tierLabel={access.leagueTierLabel}
          tierActive={access.canUseLeagueTools}
        />

        <section style={startPanelStyle}>
          <div style={leagueOpsHeaderStyle}>
            <div>
              <div style={sectionEyebrow}>Start here</div>
              <h2 style={leagueOpsTitleStyle}>
                {access.canUseLeagueTools
                  ? records.length > 0
                    ? 'Your next Coordinator move is ready.'
                    : 'Set up the first league workspace.'
                  : 'Unlock Coordinator access to save league workspaces.'}
              </h2>
              <p style={leagueOpsTextStyle}>
                {nextLeagueOpsStep.detail}
              </p>
            </div>
            <div style={responsiveStartScoreStyle}>
              <span>{leagueOpsReadinessScore}% ready</span>
              <span style={leagueOpsTrackStyle}>
                <span style={leagueOpsFillStyle(leagueOpsReadinessScore)} />
              </span>
            </div>
          </div>

          <div style={responsiveStartActionRowStyle}>
            <div>
              <span style={startActionLabelStyle}>Next action</span>
              <strong style={startActionTitleStyle}>{nextLeagueOpsStep.label}</strong>
            </div>
            <GhostLink href={nextLeagueOpsStep.href}>{nextLeagueOpsStep.cta}</GhostLink>
          </div>

          <div style={operatingFlowGridStyle} aria-label="Coordinator operating order">
            {COORDINATOR_OPERATING_FLOW.map((step) => (
              <div key={step.title} style={operatingFlowStepStyle}>
                <span style={operatingFlowNumberStyle}>{step.label}</span>
                <span style={operatingFlowCopyStyle}>
                  <strong>{step.title}</strong>
                  <em>{step.text}</em>
                </span>
              </div>
            ))}
          </div>

          <div style={startCardGridStyle}>
            {coordinatorStartCards.map((item) => (
              <Link key={item.label} href={item.href} style={item.complete ? startCardCompleteStyle : startCardStyle}>
                <span style={item.complete ? pillGreen : pillSlate}>{item.label}</span>
                <strong style={startCardTitleStyle}>{item.title}</strong>
                <span style={startCardTextStyle}>{item.detail}</span>
                <span style={startCardCtaStyle}>{item.cta}</span>
              </Link>
            ))}
          </div>
        </section>

        <section style={commandCard}>
          <div>
            <div style={sectionEyebrow}>League command center</div>
            <h2 style={sectionTitle}>{records.length ? 'Your season control room is active.' : 'Create the first league workspace.'}</h2>
            <p style={sectionText}>
              The job is simple: approve who belongs, keep the schedule visible, collect scores, review uploads, and let the standings update around the season.
            </p>
          </div>
          <div style={commandGrid}>
            <div style={commandTile}>
              <span style={commandLabel}>Leagues</span>
              <strong style={commandValue}>{records.length}</strong>
              <span style={commandText}>{teamLeagues.length} team - {individualLeagues.length} individual</span>
            </div>
            <div style={commandTile}>
              <span style={commandLabel}>Requests</span>
              <strong style={commandValue}>{pendingEntryRequestCount}</strong>
              <span style={commandText}>Waiting for coordinator approval</span>
            </div>
            <div style={commandTile}>
              <span style={commandLabel}>Participants</span>
              <strong style={commandValue}>{activeParticipantCount}</strong>
              <span style={commandText}>Teams and players tracked</span>
            </div>
            <div style={commandTile}>
              <span style={commandLabel}>Latest</span>
              <strong style={commandValue}>{latestRecord?.leagueName || 'None yet'}</strong>
              <span style={commandText}>{latestRecord ? formatDateTime(latestRecord.updatedAt) : 'Start with setup'}</span>
            </div>
          </div>
          <div style={responsiveHeroActionRowStyle}>
            {hasResultReadyLeague ? (
              <>
                {latestTeamLeague ? <GhostLink href={teamResultEntryHref}>Team results</GhostLink> : null}
                {latestIndividualLeague ? <GhostLink href={individualResultEntryHref}>Individual results</GhostLink> : null}
              </>
            ) : (
              <GhostLink href={resultEntryHref}>Record results</GhostLink>
            )}
            <GhostLink href="/compete/leagues">View leagues</GhostLink>
            <GhostLink href="/explore/rankings">View rankings</GhostLink>
          </div>
        </section>

        <section style={dataAssistOpsPanelStyle}>
          <div style={leagueOpsHeaderStyle}>
            <div>
              <div style={sectionEyebrow}>{DATA_ASSIST_STORY.eyebrow}</div>
              <h2 style={leagueOpsTitleStyle}>Use uploads as the coordinator refresh path.</h2>
              <p style={leagueOpsTextStyle}>
                {DATA_ASSIST_STORY.shortCue} Coordinator setup stays manual and reviewable; Data Assist is where schedules, rosters, and official scorecards can come in when the season changes.
              </p>
            </div>
            <GhostLink href="/data-assist">{DATA_ASSIST_STORY.cta}</GhostLink>
          </div>
          <div style={dataAssistOpsGridStyle}>
            <div style={dataAssistOpsCardStyle}>
              <span style={pillBlue}>Schedules</span>
              <strong>Upload match weeks and sites</strong>
              <span>Use reviewed schedule files to keep dates, facilities, and match windows visible for players.</span>
            </div>
            <div style={dataAssistOpsCardStyle}>
              <span style={pillGreen}>Rosters</span>
              <strong>Refresh teams or players</strong>
              <span>Bring participant lists into the workspace, then approve what becomes active league structure.</span>
            </div>
            <div style={dataAssistOpsCardStyle}>
              <span style={pillSlate}>Scorecards</span>
              <strong>Review before standings move</strong>
              <span>Uploaded scorecards should land in review before they update result books and public standings.</span>
            </div>
          </div>
        </section>

        <section style={publicReadinessPanelStyle}>
          <div style={leagueOpsHeaderStyle}>
            <div>
              <div style={sectionEyebrow}>Public page readiness</div>
              <h2 style={leagueOpsTitleStyle}>
                {records.length === 0
                  ? 'Create a league before sharing a public page.'
                  : publicPageNeedsWorkCount > 0
                    ? `${publicPageNeedsWorkCount} public page${publicPageNeedsWorkCount === 1 ? '' : 's'} need data before sharing.`
                    : 'Public league pages are ready to share.'}
              </h2>
              <p style={leagueOpsTextStyle}>
                Check whether each saved league has enough participants and results for the public TIQ page to feel useful.
              </p>
            </div>
            <span style={publicPageNeedsWorkCount > 0 ? pillSlate : pillGreen}>
              {records.length === 0 ? 'Setup first' : `${publicReadyLeagueCount}/${records.length} ready`}
            </span>
          </div>

          <div style={publicReadinessFilterRowStyle} aria-label="Public page readiness filter">
            {[
              { value: 'all', label: 'All', count: publicPageReadinessRows.length },
              { value: 'ready', label: 'Ready', count: publicReadyLeagueCount },
              { value: 'needs_work', label: 'Needs work', count: publicPageNeedsWorkCount },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                style={publicPageFilter === item.value ? publicReadinessFilterActiveStyle : publicReadinessFilterButtonStyle}
                onClick={() => setPublicPageFilter(item.value as PublicPageReadinessFilter)}
              >
                {item.label} {item.count}
              </button>
            ))}
          </div>

          {visiblePublicPageReadinessRows.length > 0 ? (
            <div style={publicReadinessGridStyle}>
              {visiblePublicPageReadinessRows.slice(0, 4).map((row) => (
                <div key={row.league.id} style={row.publicReady ? publicReadinessCardReadyStyle : publicReadinessCardStyle}>
                  <div style={registryMetaRow}>
                    <span style={row.publicReady ? pillGreen : pillSlate}>{row.statusText}</span>
                    <span style={row.league.leagueFormat === 'team' ? pillGreen : pillBlue}>
                      {row.league.leagueFormat === 'team' ? 'Team' : 'Individual'}
                    </span>
                  </div>
                  <strong style={publicReadinessTitleStyle}>{row.league.leagueName}</strong>
                  <span style={registryText}>{row.detail}</span>
                  <div style={publicReadinessCheckGridStyle}>
                    <span style={row.participantsReady ? pillGreen : pillSlate}>Participants</span>
                    <span style={row.resultsReady ? pillGreen : pillSlate}>Results</span>
                  </div>
                  <LeagueActionRow
                    league={row.league}
                    resultLabel={getLeagueResultEntryLabel(row.league)}
                    onCopyShare={copyPublicLeagueLink}
                    includeManage
                  />
                </div>
              ))}
            </div>
          ) : (
            <div style={emptyCard}>
              {publicPageReadinessRows.length === 0
                ? 'No TIQ league pages are ready yet. Save a team or individual league to start.'
                : 'No public league pages match this filter.'}
            </div>
          )}
        </section>

        <section style={reviewQueuePanelStyle}>
          <div style={leagueOpsHeaderStyle}>
            <div>
              <div style={sectionEyebrow}>Result review queue</div>
              <h2 style={leagueOpsTitleStyle}>{resultQueueHeadline}</h2>
              <p style={leagueOpsTextStyle}>
                See the result books that need line scores, fresh results, corrections, or first activity before opening a workspace.
              </p>
            </div>
            <span style={resultQueueItemCount > 0 ? pillSlate : pillGreen}>
              {resultQueueItemCount > 0 ? 'Review needed' : 'In shape'}
            </span>
          </div>
          <div style={reviewQueueGridStyle}>
            <div style={reviewCueCardStyle}>
              <div style={registryMetaRow}>
                <span style={pillGreen}>Team Results</span>
                {teamResultBooksNeedAttention > 0 ? (
                  <span style={pillSlate}>{teamResultBooksNeedAttention} books need review</span>
                ) : (
                  <span style={pillGreen}>Ready</span>
                )}
              </div>
              <div style={reviewCueValueStyle}>
                {teamResultReviewCueCount}
              </div>
              <div style={reviewCueTitleStyle}>team matches need line review</div>
              <div style={registryText}>
                {teamLeagues.length > 0
                  ? [
                      `${teamCompletedEventCount}/${teamResultEventCount} complete matches`,
                      `${teamCompletedLineCount}/${teamTotalLineCount} lines complete`,
                      teamEmptyLineEventCount ? `${teamEmptyLineEventCount} matches with no lines` : null,
                      teamScoreReviewLineCount ? `${teamScoreReviewLineCount} dynamic scores need review` : null,
                    ]
                      .filter(Boolean)
                      .join(' | ')
                  : 'Create a team league to start match review'}
              </div>
              <div style={responsiveButtonRowStyle}>
                {teamLeagues.length > 0 ? (
                  <GhostLink href={teamResultEntryHref}>Review team results</GhostLink>
                ) : (
                  <GhostBtn onClick={() => beginNewLeague('team')}>Add team league</GhostBtn>
                )}
              </div>
            </div>

            <div style={reviewCueCardStyle}>
              <div style={registryMetaRow}>
                <span style={pillBlue}>Player Results</span>
                {resultBookNeedsAttention > 0 ? (
                  <span style={pillSlate}>{resultBookNeedsAttention} books need review</span>
                ) : (
                  <span style={pillGreen}>Ready</span>
                )}
              </div>
              <div style={reviewCueValueStyle}>
                {resultBookNeedsAttention}
              </div>
              <div style={reviewCueTitleStyle}>individual books need activity</div>
              <div style={registryText}>
                {individualLeagues.length > 0
                  ? [
                      `${individualResultCount} player results`,
                      `${individualRecentResultCount} recent`,
                      individualPossiblePairCount > 0
                        ? `${individualLoggedPairCount}/${individualPossiblePairCount} pairings logged`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' | ')
                  : 'Create an individual league to start player review'}
              </div>
              <div style={responsiveButtonRowStyle}>
                {individualLeagues.length > 0 ? (
                  <GhostLink href={individualResultEntryHref}>Review player results</GhostLink>
                ) : (
                  <GhostBtn onClick={() => beginNewLeague('individual')}>Add individual league</GhostBtn>
                )}
              </div>
            </div>

            <div style={reviewCueCardStyle}>
              <div style={registryMetaRow}>
                <span style={pillSlate}>Corrections</span>
                {individualCorrectionCount > 0 ? (
                  <span style={pillSlate}>{individualCorrectionCount} edited</span>
                ) : (
                  <span style={pillGreen}>No edits pending</span>
                )}
              </div>
              <div style={reviewCueValueStyle}>
                {individualCorrectionCount}
              </div>
              <div style={reviewCueTitleStyle}>player result corrections</div>
              <div style={registryText}>
                Corrections stay visible here so a coordinator can double-check standings after edited scores.
              </div>
              <div style={responsiveButtonRowStyle}>
                <GhostLink href={individualLeagues.length > 0 ? individualResultEntryHref : resultEntryHref}>
                  Open review
                </GhostLink>
              </div>
            </div>
          </div>
        </section>

        {teamLeagues.length > 0 ? (
          <section style={resultBookPanelStyle}>
            <div style={leagueOpsHeaderStyle}>
              <div>
                <div style={sectionEyebrow}>Team result books</div>
                <h2 style={leagueOpsTitleStyle}>
                  {teamResultBooksNeedAttention > 0
                    ? `${teamResultBooksNeedAttention} team league${teamResultBooksNeedAttention === 1 ? '' : 's'} need match activity.`
                    : 'Team result books are active.'}
                </h2>
                <p style={leagueOpsTextStyle}>
                  Track match events, standings leaders, recent activity, and completed team results before opening Team Results.
                </p>
              </div>
              <span style={pillGreen}>Team results</span>
            </div>
            {teamResultWarning ? <div style={statusBanner}>{teamResultWarning}</div> : null}
            <div style={resultBookGridStyle}>
              {teamResultBookRows.slice(0, 4).map((row) => (
                <div key={row.league.id} style={resultBookCardStyle}>
                  <div style={registryMetaRow}>
                    <span style={pillGreen}>Team league</span>
                    {row.recentCount > 0 ? <span style={pillGreen}>{row.recentCount} recent</span> : <span style={pillSlate}>No recent matches</span>}
                    {row.missingLineEvents > 0 ? (
                      <span style={pillSlate}>{row.missingLineEvents} need lines</span>
                    ) : row.events.length > 0 ? (
                      <span style={pillGreen}>Lines complete</span>
                    ) : null}
                    {row.scoreReviewEvents > 0 ? <span style={pillSlate}>{row.scoreReviewEvents} score review</span> : null}
                  </div>
                  <div style={registryTitle}>{row.league.leagueName}</div>
                  <div style={registryText}>
                    {[
                      `${row.league.teams.length} teams`,
                      `${row.events.length} match events`,
                      row.latestEvent ? `Latest ${formatDateTime(row.latestEvent.matchDate)}` : 'No matches logged',
                    ].join(' | ')}
                  </div>
                  <div style={resultBookMetricRowStyle}>
                    <div style={resultBookMetricStyle}>
                      <span>Leader</span>
                      <strong>{row.leader?.teamName || '-'}</strong>
                      <small>
                        {row.leader
                          ? `${row.leader.wins}-${row.leader.losses}-${row.leader.ties}`
                          : 'No standings yet'}
                      </small>
                    </div>
                    <div style={resultBookMetricStyle}>
                      <span>Line review</span>
                      <strong>
                        {row.totalLines > 0 ? `${row.completedLines}/${row.totalLines}` : '0'}
                      </strong>
                      <small>
                        {row.scoreReviewLines > 0
                          ? `${row.scoreReviewLines} dynamic scores need review`
                          : row.missingLineEvents > 0
                          ? `${row.missingLineEvents} matches need work`
                          : row.events.length > 0
                            ? 'Matches complete'
                            : 'Awaiting lines'}
                      </small>
                    </div>
                  </div>
                  <LeagueActionRow
                    league={row.league}
                    resultHref={buildTeamResultEntryHref(row.league.id)}
                    resultLabel="Open Team Results"
                    publicLabel="League page"
                    onCopyShare={copyPublicLeagueLink}
                  />
                </div>
              ))}
            </div>
            <div style={responsiveHeroActionRowStyle}>
              <GhostLink href={teamResultEntryHref}>Review all team results</GhostLink>
            </div>
          </section>
        ) : null}

        {individualLeagues.length > 0 ? (
          <section style={resultBookPanelStyle}>
            <div style={leagueOpsHeaderStyle}>
              <div>
                <div style={sectionEyebrow}>Player result books</div>
                <h2 style={leagueOpsTitleStyle}>
                  {resultBookNeedsAttention > 0
                    ? `${resultBookNeedsAttention} individual league${resultBookNeedsAttention === 1 ? '' : 's'} need result attention.`
                    : 'Individual result books are moving.'}
                </h2>
                <p style={leagueOpsTextStyle}>
                  Review recent player results, pair coverage, leaders, and corrections before opening Player Results.
                </p>
              </div>
              <span style={resultStorageSource === 'supabase' ? pillGreen : pillSlate}>
                {resultStorageSource === 'supabase' ? 'Live results' : 'Saved preview results'}
              </span>
            </div>
            {resultStorageWarning ? <div style={statusBanner}>{resultStorageWarning}</div> : null}
            <div style={resultBookGridStyle}>
              {individualResultBookRows.slice(0, 4).map((row) => (
                <div key={row.league.id} style={resultBookCardStyle}>
                  <div style={registryMetaRow}>
                    <span style={pillBlue}>
                      {getTiqIndividualCompetitionFormatLabel(row.league.individualCompetitionFormat)}
                    </span>
                    {row.recentCount > 0 ? <span style={pillGreen}>{row.recentCount} recent</span> : <span style={pillSlate}>No recent results</span>}
                    {row.correctionCount > 0 ? <span style={pillSlate}>{row.correctionCount} corrections</span> : null}
                  </div>
                  <div style={registryTitle}>{row.league.leagueName}</div>
                  <div style={registryText}>
                    {[
                      `${row.league.players.length} players`,
                      `${row.resultCount} results`,
                      row.coverageRate !== null ? `${Math.round(row.coverageRate * 100)}% coverage` : 'Coverage pending',
                    ].join(' | ')}
                  </div>
                  <div style={resultBookMetricRowStyle}>
                    <div style={resultBookMetricStyle}>
                      <span>Leader</span>
                      <strong>{row.summary?.leaderName || '-'}</strong>
                      <small>{row.summary?.leaderRecord || '0-0'}</small>
                    </div>
                    <div style={resultBookMetricStyle}>
                      <span>Pairs</span>
                      <strong>{row.uniquePairs}/{row.possiblePairs}</strong>
                      <small>{row.possiblePairs > 0 ? 'Logged pairings' : 'Add players'}</small>
                    </div>
                  </div>
                  <LeagueActionRow
                    league={row.league}
                    resultHref={buildIndividualResultEntryHref(row.league.id)}
                    resultLabel="Open Player Results"
                    publicLabel="League page"
                    onCopyShare={copyPublicLeagueLink}
                  />
                </div>
              ))}
            </div>
            <div style={responsiveHeroActionRowStyle}>
              <GhostLink href={individualResultEntryHref}>Review all player results</GhostLink>
            </div>
          </section>
        ) : null}

        <section style={leagueOpsPanelStyle}>
          <div style={leagueOpsHeaderStyle}>
            <div>
              <div style={sectionEyebrow}>Season readiness</div>
              <h2 style={leagueOpsTitleStyle}>
                {leagueOpsReadinessScore === 100 ? 'This league is ready to operate.' : 'Tighten setup before the season moves.'}
              </h2>
              <p style={leagueOpsTextStyle}>
                {leagueOpsReadinessScore === 100
                  ? 'Setup, participants, sync, and result entry are all in usable shape.'
                  : `Next: ${nextLeagueOpsStep.label.toLowerCase()}. ${nextLeagueOpsStep.detail}`}
              </p>
            </div>
            <div style={responsiveLeagueOpsScoreStyle}>
              <strong>{leagueOpsReadinessScore}%</strong>
              <span>{leagueOpsCompleteCount}/{leagueOpsChecks.length} ready</span>
            </div>
          </div>
          <div style={leagueOpsTrackStyle} aria-label={`League season readiness ${leagueOpsReadinessScore} percent`}>
            <span style={leagueOpsFillStyle(leagueOpsReadinessScore)} />
          </div>
          <div style={leagueOpsCheckGridStyle}>
            {leagueOpsChecks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                style={item.complete ? leagueOpsCheckCompleteStyle : leagueOpsCheckStyle}
              >
                <span>{item.label}</span>
                <small>{item.detail}</small>
              </Link>
            ))}
          </div>
          <div style={responsiveHeroActionRowStyle}>
            <GhostLink href={nextLeagueOpsStep.href}>{nextLeagueOpsStep.cta}</GhostLink>
            {latestTeamLeague ? <GhostLink href={teamResultEntryHref}>Team results</GhostLink> : null}
            {latestIndividualLeague ? <GhostLink href={individualResultEntryHref}>Individual results</GhostLink> : null}
            {!hasResultReadyLeague ? <GhostLink href={resultEntryHref}>Record results</GhostLink> : null}
          </div>
        </section>

        <div style={responsiveLayoutGrid}>
          <details
            id="league-setup-form"
            style={responsivePanelCard}
            open={setupOpen || !!editingId || records.length === 0}
            onToggle={(event) => setSetupOpen(event.currentTarget.open)}
          >
            <summary style={responsiveDetailsSummary}>
              <div>
                <div style={sectionEyebrow}>{editingId ? 'Editing' : 'Setup'}</div>
                <h2 style={sectionTitle}>
                  {editingId ? 'Edit league setup' : 'Add a league'}
                </h2>
                <p style={sectionText}>
                  Use only the fields needed to create the structure. Uploads, results, and rankings come after the league record is clear.
                </p>
              </div>
              <span style={pillSlate}>{editingId ? 'Editing' : 'Open form'}</span>
            </summary>

            {shouldShowLeagueUpgradePrompt ? (
              <UpgradePrompt
                planId="league"
                headline={
                  draft.leagueFormat === 'team'
                    ? LEAGUE_COORDINATOR_STORY.upgradeHeadline
                    : LEAGUE_COORDINATOR_STORY.upgradeHeadline
                }
                body={
                  draft.leagueFormat === 'team'
                    ? LEAGUE_COORDINATOR_STORY.upgradeBody
                    : LEAGUE_COORDINATOR_STORY.upgradeBody
                }
                ctaLabel={LEAGUE_COORDINATOR_STORY.cta}
                secondaryLabel="Keep drafting"
                footnote={accessBannerText}
                compact
              />
            ) : (
              <div
                style={{
                  ...statusBanner,
                  ...noteBanner,
                }}
              >
                {accessBannerText}
              </div>
            )}

            <div style={responsiveFieldGrid}>
              <label style={fieldLabel}>
                <span>League format</span>
                <select
                  value={draft.leagueFormat}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      leagueFormat: event.target.value === 'individual' ? 'individual' : 'team',
                      individualCompetitionFormat:
                        event.target.value === 'individual'
                          ? current.individualCompetitionFormat
                          : 'standard',
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="team">Team League</option>
                  <option value="individual">Individual League</option>
                </select>
              </label>

              <label style={fieldLabel}>
                <span>League name</span>
                <input
                  value={draft.leagueName}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, leagueName: event.target.value }))
                  }
                  placeholder="TIQ Spring Doubles Cup"
                  style={inputStyle}
                />
              </label>

              <label style={fieldLabel}>
                <span>Season label</span>
                <select
                  value={seasonSelectValue}
                  onChange={(event) => {
                    if (event.target.value === CUSTOM_SEASON_VALUE) {
                      setCustomSeasonLabelOpen(true)
                      setDraft((current) => ({
                        ...current,
                        seasonLabel: draftSeasonMatchesPreset ? '' : current.seasonLabel,
                      }))
                      return
                    }

                    setCustomSeasonLabelOpen(false)
                    setDraft((current) => ({
                      ...current,
                      seasonLabel: normalizeSeasonLabel(event.target.value),
                    }))
                  }}
                  style={inputStyle}
                >
                  <option value="">Choose season</option>
                  {seasonLabelOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                  <option value={CUSTOM_SEASON_VALUE}>Custom season...</option>
                </select>
                {customSeasonLabelOpen || (normalizedDraftSeasonLabel && !draftSeasonMatchesPreset) ? (
                  <input
                    value={draft.seasonLabel}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, seasonLabel: event.target.value }))
                    }
                    onBlur={() =>
                      setDraft((current) => ({
                        ...current,
                        seasonLabel: normalizeSeasonLabel(current.seasonLabel),
                      }))
                    }
                    placeholder="Club Championship 2026"
                    style={inputStyle}
                  />
                ) : null}
              </label>

              <label style={fieldLabel}>
                <span>Season status</span>
                <select
                  value={draft.seasonStatus}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      seasonStatus:
                        event.target.value === 'active'
                          ? 'active'
                          : event.target.value === 'completed'
                            ? 'completed'
                            : event.target.value === 'archived'
                              ? 'archived'
                              : 'draft',
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              <label style={fieldLabel}>
                <span>League visibility</span>
                <select
                  value={draft.isPublic ? 'public' : 'private'}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      isPublic: event.target.value !== 'private',
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="public">Public page</option>
                  <option value="private">Private league</option>
                </select>
                <span style={fieldHelpText}>
                  {getTiqLeagueVisibilityDescription(draft.isPublic)}
                </span>
              </label>

              <label style={fieldLabel}>
                <span>Season length</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_TIQ_LEAGUE_WEEKS}
                  value={draft.maxWeeks}
                  onChange={(event) =>
                    setDraft((current) => {
                      const maxWeeks = normalizeTiqLeagueMaxWeeks(event.target.value)
                      return {
                        ...current,
                        maxWeeks,
                        endsOn: calculateTiqLeagueEndsOn(current.startsOn, maxWeeks),
                      }
                    })
                  }
                  style={inputStyle}
                />
                <span style={fieldHelpText}>
                  Capped at {MAX_TIQ_LEAGUE_WEEKS} weeks. The end date is calculated from the start date and season length.
                </span>
              </label>

              <label style={fieldLabel}>
                <span>Start date</span>
                <input
                  type="date"
                  value={draft.startsOn}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      startsOn: event.target.value,
                      endsOn: calculateTiqLeagueEndsOn(event.target.value, current.maxWeeks),
                    }))
                  }
                  style={inputStyle}
                />
              </label>

              <label style={fieldLabel}>
                <span>End date</span>
                <input
                  type="date"
                  value={calculatedEndsOn}
                  readOnly
                  style={inputStyle}
                />
                <span style={fieldHelpText}>{seasonWindowText}</span>
              </label>

              <label style={fieldLabel}>
                <span>Max match events</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_TIQ_LEAGUE_MATCH_EVENTS}
                  value={draft.maxMatchEvents}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      maxMatchEvents: normalizeTiqLeagueMaxMatchEvents(event.target.value),
                    }))
                  }
                  style={inputStyle}
                />
                <span style={fieldHelpText}>
                  Standard season: {DEFAULT_TIQ_LEAGUE_MAX_WEEKS} weeks and {DEFAULT_TIQ_LEAGUE_MAX_MATCH_EVENTS} match events. End date is calculated from weeks selected. Team cap {MAX_TIQ_TEAM_LEAGUE_TEAMS}; player cap {MAX_TIQ_INDIVIDUAL_LEAGUE_PLAYERS}.
                </span>
                <span style={scheduleCapacityWarning ? fieldWarningText : fieldHelpText}>
                  {scheduleCapacityWarning || scheduleCapacityText}
                </span>
              </label>

              <label style={fieldLabel}>
                <span>Scheduling control</span>
                <select
                  value={draft.schedulingMode}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      schedulingMode: event.target.value === 'player_arranged' ? 'player_arranged' : 'coordinator_fixed',
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="coordinator_fixed">Coordinator sets schedule</option>
                  <option value="player_arranged">Players schedule matches</option>
                </select>
                <span style={fieldHelpText}>
                  {getTiqLeagueSchedulingModeDescription(draft.schedulingMode)}
                </span>
                <span style={fieldHelpText}>
                  {draft.schedulingMode === 'player_arranged'
                    ? 'After setup, each week opens as a scheduling window. Players confirm details before the result is logged.'
                    : 'After setup, the coordinator-published schedule is the source of truth. Data Assist uploads can refresh changes after review.'}
                </span>
              </label>

              <label style={fieldLabel}>
                <span>Recurring match day</span>
                <select
                  value={draft.defaultMatchDay}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, defaultMatchDay: event.target.value }))
                  }
                  style={inputStyle}
                >
                  {MATCH_DAY_OPTIONS.map((option) => (
                    <option key={option.value || 'none'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span style={fieldHelpText}>
                  Use this when the coordinator wants recurring match days visible before exact pairings are published.
                </span>
              </label>

              <label style={fieldLabel}>
                <span>Default match time</span>
                <input
                  type="time"
                  value={draft.defaultMatchTime}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, defaultMatchTime: event.target.value }))
                  }
                  style={inputStyle}
                />
              </label>

              <label style={fieldLabel}>
                <span>Schedule time zone</span>
                <select
                  value={draft.scheduleTimeZone}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, scheduleTimeZone: event.target.value }))
                  }
                  style={inputStyle}
                >
                  {TIME_ZONE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.value})
                    </option>
                  ))}
                  {!TIME_ZONE_OPTIONS.some((option) => option.value === draft.scheduleTimeZone) ? (
                    <option value={draft.scheduleTimeZone}>{draft.scheduleTimeZone}</option>
                  ) : null}
                </select>
                <span style={fieldHelpText}>
                  Saved with the league so coordinators and players see the same match time.
                </span>
              </label>

              <label style={fieldLabel}>
                <span>Default site</span>
                <input
                  list="tiq-facility-options"
                  value={draft.defaultFacility}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, defaultFacility: event.target.value }))
                  }
                  placeholder="Club name, court block, or TBD"
                  style={inputStyle}
                />
                <datalist id="tiq-facility-options">
                  {knownFacilityOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
                <span style={fieldHelpText}>
                  Site, court block, or club instructions participants should see before scheduling.
                </span>
              </label>

              <label style={fieldLabel}>
                <span>Flight or tier</span>
                <input
                  list="tiq-flight-options"
                  value={draft.flight}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, flight: event.target.value }))
                  }
                  placeholder="4.0 / Advanced / Open"
                  style={inputStyle}
                />
                <datalist id="tiq-flight-options">
                  {FLIGHT_OPTIONS.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </label>

              <label style={fieldLabel}>
                <span>Location / market</span>
                <input
                  list="tiq-location-options"
                  value={draft.locationLabel}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, locationLabel: event.target.value }))
                  }
                  placeholder="Dallas, Plano, North Dallas, or club market"
                  style={inputStyle}
                />
                <datalist id="tiq-location-options">
                  {knownLocationOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </label>

              <label style={fieldLabel}>
                <span>League photo or logo</span>
                <div style={photoUploadBox}>
                  {draft.photoUrl ? (
                    <div style={photoPreviewWrap}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={draft.photoUrl} alt="League photo preview" style={photoPreviewImage} />
                    </div>
                  ) : (
                    <div style={photoPlaceholder}>No photo uploaded</div>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={photoUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null
                      void handlePhotoUpload(file)
                      event.target.value = ''
                    }}
                    style={fileInputStyle}
                  />
                  <input
                    value={draft.photoUrl}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, photoUrl: event.target.value }))
                    }
                    placeholder="Optional image URL fallback"
                    style={inputStyle}
                  />
                </div>
                <span style={fieldHelpText}>
                  Upload a JPG, PNG, WebP, or GIF up to 5 MB. The URL fallback is there for hosted club logos.
                </span>
                {photoUploadStatus ? <span style={fieldHelpText}>{photoUploadStatus}</span> : null}
              </label>

              {draft.leagueFormat === 'individual' ? (
                <label style={fieldLabel}>
                  <span>Individual competition format</span>
                  <select
                    value={draft.individualCompetitionFormat}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        individualCompetitionFormat:
                          event.target.value === 'ladder'
                            ? 'ladder'
                            : event.target.value === 'round_robin'
                              ? 'round_robin'
                              : event.target.value === 'challenge'
                                ? 'challenge'
                                : 'standard',
                      }))
                    }
                    style={inputStyle}
                  >
                    {TIQ_INDIVIDUAL_COMPETITION_FORMATS.map((format) => (
                      <option key={format} value={format}>
                        {getTiqIndividualCompetitionFormatLabel(format)}
                      </option>
                    ))}
                  </select>
                  <span style={fieldHelpText}>
                    {getTiqIndividualCompetitionFormatDescription(draft.individualCompetitionFormat)}
                  </span>
                </label>
              ) : null}

              <label style={fieldLabel}>
                <span>Scoring system</span>
                <select
                  value={draft.scoringSystem}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      scoringSystem: event.target.value === 'dynamic_points' ? 'dynamic_points' : 'standard',
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="standard">Standard Score</option>
                  <option value="dynamic_points">Dynamic points</option>
                </select>
                <span style={fieldHelpText}>
                  {getTiqLeagueScoringSystemDescription(draft.scoringSystem)}
                </span>
              </label>

              <label style={fieldLabel}>
                <span>Third set rule</span>
                <select
                  value={draft.thirdSetRule}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      thirdSetRule:
                        event.target.value === 'full_set'
                          ? 'full_set'
                          : event.target.value === 'match_tiebreak_10'
                            ? 'match_tiebreak_10'
                            : 'either',
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="either">Full set or 10-point tiebreak</option>
                  <option value="full_set">Full third set</option>
                  <option value="match_tiebreak_10">10-point match tiebreak</option>
                </select>
                <span style={fieldHelpText}>
                  {getTiqLeagueThirdSetRuleDescription(draft.thirdSetRule)}
                </span>
              </label>
            </div>

            <div style={responsiveOutcomeInfoGrid}>
              <div style={infoCard}>
                <div style={sectionEyebrow}>Score format</div>
                <strong style={infoCardTitle}>
                  {draft.scoringSystem === 'dynamic_points' ? 'Dynamic still uses tennis scores' : 'Standard Score records wins first'}
                </strong>
                <p style={infoCardText}>
                  Enter scores as best 2 of 3 sets: 6-4, 7-6, or 6-4, 4-6, 1-0. Third set rule: {getTiqLeagueThirdSetRuleLabel(draft.thirdSetRule)}.
                </p>
              </div>
              <div style={infoCard}>
                <div style={sectionEyebrow}>Season guardrails</div>
                <strong style={infoCardTitle}>
                  {draft.maxWeeks} weeks, ending {calculatedEndsOn || 'after start date'}
                </strong>
                <p style={infoCardText}>
                  League duration is capped at {MAX_TIQ_LEAGUE_WEEKS} weeks. Choose the start date and weeks; TenAceIQ calculates the end date and checks the {MAX_TIQ_LEAGUE_MATCH_EVENTS} match-event cap.
                </p>
              </div>
              <div style={infoCard}>
                <div style={sectionEyebrow}>Outcomes</div>
                <strong style={infoCardTitle}>
                  {draft.leagueFormat === 'team' ? 'Team events use line results' : 'Individual results use one winner'}
                </strong>
                <p style={infoCardText}>
                  {draft.leagueFormat === 'team'
                    ? 'Record a team-vs-team event, then each singles or doubles line with winner and score. Standings come from team wins, line wins, and dynamic points when enabled.'
                    : 'Record Player A, Player B, result date, winner, and score. Completed results sync into the rating engine and league standings.'}
                </p>
              </div>
            </div>

            <div style={setupAssistPanelStyle}>
              <div style={leagueOpsHeaderStyle}>
                <div>
                  <div style={sectionEyebrow}>Season calendar</div>
                  <strong style={setupAssistTitleStyle}>
                    {draft.schedulingMode === 'player_arranged'
                      ? 'Player-arranged scheduling preview'
                      : 'Coordinator-published schedule preview'}
                  </strong>
                  <p style={setupAssistTextStyle}>{schedulingHandoffSummary}</p>
                </div>
                <span style={pillSlate}>{draft.scheduleTimeZone}</span>
              </div>
              <div style={calendarGridStyle}>
                {schedulingPlanRows.slice(0, 12).map((row) => (
                  <div key={row.week} style={calendarRowStyle}>
                    <span style={calendarWeekStyle}>Week {row.week}</span>
                    <strong style={calendarDateStyle}>{row.label}</strong>
                    <span style={calendarMetaStyle}>
                      {row.meta}
                    </span>
                    <span style={calendarActionStyle}>{row.action}</span>
                  </div>
                ))}
              </div>
            </div>

            <label style={fieldLabel}>
              <span>{draft.leagueFormat === 'team' ? 'Teams' : 'Players'}</span>
              <div style={responsiveParticipantBuilderStyle}>
                <input
                  list={participantDatalistId}
                  value={participantQuickAddInput}
                  onChange={(event) => setParticipantQuickAddInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addParticipantFromInput()
                    }
                  }}
                  placeholder={
                    draft.leagueFormat === 'team'
                      ? 'Search or add a team'
                      : 'Search or add a player'
                  }
                  style={inputStyle}
                />
                <GhostBtn onClick={addParticipantFromInput}>Add</GhostBtn>
                <datalist id={participantDatalistId}>
                  {participantOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>
              <span style={fieldHelpText}>
                Use known names when available, or paste reviewed roster names from Data Assist. Custom names are allowed; coordinator approval keeps join requests from turning into active participants automatically.
              </span>
              <textarea
                value={draft.leagueFormat === 'team' ? teamListInput : playerListInput}
                onChange={(event) =>
                  draft.leagueFormat === 'team'
                    ? setTeamListInput(event.target.value)
                    : setPlayerListInput(event.target.value)
                }
                placeholder={
                  draft.leagueFormat === 'team'
                    ? 'North Dallas Aces\nPlano Pace\nFrisco Spin'
                    : 'Amy Chen\nLauren Diaz\nMina Patel'
                }
                style={textareaStyle}
              />
            </label>

            <label style={fieldLabel}>
              <span>Season notes</span>
              <textarea
                value={draft.notes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Format rules, schedule notes, eligibility, defaults, or league reminders."
                style={textareaStyle}
              />
            </label>

            <label style={fieldLabel}>
              <span>Scheduling notes</span>
              <textarea
                value={draft.schedulingNotes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, schedulingNotes: event.target.value }))
                }
                placeholder="Rainout rules, court booking links, check-in window, or how players should propose match times."
                style={textareaStyle}
              />
            </label>

            {status ? <div style={statusBanner}>{status}</div> : null}
            {lastSavedRecord ? (
              <div style={responsiveNextActionCardStyle}>
                <div>
                  <div style={nextActionTitleStyle}>
                    Next: review {lastSavedRecord.leagueName}
                  </div>
                  <div style={nextActionTextStyle}>
                    Use the saved setup for {lastSavedRecord.leagueFormat === 'team' ? 'team match results' : 'player results'}, or check the public league page before sharing.
                  </div>
                </div>
                <div style={responsiveNextActionButtonRowStyle}>
                  <GhostLink href={buildLeagueResultEntryHref(lastSavedRecord)}>
                    {getLeagueResultEntryLabel(lastSavedRecord)}
                  </GhostLink>
                  <GhostLink href={buildTiqLeaguePageHref(lastSavedRecord)}>
                    View public league
                  </GhostLink>
                </div>
              </div>
            ) : null}

            <div style={responsiveButtonRowStyle}>
              <PrimaryBtn onClick={persistDraft} disabled={!canSaveCurrentDraft}>
                {editingId ? 'Update league' : 'Save league'}
              </PrimaryBtn>
              <GhostBtn onClick={resetDraft}>Clear form</GhostBtn>
            </div>

            {!canSaveCurrentDraft ? (
              <div style={{ marginTop: 18 }}>
                <UpgradePrompt
                  planId="league"
                  compact
                  headline={
                    draft.leagueFormat === 'team'
                      ? LEAGUE_COORDINATOR_STORY.draftUpgradeHeadline
                      : LEAGUE_COORDINATOR_STORY.draftUpgradeHeadline
                  }
                  body={
                    draft.leagueFormat === 'team'
                      ? LEAGUE_COORDINATOR_STORY.draftUpgradeBody
                      : LEAGUE_COORDINATOR_STORY.draftUpgradeBody
                  }
                  ctaLabel={LEAGUE_COORDINATOR_STORY.cta}
                  secondaryLabel="Compare plans"
                />
              </div>
            ) : null}
          </details>

          <section id="league-registry" style={responsivePanelCard}>
            <div style={sectionEyebrow}>League registry</div>
            <h2 style={sectionTitle}>{LEAGUE_COORDINATOR_STORY.registryTitle}</h2>
            <p style={sectionText}>
              {LEAGUE_COORDINATOR_STORY.registryBody}
            </p>

            <div style={entryRequestPanelStyle}>
              <div style={registryMetaRow}>
                <span style={pendingEntryRequestCount > 0 ? pillGreen : pillSlate}>
                  {pendingEntryRequestCount} pending
                </span>
                <span style={pillSlate}>Coordinator approval required</span>
              </div>
              <div style={registryTitle}>Join requests</div>
              <div style={registryText}>
                Public and private leagues both require approval before a team or player becomes an active participant.
              </div>
              {entryRequestStatus ? <div style={statusBanner}>{entryRequestStatus}</div> : null}
              {pendingEntryRequestCount === 0 ? (
                <div style={emptyCard}>No join requests are waiting right now.</div>
              ) : (
                <div style={stackList}>
                  {[...pendingTeamEntryRequests, ...pendingPlayerEntryRequests].map((entry) => {
                    const league = records.find((record) => record.id === entry.leagueId)
                    if (!league) return null
                    const entryName =
                      'teamName' in entry
                        ? entry.teamName
                        : entry.playerName
                    const detail =
                      'teamName' in entry
                        ? [entry.sourceLeagueName, entry.sourceFlight, 'Team request'].filter(Boolean).join(' | ')
                        : [entry.playerLocation, 'Player request'].filter(Boolean).join(' | ')

                    return (
                      <div key={`${entry.leagueId}-${entryName}`} style={requestCardStyle}>
                        <div>
                          <div style={registryTitle}>{entryName}</div>
                          <div style={registryText}>{league.leagueName}</div>
                          {detail ? <div style={registryNotes}>{detail}</div> : null}
                        </div>
                        <div style={responsiveButtonRowStyle}>
                          <PrimaryBtn onClick={() => void handleEntryRequestAction(league, entryName, 'active')}>
                            Approve
                          </PrimaryBtn>
                          <DangerBtn onClick={() => void handleEntryRequestAction(league, entryName, 'rejected')}>
                            Decline
                          </DangerBtn>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {records.length === 0 ? (
              <div style={emptyCard}>
                No TIQ leagues have been created yet. Start with a team league or an individual league to
                create structure for participants, schedules, and results.
              </div>
            ) : (
              <div style={stackList}>
                {records.map((record) => {
                  const participantLabel =
                    record.leagueFormat === 'team'
                      ? `${record.teams.length} teams`
                      : `${record.players.length} players`
                  const recordCapacityWarning = validateTiqLeagueScheduleCapacity(record)
                  const recordCapacitySummary = getTiqLeagueScheduleCapacitySummary(record)

                  return (
                    <div key={record.id} style={registryCard}>
                      {record.photoUrl ? (
                        <div style={registryPhotoWrap}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={record.photoUrl} alt={`${record.leagueName} league`} style={registryPhoto} />
                        </div>
                      ) : null}
                      <div style={registryMetaRow}>
                        <span style={record.leagueFormat === 'team' ? pillGreen : pillBlue}>
                          {getLeagueFormatLabel(record.leagueFormat)}
                        </span>
                        <span style={record.seasonStatus === 'active' ? pillGreen : pillSlate}>
                          {record.seasonStatus}
                        </span>
                        <span style={record.isPublic ? pillGreen : pillSlate}>
                          {getTiqLeagueVisibilityLabel(record.isPublic)}
                        </span>
                        <span style={pillSlate}>{record.seasonLabel || 'Season label missing'}</span>
                        <span style={pillSlate}>{getTiqLeagueSeasonSummary(record)}</span>
                        <span style={pillSlate}>{getTiqLeagueSchedulingModeLabel(record.schedulingMode)}</span>
                        <span style={pillSlate}>{getTiqLeagueScoringSystemLabel(record.scoringSystem)}</span>
                        <span style={pillSlate}>{getTiqLeagueThirdSetRuleLabel(record.thirdSetRule)}</span>
                      </div>

                      <div style={registryTitle}>{record.leagueName}</div>
                      <div style={registryText}>
                        {[
                          record.leagueFormat === 'individual'
                            ? getTiqIndividualCompetitionFormatLabel(record.individualCompetitionFormat)
                            : null,
                          record.flight,
                          record.locationLabel,
                          record.startsOn && record.endsOn ? `${record.startsOn} to ${record.endsOn}` : null,
                          record.schedulingMode === 'coordinator_fixed' && (record.defaultMatchDay || record.defaultMatchTime || record.defaultFacility)
                            ? [record.defaultMatchDay, record.defaultMatchTime, record.defaultFacility].filter(Boolean).join(' ')
                            : getTiqLeagueSchedulingModeLabel(record.schedulingMode),
                          participantLabel,
                        ]
                          .filter(Boolean)
                          .join(' | ')}
                      </div>
                      {record.notes ? <div style={registryNotes}>{record.notes}</div> : null}
                      {record.schedulingNotes ? <div style={registryNotes}>{record.schedulingNotes}</div> : null}
                      <div style={recordCapacityWarning ? registryWarning : registryNotes}>
                        {recordCapacityWarning || recordCapacitySummary}
                      </div>

                      <div style={registryFooter}>
                        <span style={registryTimestamp}>Updated {formatDateTime(record.updatedAt)}</span>
                        <LeagueActionRow
                          league={record}
                          resultLabel={getLeagueResultEntryLabel(record)}
                          onCopyShare={copyPublicLeagueLink}
                        >
                          <GhostBtn onClick={() => startEditing(record)}>Edit</GhostBtn>
                          <DangerBtn onClick={() => removeRecord(record.id)}>Remove</DangerBtn>
                        </LeagueActionRow>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {leagueCards.length > 0 ? (
              <div style={noteCard}>
                <div style={sectionEyebrow}>League records</div>
                <div style={sectionText}>
                  {leagueCards.length} TIQ league records are now available for browsing and result entry.
                </div>
              </div>
            ) : null}

            {!access.canUseLeagueTools ? (
              <div style={{ marginTop: 18 }}>
                <UpgradePrompt
                  planId="league"
                  compact
                  headline={LEAGUE_COORDINATOR_STORY.finalUpgradeHeadline}
                  body={LEAGUE_COORDINATOR_STORY.finalUpgradeBody}
                  ctaLabel={LEAGUE_COORDINATOR_STORY.cta}
                  secondaryLabel="See league value"
                />
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </SiteShell>
  )
}

function LeagueActionRow({
  league,
  resultHref = buildLeagueResultEntryHref(league),
  resultLabel,
  publicLabel = 'View public',
  includeManage = false,
  onCopyShare,
  children,
}: {
  league: TiqLeagueRecord
  resultHref?: string
  resultLabel: string
  publicLabel?: string
  includeManage?: boolean
  onCopyShare: (record: TiqLeagueRecord) => void | Promise<void>
  children?: ReactNode
}) {
  const { isMobile } = useViewportBreakpoints()
  const responsiveLeagueActionRowStyle = isMobile ? { ...buttonRow, ...mobileStackedActionRowStyle } : buttonRow

  return (
    <div style={responsiveLeagueActionRowStyle}>
      <GhostLink href={buildTiqLeaguePageHref(league)}>{publicLabel}</GhostLink>
      <GhostBtn onClick={() => void onCopyShare(league)}>Copy share link</GhostBtn>
      <GhostLink href={resultHref}>{resultLabel}</GhostLink>
      {includeManage ? <GhostLink href={buildLeagueSetupHref(league)}>Manage</GhostLink> : null}
      {children}
    </div>
  )
}

function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      style={{
        ...ghostButton,
        ...(hovered
          ? {
              background: 'color-mix(in srgb, var(--brand-blue-2) 10%, var(--shell-chip-bg) 90%)',
              transform: 'translateY(-2px)',
              boxShadow: 'var(--shadow-soft)',
            }
          : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  )
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...ghostButtonButton,
        ...(hovered
          ? {
              background: 'color-mix(in srgb, var(--brand-blue-2) 10%, var(--shell-chip-bg) 90%)',
              transform: 'translateY(-2px)',
              boxShadow: 'var(--shadow-soft)',
            }
          : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

function PrimaryBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...primaryButton,
        ...(disabled ? disabledPrimaryButton : {}),
        ...(hovered && !disabled ? { transform: 'translateY(-2px)', boxShadow: 'var(--shadow-soft)' } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

function DangerBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...dangerButton,
        ...(hovered ? { transform: 'translateY(-2px)', boxShadow: 'var(--shadow-soft)' } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

const pageWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - 40px))',
  margin: '0 auto',
  padding: '18px 0 30px',
  display: 'grid',
  gap: '18px',
}

const mobilePageWrap: CSSProperties = {
  width: 'min(100%, calc(100% - 28px))',
  padding: '14px 0 24px',
  gap: '14px',
}

const heroCard: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: 'clamp(20px, 4vw, 28px)',
  borderRadius: '24px',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 18%, var(--shell-panel-border) 82%)',
  background:
    'radial-gradient(circle at top right, color-mix(in srgb, var(--brand-lime) 12%, transparent) 0%, transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--brand-blue-2) 10%, var(--shell-panel-bg) 90%) 0%, var(--shell-panel-bg-strong) 100%)',
  boxShadow: 'var(--shadow-card)',
  minWidth: 0,
}

const mobileHeroCard: CSSProperties = {
  padding: '20px',
  borderRadius: '24px',
}

const heroEyebrow: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  color: 'var(--brand-blue-2)',
}

const heroTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2.3rem, 6vw, 3.25rem)',
  lineHeight: 0.98,
  letterSpacing: 0,
  maxWidth: '940px',
  overflowWrap: 'anywhere',
}

const mobileHeroTitle: CSSProperties = {
  fontSize: '38px',
  lineHeight: 1.02,
}

const heroText: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '16px',
  lineHeight: 1.75,
  maxWidth: '920px',
  overflowWrap: 'anywhere',
}

const heroPillRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
}

const pillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '32px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
}

const pillBlue: CSSProperties = {
  ...pillBase,
  background: 'color-mix(in srgb, var(--brand-blue-2) 13%, var(--shell-chip-bg) 87%)',
  color: 'var(--foreground-strong)',
}

const pillGreen: CSSProperties = {
  ...pillBase,
  background: 'color-mix(in srgb, var(--brand-lime) 14%, var(--shell-chip-bg) 86%)',
  color: 'var(--foreground-strong)',
}

const pillSlate: CSSProperties = {
  ...pillBase,
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
}

const heroActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
}

const mobileStackedActionRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  alignItems: 'stretch',
  justifyItems: 'stretch',
}

const singleColumnGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: '14px',
}

const commandCard: CSSProperties = {
  display: 'grid',
  gap: '18px',
  padding: 'clamp(18px, 3vw, 24px)',
  borderRadius: '24px',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 18%, var(--shell-panel-border) 82%)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-panel-bg) 93%) 0%, color-mix(in srgb, var(--brand-green) 7%, var(--shell-panel-bg) 93%) 100%)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const commandGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: '12px',
}

const commandTile: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '16px',
  borderRadius: '20px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const commandLabel: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const commandValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '26px',
  fontWeight: 950,
  lineHeight: 1.05,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'normal',
}

const commandText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.5,
}

const leagueOpsPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-panel-bg) 92%)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const resultBookPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-panel-bg) 93%)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const startPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-lime) 7%, var(--shell-panel-bg) 93%)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const reviewQueuePanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-green) 7%, var(--shell-panel-bg) 93%)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const publicReadinessPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-panel-bg) 93%)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const dataAssistOpsPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 20%, var(--shell-panel-border) 80%)',
  background:
    'radial-gradient(circle at top right, color-mix(in srgb, var(--brand-blue-2) 10%, transparent) 0%, transparent 36%), var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const dataAssistOpsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: '12px',
}

const dataAssistOpsCardStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  alignContent: 'start',
  minHeight: '150px',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.55,
  fontWeight: 750,
  minWidth: 0,
}

const reviewQueueGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: '12px',
}

const publicReadinessGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
  gap: '12px',
}

const publicReadinessFilterRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
}

const publicReadinessFilterButtonStyle: CSSProperties = {
  minHeight: '34px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 900,
  cursor: 'pointer',
  maxWidth: '100%',
  whiteSpace: 'normal',
}

const publicReadinessFilterActiveStyle: CSSProperties = {
  ...publicReadinessFilterButtonStyle,
  border: '1px solid color-mix(in srgb, var(--brand-lime) 30%, var(--shell-panel-border) 70%)',
  background: 'color-mix(in srgb, var(--brand-lime) 13%, var(--shell-chip-bg) 87%)',
  color: 'var(--foreground-strong)',
}

const publicReadinessCardStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  alignContent: 'start',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const publicReadinessCardReadyStyle: CSSProperties = {
  ...publicReadinessCardStyle,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 9%, var(--shell-chip-bg) 91%)',
}

const publicReadinessTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  lineHeight: 1.2,
  fontWeight: 950,
}

const publicReadinessCheckGridStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
}

const reviewCueCardStyle: CSSProperties = {
  display: 'grid',
  gap: '11px',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const reviewCueValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '34px',
  fontWeight: 950,
  lineHeight: 1,
}

const reviewCueTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  fontWeight: 900,
  lineHeight: 1.25,
}

const resultBookGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))',
  gap: '12px',
}

const resultBookCardStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
  padding: '16px',
  borderRadius: '20px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const resultBookMetricRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: '10px',
}

const resultBookMetricStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  padding: '10px 12px',
  borderRadius: '14px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
}

const leagueOpsHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  flexWrap: 'wrap',
}

const leagueOpsTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: '24px',
  lineHeight: 1.1,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const leagueOpsTextStyle: CSSProperties = {
  margin: '8px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.65,
}

const leagueOpsScoreStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  justifyItems: 'end',
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 900,
}

const startScoreStyle: CSSProperties = {
  ...leagueOpsScoreStyle,
  minWidth: 0,
}

const mobileScoreStyle: CSSProperties = {
  justifyItems: 'start',
  minWidth: 0,
  width: '100%',
}

const leagueOpsTrackStyle: CSSProperties = {
  height: '14px',
  borderRadius: '999px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  overflow: 'hidden',
  padding: '2px',
}

const leagueOpsFillStyle = (value: number): CSSProperties => ({
  display: 'block',
  height: '100%',
  width: `${Math.max(0, Math.min(value, 100))}%`,
  borderRadius: '999px',
  background: 'linear-gradient(90deg, #4ade80, #9be11d)',
})

const startActionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '14px',
  flexWrap: 'wrap',
  padding: '14px 16px',
  borderRadius: '18px',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 18%, var(--shell-panel-border) 82%)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const mobileActionRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  alignItems: 'stretch',
}

const startActionLabelStyle: CSSProperties = {
  display: 'block',
  color: 'var(--brand-blue-2)',
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const startActionTitleStyle: CSSProperties = {
  display: 'block',
  marginTop: '4px',
  color: 'var(--foreground-strong)',
  fontSize: '18px',
  lineHeight: 1.15,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const operatingFlowGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: '10px',
  minWidth: 0,
}

const operatingFlowStepStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '34px minmax(0, 1fr)',
  gap: '10px',
  alignItems: 'start',
  padding: '12px',
  borderRadius: '16px',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 16%, var(--shell-panel-border) 84%)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 92%, var(--surface) 8%)',
  minWidth: 0,
}

const operatingFlowNumberStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '30px',
  height: '30px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, var(--brand-green), var(--brand-lime))',
  color: 'var(--text-dark)',
  fontSize: '12px',
  fontWeight: 950,
}

const operatingFlowCopyStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  color: 'var(--foreground-strong)',
  fontSize: '13px',
  lineHeight: 1.35,
  fontWeight: 900,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const startCardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: '10px',
}

const startCardStyle: CSSProperties = {
  display: 'grid',
  gap: '9px',
  alignContent: 'start',
  minHeight: '166px',
  padding: '14px',
  borderRadius: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  minWidth: 0,
}

const startCardCompleteStyle: CSSProperties = {
  ...startCardStyle,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 9%, var(--shell-chip-bg) 91%)',
}

const startCardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const startCardTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.55,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const startCardCtaStyle: CSSProperties = {
  alignSelf: 'end',
  color: 'var(--brand-lime)',
  fontSize: '12px',
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const leagueOpsCheckGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: '10px',
}

const leagueOpsCheckStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  minHeight: '94px',
  padding: '12px',
  borderRadius: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 750,
  minWidth: 0,
}

const leagueOpsCheckCompleteStyle: CSSProperties = {
  ...leagueOpsCheckStyle,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 9%, var(--shell-chip-bg) 91%)',
  color: 'var(--foreground-strong)',
}

const panelCard: CSSProperties = {
  display: 'grid',
  gap: '16px',
  padding: 'clamp(18px, 3vw, 24px)',
  borderRadius: '24px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const mobilePanelCard: CSSProperties = {
  padding: '18px',
  borderRadius: '22px',
  gap: '14px',
}

const detailsSummary: CSSProperties = {
  cursor: 'pointer',
  listStyle: 'none',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '14px',
  flexWrap: 'wrap',
}

const mobileDetailsSummary: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
}

const sectionEyebrow: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  color: 'var(--brand-blue-2)',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.45rem, 3vw, 1.75rem)',
  lineHeight: 1.08,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const sectionText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.72,
  overflowWrap: 'anywhere',
}

const fieldGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: '14px',
}

const outcomeInfoGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: '12px',
}

const infoCard: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const infoCardTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const infoCardText: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.55,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const setupAssistPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '16px',
  borderRadius: '20px',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-lime) 7%, var(--shell-panel-bg) 93%)',
  minWidth: 0,
}

const setupAssistTitleStyle: CSSProperties = {
  display: 'block',
  color: 'var(--foreground-strong)',
  fontSize: '17px',
  lineHeight: 1.2,
  fontWeight: 950,
}

const setupAssistTextStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.55,
}

const calendarGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
  gap: '10px',
}

const calendarRowStyle: CSSProperties = {
  display: 'grid',
  gap: '5px',
  minHeight: '98px',
  padding: '12px',
  borderRadius: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const calendarWeekStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const calendarDateStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  lineHeight: 1.2,
  fontWeight: 950,
}

const calendarMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  lineHeight: 1.45,
  fontWeight: 700,
}

const calendarActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  justifySelf: 'start',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 20%, var(--shell-panel-border) 80%)',
  background: 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 950,
}

const fieldLabel: CSSProperties = {
  display: 'grid',
  gap: '8px',
  color: 'var(--foreground)',
  fontSize: '13px',
  fontWeight: 700,
  minWidth: 0,
}

const fieldHelpText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  lineHeight: 1.6,
  fontWeight: 500,
}

const fieldWarningText: CSSProperties = {
  ...fieldHelpText,
  color: '#fca5a5',
  fontWeight: 850,
}

const participantBuilderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: '10px',
  alignItems: 'center',
  minWidth: 0,
}

const mobileParticipantBuilderStyle: CSSProperties = {
  gridTemplateColumns: 'minmax(0, 1fr)',
  alignItems: 'stretch',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '48px',
  borderRadius: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '0 14px',
  outline: 'none',
  minWidth: 0,
}

const photoUploadBox: CSSProperties = {
  display: 'grid',
  gap: '10px',
  minWidth: 0,
}

const photoPreviewWrap: CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 7',
  overflow: 'hidden',
  borderRadius: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const photoPreviewImage: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}

const photoPlaceholder: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  minHeight: '112px',
  borderRadius: '16px',
  border: '1px dashed var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  fontWeight: 800,
}

const fileInputStyle: CSSProperties = {
  width: '100%',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
}

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: '126px',
  borderRadius: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '14px',
  outline: 'none',
  resize: 'vertical',
  minWidth: 0,
}

const statusBanner: CSSProperties = {
  padding: '12px 14px',
  borderRadius: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const noteBanner: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 20%, var(--shell-panel-border) 80%)',
  background: 'color-mix(in srgb, var(--brand-green) 9%, var(--shell-chip-bg) 91%)',
  color: 'var(--foreground-strong)',
}

const nextActionCardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '14px',
  flexWrap: 'wrap',
  padding: '14px 16px',
  borderRadius: '18px',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 22%, var(--shell-panel-border) 78%)',
  background: 'color-mix(in srgb, var(--brand-lime) 9%, var(--shell-chip-bg) 91%)',
  minWidth: 0,
}

const mobileNextActionCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  alignItems: 'stretch',
}

const nextActionTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  fontWeight: 900,
}

const nextActionTextStyle: CSSProperties = {
  marginTop: '4px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.5,
}

const nextActionButtonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  justifyContent: 'flex-end',
}

const buttonRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
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
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
}

const disabledPrimaryButton: CSSProperties = {
  opacity: 0.58,
  cursor: 'not-allowed',
  boxShadow: 'none',
}

const ghostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  fontWeight: 800,
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
}

const ghostButtonButton: CSSProperties = {
  ...ghostButton,
  cursor: 'pointer',
}

const dangerButton: CSSProperties = {
  ...ghostButtonButton,
  border: '1px solid color-mix(in srgb, #ef4444 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, #ef4444 12%, var(--shell-chip-bg) 88%)',
  color: '#fecaca',
}

const emptyCard: CSSProperties = {
  padding: '18px',
  borderRadius: '20px',
  border: '1px dashed var(--shell-panel-border)',
  color: 'var(--shell-copy-muted)',
  background: 'var(--shell-chip-bg)',
  lineHeight: 1.7,
  overflowWrap: 'anywhere',
}

const stackList: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const registryCard: CSSProperties = {
  display: 'grid',
  gap: '10px',
  padding: '18px',
  borderRadius: '22px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const registryPhotoWrap: CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 7',
  overflow: 'hidden',
  borderRadius: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const registryPhoto: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}

const registryMetaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
}

const registryTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '22px',
  fontWeight: 900,
  lineHeight: 1.1,
  overflowWrap: 'anywhere',
}

const registryText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.65,
  overflowWrap: 'anywhere',
}

const registryNotes: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.72,
  overflowWrap: 'anywhere',
}

const registryWarning: CSSProperties = {
  ...registryNotes,
  padding: '10px 12px',
  borderRadius: '14px',
  border: '1px solid color-mix(in srgb, #f87171 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, #7f1d1d 12%, var(--shell-chip-bg) 88%)',
  color: 'color-mix(in srgb, #fca5a5 76%, var(--foreground-strong) 24%)',
  fontWeight: 850,
}

const registryFooter: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
  paddingTop: '8px',
}

const entryRequestPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
  padding: '16px',
  borderRadius: '20px',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-lime) 7%, var(--shell-panel-bg) 93%)',
  minWidth: 0,
}

const requestCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: '12px',
  alignItems: 'center',
  padding: '14px',
  borderRadius: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const registryTimestamp: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 700,
}

const noteCard: CSSProperties = {
  padding: '16px 18px',
  borderRadius: '20px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-panel-bg) 92%)',
}
