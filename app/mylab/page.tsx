'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import { supabase } from '@/lib/supabase'

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
}

type MatchRow = {
  id: string
  match_date: string | null
  score: string | null
  flight: string | null
  league_name: string | null
  home_team: string | null
  away_team: string | null
  winner_side: string | null
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

const LOCAL_FOLLOW_KEY = 'tenaceiq-my-lab-follows-v2'

function cleanText(value: string | null | undefined): string | null {
  const text = (value || '').trim()
  return text.length ? text : null
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

function formatRating(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(2) : '—'
}

function accentForType(type: FeedType): FeedItem['accent'] {
  if (type === 'achievement' || type === 'rating') return 'green'
  if (type === 'community') return 'violet'
  return 'blue'
}

function buildTeamEntityId(teamName: string, leagueName?: string | null, flight?: string | null) {
  return `${teamName.trim()}__${cleanText(leagueName) || ''}__${cleanText(flight) || ''}`
}

function buildLeagueEntityId(
  leagueName: string,
  flight?: string | null,
  section?: string | null,
  district?: string | null,
) {
  return `${leagueName.trim()}__${cleanText(flight) || ''}__${cleanText(section) || ''}__${cleanText(district) || ''}`
}

function parseTeamEntityId(entityId: string) {
  const [teamName = '', leagueName = '', flight = ''] = entityId.split('__')
  return {
    teamName,
    leagueName: leagueName || '',
    flight: flight || '',
  }
}

function parseLeagueEntityId(entityId: string) {
  const [leagueName = '', flight = '', section = '', district = ''] = entityId.split('__')
  return {
    leagueName,
    flight,
    section,
    district,
  }
}

function buildTeamHrefFromEntityId(entityId: string) {
  const { teamName, leagueName, flight } = parseTeamEntityId(entityId)
  const params = new URLSearchParams()
  if (leagueName) params.set('league', leagueName)
  if (flight) params.set('flight', flight)
  const query = params.toString()
  return `/teams/${encodeURIComponent(teamName)}${query ? `?${query}` : ''}`
}

function buildLeagueHrefFromEntityId(entityId: string) {
  const { leagueName, flight, section, district } = parseLeagueEntityId(entityId)
  const params = new URLSearchParams()
  if (flight) params.set('flight', flight)
  if (section) params.set('section', section)
  if (district) params.set('district', district)
  const query = params.toString()
  return `/leagues/${encodeURIComponent(leagueName)}${query ? `?${query}` : ''}`
}

export default function MyLabPage() {
  return (
    <SiteShell active="/mylab">
      <MyLabPageInner />
    </SiteShell>
  )
}

function MyLabPageInner() {
  const { userId, authResolved } = useAuth()

  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayerRow[]>([])
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([])
  const [cloudFeedRows, setCloudFeedRows] = useState<MyLabFeedRow[]>([])
  const [follows, setFollows] = useState<FollowItem[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | EntityType>('all')
  const [feedFilter, setFeedFilter] = useState<'all' | FeedType>('all')
  const [selectedTab, setSelectedTab] = useState<'feed' | 'players' | 'teams' | 'leagues'>('feed')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedToCloud, setSavedToCloud] = useState(false)
  const [screenWidth, setScreenWidth] = useState(1280)

  useEffect(() => {
    const onResize = () => setScreenWidth(window.innerWidth)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const isTablet = screenWidth < 1080
  const isMobile = screenWidth < 820
  const isSmallMobile = screenWidth < 560

  useEffect(() => {
    if (!authResolved) return

    let mounted = true

    async function load() {
      setLoading(true)
      setError(null)

      const local = readLocalFollows()
      if (mounted) setFollows(local)

      const [playersRes, matchesRes, matchPlayersRes, scenariosRes, followsRes, cloudFeedRes] =
        await Promise.all([
          supabase
            .from('players')
            .select(
              'id,name,location,flight,singles_dynamic_rating,doubles_dynamic_rating,overall_dynamic_rating',
            )
            .order('name', { ascending: true }),
          supabase
            .from('matches')
            .select('id,match_date,score,flight,league_name,home_team,away_team,winner_side')
            .order('match_date', { ascending: false })
            .limit(160),
          supabase.from('match_players').select('match_id,player_id,side,seat').limit(1200),
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
        ])

      if (!mounted) return

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
    }

    void load()

    return () => {
      mounted = false
    }
  }, [authResolved, userId])

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
      if (!home || !away) continue

      const homeKey = buildTeamEntityId(home, league, flight)
      const awayKey = buildTeamEntityId(away, league, flight)

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
      if (!leagueName) continue

      const id = buildLeagueEntityId(leagueName, flight, null, null)
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: leagueName,
          flight,
          section: null,
          district: null,
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

  const searchOptions = useMemo<SearchOption[]>(() => {
    const playerOptions = players.slice(0, 300).map((player) => ({
      id: player.id,
      type: 'player' as const,
      name: player.name,
      subtitle:
        [cleanText(player.location), cleanText(player.flight)].filter(Boolean).join(' • ') || null,
    }))

    const teamOptions = teamSummaries.slice(0, 200).map((team) => ({
      id: team.id,
      type: 'team' as const,
      name: team.name,
      subtitle: [team.league, team.flight].filter(Boolean).join(' • ') || null,
    }))

    const leagueOptions = leagueSummaries.slice(0, 120).map((league) => ({
      id: league.id,
      type: 'league' as const,
      name: league.name,
      subtitle: [league.flight, league.section, league.district].filter(Boolean).join(' • ') || null,
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
        body: `Current overall dynamic rating: ${formatRating(player.overall_dynamic_rating)}. Singles: ${formatRating(player.singles_dynamic_rating)}. Doubles: ${formatRating(player.doubles_dynamic_rating)}.`,
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
      const homeTeam = cleanText(match.home_team)
      const awayTeam = cleanText(match.away_team)

      const homeTeamId = homeTeam ? buildTeamEntityId(homeTeam, leagueName, flight) : null
      const awayTeamId = awayTeam ? buildTeamEntityId(awayTeam, leagueName, flight) : null
      const leagueId = leagueName ? buildLeagueEntityId(leagueName, flight, null, null) : null

      const containsFollowedTeam = followTeams.some(
        (f) => f.entity_id === homeTeamId || f.entity_id === awayTeamId,
      )
      const containsFollowedLeague = followLeagues.some((f) => f.entity_id === leagueId)

      if (!containsFollowedPlayer && !containsFollowedTeam && !containsFollowedLeague) continue

      const spotlightPlayers = playersInMatch
        .slice(0, 4)
        .map((mp) => playerMap.get(mp.player_id)?.name)
        .filter(Boolean) as string[]

      items.push({
        id: `match-${match.id}`,
        type: 'match',
        title: `${homeTeam || 'Team A'} vs ${awayTeam || 'Team B'}`,
        body: `${leagueName || 'League match'}${flight ? ` • ${flight}` : ''}. Score: ${match.score || 'Pending'}. Players: ${spotlightPlayers.join(', ') || 'Lineups unavailable'}.`,
        entityType: containsFollowedLeague ? 'league' : containsFollowedTeam ? 'team' : 'player',
        entityId: containsFollowedLeague
          ? leagueId
          : containsFollowedTeam
            ? (followTeams.find((f) => f.entity_id === homeTeamId || f.entity_id === awayTeamId)
                ?.entity_id ?? null)
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
      const scenarioTeamId = scenarioTeamName
        ? buildTeamEntityId(scenarioTeamName, scenarioLeagueName, scenarioFlight)
        : null
      const scenarioLeagueId = scenarioLeagueName
        ? buildLeagueEntityId(scenarioLeagueName, scenarioFlight, null, null)
        : null

      if (
        !followTeams.some((f) => f.entity_id === scenarioTeamId) &&
        !followLeagues.some((f) => f.entity_id === scenarioLeagueId)
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
  }, [follows, players, matches, matchPlayersByMatch, scenarios, playerMap, feedFilter, cloudFeedRows])

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
    const key = `${option.type}:${option.id}`
    if (followedIds.has(key)) return
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
      (follow) => !(follow.entity_type === item.entity_type && follow.entity_id === item.entity_id),
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
      value: savedToCloud ? 'On' : 'Local',
      note: savedToCloud ? 'Persisting to Supabase' : 'Fallback storage active',
    },
  ]

  return (
    <section style={pageStyle}>
      <section style={heroStyle(isTablet, isMobile)}>
        <div>
          <div style={eyebrowStyle}>My Lab</div>
          <h1 style={heroTitleStyle(isSmallMobile, isMobile)}>Your tennis intelligence hub</h1>
          <p style={heroTextStyle}>
            Follow the players, teams, and leagues that matter to you. My Lab turns TenAceIQ into a
            personalized member experience with a curated feed, watchlists, and community-style
            momentum around the matches you care about most.
          </p>

          <div style={heroButtonRowStyle}>
            <Link href="/players" style={primaryButtonStyle}>
              Find players
            </Link>
            <Link href="/teams" style={secondaryButtonStyle}>
              Browse teams
            </Link>
            <Link href="/leagues" style={secondaryButtonStyle}>
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
        </div>

        <div style={heroRailCardStyle}>
          <p style={sectionKickerStyle}>What makes this elite</p>
          <h2 style={sideTitleStyle}>A community layer on top of your analytics</h2>
          <div style={workflowListStyle}>
            {[
              ['Follow smarter', 'Track players, teams, and leagues in one place.'],
              ['See momentum', 'Recent matches, rating movement, lineup activity, and achievements.'],
              ['Stay connected', 'Build the foundation for future community and member engagement.'],
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
        </div>
      </section>

      <section style={contentGridStyle(isTablet)}>
        <div style={leftColumnStyle}>
          <section style={surfaceStrongStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={sectionKickerStyle}>Build your lab</p>
                <h2 style={sectionTitleStyle}>Follow players, teams, and leagues</h2>
                <p style={sectionTextStyle}>
                  Search the live data already in your app and add entities to your personal watchlist.
                </p>
              </div>
              <span style={savedToCloud ? pillGreenStyle : pillSlateStyle}>
                {savedToCloud ? 'Cloud synced' : 'Local fallback'}
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
                      const followed = followedIds.has(`${option.type}:${option.id}`)
                      return (
                        <div key={`${option.type}-${option.id}`} style={searchResultItemStyle}>
                          <div>
                            <div style={searchResultTitleStyle}>{option.name}</div>
                            <div style={searchResultMetaStyle}>
                              {option.type.toUpperCase()} {option.subtitle ? `• ${option.subtitle}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => addFollow(option)}
                            style={followed ? tabButtonStyle : primaryMiniButtonStyle}
                          >
                            {followed ? 'Following' : 'Follow'}
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
                <h2 style={sectionTitleStyle}>What’s happening around your network</h2>
              </div>
              <div style={filterRowStyle}>
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
              <div style={errorStateStyle}>Some data could not be loaded: {error}</div>
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
              </div>
            ) : null}

            {selectedTab === 'players' ? <FollowList items={followedPlayers} onRemove={removeFollow} /> : null}
            {selectedTab === 'teams' ? <FollowList items={followedTeams} onRemove={removeFollow} /> : null}
            {selectedTab === 'leagues' ? <FollowList items={followedLeagues} onRemove={removeFollow} /> : null}

            {selectedTab === 'feed' ? (
              <div style={insightStackStyle}>
                <InsightCard
                  title="Community direction"
                  text="My Lab gives members a reason to come back even when they are not actively searching. This is the surface that can later support alerts, achievements, reactions, and player-to-player community momentum."
                />
                <InsightCard
                  title="Best next upgrade"
                  text="Add a simple event writer into imports and rating recalculation so match results and rating moves automatically populate my_lab_feed for followed entities."
                />
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </section>
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
              {item.entity_type.toUpperCase()} {item.subtitle ? `• ${item.subtitle}` : ''}
            </div>
          </div>
          <button type="button" onClick={() => onRemove(item)} style={ghostMiniButtonStyle}>
            Remove
          </button>
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
  border: '1px solid rgba(116,190,255,0.18)',
  background:
    'linear-gradient(135deg, rgba(14,39,82,0.88) 0%, rgba(11,30,64,0.90) 52%, rgba(8,27,56,0.92) 100%)',
  boxShadow: '0 28px 80px rgba(3, 10, 24, 0.30)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
})

const eyebrowStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 38,
  padding: '8px 14px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.12)',
  color: '#d9e7ef',
  fontWeight: 800,
  fontSize: 14,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 8,
}

const heroTitleStyle = (isSmallMobile: boolean, isMobile: boolean): CSSProperties => ({
  margin: 0,
  color: '#f7fbff',
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
  color: 'rgba(231,239,251,0.78)',
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
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  color: '#071622',
  border: '1px solid rgba(155,225,29,0.34)',
  boxShadow: '0 16px 32px rgba(74, 222, 128, 0.14)',
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
  background: 'linear-gradient(180deg, rgba(58,115,212,0.18) 0%, rgba(27,62,120,0.14) 100%)',
  color: '#ebf1fd',
  border: '1px solid rgba(116,190,255,0.18)',
}

const metricGridStyle = (isSmallMobile: boolean): CSSProperties => ({
  marginTop: 22,
  display: 'grid',
  gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  gap: 14,
})

const metricCardStyle: CSSProperties = {
  borderRadius: 22,
  padding: 16,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.16) 0%, rgba(20,43,86,0.34) 100%)',
}

const metricLabelStyle: CSSProperties = {
  color: 'rgba(225,236,250,0.72)',
  fontSize: '0.82rem',
  marginBottom: 6,
  fontWeight: 700,
}

const metricValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '1.55rem',
  fontWeight: 900,
  lineHeight: 1.1,
}

const metricNoteStyle: CSSProperties = {
  color: 'rgba(231,239,251,0.72)',
  lineHeight: 1.5,
  fontSize: '.92rem',
  marginTop: 6,
}

const heroRailCardStyle: CSSProperties = {
  borderRadius: 28,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(29,56,105,0.62), rgba(14,30,59,0.78))',
  padding: 20,
}

const sideTitleStyle: CSSProperties = {
  marginTop: 10,
  marginBottom: 14,
  fontSize: '1.35rem',
  lineHeight: 1.14,
  color: '#ffffff',
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
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  flexShrink: 0,
}

const workflowTitleStyle: CSSProperties = {
  fontWeight: 700,
  color: '#ffffff',
  marginBottom: 4,
}

const workflowTextStyle: CSSProperties = {
  color: 'rgba(231,239,251,0.72)',
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
  border: '1px solid rgba(116,190,255,0.16)',
  background:
    'radial-gradient(circle at top right, rgba(155,225,29,0.10), transparent 34%), linear-gradient(135deg, rgba(13,42,90,0.82) 0%, rgba(8,27,59,0.90) 58%, rgba(7,30,62,0.94) 100%)',
  boxShadow: '0 24px 60px rgba(2, 8, 23, 0.24)',
}

const surfaceStyle: CSSProperties = {
  borderRadius: 28,
  padding: 20,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.14) 0%, rgba(16,34,70,0.42) 100%)',
  boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
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
  color: '#8fb7ff',
  fontWeight: 800,
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: 0,
}

const sectionTitleStyle: CSSProperties = {
  margin: '8px 0',
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: 28,
  letterSpacing: '-0.04em',
  lineHeight: 1.1,
}

const sectionTextStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(224,234,247,0.76)',
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
  color: 'rgba(198,216,248,0.84)',
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const inputStyle: CSSProperties = {
  width: '100%',
  height: 48,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#f8fbff',
  padding: '0 14px',
  fontSize: 14,
  outline: 'none',
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
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.05)',
  color: '#dfe8f8',
  fontWeight: 700,
  cursor: 'pointer',
}

const tabActiveStyle: CSSProperties = {
  ...tabButtonStyle,
  background: 'linear-gradient(135deg, rgba(155,225,29,0.18) 0%, rgba(74,222,128,0.18) 100%)',
  color: '#f3ffe8',
  border: '1px solid rgba(155,225,29,0.28)',
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
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
}

const searchResultTitleStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 800,
}

const searchResultMetaStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: 13,
  marginTop: 4,
}

const primaryMiniButtonStyle: CSSProperties = {
  minHeight: 34,
  borderRadius: 999,
  padding: '0 12px',
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  color: '#071622',
  fontWeight: 800,
  cursor: 'pointer',
}

const ghostMiniButtonStyle: CSSProperties = {
  minHeight: 34,
  borderRadius: 999,
  padding: '0 12px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.05)',
  color: '#dfe8f8',
  fontWeight: 700,
  cursor: 'pointer',
}

const emptyInlineStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  padding: 12,
  borderRadius: 16,
  border: '1px dashed rgba(255,255,255,0.10)',
}

const emptyStateStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  padding: 18,
  borderRadius: 18,
  border: '1px dashed rgba(255,255,255,0.10)',
}

const errorStateStyle: CSSProperties = {
  color: '#fecaca',
  padding: 18,
  borderRadius: 18,
  border: '1px solid rgba(248,113,113,0.20)',
  background: 'rgba(127,29,29,0.18)',
}

const feedListStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
}

const feedCardStyle = (accent: FeedItem['accent']): CSSProperties => ({
  borderRadius: 22,
  padding: 18,
  border: '1px solid rgba(255,255,255,0.08)',
  background:
    accent === 'green'
      ? 'linear-gradient(180deg, rgba(97,160,69,0.14) 0%, rgba(16,34,70,0.42) 100%)'
      : accent === 'violet'
        ? 'linear-gradient(180deg, rgba(119,98,255,0.14) 0%, rgba(16,34,70,0.42) 100%)'
        : 'linear-gradient(180deg, rgba(58,115,212,0.14) 0%, rgba(16,34,70,0.42) 100%)',
})

const feedTopRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginBottom: 10,
}

const feedTimeStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.68)',
  fontSize: 13,
}

const feedTitleStyle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: 20,
  lineHeight: 1.2,
}

const feedBodyStyle: CSSProperties = {
  margin: '10px 0 0 0',
  color: 'rgba(231,239,251,0.76)',
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
  color: '#cfe1ff',
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
  background: 'rgba(255,255,255,0.08)',
  color: '#dfe8f8',
}

const pillGreenStyle: CSSProperties = {
  ...pillSlateStyle,
  background: 'rgba(155,225,29,0.14)',
  color: '#e7ffd1',
}

const pillBlueStyle: CSSProperties = {
  ...pillSlateStyle,
  background: 'rgba(37,91,227,0.16)',
  color: '#c7dbff',
}

const pillVioletStyle: CSSProperties = {
  ...pillSlateStyle,
  background: 'rgba(119,98,255,0.18)',
  color: '#ddd7ff',
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

const summaryCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 14,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
}

const summaryValueStyle: CSSProperties = {
  color: '#f8fbff',
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
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
}

const insightTitleStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 800,
  marginBottom: 6,
}

const insightTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
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
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
}

const followNameStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 800,
}

const followMetaStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: 13,
  marginTop: 4,
}