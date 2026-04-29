'use client'

import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AdsenseSlot from '@/app/components/adsense-slot'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import SiteShell from '@/app/components/site-shell'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { getClientAuthState } from '@/lib/auth'
import { type UserRole } from '@/lib/roles'
import {
  formatRatingValue,
  getRatingViewLabel,
  getTiqRating,
  getUstaDynamicRating,
  getUstaRating,
} from '@/lib/player-rating-display'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

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
}

const RANKINGS_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_RANKINGS_INLINE || null

export default function RankingsPage() {
  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
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
  const [sortCol, setSortCol] = useState<'tiq' | 'trend' | 'form' | 'winRate' | 'matches'>('tiq')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])
  const ratingViewLabel = getRatingViewLabel(ratingView)

  useEffect(() => {
    void loadPlayers()
  }, [])

  useEffect(() => {
    let active = true

    async function loadAuth() {
      try {
        const authState = await getClientAuthState()
        if (!active) return
        setRole(authState.role)
        setEntitlements(authState.entitlements)
      } catch {
        if (!active) return
        setRole('public')
        setEntitlements(null)
      }
    }

    void loadAuth()

    return () => {
      active = false
    }
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
      const { data, error } = await supabase
        .from('players')
        .select(`
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
        `)

      if (error) throw new Error(error.message)

      const typedPlayers = (data || []) as Player[]
      setPlayers(typedPlayers)

      const playerIds = typedPlayers.map((player) => player.id)

      if (playerIds.length === 0) {
        setSnapshots([])
        setMatchCounts({})
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

      setSnapshots((snapshotData || []) as SnapshotRow[])
      setMatchCounts(counts)
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
        // Signal uses USTA dynamic vs USTA base — mirrors what USTA measures for bump/knockdown.
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
  }, [filteredPlayers, ratingView, snapshotMap, matchCounts, hideInactive])

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
      { label: '2.5–3.0', min: 2.5, max: 3.0 },
      { label: '3.0–3.5', min: 3.0, max: 3.5 },
      { label: '3.5–4.0', min: 3.5, max: 4.0 },
      { label: '4.0–4.5', min: 4.0, max: 4.5 },
      { label: '4.5–5.0', min: 4.5, max: 5.0 },
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

  const dynamicHeroWrap: CSSProperties = {
    ...heroWrap,
    padding: isMobile ? '14px 16px 20px' : '10px 18px 24px',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '28px 18px 22px' : '34px 28px 24px',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
    gap: isMobile ? '18px' : '22px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '46px' : '60px',
    lineHeight: isMobile ? 1.04 : 0.98,
    maxWidth: '540px',
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
    maxWidth: '540px',
  }

  const dynamicControlsCard: CSSProperties = {
    ...controlsCard,
    position: isTablet ? 'relative' : 'sticky',
    top: isTablet ? 'auto' : '24px',
  }

  const dynamicControlsTopRow: CSSProperties = {
    ...controlsTopRow,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'flex-start' : 'center',
  }

  const dynamicControlsGrid: CSSProperties = {
    ...controlsGrid,
    gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.25fr) minmax(220px, 0.75fr)',
  }

  const dynamicPodiumGrid: CSSProperties = {
    ...podiumGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }

  return (
    <SiteShell active="rankings">
      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div style={heroNoise} />

          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>Rankings</div>

              <h1 style={dynamicHeroTitle}>See who rises to the top.</h1>

              <p style={dynamicHeroText}>
                View player rankings by overall, singles, or doubles dynamic rating, then filter
                by player name or location to narrow the board and jump straight into full profiles.
              </p>

              <div style={heroHintRow}>
                <span style={heroHintPill}>{rankedPlayers.length} shown</span>
                <span style={heroHintPill}>{locations.length} locations</span>
                <span style={heroHintPill}>{capitalize(ratingView)} mode</span>
              </div>
              <div style={exploreNavRow}>
                <Link href="/explore/players" style={exploreNavLink}>Players</Link>
                <Link href="/explore/leagues" style={exploreNavLink}>Leagues</Link>
                <Link href="/mylab" style={exploreNavLink}>My Lab</Link>
              </div>

              {!access.canUseAdvancedPlayerInsights ? (
                <div style={{ marginTop: 18, maxWidth: 560 }}>
                  <UpgradePrompt
                    planId="player_plus"
                    compact
                    headline="Want more than a leaderboard?"
                    body="Unlock Player+ to turn rankings into personal guidance with clearer projections, matchup context, and where-you-should-play insight."
                    ctaLabel="Unlock Player+"
                    ctaHref="/pricing"
                    secondaryLabel="See Player+ value"
                    secondaryHref="/pricing"
                    footnote="Best for players who want rankings to turn into better match decisions, not just browsing."
                  />
                </div>
              ) : null}
            </div>

            <div style={dynamicControlsCard}>
              <div style={dynamicControlsTopRow}>
                <div>
                  <div style={controlsLabel}>Leaderboard controls</div>
                  <div style={controlsHint}>Search, filter, and switch ranking mode</div>
                </div>

                <div style={segmentWrap}>
                    <button
                      type="button"
                      aria-pressed={ratingView === 'overall'}
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
                      aria-pressed={ratingView === 'singles'}
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
                      aria-pressed={ratingView === 'doubles'}
                      onClick={() => setRatingView('doubles')}
                      style={{
                      ...segmentButton,
                      ...(ratingView === 'doubles' ? segmentButtonActive : {}),
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
                      placeholder="Search players or location..."
                      style={searchInput}
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
                      style={{
                        ...selectStyle,
                        borderColor: locationFilter ? 'rgba(155,225,29,0.42)' : undefined,
                        boxShadow: locationFilter ? '0 0 0 1px rgba(155,225,29,0.12)' : undefined,
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
                  {hideInactive ? `Active (90d) ✓` : `Active (90d)${inactiveCount > 0 ? ` −${inactiveCount}` : ''}`}
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

              <div id="rankings-filter-helper" style={controlsHelperText}>
                Search by player or location, then use the TIQ rating basis buttons to shift the board between overall, singles, and doubles.
              </div>

              <div style={summaryStatsGrid}>
                <StatChip label="Players shown" value={String(rankedPlayers.length)} />
                <StatChip label="Top TIQ" value={formatRating(topThree[0]?.selectedRating)} accent />
                <StatChip label="Average TIQ" value={formatRating(avgSelected)} />
                <StatChip label="Basis" value={ratingViewLabel} />
              </div>
            </div>
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
                  <div style={podiumRating}>{formatRating(player.selectedRating)}</div>
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

      {!loading && !error ? (
        <section style={contentWrap}>
          <article style={editorialPanel}>
            <div style={sectionKicker}>Ranking context</div>
            <h2 style={panelTitle}>Use this board to spot movement, not just order.</h2>
            <p style={editorialText}>
              A strong leaderboard helps you separate stable top-tier players from fast risers and
              thin-sample noise. Use the public board to find TIQ tiers, momentum, and recent confidence,
              then open individual player pages for deeper USTA baseline and TIQ trend context.
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
                    Rating distribution — {ratingViewLabel}
                  </div>
                  <div style={{ display: 'grid', gap: 7 }}>
                    {ratingDistribution.map((band) => (
                      <div key={band.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ minWidth: 70, color: 'rgba(190,210,240,0.6)', fontSize: 11, fontWeight: 700, textAlign: 'right' as const }}>{band.label}</span>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden', height: 18 }}>
                          <div style={{ width: `${(band.count / maxCount) * 100}%`, background: 'linear-gradient(90deg, rgba(37,91,227,0.6), rgba(63,167,255,0.5))', height: '100%', borderRadius: 999, transition: 'width 400ms ease', minWidth: band.count > 0 ? 4 : 0 }} />
                        </div>
                        <span style={{ minWidth: 28, color: 'rgba(190,210,240,0.55)', fontSize: 12, fontWeight: 800 }}>{band.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })() : null}
          </article>
        </section>
      ) : null}

      {!loading && !error && (risers.length > 0 || fallers.length > 0) ? (
        <section style={contentWrap}>
          <article style={editorialPanel}>
            <div style={sectionKicker}>Movers</div>
            <h2 style={panelTitle}>Who&apos;s rising and falling.</h2>
            <p style={editorialText}>
              Based on the full snapshot history for the current rating view. Rising players have gained the most since their first recorded match; falling players have given back the most.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 20, marginTop: 20 }}>
              {risers.length > 0 ? (
                <div>
                  <div style={{ color: '#9be11d', fontWeight: 800, fontSize: 13, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 12 }}>Rising</div>
                  {risers.map(({ player, delta }) => (
                    <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 16, background: 'rgba(155,225,29,0.05)', border: '1px solid rgba(155,225,29,0.14)', marginBottom: 8 }}>
                      <div>
                        <Link href={`/players/${player.id}`} style={{ color: '#f8fbff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>{player.name}</Link>
                        <div style={{ color: 'rgba(224,234,247,0.55)', fontSize: 12, marginTop: 3 }}>{player.location || 'No location'} · {player.selectedRating.toFixed(2)} TIQ</div>
                      </div>
                      <span style={{ color: '#9be11d', fontWeight: 900, fontSize: 16, letterSpacing: '-0.02em' }}>+{delta.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {fallers.length > 0 ? (
                <div>
                  <div style={{ color: '#f87171', fontWeight: 800, fontSize: 13, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 12 }}>Falling</div>
                  {fallers.map(({ player, delta }) => (
                    <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 16, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.14)', marginBottom: 8 }}>
                      <div>
                        <Link href={`/players/${player.id}`} style={{ color: '#f8fbff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>{player.name}</Link>
                        <div style={{ color: 'rgba(224,234,247,0.55)', fontSize: 12, marginTop: 3 }}>{player.location || 'No location'} · {player.selectedRating.toFixed(2)} TIQ</div>
                      </div>
                      <span style={{ color: '#f87171', fontWeight: 900, fontSize: 16, letterSpacing: '-0.02em' }}>{delta.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      {!loading && !error && hotFormPlayers.length > 0 ? (
        <section style={contentWrap}>
          <article style={editorialPanel}>
            <div style={sectionKicker}>Form spotlight</div>
            <h2 style={panelTitle}>Hot right now.</h2>
            <p style={editorialText}>
              Players with the strongest last-5 match form — positive net delta across their five most recent rated matches. A high form score doesn&apos;t guarantee a high rank, but it signals momentum worth watching.
            </p>

            <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
              {hotFormPlayers.map((player, i) => {
                const boardRank = rankedPlayers.findIndex((p) => p.id === player.id) + 1
                return (
                <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 18, background: 'rgba(155,225,29,0.04)', border: '1px solid rgba(155,225,29,0.12)' }}>
                  <span style={{ minWidth: 24, color: 'rgba(190,210,240,0.4)', fontWeight: 900, fontSize: 13, textAlign: 'right' as const }}>#{i + 1}</span>
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

      {!loading && !error && weeklyMovers.length > 0 ? (
        <section style={contentWrap}>
          <article style={editorialPanel}>
            <div style={sectionKicker}>Week in review</div>
            <h2 style={panelTitle}>Biggest movers this week.</h2>
            <p style={editorialText}>
              Players with the largest cumulative rating movement from matches in the last 7 days. Ranked by absolute delta — both risers and fallers.
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
                      <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: '-0.02em', color: positive ? '#9be11d' : '#f87171' }}>
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

      {!loading && !error && breakthroughPlayers.length > 0 ? (
        <section style={contentWrap}>
          <article style={editorialPanel}>
            <div style={sectionKicker}>Breakthrough watch</div>
            <h2 style={panelTitle}>Rising fast — last 30 days.</h2>
            <p style={editorialText}>
              Players accumulating the most positive rating movement this month. These are the names most likely to change tier soon — worth watching before lineup decisions.
            </p>
            <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
              {breakthroughPlayers.map(({ player, delta30, matchesThisMonth }, i) => (
                <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 18, background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.14)' }}>
                  <span style={{ minWidth: 24, color: 'rgba(190,210,240,0.4)', fontWeight: 900, fontSize: 13, textAlign: 'center' as const }}>#{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/players/${player.id}`} style={{ color: '#f8fbff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>{player.name}</Link>
                    <div style={{ color: 'rgba(224,234,247,0.5)', fontSize: 12, marginTop: 3 }}>{player.location || 'No location'} · {matchesThisMonth} match{matchesThisMonth !== 1 ? 'es' : ''} this month · {player.selectedRating.toFixed(2)} TIQ</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 900, fontSize: 16, color: '#a7f3d0', letterSpacing: '-0.02em' }}>+{delta30.toFixed(3)}</span>
                    <span style={{ padding: '3px 9px', borderRadius: 999, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.22)', color: '#a7f3d0', fontSize: 11, fontWeight: 800 }}>30d</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      <section style={contentWrap}>
        <article style={tableCard}>
          <div style={panelHead}>
            <div>
              <div style={sectionKicker}>Leaderboard</div>
              <h2 style={panelTitle}>Full rankings</h2>
            </div>

            <div style={panelChipWrap}>
              <span style={panelChip}>Showing {rankedPlayers.length}</span>
              <span style={panelChip}>TIQ {ratingViewLabel}</span>
            </div>
          </div>

          <div style={tableWrap}>
            <table style={dataTable}>
              <thead>
                <tr>
                  <th style={tableHead}>Rank</th>
                  <th style={tableHead}>Player</th>
                  <th style={tableHead}>Location</th>
                  <th style={tableHead}>Signal</th>
                  <SortableHeader col="trend" label="Trend" sortCol={sortCol} sortDir={sortDir} onSort={handleSortCol} />
                  <SortableHeader col="form" label="Form" sortCol={sortCol} sortDir={sortDir} onSort={handleSortCol} />
                  <SortableHeader col="winRate" label="W-L" sortCol={sortCol} sortDir={sortDir} onSort={handleSortCol} />
                  <SortableHeader col="matches" label="Confidence" sortCol={sortCol} sortDir={sortDir} onSort={handleSortCol} />
                  <th style={tableHead}>USTA Base</th>
                  <th style={{ ...tableHead, ...(ratingView === 'overall' ? activeTableHead : {}) }}>USTA Dynamic</th>
                  <th style={{ ...tableHead, ...(ratingView === 'overall' ? activeTableHead : {}) }}>TIQ Overall</th>
                  <th style={{ ...tableHead, ...(ratingView === 'singles' ? activeTableHead : {}) }}>TIQ Singles</th>
                  <th style={{ ...tableHead, ...(ratingView === 'doubles' ? activeTableHead : {}) }}>TIQ Doubles</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={13} style={emptyCell}>Loading rankings...</td>
                  </tr>
                ) : rankedPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={emptyCell}>
                      {hasActiveFilters
                        ? 'No players matched the current search or location filter. Clear filters to widen the board.'
                        : 'Player rankings are not available yet.'}
                    </td>
                  </tr>
                ) : (
                  tieredRows.map((row) => {
                    if (row.type === 'divider') {
                      return (
                        <tr key={row.key}>
                          <td colSpan={13} style={tierDividerCell}>
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
                          <Link href={`/players/${player.id}`} style={playerLink}>
                            {player.name}
                          </Link>
                        </td>

                        <td style={tableCell}>{player.location || '—'}</td>

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
                            <span style={{ color: 'rgba(190,210,240,0.35)', fontSize: 12 }}>—</span>
                          )}
                        </td>

                        <td style={tableCell}>
                          <span style={confidencePill}>{player.confidence}</span>
                        </td>

                        <td style={tableCell}>
                          {formatRatingValue(player.overall_rating)}
                        </td>

                        <td style={{ ...tableCell, ...(ratingView === 'overall' ? activeRatingCell : {}) }}>
                          {formatRating(player.ustaSelectedRating)}
                        </td>

                        <td style={{ ...tableCell, ...(ratingView === 'overall' ? activeRatingCell : {}) }}>
                          {formatRating(player.overall_dynamic_rating)}
                        </td>

                        <td style={{ ...tableCell, ...(ratingView === 'singles' ? activeRatingCell : {}) }}>
                          {formatRating(player.singles_dynamic_rating)}
                        </td>

                        <td style={{ ...tableCell, ...(ratingView === 'doubles' ? activeRatingCell : {}) }}>
                          {formatRating(player.doubles_dynamic_rating)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
      <div style={{ marginTop: 12 }}>
        <AdsenseSlot slot={RANKINGS_INLINE_AD_SLOT} label="Sponsored" minHeight={250} />
      </div>
    </SiteShell>
  )
}

function SortableHeader({
  col, label, sortCol, sortDir, onSort,
}: {
  col: 'trend' | 'form' | 'winRate' | 'matches'
  label: string
  sortCol: string
  sortDir: 'asc' | 'desc'
  onSort: (col: 'trend' | 'form' | 'winRate' | 'matches') => void
}) {
  const active = sortCol === col
  return (
    <th
      style={{ ...tableHead, cursor: 'pointer', userSelect: 'none', ...(active ? activeTableHead : {}) }}
      onClick={() => onSort(col)}
    >
      {label}{active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
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
  if (direction === 'up') return '▲'
  if (direction === 'down') return '▼'
  return '→'
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
  boxShadow: 'var(--shadow-card)',
  overflow: 'hidden',
  position: 'relative',
}

const heroNoise: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at 10% 0%, color-mix(in srgb, var(--brand-blue-2) 16%, transparent) 0%, transparent 26%), radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--brand-lime) 8%, transparent) 0%, transparent 30%)',
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

const heroTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  letterSpacing: '-0.045em',
}

const heroText: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  fontWeight: 500,
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  padding: '7px 11px',
  borderRadius: '999px',
  color: 'var(--foreground-strong)',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
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

const exploreNavRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '2px',
}

const exploreNavLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '36px',
  padding: '0 13px',
  borderRadius: '999px',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 24%, var(--shell-panel-border) 76%)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: 800,
}

const controlsCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
}

const controlsTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '14px',
}

const controlsLabel: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: '-0.03em',
}

const controlsHint: CSSProperties = {
  marginTop: '4px',
  color: 'var(--shell-copy-muted)',
  fontWeight: 600,
  fontSize: '14px',
  lineHeight: 1.6,
}

const segmentWrap: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
}

const segmentButton: CSSProperties = {
  border: '1px solid var(--shell-panel-border)',
  borderRadius: '16px',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  minHeight: '48px',
  padding: '0 14px',
  fontSize: '14px',
  fontWeight: 800,
  cursor: 'pointer',
}

const segmentButtonActive: CSSProperties = {
  background: 'linear-gradient(135deg, var(--brand-lime), #4ade80 90%)',
  color: 'var(--text-dark)',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 30%, var(--shell-panel-border) 70%)',
  boxShadow: '0 12px 30px color-mix(in srgb, var(--brand-lime) 20%, transparent), inset 0 1px 0 rgba(255,255,255,0.26)',
}

const controlsGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  marginBottom: '14px',
}

const inputLabel: CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  color: 'var(--brand-blue-2)',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const controlsHelperText: CSSProperties = {
  marginTop: '14px',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.6,
  fontWeight: 500,
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '15px 16px 15px 46px',
  fontSize: '15px',
  outline: 'none',
  boxShadow: 'var(--home-control-shadow)',
  colorScheme: 'dark',
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: '52px',
  borderRadius: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '0 14px',
  fontSize: '14px',
  fontWeight: 700,
  outline: 'none',
  boxShadow: 'var(--home-control-shadow)',
  colorScheme: 'dark',
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
  background: 'color-mix(in srgb, var(--brand-lime) 16%, var(--shell-chip-bg) 84%)',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)',
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
  color: 'var(--foreground-strong)',
  fontSize: '20px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '0 18px 0',
}

const podiumGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
  marginBottom: '16px',
}

const podiumCard: CSSProperties = {
  textDecoration: 'none',
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
}

const podiumFirst: CSSProperties = {
  border: '1px solid rgba(111, 236, 168, 0.34)',
  boxShadow: '0 16px 34px rgba(43, 195, 104, 0.14), inset 0 1px 0 rgba(255,255,255,0.08)',
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
  letterSpacing: '-0.04em',
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
  letterSpacing: '-0.04em',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'radial-gradient(circle at top right, color-mix(in srgb, var(--brand-lime) 10%, transparent) 0%, transparent 34%), var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
  minWidth: 0,
  marginBottom: '16px',
}

const panelHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '16px',
  flexWrap: 'wrap',
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
  letterSpacing: '-0.04em',
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
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  border: '1px solid var(--shell-panel-border)',
  fontWeight: 800,
  fontSize: '13px',
}

const clearFilterButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '34px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 800,
  cursor: 'pointer',
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
  minWidth: '1100px',
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
  background: 'var(--shell-panel-bg)',
  whiteSpace: 'nowrap',
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
}

const emptyCell: CSSProperties = {
  textAlign: 'center',
  color: 'var(--shell-copy-muted)',
  fontWeight: 700,
  padding: '24px',
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
}

const playerLink: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  textDecoration: 'none',
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
  padding: '24px',
  borderRadius: '26px',
  background: 'var(--shell-panel-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
}

const editorialText: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: '15px',
  lineHeight: 1.8,
  maxWidth: '860px',
}

const editorialGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
}

const editorialCard: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '18px',
  borderRadius: '20px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
}

const editorialCardLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
}

const editorialCardValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '24px',
  lineHeight: 1.04,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const editorialCardText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.65,
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
  whiteSpace: 'nowrap',
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
  whiteSpace: 'nowrap',
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
  whiteSpace: 'nowrap',
}

const tierDividerCell: CSSProperties = {
  padding: '10px 16px',
  background: 'rgba(116,190,255,0.04)',
  borderTop: '1px solid rgba(116,190,255,0.10)',
  borderBottom: '1px solid rgba(116,190,255,0.10)',
}

const tierDividerLabel: CSSProperties = {
  color: '#8fb7ff',
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.10em',
}
