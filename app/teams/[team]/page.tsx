'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import React from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { buildCaptainScopedHref } from '@/lib/captain-memory'
import {
  buildExploreLeagueHref,
  getCompetitionLayerLabel,
  inferCompetitionLayerFromValues,
} from '@/lib/competition-layers'
import { buildScopedTeamEntityId } from '@/lib/entity-ids'
import { supabase } from '@/lib/supabase'
import { buildTeamProfileHref, decodeTeamRouteSegment } from '@/lib/team-routes'
import {
  listTiqTeamParticipations,
  type TiqLeagueStorageSource,
  type TiqTeamParticipationRecord,
} from '@/lib/tiq-league-service'
import SiteShell from '@/app/components/site-shell'
import QuickMessageComposer from '@/app/components/quick-message-composer'
import EntityDetailLink from '@/app/components/entity-detail-link'
import DataTrustPanel from '@/app/components/data-trust-panel'
import PublicDetailState from '@/app/components/public-detail-state'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
import FollowButton from '@/app/components/follow-button'
import MatchAccuracyReportButton from '@/app/components/match-accuracy-report-button'
import { formatDate, formatRating, cleanText, normalizeTeamName } from '@/lib/captain-formatters'
import {
  getReportStatusLabel,
  listMyMatchAccuracyReports,
  type MatchAccuracyReport,
} from '@/lib/match-accuracy-reports'
import { CAPTAIN_STORY, DATA_ASSIST_STORY } from '@/lib/product-story'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { loadUserProfileLink } from '@/lib/user-profile'
import { loadRecentTiqAwards, type TiqAwardRecord } from '@/lib/tiq-awards-registry'
import { buildTeamRoomHref } from '@/lib/team-room'
import { fetchTeamConnections } from '@/lib/team-profile-links-client'
import { isCaptainTeamConnection, type TeamConnection } from '@/lib/team-profile-links'
import {
  CAPTAIN_ROSTER_CONTACTS_TABLE,
  buildCaptainContactReviewHref,
  getCaptainRosterPhoneCoverage,
  normalizeCaptainRosterContactKey,
  selectCaptainContactRowsForScope,
  type CaptainRosterContactRow,
} from '@/lib/captain-roster-contacts'
import { getTeamMatchFormatSummary, resolveTeamMatchFormat } from '@/lib/competition-format-registry'
import ExploreResumeTracker from '@/app/explore/_components/explore-resume-tracker'

type TeamMatch = {
  id: string
  external_match_id?: string | null
  home_team: string | null
  away_team: string | null
  match_date: string | null
  match_type: 'singles' | 'doubles' | null
  winner_side: 'A' | 'B' | null
  score: string | null
  flight?: string | null
  league_name?: string | null
  usta_section?: string | null
  district_area?: string | null
  line_number?: string | null
}

type LineMatch = {
  id: string
  external_match_id: string | null
  winner_side: 'A' | 'B' | null
  match_type: 'singles' | 'doubles' | null
  line_number: string | null
}

type TeamRatingStatus = 'Bump Up Pace' | 'Trending Up' | 'Holding' | 'At Risk' | 'Drop Watch'
type RosterFilter = 'all' | 'played' | 'roster-only' | 'singles' | 'doubles'
type TeamActivityFilter = 'all' | 'upcoming' | 'results'

type Player = {
  id: string
  name: string
  overall_rating?: number | null
  singles_dynamic_rating: number | null
  doubles_dynamic_rating: number | null
  overall_dynamic_rating?: number | null
  singles_usta_dynamic_rating?: number | null
  doubles_usta_dynamic_rating?: number | null
  overall_usta_dynamic_rating?: number | null
  location?: string | null
}

type PlayerRelation = Player | Player[] | null

type MatchPlayer = {
  match_id: string
  side: 'A' | 'B'
  player_id: string
  match_type?: 'singles' | 'doubles' | null
  players: PlayerRelation
}

type TeamRosterMemberRow = {
  team_name: string | null
  player_id: string | null
  player_name: string | null
  league_name: string | null
  flight: string | null
  ntrp?: number | null
  players: PlayerRelation
}

type TeamSummaryTeamRow = {
  team_name: string | null
  league_name: string | null
  flight: string | null
  usta_section: string | null
  district_area: string | null
  raw_capture_json?: unknown
}

type TennisRecordTeamContextRow = {
  team_name: string | null
  league_name: string | null
  flight: string | null
}

type TennisRecordTeamRosterContextRow = {
  team_name: string | null
  player_name: string | null
  canonical_player_id: string | null
}

type TennisRecordTeamHistoryRow = {
  source_match_key: string
  opponent_team: string | null
  played_on: string | null
  league_name: string | null
  flight: string | null
  discipline: 'singles' | 'doubles' | null
  court_number: number | null
  score_text: string | null
  winner_side: 'A' | 'B' | null
  team_side: 'A' | 'B' | null
}

type RosterPlayer = Player & {
  appearances: number
  singlesAppearances: number
  doublesAppearances: number
  wins: number
  losses: number
}

type PairingCard = {
  key: string
  names: string[]
  players: Array<{ id: string; name: string }>
  appearances: number
  avgRating: number | null
  wins: number
  losses: number
}

type MatchCard = TeamMatch & {
  won: boolean | null
  opponent: string | null
  venueLabel: string
  linkedPlayerAppears: boolean
  linkedPlayerReportSource: 'parent_match' | 'line_match' | null
}

function normalizePlayer(player: PlayerRelation): Player | null {
  if (!player) return null
  return Array.isArray(player) ? player[0] ?? null : player
}

function formatCompactDate(value: string | null | undefined) {
  if (!value) return '--'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

function getOpenMatchStatus(matchDate: string | null | undefined) {
  if (!matchDate) return 'Scheduled'
  return matchDate.slice(0, 10) < new Date().toISOString().slice(0, 10) ? 'Not reported' : 'Scheduled'
}

function rosterMemberPlayer(entry: TeamRosterMemberRow): Player | null {
  const player = normalizePlayer(entry.players)
  if (player?.id && player.name) return player
  if (!entry.player_name) return null

  const rating = typeof entry.ntrp === 'number' && Number.isFinite(entry.ntrp) ? entry.ntrp : null
  const fallbackId = entry.player_id || `summary:${normalizeTeamName(entry.player_name)}`
  return {
    id: fallbackId,
    name: entry.player_name,
    overall_rating: rating,
    singles_dynamic_rating: rating,
    doubles_dynamic_rating: rating,
    overall_dynamic_rating: rating,
    singles_usta_dynamic_rating: null,
    doubles_usta_dynamic_rating: null,
    overall_usta_dynamic_rating: null,
    location: null,
  }
}

function teamSideForMatch(match: TeamMatch, teamName: string): 'A' | 'B' | null {
  const home = cleanText(match.home_team)
  const away = cleanText(match.away_team)
  const normalizedTeam = normalizeTeamName(teamName)
  if (normalizeTeamName(home) === normalizedTeam) return 'A'
  if (normalizeTeamName(away) === normalizedTeam) return 'B'
  return null
}

function didTeamWin(match: TeamMatch, teamName: string): boolean | null {
  const side = teamSideForMatch(match, teamName)
  if (!side || !match.winner_side) return null
  return side === match.winner_side
}

function getOpponent(match: TeamMatch, teamName: string): string | null {
  const home = cleanText(match.home_team)
  const away = cleanText(match.away_team)
  const normalizedTeam = normalizeTeamName(teamName)
  if (normalizeTeamName(home) === normalizedTeam) return away
  if (normalizeTeamName(away) === normalizedTeam) return home
  return null
}

function safeOverallRating(player: Player) {
  if (typeof player.overall_dynamic_rating === 'number' && !Number.isNaN(player.overall_dynamic_rating)) {
    return player.overall_dynamic_rating
  }

  const singles = typeof player.singles_dynamic_rating === 'number' && !Number.isNaN(player.singles_dynamic_rating)
    ? player.singles_dynamic_rating
    : null
  const doubles = typeof player.doubles_dynamic_rating === 'number' && !Number.isNaN(player.doubles_dynamic_rating)
    ? player.doubles_dynamic_rating
    : null

  if (singles == null && doubles == null) return null
  return Math.max(singles ?? Number.NEGATIVE_INFINITY, doubles ?? Number.NEGATIVE_INFINITY)
}

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || ''
  return value || ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractSummaryRosterMembers(summaryRows: TeamSummaryTeamRow[], teamName: string): TeamRosterMemberRow[] {
  const normalizedTeam = normalizeTeamName(teamName)
  const members = new Map<string, TeamRosterMemberRow>()

  for (const row of summaryRows) {
    const raw = row.raw_capture_json
    if (!isRecord(raw)) continue
    const summary = isRecord(raw.teamSummary) ? raw.teamSummary : raw

    const rosterTeamName = cleanText(summary.rosterTeamName)
    if (normalizeTeamName(rosterTeamName) !== normalizedTeam) continue

    const players = Array.isArray(summary.players) ? summary.players : []
    for (const entry of players) {
      if (!isRecord(entry)) continue
      const playerName = cleanText(entry.name)
      if (!playerName) continue
      const entryTeamName = cleanText(entry.teamName) || rosterTeamName
      if (normalizeTeamName(entryTeamName) !== normalizedTeam) continue
      const key = playerName.toLowerCase()
      if (members.has(key)) continue
      members.set(key, {
        team_name: teamName,
        player_id: null,
        player_name: playerName,
        league_name: row.league_name,
        flight: row.flight,
        ntrp: typeof entry.ntrp === 'number' && Number.isFinite(entry.ntrp) ? entry.ntrp : null,
        players: null,
      })
    }
  }

  return [...members.values()]
}

function summaryRowMatchesTeam(row: TeamSummaryTeamRow, teamName: string) {
  if (normalizeTeamName(row.team_name) === normalizeTeamName(teamName)) return true
  return extractSummaryRosterMembers([row], teamName).length > 0
}

function escapePostgrestValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export default function TeamPage() {
  return (
    <SiteShell active="/teams">
      <TeamPageContent />
    </SiteShell>
  )
}

function TeamPageContent() {
  const params = useParams()
  const searchParams = useSearchParams()

  const rawTeam = getParamValue(params.team as string | string[] | undefined)
  const team = decodeTeamRouteSegment(rawTeam)

  const layerFilter = cleanText(searchParams.get('layer'))
  const leagueFilter = cleanText(searchParams.get('league'))
  const flightFilter = cleanText(searchParams.get('flight'))

  const [matches, setMatches] = useState<TeamMatch[]>([])
  const [players, setPlayers] = useState<MatchPlayer[]>([])
  const [rosterMembers, setRosterMembers] = useState<TeamRosterMemberRow[]>([])
  const [summaryTeams, setSummaryTeams] = useState<TeamSummaryTeamRow[]>([])
  const [lineMatches, setLineMatches] = useState<LineMatch[]>([])
  const [linePlayers, setLinePlayers] = useState<MatchPlayer[]>([])
  const [tennisRecordRoster, setTennisRecordRoster] = useState<TennisRecordTeamRosterContextRow[]>([])
  const [tennisRecordHistory, setTennisRecordHistory] = useState<TennisRecordTeamHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seasonFilter, setSeasonFilter] = useState<string>('all')
  const [activityFilter, setActivityFilter] = useState<TeamActivityFilter>('all')
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('all')
  const [showFullMatchHistory, setShowFullMatchHistory] = useState(false)
  const [showFullRoster, setShowFullRoster] = useState(false)
  const [rosterSearch, setRosterSearch] = useState('')
  const [detailReady, setDetailReady] = useState(false)
  const [selectedRosterPlayerIds, setSelectedRosterPlayerIds] = useState<string[]>([])
  const [tiqParticipations, setTiqParticipations] = useState<TiqTeamParticipationRecord[]>([])
  const [tiqParticipationSource, setTiqParticipationSource] = useState<TiqLeagueStorageSource>('local')
  const [tiqParticipationWarning, setTiqParticipationWarning] = useState('')
  const [teamAwards, setTeamAwards] = useState<TiqAwardRecord[]>([])
  const [linkedPlayerId, setLinkedPlayerId] = useState<string | null>(null)
  const [linkedPlayerName, setLinkedPlayerName] = useState('')
  const [teamConnections, setTeamConnections] = useState<TeamConnection[]>([])
  const [captainRosterContacts, setCaptainRosterContacts] = useState<CaptainRosterContactRow[]>([])
  const [myMatchReports, setMyMatchReports] = useState<MatchAccuracyReport[]>([])
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const { userId: currentUserId, authResolved, role, entitlements, session } = useAuth()
  const accessToken = session?.access_token || ''
  const resolvedRole = authResolved || !currentUserId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [entitlements, resolvedRole])

  useEffect(() => {
    if (!authResolved || !accessToken) {
      setTeamConnections([])
      return
    }

    let active = true
    void fetchTeamConnections(accessToken)
      .then((result) => {
        if (active) setTeamConnections(result.connections)
      })
      .catch(() => {
        if (active) setTeamConnections([])
      })

    return () => {
      active = false
    }
  }, [accessToken, authResolved])

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    setSeasonFilter(query.get('season') || 'all')
    const nextActivity = query.get('activity')
    if (nextActivity === 'upcoming' || nextActivity === 'results' || nextActivity === 'all') {
      setActivityFilter(nextActivity)
    }
    const nextRoster = query.get('roster')
    if (nextRoster === 'played' || nextRoster === 'roster-only' || nextRoster === 'singles' || nextRoster === 'doubles' || nextRoster === 'all') {
      setRosterFilter(nextRoster)
    }
    setDetailReady(true)
  }, [])

  const exploreResumeHref = useMemo(() => {
    const query = new URLSearchParams()
    if (layerFilter) query.set('layer', layerFilter)
    if (leagueFilter) query.set('league', leagueFilter)
    if (flightFilter) query.set('flight', flightFilter)
    if (seasonFilter !== 'all') query.set('season', seasonFilter)
    if (activityFilter !== 'all') query.set('activity', activityFilter)
    if (rosterFilter !== 'all') query.set('roster', rosterFilter)
    const search = query.toString()
    return `/teams/${rawTeam}${search ? `?${search}` : ''}`
  }, [activityFilter, flightFilter, layerFilter, leagueFilter, rawTeam, rosterFilter, seasonFilter])

  useEffect(() => {
    if (!detailReady) return
    window.history.replaceState(null, '', exploreResumeHref)
  }, [detailReady, exploreResumeHref])

  useEffect(() => {
    if (!authResolved) return

    if (!currentUserId) {
      setLinkedPlayerId(null)
      setLinkedPlayerName('')
      setMyMatchReports([])
      return
    }

    let active = true

    void (async () => {
      const result = await loadUserProfileLink(currentUserId)
      if (!active) return
      setLinkedPlayerId(result.data?.linked_player_id || null)
      setLinkedPlayerName(result.data?.linked_player_name || '')
    })()

    return () => {
      active = false
    }
  }, [authResolved, currentUserId])

  const refreshMyMatchReports = useCallback(async () => {
    if (!authResolved) return

    if (!currentUserId) {
      setMyMatchReports([])
      return
    }

    try {
      setMyMatchReports(await listMyMatchAccuracyReports())
    } catch {
      setMyMatchReports([])
    }
  }, [authResolved, currentUserId])

  useEffect(() => {
    void refreshMyMatchReports()
  }, [refreshMyMatchReports])

  const loadTeamPage = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (!team) {
        setMatches([])
        setPlayers([])
        setRosterMembers([])
        setSummaryTeams([])
        setTennisRecordRoster([])
        setTennisRecordHistory([])
        setError('Team not found.')
        return
      }

      let summaryTeamQuery = supabase
        .from('team_summary_teams')
        .select('team_name, league_name, flight, usta_section, district_area, raw_capture_json')
        .eq('normalized_team_name', normalizeTeamName(team))
        .limit(20)

      if (leagueFilter) summaryTeamQuery = summaryTeamQuery.eq('league_name', leagueFilter)
      if (flightFilter) summaryTeamQuery = summaryTeamQuery.eq('flight', flightFilter)

      const { data: exactSummaryTeamData, error: summaryTeamError } = await summaryTeamQuery
      let summaryTeamData = (exactSummaryTeamData || []) as TeamSummaryTeamRow[]

      let tennisRecordContextQuery = supabase
        .from('tennisrecord_public_team_context')
        .select('team_name, league_name, flight')
        .ilike('team_name', team)
        .limit(20)

      if (leagueFilter) tennisRecordContextQuery = tennisRecordContextQuery.eq('league_name', leagueFilter)
      if (flightFilter) tennisRecordContextQuery = tennisRecordContextQuery.eq('flight', flightFilter)

      const { data: tennisRecordContextData, error: tennisRecordContextError } = await tennisRecordContextQuery
      if (!tennisRecordContextError) {
        const existingScopes = new Set(
          summaryTeamData.map((row) => `${cleanText(row.team_name)}__${cleanText(row.league_name)}__${cleanText(row.flight)}`),
        )
        for (const row of (tennisRecordContextData || []) as TennisRecordTeamContextRow[]) {
          const key = `${cleanText(row.team_name)}__${cleanText(row.league_name)}__${cleanText(row.flight)}`
          if (existingScopes.has(key)) continue
          summaryTeamData.push({
            team_name: row.team_name,
            league_name: row.league_name,
            flight: row.flight,
            usta_section: null,
            district_area: null,
            raw_capture_json: null,
          })
          existingScopes.add(key)
        }
      }

      if (!summaryTeamError && summaryTeamData.length === 0 && (leagueFilter || flightFilter)) {
        let scopedSummaryTeamQuery = supabase
          .from('team_summary_teams')
          .select('team_name, league_name, flight, usta_section, district_area, raw_capture_json')
          .limit(200)

        if (leagueFilter) scopedSummaryTeamQuery = scopedSummaryTeamQuery.eq('league_name', leagueFilter)
        if (flightFilter) scopedSummaryTeamQuery = scopedSummaryTeamQuery.eq('flight', flightFilter)

        const { data: scopedSummaryTeamData, error: scopedSummaryTeamError } = await scopedSummaryTeamQuery
        if (scopedSummaryTeamError) {
          console.warn('team_summary_teams scoped lookup skipped', scopedSummaryTeamError.message)
        } else {
          summaryTeamData = ((scopedSummaryTeamData || []) as TeamSummaryTeamRow[]).filter((row) =>
            summaryRowMatchesTeam(row, team),
          )
        }
      }

      if (summaryTeamError) {
        console.warn('team_summary_teams lookup skipped', summaryTeamError.message)
        setSummaryTeams([])
      } else {
        setSummaryTeams(summaryTeamData)
      }

      const tennisRecordRosterQuery = supabase
        .from('tennisrecord_public_team_roster_context')
        .select('team_name, player_name, canonical_player_id')
        .eq('normalized_team_name', normalizeTeamName(team))
        .order('player_name')
        .limit(100)

      let tennisRecordHistoryQuery = supabase
        .from('tennisrecord_public_team_match_history')
        .select('source_match_key, opponent_team, played_on, league_name, flight, discipline, court_number, score_text, winner_side, team_side')
        .ilike('team_name', team)
        .is('canonical_match_id', null)
        .order('played_on', { ascending: false })
        .limit(50)

      if (leagueFilter) tennisRecordHistoryQuery = tennisRecordHistoryQuery.eq('league_name', leagueFilter)
      if (flightFilter) tennisRecordHistoryQuery = tennisRecordHistoryQuery.eq('flight', flightFilter)

      const [tennisRecordRosterResult, tennisRecordHistoryResult] = await Promise.all([
        tennisRecordRosterQuery,
        tennisRecordHistoryQuery,
      ])
      if (tennisRecordRosterResult.error) {
        console.warn('TennisRecord roster context lookup skipped', tennisRecordRosterResult.error.message)
        setTennisRecordRoster([])
      } else {
        const rosterRows = (tennisRecordRosterResult.data || []) as TennisRecordTeamRosterContextRow[]
        const uniqueRoster = new Map<string, TennisRecordTeamRosterContextRow>()
        for (const row of rosterRows) {
          const key = cleanText(row.player_name).toLowerCase()
          if (key && !uniqueRoster.has(key)) uniqueRoster.set(key, row)
        }
        setTennisRecordRoster([...uniqueRoster.values()])
      }
      if (tennisRecordHistoryResult.error) {
        console.warn('TennisRecord team history lookup skipped', tennisRecordHistoryResult.error.message)
        setTennisRecordHistory([])
      } else {
        setTennisRecordHistory((tennisRecordHistoryResult.data || []) as TennisRecordTeamHistoryRow[])
      }

      let matchQuery = supabase
        .from('matches')
        .select(`
          id,
          external_match_id,
          home_team,
          away_team,
          match_date,
          match_type,
          winner_side,
          score,
          flight,
          league_name,
          usta_section,
          district_area,
          line_number
        `)
        .is('line_number', null)
        .order('match_date', { ascending: false })
        .limit(250)

      if (leagueFilter) {
        matchQuery = matchQuery.eq('league_name', leagueFilter)
      }

      if (flightFilter) {
        matchQuery = matchQuery.eq('flight', flightFilter)
      }

      if (!leagueFilter && !flightFilter) {
        const safeTeam = escapePostgrestValue(team)
        matchQuery = matchQuery.or(`home_team.eq."${safeTeam}",away_team.eq."${safeTeam}"`)
      }

      const { data: matchData, error: matchError } = await matchQuery
      if (matchError) {
        console.warn('team match lookup skipped', matchError.message)
      }

      const scopedMatches = matchError ? [] : ((matchData || []) as TeamMatch[]).filter((match) => {
        const home = cleanText(match.home_team)
        const away = cleanText(match.away_team)
        if (!home || !away) return false

        if (leagueFilter && cleanText(match.league_name) !== leagueFilter) return false
        if (flightFilter && cleanText(match.flight) !== flightFilter) return false

        return home === team || away === team
      })

      setMatches(scopedMatches)

      const rosterQuery = supabase
        .from('team_roster_members')
        .select(`
          team_name,
          player_id,
          player_name,
          league_name,
          flight,
          ntrp,
          players (
            id,
            name,
            overall_rating,
            singles_dynamic_rating,
            doubles_dynamic_rating,
            overall_dynamic_rating,
            singles_usta_dynamic_rating,
            doubles_usta_dynamic_rating,
            overall_usta_dynamic_rating,
            location
          )
        `)
        .eq('normalized_team_name', normalizeTeamName(team))

      const { data: rosterData, error: rosterError } = await rosterQuery
      if (rosterError) {
        console.warn('team_roster_members lookup skipped', rosterError.message)
        setRosterMembers([])
      } else {
        let nextRosterMembers = (rosterData || []) as TeamRosterMemberRow[]

        if (nextRosterMembers.length === 0 && summaryTeamData?.length) {
          const fallbackMembers = extractSummaryRosterMembers(summaryTeamData as TeamSummaryTeamRow[], team)
          const fallbackNames = fallbackMembers.map((member) => cleanText(member.player_name)).filter(Boolean)

          if (fallbackNames.length > 0) {
            const { data: fallbackPlayers, error: fallbackPlayersError } = await supabase
              .from('players')
              .select(`
                id,
                name,
                overall_rating,
                singles_dynamic_rating,
                doubles_dynamic_rating,
                overall_dynamic_rating,
                singles_usta_dynamic_rating,
                doubles_usta_dynamic_rating,
                overall_usta_dynamic_rating,
                location
              `)
              .in('name', fallbackNames)

            if (fallbackPlayersError) {
              console.warn('team summary fallback player lookup skipped', fallbackPlayersError.message)
            } else {
              const fallbackPlayerByName = new Map(
                ((fallbackPlayers || []) as Player[]).map((player) => [player.name.toLowerCase(), player]),
              )
              nextRosterMembers = fallbackMembers.map((member) => ({
                ...member,
                player_id: fallbackPlayerByName.get(cleanText(member.player_name).toLowerCase())?.id ?? member.player_id,
                players: fallbackPlayerByName.get(cleanText(member.player_name).toLowerCase()) ?? member.players,
              }))
            }
          }

          if (nextRosterMembers.length === 0) nextRosterMembers = fallbackMembers
        }

        setRosterMembers(nextRosterMembers)
      }

      if (!scopedMatches.length) {
        setPlayers([])
        setLineMatches([])
        setLinePlayers([])
        return
      }

      // Line matches: fetch individual court results for player records.
      const parentExternalIds = scopedMatches
        .map((m) => cleanText(m.external_match_id))
        .filter((id): id is string => id !== null)

      const matchDates = scopedMatches
        .map((m) => m.match_date)
        .filter((d): d is string => Boolean(d))
        .sort()

      let fetchedLineMatches: LineMatch[] = []
      let fetchedLinePlayers: MatchPlayer[] = []

      const ids = scopedMatches.map((match) => match.id)

      const playerDataPromise = supabase
        .from('match_players')
        .select(`
          match_id,
          side,
          player_id,
          players (
            id,
            name,
            overall_rating,
            singles_dynamic_rating,
            doubles_dynamic_rating,
            overall_dynamic_rating,
            singles_usta_dynamic_rating,
            doubles_usta_dynamic_rating,
            overall_usta_dynamic_rating,
            location
          )
        `)
        .in('match_id', ids)

      type LineResult = { data: LineMatch[] | null; error: { message: string } | null }
      let lineDataPromise: Promise<LineResult> = Promise.resolve({ data: null, error: null })

      if (parentExternalIds.length > 0 && matchDates.length > 0) {
        let lineQuery = supabase
          .from('matches')
          .select('id, external_match_id, winner_side, match_type, line_number')
          .not('line_number', 'is', null)
          .gte('match_date', matchDates[0])
          .lte('match_date', matchDates[matchDates.length - 1])

        if (leagueFilter) lineQuery = lineQuery.eq('league_name', leagueFilter)
        if (flightFilter) lineQuery = lineQuery.eq('flight', flightFilter)

        lineDataPromise = lineQuery as unknown as Promise<LineResult>
      }

      const [{ data: playerData, error: playerError }, lineResult] = await Promise.all([
        playerDataPromise,
        lineDataPromise,
      ])

      if (playerError) {
        console.warn('team match player lookup skipped', playerError.message)
        setPlayers([])
      } else {
        setPlayers((playerData || []) as MatchPlayer[])
      }

      if (lineResult.error) {
        console.warn('team line match lookup skipped', lineResult.error.message)
      } else if (lineResult.data !== null) {
        const parentIdSet = new Set(parentExternalIds)
        fetchedLineMatches = ((lineResult.data || []) as LineMatch[]).filter((lm) => {
          const extId = cleanText(lm.external_match_id)
          if (!extId) return false
          const prefix = extId.split('::line:')[0] ?? ''
          return parentIdSet.has(prefix)
        })

        setLineMatches(fetchedLineMatches)

        if (fetchedLineMatches.length > 0) {
          const lineIds = fetchedLineMatches.map((lm) => lm.id)
          const { data: linePlayerData, error: linePlayerError } = await supabase
            .from('match_players')
            .select(`
              match_id,
              side,
              player_id,
              players (
                id,
                name,
                overall_rating,
                singles_dynamic_rating,
                doubles_dynamic_rating,
                overall_dynamic_rating,
                overall_usta_dynamic_rating,
                location
              )
            `)
            .in('match_id', lineIds)

          if (linePlayerError) {
            console.warn('team line player lookup skipped', linePlayerError.message)
          } else {
            fetchedLinePlayers = (linePlayerData || []) as MatchPlayer[]
            setLinePlayers(fetchedLinePlayers)
          }
        }
      }
    } catch (err) {
      console.error(err)
      setMatches([])
      setPlayers([])
      setRosterMembers([])
      setSummaryTeams([])
      setError('Unable to load this team page right now.')
    } finally {
      setLoading(false)
    }
  }, [flightFilter, leagueFilter, team])

  useEffect(() => {
    void loadTeamPage()
  }, [loadTeamPage])

  useEffect(() => {
    let active = true

    async function loadTeamAwards() {
      if (!team) {
        setTeamAwards([])
        return
      }

      const result = await loadRecentTiqAwards()
      if (!active) return

      const normalizedTeam = normalizeTeamName(team)
      const awards = result.data.filter(
        (award) =>
          award.sourceType === 'league' &&
          !award.recipientPlayerId &&
          normalizeTeamName(award.recipientName) === normalizedTeam,
      )
      setTeamAwards(awards)
    }

    void loadTeamAwards()

    return () => {
      active = false
    }
  }, [team])

  useEffect(() => {
    let active = true

    async function loadTiqParticipations() {
      const result = await listTiqTeamParticipations({
        teamName: team,
        sourceLeagueName: leagueFilter || undefined,
        sourceFlight: flightFilter || undefined,
      })

      if (!active) return

      setTiqParticipations(result.entries)
      setTiqParticipationSource(result.source)
      setTiqParticipationWarning(result.warning || '')
    }

    if (team) {
      void loadTiqParticipations()
    } else {
      setTiqParticipations([])
      setTiqParticipationSource('local')
      setTiqParticipationWarning('')
    }

    return () => {
      active = false
    }
  }, [flightFilter, leagueFilter, team])

  const teamMeta = useMemo(() => {
    const firstSummaryTeam = summaryTeams.find(
      (row) => cleanText(row.league_name) || cleanText(row.flight) || cleanText(row.usta_section),
    )
    const firstWithLeague = matches.find(
      (match) => cleanText(match.league_name) || cleanText(match.flight) || cleanText(match.usta_section),
    )

    return {
      league: cleanText(firstSummaryTeam?.league_name) || cleanText(firstWithLeague?.league_name) || leagueFilter,
      flight: cleanText(firstSummaryTeam?.flight) || cleanText(firstWithLeague?.flight) || flightFilter,
      section: cleanText(firstSummaryTeam?.usta_section) || cleanText(firstWithLeague?.usta_section),
      district: cleanText(firstSummaryTeam?.district_area) || cleanText(firstWithLeague?.district_area),
    }
  }, [matches, summaryTeams, leagueFilter, flightFilter])

  // All seasons is the team's dynasty read. A selected season scopes every
  // performance and roster calculation to players with evidence that year.
  const seasonMatches = useMemo(
    () => seasonFilter === 'all' ? matches : matches.filter((match) => (match.match_date || '').startsWith(seasonFilter)),
    [matches, seasonFilter],
  )

  const latestCompletedMatch = useMemo(
    () => seasonMatches.find((match) => didTeamWin(match, team) !== null) || null,
    [seasonMatches, team],
  )
  const competitionLayer = inferCompetitionLayerFromValues({
    layerHint: layerFilter,
    leagueName: teamMeta.league,
    ustaSection: teamMeta.section,
    districtArea: teamMeta.district,
  })
  const resolvedTeamFormat = useMemo(
    () => resolveTeamMatchFormat({
      leagueName: teamMeta.league,
      flight: teamMeta.flight,
    }),
    [teamMeta.flight, teamMeta.league],
  )
  const teamFormatSummary = useMemo(
    () => getTeamMatchFormatSummary(resolvedTeamFormat),
    [resolvedTeamFormat],
  )
  const isDoublesOnlyTeam = teamFormatSummary.singles === 0 && teamFormatSummary.doubles > 0

  useEffect(() => {
    if (!currentUserId || !team) {
      setCaptainRosterContacts([])
      return
    }

    let active = true
    void supabase
      .from(CAPTAIN_ROSTER_CONTACTS_TABLE)
      .select('id, captain_user_id, team_name, normalized_team_name, league_name, flight, full_name, normalized_name, phone, email, role, is_captain, source, source_batch_id')
      .eq('captain_user_id', currentUserId)
      .eq('normalized_team_name', normalizeCaptainRosterContactKey(team))
      .order('full_name')
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          console.warn('captain roster contacts lookup skipped', error.message)
          setCaptainRosterContacts([])
          return
        }
        setCaptainRosterContacts((data || []) as CaptainRosterContactRow[])
      })

    return () => {
      active = false
    }
  }, [currentUserId, team])

  const record = useMemo(() => {
    let wins = 0
    let losses = 0

    seasonMatches.forEach((match) => {
      const result = didTeamWin(match, team)
      if (result === true) wins += 1
      if (result === false) losses += 1
    })

    return { wins, losses }
  }, [seasonMatches, team])

  const matchTypeSplit = useMemo(() => {
    let singlesW = 0, singlesL = 0, doublesW = 0, doublesL = 0
    for (const match of seasonMatches) {
      const won = didTeamWin(match, team)
      if (won === null) continue
      if (match.match_type === 'singles') { if (won) singlesW++; else singlesL++ }
      if (match.match_type === 'doubles') { if (won) doublesW++; else doublesL++ }
    }
    return { singlesW, singlesL, doublesW, doublesL }
  }, [seasonMatches, team])

  const recentForm = useMemo(() => {
    return seasonMatches
      .slice(0, 10)
      .map((m) => didTeamWin(m, team))
      .filter((r): r is boolean => r !== null)
      .map((won) => (won ? 'W' : 'L'))
  }, [seasonMatches, team])

  const completedMatchCount = record.wins + record.losses
  const winRate = completedMatchCount > 0 ? Math.round((record.wins / completedMatchCount) * 100) : null
  const latestResult = latestCompletedMatch
  const latestResultOpponent = latestResult ? getOpponent(latestResult, team) : null

  const roster = useMemo<RosterPlayer[]>(() => {
    const map = new Map<string, RosterPlayer>()

    if (seasonFilter === 'all') rosterMembers.forEach((entry) => {
      const player = rosterMemberPlayer(entry)
      if (!player || !player.id) return
      if (!map.has(player.id)) {
        map.set(player.id, {
          ...player,
          appearances: 0,
          singlesAppearances: 0,
          doublesAppearances: 0,
          wins: 0,
          losses: 0,
        })
      }
    })

    const useLineData = linePlayers.length > 0

    if (useLineData) {
      // New data path: individual court outcomes from line matches.
      const lineMatchLookup = new Map(lineMatches.map((lm) => [lm.id, lm]))
      // Map the parent external_match_id prefix to its parent TeamMatch.
      const parentByExternalId = new Map(
        seasonMatches.map((m) => [cleanText(m.external_match_id) ?? '', m]),
      )

      linePlayers.forEach((entry) => {
        const player = normalizePlayer(entry.players)
        if (!player) return

        const lineMatch = lineMatchLookup.get(entry.match_id)
        if (!lineMatch) return

        const extId = cleanText(lineMatch.external_match_id)
        if (!extId) return
        const parentPrefix = extId.split('::line:')[0] ?? ''
        const parentMatch = parentByExternalId.get(parentPrefix)
        if (!parentMatch) return

        // Only include players on our team's side
        const teamSide = teamSideForMatch(parentMatch, team)
        if (!teamSide || entry.side !== teamSide) return

        if (!map.has(player.id)) {
          map.set(player.id, {
            ...player,
            appearances: 0,
            singlesAppearances: 0,
            doublesAppearances: 0,
            wins: 0,
            losses: 0,
          })
        }

        const current = map.get(player.id)
        if (!current) return

        current.appearances += 1
        const appearanceType = entry.match_type ?? lineMatch.match_type
        if (appearanceType === 'singles') current.singlesAppearances += 1
        if (appearanceType === 'doubles') current.doublesAppearances += 1

        // Individual win: player's side matches THIS line's winner_side
        if (lineMatch.winner_side === entry.side) current.wins += 1
        else if (lineMatch.winner_side !== null) current.losses += 1
      })
    } else {
      // Legacy data path: match_players linked directly to parent matches.
      const matchLookup = new Map(seasonMatches.map((match) => [match.id, match]))

      players.forEach((entry) => {
        const player = normalizePlayer(entry.players)
        if (!player) return

        const match = matchLookup.get(entry.match_id)
        if (!match) return

        const teamSide = teamSideForMatch(match, team)
        if (!teamSide || entry.side !== teamSide) return

        if (!map.has(player.id)) {
          map.set(player.id, {
            ...player,
            appearances: 0,
            singlesAppearances: 0,
            doublesAppearances: 0,
            wins: 0,
            losses: 0,
          })
        }

        const current = map.get(player.id)
        if (!current) return

        current.appearances += 1
        const appearanceType = entry.match_type ?? match.match_type
        if (appearanceType === 'singles') current.singlesAppearances += 1
        if (appearanceType === 'doubles') current.doublesAppearances += 1

        // Legacy: use team-level outcome (best available without line data)
        const result = didTeamWin(match, team)
        if (result === true) current.wins += 1
        if (result === false) current.losses += 1
      })
    }

    return Array.from(map.values()).sort((a, b) => {
      const aOverall = safeOverallRating(a)
      const bOverall = safeOverallRating(b)

      if (aOverall == null && bOverall == null) return a.name.localeCompare(b.name)
      if (aOverall == null) return 1
      if (bOverall == null) return -1
      if (bOverall !== aOverall) return bOverall - aOverall
      return a.name.localeCompare(b.name)
    })
  }, [lineMatches, linePlayers, rosterMembers, seasonFilter, seasonMatches, players, team])

  const teamChatPlayerIds = useMemo(() => Array.from(new Set(
    rosterMembers
      .map((entry) => cleanText(entry.player_id))
      .filter((playerId) => playerId && !playerId.startsWith('summary:')),
  )), [rosterMembers])

  const teamExistsFromSummary = summaryTeams.length > 0
  const bestSingles = useMemo(() => {
    return [...roster]
      .sort((a, b) => {
        const left = a.singles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        const right = b.singles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        if (right !== left) return right - left
        return a.name.localeCompare(b.name)
      })
      .slice(0, 6)
  }, [roster])

  const bestDoubles = useMemo(() => {
    return [...roster]
      .sort((a, b) => {
        const left = a.doubles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        const right = b.doubles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        if (right !== left) return right - left
        return a.name.localeCompare(b.name)
      })
      .slice(0, 6)
  }, [roster])

  useEffect(() => {
    if (isDoublesOnlyTeam && rosterFilter === 'singles') {
      setRosterFilter('all')
    }
  }, [isDoublesOnlyTeam, rosterFilter])

  const activeRosterFilter: RosterFilter = isDoublesOnlyTeam && rosterFilter === 'singles'
    ? 'all'
    : rosterFilter

  const filteredRoster = useMemo(() => {
    const searchTerm = cleanText(rosterSearch).toLowerCase()
    const nextRoster = roster.filter((player) => {
      if (searchTerm && !player.name.toLowerCase().includes(searchTerm)) return false
      if (activeRosterFilter === 'played') return player.appearances > 0
      if (activeRosterFilter === 'roster-only') return player.appearances === 0
      return true
    })

    if (activeRosterFilter === 'singles') {
      return [...nextRoster].sort((a, b) => {
        const left = a.singles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        const right = b.singles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        if (right !== left) return right - left
        return a.name.localeCompare(b.name)
      })
    }

    if (activeRosterFilter === 'doubles') {
      return [...nextRoster].sort((a, b) => {
        const left = a.doubles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        const right = b.doubles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        if (right !== left) return right - left
        return a.name.localeCompare(b.name)
      })
    }

    return nextRoster
  }, [activeRosterFilter, roster, rosterSearch])
  const mobileRosterPreviewLimit = isMobile ? 4 : 12
  const visibleRoster = showFullRoster ? filteredRoster : filteredRoster.slice(0, mobileRosterPreviewLimit)

  const rosterFilterOptions = useMemo<Array<{ key: RosterFilter; label: string; count: number }>>(() => {
    const options: Array<{ key: RosterFilter; label: string; count: number }> = [
      { key: 'all', label: 'All', count: roster.length },
      { key: 'played', label: 'Played', count: roster.filter((player) => player.appearances > 0).length },
      { key: 'roster-only', label: 'Roster only', count: roster.filter((player) => player.appearances === 0).length },
    ]
    if (!isDoublesOnlyTeam) options.push({ key: 'singles', label: 'Singles options', count: roster.length })
    options.push({ key: 'doubles', label: 'Doubles options', count: roster.length })
    return options
  }, [isDoublesOnlyTeam, roster])
  const hasRosterParticipationSplit = useMemo(() => {
    const playedCount = roster.filter((player) => player.appearances > 0).length
    return playedCount > 0 && playedCount < roster.length
  }, [roster])
  const showRosterFilters = !isMobile || hasRosterParticipationSplit
  const showRosterTools = !isMobile || showFullRoster

  const selectedRosterPlayers = useMemo(() => {
    return selectedRosterPlayerIds
      .map((id) => roster.find((player) => player.id === id) || null)
      .filter((player): player is RosterPlayer => Boolean(player))
  }, [roster, selectedRosterPlayerIds])

  const rosterCompareHref = selectedRosterPlayerIds.length === 2
    ? `/matchup?type=singles&playerA=${encodeURIComponent(selectedRosterPlayerIds[0])}&playerB=${encodeURIComponent(selectedRosterPlayerIds[1])}`
    : '/matchup'

  function handleRosterCompareToggle(playerId: string) {
    if (playerId.startsWith('summary:')) return

    setSelectedRosterPlayerIds((current) => {
      if (current.includes(playerId)) return current.filter((id) => id !== playerId)
      if (current.length >= 2) return [current[1], playerId]
      return [...current, playerId]
    })
  }

  function toggleFullRoster() {
    if (showFullRoster) setRosterSearch('')
    setShowFullRoster(!showFullRoster)
  }

  const pairings = useMemo<PairingCard[]>(() => {
    const byMatch = new Map<string, MatchPlayer[]>()

    players.forEach((entry) => {
      if (!byMatch.has(entry.match_id)) {
        byMatch.set(entry.match_id, [])
      }
      byMatch.get(entry.match_id)?.push(entry)
    })

    const pairMap = new Map<string, PairingCard>()

    matches.forEach((match) => {
      if (match.match_type !== 'doubles') return

      const teamSide = teamSideForMatch(match, team)
      if (!teamSide) return

      const entries = (byMatch.get(match.id) || []).filter((entry) => entry.side === teamSide)
      if (entries.length < 2) return

      const normalized = entries
        .map((entry) => normalizePlayer(entry.players))
        .filter((player): player is Player => Boolean(player))
        .slice(0, 2)

      if (normalized.length < 2) return

      const sortedPlayers = [...normalized].sort((a, b) => a.name.localeCompare(b.name))
      const key = sortedPlayers.map((player) => player.id).join('-')
      const validRatings = sortedPlayers
        .map((player) => player.doubles_dynamic_rating)
        .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))
      const avgRating = validRatings.length
        ? validRatings.reduce((sum, value) => sum + value, 0) / validRatings.length
        : null

      if (!pairMap.has(key)) {
        pairMap.set(key, {
          key,
          names: sortedPlayers.map((player) => player.name),
          players: sortedPlayers.map((player) => ({ id: player.id, name: player.name })),
          appearances: 0,
          avgRating,
          wins: 0,
          losses: 0,
        })
      }

      const pair = pairMap.get(key)
      if (!pair) return

      pair.appearances += 1
      pair.avgRating = avgRating

      const result = didTeamWin(match, team)
      if (result === true) pair.wins += 1
      if (result === false) pair.losses += 1
    })

    return Array.from(pairMap.values()).sort((a, b) => {
      if (a.avgRating == null && b.avgRating == null) {
        if (b.appearances !== a.appearances) return b.appearances - a.appearances
        return a.names.join(' / ').localeCompare(b.names.join(' / '))
      }
      if (a.avgRating == null) return 1
      if (b.avgRating == null) return -1
      if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating
      if (b.appearances !== a.appearances) return b.appearances - a.appearances
      return a.names.join(' / ').localeCompare(b.names.join(' / '))
    })
  }, [matches, players, team])

  const seasonOptions = useMemo(() => {
    const years = new Set(matches.map((m) => m.match_date?.slice(0, 4)).filter(Boolean) as string[])
    return [...years].sort((a, b) => b.localeCompare(a))
  }, [matches])

  const opponentAnalysis = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number; lastDate: string | null }>()
    for (const match of matches) {
      const opp = getOpponent(match, team)
      if (!opp) continue
      const won = didTeamWin(match, team)
      const existing = map.get(opp) ?? { wins: 0, losses: 0, lastDate: null }
      if (won === true) existing.wins++
      else if (won === false) existing.losses++
      if (won !== null && (!existing.lastDate || (match.match_date && match.match_date > existing.lastDate))) {
        existing.lastDate = match.match_date
      }
      map.set(opp, existing)
    }
    return [...map.entries()]
      .map(([name, rec]) => ({ name, wins: rec.wins, losses: rec.losses, total: rec.wins + rec.losses, lastDate: rec.lastDate, winPct: rec.wins + rec.losses > 0 ? Math.round((rec.wins / (rec.wins + rec.losses)) * 100) : 0 }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [matches, team])

  const myMatchReportByMatchId = useMemo(() => {
    const map = new Map<string, MatchAccuracyReport>()
    for (const report of myMatchReports) {
      if (!report.matchId || map.has(report.matchId)) continue
      map.set(report.matchId, report)
    }
    return map
  }, [myMatchReports])

  const matchCards = useMemo<MatchCard[]>(() => {
    const parentMatchIdsWithLinkedPlayer = new Set<string>()
    const parentExternalIdsWithLinkedPlayer = new Set<string>()
    const lineMatchById = new Map(lineMatches.map((lineMatch) => [lineMatch.id, lineMatch]))

    if (linkedPlayerId) {
      for (const entry of players) {
        if (entry.player_id === linkedPlayerId) {
          parentMatchIdsWithLinkedPlayer.add(entry.match_id)
        }
      }

      for (const entry of linePlayers) {
        if (entry.player_id !== linkedPlayerId) continue
        const lineMatch = lineMatchById.get(entry.match_id)
        const externalId = cleanText(lineMatch?.external_match_id)
        if (!externalId) continue
        const parentExternalId = externalId.split('::line:')[0] ?? ''
        if (parentExternalId) parentExternalIdsWithLinkedPlayer.add(parentExternalId)
      }
    }

    return matches.map((match) => {
      const won = didTeamWin(match, team)
      const opponent = getOpponent(match, team)
      const isHome = cleanText(match.home_team) === team
      const externalId = cleanText(match.external_match_id)
      const directParentMatch = parentMatchIdsWithLinkedPlayer.has(match.id)
      const lineMatch = externalId ? parentExternalIdsWithLinkedPlayer.has(externalId) : false

      return {
        ...match,
        won,
        opponent,
        venueLabel: isHome ? 'Home' : 'Away',
        linkedPlayerAppears: directParentMatch || lineMatch,
        linkedPlayerReportSource: directParentMatch ? 'parent_match' : lineMatch ? 'line_match' : null,
      }
    })
  }, [lineMatches, linePlayers, linkedPlayerId, matches, players, team])

  const nextScheduledMatch = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return matchCards
      .filter((match) => match.won === null && Boolean(match.match_date) && (match.match_date || '').slice(0, 10) >= today)
      .sort((left, right) => (left.match_date || '').localeCompare(right.match_date || ''))[0] ?? null
  }, [matchCards])

  const playedRosterCount = useMemo(
    () => roster.filter((player) => player.appearances > 0).length,
    [roster],
  )

  const teamCourtLead = useMemo(() => {
    const topPair = pairings.find((pair) => pair.avgRating !== null)
    if (topPair) {
      return {
        label: 'Top doubles read',
        value: formatRating(topPair.avgRating),
        detail: topPair.names.join(' / '),
      }
    }

    const topSingles = !isDoublesOnlyTeam
      ? bestSingles.find((player) => player.singles_dynamic_rating !== null)
      : null
    if (topSingles) {
      return {
        label: 'Top singles read',
        value: formatRating(topSingles.singles_dynamic_rating),
        detail: topSingles.name,
      }
    }

    return null
  }, [bestSingles, isDoublesOnlyTeam, pairings])

  const captainLinks = [
    {
      question: 'Who is available?',
      title: 'Check availability',
      description: 'Track who is in, out, and on the bubble before lineup lock.',
      cta: 'Check availability',
      job: 'check_availability',
      href: buildCaptainScopedHref('/captain/availability', {
        competitionLayer,
        team,
        league: leagueFilter || teamMeta.league || undefined,
        flight: flightFilter || teamMeta.flight || undefined,
      }),
    },
    {
      question: 'What lineup gives us the best chance?',
      title: 'Build the lineup',
      description: 'Compare available players, court strength, opponent context, and risk before match day.',
      cta: 'Build lineup',
      job: 'build_lineup',
      href: buildCaptainScopedHref('/captain/lineup-builder', {
        competitionLayer,
        team,
        league: leagueFilter || teamMeta.league || undefined,
        flight: flightFilter || teamMeta.flight || undefined,
      }),
    },
    {
      question: 'Who should play together?',
      title: 'Compare pairings',
      description: 'Stress-test doubles combinations and alternate lineups before the weekly call gets hard.',
      cta: 'Compare scenarios',
      job: 'compare_pairings',
      href: buildCaptainScopedHref('/captain/scenario-builder', {
        competitionLayer,
        team,
        league: leagueFilter || teamMeta.league || undefined,
        flight: flightFilter || teamMeta.flight || undefined,
      }),
    },
    {
      question: 'What should I communicate?',
      title: 'Send the team plan',
      description: 'Turn the lineup decision into a clear team note so players know where to be, who they play with, and what matters.',
      cta: 'Send team plan',
      job: 'send_team_plan',
      href: buildCaptainScopedHref('/captain/messaging', {
        competitionLayer,
        team,
        league: leagueFilter || teamMeta.league || undefined,
        flight: flightFilter || teamMeta.flight || undefined,
      }),
    },
  ]
  const teamRoomHref = buildTeamRoomHref({
    teamName: team,
    leagueName: leagueFilter || teamMeta.league || undefined,
    flight: flightFilter || teamMeta.flight || undefined,
  })
  const teamContactsHref = `${captainLinks[3].href}${captainLinks[3].href.includes('?') ? '&' : '?'}contactView=all#captain-contact-manager`
  const teamLeagueHref = teamMeta.league
    ? buildExploreLeagueHref({
        competitionLayer,
        leagueFormat: 'team',
        leagueName: teamMeta.league,
        flight: teamMeta.flight,
        ustaSection: teamMeta.section,
        districtArea: teamMeta.district,
      })
    : ''
  const linkedTeamConnection = teamConnections.find((connection) => {
    if (normalizeTeamName(connection.teamName) !== normalizeTeamName(team)) return false
    const currentLeague = cleanText(leagueFilter || teamMeta.league).toLowerCase()
    const currentFlight = cleanText(flightFilter || teamMeta.flight).toLowerCase()
    if (currentLeague && connection.leagueName && connection.leagueName.toLowerCase() !== currentLeague) return false
    if (currentFlight && connection.flight && connection.flight.toLowerCase() !== currentFlight) return false
    return true
  }) || null
  const isLinkedTeamMember = Boolean(currentUserId && linkedTeamConnection)
  const canManageThisTeam = Boolean(
    linkedTeamConnection
    && isCaptainTeamConnection(linkedTeamConnection.roles)
    && access.canUseCaptainWorkflow,
  )
  const scopedCaptainContacts = useMemo(
    () => selectCaptainContactRowsForScope({
      rows: captainRosterContacts,
      team,
      league: leagueFilter || teamMeta.league || undefined,
      flight: flightFilter || teamMeta.flight || undefined,
    }),
    [captainRosterContacts, flightFilter, leagueFilter, team, teamMeta.flight, teamMeta.league],
  )
  const captainContactByPlayerName = useMemo(
    () => new Map(scopedCaptainContacts.map((contact) => [normalizeCaptainRosterContactKey(contact.full_name), contact])),
    [scopedCaptainContacts],
  )
  const captainContactCoverage = useMemo(() => {
    const rosterNames = roster.map((player) => player.name)
    const phoneCoverage = getCaptainRosterPhoneCoverage({
      rosterNames,
      contacts: scopedCaptainContacts,
    })
    const emailNameKeys = new Set(
      scopedCaptainContacts
        .filter((contact) => Boolean(contact.email?.trim()))
        .map((contact) => normalizeCaptainRosterContactKey(contact.full_name))
        .filter(Boolean),
    )
    const emailReadyCount = rosterNames.filter((name) => emailNameKeys.has(normalizeCaptainRosterContactKey(name))).length
    const unreachableCount = rosterNames.filter((name) => {
      const contact = captainContactByPlayerName.get(normalizeCaptainRosterContactKey(name))
      return !contact?.phone?.trim() && !contact?.email?.trim()
    }).length

    return {
      total: rosterNames.length,
      phoneReadyCount: phoneCoverage.readyCount,
      emailReadyCount,
      missingPhoneNames: phoneCoverage.missingNames,
      unreachableCount,
    }
  }, [captainContactByPlayerName, roster, scopedCaptainContacts])
  const captainContactReviewHref = buildCaptainContactReviewHref({
    baseHref: teamContactsHref,
    missingNames: captainContactCoverage.missingPhoneNames,
  })

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '18px' : '34px 26px',
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1.2fr) minmax(min(100%, 300px), 0.85fr)',
    gap: isMobile ? '14px' : '22px',
    borderRadius: isMobile ? 22 : heroShell.borderRadius,
    order: 0,
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '30px' : isMobile ? '38px' : '56px',
    lineHeight: isMobile ? 1.04 : heroTitle.lineHeight,
  }

  const dynamicCardGrid: CSSProperties = {
    ...cardGridStyle,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicRosterGrid: CSSProperties = {
    ...rosterCardGridStyle,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicRosterMetricGrid: CSSProperties = {
    ...mobileRosterMetricGridStyle,
    gridTemplateColumns: isDoublesOnlyTeam ? 'repeat(2, minmax(0, 1fr))' : mobileRosterMetricGridStyle.gridTemplateColumns,
  }

  const dynamicHeroActions: CSSProperties = {
    ...heroActions,
    flexDirection: 'row',
    alignItems: 'center',
    gap: isMobile ? 8 : heroActions.gap,
  }

  const dynamicSummaryCard: CSSProperties = isMobile ? mobileSummaryCard : summaryCard
  const dynamicSummaryMetricGrid: CSSProperties = isMobile ? mobileSummaryMetricGrid : summaryMetricGrid
  const dynamicTeamMatchPulseMetricGrid: CSSProperties = {
    ...teamMatchPulseMetricGridStyle,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicListRow: CSSProperties = {
    ...listRow,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'stretch' : 'flex-start',
  }

  const heroMetaParts = [teamMeta.league, teamMeta.flight, teamMeta.section].filter(Boolean)
  const stableFollowId = buildScopedTeamEntityId({
    competitionLayer,
    teamName: team,
    leagueName: teamMeta.league,
    flight: teamMeta.flight,
  })
  if (loading) {
    return (
      <section style={pageContent}>
        <PublicDetailState
          eyebrow="Team Intelligence"
          title="Opening team context."
          body="Pulling roster, recent matches, league scope, and Captain Tools paths so this team page starts with useful tennis context."
          tone="loading"
          visual="team"
          signals={[
            { label: 'Source', value: 'Player Rosters and scorecards' },
            { label: 'Freshness', value: 'Recent matches first' },
            { label: 'Status', value: 'Reviewable through Data Assist' },
          ]}
          actions={[
            { href: '/teams', label: 'Find Teams' },
            { href: '/captain', label: 'Open Captain Tools' },
            { href: DATA_ASSIST_STORY.href, label: DATA_ASSIST_STORY.cta },
          ]}
        />
      </section>
    )
  }

  return (
    <section style={pageContent}>
        <ExploreResumeTracker
          surface="team"
          label="team"
          href={exploreResumeHref}
          contextLabel={team}
          enabled={detailReady}
        />
        <nav style={isMobile ? teamSectionNavMobileStyle : teamSectionNavStyle} aria-label="Team page sections">
          <a href="#team-overview" style={isMobile ? teamSectionNavLinkMobileStyle : teamSectionNavLinkStyle}>Overview</a>
          <a href="#team-schedule" style={isMobile ? teamSectionNavLinkMobileStyle : teamSectionNavLinkStyle}>Activity</a>
          <a href="#team-roster" style={isMobile ? teamSectionNavLinkMobileStyle : teamSectionNavLinkStyle}>Roster</a>
          {isLinkedTeamMember ? <a href="#team-chat" style={isMobile ? teamSectionNavLinkMobileStyle : teamSectionNavLinkStyle}>Team chat</a> : null}
        </nav>
        <section id="team-overview" style={{ ...dynamicHeroShell, scrollMarginTop: 16 }}>
          <span aria-hidden="true" style={watermarkStyle} />
          <div>
            <Link href="/teams" style={heroBackLinkStyle}>Back to teams</Link>
            <p style={eyebrow}>Team profile</p>
            <h1 style={dynamicHeroTitle}>{team || 'Team Detail'}</h1>

            <div style={heroBadgeRow}>
              <span style={badgeSlate}>{getCompetitionLayerLabel(competitionLayer)}</span>
              {teamLeagueHref ? <Link href={teamLeagueHref} style={{ ...badgeBlue, textDecoration: 'none' }}>{teamMeta.league}</Link> : null}
              {teamMeta.flight ? <span style={badgeGreen}>{teamMeta.flight}</span> : null}
              {teamMeta.district ? <span style={badgeSlate}>{teamMeta.district}</span> : null}
              {!teamMeta.district && teamMeta.section ? <span style={badgeSlate}>{teamMeta.section}</span> : null}
            </div>

            <p style={heroContextText}>
              {completedMatchCount > 0
                ? `${completedMatchCount} reviewed ${completedMatchCount === 1 ? 'result' : 'results'} shape this team view.`
                : 'See the team context that helps everyone stay ready.'}
            </p>

            {seasonOptions.length > 1 ? (
              <div style={teamSeasonScopeStyle} aria-label="Team season view">
                <span style={teamSeasonScopeLabelStyle}>Season view</span>
                <div style={teamSeasonScopeControlsStyle}>
                  {(['all', ...seasonOptions] as const).map((season) => {
                    const active = seasonFilter === season
                    return (
                      <button
                        key={season}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSeasonFilter(season)}
                        style={{
                          ...seasonFilterButtonStyle,
                          ...(active ? teamSeasonScopeButtonActiveStyle : teamSeasonScopeButtonStyle),
                        }}
                      >
                        {season === 'all' ? 'All seasons' : season}
                      </button>
                    )
                  })}
                </div>
                <span style={teamSeasonScopeDetailStyle}>
                  {seasonFilter === 'all' ? 'Lifetime team view' : `${seasonFilter} roster and results`}
                </span>
              </div>
            ) : null}

            <div style={dynamicHeroActions}>
              {!authResolved ? (
                <span style={helperCallout}>Checking team access...</span>
              ) : !currentUserId ? (
                <>
                  <PrimaryLink href={`/join?next=${encodeURIComponent(teamRoomHref)}`}>Register Free</PrimaryLink>
                  <SecondaryLink href={`/login?next=${encodeURIComponent(teamRoomHref)}`}>Sign in</SecondaryLink>
                </>
              ) : isLinkedTeamMember ? (
                <>
                  <PrimaryLink href="#team-chat">Open Team Chat</PrimaryLink>
                  {!isMobile && access.canUseAdvancedPlayerInsights ? <SecondaryLink href="/mylab">Open My Lab</SecondaryLink> : null}
                  {!isMobile && access.canUseAdvancedPlayerInsights ? <GhostLink href="/matchup">Prep matchup</GhostLink> : null}
                  {canManageThisTeam ? <SecondaryLink href={captainLinks[1].href}>Build lineup</SecondaryLink> : null}
                  {!isMobile && canManageThisTeam ? <GhostLink href={captainLinks[0].href}>Check availability</GhostLink> : null}
                </>
              ) : (
                <>
                  <PrimaryLink href="/team-connections">Connect this team</PrimaryLink>
                  <GhostLink href="/compete/teams">My Teams</GhostLink>
                </>
              )}
              <div style={followButtonWrap}>
                <FollowButton
                  entityType="team"
                  entityId={stableFollowId}
                  entityName={team}
                  subtitle={heroMetaParts.join(' - ') || undefined}
                />
              </div>
            </div>
          </div>

          <div style={dynamicSummaryCard}>
            <div style={isMobile ? mobileSummaryTitle : summaryTitle}>Season pulse</div>

            <div style={dynamicSummaryMetricGrid}>
              <MetricCard compact={isMobile} label="Record" value={`${record.wins}-${record.losses}`} subtle="Wins / losses" />
              <MetricCard
                compact={isMobile}
                label="Win rate"
                value={winRate == null ? '—' : `${winRate}%`}
                subtle={completedMatchCount ? `${completedMatchCount} decisions` : 'No completed results'}
              />
              <MetricCard
                compact={isMobile}
                label={roster.length ? 'Roster' : tennisRecordRoster.length ? 'Listed' : 'Roster'}
                value={String(roster.length || tennisRecordRoster.length)}
                subtle={roster.length ? 'Players tracked' : tennisRecordRoster.length ? 'Recorded roster' : 'Not listed'}
              />
            </div>

            {(matchTypeSplit.singlesW + matchTypeSplit.singlesL > 0 || matchTypeSplit.doublesW + matchTypeSplit.doublesL > 0) ? (
              <div style={summarySplitRowStyle}>
                {matchTypeSplit.singlesW + matchTypeSplit.singlesL > 0 ? (
                  <div style={summarySplitItemStyle}>
                    <span style={summarySplitLabelStyle}>Singles</span>
                    <strong>{matchTypeSplit.singlesW}-{matchTypeSplit.singlesL}</strong>
                    <span>{Math.round((matchTypeSplit.singlesW / (matchTypeSplit.singlesW + matchTypeSplit.singlesL)) * 100)}% win</span>
                  </div>
                ) : null}
                {matchTypeSplit.doublesW + matchTypeSplit.doublesL > 0 ? (
                  <div style={summarySplitItemStyle}>
                    <span style={summarySplitLabelStyle}>Doubles</span>
                    <strong>{matchTypeSplit.doublesW}-{matchTypeSplit.doublesL}</strong>
                    <span>{Math.round((matchTypeSplit.doublesW / (matchTypeSplit.doublesW + matchTypeSplit.doublesL)) * 100)}% win</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {recentForm.length > 0 ? (
              <div style={recentFormRowStyle}>
                <span style={{ color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Recent</span>
                {recentForm.map((result, i) => (
                  <span
                    key={i}
                    style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, fontSize: 11, fontWeight: 900, background: result === 'W' ? 'rgba(155,225,29,0.12)' : 'rgba(239,68,68,0.10)', color: result === 'W' ? '#d9f84a' : '#fca5a5', border: `1px solid ${result === 'W' ? 'rgba(155,225,29,0.22)' : 'rgba(239,68,68,0.18)'}` }}
                  >
                    {result}
                  </span>
                ))}
              </div>
            ) : null}

            {latestResult ? (
              <a href="#team-schedule" style={featuredTeamResultStyle}>
                <span style={latestResult.winner_side === teamSideForMatch(latestResult, team) ? resultWinMarkStyle : resultLossMarkStyle}>
                  {didTeamWin(latestResult, team) ? 'W' : 'L'}
                </span>
                <span style={featuredTeamResultCopyStyle}>
                  <span style={featuredTeamResultKickerStyle}>Latest result · {formatCompactDate(latestResult.match_date)}</span>
                  <strong>vs {latestResultOpponent || 'Opponent pending'}</strong>
                </span>
                <span style={featuredTeamResultScoreStyle}>{latestResult.score || 'View'}</span>
              </a>
            ) : tennisRecordHistory.length > 0 ? (
              <a href="#team-schedule" style={featuredTeamResultStyle}>
                <span style={sourceHistoryMarkStyle}>•</span>
                <span style={featuredTeamResultCopyStyle}>
                  <span style={featuredTeamResultKickerStyle}>Team activity</span>
                  <strong>{tennisRecordHistory.length} results ready to review</strong>
                </span>
                <span style={featuredTeamResultScoreStyle}>View</span>
              </a>
            ) : null}

            <a href="#team-schedule" style={summaryHistoryLinkStyle}>View full match history</a>
          </div>
        </section>

        {nextScheduledMatch || roster.length || teamCourtLead ? (
          <section style={teamMatchPulseStyle} aria-label="Team match pulse">
            <div style={teamMatchPulseHeadingStyle}>
              <div>
                <p style={sectionKicker}>Match pulse</p>
                <h2 style={teamMatchPulseTitleStyle}>{nextScheduledMatch ? 'Ready for the next opponent.' : 'Team readiness at a glance.'}</h2>
              </div>
              <Link href={canManageThisTeam ? captainLinks[1].href : '/captain'} style={teamMatchPulseActionStyle}>
                {canManageThisTeam ? 'Open lineup' : 'Explore Captain'}
              </Link>
            </div>

            {nextScheduledMatch ? (
              <a href="#team-schedule" style={teamNextMatchReadStyle}>
                <span style={teamPulseLabelStyle}>Next up</span>
                <strong>vs {nextScheduledMatch.opponent || 'Opponent pending'}</strong>
                <span style={teamPulseDetailStyle}>
                  {formatCompactDate(nextScheduledMatch.match_date)} · {nextScheduledMatch.venueLabel}
                </span>
              </a>
            ) : null}

            <div style={dynamicTeamMatchPulseMetricGrid}>
              {roster.length ? (
                <a href="#team-roster" style={teamPulseMetricStyle}>
                  <span style={teamPulseLabelStyle}>Roster active</span>
                  <strong>{playedRosterCount}/{roster.length}</strong>
                  <span style={teamPulseDetailStyle}>players with a tracked start</span>
                </a>
              ) : null}
              {teamCourtLead ? (
                <a href="#team-roster" style={teamPulseMetricStyle}>
                  <span style={teamPulseLabelStyle}>{teamCourtLead.label}</span>
                  <strong>{teamCourtLead.value}</strong>
                  <span style={teamPulseDetailStyle}>{teamCourtLead.detail}</span>
                </a>
              ) : null}
            </div>

            {!canManageThisTeam ? (
              <Link href="/captain" style={teamPulseCaptainPreviewStyle}>
                <span style={teamPulseCaptainCopyStyle}>
                  <span style={teamPulseLabelStyle}>{CAPTAIN_STORY.quickStartKicker}</span>
                  <strong>Turn this team read into a clear lineup.</strong>
                </span>
                <span aria-hidden="true" style={teamPulseCaptainArrowStyle}>→</span>
              </Link>
            ) : null}
          </section>
        ) : null}

        {!canManageThisTeam && !isMobile && !(nextScheduledMatch || roster.length || teamCourtLead) ? (
          <section style={captainAccessTeaseStyle} aria-label="Captain tools">
            <div style={captainAccessCopyStyle}>
              <p style={sectionKicker}>{CAPTAIN_STORY.eyebrow}</p>
              <h2 style={captainAccessTitleStyle}>Get the lineup ready before match day.</h2>
              <p style={captainAccessTextStyle}>Availability, pairings, and team messaging stay in one weekly flow.</p>
            </div>
            <SecondaryLink href="/captain">{CAPTAIN_STORY.quickStartKicker}</SecondaryLink>
          </section>
        ) : null}

        {isLinkedTeamMember ? <section id="team-chat" style={{ ...surfaceCard, order: 4, scrollMarginTop: 16 }}>
          <div style={sectionHeadingRow}>
            <div style={sectionHeadingCopyStyle}>
              <p style={sectionKicker}>Team chat</p>
              <h2 style={sectionTitle}>Talk with the roster.</h2>
              <p style={bodyText}>Start or continue the team conversation. Replies also appear in your Messages inbox.</p>
            </div>
          </div>
          <div style={dynamicHeroActions}>
            <QuickMessageComposer
              mode="team"
              triggerLabel="Open Team Chat"
              subject={`${team} team chat`}
              leagueName={team}
              teamName={team}
              teamLeagueName={leagueFilter || teamMeta.league}
              teamFlight={flightFilter || teamMeta.flight}
              entityType="team"
              entityId={stableFollowId}
              participantPlayerIds={teamChatPlayerIds}
            />
            <GhostLink href={teamRoomHref}>Open full room</GhostLink>
          </div>

          {isLinkedTeamMember && access.canUseAdvancedPlayerInsights ? (
            <div style={{ marginTop: 16, padding: 16, borderRadius: 18, border: '1px solid rgba(125, 211, 252, 0.16)', background: 'rgba(255, 255, 255, 0.035)' }}>
              <p style={sectionKicker}>Player tools</p>
              <h3 style={{ ...sectionTitle, fontSize: 18 }}>Turn team context into your next improvement.</h3>
              <p style={bodyText}>Bring this roster, your match history, and the next opponent into My Lab and matchup prep.</p>
              <div style={dynamicHeroActions}>
                <PrimaryLink href="/mylab">Open My Lab</PrimaryLink>
                <SecondaryLink href="/matchup">Prep matchup</SecondaryLink>
              </div>
            </div>
          ) : null}

          {linkedTeamConnection && isCaptainTeamConnection(linkedTeamConnection.roles) && access.canUseCaptainWorkflow ? (
            <div style={{ marginTop: 12 }}>
              <SecondaryLink href={captainLinks[1].href}>Open captain team tools</SecondaryLink>
            </div>
          ) : null}
        </section> : null}

        {canManageThisTeam ? (
        <section style={{ ...teamWeekPathStyle(isTablet), order: 1 }} aria-label="Captain team week tools">
          <div style={teamWeekPathCopyStyle}>
            <p style={sectionKicker}>Team week path</p>
            <h2 style={teamWeekPathTitleStyle}>Answer match week from your phone.</h2>
            <p style={teamWeekPathTextStyle}>
              Start with the team page, then move straight into availability, lineup, pairings, and the team note.
            </p>
          </div>
          <div style={teamWeekPathGridStyle(isSmallMobile)}>
            {captainLinks.map((item) => (
              <Link
                key={item.question}
                href={item.href}
                style={teamWeekActionCardStyle}
                aria-label={`${item.cta}: ${item.question}`}
                data-team-week-job={item.job}
              >
                <span style={teamWeekActionQuestionStyle}>{item.question}</span>
                <strong style={teamWeekActionTitleStyle}>{item.title}</strong>
                <span style={teamWeekActionTextStyle}>{item.description}</span>
              </Link>
            ))}
          </div>
        </section>
        ) : null}

        <details style={{ ...detailDrawerStyle, order: 7 }}>
          <summary style={detailDrawerSummaryStyle}>
            <span style={detailDrawerCopyStyle}>
              <span style={sectionKicker}>Data quality</span>
              <strong style={detailDrawerTitleStyle}>Show how this team page is checked</strong>
            </span>
            <span style={panelCountPill}>Details</span>
          </summary>
          <div style={detailDrawerContentStyle}>
            <DataTrustPanel
              title="Team data trust"
              body="Team pages combine reviewed Player Rosters, scorecards, TIQ league entries, and public tennis context when available. Use Data Assist when a roster, result, or team identity needs review."
              signals={[
                { label: 'Source', value: 'Player rosters, scorecards, and TIQ entries' },
                { label: 'Freshness', value: 'Updates as reviewed uploads connect' },
                { label: 'Confidence', value: 'Higher when scorecards and roster context agree' },
                { label: 'Status', value: 'Report, upload, or request review through Data Assist' },
              ]}
            />
          </div>
        </details>

        {error ? (
          <section style={surfaceCard}>
            <h2 style={sectionTitle}>Team page unavailable</h2>
            <p style={bodyText}>{error}</p>
            <div style={{ marginTop: 14 }}>
              <RetryButton onClick={() => void loadTeamPage()}>Retry team page</RetryButton>
            </div>
          </section>
        ) : null}

        {!error && !matches.length && !tennisRecordHistory.length ? (
          <section style={surfaceCard}>
            <h2 style={sectionTitle}>No reviewed scorecards yet</h2>
            <p style={bodyText}>
              This team can exist from a reviewed roster before results arrive. Use the roster and Team Hub now,
              then reviewed Data Assist scorecards will enrich match history, records, and player usage.
            </p>
            <div style={dynamicHeroActions}>
              <SecondaryLink href={DATA_ASSIST_STORY.href}>{DATA_ASSIST_STORY.cta}</SecondaryLink>
              <SecondaryLink href="/teams">Browse all teams</SecondaryLink>
              {canManageThisTeam ? <GhostLink href={captainLinks[0].href}>Open captain availability</GhostLink> : null}
            </div>
          </section>
        ) : null}

        {!error && tennisRecordHistory.length ? (
          <section style={{ ...surfaceCard, order: 2, scrollMarginTop: 16 }} id="team-schedule">
            <div style={sectionHeadingRow}>
              <div style={sectionHeadingCopyStyle}>
                <p style={sectionKicker}>Team activity</p>
                <h2 style={sectionTitle}>Recorded match history</h2>
                <p style={bodyText}>Match results that are still being connected to this team record.</p>
              </div>
              <span style={panelCountPill}>{tennisRecordHistory.length} {tennisRecordHistory.length === 1 ? 'line' : 'lines'}</span>
            </div>
            <div style={stackList}>
              {tennisRecordHistory.slice(0, 8).map((match) => {
                const won = match.winner_side && match.team_side ? match.winner_side === match.team_side : null
                return (
                  <div key={match.source_match_key} style={dynamicListRow}>
                    <div style={listRowCopyStyle}>
                      <strong>vs {match.opponent_team || 'Opponent pending'}</strong>
                      <div style={mutedText}>
                        {[formatDate(match.played_on), match.league_name, match.flight, match.discipline ? `${match.discipline} ${match.court_number || ''}`.trim() : ''].filter(Boolean).join(' - ')}
                      </div>
                    </div>
                    <div style={dynamicHeroActions}>
                      {match.score_text ? <strong>{match.score_text}</strong> : <span style={mutedText}>Score pending</span>}
                      {won != null ? <span style={won ? badgeGreen : badgeBlue}>{won ? 'Win' : 'Loss'}</span> : null}
                    </div>
                  </div>
                )
              })}
            </div>
            {tennisRecordHistory.length > 8 ? <p style={{ ...mutedText, marginTop: 14 }}>Showing the latest 8 match lines while team history connects.</p> : null}
          </section>
        ) : null}

        {teamAwards.length > 0 ? (
          <section style={{ ...surfaceCard, order: 5 }} id="team-awards">
            <div style={sectionHeadingRow}>
              <div style={sectionHeadingCopyStyle}>
                <p style={sectionKicker}>Team Awards</p>
                <h2 style={sectionTitle}>Trophy case</h2>
              </div>
              <span style={panelCountPill}>{teamAwards.length} earned</span>
            </div>

            <div style={teamAwardGridStyle}>
              {teamAwards.slice(0, 6).map((award) => (
                <Link key={award.id} href={`/awards/${encodeURIComponent(award.id)}`} style={teamAwardCardStyle}>
                  <span style={teamAwardCodeStyle}>{award.badgeCode}</span>
                  <span style={teamAwardTitleStyle}>{award.title}</span>
                  <span style={teamAwardMetaStyle}>{award.sourceName}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {tiqParticipations.length || tiqParticipationWarning ? (
        <section style={{ ...surfaceCard, order: 6 }}>
          <div style={sectionHeadingRow}>
            <div style={sectionHeadingCopyStyle}>
              <p style={sectionKicker}>TIQ Seasons</p>
              <h2 style={sectionTitle}>Entered TIQ Leagues</h2>
            </div>
          </div>

          {tiqParticipations.length ? (
            <div style={stackList}>
              {tiqParticipations.map((entry) => (
                <div key={`${entry.leagueId}-${entry.teamName}`} style={dynamicListRow}>
                  <div style={listRowCopyStyle}>
                    <strong>{entry.leagueName || 'TIQ League'}</strong>
                    <div style={mutedText}>
                      {[entry.seasonLabel, entry.leagueFlight || entry.sourceFlight, entry.locationLabel]
                        .filter(Boolean)
                        .join(' - ')}
                    </div>
                    {entry.sourceLeagueName || entry.sourceFlight ? (
                      <div style={mutedText}>
                        Original team: {[entry.sourceLeagueName, entry.sourceFlight].filter(Boolean).join(' - ')}
                      </div>
                    ) : null}
                  </div>
                  <div style={dynamicHeroActions}>
                    <GhostLink href={`/explore/leagues/tiq/${encodeURIComponent(entry.leagueId)}?league_id=${encodeURIComponent(entry.leagueId)}`}>
                      TIQ League
                    </GhostLink>
                    {canManageThisTeam ? <SecondaryLink href={buildCaptainScopedHref('/captain/lineup-builder', {
                      competitionLayer: 'tiq',
                      team,
                      league: entry.leagueName || undefined,
                      flight: entry.leagueFlight || undefined,
                    })}>
                      Lineup Builder
                    </SecondaryLink> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={emptyStateBlock}>
              <p style={emptyState}>This team is not entered in a TIQ league yet.</p>
              <p style={mutedText}>
                Enter this team in a TIQ league when you want to manage rosters, schedules, and results in TenAceIQ.
              </p>
            </div>
          )}

          {tiqParticipationWarning ? (
            <div style={helperCallout}>
              {tiqParticipationSource === 'supabase' ? tiqParticipationWarning : `TIQ leagues are available on this device while cloud sync catches up: ${tiqParticipationWarning}`}
            </div>
          ) : null}
        </section>
        ) : null}

        {roster.length || bestSingles.length || pairings.length || bestDoubles.length ? (
        <details style={{ ...detailDrawerStyle, order: 4 }}>
          <summary style={detailDrawerSummaryStyle}>
            <span style={detailDrawerCopyStyle}>
              <span style={sectionKicker}>Player insights</span>
              <strong style={detailDrawerTitleStyle}>{isDoublesOnlyTeam ? 'Doubles depth and pairings' : 'Singles, doubles, and pairings'}</strong>
            </span>
            <span style={panelCountPill}>View</span>
          </summary>
          <div style={detailDrawerContentStyle}>
        {roster.length || (isDoublesOnlyTeam ? bestDoubles.length : bestSingles.length) || pairings.length ? (
        <section style={dynamicCardGrid}>
          <article style={surfaceCardStrong}>
            <div style={sectionHeadingRow}>
              <div style={sectionHeadingCopyStyle}>
                <p style={sectionKicker}>{isDoublesOnlyTeam ? 'Doubles Core' : 'Singles Core'}</p>
                <h2 style={sectionTitle}>{isDoublesOnlyTeam ? 'Top Doubles Options' : 'Top Singles Options'}</h2>
              </div>
            </div>

            {(isDoublesOnlyTeam ? bestDoubles : bestSingles).length ? (
              <div style={stackList}>
                {(isDoublesOnlyTeam ? bestDoubles : bestSingles).map((player, index) => {
                  const status = getTeamPlayerStatus(player)
                  const appearances = isDoublesOnlyTeam ? player.doublesAppearances : player.singlesAppearances
                  const rating = isDoublesOnlyTeam ? player.doubles_dynamic_rating : player.singles_dynamic_rating
                  return (
                    <div key={player.id} style={listRow}>
                      <div style={listRowCopyStyle}>
                        <strong>
                          {index + 1}.{' '}
                          <EntityDetailLink href={`/players/${encodeURIComponent(player.id)}`}>
                            {player.name}
                          </EntityDetailLink>
                        </strong>
                        <div style={mutedText}>
                          {appearances} {isDoublesOnlyTeam ? 'doubles' : 'singles'} starts - {player.wins}-{player.losses} record
                        </div>
                      </div>
                      <div style={ratingStackStyle}>
                        <span style={badgeBlue}>{formatRating(rating)}</span>
                        {status ? <span style={{ ...teamStatusPill, ...getTeamStatusStyle(status) }}>{status}</span> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={emptyStateBlock}>
                <p style={emptyState}>{isDoublesOnlyTeam ? 'Doubles depth is not available yet.' : 'Singles data is not available yet.'}</p>
                <p style={mutedText}>{isDoublesOnlyTeam ? 'This format uses doubles courts. Doubles depth will appear as players log those lines.' : 'Once this team logs singles courts, the strongest options will surface here.'}</p>
              </div>
            )}
          </article>

          <article style={surfaceCardStrong}>
            <div style={sectionHeadingRow}>
              <div style={sectionHeadingCopyStyle}>
                <p style={sectionKicker}>Doubles Chemistry</p>
                <h2 style={sectionTitle}>Best Pairs</h2>
              </div>
            </div>

            {pairings.length ? (
              <div style={stackList}>
                {pairings.slice(0, 6).map((pair) => (
                  <div key={pair.key} style={listRow}>
                    <div style={listRowCopyStyle}>
                      <strong>
                        {pair.players.map((player, index) => (
                          <React.Fragment key={player.id}>
                            {index > 0 ? ' / ' : null}
                            <EntityDetailLink href={`/players/${encodeURIComponent(player.id)}`}>
                              {player.name}
                            </EntityDetailLink>
                          </React.Fragment>
                        ))}
                      </strong>
                      <div style={mutedText}>
                        {pair.appearances} matches together - {pair.wins}-{pair.losses} record
                      </div>
                    </div>
                    <span style={badgeGreen}>{formatRating(pair.avgRating)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={emptyStateBlock}>
                <p style={emptyState}>Doubles pairings are not available yet.</p>
                <p style={mutedText}>As soon as this roster logs repeat partnerships, chemistry trends will appear here.</p>
              </div>
            )}
          </article>
        </section>
        ) : null}

        {!isDoublesOnlyTeam && bestDoubles.length ? (
        <section style={dynamicCardGrid}>
          <article style={surfaceCard}>
            <div style={sectionHeadingRow}>
              <div style={sectionHeadingCopyStyle}>
                <p style={sectionKicker}>Depth View</p>
                <h2 style={sectionTitle}>Top Doubles Players</h2>
              </div>
            </div>

            {bestDoubles.length ? (
              <div style={stackList}>
                {bestDoubles.map((player, index) => {
                  const status = getTeamPlayerStatus(player)
                  return (
                    <div key={player.id} style={listRow}>
                      <div style={listRowCopyStyle}>
                        <strong>
                          {index + 1}.{' '}
                          <EntityDetailLink href={`/players/${encodeURIComponent(player.id)}`}>
                            {player.name}
                          </EntityDetailLink>
                        </strong>
                        <div style={mutedText}>
                          {player.doublesAppearances} doubles starts - {player.wins}-{player.losses} record
                        </div>
                      </div>
                      <div style={ratingStackStyle}>
                        <span style={badgeSlate}>{formatRating(player.doubles_dynamic_rating)}</span>
                        {status ? <span style={{ ...teamStatusPill, ...getTeamStatusStyle(status) }}>{status}</span> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={emptyStateBlock}>
                <p style={emptyState}>Doubles depth data is not available yet.</p>
                <p style={mutedText}>Match results will fill in this ladder once players start appearing in doubles lines.</p>
              </div>
            )}
          </article>
        </section>
        ) : null}
          </div>
        </details>
        ) : null}

        {matches.length ? (
        <section style={{ ...surfaceCard, order: 2, scrollMarginTop: 16 }} id="team-schedule">
          <div style={sectionHeadingRow}>
            <div style={sectionHeadingCopyStyle}>
              <p style={sectionKicker}>Team activity</p>
              <h2 style={sectionTitle}>Match history</h2>
              <p style={sectionHeadingTextStyle}>A quick read of what happened most recently. Open the full history only when you need it.</p>
            </div>
            <span style={panelCountPill}>{matches.length} {matches.length === 1 ? 'match' : 'matches'}</span>
          </div>

          {opponentAnalysis.length > 0 ? (
            <details style={opponentBreakdownDetailsStyle}>
              <summary style={opponentBreakdownSummaryStyle}>
                <span>Record vs. opponents</span>
                <span style={opponentBreakdownCountStyle}>
                  {opponentAnalysis.length} opponent{opponentAnalysis.length !== 1 ? 's' : ''}
                </span>
              </summary>
              <div style={opponentBreakdownBodyStyle}>
                <div style={opponentListStyle}>
                {opponentAnalysis.map((opp) => (
                  <article key={opp.name} style={opponentCardStyle(isSmallMobile)}>
                    <div style={opponentIdentityStyle}>
                      <strong style={opponentNameStyle}>
                        <EntityDetailLink href={buildTeamProfileHref(opp.name)}>
                          {opp.name}
                        </EntityDetailLink>
                      </strong>
                      <span style={mutedText}>Last met {formatDate(opp.lastDate)}</span>
                    </div>
                    <div style={opponentRecordStyle} aria-label={`${opp.wins} wins, ${opp.losses} losses, ${opp.winPct}% win rate across ${opp.total} matches`}>
                      <span style={opponentMetricStyle}><strong>{opp.wins}-{opp.losses}</strong><small>record</small></span>
                      <span style={opponentMetricStyle}><strong>{opp.winPct}%</strong><small>win rate</small></span>
                      <span style={opponentMetricStyle}><strong>{opp.total}</strong><small>matches</small></span>
                    </div>
                  </article>
                ))}
                </div>
              </div>
            </details>
          ) : null}

          {matchCards.length ? (() => {
            const filteredCards = seasonFilter === 'all'
              ? matchCards
              : matchCards.filter((m) => (m.match_date || '').startsWith(seasonFilter))
            const upcomingCards = filteredCards
              .filter((match) => match.won === null)
              .sort((left, right) => (left.match_date || '').localeCompare(right.match_date || ''))
            const completedCards = filteredCards
              .filter((match) => match.won !== null)
              .sort((left, right) => (right.match_date || '').localeCompare(left.match_date || ''))
            const orderedCards = [...upcomingCards, ...completedCards]
            const activityCards = activityFilter === 'upcoming'
              ? upcomingCards
              : activityFilter === 'results'
                ? completedCards
                : orderedCards
            const previewCards = isMobile
              ? activityFilter === 'all'
                ? [...upcomingCards.slice(0, 2), ...completedCards.slice(0, 2)]
                : activityCards.slice(0, 4)
              : activityCards.slice(0, 8)
            const visibleCards = showFullMatchHistory ? activityCards : previewCards
            return (
            <>
            {isMobile ? (
              <div style={activityFilterControlsStyle} aria-label="Team activity filter">
                {([
                  { key: 'all', label: 'All' },
                  { key: 'upcoming', label: `Upcoming ${upcomingCards.length}` },
                  { key: 'results', label: `Results ${completedCards.length}` },
                ] as const).map((option) => {
                  const active = activityFilter === option.key
                  return (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setActivityFilter(option.key)
                        setShowFullMatchHistory(false)
                      }}
                      style={{
                        ...activityFilterButtonStyle,
                        ...(active ? activityFilterButtonActiveStyle : null),
                      }}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
            {isMobile ? (
              <div style={mobileMatchListStyle}>
                {[
                  { key: 'upcoming', label: 'Upcoming', cards: visibleCards.filter((match) => match.won === null) },
                  { key: 'recent', label: 'Recent results', cards: visibleCards.filter((match) => match.won !== null) },
                ].filter((group) => group.cards.length > 0).map((group) => (
                  <section key={group.key} style={mobileMatchGroupStyle} aria-label={group.label}>
                    <h3 style={mobileMatchGroupTitleStyle}>{group.label}</h3>
                    <div style={mobileMatchGroupCardsStyle}>
                      {group.cards.map((match) => {
                        const existingReport = myMatchReportByMatchId.get(match.id) || null
                        return (
                          <article key={match.id} style={mobileMatchCardStyle}>
                            <div style={mobileMatchCardHeaderStyle}>
                              <div style={mobileMatchIdentityStyle}>
                                <span style={mobileMatchDateStyle}>{formatCompactDate(match.match_date)}</span>
                                <strong style={mobileMatchOpponentStyle}>
                                  {match.opponent ? (
                                    <EntityDetailLink
                                      href={buildTeamProfileHref(match.opponent, {
                                        layer: competitionLayer,
                                        league: match.league_name,
                                        flight: match.flight,
                                      })}
                                    >
                                      {match.opponent}
                                    </EntityDetailLink>
                                  ) : 'Opponent unavailable'}
                                </strong>
                              </div>
                              <span style={match.won === true ? badgeGreen : match.won === false ? badgeBlue : badgeSlate}>
                                {match.won === true ? 'Win' : match.won === false ? 'Loss' : getOpenMatchStatus(match.match_date)}
                              </span>
                            </div>
                            <div style={mobileMatchFactsStyle}>
                              <span>{match.venueLabel}</span>
                              {match.match_type ? <span>{match.match_type[0].toUpperCase() + match.match_type.slice(1)}</span> : null}
                              {match.score ? <strong>Score {match.score}</strong> : null}
                            </div>
                            {existingReport ? (
                              <span style={reportStatusBadgeStyle(existingReport.status)}>
                                {getReportStatusLabel(existingReport.status)}
                              </span>
                            ) : match.linkedPlayerAppears ? (
                              <MatchAccuracyReportButton
                                matchId={match.id}
                                reporterPlayerName={linkedPlayerName}
                                matchLabel={`${team} vs ${match.opponent ?? 'opponent'} - ${match.score ?? 'No score'}`}
                                context={{
                                  surface: 'team_match_history',
                                  linkedPlayerId: linkedPlayerId || '',
                                  teamName: team,
                                  opponent: match.opponent,
                                  leagueName: match.league_name,
                                  flight: match.flight,
                                  matchType: match.match_type,
                                  matchDate: match.match_date,
                                  result: match.won === true ? 'W' : match.won === false ? 'L' : null,
                                  reportSource: match.linkedPlayerReportSource,
                                  externalMatchId: match.external_match_id,
                                }}
                                onSubmitted={() => void refreshMyMatchReports()}
                              />
                            ) : null}
                          </article>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div style={tableWrap}>
                <table style={dataTable}>
                <thead>
                  <tr>
                    <th style={tableHeaderCell}>Date</th>
                    <th style={tableHeaderCell}>Opponent</th>
                    <th style={tableHeaderCell}>Venue</th>
                    <th style={tableHeaderCell}>Format</th>
                    <th style={tableHeaderCell}>Score</th>
                    <th style={tableHeaderCell}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCards.map((match) => {
                    const existingReport = myMatchReportByMatchId.get(match.id) || null
                    return (
                    <tr key={match.id}>
                      <td style={tableCell}>{formatDate(match.match_date)}</td>
                      <td style={tableCell}>
                        {match.opponent ? (
                          <EntityDetailLink
                            href={buildTeamProfileHref(match.opponent, {
                              layer: competitionLayer,
                              league: match.league_name,
                              flight: match.flight,
                            })}
                          >
                            {match.opponent}
                          </EntityDetailLink>
                        ) : '--'}
                      </td>
                      <td style={tableCell}>{match.venueLabel}</td>
                      <td style={tableCell}>
                        {match.match_type ? match.match_type[0].toUpperCase() + match.match_type.slice(1) : '--'}
                      </td>
                      <td style={tableCell}>
                        <div style={scoreCellStackStyle}>
                          <span>{match.score ?? '--'}</span>
                          {existingReport ? (
                            <span style={reportStatusBadgeStyle(existingReport.status)}>
                              {getReportStatusLabel(existingReport.status)}
                            </span>
                          ) : match.linkedPlayerAppears ? (
                            <MatchAccuracyReportButton
                              matchId={match.id}
                              reporterPlayerName={linkedPlayerName}
                              matchLabel={`${team} vs ${match.opponent ?? 'opponent'} - ${match.score ?? 'No score'}`}
                              context={{
                                surface: 'team_match_history',
                                linkedPlayerId: linkedPlayerId || '',
                                teamName: team,
                                opponent: match.opponent,
                                leagueName: match.league_name,
                                flight: match.flight,
                                matchType: match.match_type,
                                matchDate: match.match_date,
                                result: match.won === true ? 'W' : match.won === false ? 'L' : null,
                                reportSource: match.linkedPlayerReportSource,
                                externalMatchId: match.external_match_id,
                              }}
                              onSubmitted={() => void refreshMyMatchReports()}
                            />
                          ) : null}
                        </div>
                      </td>
                      <td style={tableCell}>
                        <span style={match.won === true ? badgeGreen : match.won === false ? badgeBlue : badgeSlate}>
                          {match.won === true ? 'Win' : match.won === false ? 'Loss' : '--'}
                        </span>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
                </table>
              </div>
            )}
            {orderedCards.length > previewCards.length ? (
              <div style={tableControlRowStyle}>
                <button type="button" onClick={() => setShowFullMatchHistory((value) => !value)} style={tableToggleButtonStyle}>
                  {showFullMatchHistory ? 'Return to match preview' : `Explore all ${filteredCards.length} matches`}
                </button>
              </div>
            ) : null}
            </>
            )
          })() : (
            <div style={emptyStateBlock}>
              <p style={emptyState}>Team match history is not available yet.</p>
              <p style={mutedText}>Return to the team directory or use the Captain actions above while the season history catches up.</p>
            </div>
          )}
        </section>
        ) : null}

        {roster.length || tennisRecordRoster.length ? (
        <section style={{ ...surfaceCard, order: 3, scrollMarginTop: 16 }} id="team-roster">
          <div style={sectionHeadingRow}>
            <div style={sectionHeadingCopyStyle}>
              <p style={sectionKicker}>Team people</p>
              <h2 style={sectionTitle}>{isMobile ? 'Roster & contacts' : 'Lineup, roster & contacts'}</h2>
              <p style={sectionHeadingTextStyle}>{isMobile ? 'See the active roster, then move straight into team contact or chat.' : 'Explore the roster, compare two players, and keep private captain contact details in one trusted team path.'}</p>
            </div>
            {roster.length && (visibleRoster.length !== filteredRoster.length || filteredRoster.length !== roster.length) ? (
              <span style={panelCountPill}>
                {visibleRoster.length} of {filteredRoster.length} shown
              </span>
            ) : null}
          </div>

          <div style={rosterPeopleHubStyle}>
            <div style={rosterPeopleHubCopyStyle}>
              <strong>{roster.length || tennisRecordRoster.length} {(roster.length || tennisRecordRoster.length) === 1 ? 'player' : 'players'} in this team view</strong>
              <span>{canManageThisTeam
                ? `${scopedCaptainContacts.length} private captain contacts saved for this team.`
                : 'Open a player profile or join Team Chat to stay connected.'}</span>
            </div>
            <div style={rosterPeopleHubActionsStyle}>
              {canManageThisTeam ? <Link href={teamContactsHref} style={rosterPeopleContactLinkStyle}>Team contacts</Link> : null}
              {isLinkedTeamMember ? <Link href={teamRoomHref} style={rosterPeopleChatLinkStyle}>TiQ Team Chat</Link> : null}
            </div>
          </div>

          {roster.length ? (
            <>
              {canManageThisTeam ? (
                <details style={captainContactHubStyle}>
                  <summary style={captainContactHubSummaryStyle}>
                    <span style={detailDrawerCopyStyle}>
                      <span style={sectionKicker}>Captain contacts</span>
                      <strong style={detailDrawerTitleStyle}>Contact readiness for match week</strong>
                      <span style={captainContactHubSummaryTextStyle}>
                        {captainContactCoverage.phoneReadyCount} of {captainContactCoverage.total} players are ready for a text.
                      </span>
                    </span>
                    <span style={captainContactHubSummaryBadgeStyle}>
                      {captainContactCoverage.phoneReadyCount}/{captainContactCoverage.total} text-ready
                    </span>
                  </summary>
                  <div style={captainContactHubContentStyle}>
                    <p style={captainContactPrivacyNoteStyle}>Private to captains. Keep player details current before you send a lineup ask.</p>
                    <div style={captainContactMetricGridStyle}>
                      <div style={captainContactMetricStyle}>
                        <span style={captainContactMetricLabelStyle}>Text-ready</span>
                        <strong>{captainContactCoverage.phoneReadyCount}/{captainContactCoverage.total}</strong>
                        <span style={captainContactMetricTextStyle}>mobile saved</span>
                      </div>
                      <div style={captainContactMetricStyle}>
                        <span style={captainContactMetricLabelStyle}>Email-ready</span>
                        <strong>{captainContactCoverage.emailReadyCount}/{captainContactCoverage.total}</strong>
                        <span style={captainContactMetricTextStyle}>email saved</span>
                      </div>
                      <div style={captainContactMetricStyle}>
                        <span style={captainContactMetricLabelStyle}>Needs a path</span>
                        <strong>{captainContactCoverage.unreachableCount}</strong>
                        <span style={captainContactMetricTextStyle}>no mobile or email</span>
                      </div>
                    </div>
                    <div style={captainContactHubActionsStyle}>
                      <Link href={captainContactReviewHref} style={rosterPeopleContactLinkStyle}>
                        {captainContactCoverage.missingPhoneNames.length ? 'Add missing mobiles' : 'Review contacts'}
                      </Link>
                      <Link href={teamContactsHref} style={rosterPeopleChatLinkStyle}>Manage contacts</Link>
                    </div>
                    <div style={captainContactPreviewGridStyle}>
                      {roster.map((player) => {
                        const contact = captainContactByPlayerName.get(normalizeCaptainRosterContactKey(player.name))
                        const phone = contact?.phone?.trim() || ''
                        const email = contact?.email?.trim() || ''
                        return (
                          <article key={`contact-${player.id}`} style={captainContactPreviewCardStyle}>
                            <div style={captainContactPreviewHeaderStyle}>
                              <div style={captainContactPreviewIdentityStyle}>
                                <strong>{player.name}</strong>
                                <span>{contact?.is_captain ? 'Captain' : contact?.role || 'Player'}</span>
                              </div>
                              <span style={phone ? captainContactReadyBadgeStyle : captainContactMissingBadgeStyle}>
                                {phone ? 'Text ready' : 'Add mobile'}
                              </span>
                            </div>
                            <div style={captainContactPreviewDetailsStyle}>
                              <span>{phone || 'No mobile saved'}</span>
                              <span>{email || 'No email saved'}</span>
                            </div>
                            <div style={captainContactPreviewActionsStyle}>
                              {phone ? <a href={`sms:${phone.replace(/[^+\d]/g, '')}`} style={rosterContactTextLinkStyle}>Text</a> : null}
                              {email ? <a href={`mailto:${email}`} style={rosterContactManageLinkStyle}>Email</a> : null}
                              {!phone || !email ? <Link href={teamContactsHref} style={rosterContactManageLinkStyle}>Update</Link> : null}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </div>
                </details>
              ) : null}

              {showRosterFilters && showRosterTools ? (
                <>
                  <div style={rosterFilterRow}>
                    {rosterFilterOptions.filter((option) => !isMobile || option.count > 0).map((option) => {
                      const active = activeRosterFilter === option.key
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setRosterFilter(option.key)}
                          style={active ? rosterFilterButtonActive : rosterFilterButton}
                        >
                          <span>{isMobile ? option.label.replace(' options', '') : option.label}</span>
                          <span style={rosterFilterCount}>{option.count}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div style={rosterFilterHint}>
                    {activeRosterFilter === 'played'
                      ? 'Players who have already appeared in reviewed scorecards.'
                      : activeRosterFilter === 'roster-only'
                        ? 'Rostered players who have not played yet.'
                        : activeRosterFilter === 'singles'
                          ? 'Roster sorted by singles strength.'
                          : activeRosterFilter === 'doubles'
                            ? 'Roster sorted by doubles strength.'
                            : 'Full roster from Player Roster and match history.'}
                  </div>
                </>
              ) : null}

              {isMobile && showFullRoster ? (
                <label style={rosterSearchFieldStyle}>
                  <span>Find a teammate</span>
                  <input
                    type="search"
                    value={rosterSearch}
                    onChange={(event) => setRosterSearch(event.target.value)}
                    placeholder="Search this roster"
                    style={rosterSearchInputStyle}
                  />
                </label>
              ) : null}

              {showRosterTools && selectedRosterPlayerIds.length > 0 ? <div style={rosterCompareTray}>
                <div style={sectionHeadingCopyStyle}>
                  <div style={rosterCompareKicker}>Matchup</div>
                  <div style={rosterCompareTitle}>
                    {selectedRosterPlayers.length === 1
                      ? `${selectedRosterPlayers[0].name} selected — choose one more player`
                      : selectedRosterPlayers.map((player) => player.name).join(' vs ')}
                  </div>
                </div>
                <div style={rosterCompareActions}>
                  {selectedRosterPlayerIds.length ? (
                    <button
                      type="button"
                      onClick={() => setSelectedRosterPlayerIds([])}
                      style={rosterCompareClearButton}
                    >
                      Clear
                    </button>
                  ) : null}
                  <Link
                    href={rosterCompareHref}
                    style={selectedRosterPlayerIds.length === 2 ? rosterCompareLinkReady : rosterCompareLinkDisabled}
                    aria-disabled={selectedRosterPlayerIds.length !== 2}
                    onClick={(event) => {
                      if (selectedRosterPlayerIds.length !== 2) event.preventDefault()
                    }}
                  >
                    Open Matchup
                  </Link>
                </div>
              </div> : null}

              <div style={dynamicRosterGrid}>
                {visibleRoster.map((player) => {
                  const selected = selectedRosterPlayerIds.includes(player.id)
                  const singlesRating = player.singles_dynamic_rating ?? player.overall_dynamic_rating
                  const doublesRating = player.doubles_dynamic_rating ?? player.overall_dynamic_rating
                  const ustaRating = player.overall_rating
                  const contact = captainContactByPlayerName.get(normalizeCaptainRosterContactKey(player.name))
                  const isPendingLink = player.id.startsWith('summary:')
                  return (
                    <article key={player.id} style={mobileRosterCardStyle}>
                      <div style={mobileRosterHeaderStyle}>
                        <div style={mobileRosterIdentityStyle}>
                          {isPendingLink ? <strong>{player.name}</strong> : (
                            <Link href={`/players/${player.id}`} style={playerLink}><strong>{player.name}</strong></Link>
                          )}
                          {player.location ? <span style={mutedText}>{player.location}</span> : null}
                        </div>
                        {isPendingLink ? <span style={mobileRosterPendingStyle}>Link pending</span> : showRosterTools ? (
                          <button
                            type="button"
                            onClick={() => handleRosterCompareToggle(player.id)}
                            style={selected ? rosterSelectButtonActive : rosterSelectButton}
                            aria-pressed={selected}
                          >
                            {selected ? 'Selected' : 'Compare'}
                          </button>
                        ) : null}
                      </div>

                      <div style={mobileRosterCompactRowStyle}>
                        <dl style={dynamicRosterMetricGrid} aria-label={`${player.name} roster stats`}>
                          {!isDoublesOnlyTeam ? <div style={mobileRosterMetricStyle}>
                            <dt style={mobileRosterMetricLabelStyle}>TiQ singles</dt>
                            <dd style={mobileRosterMetricValueStyle}>{formatRating(singlesRating)}</dd>
                          </div> : null}
                          <div style={mobileRosterMetricStyle}>
                            <dt style={mobileRosterMetricLabelStyle}>TiQ doubles</dt>
                            <dd style={mobileRosterMetricValueStyle}>{formatRating(doublesRating)}</dd>
                          </div>
                          <div style={mobileRosterMetricStyle}>
                            <dt style={mobileRosterMetricLabelStyle}>USTA</dt>
                            <dd style={mobileRosterMetricValueStyle}>{formatRating(ustaRating)}</dd>
                          </div>
                        </dl>
                        <span style={rosterPlayerRecordStyle}>{player.appearances} starts · {player.wins}-{player.losses}</span>
                      </div>

                      <div style={rosterCardFooterStyle}>
                        <div style={rosterActionRow}>
                          {!isPendingLink ? <Link href={`/players/${player.id}`} style={rosterActionLink}>Profile</Link> : null}
                          {!isPendingLink && access.canUseAdvancedPlayerInsights ? (
                            <Link href={`/matchup?type=singles&playerA=${encodeURIComponent(player.id)}`} style={rosterActionLinkAccent}>Matchup</Link>
                          ) : null}
                          {isLinkedTeamMember ? <Link href={teamRoomHref} style={rosterActionLink}>Team chat</Link> : null}
                        </div>
                        {canManageThisTeam ? (
                          <div style={rosterContactActionRowStyle}>
                            {contact?.phone ? (
                              <a href={`sms:${contact.phone.replace(/[^+\d]/g, '')}`} style={rosterContactTextLinkStyle}>
                                Text {contact.phone}
                              </a>
                            ) : <Link href={teamContactsHref} style={rosterContactManageLinkStyle}>Add mobile</Link>}
                            <Link href={teamContactsHref} style={rosterContactManageLinkStyle}>Contact details</Link>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
              {filteredRoster.length > mobileRosterPreviewLimit ? (
                <div style={tableControlRowStyle}>
                  <button type="button" onClick={toggleFullRoster} style={tableToggleButtonStyle}>
                    {showFullRoster ? 'Return to lineup snapshot' : `Explore all ${filteredRoster.length} players`}
                  </button>
                </div>
              ) : null}
            </>
          ) : tennisRecordRoster.length ? (
            <div style={stackList}>
              <p style={bodyText}>These players were explicitly listed in an external public roster. They are source context only until a verified roster or scorecard confirms the TenAceIQ team record.</p>
              {tennisRecordRoster.map((player) => (
                <div key={`${player.canonical_player_id || 'source'}-${player.player_name}`} style={dynamicListRow}>
                  <div style={listRowCopyStyle}>
                    {player.canonical_player_id ? <Link href={`/players/${player.canonical_player_id}`} style={playerLink}><strong>{player.player_name}</strong></Link> : <strong>{player.player_name}</strong>}
                    <div style={mutedText}>Recorded team listing</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={emptyStateBlock}>
              <p style={emptyState}>
                {teamExistsFromSummary
                  ? 'This team exists in the imported standings, but its roster was not captured yet.'
                  : 'No roster players are linked to this team yet.'}
              </p>
              <p style={mutedText}>
                {teamExistsFromSummary
                  ? `Standings can create the ${team} team shell before its players are connected. Open ${team}'s Player Roster in TennisLink and import it, or import scorecards to build usage history.`
                  : 'Import this team’s Player Roster, or import scorecards to add player usage.'}
              </p>
            </div>
          )}
        </section>
        ) : null}
      </section>
  )
}

function RetryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...buttonSecondary,
        borderColor: hovered ? 'rgba(116,190,255,0.34)' : 'rgba(116,190,255,0.18)',
        background: hovered
          ? 'linear-gradient(180deg, rgba(68,130,230,0.24) 0%, rgba(35,75,148,0.20) 100%)'
          : buttonSecondary.background,
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'all 140ms ease',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...buttonPrimary,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered
          ? '0 20px 40px rgba(74,222,128,0.24)'
          : '0 16px 32px rgba(74,222,128,0.14)',
        transition: 'transform 140ms ease, box-shadow 140ms ease',
      }}
    >
      {children}
    </Link>
  )
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...buttonSecondary,
        borderColor: hovered ? 'rgba(116,190,255,0.34)' : 'rgba(116,190,255,0.18)',
        background: hovered
          ? 'linear-gradient(180deg, rgba(68,130,230,0.24) 0%, rgba(35,75,148,0.20) 100%)'
          : buttonSecondary.background,
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'all 140ms ease',
      }}
    >
      {children}
    </Link>
  )
}

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...buttonGhost,
        borderColor: hovered ? 'rgba(116,190,255,0.26)' : 'rgba(116,190,255,0.18)',
        background: hovered ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.06)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'all 140ms ease',
      }}
    >
      {children}
    </Link>
  )
}

function MetricCard({
  label,
  value,
  subtle,
  compact = false,
}: {
  label: string
  value: string
  subtle: string
  compact?: boolean
}) {
  return (
    <div style={compact ? mobileSummaryMetricCard : summaryMetricCard}>
      <div style={compact ? mobileSummaryMetricLabel : summaryMetricLabel}>{label}</div>
      <div style={compact ? mobileSummaryMetricValue : summaryMetricValue}>{value}</div>
      {!compact ? <div style={summaryHintSmall}>{subtle}</div> : null}
    </div>
  )
}

const pageContent: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  minWidth: 0,
  margin: '0 auto',
  padding: '18px 0 0',
  display: 'grid',
  gap: '18px',
  boxSizing: 'border-box',
  overflowX: 'clip',
}

const teamSectionNavStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: 'fit-content',
  maxWidth: '100%',
  margin: '0 auto -6px',
  padding: 5,
  overflowX: 'auto',
  overscrollBehaviorX: 'contain',
  borderRadius: 999,
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(8, 13, 28, 0.78)',
  boxSizing: 'border-box',
}

const teamSectionNavLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '0 13px',
  borderRadius: 999,
  color: 'var(--foreground)',
  fontSize: 13,
  fontWeight: 850,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

const teamSectionNavMobileStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 4,
  width: '100%',
  margin: '0 0 -6px',
  padding: 4,
  borderRadius: 16,
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(8, 13, 28, 0.78)',
  boxSizing: 'border-box',
}

const teamSectionNavLinkMobileStyle: CSSProperties = {
  ...teamSectionNavLinkStyle,
  minWidth: 0,
  padding: '0 5px',
  borderRadius: 12,
  fontSize: 11,
  whiteSpace: 'normal',
  textAlign: 'center',
  lineHeight: 1.15,
}

const heroShell: CSSProperties = {
  position: 'relative',
  display: 'grid',
  minWidth: 0,
  borderRadius: '34px',
  overflow: 'hidden',
  border: '1px solid rgba(125, 211, 252, 0.22)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2, 8, 23, 0.48)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
}

const heroBackLinkStyle: CSSProperties = {
  display: 'flex',
  width: 'fit-content',
  marginBottom: 12,
  color: 'var(--brand-blue-2)',
  fontSize: 13,
  fontWeight: 800,
  textDecoration: 'none',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '-118px',
  width: 'min(100%, 310px)',
  aspectRatio: '1552 / 1614',
  background: 'url("/brand/web/header-iq-compact.png") center / contain no-repeat',
  opacity: 0.14,
  pointerEvents: 'none',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  minHeight: '38px',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(125, 211, 252, 0.24)',
  background: 'rgba(15, 23, 42, 0.66)',
  color: 'var(--brand-blue-2)',
  fontWeight: 800,
  fontSize: '14px',
  marginBottom: '18px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const heroTitle: CSSProperties = {
  margin: '0 0 12px',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  lineHeight: 0.98,
  letterSpacing: 0,
  maxWidth: '760px',
  overflowWrap: 'anywhere',
}

const heroContextText: CSSProperties = {
  margin: '0 0 18px',
  color: 'var(--shell-copy-muted)',
  fontSize: '15px',
  lineHeight: 1.55,
  maxWidth: '560px',
  overflowWrap: 'anywhere',
}

const heroBadgeRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginBottom: '18px',
  minWidth: 0,
}

const heroActions: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  alignItems: 'center',
  minWidth: 0,
}

const buttonPrimary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 800,
  background: 'linear-gradient(135deg, rgba(155,225,29,0.32), rgba(34,211,238,0.16))',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(155,225,29,0.38)',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const buttonSecondary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 800,
  background: 'rgba(15, 23, 42, 0.74)',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(125, 211, 252, 0.22)',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const buttonGhost: CSSProperties = {
  ...buttonSecondary,
  background: 'rgba(8, 13, 28, 0.62)',
}

const followButtonWrap: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
}

const badgeBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const badgeBlue: CSSProperties = {
  ...badgeBase,
  background: 'rgba(56,189,248,0.14)',
  color: 'var(--foreground-strong)',
}

const badgeGreen: CSSProperties = {
  ...badgeBase,
  background: 'rgba(155,225,29,0.14)',
  color: 'var(--foreground-strong)',
}

const badgeSlate: CSSProperties = {
  ...badgeBase,
  background: 'rgba(15, 23, 42, 0.7)',
  color: 'var(--shell-copy-muted)',
}

const teamStatusPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  padding: '3px 9px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.03em',
  whiteSpace: 'normal' as const,
  overflowWrap: 'anywhere',
}

function getTeamPlayerStatus(player: Player): TeamRatingStatus | null {
  const base = player.overall_rating ?? null
  const usta = player.overall_usta_dynamic_rating ?? null
  if (base === null || usta === null) return null
  const diff = usta - base
  if (diff >= 0.15) return 'Bump Up Pace'
  if (diff >= 0.07) return 'Trending Up'
  if (diff > -0.07) return 'Holding'
  if (diff > -0.15) return 'At Risk'
  return 'Drop Watch'
}

function getTeamStatusStyle(status: TeamRatingStatus): CSSProperties {
  switch (status) {
    case 'Bump Up Pace': return { background: 'color-mix(in srgb, var(--brand-green) 14%, var(--shell-chip-bg) 86%)', color: 'var(--brand-lime)', border: '1px solid color-mix(in srgb, var(--brand-green) 26%, var(--shell-panel-border) 74%)' }
    case 'Trending Up':  return { background: 'color-mix(in srgb, #34d399 12%, var(--shell-chip-bg) 88%)', color: '#a7f3d0', border: '1px solid color-mix(in srgb, #34d399 24%, var(--shell-panel-border) 76%)' }
    case 'Holding':      return { background: 'color-mix(in srgb, var(--brand-blue-2) 11%, var(--shell-chip-bg) 89%)', color: 'var(--foreground-strong)', border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)' }
    case 'At Risk':      return { background: 'color-mix(in srgb, #fb923c 12%, var(--shell-chip-bg) 88%)', color: '#fed7aa', border: '1px solid color-mix(in srgb, #fb923c 24%, var(--shell-panel-border) 76%)' }
    case 'Drop Watch':   return { background: 'color-mix(in srgb, #ef4444 12%, var(--shell-chip-bg) 88%)', color: '#fecaca', border: '1px solid color-mix(in srgb, #ef4444 24%, var(--shell-panel-border) 76%)' }
  }
}

const summaryCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(125, 211, 252, 0.2)',
  background: 'rgba(8, 13, 28, 0.72)',
  padding: '18px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  minHeight: '100%',
  minWidth: 0,
  boxShadow: 'var(--shadow-soft)',
}

const mobileSummaryCard: CSSProperties = {
  ...summaryCard,
  padding: 14,
  borderRadius: 18,
  boxShadow: 'none',
}

const summaryTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: 0,
  marginBottom: '14px',
  overflowWrap: 'anywhere',
}

const mobileSummaryTitle: CSSProperties = {
  ...summaryTitle,
  marginBottom: 10,
  fontSize: 17,
}

const summaryMetricGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: '12px',
  minWidth: 0,
}

const mobileSummaryMetricGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 7,
  minWidth: 0,
}

const summaryMetricCard: CSSProperties = {
  borderRadius: '20px',
  padding: '14px',
  background: 'rgba(15, 23, 42, 0.72)',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  minWidth: 0,
}

const mobileSummaryMetricCard: CSSProperties = {
  minWidth: 0,
  padding: '10px 8px',
  borderRadius: 13,
  border: '1px solid rgba(125, 211, 252, 0.14)',
  background: 'rgba(15, 23, 42, 0.72)',
  textAlign: 'center',
}

const summaryMetricLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontWeight: 700,
  fontSize: '13px',
  marginBottom: '8px',
  overflowWrap: 'anywhere',
}

const mobileSummaryMetricLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 800,
  lineHeight: 1.2,
  marginBottom: 6,
  overflowWrap: 'anywhere',
}

const summaryMetricValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: 0,
  lineHeight: 1,
  overflowWrap: 'anywhere',
}

const mobileSummaryMetricValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 17,
  fontWeight: 900,
  lineHeight: 1.1,
  overflowWrap: 'anywhere',
}

const summaryHintSmall: CSSProperties = {
  marginTop: '8px',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.5,
  fontSize: '13px',
  overflowWrap: 'anywhere',
}

const summarySplitRowStyle: CSSProperties = {
  marginTop: 14,
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
  minWidth: 0,
}

const summarySplitItemStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  padding: '11px 12px',
  borderRadius: 14,
  border: '1px solid rgba(125, 211, 252, 0.14)',
  background: 'rgba(15, 23, 42, 0.48)',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 850,
  lineHeight: 1.2,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const summarySplitLabelStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const featuredTeamResultStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginTop: 14,
  paddingTop: 14,
  borderTop: '1px solid rgba(125, 211, 252, 0.14)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  minWidth: 0,
}

const resultWinMarkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
  width: 34,
  height: 34,
  borderRadius: '50%',
  border: '1px solid color-mix(in srgb, var(--brand-green) 52%, var(--shell-panel-border) 48%)',
  background: 'color-mix(in srgb, var(--brand-green) 14%, var(--shell-chip-bg) 86%)',
  color: 'var(--brand-lime)',
  fontSize: 13,
  fontWeight: 950,
}

const resultLossMarkStyle: CSSProperties = {
  ...resultWinMarkStyle,
  borderColor: 'color-mix(in srgb, var(--brand-blue-2) 52%, var(--shell-panel-border) 48%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 12%, var(--shell-chip-bg) 88%)',
  color: 'var(--brand-blue-2)',
}

const sourceHistoryMarkStyle: CSSProperties = {
  ...resultWinMarkStyle,
  color: 'var(--brand-blue-2)',
  fontSize: 24,
}

const featuredTeamResultCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  flex: 1,
  overflowWrap: 'anywhere',
}

const featuredTeamResultKickerStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 850,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const featuredTeamResultScoreStyle: CSSProperties = {
  flex: '0 1 auto',
  color: 'var(--brand-lime)',
  fontSize: 14,
  fontWeight: 950,
  textAlign: 'right',
  overflowWrap: 'anywhere',
}

const summaryHistoryLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  width: 'fit-content',
  marginTop: 14,
  color: 'var(--brand-blue-2)',
  fontSize: 13,
  fontWeight: 900,
  textDecoration: 'none',
}

const teamMatchPulseStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: '18px',
  borderRadius: 22,
  border: '1px solid rgba(155,225,29,0.2)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.1), rgba(8,13,28,0.84) 56%)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const teamMatchPulseHeadingStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const teamMatchPulseTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: 0,
  lineHeight: 1.08,
  overflowWrap: 'anywhere',
}

const teamMatchPulseActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '8px 12px',
  borderRadius: 12,
  border: '1px solid rgba(155,225,29,0.3)',
  background: 'rgba(155,225,29,0.1)',
  color: 'var(--brand-lime)',
  fontSize: 12,
  fontWeight: 900,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

const teamPulseCaptainPreviewStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minWidth: 0,
  padding: '12px 14px',
  borderRadius: 16,
  border: '1px solid rgba(88, 163, 255, 0.24)',
  background: 'rgba(13, 35, 59, 0.62)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
}

const teamPulseCaptainCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  fontSize: 14,
  lineHeight: 1.3,
  overflowWrap: 'anywhere',
}

const teamPulseCaptainArrowStyle: CSSProperties = {
  flex: '0 0 auto',
  color: 'var(--brand-lime)',
  fontSize: 20,
  fontWeight: 900,
}

const teamNextMatchReadStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  padding: '13px 14px',
  borderRadius: 16,
  border: '1px solid rgba(155,225,29,0.25)',
  background: 'rgba(5,21,28,0.58)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const teamMatchPulseMetricGridStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const teamPulseMetricStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  padding: '12px 13px',
  borderRadius: 15,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(8,13,28,0.52)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const teamPulseLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const teamPulseDetailStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 650,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const captainAccessTeaseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
  minWidth: 0,
  padding: '18px 20px',
  borderRadius: 22,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 26%, var(--shell-panel-border) 74%)',
  background: 'rgba(8, 13, 28, 0.72)',
}

const captainAccessCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  maxWidth: 620,
}

const captainAccessTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.16,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const captainAccessTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
}

const recentFormRowStyle: CSSProperties = {
  marginTop: 10,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
}

const teamWeekPathStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 0.8fr) minmax(0, 1.2fr)',
  gap: '18px',
  alignItems: 'stretch',
  minWidth: 0,
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(155,225,29,0.20)',
  background: 'linear-gradient(135deg, rgba(8,13,28,0.82), rgba(15,23,42,0.72))',
  boxShadow: 'var(--shadow-soft)',
})

const teamWeekPathCopyStyle: CSSProperties = {
  minWidth: 0,
  alignSelf: 'center',
  overflowWrap: 'anywhere',
}

const teamWeekPathTitleStyle: CSSProperties = {
  margin: '8px 0 0',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '26px',
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const teamWeekPathTextStyle: CSSProperties = {
  margin: '10px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: '15px',
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
}

const teamWeekPathGridStyle = (isSmallMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
  gap: '12px',
  minWidth: 0,
})

const teamWeekActionCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto auto minmax(0, 1fr)',
  gap: '7px',
  minWidth: 0,
  minHeight: 146,
  padding: '15px',
  borderRadius: '18px',
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const teamWeekActionQuestionStyle: CSSProperties = {
  color: 'var(--brand-lime)',
  fontSize: '12px',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  overflowWrap: 'anywhere',
}

const teamWeekActionTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '17px',
  fontWeight: 900,
  lineHeight: 1.25,
  overflowWrap: 'anywhere',
}

const teamWeekActionTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
}

const cardGridStyle: CSSProperties = {
  display: 'grid',
  gap: '18px',
  minWidth: 0,
}

const surfaceCard: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(8, 13, 28, 0.66)',
  boxShadow: 'var(--shadow-soft)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  minWidth: 0,
}

const surfaceCardStrong: CSSProperties = {
  ...surfaceCard,
  background: 'rgba(8, 13, 28, 0.76)',
}

const detailDrawerStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const detailDrawerSummaryStyle: CSSProperties = {
  ...surfaceCard,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  cursor: 'pointer',
  listStyle: 'none',
}

const detailDrawerCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const detailDrawerTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  lineHeight: 1.2,
  overflowWrap: 'anywhere',
}

const detailDrawerContentStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const sectionHeadingRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  marginBottom: '16px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const sectionHeadingCopyStyle: CSSProperties = {
  display: 'grid',
  gap: '2px',
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
}

const sectionHeadingTextStyle: CSSProperties = {
  margin: '8px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.5,
  maxWidth: 620,
  overflowWrap: 'anywhere',
}

const sectionKicker: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: 0,
  overflowWrap: 'anywhere',
}

const sectionTitle: CSSProperties = {
  margin: '8px 0 0',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const panelCountPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  minHeight: '32px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(125, 211, 252, 0.2)',
  background: 'rgba(15, 23, 42, 0.68)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 900,
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

const teamAwardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: '12px',
  minWidth: 0,
}

const teamAwardCardStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
  minWidth: 0,
  padding: '14px',
  borderRadius: '18px',
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.10), rgba(116,190,255,0.06))',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const teamAwardCodeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '42px',
  minHeight: '30px',
  borderRadius: '999px',
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'rgba(155,225,29,0.13)',
  color: 'var(--brand-lime)',
  fontSize: '12px',
  fontWeight: 900,
}

const teamAwardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  fontWeight: 900,
  lineHeight: 1.25,
}

const teamAwardMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  lineHeight: 1.45,
}

const bodyText: CSSProperties = {
  margin: '10px 0 0',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
}

const stackList: CSSProperties = {
  display: 'grid',
  gap: '12px',
  minWidth: 0,
}

const listRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  gap: '14px',
  padding: '14px',
  borderRadius: '18px',
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
  minWidth: 0,
}

const listRowCopyStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const ratingStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 5,
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
}

const mutedText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.55,
  fontSize: '0.92rem',
  marginTop: '4px',
  overflowWrap: 'anywhere',
}

const rosterFilterRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '10px',
  minWidth: 0,
}

const rosterFilterButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '7px',
  maxWidth: '100%',
  minHeight: '44px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(15, 23, 42, 0.66)',
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const rosterFilterButtonActive: CSSProperties = {
  ...rosterFilterButton,
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'rgba(155,225,29,0.14)',
  color: 'var(--foreground-strong)',
}

const rosterFilterCount: CSSProperties = {
  minWidth: '22px',
  height: '22px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '999px',
  background: 'rgba(8, 13, 28, 0.72)',
  color: 'inherit',
  fontSize: '11px',
}

const rosterFilterHint: CSSProperties = {
  margin: '0 0 12px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const rosterSearchFieldStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  marginBottom: 12,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 850,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const rosterSearchInputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 44,
  padding: '0 12px',
  boxSizing: 'border-box',
  borderRadius: 12,
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(8, 13, 28, 0.6)',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  outline: 'none',
}

const rosterCompareTray: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '14px',
  flexWrap: 'wrap',
  margin: '0 0 14px',
  padding: '14px 16px',
  borderRadius: '18px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 26%, var(--shell-panel-border) 74%)',
  background: 'rgba(155,225,29,0.1)',
  minWidth: 0,
}

const rosterCompareKicker: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '11px',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '5px',
  overflowWrap: 'anywhere',
}

const rosterCompareTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const rosterCompareActions: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const rosterCompareClearButton: CSSProperties = {
  maxWidth: '100%',
  minHeight: '44px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const rosterCompareLinkReady: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: '44px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'rgba(155,225,29,0.14)',
  color: '#d9f84a',
  fontSize: '12px',
  fontWeight: 900,
  textDecoration: 'none',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const rosterCompareLinkDisabled: CSSProperties = {
  ...rosterCompareLinkReady,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(224,234,247,0.44)',
  cursor: 'not-allowed',
}

const rosterSelectButton: CSSProperties = {
  maxWidth: '100%',
  minHeight: '44px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(255,255,255,0.04)',
  color: '#dbeafe',
  fontSize: '12px',
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const rosterSelectButtonActive: CSSProperties = {
  ...rosterSelectButton,
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'rgba(155,225,29,0.14)',
  color: '#d9f84a',
}

const emptyState: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  margin: 0,
  lineHeight: 1.65,
  overflowWrap: 'anywhere',
}

const emptyStateBlock: CSSProperties = {
  display: 'grid',
  gap: '8px',
  minWidth: 0,
}

const helperCallout: CSSProperties = {
  marginTop: '14px',
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  minHeight: '34px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(15, 23, 42, 0.68)',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  color: 'var(--foreground)',
  fontSize: '13px',
  fontWeight: 700,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const opponentBreakdownDetailsStyle: CSSProperties = {
  marginBottom: 14,
  borderRadius: 16,
  border: '1px solid rgba(125, 211, 252, 0.14)',
  background: 'rgba(15, 23, 42, 0.42)',
  overflow: 'hidden',
}

const opponentBreakdownSummaryStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
  padding: '13px 14px',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 850,
  cursor: 'pointer',
}

const opponentBreakdownCountStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 26,
  minHeight: 26,
  padding: '0 7px',
  borderRadius: 999,
  background: 'rgba(116, 190, 255, 0.12)',
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 900,
}

const opponentBreakdownBodyStyle: CSSProperties = {
  padding: '0 12px 12px',
}

const opponentListStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const opponentCardStyle = (isSmallMobile: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: isSmallMobile ? 'column' : 'row',
  justifyContent: 'space-between',
  alignItems: isSmallMobile ? 'stretch' : 'center',
  gap: 14,
  minWidth: 0,
  padding: isSmallMobile ? '14px' : '14px 16px',
  borderRadius: 16,
  border: '1px solid rgba(125, 211, 252, 0.14)',
  background: 'rgba(15, 23, 42, 0.5)',
})

const opponentIdentityStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
}

const opponentNameStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const opponentRecordStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
  minWidth: 'min(100%, 250px)',
}

const opponentMetricStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
  padding: '8px 10px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.035)',
  color: 'var(--foreground)',
  textAlign: 'center',
  overflowWrap: 'anywhere',
}

const mobileMatchListStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const mobileMatchGroupStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const mobileMatchGroupTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const mobileMatchGroupCardsStyle: CSSProperties = {
  display: 'grid',
  gap: 0,
  minWidth: 0,
  overflow: 'hidden',
  borderRadius: 16,
  border: '1px solid rgba(125, 211, 252, 0.14)',
  background: 'rgba(15, 23, 42, 0.42)',
}

const mobileMatchCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: '13px 14px',
  borderBottom: '1px solid rgba(125, 211, 252, 0.12)',
}

const mobileMatchCardHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  minWidth: 0,
}

const mobileMatchIdentityStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
}

const mobileMatchDateStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 700,
}

const mobileMatchOpponentStyle: CSSProperties = {
  minWidth: 0,
  fontSize: 16,
  overflowWrap: 'anywhere',
}

const mobileMatchFactsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const teamSeasonScopeStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: 8,
  alignItems: 'center',
  marginTop: 16,
  minWidth: 0,
}

const teamSeasonScopeLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  overflowWrap: 'anywhere',
}

const teamSeasonScopeControlsStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
}

const teamSeasonScopeButtonStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.10)',
  color: 'var(--shell-copy-muted)',
}

const teamSeasonScopeButtonActiveStyle: CSSProperties = {
  background: 'color-mix(in srgb, var(--brand-green) 16%, transparent)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, transparent)',
  color: 'var(--foreground-strong)',
  boxShadow: '0 10px 24px color-mix(in srgb, var(--brand-green) 12%, transparent)',
}

const teamSeasonScopeDetailStyle: CSSProperties = {
  gridColumn: '1 / -1',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.4,
  overflowWrap: 'anywhere',
}

const activityFilterControlsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 6,
  marginBottom: 12,
  minWidth: 0,
}

const activityFilterButtonStyle: CSSProperties = {
  minHeight: 40,
  minWidth: 0,
  border: '1px solid rgba(125, 211, 252, 0.14)',
  borderRadius: 12,
  background: 'rgba(15, 23, 42, 0.45)',
  color: 'var(--shell-copy-muted)',
  padding: '6px 8px',
  fontSize: 11,
  fontWeight: 850,
  lineHeight: 1.15,
  textAlign: 'center',
  cursor: 'pointer',
  overflowWrap: 'anywhere',
}

const activityFilterButtonActiveStyle: CSSProperties = {
  borderColor: 'rgba(155, 225, 29, 0.32)',
  background: 'rgba(155, 225, 29, 0.12)',
  color: 'var(--foreground-strong)',
}

const seasonFilterButtonStyle: CSSProperties = {
  minHeight: 44,
  padding: '5px 11px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const tableControlRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginTop: 12,
  minWidth: 0,
}

const tableToggleButtonStyle: CSSProperties = {
  ...seasonFilterButtonStyle,
  border: '1px solid rgba(125, 211, 252, 0.22)',
  background: 'rgba(15, 23, 42, 0.72)',
  color: 'var(--foreground-strong)',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const tableWrap: CSSProperties = {
  width: '100%',
  overflowX: 'auto',
  overscrollBehaviorX: 'contain',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'thin',
  minWidth: 0,
  maxWidth: '100%',
  borderRadius: '18px',
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
}

const dataTable: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 680,
}

const tableHeaderCell: CSSProperties = {
  textAlign: 'left',
  padding: '14px',
  background: 'rgba(8, 13, 28, 0.78)',
  color: '#c7dbff',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  whiteSpace: 'nowrap',
}

const tableCell: CSSProperties = {
  padding: '14px',
  borderTop: '1px solid rgba(125, 211, 252, 0.14)',
  color: 'var(--foreground)',
  verticalAlign: 'top',
  overflowWrap: 'normal',
}

const scoreCellStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 8,
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
}

const reportStatusBadgeStyle = (status: MatchAccuracyReport['status']): CSSProperties => {
  const resolved = status === 'resolved'
  const rejected = status === 'rejected'
  const reviewing = status === 'reviewing'
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'fit-content',
    maxWidth: '100%',
    borderRadius: 999,
    border: `1px solid ${resolved ? 'rgba(155,225,29,0.20)' : rejected ? 'rgba(239,68,68,0.18)' : reviewing ? 'rgba(116,190,255,0.18)' : 'var(--shell-panel-border)'}`,
    background: resolved
      ? 'rgba(155,225,29,0.10)'
      : rejected
        ? 'rgba(239,68,68,0.10)'
        : reviewing
          ? 'rgba(116,190,255,0.10)'
          : 'rgba(148,163,184,0.10)',
    color: resolved ? '#d9f84a' : rejected ? '#fca5a5' : reviewing ? '#93c5fd' : 'var(--shell-copy-muted)',
    padding: '4px 9px',
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
  }
}

const mobileRosterCardStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
  minWidth: 0,
  padding: '13px 14px',
  borderRadius: 18,
  border: '1px solid rgba(125, 211, 252, 0.14)',
  background: 'rgba(15, 23, 42, 0.42)',
}

const mobileRosterHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  minWidth: 0,
}

const mobileRosterIdentityStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  fontSize: 15,
  overflowWrap: 'anywhere',
}

const mobileRosterPendingStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 9px',
  borderRadius: 999,
  background: 'rgba(148, 163, 184, 0.10)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap',
}

const mobileRosterMetricGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
  flex: '1 1 190px',
  minWidth: 0,
  margin: 0,
}

const mobileRosterMetricStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
  color: 'var(--foreground-strong)',
  textAlign: 'left',
  overflowWrap: 'anywhere',
}

const mobileRosterMetricLabelStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 750,
}

const mobileRosterMetricValueStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 850,
}

const mobileRosterCompactRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
  paddingTop: 9,
  borderTop: '1px solid rgba(125, 211, 252, 0.10)',
}

const playerLink: CSSProperties = {
  color: 'var(--foreground)',
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const rosterActionRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const rosterPeopleHubStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 14,
  minWidth: 0,
  margin: '2px 0 16px',
  padding: '14px 16px',
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.25)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.10), rgba(56,189,248,0.07))',
}

const rosterPeopleHubCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const rosterPeopleHubActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const rosterPeopleContactLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.30)',
  background: 'rgba(155,225,29,0.12)',
  color: '#d9f84a',
  fontSize: 12,
  fontWeight: 900,
  textDecoration: 'none',
  textAlign: 'center',
}

const rosterPeopleChatLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(255,255,255,0.04)',
  color: '#dbeafe',
  fontSize: 12,
  fontWeight: 900,
  textDecoration: 'none',
  textAlign: 'center',
}

const captainContactHubStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  margin: '0 0 18px',
  borderRadius: 20,
  border: '1px solid rgba(155,225,29,0.26)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.09), rgba(56,189,248,0.06))',
  overflow: 'hidden',
}

const captainContactHubSummaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  minWidth: 0,
  padding: '16px',
  cursor: 'pointer',
  listStyle: 'none',
}

const captainContactHubSummaryTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
}

const captainContactHubSummaryBadgeStyle: CSSProperties = {
  flex: '0 0 auto',
  maxWidth: '48%',
  padding: '7px 10px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.11)',
  color: '#d9f84a',
  fontSize: 11,
  fontWeight: 900,
  textAlign: 'center',
  overflowWrap: 'anywhere',
}

const captainContactHubContentStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: '0 16px 16px',
}

const captainContactPrivacyNoteStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
}

const captainContactMetricGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainContactMetricStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  padding: '12px',
  borderRadius: 14,
  border: '1px solid rgba(125, 211, 252, 0.14)',
  background: 'rgba(5, 12, 28, 0.48)',
  color: 'var(--foreground-strong)',
}

const captainContactMetricLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
}

const captainContactMetricTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.35,
}

const captainContactHubActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const captainContactPreviewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 225px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainContactPreviewCardStyle: CSSProperties = {
  display: 'grid',
  gap: 11,
  minWidth: 0,
  padding: '13px',
  borderRadius: 16,
  border: '1px solid rgba(125, 211, 252, 0.14)',
  background: 'rgba(5, 12, 28, 0.50)',
}

const captainContactPreviewHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
}

const captainContactPreviewIdentityStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const captainContactPreviewDetailsStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.4,
  overflowWrap: 'anywhere',
}

const captainContactPreviewActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const captainContactReadyBadgeStyle: CSSProperties = {
  flex: '0 0 auto',
  padding: '5px 8px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.10)',
  color: '#d9f84a',
  fontSize: 10,
  fontWeight: 900,
  textAlign: 'center',
}

const captainContactMissingBadgeStyle: CSSProperties = {
  ...captainContactReadyBadgeStyle,
  border: '1px solid rgba(251, 191, 36, 0.28)',
  background: 'rgba(251, 191, 36, 0.10)',
  color: '#fde68a',
}

const rosterContactActionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
  paddingTop: 10,
  borderTop: '1px solid rgba(125, 211, 252, 0.10)',
}

const rosterContactTextLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 36,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.10)',
  color: '#d9f84a',
  fontSize: 11,
  fontWeight: 900,
  textDecoration: 'none',
  textAlign: 'center',
}

const rosterContactManageLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 36,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(255,255,255,0.04)',
  color: '#dbeafe',
  fontSize: 11,
  fontWeight: 900,
  textDecoration: 'none',
  textAlign: 'center',
}

const rosterCardGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const rosterCardFooterStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  paddingTop: 10,
  borderTop: '1px solid rgba(125, 211, 252, 0.10)',
}

const rosterPlayerRecordStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap',
}

const rosterActionLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  minHeight: '44px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(255,255,255,0.04)',
  color: '#dbeafe',
  fontSize: '12px',
  fontWeight: 900,
  textDecoration: 'none',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const rosterActionLinkAccent: CSSProperties = {
  ...rosterActionLink,
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.10)',
  color: '#d9f84a',
}

