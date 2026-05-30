'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import React from 'react'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import MatchAccuracyReportButton from '@/app/components/match-accuracy-report-button'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import {
  getIssueTypeLabel,
  getReportStatusLabel,
  listMyMatchAccuracyReports,
  type MatchAccuracyReport,
} from '@/lib/match-accuracy-reports'
import {
  inferCompetitionLayerFromValues,
  type CompetitionLayer,
} from '@/lib/competition-layers'
import { buildCaptainScopedHref } from '@/lib/captain-memory'
import {
  buildScopedLeagueEntityId,
  buildScopedTeamEntityId,
} from '@/lib/entity-ids'
import { supabase } from '@/lib/supabase'
import { listTiqIndividualLeagueResults, type TiqIndividualLeagueResultRecord } from '@/lib/tiq-individual-results-service'
import { buildTiqIndividualLeagueSummaries } from '@/lib/tiq-individual-results-summary'
import {
  listTiqIndividualSuggestions,
  type TiqIndividualSuggestionRecord,
} from '@/lib/tiq-individual-suggestions-service'
import {
  getTiqIndividualCompetitionFormatLabel,
  getTiqIndividualCompetitionFormatNextAction,
} from '@/lib/tiq-individual-format'
import { type TiqLeagueRecord } from '@/lib/tiq-league-registry'
import {
  listTiqLeagues,
  listTiqPlayerParticipations,
  type TiqPlayerParticipationRecord,
} from '@/lib/tiq-league-service'
import { buildProductAccessState } from '@/lib/access-model'
import { DATA_ASSIST_STORY, MY_LAB_STORY } from '@/lib/product-story'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import { loadTiqAwardsForPlayer, readTiqAwardsRegistry, type TiqAwardRecord } from '@/lib/tiq-awards-registry'
import { loadUserProfileLink, type UserProfileLink } from '@/lib/user-profile'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { formatRating, cleanText } from '@/lib/captain-formatters'
import { PLAYER_DEVELOPMENT_IDENTITIES } from '@/lib/player-development'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import {
  getCoachAssignmentDueState,
  getCoachAssignmentReview,
  getCoachAssignmentSummary,
  sortPlayerAssignmentsForAction,
  type CoachAssignment,
  type CoachStudentLink,
} from '@/lib/coach-storage'

type EntityType = 'player' | 'team' | 'league'
type FeedType = 'match' | 'rating' | 'achievement' | 'community' | 'team' | 'league'

type FollowItem = {
  id: string
  entity_type: EntityType
  entity_id: string
  entity_name: string
  subtitle: string | null
  created_at?: string | null
}

type FeedItem = {
  id: string
  type: FeedType
  title: string
  body: string
  entityType: EntityType | 'community'
  entityId: string | null
  entityName: string
  createdAt: string
  score: number
  badge: string
  accent: 'blue' | 'green' | 'violet'
}

type PlayerRow = {
  id: string
  name: string
  location: string | null
  flight: string | null
  singles_dynamic_rating: number | null
  doubles_dynamic_rating: number | null
  overall_dynamic_rating: number | null
  singles_usta_dynamic_rating: number | null
  doubles_usta_dynamic_rating: number | null
  overall_usta_dynamic_rating: number | null
  rating_source?: string | null
}

type MatchRow = {
  id: string
  match_date: string | null
  score: string | null
  flight: string | null
  league_name: string | null
  usta_section?: string | null
  district_area?: string | null
  home_team: string | null
  away_team: string | null
  winner_side: string | null
  line_number: string | null
}

type MatchPlayerRow = {
  match_id: string
  player_id: string
  side: string | null
  seat: number | null
}

type PersonalMatchRow = {
  id: string
  date: string | null
  leagueName: string | null
  matchType: string | null
  score: string | null
  result: 'W' | 'L' | '-'
  opponent: string
}

type PersonalParticipantRow = MatchPlayerRow & {
  players?: { id: string; name: string } | { id: string; name: string }[] | null
}

type ScenarioRow = {
  id: string
  scenario_name: string
  league_name: string | null
  flight: string | null
  match_date: string | null
  team_name: string | null
  opponent_team: string | null
}

type TeamSummary = {
  id: string
  name: string
  league: string | null
  flight: string | null
  playerCount: number
}

const MY_LAB_PLAYER_SELECT_BASE =
  'id,name,location,flight,singles_dynamic_rating,doubles_dynamic_rating,overall_dynamic_rating,singles_usta_dynamic_rating,doubles_usta_dynamic_rating,overall_usta_dynamic_rating'

const MY_LAB_PLAYER_SELECT_WITH_SOURCE = `${MY_LAB_PLAYER_SELECT_BASE},rating_source`

type ProfileLinkRow = UserProfileLink

type LeagueSummary = {
  id: string
  name: string
  flight: string | null
  section: string | null
  district: string | null
  teamCount: number
  playerCount: number
}

type SearchOption = {
  id: string
  type: EntityType
  name: string
  subtitle: string | null
}

type MyLabFeedRow = {
  id: string
  event_type: string
  entity_type: EntityType
  entity_id: string
  entity_name: string
  subtitle: string | null
  title: string
  body: string | null
  created_at: string
}

type LabGoalState = {
  id: string
  goal: string
  progressStatus: 'not-started' | 'in-progress' | 'improving' | 'completed'
  progressUpdate: string
  doingWell: string
  improveNext: string
  notes: string
  updatedAt: string | null
}

type GoalTemplate = Pick<LabGoalState, 'goal' | 'progressUpdate' | 'doingWell' | 'improveNext' | 'notes'>

const LOCAL_FOLLOW_KEY = 'tenaceiq-my-lab-follows-v2'
const LOCAL_GOAL_KEY = 'tenaceiq-my-lab-goal-v1'
const LOCAL_NOTEBOOK_KEY = 'tenaceiq-my-lab-notebook-v1'
const LOCAL_GOAL_STATE_KEY = 'tenaceiq-my-lab-goal-state-v1'
const LOCAL_GOALS_KEY = 'tenaceiq-my-lab-goals-v2'

const EMPTY_LAB_GOAL: LabGoalState = {
  id: 'goal-1',
  goal: '',
  progressStatus: 'not-started',
  progressUpdate: '',
  doingWell: '',
  improveNext: '',
  notes: '',
  updatedAt: null,
}

const MY_LAB_ONBOARDING_GOALS: Array<{ label: string; template: GoalTemplate }> = [
  {
    label: 'Win more singles',
    template: {
      goal: 'Win more singles',
      progressUpdate: 'Track one pattern from each singles match.',
      doingWell: 'Name the point pattern that is already holding up.',
      improveNext: 'Choose one serve plus first-ball pattern to test.',
      notes: 'Next singles test:\nPattern to repeat:\nPattern to clean up:',
    },
  },
  {
    label: 'Improve doubles',
    template: {
      goal: 'Improve doubles',
      progressUpdate: 'Track positioning, return pressure, and partner patterns.',
      doingWell: 'Name one team pattern that creates easy balls.',
      improveNext: 'Choose one poach, lob, or return target to practice.',
      notes: 'Doubles partner:\nBest pattern:\nNext court habit:',
    },
  },
  {
    label: 'Get ready for 4.0 / 4.5',
    template: {
      goal: 'Get ready for 4.0 / 4.5',
      progressUpdate: 'Use match evidence to test whether the next rating band is getting closer.',
      doingWell: 'Name the level-up skill that already travels under pressure.',
      improveNext: 'Pick one pressure pattern to repeat for two weeks.',
      notes: 'Target level:\nPressure skill:\nEvidence to upload:',
    },
  },
  {
    label: 'Prepare for playoffs',
    template: {
      goal: 'Prepare for playoffs',
      progressUpdate: 'Scout likely opponents and choose one reliable match plan.',
      doingWell: 'Name what you can trust late in sets.',
      improveNext: 'Choose one matchup risk to practice before playoffs.',
      notes: 'Likely opponent:\nCourt plan:\nWatch item:',
    },
  },
  {
    label: 'Captain a team',
    template: {
      goal: 'Captain a team',
      progressUpdate: 'Use team context to reduce availability, lineup, and scouting friction.',
      doingWell: 'Name the part of match week that is already organized.',
      improveNext: 'Choose one captain workflow to move into Team Hub.',
      notes: 'Team:\nAvailability gap:\nLineup question:',
    },
  },
  {
    label: 'Find a coach',
    template: {
      goal: 'Find a coach',
      progressUpdate: 'Bring one match pattern and one question into the next lesson.',
      doingWell: 'Name what you want a coach to keep.',
      improveNext: 'Choose the first measurable assignment to ask for.',
      notes: 'Coach question:\nMatch evidence:\nAssignment idea:',
    },
  },
  {
    label: 'Build a practice routine',
    template: {
      goal: 'Build a practice routine',
      progressUpdate: 'Turn match evidence into one repeatable weekly practice block.',
      doingWell: 'Name one skill that responds well to repetition.',
      improveNext: 'Choose a practice routine you can repeat twice this week.',
      notes: 'Routine:\nFrequency:\nEvidence after practice:',
    },
  },
]

function safeDate(value: string | null | undefined) {
  if (!value) return 'Recently'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString()
}

function timeAgo(value: string | null | undefined) {
  if (!value) return 'Recently'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Recently'
  const diffMs = Date.now() - d.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return safeDate(value)
}

function readLocalFollows(): FollowItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOCAL_FOLLOW_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalFollows(items: FollowItem[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_FOLLOW_KEY, JSON.stringify(items))
}

function isMissingRatingSourceError(message: string | null | undefined) {
  const normalized = (message || '').toLowerCase()
  return normalized.includes('rating_source') || normalized.includes('schema cache') || normalized.includes('column')
}

async function loadMyLabPlayers(): Promise<PlayerRow[]> {
  const withSource = await supabase
    .from('players')
    .select(MY_LAB_PLAYER_SELECT_WITH_SOURCE)
    .order('name', { ascending: true })

  if (!withSource.error) return (withSource.data ?? []) as PlayerRow[]
  if (!isMissingRatingSourceError(withSource.error.message)) throw new Error(withSource.error.message)

  const base = await supabase
    .from('players')
    .select(MY_LAB_PLAYER_SELECT_BASE)
    .order('name', { ascending: true })

  if (base.error) throw new Error(base.error.message)
  return ((base.data ?? []) as PlayerRow[]).map((player) => ({ ...player, rating_source: null }))
}

function scopedLabStorageKey(baseKey: string, userId: string | null, playerId: string | null | undefined) {
  return `${baseKey}:${userId || playerId || 'local'}`
}

function readLocalLabText(baseKey: string, userId: string | null, playerId: string | null | undefined) {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(scopedLabStorageKey(baseKey, userId, playerId)) || ''
  } catch {
    return ''
  }
}

function writeLocalLabText(baseKey: string, userId: string | null, playerId: string | null | undefined, value: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(scopedLabStorageKey(baseKey, userId, playerId), value)
}

function createEmptyGoal(): LabGoalState {
  return {
    ...EMPTY_LAB_GOAL,
    id: `goal-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  }
}

function normalizeGoalState(value: Partial<LabGoalState> | null | undefined, fallbackId = 'goal-1'): LabGoalState {
  return {
    ...EMPTY_LAB_GOAL,
    ...value,
    id: value?.id || fallbackId,
    progressStatus: isGoalProgressStatus(value?.progressStatus) ? value.progressStatus : EMPTY_LAB_GOAL.progressStatus,
  }
}

function readLocalGoals(userId: string | null, playerId: string | null | undefined): LabGoalState[] {
  if (typeof window === 'undefined') return [EMPTY_LAB_GOAL]
  try {
    const goalsRaw = window.localStorage.getItem(scopedLabStorageKey(LOCAL_GOALS_KEY, userId, playerId))
    if (goalsRaw) {
      const parsedGoals = JSON.parse(goalsRaw)
      if (Array.isArray(parsedGoals) && parsedGoals.length) {
        return parsedGoals.map((goal, index) => normalizeGoalState(goal as Partial<LabGoalState>, `goal-${index + 1}`))
      }
    }

    const raw = window.localStorage.getItem(scopedLabStorageKey(LOCAL_GOAL_STATE_KEY, userId, playerId))
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LabGoalState>
      return [normalizeGoalState(parsed)]
    }

    return [
      normalizeGoalState({
        goal: readLocalLabText(LOCAL_GOAL_KEY, userId, playerId),
        notes: readLocalLabText(LOCAL_NOTEBOOK_KEY, userId, playerId),
      }),
    ]
  } catch {
    return [EMPTY_LAB_GOAL]
  }
}

function writeLocalGoals(userId: string | null, playerId: string | null | undefined, value: LabGoalState[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(scopedLabStorageKey(LOCAL_GOALS_KEY, userId, playerId), JSON.stringify(value))
}

function isGoalProgressStatus(value: unknown): value is LabGoalState['progressStatus'] {
  return value === 'not-started' || value === 'in-progress' || value === 'improving' || value === 'completed'
}

function goalStatusLabel(value: LabGoalState['progressStatus']) {
  if (value === 'not-started') return 'Not started'
  if (value === 'in-progress') return 'In progress'
  if (value === 'improving') return 'Improving'
  return 'Completed'
}

function goalReadinessChecksFor(goal: LabGoalState) {
  return [
    { label: 'Goal', complete: Boolean(goal.goal.trim()) },
    { label: 'Update', complete: Boolean(goal.progressUpdate.trim()) },
    { label: 'Strength', complete: Boolean(goal.doingWell.trim()) },
    { label: 'Improve', complete: Boolean(goal.improveNext.trim()) },
    { label: 'Notes', complete: Boolean(goal.notes.trim()) },
  ]
}

function goalReadinessScoreFor(goal: LabGoalState) {
  if (goal.progressStatus === 'completed') return 100
  const checks = goalReadinessChecksFor(goal)
  return Math.round((checks.filter((item) => item.complete).length / checks.length) * 100)
}

function compactOpponentLabel(value: string | null | undefined) {
  if (!value) return 'opponent'
  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length <= 2) return value
  return `${parts.slice(0, 2).join(' / ')} +${parts.length - 2}`
}

function buildSinglesMatchupHref(linkedPlayerId: string | null | undefined, opponentId: string | null | undefined) {
  const params = new URLSearchParams({ type: 'singles' })
  if (linkedPlayerId) params.set('playerA', linkedPlayerId)
  if (opponentId) params.set('playerB', opponentId)
  return `/matchup?${params.toString()}`
}

function getMatchupRead(gap: number) {
  if (gap <= 0.08) return 'Very close'
  if (gap <= 0.18) return 'Good test'
  return 'Stretch test'
}

function accentForType(type: FeedType): FeedItem['accent'] {
  if (type === 'achievement' || type === 'rating') return 'green'
  if (type === 'community') return 'violet'
  return 'blue'
}

function parseScopedEntityId(entityId: string, expectedType: EntityType) {
  const parts = entityId.split('__')

  if (expectedType === 'team') {
    if (parts.length >= 4) {
      const [competitionLayer = '', teamName = '', leagueName = '', flight = ''] = parts
      return {
        competitionLayer,
        teamName,
        leagueName,
        flight,
      }
    }

    const [teamName = '', leagueName = '', flight = ''] = parts
    return {
      competitionLayer: '',
      teamName,
      leagueName,
      flight,
    }
  }

  if (parts.length >= 5) {
    const [competitionLayer = '', leagueName = '', flight = '', section = '', district = ''] = parts
    return {
      competitionLayer,
      leagueName,
      flight,
      section,
      district,
    }
  }

  const [leagueName = '', flight = '', section = '', district = ''] = parts
  return {
    competitionLayer: '',
    leagueName,
    flight,
    section,
    district,
  }
}

function parseTeamEntityId(entityId: string) {
  const parsed = parseScopedEntityId(entityId, 'team')
  return {
    competitionLayer: parsed.competitionLayer || '',
    teamName: parsed.teamName || '',
    leagueName: parsed.leagueName || '',
    flight: parsed.flight || '',
  }
}

function parseLeagueEntityId(entityId: string) {
  const parsed = parseScopedEntityId(entityId, 'league')
  return {
    competitionLayer: parsed.competitionLayer || '',
    leagueName: parsed.leagueName || '',
    flight: parsed.flight || '',
    section: parsed.section || '',
    district: parsed.district || '',
  }
}

function buildTeamHrefFromEntityId(entityId: string) {
  const { competitionLayer, teamName, leagueName, flight } = parseTeamEntityId(entityId)
  const params = new URLSearchParams()
  if (competitionLayer) params.set('layer', competitionLayer)
  if (leagueName) params.set('league', leagueName)
  if (flight) params.set('flight', flight)
  const query = params.toString()
  return `/teams/${encodeURIComponent(teamName)}${query ? `?${query}` : ''}`
}

function buildLeagueHrefFromEntityId(entityId: string) {
  const { competitionLayer, leagueName, flight, section, district } = parseLeagueEntityId(entityId)
  const params = new URLSearchParams()
  if (flight) params.set('flight', flight)
  if (section) params.set('section', section)
  if (district) params.set('district', district)
  const query = params.toString()
  if (competitionLayer === 'usta' || competitionLayer === 'tiq') {
    return `/explore/leagues/${competitionLayer}/${encodeURIComponent(leagueName)}${query ? `?${query}` : ''}`
  }
  return `/leagues/${encodeURIComponent(leagueName)}${query ? `?${query}` : ''}`
}

function buildTiqLeagueDetailHref(leagueId: string) {
  const safeLeagueId = encodeURIComponent(leagueId)
  return `/explore/leagues/tiq/${safeLeagueId}?league_id=${safeLeagueId}`
}

function buildTiqParticipantValue(playerName: string, playerId: string) {
  return playerId || `name:${playerName}`
}

function buildTiqSuggestionResultHref(suggestion: TiqIndividualSuggestionRecord) {
  const params = new URLSearchParams({
    league_id: suggestion.leagueId,
    suggest_player_a: buildTiqParticipantValue(suggestion.playerAName, suggestion.playerAId),
    suggest_player_b: buildTiqParticipantValue(suggestion.playerBName, suggestion.playerBId),
  })
  return `/explore/leagues/tiq/${encodeURIComponent(suggestion.leagueId)}?${params.toString()}`
}

function inferCompetitionLayerForContext({
  leagueName,
  section,
  district,
}: {
  leagueName?: string | null
  section?: string | null
  district?: string | null
}): CompetitionLayer {
  return inferCompetitionLayerFromValues({
    leagueName,
    ustaSection: section,
    districtArea: district,
  })
}

function entityIdsMatch(entityType: EntityType, left: string, right: string) {
  if (left === right) return true
  if (entityType === 'player') return left === right

  if (entityType === 'team') {
    const a = parseTeamEntityId(left)
    const b = parseTeamEntityId(right)
    return (
      a.teamName === b.teamName &&
      a.leagueName === b.leagueName &&
      a.flight === b.flight
    )
  }

  const a = parseLeagueEntityId(left)
  const b = parseLeagueEntityId(right)
  return (
    a.leagueName === b.leagueName &&
    a.flight === b.flight &&
    a.section === b.section &&
    a.district === b.district
  )
}

function followContainsEntity(follows: FollowItem[], entityType: EntityType, entityId: string | null) {
  if (!entityId) return false
  return follows.some(
    (follow) => follow.entity_type === entityType && entityIdsMatch(entityType, follow.entity_id, entityId),
  )
}

function getFollowedEntityId(follows: FollowItem[], entityType: EntityType, candidates: Array<string | null>) {
  for (const candidate of candidates) {
    if (!candidate) continue
    const match = follows.find(
      (follow) => follow.entity_type === entityType && entityIdsMatch(entityType, follow.entity_id, candidate),
    )
    if (match) return match.entity_id
  }
  return candidates.find(Boolean) ?? null
}

export default function MyLabPage() {
  return (
    <SiteShell active="/mylab">
      <MyLabPageInner />
    </SiteShell>
  )
}

function MyLabPageInner() {
  const { userId, authResolved, role, entitlements, session } = useAuth()

  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayerRow[]>([])
  const [personalMatches, setPersonalMatches] = useState<PersonalMatchRow[]>([])
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([])
  const [cloudFeedRows, setCloudFeedRows] = useState<MyLabFeedRow[]>([])
  const [follows, setFollows] = useState<FollowItem[]>([])
  const [tiqIndividualResults, setTiqIndividualResults] = useState<TiqIndividualLeagueResultRecord[]>([])
  const [tiqIndividualSuggestions, setTiqIndividualSuggestions] = useState<TiqIndividualSuggestionRecord[]>([])
  const [tiqLeagues, setTiqLeagues] = useState<TiqLeagueRecord[]>([])
  const [tiqPlayerParticipations, setTiqPlayerParticipations] = useState<TiqPlayerParticipationRecord[]>([])
  const [tiqPlayerParticipationWarning, setTiqPlayerParticipationWarning] = useState<string | null>(null)
  const [myMatchReports, setMyMatchReports] = useState<MatchAccuracyReport[]>([])
  const [myMatchReportsLoading, setMyMatchReportsLoading] = useState(false)
  const [myMatchReportsError, setMyMatchReportsError] = useState('')
  const [coachLinks, setCoachLinks] = useState<CoachStudentLink[]>([])
  const [coachAssignments, setCoachAssignments] = useState<CoachAssignment[]>([])
  const [coachAssignmentsLoading, setCoachAssignmentsLoading] = useState(false)
  const [coachAssignmentsMessage, setCoachAssignmentsMessage] = useState('')
  const [profileLink, setProfileLink] = useState<ProfileLinkRow | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | EntityType>('all')
  const [feedFilter, setFeedFilter] = useState<'all' | FeedType>('all')
  const [selectedTab, setSelectedTab] = useState<'feed' | 'players' | 'teams' | 'leagues'>('feed')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [goals, setGoals] = useState<LabGoalState[]>([EMPTY_LAB_GOAL])
  const [activeGoalId, setActiveGoalId] = useState(EMPTY_LAB_GOAL.id)
  const [notebookSavedLabel, setNotebookSavedLabel] = useState('All changes saved')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [savedToCloud, setSavedToCloud] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [tiqAwards, setTiqAwards] = useState<TiqAwardRecord[]>([])
  const { isTablet } = useViewportBreakpoints()
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [resolvedRole, entitlements])
  const accessPending = !authResolved || (Boolean(userId) && entitlements === null)

  useEffect(() => {
    const nextGoals = readLocalGoals(userId, profileLink?.linked_player_id)
    setGoals(nextGoals)
    setActiveGoalId(nextGoals[0]?.id || EMPTY_LAB_GOAL.id)
    setNotebookSavedLabel('All changes saved')
    setLastSavedAt(nextGoals.find((goal) => goal.updatedAt)?.updatedAt || null)
  }, [userId, profileLink?.linked_player_id])

  useEffect(() => {
    if (notebookSavedLabel !== 'Saved just now') return
    const timeout = window.setTimeout(() => setNotebookSavedLabel('All changes saved'), 1800)
    return () => window.clearTimeout(timeout)
  }, [notebookSavedLabel])

  useEffect(() => {
    setTiqAwards(readTiqAwardsRegistry())

    function handleStorage() {
      setTiqAwards(readTiqAwardsRegistry())
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    const linkedPlayerId = profileLink?.linked_player_id || ''
    const linkedPlayerName = profileLink?.linked_player_name || ''
    if (!linkedPlayerId && !linkedPlayerName) return

    let active = true

    void (async () => {
      const result = await loadTiqAwardsForPlayer(linkedPlayerId, linkedPlayerName)
      if (!active) return
      const byId = new Map<string, TiqAwardRecord>()
      for (const award of [...result.data, ...readTiqAwardsRegistry()]) {
        byId.set(award.id, award)
      }
      setTiqAwards([...byId.values()])
    })()

    return () => {
      active = false
    }
  }, [profileLink?.linked_player_id, profileLink?.linked_player_name])

  const refreshMyLab = useCallback(async () => {
    setLoading(true)
    setError(null)

    const local = readLocalFollows()
    setFollows(local)

    const [
      playersRes,
      matchesRes,
      scenariosRes,
      followsRes,
      cloudFeedRes,
      profileLinkRes,
      tiqLeaguesRes,
      tiqParticipationRes,
      tiqResultsRes,
      tiqSuggestionsRes,
    ] = await Promise.all([
      loadMyLabPlayers(),
      supabase
        .from('matches')
        .select('id,match_date,score,flight,league_name,usta_section,district_area,home_team,away_team,winner_side,line_number')
        .is('line_number', null)
        .order('match_date', { ascending: false })
        .limit(160),
      supabase
        .from('lineup_scenarios')
        .select('id,scenario_name,league_name,flight,match_date,team_name,opponent_team')
        .order('match_date', { ascending: false })
        .limit(40),
      userId
        ? supabase
            .from('user_follows')
            .select('id,entity_type,entity_id,entity_name,subtitle,created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('my_lab_feed')
        .select(
          'id,event_type,entity_type,entity_id,entity_name,subtitle,title,body,created_at',
        )
        .order('created_at', { ascending: false })
        .limit(160),
      loadUserProfileLink(userId),
      listTiqLeagues(),
      listTiqPlayerParticipations(),
      listTiqIndividualLeagueResults(),
      listTiqIndividualSuggestions(),
    ])

    const matchIds = ((matchesRes.data ?? []) as MatchRow[]).map((match) => match.id)
    const matchPlayersRes =
      matchIds.length > 0
        ? await supabase
            .from('match_players')
            .select('match_id,player_id,side,seat')
            .in('match_id', matchIds)
        : { data: [], error: null }

    const firstHardError = [
      matchesRes.error,
      matchPlayersRes.error,
      scenariosRes.error,
      cloudFeedRes.error,
    ].find(Boolean)

    if (firstHardError) {
      setError(firstHardError.message)
    }

    setPlayers(playersRes)
    setMatches(
      ((matchesRes.data ?? []) as MatchRow[]).filter(
        (row) => cleanText(row.home_team) && cleanText(row.away_team),
      ),
    )
    setMatchPlayers((matchPlayersRes.data ?? []) as MatchPlayerRow[])
    setScenarios((scenariosRes.data ?? []) as ScenarioRow[])
    setCloudFeedRows((cloudFeedRes.data ?? []) as MyLabFeedRow[])
    setTiqLeagues(tiqLeaguesRes.records)
    setTiqIndividualResults(tiqResultsRes.results)
    setTiqIndividualSuggestions(tiqSuggestionsRes.suggestions)
    setTiqPlayerParticipations(tiqParticipationRes.entries)
    setTiqPlayerParticipationWarning(tiqParticipationRes.warning)
    let linkedPlayerIdForWorkshop = ''

    if (profileLinkRes.data) {
      const nextProfileLink = profileLinkRes.data as ProfileLinkRow
      linkedPlayerIdForWorkshop = nextProfileLink.linked_player_id || ''
      setProfileLink(nextProfileLink)
    }

    if (linkedPlayerIdForWorkshop) {
      const { data: playerMatchRefs } = await supabase
        .from('match_players')
        .select('match_id')
        .eq('player_id', linkedPlayerIdForWorkshop)
        .limit(80)

      const personalMatchIds = [...new Set((playerMatchRefs || []).map((row) => row.match_id).filter(Boolean))]

      if (personalMatchIds.length) {
        const [{ data: personalMatchRows }, { data: personalParticipantRows }] = await Promise.all([
          supabase
            .from('matches')
            .select('id, match_date, match_type, league_name, score, winner_side')
            .in('id', personalMatchIds)
            .order('match_date', { ascending: false })
            .limit(8),
          supabase
            .from('match_players')
            .select('match_id, player_id, side, seat, players(id, name)')
            .in('match_id', personalMatchIds),
        ])

        const participantsByMatch = new Map<string, PersonalParticipantRow[]>()
        for (const row of (personalParticipantRows || []) as unknown as PersonalParticipantRow[]) {
          const existing = participantsByMatch.get(row.match_id) ?? []
          existing.push(row)
          participantsByMatch.set(row.match_id, existing)
        }

        setPersonalMatches(
          ((personalMatchRows || []) as Array<{
            id: string
            match_date: string | null
            match_type: string | null
            league_name: string | null
            score: string | null
            winner_side: string | null
          }>).map((match) => {
            const participants = participantsByMatch.get(match.id) ?? []
            const linkedParticipant = participants.find((participant) => participant.player_id === linkedPlayerIdForWorkshop)
            const playerSide = linkedParticipant?.side || ''
            const opponentSide = playerSide === 'A' ? 'B' : playerSide === 'B' ? 'A' : ''
            const opponents = participants
              .filter((participant) => participant.side === opponentSide)
              .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
              .map((participant) => {
                const player = Array.isArray(participant.players) ? participant.players[0] : participant.players
                return player?.name || 'Player'
              })
            const result =
              playerSide && match.winner_side
                ? playerSide === match.winner_side
                  ? 'W'
                  : 'L'
                : '-'

            return {
              id: match.id,
              date: match.match_date,
              leagueName: match.league_name,
              matchType: match.match_type,
              score: match.score,
              result,
              opponent: opponents.join(' / ') || 'Opponent',
            }
          }),
        )
      } else {
        setPersonalMatches([])
      }
    } else {
      setPersonalMatches([])
    }

    if (!followsRes.error && Array.isArray(followsRes.data) && followsRes.data.length) {
      const cloudFollows = followsRes.data as FollowItem[]
      setFollows(cloudFollows)
      setSavedToCloud(true)
      writeLocalFollows(cloudFollows)
    } else if (userId) {
      setSavedToCloud(true)
    } else {
      setSavedToCloud(false)
    }

    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (!authResolved) return
    void refreshMyLab()
  }, [authResolved, refreshMyLab, refreshTick])

  const refreshMyMatchReports = useCallback(async () => {
    if (!userId) {
      setMyMatchReports([])
      setMyMatchReportsError('')
      return
    }

    setMyMatchReportsLoading(true)
    setMyMatchReportsError('')
    try {
      setMyMatchReports(await listMyMatchAccuracyReports())
    } catch (err) {
      setMyMatchReportsError(err instanceof Error ? err.message : 'Could not load your match reports.')
    } finally {
      setMyMatchReportsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!authResolved) return
    void refreshMyMatchReports()
  }, [authResolved, refreshMyMatchReports])

  useEffect(() => {
    if (!authResolved) return

    if (!session?.access_token || !access.canUseAdvancedPlayerInsights) {
      setCoachLinks([])
      setCoachAssignments([])
      setCoachAssignmentsMessage('')
      setCoachAssignmentsLoading(false)
      return
    }

    let active = true
    setCoachAssignmentsLoading(true)
    setCoachAssignmentsMessage('')

    void (async () => {
      try {
        const response = await fetch('/api/player/coach-assignments', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = (await response.json()) as {
          ok?: boolean
          coachLinks?: CoachStudentLink[]
          assignments?: CoachAssignment[]
          message?: string
        }

        if (!response.ok || !json.ok) {
          throw new Error(json.message || 'Could not load coach assignments.')
        }

        if (!active) return
        setCoachLinks(json.coachLinks ?? [])
        setCoachAssignments(json.assignments ?? [])
      } catch (err) {
        if (!active) return
        setCoachAssignmentsMessage(err instanceof Error ? err.message : 'Could not load coach assignments.')
      } finally {
        if (active) setCoachAssignmentsLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [access.canUseAdvancedPlayerInsights, authResolved, session?.access_token])

  const completeCoachAssignment = useCallback(
    async (assignmentId: string, recap: string, evidence: string) => {
      if (!session?.access_token) {
        throw new Error('Sign in to complete coach assignments.')
      }

      const response = await fetch('/api/player/coach-assignments', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignmentId, recap, evidence }),
      })
      const json = (await response.json()) as { ok?: boolean; assignment?: CoachAssignment; message?: string }
      if (!response.ok || !json.ok || !json.assignment) {
        throw new Error(json.message || 'Could not complete coach assignment.')
      }

      setCoachAssignments((current) =>
        current.map((assignment) => (assignment.id === json.assignment?.id ? json.assignment : assignment)),
      )
    },
    [session?.access_token],
  )

  const myMatchReportByMatchId = useMemo(() => {
    const map = new Map<string, MatchAccuracyReport>()
    for (const report of myMatchReports) {
      if (!report.matchId || map.has(report.matchId)) continue
      map.set(report.matchId, report)
    }
    return map
  }, [myMatchReports])

  const playerMap = useMemo(() => new Map(players.map((player) => [player.id, player])), [players])

  const matchPlayersByMatch = useMemo(() => {
    const map = new Map<string, MatchPlayerRow[]>()
    for (const row of matchPlayers) {
      const existing = map.get(row.match_id) ?? []
      existing.push(row)
      map.set(row.match_id, existing)
    }
    return map
  }, [matchPlayers])

  const teamSummaries = useMemo<TeamSummary[]>(() => {
    const map = new Map<string, TeamSummary>()
    const rosterByTeam = new Map<string, Set<string>>()

    for (const match of matches) {
      const home = cleanText(match.home_team)
      const away = cleanText(match.away_team)
      const league = cleanText(match.league_name)
      const flight = cleanText(match.flight)
      const competitionLayer = inferCompetitionLayerForContext({
        leagueName: league,
      })
      if (!home || !away) continue

      const homeKey = buildScopedTeamEntityId({
        competitionLayer,
        teamName: home,
        leagueName: league,
        flight,
      })
      const awayKey = buildScopedTeamEntityId({
        competitionLayer,
        teamName: away,
        leagueName: league,
        flight,
      })

      if (!map.has(homeKey)) {
        map.set(homeKey, {
          id: homeKey,
          name: home,
          league,
          flight,
          playerCount: 0,
        })
      }

      if (!map.has(awayKey)) {
        map.set(awayKey, {
          id: awayKey,
          name: away,
          league,
          flight,
          playerCount: 0,
        })
      }

      const participants = matchPlayersByMatch.get(match.id) ?? []
      if (!rosterByTeam.has(homeKey)) rosterByTeam.set(homeKey, new Set())
      if (!rosterByTeam.has(awayKey)) rosterByTeam.set(awayKey, new Set())

      participants.forEach((participant) => {
        if (!participant.player_id) return
        if (participant.side === 'A') rosterByTeam.get(homeKey)?.add(participant.player_id)
        if (participant.side === 'B') rosterByTeam.get(awayKey)?.add(participant.player_id)
      })
    }

    return Array.from(map.values())
      .map((team) => ({ ...team, playerCount: rosterByTeam.get(team.id)?.size ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [matches, matchPlayersByMatch])

  const leagueSummaries = useMemo<LeagueSummary[]>(() => {
    const map = new Map<
      string,
      {
        id: string
        name: string
        flight: string | null
        section: string | null
        district: string | null
        teams: Set<string>
        players: Set<string>
      }
    >()

    for (const match of matches) {
      const leagueName = cleanText(match.league_name)
      const flight = cleanText(match.flight)
      const section = cleanText((match as MatchRow & { usta_section?: string | null }).usta_section)
      const district = cleanText((match as MatchRow & { district_area?: string | null }).district_area)
      if (!leagueName) continue

      const competitionLayer = inferCompetitionLayerForContext({
        leagueName,
        section,
        district,
      })
      const id = buildScopedLeagueEntityId({
        competitionLayer,
        leagueName,
        flight,
        section,
        district,
      })
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: leagueName,
          flight,
          section,
          district,
          teams: new Set(),
          players: new Set(),
        })
      }

      const entry = map.get(id)
      if (!entry) continue
      if (cleanText(match.home_team)) entry.teams.add(cleanText(match.home_team) as string)
      if (cleanText(match.away_team)) entry.teams.add(cleanText(match.away_team) as string)
      ;(matchPlayersByMatch.get(match.id) ?? []).forEach((mp) => {
        if (mp.player_id) entry.players.add(mp.player_id)
      })
    }

    return Array.from(map.values())
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        flight: entry.flight,
        section: entry.section,
        district: entry.district,
        teamCount: entry.teams.size,
        playerCount: entry.players.size,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [matches, matchPlayersByMatch])

  const linkedPlayerTeamSummaries = useMemo(() => {
    const linkedPlayerId = profileLink?.linked_player_id
    if (!linkedPlayerId) return []

    const teamIds = new Set<string>()

    for (const match of matches) {
      const participants = matchPlayersByMatch.get(match.id) ?? []
      const linkedParticipant = participants.find((participant) => participant.player_id === linkedPlayerId)
      if (!linkedParticipant) continue

      const teamName = cleanText(linkedParticipant.side === 'A' ? match.home_team : match.away_team)
      const leagueName = cleanText(match.league_name)
      const flight = cleanText(match.flight)
      if (!teamName) continue

      teamIds.add(
        buildScopedTeamEntityId({
          competitionLayer: inferCompetitionLayerForContext({ leagueName }),
          teamName,
          leagueName,
          flight,
        }),
      )
    }

    return teamSummaries.filter((team) => teamIds.has(team.id))
  }, [matches, matchPlayersByMatch, profileLink?.linked_player_id, teamSummaries])

  const searchOptions = useMemo<SearchOption[]>(() => {
    const playerOptions = players.slice(0, 300).map((player) => ({
      id: player.id,
      type: 'player' as const,
      name: player.name,
      subtitle:
        [cleanText(player.location), cleanText(player.flight)].filter(Boolean).join(' - ') || null,
    }))

    const teamOptions = teamSummaries.slice(0, 200).map((team) => ({
      id: team.id,
      type: 'team' as const,
      name: team.name,
      subtitle: [team.league, team.flight].filter(Boolean).join(' - ') || null,
    }))

    const leagueOptions = leagueSummaries.slice(0, 120).map((league) => ({
      id: league.id,
      type: 'league' as const,
      name: league.name,
      subtitle: [league.flight, league.section, league.district].filter(Boolean).join(' - ') || null,
    }))

    return [...playerOptions, ...teamOptions, ...leagueOptions]
  }, [players, teamSummaries, leagueSummaries])

  const filteredSearchOptions = useMemo(() => {
    const query = search.trim().toLowerCase()
    return searchOptions
      .filter((item) => {
        const matchesText = !query || `${item.name} ${item.subtitle ?? ''}`.toLowerCase().includes(query)
        const matchesType = filter === 'all' || item.type === filter
        return matchesText && matchesType
      })
      .slice(0, 12)
  }, [searchOptions, search, filter])

  const followedPlayerNameSet = useMemo(() => {
    const names = new Set<string>()
    for (const follow of follows) {
      if (follow.entity_type !== 'player') continue
      const player = playerMap.get(follow.entity_id)
      if (!player) continue
      const playerName = cleanText(player.name)
      if (playerName) names.add(playerName.toLowerCase())
    }
    return names
  }, [follows, playerMap])

  const followedTiqIndividualParticipations = useMemo(
    () =>
      tiqPlayerParticipations.filter((entry) => followedPlayerNameSet.has(entry.playerName.toLowerCase())),
    [tiqPlayerParticipations, followedPlayerNameSet],
  )

  const followedLeagueIds = useMemo(() => {
    return new Set(
      follows
        .filter((item) => item.entity_type === 'league')
        .map((league) => parseLeagueEntityId(league.entity_id))
        .filter((league) => league.competitionLayer === 'tiq')
        .map((league) => league.leagueName.toLowerCase()),
    )
  }, [follows])

  const tiqLeagueContextById = useMemo(() => {
    const map = new Map<string, { leagueName: string; leagueFlight: string }>()
    for (const entry of followedTiqIndividualParticipations) {
      if (!map.has(entry.leagueId)) {
        map.set(entry.leagueId, {
          leagueName: entry.leagueName,
          leagueFlight: entry.leagueFlight,
        })
      }
    }
    return map
  }, [followedTiqIndividualParticipations])

  const followedTiqIndividualLeagueInsights = useMemo(() => {
    const summaries = buildTiqIndividualLeagueSummaries(tiqIndividualResults)

    return tiqLeagues
      .filter(
        (league) =>
          league.leagueFormat === 'individual' &&
          (followedLeagueIds.has(league.leagueName.toLowerCase()) ||
            followedTiqIndividualParticipations.some((entry) => entry.leagueId === league.id)),
      )
      .map((league) => {
        const summary = summaries.get(league.id)
        return {
          league,
          summary,
          nextAction: getTiqIndividualCompetitionFormatNextAction(
            league.individualCompetitionFormat,
            league.leagueName,
          ),
          formatLabel: getTiqIndividualCompetitionFormatLabel(league.individualCompetitionFormat),
        }
      })
      .sort((left, right) => (right.summary?.resultCount || 0) - (left.summary?.resultCount || 0))
  }, [followedLeagueIds, followedTiqIndividualParticipations, tiqIndividualResults, tiqLeagues])

  const followedTiqSuggestionItems = useMemo(
    () =>
      tiqIndividualSuggestions.filter((suggestion) => {
        const league = tiqLeagues.find((item) => item.id === suggestion.leagueId)
        const suggestionLeagueName = league?.leagueName.toLowerCase() || ''
        return (
          followedLeagueIds.has(suggestion.leagueId.toLowerCase()) ||
          (suggestionLeagueName ? followedLeagueIds.has(suggestionLeagueName) : false) ||
          followedTiqIndividualParticipations.some((entry) => entry.leagueId === suggestion.leagueId)
        )
      }),
    [followedLeagueIds, followedTiqIndividualParticipations, tiqIndividualSuggestions, tiqLeagues],
  )

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = []
    const followedKeySet = new Set(follows.map((f) => `${f.entity_type}:${f.entity_id}`))
    const followPlayers = follows.filter((f) => f.entity_type === 'player')
    const followTeams = follows.filter((f) => f.entity_type === 'team')
    const followLeagues = follows.filter((f) => f.entity_type === 'league')

    for (const row of cloudFeedRows) {
      const key = `${row.entity_type}:${row.entity_id}`
      if (!followedKeySet.has(key)) continue

      const mappedType: FeedType =
        row.event_type === 'rating'
          ? 'rating'
          : row.event_type === 'achievement'
            ? 'achievement'
            : row.event_type === 'team'
              ? 'team'
              : row.event_type === 'league'
                ? 'league'
                : row.event_type === 'community'
                  ? 'community'
                  : 'match'

      items.push({
        id: `cloud-${row.id}`,
        type: mappedType,
        title: row.title,
        body: row.body || row.subtitle || 'Update available.',
        entityType: row.entity_type,
        entityId: row.entity_id,
        entityName: row.entity_name,
        createdAt: row.created_at,
        score: 120,
        badge: row.event_type[0].toUpperCase() + row.event_type.slice(1),
        accent: accentForType(mappedType),
      })
    }

    for (const follow of followPlayers) {
      const player = players.find((p) => p.id === follow.entity_id)
      if (!player) continue
      items.push({
        id: `rating-${player.id}`,
        type: 'rating',
        title: `${player.name} rating snapshot`,
        body: `TIQ overall: ${formatRating(player.overall_dynamic_rating)} (USTA: ${formatRating(player.overall_usta_dynamic_rating)}). Singles TIQ: ${formatRating(player.singles_dynamic_rating)}. Doubles TIQ: ${formatRating(player.doubles_dynamic_rating)}.`,
        entityType: 'player',
        entityId: player.id,
        entityName: player.name,
        createdAt: new Date().toISOString(),
        score: 98,
        badge: 'Ratings',
        accent: accentForType('rating'),
      })
    }

    for (const match of matches.slice(0, 80)) {
      const playersInMatch = matchPlayersByMatch.get(match.id) ?? []
      const watchedPlayerIds = new Set(followPlayers.map((f) => f.entity_id))
      const containsFollowedPlayer = playersInMatch.some((mp) => watchedPlayerIds.has(mp.player_id))

      const leagueName = cleanText(match.league_name)
      const flight = cleanText(match.flight)
      const section = cleanText(match.usta_section)
      const district = cleanText(match.district_area)
      const homeTeam = cleanText(match.home_team)
      const awayTeam = cleanText(match.away_team)
      const competitionLayer = inferCompetitionLayerForContext({
        leagueName,
        section,
        district,
      })

      const homeTeamId = homeTeam
        ? buildScopedTeamEntityId({
            competitionLayer,
            teamName: homeTeam,
            leagueName,
            flight,
          })
        : null
      const awayTeamId = awayTeam
        ? buildScopedTeamEntityId({
            competitionLayer,
            teamName: awayTeam,
            leagueName,
            flight,
          })
        : null
      const leagueId = leagueName
        ? buildScopedLeagueEntityId({
            competitionLayer,
            leagueName,
            flight,
            section,
            district,
          })
        : null

      const containsFollowedTeam =
        followContainsEntity(followTeams, 'team', homeTeamId) ||
        followContainsEntity(followTeams, 'team', awayTeamId)
      const containsFollowedLeague = followContainsEntity(followLeagues, 'league', leagueId)

      if (!containsFollowedPlayer && !containsFollowedTeam && !containsFollowedLeague) continue

      const spotlightPlayers = playersInMatch
        .slice(0, 4)
        .map((mp) => playerMap.get(mp.player_id)?.name)
        .filter(Boolean) as string[]

      items.push({
        id: `match-${match.id}`,
        type: 'match',
        title: `${homeTeam || 'Team A'} vs ${awayTeam || 'Team B'}`,
        body: `${leagueName || 'League match'}${flight ? ` - ${flight}` : ''}. Score: ${match.score || 'Pending'}. Players: ${spotlightPlayers.join(', ') || 'Lineups unavailable'}.`,
        entityType: containsFollowedLeague ? 'league' : containsFollowedTeam ? 'team' : 'player',
        entityId: containsFollowedLeague
          ? getFollowedEntityId(followLeagues, 'league', [leagueId])
          : containsFollowedTeam
            ? getFollowedEntityId(followTeams, 'team', [homeTeamId, awayTeamId])
            : (playersInMatch[0]?.player_id ?? null),
        entityName: leagueName || homeTeam || 'Watched match',
        createdAt: match.match_date || new Date().toISOString(),
        score: 94,
        badge: 'Match',
        accent: accentForType('match'),
      })
    }

    for (const scenario of scenarios.slice(0, 24)) {
      const scenarioLeagueName = cleanText(scenario.league_name)
      const scenarioFlight = cleanText(scenario.flight)
      const scenarioTeamName = cleanText(scenario.team_name)
      const competitionLayer = inferCompetitionLayerForContext({
        leagueName: scenarioLeagueName,
      })
      const scenarioTeamId = scenarioTeamName
        ? buildScopedTeamEntityId({
            competitionLayer,
            teamName: scenarioTeamName,
            leagueName: scenarioLeagueName,
            flight: scenarioFlight,
          })
        : null
      const scenarioLeagueId = scenarioLeagueName
        ? buildScopedLeagueEntityId({
            competitionLayer,
            leagueName: scenarioLeagueName,
            flight: scenarioFlight,
            section: null,
            district: null,
          })
        : null

      if (
        !followContainsEntity(followTeams, 'team', scenarioTeamId) &&
        !followContainsEntity(followLeagues, 'league', scenarioLeagueId)
      ) {
        continue
      }

      items.push({
        id: `scenario-${scenario.id}`,
        type: 'team',
        title: `${scenario.scenario_name} saved`,
        body: `${scenario.team_name || 'Team'} lineup scenario was saved for ${scenario.opponent_team || 'the upcoming opponent'}${scenario.match_date ? ` on ${safeDate(scenario.match_date)}` : ''}.`,
        entityType: scenarioTeamId ? 'team' : 'league',
        entityId: scenarioTeamId || scenarioLeagueId,
        entityName: scenario.team_name || scenario.league_name || 'Scenario',
        createdAt: scenario.match_date || new Date().toISOString(),
        score: 87,
        badge: 'Lineup',
        accent: accentForType('team'),
      })
    }

    const streakPlayers = players
      .filter((player) => typeof player.overall_dynamic_rating === 'number')
      .sort((a, b) => (b.overall_dynamic_rating ?? 0) - (a.overall_dynamic_rating ?? 0))
      .slice(0, 8)

    streakPlayers.forEach((player, index) => {
      if (!followPlayers.some((f) => f.entity_id === player.id)) return
      items.push({
        id: `achievement-${player.id}`,
        type: 'achievement',
        title: `${player.name} is trending up`,
        body: `${player.name} is sitting near the top of your followed players by overall dynamic rating at ${formatRating(player.overall_dynamic_rating)}.`,
        entityType: 'player',
        entityId: player.id,
        entityName: player.name,
        createdAt: new Date(Date.now() - index * 3600 * 1000).toISOString(),
        score: 85 - index,
        badge: 'Achievement',
        accent: accentForType('achievement'),
      })
    })

    followedTiqIndividualParticipations.slice(0, 24).forEach((entry, index) => {
      const leagueEntityId = buildScopedLeagueEntityId({
        competitionLayer: 'tiq',
        leagueName: entry.leagueName,
        flight: entry.leagueFlight,
        section: null,
        district: null,
      })

      items.push({
        id: `tiq-individual-${entry.leagueId}-${entry.playerName}`,
        type: 'league',
        title: `${entry.playerName} is active in ${entry.leagueName}`,
        body: `${entry.playerName} is competing in a TIQ individual league${entry.seasonLabel ? ` for ${entry.seasonLabel}` : ''}${entry.leagueFlight ? ` at ${entry.leagueFlight}` : ''}${entry.locationLabel ? ` in ${entry.locationLabel}` : ''}.`,
        entityType: 'league',
        entityId: leagueEntityId,
        entityName: entry.leagueName,
        createdAt: new Date(Date.now() - index * 2700 * 1000).toISOString(),
        score: 89 - index,
        badge: 'TIQ League',
        accent: accentForType('league'),
      })
    })

    const tiqLeagueSummaries = buildTiqIndividualLeagueSummaries(tiqIndividualResults)

    tiqIndividualResults.slice(0, 30).forEach((result, index) => {
      const playerAName = result.playerAName.toLowerCase()
      const playerBName = result.playerBName.toLowerCase()
      const winnerName = result.winnerPlayerName
      const loserName = winnerName === result.playerAName ? result.playerBName : result.playerAName
      const shouldInclude =
        followedPlayerNameSet.has(playerAName) ||
        followedPlayerNameSet.has(playerBName) ||
        followedLeagueIds.has(result.leagueId.toLowerCase())

      if (!shouldInclude) return

      const summary = tiqLeagueSummaries.get(result.leagueId)
      const leagueContext = tiqLeagueContextById.get(result.leagueId)
      items.push({
        id: `tiq-result-${result.id}`,
        type: 'league',
        title: `${winnerName} won a TIQ match in ${leagueContext?.leagueName || 'TIQ Individual League'}`,
        body: `${winnerName} defeated ${loserName}${result.score ? ` ${result.score}` : ''}${summary?.leaderName ? `. Current leader: ${summary.leaderName} (${summary.leaderRecord})` : ''}.`,
        entityType: 'league',
        entityId: buildScopedLeagueEntityId({
          competitionLayer: 'tiq',
          leagueName: leagueContext?.leagueName || result.leagueId,
          flight: leagueContext?.leagueFlight || null,
          section: null,
          district: null,
        }),
        entityName: leagueContext?.leagueName || 'TIQ Individual League',
        createdAt: result.resultDate || result.createdAt,
        score: 97 - index,
        badge: 'TIQ Result',
        accent: accentForType('league'),
      })
    })

    followedTiqIndividualLeagueInsights.slice(0, 12).forEach((item, index) => {
      items.push({
        id: `tiq-opportunity-${item.league.id}`,
        type: 'league',
        title: `${item.formatLabel} next step in ${item.league.leagueName}`,
        body: `${item.nextAction}${item.summary?.leaderName ? ` Current leader: ${item.summary.leaderName} (${item.summary.leaderRecord}).` : ''}`,
        entityType: 'league',
        entityId: buildScopedLeagueEntityId({
          competitionLayer: 'tiq',
          leagueName: item.league.leagueName,
          flight: item.league.flight,
          section: null,
          district: null,
        }),
        entityName: item.league.leagueName,
        createdAt: item.summary?.latestResult?.resultDate || item.summary?.latestResult?.createdAt || item.league.updatedAt,
        score: 82 - index,
        badge: 'TIQ Next',
        accent: accentForType('league'),
      })
    })

    followedTiqSuggestionItems.slice(0, 18).forEach((suggestion, index) => {
      const league = tiqLeagues.find((item) => item.id === suggestion.leagueId)
      items.push({
        id: `tiq-suggestion-${suggestion.id}`,
        type: 'league',
        title:
          suggestion.status === 'completed'
            ? `Completed TIQ prompt in ${league?.leagueName || 'TIQ League'}`
            : suggestion.claimedByLabel
              ? `Claimed TIQ prompt in ${league?.leagueName || 'TIQ League'}`
              : `Open TIQ prompt in ${league?.leagueName || 'TIQ League'}`,
        body: `${suggestion.title}. ${suggestion.body || getTiqIndividualCompetitionFormatNextAction(suggestion.individualCompetitionFormat, league?.leagueName || 'This TIQ league')}${suggestion.claimedByLabel ? ` Claimed by ${suggestion.claimedByLabel}.` : ''}`,
        entityType: 'league',
        entityId: buildScopedLeagueEntityId({
          competitionLayer: 'tiq',
          leagueName: league?.leagueName || suggestion.leagueId,
          flight: league?.flight || null,
          section: null,
          district: null,
        }),
        entityName: league?.leagueName || 'TIQ Individual League',
        createdAt: suggestion.updatedAt || suggestion.createdAt,
        score: 78 - index,
        badge:
          suggestion.status === 'completed'
            ? 'TIQ Done'
            : suggestion.claimedByLabel
              ? 'TIQ Claimed'
              : 'TIQ Prompt',
        accent: accentForType('league'),
      })
    })

    if (!items.length) {
      items.push({
        id: 'community-welcome',
        type: 'community',
        title: 'Start following players, teams, and leagues',
        body: MY_LAB_STORY.upgradeBody,
        entityType: 'community',
        entityId: null,
        entityName: 'Community',
        createdAt: new Date().toISOString(),
        score: 999,
        badge: 'Welcome',
        accent: accentForType('community'),
      })
    }

    const deduped = new Map<string, FeedItem>()
    for (const item of items) {
      if (!deduped.has(item.id)) deduped.set(item.id, item)
    }

    return Array.from(deduped.values())
      .filter((item) => feedFilter === 'all' || item.type === feedFilter)
      .sort(
        (a, b) =>
          b.score - a.score || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 30)
  }, [
    follows,
    players,
    matches,
    matchPlayersByMatch,
    scenarios,
    playerMap,
    feedFilter,
    cloudFeedRows,
    tiqIndividualResults,
    tiqLeagues,
    followedTiqSuggestionItems,
    followedTiqIndividualLeagueInsights,
    followedTiqIndividualParticipations,
    followedLeagueIds,
    followedPlayerNameSet,
    tiqLeagueContextById,
  ])

  const followedPlayerSignals = useMemo(() => {
    return follows
      .filter((f) => f.entity_type === 'player')
      .map((f) => {
        const player = playerMap.get(f.entity_id)
        if (!player) return null
        const base = player.overall_dynamic_rating
        const usta = player.overall_usta_dynamic_rating
        if (base == null || usta == null) return { id: f.entity_id, name: f.entity_name, status: null as null, tiq: base }
        const diff = usta - base
        const status =
          diff >= 0.15 ? 'Bump Up Pace' :
          diff >= 0.07 ? 'Trending Up' :
          diff > -0.07 ? 'Holding' :
          diff > -0.15 ? 'At Risk' : 'Drop Watch'
        return { id: f.entity_id, name: f.entity_name, status, tiq: base }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
  }, [follows, playerMap])

  async function persistFollows(next: FollowItem[]) {
    setFollows(next)
    writeLocalFollows(next)

    try {
      if (!userId) {
        setSavedToCloud(false)
        return
      }

      const { error: deleteError } = await supabase.from('user_follows').delete().eq('user_id', userId)

      if (deleteError && !/relation .* does not exist/i.test(deleteError.message)) {
        throw deleteError
      }

      if (next.length) {
        const payload = next.map((item) => ({
          user_id: userId,
          entity_type: item.entity_type,
          entity_id: item.entity_id,
          entity_name: item.entity_name,
          subtitle: item.subtitle,
        }))

        const { error: insertError } = await supabase.from('user_follows').insert(payload)

        if (insertError && !/relation .* does not exist/i.test(insertError.message)) {
          throw insertError
        }

        if (!insertError) setSavedToCloud(true)
      } else {
        setSavedToCloud(true)
      }
    } catch {
      setSavedToCloud(false)
    }
  }

  async function addFollow(option: SearchOption) {
    if (followContainsEntity(follows, option.type, option.id)) return
    const next: FollowItem[] = [
      {
        id: `${option.type}-${option.id}`,
        entity_type: option.type,
        entity_id: option.id,
        entity_name: option.name,
        subtitle: option.subtitle,
        created_at: new Date().toISOString(),
      },
      ...follows,
    ]
    await persistFollows(next)
    setSearch('')
  }

  async function removeFollow(item: FollowItem) {
    const next = follows.filter(
      (follow) =>
        !(
          follow.entity_type === item.entity_type &&
          entityIdsMatch(item.entity_type, follow.entity_id, item.entity_id)
        ),
    )
    await persistFollows(next)
  }

  function persistGoalList(nextGoals: LabGoalState[], nextActiveGoalId = activeGoalId, label = 'Saved just now') {
    setGoals(nextGoals)
    writeLocalGoals(userId, profileLink?.linked_player_id, nextGoals)
    const activeGoal = nextGoals.find((goal) => goal.id === nextActiveGoalId) || nextGoals[0] || EMPTY_LAB_GOAL
    writeLocalLabText(LOCAL_GOAL_KEY, userId, profileLink?.linked_player_id, activeGoal.goal)
    writeLocalLabText(LOCAL_NOTEBOOK_KEY, userId, profileLink?.linked_player_id, activeGoal.notes)
    setLastSavedAt(activeGoal.updatedAt || new Date().toISOString())
    setNotebookSavedLabel(label)
  }

  function saveNotebook() {
    const now = new Date().toISOString()
    const nextGoals = goals.map((goal) => ({
      ...goal,
      goal: goal.goal.trim(),
      progressUpdate: goal.progressUpdate.trim(),
      doingWell: goal.doingWell.trim(),
      improveNext: goal.improveNext.trim(),
      notes: goal.notes.trim(),
      updatedAt: goal.id === activeGoalId ? now : goal.updatedAt,
    }))
    persistGoalList(nextGoals)
  }

  function updateGoal(goalId: string, updates: Partial<LabGoalState>) {
    const now = new Date().toISOString()
    const nextGoals = goals.map((goal) => (
      goal.id === goalId
        ? { ...goal, ...updates, updatedAt: now }
        : goal
    ))
    persistGoalList(nextGoals, goalId, 'Saved automatically')
  }

  function addGoal() {
    const nextGoal = createEmptyGoal()
    const nextGoals = [...goals, nextGoal]
    setActiveGoalId(nextGoal.id)
    persistGoalList(nextGoals, nextGoal.id, 'New goal added')
  }

  function removeGoal(goalId: string) {
    const nextGoals = goals.filter((goal) => goal.id !== goalId)
    const normalizedGoals = nextGoals.length ? nextGoals : [createEmptyGoal()]
    const nextActiveGoalId = normalizedGoals.some((goal) => goal.id === activeGoalId)
      ? activeGoalId
      : normalizedGoals[0].id
    setActiveGoalId(nextActiveGoalId)
    persistGoalList(normalizedGoals, nextActiveGoalId, 'Goal removed')
  }

  function applyGoalTemplate(template: GoalTemplate) {
    const now = new Date().toISOString()
    const nextGoals = goals.map((goal) => (
      goal.id === activeGoalId
        ? {
            ...goal,
            ...template,
            progressStatus: 'in-progress' as const,
            updatedAt: now,
          }
        : goal
    ))
    persistGoalList(nextGoals, activeGoalId, 'Focus added')
    void trackProductUsageEvent({
      eventName: 'mylab_goal_template_applied',
      surface: 'mylab',
      planId: 'player_plus',
      metadata: {
        goal: template.goal,
        linkedPlayerId: linkedPlayer?.id ?? null,
      },
    })
  }

  function reflectOnMatch(match: PersonalMatchRow) {
    const opponent = compactOpponentLabel(match.opponent)
    const resultLabel = match.result === 'W' ? 'win' : match.result === 'L' ? 'loss' : 'match'
    const matchContext = [safeDate(match.date), match.leagueName, match.matchType, match.score].filter(Boolean).join(' - ')
    applyGoalTemplate({
      goal: `Review ${resultLabel} vs ${opponent}`,
      progressUpdate: matchContext ? `Logged from ${matchContext}.` : 'Logged from recent match history.',
      doingWell: match.result === 'W' ? 'Identify what traveled well from this win.' : doingWellDefault,
      improveNext: match.result === 'L' ? 'Choose one pattern to clean up before the next match.' : improvementDefault,
      notes: [
        `Opponent: ${match.opponent}`,
        matchContext ? `Match: ${matchContext}` : '',
        'What decided it:',
        'Next test:',
      ].filter(Boolean).join('\n'),
    })
  }

  const followedPlayers = follows.filter((item) => item.entity_type === 'player')
  const followedTeams = follows.filter((item) => item.entity_type === 'team')
  const followedLeagues = follows.filter((item) => item.entity_type === 'league')
  const isProfileConfirmed = Boolean(profileLink?.linked_player_id || profileLink?.linked_player_name)
  const linkedPlayer = profileLink?.linked_player_id ? playerMap.get(profileLink.linked_player_id) || null : null
  const isSelfRatedProfile = linkedPlayer?.rating_source === 'self'
  const isNewSelfRatedProfile = Boolean(isSelfRatedProfile && !personalMatches.length)
  const earnedAwardCards = useMemo(() => {
    const profileNames = new Set(
      [profileLink?.linked_player_name, linkedPlayer?.name]
        .map((name) => cleanText(name || '').toLowerCase())
        .filter(Boolean),
    )
    if (!profileNames.size) return []

    return tiqAwards
      .filter((award) => profileNames.has(cleanText(award.recipientName).toLowerCase()))
      .slice(0, 4)
      .map((award) => ({
        label: award.badgeLabel,
        value: award.badgeCode,
        note: `${award.title} - ${award.sourceName}`,
        href: `/awards/${encodeURIComponent(award.id)}`,
        cta: 'Certificate',
      }))
  }, [linkedPlayer?.name, profileLink?.linked_player_name, tiqAwards])
  const firstName = (profileLink?.linked_player_name || linkedPlayer?.name || '').split(' ')[0] || ''
  const welcomeLine = firstName ? `Welcome back, ${firstName}.` : 'Welcome to your lab.'
  const recentDecisionMatches = personalMatches.filter((match) => match.result === 'W' || match.result === 'L')
  const recentWins = recentDecisionMatches.filter((match) => match.result === 'W').length
  const recentLosses = recentDecisionMatches.filter((match) => match.result === 'L').length
  const recentRecordLabel = recentDecisionMatches.length ? `${recentWins}-${recentLosses}` : 'New'
  const recentWinRate = recentDecisionMatches.length ? Math.round((recentWins / recentDecisionMatches.length) * 100) : 0
  const lastMatch = personalMatches[0] || null
  const lastMatchSummary = lastMatch ? `Last: ${lastMatch.result} vs ${compactOpponentLabel(lastMatch.opponent)}` : 'Recent results appear as imports connect.'
  const personalSinglesCount = personalMatches.filter((match) => (match.matchType || '').toLowerCase().includes('singles')).length
  const personalDoublesCount = personalMatches.filter((match) => (match.matchType || '').toLowerCase().includes('doubles')).length
  const currentTiq = linkedPlayer?.overall_dynamic_rating ?? null
  const ustaDynamic = isSelfRatedProfile ? null : linkedPlayer?.overall_usta_dynamic_rating ?? null
  const ustaBase =
    typeof ustaDynamic === 'number'
      ? Math.max(2.5, Math.floor(ustaDynamic * 2) / 2)
      : null
  const nextUstaLevel = ustaBase == null ? null : ustaBase + 0.5
  const levelProgress =
    typeof currentTiq === 'number' && ustaBase != null
      ? Math.max(0, Math.min(100, ((currentTiq - ustaBase) / 0.5) * 100))
      : 0
  const hasLevelProgress = typeof currentTiq === 'number' && ustaBase != null
  const tiqVsUsta = typeof currentTiq === 'number' && typeof ustaDynamic === 'number' ? currentTiq - ustaDynamic : null
  const levelStatus =
    tiqVsUsta == null
      ? 'Building profile'
      : tiqVsUsta >= 0.05
        ? 'Trending up'
        : tiqVsUsta <= -0.05
          ? 'Needs work'
          : 'Holding steady'
  const confidenceLabel =
    recentDecisionMatches.length >= 8 ? 'High confidence' : recentDecisionMatches.length >= 4 ? 'Medium confidence' : 'Low confidence'
  const ratingToGo = typeof currentTiq === 'number' && nextUstaLevel != null ? Math.max(0, nextUstaLevel - currentTiq) : null
  const chronologicalDecisions = [...recentDecisionMatches].sort((a, b) => {
    const left = a.date ? new Date(a.date).getTime() : 0
    const right = b.date ? new Date(b.date).getTime() : 0
    return left - right
  })
  let bestWinStreak = 0
  let rollingWinStreak = 0
  chronologicalDecisions.forEach((match) => {
    if (match.result === 'W') {
      rollingWinStreak += 1
      bestWinStreak = Math.max(bestWinStreak, rollingWinStreak)
    } else {
      rollingWinStreak = 0
    }
  })
  let currentWinStreak = 0
  for (const match of recentDecisionMatches) {
    if (match.result !== 'W') break
    currentWinStreak += 1
  }
  const seasonRecords = new Map<string, { wins: number; losses: number }>()
  const leagueRecords = new Map<string, { wins: number; losses: number }>()
  recentDecisionMatches.forEach((match) => {
    const year = match.date && !Number.isNaN(new Date(match.date).getTime())
      ? String(new Date(match.date).getFullYear())
      : 'Connected'
    const season = seasonRecords.get(year) || { wins: 0, losses: 0 }
    if (match.result === 'W') season.wins += 1
    if (match.result === 'L') season.losses += 1
    seasonRecords.set(year, season)

    const leagueName = match.leagueName || 'Connected matches'
    const league = leagueRecords.get(leagueName) || { wins: 0, losses: 0 }
    if (match.result === 'W') league.wins += 1
    if (match.result === 'L') league.losses += 1
    leagueRecords.set(leagueName, league)
  })
  const rankRecords = (records: Map<string, { wins: number; losses: number }>) =>
    [...records.entries()]
      .map(([label, record]) => ({
        label,
        ...record,
        total: record.wins + record.losses,
        winRate: record.wins + record.losses ? Math.round((record.wins / (record.wins + record.losses)) * 100) : 0,
      }))
      .filter((record) => record.total > 0)
      .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || b.total - a.total)
  const bestSeason = rankRecords(seasonRecords)[0] || null
  const bestLeague = rankRecords(leagueRecords)[0] || null
  const anchorRating = linkedPlayer?.singles_dynamic_rating ?? linkedPlayer?.overall_dynamic_rating ?? null
  const matchupCandidates =
    linkedPlayer && typeof anchorRating === 'number'
      ? players
          .filter((player) => player.id !== linkedPlayer.id)
          .map((player) => {
            const rating = player.singles_dynamic_rating ?? player.overall_dynamic_rating
            if (typeof rating !== 'number') return null
            const gap = Math.abs(rating - anchorRating)
            const fitScore = Math.max(0, Math.min(100, Math.round(100 - gap * 100)))
            return {
              player,
              rating,
              gap,
              fitScore,
              read: getMatchupRead(gap),
              href: buildSinglesMatchupHref(linkedPlayer.id, player.id),
            }
          })
          .filter((item): item is {
            player: PlayerRow
            rating: number
            gap: number
            fitScore: number
            read: string
            href: string
          } => Boolean(item))
          .sort((left, right) => left.gap - right.gap)
          .slice(0, 5)
      : []
  const topMatchupCandidate = matchupCandidates[0] || null
  const matchupQueue = matchupCandidates.slice(0, 3)
  const matchupHref = linkedPlayer ? buildSinglesMatchupHref(linkedPlayer.id, topMatchupCandidate?.player.id) : '/matchup'
  const matchupGapScore = topMatchupCandidate ? topMatchupCandidate.fitScore : 0
  const matchupReadLabel = topMatchupCandidate?.read || (isNewSelfRatedProfile ? 'Start the signal' : 'Set profile')
  const matchupPreviewCards = [
    {
      label: 'Match quality',
      value: topMatchupCandidate ? matchupReadLabel : 'Waiting',
      note: topMatchupCandidate
        ? `${topMatchupCandidate.gap.toFixed(2)} rating gap`
        : isNewSelfRatedProfile
          ? 'Add a first result or find a local test.'
          : 'Set your profile to find close tests',
    },
    {
      label: 'Your singles',
      value: `${formatRating(linkedPlayer?.singles_dynamic_rating ?? linkedPlayer?.overall_dynamic_rating ?? null)}${isSelfRatedProfile ? ' S' : ''}`,
      note: linkedPlayer ? linkedPlayer.name : 'Player profile needed',
    },
    {
      label: 'Their singles',
      value: formatRating(topMatchupCandidate?.player.singles_dynamic_rating ?? topMatchupCandidate?.player.overall_dynamic_rating ?? null),
      note: topMatchupCandidate?.player.name || 'Choose an opponent',
    },
  ]
  const activeGoal = goals.find((goal) => goal.id === activeGoalId) || goals[0] || EMPTY_LAB_GOAL
  const activeGoals = goals.filter((goal) => goal.progressStatus !== 'completed')
  const completedGoals = goals.filter((goal) => goal.progressStatus === 'completed')
  const goalReadinessChecks = goalReadinessChecksFor(activeGoal)
  const goalReadinessScore = goalReadinessScoreFor(activeGoal)
  const nextReadinessStep = goalReadinessChecks.find((item) => !item.complete)?.label || 'Ready'
  const focusSuggestion =
    activeGoal.goal.trim() ||
    (recentDecisionMatches.length >= 3 && recentLosses > recentWins
      ? 'Review recent losses and choose one pattern to clean up before the next match.'
      : topMatchupCandidate
        ? `Test yourself against ${topMatchupCandidate.player.name} and compare the read.`
        : 'Add a goal for your next two weeks of tennis.')
  const progressUpdatedLabel = activeGoal.updatedAt ? `Updated ${timeAgo(activeGoal.updatedAt)}` : 'No progress update yet'
  const improvementDefault =
    activeGoal.improveNext ||
    (recentDecisionMatches.length && recentLosses > recentWins
      ? 'Pick one repeat pattern from the recent losses.'
      : 'Use Matchup to test a close opponent.')
  const doingWellDefault =
    activeGoal.doingWell ||
    (recentDecisionMatches.length && recentWins >= recentLosses
      ? 'Recent results are holding steady.'
      : 'You have a clear place to focus next.')
  const tiqRecommendation =
    recentDecisionMatches.length >= 3 && recentLosses > recentWins
      ? 'Your recent record suggests choosing one repeat pattern from losses and tracking it for the next two matches.'
      : topMatchupCandidate
        ? `A close next test is ${topMatchupCandidate.player.name}. Use Matchup, then log what actually happened.`
        : isNewSelfRatedProfile
          ? 'Start your TIQ signal with a scorecard, a local league match, a TIQ league, or a close player to test.'
          : linkedPlayer
          ? 'Pick one measurable goal and update it after your next match so My Lab can start showing progress.'
          : 'Set your profile to unlock recommendations from ratings, match history, and matchup context.'
  const nextMoveHref = !isProfileConfirmed
    ? '/profile'
    : topMatchupCandidate
      ? matchupHref
      : '#player-notebook'
  const nextMoveCta = !isProfileConfirmed
    ? 'Set profile'
    : topMatchupCandidate
      ? 'Open matchup'
      : 'Set focus'
  const personalReadCards: Array<{
    label: string
    value: string
    note: string
    href?: string
  }> = [
    {
      label: 'Form',
      value: recentDecisionMatches.length ? recentRecordLabel : 'New',
      note: lastMatchSummary,
    },
    {
      label: 'Best test',
      value: topMatchupCandidate?.player.name || 'Waiting',
      note: topMatchupCandidate
        ? `${topMatchupCandidate.read} - ${topMatchupCandidate.gap.toFixed(2)} rating gap`
        : isNewSelfRatedProfile
          ? 'Find a local player or add a first result.'
          : 'Set your profile to build a matchup queue.',
    },
    {
      label: 'Focus',
      value: activeGoal.goal.trim() || 'Choose one',
      note: activeGoal.progressUpdate || focusSuggestion,
    },
    {
      label: 'Next move',
      value: nextMoveCta,
      note: tiqRecommendation,
      href: nextMoveHref,
    },
  ]
  const focusTemplates: Array<{ label: string } & GoalTemplate> = [
    {
      label: 'Next match plan',
      goal: topMatchupCandidate
        ? `Prepare for ${topMatchupCandidate.player.name}`
        : 'Build a plan for my next match',
      progressUpdate: topMatchupCandidate
        ? `Use the matchup read, then track what held up against ${topMatchupCandidate.player.name}.`
        : 'Choose one pattern to test, then update this after the next match.',
      doingWell: doingWellDefault,
      improveNext: improvementDefault,
      notes: topMatchupCandidate
        ? `Watch the ${topMatchupCandidate.read.toLowerCase()} and compare the rating gap after play.`
        : 'Write the opponent, score, and one pattern that decided the match.',
    },
    {
      label: 'Clean up losses',
      goal: 'Find one repeat pattern in recent losses',
      progressUpdate: recentLosses
        ? `Review ${recentLosses} recent loss${recentLosses === 1 ? '' : 'es'} and pick one fix.`
        : 'Use the next tough set as the first data point.',
      doingWell: doingWellDefault,
      improveNext: recentLosses > recentWins ? 'Turn one losing pattern into a practice target.' : improvementDefault,
      notes: 'After each match, record the point pattern that showed up most often.',
    },
    {
      label: 'Two-week focus',
      goal: 'Set a two-week tennis focus',
      progressUpdate: 'Keep this small enough to update after every match or practice.',
      doingWell: doingWellDefault,
      improveNext: improvementDefault,
      notes: 'Pick one skill, one measure, and the next time I will test it.',
    },
  ]
  const matchPlanCards = [
    {
      label: 'Before play',
      title: topMatchupCandidate ? `Prep for ${topMatchupCandidate.player.name}` : 'Choose a useful test',
      body: topMatchupCandidate
        ? `Open Matchup, check the ${topMatchupCandidate.read.toLowerCase()}, and pick one pattern to watch.`
        : 'Use the player pool or a recent opponent to build the next matchup read.',
      href: matchupHref,
      cta: topMatchupCandidate ? 'Open read' : 'Find matchup',
    },
    {
      label: 'During play',
      title: activeGoal.goal.trim() || 'Play with one focus',
      body: activeGoal.improveNext || improvementDefault,
      href: '#player-notebook',
      cta: 'See focus',
    },
    {
      label: 'After play',
      title: activeGoal.progressUpdate.trim() ? 'Update the result' : 'Log what happened',
      body: activeGoal.progressUpdate || 'Add the score, the pattern that mattered, and what to test next.',
      href: '#player-notebook',
      cta: 'Log update',
    },
  ]
  const goalSummaryCards = [
    {
      label: 'Active goals',
      value: String(activeGoals.length || goals.length),
      note: progressUpdatedLabel,
    },
    {
      label: 'Main focus',
      value: activeGoal.goal || 'Set a goal',
      note: activeGoal.progressUpdate || 'Add a short update after practice or a match.',
    },
    {
      label: 'Doing well',
      value: doingWellDefault,
      note: 'Keep the part of your game that is already working visible.',
    },
    {
      label: 'Improve next',
      value: improvementDefault,
      note: 'One adjustment beats five vague intentions.',
    },
    {
      label: 'Completed',
      value: String(completedGoals.length),
      note: 'Keep finished goals in view without letting them crowd the page.',
    },
  ]
  const personalCommandCards = [
    {
      label: 'Where am I?',
      value: formatRating(linkedPlayer?.overall_dynamic_rating ?? null),
      note: linkedPlayer ? `${linkedPlayer.name} - ${linkedPlayer.location || 'player profile'}` : 'Set your profile to start this read.',
      href: '/profile',
      cta: 'Manage profile',
      icon: 'playerRatings' as TiqFeatureIconName,
    },
    {
      label: 'How am I doing?',
      value: recentRecordLabel,
      note: lastMatchSummary,
      href: '#recent-matches',
      cta: 'Review matches',
      icon: 'reports' as TiqFeatureIconName,
    },
    {
      label: 'What should I focus on?',
      value: activeGoal.goal.trim() ? goalStatusLabel(activeGoal.progressStatus) : 'Choose one',
      note: focusSuggestion,
      href: '#player-notebook',
      cta: 'Open notebook',
      icon: 'myLab' as TiqFeatureIconName,
    },
  ]
  const dataAssistMyLabHref = '/data-assist?intent=upload-source&context=My%20Lab'
  const youHubCards = [
    {
      label: 'Open My Lab',
      value: 'Home base',
      note: isNewSelfRatedProfile
        ? 'Your self-rated profile is live. Add a scorecard or match signal when ready.'
        : 'Ratings, recent matches, goals, follows, and the next useful read.',
      href: '#scorecard-summary',
      cta: 'Stay here',
      icon: 'myLab' as TiqFeatureIconName,
    },
    {
      label: 'Improve data',
      value: isNewSelfRatedProfile ? 'First signal' : 'Refresh',
      note: isNewSelfRatedProfile
        ? 'Upload a scorecard or team summary to replace the starter signal.'
        : 'Upload, report, or correct the tennis context behind your read.',
      href: dataAssistMyLabHref,
      cta: 'Open Data Assist',
      icon: 'reports' as TiqFeatureIconName,
    },
    {
      label: 'Prep matchup',
      value: topMatchupCandidate ? topMatchupCandidate.player.name : 'Compare',
      note: topMatchupCandidate
        ? `${topMatchupCandidate.read} - gap ${topMatchupCandidate.gap.toFixed(2)}`
        : isNewSelfRatedProfile
          ? 'Find a local player and start your first comparison.'
          : 'Compare a player or court before you play.',
      href: matchupHref,
      cta: 'Open Matchup',
      icon: 'matchupAnalysis' as TiqFeatureIconName,
    },
    {
      label: 'Review messages',
      value: 'Inbox',
      note: 'Keep tennis replies, scheduling threads, and alerts together.',
      href: '/messages',
      cta: 'Open Messages',
      icon: 'messagingCenter' as TiqFeatureIconName,
    },
  ]
  const tiqActionCards = [
    ...followedTiqSuggestionItems
      .filter((suggestion) => suggestion.status === 'open')
      .slice(0, 2)
      .map((suggestion) => {
        const league = tiqLeagues.find((item) => item.id === suggestion.leagueId)
        return {
          id: `suggestion-${suggestion.id}`,
          label: 'TIQ prompt',
          title: suggestion.title,
          text:
            suggestion.body ||
            getTiqIndividualCompetitionFormatNextAction(
              suggestion.individualCompetitionFormat,
              league?.leagueName || 'this TIQ league',
            ),
          primaryHref: buildTiqSuggestionResultHref(suggestion),
          primaryLabel: 'Log result',
          secondaryHref: buildTiqLeagueDetailHref(suggestion.leagueId),
          secondaryLabel: 'Open league',
          meta: league?.leagueName || 'TIQ Individual League',
        }
      }),
    ...followedTiqIndividualLeagueInsights.slice(0, 2).map((item) => ({
      id: `insight-${item.league.id}`,
      label: item.formatLabel,
      title: item.league.leagueName,
      text: item.summary?.leaderName
        ? `${item.nextAction} Current leader: ${item.summary.leaderName} (${item.summary.leaderRecord}).`
        : item.nextAction,
      primaryHref: buildTiqLeagueDetailHref(item.league.id),
      primaryLabel: 'Open league',
      secondaryHref: '/compete/results',
      secondaryLabel: 'Results',
      meta: item.summary?.resultCount ? `${item.summary.resultCount} results` : 'Ready for first result',
    })),
  ].slice(0, 3)
  const teamPrepCards = access.canUseCaptainWorkflow
    ? linkedPlayerTeamSummaries.slice(0, 3).map((team) => {
        const parsed = parseTeamEntityId(team.id)
        const competitionLayer = parsed.competitionLayer || inferCompetitionLayerForContext({ leagueName: team.league })
        const leagueName = parsed.leagueName || team.league || ''
        const flight = parsed.flight || team.flight || ''
        const scope = {
          competitionLayer,
          team: team.name,
          league: leagueName,
          flight,
        }

        return {
          id: team.id,
          title: team.name,
          meta: [leagueName, flight, `${team.playerCount} players`].filter(Boolean).join(' - '),
          briefHref: buildCaptainScopedHref('/captain/weekly-brief', scope),
          availabilityHref: buildCaptainScopedHref('/captain/availability', scope),
          lineupHref: buildCaptainScopedHref('/captain/lineup-builder', scope),
        }
      })
    : []
  const confirmedLeagueCount = new Set(
    linkedPlayerTeamSummaries
      .map((team) => [team.league, team.flight].filter(Boolean).join(' - '))
      .filter(Boolean),
  ).size
  const visualStatBars = [
    {
      label: 'Recent win rate',
      value: recentWinRate,
      text: recentDecisionMatches.length ? `${recentWinRate}% across connected decisions` : 'Waiting on connected results',
      figure: recentDecisionMatches.length ? `${recentWinRate}%` : 'New',
    },
    {
      label: 'Singles share',
      value: personalMatches.length ? Math.round((personalSinglesCount / personalMatches.length) * 100) : 0,
      text: `${personalSinglesCount} singles matches`,
      figure: String(personalSinglesCount),
    },
    {
      label: 'Doubles share',
      value: personalMatches.length ? Math.round((personalDoublesCount / personalMatches.length) * 100) : 0,
      text: `${personalDoublesCount} doubles matches`,
      figure: String(personalDoublesCount),
    },
    {
      label: 'Team context',
      value: Math.min(100, (linkedPlayerTeamSummaries.length || (profileLink?.linked_team_name ? 1 : 0)) * 25),
      text: confirmedLeagueCount ? `${confirmedLeagueCount} leagues detected` : 'Grows as results connect',
      figure: String(linkedPlayerTeamSummaries.length || (profileLink?.linked_team_name ? 1 : 0)),
    },
  ]
  const ratingVisuals = [
    {
      label: 'USTA base',
      value: ustaBase,
      display: isSelfRatedProfile ? 'Pending' : ustaBase == null ? 'New' : ustaBase.toFixed(2),
    },
    {
      label: 'USTA dynamic',
      value: ustaDynamic,
      display: isSelfRatedProfile ? 'Pending' : formatRating(ustaDynamic),
    },
    {
      label: 'Overall',
      value: currentTiq,
      display: `${formatRating(currentTiq)}${isSelfRatedProfile ? ' S' : ''}`,
    },
    {
      label: 'Singles',
      value: linkedPlayer?.singles_dynamic_rating ?? null,
      display: `${formatRating(linkedPlayer?.singles_dynamic_rating ?? null)}${isSelfRatedProfile ? ' S' : ''}`,
    },
    {
      label: 'Doubles',
      value: linkedPlayer?.doubles_dynamic_rating ?? null,
      display: `${formatRating(linkedPlayer?.doubles_dynamic_rating ?? null)}${isSelfRatedProfile ? ' S' : ''}`,
    },
  ]
  const scorecardSummaryCards = [
    { label: 'Recent record', value: recentRecordLabel, note: `${recentDecisionMatches.length} connected decisions` },
    { label: 'Win rate', value: recentDecisionMatches.length ? `${recentWinRate}%` : 'New', note: lastMatchSummary },
    {
      label: 'Matchup read',
      value: matchupReadLabel,
      note: topMatchupCandidate ? `${topMatchupCandidate.player.name} - gap ${topMatchupCandidate.gap.toFixed(2)}` : 'Use Matchup to compare',
    },
    { label: 'Current focus', value: activeGoal.goal || 'Optional', note: activeGoal.progressUpdate || 'Add a goal only when it helps' },
  ]
  const starterActionCards = [
    {
      title: 'Upload scores',
      text: 'Use a scorecard or team summary to replace the starter rating with verified match context.',
      href: dataAssistMyLabHref,
    },
    {
      title: 'Local leagues',
      text: 'Find nearby league play and register your first match path.',
      href: '/explore/leagues',
    },
    {
      title: 'Create league',
      text: 'Start a TIQ league when your group needs structure, results, and rankings.',
      href: '/league-coordinator',
    },
    {
      title: 'Find players',
      text: 'Pick a local player, open Matchup, and get a first comparison going.',
      href: '/explore/players',
    },
  ]
  const trophyRoomCards = [
    ...earnedAwardCards,
    {
      label: 'Peak TIQ',
      value: formatRating(
        [linkedPlayer?.overall_dynamic_rating, linkedPlayer?.singles_dynamic_rating, linkedPlayer?.doubles_dynamic_rating]
          .filter((value): value is number => typeof value === 'number')
          .sort((a, b) => b - a)[0] ?? null,
      ),
      note: 'Best rating mark currently connected',
    },
    {
      label: 'Best streak',
      value: bestWinStreak ? `${bestWinStreak}W` : 'New',
      note: currentWinStreak ? `${currentWinStreak}W active streak` : 'Win streaks appear as results connect',
    },
    {
      label: 'Best season',
      value: bestSeason?.label || 'New',
      note: bestSeason ? `${bestSeason.wins}W-${bestSeason.losses}L - ${bestSeason.winRate}% win rate` : 'Season finishes appear from match history',
    },
    {
      label: 'Best league',
      value: bestLeague?.label || 'New',
      note: bestLeague ? `${bestLeague.wins}W-${bestLeague.losses}L - ${bestLeague.winRate}% win rate` : 'League finishes appear from match history',
    },
  ]
  return (
    <section style={pageStyle}>
      {!accessPending && !access.canUseAdvancedPlayerInsights ? (
        <UpgradePrompt
          planId="player_plus"
          headline={MY_LAB_STORY.upgradeHeadline}
          body={MY_LAB_STORY.upgradeBody}
          ctaLabel={MY_LAB_STORY.upgradeCta}
          secondaryLabel={MY_LAB_STORY.upgradeSecondary}
          footnote={MY_LAB_STORY.upgradeFootnote}
          compact
        />
      ) : null}

      <section id="player-workshop" style={profileLinkSectionStyle}>
        <div style={profileLinkCardStyle}>
          <span aria-hidden="true" style={watermarkStyle} />
          <div style={sectionHeaderStyle}>
            <div style={sectionTitleClusterStyle}>
              <TiqFeatureIcon name="myLab" size="lg" variant="surface" />
              <div>
                <p style={sectionKickerStyle}>You hub</p>
                <h1 style={sectionTitleStyle}>{welcomeLine}</h1>
                <p style={sectionTextStyle}>
                  My Lab is the home base. Data Assist, Matchup, and Messages stay one move away.
                </p>
              </div>
            </div>
            <Link href={matchupHref} style={secondaryButtonStyle}>
              Open Matchup
            </Link>
          </div>

          <section style={youHubPanelStyle}>
            <div style={personalCommandGridStyle(isTablet)}>
              {youHubCards.map((card) => (
                <Link key={card.label} href={card.href} style={personalCommandCardStyle}>
                  <TiqFeatureIcon name={card.icon} size="md" variant="surface" />
                  <div style={metricLabelStyle}>{card.label}</div>
                  <div style={personalHomeTitleStyle}>{card.value}</div>
                  <div style={metricNoteStyle}>{card.note}</div>
                  <span style={miniActionLinkStyle}>{card.cta}</span>
                </Link>
              ))}
            </div>
          </section>

          <section style={onboardingPanelStyle}>
            <div style={sectionHeaderStyle}>
              <div style={sectionHeaderCopyStyle}>
                <p style={sectionKickerStyle}>First My Lab read</p>
                <h2 style={compactSectionTitleStyle}>Find yourself, choose a goal, open one useful card.</h2>
                <p style={sectionTextStyle}>
                  My Lab works best when setup feels like a tennis next step, not a page full of empty counters.
                </p>
              </div>
              <Link href={isProfileConfirmed ? nextMoveHref : '/profile'} style={matchupPrimaryLinkStyle}>
                {isProfileConfirmed ? 'Open first read' : 'Find yourself'}
              </Link>
            </div>

            <div style={onboardingStepGridStyle(isTablet)}>
              <div style={onboardingStepCardStyle}>
                <span style={setupStepNumberStyle}>1</span>
                <strong>Find yourself</strong>
                <p>{isProfileConfirmed ? profileLink?.linked_player_name || linkedPlayer?.name || 'Player profile linked.' : 'Search for your player record or create a self-rated profile.'}</p>
                <Link href="/profile" style={smallInlineLinkStyle}>{isProfileConfirmed ? 'Review profile' : 'Set profile'}</Link>
              </div>

              <div style={onboardingStepCardStyle}>
                <span style={setupStepNumberStyle}>2</span>
                <strong>Choose your tennis goal</strong>
                <p>{activeGoal.goal.trim() || 'Pick one focus for the next two weeks.'}</p>
                <div style={onboardingGoalGridStyle}>
                  {MY_LAB_ONBOARDING_GOALS.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => applyGoalTemplate(option.template)}
                      style={activeGoal.goal === option.template.goal ? onboardingGoalButtonActiveStyle : onboardingGoalButtonStyle}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={onboardingStepCardStyle}>
                <span style={setupStepNumberStyle}>3</span>
                <strong>Open your first read</strong>
                <p>
                  {topMatchupCandidate
                    ? `Try the matchup read vs ${topMatchupCandidate.player.name}.`
                    : isProfileConfirmed
                      ? 'Upload data, follow a team, or build a matchup to sharpen the read.'
                      : 'Set your profile first, then My Lab can suggest the next card.'}
                </p>
                <div style={onboardingReadListStyle}>
                  <Link href={nextMoveHref} style={miniActionPillStyle}>{nextMoveCta}</Link>
                  <Link href={dataAssistMyLabHref} style={smallInlineLinkStyle}>Upload data</Link>
                  <Link href="/coaches" style={smallInlineLinkStyle}>Find a coach</Link>
                </div>
              </div>
            </div>
          </section>

          <section style={personalReadPanelStyle}>
            <div style={personalReadHeaderStyle}>
              <div style={sectionHeaderCopyStyle}>
                <p style={sectionKickerStyle}>Today&apos;s next move</p>
                <h3 style={personalReadTitleStyle}>
                  {linkedPlayer ? `${linkedPlayer.name}: ${nextMoveCta}` : 'Set your profile to unlock your read'}
                </h3>
              </div>
              <Link href={nextMoveHref} style={matchupPrimaryLinkStyle}>
                {nextMoveCta}
              </Link>
            </div>
            <div style={personalReadGridStyle(isTablet)}>
              {personalReadCards.map((card) => (
                card.href ? (
                  <Link key={card.label} href={card.href} style={personalReadCardLinkStyle}>
                    <div style={metricLabelStyle}>{card.label}</div>
                    <div style={personalReadValueStyle}>{card.value}</div>
                    <div style={metricNoteStyle}>{card.note}</div>
                  </Link>
                ) : (
                  <div key={card.label} style={personalReadCardStyle}>
                    <div style={metricLabelStyle}>{card.label}</div>
                    <div style={personalReadValueStyle}>{card.value}</div>
                    <div style={metricNoteStyle}>{card.note}</div>
                  </div>
                )
              ))}
            </div>
          </section>

          <PlayerDevelopmentPathPanel
            linkedPlayerName={linkedPlayer?.name || profileLink?.linked_player_name || ''}
            currentGoal={activeGoal?.goal || ''}
          />

          <PlayerCoachAssignmentsPanel
            assignments={coachAssignments}
            coachLinks={coachLinks}
            loading={coachAssignmentsLoading}
            message={coachAssignmentsMessage}
            onComplete={completeCoachAssignment}
          />

          {linkedPlayer ? (
            <>
              <section id="scorecard-summary" style={levelUpPanelStyle(isTablet)}>
                <div style={levelMeterStyle}>
                  <div style={levelMeterHeaderStyle}>
                    <div style={sectionHeaderCopyStyle}>
                      <div style={levelMeterTitleStyle}>Level-up meter</div>
                      <div style={levelBadgeRowStyle}>
                        <span style={levelStatus === 'Trending up' ? pillGreenStyle : levelStatus === 'Needs work' ? pillRedStyle : pillBlueStyle}>
                          {levelStatus}
                        </span>
                        <span style={pillSlateStyle}>{confidenceLabel}</span>
                      </div>
                    </div>
                    <div style={levelRatingBlockStyle}>
                      <strong style={levelRatingNumberStyle}>{formatRating(currentTiq)}</strong>
                      <span>
                        {ustaBase == null || nextUstaLevel == null
                          ? 'Build match history'
                          : `USTA ${ustaBase.toFixed(2)} - next ${nextUstaLevel.toFixed(1)}`}
                      </span>
                      <small>{tiqVsUsta == null ? 'TIQ vs USTA appears after linking' : `TIQ vs USTA ${tiqVsUsta >= 0 ? '+' : ''}${tiqVsUsta.toFixed(2)}`}</small>
                    </div>
                  </div>
                  <div style={levelMeterMetaStyle}>
                    <strong>{ustaBase == null ? 'USTA base pending' : `USTA ${ustaBase.toFixed(2)} - TIQ overall ${formatRating(currentTiq)}`}</strong>
                    <span>{ratingToGo == null ? 'Set your profile to show your next level path.' : `${ratingToGo.toFixed(2)} to go`}</span>
                  </div>
                  <div style={progressTrackStyle} aria-label={hasLevelProgress ? `Level progress ${Math.round(levelProgress)} percent` : 'Level progress pending'}>
                    <div style={levelProgressFillStyle(levelProgress, hasLevelProgress)} />
                  </div>
                  <div style={levelMeterScaleStyle}>
                    <span>{ustaBase == null ? 'Base' : ustaBase.toFixed(1)}</span>
                    <span>{ratingToGo == null ? 'Next level' : `${ratingToGo.toFixed(2)} to go`}</span>
                    <span>{nextUstaLevel == null ? 'Next' : nextUstaLevel.toFixed(1)}</span>
                  </div>
                </div>

                <div style={quickProfileStyle}>
                  <h3 style={quickProfileTitleStyle}>Quick profile view</h3>
                  <div style={quickProfileGridStyle(isTablet)}>
                    {ratingVisuals.map((rating) => (
                      <div key={rating.label} style={quickProfileCardStyle}>
                        <div style={metricLabelStyle}>{rating.label}</div>
                        <div style={quickProfileValueStyle}>{rating.display}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {isNewSelfRatedProfile ? (
                <section style={starterPanelStyle}>
                  <div style={sectionHeaderStyle}>
                    <div style={sectionTitleClusterStyle}>
                      <TiqFeatureIcon name="playerRatings" size="md" variant="surface" />
                      <div>
                        <p style={sectionKickerStyle}>Self-rated start</p>
                        <h3 style={compactSectionTitleStyle}>Get your TIQ score moving</h3>
                        <p style={sectionTextStyle}>
                          Your rating shows an S until verified match or TennisLink data replaces it.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div style={starterGridStyle(isTablet)}>
                    {starterActionCards.map((card) => (
                      <Link key={card.title} href={card.href} style={starterCardStyle}>
                        <strong>{card.title}</strong>
                        <span>{card.text}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              <section style={todayReadPanelStyle}>
                <div style={workshopContextRowStyle}>
                  <span>Today&apos;s read</span>
                  <strong>{linkedPlayer?.name || profileLink?.linked_player_name || 'Player profile'}</strong>
                </div>
                <div style={todayReadGridStyle(isTablet)}>
                  {scorecardSummaryCards.map((item) => (
                    <div key={item.label} style={todayReadCardStyle}>
                      <div style={metricLabelStyle}>{item.label}</div>
                      <div style={todayReadValueStyle}>{item.value}</div>
                      <div style={metricNoteStyle}>{item.note}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section style={matchupSpotlightStyle}>
                <div style={matchupSpotlightHeroStyle(isTablet)}>
                  <div style={sectionTitleClusterStyle}>
                    <TiqFeatureIcon name="matchupAnalysis" size="md" variant="surface" />
                    <div>
                      <p style={sectionKickerStyle}>Matchup spotlight</p>
                      <h3 style={matchupSpotlightTitleStyle}>
                        {topMatchupCandidate ? `${linkedPlayer?.name || 'You'} vs ${topMatchupCandidate.player.name}` : 'Find your next useful test'}
                      </h3>
                      <p style={sectionTextStyle}>
                        {topMatchupCandidate
                          ? 'Pick a close test, open the read, then decide what to work on next.'
                          : 'Set your profile and My Lab will turn the player pool into matchup suggestions.'}
                      </p>
                    </div>
                  </div>
                  <Link href={matchupHref} style={matchupPrimaryLinkStyle}>
                    Compare now
                  </Link>
                </div>
                <div style={matchupMeterStyle}>
                  <div style={workshopContextRowStyle}>
                    <span>{matchupReadLabel}</span>
                    <strong>{topMatchupCandidate ? `${matchupGapScore.toFixed(0)}% fit` : 'No read yet'}</strong>
                  </div>
                  <div style={matchupTrackStyle}>
                    <div style={matchupFillStyle(matchupGapScore)} />
                  </div>
                </div>
                <div style={matchupPreviewGridStyle(isTablet)}>
                  {matchupPreviewCards.map((card) => (
                    <div key={card.label} style={matchupPreviewCardStyle}>
                      <div style={metricLabelStyle}>{card.label}</div>
                      <div style={todayReadValueStyle}>{card.value}</div>
                      <div style={metricNoteStyle}>{card.note}</div>
                    </div>
                  ))}
                </div>
                {matchupQueue.length ? (
                  <div style={matchupQueueGridStyle(isTablet)}>
                    {matchupQueue.map((candidate, index) => (
                      <Link key={candidate.player.id} href={candidate.href} style={matchupQueueCardStyle}>
                        <div style={matchupQueueRankStyle}>{index + 1}</div>
                        <div style={matchupQueueCopyStyle}>
                          <div style={matchupQueueNameStyle}>{candidate.player.name}</div>
                          <div style={matchupQueueMetaStyle}>
                            {candidate.read} - gap {candidate.gap.toFixed(2)}
                          </div>
                        </div>
                        <div style={matchupQueueFitStyle}>
                          <strong>{candidate.fitScore}%</strong>
                          <span>fit</span>
                        </div>
                        <div style={matchupQueueTrackStyle}>
                          <span style={matchupQueueFillStyle(candidate.fitScore)} />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div style={emptyStateStyle}>
                    {isProfileConfirmed
                      ? 'Matchup queue appears when your rating and player pool are available.'
                      : 'Manage your profile to unlock matchup suggestions.'}
                  </div>
                )}
              </section>

              <details style={labDrawerDetailsStyle}>
                <summary style={labDrawerSummaryStyle}>
                  <span style={labDrawerSummaryCopyStyle}>
                    <strong>Deeper lab read</strong>
                    <em style={labDrawerSummaryHintStyle}>Goals, trends, and records after the quick read.</em>
                  </span>
                  <span style={optionalContextCountStyle}>3 views</span>
                </summary>

                <div style={labDrawerContentStyle}>
                  <section style={matchPlanPanelStyle}>
                    <div style={sectionHeaderStyle}>
                      <div style={sectionTitleClusterStyle}>
                        <TiqFeatureIcon name="matchPrep" size="md" variant="surface" />
                        <div>
                          <p style={sectionKickerStyle}>Match plan</p>
                          <h3 style={compactSectionTitleStyle}>Turn the read into one action</h3>
                          <p style={sectionTextStyle}>
                            Pick what matters before the next match.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => applyGoalTemplate(focusTemplates[0])}
                        style={smallGhostButtonStyle}
                      >
                        Use suggested focus
                      </button>
                    </div>
                    <div style={matchPlanGridStyle(isTablet)}>
                      {matchPlanCards.map((card) => (
                        <Link
                          key={card.label}
                          href={card.href}
                          style={matchPlanCardStyle}
                          onClick={() => {
                            void trackProductUsageEvent({
                              eventName: 'mylab_match_plan_action',
                              surface: 'mylab',
                              planId: 'player_plus',
                              metadata: {
                                action: card.label,
                                href: card.href,
                                linkedPlayerId: linkedPlayer?.id ?? null,
                                matchupPlayerId: topMatchupCandidate?.player.id ?? null,
                              },
                            })
                          }}
                        >
                          <span style={miniActionPillStyle}>{card.label}</span>
                          <strong>{card.title}</strong>
                          <span style={matchPlanTextStyle}>{card.body}</span>
                          <span style={miniActionLinkStyle}>{card.cta}</span>
                        </Link>
                      ))}
                    </div>
                  </section>

                  <section style={performancePanelStyle}>
                    <div style={sectionHeaderStyle}>
                      <div style={sectionTitleClusterStyle}>
                        <TiqFeatureIcon name="playerRatings" size="md" variant="surface" />
                        <div>
                          <p style={sectionKickerStyle}>Performance mix</p>
                          <h3 style={compactSectionTitleStyle}>Stats that explain the score</h3>
                        </div>
                      </div>
                    </div>
                    <div style={performanceGridStyle(isTablet)}>
                      {visualStatBars.map((bar) => (
                        <div key={bar.label} style={performanceCardStyle}>
                          <div style={statRingStyle(bar.value)}>
                            <span>{bar.figure}</span>
                          </div>
                          <div>
                            <div style={performanceCardTitleStyle}>{bar.label}</div>
                            <div style={metricNoteStyle}>{bar.text}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section style={trophyRoomPanelStyle}>
                    <div style={sectionHeaderStyle}>
                      <div style={sectionTitleClusterStyle}>
                        <TiqFeatureIcon name="teamRankings" size="md" variant="surface" />
                        <div>
                          <p style={sectionKickerStyle}>Trophy room</p>
                          <h3 style={compactSectionTitleStyle}>Personal records</h3>
                          <p style={sectionTextStyle}>Tournament honors and best marks across the tracked history for this profile.</p>
                        </div>
                      </div>
                    </div>
                    <div style={trophyProofGridStyle(isTablet)} aria-label="Trophy room proof">
                      <div style={trophyProofItemStyle}>
                        <span style={trophyProofDotStyle} />
                        <strong>Honors</strong>
                        <em>{earnedAwardCards.length || 'New'}</em>
                      </div>
                      <div style={trophyProofItemStyle}>
                        <span style={trophyProofDotStyle} />
                        <strong>Certificates</strong>
                        <em>{earnedAwardCards.length ? 'Ready' : 'Pending'}</em>
                      </div>
                      <div style={trophyProofItemStyle}>
                        <span style={trophyProofDotStyle} />
                        <strong>Best marks</strong>
                        <em>{trophyRoomCards.length - earnedAwardCards.length}</em>
                      </div>
                    </div>
                    <div style={trophyRoomGridStyle(isTablet)}>
                      {trophyRoomCards.map((record) => (
                        <div key={record.label} style={trophyCardStyle}>
                          <div style={metricLabelStyle}>{record.label}</div>
                          <div style={trophyValueStyle}>{record.value}</div>
                          <div style={metricNoteStyle}>{record.note}</div>
                          {'href' in record && record.href ? (
                            <Link href={record.href} style={trophyCardActionStyle}>
                              {record.cta}
                            </Link>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </details>
            </>
          ) : (
            <section style={setupPanelStyle(isTablet)}>
              <div style={setupHeroStyle}>
                <TiqFeatureIcon name="accountSecurity" size="lg" variant="surface" />
                <div>
                  <p style={sectionKickerStyle}>Finish setup</p>
                  <h3 style={setupTitleStyle}>Set your player profile once.</h3>
                  <p style={sectionTextStyle}>
                    My Lab becomes your scorecard after your account knows which player is you.
                  </p>
                </div>
              </div>
              <div style={setupStepGridStyle(isTablet)}>
                <div style={setupStepCardStyle}>
                  <span style={setupStepNumberStyle}>1</span>
                  <strong>Match identity</strong>
                  <p>Choose your player record in Profile.</p>
                </div>
                <div style={setupStepCardStyle}>
                  <span style={setupStepNumberStyle}>2</span>
                  <strong>Pull tennis context</strong>
                  <p>Ratings, teams, leagues, and history connect automatically.</p>
                </div>
                <div style={setupStepCardStyle}>
                  <span style={setupStepNumberStyle}>3</span>
                  <strong>Open your lab</strong>
                  <p>Scorecard, matchup queue, goals, and recent matches unlock here.</p>
                </div>
              </div>
              <div style={setupActionRowStyle}>
                <Link href="/profile" style={matchupPrimaryLinkStyle}>
                  Set profile
                </Link>
                <Link href="/explore/players" style={secondaryButtonStyle}>
                  Find player
                </Link>
              </div>
            </section>
          )}
        </div>
      </section>

      {tiqPlayerParticipationWarning ? (
        <div style={warningNoteStyle}>
          TIQ participation note: {tiqPlayerParticipationWarning}
        </div>
      ) : null}

      {linkedPlayer ? (
        <details id="player-tools" style={labDrawerDetailsStyle}>
          <summary style={labDrawerSummaryStyle}>
            <span style={labDrawerSummaryCopyStyle}>
              <strong>Notebook and match history</strong>
              <em style={labDrawerSummaryHintStyle}>Open for notes, reports, and wider tennis context.</em>
            </span>
            <span style={optionalContextCountStyle}>Open</span>
          </summary>

          <section style={profileLinkSectionStyle}>
          <div style={profileLinkCardStyle}>
            <div style={sectionHeaderStyle}>
              <div style={sectionHeaderCopyStyle}>
                <p style={sectionKickerStyle}>Player workshop</p>
                <h2 style={sectionTitleStyle}>What should I do next?</h2>
                <p style={sectionTextStyle}>
                  Review the scorecard, choose one focus, then go play.
                </p>
              </div>
              <Link href={matchupHref} style={secondaryButtonStyle}>
                Open Matchup
              </Link>
            </div>

            <div style={personalCommandGridStyle(isTablet)}>
              {personalCommandCards.map((card) => (
                <Link key={card.label} href={card.href} style={personalCommandCardStyle}>
                  <TiqFeatureIcon name={card.icon} size="md" variant="surface" />
                  <div style={metricLabelStyle}>{card.label}</div>
                  <div style={personalHomeTitleStyle}>{card.value}</div>
                  <div style={metricNoteStyle}>{card.note}</div>
                  <span style={miniActionLinkStyle}>{card.cta}</span>
                </Link>
              ))}
            </div>

            {tiqActionCards.length ? (
              <section style={tiqActionRailStyle}>
                <div style={sectionHeaderStyle}>
                  <div style={sectionHeaderCopyStyle}>
                    <p style={sectionKickerStyle}>TIQ action rail</p>
                    <h3 style={compactSectionTitleStyle}>League prompts</h3>
                  </div>
                  <Link href="/compete/leagues" style={smallInlineLinkStyle}>
                    League directory
                  </Link>
                </div>
                <div style={tiqActionGridStyle(isTablet)}>
                  {tiqActionCards.map((card) => (
                    <article key={card.id} style={tiqActionCardStyle}>
                      <div style={tiqActionTopRowStyle}>
                        <span style={tiqActionLabelStyle}>{card.label}</span>
                        <span style={tiqActionMetaStyle}>{card.meta}</span>
                      </div>
                      <div style={tiqActionTitleStyle}>{card.title}</div>
                      <p style={tiqActionTextStyle}>{card.text}</p>
                      <div style={tiqActionButtonRowStyle}>
                        <Link href={card.primaryHref} style={miniActionPillStyle}>
                          {card.primaryLabel}
                        </Link>
                        <Link href={card.secondaryHref} style={smallInlineLinkStyle}>
                          {card.secondaryLabel}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {teamPrepCards.length ? (
              <section style={teamPrepRailStyle}>
                <div style={sectionHeaderStyle}>
                  <div style={sectionHeaderCopyStyle}>
                    <p style={sectionKickerStyle}>Team prep</p>
                    <h3 style={compactSectionTitleStyle}>Team context from your profile</h3>
                  </div>
                  <Link href="/captain" style={smallInlineLinkStyle}>
                    Captain
                  </Link>
                </div>
                <div style={teamPrepGridStyle(isTablet)}>
                  {teamPrepCards.map((team) => (
                    <article key={team.id} style={teamPrepCardStyle}>
                      <div>
                        <div style={teamPrepTitleStyle}>{team.title}</div>
                        <div style={teamPrepMetaStyle}>{team.meta || 'Team context'}</div>
                      </div>
                      <div style={teamPrepActionRowStyle}>
                        <Link href={team.briefHref} style={miniActionPillStyle}>
                          Brief
                        </Link>
                        <Link href={team.availabilityHref} style={smallInlineLinkStyle}>
                          Availability
                        </Link>
                        <Link href={team.lineupHref} style={smallInlineLinkStyle}>
                          Lineup
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section id="goal-progress" style={goalProgressPanelStyle}>
              <div style={sectionHeaderStyle}>
                <div style={sectionHeaderCopyStyle}>
                  <p style={sectionKickerStyle}>Optional goals</p>
                  <h3 style={compactSectionTitleStyle}>Training notes</h3>
                </div>
                <button type="button" onClick={addGoal} style={smallGhostButtonStyle}>
                  Add goal
                </button>
              </div>
              <div style={goalSummaryGridStyle(isTablet)}>
                {goalSummaryCards.map((item) => (
                  <div key={item.label} style={goalSummaryCardStyle}>
                    <div style={metricLabelStyle}>{item.label}</div>
                    <div style={goalSummaryValueStyle}>{item.value}</div>
                    <div style={metricNoteStyle}>{item.note}</div>
                  </div>
                ))}
              </div>
              <div style={goalReadinessPanelStyle}>
                <div style={goalReadinessHeaderStyle}>
                  <div style={sectionHeaderCopyStyle}>
                    <div style={metricLabelStyle}>Active goal readiness</div>
                    <p style={goalReadinessTextStyle}>
                      {goalReadinessScore === 100
                        ? 'This focus is ready to take into your next match.'
                        : `Next: add ${nextReadinessStep.toLowerCase()} detail.`}
                    </p>
                  </div>
                  <strong style={goalReadinessScoreStyle}>{goalReadinessScore}%</strong>
                </div>
                <div style={goalReadinessTrackStyle} aria-label={`Active goal readiness ${goalReadinessScore} percent`}>
                  <span style={goalReadinessFillStyle(goalReadinessScore)} />
                </div>
                <div style={goalReadinessChecklistStyle}>
                  {goalReadinessChecks.map((item) => (
                    <span key={item.label} style={item.complete ? readinessPillCompleteStyle : readinessPillStyle}>
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
              <div style={recommendationCardStyle}>
                <div style={metricLabelStyle}>TenAceIQ recommendation</div>
                <p style={recommendationTextStyle}>{tiqRecommendation}</p>
              </div>
              <div style={quickStartPanelStyle}>
                <div>
                  <div style={metricLabelStyle}>Quick starts</div>
                  <p style={quickStartTextStyle}>Start with a practical focus, then adjust it.</p>
                </div>
                <div style={quickStartButtonRowStyle}>
                  {focusTemplates.map((template) => (
                    <button
                      key={template.label}
                      type="button"
                      onClick={() => applyGoalTemplate(template)}
                      style={quickStartButtonStyle}
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>
              <div id="player-notebook" style={goalWorkspaceStyle}>
                <div style={goalListStyle}>
                  {goals.map((goal, index) => (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => setActiveGoalId(goal.id)}
                      style={goal.id === activeGoalId ? goalTabActiveStyle : goalTabStyle}
                    >
                      <span>{goal.goal || `Goal ${index + 1}`}</span>
                      <span style={goalTabMetaRowStyle}>
                        <em>{goalStatusLabel(goal.progressStatus)}</em>
                        <strong>{goalReadinessScoreFor(goal)}%</strong>
                      </span>
                      <span style={goalTabTrackStyle}>
                        <span style={goalTabTrackFillStyle(goalReadinessScoreFor(goal))} />
                      </span>
                    </button>
                  ))}
                </div>

                <details style={goalEditorDetailsStyle}>
                  <summary style={collapsibleSummaryStyle}>+ Update goals and notes</summary>
                  <div style={goalEditorStyle}>
                    <div style={inputWrapStyle}>
                      <label style={labelStyle} htmlFor={`my-lab-goal-${activeGoal.id}`}>Goal</label>
                      <input
                        id={`my-lab-goal-${activeGoal.id}`}
                        value={activeGoal.goal}
                        onChange={(event) => updateGoal(activeGoal.id, { goal: event.target.value })}
                        placeholder="Example: attack second serves this month"
                        style={inputStyle}
                      />
                    </div>
                    <div style={inputWrapStyle}>
                      <label style={labelStyle} htmlFor={`my-lab-progress-${activeGoal.id}`}>Status</label>
                      <select
                        id={`my-lab-progress-${activeGoal.id}`}
                        value={activeGoal.progressStatus}
                        onChange={(event) => {
                          const nextStatus = event.target.value
                          if (!isGoalProgressStatus(nextStatus)) return
                          updateGoal(activeGoal.id, { progressStatus: nextStatus })
                        }}
                        style={inputStyle}
                      >
                        <option value="not-started">Not started</option>
                        <option value="in-progress">In progress</option>
                        <option value="improving">Improving</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <div style={inputWrapStyle}>
                      <label style={labelStyle} htmlFor={`my-lab-progress-update-${activeGoal.id}`}>Progress update</label>
                      <textarea
                        id={`my-lab-progress-update-${activeGoal.id}`}
                        value={activeGoal.progressUpdate}
                        onChange={(event) => updateGoal(activeGoal.id, { progressUpdate: event.target.value })}
                        placeholder="What changed since the last match or practice?"
                        style={shortTextAreaStyle}
                      />
                    </div>
                    <div style={goalFieldGridStyle(isTablet)}>
                      <div style={inputWrapStyle}>
                        <label style={labelStyle} htmlFor={`my-lab-doing-well-${activeGoal.id}`}>What am I doing well?</label>
                        <textarea
                          id={`my-lab-doing-well-${activeGoal.id}`}
                          value={activeGoal.doingWell}
                          onChange={(event) => updateGoal(activeGoal.id, { doingWell: event.target.value })}
                          placeholder="Example: holding serve under pressure"
                          style={shortTextAreaStyle}
                        />
                      </div>
                      <div style={inputWrapStyle}>
                        <label style={labelStyle} htmlFor={`my-lab-improve-next-${activeGoal.id}`}>Where can I improve?</label>
                        <textarea
                          id={`my-lab-improve-next-${activeGoal.id}`}
                          value={activeGoal.improveNext}
                          onChange={(event) => updateGoal(activeGoal.id, { improveNext: event.target.value })}
                          placeholder="Example: return depth on second serves"
                          style={shortTextAreaStyle}
                        />
                      </div>
                    </div>
                    <div style={inputWrapStyle}>
                      <label style={labelStyle} htmlFor={`my-lab-notebook-${activeGoal.id}`}>Notes</label>
                      <textarea
                        id={`my-lab-notebook-${activeGoal.id}`}
                        value={activeGoal.notes}
                        onChange={(event) => updateGoal(activeGoal.id, { notes: event.target.value })}
                        placeholder="What felt good? What broke down? What should I test next?"
                        style={textAreaStyle}
                      />
                    </div>
                    <div style={notebookFooterStyle}>
                      <span>{notebookSavedLabel}{lastSavedAt ? ` - ${timeAgo(lastSavedAt)}` : ''}</span>
                      <div style={goalFooterActionsStyle}>
                        <button type="button" onClick={() => removeGoal(activeGoal.id)} style={smallGhostButtonStyle}>
                          Remove goal
                        </button>
                        <button type="button" onClick={saveNotebook} style={saveNotebookButtonStyle}>
                          Save goals
                        </button>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </section>

            <div style={workshopGridStyle(isTablet)}>
              <div id="recent-matches" style={workshopPanelStyle}>
                <div style={sectionKickerStyle}>Recent matches</div>
                <div style={workshopListStyle}>
                  {personalMatches.length ? (
                    personalMatches.slice(0, 5).map((match) => {
                      const existingReport = myMatchReportByMatchId.get(match.id) || null
                      return (
                        <div key={match.id} style={workshopMatchRowStyle}>
                          <span style={match.result === 'W' ? pillGreenStyle : match.result === 'L' ? pillRedStyle : pillSlateStyle}>
                            {match.result}
                          </span>
                          <div style={workshopRowCopyStyle}>
                            <div style={workshopRowTitleStyle}>{match.opponent}</div>
                            <div style={workshopRowMetaStyle}>
                              {[safeDate(match.date), match.leagueName, match.matchType, match.score].filter(Boolean).join(' - ')}
                            </div>
                          </div>
                          <div style={matchActionStackStyle}>
                            {existingReport ? (
                              <span style={existingReport.status === 'resolved' ? pillGreenStyle : existingReport.status === 'rejected' ? pillRedStyle : existingReport.status === 'reviewing' ? pillBlueStyle : pillSlateStyle}>
                                {getReportStatusLabel(existingReport.status)}
                              </span>
                            ) : (
                              <MatchAccuracyReportButton
                                matchId={match.id}
                                reporterPlayerName={linkedPlayer?.name || profileLink?.linked_player_name || ''}
                                matchLabel={`${match.result} vs ${compactOpponentLabel(match.opponent)}${match.score ? ` - ${match.score}` : ''}`}
                                context={{
                                  surface: 'mylab_recent_matches',
                                  linkedPlayerId: profileLink?.linked_player_id || '',
                                  leagueName: match.leagueName || '',
                                  matchType: match.matchType || '',
                                  matchDate: match.date || '',
                                  opponent: match.opponent,
                                  result: match.result,
                                }}
                                onSubmitted={() => void refreshMyMatchReports()}
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => reflectOnMatch(match)}
                              style={matchReflectButtonStyle}
                            >
                              Reflect
                            </button>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div style={emptyStateStyle}>
                      {isProfileConfirmed ? `${DATA_ASSIST_STORY.shortCue} Reviewed results will appear here once they connect to your player record.` : 'Set up your profile to unlock your personal match history.'}
                    </div>
                  )}
                </div>
              </div>

              <div id="match-report-status" style={workshopPanelStyle}>
                <div style={sectionHeaderStyle}>
                  <div style={sectionHeaderCopyStyle}>
                    <div style={sectionKickerStyle}>Report status</div>
                    <h3 style={compactSectionTitleStyle}>Match issues you sent</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshMyMatchReports()}
                    disabled={myMatchReportsLoading}
                    style={smallGhostButtonStyle}
                  >
                    Refresh
                  </button>
                </div>
                <div style={workshopListStyle}>
                  {myMatchReportsLoading ? (
                    <div style={emptyStateStyle}>Loading your match reports.</div>
                  ) : myMatchReportsError ? (
                    <div style={errorStateStyle}>{myMatchReportsError}</div>
                  ) : myMatchReports.length ? (
                    myMatchReports.slice(0, 4).map((report) => (
                      <article key={report.id} style={reportStatusCardStyle}>
                        <div style={reportStatusHeaderStyle}>
                          <span style={report.status === 'resolved' ? pillGreenStyle : report.status === 'rejected' ? pillRedStyle : report.status === 'reviewing' ? pillBlueStyle : pillSlateStyle}>
                            {getReportStatusLabel(report.status)}
                          </span>
                          <span style={workshopRowMetaStyle}>{safeDate(report.createdAt)}</span>
                        </div>
                        <div style={workshopRowTitleStyle}>{getIssueTypeLabel(report.issueType)}</div>
                        <p style={reportStatusTextStyle}>{report.actionSummary || report.description}</p>
                        <div style={workshopRowMetaStyle}>
                          Match {report.externalMatchId || report.matchId || 'reported'}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div style={emptyStateStyle}>No match issues submitted yet.</div>
                  )}
                </div>
              </div>

              <div style={workshopPanelStyle}>
                <div style={sectionKickerStyle}>Next action</div>
                <div style={nextActionCardStyle}>
                  <TiqFeatureIcon name="matchPrep" size="md" variant="surface" />
                  <div style={workshopRowCopyStyle}>
                    <div style={workshopRowTitleStyle}>
                      {topMatchupCandidate ? `Open the read vs ${topMatchupCandidate.player.name}` : 'Build your first read'}
                    </div>
                    <div style={workshopRowMetaStyle}>
                      {topMatchupCandidate
                        ? 'Use the staged matchup to compare the edge, what to watch, and whether it fits your current focus.'
                        : 'Once your profile has a connected rating, this will become a direct matchup recommendation.'}
                    </div>
                  </div>
                  <Link href={matchupHref} style={miniActionPillStyle}>
                    Matchup
                  </Link>
                </div>
              </div>
            </div>
          </div>
          </section>
        </details>
      ) : null}

      <details style={optionalContextDetailsStyle}>
        <summary style={optionalContextSummaryStyle}>
          <span>
            <strong>Watchlist</strong>
            <em>Follows and updates when you want the wider picture.</em>
          </span>
          <span style={optionalContextCountStyle}>
            {follows.length} follows
          </span>
        </summary>

        <section style={contentGridStyle(isTablet)}>
          <div style={leftColumnStyle}>
            {followedPlayerSignals.length > 0 ? (
              <section style={compactSignalsPanelStyle}>
                <div style={compactSignalsHeaderStyle}>
                  <span>Player signals</span>
                  <strong>{followedPlayerSignals.length}</strong>
                </div>
                <div style={compactSignalsGridStyle}>
                  {followedPlayerSignals.slice(0, 6).map((s) => {
                    const positive = s.status === 'Bump Up Pace' || s.status === 'Trending Up'
                    const negative = s.status === 'At Risk' || s.status === 'Drop Watch'
                    const pillStyle: React.CSSProperties = positive
                      ? { background: 'rgba(155,225,29,0.10)', color: '#d9f84a', border: '1px solid rgba(155,225,29,0.20)' }
                      : negative
                        ? { background: 'rgba(239,68,68,0.10)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.18)' }
                        : { background: 'rgba(116,190,255,0.08)', color: '#93c5fd', border: '1px solid rgba(116,190,255,0.16)' }
                    return (
                      <div key={s.id} style={compactSignalCardStyle}>
                        <div style={compactSignalCopyStyle}>
                          <div style={compactSignalNameStyle}>{s.name}</div>
                          {s.tiq != null ? <div style={compactSignalMetaStyle}>TIQ {s.tiq.toFixed(2)}</div> : null}
                        </div>
                        {s.status ? (
                          <span style={{ ...pillStyle, display: 'inline-flex', padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, whiteSpace: 'normal' as const }}>{s.status}</span>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </section>
            ) : null}

          <section style={surfaceStrongStyle}>
            <div style={sectionHeaderStyle}>
              <div style={sectionHeaderCopyStyle}>
                <p style={sectionKickerStyle}>Watchlist</p>
                <h2 style={sectionTitleStyle}>Follow tennis context</h2>
                <p style={sectionTextStyle}>
                  Keep optional tennis context close without crowding your own lab.
                </p>
              </div>
              <span style={savedToCloud ? pillGreenStyle : pillSlateStyle}>
                {savedToCloud ? 'Cloud synced' : 'Saved on device'}
              </span>
            </div>

            <div style={searchPanelStyle}>
              <div style={inputWrapStyle}>
                <label style={labelStyle}>Search</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find a player, team, or league"
                  style={inputStyle}
                />
              </div>
              <div style={filterRowStyle}>
                {(['all', 'player', 'team', 'league'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    style={value === filter ? tabActiveStyle : tabButtonStyle}
                  >
                    {value === 'all' ? 'All' : value[0].toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </div>

              {search.trim() ? (
                <div style={searchResultsStyle}>
                  {filteredSearchOptions.length ? (
                    filteredSearchOptions.map((option) => {
                      const existingFollow = follows.find(
                        (follow) =>
                          follow.entity_type === option.type &&
                          entityIdsMatch(option.type, follow.entity_id, option.id),
                      )
                      return (
                        <div key={`${option.type}-${option.id}`} style={searchResultItemStyle}>
                          <div>
                            <div style={searchResultTitleStyle}>{option.name}</div>
                            <div style={searchResultMetaStyle}>
                              {option.type.toUpperCase()} {option.subtitle ? ` - ${option.subtitle}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => (existingFollow ? removeFollow(existingFollow) : addFollow(option))}
                            style={existingFollow ? tabButtonStyle : primaryMiniButtonStyle}
                          >
                            {existingFollow ? 'Unfollow' : 'Follow'}
                          </button>
                        </div>
                      )
                    })
                  ) : (
                    <div style={emptyInlineStyle}>No matching players, teams, or leagues found.</div>
                  )}
                </div>
              ) : (
                <div style={emptyInlineStyle}>Start typing to build your lab.</div>
              )}
            </div>
          </section>

          <section style={surfaceStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={sectionKickerStyle}>Watchlist updates</p>
                <h2 style={sectionTitleStyle}>What changed around your watchlist</h2>
              </div>
              <div style={filterRowStyle}>
                <GhostButton onClick={() => setRefreshTick((current) => current + 1)}>
                  {loading ? 'Refreshing...' : 'Refresh lab'}
                </GhostButton>
                {(['all', 'match', 'rating', 'achievement', 'team', 'league', 'community'] as const).map(
                  (value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFeedFilter(value)}
                      style={feedFilter === value ? tabActiveStyle : tabButtonStyle}
                    >
                      {value === 'all' ? 'All' : value}
                    </button>
                  ),
                )}
              </div>
            </div>

            {loading ? (
              <div style={emptyStateStyle}>
                <strong>Find yourself, choose a tennis goal, then open your first read.</strong>
                <div style={{ marginTop: 8 }}>
                  My Lab is getting your player record, follows, matchup notes, and coach context ready.
                </div>
              </div>
            ) : error ? (
              <div style={errorStateStyle}>
                <div>Some data could not be loaded: {error}</div>
                <div style={errorActionRowStyle}>
                  <GhostButton onClick={() => setRefreshTick((current) => current + 1)}>
                    Retry lab load
                  </GhostButton>
                </div>
              </div>
            ) : (
              <div style={feedListStyle}>
                {feed.slice(0, 5).map((item) => (
                  <article key={item.id} style={feedCardStyle(item.accent)}>
                    <div style={feedTopRowStyle}>
                      <span style={badgeForAccent(item.accent)}>{item.badge}</span>
                      <span style={feedTimeStyle}>{timeAgo(item.createdAt)}</span>
                    </div>
                    <h3 style={feedTitleStyle}>{item.title}</h3>
                    <p style={feedBodyStyle}>{item.body}</p>
                    <div style={feedMetaRowStyle}>
                      <span style={pillSlateStyle}>{item.entityName}</span>
                      {item.entityType === 'player' && item.entityId ? (
                        <Link href={`/players/${item.entityId}`} style={feedLinkStyle}>
                          Open
                        </Link>
                      ) : item.entityType === 'team' && item.entityId ? (
                        <Link href={buildTeamHrefFromEntityId(item.entityId)} style={feedLinkStyle}>
                          Open
                        </Link>
                      ) : item.entityType === 'league' && item.entityId ? (
                        <Link href={buildLeagueHrefFromEntityId(item.entityId)} style={feedLinkStyle}>
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <div style={rightColumnStyle}>
          <section style={surfaceStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={sectionKickerStyle}>Manage</p>
                <h2 style={sectionTitleStyle}>Your follows</h2>
              </div>
              <div style={filterRowStyle}>
                {(['feed', 'players', 'teams', 'leagues'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedTab(value)}
                    style={selectedTab === value ? tabActiveStyle : tabButtonStyle}
                  >
                    {value[0].toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {selectedTab === 'feed' ? (
              <div style={collectionsStackStyle}>
                <div style={summaryGridStyle}>
                  <SummaryCard
                    label="Players"
                    value={String(followedPlayers.length)}
                    note="Watchlist athletes"
                  />
                  <SummaryCard
                    label="Teams"
                    value={String(followedTeams.length)}
                    note="Tracked squads"
                  />
                  <SummaryCard
                    label="Leagues"
                    value={String(followedLeagues.length)}
                    note="Competition groups"
                  />
                  <SummaryCard
                    label="TIQ Individual"
                    value={String(followedTiqIndividualParticipations.length)}
                    note="Active player league entries"
                  />
                </div>

                <div style={manageFollowsHeaderStyle}>
                  <div style={supportTitleStyle}>Manage follows</div>
                  <div style={supportTextStyle}>Keep this list small enough to act on.</div>
                </div>
                <FollowList items={follows} onRemove={removeFollow} />
              </div>
            ) : null}

            {selectedTab === 'players' ? <FollowList items={followedPlayers} onRemove={removeFollow} /> : null}
            {selectedTab === 'teams' ? <FollowList items={followedTeams} onRemove={removeFollow} /> : null}
            {selectedTab === 'leagues' ? <FollowList items={followedLeagues} onRemove={removeFollow} /> : null}

            {selectedTab === 'feed' ? (
              <div style={insightStackStyle}>
                <InsightCard
                  title="Next useful action"
                  text="Your follows become a quick read on the players, teams, and leagues that matter most."
                />
                <InsightCard
                  title="TIQ prep"
                  text={
                    followedTiqIndividualLeagueInsights[0]
                      ? `${followedTiqIndividualLeagueInsights[0].formatLabel}: ${followedTiqIndividualLeagueInsights[0].nextAction}${followedTiqIndividualLeagueInsights[0].summary?.leaderName ? ` ${followedTiqIndividualLeagueInsights[0].summary.leaderName} currently leads at ${followedTiqIndividualLeagueInsights[0].summary.leaderRecord}.` : ''}`
                      : 'Follow a TIQ individual league or player to let My Lab surface the next useful action for ladder, round robin, challenge, or standard TIQ competition.'
                  }
                />
              </div>
            ) : null}
          </section>
        </div>
        </section>
      </details>
    </section>
  )
}

function GhostButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...ghostMiniButtonStyle,
        background: hovered
          ? 'color-mix(in srgb, var(--foreground-strong) 7%, var(--shell-chip-bg) 93%)'
          : ghostMiniButtonStyle.background,
        border: hovered
          ? '1px solid color-mix(in srgb, var(--foreground-strong) 12%, var(--shell-panel-border) 88%)'
          : ghostMiniButtonStyle.border,
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'all 130ms ease',
      }}
    >
      {children}
    </button>
  )
}

function PlayerDevelopmentPathPanel({
  linkedPlayerName,
  currentGoal,
}: {
  linkedPlayerName: string
  currentGoal: string
}) {
  const primaryIdentity = PLAYER_DEVELOPMENT_IDENTITIES[0]
  const nextIdentity = PLAYER_DEVELOPMENT_IDENTITIES[1]

  return (
    <section style={developmentPathPanelStyle}>
      <div style={developmentPathHeaderStyle}>
        <div style={sectionTitleClusterStyle}>
          <TiqFeatureIcon name="matchPrep" size="md" variant="surface" />
          <div style={sectionHeaderCopyStyle}>
            <p style={sectionKickerStyle}>Player+ development path</p>
            <h3 style={compactSectionTitleStyle}>
              {linkedPlayerName ? `${linkedPlayerName}: choose this week's work` : "Choose this week's work"}
            </h3>
            <p style={sectionTextStyle}>
              Print the workbook, bring a sheet to your coach, then use My Lab to keep the goal and weekly evidence connected.
            </p>
          </div>
        </div>
        <Link href={`/player-development/${primaryIdentity.slug}/workbook`} style={quickStartButtonStyle}>
          Print workbook
        </Link>
      </div>

      <div style={developmentPathGridStyle}>
        {[primaryIdentity, nextIdentity].filter(Boolean).map((identity) => (
          <Link href={`/player-development/${identity.slug}`} key={identity.slug} style={developmentIdentityCardStyle}>
            <div style={metricLabelStyle}>{identity.ratingBand}</div>
            <div style={developmentIdentityTitleStyle}>{identity.title}</div>
            <div style={metricNoteStyle}>{identity.mantra}</div>
          </Link>
        ))}
        <div style={developmentCheckInCardStyle}>
          <div style={metricLabelStyle}>Current My Lab goal</div>
          <div style={developmentIdentityTitleStyle}>{currentGoal || 'Set one weekly focus'}</div>
          <div style={metricNoteStyle}>Use the workbook recap after practice or a match, then update this goal.</div>
        </div>
      </div>

      <div style={developmentActionRowStyle}>
        <Link href="/player-development" style={miniActionLinkStyle}>Open paths</Link>
        <Link href={`/player-development/${primaryIdentity.slug}/coach-planner`} style={miniActionLinkStyle}>Coach planner</Link>
        <Link href="#goal-progress" style={miniActionLinkStyle}>Update My Lab goal</Link>
      </div>
    </section>
  )
}

function PlayerCoachAssignmentsPanel({
  assignments,
  coachLinks,
  loading,
  message,
  onComplete,
}: {
  assignments: CoachAssignment[]
  coachLinks: CoachStudentLink[]
  loading: boolean
  message: string
  onComplete: (assignmentId: string, recap: string, evidence: string) => Promise<void>
}) {
  const coachLinkMap = useMemo(() => new Map(coachLinks.map((link) => [link.id, link])), [coachLinks])
  const sortedAssignments = useMemo(() => sortPlayerAssignmentsForAction(assignments), [assignments])
  const openAssignments = sortedAssignments.filter((assignment) => assignment.status !== 'completed')
  const completedAssignments = assignments.filter((assignment) => assignment.status === 'completed')
  const overdueAssignments = openAssignments.filter((assignment) => getCoachAssignmentDueState(assignment.dueDate).tone === 'overdue')
  const dueTodayAssignments = openAssignments.filter((assignment) => getCoachAssignmentDueState(assignment.dueDate).tone === 'today')
  const assignmentCards = (openAssignments.length ? openAssignments : sortedAssignments).slice(0, 4)
  const activeCoachLink = coachLinks[0]
  const nextAssignment = openAssignments[0] ?? sortedAssignments[0] ?? null
  const nextDueState = nextAssignment ? getCoachAssignmentDueState(nextAssignment.dueDate) : null
  const nextAssignmentSummary = nextAssignment ? getCoachAssignmentSummary(nextAssignment.assignment) : null
  const nextCoachReview = nextAssignment ? getCoachAssignmentReview(nextAssignment.assignment) : null
  const nextAssignmentActionPlan = nextAssignment
    ? buildPlayerAssignmentActionPlan(nextAssignment, nextAssignmentSummary, nextDueState?.label ?? '')
    : []
  const [activeAssignmentId, setActiveAssignmentId] = useState('')
  const [recap, setRecap] = useState('')
  const [evidence, setEvidence] = useState('')
  const [savingAssignmentId, setSavingAssignmentId] = useState('')
  const [checkInMessage, setCheckInMessage] = useState('')

  const beginPlayerCheckIn = (assignment: CoachAssignment) => {
    setActiveAssignmentId(assignment.id)
    setRecap('')
    setEvidence('')
    setCheckInMessage('')
  }

  const submitCheckIn = async (assignmentId: string) => {
    setSavingAssignmentId(assignmentId)
    setCheckInMessage('')

    try {
      await onComplete(assignmentId, recap, evidence)
      setActiveAssignmentId('')
      setRecap('')
      setEvidence('')
      setCheckInMessage('Assignment completed. Your coach can review the recap from their workspace.')
    } catch (err) {
      setCheckInMessage(err instanceof Error ? err.message : 'Could not complete coach assignment.')
    } finally {
      setSavingAssignmentId('')
    }
  }

  return (
    <section style={coachAssignmentPanelStyle}>
      <div style={developmentPathHeaderStyle}>
        <div style={sectionTitleClusterStyle}>
          <TiqFeatureIcon name="messagingCenter" size="md" variant="surface" />
          <div style={sectionHeaderCopyStyle}>
            <p style={sectionKickerStyle}>Coach-connected Player+</p>
            <h3 style={compactSectionTitleStyle}>
              {activeCoachLink ? `${activeCoachLink.playerName}: Coach Hub` : 'Connect Coach Hub'}
            </h3>
            <p style={sectionTextStyle}>
              Your coach assignments, recaps, feedback, and next focus stay together between lessons.
            </p>
          </div>
        </div>
        <Link href={buildPlayerCoachMessageHref(activeCoachLink, 'Player+ coach check-in', 'Quick player note: ')} style={quickStartButtonStyle}>
          Message coach
        </Link>
      </div>

      <div style={coachAssignmentMetricsStyle}>
        <SummaryCard label="Connected coaches" value={coachLinks.length ? String(coachLinks.length) : 'Connect'} note="Accept a coach invite to link work" />
        <SummaryCard label="Due pressure" value={openAssignments.length ? String(overdueAssignments.length + dueTodayAssignments.length) : 'Clear'} note={openAssignments.length ? `${overdueAssignments.length} overdue / ${dueTodayAssignments.length} today` : 'Choose your first goal before assignment counters matter'} />
        <SummaryCard label="Open assignments" value={openAssignments.length ? String(openAssignments.length) : 'First read'} note="Coach-created work appears after setup" />
        <SummaryCard label="Completed" value={completedAssignments.length ? String(completedAssignments.length) : 'Later'} note="Finished coach follow-through" />
      </div>

      {nextAssignment ? (
        <div style={coachHubNextActionStyle}>
          <div style={coachHubNextCopyStyle}>
            <div style={metricLabelStyle}>Next coach action</div>
            <strong>{nextAssignment.title}</strong>
            <span>{nextAssignment.focus || nextAssignmentSummary?.detail || 'Complete the next measurable assignment.'}</span>
            <div style={coachAssignmentMetaStyle}>
              {nextDueState ? <span style={coachAssignmentDueStyle(nextDueState.tone)}>{nextDueState.label}</span> : null}
              {nextAssignment.status === 'completed' ? <span style={coachAssignmentDueStyle('none')}>Completed</span> : null}
            </div>
            {nextCoachReview?.nextFocus ? (
              <em>Coach next focus: {nextCoachReview.nextFocus}</em>
            ) : null}
            {nextAssignmentActionPlan.length ? (
              <div style={coachAssignmentActionPlanStyle}>
                {nextAssignmentActionPlan.map((item) => (
                  <span key={item.label} style={coachAssignmentActionItemStyle}>
                    <strong>{item.label}</strong>
                    <em>{item.value}</em>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div style={coachHubNextActionsStyle}>
            {nextAssignment.status !== 'completed' ? (
              <button
                type="button"
                onClick={() => beginPlayerCheckIn(nextAssignment)}
                style={coachCheckInButtonStyle}
              >
                Add recap
              </button>
            ) : null}
            <Link
              href={buildPlayerCoachMessageHref(
                coachLinkMap.get(nextAssignment.studentLinkId),
                nextAssignment.title,
                `Quick note on ${nextAssignment.title}: `,
                {
                  assignmentId: nextAssignment.id,
                  assignmentTitle: nextAssignment.title,
                  assignmentFocus: nextAssignment.focus,
                },
              )}
              style={coachCheckInGhostLinkStyle}
            >
              Message coach
            </Link>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div style={emptyStateStyle}>Loading coach assignments.</div>
      ) : message ? (
        <div style={emptyStateStyle}>{message}</div>
      ) : assignmentCards.length ? (
        <div style={coachAssignmentGridStyle}>
          {assignmentCards.map((assignment) => {
            const link = coachLinkMap.get(assignment.studentLinkId)
            const coachReview = getCoachAssignmentReview(assignment.assignment)
            const assignmentSummary = getCoachAssignmentSummary(assignment.assignment)
            const dueState = getCoachAssignmentDueState(assignment.dueDate)
            const assignmentActionPlan = buildPlayerAssignmentActionPlan(assignment, assignmentSummary, dueState.label)
            const checkInDraft = buildPlayerAssignmentCheckInDraft(assignment, assignmentSummary, dueState.label)
            return (
              <div key={assignment.id} id={`coach-assignment-${assignment.id}`} style={coachAssignmentCardStyle}>
                <div style={metricLabelStyle}>{assignment.status === 'completed' ? 'Completed' : 'Assigned'}</div>
                <div style={developmentIdentityTitleStyle}>{assignment.title}</div>
                <div style={metricNoteStyle}>{assignment.focus || 'Coach assignment'}</div>
                <div style={coachAssignmentMetaStyle}>
                  <span>{link?.levelLabel || link?.identitySlug || 'Development path'}</span>
                  <span style={coachAssignmentDueStyle(dueState.tone)}>{dueState.label}</span>
                </div>
                {link?.coachUserId ? (
                  <Link
                    href={buildPlayerCoachMessageHref(
                      link,
                      assignment.title,
                      `Quick note on ${assignment.title}: `,
                      {
                        assignmentId: assignment.id,
                        assignmentTitle: assignment.title,
                        assignmentFocus: assignment.focus,
                      },
                    )}
                    style={miniActionLinkStyle}
                  >
                    Message coach about this
                  </Link>
                ) : null}
                {assignmentSummary.detail || assignmentSummary.volume || assignmentSummary.tracker.length || assignmentSummary.prompt || assignmentSummary.expectedEvidence ? (
                  <div style={coachAssignmentSummaryStyle}>
                    {assignmentSummary.detail ? <span>{assignmentSummary.detail}</span> : null}
                    {assignmentSummary.volume ? <strong>{assignmentSummary.volume}</strong> : null}
                    {assignmentSummary.expectedEvidence ? <em>Evidence expected: {assignmentSummary.expectedEvidence}</em> : null}
                    {assignmentSummary.tracker.length ? (
                      <ul style={coachAssignmentTrackerStyle}>
                        {assignmentSummary.tracker.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                    {assignmentSummary.prompt ? <em>{assignmentSummary.prompt}</em> : null}
                  </div>
                ) : null}
                {assignment.status !== 'completed' && assignmentActionPlan.length ? (
                  <div style={coachAssignmentMicroPlanStyle}>
                    {assignmentActionPlan.map((item) => (
                      <span key={item.label}>
                        <strong>{item.label}: </strong>
                        {item.value}
                      </span>
                    ))}
                  </div>
                ) : null}
                {coachReview ? (
                  <div style={coachFeedbackStyle}>
                    <strong>Coach feedback</strong>
                    {coachReview.note ? <span>{coachReview.note}</span> : null}
                    {coachReview.nextFocus ? <em>Next: {coachReview.nextFocus}</em> : null}
                  </div>
                ) : null}
                {assignment.status !== 'completed' ? (
                  activeAssignmentId === assignment.id ? (
                    <div style={coachCheckInFormStyle}>
                      <div style={coachCheckInGuideStyle}>
                        <strong>Player+ recap guide</strong>
                        <span>{checkInDraft.recapCue}</span>
                        <em>{checkInDraft.evidenceCue}</em>
                      </div>
                      <textarea
                        value={recap}
                        onChange={(event) => setRecap(event.target.value)}
                        placeholder={checkInDraft.recapPlaceholder}
                        style={coachCheckInTextareaStyle}
                      />
                      <input
                        value={evidence}
                        onChange={(event) => setEvidence(event.target.value)}
                        placeholder={checkInDraft.evidencePlaceholder}
                        style={coachCheckInInputStyle}
                      />
                      <div style={developmentActionRowStyle}>
                        <button
                          type="button"
                          onClick={() => {
                            setRecap(checkInDraft.recapTemplate)
                            setEvidence(checkInDraft.evidenceTemplate)
                          }}
                          style={coachCheckInGhostButtonStyle}
                        >
                          Use guided draft
                        </button>
                        <button
                          type="button"
                          onClick={() => void submitCheckIn(assignment.id)}
                          disabled={savingAssignmentId === assignment.id}
                          style={coachCheckInButtonStyle}
                        >
                          {savingAssignmentId === assignment.id ? 'Saving' : 'Complete assignment'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveAssignmentId('')}
                          style={coachCheckInGhostButtonStyle}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginPlayerCheckIn(assignment)}
                      style={coachCheckInGhostButtonStyle}
                    >
                      Add recap
                    </button>
                  )
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={coachAssignmentEmptyStyle}>
          {activeCoachLink ? (
            <>
              <strong>Coach connected. Ask for the first assignment.</strong>
              <span>
                Your Coach Hub is ready. Once your coach assigns work, it will show up here with recap prompts, evidence tracking, and feedback.
              </span>
              <div style={coachConnectedEmptyStepsStyle}>
                <span><strong>1</strong> Request a measurable assignment</span>
                <span><strong>2</strong> Complete the work on court</span>
                <span><strong>3</strong> Send back recap and evidence</span>
              </div>
              <div style={developmentActionRowStyle}>
                <Link
                  href={buildPlayerCoachMessageHref(
                    activeCoachLink,
                    'First Player+ assignment',
                    'Coach, can you send my first TenAceIQ assignment so I can track it in My Lab? ',
                  )}
                  style={miniActionLinkStyle}
                >
                  Request first assignment
                </Link>
                <Link href="/player-development" style={miniActionLinkStyle}>Open workbook paths</Link>
              </div>
            </>
          ) : (
            <>
              <strong>No live coach assignments yet.</strong>
              <span>
                Print the workbook now, then accept a coach invite when you want Player+ check-ins, assignment tracking, and weekly recaps connected to TenAceIQ.
              </span>
              <div style={developmentActionRowStyle}>
                <Link href="/player-development" style={miniActionLinkStyle}>Open workbook paths</Link>
                <Link href="/pricing#coach" style={miniActionLinkStyle}>See Coach tools</Link>
              </div>
            </>
          )}
        </div>
      )}
      {checkInMessage ? <div style={coachCheckInMessageStyle}>{checkInMessage}</div> : null}
    </section>
  )
}

function buildPlayerCoachMessageHref(
  coachLink: CoachStudentLink | undefined,
  subject: string,
  body: string,
  assignmentContext?: {
    assignmentId: string
    assignmentTitle: string
    assignmentFocus: string
  },
) {
  if (!coachLink?.coachUserId) return '/messages'
  const params = new URLSearchParams({
    compose: 'direct',
    recipientProfileId: coachLink.coachUserId,
    recipient: 'Coach',
    subject,
    body,
    entityType: 'coach_player_link',
    entityId: coachLink.id,
  })
  if (assignmentContext?.assignmentId) params.set('assignmentId', assignmentContext.assignmentId)
  if (assignmentContext?.assignmentTitle) params.set('assignmentTitle', assignmentContext.assignmentTitle)
  if (assignmentContext?.assignmentFocus) params.set('assignmentFocus', assignmentContext.assignmentFocus)
  return `/messages?${params.toString()}`
}

function buildPlayerAssignmentActionPlan(
  assignment: CoachAssignment,
  summary: ReturnType<typeof getCoachAssignmentSummary> | null,
  dueLabel: string,
) {
  const trackerTarget = summary?.tracker[0] || summary?.volume || 'Complete the work exactly as assigned.'
  const proofTarget = summary?.expectedEvidence || summary?.tracker[1] || 'Record reps, score, success rate, or a short note from the session.'
  const coachTarget = summary?.prompt || 'Send your coach the result and one thing you want to sharpen next.'
  return [
    {
      label: 'Do',
      value: summary?.detail || assignment.focus || trackerTarget,
    },
    {
      label: 'Track',
      value: proofTarget,
    },
    {
      label: 'Send back',
      value: dueLabel && dueLabel !== 'No due date' ? `${coachTarget} ${dueLabel}.` : coachTarget,
    },
  ]
}

function buildPlayerAssignmentCheckInDraft(
  assignment: CoachAssignment,
  summary: ReturnType<typeof getCoachAssignmentSummary> | null,
  dueLabel: string,
) {
  const actionPlan = buildPlayerAssignmentActionPlan(assignment, summary, dueLabel)
  const doTarget = actionPlan.find((item) => item.label === 'Do')?.value || assignment.focus || assignment.title
  const trackTarget = actionPlan.find((item) => item.label === 'Track')?.value || summary?.expectedEvidence || 'reps, score, success rate, or workbook proof'
  const sendBackTarget = actionPlan.find((item) => item.label === 'Send back')?.value || 'One clear result and one next question for your coach.'

  return {
    recapCue: `Write what happened on court against the actual assignment: ${doTarget}`,
    evidenceCue: `Coach is looking for: ${trackTarget}`,
    recapPlaceholder: `Completed: ${doTarget}\nResult: \nWhat changed: \nQuestion for coach: `,
    evidencePlaceholder: `Evidence: ${trackTarget}`,
    recapTemplate: `Completed: ${doTarget}\nResult: \nWhat changed: \nQuestion for coach: ${sendBackTarget}`,
    evidenceTemplate: `Evidence: ${trackTarget}`,
  }
}

function FollowList({
  items,
  onRemove,
}: {
  items: FollowItem[]
  onRemove: (item: FollowItem) => void
}) {
  if (!items.length) {
    return <div style={emptyStateStyle}>Nothing followed here yet.</div>
  }

  return (
    <div style={followListStyle}>
      {items.map((item) => (
        <div key={`${item.entity_type}:${item.entity_id}`} style={followCardStyle}>
          <div>
            <div style={followNameStyle}>{item.entity_name}</div>
            <div style={followMetaStyle}>
              {item.entity_type.toUpperCase()} {item.subtitle ? ` - ${item.subtitle}` : ''}
            </div>
          </div>
          <GhostButton onClick={() => onRemove(item)}>Remove</GhostButton>
        </div>
      ))}
    </div>
  )
}

function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div style={summaryCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{value}</div>
      <div style={metricNoteStyle}>{note}</div>
    </div>
  )
}

function InsightCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={insightCardStyle}>
      <div style={insightTitleStyle}>{title}</div>
      <div style={insightTextStyle}>{text}</div>
    </div>
  )
}

const pageStyle: CSSProperties = {
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

const developmentPathPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 18,
  borderRadius: 22,
  border: '1px solid color-mix(in srgb, var(--brand-green) 22%, var(--shell-panel-border) 78%)',
  background:
    'radial-gradient(circle at 8% 0%, rgba(155,225,29,0.14), transparent 28%), linear-gradient(180deg, rgba(14,31,60,0.78) 0%, rgba(8,19,38,0.94) 100%)',
  boxShadow: 'var(--shadow-card)',
  minWidth: 0,
}

const developmentPathHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  flexWrap: 'wrap',
  minWidth: 0,
}

const developmentPathGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const developmentIdentityCardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
  minHeight: 142,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.035))',
  textDecoration: 'none',
}

const developmentCheckInCardStyle: CSSProperties = {
  ...developmentIdentityCardStyle,
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'linear-gradient(180deg, rgba(155,225,29,0.10), rgba(255,255,255,0.035))',
}

const developmentIdentityTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.08rem',
  fontWeight: 900,
  lineHeight: 1.15,
}

const developmentActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
}

const coachAssignmentPanelStyle: CSSProperties = {
  ...developmentPathPanelStyle,
  background:
    'radial-gradient(circle at 86% 0%, rgba(116,190,255,0.16), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,251,255,0.96) 100%)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 18%, rgba(15,37,67,0.14) 82%)',
  color: '#0b1730',
}

const coachAssignmentMetricsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
  gap: 12,
}

const coachAssignmentGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 12,
}

const coachHubNextActionStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 14,
  alignItems: 'center',
  padding: 16,
  borderRadius: 20,
  border: '1px solid rgba(93,143,18,0.2)',
  background:
    'radial-gradient(circle at 92% 18%, rgba(155,225,29,0.18), transparent 34%), linear-gradient(135deg, rgba(255,255,255,1), rgba(238,248,229,0.94))',
  boxShadow: '0 18px 42px rgba(5,18,40,0.08)',
  minWidth: 0,
}

const coachHubNextCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  color: '#435775',
  fontSize: '.92rem',
  lineHeight: 1.45,
}

const coachHubNextActionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  justifyContent: 'flex-end',
  minWidth: 0,
}

const coachAssignmentActionPlanStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
  gap: 8,
  marginTop: 4,
}

const coachAssignmentActionItemStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(15,37,67,0.1)',
  background: 'rgba(255,255,255,0.78)',
  color: '#435775',
  fontSize: '.82rem',
  lineHeight: 1.35,
}

const coachAssignmentCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  minHeight: 150,
  padding: 16,
  borderRadius: 18,
  border: '1px solid rgba(15,37,67,0.12)',
  background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(243,248,255,0.96))',
  boxShadow: '0 18px 40px rgba(5,18,40,0.08)',
}

const coachAssignmentMetaStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
  justifyContent: 'space-between',
  color: '#55708e',
  fontSize: '.82rem',
  fontWeight: 800,
}

function coachAssignmentDueStyle(tone: ReturnType<typeof getCoachAssignmentDueState>['tone']): CSSProperties {
  const urgent = tone === 'overdue' || tone === 'today'
  const soon = tone === 'soon'
  return {
    borderRadius: 999,
    border: urgent
      ? '1px solid rgba(185,28,28,0.2)'
      : soon
        ? '1px solid rgba(93,143,18,0.22)'
        : '1px solid rgba(15,37,67,0.12)',
    background: urgent
      ? 'rgba(254,226,226,0.78)'
      : soon
        ? 'rgba(155,225,29,0.11)'
        : 'rgba(255,255,255,0.72)',
    color: urgent ? '#991b1b' : soon ? '#2f5a0d' : '#55708e',
    padding: '3px 8px',
    fontSize: '.76rem',
    fontWeight: 900,
  }
}

const coachAssignmentEmptyStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 16,
  borderRadius: 18,
  border: '1px dashed rgba(15,37,67,0.18)',
  background: 'rgba(255,255,255,0.78)',
  color: '#435775',
  lineHeight: 1.55,
}

const coachConnectedEmptyStepsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
  gap: 8,
  marginTop: 2,
}

const coachAssignmentSummaryStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(15,37,67,0.1)',
  background: 'rgba(255,255,255,0.82)',
  color: '#435775',
  fontSize: '.88rem',
  lineHeight: 1.45,
}

const coachAssignmentTrackerStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  display: 'grid',
  gap: 3,
}

const coachAssignmentMicroPlanStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 11,
  borderRadius: 15,
  border: '1px solid rgba(93,143,18,0.16)',
  background: 'rgba(238,248,229,0.72)',
  color: '#31445f',
  fontSize: '.82rem',
  lineHeight: 1.4,
}

const coachFeedbackStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'rgba(155,225,29,0.11)',
  color: '#21410f',
  fontSize: '.88rem',
  lineHeight: 1.45,
  fontWeight: 780,
}

const coachCheckInFormStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  marginTop: 4,
}

const coachCheckInGuideStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(15,37,67,0.12)',
  background: 'linear-gradient(135deg, rgba(8,19,38,0.92), rgba(17,46,42,0.9))',
  color: '#f7fbff',
  fontSize: '.82rem',
  lineHeight: 1.4,
}

const coachCheckInTextareaStyle: CSSProperties = {
  width: '100%',
  minHeight: 86,
  resize: 'vertical',
  borderRadius: 14,
  border: '1px solid rgba(15,37,67,0.18)',
  background: '#fff',
  color: '#0b1730',
  padding: '11px 12px',
  font: 'inherit',
  boxSizing: 'border-box',
}

const coachCheckInInputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 999,
  border: '1px solid rgba(15,37,67,0.18)',
  background: '#fff',
  color: '#0b1730',
  padding: '10px 12px',
  font: 'inherit',
  boxSizing: 'border-box',
}

const coachCheckInButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 999,
  background: 'var(--brand-green)',
  color: '#071226',
  padding: '10px 14px',
  fontSize: '.82rem',
  fontWeight: 900,
  cursor: 'pointer',
}

const coachCheckInGhostButtonStyle: CSSProperties = {
  border: '1px solid rgba(15,37,67,0.16)',
  borderRadius: 999,
  background: '#fff',
  color: '#0b1730',
  padding: '9px 13px',
  fontSize: '.82rem',
  fontWeight: 900,
  cursor: 'pointer',
}

const coachCheckInGhostLinkStyle: CSSProperties = {
  ...coachCheckInGhostButtonStyle,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
}

const coachCheckInMessageStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 16,
  background: 'rgba(155,225,29,0.12)',
  border: '1px solid rgba(155,225,29,0.28)',
  color: '#21410f',
  fontSize: '.9rem',
  fontWeight: 800,
}

const secondaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 0,
  minHeight: 46,
  padding: '0 16px',
  borderRadius: 999,
  textDecoration: 'none',
  fontWeight: 800,
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  border: '1px solid var(--shell-panel-border)',
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
  overflowWrap: 'anywhere',
}

const profileLinkSectionStyle: CSSProperties = {
  margin: 0,
  minWidth: 0,
}

const warningNoteStyle: CSSProperties = {
  margin: '0 0 18px',
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.55,
  fontSize: 13,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const profileLinkCardStyle: CSSProperties = {
  position: 'relative',
  borderRadius: 28,
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2,8,23,0.42), inset 0 1px 0 rgba(255,255,255,0.05)',
  padding: 'clamp(14px, 2.4vw, 20px)',
  display: 'grid',
  gap: 14,
  minWidth: 0,
  overflow: 'hidden',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: 'clamp(-92px, -7vw, -34px)',
  top: 'clamp(-112px, -10vw, -52px)',
  width: 'clamp(230px, 30vw, 420px)',
  aspectRatio: '1',
  borderRadius: '50%',
  border: '1px solid rgba(155,225,29,0.16)',
  background:
    'radial-gradient(circle at 34% 30%, rgba(255,255,255,0.15) 0 7%, transparent 8%), radial-gradient(circle at 52% 52%, rgba(155,225,29,0.09), rgba(125,211,252,0.04) 42%, transparent 68%)',
  opacity: 0.74,
  pointerEvents: 'none',
}

const personalHomeTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.08rem',
  fontWeight: 900,
  lineHeight: 1.2,
  overflowWrap: 'anywhere',
}

const personalReadPanelStyle: CSSProperties = {
  borderRadius: 20,
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.10), rgba(8,13,28,0.50))',
  padding: 14,
  display: 'grid',
  gap: 12,
  boxShadow: '0 18px 45px rgba(2,8,23,0.28)',
  minWidth: 0,
}

const onboardingPanelStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid color-mix(in srgb, var(--brand-lime) 26%, var(--shell-panel-border) 74%)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.11), rgba(116,190,255,0.07), rgba(8,13,28,0.62))',
  padding: 16,
  display: 'grid',
  gap: 14,
  boxShadow: '0 18px 45px rgba(2,8,23,0.26)',
  minWidth: 0,
  overflow: 'hidden',
}

const onboardingStepGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))',
  gap: 12,
  minWidth: 0,
})

const onboardingStepCardStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
  alignContent: 'start',
  minHeight: 210,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(7,17,33,0.62)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 750,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const onboardingGoalGridStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  minWidth: 0,
}

const onboardingGoalButtonStyle: CSSProperties = {
  minHeight: 34,
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  padding: '0 10px',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const onboardingGoalButtonActiveStyle: CSSProperties = {
  ...onboardingGoalButtonStyle,
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'rgba(155,225,29,0.14)',
}

const onboardingReadListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 9,
  alignItems: 'center',
  marginTop: 'auto',
  minWidth: 0,
}

const personalReadHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 14,
  flexWrap: 'wrap',
  minWidth: 0,
}

const personalReadTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: '1.35rem',
  lineHeight: 1.08,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const personalReadGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))'
    : 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  minWidth: 0,
})

const personalReadCardStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(125,211,252,0.12)',
  background: 'rgba(255,255,255,0.045)',
  padding: 12,
  minHeight: 108,
  display: 'grid',
  gap: 7,
  alignContent: 'start',
  minWidth: 0,
}

const personalReadCardLinkStyle: CSSProperties = {
  ...personalReadCardStyle,
  textDecoration: 'none',
  color: 'inherit',
  border: '1px solid rgba(155,225,29,0.26)',
}

const personalReadValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.12rem',
  fontWeight: 950,
  lineHeight: 1.12,
  overflowWrap: 'anywhere',
}

const levelUpPanelStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
  gap: 18,
  alignItems: 'stretch',
  minWidth: 0,
})

const levelMeterStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(8,13,28,0.60)',
  padding: 20,
  display: 'grid',
  gap: 16,
  boxShadow: '0 18px 45px rgba(2,8,23,0.28)',
}

const levelMeterHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 14,
  flexWrap: 'wrap',
  minWidth: 0,
}

const levelMeterTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.28rem',
  fontWeight: 950,
  lineHeight: 1.1,
  overflowWrap: 'anywhere',
}

const levelBadgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 12,
}

const levelRatingBlockStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'end',
  gap: 4,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontWeight: 900,
  textAlign: 'right',
  overflowWrap: 'anywhere',
}

const levelRatingNumberStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
  lineHeight: 0.92,
  fontWeight: 950,
}

const levelMeterMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 900,
  flexWrap: 'wrap',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const levelMeterScaleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 900,
  flexWrap: 'wrap',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const levelProgressFillStyle = (value: number, hasProgress: boolean): CSSProperties => ({
  display: 'block',
  height: '100%',
  minWidth: hasProgress ? 18 : '100%',
  width: hasProgress ? `${Math.max(4, Math.min(value, 100))}%` : '100%',
  borderRadius: 999,
  background: hasProgress
    ? 'linear-gradient(90deg, #74beff 0%, #4ade80 58%, #9be11d 100%)'
    : 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--brand-blue-2) 24%, transparent) 0 10px, color-mix(in srgb, var(--brand-blue-2) 10%, transparent) 10px 20px)',
  opacity: hasProgress ? 1 : 0.9,
  boxShadow: hasProgress
    ? '0 0 0 1px color-mix(in srgb, white 18%, transparent), 0 0 22px color-mix(in srgb, var(--brand-lime) 42%, transparent)'
    : 'none',
})

const quickProfileStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(8,13,28,0.60)',
  padding: 20,
  display: 'grid',
  gap: 14,
  boxShadow: '0 18px 45px rgba(2,8,23,0.28)',
  minWidth: 0,
}

const quickProfileTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: '1.28rem',
  fontWeight: 950,
  lineHeight: 1.1,
  overflowWrap: 'anywhere',
}

const quickProfileGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'minmax(0, 1fr)'
    : 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  minWidth: 0,
})

const quickProfileCardStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(255,255,255,0.045)',
  padding: 14,
  minHeight: 78,
  display: 'grid',
  alignContent: 'center',
  gap: 6,
  minWidth: 0,
}

const quickProfileValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.35rem',
  fontWeight: 950,
  lineHeight: 1,
  overflowWrap: 'anywhere',
}

const setupPanelStyle = (isTablet: boolean): CSSProperties => ({
  borderRadius: 24,
  border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 7%, var(--shell-panel-bg) 93%)',
  padding: isTablet ? 18 : 22,
  display: 'grid',
  gap: 18,
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
})

const setupHeroStyle: CSSProperties = {
  display: 'flex',
  gap: 14,
  alignItems: 'center',
  flexWrap: 'wrap',
  minWidth: 0,
}

const setupTitleStyle: CSSProperties = {
  margin: '4px 0 8px',
  color: 'var(--foreground-strong)',
  fontSize: '1.55rem',
  lineHeight: 1.06,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const setupStepGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'minmax(0, 1fr)'
    : 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 12,
  minWidth: 0,
})

const setupStepCardStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 14,
  display: 'grid',
  gap: 8,
  minHeight: 138,
  alignContent: 'start',
  color: 'var(--foreground-strong)',
  minWidth: 0,
}

const setupStepNumberStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-chip-bg) 78%)',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 42%, var(--shell-panel-border) 58%)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 950,
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
}

const setupActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const todayReadPanelStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 18,
  display: 'grid',
  gap: 12,
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const starterPanelStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid color-mix(in srgb, var(--brand-lime) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-lime) 7%, var(--shell-panel-bg) 93%)',
  padding: 18,
  display: 'grid',
  gap: 14,
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const starterGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'repeat(4, minmax(0, 1fr))',
  gap: 10,
  minWidth: 0,
})

const starterCardStyle: CSSProperties = {
  minWidth: 0,
  minHeight: 118,
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  padding: 14,
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const todayReadGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))'
    : 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
  gap: 10,
  minWidth: 0,
})

const todayReadCardStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  minHeight: 106,
  display: 'grid',
  gap: 6,
  alignContent: 'start',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const todayReadValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.12rem',
  fontWeight: 950,
  lineHeight: 1.1,
  overflowWrap: 'anywhere',
}

const matchupSpotlightStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 7%, var(--shell-panel-bg) 93%)',
  padding: 18,
  display: 'grid',
  gap: 14,
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const matchupSpotlightHeroStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, auto)',
  alignItems: 'center',
  gap: 14,
  minWidth: 0,
  overflowWrap: 'anywhere',
})

const matchupSpotlightTitleStyle: CSSProperties = {
  margin: '4px 0 8px',
  color: 'var(--foreground-strong)',
  fontSize: '1.35rem',
  lineHeight: 1.08,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const matchupPrimaryLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  textDecoration: 'none',
  fontWeight: 950,
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
}

const matchupMeterStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const matchupTrackStyle: CSSProperties = {
  height: 14,
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--shell-chip-bg) 72%, black 28%)',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 24%, var(--shell-panel-border) 76%)',
  overflow: 'hidden',
}

const matchupFillStyle = (value: number): CSSProperties => ({
  display: 'block',
  height: '100%',
  minWidth: value > 0 ? 12 : 0,
  width: `${Math.max(0, Math.min(value, 100))}%`,
  borderRadius: 999,
  background: 'linear-gradient(90deg, var(--brand-green), var(--brand-lime))',
  boxShadow: '0 0 18px color-mix(in srgb, var(--brand-lime) 42%, transparent)',
})

const matchupPreviewGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'minmax(0, 1fr)'
    : 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
  gap: 10,
  minWidth: 0,
})

const matchupPreviewCardStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  display: 'grid',
  gap: 6,
  minHeight: 104,
  minWidth: 0,
}

const matchupQueueGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'minmax(0, 1fr)'
    : 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))',
  gap: 10,
  minWidth: 0,
})

const matchupQueueCardStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr) minmax(0, auto)',
  alignItems: 'center',
  gap: 10,
  minHeight: 104,
  padding: 14,
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-lime) 20%, var(--shell-panel-border) 80%)',
  background: 'color-mix(in srgb, var(--brand-green) 7%, var(--shell-panel-bg) 93%)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  overflow: 'hidden',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const matchupQueueRankStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 950,
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
}

const matchupQueueCopyStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
}

const matchupQueueNameStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  fontSize: '1rem',
  fontWeight: 950,
  lineHeight: 1.15,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const matchupQueueMetaStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  marginTop: 4,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 800,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const matchupQueueFitStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'end',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  lineHeight: 1,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const matchupQueueTrackStyle: CSSProperties = {
  gridColumn: '1 / -1',
  height: 8,
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
  overflow: 'hidden',
}

const matchupQueueFillStyle = (value: number): CSSProperties => ({
  display: 'block',
  height: '100%',
  width: `${Math.max(0, Math.min(value, 100))}%`,
  minWidth: value > 0 ? 10 : 0,
  borderRadius: 999,
  background: 'linear-gradient(90deg, var(--brand-green), var(--brand-lime))',
})

const performancePanelStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 18,
  display: 'grid',
  gap: 12,
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const matchPlanPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 16,
  borderRadius: 22,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 7%, var(--shell-panel-bg) 93%)',
  minWidth: 0,
}

const matchPlanGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'minmax(0, 1fr)'
    : 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 12,
  minWidth: 0,
})

const matchPlanCardStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
  alignContent: 'start',
  minHeight: 170,
  padding: 14,
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  lineHeight: 1.5,
  fontWeight: 800,
  minWidth: 0,
}

const matchPlanTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const performanceGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))'
    : 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
  gap: 12,
  minWidth: 0,
})

const performanceCardStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 14,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 64px) minmax(0, 1fr)',
  alignItems: 'center',
  gap: 12,
  minHeight: 104,
  minWidth: 0,
}

const performanceCardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 950,
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}

const statRingStyle = (value: number): CSSProperties => ({
  width: 64,
  height: 64,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--foreground-strong)',
  fontWeight: 950,
  background: `conic-gradient(var(--brand-lime) 0% ${Math.max(0, Math.min(value, 100))}%, var(--shell-chip-bg) ${Math.max(0, Math.min(value, 100))}% 100%)`,
  boxShadow: 'inset 0 0 0 8px var(--shell-panel-bg)',
})

const trophyRoomPanelStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid color-mix(in srgb, var(--brand-green) 20%, var(--shell-panel-border) 80%)',
  background: 'var(--shell-panel-bg)',
  padding: 18,
  display: 'grid',
  gap: 14,
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const trophyRoomGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))'
    : 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
  gap: 12,
  minWidth: 0,
})

const trophyProofGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'repeat(auto-fit, minmax(min(100%, 135px), 1fr))'
    : 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 8,
  minWidth: 0,
})

const trophyProofItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gap: 8,
  alignItems: 'center',
  minWidth: 0,
  padding: '9px 10px',
  borderRadius: 14,
  border: '1px solid color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const trophyProofDotStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'var(--brand-lime)',
  boxShadow: '0 0 0 4px rgba(155,225,29,0.10)',
}

const trophyCardStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 16,
  display: 'grid',
  gap: 8,
  minHeight: 118,
  alignContent: 'start',
  minWidth: 0,
}

const trophyValueStyle: CSSProperties = {
  color: 'var(--brand-lime)',
  fontSize: '1.55rem',
  fontWeight: 950,
  lineHeight: 1.05,
  overflowWrap: 'anywhere',
}

const trophyCardActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  justifySelf: 'start',
  minHeight: 30,
  maxWidth: '100%',
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const personalCommandGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'minmax(0, 1fr)'
    : 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
  gap: 12,
  minWidth: 0,
})

const personalCommandCardStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 16,
  display: 'grid',
  gap: 8,
  textDecoration: 'none',
  minHeight: 160,
  alignContent: 'start',
  minWidth: 0,
}

const youHubPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const tiqActionRailStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)',
  background: 'var(--shell-panel-bg)',
  padding: 16,
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const tiqActionGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'minmax(0, 1fr)'
    : 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
  gap: 12,
  minWidth: 0,
})

const tiqActionCardStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 14,
  display: 'grid',
  gap: 8,
  minHeight: 172,
  alignContent: 'start',
  minWidth: 0,
}

const tiqActionTopRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
}

const tiqActionLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const tiqActionMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 850,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const tiqActionTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1rem',
  lineHeight: 1.25,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const tiqActionTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
}

const tiqActionButtonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
  marginTop: 4,
  minWidth: 0,
}

const smallInlineLinkStyle: CSSProperties = {
  color: 'var(--brand-lime)',
  fontSize: 12,
  fontWeight: 950,
  textDecoration: 'none',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const teamPrepRailStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 22%, var(--shell-panel-border) 78%)',
  background: 'color-mix(in srgb, var(--brand-green) 7%, var(--shell-panel-bg) 93%)',
  padding: 16,
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const teamPrepGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'minmax(0, 1fr)'
    : 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 12,
  minWidth: 0,
})

const teamPrepCardStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 14,
  display: 'grid',
  gap: 12,
  minHeight: 132,
  alignContent: 'space-between',
  minWidth: 0,
}

const teamPrepTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1rem',
  lineHeight: 1.25,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const teamPrepMetaStyle: CSSProperties = {
  marginTop: 5,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
}

const teamPrepActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
  minWidth: 0,
}

const goalProgressPanelStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 22%, var(--shell-panel-border) 78%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
  padding: 16,
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const compactSectionTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: '1.08rem',
  lineHeight: 1.2,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const goalSummaryGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))'
    : 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
})

const goalSummaryCardStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  display: 'grid',
  gap: 6,
  minHeight: 116,
  minWidth: 0,
}

const goalSummaryValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  lineHeight: 1.25,
  overflowWrap: 'anywhere',
}

const goalReadinessPanelStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid color-mix(in srgb, var(--brand-lime) 22%, var(--shell-panel-border) 78%)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const goalReadinessHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const goalReadinessTextStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
}

const goalReadinessScoreStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.35rem',
  lineHeight: 1,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const goalReadinessTrackStyle: CSSProperties = {
  height: 12,
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--foreground-strong) 12%, var(--shell-panel-border) 88%)',
  background: 'var(--shell-chip-bg)',
  overflow: 'hidden',
  padding: 2,
}

const goalReadinessFillStyle = (value: number): CSSProperties => ({
  display: 'block',
  height: '100%',
  width: `${Math.max(0, Math.min(value, 100))}%`,
  borderRadius: 999,
  background: 'linear-gradient(90deg, var(--brand-green), var(--brand-lime))',
})

const goalReadinessChecklistStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  minWidth: 0,
}

const readinessPillStyle: CSSProperties = {
  maxWidth: '100%',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
  borderRadius: 999,
  padding: '4px 8px',
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const readinessPillCompleteStyle: CSSProperties = {
  ...readinessPillStyle,
  border: '1px solid color-mix(in srgb, var(--brand-green) 35%, var(--shell-panel-border) 65%)',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)',
  color: 'var(--foreground-strong)',
}

const recommendationCardStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  minWidth: 0,
}

const recommendationTextStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const quickStartPanelStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const quickStartTextStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const quickStartButtonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const quickStartButtonStyle: CSSProperties = {
  maxWidth: '100%',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 22%, var(--shell-panel-border) 78%)',
  background: 'color-mix(in srgb, var(--brand-lime) 9%, var(--shell-chip-bg) 91%)',
  color: 'var(--foreground-strong)',
  borderRadius: 999,
  minHeight: 34,
  padding: '0 12px',
  fontSize: 13,
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const smallGhostButtonStyle: CSSProperties = {
  maxWidth: '100%',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  borderRadius: 999,
  minHeight: 36,
  padding: '0 13px',
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const collapsibleSummaryStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  cursor: 'pointer',
  marginBottom: 12,
  overflowWrap: 'anywhere',
}

const progressTrackStyle: CSSProperties = {
  height: 16,
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--foreground-strong) 10%, var(--shell-chip-bg) 90%)',
  border: '1px solid color-mix(in srgb, var(--foreground-strong) 14%, var(--shell-panel-border) 86%)',
  overflow: 'hidden',
  padding: 2,
  boxShadow: 'inset 0 1px 3px color-mix(in srgb, black 18%, transparent)',
}

const goalWorkspaceStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 14,
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const goalListStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const goalTabStyle: CSSProperties = {
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  color: 'var(--foreground-strong)',
  borderRadius: 14,
  padding: '10px 12px',
  display: 'grid',
  gap: 4,
  textAlign: 'left',
  cursor: 'pointer',
  fontWeight: 900,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const goalTabActiveStyle: CSSProperties = {
  ...goalTabStyle,
  border: '1px solid color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-panel-bg) 88%)',
}

const goalTabMetaRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const goalTabTrackStyle: CSSProperties = {
  height: 6,
  borderRadius: 999,
  background: 'var(--shell-chip-bg)',
  overflow: 'hidden',
}

const goalTabTrackFillStyle = (value: number): CSSProperties => ({
  display: 'block',
  height: '100%',
  width: `${Math.max(0, Math.min(value, 100))}%`,
  borderRadius: 999,
  background: 'linear-gradient(90deg, var(--brand-green), var(--brand-lime))',
})

const goalEditorDetailsStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  minWidth: 0,
}

const goalFooterActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  minWidth: 0,
}

const miniActionLinkStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 13,
  fontWeight: 900,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const workshopGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1.1fr) minmax(min(100%, 280px), 0.9fr)',
  gap: 12,
  minWidth: 0,
})

const workshopPanelStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 16,
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const workshopListStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
  minWidth: 0,
}

const goalEditorStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 14,
  minWidth: 0,
}

const workshopMatchRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr) minmax(0, auto)',
  gap: 10,
  alignItems: 'center',
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: '10px 12px',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const matchActionStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 8,
  minWidth: 0,
}

const reportStatusCardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: '10px 12px',
  minWidth: 0,
}

const reportStatusHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
  minWidth: 0,
}

const reportStatusTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
}

const matchReflectButtonStyle: CSSProperties = {
  maxWidth: '100%',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  borderRadius: 999,
  minHeight: 32,
  padding: '0 10px',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'normal',
  textAlign: 'center',
  overflowWrap: 'anywhere',
}

const workshopContextRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: '10px 12px',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  minWidth: 0,
}

const workshopRowTitleStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const workshopRowMetaStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  marginTop: 3,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const workshopRowCopyStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
}

const nextActionCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr) minmax(0, auto)',
  alignItems: 'center',
  gap: 12,
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)',
  background: 'var(--shell-panel-bg)',
  padding: 14,
  minHeight: 112,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const miniActionPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-lime) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-lime) 12%, var(--shell-chip-bg) 88%)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
  textDecoration: 'none',
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const notebookFooterStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 800,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const saveNotebookButtonStyle: CSSProperties = {
  maxWidth: '100%',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  borderRadius: 999,
  minHeight: 38,
  padding: '0 14px',
  fontWeight: 900,
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const goalFieldGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet
    ? 'minmax(0, 1fr)'
    : 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: 12,
  minWidth: 0,
})

const metricLabelStyle: CSSProperties = {
  color: 'var(--muted)',
  fontSize: '0.82rem',
  marginBottom: 6,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const metricNoteStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.5,
  fontSize: '.92rem',
  marginTop: 6,
  overflowWrap: 'anywhere',
}

const contentGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1.4fr) minmax(min(100%, 320px), 0.9fr)',
  gap: 18,
  marginTop: 18,
  minWidth: 0,
})

const optionalContextDetailsStyle: CSSProperties = {
  marginTop: 18,
  borderRadius: 24,
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-panel-bg) 84%, transparent)',
  padding: 0,
  overflow: 'hidden',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const labDrawerDetailsStyle: CSSProperties = {
  marginTop: 14,
  borderRadius: 22,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--shell-panel-bg) 82%, transparent)',
  padding: 0,
  overflow: 'hidden',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
}

const labDrawerSummaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  padding: '14px 16px',
  cursor: 'pointer',
  color: 'var(--foreground-strong)',
  fontWeight: 950,
  listStyle: 'none',
  flexWrap: 'wrap',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const labDrawerSummaryCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
}

const labDrawerSummaryHintStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontStyle: 'normal',
  fontWeight: 800,
  lineHeight: 1.35,
}

const labDrawerContentStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: '0 14px 14px',
  minWidth: 0,
}

const optionalContextSummaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  padding: '16px 18px',
  cursor: 'pointer',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  listStyle: 'none',
  flexWrap: 'wrap',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const optionalContextCountStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 11px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: 'normal',
  maxWidth: '100%',
  overflowWrap: 'anywhere',
}

const compactSignalsPanelStyle: CSSProperties = {
  borderRadius: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: '14px 16px',
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const compactSignalsHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0,
  flexWrap: 'wrap',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const compactSignalsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const compactSignalCardStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px',
  borderRadius: 12,
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  flexWrap: 'wrap',
  minWidth: 0,
}

const compactSignalCopyStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
}

const compactSignalNameStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  color: 'var(--foreground)',
  fontWeight: 800,
  fontSize: 13,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const compactSignalMetaStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 600,
  marginTop: 2,
  overflowWrap: 'anywhere',
}

const leftColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  minWidth: 0,
}

const rightColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  minWidth: 0,
}

const surfaceStrongStyle: CSSProperties = {
  borderRadius: 28,
  padding: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
  minWidth: 0,
}

const surfaceStyle: CSSProperties = {
  borderRadius: 28,
  padding: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
  marginBottom: 16,
  minWidth: 0,
}

const sectionHeaderCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
}

const sectionTitleClusterStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 14,
  minWidth: 0,
  flexWrap: 'wrap',
}

const sectionKickerStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontWeight: 800,
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: 0,
  margin: 0,
  overflowWrap: 'anywhere',
}

const sectionTitleStyle: CSSProperties = {
  margin: '8px 0',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: 'clamp(1.45rem, 3vw, 1.75rem)',
  letterSpacing: 0,
  lineHeight: 1.1,
  overflowWrap: 'anywhere',
}

const sectionTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  maxWidth: 780,
  overflowWrap: 'anywhere',
}

const searchPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const inputWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const labelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const inputStyle: CSSProperties = {
  width: '100%',
  height: 48,
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '0 14px',
  fontSize: 14,
  outline: 'none',
  boxShadow: 'var(--home-control-shadow)',
}

const textAreaStyle: CSSProperties = {
  ...inputStyle,
  height: 112,
  padding: '12px 14px',
  resize: 'vertical',
  lineHeight: 1.45,
}

const shortTextAreaStyle: CSSProperties = {
  ...textAreaStyle,
  height: 84,
}

const filterRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
}

const tabButtonStyle: CSSProperties = {
  minHeight: 34,
  borderRadius: 999,
  padding: '0 12px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 700,
  cursor: 'pointer',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const tabActiveStyle: CSSProperties = {
  ...tabButtonStyle,
  background: 'color-mix(in srgb, var(--brand-green) 13%, var(--shell-chip-bg) 87%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
}

const searchResultsStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const searchResultItemStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  padding: 14,
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const searchResultTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const searchResultMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  marginTop: 4,
  overflowWrap: 'anywhere',
}

const primaryMiniButtonStyle: CSSProperties = {
  minHeight: 34,
  borderRadius: 999,
  padding: '0 12px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  cursor: 'pointer',
  maxWidth: '100%',
  whiteSpace: 'normal',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
}

const ghostMiniButtonStyle: CSSProperties = {
  minHeight: 34,
  borderRadius: 999,
  padding: '0 12px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 700,
  cursor: 'pointer',
  maxWidth: '100%',
  whiteSpace: 'normal',
}

const emptyInlineStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  padding: 12,
  borderRadius: 16,
  border: '1px dashed var(--shell-panel-border)',
}

const emptyStateStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  padding: 18,
  borderRadius: 18,
  border: '1px dashed var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 88%, transparent)',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const errorStateStyle: CSSProperties = {
  color: 'color-mix(in srgb, #f87171 72%, var(--foreground-strong) 28%)',
  padding: 18,
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, #f87171 26%, var(--shell-panel-border) 74%)',
  background: 'color-mix(in srgb, #7f1d1d 14%, var(--shell-chip-bg) 86%)',
}

const errorActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 14,
}

const feedListStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  maxHeight: 640,
  overflowY: 'auto',
  paddingRight: 6,
  minWidth: 0,
}

const feedCardStyle = (accent: FeedItem['accent']): CSSProperties => ({
  borderRadius: 22,
  padding: 18,
  border: '1px solid var(--shell-panel-border)',
  background:
    accent === 'green'
      ? 'color-mix(in srgb, var(--brand-green) 9%, var(--shell-panel-bg) 91%)'
      : accent === 'violet'
        ? 'color-mix(in srgb, #7762ff 10%, var(--shell-panel-bg) 90%)'
        : 'color-mix(in srgb, var(--brand-blue-2) 10%, var(--shell-panel-bg) 90%)',
  minWidth: 0,
  overflowWrap: 'anywhere',
})

const feedTopRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginBottom: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const feedTimeStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  overflowWrap: 'anywhere',
}

const feedTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: 20,
  lineHeight: 1.2,
  overflowWrap: 'anywhere',
}

const feedBodyStyle: CSSProperties = {
  margin: '10px 0 0 0',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  overflowWrap: 'anywhere',
}

const feedMetaRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
  marginTop: 14,
}

const feedLinkStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontWeight: 800,
  textDecoration: 'none',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const pillSlateStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  border: '1px solid var(--shell-panel-border)',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const pillGreenStyle: CSSProperties = {
  ...pillSlateStyle,
  background: 'color-mix(in srgb, var(--brand-green) 11%, var(--shell-chip-bg) 89%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
}

const pillRedStyle: CSSProperties = {
  ...pillSlateStyle,
  background: 'rgba(239,68,68,0.12)',
  color: '#fecaca',
  border: '1px solid rgba(239,68,68,0.20)',
}

const pillBlueStyle: CSSProperties = {
  ...pillSlateStyle,
  background: 'color-mix(in srgb, var(--brand-blue-2) 12%, var(--shell-chip-bg) 88%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)',
}

const pillVioletStyle: CSSProperties = {
  ...pillSlateStyle,
  background: 'color-mix(in srgb, #7762ff 12%, var(--shell-chip-bg) 88%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, #7762ff 24%, var(--shell-panel-border) 76%)',
}

function badgeForAccent(accent: FeedItem['accent']): CSSProperties {
  if (accent === 'green') return pillGreenStyle
  if (accent === 'violet') return pillVioletStyle
  return pillBlueStyle
}

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const collectionsStackStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const manageFollowsHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  paddingTop: 4,
  minWidth: 0,
}

const supportTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 18,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const supportTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
}

const summaryCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const summaryValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: 26,
  lineHeight: 1.1,
  overflowWrap: 'anywhere',
}

const insightStackStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 14,
  minWidth: 0,
}

const insightCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const insightTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  marginBottom: 6,
  overflowWrap: 'anywhere',
}

const insightTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  overflowWrap: 'anywhere',
}

const followListStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const followCardStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: 14,
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  flexWrap: 'wrap',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const followNameStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const followMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  marginTop: 4,
  overflowWrap: 'anywhere',
}

