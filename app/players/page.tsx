'use client'

import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AdsenseSlot from '@/app/components/adsense-slot'
import FollowButton from '@/app/components/follow-button'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import SiteShell from '@/app/components/site-shell'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { getClientAuthState } from '@/lib/auth'
import { type UserRole } from '@/lib/roles'
import { getTiqRating, getUstaRating, getUstaDynamicRating } from '@/lib/player-rating-display'
import { cleanText, formatRating } from '@/lib/captain-formatters'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { loadUserProfileLink } from '@/lib/user-profile'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'

type SortKey = 'overall' | 'singles' | 'doubles' | 'name'
type FilterKey = 'all' | 'with-matches' | 'high-rated' | 'trending-up' | 'at-risk'
type FlightFilter = 'all' | '2.5' | '3.0' | '3.5' | '4.0' | '4.5+'
type RatingView = 'overall' | 'singles' | 'doubles'
type TrendDirection = 'up' | 'down' | 'flat'
type ConfidenceLevel = 'Low' | 'Medium' | 'High'
type RatingStatus =
  | 'Bump Up Pace'
  | 'Trending Up'
  | 'Holding'
  | 'At Risk'
  | 'Drop Watch'

type PlayerRow = {
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
}

type MatchPlayerCountRow = {
  player_id: string
  match_id: string | null
  matches?: {
    match_type?: string | null
    winner_side?: string | null
    score?: string | null
  } | null
}

type PlayerCard = PlayerRow & {
  matches: number
  baseOverall: number
  baseSingles: number
  baseDoubles: number
  overallStatus: RatingStatus
  overallTrend: TrendDirection
  overallTrendDelta: number
  confidence: ConfidenceLevel
  overallDiff: number
}

const PLAYERS_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_PLAYERS_INLINE || null

export default function PlayersPage() {
  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [linkedPlayerId, setLinkedPlayerId] = useState('')
  const [players, setPlayers] = useState<PlayerCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('overall')
  const [filterBy, setFilterBy] = useState<FilterKey>('all')
  const [flightFilter, setFlightFilter] = useState<FlightFilter>('all')
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])

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
        const profileResult = await loadUserProfileLink(authState.user?.id)
        if (!active) return
        setLinkedPlayerId(profileResult.data?.linked_player_id || '')
      } catch {
        if (!active) return
        setRole('public')
        setEntitlements(null)
        setLinkedPlayerId('')
      }
    }

    void loadAuth()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (
        event.key === '/' &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault()
        searchInputRef.current?.focus()
      } else if (event.key === 'Escape') {
        setSearch('')
        setSortBy('overall')
        setFlightFilter('all')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nextSearch = params.get('q')?.trim() || ''
    const nextFlight = params.get('flight')?.trim() as FlightFilter | undefined

    setSearch(nextSearch)
    setFlightFilter(
      nextFlight === '2.5' ||
        nextFlight === '3.0' ||
        nextFlight === '3.5' ||
        nextFlight === '4.0' ||
        nextFlight === '4.5+' ||
        nextFlight === 'all'
        ? nextFlight
        : 'all',
    )
  }, [])

  async function loadPlayers() {
    setLoading(true)
    setError('')

    try {
      const { data: playerRows, error: playersError } = await supabase
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
        .order('name', { ascending: true })

      if (playersError) throw new Error(playersError.message)

      const typedPlayers = (playerRows || []) as PlayerRow[]
      const playerIds = typedPlayers.map((player) => player.id)
      const matchCounts = new Map<string, number>()
      const snapshotsByPlayer = new Map<string, SnapshotRow[]>()

      if (playerIds.length > 0) {
        const { data: matchPlayerRows, error: matchPlayersError } = await supabase
          .from('match_players')
          .select(`
            player_id,
            match_id,
            matches (
              match_type,
              winner_side,
              score
            )
          `)
          .in('player_id', playerIds)

        if (matchPlayersError) throw new Error(matchPlayersError.message)

        const uniqueMatchesByPlayer = new Map<string, Set<string>>()

        for (const row of ((matchPlayerRows || []) as MatchPlayerCountRow[])) {
          const playerId = String(row.player_id)
          const matchId = String(row.match_id || '')
          if (!matchId) continue
          if (!row.matches?.match_type) continue
          if (!row.matches?.winner_side && !cleanText(row.matches?.score)) continue

          const existing = uniqueMatchesByPlayer.get(playerId) ?? new Set<string>()
          existing.add(matchId)
          uniqueMatchesByPlayer.set(playerId, existing)
        }

        for (const [playerId, matchIds] of uniqueMatchesByPlayer.entries()) {
          matchCounts.set(playerId, matchIds.size)
        }

        const { data: snapshotRows, error: snapshotError } = await supabase
          .from('rating_snapshots')
          .select(`
            player_id,
            rating_type,
            dynamic_rating,
            snapshot_date
          `)
          .in('player_id', playerIds)
          .order('snapshot_date', { ascending: true })

        if (snapshotError) throw new Error(snapshotError.message)

        for (const row of (snapshotRows || []) as SnapshotRow[]) {
          const key = `${row.player_id}:${row.rating_type || 'overall'}`
          const existing = snapshotsByPlayer.get(key) ?? []
          existing.push(row)
          snapshotsByPlayer.set(key, existing)
        }
      }

      setPlayers(
        typedPlayers.map((player) => {
          const matches = matchCounts.get(player.id) || 0
          const baseOverall = getBaseRating(player, 'overall')
          const baseSingles = getBaseRating(player, 'singles')
          const baseDoubles = getBaseRating(player, 'doubles')
          const overallDynamic = getRating(player, 'overall')
          const overallUstaDynamic = getUstaDynamicRating(player, 'overall')
          const overallSnapshots = snapshotsByPlayer.get(`${player.id}:overall`) ?? []
          const overallTrend = getTrendDirection(overallSnapshots)
          const overallTrendDelta = getRecentTrendDelta(overallSnapshots)
          const overallStatus = getRatingStatus(baseOverall, overallUstaDynamic)
          const confidence = getConfidence(matches)
          const overallDiff = roundToTwo(overallDynamic - baseOverall)

          return {
            ...player,
            matches,
            baseOverall,
            baseSingles,
            baseDoubles,
            overallStatus,
            overallTrend,
            overallTrendDelta,
            confidence,
            overallDiff,
          }
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load players')
    } finally {
      setLoading(false)
    }
  }

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase()

    let next = players.filter((player) => {
      const matchesSearch =
        !q ||
        player.name.toLowerCase().includes(q) ||
        (player.location || '').toLowerCase().includes(q)

      if (!matchesSearch) return false

      if (filterBy === 'with-matches') return player.matches > 0
      if (filterBy === 'high-rated') return getRating(player, 'overall') >= 4.0
      if (filterBy === 'trending-up') return player.overallStatus === 'Trending Up' || player.overallStatus === 'Bump Up Pace'
      if (filterBy === 'at-risk') return player.overallStatus === 'At Risk' || player.overallStatus === 'Drop Watch'

      if (flightFilter !== 'all') {
        const base = player.baseOverall
        if (flightFilter === '2.5' && !(base >= 2.0 && base < 2.75)) return false
        if (flightFilter === '3.0' && !(base >= 2.75 && base < 3.25)) return false
        if (flightFilter === '3.5' && !(base >= 3.25 && base < 3.75)) return false
        if (flightFilter === '4.0' && !(base >= 3.75 && base < 4.25)) return false
        if (flightFilter === '4.5+' && !(base >= 4.25)) return false
      }

      return true
    })

    next = [...next].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      return getRating(b, sortBy) - getRating(a, sortBy)
    })

    return next
  }, [filterBy, flightFilter, players, search, sortBy])
  const hasActiveFilters = search.trim().length > 0 || filterBy !== 'all' || sortBy !== 'overall' || flightFilter !== 'all'
  const playersWithMatches = useMemo(() => players.filter((player) => player.matches > 0).length, [players])
  const trendingPlayers = useMemo(
    () => players.filter((player) => player.overallStatus === 'Trending Up' || player.overallStatus === 'Bump Up Pace').length,
    [players],
  )
  const highRatedPlayers = useMemo(() => players.filter((player) => getRating(player, 'overall') >= 4).length, [players])

  const dynamicHeroWrap: CSSProperties = {
    ...heroWrap,
    padding: isMobile ? '12px 16px 18px' : '8px 18px 18px',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '24px 18px 20px' : '28px 28px 22px',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
    gridTemplateColumns: isTablet
      ? '1fr'
      : 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
    gap: isMobile ? '18px' : '22px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '44px' : '54px',
    lineHeight: isMobile ? 1.04 : 0.98,
    maxWidth: '520px',
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
    maxWidth: '520px',
  }

  const dynamicControlsShell: CSSProperties = {
    ...controlsShell,
    padding: isMobile ? '16px' : '18px',
    boxShadow: searchFocused
      ? '0 20px 44px rgba(7,24,53,0.18), 0 0 0 2px rgba(72,161,255,0.18)'
      : controlsShell.boxShadow,
    position: isTablet ? 'relative' : 'sticky',
    top: isTablet ? 'auto' : '24px',
  }

  const dynamicControlsTopRow: CSSProperties = {
    ...controlsTopRow,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'flex-start' : 'center',
  }

  const dynamicControlsRow: CSSProperties = {
    ...controlsRow,
    flexDirection: isTablet ? 'column' : 'row',
    alignItems: isTablet ? 'stretch' : 'center',
  }

  const dynamicSearchInputWrap: CSSProperties = {
    ...searchInputWrap,
    width: '100%',
    minWidth: 0,
  }

  const dynamicSearchInput: CSSProperties = {
    ...searchInput,
    boxShadow: searchFocused ? '0 0 0 2px rgba(64,145,255,0.18)' : 'none',
  }

  const dynamicSelectStyle: CSSProperties = {
    ...selectStyle,
    width: isTablet ? '100%' : 'auto',
    minWidth: isTablet ? 0 : '150px',
  }

  const dynamicSortSelect: CSSProperties = {
    ...dynamicSelectStyle,
    borderColor: sortBy !== 'overall' ? 'rgba(155,225,29,0.42)' : undefined,
    boxShadow: sortBy !== 'overall' ? '0 0 0 1px rgba(155,225,29,0.12)' : undefined,
  }

  const dynamicFilterSelect: CSSProperties = {
    ...dynamicSelectStyle,
    borderColor: filterBy !== 'all' ? 'rgba(155,225,29,0.42)' : undefined,
    boxShadow: filterBy !== 'all' ? '0 0 0 1px rgba(155,225,29,0.12)' : undefined,
  }

  const dynamicFlightSelect: CSSProperties = {
    ...dynamicSelectStyle,
    borderColor: flightFilter !== 'all' ? 'rgba(155,225,29,0.42)' : undefined,
    boxShadow: flightFilter !== 'all' ? '0 0 0 1px rgba(155,225,29,0.12)' : undefined,
  }

  const dynamicHeroStatsGrid: CSSProperties = {
    ...heroStatsGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicSectionHeader: CSSProperties = {
    ...sectionHeader,
    alignItems: isMobile ? 'flex-start' : 'flex-end',
  }

  const dynamicCardGrid: CSSProperties = {
    ...cardGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isTablet
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicRatingRow: CSSProperties = {
    ...ratingRow,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicQuickFilterGrid: CSSProperties = {
    ...quickFilterGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }

  return (
    <SiteShell active="players">
      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div style={heroNoise} />

          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>Players</div>

              <h1 style={dynamicHeroTitle}>
                Find a player fast.
              </h1>

              <p style={dynamicHeroText}>
                Search by name or location. Open a profile when you want ratings, teams, history, or matchup prep.
              </p>

              <div style={heroHintRow}>
                <span style={heroHintPill}>Search</span>
                <span style={heroHintPill}>Open profile</span>
                <span style={heroHintPill}>Prep with Matchup</span>
              </div>

              {!access.canUseAdvancedPlayerInsights ? (
                <div style={{ marginTop: 18, maxWidth: 560 }}>
                  <UpgradePrompt
                    planId="player_plus"
                    compact
                    headline="Want smarter match prep?"
                    body="Unlock Matchup and My Lab with Player so you can compare players before you play and follow the tennis you care about."
                    ctaLabel="Upgrade to Player"
                    ctaHref="/pricing"
                    secondaryLabel="See Player value"
                    secondaryHref="/pricing"
                    footnote="Best for serious players who want clearer prep before the match starts."
                  />
                </div>
              ) : null}
            </div>

            <div style={heroRight}>
              <div style={dynamicControlsShell}>
                <div style={dynamicControlsTopRow}>
                  <div style={controlsLabel}>Find a player</div>
                  {!isTablet ? <div style={controlsHint}>Search first, filter if needed</div> : null}
                </div>

                <div style={dynamicControlsRow}>
                  <div style={dynamicSearchInputWrap}>
                    <div style={searchIconWrap}>
                      <SearchIcon />
                    </div>
                    <input
                      id="players-directory-search"
                      aria-label="Search players by name or location"
                      aria-describedby="players-directory-helper"
                      ref={searchInputRef}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setSearchFocused(false)}
                      placeholder="Search player name or location..."
                      style={dynamicSearchInput}
                    />
                  </div>

                  <select
                    id="players-directory-sort"
                    aria-label="Sort player directory"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    style={dynamicSortSelect}
                  >
                    <option value="overall">Sort: Overall</option>
                    <option value="singles">Sort: Singles</option>
                    <option value="doubles">Sort: Doubles</option>
                    <option value="name">Sort: Name</option>
                  </select>

                  <select
                    id="players-directory-filter"
                    aria-label="Filter player directory"
                    value={filterBy}
                    onChange={(e) => setFilterBy(e.target.value as FilterKey)}
                    style={dynamicFilterSelect}
                  >
                    <option value="all">All players</option>
                    <option value="with-matches">With matches</option>
                    <option value="high-rated">4.0+ overall</option>
                    <option value="trending-up">Trending up</option>
                    <option value="at-risk">At risk</option>
                  </select>

                  <select
                    id="players-directory-flight"
                    aria-label="Filter by league flight / NTRP level"
                    value={flightFilter}
                    onChange={(e) => setFlightFilter(e.target.value as FlightFilter)}
                    style={dynamicFlightSelect}
                  >
                    <option value="all">All levels</option>
                    <option value="2.5">2.5</option>
                    <option value="3.0">3.0</option>
                    <option value="3.5">3.5</option>
                    <option value="4.0">4.0</option>
                    <option value="4.5+">4.5+</option>
                  </select>
                </div>

                <div id="players-directory-helper" style={controlsHelperText}>
                  Start with a name. Use filters only when the list is too wide.
                </div>
                <div style={dynamicQuickFilterGrid} aria-label="Quick player filters">
                  <button
                    type="button"
                    onClick={() => setFilterBy('with-matches')}
                    style={{
                      ...quickFilterButton,
                      ...(filterBy === 'with-matches' ? quickFilterButtonActive : null),
                    }}
                  >
                    <span>Match data</span>
                    <strong>{playersWithMatches}</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterBy('trending-up')}
                    style={{
                      ...quickFilterButton,
                      ...(filterBy === 'trending-up' ? quickFilterButtonActive : null),
                    }}
                  >
                    <span>Trending</span>
                    <strong>{trendingPlayers}</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterBy('high-rated')}
                    style={{
                      ...quickFilterButton,
                      ...(filterBy === 'high-rated' ? quickFilterButtonActive : null),
                    }}
                  >
                    <span>4.0+</span>
                    <strong>{highRatedPlayers}</strong>
                  </button>
                </div>
                {hasActiveFilters ? (
                  <div style={controlsActionRow}>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('')
                        setSortBy('overall')
                        setFilterBy('all')
                        setFlightFilter('all')
                      }}
                      style={clearFilterButton}
                    >
                      Reset directory filters
                    </button>
                  </div>
                ) : null}
              </div>

              <div style={summaryCard}>
                <div style={summaryTitle}>Directory</div>

                <div style={dynamicHeroStatsGrid}>
                  <StatChip label="Players" value={String(players.length)} />
                  <StatChip label="Showing" value={String(filteredPlayers.length)} accent />
                </div>

                <div style={summaryFooterWrap}>
                  <div style={summaryHint}>
                    Search here, open a profile, then use My Lab or Matchup when you need deeper prep.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
      <section style={errorCard}>
          <div style={sectionKicker}>Players</div>
          <h2 style={sectionTitle}>Unable to load players</h2>
          <p style={sectionText}>{error}</p>
          <div style={controlsActionRow}>
            <button type="button" onClick={() => void loadPlayers()} style={clearFilterButton}>
              Retry player directory
            </button>
          </div>
        </section>
      ) : null}

      <section style={contentWrap}>
        <div style={dynamicSectionHeader}>
          <div>
            <div style={sectionKicker}>Directory</div>
            <h2 style={sectionTitle}>Open a player profile</h2>
          </div>
          <div style={exploreNavLinks}>
            <Link href="/explore/rankings" style={secondaryLink}>
              Rankings
            </Link>
            <Link href="/explore/leagues" style={secondaryLink}>
              Leagues
            </Link>
            <Link href="/mylab" style={secondaryLink}>
              My Lab
            </Link>
          </div>
        </div>

        {loading ? (
          <div style={loadingCard}>
            <div style={sectionKicker}>Directory loading</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, color: '#f8fbff' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: '2px solid rgba(155,225,29,0.2)',
                  borderTopColor: '#9be11d',
                  animation: 'tenaceiq-spin 0.7s linear infinite',
                }}
              />
              Loading player directory...
            </div>
            <p style={emptyStateText}>
              Building a cleaner scouting board from current player, rating, and match data.
            </p>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div style={loadingCard}>
            <div style={sectionKicker}>Directory reset</div>
            <div style={emptyStateTitle}>No players matched the current directory view.</div>
            <p style={emptyStateText}>
              Try a broader name or location search, or reset the sort and filter controls to reopen the full player board.
            </p>
          </div>
        ) : (
          <div style={dynamicCardGrid}>
            {filteredPlayers.map((player) => {
              const isHovered = hoveredCard === player.id
              const theme = getMeterTheme(player.overallStatus)
              const compareHref = buildCompareHref(linkedPlayerId, player.id)
              const canCompareAgainstMe = Boolean(access.canUseAdvancedPlayerInsights && linkedPlayerId && linkedPlayerId !== player.id)

              return (
                <article
                  key={player.id}
                  style={{
                    ...playerCard,
                    ...(isHovered ? playerCardHover : {}),
                  }}
                  onMouseEnter={() => setHoveredCard(player.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div style={cardAccentGlow} />

                  <div style={playerCardTopRow}>
                    <div style={miniKicker}>
                      <TiqFeatureIcon name="playerRatings" size="sm" variant="ghost" />
                      <span>Player</span>
                    </div>
                    <div style={matchCountPill}>{player.matches} matches</div>
                  </div>

                  <Link href={`/players/${player.id}`} style={playerNameLink}>
                    {player.name}
                  </Link>
                  <div style={playerLocation}>{player.location || 'Location not set'}</div>

                  <div style={followButtonWrap}>
                    <FollowButton
                      entityType="player"
                      entityId={player.id}
                      entityName={player.name}
                      subtitle={player.location || ''}
                    />
                  </div>

                  <div style={signalRow}>
                    <span
                      style={{
                        ...signalStatusPill,
                        background: theme.pillBackground,
                        color: theme.pillColor,
                        border: `1px solid ${theme.pillBorder}`,
                      }}
                    >
                      {player.overallStatus}
                    </span>

                    <span
                      style={{
                        ...signalTrendPill,
                        background: theme.trendBackground,
                        color: theme.trendColor,
                        border: `1px solid ${theme.trendBorder}`,
                      }}
                    >
                      {getTrendIcon(player.overallTrend)} {getTrendShortLabel(player.overallTrend)}{' '}
                      {player.overallTrendDelta >= 0 ? '+' : ''}
                      {player.overallTrendDelta.toFixed(2)}
                    </span>

                    <span style={signalConfidencePill}>{player.confidence}</span>
                  </div>

                  <div style={dynamicRatingRow}>
                    <RatingPill label="TIQ Overall" value={getRating(player, 'overall')} accent />
                    <RatingPill label="TIQ Singles" value={getRating(player, 'singles')} />
                    <RatingPill label="TIQ Doubles" value={getRating(player, 'doubles')} />
                  </div>

                  <div style={deltaRow}>
                    <div style={deltaStat}>
                      <span style={deltaLabel}>USTA</span>
                      <span style={deltaValue}>{player.baseOverall.toFixed(2)}</span>
                    </div>
                    <div style={deltaStat}>
                      <span style={deltaLabel}>TIQ vs USTA</span>
                      <span style={deltaValue}>
                        {player.overallDiff >= 0 ? '+' : ''}
                        {player.overallDiff.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div style={playerCardFooter}>
                    <Link href={`/players/${player.id}`} style={profileLinkText}>
                      Open profile
                    </Link>
                    <Link href={compareHref} style={compareLinkText}>
                      {canCompareAgainstMe ? 'Compare vs me' : 'Open Matchup'}
                    </Link>
                    <span style={arrowText}>→</span>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
      <div style={{ marginTop: 12 }}>
        <AdsenseSlot slot={PLAYERS_INLINE_AD_SLOT} label="Sponsored" minHeight={250} />
      </div>
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
        ...statChip,
        ...(accent ? statChipAccent : {}),
      }}
    >
      <div style={statChipLabel}>{label}</div>
      <div style={statChipValue}>{value}</div>
    </div>
  )
}

function RatingPill({
  label,
  value,
  accent = false,
}: {
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div
      style={{
        ...ratingPill,
        ...(accent ? ratingPillAccent : {}),
      }}
    >
      <div style={ratingPillLabel}>{label}</div>
      <div style={ratingPillValue}>{formatRating(value)}</div>
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

function buildCompareHref(linkedPlayerId: string, scoutPlayerId: string) {
  const params = new URLSearchParams({ type: 'singles' })
  if (linkedPlayerId && linkedPlayerId !== scoutPlayerId) {
    params.set('playerA', linkedPlayerId)
    params.set('playerB', scoutPlayerId)
  } else {
    params.set('playerB', scoutPlayerId)
  }
  return `/matchup?${params.toString()}`
}

function getRating(player: PlayerRow, view: Exclude<SortKey, 'name'>) {
  return getTiqRating(player, view)
}

function getBaseRating(player: PlayerRow, view: RatingView) {
  return getUstaRating(player, view)
}

function toNumber(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100
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

function getRatingStatus(base: number, dynamic: number): RatingStatus {
  const diff = dynamic - base

  if (diff >= 0.15) return 'Bump Up Pace'
  if (diff >= 0.07) return 'Trending Up'
  if (diff > -0.07) return 'Holding'
  if (diff > -0.15) return 'At Risk'
  return 'Drop Watch'
}

function getConfidence(matches: number): ConfidenceLevel {
  if (matches < 5) return 'Low'
  if (matches < 10) return 'Medium'
  return 'High'
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
  color: 'var(--foreground-strong)',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
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

const controlsShell: CSSProperties = {
  borderRadius: '24px',
  background: 'var(--shell-panel-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
  zIndex: 3,
}

const controlsTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '12px',
  alignItems: 'center',
}

const controlsLabel: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '15px',
  fontWeight: 800,
  letterSpacing: '-0.02em',
}

const controlsHint: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

const controlsRow: CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
  minWidth: 0,
}

const searchInputWrap: CSSProperties = {
  position: 'relative',
  flex: 1,
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
}

const selectStyle: CSSProperties = {
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
}

const controlsHelperText: CSSProperties = {
  marginTop: '12px',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.6,
}

const controlsActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '12px',
}

const quickFilterGrid: CSSProperties = {
  display: 'grid',
  gap: '10px',
  marginTop: '12px',
}

const quickFilterButton: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  minHeight: '48px',
  padding: '0 12px',
  borderRadius: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 900,
  cursor: 'pointer',
}

const quickFilterButtonActive: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-lime) 36%, var(--shell-panel-border) 64%)',
  background: 'color-mix(in srgb, var(--brand-lime) 14%, var(--shell-chip-bg) 86%)',
  color: 'var(--foreground-strong)',
}

const clearFilterButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '38px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 800,
  cursor: 'pointer',
}

const summaryCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const summaryTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: '-0.03em',
  marginBottom: '14px',
}

const heroStatsGrid: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const statChip: CSSProperties = {
  borderRadius: '18px',
  padding: '12px 12px 11px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  minWidth: 0,
}

const statChipAccent: CSSProperties = {
  background: 'color-mix(in srgb, var(--brand-lime) 16%, var(--shell-chip-bg) 84%)',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)',
}

const statChipLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '6px',
}

const statChipValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '20px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const summaryFooterWrap: CSSProperties = {
  display: 'grid',
  gap: '14px',
  marginTop: '14px',
}

const summaryInlineStat: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '14px 16px',
  borderRadius: '20px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
}

const summaryInlineLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontWeight: 700,
  fontSize: '14px',
}

const summaryInlineValue: CSSProperties = {
  background: 'linear-gradient(135deg, #9af2bd, #4ade80 55%, #22c55e)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 900,
  fontSize: '22px',
  letterSpacing: '-0.04em',
}

const summaryHint: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.6,
  fontSize: '14px',
}

const errorCard: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1280px',
  margin: '0 auto 18px',
  padding: '22px',
  borderRadius: '28px',
  border: '1px solid rgba(255,100,100,0.2)',
  background: 'rgba(62,16,22,0.78)',
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '0 18px 0',
}

const editorialPanel: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '24px',
  borderRadius: '26px',
  background: 'var(--shell-panel-bg)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'var(--shadow-soft)',
  marginBottom: '18px',
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

const sectionHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
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

const sectionTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '30px',
  letterSpacing: '-0.04em',
}

const sectionText: CSSProperties = {
  margin: '10px 0 0',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.6,
}

const secondaryLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '48px',
  padding: '0 18px',
  borderRadius: '999px',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 30%, var(--shell-panel-border) 70%)',
  background: 'linear-gradient(135deg, var(--brand-lime), #4ade80 90%)',
  color: 'var(--text-dark)',
  textDecoration: 'none',
  fontWeight: 900,
  boxShadow: '0 14px 34px rgba(45, 196, 106, 0.24), inset 0 1px 0 rgba(255,255,255,0.26)',
}

const exploreNavLinks: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  justifyContent: 'flex-end',
}

const loadingCard: CSSProperties = {
  padding: '26px',
  borderRadius: '28px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  color: 'var(--foreground)',
  fontWeight: 700,
}

const emptyStateTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.2,
}

const emptyStateText: CSSProperties = {
  margin: '10px 0 0',
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.65,
  fontWeight: 500,
}

const cardGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const playerCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  textDecoration: 'none',
  borderRadius: '28px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: '20px',
  boxShadow: 'var(--shadow-soft)',
  transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
}

const playerCardHover: CSSProperties = {
  transform: 'translateY(-3px)',
  boxShadow: 'var(--shadow-card)',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 20%, var(--shell-panel-border) 80%)',
}

const cardAccentGlow: CSSProperties = {
  position: 'absolute',
  top: '-70px',
  right: '-50px',
  width: '180px',
  height: '180px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(78,178,255,0.24), rgba(78,178,255,0) 70%)',
  pointerEvents: 'none',
}

const playerCardTopRow: CSSProperties = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '14px',
}

const miniKicker: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const matchCountPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontSize: '12px',
  fontWeight: 800,
  border: '1px solid var(--shell-panel-border)',
}

const playerName: CSSProperties = {
  position: 'relative',
  color: 'var(--foreground-strong)',
  fontSize: '28px',
  fontWeight: 900,
  letterSpacing: '-0.04em',
  lineHeight: 1.05,
  marginBottom: '8px',
}

const playerNameLink: CSSProperties = {
  ...playerName,
  display: 'block',
  textDecoration: 'none',
}

const playerLocation: CSSProperties = {
  position: 'relative',
  color: 'var(--shell-copy-muted)',
  fontSize: '15px',
  fontWeight: 700,
  marginBottom: '16px',
}

const ratingRow: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: '10px',
}

const ratingPill: CSSProperties = {
  borderRadius: '18px',
  padding: '12px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const ratingPillAccent: CSSProperties = {
  background: 'color-mix(in srgb, var(--brand-lime) 16%, var(--shell-chip-bg) 84%)',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 26%, var(--shell-panel-border) 74%)',
  boxShadow: 'var(--shadow-soft)',
}

const ratingPillLabel: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 700,
  marginBottom: '6px',
}

const ratingPillValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '24px',
  fontWeight: 900,
  letterSpacing: '-0.04em',
  lineHeight: 1,
}

const playerCardFooter: CSSProperties = {
  position: 'relative',
  marginTop: '18px',
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  color: '#dfe9fb',
  gap: '12px',
}

const profileLinkText: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, rgba(103, 241, 154, 1), rgba(40, 205, 110, 0.94))',
  color: '#071622',
  fontWeight: 900,
  fontSize: '13px',
  letterSpacing: '0.01em',
  boxShadow: '0 12px 30px rgba(43, 195, 104, 0.20), inset 0 1px 0 rgba(255,255,255,0.26)',
}

const arrowText: CSSProperties = {
  display: 'none',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  borderRadius: '999px',
  background: 'rgba(91, 233, 146, 0.12)',
  border: '1px solid rgba(109, 239, 171, 0.18)',
  color: '#9df0bf',
  fontWeight: 900,
  fontSize: '18px',
}

const compareLinkText: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '999px',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  border: '1px solid var(--shell-panel-border)',
  fontWeight: 900,
  fontSize: '13px',
  textDecoration: 'none',
}

const iconSvgStyle: CSSProperties = {
  width: '22px',
  height: '22px',
}

const followButtonWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  marginBottom: '16px',
  display: 'flex',
  alignItems: 'center',
}

const signalRow: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '14px',
  zIndex: 2,
}

const signalStatusPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const signalTrendPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 800,
  whiteSpace: 'nowrap',
}

const signalConfidencePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.08)',
  color: '#e2efff',
  border: '1px solid rgba(255,255,255,0.10)',
  fontSize: '11px',
  fontWeight: 800,
}

const deltaRow: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
  marginTop: '12px',
  zIndex: 2,
}

const deltaStat: CSSProperties = {
  borderRadius: '16px',
  padding: '10px 12px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.05)',
  minWidth: 0,
}

const deltaLabel: CSSProperties = {
  display: 'block',
  color: 'rgba(224,234,247,0.68)',
  fontSize: '11px',
  fontWeight: 700,
  marginBottom: '6px',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const deltaValue: CSSProperties = {
  display: 'block',
  color: '#f8fbff',
  fontSize: '18px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}
