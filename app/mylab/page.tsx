'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import React from 'react'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import SiteShell from '@/app/components/site-shell'
import UpgradePrompt from '@/app/components/upgrade-prompt'
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
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { formatRating, cleanText } from '@/lib/captain-formatters'

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

type ProfileLinkRow = {
  linked_player_id: string | null
  linked_player_name: string | null
  linked_team_name: string | null
  linked_league_name: string | null
  linked_flight: string | null
}

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

type LabSignal = {
  label: string
  value: string
  note: string
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

const LOCAL_FOLLOW_KEY = 'tenaceiq-my-lab-follows-v2'

const LAB_SIGNALS: LabSignal[] = [
  {
    label: 'What happened',
    value: 'Feed',
    note: 'Match, rating, TIQ, and follow activity in one stream.',
  },
  {
    label: 'What to watch',
    value: 'Collections',
    note: 'Players, teams, leagues, and TIQ entries stay close.',
  },
  {
    label: 'What to do next',
    value: 'Insight',
    note: 'Follow the action and spot the next move faster.',
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
  const [playersHovered, setPlayersHovered] = useState(false)
  const [teamsHovered, setTeamsHovered] = useState(false)
  const [leaguesHovered, setLeaguesHovered] = useState(false)
  const [savedToCloud, setSavedToCloud] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const access = useMemo(() => buildProductAccessState(role, null), [role])

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
      userId
        ? supabase
            .from('profiles')
            .select('linked_player_id,linked_player_name,linked_team_name,linked_league_name,linked_flight')
            .eq('id', userId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
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
    if (!profileLinkRes.error && profileLinkRes.data) {
      const nextProfileLink = profileLinkRes.data as ProfileLinkRow
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

  async function saveProfileTeamLink() {
    if (!userId) {
      setProfileLinkMessage('Sign in to link your player and team.')
      return
    }

    const selectedPlayer = players.find((player) => player.id === selectedPlayerLinkId) ?? null
    const selectedTeam = selectedTeamLinkId ? parseTeamEntityId(selectedTeamLinkId) : null

    setSavingProfileLink(true)
    setProfileLinkMessage('')

    const payload = {
      linked_player_id: selectedPlayer?.id || null,
      linked_player_name: selectedPlayer?.name || null,
      linked_team_name: selectedTeam?.teamName || null,
      linked_league_name: selectedTeam?.leagueName || null,
      linked_flight: selectedTeam?.flight || null,
      linked_team_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)

    setSavingProfileLink(false)

    if (updateError) {
      setProfileLinkMessage(updateError.message)
      return
    }

    setProfileLink({
      linked_player_id: payload.linked_player_id,
      linked_player_name: payload.linked_player_name,
      linked_team_name: payload.linked_team_name,
      linked_league_name: payload.linked_league_name,
      linked_flight: payload.linked_flight,
    })
    setProfileLinkMessage('Your player and team links were saved.')
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
        body: 'Build your lab so your feed can surface match results, lineup activity, rating movement, and community-style updates tied to the entities you care about most.',
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

  const followedPlayers = follows.filter((item) => item.entity_type === 'player')
  const followedTeams = follows.filter((item) => item.entity_type === 'team')
  const followedLeagues = follows.filter((item) => item.entity_type === 'league')

  const heroStats = [
    {
      label: 'Following',
      value: String(follows.length),
      note: 'Players, teams, and leagues in your lab',
    },
    {
      label: 'Feed items',
      value: String(feed.length),
      note: 'Personalized updates across your network',
    },
    {
      label: 'Cloud sync',
      value: savedToCloud ? 'On' : 'Device',
      note: savedToCloud ? 'Saved across sessions' : 'Saved on this device',
    },
    {
      label: 'TIQ individual',
      value: String(followedTiqIndividualParticipations.length),
      note: 'Tracked TIQ player-league entries',
    },
  ]

  const dynamicHeroRailCardStyle: CSSProperties = {
    ...heroRailCardStyle,
    position: 'relative',
    overflow: 'hidden',
    background: 'var(--shell-panel-bg)',
  }

  const heroRailContentStyle: CSSProperties = {
    position: 'relative',
    zIndex: 2,
  }

  const heroRailHighlights = [
    {
      label: 'Tracked',
      value: String(follows.length),
      text: 'Your watchlist.',
    },
    {
      label: 'Feed ready',
      value: String(feed.length),
      text: 'Updates in one stream.',
    },
    {
      label: 'Best fit',
      value: access.canUseAdvancedPlayerInsights ? 'Player+' : 'Free',
      text: access.canUseAdvancedPlayerInsights
        ? 'Player insight unlocked.'
        : 'Upgrade for deeper answers.',
    },
  ]

  return (
    <section style={pageStyle}>
      <section style={heroStyle(isTablet, isMobile)}>
        <div>
          <div style={eyebrowStyle}>My Lab</div>
          <h1 style={heroTitleStyle(isSmallMobile, isMobile)}>Your tennis intelligence hub</h1>
          <p style={heroTextStyle}>
            Follow players, teams, and leagues. Get a personal feed for the tennis you care about.
          </p>

          <div style={heroButtonRowStyle}>
            <Link
              href="/explore/players"
              onMouseEnter={() => setPlayersHovered(true)}
              onMouseLeave={() => setPlayersHovered(false)}
              style={{
                ...primaryButtonStyle,
                transform: playersHovered ? 'translateY(-2px)' : 'none',
                boxShadow: playersHovered
                  ? '0 20px 40px rgba(74,222,128,0.22)'
                  : '0 16px 32px rgba(74,222,128,0.14)',
                transition: 'transform 140ms ease, box-shadow 140ms ease',
              }}
            >
              Find players
            </Link>
            <Link
              href="/explore/teams"
              onMouseEnter={() => setTeamsHovered(true)}
              onMouseLeave={() => setTeamsHovered(false)}
              style={{
                ...secondaryButtonStyle,
                border: teamsHovered
                  ? '1px solid color-mix(in srgb, var(--brand-blue-2) 30%, var(--shell-panel-border) 70%)'
                  : secondaryButtonStyle.border,
                transform: teamsHovered ? 'translateY(-2px)' : 'none',
                transition: 'all 140ms ease',
              }}
            >
              Browse teams
            </Link>
            <Link
              href="/explore/leagues"
              onMouseEnter={() => setLeaguesHovered(true)}
              onMouseLeave={() => setLeaguesHovered(false)}
              style={{
                ...secondaryButtonStyle,
                border: leaguesHovered
                  ? '1px solid color-mix(in srgb, var(--brand-blue-2) 30%, var(--shell-panel-border) 70%)'
                  : secondaryButtonStyle.border,
                transform: leaguesHovered ? 'translateY(-2px)' : 'none',
                transition: 'all 140ms ease',
              }}
            >
              Explore leagues
            </Link>
          </div>

          <div style={metricGridStyle(isSmallMobile)}>
            {heroStats.map((stat) => (
              <div key={stat.label} style={metricCardStyle}>
                <div style={metricLabelStyle}>{stat.label}</div>
                <div style={metricValueStyle}>{stat.value}</div>
                <div style={metricNoteStyle}>{stat.note}</div>
              </div>
              ))}
          </div>

          {tiqPlayerParticipationWarning ? (
            <div
              style={{
                marginTop: 18,
                padding: '14px 16px',
                borderRadius: 16,
                border: '1px solid var(--shell-panel-border)',
                background: 'var(--shell-chip-bg)',
                color: 'var(--shell-copy-muted)',
                lineHeight: 1.6,
                fontSize: 13,
              }}
            >
              TIQ participation note: 
              {tiqPlayerParticipationWarning}
            </div>
          ) : null}
        </div>

        <div style={dynamicHeroRailCardStyle}>
          <div style={labRailGlowStyle} />
          <div style={labRailGridStyle} />

          <div style={heroRailContentStyle}>
            <p style={sectionKickerStyle}>Why use it</p>
            <h2 style={sideTitleStyle}>Your watchlist, cleaned up</h2>
            <div style={workflowListStyle}>
              {[
                ['Follow', 'Track players, teams, and leagues.'],
                ['Watch', 'See match and rating movement.'],
                ['Act', 'Open the right page when something changes.'],
              ].map(([title, text]) => (
                <div key={title} style={workflowRowStyle}>
                  <div style={workflowDotStyle} />
                  <div>
                    <div style={workflowTitleStyle}>{title}</div>
                    <div style={workflowTextStyle}>{text}</div>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                gap: 12,
                marginTop: 18,
              }}
            >
              {heroRailHighlights.map((item) => (
                <div key={item.label} style={labRailMiniCardStyle}>
                  <div style={labRailMiniLabelStyle}>{item.label}</div>
                  <div style={labRailMiniValueStyle}>{item.value}</div>
                  <div style={labRailMiniTextStyle}>{item.text}</div>
                </div>
              ))}
            </div>

            <div style={labRailBoardStyle}>
              <div style={labRailBoardHeaderStyle}>
                <span style={pillSlateStyle}>Watchlist</span>
                <span style={pillBlueStyle}>Feed</span>
              </div>

              <div style={labRailBoardRowsStyle}>
                <div style={labRailBoardRowStyle}>
                  <div>
                    <div style={labRailBoardTitleStyle}>Tracked players</div>
                    <div style={labRailBoardTextStyle}>Follow performance, movement, and match activity.</div>
                  </div>
                  <span style={pillGreenStyle}>{followedPlayers.length}</span>
                </div>
                <div style={labRailBoardRowStyle}>
                  <div>
                    <div style={labRailBoardTitleStyle}>Tracked teams</div>
                    <div style={labRailBoardTextStyle}>Keep an eye on roster context and weekly motion.</div>
                  </div>
                  <span style={pillBlueStyle}>{followedTeams.length}</span>
                </div>
                <div style={labRailBoardRowStyle}>
                  <div>
                    <div style={labRailBoardTitleStyle}>Tracked leagues</div>
                    <div style={labRailBoardTextStyle}>Separate official status from TIQ internal competition.</div>
                  </div>
                  <span style={pillSlateStyle}>{followedLeagues.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={labSignalGridStyle(isMobile)}>
        {LAB_SIGNALS.map((signal) => (
          <div key={signal.label} style={labSignalCardStyle}>
            <div style={labSignalLabelStyle}>{signal.label}</div>
            <div style={labSignalValueStyle}>{signal.value}</div>
            <div style={labSignalNoteStyle}>{signal.note}</div>
          </div>
        ))}
      </section>

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 20px' }}>
        <div style={{ borderRadius: 20, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)', padding: '18px 20px', display: 'grid', gap: 14 }}>
          <div style={sectionHeaderStyle}>
            <div>
              <p style={sectionKickerStyle}>Profile links</p>
              <h2 style={sectionTitleStyle}>Connect yourself to a player and team</h2>
              <p style={sectionTextStyle}>
                This tells TenAceIQ which player profile and roster context belong to your account.
              </p>
            </div>
            <span style={profileLink?.linked_team_name || profileLink?.linked_player_name ? pillGreenStyle : pillSlateStyle}>
              {profileLink?.linked_team_name || profileLink?.linked_player_name ? 'Linked' : 'Not linked'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={labelStyle}>Player profile</span>
              <select value={selectedPlayerLinkId} onChange={(event) => setSelectedPlayerLinkId(event.target.value)} style={inputStyle}>
                <option value="">Select your player profile</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}{player.location ? ` - ${player.location}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={labelStyle}>Team roster</span>
              <select value={selectedTeamLinkId} onChange={(event) => setSelectedTeamLinkId(event.target.value)} style={inputStyle}>
                <option value="">Select your team</option>
                {teamSummaries.map((team) => (
                  <option key={team.id} value={team.id}>
                    {[team.name, team.league, team.flight].filter(Boolean).join(' - ')}
                  </option>
                ))}
              </select>
            </label>

            <button type="button" onClick={saveProfileTeamLink} disabled={savingProfileLink || !userId} style={primaryButtonStyle}>
              {savingProfileLink ? 'Saving...' : 'Save links'}
            </button>
          </div>

          {profileLinkMessage ? (
            <div style={{ color: profileLinkMessage.includes('saved') ? '#bbf7d0' : '#fecaca', fontSize: 13, fontWeight: 800 }}>
              {profileLinkMessage}
            </div>
          ) : null}
        </div>
      </section>

      {followedPlayerSignals.length > 0 ? (
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 20px' }}>
          <div style={{ borderRadius: 20, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)', padding: '18px 20px' }}>
            <div style={{ color: '#93c5fd', fontWeight: 800, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 14 }}>
              Signals — followed players
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
                <p style={sectionKickerStyle}>Build your lab</p>
                <h2 style={sectionTitleStyle}>Follow players, teams, and leagues</h2>
                <p style={sectionTextStyle}>
                  Find players, teams, and leagues to follow.
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
                <p style={sectionKickerStyle}>Personal feed</p>
                <h2 style={sectionTitleStyle}>What's happening around your network</h2>
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
                {feed.map((item) => (
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
                <p style={sectionKickerStyle}>Collections</p>
                <h2 style={sectionTitleStyle}>Your followed entities</h2>
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
                  <div style={supportTextStyle}>Remove anything you no longer want in your feed.</div>
                </div>
                <FollowList items={follows} onRemove={removeFollow} />
              </div>
            ) : null}

            {selectedTab === 'players' ? <FollowList items={followedPlayers} onRemove={removeFollow} /> : null}
            {selectedTab === 'teams' ? <FollowList items={followedTeams} onRemove={removeFollow} /> : null}
            {selectedTab === 'leagues' ? <FollowList items={followedLeagues} onRemove={removeFollow} /> : null}

            {selectedTab === 'feed' ? (
              <div style={insightStackStyle}>
                {!access.canUseAdvancedPlayerInsights ? (
                  <UpgradePrompt
                    planId="player_plus"
                    compact
                    headline="Want to know where you should play?"
                    body="Unlock Player+ to turn your feed and tracked activity into clearer lineup-fit reads, opponent context, and personal performance direction."
                    ctaLabel="Unlock Player+"
                    ctaHref="/pricing"
                    secondaryLabel="See Player+ plan"
                    secondaryHref="/pricing"
                    footnote="Best for players who want more than match history and want clearer direction from their data."
                  />
                ) : null}
                <InsightCard
                  title="Why it matters"
                  text="Your follows become a quick read on the players, teams, and leagues that matter most."
                />
                <InsightCard
                  title="Best next upgrade"
                  text="Player+ adds deeper player reads, lineup fit, opponent context, and projections."
                />
                <InsightCard
                  title="Individual competition pulse"
                  text={`${followedTiqIndividualParticipations.length} followed TIQ individual ${followedTiqIndividualParticipations.length === 1 ? 'entry' : 'entries'}.`}
                />
                <InsightCard
                  title="Best TIQ next action"
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
  padding: '18px 24px 0',
}

const heroStyle = (isTablet: boolean, isMobile: boolean): CSSProperties => ({
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.45fr) minmax(320px, 0.92fr)',
  gap: isMobile ? 18 : 24,
  padding: isMobile ? '26px 18px' : '34px 26px',
  borderRadius: 34,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
})

const eyebrowStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 38,
  padding: '8px 14px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--home-eyebrow-color)',
  fontWeight: 800,
  fontSize: 14,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 8,
}

const heroTitleStyle = (isSmallMobile: boolean, isMobile: boolean): CSSProperties => ({
  margin: 0,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  lineHeight: 0.98,
  letterSpacing: '-0.055em',
  maxWidth: 760,
  fontSize: isSmallMobile ? 34 : isMobile ? 42 : 50,
})

const heroTextStyle: CSSProperties = {
  marginTop: 16,
  marginBottom: 0,
  maxWidth: 840,
  color: 'var(--shell-copy-muted)',
  fontSize: '1.02rem',
  lineHeight: 1.72,
}

const heroButtonRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 22,
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 46,
  padding: '0 16px',
  borderRadius: 999,
  textDecoration: 'none',
  fontWeight: 800,
  background: 'linear-gradient(135deg, var(--brand-green) 0%, #4ade80 100%)',
  color: 'var(--text-dark)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 30%, var(--shell-panel-border) 70%)',
  boxShadow: '0 16px 32px color-mix(in srgb, var(--brand-green) 16%, transparent)',
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

const metricGridStyle = (isSmallMobile: boolean): CSSProperties => ({
  marginTop: 22,
  display: 'grid',
  gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  gap: 14,
})

const labSignalGridStyle = (isMobile: boolean): CSSProperties => ({
  marginTop: 18,
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  gap: 14,
})

const labSignalCardStyle: CSSProperties = {
  borderRadius: 24,
  padding: '18px 18px 16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  boxShadow: 'var(--shadow-soft)',
}

const labSignalLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const labSignalValueStyle: CSSProperties = {
  marginTop: 10,
  color: 'var(--foreground-strong)',
  fontSize: '1.35rem',
  fontWeight: 900,
  letterSpacing: '-0.03em',
  lineHeight: 1.1,
}

const labSignalNoteStyle: CSSProperties = {
  marginTop: 8,
  color: 'var(--shell-copy-muted)',
  fontSize: '.94rem',
  lineHeight: 1.6,
}

const metricCardStyle: CSSProperties = {
  borderRadius: 22,
  padding: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const metricLabelStyle: CSSProperties = {
  color: 'var(--muted)',
  fontSize: '0.82rem',
  marginBottom: 6,
  fontWeight: 700,
}

const metricValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.55rem',
  fontWeight: 900,
  lineHeight: 1.1,
}

const metricNoteStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.5,
  fontSize: '.92rem',
  marginTop: 6,
}

const heroRailCardStyle: CSSProperties = {
  borderRadius: 28,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 20,
}

const labRailGlowStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at 78% 18%, rgba(155,225,29,0.18) 0%, rgba(155,225,29,0.06) 22%, rgba(155,225,29,0) 54%), radial-gradient(circle at 18% 78%, rgba(116,190,255,0.16) 0%, rgba(116,190,255,0.06) 20%, rgba(116,190,255,0) 48%)',
  pointerEvents: 'none',
}

const labRailGridStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(var(--page-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--page-grid-line) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
  opacity: 0.16,
  pointerEvents: 'none',
}

const labRailMiniCardStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: '14px 14px 13px',
  boxShadow: 'var(--shadow-soft)',
  display: 'grid',
  gap: 8,
}

const labRailMiniLabelStyle: CSSProperties = {
  color: 'var(--muted)',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const labRailMiniValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 24,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const labRailMiniTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.6,
}

const labRailBoardStyle: CSSProperties = {
  marginTop: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 16,
  boxShadow: 'var(--shadow-soft)',
}

const labRailBoardHeaderStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
}

const labRailBoardRowsStyle: CSSProperties = {
  marginTop: 14,
  display: 'grid',
  gap: 10,
}

const labRailBoardRowStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: '14px 14px 13px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
}

const labRailBoardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.3,
}

const labRailBoardTextStyle: CSSProperties = {
  marginTop: 6,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.6,
}

const sideTitleStyle: CSSProperties = {
  marginTop: 10,
  marginBottom: 14,
  fontSize: '1.35rem',
  lineHeight: 1.14,
  color: 'var(--foreground-strong)',
}

const workflowListStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const workflowRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
}

const workflowDotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  marginTop: 7,
  background: 'linear-gradient(135deg, var(--brand-green) 0%, #4ade80 100%)',
  flexShrink: 0,
}

const workflowTitleStyle: CSSProperties = {
  fontWeight: 700,
  color: 'var(--foreground-strong)',
  marginBottom: 4,
}

const workflowTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.55,
  fontSize: '.95rem',
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

