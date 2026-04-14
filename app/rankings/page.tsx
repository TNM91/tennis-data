'use client'

import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import SiteShell from '@/app/components/site-shell'
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
}

type SnapshotRow = {
  player_id: string
  rating_type?: RatingView | null
  dynamic_rating: number
  snapshot_date: string
}

type RankedPlayer = Player & {
  selectedRating: number
  baseRating: number
  ratingDiff: number
  matches: number
  confidence: ConfidenceLevel
  status: RatingStatus
  trendDirection: TrendDirection
  trendDelta: number
}

export default function RankingsPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [ratingView, setRatingView] = useState<RatingView>('overall')
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  useEffect(() => {
    void loadPlayers()
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
          doubles_dynamic_rating
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
        .select('player_id, rating_type, dynamic_rating, snapshot_date')
        .in('player_id', playerIds)
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
  const hasActiveFilters = searchText.trim().length > 0 || locationFilter.length > 0

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
        const baseRating = getBaseRating(player, ratingView)
        const ratingDiff = roundToTwo(selectedRating - baseRating)
        const matches = matchCounts[player.id] || 0
        const confidence = getConfidence(matches)

        const trendPoints = getTrendPointsForPlayer(snapshotMap, player.id, ratingView)
        const trendDirection = getTrendDirection(trendPoints)
        const trendDelta = getRecentTrendDelta(trendPoints)
        const status = getRatingStatus(baseRating, selectedRating)

        return {
          ...player,
          selectedRating,
          baseRating,
          ratingDiff,
          matches,
          confidence,
          status,
          trendDirection,
          trendDelta,
        }
      })
      .sort((a, b) => b.selectedRating - a.selectedRating)
  }, [filteredPlayers, ratingView, snapshotMap, matchCounts])

  const topThree = rankedPlayers.slice(0, 3)

  const avgSelected = useMemo(() => {
    if (rankedPlayers.length === 0) return 0
    const total = rankedPlayers.reduce((sum, player) => sum + player.selectedRating, 0)
    return total / rankedPlayers.length
  }, [rankedPlayers])

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
                      style={selectStyle}
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

              {hasActiveFilters ? (
                <div style={panelChipWrap}>
                  <span style={panelChip}>Filters active</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchText('')
                      setLocationFilter('')
                    }}
                    style={clearFilterButton}
                  >
                    Clear filters
                  </button>
                </div>
              ) : null}

              <div id="rankings-filter-helper" style={controlsHelperText}>
                Search by player or location, then use the rating basis buttons to shift the board between overall, singles, and doubles.
              </div>

              <div style={summaryStatsGrid}>
                <StatChip label="Players shown" value={String(rankedPlayers.length)} />
                <StatChip label="Top rating" value={formatRating(topThree[0]?.selectedRating)} accent />
                <StatChip label="Average" value={formatRating(avgSelected)} />
                <StatChip label="Basis" value={capitalize(ratingView)} />
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

              return (
                <Link
                  key={player.id}
                  href={`/players/${player.id}`}
                  style={{
                    ...podiumCard,
                    ...(index === 0 ? podiumFirst : index === 1 ? podiumSecond : podiumThird),
                  }}
                >
                  <div style={podiumRank}>#{index + 1}</div>
                  <div style={podiumName}>{player.name}</div>
                  <div style={podiumLocation}>{player.location || 'No location'}</div>
                  <div style={podiumRating}>{formatRating(player.selectedRating)}</div>
                  <div style={podiumSubtext}>{capitalize(ratingView)} dynamic rating</div>

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

      <section style={contentWrap}>
        <article style={tableCard}>
          <div style={panelHead}>
            <div>
              <div style={sectionKicker}>Leaderboard</div>
              <h2 style={panelTitle}>Full rankings</h2>
            </div>

            <div style={panelChipWrap}>
              <span style={panelChip}>Showing {rankedPlayers.length}</span>
              <span style={panelChip}>{capitalize(ratingView)} rating</span>
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
                  <th style={tableHead}>Trend</th>
                  <th style={tableHead}>Confidence</th>
                  <th style={{ ...tableHead, ...(ratingView === 'overall' ? activeTableHead : {}) }}>Overall</th>
                  <th style={{ ...tableHead, ...(ratingView === 'singles' ? activeTableHead : {}) }}>Singles</th>
                  <th style={{ ...tableHead, ...(ratingView === 'doubles' ? activeTableHead : {}) }}>Doubles</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={emptyCell}>Loading rankings...</td>
                  </tr>
                ) : rankedPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={emptyCell}>
                      {hasActiveFilters
                        ? 'No players matched the current search or location filter. Clear filters to widen the board.'
                        : 'No players found yet.'}
                    </td>
                  </tr>
                ) : (
                  rankedPlayers.map((player, index) => {
                    const theme = getMeterTheme(player.status)

                    return (
                      <tr key={player.id}>
                        <td style={tableCell}>
                          <span style={rankBadge}>{index + 1}</span>
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
                        </td>

                        <td style={tableCell}>
                          <span style={confidencePill}>{player.confidence}</span>
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
    </SiteShell>
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

function getSelectedRating(player: Player, view: RatingView) {
  if (view === 'singles') return toRatingNumber(player.singles_dynamic_rating, 3.5)
  if (view === 'doubles') return toRatingNumber(player.doubles_dynamic_rating, 3.5)
  return toRatingNumber(player.overall_dynamic_rating, 3.5)
}

function getBaseRating(player: Player, view: RatingView) {
  if (view === 'singles') {
    return toRatingNumber(player.singles_rating ?? player.overall_rating, 3.5)
  }

  if (view === 'doubles') {
    return toRatingNumber(player.doubles_rating ?? player.overall_rating, 3.5)
  }

  return toRatingNumber(player.overall_rating, 3.5)
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
  if (matches < 5) return 'Low'
  if (matches < 10) return 'Medium'
  return 'High'
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
  background:
    `
    linear-gradient(180deg, rgba(26, 54, 104, 0.52) 0%, rgba(17, 36, 72, 0.72) 22%, rgba(12, 27, 52, 0.82) 100%)
  `,
  border: '1px solid rgba(116,190,255,0.22)',
  boxShadow:
    '0 26px 80px rgba(7,18,42,0.24), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 80px rgba(88,170,255,0.06)',
  overflow: 'hidden',
  position: 'relative',
}

const heroNoise: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at 10% 0%, rgba(88,161,255,0.16), transparent 26%), radial-gradient(circle at 100% 0%, rgba(74,222,128,0.08), transparent 30%)',
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
  color: '#f8fbff',
  fontWeight: 900,
  letterSpacing: '-0.045em',
}

const heroText: CSSProperties = {
  margin: 0,
  color: 'rgba(224,236,249,0.86)',
  lineHeight: 1.65,
  fontWeight: 500,
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  padding: '7px 11px',
  borderRadius: '999px',
  color: '#d6e9ff',
  background: 'rgba(74,123,211,0.18)',
  border: '1px solid rgba(130,178,255,0.18)',
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
  border: '1px solid rgba(137,182,255,0.14)',
  background: 'rgba(43,78,138,0.34)',
  color: '#e2efff',
  borderRadius: '999px',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 700,
}

const controlsCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(128,174,255,0.16)',
  background: 'linear-gradient(180deg, rgba(45,79,137,0.42) 0%, rgba(24,45,84,0.5) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
}

const controlsTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '14px',
}

const controlsLabel: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: '-0.03em',
}

const controlsHint: CSSProperties = {
  marginTop: '4px',
  color: 'rgba(220,231,244,0.78)',
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
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '16px',
  background: 'rgba(255,255,255,0.06)',
  color: '#f7fbff',
  minHeight: '48px',
  padding: '0 14px',
  fontSize: '14px',
  fontWeight: 800,
  cursor: 'pointer',
}

const segmentButtonActive: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(103, 241, 154, 1), rgba(40, 205, 110, 0.94))',
  color: '#071622',
  border: '1px solid rgba(111, 236, 168, 0.34)',
  boxShadow: '0 12px 30px rgba(43, 195, 104, 0.20), inset 0 1px 0 rgba(255,255,255,0.26)',
}

const controlsGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  marginBottom: '14px',
}

const inputLabel: CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  color: 'rgba(198,216,248,0.84)',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const controlsHelperText: CSSProperties = {
  marginTop: '14px',
  color: 'rgba(220,231,244,0.78)',
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
  color: 'rgba(210,226,244,0.82)',
  pointerEvents: 'none',
}

const searchInput: CSSProperties = {
  width: '100%',
  borderRadius: '18px',
  border: '1px solid rgba(138,182,255,0.16)',
  background: 'rgba(10,20,40,0.6)',
  color: '#f7fbff',
  padding: '15px 16px 15px 46px',
  fontSize: '15px',
  outline: 'none',
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: '52px',
  borderRadius: '18px',
  border: '1px solid rgba(138,182,255,0.16)',
  background: 'rgba(10,20,40,0.6)',
  color: '#f7fbff',
  padding: '0 14px',
  fontSize: '14px',
  fontWeight: 700,
  outline: 'none',
}

const errorBanner: CSSProperties = {
  marginBottom: '14px',
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.18)',
  color: '#fecaca',
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
  background: 'rgba(26,42,71,0.58)',
  border: '1px solid rgba(74,123,211,0.24)',
  minWidth: 0,
}

const chipStatAccent: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(31,102,74,0.92) 0%, rgba(42,162,96,0.84) 100%)',
  border: '1px solid rgba(134,239,172,0.24)',
}

const chipStatLabel: CSSProperties = {
  color: 'rgba(198,214,230,0.74)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '6px',
}

const chipStatValue: CSSProperties = {
  color: '#f8fbff',
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
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.32) 0%, rgba(28,49,95,0.46) 100%)',
  boxShadow: '0 14px 34px rgba(9,25,54,0.14), inset 0 1px 0 rgba(255,255,255,0.05)',
}

const podiumFirst: CSSProperties = {
  border: '1px solid rgba(111, 236, 168, 0.34)',
  boxShadow: '0 16px 34px rgba(43, 195, 104, 0.14), inset 0 1px 0 rgba(255,255,255,0.08)',
}

const podiumSecond: CSSProperties = {}

const podiumThird: CSSProperties = {}

const podiumRank: CSSProperties = {
  color: '#bbf7d0',
  fontSize: '13px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const podiumName: CSSProperties = {
  marginTop: '8px',
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const podiumLocation: CSSProperties = {
  marginTop: '8px',
  color: 'rgba(223,232,248,0.82)',
  fontSize: '15px',
  fontWeight: 700,
}

const podiumRating: CSSProperties = {
  marginTop: '16px',
  color: '#f8fbff',
  fontSize: '34px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const podiumSubtext: CSSProperties = {
  marginTop: '6px',
  color: 'rgba(198,216,248,0.78)',
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
  border: '1px solid rgba(133, 168, 229, 0.16)',
  background:
    'radial-gradient(circle at top right, rgba(184, 230, 26, 0.12), transparent 34%), linear-gradient(135deg, rgba(8, 34, 75, 0.98) 0%, rgba(4, 18, 45, 0.98) 58%, rgba(7, 36, 46, 0.98) 100%)',
  boxShadow: '0 28px 60px rgba(2, 8, 23, 0.28)',
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
  color: '#8fb7ff',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
}

const panelTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
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
  background: 'rgba(16, 39, 77, 0.84)',
  color: 'rgba(220, 232, 255, 0.92)',
  border: '1px solid rgba(82, 127, 201, 0.2)',
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
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e6eefb',
  fontWeight: 800,
  cursor: 'pointer',
}

const tableWrap: CSSProperties = {
  overflowX: 'auto',
  borderRadius: '20px',
  border: '1px solid rgba(160, 185, 234, 0.12)',
  background: 'rgba(7, 20, 45, 0.62)',
}

const dataTable: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: '1100px',
}

const tableHead: CSSProperties = {
  padding: '15px 16px',
  textAlign: 'left',
  color: 'rgba(190, 210, 245, 0.8)',
  fontSize: '12px',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  fontWeight: 800,
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'rgba(10, 27, 58, 0.78)',
  whiteSpace: 'nowrap',
}

const activeTableHead: CSSProperties = {
  color: '#bbf7d0',
}

const tableCell: CSSProperties = {
  padding: '16px',
  color: '#e9f2ff',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 600,
  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  verticalAlign: 'top',
}

const emptyCell: CSSProperties = {
  textAlign: 'center',
  color: 'rgba(220,231,244,0.78)',
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
  background: 'rgba(37,91,227,0.18)',
  color: '#dbeafe',
  fontSize: '12px',
  lineHeight: 1,
  fontWeight: 900,
}

const playerLink: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 800,
  textDecoration: 'none',
}

const activeRatingCell: CSSProperties = {
  color: '#bbf7d0',
  fontWeight: 900,
}

const iconSvgStyle: CSSProperties = {
  width: '22px',
  height: '22px',
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
  background: 'rgba(255,255,255,0.06)',
  color: '#e2efff',
  border: '1px solid rgba(255,255,255,0.10)',
  fontSize: '12px',
  fontWeight: 800,
  whiteSpace: 'nowrap',
}
