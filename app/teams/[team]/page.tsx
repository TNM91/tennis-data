'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import React from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { buildCaptainScopedHref } from '@/lib/captain-memory'
import {
  getCompetitionLayerLabel,
  inferCompetitionLayerFromValues,
} from '@/lib/competition-layers'
import { buildScopedTeamEntityId } from '@/lib/entity-ids'
import { supabase } from '@/lib/supabase'
import { decodeTeamRouteSegment } from '@/lib/team-routes'
import {
  listTiqTeamParticipations,
  type TiqLeagueStorageSource,
  type TiqTeamParticipationRecord,
} from '@/lib/tiq-league-service'
import SiteShell from '@/app/components/site-shell'
import DataTrustPanel from '@/app/components/data-trust-panel'
import PublicDetailState from '@/app/components/public-detail-state'
import { useAuth } from '@/app/components/auth-provider'
import FollowButton from '@/app/components/follow-button'
import MatchAccuracyReportButton from '@/app/components/match-accuracy-report-button'
import { formatDate, formatRating, cleanText, normalizeTeamName } from '@/lib/captain-formatters'
import {
  getReportStatusLabel,
  listMyMatchAccuracyReports,
  type MatchAccuracyReport,
} from '@/lib/match-accuracy-reports'
import { DATA_ASSIST_STORY, PRODUCT_MOTTO } from '@/lib/product-story'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { loadUserProfileLink } from '@/lib/user-profile'
import { loadRecentTiqAwards, type TiqAwardRecord } from '@/lib/tiq-awards-registry'
import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'

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

type RosterPlayer = Player & {
  appearances: number
  singlesAppearances: number
  doublesAppearances: number
  wins: number
  losses: number
}

const ROSTER_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('relentless-competitor-4-0')
const ROSTER_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(ROSTER_PLAYER_IDENTITY)
const ROSTER_LEVEL_UP_HREF = `/level-up/${ROSTER_PLAYER_IDENTITY.slug}#level-up-flow`
const ROSTER_PLAYER_DEVELOPMENT_HREF = `/player-development/${ROSTER_PLAYER_IDENTITY.slug}`

type PairingCard = {
  key: string
  names: string[]
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
  if (home === teamName) return 'A'
  if (away === teamName) return 'B'
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
  if (home === teamName) return away
  if (away === teamName) return home
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seasonFilter, setSeasonFilter] = useState<string>('all')
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('all')
  const [selectedRosterPlayerIds, setSelectedRosterPlayerIds] = useState<string[]>([])
  const [tiqParticipations, setTiqParticipations] = useState<TiqTeamParticipationRecord[]>([])
  const [tiqParticipationSource, setTiqParticipationSource] = useState<TiqLeagueStorageSource>('local')
  const [tiqParticipationWarning, setTiqParticipationWarning] = useState('')
  const [teamAwards, setTeamAwards] = useState<TiqAwardRecord[]>([])
  const [linkedPlayerId, setLinkedPlayerId] = useState<string | null>(null)
  const [linkedPlayerName, setLinkedPlayerName] = useState('')
  const [myMatchReports, setMyMatchReports] = useState<MatchAccuracyReport[]>([])
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const { userId: currentUserId, authResolved } = useAuth()

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

      // ── Line matches: fetch individual court results for player records ──
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

  const recentMatch = matches[0] || null
  const competitionLayer = inferCompetitionLayerFromValues({
    layerHint: layerFilter,
    leagueName: teamMeta.league,
    ustaSection: teamMeta.section,
    districtArea: teamMeta.district,
  })

  const record = useMemo(() => {
    let wins = 0
    let losses = 0

    matches.forEach((match) => {
      const result = didTeamWin(match, team)
      if (result === true) wins += 1
      if (result === false) losses += 1
    })

    return { wins, losses }
  }, [matches, team])

  const teamStreak = useMemo(() => {
    const results = matches
      .map((m) => didTeamWin(m, team))
      .filter((r): r is boolean => r !== null)
    if (results.length === 0) return null
    const type = results[0] ? 'W' : 'L'
    let count = 0
    for (const r of results) {
      if ((r ? 'W' : 'L') === type) count++
      else break
    }
    return { count, type }
  }, [matches, team])

  const matchTypeSplit = useMemo(() => {
    let singlesW = 0, singlesL = 0, doublesW = 0, doublesL = 0
    for (const match of matches) {
      const won = didTeamWin(match, team)
      if (won === null) continue
      if (match.match_type === 'singles') { if (won) singlesW++; else singlesL++ }
      else { if (won) doublesW++; else doublesL++ }
    }
    return { singlesW, singlesL, doublesW, doublesL }
  }, [matches, team])

  const recentForm = useMemo(() => {
    return matches
      .slice(0, 10)
      .map((m) => didTeamWin(m, team))
      .filter((r): r is boolean => r !== null)
      .map((won) => (won ? 'W' : 'L'))
  }, [matches, team])

  const roster = useMemo<RosterPlayer[]>(() => {
    const map = new Map<string, RosterPlayer>()

    rosterMembers.forEach((entry) => {
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
      // ── New data path: individual court outcomes from line matches ──
      const lineMatchLookup = new Map(lineMatches.map((lm) => [lm.id, lm]))
      // Map parent external_match_id prefix → parent TeamMatch for team-side lookup
      const parentByExternalId = new Map(
        matches.map((m) => [cleanText(m.external_match_id) ?? '', m]),
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
      // ── Legacy data path: match_players linked directly to parent matches ──
      const matchLookup = new Map(matches.map((match) => [match.id, match]))

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
  }, [lineMatches, linePlayers, matches, players, rosterMembers, team])

  const teamExistsFromSummary = summaryTeams.length > 0

  const hotPlayers = useMemo(() => {
    return roster.filter((p) => {
      const base = p.overall_rating ?? null
      const usta = p.overall_usta_dynamic_rating ?? null
      if (base === null || usta === null) return false
      return (usta - base) >= 0.07
    })
  }, [roster])

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

  const filteredRoster = useMemo(() => {
    const nextRoster = roster.filter((player) => {
      if (rosterFilter === 'played') return player.appearances > 0
      if (rosterFilter === 'roster-only') return player.appearances === 0
      return true
    })

    if (rosterFilter === 'singles') {
      return [...nextRoster].sort((a, b) => {
        const left = a.singles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        const right = b.singles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        if (right !== left) return right - left
        return a.name.localeCompare(b.name)
      })
    }

    if (rosterFilter === 'doubles') {
      return [...nextRoster].sort((a, b) => {
        const left = a.doubles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        const right = b.doubles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        if (right !== left) return right - left
        return a.name.localeCompare(b.name)
      })
    }

    return nextRoster
  }, [roster, rosterFilter])

  const rosterFilterOptions = useMemo<Array<{ key: RosterFilter; label: string; count: number }>>(() => [
    { key: 'all', label: 'All', count: roster.length },
    { key: 'played', label: 'Played', count: roster.filter((player) => player.appearances > 0).length },
    { key: 'roster-only', label: 'Roster only', count: roster.filter((player) => player.appearances === 0).length },
    { key: 'singles', label: 'Singles options', count: roster.length },
    { key: 'doubles', label: 'Doubles options', count: roster.length },
  ], [roster])

  const selectedRosterPlayers = useMemo(() => {
    return selectedRosterPlayerIds
      .map((id) => roster.find((player) => player.id === id) || null)
      .filter((player): player is RosterPlayer => Boolean(player))
  }, [roster, selectedRosterPlayerIds])

  const rosterCompareHref = selectedRosterPlayerIds.length === 2
    ? `/matchup?type=singles&playerA=${encodeURIComponent(selectedRosterPlayerIds[0])}&playerB=${encodeURIComponent(selectedRosterPlayerIds[1])}`
    : '/matchup'

  const rosterPlayerIdSignals = [
    {
      label: 'Roster IDs',
      value: roster.length ? `${roster.length} players` : 'Roster pending',
      body: roster.length
        ? 'Open each player record before turning team context into lineup or matchup decisions.'
        : 'Import roster or scorecard context so players can become searchable TenAceIQ records.',
    },
    {
      label: 'Compare next',
      value: selectedRosterPlayers.length === 2
        ? selectedRosterPlayers.map((player) => player.name).join(' vs ')
        : 'Select two players',
      body: 'Select two roster players to prep a singles matchup, or open a profile to review their player history first.',
    },
    {
      label: 'Captain handoff',
      value: 'Availability / Lineup',
      body: 'Use the same player IDs for availability, lineup building, pairing choices, and Data Assist review.',
    },
  ] as const
  const rosterPlayerIdStarterRead = [
    { label: 'Train first', value: ROSTER_PLAYER_IDENTITY_READ.trainingPriority },
    { label: 'Proof target', value: ROSTER_PLAYER_IDENTITY_READ.proofTarget },
    { label: 'Match test', value: ROSTER_PLAYER_IDENTITY_READ.matchTrigger },
  ] as const

  function handleRosterCompareToggle(playerId: string) {
    if (playerId.startsWith('summary:')) return

    setSelectedRosterPlayerIds((current) => {
      if (current.includes(playerId)) return current.filter((id) => id !== playerId)
      if (current.length >= 2) return [current[1], playerId]
      return [...current, playerId]
    })
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
      if (!existing.lastDate || (match.match_date && match.match_date > existing.lastDate)) {
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

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '26px 18px' : '34px 26px',
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1.2fr) minmax(min(100%, 300px), 0.85fr)',
    gap: isMobile ? '18px' : '22px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '42px' : '56px',
  }

  const dynamicMetricGrid: CSSProperties = {
    ...metricGridStyle,
    gridTemplateColumns: isSmallMobile
      ? 'minmax(0, 1fr)'
      : isTablet
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(4, minmax(0, 1fr))',
  }

  const dynamicCardGrid: CSSProperties = {
    ...cardGridStyle,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicHeroActions: CSSProperties = {
    ...heroActions,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'stretch' : 'center',
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
  const teamSignals = [
    {
      label: 'League type',
      value: getCompetitionLayerLabel(competitionLayer),
      note: competitionLayer === 'usta'
        ? 'Reviewed league, flight, and roster details stay together here.'
        : 'TenAceIQ league play, roster, and results stay together here.',
    },
    {
      label: 'Weekly planning',
      value: `${matches.length} matches tracked`,
      note: 'Move from roster review into availability, lineup building, pairings, and the team message.',
    },
    {
      label: 'TIQ leagues',
      value: tiqParticipations.length > 0 ? `${tiqParticipations.length} TIQ entries` : 'No TIQ entries yet',
      note: 'Use TIQ leagues when you want to run teams, schedules, rosters, and results in TenAceIQ.',
    },
  ]
  if (loading) {
    return (
      <section style={pageContent}>
        <PublicDetailState
          eyebrow="Team Intelligence"
          title="Opening team context."
          body="Pulling roster, recent matches, league scope, and Captain Tools paths so this team page starts with useful tennis context."
          signals={[
            { label: 'Source', value: 'Rosters, scorecards, team summaries' },
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
        <section style={dynamicHeroShell}>
          <span aria-hidden="true" style={watermarkStyle} />
          <div>
            <p style={eyebrow}>Team Intelligence</p>
            <h1 style={dynamicHeroTitle}>{team || 'Team Detail'}</h1>
            <p style={heroText}>
              {PRODUCT_MOTTO} See the roster, recent form, singles strength, doubles options, and the Team Hub context that helps captains plan the week.
            </p>

            <div style={heroBadgeRow}>
              <span style={badgeSlate}>{getCompetitionLayerLabel(competitionLayer)}</span>
              {teamMeta.league ? <span style={badgeBlue}>{teamMeta.league}</span> : null}
              {teamMeta.flight ? <span style={badgeGreen}>{teamMeta.flight}</span> : null}
              {teamMeta.section ? <span style={badgeSlate}>{teamMeta.section}</span> : null}
              <span style={badgeSlate}>{matches.length} matches tracked</span>
              {teamStreak && teamStreak.count >= 2 ? (
                <span style={teamStreak.type === 'W' ? badgeGreen : badgeRed}>
                  {teamStreak.count} {teamStreak.type === 'W' ? 'win' : 'loss'} streak
                </span>
              ) : null}
              {hotPlayers.length > 0 ? (
                <span style={badgeGreen}>{hotPlayers.length} hot player{hotPlayers.length > 1 ? 's' : ''}</span>
              ) : null}
              {tiqParticipations.length > 0 ? <span style={badgeGreen}>{tiqParticipations.length} TIQ leagues entered</span> : null}
              {teamAwards.length > 0 ? <span style={badgeGreen}>{teamAwards.length} team award{teamAwards.length > 1 ? 's' : ''}</span> : null}
            </div>

            <div style={dynamicHeroActions}>
              <PrimaryLink href={captainLinks[1].href}>Open lineup builder</PrimaryLink>
              <SecondaryLink href={captainLinks[0].href}>Check availability</SecondaryLink>
              <div style={followButtonWrap}>
                <FollowButton
                  entityType="team"
                  entityId={stableFollowId}
                  entityName={team}
                  subtitle={heroMetaParts.join(' - ') || undefined}
                />
              </div>
              <GhostLink href="/teams">Back to teams</GhostLink>
            </div>
          </div>

          <div style={summaryCard}>
            <div style={summaryTitle}>Team snapshot</div>

            <div style={summaryMetricGrid}>
              <MetricCard label="Record" value={`${record.wins}-${record.losses}`} subtle="Wins / losses tracked" />
              <MetricCard label="Roster size" value={String(roster.length)} subtle="Players from team summary and match history" />
              <MetricCard label="Reviewed scorecards" value={String(matches.length)} subtle="Completed team results loaded" />
              <MetricCard
                label="Latest match"
                value={formatDate(recentMatch?.match_date)}
                subtle={recentMatch ? `vs ${getOpponent(recentMatch, team) ?? '--'}` : 'No recent match yet'}
              />
              {teamStreak && teamStreak.count >= 2 ? (
                <MetricCard
                  label="Current streak"
                  value={`${teamStreak.count} ${teamStreak.type === 'W' ? 'wins' : 'losses'}`}
                  subtle={teamStreak.type === 'W' ? 'Active win run' : 'Active loss run'}
                />
              ) : null}
              {hotPlayers.length > 0 ? (
                <MetricCard
                  label="Hot players"
                  value={String(hotPlayers.length)}
                  subtle={hotPlayers.slice(0, 2).map((p) => p.name).join(', ')}
                />
              ) : null}
            </div>

            {(matchTypeSplit.singlesW + matchTypeSplit.singlesL > 0 || matchTypeSplit.doublesW + matchTypeSplit.doublesL > 0) ? (
              <div style={summarySplitRowStyle}>
                {matchTypeSplit.singlesW + matchTypeSplit.singlesL > 0 ? (
                  <div style={summarySplitItemStyle}>
                    <span style={{ color: 'var(--foreground)', fontWeight: 900 }}>S</span>{' '}
                    {matchTypeSplit.singlesW}-{matchTypeSplit.singlesL}
                    {matchTypeSplit.singlesW + matchTypeSplit.singlesL > 0 ? (
                      <span style={{ color: 'rgba(190,210,240,0.4)', marginLeft: 4 }}>
                        ({Math.round((matchTypeSplit.singlesW / (matchTypeSplit.singlesW + matchTypeSplit.singlesL)) * 100)}% win)
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {matchTypeSplit.doublesW + matchTypeSplit.doublesL > 0 ? (
                  <div style={summarySplitItemStyle}>
                    <span style={{ color: 'var(--foreground)', fontWeight: 900 }}>D</span>{' '}
                    {matchTypeSplit.doublesW}-{matchTypeSplit.doublesL}
                    {matchTypeSplit.doublesW + matchTypeSplit.doublesL > 0 ? (
                      <span style={{ color: 'rgba(190,210,240,0.4)', marginLeft: 4 }}>
                        ({Math.round((matchTypeSplit.doublesW / (matchTypeSplit.doublesW + matchTypeSplit.doublesL)) * 100)}% win)
                      </span>
                    ) : null}
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

            {teamMeta.district ? <div style={summaryHint}>{teamMeta.district}</div> : null}
            {tiqParticipations.length > 0 ? (
              <div style={summaryHint}>
                Entered in {tiqParticipations.length} TIQ {tiqParticipations.length === 1 ? 'league' : 'leagues'}.
              </div>
            ) : null}
          </div>
        </section>

        <section style={teamWeekPathStyle(isTablet)} aria-label="Team week path">
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

        <DataTrustPanel
          title="Team data trust"
          body="Team pages combine reviewed team summaries, scorecards, TIQ league entries, and public tennis context when available. Use Data Assist when a roster, result, or team identity needs review."
          signals={[
            { label: 'Source', value: 'Team summaries, scorecards, TIQ league entries' },
            { label: 'Freshness', value: 'Updates as reviewed uploads connect' },
            { label: 'Confidence', value: 'Higher when scorecards and roster context agree' },
            { label: 'Status', value: 'Report, upload, or request review through Data Assist' },
          ]}
        />

        {error ? (
          <section style={surfaceCard}>
            <h2 style={sectionTitle}>Team page unavailable</h2>
            <p style={bodyText}>{error}</p>
            <div style={{ marginTop: 14 }}>
              <RetryButton onClick={() => void loadTeamPage()}>Retry team page</RetryButton>
            </div>
          </section>
        ) : null}

        {!error && !matches.length ? (
          <section style={surfaceCard}>
            <h2 style={sectionTitle}>No reviewed scorecards yet</h2>
            <p style={bodyText}>
              This team can exist from a reviewed team summary before results arrive. Use the roster and Team Hub now,
              then reviewed Data Assist scorecards will enrich match history, records, and player usage.
            </p>
            <div style={dynamicHeroActions}>
              <SecondaryLink href={DATA_ASSIST_STORY.href}>{DATA_ASSIST_STORY.cta}</SecondaryLink>
              <SecondaryLink href="/teams">Browse all teams</SecondaryLink>
              <GhostLink href={captainLinks[0].href}>Open captain availability</GhostLink>
            </div>
          </section>
        ) : null}

        <section style={dynamicMetricGrid}>
          <section style={signalGridStyle(isSmallMobile)}>
            {teamSignals.map((signal) => (
              <article key={signal.label} style={signalCardStyle}>
                <div style={signalLabelStyle}>{signal.label}</div>
                <div style={signalValueStyle}>{signal.value}</div>
                <div style={signalNoteStyle}>{signal.note}</div>
              </article>
            ))}
          </section>

          <article style={metricCard}>
            <span style={metricLabel}>Record</span>
            <strong style={metricValue}>{record.wins}-{record.losses}</strong>
            <span style={metricSubtle}>Wins / losses tracked</span>
          </article>

          <article style={metricCard}>
            <span style={metricLabel}>Roster Size</span>
            <strong style={metricValue}>{roster.length}</strong>
            <span style={metricSubtle}>Team summary plus match history</span>
          </article>

          <article style={metricCard}>
            <span style={metricLabel}>Imported Scorecards</span>
            <strong style={metricValue}>{matches.length}</strong>
            <span style={metricSubtle}>Completed team results loaded</span>
          </article>

          <article style={metricCard}>
            <span style={metricLabel}>Latest Match</span>
            <strong style={metricValue}>{formatDate(recentMatch?.match_date)}</strong>
            <span style={metricSubtle}>
              {recentMatch ? `vs ${getOpponent(recentMatch, team) ?? '--'}` : 'No recent match yet'}
            </span>
          </article>
        </section>

        {teamAwards.length > 0 ? (
          <section style={surfaceCard} id="team-awards">
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

        <section style={surfaceCard}>
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
                    <SecondaryLink href={buildCaptainScopedHref('/captain/lineup-builder', {
                      competitionLayer: 'tiq',
                      team,
                      league: entry.leagueName || undefined,
                      flight: entry.leagueFlight || undefined,
                    })}>
                      Lineup Builder
                    </SecondaryLink>
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

        <section style={dynamicCardGrid}>
          <article style={surfaceCardStrong}>
            <div style={sectionHeadingRow}>
              <div style={sectionHeadingCopyStyle}>
                <p style={sectionKicker}>Singles Core</p>
                <h2 style={sectionTitle}>Top Singles Options</h2>
              </div>
            </div>

            {bestSingles.length ? (
              <div style={stackList}>
                {bestSingles.map((player, index) => {
                  const status = getTeamPlayerStatus(player)
                  return (
                    <div key={player.id} style={listRow}>
                      <div style={listRowCopyStyle}>
                        <strong>
                          {index + 1}. {player.name}
                        </strong>
                        <div style={mutedText}>
                          {player.singlesAppearances} singles starts · {player.wins}-{player.losses} record
                        </div>
                      </div>
                      <div style={ratingStackStyle}>
                        <span style={badgeBlue}>{formatRating(player.singles_dynamic_rating)}</span>
                        {status ? <span style={{ ...teamStatusPill, ...getTeamStatusStyle(status) }}>{status}</span> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={emptyStateBlock}>
                <p style={emptyState}>Singles data is not available yet.</p>
                <p style={mutedText}>Once this team logs singles courts, the strongest options will surface here.</p>
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
                      <strong>{pair.names.join(' / ')}</strong>
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

        <section style={dynamicCardGrid}>
          <article style={surfaceCard}>
            <div style={sectionHeadingRow}>
              <div style={sectionHeadingCopyStyle}>
                <p style={sectionKicker}>Captain tools</p>
                <h2 style={sectionTitle}>Next Best Actions</h2>
              </div>
            </div>

            <div style={stackList}>
              {captainLinks.map((item) => (
                <CaptainListCard
                  key={item.question}
                  href={item.href}
                  question={item.question}
                  title={item.title}
                  description={item.description}
                  cta={item.cta}
                  job={item.job}
                />
              ))}
            </div>
          </article>

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
                          {index + 1}. {player.name}
                        </strong>
                        <div style={mutedText}>
                          {player.doublesAppearances} doubles starts · {player.wins}-{player.losses} record
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

        <section style={surfaceCard} id="team-roster">
          <div style={sectionHeadingRow}>
            <div style={sectionHeadingCopyStyle}>
              <p style={sectionKicker}>Recent Form</p>
              <h2 style={sectionTitle}>Match History</h2>
            </div>
          </div>

          {opponentAnalysis.length > 0 ? (
            <section style={{ ...surfaceCard, marginBottom: 20 }}>
              <div style={opponentBreakdownHeaderStyle}>
                <div style={listRowCopyStyle}>
                  <div style={sectionKicker}>Opponent breakdown</div>
                  <h2 style={sectionTitle}>Record vs. opponents</h2>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(15, 23, 42, 0.68)', border: '1px solid rgba(125, 211, 252, 0.18)', color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 700 }}>{opponentAnalysis.length} opponent{opponentAnalysis.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={tableWrap}>
                <table style={{ ...dataTable, minWidth: 0 }}>
                  <thead>
                    <tr>
                      {['Opponent', 'W', 'L', 'Win %', 'Matches', 'Last met'].map((h) => (
                        <th key={h} style={tableHeaderCell}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {opponentAnalysis.map((opp, i) => {
                      const dominated = opp.winPct >= 70
                      const struggling = opp.winPct <= 30
                      return (
                        <tr key={opp.name} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.016)' }}>
                          <td style={{ ...tableCell, fontWeight: 800, color: 'var(--foreground)' }}>{opp.name}</td>
                          <td style={{ ...tableCell, color: '#86efac', fontWeight: 800 }}>{opp.wins}</td>
                          <td style={{ ...tableCell, color: '#fca5a5', fontWeight: 800 }}>{opp.losses}</td>
                          <td style={tableCell}>
                            <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: dominated ? 'rgba(155,225,29,0.10)' : struggling ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)', color: dominated ? '#d9f84a' : struggling ? '#fca5a5' : 'var(--shell-copy-muted)', border: `1px solid ${dominated ? 'rgba(155,225,29,0.20)' : struggling ? 'rgba(239,68,68,0.16)' : 'rgba(255,255,255,0.08)'}` }}>
                              {opp.winPct}%
                            </span>
                          </td>
                          <td style={{ ...tableCell, color: 'var(--shell-copy-muted)' }}>{opp.total}</td>
                          <td style={{ ...tableCell, color: 'var(--shell-copy-muted)', fontSize: 13 }}>{formatDate(opp.lastDate)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {matchCards.length ? (() => {
            const filteredCards = seasonFilter === 'all'
              ? matchCards
              : matchCards.filter((m) => (m.match_date || '').startsWith(seasonFilter))
            return (
            <>
            {seasonOptions.length > 1 ? (
              <div style={seasonFilterControlsStyle}>
                <span style={{ color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 700 }}>Season:</span>
                {(['all', ...seasonOptions] as const).map((y) => (
                  <button key={y} type="button" onClick={() => setSeasonFilter(y)} style={{ ...seasonFilterButtonStyle, background: seasonFilter === y ? 'rgba(116,190,255,0.14)' : 'transparent', border: `1px solid ${seasonFilter === y ? 'rgba(116,190,255,0.28)' : 'rgba(255,255,255,0.10)'}`, color: seasonFilter === y ? '#93c5fd' : 'var(--shell-copy-muted)' }}>
                    {y === 'all' ? 'All seasons' : y}
                  </button>
                ))}
              </div>
            ) : null}
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
                  {filteredCards.map((match) => {
                    const existingReport = myMatchReportByMatchId.get(match.id) || null
                    return (
                    <tr key={match.id}>
                      <td style={tableCell}>{formatDate(match.match_date)}</td>
                      <td style={tableCell}>{match.opponent ?? '—'}</td>
                      <td style={tableCell}>{match.venueLabel}</td>
                      <td style={tableCell}>
                        {match.match_type ? match.match_type[0].toUpperCase() + match.match_type.slice(1) : '—'}
                      </td>
                      <td style={tableCell}>
                        <div style={scoreCellStackStyle}>
                          <span>{match.score ?? '—'}</span>
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
                          {match.won === true ? 'Win' : match.won === false ? 'Loss' : '—'}
                        </span>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </>
            )
          })() : (
            <div style={emptyStateBlock}>
              <p style={emptyState}>Team match history is not available yet.</p>
              <p style={mutedText}>Return to the team directory or use the Captain actions above while the season history catches up.</p>
            </div>
          )}
        </section>

        <section style={surfaceCard}>
          <div style={sectionHeadingRow}>
            <div style={sectionHeadingCopyStyle}>
              <p style={sectionKicker}>Roster</p>
              <h2 style={sectionTitle}>Player Breakdown</h2>
            </div>
            {roster.length ? (
              <span style={panelCountPill}>
                {filteredRoster.length} shown
              </span>
            ) : null}
          </div>

          {roster.length ? (
            <>
              <div style={rosterFilterRow}>
                {rosterFilterOptions.map((option) => {
                  const active = rosterFilter === option.key
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setRosterFilter(option.key)}
                      style={active ? rosterFilterButtonActive : rosterFilterButton}
                    >
                      <span>{option.label}</span>
                      <span style={rosterFilterCount}>{option.count}</span>
                    </button>
                  )
                })}
              </div>

              <div style={rosterFilterHint}>
                {rosterFilter === 'played'
                  ? 'Players who have already appeared in reviewed scorecards.'
                  : rosterFilter === 'roster-only'
                    ? 'Rostered players who have not played yet.'
                    : rosterFilter === 'singles'
                      ? 'Roster sorted by singles strength.'
                      : rosterFilter === 'doubles'
                        ? 'Roster sorted by doubles strength.'
                        : 'Full roster from team summary and match history.'}
              </div>

              <div style={rosterPlayerIdTrailStyle} aria-label="Roster Player ID trail">
                {rosterPlayerIdSignals.map((signal) => (
                  <article key={signal.label} style={rosterPlayerIdSignalStyle}>
                    <span style={rosterPlayerIdSignalLabelStyle}>{signal.label}</span>
                    <strong style={rosterPlayerIdSignalValueStyle}>{signal.value}</strong>
                    <span style={rosterPlayerIdSignalTextStyle}>{signal.body}</span>
                  </article>
                ))}
              </div>
              <div style={rosterPlayerIdStarterStyle}>
                <div style={rosterPlayerIdStarterCopyStyle}>
                  <span style={rosterPlayerIdSignalLabelStyle}>Roster Player ID starter</span>
                  <strong style={rosterPlayerIdSignalValueStyle}>{ROSTER_PLAYER_IDENTITY_READ.label}</strong>
                  <span style={rosterPlayerIdSignalTextStyle}>{ROSTER_PLAYER_IDENTITY_READ.levelUpNudge}</span>
                </div>
                <div style={rosterPlayerIdStarterGridStyle} aria-label="Roster Player ID starter read">
                  {rosterPlayerIdStarterRead.map((item) => (
                    <span key={item.label} style={rosterPlayerIdStarterItemStyle}>
                      <em>{item.label}</em>
                      <b>{item.value}</b>
                    </span>
                  ))}
                </div>
                <div style={rosterPlayerIdStarterActionRowStyle}>
                  <Link href={ROSTER_LEVEL_UP_HREF} style={rosterPlayerIdStarterLinkStyle}>
                    Start Level Up
                  </Link>
                  <Link href={ROSTER_PLAYER_DEVELOPMENT_HREF} style={rosterPlayerIdStarterSecondaryLinkStyle}>
                    Read Player ID
                  </Link>
                </div>
              </div>

              <div style={rosterCompareTray}>
                <div style={sectionHeadingCopyStyle}>
                  <div style={rosterCompareKicker}>Matchup</div>
                  <div style={rosterCompareTitle}>
                    {selectedRosterPlayers.length === 0
                      ? 'Select two roster players to compare'
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
              </div>

              <div style={tableWrap}>
                <table style={dataTable}>
                  <thead>
                    <tr>
                      <th style={tableHeaderCell}>Compare</th>
                      <th style={tableHeaderCell}>Player</th>
                      <th style={tableHeaderCell}>S TIQ</th>
                      <th style={tableHeaderCell}>S USTA</th>
                      <th style={tableHeaderCell}>D TIQ</th>
                      <th style={tableHeaderCell}>D USTA</th>
                      <th style={tableHeaderCell}>Appearances</th>
                      <th style={tableHeaderCell}>Record</th>
                      <th style={tableHeaderCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoster.map((player) => (
                      <tr key={player.id}>
                        <td style={tableCell}>
                          {player.id.startsWith('summary:') ? (
                            <span style={mutedText}>Linked soon</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRosterCompareToggle(player.id)}
                              style={selectedRosterPlayerIds.includes(player.id) ? rosterSelectButtonActive : rosterSelectButton}
                              aria-pressed={selectedRosterPlayerIds.includes(player.id)}
                            >
                              {selectedRosterPlayerIds.includes(player.id) ? 'Selected' : 'Select'}
                            </button>
                          )}
                        </td>
                        <td style={tableCell}>
                          <div style={{ display: 'grid', gap: 4 }}>
                            {player.id.startsWith('summary:') ? (
                              <strong>{player.name}</strong>
                            ) : (
                              <Link href={`/players/${player.id}`} style={playerLink}>
                                <strong>{player.name}</strong>
                              </Link>
                            )}
                            {player.location ? <span style={mutedText}>{player.location}</span> : null}
                          </div>
                        </td>
                        <td style={tableCell}>{formatRating(player.singles_dynamic_rating)}</td>
                        <td style={tableCell}>{formatRating(player.singles_usta_dynamic_rating)}</td>
                        <td style={tableCell}>{formatRating(player.doubles_dynamic_rating)}</td>
                        <td style={tableCell}>{formatRating(player.doubles_usta_dynamic_rating)}</td>
                        <td style={tableCell}>{player.appearances}</td>
                        <td style={tableCell}>
                          {player.wins}-{player.losses}
                        </td>
                        <td style={tableCell}>
                          <div style={rosterActionRow}>
                            {player.id.startsWith('summary:') ? null : (
                              <>
                                <Link href={`/players/${player.id}`} style={rosterActionLink}>
                                  Profile
                                </Link>
                                <Link href={`/matchup?type=singles&playerA=${encodeURIComponent(player.id)}`} style={rosterActionLinkAccent}>
                                  Matchup
                                </Link>
                              </>
                            )}
                            <Link href={captainLinks[0].href} style={rosterActionLink}>
                              Availability
                            </Link>
                            <Link href={captainLinks[1].href} style={rosterActionLink}>
                              Lineup
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={emptyStateBlock}>
              <p style={emptyState}>
                {teamExistsFromSummary
                  ? 'This team exists in the imported standings, but its roster was not captured yet.'
                  : 'No roster players are linked to this team yet.'}
              </p>
              <p style={mutedText}>
                {teamExistsFromSummary
                  ? `The last team summary can create the ${team} team shell from standings, but roster players only import for the roster team shown in that capture. Open ${team}'s roster/team-summary page in TennisLink and capture that roster, or import scorecards to build usage history.`
                  : 'Import a team summary with this team selected as the roster team, or capture scorecards to enrich this page with player usage.'}
              </p>
            </div>
          )}
        </section>
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

function CaptainListCard({
  href,
  question,
  title,
  description,
  cta,
  job,
}: {
  href: string
  question: string
  title: string
  description: string
  cta: string
  job: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      aria-label={`${cta}: ${question}`}
      data-team-week-job={job}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...listLinkCard,
        borderColor: hovered ? 'rgba(116,190,255,0.20)' : 'rgba(255,255,255,0.08)',
        background: hovered ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'all 150ms ease',
      }}
    >
      <span style={teamWeekActionQuestionStyle}>{question}</span>
      <strong style={{ color: hovered ? '#f8fbff' : '#f0f6ff' }}>{title}</strong>
      <span style={{ color: 'rgba(214,228,246,0.70)', fontSize: '14px' }}>{description}</span>
      <span style={teamWeekActionCtaStyle}>{cta}</span>
    </Link>
  )
}

function MetricCard({
  label,
  value,
  subtle,
}: {
  label: string
  value: string
  subtle: string
}) {
  return (
    <div style={summaryMetricCard}>
      <div style={summaryMetricLabel}>{label}</div>
      <div style={summaryMetricValue}>{value}</div>
      <div style={summaryHintSmall}>{subtle}</div>
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

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: '-110px',
  top: '-118px',
  width: '310px',
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
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

const heroText: CSSProperties = {
  margin: '0 0 20px',
  color: 'var(--shell-copy-muted)',
  fontSize: '18px',
  lineHeight: 1.6,
  maxWidth: '720px',
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

const badgeRed: CSSProperties = {
  ...badgeBase,
  background: 'rgba(239,68,68,0.12)',
  color: '#fca5a5',
  border: '1px solid color-mix(in srgb, #ef4444 24%, var(--shell-panel-border) 76%)',
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

const summaryTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: 0,
  marginBottom: '14px',
  overflowWrap: 'anywhere',
}

const summaryMetricGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: '12px',
  minWidth: 0,
}

const summaryMetricCard: CSSProperties = {
  borderRadius: '20px',
  padding: '14px',
  background: 'rgba(15, 23, 42, 0.72)',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  minWidth: 0,
}

const summaryMetricLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontWeight: 700,
  fontSize: '13px',
  marginBottom: '8px',
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

const summaryHint: CSSProperties = {
  marginTop: '14px',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.6,
  fontSize: '14px',
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
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const summarySplitItemStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--shell-copy-muted)',
  minWidth: 0,
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

const teamWeekActionCtaStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const signalGridStyle = (isSmallMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))',
  gap: '14px',
  gridColumn: '1 / -1',
  minWidth: 0,
})

const signalCardStyle: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(8, 13, 28, 0.68)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const signalLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  overflowWrap: 'anywhere',
}

const signalValueStyle: CSSProperties = {
  marginTop: '10px',
  color: 'var(--foreground-strong)',
  fontSize: '1.28rem',
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const signalNoteStyle: CSSProperties = {
  marginTop: '8px',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.6,
  fontSize: '.94rem',
  overflowWrap: 'anywhere',
}

const metricGridStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  minWidth: 0,
}

const metricCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(8, 13, 28, 0.68)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const metricLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '0.82rem',
  marginBottom: '0.42rem',
  fontWeight: 700,
  display: 'block',
  overflowWrap: 'anywhere',
}

const metricValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '1.8rem',
  fontWeight: 900,
  lineHeight: 1.1,
  display: 'block',
  overflowWrap: 'anywhere',
}

const metricSubtle: CSSProperties = {
  marginTop: '8px',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.55,
  fontSize: '0.9rem',
  display: 'block',
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
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
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
  minHeight: '34px',
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

const rosterPlayerIdTrailStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: '10px',
  margin: '0 0 14px',
  minWidth: 0,
}

const rosterPlayerIdSignalStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: '7px',
  minWidth: 0,
  padding: '13px',
  borderRadius: '16px',
  border: '1px solid rgba(125, 211, 252, 0.14)',
  background: 'rgba(15, 23, 42, 0.58)',
  overflowWrap: 'anywhere',
}

const rosterPlayerIdSignalLabelStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: '10px',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  overflowWrap: 'anywhere',
}

const rosterPlayerIdSignalValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}

const rosterPlayerIdSignalTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
}

const rosterPlayerIdStarterStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  margin: '0 0 14px',
  padding: 14,
  borderRadius: '18px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'rgba(15, 23, 42, 0.58)',
  overflowWrap: 'anywhere',
}

const rosterPlayerIdStarterCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const rosterPlayerIdStarterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const rosterPlayerIdStarterItemStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  padding: '8px 9px',
  borderRadius: 12,
  border: '1px solid rgba(125, 211, 252, 0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 760,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const rosterPlayerIdStarterActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const rosterPlayerIdStarterLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-green) 15%, var(--shell-chip-bg) 85%)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 900,
  textDecoration: 'none',
  maxWidth: '100%',
  whiteSpace: 'normal',
  minWidth: 0,
  textAlign: 'center',
  overflowWrap: 'anywhere',
}

const rosterPlayerIdStarterSecondaryLinkStyle: CSSProperties = {
  ...rosterPlayerIdStarterLinkStyle,
  border: '1px solid rgba(125, 211, 252, 0.14)',
  background: 'rgba(7,17,33,0.72)',
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
  minHeight: '34px',
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
  minHeight: '34px',
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
  minHeight: '30px',
  padding: '0 10px',
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

const opponentBreakdownHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16,
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const seasonFilterControlsStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 12,
  alignItems: 'center',
  minWidth: 0,
}

const seasonFilterButtonStyle: CSSProperties = {
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

const listLinkCard: CSSProperties = {
  display: 'grid',
  gap: '8px',
  textDecoration: 'none',
  color: 'var(--foreground)',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
  minWidth: 0,
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
  minWidth: 0,
}

const tableHeaderCell: CSSProperties = {
  textAlign: 'left',
  padding: '14px',
  background: 'rgba(8, 13, 28, 0.78)',
  color: '#c7dbff',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const tableCell: CSSProperties = {
  padding: '14px',
  borderTop: '1px solid rgba(125, 211, 252, 0.14)',
  color: 'var(--foreground)',
  verticalAlign: 'top',
  overflowWrap: 'anywhere',
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

const rosterActionLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  minHeight: '30px',
  padding: '0 10px',
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

