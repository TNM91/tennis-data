'use client'

import Link from 'next/link'
import React from 'react'
import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SiteShell from '@/app/components/site-shell'
import FollowButton from '@/app/components/follow-button'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { getClientAuthState } from '@/lib/auth'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import {
  formatRatingValue,
  getRatingViewLabel,
  getTiqRating,
  getUstaDynamicRating,
  getUstaRating,
} from '@/lib/player-rating-display'
import {
  listTiqPlayerParticipations,
  type TiqLeagueStorageSource,
  type TiqPlayerParticipationRecord,
} from '@/lib/tiq-league-service'
import { formatDate, formatRating } from '@/lib/captain-formatters'
import { type UserRole } from '@/lib/roles'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type RatingView = 'overall' | 'singles' | 'doubles'
type MatchType = 'singles' | 'doubles'
type MatchSide = 'A' | 'B'
type TrendDirection = 'up' | 'down' | 'flat'
type ConfidenceLevel = 'Low' | 'Medium' | 'High'
type RatingStatus =
  | 'Bump Up Pace'
  | 'Trending Up'
  | 'Holding'
  | 'At Risk'
  | 'Drop Watch'

type Player = {
  id: string
  name: string
  location?: string | null
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

type MatchRecord = {
  id: string
  date: string
  matchType: MatchType
  leagueName: string | null
  source: string | null
  score: string
  result: 'W' | 'L'
  opponent: string
  opponentIds: string[]
  partner: string | null
  sideA: string[]
  sideB: string[]
}

type SnapshotRow = {
  id: string
  player_id: string
  match_id: string
  snapshot_date: string
  rating_type?: RatingView | null
  dynamic_rating: number
  delta?: number | null
  opponent_rating?: number | null
  win_probability?: number | null
  multiplier?: number | null
}

type MatchRow = {
  id: string
  match_date: string
  match_time: string | null
  match_type: MatchType
  league_name: string | null
  source: string | null
  score: string
  winner_side: MatchSide
}

type MatchPlayerRow = {
  match_id: string
  player_id: string
  side: MatchSide
  seat: number | null
  players: {
    id: string
    name: string
  } | null
}

export default function PlayerProfilePage() {
  const params = useParams()
  const playerId = String(params.id)

  const [player, setPlayer] = useState<Player | null>(null)
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
  const [tiqParticipations, setTiqParticipations] = useState<TiqPlayerParticipationRecord[]>([])
  const [tiqParticipationSource, setTiqParticipationSource] = useState<TiqLeagueStorageSource>('local')
  const [tiqParticipationWarning, setTiqParticipationWarning] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [ratingView, setRatingView] = useState<RatingView>('overall')
  const [chartWindow, setChartWindow] = useState<'all' | '90d' | '30d'>('all')
  const [historyMode, setHistoryMode] = useState<'chart' | 'table'>('chart')
  const [playerRank, setPlayerRank] = useState<number | null>(null)
  const [totalPlayers, setTotalPlayers] = useState<number | null>(null)
  const [nearbyPlayers, setNearbyPlayers] = useState<Array<{ id: string; name: string; location: string | null; overall_dynamic_rating: number }>>([])
  const [fieldAvgRating, setFieldAvgRating] = useState<number | null>(null)

  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  useEffect(() => {
    let active = true

    void (async () => {
      const authState = await getClientAuthState()
      if (!active) return
      setRole(authState.role)
      setEntitlements(authState.entitlements)
    })()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const tiq = player?.overall_dynamic_rating
    if (typeof tiq !== 'number') return
    let active = true
    void (async () => {
      const [{ count: total }, { count: above }, { data: nearby }, { data: avgData }] = await Promise.all([
        supabase.from('players').select('*', { count: 'exact', head: true }),
        supabase.from('players').select('*', { count: 'exact', head: true })
          .gt('overall_dynamic_rating', tiq),
        supabase
          .from('players')
          .select('id, name, location, overall_dynamic_rating')
          .neq('id', playerId)
          .gte('overall_dynamic_rating', tiq - 0.15)
          .lte('overall_dynamic_rating', tiq + 0.15)
          .order('overall_dynamic_rating', { ascending: false })
          .limit(5),
        supabase
          .from('players')
          .select('overall_dynamic_rating')
          .not('overall_dynamic_rating', 'is', null)
          .limit(500),
      ])
      if (!active) return
      setPlayerRank(typeof above === 'number' ? above + 1 : null)
      setTotalPlayers(total)
      if (avgData && avgData.length > 0) {
        const vals = (avgData as Array<{ overall_dynamic_rating: number }>).map((r) => r.overall_dynamic_rating)
        setFieldAvgRating(vals.reduce((a, b) => a + b, 0) / vals.length)
      }
      setNearbyPlayers(
        ((nearby ?? []) as Array<{ id: string; name: string; location: string | null; overall_dynamic_rating: number }>)
          .filter((p) => p.id !== playerId),
      )
    })()
    return () => { active = false }
  }, [player?.overall_dynamic_rating, playerId])

  const loadPlayerProfile = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [
        { data: playerData, error: playerError },
        { data: playerMatchRefs, error: playerMatchRefsError },
        { data: snapshotsData, error: snapshotsError },
      ] = await Promise.all([
        supabase
          .from('players')
          .select(`
            id,
            name,
            location,
            overall_rating,
            overall_dynamic_rating,
            overall_usta_dynamic_rating,
            singles_rating,
            singles_dynamic_rating,
            singles_usta_dynamic_rating,
            doubles_rating,
            doubles_dynamic_rating,
            doubles_usta_dynamic_rating
          `)
          .eq('id', playerId)
          .single(),
        supabase.from('match_players').select('match_id').eq('player_id', playerId),
        supabase
          .from('rating_snapshots')
          .select('id, player_id, match_id, snapshot_date, rating_type, dynamic_rating, track, delta, opponent_rating, win_probability, multiplier')
          .eq('player_id', playerId)
          .eq('track', 'tiq')
          .order('snapshot_date', { ascending: true })
          .order('id', { ascending: true }),
      ])

      if (playerError) throw new Error(playerError.message)
      if (playerMatchRefsError) throw new Error(playerMatchRefsError.message)
      if (snapshotsError) throw new Error(snapshotsError.message)

      const matchIds = [...new Set((playerMatchRefs || []).map((row) => row.match_id))]

      let matchRows: MatchRow[] = []
      let participantRows: MatchPlayerRow[] = []

      if (matchIds.length > 0) {
        const [
          { data: matchesData, error: matchesError },
          { data: participantsData, error: participantsError },
        ] = await Promise.all([
          supabase
            .from('matches')
            .select(`
              id,
              match_date,
              match_time,
              match_type,
              league_name,
              source,
              score,
              winner_side
            `)
            .in('id', matchIds)
            .not('match_type', 'is', null)
            .order('match_date', { ascending: false })
            .order('match_time', { ascending: false })
            .order('id', { ascending: false }),
          supabase
            .from('match_players')
            .select(`
              match_id,
              player_id,
              side,
              seat,
              players (
                id,
                name
              )
            `)
            .in('match_id', matchIds),
        ])

        if (matchesError) throw new Error(matchesError.message)
        if (participantsError) throw new Error(participantsError.message)

        matchRows = (matchesData || []) as MatchRow[]
        participantRows = (participantsData || []) as unknown as MatchPlayerRow[]
      }

      const participantsByMatchId = new Map<string, MatchPlayerRow[]>()

      for (const row of participantRows) {
        const existing = participantsByMatchId.get(row.match_id) ?? []
        existing.push(row)
        participantsByMatchId.set(row.match_id, existing)
      }

      const groupedMatches: MatchRecord[] = matchRows.map((match) => {
        const participants = participantsByMatchId.get(match.id) ?? []

        const sideA = participants
          .filter((p) => p.side === 'A')
          .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))

        const sideB = participants
          .filter((p) => p.side === 'B')
          .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))

        const playerOnSideA = sideA.some((p) => p.player_id === playerId)
        const playerSide: MatchSide = playerOnSideA ? 'A' : 'B'
        const opponentSide: MatchSide = playerSide === 'A' ? 'B' : 'A'

        const playerTeam = (playerSide === 'A' ? sideA : sideB).map(
          (p) => p.players?.name || 'Player not linked',
        )
        const opponentSideParts = opponentSide === 'A' ? sideA : sideB
        const opponentTeam = opponentSideParts.map(
          (p) => p.players?.name || 'Player not linked',
        )
        const opponentIds = opponentSideParts
          .map((p) => p.player_id)
          .filter((id): id is string => Boolean(id))

        const partnerNames = playerTeam.filter(
          (name) =>
            normalizeName(name).toLowerCase() !==
            normalizeName(playerData.name).toLowerCase(),
        )

        const isWin =
          (playerSide === 'A' && match.winner_side === 'A') ||
          (playerSide === 'B' && match.winner_side === 'B')

        return {
          id: match.id,
          date: match.match_date,
          matchType: normalizeMatchType(match.match_type),
          leagueName: match.league_name,
          source: match.source,
          score: match.score,
          result: isWin ? 'W' : 'L',
          opponent: opponentTeam.join(' / '),
          opponentIds,
          partner: partnerNames.length > 0 ? partnerNames.join(' / ') : null,
          sideA: sideA.map((p) => p.players?.name || 'Player not linked'),
          sideB: sideB.map((p) => p.players?.name || 'Player not linked'),
        }
      })

      setPlayer(playerData as Player)
      setMatches(groupedMatches)
      setSnapshots((snapshotsData || []) as SnapshotRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load player profile')
    } finally {
      setLoading(false)
    }
  }, [playerId])

  useEffect(() => {
    if (playerId) {
      void loadPlayerProfile()
    }
  }, [playerId, loadPlayerProfile])

  useEffect(() => {
    if (!player?.name) {
      setTiqParticipations([])
      setTiqParticipationSource('local')
      setTiqParticipationWarning(null)
      return
    }

    let isActive = true

    void (async () => {
      const result = await listTiqPlayerParticipations({
        playerName: player.name,
      })

      if (!isActive) return
      setTiqParticipations(result.entries)
      setTiqParticipationSource(result.source)
      setTiqParticipationWarning(result.warning)
    })()

    return () => {
      isActive = false
    }
  }, [player?.name])

  const filteredMatches = useMemo(() => {
    if (ratingView === 'overall') return matches
    return matches.filter((match) => match.matchType === ratingView)
  }, [matches, ratingView])

  const wins = useMemo(
    () => filteredMatches.filter((match) => match.result === 'W').length,
    [filteredMatches],
  )

  const losses = useMemo(
    () => filteredMatches.filter((match) => match.result === 'L').length,
    [filteredMatches],
  )

  const totalMatches = filteredMatches.length
  const winPct = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : '0.0'
  const [showAllMatches, setShowAllMatches] = useState(false)
  const [showAllHovered, setShowAllHovered] = useState(false)
  const [hoveredMatchRow, setHoveredMatchRow] = useState<string | null>(null)
  const [matchSearch, setMatchSearch] = useState('')
  const matchSearchedMatches = useMemo(() => {
    const q = matchSearch.trim().toLowerCase()
    if (!q) return filteredMatches
    return filteredMatches.filter((m) =>
      m.opponent.toLowerCase().includes(q) ||
      (m.partner || '').toLowerCase().includes(q) ||
      (m.score || '').toLowerCase().includes(q),
    )
  }, [filteredMatches, matchSearch])
  const mostRecentMatches = useMemo(
    () => showAllMatches ? matchSearchedMatches : matchSearchedMatches.slice(0, 10),
    [matchSearchedMatches, showAllMatches],
  )

  const chartPoints = useMemo(() => {
    const relevantSnapshots =
      ratingView === 'overall'
        ? snapshots.filter(
            (snapshot) => !snapshot.rating_type || snapshot.rating_type === 'overall',
          )
        : snapshots.filter((snapshot) => snapshot.rating_type === ratingView)

    return relevantSnapshots.map((snapshot, index) => ({
      x: index + 1,
      date: snapshot.snapshot_date,
      rating: snapshot.dynamic_rating,
      delta: snapshot.delta ?? null,
      winProbability: snapshot.win_probability ?? null,
    }))
  }, [snapshots, ratingView])

  const filteredChartPoints = useMemo(() => {
    if (chartWindow === 'all') return chartPoints
    const cutoff = Date.now() - (chartWindow === '90d' ? 90 : 30) * 24 * 60 * 60 * 1000
    return chartPoints.filter((p) => new Date(p.date).getTime() >= cutoff)
  }, [chartPoints, chartWindow])

  const selectedDynamicRating = useMemo(() => getTiqRating(player, ratingView), [player, ratingView])
  const ustaDynamicRating = useMemo(() => getUstaDynamicRating(player, ratingView), [player, ratingView])

  const staticOverall = useMemo(() => getUstaRating(player, 'overall'), [player])
  const staticSingles = useMemo(() => getUstaRating(player, 'singles'), [player])
  const staticDoubles = useMemo(() => getUstaRating(player, 'doubles'), [player])

  const baseRating = useMemo(() => {
    if (ratingView === 'singles') return staticSingles
    if (ratingView === 'doubles') return staticDoubles
    return staticOverall
  }, [ratingView, staticSingles, staticDoubles, staticOverall])

  const nextThreshold = useMemo(
    () => getNextThreshold(selectedDynamicRating),
    [selectedDynamicRating],
  )
  const progressInfo = useMemo(
    () => getProgressToNextLevel(selectedDynamicRating, nextThreshold),
    [selectedDynamicRating, nextThreshold],
  )

  // Status uses USTA dynamic — that's what USTA measures for bump/knockdown decisions.
  const ratingStatus = useMemo(
    () => getRatingStatus(baseRating, ustaDynamicRating),
    [baseRating, ustaDynamicRating],
  )

  const trendDirection = useMemo<TrendDirection>(
    () => getTrendDirection(chartPoints),
    [chartPoints],
  )

  const confidence = useMemo<ConfidenceLevel>(
    () => getConfidence(totalMatches),
    [totalMatches],
  )

  const ratingDiff = useMemo(
    () => roundToTwo(selectedDynamicRating - baseRating),
    [selectedDynamicRating, baseRating],
  )

  const recentTrendDelta = useMemo(
    () => getRecentTrendDelta(chartPoints),
    [chartPoints],
  )

  const daysSinceLastMatch = useMemo(() => {
    const lastDate = matches[0]?.date
    if (!lastDate) return null
    return Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
  }, [matches])

  const snapshotByMatchId = useMemo(() => {
    const map = new Map<string, SnapshotRow>()
    for (const snap of snapshots) {
      const matchType = snap.rating_type
      if (matchType && matchType !== 'overall') {
        map.set(`${snap.match_id}:${matchType}`, snap)
      }
      if (!map.has(`${snap.match_id}:overall`) && matchType === 'overall') {
        map.set(`${snap.match_id}:overall`, snap)
      }
    }
    return map
  }, [snapshots])

  const stalenessLabel = useMemo(() => {
    if (daysSinceLastMatch === null || daysSinceLastMatch <= 90) return null
    const months = Math.floor(daysSinceLastMatch / 30)
    return months >= 12
      ? `Last active ${Math.floor(months / 12)}yr ago`
      : `Last active ${months}mo ago`
  }, [daysSinceLastMatch])

  const winStreak = useMemo(() => {
    if (filteredMatches.length === 0) return { count: 0, type: 'W' as const }
    const firstResult = filteredMatches[0].result
    let count = 0
    for (const match of filteredMatches) {
      if (match.result === firstResult) count++
      else break
    }
    return { count, type: firstResult }
  }, [filteredMatches])

  const avgOpponentRating = useMemo(() => {
    const relevant = snapshots.filter((snap) =>
      ratingView === 'overall'
        ? !snap.rating_type || snap.rating_type === 'overall'
        : snap.rating_type === ratingView,
    )
    const validRatings = relevant
      .map((s) => s.opponent_rating)
      .filter((r): r is number => r != null && Number.isFinite(r))
    if (validRatings.length === 0) return null
    return validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length
  }, [snapshots, ratingView])

  const opponentQualityBreakdown = useMemo(() => {
    const bands = { weaker: { w: 0, l: 0 }, similar: { w: 0, l: 0 }, stronger: { w: 0, l: 0 } }
    for (const match of filteredMatches) {
      const snap = snapshotByMatchId.get(`${match.id}:${match.matchType}`) ?? snapshotByMatchId.get(`${match.id}:overall`)
      if (!snap?.opponent_rating || !baseRating) continue
      const diff = snap.opponent_rating - baseRating
      const bucket = diff > 0.25 ? 'stronger' : diff < -0.25 ? 'weaker' : 'similar'
      if (match.result === 'W') bands[bucket].w++
      else bands[bucket].l++
    }
    const total = Object.values(bands).reduce((s, b) => s + b.w + b.l, 0)
    if (total === 0) return null
    return bands
  }, [filteredMatches, snapshotByMatchId, baseRating])

  const formScore = useMemo(() => {
    const relevant = snapshots.filter((snap) =>
      ratingView === 'overall'
        ? !snap.rating_type || snap.rating_type === 'overall'
        : snap.rating_type === ratingView,
    )
    const last5 = relevant.slice(-5)
    const deltas = last5.map((s) => s.delta).filter((d): d is number => d != null)
    if (deltas.length === 0) return null
    return deltas.reduce((sum, d) => sum + d, 0)
  }, [snapshots, ratingView])

  const singlesRecord = useMemo(() => {
    const w = matches.filter((m) => m.matchType === 'singles' && m.result === 'W').length
    const l = matches.filter((m) => m.matchType === 'singles' && m.result === 'L').length
    return { w, l, total: w + l }
  }, [matches])

  const doublesRecord = useMemo(() => {
    const w = matches.filter((m) => m.matchType === 'doubles' && m.result === 'W').length
    const l = matches.filter((m) => m.matchType === 'doubles' && m.result === 'L').length
    return { w, l, total: w + l }
  }, [matches])

  // How many consecutive matches the current USTA status has held, reading snapshots newest→oldest.
  const statusStreakMatches = useMemo(() => {
    const relevant = snapshots
      .filter((s) => !s.rating_type || s.rating_type === 'overall')
      .slice()
      .reverse() // newest first
    if (relevant.length === 0) return 0
    let count = 0
    for (const snap of relevant) {
      const snapStatus = getRatingStatus(baseRating, snap.dynamic_rating)
      if (snapStatus === ratingStatus) count++
      else break
    }
    return count
  }, [snapshots, baseRating, ratingStatus])

  const percentile = useMemo(() => {
    if (playerRank === null || !totalPlayers) return null
    return Math.ceil((playerRank / totalPlayers) * 100)
  }, [playerRank, totalPlayers])

  // Longest win streak across all matches (not filtered by view).
  const opponentRecords = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number; lastDate: string; id: string | null }>()
    for (const match of matches) {
      const opp = match.opponent
      if (!opp || opp === 'Player not linked') continue
      const existing = map.get(opp) ?? { wins: 0, losses: 0, lastDate: match.date, id: match.opponentIds[0] ?? null }
      if (match.result === 'W') existing.wins++
      else existing.losses++
      if (match.date > existing.lastDate) existing.lastDate = match.date
      if (!existing.id && match.opponentIds[0]) existing.id = match.opponentIds[0]
      map.set(opp, existing)
    }
    return [...map.entries()]
      .filter(([, rec]) => rec.wins + rec.losses >= 2)
      .sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses))
      .slice(0, 8)
      .map(([name, rec]) => ({ name, id: rec.id, wins: rec.wins, losses: rec.losses, lastDate: rec.lastDate, total: rec.wins + rec.losses }))
  }, [matches])

  const seasonBreakdown = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number; singles: number; doubles: number; deltaSum: number; deltaCount: number }>()
    for (const match of matches) {
      const year = match.date.slice(0, 4)
      const existing = map.get(year) ?? { wins: 0, losses: 0, singles: 0, doubles: 0, deltaSum: 0, deltaCount: 0 }
      if (match.result === 'W') existing.wins++
      else existing.losses++
      if (match.matchType === 'singles') existing.singles++
      else existing.doubles++
      const snap = snapshotByMatchId.get(`${match.id}:${match.matchType}`) ?? snapshotByMatchId.get(`${match.id}:overall`)
      if (snap?.delta != null) { existing.deltaSum += snap.delta; existing.deltaCount++ }
      map.set(year, existing)
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, rec]) => ({
        year,
        wins: rec.wins,
        losses: rec.losses,
        total: rec.wins + rec.losses,
        singles: rec.singles,
        doubles: rec.doubles,
        netDelta: rec.deltaCount > 0 ? rec.deltaSum : null,
        winRate: rec.wins + rec.losses > 0 ? Math.round((rec.wins / (rec.wins + rec.losses)) * 100) : 0,
      }))
  }, [matches, snapshotByMatchId])

  const ustaLeagueBreakdown = useMemo(() => {
    const map = new Map<string, { leagueName: string; matches: number; wins: number; losses: number; latest: string }>()
    for (const match of matches) {
      const leagueName = (match.leagueName || '').trim()
      if (!leagueName) continue
      if (/\btiq\b/i.test(match.source || leagueName)) continue
      const existing = map.get(leagueName) ?? { leagueName, matches: 0, wins: 0, losses: 0, latest: match.date }
      existing.matches += 1
      if (match.result === 'W') existing.wins += 1
      else existing.losses += 1
      if (match.date > existing.latest) existing.latest = match.date
      map.set(leagueName, existing)
    }
    return [...map.values()].sort((a, b) => b.latest.localeCompare(a.latest))
  }, [matches])

  const scoreBreakdown = useMemo(() => {
    const wins = filteredMatches.filter((m) => m.result === 'W')
    if (wins.length === 0) return null
    let straightSets = 0
    let threeSets = 0
    let bagels = 0
    for (const m of wins) {
      if (!m.score) continue
      const sets = m.score.split(/[;,|]/).map((s) => s.trim()).filter(Boolean)
      if (sets.length === 2) straightSets++
      if (sets.length >= 3) threeSets++
      if (/\b6-0\b|\b0-6\b/.test(m.score)) bagels++
    }
    return { wins: wins.length, straightSets, threeSets, bagels }
  }, [filteredMatches])

  const pressureSituations = useMemo(() => {
    let tiebreakTotal = 0, tiebreakWins = 0
    let threeSetTotal = 0, threeSetWins = 0
    let upsetTotal = 0, upsetWins = 0  // matches where win_probability was known
    for (const match of filteredMatches) {
      const sets = (match.score || '').split(/[;,|]/).map((s) => s.trim()).filter(Boolean)
      const hasTiebreak = sets.some((s) => /^7-6$|^6-7$/.test(s))
      const isThreeSet = sets.length >= 3
      if (hasTiebreak) { tiebreakTotal++; if (match.result === 'W') tiebreakWins++ }
      if (isThreeSet) { threeSetTotal++; if (match.result === 'W') threeSetWins++ }
      // upset: won with < 40% win probability
      const snap = snapshotByMatchId.get(`${match.id}:${match.matchType}`) ?? snapshotByMatchId.get(`${match.id}:overall`)
      if (snap?.win_probability != null) {
        upsetTotal++
        if (match.result === 'W' && snap.win_probability <= 40) upsetWins++
      }
    }
    return { tiebreakTotal, tiebreakWins, threeSetTotal, threeSetWins, upsetWins, upsetTotal }
  }, [filteredMatches, snapshotByMatchId])

  const longestWinStreak = useMemo(() => {
    let best = 0
    let current = 0
    for (const match of [...matches].reverse()) { // oldest→newest
      if (match.result === 'W') {
        current++
        if (current > best) best = current
      } else {
        current = 0
      }
    }
    return best
  }, [matches])

  const careerHighs = useMemo(() => {
    const peakRating = chartPoints.length > 0
      ? Math.max(...chartPoints.map((p) => p.rating))
      : null
    const bestSeason = seasonBreakdown.length > 0
      ? seasonBreakdown.reduce((best, s) => s.wins > best.wins ? s : best, seasonBreakdown[0])
      : null
    const mostMatchesSeason = seasonBreakdown.length > 0
      ? seasonBreakdown.reduce((best, s) => s.total > best.total ? s : best, seasonBreakdown[0])
      : null
    return { peakRating, bestSeason, longestStreak: longestWinStreak, mostMatchesSeason }
  }, [chartPoints, seasonBreakdown, longestWinStreak])

  const benchmark = useMemo(() => {
    if (!fieldAvgRating) return null
    const tiqDiff = selectedDynamicRating - fieldAvgRating
    const winRateDiff = totalMatches > 0 ? ((wins / totalMatches) * 100 - 50) : null
    const formVsNeutral = formScore !== null ? formScore : null
    return { tiqDiff, winRateDiff, formVsNeutral, fieldAvgRating }
  }, [fieldAvgRating, selectedDynamicRating, wins, totalMatches, formScore])

  const volatilityScore = useMemo(() => {
    const deltas = chartPoints
      .map((p) => p.delta)
      .filter((d): d is number => d !== null)
    if (deltas.length < 3) return null
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length
    const variance = deltas.reduce((sum, d) => sum + (d - mean) ** 2, 0) / deltas.length
    return Math.sqrt(variance)
  }, [chartPoints])

  const meterTheme = useMemo(
    () => getMeterTheme(ratingStatus),
    [ratingStatus],
  )

  const dynamicHeroWrap: CSSProperties = {
    ...heroWrap,
    padding: isMobile ? '14px 16px 24px' : '10px 18px 24px',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '28px 18px 22px' : '34px 28px 24px',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
    gridTemplateColumns: isTablet
      ? '1fr'
      : 'minmax(0, 0.96fr) minmax(0, 1.04fr)',
    gap: isMobile ? '18px' : '22px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '46px' : '60px',
    lineHeight: isMobile ? 1.04 : 0.98,
    maxWidth: '560px',
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
    maxWidth: '560px',
  }

  const dynamicRightColumn: CSSProperties = {
    ...heroRight,
    position: isTablet ? 'relative' : 'sticky',
    top: isTablet ? 'auto' : '24px',
  }

  const dynamicSegmentWrap: CSSProperties = {
    ...segmentWrap,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicFocusMetrics: CSSProperties = {
    ...focusMetrics,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicFollowRow: CSSProperties = {
    ...followRow,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'stretch' : 'center',
  }

  const dynamicStatsGrid: CSSProperties = {
    ...statsGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isMobile
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(4, minmax(0, 1fr))',
  }

  const dynamicContentGrid: CSSProperties = {
    ...contentGrid,
    gridTemplateColumns: '1fr',
  }

  const dynamicMeterFill: CSSProperties = {
    ...meterFill,
    background: meterTheme.fill,
    boxShadow: meterTheme.shadow,
    width: `${progressInfo.percent}%`,
  }

  const dynamicStatusPill: CSSProperties = {
    ...statusPill,
    background: meterTheme.pillBackground,
    color: meterTheme.pillColor,
    border: `1px solid ${meterTheme.pillBorder}`,
  }

  const dynamicTrendPill: CSSProperties = {
    ...trendPill,
    background: meterTheme.trendBackground,
    color: meterTheme.trendColor,
    border: `1px solid ${meterTheme.trendBorder}`,
  }
  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])
  const ratingViewLabel = getRatingViewLabel(ratingView)
  const tiqParticipationCount = tiqParticipations.length
  const playerSignals = [
    {
      label: 'Official baseline',
      value: `USTA ${baseRating.toFixed(2)}`,
      note: 'Use USTA to understand official standing, bump pressure, and baseline comparison.',
    },
    {
      label: 'Strategy signal',
      value: `TIQ ${selectedDynamicRating.toFixed(2)}`,
      note: `Use the ${ratingViewLabel.toLowerCase()} TIQ read to understand current form and decision support.`,
    },
    {
      label: 'Competition context',
      value: tiqParticipationCount > 0 ? `${tiqParticipationCount} TIQ entries` : 'No TIQ entries yet',
      note: 'TIQ individual leagues show where this player is actively competing inside TenAceIQ.',
    },
  ]

  if (loading) {
    return (
      <SiteShell active="/players">
        <section style={dynamicHeroWrap}>
          <div style={dynamicHeroShell}>
            <div style={heroNoise} />
            <div style={loadingCard}>Loading player profile...</div>
          </div>
        </section>
      </SiteShell>
    )
  }

  if (error || !player) {
    return (
      <SiteShell active="/players">
        <section style={dynamicHeroWrap}>
          <div style={dynamicHeroShell}>
            <div style={heroNoise} />
            <div style={errorCard}>
              <div style={sectionKicker}>Player profile</div>
              <h2 style={sectionTitle}>Unable to load player</h2>
              <p style={sectionText}>{error || 'Player not found.'}</p>
              <div style={errorActionRow}>
                <MiniButton onClick={() => void loadPlayerProfile()}>Retry profile load</MiniButton>
                <MiniLink href="/players">Back to players</MiniLink>
                <MiniLink href="/rankings">Browse rankings</MiniLink>
              </div>
            </div>
          </div>
        </section>
      </SiteShell>
    )
  }

  return (
    <SiteShell active="/players">
      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div style={heroNoise} />

          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <BreadcrumbLink href="/players" label="Back to players" />
              <div style={eyebrow}>Player profile preview</div>

              <h1 style={dynamicHeroTitle}>{player.name}</h1>

              <p style={dynamicHeroText}>{player.location || 'Location not set'}</p>

              <div style={dynamicFollowRow}>
                <FollowButton
                  entityType="player"
                  entityId={player.id}
                  entityName={player.name}
                  subtitle={player.location || ''}
                />
                <MiniLink href="/mylab">Open My Lab</MiniLink>
                <MiniLink href="/rankings">Browse rankings</MiniLink>
              </div>

              <div style={heroHintRow}>
                <span style={heroHintPill}>{totalMatches} matches</span>
                <span style={heroHintPill}>{winPct}% win rate</span>
                <span style={heroHintPill}>{ratingViewLabel} view</span>
                {percentile !== null ? (
                  <span style={{ ...heroHintPill, background: 'rgba(116,190,255,0.08)', border: '1px solid rgba(116,190,255,0.22)', color: '#93c5fd' }}>
                    top {percentile}% of {totalPlayers} players
                  </span>
                ) : null}
                {tiqParticipationCount > 0 ? (
                  <span style={heroHintPill}>{tiqParticipationCount} TIQ individual leagues</span>
                ) : null}
                {winStreak.count >= 2 ? (
                  <span
                    style={{
                      ...heroHintPill,
                      background: winStreak.type === 'W' ? 'rgba(155,225,29,0.10)' : 'rgba(239,68,68,0.10)',
                      border: `1px solid ${winStreak.type === 'W' ? 'rgba(155,225,29,0.28)' : 'rgba(239,68,68,0.22)'}`,
                      color: winStreak.type === 'W' ? '#d9f84a' : '#fca5a5',
                    }}
                  >
                    {winStreak.count} {winStreak.type === 'W' ? 'win' : 'loss'} streak
                  </span>
                ) : null}
                {longestWinStreak >= 3 ? (
                  <span style={heroHintPill}>Best streak: {longestWinStreak}W</span>
                ) : null}
                {stalenessLabel ? (
                  <span style={stalenessPill}>{stalenessLabel}</span>
                ) : null}
              </div>

              <div style={meterCard}>
                <div style={meterHeader}>
                  <div style={meterLeftGroup}>
                    <div style={meterLabel}>Level-up meter</div>

                    <div style={meterStatusRow}>
                      <span style={dynamicStatusPill}>{ratingStatus}</span>
                      <span style={confidencePill}>{confidence} confidence</span>
                      {statusStreakMatches >= 3 ? (
                        <span style={confidencePill}>{statusStreakMatches} match streak</span>
                      ) : null}
                    </div>

                    <div style={meterSubtext}>
                      USTA {formatRatingValue(baseRating)} - TIQ {ratingViewLabel.toLowerCase()} rating{' '}
                      {formatRatingValue(selectedDynamicRating)}
                    </div>

                    <div style={dynamicTrendPill}>
                      <span>{getTrendIcon(trendDirection)}</span>
                      <span>{getTrendLabel(trendDirection)}</span>
                      <span style={trendDeltaText}>
                        {recentTrendDelta >= 0 ? '+' : ''}
                        {recentTrendDelta.toFixed(2)} recent
                      </span>
                    </div>
                  </div>

                  <div style={meterValueGroup}>
                    <div style={meterCurrent}>{selectedDynamicRating.toFixed(2)}</div>
                    <div style={meterTarget}>USTA {baseRating.toFixed(2)} - Next {nextThreshold.toFixed(1)}</div>
                    <div style={meterDelta}>
                      TIQ vs USTA {ratingDiff >= 0 ? '+' : ''}
                      {ratingDiff.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div style={meterTrack}>
                  <div style={dynamicMeterFill} />
                </div>

                <div style={meterFooter}>
                  <span>{progressInfo.previous.toFixed(1)}</span>
                  <span>{progressInfo.remaining.toFixed(2)} to go</span>
                  <span>{nextThreshold.toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div style={dynamicRightColumn}>
              <div style={focusCard}>
                <div style={focusHead}>
                  <div>
                    <div style={focusLabel}>Rating focus</div>
                    <div style={focusSubtitle}>
                      Keep official USTA status separate from TIQ strategy signal.
                    </div>
                  </div>

                  <MiniLink href="/players">Back to players</MiniLink>
                </div>

                <div style={dynamicSegmentWrap}>
                  <button
                    type="button"
                    onClick={() => setRatingView('overall')}
                    style={{
                      ...segmentButton,
                      ...(ratingView === 'overall' ? segmentButtonActive : {}),
                    }}
                  >
                    Overall
                  </button>
                  <button
                    type="button"
                    onClick={() => setRatingView('singles')}
                    style={{
                      ...segmentButton,
                      ...(ratingView === 'singles' ? segmentButtonActive : {}),
                    }}
                  >
                    Singles
                  </button>
                  <button
                    type="button"
                    onClick={() => setRatingView('doubles')}
                    style={{
                      ...segmentButton,
                      ...(ratingView === 'doubles' ? segmentButtonActive : {}),
                    }}
                  >
                    Doubles
                  </button>
                </div>

                <div style={dynamicFocusMetrics}>
                  <StatChip label="TIQ" value={selectedDynamicRating.toFixed(2)} accent />
                  <StatChip label="USTA Dynamic" value={ustaDynamicRating.toFixed(2)} />
                  <StatChip label="USTA Base" value={baseRating.toFixed(2)} />
                  <StatChip label="Trend" value={getTrendShortLabel(trendDirection)} />
                  <StatChip label="Confidence" value={confidence} />
                  <StatChip
                    label="Form last 5"
                    value={formScore !== null ? `${formScore >= 0 ? '+' : ''}${formScore.toFixed(3)}` : '—'}
                  />
                </div>
              </div>

              <div style={summaryCard}>
                <div style={summaryTitle}>Quick profile view</div>

                <div style={summaryStatsGrid}>
                  <StatChip label="USTA Base" value={formatRatingValue(player.overall_rating)} />
                  <StatChip label="USTA Dynamic" value={formatRatingValue(player.overall_usta_dynamic_rating ?? player.overall_rating)} />
                  <StatChip label="TIQ Overall" value={formatRatingValue(player.overall_dynamic_rating)} />
                  <StatChip label="TIQ Singles" value={formatRatingValue(player.singles_dynamic_rating ?? player.overall_dynamic_rating)} />
                  <StatChip label="TIQ Doubles" value={formatRatingValue(player.doubles_dynamic_rating ?? player.overall_dynamic_rating)} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={contentWrap}>
        <article
          style={{
            display: 'grid',
            gap: 14,
            marginBottom: 18,
            padding: 24,
            borderRadius: 26,
            background: 'linear-gradient(180deg, rgba(19,38,70,0.74) 0%, rgba(9,19,36,0.96) 100%)',
            border: '1px solid rgba(116,190,255,0.14)',
            boxShadow: '0 18px 44px rgba(7,18,40,0.18), inset 0 1px 0 rgba(255,255,255,0.03)',
          }}
        >
          <div style={sectionKicker}>Profile context</div>
          <h2 style={sectionTitle}>Read status and strategy separately, not as one blended rating.</h2>
          <p style={sectionText}>
            This profile is designed to keep official USTA baseline status separate from TIQ decision
            support. The most useful read usually comes from comparing the TIQ signal against the
            player&apos;s USTA baseline and recent match history rather than relying on a single number.
          </p>
          <div style={dynamicFollowRow}>
            <MiniLink href="/rankings">Compare on rankings</MiniLink>
            <MiniLink href="/mylab">Use My Lab</MiniLink>
            <MiniLink href="/advertising-disclosure">Advertising disclosure</MiniLink>
          </div>
        </article>

        {access.canUseAdvancedPlayerInsights ? (
          <section style={signalGridStyle(isMobile)}>
            {playerSignals.map((signal) => (
              <article key={signal.label} style={signalCardStyle}>
                <div style={signalLabelStyle}>{signal.label}</div>
                <div style={signalValueStyle}>{signal.value}</div>
                <div style={signalNoteStyle}>{signal.note}</div>
              </article>
            ))}
          </section>
        ) : (
          <UpgradePrompt
            planId="player_plus"
            headline="Want to know where you should play?"
            body="Player+ turns raw match history into clearer personal insight with lineup-fit guidance, strengths and weaknesses, projections, and opponent context when it is available."
            ctaLabel="Unlock Player+"
            ctaHref="/pricing"
            secondaryLabel="Keep browsing free"
            footnote={access.playerPlusMessage}
            compact
          />
        )}

        <div style={dynamicStatsGrid}>
          <article style={{ ...statCard, ...statCardAccentGreen }}>
            <div style={statLabel}>TIQ {ratingViewLabel}</div>
            <div style={statValue}>{selectedDynamicRating.toFixed(2)}</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>USTA Dynamic {ratingViewLabel}</div>
            <div style={statValue}>{ustaDynamicRating.toFixed(2)}</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>USTA Base {ratingViewLabel}</div>
            <div style={statValue}>{baseRating.toFixed(2)}</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Status</div>
            <div style={statValueSmall}>{ratingStatus}</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Trend</div>
            <div style={statValueSmall}>{getTrendLabel(trendDirection)}</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>TIQ Overall</div>
            <div style={statValue}>
              {formatRatingValue(player.overall_dynamic_rating)}
            </div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>TIQ Singles</div>
            <div style={statValue}>
              {formatRatingValue(
                player.singles_dynamic_rating ?? player.overall_dynamic_rating,
              )}
            </div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>TIQ Doubles</div>
            <div style={statValue}>
              {formatRatingValue(
                player.doubles_dynamic_rating ?? player.overall_dynamic_rating,
              )}
            </div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Tracked matches</div>
            <div style={statValue}>{totalMatches}</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>TIQ Individual Leagues</div>
            <div style={statValue}>{tiqParticipationCount}</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Wins</div>
            <div style={statValue}>{wins}</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Losses</div>
            <div style={statValue}>{losses}</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Win rate</div>
            <div style={statValue}>{winPct}%</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>TIQ vs USTA</div>
            <div style={statValue}>
              {ratingDiff >= 0 ? '+' : ''}
              {ratingDiff.toFixed(2)}
            </div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Singles record</div>
            <div style={statValue}>{singlesRecord.total > 0 ? `${singlesRecord.w}-${singlesRecord.l}` : '—'}</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Doubles record</div>
            <div style={statValue}>{doublesRecord.total > 0 ? `${doublesRecord.w}-${doublesRecord.l}` : '—'}</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Avg opponent ({ratingViewLabel.toLowerCase()})</div>
            <div style={statValue}>{avgOpponentRating !== null ? avgOpponentRating.toFixed(2) : '—'}</div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Form last 5</div>
            <div
              style={{
                ...statValue,
                color:
                  formScore !== null
                    ? formScore >= 0
                      ? '#9be11d'
                      : '#f87171'
                    : 'var(--foreground)',
              }}
            >
              {formScore !== null ? `${formScore >= 0 ? '+' : ''}${formScore.toFixed(3)}` : '—'}
            </div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Status held</div>
            <div style={statValueSmall}>
              {statusStreakMatches > 0 ? `${statusStreakMatches} match${statusStreakMatches === 1 ? '' : 'es'}` : '—'}
            </div>
          </article>

          <article style={statCard}>
            <div style={statLabel}>Best win streak</div>
            <div style={statValue}>{longestWinStreak > 0 ? `${longestWinStreak}W` : '—'}</div>
          </article>

          {playerRank !== null && totalPlayers !== null ? (
            <>
              <article style={statCard}>
                <div style={statLabel}>Overall rank</div>
                <div style={statValue}>#{playerRank}</div>
              </article>
              <article style={statCard}>
                <div style={statLabel}>Percentile</div>
                <div style={{ ...statValue, color: '#93c5fd' }}>top {percentile}%</div>
              </article>
            </>
          ) : null}

          {volatilityScore !== null ? (
            <article style={statCard}>
              <div style={statLabel}>Rating volatility</div>
              <div style={{
                ...statValue,
                color: volatilityScore > 0.07 ? '#fed7aa' : volatilityScore < 0.03 ? '#a7f3d0' : 'var(--foreground)',
              }}>
                {volatilityScore.toFixed(3)}
              </div>
              <div style={{ ...statLabel, marginTop: 4 }}>
                {volatilityScore > 0.07 ? 'High swing' : volatilityScore < 0.03 ? 'Very stable' : 'Normal range'}
              </div>
            </article>
          ) : null}

          {scoreBreakdown ? (
            <>
              <article style={statCard}>
                <div style={statLabel}>Straight-set wins</div>
                <div style={statValue}>{scoreBreakdown.straightSets}</div>
                <div style={{ ...statLabel, marginTop: 4 }}>of {scoreBreakdown.wins} wins</div>
              </article>
              <article style={statCard}>
                <div style={statLabel}>3-set wins</div>
                <div style={statValue}>{scoreBreakdown.threeSets}</div>
              </article>
              {scoreBreakdown.bagels > 0 ? (
                <article style={{ ...statCard, borderColor: 'rgba(155,225,29,0.22)' }}>
                  <div style={statLabel}>Bagel sets</div>
                  <div style={{ ...statValue, color: '#9be11d' }}>{scoreBreakdown.bagels}</div>
                </article>
              ) : null}
            </>
          ) : null}

          {(pressureSituations.tiebreakTotal > 0 || pressureSituations.threeSetTotal > 0 || pressureSituations.upsetWins > 0) ? (
            <>
              {pressureSituations.tiebreakTotal > 0 ? (
                <article style={statCard}>
                  <div style={statLabel}>Tiebreak record</div>
                  <div style={statValue}>{pressureSituations.tiebreakWins}-{pressureSituations.tiebreakTotal - pressureSituations.tiebreakWins}</div>
                  <div style={{ ...statLabel, marginTop: 4 }}>{Math.round((pressureSituations.tiebreakWins / pressureSituations.tiebreakTotal) * 100)}% win</div>
                </article>
              ) : null}
              {pressureSituations.threeSetTotal > 0 ? (
                <article style={statCard}>
                  <div style={statLabel}>3-set record</div>
                  <div style={statValue}>{pressureSituations.threeSetWins}-{pressureSituations.threeSetTotal - pressureSituations.threeSetWins}</div>
                  <div style={{ ...statLabel, marginTop: 4 }}>{Math.round((pressureSituations.threeSetWins / pressureSituations.threeSetTotal) * 100)}% win</div>
                </article>
              ) : null}
              {pressureSituations.upsetWins > 0 ? (
                <article style={{ ...statCard, borderColor: 'rgba(251,146,60,0.22)' }}>
                  <div style={statLabel}>Upset wins</div>
                  <div style={{ ...statValue, color: '#fed7aa' }}>{pressureSituations.upsetWins}</div>
                  <div style={{ ...statLabel, marginTop: 4 }}>Won as underdog</div>
                </article>
              ) : null}
            </>
          ) : null}
        </div>

        {(careerHighs.peakRating !== null || careerHighs.longestStreak > 0 || careerHighs.bestSeason) ? (
          <article style={panelCard}>
            <div style={panelHead}>
              <div>
                <div style={sectionKicker}>Career highs</div>
                <h2 style={panelTitle}>Personal records</h2>
              </div>
            </div>
            <p style={sectionText}>Best marks across the full tracked history for this profile.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 16 }}>
              {careerHighs.peakRating !== null ? (
                <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(155,225,29,0.05)', border: '1px solid rgba(155,225,29,0.14)' }}>
                  <div style={{ color: 'var(--shell-copy-muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 6 }}>Peak TIQ</div>
                  <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', color: '#d9f84a' }}>{careerHighs.peakRating.toFixed(2)}</div>
                  <div style={{ color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 600, marginTop: 4 }}>Highest rating reached</div>
                </div>
              ) : null}
              {careerHighs.longestStreak > 1 ? (
                <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(116,190,255,0.05)', border: '1px solid rgba(116,190,255,0.14)' }}>
                  <div style={{ color: 'var(--shell-copy-muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 6 }}>Best win streak</div>
                  <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', color: '#93c5fd' }}>{careerHighs.longestStreak}W</div>
                  <div style={{ color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 600, marginTop: 4 }}>Consecutive wins</div>
                </div>
              ) : null}
              {careerHighs.bestSeason ? (
                <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.14)' }}>
                  <div style={{ color: 'var(--shell-copy-muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 6 }}>Best season</div>
                  <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', color: '#a7f3d0' }}>{careerHighs.bestSeason.year}</div>
                  <div style={{ color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 600, marginTop: 4 }}>{careerHighs.bestSeason.wins}W–{careerHighs.bestSeason.losses}L · {careerHighs.bestSeason.winRate}% win rate</div>
                </div>
              ) : null}
              {careerHighs.mostMatchesSeason && careerHighs.mostMatchesSeason.year !== careerHighs.bestSeason?.year ? (
                <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.14)' }}>
                  <div style={{ color: 'var(--shell-copy-muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 6 }}>Most active season</div>
                  <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', color: '#fed7aa' }}>{careerHighs.mostMatchesSeason.year}</div>
                  <div style={{ color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 600, marginTop: 4 }}>{careerHighs.mostMatchesSeason.total} matches played</div>
                </div>
              ) : null}
            </div>
          </article>
        ) : null}

        {benchmark ? (
          <article style={panelCard}>
            <div style={panelHead}>
              <div>
                <div style={sectionKicker}>Vs. the field</div>
                <h2 style={panelTitle}>Benchmark comparison</h2>
              </div>
              <span style={panelChip}>Field avg {benchmark.fieldAvgRating.toFixed(2)}</span>
            </div>
            <p style={sectionText}>How this profile compares to the field average across TIQ rating, win rate, and recent form.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}>
              {[
                {
                  label: 'TIQ vs field avg',
                  value: `${benchmark.tiqDiff >= 0 ? '+' : ''}${benchmark.tiqDiff.toFixed(2)}`,
                  positive: benchmark.tiqDiff > 0,
                  negative: benchmark.tiqDiff < -0.05,
                  note: benchmark.tiqDiff > 0.1 ? 'Above average' : benchmark.tiqDiff < -0.1 ? 'Below average' : 'Near average',
                },
                {
                  label: 'Win rate vs 50%',
                  value: benchmark.winRateDiff !== null ? `${benchmark.winRateDiff >= 0 ? '+' : ''}${benchmark.winRateDiff.toFixed(1)}%` : '—',
                  positive: benchmark.winRateDiff !== null && benchmark.winRateDiff > 0,
                  negative: benchmark.winRateDiff !== null && benchmark.winRateDiff < -5,
                  note: benchmark.winRateDiff !== null ? (benchmark.winRateDiff > 5 ? 'Winning more than losing' : benchmark.winRateDiff < -5 ? 'More losses than wins' : 'Near even') : 'Not enough data',
                },
                {
                  label: 'Form vs neutral',
                  value: benchmark.formVsNeutral !== null ? `${benchmark.formVsNeutral >= 0 ? '+' : ''}${benchmark.formVsNeutral.toFixed(3)}` : '—',
                  positive: benchmark.formVsNeutral !== null && benchmark.formVsNeutral > 0.01,
                  negative: benchmark.formVsNeutral !== null && benchmark.formVsNeutral < -0.01,
                  note: benchmark.formVsNeutral !== null ? (benchmark.formVsNeutral > 0.01 ? 'Gaining recently' : benchmark.formVsNeutral < -0.01 ? 'Losing recently' : 'Flat') : 'Not enough matches',
                },
              ].map((row) => (
                <div key={row.label} style={{ padding: '13px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ color: 'var(--shell-copy-muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 6 }}>{row.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', color: row.positive ? '#86efac' : row.negative ? '#fca5a5' : 'var(--foreground)' }}>{row.value}</div>
                  <div style={{ color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 600, marginTop: 4 }}>{row.note}</div>
                </div>
              ))}
            </div>
          </article>
        ) : null}

        {opponentQualityBreakdown ? (
          <article style={panelCard}>
            <div style={panelHead}>
              <div>
                <div style={sectionKicker}>Matchup quality</div>
                <h2 style={panelTitle}>Who they beat and lose to</h2>
              </div>
            </div>
            <p style={sectionText}>W-L split by opponent rating relative to this player's USTA base. "Stronger" means the opponent rated 0.25+ higher; "weaker" means 0.25+ lower.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
              {[
                { key: 'weaker' as const, label: 'vs Weaker', color: '#d9f84a', bg: 'rgba(155,225,29,0.06)', border: 'rgba(155,225,29,0.16)' },
                { key: 'similar' as const, label: 'vs Similar', color: '#93c5fd', bg: 'rgba(116,190,255,0.06)', border: 'rgba(116,190,255,0.16)' },
                { key: 'stronger' as const, label: 'vs Stronger', color: '#fed7aa', bg: 'rgba(251,146,60,0.06)', border: 'rgba(251,146,60,0.16)' },
              ].map(({ key, label, color, bg, border }) => {
                const b = opponentQualityBreakdown[key]
                const total = b.w + b.l
                const pct = total > 0 ? Math.round((b.w / total) * 100) : null
                return (
                  <div key={key} style={{ padding: '14px 16px', borderRadius: 16, background: bg, border: `1px solid ${border}` }}>
                    <div style={{ color: 'var(--shell-copy-muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 8 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: '-0.03em' }}>{b.w}–{b.l}</div>
                    {pct !== null ? <div style={{ color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 600, marginTop: 4 }}>{pct}% win rate</div> : null}
                  </div>
                )
              })}
            </div>
          </article>
        ) : null}

        {access.canUseAdvancedPlayerInsights ? (() => {
          const rec = buildPlayerRecommendation(ratingStatus, ratingDiff, confidence, statusStreakMatches, ratingView)
          return (
            <article style={{ ...panelCard, marginBottom: 16, borderColor: meterTheme.pillBorder, boxShadow: `0 14px 34px rgba(0,0,0,0.12), inset 0 0 0 1px ${meterTheme.pillBorder}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' as const }}>
                <span style={{ ...dynamicStatusPill }}>{ratingStatus}</span>
                <span style={sectionKicker}>What this means</span>
              </div>
              <h3 style={{ margin: '0 0 10px', color: 'var(--foreground)', fontWeight: 900, fontSize: 20, letterSpacing: '-0.03em' }}>{rec.headline}</h3>
              <p style={{ margin: 0, color: 'var(--shell-copy-muted)', lineHeight: 1.65, fontSize: 15 }}>{rec.body}</p>
            </article>
          )
        })() : null}

        <article style={panelCard}>
          <div style={panelHead}>
            <div>
              <div style={sectionKicker}>USTA league context</div>
              <h2 style={panelTitle}>USTA leagues played</h2>
            </div>
            <span style={panelChip}>{ustaLeagueBreakdown.length} league{ustaLeagueBreakdown.length === 1 ? '' : 's'}</span>
          </div>

          {ustaLeagueBreakdown.length === 0 ? (
            <div style={{ ...emptyStateStack, marginTop: 16 }}>
              <p style={emptyText}>No USTA league match history is linked yet.</p>
              <p style={sectionText}>USTA leagues will appear here as played scorecards are imported with league metadata.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              {ustaLeagueBreakdown.map((league) => (
                <div key={league.leagueName} style={leagueRowStyle}>
                  <div style={{ display: 'grid', gap: 5 }}>
                    <strong style={{ color: 'var(--foreground-strong)', fontSize: 15 }}>{league.leagueName}</strong>
                    <span style={{ color: 'var(--shell-copy-muted)', fontSize: 13 }}>
                      Latest match {formatDate(league.latest)}
                    </span>
                  </div>
                  <div style={leagueBadgeWrapStyle}>
                    <span style={leagueBadgeBlueStyle}>{league.matches} match{league.matches === 1 ? '' : 'es'}</span>
                    <span style={leagueBadgeGreenStyle}>{league.wins}W - {league.losses}L</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article style={panelCard}>
          <div style={panelHead}>
            <div>
              <div style={sectionKicker}>TIQ competition context</div>
              <h2 style={panelTitle}>Active TIQ individual leagues</h2>
            </div>
            <span style={panelChip}>
              {tiqParticipationCount} active {tiqParticipationCount === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          <p style={sectionText}>
            USTA tells you where this player stands officially. TIQ individual leagues show where
            they are actively competing inside TenAceIQ&apos;s strategic competition layer.
          </p>

          {tiqParticipationWarning ? (
            <div
              style={{
                ...emptyStateStack,
                marginTop: 16,
                padding: '14px 16px',
                borderRadius: 18,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <p style={emptyText}>
                {tiqParticipationSource === 'local' ? 'Local TIQ participation fallback' : 'TIQ participation note'}
              </p>
              <p style={sectionText}>{tiqParticipationWarning}</p>
            </div>
          ) : null}

          {tiqParticipationCount === 0 ? (
            <div style={{ ...emptyStateStack, marginTop: 20 }}>
              <p style={emptyText}>No TIQ individual league entries yet.</p>
              <p style={sectionText}>
                This player has strong USTA and TIQ rating context already, but they have not joined
                an active TIQ individual competition season yet.
              </p>
              <div style={dynamicFollowRow}>
                <MiniLink href="/explore/leagues">Browse TIQ leagues</MiniLink>
                <MiniLink href="/compete/leagues">Open compete hub</MiniLink>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
              {tiqParticipations.map((entry) => (
                <div
                  key={`${entry.leagueId}-${entry.playerName}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 14,
                    flexWrap: 'wrap',
                    padding: '16px 18px',
                    borderRadius: 18,
                    border: '1px solid rgba(116,190,255,0.14)',
                    background: 'linear-gradient(180deg, rgba(30,58,104,0.28) 0%, rgba(10,18,36,0.66) 100%)',
                  }}
                >
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ color: '#f8fbff', fontWeight: 800, fontSize: 17 }}>{entry.leagueName}</div>
                    <div style={{ color: 'rgba(224,234,247,0.74)', fontSize: 13 }}>
                      {[entry.seasonLabel, entry.leagueFlight, entry.locationLabel].filter(Boolean).join(' - ') || 'TIQ Individual League'}
                    </div>
                  </div>
                  <div style={dynamicFollowRow}>
                    <MiniLink href={`/explore/leagues/tiq/${encodeURIComponent(entry.leagueId)}?league_id=${encodeURIComponent(entry.leagueId)}`}>
                      Open league
                    </MiniLink>
                    <MiniLink href="/compete/leagues">Compete</MiniLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <div style={dynamicContentGrid}>
          <article style={panelCard}>
            <div style={panelHead}>
              <div>
                <div style={sectionKicker}>Trend</div>
                <h2 style={panelTitle}>{capitalize(ratingView)} rating trend</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                {(['30d', '90d', 'all'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setChartWindow(w)}
                    style={{
                      padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                      background: chartWindow === w ? 'rgba(116,190,255,0.14)' : 'transparent',
                      border: `1px solid ${chartWindow === w ? 'rgba(116,190,255,0.30)' : 'rgba(116,190,255,0.12)'}`,
                      color: chartWindow === w ? '#93c5fd' : 'rgba(190,210,240,0.45)',
                      transition: 'all 120ms ease',
                    }}
                  >
                    {w === 'all' ? 'All' : w}
                  </button>
                ))}
                <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.10)' }} />
                {(['chart', 'table'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setHistoryMode(m)}
                    style={{
                      padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                      background: historyMode === m ? 'rgba(155,225,29,0.12)' : 'transparent',
                      border: `1px solid ${historyMode === m ? 'rgba(155,225,29,0.26)' : 'rgba(255,255,255,0.10)'}`,
                      color: historyMode === m ? '#d9f84a' : 'rgba(190,210,240,0.45)',
                      transition: 'all 120ms ease',
                    }}
                  >
                    {m === 'chart' ? 'Chart' : 'Table'}
                  </button>
                ))}
                <span style={panelChip}>{filteredChartPoints.length} pts</span>
              </div>
            </div>

            {filteredChartPoints.length === 0 ? (
              <div style={emptyStateStack}>
                <p style={emptyText}>No rating history for this window.</p>
                <p style={sectionText}>
                  {chartWindow !== 'all'
                    ? `No matches in the last ${chartWindow}. Switch to "All" to see full history.`
                    : 'This profile has not built enough snapshot history for a trendline yet.'}
                </p>
                <div style={dynamicFollowRow}>
                  {chartWindow !== 'all' ? (
                    <button type="button" onClick={() => setChartWindow('all')} style={{ ...secondaryMiniButton }}>Show all time</button>
                  ) : null}
                  <MiniLink href="/rankings">Compare on rankings</MiniLink>
                  <MiniLink href="/mylab">Open My Lab</MiniLink>
                </div>
              </div>
            ) : historyMode === 'table' ? (
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table style={dataTable}>
                  <thead>
                    <tr>
                      {['Date', 'Rating', 'Δ Delta', 'Win %', 'Opp rating', 'Multiplier'].map((h) => (
                        <th key={h} style={tableHead}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredChartPoints].reverse().map((pt, i) => {
                      const snap = snapshots.find((s) => s.snapshot_date === pt.date && (!s.rating_type || s.rating_type === ratingView || (ratingView === 'overall' && !s.rating_type)))
                      const positive = pt.delta !== null && pt.delta > 0
                      const negative = pt.delta !== null && pt.delta < 0
                      return (
                        <tr key={`${pt.date}-${i}`} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)' }}>
                          <td style={tableCell}>{formatDate(pt.date)}</td>
                          <td style={{ ...tableCell, fontWeight: 800 }}>{pt.rating.toFixed(3)}</td>
                          <td style={tableCell}>
                            {pt.delta !== null ? (
                              <span style={{ color: positive ? '#9be11d' : negative ? '#fca5a5' : 'var(--shell-copy-muted)', fontWeight: 800 }}>
                                {positive ? '+' : ''}{pt.delta.toFixed(3)}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ ...tableCell, color: 'var(--shell-copy-muted)' }}>{pt.winProbability != null ? `${pt.winProbability}%` : '—'}</td>
                          <td style={{ ...tableCell, color: 'var(--shell-copy-muted)' }}>{snap?.opponent_rating != null ? snap.opponent_rating.toFixed(2) : '—'}</td>
                          <td style={{ ...tableCell, color: 'var(--shell-copy-muted)' }}>{snap?.multiplier != null ? snap.multiplier.toFixed(2) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <SimpleLineChart points={filteredChartPoints} baseRating={baseRating} />
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '14px', marginTop: '12px', padding: '0 4px' }}>
                  {[
                    { dot: '#3FA7FF', label: 'Standard match' },
                    { dot: '#9be11d', label: 'Big gain (+0.08+)', large: true },
                    { dot: '#fca5a5', label: 'Big loss (−0.08+)', large: true },
                    { dot: '#ffd700', label: 'Upset win (won < 40% fav)', large: true },
                    { dot: undefined, dashed: 'rgba(155,225,29,0.55)', label: 'Projected trend' },
                    { dot: undefined, dashed: 'rgba(255,210,50,0.65)', label: 'USTA base' },
                  ].map((item) => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {item.dot ? (
                        <svg width={item.large ? 10 : 8} height={item.large ? 10 : 8} viewBox="0 0 10 10">
                          <circle cx="5" cy="5" r="5" fill={item.dot} />
                        </svg>
                      ) : item.dashed ? (
                        <svg width="20" height="4" viewBox="0 0 20 4">
                          <line x1="0" y1="2" x2="20" y2="2" stroke={item.dashed} strokeWidth="2" strokeDasharray="4 2" />
                        </svg>
                      ) : null}
                      <span style={{ color: 'var(--shell-copy-muted)', fontSize: '11px', fontWeight: 600 }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </article>

          <article style={panelCard}>
            <div style={panelHead}>
              <div>
                <div style={sectionKicker}>Recent results</div>
                <h2 style={panelTitle}>Latest match history</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' as const }}>
                <input
                  type="text"
                  value={matchSearch}
                  onChange={(e) => { setMatchSearch(e.target.value); setShowAllMatches(true) }}
                  placeholder="Search opponent, score…"
                  style={{ height: 34, padding: '0 12px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--foreground)', fontSize: 13, fontWeight: 600, minWidth: 0, width: 180, outline: 'none' }}
                />
                {matchSearch ? (
                  <button type="button" onClick={() => setMatchSearch('')} style={{ ...showAllButton, padding: '0 10px', fontSize: 12 }}>Clear</button>
                ) : filteredMatches.length > 10 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllMatches((prev) => !prev)}
                    onMouseEnter={() => setShowAllHovered(true)}
                    onMouseLeave={() => setShowAllHovered(false)}
                    style={{
                      ...showAllButton,
                      borderColor: showAllHovered ? 'rgba(155,225,29,0.45)' : 'rgba(155,225,29,0.25)',
                      background: showAllHovered ? 'rgba(155,225,29,0.12)' : 'rgba(155,225,29,0.06)',
                      color: showAllHovered ? 'rgba(155,225,29,1)' : 'rgba(155,225,29,0.85)',
                      transform: showAllHovered ? 'translateY(-1px)' : 'none',
                    }}
                  >
                    {showAllMatches ? 'Show less' : `Show all ${filteredMatches.length}`}
                  </button>
                ) : null}
                <span style={panelChip}>{matchSearch ? `${mostRecentMatches.length} result${mostRecentMatches.length !== 1 ? 's' : ''}` : `${showAllMatches ? filteredMatches.length : Math.min(10, filteredMatches.length)} shown`}</span>
              </div>
            </div>

            {mostRecentMatches.length === 0 ? (
              <div style={emptyStateStack}>
                <p style={emptyText}>No matches found for this view.</p>
                <p style={sectionText}>
                  Try another rating view or head back to the player directory to compare against teammates and nearby-rated players.
                </p>
                <div style={dynamicFollowRow}>
                  <MiniLink href="/players">Back to players</MiniLink>
                  <MiniLink href="/mylab">Open My Lab</MiniLink>
                </div>
              </div>
            ) : (
              <div style={tableWrap}>
                <table style={dataTable}>
                  <thead>
                    <tr>
                      <th style={tableHead}>Date</th>
                      <th style={tableHead}>Type</th>
                      <th style={tableHead}>Partner</th>
                      <th style={tableHead}>Opponent</th>
                      <th style={tableHead}>Score</th>
                      <th style={tableHead}>Quality</th>
                      <th style={tableHead}>Result</th>
                      <th style={tableHead}>Rating change</th>
                      <th style={tableHead}>Win%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mostRecentMatches.map((match) => (
                      <tr
                        key={match.id}
                        onMouseEnter={() => setHoveredMatchRow(match.id)}
                        onMouseLeave={() => setHoveredMatchRow(null)}
                        style={{
                          background: hoveredMatchRow === match.id ? 'rgba(116,190,255,0.05)' : undefined,
                          transition: 'background 120ms ease',
                        }}
                      >
                        <td style={tableCell}>{formatDate(match.date)}</td>
                        <td style={tableCell}>{capitalize(match.matchType)}</td>
                        <td style={tableCell}>{match.partner || '—'}</td>
                        <td style={tableCell}>
                          {match.opponentIds.length === 1 ? (
                            <Link
                              href="/mylab"
                              style={{ color: '#93c5fd', fontWeight: 700, textDecoration: 'none' }}
                            >
                              {match.opponent}
                            </Link>
                          ) : match.opponentIds.length > 1 ? (
                            <Link
                              href={`/players/${encodeURIComponent(match.opponentIds[0])}`}
                              style={{ color: '#93c5fd', fontWeight: 700, textDecoration: 'none' }}
                            >
                              {match.opponent}
                            </Link>
                          ) : (
                            match.opponent
                          )}
                        </td>
                        <td style={tableCell}>{match.score}</td>
                        <td style={tableCell}>
                          {(() => {
                            const q = getMatchScoreQuality(match.score)
                            if (!q) return <span style={{ color: 'rgba(190,210,240,0.3)', fontSize: 12 }}>—</span>
                            const isPositive = q === 'Dominant'
                            const isTense = q === 'Tiebreak' || q === '3 sets'
                            return (
                              <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' as const, background: isPositive ? 'rgba(155,225,29,0.10)' : isTense ? 'rgba(251,146,60,0.10)' : 'rgba(116,190,255,0.08)', color: isPositive ? '#d9f84a' : isTense ? '#fed7aa' : '#93c5fd', border: `1px solid ${isPositive ? 'rgba(155,225,29,0.20)' : isTense ? 'rgba(251,146,60,0.18)' : 'rgba(116,190,255,0.14)'}` }}>
                                {q}
                              </span>
                            )
                          })()}
                        </td>
                        <td style={tableCell}>
                          <span
                            style={{
                              ...resultPill,
                              ...(match.result === 'W' ? resultWin : resultLoss),
                            }}
                          >
                            {match.result}
                          </span>
                        </td>
                        <MatchDeltaCell
                          snap={snapshotByMatchId.get(`${match.id}:${match.matchType}`) ?? snapshotByMatchId.get(`${match.id}:overall`) ?? null}
                        />
                        <MatchWinPctCell
                          snap={snapshotByMatchId.get(`${match.id}:${match.matchType}`) ?? snapshotByMatchId.get(`${match.id}:overall`) ?? null}
                          result={match.result}
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>

        {opponentRecords.length > 0 ? (
          <article style={panelCard}>
            <div style={panelHead}>
              <div>
                <div style={sectionKicker}>Rivalry records</div>
                <h2 style={panelTitle}>Repeat opponents</h2>
              </div>
              <span style={panelChip}>{opponentRecords.length} opponents</span>
            </div>
            <p style={sectionText}>
              Players faced at least twice. Win rate reflects all tracked matches, not just the current view.
            </p>
            <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
              {opponentRecords.map((opp) => {
                const rate = Math.round((opp.wins / opp.total) * 100)
                const dominant = rate >= 70
                const struggling = rate <= 30
                return (
                  <div key={opp.name} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' as const, padding: '11px 14px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {opp.id ? (
                        <Link href="/mylab" style={{ color: '#93c5fd', fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, textDecoration: 'none' }}>{opp.name}</Link>
                      ) : (
                        <div style={{ color: '#f8fbff', fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{opp.name}</div>
                      )}
                      <div style={{ color: 'rgba(224,234,247,0.5)', fontSize: 12, marginTop: 2 }}>{opp.total} match{opp.total === 1 ? '' : 'es'} · last {formatDate(opp.lastDate)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 900, fontSize: 15, color: '#f8fbff' }}>{opp.wins}-{opp.losses}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: dominant ? 'rgba(155,225,29,0.10)' : struggling ? 'rgba(239,68,68,0.10)' : 'rgba(116,190,255,0.08)', color: dominant ? '#d9f84a' : struggling ? '#fca5a5' : '#93c5fd', border: `1px solid ${dominant ? 'rgba(155,225,29,0.20)' : struggling ? 'rgba(239,68,68,0.18)' : 'rgba(116,190,255,0.14)'}` }}>
                        {rate}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </article>
        ) : null}

        {seasonBreakdown.length > 0 ? (
          <article style={panelCard}>
            <div style={panelHead}>
              <div>
                <div style={sectionKicker}>Season history</div>
                <h2 style={panelTitle}>Year-by-year performance</h2>
              </div>
              <span style={panelChip}>{seasonBreakdown.length} season{seasonBreakdown.length === 1 ? '' : 's'}</span>
            </div>
            <p style={sectionText}>
              Match record, singles/doubles split, and cumulative rating movement grouped by calendar year.
            </p>
            <div style={{ overflowX: 'auto', marginTop: 16 }}>
              <table style={{ ...dataTable, minWidth: 560 }}>
                <thead>
                  <tr>
                    <th style={tableHead}>Season</th>
                    <th style={tableHead}>Record</th>
                    <th style={tableHead}>Win %</th>
                    <th style={tableHead}>Singles</th>
                    <th style={tableHead}>Doubles</th>
                    <th style={tableHead}>Rating movement</th>
                  </tr>
                </thead>
                <tbody>
                  {seasonBreakdown.map((s) => {
                    const positive = s.netDelta !== null && s.netDelta > 0
                    const negative = s.netDelta !== null && s.netDelta < 0
                    const goodWR = s.winRate >= 60
                    const poorWR = s.winRate < 40
                    return (
                      <tr key={s.year}>
                        <td style={{ ...tableCell, fontWeight: 900, fontSize: 15, color: 'var(--foreground)' }}>{s.year}</td>
                        <td style={tableCell}>
                          <span style={{ fontWeight: 800 }}>{s.wins}W</span>
                          <span style={{ color: 'rgba(190,210,240,0.4)', margin: '0 4px' }}>–</span>
                          <span style={{ fontWeight: 800 }}>{s.losses}L</span>
                        </td>
                        <td style={tableCell}>
                          <span style={{ fontSize: 13, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: goodWR ? 'rgba(155,225,29,0.10)' : poorWR ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)', color: goodWR ? '#d9f84a' : poorWR ? '#fca5a5' : 'var(--shell-copy-muted)', border: `1px solid ${goodWR ? 'rgba(155,225,29,0.20)' : poorWR ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.08)'}` }}>
                            {s.winRate}%
                          </span>
                        </td>
                        <td style={{ ...tableCell, color: 'var(--shell-copy-muted)' }}>{s.singles}</td>
                        <td style={{ ...tableCell, color: 'var(--shell-copy-muted)' }}>{s.doubles}</td>
                        <td style={tableCell}>
                          {s.netDelta !== null ? (
                            <span style={{ color: positive ? '#9be11d' : negative ? '#fca5a5' : 'var(--shell-copy-muted)', fontWeight: 800, fontSize: 13 }}>
                              {s.netDelta > 0 ? '+' : ''}{s.netDelta.toFixed(3)}
                            </span>
                          ) : (
                            <span style={{ color: 'rgba(190,210,240,0.3)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </article>
        ) : null}

        {nearbyPlayers.length > 0 ? (
          <article style={panelCard}>
            <div style={panelHead}>
              <div>
                <div style={sectionKicker}>Competitive context</div>
                <h2 style={panelTitle}>Who to play</h2>
              </div>
              <span style={panelChip}>{nearbyPlayers.length} within ±0.15</span>
            </div>
            <p style={sectionText}>
              Players currently rated within 0.15 TIQ of this profile — the most competitive match range for pushing the signal in either direction.
            </p>
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              {nearbyPlayers.map((p) => {
                const diff = p.overall_dynamic_rating - selectedDynamicRating
                const isHigher = diff > 0.02
                const isLower = diff < -0.02
                return (
                  <div
                    key={p.id}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' as const, padding: '13px 16px', borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div>
                      <Link href={`/players/${p.id}`} style={{ color: '#f8fbff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>{p.name}</Link>
                      <div style={{ color: 'rgba(224,234,247,0.5)', fontSize: 12, marginTop: 3 }}>{p.location || 'No location'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#f8fbff' }}>{p.overall_dynamic_rating.toFixed(2)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isHigher ? '#93c5fd' : isLower ? '#9be11d' : 'rgba(224,234,247,0.5)' }}>
                        {isHigher ? `▲ +${diff.toFixed(2)}` : isLower ? `▼ ${diff.toFixed(2)}` : '≈ even'}
                      </span>
                      <Link href="/mylab" style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(116,190,255,0.18)', background: 'rgba(116,190,255,0.07)', color: '#93c5fd', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>My Lab</Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </article>
        ) : null}
      </section>
    </SiteShell>
  )
}

function MatchDeltaCell({ snap }: { snap: SnapshotRow | null }) {
  if (!snap || snap.delta == null) {
    return <td style={tableCell}>—</td>
  }
  const delta = snap.delta
  const sign = delta >= 0 ? '+' : ''
  return (
    <td style={tableCell}>
      <span style={{ color: delta >= 0 ? '#9be11d' : '#fca5a5', fontWeight: 800, fontSize: 13 }}>
        {sign}{delta.toFixed(3)}
      </span>
    </td>
  )
}

function MatchWinPctCell({ snap, result }: { snap: SnapshotRow | null; result: 'W' | 'L' }) {
  if (!snap || snap.win_probability == null) {
    return <td style={tableCell}>—</td>
  }
  const pct = snap.win_probability
  const isUpset = (result === 'W' && pct < 40) || (result === 'L' && pct > 60)
  return (
    <td style={tableCell}>
      <span style={{ color: isUpset ? '#fed7aa' : 'var(--shell-copy-muted)', fontWeight: isUpset ? 800 : 600, fontSize: 13 }}>
        {pct}%{isUpset ? ' upset' : ''}
      </span>
    </td>
  )
}

function MiniLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...secondaryMiniLink,
        background: hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
        borderColor: hovered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'all 140ms ease',
      }}
    >
      {children}
    </Link>
  )
}

function MiniButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...secondaryMiniButton,
        background: hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
        borderColor: hovered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'all 140ms ease',
      }}
    >
      {children}
    </button>
  )
}

function BreadcrumbLink({ href, label }: { href: string; label: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...breadcrumbLink,
        color: hovered ? 'rgba(190,210,240,0.92)' : 'rgba(190,210,240,0.60)',
        transform: hovered ? 'translateX(-2px)' : 'none',
        transition: 'color 140ms ease, transform 140ms ease',
      }}
    >
      {label}
    </Link>
  )
}

function StatChip({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      style={{
        ...chipStat,
        ...(accent ? chipStatAccent : {}),
      }}
    >
      <div
        style={{
          ...chipStatLabel,
          ...(accent ? { color: 'rgba(255,255,255,0.82)' } : {}),
        }}
      >
        {label}
      </div>
      <div
        style={{
          ...chipStatValue,
          ...(accent ? { color: '#07111d' } : {}),
        }}
      >
        {value}
      </div>
    </div>
  )
}

type ChartPoint = { x: number; date: string; rating: number; delta: number | null; winProbability: number | null }

function dotStyle(point: ChartPoint): { fill: string; halo: string; r: number } {
  const { delta, winProbability } = point
  // Upset win: won despite ≤40% chance
  if (delta !== null && delta > 0 && winProbability !== null && winProbability <= 40) {
    return { fill: '#fb923c', halo: 'rgba(251,146,60,0.22)', r: 5.5 }
  }
  // Big gain: delta > 0.08
  if (delta !== null && delta > 0.08) {
    return { fill: '#9be11d', halo: 'rgba(155,225,29,0.20)', r: 5.5 }
  }
  // Big loss: delta < -0.08
  if (delta !== null && delta < -0.08) {
    return { fill: '#f87171', halo: 'rgba(239,68,68,0.20)', r: 5.5 }
  }
  // Normal
  return { fill: '#255BE3', halo: 'rgba(37,91,227,0.18)', r: 4.5 }
}

function SimpleLineChart({ points, baseRating }: { points: ChartPoint[]; baseRating?: number }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; flip: boolean } | null>(null)

  const width = 920
  const height = 304
  const padding = 34
  const chartHeight = 256

  const minRating = Math.min(...points.map((p) => p.rating))
  const maxRating = Math.max(...points.map((p) => p.rating))
  const spread = Math.max(maxRating - minRating, 0.1)
  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0

  const path = points
    .map((point, index) => {
      const x = padding + index * xStep
      const y = chartHeight - padding - ((point.rating - minRating) / spread) * (chartHeight - padding * 2)
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  const projectionPath = (() => {
    if (points.length < 5) return null
    const recentDeltas = points.slice(-10).map((p) => p.delta).filter((d): d is number => d !== null)
    if (recentDeltas.length < 3) return null
    const avgDelta = recentDeltas.reduce((a, b) => a + b, 0) / recentDeltas.length
    const lastPoint = points[points.length - 1]
    const lastX = padding + (points.length - 1) * xStep
    const lastY = chartHeight - padding - ((lastPoint.rating - minRating) / spread) * (chartHeight - padding * 2)
    const projSteps = 5
    const projXStep = xStep > 0 ? xStep : (width - padding * 2) / 10
    let d = `M ${lastX} ${lastY}`
    for (let i = 1; i <= projSteps; i++) {
      const projRating = lastPoint.rating + avgDelta * i
      const px = lastX + i * projXStep
      const py = chartHeight - padding - ((projRating - minRating) / spread) * (chartHeight - padding * 2)
      d += ` L ${px} ${py}`
    }
    return { d, positive: avgDelta >= 0 }
  })()

  const upsets = points.filter((p) => p.delta !== null && p.delta > 0 && p.winProbability !== null && p.winProbability <= 40).length
  const bigGains = points.filter((p) => p.delta !== null && p.delta > 0.08).length
  const bigLosses = points.filter((p) => p.delta !== null && p.delta < -0.08).length

  const labelIndices = getSpreadIndices(points.length, 6)
  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null

  function handleChartMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (points.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = e.clientX - rect.left
    const svgX = (relX / rect.width) * width
    const nearestIdx = xStep > 0
      ? Math.min(Math.max(0, Math.round((svgX - padding) / xStep)), points.length - 1)
      : 0
    setHoveredIndex(nearestIdx)
    setTooltipPos({ x: relX, y: e.clientY - rect.top, flip: relX > rect.width * 0.55 })
  }

  function handleChartMouseLeave() {
    setHoveredIndex(null)
    setTooltipPos(null)
  }

  return (
    <div style={{ ...chartShell, position: 'relative' }}>
      <svg
        width={width}
        height={height}
        style={{ ...chartSvg, cursor: points.length > 0 ? 'crosshair' : undefined }}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleChartMouseMove}
        onMouseLeave={handleChartMouseLeave}
      >
        <defs>
          <linearGradient id="playerLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#255BE3" />
            <stop offset="55%" stopColor="#3FA7FF" />
            <stop offset="100%" stopColor="#B8E61A" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} rx="20" fill="#0f1c38" />

        {[0.2, 0.4, 0.6, 0.8].map((line, index) => {
          const y = padding + (chartHeight - padding * 2) * line
          return (
            <line
              key={index}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="1"
            />
          )
        })}

        {baseRating !== undefined && baseRating >= minRating - 0.05 && baseRating <= maxRating + 0.05 ? (() => {
          const by = chartHeight - padding - ((baseRating - minRating) / spread) * (chartHeight - padding * 2)
          const topY = padding
          const bottomY = chartHeight - padding
          return (
            <>
              <rect x={padding} y={topY} width={width - padding * 2} height={by - topY} fill="rgba(155,225,29,0.04)" />
              <rect x={padding} y={by} width={width - padding * 2} height={bottomY - by} fill="rgba(239,68,68,0.05)" />
              <line x1={padding} x2={width - padding} y1={by} y2={by} stroke="rgba(255,210,50,0.55)" strokeWidth="1.5" strokeDasharray="6 3" />
              <text x={width - padding + 4} y={by + 4} textAnchor="start" fill="rgba(255,210,50,0.65)" fontSize="10" fontWeight="700">USTA</text>
            </>
          )
        })() : null}

        {[1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0]
          .filter((band) => band >= minRating - 0.05 && band <= maxRating + 0.05)
          .map((band) => {
            const y = chartHeight - padding - ((band - minRating) / spread) * (chartHeight - padding * 2)
            return (
              <g key={`band-${band}`}>
                <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="rgba(147,197,253,0.18)" strokeWidth="1" strokeDasharray="4 3" />
                <text x={padding - 5} y={y + 4} textAnchor="end" fill="rgba(147,197,253,0.45)" fontSize="10" fontWeight="700">{band.toFixed(1)}</text>
              </g>
            )
          })}

        <path
          d={path}
          fill="none"
          stroke="url(#playerLineGradient)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {projectionPath ? (
          <path
            d={projectionPath.d}
            fill="none"
            stroke={projectionPath.positive ? 'rgba(155,225,29,0.45)' : 'rgba(239,68,68,0.40)'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
        ) : null}

        {points.map((point, index) => {
          const x = padding + index * xStep
          const y = chartHeight - padding - ((point.rating - minRating) / spread) * (chartHeight - padding * 2)
          const { fill, halo, r } = dotStyle(point)

          return (
            <g key={`${point.date}-${index}`}>
              <circle cx={x} cy={y} r={r + 5} fill={halo} />
              <circle cx={x} cy={y} r={r} fill={fill} />
            </g>
          )
        })}

        {labelIndices.map((i) => {
          const point = points[i]
          if (!point) return null
          const x = padding + i * xStep
          return (
            <text
              key={`label-${i}`}
              x={x}
              y={height - 6}
              textAnchor="middle"
              fill="rgba(190,210,240,0.55)"
              fontSize="11"
              fontWeight="600"
            >
              {formatChartDate(point.date)}
            </text>
          )
        })}

        {hoveredIndex !== null && (() => {
          const hx = padding + hoveredIndex * xStep
          const hy = chartHeight - padding - ((points[hoveredIndex].rating - minRating) / spread) * (chartHeight - padding * 2)
          return (
            <circle
              cx={hx}
              cy={hy}
              r={11}
              fill="rgba(255,255,255,0.08)"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={1.5}
              style={{ pointerEvents: 'none' }}
            />
          )
        })()}
      </svg>

      {hoveredPoint && tooltipPos ? (
        <div
          style={{
            position: 'absolute',
            top: Math.max(tooltipPos.y - 92, 8),
            left: tooltipPos.flip ? tooltipPos.x - 178 : tooltipPos.x + 14,
            pointerEvents: 'none',
            zIndex: 10,
            background: 'rgba(8,18,38,0.97)',
            border: '1px solid rgba(116,190,255,0.24)',
            borderRadius: 14,
            padding: '10px 14px',
            minWidth: 162,
            boxShadow: '0 14px 34px rgba(0,0,0,0.38)',
          }}
        >
          <div style={{ color: '#8fb7ff', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>
            {formatChartDate(hoveredPoint.date)}
          </div>
          <div style={{ color: '#f8fbff', fontSize: 19, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
            {hoveredPoint.rating.toFixed(3)}
          </div>
          {hoveredPoint.delta !== null ? (
            <div style={{ marginTop: 5, fontSize: 13, fontWeight: 800, color: hoveredPoint.delta >= 0 ? '#9be11d' : '#f87171' }}>
              {hoveredPoint.delta >= 0 ? '+' : ''}{hoveredPoint.delta.toFixed(3)} change
            </div>
          ) : null}
          {hoveredPoint.winProbability !== null ? (
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: 'rgba(224,234,247,0.68)' }}>
              {hoveredPoint.winProbability}% win prob
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={chartMeta}>
        {points.length} data point{points.length === 1 ? '' : 's'} · Latest{' '}
        {points[points.length - 1]?.rating.toFixed(2)}
        {upsets > 0 ? ` · ${upsets} upset win${upsets > 1 ? 's' : ''} (orange)` : ''}
        {bigGains > 0 ? ` · ${bigGains} big gain${bigGains > 1 ? 's' : ''} (green)` : ''}
        {bigLosses > 0 ? ` · ${bigLosses} big loss${bigLosses > 1 ? 'es' : ''} (red)` : ''}
      </div>
    </div>
  )
}

function buildPlayerRecommendation(
  status: RatingStatus,
  ratingDiff: number,
  confidence: ConfidenceLevel,
  statusStreak: number,
  ratingView: RatingView,
): { headline: string; body: string } {
  const view = ratingView === 'overall' ? 'overall' : ratingView
  const streakNote = statusStreak >= 5 ? ` This signal has held for ${statusStreak} consecutive matches.` : ''
  const diffStr = `${Math.abs(ratingDiff).toFixed(2)}`
  const confNote = confidence === 'Low' ? 'Sample is still building — more matches will sharpen this read.' : confidence === 'High' ? 'This is a high-confidence read based on your match history.' : 'Moderate sample — a few more results will lock this in.'

  switch (status) {
    case 'Bump Up Pace':
      return {
        headline: 'You\'re tracking ahead of your USTA level.',
        body: `TIQ shows you playing ${diffStr} above your USTA base in ${view}.${streakNote} ${confNote} Keep competing at this level — especially in singles against similarly-rated opponents — to hold this gap through your next rating review window. Avoid coasting against lower-rated competition; the engine weights quality of result over volume.`,
      }
    case 'Trending Up':
      return {
        headline: 'Good momentum — keep pushing.',
        body: `TIQ is tracking ${diffStr} above your USTA base in ${view}.${streakNote} You're not yet in Bump Up Pace range, but ${(0.15 - ratingDiff).toFixed(2)} more points of separation would get you there. Focus on wins against players at or above your rating — that's where the signal moves fastest. ${confNote}`,
      }
    case 'Holding':
      return {
        headline: 'Performing at level.',
        body: `TIQ and USTA signals are closely aligned (${ratingDiff >= 0 ? '+' : ''}${ratingDiff.toFixed(2)}) in ${view}.${streakNote} ${confNote} To shift the signal upward, prioritize matches against players rated at or above you — the engine rewards quality of competition over easy wins.`,
      }
    case 'At Risk':
      return {
        headline: 'USTA signal is sliding below your base.',
        body: `TIQ shows ${diffStr} below your USTA base in ${view}.${streakNote} ${confNote} Competitive wins at or near your rated level are the most direct recovery path. Close losses against strong competition still move the signal better than blowout wins against lower-rated players — focus on quality matchups.`,
      }
    case 'Drop Watch':
      return {
        headline: 'Gap warrants attention.',
        body: `TIQ shows ${diffStr} below your USTA base in ${view} — well into knockdown range.${streakNote} ${confNote} Consistent wins against rated opponents are the clearest path forward. Review your recent match log: look for patterns in the loss column and check whether your toughest matches are close or getting away from you — that distinction matters for recovery pace.`,
      }
  }
}

function getMatchScoreQuality(score: string | null): string {
  if (!score) return ''
  if (/\b6-0\b|\b0-6\b/.test(score)) return 'Dominant'
  if (/7-6|6-7|\(/.test(score)) return 'Tiebreak'
  const sets = score.split(/[;,|]/).map((s) => s.trim()).filter((s) => /\d-\d/.test(s))
  if (sets.length >= 3) return '3 sets'
  return ''
}

function getSpreadIndices(total: number, count: number): number[] {
  if (total === 0) return []
  if (total <= count) return Array.from({ length: total }, (_, i) => i)
  const result = [0]
  const step = (total - 1) / (count - 1)
  for (let i = 1; i < count - 1; i++) {
    result.push(Math.round(i * step))
  }
  result.push(total - 1)
  return result
}

function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr.slice(5) // fallback: MM-DD
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function normalizeMatchType(value: string | null | undefined): MatchType {
  return value === 'doubles' ? 'doubles' : 'singles'
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function toRatingNumber(value: number | string | null | undefined, fallback = 3.5) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getNextThreshold(rating: number) {
  const threshold = Math.ceil(rating * 2) / 2
  return threshold <= rating ? threshold + 0.5 : threshold
}

function getProgressToNextLevel(rating: number, next: number) {
  const previous = next - 0.5
  const percent = Math.max(0, Math.min(100, ((rating - previous) / 0.5) * 100))
  const remaining = Math.max(0, next - rating)

  return { previous, percent, remaining }
}

function getRatingStatus(base: number, dynamic: number): RatingStatus {
  const diff = dynamic - base

  if (diff >= 0.15) return 'Bump Up Pace'
  if (diff >= 0.07) return 'Trending Up'
  if (diff > -0.07) return 'Holding'
  if (diff > -0.15) return 'At Risk'
  return 'Drop Watch'
}

function getTrendDirection(points: Array<{ rating: number }>): TrendDirection {
  if (points.length < 2) return 'flat'

  const recent = points.slice(-5)
  const first = recent[0]?.rating ?? 0
  const last = recent[recent.length - 1]?.rating ?? 0

  if (last > first + 0.02) return 'up'
  if (last < first - 0.02) return 'down'
  return 'flat'
}

function getConfidence(matches: number): ConfidenceLevel {
  if (matches < 10) return 'Low'
  if (matches < 30) return 'Medium'
  return 'High'
}

function getRecentTrendDelta(points: Array<{ rating: number }>) {
  if (points.length < 2) return 0
  const recent = points.slice(-5)
  const first = recent[0]?.rating ?? 0
  const last = recent[recent.length - 1]?.rating ?? 0
  return roundToTwo(last - first)
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function getTrendLabel(direction: TrendDirection) {
  if (direction === 'up') return 'Trending up'
  if (direction === 'down') return 'Trending down'
  return 'Holding steady'
}

function getTrendShortLabel(direction: TrendDirection) {
  if (direction === 'up') return 'Up'
  if (direction === 'down') return 'Down'
  return 'Flat'
}

function getTrendIcon(direction: TrendDirection) {
  if (direction === 'up') return '▲'
  if (direction === 'down') return '▼'
  return '→'
}

function getMeterTheme(status: RatingStatus) {
  switch (status) {
    case 'Bump Up Pace':
      return {
        fill: 'linear-gradient(135deg, #9be11d 0%, #4ade80 60%, #22c55e 100%)',
        shadow: '0 10px 24px rgba(155,225,29,0.25)',
        pillBackground: 'rgba(155,225,29,0.16)',
        pillColor: '#d9f84a',
        pillBorder: 'rgba(155,225,29,0.28)',
        trendBackground: 'rgba(46, 204, 113, 0.12)',
        trendColor: '#bef264',
        trendBorder: 'rgba(132, 204, 22, 0.24)',
      }
    case 'Trending Up':
      return {
        fill: 'linear-gradient(135deg, #60a5fa 0%, #34d399 65%, #9be11d 100%)',
        shadow: '0 10px 24px rgba(52,211,153,0.22)',
        pillBackground: 'rgba(52,211,153,0.14)',
        pillColor: '#a7f3d0',
        pillBorder: 'rgba(52,211,153,0.24)',
        trendBackground: 'rgba(52,211,153,0.10)',
        trendColor: '#a7f3d0',
        trendBorder: 'rgba(52,211,153,0.22)',
      }
    case 'Holding':
      return {
        fill: 'linear-gradient(135deg, #60a5fa 0%, #3fa7ff 50%, #93c5fd 100%)',
        shadow: '0 10px 24px rgba(63,167,255,0.22)',
        pillBackground: 'rgba(63,167,255,0.12)',
        pillColor: '#bfdbfe',
        pillBorder: 'rgba(63,167,255,0.22)',
        trendBackground: 'rgba(96,165,250,0.10)',
        trendColor: '#dbeafe',
        trendBorder: 'rgba(96,165,250,0.20)',
      }
    case 'At Risk':
      return {
        fill: 'linear-gradient(135deg, #facc15 0%, #fb923c 65%, #f59e0b 100%)',
        shadow: '0 10px 24px rgba(251,146,60,0.22)',
        pillBackground: 'rgba(251,146,60,0.14)',
        pillColor: '#fed7aa',
        pillBorder: 'rgba(251,146,60,0.24)',
        trendBackground: 'rgba(245,158,11,0.10)',
        trendColor: '#fde68a',
        trendBorder: 'rgba(245,158,11,0.22)',
      }
    case 'Drop Watch':
      return {
        fill: 'linear-gradient(135deg, #f87171 0%, #ef4444 55%, #dc2626 100%)',
        shadow: '0 10px 24px rgba(239,68,68,0.22)',
        pillBackground: 'rgba(239,68,68,0.14)',
        pillColor: '#fecaca',
        pillBorder: 'rgba(239,68,68,0.24)',
        trendBackground: 'rgba(239,68,68,0.10)',
        trendColor: '#fecaca',
        trendBorder: 'rgba(239,68,68,0.22)',
      }
  }
}

const heroWrap: CSSProperties = {
  position: 'relative',
  zIndex: 1,
}

const heroShell: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  borderRadius: '30px',
  background: 'var(--shell-panel-bg-strong)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow:
    '0 26px 80px rgba(7,18,42,0.16), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 80px rgba(88,170,255,0.03)',
  overflow: 'hidden',
  position: 'relative',
}

const heroNoise: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at 12% 0%, rgba(116,190,255,0.26), transparent 28%), radial-gradient(circle at 72% 8%, rgba(88,170,255,0.18), transparent 24%), radial-gradient(circle at 100% 0%, rgba(155,225,29,0.10), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 26%)',
  pointerEvents: 'none',
}

const heroContent: CSSProperties = {
  display: 'grid',
  alignItems: 'stretch',
  position: 'relative',
  zIndex: 1,
}

const heroLeft: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '16px',
  minWidth: 0,
}

const heroRight: CSSProperties = {
  display: 'grid',
  gap: '14px',
  alignContent: 'start',
  minWidth: 0,
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  padding: '7px 11px',
  borderRadius: '999px',
  color: 'var(--foreground)',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const heroTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground)',
  fontWeight: 900,
  letterSpacing: '-0.045em',
}

const heroText: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  fontWeight: 500,
}

const followRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  marginTop: '-4px',
}

const heroHintRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '4px',
}

const heroHintPill: CSSProperties = {
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  borderRadius: '999px',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 700,
}

const stalenessPill: CSSProperties = {
  ...heroHintPill,
  background: 'rgba(251,146,60,0.08)',
  border: '1px solid rgba(251,146,60,0.22)',
  color: '#fed7aa',
}

const meterCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.14), inset 0 1px 0 rgba(255,255,255,0.03)',
  maxWidth: '560px',
}

const meterHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  marginBottom: '14px',
}

const meterLeftGroup: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  minWidth: 0,
}

const meterLabel: CSSProperties = {
  color: 'var(--foreground)',
  fontWeight: 900,
  fontSize: '22px',
  letterSpacing: '-0.03em',
}

const meterStatusRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  alignItems: 'center',
}

const statusPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const confidencePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  border: '1px solid var(--shell-panel-border)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.03em',
}

const meterSubtext: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontWeight: 600,
  fontSize: '14px',
  lineHeight: 1.6,
}

const trendPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  width: 'fit-content',
  minHeight: '34px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '13px',
  fontWeight: 800,
}

const trendDeltaText: CSSProperties = {
  opacity: 0.82,
}

const meterValueGroup: CSSProperties = {
  textAlign: 'right',
}

const meterCurrent: CSSProperties = {
  color: 'var(--foreground)',
  fontWeight: 900,
  fontSize: '32px',
  lineHeight: 1,
  letterSpacing: '-0.04em',
}

const meterTarget: CSSProperties = {
  marginTop: '6px',
  color: '#d9f84a',
  fontWeight: 800,
  fontSize: '13px',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const meterDelta: CSSProperties = {
  marginTop: '8px',
  color: 'var(--shell-copy-muted)',
  fontWeight: 800,
  fontSize: '13px',
}

const meterTrack: CSSProperties = {
  width: '100%',
  height: '14px',
  borderRadius: '999px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  overflow: 'hidden',
}

const meterFill: CSSProperties = {
  height: '100%',
  borderRadius: '999px',
}

const meterFooter: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  marginTop: '10px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  fontWeight: 700,
}

const focusCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.14), inset 0 1px 0 rgba(255,255,255,0.03)',
}

const focusHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  marginBottom: '14px',
}

const focusLabel: CSSProperties = {
  color: 'var(--foreground)',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: '-0.03em',
}

const focusSubtitle: CSSProperties = {
  marginTop: '4px',
  color: 'var(--shell-copy-muted)',
  fontWeight: 600,
  fontSize: '14px',
  lineHeight: 1.6,
}

const secondaryMiniLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '13px',
}

const secondaryMiniButton: CSSProperties = {
  ...secondaryMiniLink,
  appearance: 'none',
  cursor: 'pointer',
}

const segmentWrap: CSSProperties = {
  display: 'grid',
  gap: '10px',
  marginBottom: '14px',
}

const segmentButton: CSSProperties = {
  border: '1px solid var(--shell-panel-border)',
  borderRadius: '16px',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  minHeight: '52px',
  padding: '0 14px',
  fontSize: '14px',
  fontWeight: 800,
  cursor: 'pointer',
}

const segmentButtonActive: CSSProperties = {
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  color: '#04121f',
  border: '1px solid rgba(155,225,29,0.45)',
  boxShadow: '0 12px 30px rgba(155,225,29,0.25)',
}

const focusMetrics: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const summaryCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.14), inset 0 1px 0 rgba(255,255,255,0.03)',
  minWidth: 0,
}

const summaryTitle: CSSProperties = {
  color: 'var(--foreground)',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: '-0.03em',
  marginBottom: '14px',
}

const summaryStatsGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
}

const chipStat: CSSProperties = {
  borderRadius: '18px',
  padding: '12px 12px 11px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  minWidth: 0,
}

const chipStatAccent: CSSProperties = {
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  border: '1px solid rgba(155,225,29,0.35)',
}

const chipStatLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '6px',
}

const chipStatValue: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: '20px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const statsGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
  marginBottom: '26px',
}

const statCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.14), inset 0 1px 0 rgba(255,255,255,0.03)',
  minWidth: 0,
}

const statCardAccentGreen: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.32)',
  boxShadow: '0 10px 30px rgba(155,225,29,0.12), inset 0 0 0 1px rgba(155,225,29,0.06)',
}

const signalGridStyle = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  gap: '14px',
  marginBottom: '18px',
})

const signalCardStyle: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 14px 34px rgba(7,18,40,0.10)',
}

const signalLabelStyle: CSSProperties = {
  color: '#8fb7ff',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const signalValueStyle: CSSProperties = {
  marginTop: '10px',
  color: 'var(--foreground)',
  fontSize: '1.32rem',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const signalNoteStyle: CSSProperties = {
  marginTop: '8px',
  color: 'var(--shell-copy-muted)',
  fontSize: '.94rem',
  lineHeight: 1.6,
}

const statLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.5,
  fontWeight: 750,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const statValue: CSSProperties = {
  marginTop: '8px',
  color: 'var(--foreground)',
  fontSize: '34px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const statValueSmall: CSSProperties = {
  marginTop: '8px',
  color: 'var(--foreground)',
  fontSize: '24px',
  lineHeight: 1.15,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '32px 18px 10px',
}

const contentGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const panelCard: CSSProperties = {
  borderRadius: '28px',
  padding: '22px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.14), inset 0 1px 0 rgba(255,255,255,0.03)',
  minWidth: 0,
}

const panelHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '16px',
  flexWrap: 'wrap',
}

const leagueRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
  padding: '14px 16px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.035)',
}

const leagueBadgeWrapStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
}

const leagueBadgeBlueStyle: CSSProperties = {
  padding: '4px 9px',
  borderRadius: '999px',
  background: 'rgba(116,190,255,0.10)',
  border: '1px solid rgba(116,190,255,0.18)',
  color: '#93c5fd',
  fontSize: '12px',
  fontWeight: 800,
}

const leagueBadgeGreenStyle: CSSProperties = {
  ...leagueBadgeBlueStyle,
  background: 'rgba(155,225,29,0.10)',
  border: '1px solid rgba(155,225,29,0.20)',
  color: '#d9f84a',
}

const sectionKicker: CSSProperties = {
  color: '#93c5fd',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
}

const panelTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground)',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: '-0.04em',
}

const panelChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '38px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'var(--shell-chip-bg)',
  color: '#d9f84a',
  border: '1px solid rgba(155,225,29,0.25)',
  fontWeight: 800,
  fontSize: '13px',
}

const emptyText: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '15px',
  lineHeight: 1.7,
  fontWeight: 550,
}

const emptyStateStack: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const tableWrap: CSSProperties = {
  overflowX: 'auto',
  borderRadius: '20px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const dataTable: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: '760px',
}

const tableHead: CSSProperties = {
  padding: '15px 16px',
  textAlign: 'left',
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  fontWeight: 800,
  borderBottom: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg-strong)',
  whiteSpace: 'nowrap',
}

const tableCell: CSSProperties = {
  padding: '16px',
  color: 'var(--foreground)',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 600,
  borderTop: '1px solid var(--shell-panel-border)',
  verticalAlign: 'top',
}

const resultPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '2.4rem',
  padding: '0.35rem 0.65rem',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.04em',
}

const resultWin: CSSProperties = {
  background: 'rgba(155,225,29,0.14)',
  color: '#d9f84a',
  border: '1px solid rgba(155,225,29,0.24)',
}

const resultLoss: CSSProperties = {
  background: 'rgba(255, 60, 40, 0.10)',
  color: '#ffb4ab',
  border: '1px solid rgba(255, 60, 40, 0.16)',
}

const loadingCard: CSSProperties = {
  padding: '26px',
  borderRadius: '28px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  color: 'var(--foreground)',
  fontWeight: 700,
  position: 'relative',
  zIndex: 1,
}

const errorCard: CSSProperties = {
  padding: '22px',
  borderRadius: '28px',
  border: '1px solid rgba(255, 60, 40, 0.18)',
  background: 'var(--shell-panel-bg)',
  position: 'relative',
  zIndex: 1,
}

const errorActionRow: CSSProperties = {
  marginTop: '14px',
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground)',
  fontWeight: 900,
  fontSize: '30px',
  letterSpacing: '-0.04em',
}

const sectionText: CSSProperties = {
  margin: '10px 0 0',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.6,
}

const chartShell: CSSProperties = {
  width: '100%',
}

const chartSvg: CSSProperties = {
  width: '100%',
  height: 'auto',
  display: 'block',
  overflow: 'visible',
}

const chartMeta: CSSProperties = {
  marginTop: '0.9rem',
  color: 'rgba(224,236,249,0.72)',
  fontSize: '0.9rem',
  fontWeight: 600,
}

const breadcrumbLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  color: 'rgba(190,210,240,0.60)',
  fontSize: '13px',
  fontWeight: 700,
  textDecoration: 'none',
  letterSpacing: '0.01em',
  transition: 'color 140ms ease',
}

const showAllButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 12px',
  borderRadius: '999px',
  border: '1px solid rgba(155,225,29,0.25)',
  background: 'rgba(155,225,29,0.06)',
  color: 'rgba(155,225,29,0.85)',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 140ms ease',
  whiteSpace: 'nowrap' as const,
}

