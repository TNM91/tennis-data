'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
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
import {
  buildTiqAwardCertificateText,
  buildTiqLeagueAwardCandidates,
  readTiqAwardsForSource,
  saveTiqAwardRecordForUser,
  type TiqAwardRecord,
  type TiqLeagueAwardCandidate,
} from '@/lib/tiq-awards-registry'

const emptyLeagueRegistryActions = [
  { href: '#league-setup-form', label: 'Create league' },
  { href: DATA_ASSIST_STORY.href, label: 'Upload season data' },
  { href: '/compete/leagues', label: 'League directory' },
] as const

const emptyPublicReadinessActions = [
  { href: '#league-setup-form', label: 'Create league' },
  { href: DATA_ASSIST_STORY.href, label: 'Add data' },
  { href: '/compete/leagues', label: 'Preview league lane' },
] as const

const emptyJoinRequestActions = [
  { href: '#league-public-pages', label: 'Check public pages' },
  { href: '/compete/leagues', label: 'Share league lane' },
  { href: '#league-setup-form', label: 'Review setup' },
] as const

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

const RESULT_ENTRY_HANDOFF_STEPS = [
  {
    title: 'Choose the book',
    text: 'Team Results handles team match events and line scores. Player Results handles individual league matches.',
  },
  {
    title: 'Check the scorecard',
    text: 'Reviewed Data Assist scorecards can support updates before standings move.',
  },
  {
    title: 'Confirm the fields',
    text: 'Team entries need teams, match date, lines, winners, and scores. Player entries need two players, result date, winner, and score.',
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

export function LeagueCoordinatorWorkspace() {
  const searchParams = useSearchParams()
  const { isMobile } = useViewportBreakpoints()
  const { role, userId, entitlements, authResolved } = useAuth()
  const resolvedRole = authResolved || !userId ? role : 'member'
  const requestedEditLeagueId = searchParams.get('leagueId') || searchParams.get('league_id') || ''
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
  const [leagueAwardRefresh, setLeagueAwardRefresh] = useState(0)

  const refreshRegistry = useCallback(async () => {
    try {
      const result = await listTiqLeagues()
      setRecords(result.records)
      setStorageSource(result.source)
      setStorageWarning(result.warning || '')
    } catch (error) {
      setRecords([])
      setStorageSource('local')
      setStorageWarning(error instanceof Error ? error.message : 'League Office data could not load.')
    }
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
      try {
        const teamLeagues = records.filter((record) => record.leagueFormat === 'team')
        const playerLeagues = records.filter((record) => record.leagueFormat === 'individual')

        const [teamResults, playerResults] = await Promise.all([
          Promise.all(teamLeagues.map((record) => listTiqTeamLeagueEntries(record.id, { includeAllStatuses: true }))),
          Promise.all(playerLeagues.map((record) => listTiqPlayerLeagueEntries(record.id, { includeAllStatuses: true }))),
        ])

        if (!active) return
        setTeamEntryRequests(teamResults.flatMap((result) => result.entries))
        setPlayerEntryRequests(playerResults.flatMap((result) => result.entries))
        setEntryRequestStatus('')
      } catch (error) {
        if (!active) return
        setTeamEntryRequests([])
        setPlayerEntryRequests([])
        setEntryRequestStatus(error instanceof Error ? error.message : 'League entry requests could not load.')
      }
    }

    void loadEntryRequests()

    return () => {
      active = false
    }
  }, [records])

  useEffect(() => {
    let active = true

    async function loadIndividualResults() {
      try {
        const result = await listTiqIndividualLeagueResults()
        if (!active) return

        setIndividualResults(result.results)
        setResultStorageSource(result.source)
        setResultStorageWarning(result.warning || '')
      } catch (error) {
        if (!active) return
        setIndividualResults([])
        setResultStorageSource('local')
        setResultStorageWarning(error instanceof Error ? error.message : 'Individual results could not load.')
      }
    }

    void loadIndividualResults()

    return () => {
      active = false
    }
  }, [])

  const leagueCards = useMemo(() => buildLeagueCardsFromRegistry(records), [records])
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [entitlements, resolvedRole])
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

      try {
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
      } catch (error) {
        if (!active) return
        setTeamMatchEvents([])
        setTeamMatchLines([])
        setTeamStandingsByLeague({})
        setTeamResultWarning(error instanceof Error ? error.message : 'Team result books could not load.')
      }
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
  const leagueAwardRows = useMemo(() => {
    void leagueAwardRefresh
    const teamAwardRows = teamResultBookRows.map((row) => {
      const candidates = buildTiqLeagueAwardCandidates(
        row.standings.slice(0, 3).map((standing) => ({
          recipientName: standing.teamName,
          detail: `${standing.wins}-${standing.losses}-${standing.ties}`,
        })),
      )
      return {
        league: row.league,
        mode: 'Team' as const,
        candidates,
        issuedAwards: readTiqAwardsForSource('league', row.league.id),
        ready: candidates.some((candidate) => candidate.recipientName),
      }
    })

    const individualAwardRows = individualResultBookRows.map((row) => {
      const candidates = buildTiqLeagueAwardCandidates(
        buildIndividualLeagueAwardFinishers(row.league, individualResults.filter((result) => result.leagueId === row.league.id)),
      )
      return {
        league: row.league,
        mode: 'Player' as const,
        candidates,
        issuedAwards: readTiqAwardsForSource('league', row.league.id),
        ready: candidates.some((candidate) => candidate.recipientName),
      }
    })

    return [...teamAwardRows, ...individualAwardRows]
      .filter((row) => row.ready || row.issuedAwards.length > 0)
      .sort((left, right) => Number(right.ready) - Number(left.ready) || new Date(right.league.updatedAt).getTime() - new Date(left.league.updatedAt).getTime())
  }, [individualResultBookRows, individualResults, leagueAwardRefresh, teamResultBookRows])
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
      ? 'Team Results handles team match events and line scores; Player Results handles individual league matches.'
      : teamLeagues.length > 0
        ? 'Team Results is ready for team match events, line winners, and score review.'
        : individualLeagues.length > 0
          ? 'Player Results is ready for one-on-one results, corrections, and standings updates.'
          : 'Save a team or individual league first; result entry opens after setup has participants.'
  const leagueOpsChecks = [
    {
      label: 'Access',
      complete: access.canUseLeagueTools,
      detail: access.canUseLeagueTools ? 'League Office is active.' : 'League access is not active yet.',
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
      label: 'Season window',
      complete: records.length > 0 && scheduleReadyLeagueCount === records.length && scheduleCapacityIssueCount === 0,
      detail: scheduleReadinessDetail,
      href: '#league-setup-form',
      cta: scheduleCapacityIssueCount > 0 ? 'Fix cap' : 'Review setup',
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
          ? `${activeParticipantCount} participants are tracked across League Office.`
          : 'A league becomes usable once the competing teams or players are in the record.',
      href: '#league-setup-form',
      cta: activeParticipantCount > 0 ? 'Review participants' : 'Add participants',
      complete: activeParticipantCount > 0,
    },
    {
      label: 'Season window',
      title: records.length > 0 && scheduleCapacityIssueCount === 0 ? 'Season capacity is clear' : 'Check season capacity',
      detail: scheduleReadinessDetail,
      href: '#league-setup-form',
      cta: scheduleCapacityIssueCount > 0 ? 'Fix cap' : 'Review setup',
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
      href: records.length > 0 ? '/leagues' : '#league-setup-form',
      cta: records.length > 0 ? 'View public leagues' : 'Create first',
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

  async function issueLeagueAward(league: TiqLeagueRecord, candidate: TiqLeagueAwardCandidate) {
    if (!candidate.recipientName) {
      setStatus('Add league results before creating this award.')
      return
    }

    const result = await saveTiqAwardRecordForUser({
      sourceType: 'league',
      sourceId: league.id,
      sourceName: league.leagueName,
      recipientName: candidate.recipientName,
      recipientPlayerId: candidate.recipientPlayerId,
      placement: candidate.placement,
      title: candidate.label,
      subtitle: [league.seasonLabel, league.flight, league.locationLabel].filter(Boolean).join(' | ') || 'League season finish',
      coordinatorName: '',
      notes: league.notes,
    }, userId)

    setLeagueAwardRefresh((current) => current + 1)
    setStatus(
      result.data
        ? `${candidate.label} award created for ${candidate.recipientName}.`
        : 'That league award could not be created yet.',
    )
  }

  const responsivePageWrap = isMobile ? { ...pageWrap, ...mobilePageWrap } : pageWrap
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
  const sharedSchedulerItems = [
    {
      label: 'Schedule',
      value: records.length ? `${scheduleReadyLeagueCount}/${records.length}` : 'Setup first',
      ready: records.length > 0 && scheduleCapacityIssueCount === 0 && scheduleReadyLeagueCount === records.length,
    },
    {
      label: 'Requests',
      value: pendingEntryRequestCount ? `${pendingEntryRequestCount} pending` : 'Clear',
      ready: pendingEntryRequestCount === 0,
    },
    {
      label: 'Results',
      value: hasResultReadyLeague ? `${resultQueueItemCount} cues` : 'After setup',
      ready: hasResultReadyLeague && resultQueueItemCount === 0,
    },
  ]
  const sharedSchedulerNextMove =
    records.length === 0
      ? {
          label: 'Create the season shell',
          detail: 'Add the first league before dates or scores can land on the shared calendar.',
          href: '#league-setup-form',
          cta: 'Add league',
        }
      : scheduleCapacityIssueCount > 0
        ? {
            label: 'Fix the season capacity',
            detail: `${scheduleCapacityIssueCount} league${scheduleCapacityIssueCount === 1 ? '' : 's'} need a larger match-event cap before scheduling is clean.`,
            href: '#league-setup-form',
            cta: 'Fix cap',
          }
        : pendingEntryRequestCount > 0
          ? {
              label: 'Approve waiting participants',
              detail: `${pendingEntryRequestCount} request${pendingEntryRequestCount === 1 ? '' : 's'} should be handled before the schedule is trusted.`,
              href: '#league-registry',
              cta: 'Review requests',
            }
          : !hasResultReadyLeague
            ? {
                label: 'Finish setup for results',
                detail: 'A saved league with participants opens the result books and shared season path.',
                href: '#league-setup-form',
                cta: 'Finish setup',
              }
            : resultQueueItemCount > 0
              ? {
                  label: 'Clear result review cues',
                  detail: resultQueueHeadline,
                  href: resultEntryHref,
                  cta: 'Review results',
                }
              : {
                  label: 'Scheduler is current',
                  detail: 'Schedule, approvals, and result books are ready for season review.',
                  href: '/compete/schedule',
                  cta: 'Open calendar',
                }
  const schedulingPlanRows = buildTiqLeagueSchedulingPlanRows(draft)
  const schedulingHandoffSummary = getTiqLeagueSchedulingHandoffSummary(draft)
  const participantOptions = draft.leagueFormat === 'team' ? knownTeamOptions : knownPlayerOptions
  const participantDatalistId = draft.leagueFormat === 'team' ? 'tiq-known-team-options' : 'tiq-known-player-options'

  return (
      <section style={responsivePageWrap}>
        {storageWarning ? <div style={statusBanner}>{storageWarning}</div> : null}

        <section style={startPanelStyle}>
          <span aria-hidden="true" style={portalWatermarkStyle} />
          <div style={portalPanelContentStyle}>
            <div style={leagueOpsHeaderStyle}>
              <div style={leagueOpsHeaderCopyStyle}>
                <div style={sectionEyebrow}>Start here</div>
                <h1 style={leagueOpsTitleStyle}>
                  {access.canUseLeagueTools
                    ? records.length > 0
                      ? 'Your next League Office move is ready.'
                      : 'Set up the first League Office workspace.'
                    : 'Unlock League access to save League Office workspaces.'}
                </h1>
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
              <div style={leagueOpsHeaderCopyStyle}>
                <span style={startActionLabelStyle}>Next action</span>
                <strong style={startActionTitleStyle}>{nextLeagueOpsStep.label}</strong>
              </div>
              <GhostLink href={nextLeagueOpsStep.href}>{nextLeagueOpsStep.cta}</GhostLink>
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
          </div>
        </section>

        <section id="shared-calendar" style={commandCard}>
          <span aria-hidden="true" style={portalWatermarkStyle} />
          <div style={portalPanelContentStyle}>
            <div>
              <div style={sectionEyebrow}>League Office</div>
              <h2 style={sectionTitle}>{records.length ? 'Your season workspace is ready.' : 'Create the first League Office workspace.'}</h2>
              <p style={sectionText}>
                Approve players, keep the schedule visible, collect scores, review uploads, and let standings update around the season.
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
                <span style={commandText}>Waiting for review</span>
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
            <div style={sharedCalendarStripStyle} aria-label="Shared league scheduler">
              <div style={sharedCalendarStripCopyStyle}>
                <div style={sectionEyebrow}>Shared scheduler</div>
                <strong>Dates, confirmations, and scores stay in one lane.</strong>
              </div>
              <div style={sharedCalendarReadinessGridStyle}>
                {sharedSchedulerItems.map((item) => (
                  <div key={item.label} style={sharedCalendarReadinessItemStyle}>
                    <span style={item.ready ? readinessDotStyle : readinessDotMutedStyle} />
                    <strong>{item.label}</strong>
                    <em>{item.value}</em>
                  </div>
                ))}
              </div>
              <Link href={sharedSchedulerNextMove.href} style={sharedCalendarNextMoveStyle}>
                <span style={sharedCalendarNextLabelStyle}>Next</span>
                <span style={sharedCalendarNextCopyStyle}>
                  <strong>{sharedSchedulerNextMove.label}</strong>
                  <small>{sharedSchedulerNextMove.detail}</small>
                </span>
                <em>{sharedSchedulerNextMove.cta}</em>
              </Link>
              <div style={sharedCalendarStepGridStyle}>
                <GhostLink href="#league-setup-form">Pending dates</GhostLink>
                <GhostLink href="/compete/schedule">Confirmed calendar</GhostLink>
                <GhostLink href={resultEntryHref}>Post results</GhostLink>
              </div>
            </div>
          </div>
        </section>

        <details style={dataAssistOpsPanelStyle}>
          <summary style={responsiveDetailsSummary}>
            <div style={leagueOpsHeaderCopyStyle}>
              <div style={sectionEyebrow}>{DATA_ASSIST_STORY.eyebrow}</div>
              <h2 style={leagueOpsTitleStyle}>Data refresh path</h2>
              <p style={leagueOpsTextStyle}>Open when schedules, rosters, or scorecards need to refresh the season.</p>
            </div>
            <GhostLink href={DATA_ASSIST_STORY.href}>{DATA_ASSIST_STORY.cta}</GhostLink>
          </summary>
          <div style={leagueOpsHeaderStyle}>
            <div style={leagueOpsHeaderCopyStyle}>
              <div style={sectionEyebrow}>{DATA_ASSIST_STORY.eyebrow}</div>
              <h2 style={leagueOpsTitleStyle}>Use uploads to refresh the season.</h2>
              <p style={leagueOpsTextStyle}>
                {DATA_ASSIST_STORY.shortCue} Setup stays reviewable; Data Assist brings in schedules, rosters, and official scorecards when the season changes.
              </p>
            </div>
            <GhostLink href={DATA_ASSIST_STORY.href}>{DATA_ASSIST_STORY.cta}</GhostLink>
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
        </details>

        <details id="league-public-pages" style={publicReadinessPanelStyle}>
          <summary style={responsiveDetailsSummary}>
            <div style={leagueOpsHeaderCopyStyle}>
              <div style={sectionEyebrow}>Public page readiness</div>
              <h2 style={leagueOpsTitleStyle}>
                {records.length === 0
                  ? 'Public pages unlock after setup.'
                  : publicPageNeedsWorkCount > 0
                    ? `${publicPageNeedsWorkCount} page${publicPageNeedsWorkCount === 1 ? '' : 's'} need data.`
                    : 'Public pages are ready.'}
              </h2>
            </div>
            <span style={publicPageNeedsWorkCount > 0 ? pillSlate : pillGreen}>
              {records.length === 0 ? 'Setup first' : `${publicReadyLeagueCount}/${records.length} ready`}
            </span>
          </summary>
          <div style={leagueOpsHeaderStyle}>
            <div style={leagueOpsHeaderCopyStyle}>
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
            <EmptyPublicReadinessPanel hasLeagueRows={publicPageReadinessRows.length > 0} />
          )}
        </details>

        <details style={reviewQueuePanelStyle}>
          <summary style={responsiveDetailsSummary}>
            <div style={leagueOpsHeaderCopyStyle}>
              <div style={sectionEyebrow}>Result review queue</div>
              <h2 style={leagueOpsTitleStyle}>{resultQueueHeadline}</h2>
            </div>
            <span style={resultQueueItemCount > 0 ? pillSlate : pillGreen}>
              {resultQueueItemCount > 0 ? 'Review needed' : 'In shape'}
            </span>
          </summary>
          <div style={leagueOpsHeaderStyle}>
            <div style={leagueOpsHeaderCopyStyle}>
              <div style={sectionEyebrow}>Result review queue</div>
              <h2 style={leagueOpsTitleStyle}>{resultQueueHeadline}</h2>
              <p style={leagueOpsTextStyle}>
                Use the correct workspace: Team Results for team match events and line scores; Player Results for individual matches. Reviewed Data Assist scorecards can support updates before standings move.
              </p>
            </div>
            <span style={resultQueueItemCount > 0 ? pillSlate : pillGreen}>
              {resultQueueItemCount > 0 ? 'Review needed' : 'In shape'}
            </span>
          </div>
          <div style={resultHandoffGridStyle}>
            {RESULT_ENTRY_HANDOFF_STEPS.map((step) => (
              <div key={step.title} style={resultHandoffStepStyle}>
                <strong>{step.title}</strong>
                <span>{step.text}</span>
              </div>
            ))}
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
                  : 'Create a team league before opening Team Results. Team result entry needs teams, match date, line winners, and scores.'}
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
                  : 'Create an individual league before opening Player Results. Player result entry needs two players, result date, winner, and score.'}
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
                Manual edits and reviewed Data Assist scorecards stay visible here so a coordinator can double-check standings after edited scores.
              </div>
              <div style={responsiveButtonRowStyle}>
                <GhostLink href={individualLeagues.length > 0 ? individualResultEntryHref : resultEntryHref}>
                  Open review
                </GhostLink>
              </div>
            </div>
          </div>
        </details>

        {teamLeagues.length > 0 ? (
          <section style={resultBookPanelStyle}>
            <div style={leagueOpsHeaderStyle}>
              <div style={leagueOpsHeaderCopyStyle}>
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
                          : 'Standings start after results'}
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
              <div style={leagueOpsHeaderCopyStyle}>
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

        {leagueAwardRows.length > 0 ? (
          <section style={leagueAwardPanelStyle}>
            <div style={leagueOpsHeaderStyle}>
              <div style={leagueOpsHeaderCopyStyle}>
                <div style={sectionEyebrow}>League award studio</div>
                <h2 style={leagueOpsTitleStyle}>Turn standings into certificates.</h2>
                <p style={leagueOpsTextStyle}>
                  Issue 1st, 2nd, and 3rd place league honors from team standings or individual results, then share the certificate or send players into their trophy case.
                </p>
              </div>
              <span style={pillGreen}>Awards</span>
            </div>
            <div style={leagueAwardGridStyle}>
              {leagueAwardRows.slice(0, 4).map((row) => (
                <div key={row.league.id} style={leagueAwardCardStyle}>
                  <div style={registryMetaRow}>
                    <span style={row.mode === 'Team' ? pillGreen : pillBlue}>{row.mode} league</span>
                    <span style={row.issuedAwards.length ? pillGreen : pillSlate}>
                      {row.issuedAwards.length ? `${row.issuedAwards.length} issued` : 'Ready'}
                    </span>
                  </div>
                  <div style={registryTitle}>{row.league.leagueName}</div>
                  <div style={registryText}>
                    {[row.league.seasonLabel, row.league.flight, row.league.locationLabel].filter(Boolean).join(' | ') || 'League season'}
                  </div>
                  <div style={leagueAwardCandidateGridStyle}>
                    {row.candidates.map((candidate) => {
                      const issuedAward = row.issuedAwards.find((award) => award.placement === candidate.placement)
                      return (
                        <div key={`${row.league.id}-${candidate.placement}`} style={leagueAwardCandidateStyle}>
                          <div style={leagueAwardCandidateCopyStyle}>
                            <span style={pillSlate}>{candidate.label}</span>
                            <strong>{candidate.recipientName || 'Needs results'}</strong>
                            <small>{candidate.helperText}</small>
                          </div>
                          {issuedAward ? (
                            <div style={responsiveButtonRowStyle}>
                              <GhostLink href={`/awards/${encodeURIComponent(issuedAward.id)}`}>Certificate</GhostLink>
                              <GhostLink href={buildLeagueAwardMailto(issuedAward)}>Email</GhostLink>
                              {issuedAward.recipientPlayerId ? (
                                <GhostLink href={`/players/${encodeURIComponent(issuedAward.recipientPlayerId)}#profile-trophy-case`}>
                                  Trophy case
                                </GhostLink>
                              ) : null}
                            </div>
                          ) : (
                            <GhostBtn onClick={() => void issueLeagueAward(row.league, candidate)}>
                              Create award
                            </GhostBtn>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section style={leagueOpsPanelStyle}>
          <div style={leagueOpsHeaderStyle}>
            <div style={leagueOpsHeaderCopyStyle}>
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
        </section>

        <div style={responsiveLayoutGrid}>
          <details
            id="league-setup-form"
            style={responsivePanelCard}
            open={setupOpen || !!editingId || records.length === 0}
            onToggle={(event) => setSetupOpen(event.currentTarget.open)}
          >
            <summary style={responsiveDetailsSummary}>
              <div style={leagueOpsHeaderCopyStyle}>
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
                  <option value="coordinator_fixed">League Office sets schedule</option>
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
                <div style={leagueOpsHeaderCopyStyle}>
                  <div style={sectionEyebrow}>Season calendar</div>
                  <strong style={setupAssistTitleStyle}>
                    {draft.schedulingMode === 'player_arranged'
                      ? 'Player-arranged scheduling preview'
                      : 'League Office-published schedule preview'}
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
                Use known names when available, or paste reviewed roster names from Data Assist. Custom names are allowed; League Office approval keeps join requests from turning into active participants automatically.
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
                <div style={leagueOpsHeaderCopyStyle}>
                  <div style={nextActionTitleStyle}>
                    Next: review {lastSavedRecord.leagueName}
                  </div>
                  <div style={nextActionTextStyle}>
                    {lastSavedRecord.leagueFormat === 'team'
                      ? 'Next, open Team Results to add match date, teams, line winners, and scores. Use Data Assist scorecards only after review.'
                      : 'Next, open Player Results to add players, result date, winner, and score. Use reviewed scorecards when available.'}
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
                <span style={pillSlate}>League Office approval required</span>
              </div>
              <div style={registryTitle}>Join requests</div>
              <div style={registryText}>
                Public and private leagues both require approval before a team or player becomes an active participant.
              </div>
              {entryRequestStatus ? <div style={statusBanner}>{entryRequestStatus}</div> : null}
              {pendingEntryRequestCount === 0 ? (
                <EmptyJoinRequestPanel />
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
                        <div style={requestCardContentStyle}>
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
              <EmptyLeagueRegistryPanel />
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
  )
}

function buildIndividualLeagueAwardFinishers(
  league: TiqLeagueRecord,
  results: TiqIndividualLeagueResultRecord[],
) {
  const records = new Map<string, { name: string; playerId: string; wins: number; losses: number }>()

  for (const playerName of league.players) {
    if (!records.has(playerName.toLowerCase())) {
      records.set(playerName.toLowerCase(), { name: playerName, playerId: '', wins: 0, losses: 0 })
    }
  }

  for (const result of results) {
    const players = [
      { name: result.playerAName, id: result.playerAId },
      { name: result.playerBName, id: result.playerBId },
    ]

    for (const player of players) {
      const key = player.name.toLowerCase()
      if (!records.has(key)) {
        records.set(key, { name: player.name, playerId: player.id, wins: 0, losses: 0 })
      } else if (player.id) {
        records.get(key)!.playerId = player.id
      }
    }

    const winnerKey = result.winnerPlayerName.toLowerCase()
    const loserName = result.winnerPlayerName === result.playerAName ? result.playerBName : result.playerAName
    const loserKey = loserName.toLowerCase()
    if (records.has(winnerKey)) records.get(winnerKey)!.wins += 1
    if (records.has(loserKey)) records.get(loserKey)!.losses += 1
  }

  return [...records.values()]
    .filter((record) => record.wins > 0 || record.losses > 0)
    .sort((left, right) => {
      if (right.wins !== left.wins) return right.wins - left.wins
      if (left.losses !== right.losses) return left.losses - right.losses
      return left.name.localeCompare(right.name)
    })
    .slice(0, 3)
    .map((record) => ({
      recipientName: record.name,
      recipientPlayerId: record.playerId,
      detail: `${record.wins}-${record.losses}`,
    }))
}

function buildLeagueAwardMailto(award: TiqAwardRecord) {
  const certificateUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/awards/${encodeURIComponent(award.id)}`
      : `/awards/${encodeURIComponent(award.id)}`
  const subject = encodeURIComponent(`TenAceIQ ${award.badgeLabel}: ${award.recipientName}`)
  const body = encodeURIComponent(`${buildTiqAwardCertificateText(award)}\n\nCertificate: ${certificateUrl}`)

  return `mailto:?subject=${subject}&body=${body}`
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

function EmptyLeagueRegistryPanel() {
  return (
    <div style={emptyRegistryPanelStyle}>
      <div style={emptyRegistryCopyStyle}>
        <strong>League operations start with one season shell.</strong>
        <span>Create a team or individual league, then bring in schedules, rosters, scorecards, and public pages from the same League Office.</span>
      </div>
      <div style={emptyRegistryActionRowStyle}>
        {emptyLeagueRegistryActions.map((action) => (
          <Link key={action.href} href={action.href} style={emptyRegistryActionStyle}>
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function EmptyPublicReadinessPanel({ hasLeagueRows }: { hasLeagueRows: boolean }) {
  return (
    <div style={emptyPublicReadinessPanelStyle}>
      <div style={emptyPublicReadinessCopyStyle}>
        <strong>{hasLeagueRows ? 'No pages match this view.' : 'Public pages start after one league is saved.'}</strong>
        <span>
          {hasLeagueRows
            ? 'Switch the readiness filter or add the missing participants and results before sharing the league room.'
            : 'Create the league shell, add participants, then use Data Assist or the result books to make the public page useful.'}
        </span>
      </div>
      <div style={emptyPublicReadinessActionRowStyle}>
        {(hasLeagueRows ? [{ href: '#league-public-pages', label: 'Show all pages' }, ...emptyPublicReadinessActions.slice(1)] : emptyPublicReadinessActions).map((action) => (
          <Link key={action.href} href={action.href} style={emptyPublicReadinessActionStyle}>
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function EmptyJoinRequestPanel() {
  return (
    <div style={emptyJoinRequestPanelStyle}>
      <div style={emptyJoinRequestCopyStyle}>
        <strong>No join requests are waiting.</strong>
        <span>Keep the league room shareable, confirm the setup is clear, then approve teams or players as requests arrive.</span>
      </div>
      <div style={emptyJoinRequestActionRowStyle}>
        {emptyJoinRequestActions.map((action) => (
          <Link key={action.href} href={action.href} style={emptyJoinRequestActionStyle}>
            {action.label}
          </Link>
        ))}
      </div>
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
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  padding: '18px 0 64px',
  display: 'grid',
  gap: '18px',
  minWidth: 0,
  overflowX: 'clip',
  boxSizing: 'border-box',
}

const mobilePageWrap: CSSProperties = {
  width: 'calc(100% - clamp(20px, 5vw, 28px))',
  padding: '14px 0 48px',
  gap: '14px',
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
  overflowWrap: 'anywhere',
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
  minWidth: 0,
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
  borderRadius: '26px',
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(4,10,24,0.9))',
  boxShadow: '0 26px 78px rgba(2, 8, 23, 0.42), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  position: 'relative',
  overflow: 'hidden',
}

const commandGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: '12px',
  minWidth: 0,
}

const commandTile: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '16px',
  borderRadius: '20px',
  border: '1px solid rgba(125,211,252,0.13)',
  background: 'rgba(8, 16, 34, 0.72)',
  minWidth: 0,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const commandLabel: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const commandValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '26px',
  fontWeight: 950,
  lineHeight: 1.05,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const commandText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
}

const sharedCalendarStripStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: '12px',
  alignItems: 'center',
  minWidth: 0,
  padding: '14px',
  borderRadius: '20px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 20%, var(--shell-panel-border) 80%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
}

const sharedCalendarStripCopyStyle: CSSProperties = {
  display: 'grid',
  gap: '5px',
  minWidth: 0,
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const sharedCalendarReadinessGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))',
  gap: '8px',
  minWidth: 0,
}

const sharedCalendarReadinessItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: '2px 7px',
  alignItems: 'center',
  minWidth: 0,
  padding: '9px',
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(8,16,34,0.38)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const readinessDotStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'var(--brand-lime)',
  boxShadow: '0 0 0 4px rgba(155,225,29,0.10)',
}

const readinessDotMutedStyle: CSSProperties = {
  ...readinessDotStyle,
  background: 'rgba(116,190,255,0.46)',
  boxShadow: '0 0 0 4px rgba(116,190,255,0.08)',
}

const sharedCalendarNextMoveStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gap: '10px',
  alignItems: 'center',
  minWidth: 0,
  padding: '11px',
  borderRadius: '16px',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-lime) 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const sharedCalendarNextLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 28,
  padding: '0 9px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.28)',
  color: 'var(--brand-lime)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const sharedCalendarNextCopyStyle: CSSProperties = {
  display: 'grid',
  gap: '3px',
  minWidth: 0,
  fontSize: '13px',
  lineHeight: 1.35,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const sharedCalendarStepGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 135px), 1fr))',
  gap: '8px',
  minWidth: 0,
}

const leagueOpsPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 18%, var(--shell-panel-border) 82%)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const resultBookPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 18%, var(--shell-panel-border) 82%)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const leagueAwardPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.09), rgba(8,18,36,0.92) 46%, rgba(116,190,255,0.07))',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const leagueAwardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: '12px',
  minWidth: 0,
}

const leagueAwardCardStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
  alignContent: 'start',
  minWidth: 0,
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(8,16,34,0.72)',
  overflowWrap: 'anywhere',
}

const leagueAwardCandidateGridStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
  minWidth: 0,
}

const leagueAwardCandidateStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  alignItems: 'center',
  gap: '10px',
  minWidth: 0,
  padding: '10px',
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  overflowWrap: 'anywhere',
}

const leagueAwardCandidateCopyStyle: CSSProperties = {
  display: 'grid',
  gap: '5px',
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 800,
}

const startPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '26px',
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(4,10,24,0.9))',
  boxShadow: '0 26px 78px rgba(2, 8, 23, 0.42), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  position: 'relative',
  overflow: 'hidden',
}

const portalWatermarkStyle: CSSProperties = {
  position: 'absolute',
  right: '-72px',
  top: '-88px',
  width: '260px',
  aspectRatio: '1 / 1',
  borderRadius: '999px',
  border: '28px solid rgba(155,225,29,0.07)',
  boxShadow: 'inset 0 0 0 2px rgba(125,211,252,0.05), 0 0 70px rgba(125,211,252,0.08)',
  opacity: 0.72,
  pointerEvents: 'none',
}

const portalPanelContentStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '14px',
  minWidth: 0,
}

const reviewQueuePanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-border) 82%)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const publicReadinessPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 18%, var(--shell-panel-border) 82%)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const dataAssistOpsPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 20%, var(--shell-panel-border) 80%)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const dataAssistOpsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: '12px',
  minWidth: 0,
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
  overflowWrap: 'anywhere',
}

const resultHandoffGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: '10px',
  minWidth: 0,
}

const resultHandoffStepStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  padding: '13px',
  borderRadius: '16px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 20%, var(--shell-panel-border) 80%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.45,
  fontWeight: 750,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const reviewQueueGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: '12px',
  minWidth: 0,
}

const publicReadinessGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
  gap: '12px',
  minWidth: 0,
}

const publicReadinessFilterRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  minWidth: 0,
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
  overflowWrap: 'anywhere',
  textAlign: 'center',
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
  overflowWrap: 'anywhere',
}

const publicReadinessCheckGridStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  minWidth: 0,
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
  overflowWrap: 'anywhere',
}

const reviewCueTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  fontWeight: 900,
  lineHeight: 1.25,
  overflowWrap: 'anywhere',
}

const resultBookGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))',
  gap: '12px',
  minWidth: 0,
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
  minWidth: 0,
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
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const leagueOpsHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const leagueOpsHeaderCopyStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  minWidth: 0,
  overflowWrap: 'anywhere',
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
  overflowWrap: 'anywhere',
}

const leagueOpsScoreStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  justifyItems: 'end',
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 900,
  minWidth: 0,
  overflowWrap: 'anywhere',
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
  minWidth: 0,
  maxWidth: '100%',
}

const leagueOpsFillStyle = (value: number): CSSProperties => ({
  display: 'block',
  height: '100%',
  width: `${Math.max(0, Math.min(value, 100))}%`,
  borderRadius: '999px',
  background: 'linear-gradient(90deg, var(--brand-green), var(--brand-lime))',
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
  overflowWrap: 'anywhere',
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

const startCardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: '10px',
  minWidth: 0,
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
  overflowWrap: 'anywhere',
}

const leagueOpsCheckGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: '10px',
  minWidth: 0,
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
  overflowWrap: 'anywhere',
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
  background: 'var(--shell-panel-bg-strong)',
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
  minWidth: 0,
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
  overflowWrap: 'anywhere',
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
  minWidth: 0,
}

const outcomeInfoGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: '12px',
  minWidth: 0,
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
  overflowWrap: 'anywhere',
}

const setupAssistTextStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const calendarGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
  gap: '10px',
  minWidth: 0,
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
  overflowWrap: 'anywhere',
}

const calendarDateStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const calendarMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  lineHeight: 1.45,
  fontWeight: 700,
  overflowWrap: 'anywhere',
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
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
  overflowWrap: 'anywhere',
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
  overflowWrap: 'anywhere',
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
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const fileInputStyle: CSSProperties = {
  width: '100%',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  minWidth: 0,
  overflowWrap: 'anywhere',
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
  overflowWrap: 'anywhere',
}

const statusBanner: CSSProperties = {
  padding: '12px 14px',
  borderRadius: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 700,
  minWidth: 0,
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
  overflowWrap: 'anywhere',
}

const nextActionTextStyle: CSSProperties = {
  marginTop: '4px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
}

const nextActionButtonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  justifyContent: 'flex-end',
  minWidth: 0,
}

const buttonRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  minWidth: 0,
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
  padding: '0 16px',
  borderRadius: '999px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  cursor: 'pointer',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  textAlign: 'center',
  overflowWrap: 'anywhere',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
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
  minWidth: 0,
  whiteSpace: 'normal',
  textAlign: 'center',
  overflowWrap: 'anywhere',
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
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const emptyRegistryPanelStyle: CSSProperties = {
  ...emptyCard,
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const emptyRegistryCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const emptyRegistryActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const emptyRegistryActionStyle: CSSProperties = {
  ...ghostButton,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const emptyPublicReadinessPanelStyle: CSSProperties = {
  ...emptyCard,
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const emptyPublicReadinessCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const emptyPublicReadinessActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const emptyPublicReadinessActionStyle: CSSProperties = {
  ...ghostButton,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const emptyJoinRequestPanelStyle: CSSProperties = {
  ...emptyCard,
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const emptyJoinRequestCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const emptyJoinRequestActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const emptyJoinRequestActionStyle: CSSProperties = {
  ...ghostButton,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const stackList: CSSProperties = {
  display: 'grid',
  gap: '12px',
  minWidth: 0,
}

const registryCard: CSSProperties = {
  display: 'grid',
  gap: '10px',
  padding: '18px',
  borderRadius: '22px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
  overflowWrap: 'anywhere',
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
  minWidth: 0,
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
  minWidth: 0,
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

const requestCardContentStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const registryTimestamp: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 700,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const noteCard: CSSProperties = {
  padding: '16px 18px',
  borderRadius: '20px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-panel-bg) 92%)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}
