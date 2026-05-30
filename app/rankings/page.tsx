'use client'

import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AdsenseSlot from '@/app/components/adsense-slot'
import DataTrustPanel from '@/app/components/data-trust-panel'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import TiqDirectoryFallbackCard from '@/app/components/tiq-directory-fallback-card'
import TiqTrustStrip from '@/app/components/tiq-trust-strip'
import { shouldShowSponsoredPlacements } from '@/lib/access-model'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'
import {
  formatRatingValue,
  getRatingViewLabel,
  getTiqRating,
  getUstaDynamicRating,
  getUstaRating,
} from '@/lib/player-rating-display'
import { useProductAccess } from '@/lib/use-product-access'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { DATA_ASSIST_STORY } from '@/lib/product-story'
import { loadRecentTiqAwards, type TiqAwardRecord } from '@/lib/tiq-awards-registry'

type RatingView = 'overall' | 'singles' | 'doubles'
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
  overall_rating?: number | null
  singles_rating?: number | null
  doubles_rating?: number | null
  overall_dynamic_rating?: number | null
  singles_dynamic_rating?: number | null
  doubles_dynamic_rating?: number | null
  overall_usta_dynamic_rating?: number | null
  singles_usta_dynamic_rating?: number | null
  doubles_usta_dynamic_rating?: number | null
  rating_source?: string | null
}

type SnapshotRow = {
  player_id: string
  rating_type?: RatingView | null
  dynamic_rating: number
  snapshot_date: string
  track?: string | null
  delta?: number | null
}

type RankedPlayer = Player & {
  selectedRating: number
  ustaSelectedRating: number
  baseRating: number
  ratingDiff: number
  matches: number
  confidence: ConfidenceLevel
  status: RatingStatus
  trendDirection: TrendDirection
  trendDelta: number
  formScore: number
  percentile: number
  wins: number
  losses: number
  winRate: number | null
  awards: TiqAwardRecord[]
}

const RANKINGS_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_RANKINGS_INLINE || null
const RANKING_PLAYER_SELECT_BASE = `
  id,
  name,
  location,
  overall_rating,
  singles_rating,
  doubles_rating,
  overall_dynamic_rating,
  singles_dynamic_rating,
  doubles_dynamic_rating,
  overall_usta_dynamic_rating,
  singles_usta_dynamic_rating,
  doubles_usta_dynamic_rating
`
const RANKING_PLAYER_SELECT_WITH_SOURCE = `
  ${RANKING_PLAYER_SELECT_BASE},
  rating_source
`

function isMissingRatingSourceError(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('rating_source') || normalized.includes('schema cache') || normalized.includes('column')
}

async function loadRankingPlayerRows(): Promise<Player[]> {
  const withSource = await supabase
    .from('players')
    .select(RANKING_PLAYER_SELECT_WITH_SOURCE)

  if (!withSource.error) return (withSource.data || []) as Player[]
  if (!isMissingRatingSourceError(withSource.error.message)) throw new Error(withSource.error.message)

  const base = await supabase
    .from('players')
    .select(RANKING_PLAYER_SELECT_BASE)

  if (base.error) throw new Error(base.error.message)
  return ((base.data || []) as Player[]).map((player) => ({ ...player, rating_source: null }))
}

function isSelfRatedPlayer(player: Pick<Player, 'rating_source'>) {
  return player.rating_source === 'self'
}

function formatPublicRating(value: number | null | undefined, player: Pick<Player, 'rating_source'>) {
  const formatted = formatRating(value)
  return isSelfRatedPlayer(player) && value != null ? `${formatted} S` : formatted
}

export default function RankingsPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [awardsByPlayerId, setAwardsByPlayerId] = useState<Record<string, TiqAwardRecord[]>>({})
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [ratingView, setRatingView] = useState<RatingView>('overall')
  const [hoveredPodium, setHoveredPodium] = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [hideInactive, setHideInactive] = useState(false)
  const [focusedDirectoryControl, setFocusedDirectoryControl] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<'tiq' | 'trend' | 'form' | 'winRate' | 'matches'>('tiq')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const { isMobile, isSmallMobile } = useViewportBreakpoints()
  const { access, authResolved } = useProductAccess()
  const shouldShowAds = authResolved && shouldShowSponsoredPlacements(access)
  const ratingViewLabel = getRatingViewLabel(ratingView)

  useEffect(() => {
    void loadPlayers()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearchText('')
        setLocationFilter('')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  async function loadPlayers() {
    setLoading(true)
    setError('')

    try {
      const typedPlayers = await loadRankingPlayerRows()
      setPlayers(typedPlayers)

      const playerIds = typedPlayers.map((player) => player.id)

      if (playerIds.length === 0) {
        setSnapshots([])
        setMatchCounts({})
        setAwardsByPlayerId({})
        return
      }

      const { data: snapshotData, error: snapshotError } = await supabase
        .from('rating_snapshots')
        .select('player_id, rating_type, dynamic_rating, snapshot_date, track, delta')
        .in('player_id', playerIds)
        .eq('track', 'tiq')
        .order('snapshot_date', { ascending: true })

      if (snapshotError) throw new Error(snapshotError.message)

      const { data: matchPlayerRows, error: matchPlayersError } = await supabase
        .from('match_players')
        .select('player_id')
        .in('player_id', playerIds)

      if (matchPlayersError) throw new Error(matchPlayersError.message)

      const counts: Record<string, number> = {}
      for (const row of matchPlayerRows || []) {
        const playerId = String(row.player_id)
        counts[playerId] = (counts[playerId] || 0) + 1
      }

      const awardResult = await loadRecentTiqAwards()
      const nextAwardsByPlayerId: Record<string, TiqAwardRecord[]> = {}
      for (const award of awardResult.data) {
        if (!award.recipientPlayerId) continue
        const existing = nextAwardsByPlayerId[award.recipientPlayerId] ?? []
        existing.push(award)
        nextAwardsByPlayerId[award.recipientPlayerId] = existing
      }

      setSnapshots((snapshotData || []) as SnapshotRow[])
      setMatchCounts(counts)
      setAwardsByPlayerId(nextAwardsByPlayerId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rankings')
    } finally {
      setLoading(false)
    }
  }

  const locations = useMemo(() => {
    return [...new Set(players.map((player) => player.location).filter(Boolean) as string[])].sort()
  }, [players])

  const filteredPlayers = useMemo(() => {
    const query = searchText.trim().toLowerCase()

    return players.filter((player) => {
      const matchesSearch =
        !query ||
        player.name.toLowerCase().includes(query) ||
        String(player.location || '').toLowerCase().includes(query)

      const matchesLocation = !locationFilter || (player.location || '') === locationFilter
      return matchesSearch && matchesLocation
    })
  }, [players, searchText, locationFilter])
  const hasActiveFilters = searchText.trim().length > 0 || locationFilter.length > 0 || hideInactive

  const snapshotMap = useMemo(() => {
    const map = new Map<string, SnapshotRow[]>()

    for (const snapshot of snapshots) {
      const key = `${snapshot.player_id}:${snapshot.rating_type || 'overall'}`
      const existing = map.get(key) ?? []
      existing.push(snapshot)
      map.set(key, existing)
    }

    return map
  }, [snapshots])

  const rankedPlayers = useMemo<RankedPlayer[]>(() => {
    return [...filteredPlayers]
      .map((player) => {
        const selectedRating = getSelectedRating(player, ratingView)
        const ustaSelectedRating = getUstaDynamicRating(player, ratingView)
        const baseRating = getBaseRating(player, ratingView)
        const ratingDiff = roundToTwo(selectedRating - baseRating)
        const matches = matchCounts[player.id] || 0
        const confidence = getConfidence(matches)

        const trendPoints = getTrendPointsForPlayer(snapshotMap, player.id, ratingView)
        const trendDirection = getTrendDirection(trendPoints)
        const trendDelta = getRecentTrendDelta(trendPoints)
        // Signal uses USTA dynamic vs USTA base, mirroring what USTA measures for bump/knockdown.
        const status = getRatingStatus(baseRating, ustaSelectedRating)
        const recent5 = trendPoints.slice(-5)
        const formScore = recent5.length >= 2
          ? roundToTwo(recent5[recent5.length - 1].dynamic_rating - recent5[0].dynamic_rating)
          : 0

        const wins = trendPoints.filter((s) => typeof s.delta === 'number' && s.delta > 0).length
        const losses = trendPoints.filter((s) => typeof s.delta === 'number' && s.delta < 0).length
        const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null

        return {
          ...player,
          selectedRating,
          ustaSelectedRating,
          baseRating,
          ratingDiff,
          matches,
          confidence,
          status,
          trendDirection,
          trendDelta,
          formScore,
          percentile: 0,
          wins,
          losses,
          winRate,
          awards: (awardsByPlayerId[player.id] || []).slice(0, 2),
        }
      })
      .sort((a, b) => b.selectedRating - a.selectedRating)
      .filter((player) => {
        if (!hideInactive) return true
        const pts = getTrendPointsForPlayer(snapshotMap, player.id, ratingView)
        const last = pts[pts.length - 1]
        if (!last) return false
        return Date.now() - new Date(last.snapshot_date).getTime() <= 90 * 24 * 60 * 60 * 1000
      })
      .map((player, idx, arr) => ({
        ...player,
        percentile: Math.ceil(((idx + 1) / arr.length) * 100),
      }))
  }, [awardsByPlayerId, filteredPlayers, ratingView, snapshotMap, matchCounts, hideInactive])

  const topThree = rankedPlayers.slice(0, 3)

  const inactiveCount = useMemo(() => {
    if (!snapshotMap.size) return 0
    return filteredPlayers.filter((player) => {
      const pts = getTrendPointsForPlayer(snapshotMap, player.id, ratingView)
      const last = pts[pts.length - 1]
      if (!last) return true
      return Date.now() - new Date(last.snapshot_date).getTime() > 90 * 24 * 60 * 60 * 1000
    }).length
  }, [filteredPlayers, snapshotMap, ratingView])

  const ratingDistribution = useMemo(() => {
    const bands = [
      { label: '2.5-3.0', min: 2.5, max: 3.0 },
      { label: '3.0-3.5', min: 3.0, max: 3.5 },
      { label: '3.5-4.0', min: 3.5, max: 4.0 },
      { label: '4.0-4.5', min: 4.0, max: 4.5 },
      { label: '4.5-5.0', min: 4.5, max: 5.0 },
      { label: '5.0+',   min: 5.0, max: Infinity },
    ]
    return bands.map((band) => ({
      ...band,
      count: rankedPlayers.filter((p) => p.selectedRating >= band.min && p.selectedRating < band.max).length,
    }))
  }, [rankedPlayers])

  const avgSelected = useMemo(() => {
    if (rankedPlayers.length === 0) return 0
    const total = rankedPlayers.reduce((sum, player) => sum + player.selectedRating, 0)
    return total / rankedPlayers.length
  }, [rankedPlayers])

  const avgMatches = useMemo(() => {
    if (rankedPlayers.length === 0) return 0
    return rankedPlayers.reduce((sum, player) => sum + player.matches, 0) / rankedPlayers.length
  }, [rankedPlayers])

  const playerMovers = useMemo(() => {
    return rankedPlayers
      .map((player) => {
        const pts = snapshotMap.get(`${player.id}:${ratingView}`) ?? []
        if (pts.length < 2) return null
        const delta = roundToTwo(pts[pts.length - 1].dynamic_rating - pts[0].dynamic_rating)
        return { player, delta }
      })
      .filter((m): m is { player: RankedPlayer; delta: number } => m !== null)
  }, [rankedPlayers, snapshotMap, ratingView])

  const risers = useMemo(
    () => playerMovers.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3),
    [playerMovers],
  )
  const fallers = useMemo(
    () => playerMovers.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3),
    [playerMovers],
  )

  const hotFormPlayers = useMemo(
    () =>
      rankedPlayers
        .filter((p) => p.formScore > 0.01 && p.matches >= 3)
        .sort((a, b) => b.formScore - a.formScore)
        .slice(0, 5),
    [rankedPlayers],
  )

  const weeklyMovers = useMemo(() => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    return rankedPlayers
      .map((player) => {
        const pts = (snapshotMap.get(`${player.id}:${ratingView}`) ?? [])
          .filter((s) => s.snapshot_date >= cutoff && s.delta != null)
        if (pts.length === 0) return null
        const weekDelta = roundToTwo(pts.reduce((sum, s) => sum + (s.delta ?? 0), 0))
        return { player, weekDelta, matchesThisWeek: pts.length }
      })
      .filter((m): m is { player: RankedPlayer; weekDelta: number; matchesThisWeek: number } => m !== null && m.weekDelta !== 0)
      .sort((a, b) => Math.abs(b.weekDelta) - Math.abs(a.weekDelta))
      .slice(0, 6)
  }, [rankedPlayers, snapshotMap, ratingView])

  const breakthroughPlayers = useMemo(() => {
    const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    return rankedPlayers
      .map((player) => {
        const allPts = snapshotMap.get(`${player.id}:${ratingView}`) ?? []
        const recent = allPts.filter((s) => s.snapshot_date >= cutoff30)
        if (recent.length < 2) return null
        const delta30 = roundToTwo(recent.reduce((sum, s) => sum + (s.delta ?? 0), 0))
        if (delta30 <= 0.05) return null
        // Only surface players below the top tier who are climbing fast
        if (player.selectedRating > 5.0) return null
        return { player, delta30, matchesThisMonth: recent.length }
      })
      .filter((m): m is { player: RankedPlayer; delta30: number; matchesThisMonth: number } => m !== null)
      .sort((a, b) => b.delta30 - a.delta30)
      .slice(0, 5)
  }, [rankedPlayers, snapshotMap, ratingView])

  function handleSortCol(col: typeof sortCol) {
    if (col === sortCol) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  const sortedPlayers = useMemo(() => {
    if (sortCol === 'tiq') return rankedPlayers
    return [...rankedPlayers].sort((a, b) => {
      let diff = 0
      if (sortCol === 'trend') diff = a.trendDelta - b.trendDelta
      else if (sortCol === 'form') diff = a.formScore - b.formScore
      else if (sortCol === 'winRate') diff = (a.winRate ?? -1) - (b.winRate ?? -1)
      else if (sortCol === 'matches') diff = a.matches - b.matches
      return sortDir === 'desc' ? -diff : diff
    })
  }, [rankedPlayers, sortCol, sortDir])

  const tieredRows = useMemo(() => {
    type DividerRow = { type: 'divider'; tier: string; key: string }
    type PlayerRow = { type: 'player'; player: RankedPlayer; rank: number }
    const rows: Array<DividerRow | PlayerRow> = []
    if (sortCol !== 'tiq') {
      sortedPlayers.forEach((player, i) => {
        rows.push({ type: 'player', player, rank: i + 1 })
      })
      return rows
    }
    let lastTier = ''
    rankedPlayers.forEach((player, i) => {
      const tier = getTierLabel(player.baseRating)
      if (tier !== lastTier) {
        rows.push({ type: 'divider', tier, key: `divider-${tier}` })
        lastTier = tier
      }
      rows.push({ type: 'player', player, rank: i + 1 })
    })
    return rows
  }, [rankedPlayers, sortedPlayers, sortCol])

  const dynamicControlsCard: CSSProperties = {
    ...controlsCard,
  }

  const dynamicControlsTopRow: CSSProperties = {
    ...controlsTopRow,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'flex-start' : 'center',
  }

  const dynamicControlsGrid: CSSProperties = {
    ...controlsGrid,
    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.25fr) minmax(min(100%, 220px), 0.75fr)',
  }

  const dynamicPodiumGrid: CSSProperties = {
    ...podiumGrid,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicTableCard: CSSProperties = {
    ...tableCard,
    padding: isSmallMobile ? 14 : isMobile ? 16 : 20,
  }

  const topPlayer = topThree[0] ?? null
  const topRival = topThree[1] ?? null
  const rankedPlayerSummary = loading
    ? 'Board refreshing'
    : rankedPlayers.length
      ? `${rankedPlayers.length} shown`
      : 'Search to build the board'
  const locationSummary = loading
    ? 'Locations pending'
    : locations.length
      ? `${locations.length} locations`
      : 'Location filters appear after review'
  const leaderboardSummary = loading
    ? 'Preparing board'
    : rankedPlayers.length
      ? `Showing ${rankedPlayers.length}`
      : 'Board starts after verified context'
  const playersShownValue = loading
    ? 'Reviewing'
    : rankedPlayers.length
      ? String(rankedPlayers.length)
      : 'Start search'
  const topTiqValue = loading
    ? 'Pending'
    : topThree[0]
      ? formatRating(topThree[0].selectedRating)
      : 'Needs data'
  const averageTiqValue = loading
    ? 'Pending'
    : rankedPlayers.length
      ? formatRating(avgSelected)
      : 'Needs data'

  return (
    <SiteShell active="rankings">
      <JsonLd id="rankings-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Rankings', '/rankings')} />
      <section style={contentWrap}>
        <div style={dynamicControlsCard}>
          <div aria-hidden="true" style={watermarkStyle} />
          <div style={rankingPanelHeader}>
            <div>
              <div style={sectionKicker}>Ranking discovery</div>
              <h1 style={rankingPanelTitle}>Check the field.</h1>
            </div>
            <div style={heroHintRow}>
              <span style={heroHintPill}>{rankedPlayerSummary}</span>
              <span style={heroHintPill}>{locationSummary}</span>
              <span style={heroHintPill}>{capitalize(ratingView)} mode</span>
            </div>
          </div>

                <div style={dynamicControlsTopRow}>
                  <div>
                    <div style={controlsLabel}>Rankings board</div>
                  </div>

                  <div style={segmentWrap}>
                    <button
                      type="button"
                      aria-pressed={ratingView === 'overall'}
                      onClick={() => setRatingView('overall')}
                      onFocus={() => setFocusedDirectoryControl('overall')}
                      onBlur={() => setFocusedDirectoryControl(null)}
                      style={{
                      ...segmentButton,
                      ...(ratingView === 'overall' ? segmentButtonActive : {}),
                      ...(focusedDirectoryControl === 'overall' ? directoryControlFocusStyle : {}),
                    }}
                  >
                    Overall
                  </button>
                    <button
                      type="button"
                      aria-pressed={ratingView === 'singles'}
                      onClick={() => setRatingView('singles')}
                      onFocus={() => setFocusedDirectoryControl('singles')}
                      onBlur={() => setFocusedDirectoryControl(null)}
                      style={{
                      ...segmentButton,
                      ...(ratingView === 'singles' ? segmentButtonActive : {}),
                      ...(focusedDirectoryControl === 'singles' ? directoryControlFocusStyle : {}),
                    }}
                  >
                    Singles
                  </button>
                    <button
                      type="button"
                      aria-pressed={ratingView === 'doubles'}
                      onClick={() => setRatingView('doubles')}
                      onFocus={() => setFocusedDirectoryControl('doubles')}
                      onBlur={() => setFocusedDirectoryControl(null)}
                      style={{
                      ...segmentButton,
                      ...(ratingView === 'doubles' ? segmentButtonActive : {}),
                      ...(focusedDirectoryControl === 'doubles' ? directoryControlFocusStyle : {}),
                    }}
                  >
                    Doubles
                  </button>
                  </div>
                </div>

                <div style={dynamicControlsGrid}>
                <div>
                  <label htmlFor="rankings-search" style={inputLabel}>Search</label>
                  <div style={searchWrap}>
                    <div style={searchIconWrap}>
                      <SearchIcon />
                    </div>
                     <input
                        id="rankings-search"
                        aria-describedby="rankings-filter-helper"
                        value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      onFocus={() => setFocusedDirectoryControl('search')}
                      onBlur={() => setFocusedDirectoryControl(null)}
                      placeholder="Search players or location..."
                      style={{
                        ...searchInput,
                        ...(focusedDirectoryControl === 'search' ? directoryControlFocusStyle : {}),
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="rankings-location" style={inputLabel}>Location</label>
                  <select
                      id="rankings-location"
                      aria-describedby="rankings-filter-helper"
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      onFocus={() => setFocusedDirectoryControl('location')}
                      onBlur={() => setFocusedDirectoryControl(null)}
                      style={{
                        ...selectStyle,
                        borderColor: locationFilter ? 'rgba(155,225,29,0.42)' : undefined,
                        boxShadow: locationFilter ? '0 0 0 1px rgba(155,225,29,0.12)' : undefined,
                        ...(focusedDirectoryControl === 'location' ? directoryControlFocusStyle : {}),
                      }}
                  >
                    <option value="">All locations</option>
                    {locations.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error ? (
                <div style={errorBanner}>{error}</div>
              ) : null}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setHideInactive((v) => !v)}
                  style={{
                    padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    background: hideInactive ? 'rgba(155,225,29,0.12)' : 'transparent',
                    border: `1px solid ${hideInactive ? 'rgba(155,225,29,0.28)' : 'rgba(255,255,255,0.12)'}`,
                    color: hideInactive ? '#d9f84a' : 'var(--shell-copy-muted)',
                    transition: 'all 140ms ease',
                  }}
                >
                  {hideInactive ? 'Active only' : `Active (90d)${inactiveCount > 0 ? ` -${inactiveCount}` : ''}`}
                </button>

                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchText('')
                      setLocationFilter('')
                      setHideInactive(false)
                    }}
                    style={clearFilterButton}
                  >
                    Clear all
                  </button>
                ) : null}
              </div>

              <div style={summaryStatsGrid}>
                <StatChip label="Players shown" value={playersShownValue} />
                <StatChip label="Top TIQ" value={topTiqValue} accent />
                <StatChip label="Average TIQ" value={averageTiqValue} />
                <StatChip label="Basis" value={ratingViewLabel} />
              </div>
        </div>
      </section>

      {!loading && !error && topThree.length > 0 ? (
        <section style={contentWrap}>
          <div style={dynamicPodiumGrid}>
            {topThree.map((player, index) => {
              const theme = getMeterTheme(player.status)
              const isHovered = hoveredPodium === player.id

              return (
                <Link
                  key={player.id}
                  href={`/players/${player.id}`}
                  onMouseEnter={() => setHoveredPodium(player.id)}
                  onMouseLeave={() => setHoveredPodium(null)}
                  style={{
                    ...podiumCard,
                    ...(index === 0 ? podiumFirst : index === 1 ? podiumSecond : podiumThird),
                    transform: isHovered ? 'translateY(-4px)' : 'none',
                    boxShadow: isHovered
                      ? '0 24px 50px rgba(9,25,54,0.24), inset 0 1px 0 rgba(255,255,255,0.08)'
                      : '0 14px 34px rgba(9,25,54,0.14), inset 0 1px 0 rgba(255,255,255,0.05)',
                    transition: 'transform 160ms ease, box-shadow 160ms ease',
                  }}
                >
                  <div style={podiumRank}>#{index + 1}</div>
                  <div style={podiumName}>{player.name}</div>
                  <div style={podiumLocation}>{player.location || 'No location'}</div>
                  <div style={podiumRating}>{formatPublicRating(player.selectedRating, player)}</div>
                  <div style={podiumSubtext}>TIQ {ratingViewLabel.toLowerCase()} rating</div>

                  <div
                    style={{
                      ...statusPill,
                      marginTop: '14px',
                      background: theme.pillBackground,
                      color: theme.pillColor,
                      border: `1px solid ${theme.pillBorder}`,
                    }}
                  >
                    {player.status}
                  </div>

                  <div style={podiumMetaRow}>
                    <span
                      style={{
                        ...trendPill,
                        background: theme.trendBackground,
                        color: theme.trendColor,
                        border: `1px solid ${theme.trendBorder}`,
                      }}
                    >
                      {getTrendIcon(player.trendDirection)} {getTrendShortLabel(player.trendDirection)}{' '}
                      {player.trendDelta >= 0 ? '+' : ''}
                      {player.trendDelta.toFixed(2)}
                    </span>

                    <span style={confidencePill}>{player.confidence}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}

      {false && !loading && !error ? (
        <section style={contentWrap}>
          <article style={editorialPanel}>
            <div style={sectionKicker}>Board snapshot</div>
            <h2 style={panelTitle}>Read the board without overthinking it.</h2>
            <p style={editorialText}>
              Start with rank, rating, momentum, and confidence. Open a player when you need history,
              or compare two players when you want the matchup read.
            </p>

            <div style={editorialGrid}>
              <div style={editorialCard}>
                <div style={editorialCardLabel}>Average TIQ rating</div>
                <div style={editorialCardValue}>{avgSelected.toFixed(2)}</div>
                <div style={editorialCardText}>A quick snapshot of the current filtered board strength.</div>
              </div>
              <div style={editorialCard}>
                <div style={editorialCardLabel}>Average match count</div>
                <div style={editorialCardValue}>{avgMatches.toFixed(1)}</div>
                <div style={editorialCardText}>Helpful for judging how mature the current sample set is.</div>
              </div>
              <div style={editorialCard}>
                <div style={editorialCardLabel}>Best next step</div>
                <div style={editorialCardValue}>Open profiles</div>
                <div style={editorialCardText}>Use rankings to shortlist players, then inspect profiles before drawing conclusions.</div>
              </div>
            </div>

            {rankedPlayers.length > 0 ? (() => {
              const maxCount = Math.max(...ratingDistribution.map((b) => b.count), 1)
              return (
                <div style={{ marginTop: 24 }}>
                  <div style={{ color: '#93c5fd', fontWeight: 800, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 14 }}>
                    Rating distribution - {ratingViewLabel}
                  </div>
                  <div style={{ display: 'grid', gap: 7 }}>
                    {ratingDistribution.map((band) => (
                      <div key={band.label} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ flex: '0 1 70px', minWidth: 0, color: 'rgba(190,210,240,0.6)', fontSize: 11, fontWeight: 700, textAlign: 'right' as const, overflowWrap: 'anywhere' }}>{band.label}</span>
                        <div style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden', height: 18 }}>
                          <div style={{ width: `${(band.count / maxCount) * 100}%`, background: 'linear-gradient(90deg, rgba(37,91,227,0.6), rgba(63,167,255,0.5))', height: '100%', borderRadius: 999, transition: 'width 400ms ease', minWidth: band.count > 0 ? 4 : 0 }} />
                        </div>
                        <span style={{ flex: '0 1 28px', minWidth: 0, color: 'rgba(190,210,240,0.55)', fontSize: 12, fontWeight: 800, overflowWrap: 'anywhere' }}>{band.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })() : null}
          </article>
        </section>
      ) : null}

      {false && !loading && !error && (risers.length > 0 || fallers.length > 0) ? (
        <section style={contentWrap}>
          <article style={editorialPanel}>
            <div style={sectionKicker}>Movers</div>
            <h2 style={panelTitle}>Who&apos;s rising and falling.</h2>
            <p style={editorialText}>
              Based on the full snapshot history for the current rating view. Rising players have gained the most since their first recorded match; falling players have given back the most.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: 20, marginTop: 20, minWidth: 0 }}>
              {risers.length > 0 ? (
                <div>
                  <div style={{ color: '#9be11d', fontWeight: 800, fontSize: 13, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 12 }}>Rising</div>
                  {risers.map(({ player, delta }) => (
                    <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, minWidth: 0, padding: '12px 14px', borderRadius: 16, background: 'rgba(155,225,29,0.05)', border: '1px solid rgba(155,225,29,0.14)', marginBottom: 8 }}>
                      <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        <Link href={`/players/${player.id}`} style={{ color: '#f8fbff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>{player.name}</Link>
                        <div style={{ color: 'rgba(224,234,247,0.55)', fontSize: 12, marginTop: 3 }}>{player.location || 'No location'} · {player.selectedRating.toFixed(2)} TIQ</div>
                      </div>
                      <span style={{ color: '#9be11d', fontWeight: 900, fontSize: 16, letterSpacing: 0 }}>+{delta.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {fallers.length > 0 ? (
                <div>
                  <div style={{ color: '#f87171', fontWeight: 800, fontSize: 13, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 12 }}>Falling</div>
                  {fallers.map(({ player, delta }) => (
                    <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, minWidth: 0, padding: '12px 14px', borderRadius: 16, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.14)', marginBottom: 8 }}>
                      <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        <Link href={`/players/${player.id}`} style={{ color: '#f8fbff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>{player.name}</Link>
                        <div style={{ color: 'rgba(224,234,247,0.55)', fontSize: 12, marginTop: 3 }}>{player.location || 'No location'} · {player.selectedRating.toFixed(2)} TIQ</div>
                      </div>
                      <span style={{ color: '#f87171', fontWeight: 900, fontSize: 16, letterSpacing: 0 }}>{delta.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {false && !loading && !error && hotFormPlayers.length > 0 ? (
        <section style={contentWrap}>
          <article style={editorialPanel}>
            <div style={sectionKicker}>Form spotlight</div>
            <h2 style={panelTitle}>Hot right now.</h2>
            <p style={editorialText}>
              Players with the strongest last-5 match form - positive net delta across their five most recent rated matches. A high form score doesn&apos;t guarantee a high rank, but it signals momentum worth watching.
            </p>

            <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
              {hotFormPlayers.map((player, i) => {
                const boardRank = rankedPlayers.findIndex((p) => p.id === player.id) + 1
                return (
                <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, padding: '12px 16px', borderRadius: 18, background: 'rgba(155,225,29,0.04)', border: '1px solid rgba(155,225,29,0.12)' }}>
                  <span style={{ flex: '0 1 24px', minWidth: 0, color: 'rgba(190,210,240,0.4)', fontWeight: 900, fontSize: 13, textAlign: 'right' as const }}>#{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/players/${player.id}`} style={{ color: '#f8fbff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>{player.name}</Link>
                    <div style={{ color: 'rgba(224,234,247,0.5)', fontSize: 12, marginTop: 3 }}>{player.location || 'No location'} · {player.matches} matches{boardRank > 0 ? ` · board #${boardRank}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: 'rgba(190,210,240,0.6)', fontSize: 13, fontWeight: 700 }}>{player.selectedRating.toFixed(2)} TIQ</span>
                    <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(155,225,29,0.10)', border: '1px solid rgba(155,225,29,0.20)', color: '#d9f84a', fontSize: 13, fontWeight: 900 }}>+{player.formScore.toFixed(2)} form</span>
                  </div>
                </div>
              )})}
            </div>
          </article>
        </section>
      ) : null}

      {false && !loading && !error && weeklyMovers.length > 0 ? (
        <section style={contentWrap}>
          <article style={editorialPanel}>
            <div style={sectionKicker}>Week in review</div>
            <h2 style={panelTitle}>Biggest movers this week.</h2>
            <p style={editorialText}>
              Players with the largest cumulative rating movement from matches in the last 7 days. Ranked by absolute delta - both risers and fallers.
            </p>
            <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
              {weeklyMovers.map(({ player, weekDelta, matchesThisWeek }) => {
                const positive = weekDelta > 0
                return (
                  <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 18, background: positive ? 'rgba(155,225,29,0.04)' : 'rgba(239,68,68,0.04)', border: `1px solid ${positive ? 'rgba(155,225,29,0.12)' : 'rgba(239,68,68,0.12)'}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/players/${player.id}`} style={{ color: '#f8fbff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>{player.name}</Link>
                      <div style={{ color: 'rgba(224,234,247,0.5)', fontSize: 12, marginTop: 3 }}>{player.location || 'No location'} · {matchesThisWeek} match{matchesThisWeek !== 1 ? 'es' : ''} this week</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: 'rgba(190,210,240,0.6)', fontSize: 13, fontWeight: 700 }}>{player.selectedRating.toFixed(2)}</span>
                      <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: 0, color: positive ? '#9be11d' : '#f87171' }}>
                        {positive ? '+' : ''}{weekDelta.toFixed(3)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </article>
        </section>
      ) : null}

      {false && !loading && !error && breakthroughPlayers.length > 0 ? (
        <section style={contentWrap}>
          <article style={editorialPanel}>
            <div style={sectionKicker}>Breakthrough watch</div>
            <h2 style={panelTitle}>Rising fast - last 30 days.</h2>
            <p style={editorialText}>
              Players accumulating the most positive rating movement this month. These are the names most likely to change tier soon - worth watching before lineup decisions.
            </p>
            <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
              {breakthroughPlayers.map(({ player, delta30, matchesThisMonth }, i) => (
                <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, padding: '12px 16px', borderRadius: 18, background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.14)' }}>
                  <span style={{ flex: '0 1 24px', minWidth: 0, color: 'rgba(190,210,240,0.4)', fontWeight: 900, fontSize: 13, textAlign: 'center' as const }}>#{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/players/${player.id}`} style={{ color: '#f8fbff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>{player.name}</Link>
                    <div style={{ color: 'rgba(224,234,247,0.5)', fontSize: 12, marginTop: 3 }}>{player.location || 'No location'} · {matchesThisMonth} match{matchesThisMonth !== 1 ? 'es' : ''} this month · {player.selectedRating.toFixed(2)} TIQ</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 900, fontSize: 16, color: '#a7f3d0', letterSpacing: 0 }}>+{delta30.toFixed(3)}</span>
                    <span style={{ padding: '3px 9px', borderRadius: 999, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.22)', color: '#a7f3d0', fontSize: 11, fontWeight: 800 }}>30d</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      <section style={contentWrap}>
        <article id="full-rankings" style={dynamicTableCard}>
          <div style={panelHead}>
            <div>
              <div style={sectionKicker}>Leaderboard</div>
              <h2 style={panelTitle}>Full rankings</h2>
            </div>

          <div style={panelChipWrap}>
              <span style={panelChip}>{leaderboardSummary}</span>
              <span style={panelChip}>TIQ {ratingViewLabel}</span>
            </div>
          </div>

          {loading || rankedPlayers.length === 0 ? (
            <>
              <DataTrustPanel
                title="Ranking data trust"
                body="Rankings appear when enough reviewed player and match context exists. Confidence improves as scorecards, schedules, and player records are verified."
                signals={[
                  { label: 'Source', value: 'Player records and reviewed matches' },
                  { label: 'Freshness', value: 'Board refresh pending' },
                  { label: 'Confidence', value: 'Sample-size based' },
                  { label: 'Status', value: 'Report gaps through Data Assist' },
                ]}
              />
              <TiqDirectoryFallbackCard
                eyebrow="Featured ranking path"
                title="Build a board around the tennis question."
                body="Search a player, location, or rating view. Rankings become most useful when you compare overall, singles, doubles, activity, and confidence together."
                chips={['Overall board', 'Singles split', 'Doubles split']}
                actions={[
                  { href: '/players', label: 'Find Players' },
                  { href: DATA_ASSIST_STORY.href, label: DATA_ASSIST_STORY.cta },
                ]}
              />
            </>
          ) : null}

          {isMobile ? (
            <div style={compactLeaderboardStyle}>
              {loading ? (
                <div style={emptyCell}>
                  Search to build the board. Rankings appear when enough verified player and match context is available.
                </div>
              ) : rankedPlayers.length === 0 ? (
                <div style={emptyCell}>
                  {hasActiveFilters
                    ? 'No players matched the current search or location filter. Clear filters to widen the board.'
                    : `Search to build the board. Rankings appear when enough verified player and match context is available. ${DATA_ASSIST_STORY.shortCue}`}
                </div>
              ) : (
                tieredRows.map((row) => {
                  if (row.type === 'divider') {
                    return (
                      <div key={row.key} style={compactTierDividerStyle}>
                        {row.tier} USTA tier
                      </div>
                    )
                  }

                  return (
                    <RankingCompactCard
                      key={row.player.id}
                      player={row.player}
                      rank={row.rank}
                      ratingView={ratingView}
                      ratingViewLabel={ratingViewLabel}
                      trendPoints={snapshotMap.get(`${row.player.id}:${ratingView}`) ?? []}
                      compareHref={buildRankingCompareHref(row.player, topPlayer, topRival)}
                    />
                  )
                })
              )}
            </div>
          ) : (
            <div style={tableWrap}>
              <table style={dataTable}>
                <thead>
                  <tr>
                    <th style={tableHead}>Rank</th>
                    <th style={tableHead}>Player</th>
                    <th style={tableHead}>Location</th>
                    <th style={tableHead}>Signal</th>
                    <SortableHeaderClean col="trend" label="Trend" sortCol={sortCol} sortDir={sortDir} onSort={handleSortCol} />
                    <SortableHeaderClean col="form" label="Form" sortCol={sortCol} sortDir={sortDir} onSort={handleSortCol} />
                    <SortableHeaderClean col="winRate" label="W-L" sortCol={sortCol} sortDir={sortDir} onSort={handleSortCol} />
                    <SortableHeaderClean col="matches" label="Confidence" sortCol={sortCol} sortDir={sortDir} onSort={handleSortCol} />
                    <th style={tableHead}>USTA Base</th>
                    <th style={{ ...tableHead, ...(ratingView === 'overall' ? activeTableHead : {}) }}>USTA Dynamic</th>
                    <th style={{ ...tableHead, ...(ratingView === 'overall' ? activeTableHead : {}) }}>TIQ Overall</th>
                    <th style={{ ...tableHead, ...(ratingView === 'singles' ? activeTableHead : {}) }}>TIQ Singles</th>
                    <th style={{ ...tableHead, ...(ratingView === 'doubles' ? activeTableHead : {}) }}>TIQ Doubles</th>
                    <th style={tableHead}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={14} style={emptyCell}>
                        Search to build the board. Rankings appear when enough verified player and match context is available.
                      </td>
                    </tr>
                  ) : rankedPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={14} style={emptyCell}>
                        {hasActiveFilters
                          ? 'No players matched the current search or location filter. Clear filters to widen the board.'
                          : `Search to build the board. Rankings appear when enough verified player and match context is available. ${DATA_ASSIST_STORY.shortCue}`}
                      </td>
                    </tr>
                  ) : (
                    tieredRows.map((row) => {
                      if (row.type === 'divider') {
                        return (
                          <tr key={row.key}>
                            <td colSpan={14} style={tierDividerCell}>
                              <span style={tierDividerLabel}>{row.tier} USTA tier</span>
                            </td>
                          </tr>
                        )
                      }

                      const { player, rank } = row
                      const theme = getMeterTheme(player.status)
                      const isRowHovered = hoveredRow === player.id

                      return (
                        <tr
                          key={player.id}
                          onMouseEnter={() => setHoveredRow(player.id)}
                          onMouseLeave={() => setHoveredRow(null)}
                          style={{
                            background: isRowHovered ? 'rgba(116,190,255,0.05)' : undefined,
                            transition: 'background 120ms ease',
                            cursor: 'default',
                          }}
                        >
                          <td style={tableCell}>
                            <span style={rankBadge}>{rank}</span>
                            <div style={{ color: 'rgba(147,197,253,0.6)', fontSize: 10, fontWeight: 700, marginTop: 4, letterSpacing: '0.04em' }}>
                              top {player.percentile}%
                            </div>
                          </td>

                          <td style={tableCell}>
                            <div style={rankingPlayerIdentityStyle}>
                              <Link href={`/players/${player.id}`} style={playerLink}>
                                {player.name}
                              </Link>
                              <RankingAwardBadges player={player} />
                            </div>
                          </td>

                          <td style={tableCell}>{player.location || '--'}</td>

                          <td style={tableCell}>
                            <span
                              style={{
                                ...statusPill,
                                background: theme.pillBackground,
                                color: theme.pillColor,
                                border: `1px solid ${theme.pillBorder}`,
                              }}
                            >
                              {player.status}
                            </span>
                          </td>

                          <td style={tableCell}>
                            <MiniSparkline
                              points={snapshotMap.get(`${player.id}:${ratingView}`) ?? []}
                              direction={player.trendDirection}
                            />
                            <span
                              style={{
                                ...trendPill,
                                marginTop: 5,
                                background: theme.trendBackground,
                                color: theme.trendColor,
                                border: `1px solid ${theme.trendBorder}`,
                              }}
                            >
                              {getTrendIcon(player.trendDirection)} {getTrendShortLabel(player.trendDirection)}{' '}
                              {player.trendDelta >= 0 ? '+' : ''}
                              {player.trendDelta.toFixed(2)}
                            </span>
                          </td>

                          <td style={tableCell}>
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: 13,
                                color: player.formScore > 0.02
                                  ? '#9be11d'
                                  : player.formScore < -0.02
                                    ? '#f87171'
                                    : 'rgba(224,234,247,0.55)',
                              }}
                            >
                              {player.formScore > 0 ? '+' : ''}{player.formScore.toFixed(2)}
                            </span>
                          </td>

                          <td style={tableCell}>
                            {player.winRate !== null ? (
                              <div>
                                <span style={{ fontWeight: 800, fontSize: 13, color: player.winRate >= 55 ? '#9be11d' : player.winRate <= 45 ? '#f87171' : 'var(--foreground)' }}>
                                  {player.winRate}%
                                </span>
                                <div style={{ color: 'rgba(190,210,240,0.45)', fontSize: 10, fontWeight: 700, marginTop: 2 }}>
                                  {player.wins}W {player.losses}L
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: 'rgba(190,210,240,0.35)', fontSize: 12 }}>--</span>
                            )}
                          </td>

                          <td style={tableCell}>
                            <span style={confidencePill}>{player.confidence}</span>
                          </td>

                          <td style={tableCell}>
                            {isSelfRatedPlayer(player) ? 'Pending' : formatRatingValue(player.overall_rating)}
                          </td>

                          <td style={{ ...tableCell, ...(ratingView === 'overall' ? activeRatingCell : {}) }}>
                            {isSelfRatedPlayer(player) ? 'Pending' : formatRating(player.ustaSelectedRating)}
                          </td>

                          <td style={{ ...tableCell, ...(ratingView === 'overall' ? activeRatingCell : {}) }}>
                            {formatPublicRating(player.overall_dynamic_rating, player)}
                          </td>

                          <td style={{ ...tableCell, ...(ratingView === 'singles' ? activeRatingCell : {}) }}>
                            {formatPublicRating(player.singles_dynamic_rating, player)}
                          </td>

                          <td style={{ ...tableCell, ...(ratingView === 'doubles' ? activeRatingCell : {}) }}>
                            {formatPublicRating(player.doubles_dynamic_rating, player)}
                          </td>

                          <td style={tableCell}>
                            <div style={rowActionStackStyle}>
                              <Link
                                href={`/players/${player.id}`}
                                aria-label={`View ${player.name} profile`}
                                style={rowActionPrimaryStyle}
                              >
                                View
                              </Link>
                              <Link
                                href={buildRankingCompareHref(player, topPlayer, topRival)}
                                aria-label={`Compare ${player.name} in Matchup`}
                                style={rowActionSecondaryStyle}
                              >
                                Compare
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      {!error ? (
        <section style={contentWrap}>
          <RankingNextActionRail
            topPlayer={topPlayer}
            topRival={topRival}
            loading={loading}
            hasRankedPlayers={rankedPlayers.length > 0}
          />
        </section>
      ) : null}

      {!loading && !error ? (
        <section style={contentWrap}>
          <details style={insightDetails}>
            <summary style={insightSummary}>
              <span>
                <span style={sectionKicker}>More board signals</span>
                <span style={insightSummaryTitle}>Open deeper ranking context</span>
              </span>
              <span style={insightSummaryMeta}>
                {risers.length + fallers.length + hotFormPlayers.length + weeklyMovers.length + breakthroughPlayers.length} signals
              </span>
            </summary>

            <div style={insightBody}>
              <div style={editorialGrid}>
                <div style={editorialCard}>
                  <div style={editorialCardLabel}>Average TIQ rating</div>
                  <div style={editorialCardValue}>{avgSelected.toFixed(2)}</div>
                  <div style={editorialCardText}>Filtered board strength at a glance.</div>
                </div>
                <div style={editorialCard}>
                  <div style={editorialCardLabel}>Average match count</div>
                  <div style={editorialCardValue}>{avgMatches.toFixed(1)}</div>
                  <div style={editorialCardText}>Higher samples make the board easier to trust.</div>
                </div>
                <div style={editorialCard}>
                  <div style={editorialCardLabel}>Best next step</div>
                  <div style={editorialCardValue}>Compare</div>
                  <div style={editorialCardText}>Use Matchup when a ranking gap needs a practical read.</div>
                </div>
              </div>

              {rankedPlayers.length > 0 ? (() => {
                const maxCount = Math.max(...ratingDistribution.map((band) => band.count), 1)
                return (
                  <div style={signalPanel}>
                    <div style={signalPanelHead}>
                      <div>
                        <div style={sectionKicker}>Rating distribution</div>
                        <h3 style={signalPanelTitle}>{ratingViewLabel} bands</h3>
                      </div>
                    </div>
                    <div style={distributionGrid}>
                      {ratingDistribution.map((band) => (
                        <div key={band.label} style={distributionRow}>
                          <span style={distributionLabel}>{band.label}</span>
                          <div style={distributionTrack}>
                            <div
                              style={{
                                ...distributionFill,
                                width: `${(band.count / maxCount) * 100}%`,
                                minWidth: band.count > 0 ? 4 : 0,
                              }}
                            />
                          </div>
                          <span style={distributionCount}>{band.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })() : null}

              <div style={signalGrid}>
                <SignalList
                  title="Rising"
                  empty="No risers yet"
                  tone="up"
                  items={risers.map(({ player, delta }) => ({
                    id: player.id,
                    href: `/players/${player.id}`,
                    name: player.name,
                    meta: `${player.location || 'No location'} - ${player.selectedRating.toFixed(2)} TIQ`,
                    value: `+${delta.toFixed(2)}`,
                  }))}
                />
                <SignalList
                  title="Hot form"
                  empty="No hot form yet"
                  tone="up"
                  items={hotFormPlayers.slice(0, 3).map((player) => ({
                    id: player.id,
                    href: `/players/${player.id}`,
                    name: player.name,
                    meta: `${player.matches} matches - ${player.winRate ?? '--'}% W-L`,
                    value: `+${player.formScore.toFixed(2)}`,
                  }))}
                />
                <SignalList
                  title="Weekly moves"
                  empty="No weekly moves yet"
                  tone="neutral"
                  items={weeklyMovers.slice(0, 3).map(({ player, weekDelta, matchesThisWeek }) => ({
                    id: player.id,
                    href: `/players/${player.id}`,
                    name: player.name,
                    meta: `${matchesThisWeek} this week - ${player.selectedRating.toFixed(2)} TIQ`,
                    value: `${weekDelta > 0 ? '+' : ''}${weekDelta.toFixed(3)}`,
                  }))}
                />
                <SignalList
                  title="Breakthrough watch"
                  empty="No breakthrough watch yet"
                  tone="up"
                  items={breakthroughPlayers.slice(0, 3).map(({ player, delta30, matchesThisMonth }) => ({
                    id: player.id,
                    href: `/players/${player.id}`,
                    name: player.name,
                    meta: `${matchesThisMonth} this month - ${player.selectedRating.toFixed(2)} TIQ`,
                    value: `+${delta30.toFixed(3)}`,
                  }))}
                />
              </div>
            </div>
          </details>
        </section>
      ) : null}

      {shouldShowAds ? (
        <div style={{ marginTop: 12 }}>
          <AdsenseSlot slot={RANKINGS_INLINE_AD_SLOT} label="Sponsored" minHeight={250} />
        </div>
      ) : null}
    </SiteShell>
  )
}

function RankingNextActionRail({
  topPlayer,
  topRival,
  loading,
  hasRankedPlayers,
}: {
  topPlayer: RankedPlayer | null
  topRival: RankedPlayer | null
  loading: boolean
  hasRankedPlayers: boolean
}) {
  const compareHref = topPlayer
    ? buildRankingCompareHref(topPlayer, topPlayer, topRival)
    : '/matchup?type=singles'
  const compareTitle = topPlayer && topRival
    ? `Compare ${topPlayer.name} vs ${topRival.name}`
    : 'Open Matchup'
  const boardCue = loading
    ? 'Board is preparing'
    : hasRankedPlayers
      ? 'Use the board'
      : 'Start with a search'

  const actions = [
    {
      href: compareHref,
      label: compareTitle,
      body: 'Turn a ranking gap into a practical match read with edge, confidence, and a watch item.',
      cta: 'Compare',
    },
    {
      href: '/players',
      label: 'Find the player record',
      body: 'Open a profile before drawing conclusions from a rating, tier, or recent form signal.',
      cta: 'Find players',
    },
    {
      href: '/leagues',
      label: 'Check league context',
      body: 'See the teams, flights, standings, and season shape behind the board.',
      cta: 'Find leagues',
    },
    {
      href: DATA_ASSIST_STORY.href,
      label: 'Fix ranking data',
      body: 'Upload a scorecard, report a missing player, or request a review when the board looks off.',
      cta: DATA_ASSIST_STORY.cta,
    },
  ]

  return (
    <article style={rankingNextActionPanel}>
      <div style={rankingNextActionHead}>
        <div>
          <div style={sectionKicker}>Ranking next actions</div>
          <h2 style={rankingNextActionTitle}>Use rankings to decide what to check next.</h2>
        </div>
        <span style={panelChip}>{boardCue}</span>
      </div>
      <div style={rankingNextActionGrid}>
        {actions.map((action) => (
          <Link key={action.label} href={action.href} style={rankingNextActionCard}>
            <span style={rankingNextActionCardTitle}>{action.label}</span>
            <span style={rankingNextActionCardBody}>{action.body}</span>
            <span style={rankingNextActionCta}>{action.cta}</span>
          </Link>
        ))}
      </div>
    </article>
  )
}

function SortableHeaderClean({
  col, label, sortCol, sortDir, onSort,
}: {
  col: 'trend' | 'form' | 'winRate' | 'matches'
  label: string
  sortCol: string
  sortDir: 'asc' | 'desc'
  onSort: (col: 'trend' | 'form' | 'winRate' | 'matches') => void
}) {
  const active = sortCol === col
  const sortIndicator = active ? (sortDir === 'desc' ? ' v' : ' ^') : ''
  return (
    <th
      aria-sort={active ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
      style={{ ...tableHead, cursor: 'pointer', userSelect: 'none', ...(active ? activeTableHead : {}) }}
      onClick={() => onSort(col)}
    >
      {label}{sortIndicator}
    </th>
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
      <div style={chipStatLabel}>{label}</div>
      <div style={chipStatValue}>{value}</div>
    </div>
  )
}

function SignalList({
  title,
  empty,
  items,
  tone,
}: {
  title: string
  empty: string
  tone: 'up' | 'down' | 'neutral'
  items: Array<{
    id: string
    href: string
    name: string
    meta: string
    value: string
  }>
}) {
  const valueColor = tone === 'down' ? '#f87171' : tone === 'up' ? 'var(--brand-lime)' : 'var(--brand-blue-2)'

  return (
    <div style={signalListCard}>
      <div style={signalListTitle}>{title}</div>
      {items.length === 0 ? (
        <div style={signalEmpty}>{empty}</div>
      ) : (
        <div style={signalListItems}>
          {items.map((item) => (
            <div key={item.id} style={signalListItem}>
              <div style={{ minWidth: 0 }}>
                <Link href={item.href} style={signalListLink}>
                  {item.name}
                </Link>
                <div style={signalListMeta}>{item.meta}</div>
              </div>
              <span style={{ ...signalListValue, color: valueColor }}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RankingAwardBadges({ player, compact = false }: { player: RankedPlayer; compact?: boolean }) {
  if (!player.awards.length) return null

  return (
    <div style={compact ? compactAwardBadgeRowStyle : rankingAwardBadgeRowStyle} aria-label={`${player.name} award badges`}>
      {player.awards.map((award) => (
        <Link
          key={award.id}
          href={`/awards/${encodeURIComponent(award.id)}`}
          style={rankingAwardBadgeStyle}
          title={`${award.badgeLabel}: ${award.title}`}
        >
          <span>{award.badgeCode}</span>
          <small>{award.sourceType === 'league' ? 'League' : 'Tournament'}</small>
        </Link>
      ))}
      <Link href={`/players/${player.id}#profile-trophy-case`} style={rankingAwardCaseLinkStyle}>
        Trophy case
      </Link>
    </div>
  )
}

function RankingCompactCard({
  player,
  rank,
  ratingView,
  ratingViewLabel,
  trendPoints,
  compareHref,
}: {
  player: RankedPlayer
  rank: number
  ratingView: RatingView
  ratingViewLabel: string
  trendPoints: Array<{ dynamic_rating: number }>
  compareHref: string
}) {
  const theme = getMeterTheme(player.status)
  const selectedRating =
    ratingView === 'singles'
      ? player.singles_dynamic_rating
      : ratingView === 'doubles'
        ? player.doubles_dynamic_rating
        : player.overall_dynamic_rating

  return (
    <article style={compactRankingCardStyle}>
      <div style={compactRankingTopStyle}>
        <span style={rankBadge}>{rank}</span>
        <div style={compactPlayerCopyStyle}>
          <Link href={`/players/${player.id}`} aria-label={`View ${player.name} profile`} style={compactPlayerNameStyle}>
            {player.name}
          </Link>
          <RankingAwardBadges player={player} compact />
          <span style={compactPlayerMetaStyle}>{player.location || 'No location'} | top {player.percentile}%</span>
        </div>
        <div style={compactRatingStackStyle}>
          <strong>{formatPublicRating(selectedRating, player)}</strong>
          <span>{ratingViewLabel}</span>
        </div>
      </div>

      <div style={compactSignalRowStyle}>
        <span
          style={{
            ...statusPill,
            background: theme.pillBackground,
            color: theme.pillColor,
            border: `1px solid ${theme.pillBorder}`,
          }}
        >
          {player.status}
        </span>
        <span
          style={{
            ...trendPill,
            background: theme.trendBackground,
            color: theme.trendColor,
            border: `1px solid ${theme.trendBorder}`,
          }}
        >
          {getTrendIcon(player.trendDirection)} {player.trendDelta >= 0 ? '+' : ''}
          {player.trendDelta.toFixed(2)}
        </span>
        <span style={confidencePill}>{player.confidence}</span>
      </div>
      <TiqTrustStrip
        label={`${player.name} ranking data trust signals`}
        signals={[
          { label: 'Source', value: 'Reviewed matches', tone: 'info' },
          { label: 'Freshness', value: trendPoints.length ? 'Snapshot history' : 'Review pending', tone: trendPoints.length ? 'good' : 'warn' },
          { label: 'Confidence', value: player.confidence, tone: player.confidence === 'High' ? 'good' : player.confidence === 'Medium' ? 'warn' : 'info' },
          { label: 'Status', value: player.status, tone: player.status === 'Holding' || player.status === 'Trending Up' ? 'good' : 'warn' },
        ]}
        reviewContext={`Ranking ${player.name}`}
      />

      <div style={compactBottomGridStyle}>
        <div>
          <span style={compactMiniLabelStyle}>Trend</span>
          <MiniSparkline points={trendPoints} direction={player.trendDirection} />
        </div>
        <div>
          <span style={compactMiniLabelStyle}>W-L</span>
          <strong style={compactMiniValueStyle}>
            {player.winRate !== null ? `${player.winRate}%` : '--'}
          </strong>
        </div>
        <div>
          <span style={compactMiniLabelStyle}>Form</span>
          <strong
            style={{
              ...compactMiniValueStyle,
              color:
                player.formScore > 0.02
                  ? '#9be11d'
                  : player.formScore < -0.02
                    ? '#f87171'
                    : 'var(--foreground-strong)',
            }}
          >
            {player.formScore > 0 ? '+' : ''}{player.formScore.toFixed(2)}
          </strong>
        </div>
      </div>
      <div style={compactActionRowStyle}>
        <Link href={`/players/${player.id}`} aria-label={`View ${player.name} profile`} style={compactActionPrimaryStyle}>
          View profile
        </Link>
        <Link href={compareHref} aria-label={`Compare ${player.name} in Matchup`} style={compactActionSecondaryStyle}>
          Compare
        </Link>
      </div>
    </article>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" style={iconSvgStyle} aria-hidden="true">
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M16 16l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function MiniSparkline({ points, direction }: { points: Array<{ dynamic_rating: number }>; direction: TrendDirection }) {
  const w = 56
  const h = 22
  const pad = 2
  if (points.length < 2) {
    return <svg width={w} height={h} style={{ display: 'block', opacity: 0.35 }} aria-hidden="true"><line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" /></svg>
  }
  const vals = points.map((p) => p.dynamic_rating)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const spread = Math.max(max - min, 0.01)
  const xStep = (w - pad * 2) / (vals.length - 1)
  const toY = (v: number) => h - pad - ((v - min) / spread) * (h - pad * 2)
  const d = vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * xStep} ${toY(v)}`).join(' ')
  const color = direction === 'up' ? '#9be11d' : direction === 'down' ? '#f87171' : '#60a5fa'
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
    </svg>
  )
}

function getSelectedRating(player: Player, view: RatingView) {
  return getTiqRating(player, view)
}

function getBaseRating(player: Player, view: RatingView) {
  return getUstaRating(player, view)
}

function getTrendPointsForPlayer(
  snapshotMap: Map<string, SnapshotRow[]>,
  playerId: string,
  ratingView: RatingView,
) {
  const key = `${playerId}:${ratingView}`
  return snapshotMap.get(key) ?? []
}

function toRatingNumber(value: number | null | undefined, fallback = 3.5) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function buildRankingCompareHref(
  player: RankedPlayer,
  topPlayer: RankedPlayer | null,
  topRival: RankedPlayer | null,
) {
  const opponent = topPlayer?.id === player.id ? topRival : topPlayer
  if (!opponent) return `/matchup?type=singles&playerA=${player.id}`
  return `/matchup?type=singles&playerA=${player.id}&playerB=${opponent.id}`
}

function formatRating(value: number | null | undefined) {
  return toRatingNumber(value, 3.5).toFixed(2)
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getRatingStatus(base: number, dynamic: number): RatingStatus {
  const diff = dynamic - base

  if (diff >= 0.15) return 'Bump Up Pace'
  if (diff >= 0.07) return 'Trending Up'
  if (diff > -0.07) return 'Holding'
  if (diff > -0.15) return 'At Risk'
  return 'Drop Watch'
}

function getTrendDirection(points: Array<{ dynamic_rating: number }>): TrendDirection {
  if (points.length < 2) return 'flat'

  const recent = points.slice(-5)
  const first = recent[0]?.dynamic_rating ?? 0
  const last = recent[recent.length - 1]?.dynamic_rating ?? 0

  if (last > first + 0.02) return 'up'
  if (last < first - 0.02) return 'down'
  return 'flat'
}

function getRecentTrendDelta(points: Array<{ dynamic_rating: number }>) {
  if (points.length < 2) return 0

  const recent = points.slice(-5)
  const first = recent[0]?.dynamic_rating ?? 0
  const last = recent[recent.length - 1]?.dynamic_rating ?? 0

  return roundToTwo(last - first)
}

function getConfidence(matches: number): ConfidenceLevel {
  if (matches < 10) return 'Low'
  if (matches < 30) return 'Medium'
  return 'High'
}

function getTierLabel(baseRating: number): string {
  const tier = Math.round(baseRating * 2) / 2
  if (tier >= 5.0) return '5.0+'
  return tier.toFixed(1)
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
}

function getTrendShortLabel(direction: TrendDirection) {
  if (direction === 'up') return 'Up'
  if (direction === 'down') return 'Down'
  return 'Flat'
}

function getTrendIcon(direction: TrendDirection) {
  if (direction === 'up') return '^'
  if (direction === 'down') return 'v'
  return '->'
}

function getMeterTheme(status: RatingStatus) {
  switch (status) {
    case 'Bump Up Pace':
      return {
        pillBackground: 'rgba(155,225,29,0.16)',
        pillColor: '#d9f84a',
        pillBorder: 'rgba(155,225,29,0.28)',
        trendBackground: 'rgba(46, 204, 113, 0.12)',
        trendColor: '#bef264',
        trendBorder: 'rgba(132, 204, 22, 0.24)',
      }
    case 'Trending Up':
      return {
        pillBackground: 'rgba(52,211,153,0.14)',
        pillColor: '#a7f3d0',
        pillBorder: 'rgba(52,211,153,0.24)',
        trendBackground: 'rgba(52,211,153,0.10)',
        trendColor: '#a7f3d0',
        trendBorder: 'rgba(52,211,153,0.22)',
      }
    case 'Holding':
      return {
        pillBackground: 'rgba(63,167,255,0.12)',
        pillColor: '#bfdbfe',
        pillBorder: 'rgba(63,167,255,0.22)',
        trendBackground: 'rgba(96,165,250,0.10)',
        trendColor: '#dbeafe',
        trendBorder: 'rgba(96,165,250,0.20)',
      }
    case 'At Risk':
      return {
        pillBackground: 'rgba(251,146,60,0.14)',
        pillColor: '#fed7aa',
        pillBorder: 'rgba(251,146,60,0.24)',
        trendBackground: 'rgba(245,158,11,0.10)',
        trendColor: '#fde68a',
        trendBorder: 'rgba(245,158,11,0.22)',
      }
    case 'Drop Watch':
      return {
        pillBackground: 'rgba(239,68,68,0.14)',
        pillColor: '#fecaca',
        pillBorder: 'rgba(239,68,68,0.24)',
        trendBackground: 'rgba(239,68,68,0.10)',
        trendColor: '#fecaca',
        trendBorder: 'rgba(239,68,68,0.22)',
      }
  }
}

const heroHintRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '4px',
}

const heroHintPill: CSSProperties = {
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  borderRadius: '999px',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 800,
}

const rankingPanelHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  flexWrap: 'wrap',
  minWidth: 0,
  marginBottom: '16px',
}

const rankingPanelTitle: CSSProperties = {
  margin: '8px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.55rem, 3vw, 2.25rem)',
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const controlsCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '26px',
  padding: '20px',
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(4,10,24,0.9))',
  boxShadow: '0 30px 86px rgba(2, 8, 23, 0.46), inset 0 1px 0 rgba(255,255,255,0.05)',
}

const controlsTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
  minWidth: 0,
  marginBottom: '14px',
}

const controlsLabel: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: 'clamp(1.15rem, 2vw, 1.45rem)',
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const segmentWrap: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
}

const segmentButton: CSSProperties = {
  border: '1px solid rgba(116,190,255,0.13)',
  borderRadius: '16px',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  minHeight: '48px',
  padding: '0 14px',
  fontSize: '14px',
  fontWeight: 800,
  cursor: 'pointer',
}

const segmentButtonActive: CSSProperties = {
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
}

const controlsGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  marginBottom: '14px',
  minWidth: 0,
}

const inputLabel: CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  color: 'var(--brand-blue-2)',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const searchWrap: CSSProperties = {
  position: 'relative',
}

const searchIconWrap: CSSProperties = {
  position: 'absolute',
  left: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'var(--foreground)',
  pointerEvents: 'none',
}

const searchInput: CSSProperties = {
  width: '100%',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  padding: '15px 16px 15px 46px',
  fontSize: '15px',
  outline: '2px solid transparent',
  outlineOffset: 2,
  boxShadow: 'var(--home-control-shadow)',
  colorScheme: 'dark',
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: '52px',
  borderRadius: '18px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  padding: '0 14px',
  fontSize: '14px',
  fontWeight: 700,
  outline: '2px solid transparent',
  outlineOffset: 2,
  boxShadow: 'var(--home-control-shadow)',
  colorScheme: 'dark',
}

const directoryControlFocusStyle: CSSProperties = {
  borderColor: 'color-mix(in srgb, var(--brand-green) 44%, var(--shell-panel-border) 56%)',
  outline: '2px solid color-mix(in srgb, var(--brand-green) 48%, transparent)',
  boxShadow: '0 0 0 5px rgba(155,225,29,0.12), var(--home-control-shadow)',
}

const errorBanner: CSSProperties = {
  marginBottom: '14px',
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'color-mix(in srgb, #7f1d1d 14%, var(--shell-chip-bg) 86%)',
  border: '1px solid color-mix(in srgb, #f87171 26%, var(--shell-panel-border) 74%)',
  color: 'color-mix(in srgb, #f87171 72%, var(--foreground-strong) 28%)',
  fontWeight: 700,
  fontSize: '14px',
}

const summaryStatsGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: '10px',
  minWidth: 0,
}

const chipStat: CSSProperties = {
  borderRadius: '18px',
  padding: '12px 12px 11px',
  background: 'rgba(8,16,34,0.7)',
  border: '1px solid rgba(116,190,255,0.13)',
  minWidth: 0,
}

const chipStatAccent: CSSProperties = {
  background: 'color-mix(in srgb, var(--brand-lime) 16%, var(--shell-chip-bg) 84%)',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)',
}

const chipStatLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0,
  marginBottom: '6px',
  overflowWrap: 'anywhere',
}

const chipStatValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '20px',
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  minWidth: 0,
}

const podiumGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
  marginBottom: '16px',
  minWidth: 0,
}

const podiumCard: CSSProperties = {
  textDecoration: 'none',
  borderRadius: '24px',
  padding: '20px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.74)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const podiumFirst: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)',
  boxShadow: 'var(--shadow-soft)',
}

const podiumSecond: CSSProperties = {}

const podiumThird: CSSProperties = {}

const podiumRank: CSSProperties = {
  color: 'var(--home-eyebrow-color)',
  fontSize: '13px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const podiumName: CSSProperties = {
  marginTop: '8px',
  color: 'var(--foreground-strong)',
  fontSize: '28px',
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: 0,
}

const podiumLocation: CSSProperties = {
  marginTop: '8px',
  color: 'var(--shell-copy-muted)',
  fontSize: '15px',
  fontWeight: 700,
}

const podiumRating: CSSProperties = {
  marginTop: '16px',
  color: 'var(--foreground-strong)',
  fontSize: '34px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 0,
}

const podiumSubtext: CSSProperties = {
  marginTop: '6px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  fontWeight: 700,
}

const podiumMetaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '14px',
  alignItems: 'center',
}

const tableCard: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16)',
  minWidth: 0,
  marginBottom: '16px',
  scrollMarginTop: '96px',
}

const panelHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '16px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const sectionKicker: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
}

const panelTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: 0,
}

const panelChipWrap: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
}

const panelChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '38px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground)',
  border: '1px solid rgba(116,190,255,0.13)',
  fontWeight: 800,
  fontSize: '13px',
}

const clearFilterButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 0,
  minHeight: '34px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground)',
  fontWeight: 800,
  cursor: 'pointer',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const tableWrap: CSSProperties = {
  overflowX: 'auto',
  borderRadius: '20px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  maxWidth: '100%',
  minWidth: 0,
  WebkitOverflowScrolling: 'touch',
  overscrollBehaviorX: 'contain',
  scrollbarWidth: 'thin',
}

const compactLeaderboardStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
  minWidth: 0,
}

const compactTierDividerStyle: CSSProperties = {
  marginTop: '6px',
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const compactRankingCardStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '15px',
  borderRadius: '20px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(6,16,32,0.58)',
  textDecoration: 'none',
  color: 'inherit',
  minWidth: 0,
  overflow: 'hidden',
}

const compactRankingTopStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)',
  alignItems: 'center',
  gap: '12px',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const compactPlayerCopyStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  minWidth: 0,
}

const compactPlayerNameStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '17px',
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
  textDecoration: 'none',
}

const compactPlayerMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const compactRatingStackStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '3px',
  padding: '10px 12px',
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  fontSize: '22px',
  fontWeight: 950,
  lineHeight: 1,
  gridColumn: '1 / -1',
  minWidth: 0,
}

const compactSignalRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 112px), 1fr))',
  gap: '8px',
  alignItems: 'center',
  minWidth: 0,
}

const compactBottomGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 96px), 1fr))',
  gap: '10px',
  alignItems: 'center',
  minWidth: 0,
}

const compactActionRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))',
  gap: '9px',
  paddingTop: '2px',
  minWidth: 0,
}

const compactActionPrimaryStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '1 1 130px',
  minHeight: '40px',
  padding: '0 11px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-lime) 15%, var(--shell-chip-bg) 85%)',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 900,
  textDecoration: 'none',
  textAlign: 'center',
  whiteSpace: 'normal',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const compactActionSecondaryStyle: CSSProperties = {
  ...compactActionPrimaryStyle,
  background: 'rgba(7,17,33,0.72)',
  border: '1px solid rgba(116,190,255,0.13)',
}

const compactMiniLabelStyle: CSSProperties = {
  display: 'block',
  marginBottom: '5px',
  color: 'var(--shell-copy-muted)',
  fontSize: '10px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const compactMiniValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const dataTable: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 0,
}

const tableHead: CSSProperties = {
  padding: '15px 16px',
  textAlign: 'left',
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  fontWeight: 800,
  borderBottom: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(6,16,32,0.78)',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const activeTableHead: CSSProperties = {
  color: 'var(--home-eyebrow-color)',
}

const tableCell: CSSProperties = {
  padding: '16px',
  color: 'var(--foreground)',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 600,
  borderTop: '1px solid var(--shell-panel-border)',
  verticalAlign: 'top',
  overflowWrap: 'anywhere',
}

const rowActionStackStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  minWidth: 0,
  maxWidth: '100%',
}

const rowActionPrimaryStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 0,
  minHeight: '32px',
  padding: '0 11px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-lime) 15%, var(--shell-chip-bg) 85%)',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 900,
  textDecoration: 'none',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const rowActionSecondaryStyle: CSSProperties = {
  ...rowActionPrimaryStyle,
  background: 'rgba(7,17,33,0.72)',
  border: '1px solid rgba(116,190,255,0.13)',
}

const rankingNextActionPanel: CSSProperties = {
  display: 'grid',
  gap: '16px',
  marginBottom: '16px',
  padding: '20px',
  borderRadius: '26px',
  background: 'var(--shell-panel-bg-strong)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const rankingNextActionHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '14px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const rankingNextActionTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.35rem, 2.4vw, 1.85rem)',
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const rankingNextActionGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: '12px',
  minWidth: 0,
}

const rankingNextActionCard: CSSProperties = {
  display: 'grid',
  gap: '9px',
  alignContent: 'start',
  minHeight: '168px',
  padding: '16px',
  borderRadius: '20px',
  background: 'rgba(7,17,33,0.72)',
  border: '1px solid rgba(116,190,255,0.13)',
  color: 'inherit',
  textDecoration: 'none',
  minWidth: 0,
}

const rankingNextActionCardTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  lineHeight: 1.18,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const rankingNextActionCardBody: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.58,
  fontWeight: 650,
  overflowWrap: 'anywhere',
}

const rankingNextActionCta: CSSProperties = {
  alignSelf: 'end',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'fit-content',
  maxWidth: '100%',
  minHeight: '36px',
  padding: '0 12px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-lime) 15%, var(--shell-chip-bg) 85%)',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 900,
  textAlign: 'center',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const insightDetails: CSSProperties = {
  marginBottom: '16px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16)',
  overflow: 'hidden',
  minWidth: 0,
}

const insightSummary: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '14px',
  padding: '18px 20px',
  cursor: 'pointer',
  listStyle: 'none',
  flexWrap: 'wrap',
  minWidth: 0,
}

const insightSummaryTitle: CSSProperties = {
  display: 'block',
  marginTop: '4px',
  color: 'var(--foreground-strong)',
  fontSize: '22px',
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const insightSummaryMeta: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '34px',
  padding: '0 12px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-lime) 12%, var(--shell-chip-bg) 88%)',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 22%, var(--shell-panel-border) 78%)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 900,
  whiteSpace: 'normal',
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
}

const insightBody: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '0 20px 20px',
  minWidth: 0,
}

const signalPanel: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '18px',
  borderRadius: '20px',
  background: 'rgba(6,16,32,0.58)',
  border: '1px solid rgba(116,190,255,0.13)',
  minWidth: 0,
}

const signalPanelHead: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const signalPanelTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: '20px',
  lineHeight: 1.1,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const distributionGrid: CSSProperties = {
  display: 'grid',
  gap: '8px',
  minWidth: 0,
}

const distributionRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 72px) minmax(0, 1fr) minmax(0, 32px)',
  alignItems: 'center',
  gap: '10px',
  minWidth: 0,
}

const distributionLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '11px',
  fontWeight: 800,
  textAlign: 'right',
  overflowWrap: 'anywhere',
}

const distributionTrack: CSSProperties = {
  height: 18,
  borderRadius: 999,
  overflow: 'hidden',
  background: 'color-mix(in srgb, var(--foreground-strong) 6%, transparent)',
  minWidth: 0,
}

const distributionFill: CSSProperties = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(90deg, var(--brand-blue-2), var(--brand-lime))',
  transition: 'width 400ms ease',
}

const distributionCount: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const signalGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: '12px',
  minWidth: 0,
}

const signalListCard: CSSProperties = {
  display: 'grid',
  gap: '12px',
  minWidth: 0,
  padding: '16px',
  borderRadius: '20px',
  background: 'rgba(7,17,33,0.72)',
  border: '1px solid rgba(116,190,255,0.13)',
}

const signalListTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const signalListItems: CSSProperties = {
  display: 'grid',
  gap: '10px',
  minWidth: 0,
}

const signalListItem: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const signalListLink: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '14px',
  fontWeight: 850,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const signalListMeta: CSSProperties = {
  marginTop: '3px',
  color: 'var(--shell-copy-muted)',
  fontSize: '11px',
  fontWeight: 650,
  overflowWrap: 'anywhere',
}

const signalListValue: CSSProperties = {
  flex: '0 0 auto',
  fontSize: '14px',
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const signalEmpty: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const emptyCell: CSSProperties = {
  textAlign: 'center',
  color: 'var(--shell-copy-muted)',
  fontWeight: 700,
  padding: '24px',
  overflowWrap: 'anywhere',
}

const rankBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '2.2rem',
  padding: '0.45rem 0.7rem',
  borderRadius: '999px',
  background: 'color-mix(in srgb, var(--brand-blue-2) 12%, var(--shell-chip-bg) 88%)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  lineHeight: 1,
  fontWeight: 900,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const playerLink: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const rankingPlayerIdentityStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  minWidth: 0,
}

const rankingAwardBadgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  minWidth: 0,
}

const compactAwardBadgeRowStyle: CSSProperties = {
  ...rankingAwardBadgeRowStyle,
  gap: '5px',
}

const rankingAwardBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  minHeight: '24px',
  maxWidth: '100%',
  padding: '0 8px',
  borderRadius: '999px',
  border: '1px solid rgba(155,225,29,0.26)',
  background: 'rgba(155,225,29,0.10)',
  color: 'var(--foreground-strong)',
  fontSize: '10px',
  fontWeight: 900,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const rankingAwardCaseLinkStyle: CSSProperties = {
  ...rankingAwardBadgeStyle,
  border: '1px solid rgba(116,190,255,0.20)',
  background: 'rgba(116,190,255,0.08)',
  color: 'var(--brand-blue-2)',
}

const activeRatingCell: CSSProperties = {
  color: 'var(--home-eyebrow-color)',
  fontWeight: 900,
}

const iconSvgStyle: CSSProperties = {
  width: '22px',
  height: '22px',
}

const editorialPanel: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '22px',
  borderRadius: '26px',
  background: 'var(--shell-panel-bg-strong)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const editorialText: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '15px',
  lineHeight: 1.8,
  maxWidth: '860px',
  overflowWrap: 'anywhere',
}

const editorialGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  minWidth: 0,
}

const editorialCard: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '18px',
  borderRadius: '20px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  minWidth: 0,
}

const editorialCardLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const editorialCardValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '24px',
  lineHeight: 1.04,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const editorialCardText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.65,
  overflowWrap: 'anywhere',
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
  whiteSpace: 'normal',
  textAlign: 'center',
  overflowWrap: 'anywhere',
  minWidth: 0,
}

const trendPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  whiteSpace: 'normal',
  textAlign: 'center',
  overflowWrap: 'anywhere',
  minWidth: 0,
}

const confidencePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground)',
  border: '1px solid rgba(116,190,255,0.13)',
  fontSize: '12px',
  fontWeight: 800,
  whiteSpace: 'normal',
  textAlign: 'center',
  overflowWrap: 'anywhere',
  minWidth: 0,
}

const tierDividerCell: CSSProperties = {
  padding: '10px 16px',
  background: 'var(--shell-chip-bg)',
  borderTop: '1px solid var(--shell-panel-border)',
  borderBottom: '1px solid var(--shell-panel-border)',
}

const tierDividerLabel: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: '-86px',
  top: '-108px',
  width: '340px',
  aspectRatio: '1',
  borderRadius: '50%',
  border: '34px solid rgba(155,225,29,0.07)',
  boxShadow: 'inset 0 0 0 2px rgba(125,211,252,0.05), 0 0 76px rgba(125,211,252,0.08)',
  opacity: 0.72,
  pointerEvents: 'none',
}
