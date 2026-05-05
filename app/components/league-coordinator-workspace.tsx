'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import CoordinatorSubnav from '@/app/components/coordinator-subnav'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import SiteShell from '@/app/components/site-shell'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { getClientAuthState } from '@/lib/auth'
import { LEAGUE_COORDINATOR_STORY } from '@/lib/product-story'
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
  parseRegistryListInput,
  type TiqLeagueDraft,
  type TiqLeagueRecord,
} from '@/lib/tiq-league-registry'
import { type UserRole } from '@/lib/roles'
import {
  listTiqLeagues,
  removeTiqLeague,
  saveTiqLeague,
  type TiqLeagueStorageSource,
} from '@/lib/tiq-league-service'
import { cleanText as safeText } from '@/lib/captain-formatters'
import { formatDynamicPointsForSides } from '@/lib/tiq-scoring'

const EMPTY_DRAFT: TiqLeagueDraft = {
  leagueFormat: 'team',
  individualCompetitionFormat: 'standard',
  scoringSystem: 'standard',
  leagueName: '',
  seasonLabel: '',
  flight: '',
  locationLabel: '',
  photoUrl: '',
  captainTeamName: '',
  notes: '',
  teams: [],
  players: [],
}

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
  const requestedEditLeagueId = searchParams.get('leagueId') || searchParams.get('league_id') || ''
  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [records, setRecords] = useState<TiqLeagueRecord[]>([])
  const [draft, setDraft] = useState<TiqLeagueDraft>(EMPTY_DRAFT)
  const [teamListInput, setTeamListInput] = useState('')
  const [playerListInput, setPlayerListInput] = useState('')
  const [editingId, setEditingId] = useState('')
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
  const latestRecord = [...records].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0]
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
    setEditingId('')
    setPhotoUploadStatus('')
    if (clearHandoff) setLastSavedRecord(null)
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
      teams: draft.leagueFormat === 'team' ? parsedTeams : [],
      players: draft.leagueFormat === 'individual' ? parsedPlayers : [],
    }

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

  const startEditing = useCallback((record: TiqLeagueRecord, options: { scrollToForm?: boolean } = {}) => {
    setEditingId(record.id)
    setDraft({
      leagueFormat: record.leagueFormat,
      individualCompetitionFormat: record.individualCompetitionFormat,
      scoringSystem: record.scoringSystem,
      leagueName: record.leagueName,
      seasonLabel: record.seasonLabel,
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
    setLastSavedRecord(null)
    setStatus(`Editing ${record.leagueName}.`)
    if (options.scrollToForm) {
      window.requestAnimationFrame(() => {
        document.getElementById('league-setup-form')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      })
    }
  }, [])

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

  return (
    <SiteShell active={activeRoute}>
      <section style={pageWrap}>
        <div style={heroCard}>
          <div style={heroEyebrow}>{LEAGUE_COORDINATOR_STORY.eyebrow}</div>
          <h1 style={heroTitle}>{LEAGUE_COORDINATOR_STORY.headline}</h1>
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

          <div style={heroActionRow}>
            <GhostLink href={resultEntryHref}>Record results</GhostLink>
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
            <div style={startScoreStyle}>
              <span>{leagueOpsReadinessScore}% ready</span>
              <span style={leagueOpsTrackStyle}>
                <span style={leagueOpsFillStyle(leagueOpsReadinessScore)} />
              </span>
            </div>
          </div>

          <div style={startActionRowStyle}>
            <div>
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
        </section>

        <section style={commandCard}>
          <div>
            <div style={sectionEyebrow}>League command center</div>
            <h2 style={sectionTitle}>{records.length ? 'Your TIQ league system is active.' : 'Create the first league.'}</h2>
            <p style={sectionText}>
              Keep setup simple: create the league, add participants, record results, then let standings and schedules tell the story.
            </p>
          </div>
          <div style={commandGrid}>
            <div style={commandTile}>
              <span style={commandLabel}>Leagues</span>
              <strong style={commandValue}>{records.length}</strong>
              <span style={commandText}>{teamLeagues.length} team - {individualLeagues.length} individual</span>
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
          <div style={heroActionRow}>
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

          {publicPageReadinessRows.length > 0 ? (
            <div style={publicReadinessGridStyle}>
              {publicPageReadinessRows.slice(0, 4).map((row) => (
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
                  <div style={buttonRow}>
                    <GhostLink href={buildTiqLeaguePageHref(row.league)}>View public</GhostLink>
                    <GhostLink href={buildLeagueResultEntryHref(row.league)}>{getLeagueResultEntryLabel(row.league)}</GhostLink>
                    <GhostLink href={buildLeagueSetupHref(row.league)}>Manage</GhostLink>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={emptyCard}>No TIQ league pages are ready yet. Save a team or individual league to start.</div>
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
              <div style={buttonRow}>
                <GhostLink href={teamLeagues.length > 0 ? teamResultEntryHref : '#league-setup-form'}>
                  {teamLeagues.length > 0 ? 'Review team results' : 'Add team league'}
                </GhostLink>
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
              <div style={buttonRow}>
                <GhostLink href={individualLeagues.length > 0 ? individualResultEntryHref : '#league-setup-form'}>
                  {individualLeagues.length > 0 ? 'Review player results' : 'Add individual league'}
                </GhostLink>
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
              <div style={buttonRow}>
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
                  <div style={buttonRow}>
                    <GhostLink href={buildTeamResultEntryHref(row.league.id)}>Open Team Results</GhostLink>
                    <GhostLink href={`/explore/leagues/tiq/${encodeURIComponent(row.league.id)}?league_id=${encodeURIComponent(row.league.id)}`}>
                      League page
                    </GhostLink>
                  </div>
                </div>
              ))}
            </div>
            <div style={heroActionRow}>
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
                  <div style={buttonRow}>
                    <GhostLink href={buildIndividualResultEntryHref(row.league.id)}>Open Player Results</GhostLink>
                    <GhostLink href={`/explore/leagues/tiq/${encodeURIComponent(row.league.id)}?league_id=${encodeURIComponent(row.league.id)}`}>
                      League page
                    </GhostLink>
                  </div>
                </div>
              ))}
            </div>
            <div style={heroActionRow}>
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
            <div style={leagueOpsScoreStyle}>
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
          <div style={heroActionRow}>
            <GhostLink href={nextLeagueOpsStep.href}>{nextLeagueOpsStep.cta}</GhostLink>
            {latestTeamLeague ? <GhostLink href={teamResultEntryHref}>Team results</GhostLink> : null}
            {latestIndividualLeague ? <GhostLink href={individualResultEntryHref}>Individual results</GhostLink> : null}
            {!hasResultReadyLeague ? <GhostLink href={resultEntryHref}>Record results</GhostLink> : null}
          </div>
        </section>

        <div style={layoutGrid}>
          <details id="league-setup-form" style={panelCard} open={!!editingId || records.length === 0}>
            <summary style={detailsSummary}>
              <div>
                <div style={sectionEyebrow}>{editingId ? 'Editing' : 'Setup'}</div>
                <h2 style={sectionTitle}>
                  {editingId ? 'Edit league setup' : 'Add a league'}
                </h2>
                <p style={sectionText}>
                  Use only the fields needed to create the structure. Results and rankings come later.
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

            <div style={fieldGrid}>
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
                <input
                  value={draft.seasonLabel}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, seasonLabel: event.target.value }))
                  }
                  placeholder="Spring 2026"
                  style={inputStyle}
                />
              </label>

              <label style={fieldLabel}>
                <span>Flight or tier</span>
                <input
                  value={draft.flight}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, flight: event.target.value }))
                  }
                  placeholder="4.0 / Advanced / Open"
                  style={inputStyle}
                />
              </label>

              <label style={fieldLabel}>
                <span>Location / market</span>
                <input
                  value={draft.locationLabel}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, locationLabel: event.target.value }))
                  }
                  placeholder="Dallas Indoor"
                  style={inputStyle}
                />
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

              <label style={fieldLabel}>
                <span>Organizer / owner</span>
                <input
                  value={draft.captainTeamName}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, captainTeamName: event.target.value }))
                  }
                  placeholder="North Dallas Aces"
                  style={inputStyle}
                />
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
                  <option value="standard">Standard wins</option>
                  <option value="dynamic_points">Dynamic points</option>
                </select>
                <span style={fieldHelpText}>
                  {getTiqLeagueScoringSystemDescription(draft.scoringSystem)}
                </span>
              </label>
            </div>

            <label style={fieldLabel}>
              <span>{draft.leagueFormat === 'team' ? 'Teams' : 'Players'}</span>
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

            {status ? <div style={statusBanner}>{status}</div> : null}
            {lastSavedRecord ? (
              <div style={nextActionCardStyle}>
                <div>
                  <div style={nextActionTitleStyle}>
                    Next: review {lastSavedRecord.leagueName}
                  </div>
                  <div style={nextActionTextStyle}>
                    Use the saved setup for {lastSavedRecord.leagueFormat === 'team' ? 'team match results' : 'player results'}, or check the public league page before sharing.
                  </div>
                </div>
                <div style={nextActionButtonRowStyle}>
                  <GhostLink href={buildLeagueResultEntryHref(lastSavedRecord)}>
                    {getLeagueResultEntryLabel(lastSavedRecord)}
                  </GhostLink>
                  <GhostLink href={buildTiqLeaguePageHref(lastSavedRecord)}>
                    View public league
                  </GhostLink>
                </div>
              </div>
            ) : null}

            <div style={buttonRow}>
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

          <section id="league-registry" style={panelCard}>
            <div style={sectionEyebrow}>League registry</div>
            <h2 style={sectionTitle}>{LEAGUE_COORDINATOR_STORY.registryTitle}</h2>
            <p style={sectionText}>
              {LEAGUE_COORDINATOR_STORY.registryBody}
            </p>

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
                        <span style={pillSlate}>{record.seasonLabel || 'Season label missing'}</span>
                        <span style={pillSlate}>{getTiqLeagueScoringSystemLabel(record.scoringSystem)}</span>
                      </div>

                      <div style={registryTitle}>{record.leagueName}</div>
                      <div style={registryText}>
                        {[
                          record.leagueFormat === 'individual'
                            ? getTiqIndividualCompetitionFormatLabel(record.individualCompetitionFormat)
                            : null,
                          record.flight,
                          record.locationLabel,
                          participantLabel,
                        ]
                          .filter(Boolean)
                          .join(' | ')}
                      </div>
                      {record.notes ? <div style={registryNotes}>{record.notes}</div> : null}

                      <div style={registryFooter}>
                        <span style={registryTimestamp}>Updated {formatDateTime(record.updatedAt)}</span>
                        <div style={buttonRow}>
                          <GhostLink href={buildLeagueResultEntryHref(record)}>
                            {getLeagueResultEntryLabel(record)}
                          </GhostLink>
                          <GhostBtn onClick={() => startEditing(record)}>Edit</GhostBtn>
                          <DangerBtn onClick={() => removeRecord(record.id)}>Remove</DangerBtn>
                        </div>
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

function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      style={{
        ...ghostButton,
        ...(hovered ? { background: 'rgba(255,255,255,0.10)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(2,10,24,0.28)' } : {}),
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
        ...(hovered ? { background: 'rgba(255,255,255,0.10)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(2,10,24,0.28)' } : {}),
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
        ...(hovered && !disabled ? { transform: 'translateY(-2px)', boxShadow: '0 8px 22px rgba(155,225,29,0.30)' } : {}),
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
        ...(hovered ? { background: 'rgba(80,20,30,0.90)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(248,113,113,0.20)' } : {}),
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

const heroCard: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '28px',
  borderRadius: '30px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(16,38,70,0.78) 0%, rgba(8,19,38,0.94) 100%)',
  boxShadow: '0 28px 60px rgba(2,10,24,0.22)',
}

const heroEyebrow: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#93c5fd',
}

const heroTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontSize: '52px',
  lineHeight: 0.98,
  letterSpacing: 0,
  maxWidth: '940px',
}

const heroText: CSSProperties = {
  margin: 0,
  color: 'rgba(229,238,251,0.78)',
  fontSize: '16px',
  lineHeight: 1.75,
  maxWidth: '920px',
}

const heroPillRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
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

const pillBlue: CSSProperties = {
  ...pillBase,
  background: 'rgba(74,163,255,0.14)',
  color: '#dfeeff',
}

const pillGreen: CSSProperties = {
  ...pillBase,
  background: 'rgba(155,225,29,0.14)',
  color: '#e7ffd1',
}

const pillSlate: CSSProperties = {
  ...pillBase,
  background: 'rgba(142, 161, 189, 0.14)',
  color: '#dfe8f8',
}

const heroActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
}

const layoutGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
  gap: '18px',
}

const commandCard: CSSProperties = {
  display: 'grid',
  gap: '18px',
  padding: '24px',
  borderRadius: '28px',
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'linear-gradient(135deg, rgba(14,30,58,0.86) 0%, rgba(11,24,45,0.94) 58%, rgba(39,72,37,0.28) 100%)',
  boxShadow: '0 24px 52px rgba(2,10,24,0.18)',
}

const commandGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: '12px',
}

const commandTile: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '16px',
  borderRadius: '20px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.045)',
  minWidth: 0,
}

const commandLabel: CSSProperties = {
  color: '#93c5fd',
  fontSize: '12px',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const commandValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '26px',
  fontWeight: 950,
  lineHeight: 1.05,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const commandText: CSSProperties = {
  color: 'rgba(229,238,251,0.72)',
  fontSize: '13px',
  lineHeight: 1.5,
}

const leagueOpsPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(23,47,37,0.72) 0%, rgba(10,24,45,0.94) 68%)',
  boxShadow: '0 18px 46px rgba(2,10,24,0.16)',
}

const resultBookPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(135deg, rgba(14,30,58,0.84) 0%, rgba(10,24,45,0.94) 64%, rgba(42,84,130,0.22) 100%)',
  boxShadow: '0 18px 46px rgba(2,10,24,0.16)',
}

const startPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(18,42,36,0.82) 0%, rgba(9,22,42,0.96) 62%, rgba(53,92,42,0.22) 100%)',
  boxShadow: '0 18px 46px rgba(2,10,24,0.16)',
}

const reviewQueuePanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(20,43,37,0.82) 0%, rgba(10,24,45,0.94) 60%, rgba(42,84,130,0.20) 100%)',
  boxShadow: '0 18px 46px rgba(2,10,24,0.16)',
}

const publicReadinessPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(135deg, rgba(13,31,58,0.86) 0%, rgba(10,24,45,0.96) 62%, rgba(155,225,29,0.10) 100%)',
  boxShadow: '0 18px 46px rgba(2,10,24,0.16)',
}

const reviewQueueGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '12px',
}

const publicReadinessGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
  gap: '12px',
}

const publicReadinessCardStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
  alignContent: 'start',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.045)',
}

const publicReadinessCardReadyStyle: CSSProperties = {
  ...publicReadinessCardStyle,
  border: '1px solid rgba(74,222,128,0.20)',
  background: 'rgba(155,225,29,0.08)',
}

const publicReadinessTitleStyle: CSSProperties = {
  color: '#f8fbff',
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
  border: '1px solid rgba(155,225,29,0.12)',
  background: 'rgba(255,255,255,0.045)',
  minWidth: 0,
}

const reviewCueValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '34px',
  fontWeight: 950,
  lineHeight: 1,
}

const reviewCueTitleStyle: CSSProperties = {
  color: '#e5eefb',
  fontSize: '15px',
  fontWeight: 900,
  lineHeight: 1.25,
}

const resultBookGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: '12px',
}

const resultBookCardStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
  padding: '16px',
  borderRadius: '20px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
}

const resultBookMetricRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
}

const resultBookMetricStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  padding: '10px 12px',
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(7,17,33,0.48)',
  color: 'rgba(229,238,251,0.72)',
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
  color: '#f8fbff',
  fontSize: '24px',
  lineHeight: 1.1,
  fontWeight: 950,
}

const leagueOpsTextStyle: CSSProperties = {
  margin: '8px 0 0',
  color: 'rgba(229,238,251,0.76)',
  fontSize: '14px',
  lineHeight: 1.65,
}

const leagueOpsScoreStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  justifyItems: 'end',
  color: 'rgba(229,238,251,0.76)',
  fontSize: '12px',
  fontWeight: 900,
}

const startScoreStyle: CSSProperties = {
  ...leagueOpsScoreStyle,
  minWidth: 160,
}

const leagueOpsTrackStyle: CSSProperties = {
  height: '14px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(7,17,33,0.72)',
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
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(255,255,255,0.05)',
}

const startActionLabelStyle: CSSProperties = {
  display: 'block',
  color: '#93c5fd',
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const startActionTitleStyle: CSSProperties = {
  display: 'block',
  marginTop: '4px',
  color: '#f8fbff',
  fontSize: '18px',
  lineHeight: 1.15,
  fontWeight: 950,
}

const startCardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
  gap: '10px',
}

const startCardStyle: CSSProperties = {
  display: 'grid',
  gap: '9px',
  alignContent: 'start',
  minHeight: '166px',
  padding: '14px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.045)',
  color: '#e7eefb',
  textDecoration: 'none',
}

const startCardCompleteStyle: CSSProperties = {
  ...startCardStyle,
  border: '1px solid rgba(74,222,128,0.20)',
  background: 'rgba(155,225,29,0.08)',
}

const startCardTitleStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '16px',
  lineHeight: 1.2,
  fontWeight: 950,
}

const startCardTextStyle: CSSProperties = {
  color: 'rgba(229,238,251,0.74)',
  fontSize: '13px',
  lineHeight: 1.55,
  fontWeight: 700,
}

const startCardCtaStyle: CSSProperties = {
  alignSelf: 'end',
  color: '#d9f99d',
  fontSize: '12px',
  fontWeight: 950,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const leagueOpsCheckGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '10px',
}

const leagueOpsCheckStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  minHeight: '94px',
  padding: '12px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.045)',
  color: 'rgba(229,238,251,0.76)',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 750,
}

const leagueOpsCheckCompleteStyle: CSSProperties = {
  ...leagueOpsCheckStyle,
  border: '1px solid rgba(74,222,128,0.22)',
  background: 'rgba(155,225,29,0.10)',
  color: '#f8fbff',
}

const panelCard: CSSProperties = {
  display: 'grid',
  gap: '16px',
  padding: '24px',
  borderRadius: '28px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(14,30,58,0.82) 0%, rgba(8,18,35,0.96) 100%)',
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
  letterSpacing: 0,
}

const sectionText: CSSProperties = {
  color: 'rgba(229,238,251,0.76)',
  fontSize: '14px',
  lineHeight: 1.72,
}

const fieldGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '14px',
}

const fieldLabel: CSSProperties = {
  display: 'grid',
  gap: '8px',
  color: '#e7eefb',
  fontSize: '13px',
  fontWeight: 700,
}

const fieldHelpText: CSSProperties = {
  color: 'rgba(214,228,246,0.72)',
  fontSize: '12px',
  lineHeight: 1.6,
  fontWeight: 500,
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

const photoUploadBox: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const photoPreviewWrap: CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 7',
  overflow: 'hidden',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(255,255,255,0.05)',
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
  border: '1px dashed rgba(116,190,255,0.24)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(229,238,251,0.62)',
  fontSize: '13px',
  fontWeight: 800,
}

const fileInputStyle: CSSProperties = {
  width: '100%',
  color: 'rgba(229,238,251,0.82)',
  fontSize: '13px',
}

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: '126px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(7,17,33,0.72)',
  color: '#f8fbff',
  padding: '14px',
  outline: 'none',
  resize: 'vertical',
}

const statusBanner: CSSProperties = {
  padding: '12px 14px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(255,255,255,0.05)',
  color: '#dbeafe',
  fontWeight: 700,
}

const noteBanner: CSSProperties = {
  border: '1px solid rgba(74,222,128,0.16)',
  background: 'rgba(17, 39, 27, 0.58)',
  color: '#dcfce7',
}

const nextActionCardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '14px',
  flexWrap: 'wrap',
  padding: '14px 16px',
  borderRadius: '18px',
  border: '1px solid rgba(155,225,29,0.20)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.12), rgba(69,227,161,0.08))',
}

const nextActionTitleStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '15px',
  fontWeight: 900,
}

const nextActionTextStyle: CSSProperties = {
  marginTop: '4px',
  color: 'rgba(229,238,251,0.78)',
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
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e7eefb',
  textDecoration: 'none',
  fontWeight: 800,
}

const ghostButtonButton: CSSProperties = {
  ...ghostButton,
  cursor: 'pointer',
}

const dangerButton: CSSProperties = {
  ...ghostButtonButton,
  border: '1px solid rgba(248,113,113,0.22)',
  background: 'rgba(60,16,24,0.76)',
  color: '#fecaca',
}

const emptyCard: CSSProperties = {
  padding: '18px',
  borderRadius: '20px',
  border: '1px dashed rgba(116,190,255,0.18)',
  color: 'rgba(229,238,251,0.76)',
  background: 'rgba(255,255,255,0.04)',
  lineHeight: 1.7,
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
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
}

const registryPhotoWrap: CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 7',
  overflow: 'hidden',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.05)',
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
  color: '#f8fbff',
  fontSize: '22px',
  fontWeight: 900,
  lineHeight: 1.1,
}

const registryText: CSSProperties = {
  color: '#dbeafe',
  fontSize: '14px',
  lineHeight: 1.65,
}

const registryNotes: CSSProperties = {
  color: 'rgba(229,238,251,0.76)',
  fontSize: '14px',
  lineHeight: 1.72,
}

const registryFooter: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
  paddingTop: '8px',
}

const registryTimestamp: CSSProperties = {
  color: 'rgba(197,213,234,0.82)',
  fontSize: '12px',
  fontWeight: 700,
}

const noteCard: CSSProperties = {
  padding: '16px 18px',
  borderRadius: '20px',
  border: '1px solid rgba(74,222,128,0.16)',
  background: 'linear-gradient(180deg, rgba(32,58,31,0.24) 0%, rgba(18,36,66,0.62) 100%)',
}
