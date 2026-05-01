'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import React from 'react'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import {
  inferCompetitionLayerFromValues,
  type CompetitionLayer,
} from '@/lib/competition-layers'
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
  type TiqLeagueStorageSource,
  type TiqPlayerParticipationRecord,
} from '@/lib/tiq-league-service'
import { buildProductAccessState } from '@/lib/access-model'
import { MY_LAB_STORY } from '@/lib/product-story'
import { loadUserProfileLink, saveUserProfileLink, type UserProfileLink } from '@/lib/user-profile'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { formatRating, cleanText } from '@/lib/captain-formatters'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'

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

function compactOpponentLabel(value: string | null | undefined) {
  if (!value) return 'opponent'
  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length <= 2) return value
  return `${parts.slice(0, 2).join(' / ')} +${parts.length - 2}`
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
  const { userId, authResolved, role } = useAuth()

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
  const [tiqPlayerParticipationSource, setTiqPlayerParticipationSource] = useState<TiqLeagueStorageSource>('local')
  const [tiqPlayerParticipationWarning, setTiqPlayerParticipationWarning] = useState<string | null>(null)
  const [profileLink, setProfileLink] = useState<ProfileLinkRow | null>(null)
  const [selectedPlayerLinkId, setSelectedPlayerLinkId] = useState('')
  const [selectedTeamLinkId, setSelectedTeamLinkId] = useState('')
  const [savingProfileLink, setSavingProfileLink] = useState(false)
  const [profileLinkMessage, setProfileLinkMessage] = useState('')
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
  const { isTablet, isMobile } = useViewportBreakpoints()
  const access = useMemo(() => buildProductAccessState(role, null), [role])

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
      supabase
        .from('players')
        .select(
          'id,name,location,flight,singles_dynamic_rating,doubles_dynamic_rating,overall_dynamic_rating,singles_usta_dynamic_rating,doubles_usta_dynamic_rating,overall_usta_dynamic_rating',
        )
        .order('name', { ascending: true }),
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
      playersRes.error,
      matchesRes.error,
      matchPlayersRes.error,
      scenariosRes.error,
      cloudFeedRes.error,
    ].find(Boolean)

    if (firstHardError) {
      setError(firstHardError.message)
    }

    setPlayers((playersRes.data ?? []) as PlayerRow[])
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
    setTiqPlayerParticipationSource(tiqParticipationRes.source)
    setTiqPlayerParticipationWarning(tiqParticipationRes.warning)
    let linkedPlayerIdForWorkshop = ''

    if (!profileLinkRes.error && profileLinkRes.data) {
      const nextProfileLink = profileLinkRes.data as ProfileLinkRow
      linkedPlayerIdForWorkshop = nextProfileLink.linked_player_id || ''
      setProfileLink(nextProfileLink)
      setSelectedPlayerLinkId(nextProfileLink.linked_player_id || '')
      setSelectedTeamLinkId(
        nextProfileLink.linked_team_name
          ? buildScopedTeamEntityId({
              competitionLayer: '',
              teamName: nextProfileLink.linked_team_name,
              leagueName: nextProfileLink.linked_league_name || '',
              flight: nextProfileLink.linked_flight || '',
            })
          : '',
      )
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

  const selectedPlayerTeamSummaries = useMemo(() => {
    if (!selectedPlayerLinkId) return []

    const teamIds = new Set<string>()

    for (const match of matches) {
      const participants = matchPlayersByMatch.get(match.id) ?? []
      const selectedParticipant = participants.find((participant) => participant.player_id === selectedPlayerLinkId)
      if (!selectedParticipant) continue

      const teamName = cleanText(selectedParticipant.side === 'A' ? match.home_team : match.away_team)
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
  }, [matches, matchPlayersByMatch, selectedPlayerLinkId, teamSummaries])

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

  const profileTeamOptions = selectedPlayerTeamSummaries.length ? selectedPlayerTeamSummaries : teamSummaries

  useEffect(() => {
    if (!selectedPlayerLinkId || selectedTeamLinkId || selectedPlayerTeamSummaries.length !== 1) return
    setSelectedTeamLinkId(selectedPlayerTeamSummaries[0].id)
  }, [selectedPlayerLinkId, selectedPlayerTeamSummaries, selectedTeamLinkId])

  async function saveProfileTeamLink() {
    if (!userId) {
      setProfileLinkMessage('Sign in to confirm your player profile.')
      return
    }

    const selectedPlayer = players.find((player) => player.id === selectedPlayerLinkId) ?? null
    const selectedTeam = selectedTeamLinkId ? parseTeamEntityId(selectedTeamLinkId) : null

    setSavingProfileLink(true)
    setProfileLinkMessage('')

    const payload: ProfileLinkRow & { linked_team_at: string } = {
      linked_player_id: selectedPlayer?.id || null,
      linked_player_name: selectedPlayer?.name || null,
      linked_team_name: selectedTeam?.teamName || null,
      linked_league_name: selectedTeam?.leagueName || null,
      linked_flight: selectedTeam?.flight || null,
      linked_team_at: new Date().toISOString(),
    }

    const saveRes = await saveUserProfileLink(userId, payload)
    if (saveRes.error) {
      setSavingProfileLink(false)
      setProfileLinkMessage(saveRes.error.message)
      return
    }

    setSavingProfileLink(false)

    setProfileLink({
      linked_player_id: payload.linked_player_id,
      linked_player_name: payload.linked_player_name,
      linked_team_name: payload.linked_team_name,
      linked_league_name: payload.linked_league_name,
      linked_flight: payload.linked_flight,
    })
    setProfileLinkMessage(
      saveRes.source === 'local'
        ? 'Profile saved on this device. Apply the profile-link migration for cloud sync.'
        : 'Your player home base is confirmed.',
    )
  }

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

  const followedIds = useMemo(
    () => new Set(follows.map((item) => `${item.entity_type}:${item.entity_id}`)),
    [follows],
  )

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
    tiqIndividualSuggestions,
    tiqLeagues,
    followedTiqSuggestionItems,
    followedTiqIndividualLeagueInsights,
    followedTiqIndividualParticipations,
    followedLeagueIds,
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

  const followedPlayers = follows.filter((item) => item.entity_type === 'player')
  const followedTeams = follows.filter((item) => item.entity_type === 'team')
  const followedLeagues = follows.filter((item) => item.entity_type === 'league')
  const isProfileConfirmed = Boolean(profileLink?.linked_player_id || profileLink?.linked_player_name)
  const confirmedPlayerHref = profileLink?.linked_player_id ? `/players/${profileLink.linked_player_id}` : '/explore/players'
  const linkedPlayer = profileLink?.linked_player_id ? playerMap.get(profileLink.linked_player_id) || null : null
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
  const ustaDynamic = linkedPlayer?.overall_usta_dynamic_rating ?? null
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
            return typeof rating === 'number'
              ? {
                  player,
                  rating,
                  gap: Math.abs(rating - anchorRating),
                }
              : null
          })
          .filter((item): item is { player: PlayerRow; rating: number; gap: number } => Boolean(item))
          .sort((left, right) => left.gap - right.gap)
          .slice(0, 4)
      : []
  const topMatchupCandidate = matchupCandidates[0] || null
  const secondaryMatchupCandidates = matchupCandidates.slice(1, 4)
  const matchupHref = linkedPlayer
    ? `/matchup?type=singles&playerA=${encodeURIComponent(linkedPlayer.id)}${topMatchupCandidate ? `&playerB=${encodeURIComponent(topMatchupCandidate.player.id)}` : ''}`
    : '/matchup'
  const matchupGapScore = topMatchupCandidate ? Math.max(0, Math.min(100, 100 - topMatchupCandidate.gap * 100)) : 0
  const matchupReadLabel =
    topMatchupCandidate == null
      ? 'Build player link'
      : topMatchupCandidate.gap <= 0.08
        ? 'Very close'
        : topMatchupCandidate.gap <= 0.18
          ? 'Good test'
          : 'Stretch test'
  const matchupPreviewCards = [
    {
      label: 'Match quality',
      value: topMatchupCandidate ? matchupReadLabel : 'Waiting',
      note: topMatchupCandidate ? `${topMatchupCandidate.gap.toFixed(2)} rating gap` : 'Link your profile to find close tests',
    },
    {
      label: 'Your singles',
      value: formatRating(linkedPlayer?.singles_dynamic_rating ?? linkedPlayer?.overall_dynamic_rating ?? null),
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
        : linkedPlayer
          ? 'Pick one measurable goal and update it after your next match so My Lab can start showing progress.'
          : 'Link your player record to unlock recommendations from ratings, match history, and matchup context.'
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
      note: linkedPlayer ? `${linkedPlayer.name} - ${linkedPlayer.location || 'player profile'}` : 'Link your player record in Profile.',
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
  const confirmedTeamEntityId = profileLink?.linked_team_name
    ? buildScopedTeamEntityId({
        competitionLayer: '',
        teamName: profileLink.linked_team_name,
        leagueName: profileLink.linked_league_name || '',
        flight: profileLink.linked_flight || '',
      })
    : ''
  const confirmedTeamHref = confirmedTeamEntityId ? buildTeamHrefFromEntityId(confirmedTeamEntityId) : null
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
      display: ustaBase == null ? 'New' : ustaBase.toFixed(2),
    },
    {
      label: 'USTA dynamic',
      value: ustaDynamic,
      display: formatRating(ustaDynamic),
    },
    {
      label: 'Overall',
      value: currentTiq,
      display: formatRating(currentTiq),
    },
    {
      label: 'Singles',
      value: linkedPlayer?.singles_dynamic_rating ?? null,
      display: formatRating(linkedPlayer?.singles_dynamic_rating ?? null),
    },
    {
      label: 'Doubles',
      value: linkedPlayer?.doubles_dynamic_rating ?? null,
      display: formatRating(linkedPlayer?.doubles_dynamic_rating ?? null),
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
  const trophyRoomCards = [
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
      <section id="player-workshop" style={profileLinkSectionStyle}>
        <div style={profileLinkCardStyle}>
          <div style={sectionHeaderStyle}>
            <div style={sectionTitleClusterStyle}>
              <TiqFeatureIcon name="myLab" size="lg" variant="surface" />
              <div>
              <p style={sectionKickerStyle}>Player scorecard</p>
              <h2 style={sectionTitleStyle}>{welcomeLine}</h2>
              <p style={sectionTextStyle}>
                Start with the score: ratings, progress to the next level, records, and the next useful matchup.
              </p>
              </div>
            </div>
            <Link href={matchupHref} style={secondaryButtonStyle}>
              Open Matchup
            </Link>
          </div>

          <section style={levelUpPanelStyle(isTablet)}>
            <div style={levelMeterStyle}>
              <div style={levelMeterHeaderStyle}>
                <div>
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
                <span>{ratingToGo == null ? 'Link your player profile to show your next level path.' : `${ratingToGo.toFixed(2)} to go`}</span>
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
                    ? 'Use the closest rating gap as a fast read before you choose who to play next.'
                    : 'Link your player profile and My Lab will turn the player pool into matchup suggestions.'}
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
                <p style={sectionTextStyle}>Best marks across the tracked history for this profile.</p>
                </div>
              </div>
            </div>
            <div style={trophyRoomGridStyle(isTablet)}>
              {trophyRoomCards.map((record) => (
                <div key={record.label} style={trophyCardStyle}>
                  <div style={metricLabelStyle}>{record.label}</div>
                  <div style={trophyValueStyle}>{record.value}</div>
                  <div style={metricNoteStyle}>{record.note}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      {tiqPlayerParticipationWarning ? (
        <div style={warningNoteStyle}>
          TIQ participation note: {tiqPlayerParticipationWarning}
        </div>
      ) : null}

      <section id="player-tools" style={profileLinkSectionStyle}>
        <div style={profileLinkCardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <p style={sectionKickerStyle}>Player workshop</p>
              <h2 style={sectionTitleStyle}>What should I do next?</h2>
              <p style={sectionTextStyle}>
                Turn the scorecard into action: review, compare, choose one focus, then go play.
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

          <section id="goal-progress" style={goalProgressPanelStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={sectionKickerStyle}>Optional goals</p>
                <h3 style={compactSectionTitleStyle}>Training notes when you need them</h3>
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
            <div style={recommendationCardStyle}>
              <div style={metricLabelStyle}>TenAceIQ recommendation</div>
              <p style={recommendationTextStyle}>{tiqRecommendation}</p>
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
                    <em>{goalStatusLabel(goal.progressStatus)}</em>
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
                  personalMatches.slice(0, 5).map((match) => (
                    <div key={match.id} style={workshopMatchRowStyle}>
                      <span style={match.result === 'W' ? pillGreenStyle : match.result === 'L' ? pillRedStyle : pillSlateStyle}>
                        {match.result}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={workshopRowTitleStyle}>{match.opponent}</div>
                        <div style={workshopRowMetaStyle}>
                          {[safeDate(match.date), match.leagueName, match.matchType, match.score].filter(Boolean).join(' - ')}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={emptyStateStyle}>
                    {isProfileConfirmed ? 'Match history will appear as imported results connect to your player record.' : 'Set up your profile to unlock your personal match history.'}
                  </div>
                )}
              </div>
            </div>

            <div style={workshopPanelStyle}>
              <div style={sectionKickerStyle}>More close tests</div>
              <div style={workshopListStyle}>
                {secondaryMatchupCandidates.length ? (
                  secondaryMatchupCandidates.map(({ player, rating, gap }) => (
                    <Link
                      key={player.id}
                      href={`/matchup?type=singles&playerA=${encodeURIComponent(linkedPlayer?.id || '')}&playerB=${encodeURIComponent(player.id)}`}
                      style={matchupSuggestionStyle}
                    >
                      <span>
                        <strong>{player.name}</strong>
                        <small>{player.location || 'Player'} - S {formatRating(player.singles_dynamic_rating)} - O {formatRating(player.overall_dynamic_rating)}</small>
                      </span>
                      <em>{gap.toFixed(2)}</em>
                    </Link>
                  ))
                ) : (
                  <div style={emptyStateStyle}>
                    {topMatchupCandidate
                      ? 'The spotlight above is your closest current read.'
                      : isProfileConfirmed
                        ? 'Matchup suggestions appear when your rating and player pool are available.'
                        : 'Manage your profile to unlock matchup suggestions.'}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {followedPlayerSignals.length > 0 ? (
        <section style={profileLinkSectionStyle}>
          <div style={{ borderRadius: 20, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)', padding: '18px 20px' }}>
            <div style={{ color: '#93c5fd', fontWeight: 800, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 14 }}>
              Watchlist signals
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {followedPlayerSignals.map((s) => {
                const positive = s.status === 'Bump Up Pace' || s.status === 'Trending Up'
                const negative = s.status === 'At Risk' || s.status === 'Drop Watch'
                const pillStyle: React.CSSProperties = positive
                  ? { background: 'rgba(155,225,29,0.10)', color: '#d9f84a', border: '1px solid rgba(155,225,29,0.20)' }
                  : negative
                    ? { background: 'rgba(239,68,68,0.10)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.18)' }
                    : { background: 'rgba(116,190,255,0.08)', color: '#93c5fd', border: '1px solid rgba(116,190,255,0.16)' }
                return (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, background: 'var(--shell-chip-bg)', border: '1px solid var(--shell-panel-border)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--foreground)', fontWeight: 800, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{s.name}</div>
                      {s.tiq != null ? <div style={{ color: 'var(--shell-copy-muted)', fontSize: 11, fontWeight: 600, marginTop: 2 }}>TIQ {s.tiq.toFixed(2)}</div> : null}
                    </div>
                    {s.status ? (
                      <span style={{ ...pillStyle, display: 'inline-flex', padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' as const }}>{s.status}</span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section style={contentGridStyle(isTablet)}>
        <div style={leftColumnStyle}>
          <section style={surfaceStrongStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={sectionKickerStyle}>Watchlist</p>
                <h2 style={sectionTitleStyle}>Track extra players, teams, and leagues</h2>
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
              <div style={emptyStateStyle}>Loading your lab...</div>
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
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '20px 24px 0',
}

const secondaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 46,
  padding: '0 16px',
  borderRadius: 999,
  textDecoration: 'none',
  fontWeight: 800,
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  border: '1px solid var(--shell-panel-border)',
}

const profileLinkSectionStyle: CSSProperties = {
  margin: '0 0 18px',
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
}

const profileLinkCardStyle: CSSProperties = {
  borderRadius: 28,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
  padding: '24px',
  display: 'grid',
  gap: 18,
}

const profileHintStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 700,
}

const personalHomeTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.08rem',
  fontWeight: 900,
  lineHeight: 1.2,
}

const levelUpPanelStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
  gap: 18,
  alignItems: 'stretch',
})

const levelMeterStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background:
    'radial-gradient(circle at top right, color-mix(in srgb, var(--brand-lime) 12%, transparent) 0%, transparent 34%), var(--shell-panel-bg)',
  padding: 20,
  display: 'grid',
  gap: 16,
  boxShadow: 'var(--shadow-soft)',
}

const levelMeterHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 14,
  flexWrap: 'wrap',
}

const levelMeterTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.28rem',
  fontWeight: 950,
  lineHeight: 1.1,
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
  color: 'var(--shell-copy-muted)',
  fontWeight: 900,
  textAlign: 'right',
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
}

const levelMeterScaleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 900,
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 20,
  display: 'grid',
  gap: 14,
  boxShadow: 'var(--shadow-soft)',
}

const quickProfileTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: '1.28rem',
  fontWeight: 950,
  lineHeight: 1.1,
}

const quickProfileGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  gap: 10,
})

const quickProfileCardStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 14,
  minHeight: 78,
  display: 'grid',
  alignContent: 'center',
  gap: 6,
}

const quickProfileValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.35rem',
  fontWeight: 950,
  lineHeight: 1,
}

const todayReadPanelStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 18,
  display: 'grid',
  gap: 12,
  boxShadow: 'var(--shadow-soft)',
}

const todayReadGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
  gap: 10,
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
}

const todayReadValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.12rem',
  fontWeight: 950,
  lineHeight: 1.1,
}

const matchupSpotlightStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)',
  background:
    'radial-gradient(circle at top right, color-mix(in srgb, var(--brand-lime) 14%, transparent) 0%, transparent 34%), var(--shell-panel-bg)',
  padding: 18,
  display: 'grid',
  gap: 14,
  boxShadow: 'var(--shadow-soft)',
}

const matchupSpotlightHeroStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 14,
})

const matchupSpotlightTitleStyle: CSSProperties = {
  margin: '4px 0 8px',
  color: 'var(--foreground-strong)',
  fontSize: '1.35rem',
  lineHeight: 1.08,
  fontWeight: 950,
}

const matchupPrimaryLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 999,
  background: 'linear-gradient(135deg, var(--brand-lime), var(--brand-green))',
  color: 'var(--text-dark)',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 36%, var(--shell-panel-border) 64%)',
  textDecoration: 'none',
  fontWeight: 950,
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
  gridTemplateColumns: isTablet ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  gap: 10,
})

const matchupPreviewCardStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  display: 'grid',
  gap: 6,
  minHeight: 104,
}

const performancePanelStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 18,
  display: 'grid',
  gap: 12,
  boxShadow: 'var(--shadow-soft)',
}

const performanceGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
  gap: 12,
})

const performanceCardStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 14,
  display: 'grid',
  gridTemplateColumns: '64px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 12,
  minHeight: 104,
}

const performanceCardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 950,
  lineHeight: 1.15,
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
  background:
    'radial-gradient(circle at top right, color-mix(in srgb, var(--brand-green) 12%, transparent) 0%, transparent 34%), var(--shell-panel-bg)',
  padding: 18,
  display: 'grid',
  gap: 14,
  boxShadow: 'var(--shadow-soft)',
}

const trophyRoomGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : 'repeat(4, minmax(0, 1fr))',
  gap: 12,
})

const trophyCardStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 16,
  display: 'grid',
  gap: 8,
  minHeight: 118,
  alignContent: 'start',
}

const trophyValueStyle: CSSProperties = {
  color: 'var(--brand-lime)',
  fontSize: '1.55rem',
  fontWeight: 950,
  lineHeight: 1.05,
}

const personalCommandGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  gap: 12,
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
}

const goalProgressPanelStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 22%, var(--shell-panel-border) 78%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
  padding: 16,
  display: 'grid',
  gap: 12,
}

const compactSectionTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: '1.08rem',
  lineHeight: 1.2,
  fontWeight: 900,
}

const goalSummaryGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : 'repeat(5, minmax(0, 1fr))',
  gap: 10,
})

const goalSummaryCardStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  display: 'grid',
  gap: 6,
  minHeight: 116,
}

const goalSummaryValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  lineHeight: 1.25,
}

const recommendationCardStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
}

const recommendationTextStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.5,
  fontWeight: 800,
}

const smallGhostButtonStyle: CSSProperties = {
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  borderRadius: 999,
  minHeight: 36,
  padding: '0 13px',
  fontWeight: 900,
  cursor: 'pointer',
}

const collapsibleSummaryStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  cursor: 'pointer',
  marginBottom: 12,
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
}

const goalListStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
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
}

const goalTabActiveStyle: CSSProperties = {
  ...goalTabStyle,
  border: '1px solid color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-panel-bg) 88%)',
}

const goalEditorDetailsStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
}

const goalFooterActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
}

const miniActionLinkStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 13,
  fontWeight: 900,
  textDecoration: 'none',
}

const workshopGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.1fr) minmax(280px, 0.9fr)',
  gap: 12,
})

const workshopPanelStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 16,
  display: 'grid',
  gap: 12,
}

const workshopListStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
}

const goalAccordionListStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const goalAccordionStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
}

const goalSummaryHeaderStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
}

const goalEditorStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 14,
}

const workshopMatchRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: 10,
  alignItems: 'center',
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: '10px 12px',
}

const workshopContextRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: '10px 12px',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
}

const workshopRowTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const workshopRowMetaStyle: CSSProperties = {
  marginTop: 3,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const matchupSuggestionStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: '10px 12px',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
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
}

const saveNotebookButtonStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'linear-gradient(135deg, var(--brand-green) 0%, #4ade80 100%)',
  color: 'var(--text-dark)',
  borderRadius: 999,
  minHeight: 38,
  padding: '0 14px',
  fontWeight: 900,
  cursor: 'pointer',
}

const goalFieldGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  gap: 12,
})

const metricLabelStyle: CSSProperties = {
  color: 'var(--muted)',
  fontSize: '0.82rem',
  marginBottom: 6,
  fontWeight: 700,
}

const metricNoteStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.5,
  fontSize: '.92rem',
  marginTop: 6,
}

const contentGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.4fr) minmax(320px, 0.9fr)',
  gap: 18,
  marginTop: 18,
})

const leftColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
}

const rightColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
}

const surfaceStrongStyle: CSSProperties = {
  borderRadius: 28,
  padding: 20,
  border: '1px solid var(--shell-panel-border)',
  background:
    'radial-gradient(circle at top right, color-mix(in srgb, var(--brand-green) 10%, transparent) 0%, transparent 34%), var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
}

const surfaceStyle: CSSProperties = {
  borderRadius: 28,
  padding: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
  marginBottom: 16,
}

const sectionTitleClusterStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 14,
  minWidth: 0,
}

const sectionKickerStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontWeight: 800,
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: 0,
}

const sectionTitleStyle: CSSProperties = {
  margin: '8px 0',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: 28,
  letterSpacing: '-0.04em',
  lineHeight: 1.1,
}

const sectionTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  maxWidth: 780,
}

const searchPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
}

const inputWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const labelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
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
}

const searchResultItemStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: 14,
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const searchResultTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
}

const searchResultMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  marginTop: 4,
}

const primaryMiniButtonStyle: CSSProperties = {
  minHeight: 34,
  borderRadius: 999,
  padding: '0 12px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 30%, var(--shell-panel-border) 70%)',
  background: 'linear-gradient(135deg, var(--brand-green) 0%, #4ade80 100%)',
  color: 'var(--text-dark)',
  fontWeight: 800,
  cursor: 'pointer',
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
})

const feedTopRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginBottom: 10,
}

const feedTimeStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
}

const feedTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: 20,
  lineHeight: 1.2,
}

const feedBodyStyle: CSSProperties = {
  margin: '10px 0 0 0',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
}

const feedMetaRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 14,
}

const feedLinkStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontWeight: 800,
  textDecoration: 'none',
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
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
}

const collectionsStackStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
}

const manageFollowsHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  paddingTop: 4,
}

const supportTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 18,
  fontWeight: 900,
}

const supportTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
}

const summaryCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const summaryValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: 26,
  lineHeight: 1.1,
}

const insightStackStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 14,
}

const insightCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const insightTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  marginBottom: 6,
}

const insightTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
}

const followListStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
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
}

const followNameStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
}

const followMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  marginTop: 4,
}

