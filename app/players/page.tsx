'use client'

import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import AdsenseSlot from '@/app/components/adsense-slot'
import DataTrustPanel from '@/app/components/data-trust-panel'
import FollowButton from '@/app/components/follow-button'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import TiqDirectoryFallbackCard from '@/app/components/tiq-directory-fallback-card'
import TiqTrustStrip from '@/app/components/tiq-trust-strip'
import { shouldShowSponsoredPlacements } from '@/lib/access-model'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'
import { getTiqRating, getUstaRating, getUstaDynamicRating } from '@/lib/player-rating-display'
import { cleanText, formatRating } from '@/lib/captain-formatters'
import { useProductAccess } from '@/lib/use-product-access'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { loadUserProfileLink } from '@/lib/user-profile'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import { DATA_ASSIST_STORY } from '@/lib/product-story'
import { loadRecentTiqAwards, type TiqAwardRecord } from '@/lib/tiq-awards-registry'
import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'

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
  rating_source?: string | null
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
  awards: TiqAwardRecord[]
}

const DIRECTORY_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('relentless-competitor-4-0')
const DIRECTORY_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(DIRECTORY_PLAYER_IDENTITY)
const DIRECTORY_LEVEL_UP_HREF = `/level-up/${DIRECTORY_PLAYER_IDENTITY.slug}#level-up-flow`
const DIRECTORY_PLAYER_DEVELOPMENT_HREF = `/player-development/${DIRECTORY_PLAYER_IDENTITY.slug}`

const PLAYERS_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_PLAYERS_INLINE || null
const PLAYER_DIRECTORY_SELECT_BASE = `
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
const PLAYER_DIRECTORY_SELECT_WITH_SOURCE = `
  ${PLAYER_DIRECTORY_SELECT_BASE},
  rating_source
`

function isMissingRatingSourceError(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('rating_source') || normalized.includes('schema cache') || normalized.includes('column')
}

async function loadPlayerDirectoryRows(): Promise<PlayerRow[]> {
  const withSource = await supabase
    .from('players')
    .select(PLAYER_DIRECTORY_SELECT_WITH_SOURCE)
    .order('name', { ascending: true })

  if (!withSource.error) return (withSource.data || []) as PlayerRow[]
  if (!isMissingRatingSourceError(withSource.error.message)) throw new Error(withSource.error.message)

  const base = await supabase
    .from('players')
    .select(PLAYER_DIRECTORY_SELECT_BASE)
    .order('name', { ascending: true })

  if (base.error) throw new Error(base.error.message)
  return ((base.data || []) as PlayerRow[]).map((player) => ({ ...player, rating_source: null }))
}

function isSelfRatedPlayer(player: Pick<PlayerRow, 'rating_source'>) {
  return player.rating_source === 'self'
}

function formatPublicRating(value: number | null | undefined, player: Pick<PlayerRow, 'rating_source'>) {
  const formatted = formatRating(value)
  return isSelfRatedPlayer(player) && value != null ? `${formatted} S` : formatted
}

export default function PlayersPage() {
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
  const [focusedDirectoryControl, setFocusedDirectoryControl] = useState<string | null>(null)
  const [browseAll, setBrowseAll] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const { access, user, authResolved } = useProductAccess()
  const shouldShowAds = authResolved && shouldShowSponsoredPlacements(access)

  useEffect(() => {
    void loadPlayers()
  }, [])

  useEffect(() => {
    let active = true
    const userId = user?.id || null

    async function loadProfileLink() {
      if (!userId) {
        setLinkedPlayerId('')
        return
      }

      try {
        const profileResult = await loadUserProfileLink(userId)
        if (!active) return
        setLinkedPlayerId(profileResult.data?.linked_player_id || '')
      } catch {
        if (!active) return
        setLinkedPlayerId('')
      }
    }

    void loadProfileLink()

    return () => {
      active = false
    }
  }, [user?.id])

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
        setFilterBy('all')
        setFlightFilter('all')
        setBrowseAll(false)
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
    setBrowseAll(Boolean(nextSearch || (nextFlight && nextFlight !== 'all')))
  }, [])

  async function loadPlayers() {
    setLoading(true)
    setError('')

    try {
      const typedPlayers = await loadPlayerDirectoryRows()
      const playerIds = typedPlayers.map((player) => player.id)
      const matchCounts = new Map<string, number>()
      const snapshotsByPlayer = new Map<string, SnapshotRow[]>()
      const awardsByPlayerId = new Map<string, TiqAwardRecord[]>()

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

      const awardsResult = await loadRecentTiqAwards()
      for (const award of awardsResult.data) {
        if (!award.recipientPlayerId) continue
        const existing = awardsByPlayerId.get(award.recipientPlayerId) ?? []
        existing.push(award)
        awardsByPlayerId.set(award.recipientPlayerId, existing)
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
            awards: (awardsByPlayerId.get(player.id) || []).slice(0, 3),
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
  const shouldShowPlayerResults = hasActiveFilters || browseAll
  const visiblePlayers = shouldShowPlayerResults ? filteredPlayers : []
  const playersWithMatches = useMemo(() => players.filter((player) => player.matches > 0).length, [players])
  const trendingPlayers = useMemo(
    () => players.filter((player) => player.overallStatus === 'Trending Up' || player.overallStatus === 'Bump Up Pace').length,
    [players],
  )
  const highRatedPlayers = useMemo(() => players.filter((player) => getRating(player, 'overall') >= 4).length, [players])
  const linkedPlayer = useMemo(
    () => players.find((player) => player.id === linkedPlayerId) || null,
    [linkedPlayerId, players],
  )
  const playerIdLaunchpadSignals = [
    {
      label: 'Find the ID',
      value: shouldShowPlayerResults ? `${visiblePlayers.length} shown` : 'Search first',
      body: 'Search by name, city, team context, or level to open the right player record.',
    },
    {
      label: 'Your anchor',
      value: linkedPlayer?.name || (linkedPlayerId ? 'Linked profile' : 'Set profile'),
      body: linkedPlayerId
        ? 'Use your linked Player ID to compare, follow, and personalize the next tennis step.'
        : 'Set your profile so player discovery can hand off to Matchup and My Lab with you preloaded.',
    },
    {
      label: 'Next move',
      value: 'Profile, Matchup, My Lab',
      body: 'Open the record, compare the matchup, follow the player, or send missing context through Data Assist.',
    },
    {
      label: 'Starter read',
      value: DIRECTORY_PLAYER_IDENTITY_READ.label,
      body: 'No match history yet? Start with a Level Up identity, then let the profile record sharpen the next cue.',
    },
  ] as const
  const playerIdStarterRead = [
    { label: 'Train first', value: DIRECTORY_PLAYER_IDENTITY_READ.trainingPriority },
    { label: 'Proof target', value: DIRECTORY_PLAYER_IDENTITY_READ.proofTarget },
    { label: 'Match test', value: DIRECTORY_PLAYER_IDENTITY_READ.matchTrigger },
  ] as const

  const dynamicControlsShell: CSSProperties = {
    ...controlsShell,
    padding: isMobile ? '16px' : '18px',
    boxShadow: searchFocused
      ? '0 20px 44px rgba(7,24,53,0.18), 0 0 0 2px rgba(72,161,255,0.18)'
      : controlsShell.boxShadow,
    position: 'relative',
    top: 'auto',
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
    ...(searchFocused ? directoryControlFocusStyle : null),
  }

  const dynamicSelectStyle: CSSProperties = {
    ...selectStyle,
    width: isTablet ? '100%' : 'auto',
    minWidth: isTablet ? 0 : '150px',
  }

  const dynamicSelectWrap: CSSProperties = {
    display: 'grid',
    minWidth: isTablet ? 0 : '150px',
    width: isTablet ? '100%' : 'auto',
  }

  const dynamicSortSelect: CSSProperties = {
    ...dynamicSelectStyle,
    borderColor: sortBy !== 'overall' ? 'rgba(155,225,29,0.42)' : undefined,
    boxShadow: sortBy !== 'overall' ? '0 0 0 1px rgba(155,225,29,0.12)' : undefined,
    ...(focusedDirectoryControl === 'sort' ? directoryControlFocusStyle : null),
  }

  const dynamicFilterSelect: CSSProperties = {
    ...dynamicSelectStyle,
    borderColor: filterBy !== 'all' ? 'rgba(155,225,29,0.42)' : undefined,
    boxShadow: filterBy !== 'all' ? '0 0 0 1px rgba(155,225,29,0.12)' : undefined,
    ...(focusedDirectoryControl === 'filter' ? directoryControlFocusStyle : null),
  }

  const dynamicFlightSelect: CSSProperties = {
    ...dynamicSelectStyle,
    borderColor: flightFilter !== 'all' ? 'rgba(155,225,29,0.42)' : undefined,
    boxShadow: flightFilter !== 'all' ? '0 0 0 1px rgba(155,225,29,0.12)' : undefined,
    ...(focusedDirectoryControl === 'flight' ? directoryControlFocusStyle : null),
  }

  const dynamicSectionHeader: CSSProperties = {
    ...sectionHeader,
    alignItems: isMobile ? 'flex-start' : 'flex-end',
  }

  const dynamicCardGrid: CSSProperties = {
    ...cardGrid,
    gridTemplateColumns: isSmallMobile
      ? 'minmax(0, 1fr)'
      : isTablet
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicQuickFilterGrid: CSSProperties = {
    ...quickFilterGrid,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))',
  }

  return (
    <SiteShell active="players">
      <JsonLd id="players-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Players', '/players')} />
      <section style={playerToolWrap}>
        <div style={dynamicControlsShell}>
          <div aria-hidden="true" style={watermarkStyle} />
            <div style={dynamicControlsTopRow}>
              <div style={controlsTitleGroup}>
                <div style={sectionKicker}>Player discovery</div>
              <h1 style={controlsLabel}>Find a player.</h1>
            </div>
            <div style={inlineStatRow}>
              <StatChip label="Players" value={loading ? 'Refreshing' : String(players.length)} />
              <StatChip label="Shown" value={loading ? 'Starter' : shouldShowPlayerResults ? String(filteredPlayers.length) : 'Ready'} accent />
            </div>
          </div>

          <div style={dynamicControlsRow}>
            <div style={dynamicSearchInputWrap}>
              <label htmlFor="players-directory-search" style={srOnlyStyle}>
                Search players by name or location
              </label>
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

            <div style={dynamicSelectWrap}>
              <label htmlFor="players-directory-sort" style={srOnlyStyle}>
                Sort player directory
              </label>
              <select
                id="players-directory-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                onFocus={() => setFocusedDirectoryControl('sort')}
                onBlur={() => setFocusedDirectoryControl(null)}
                style={dynamicSortSelect}
              >
                <option value="overall">Sort: Overall</option>
                <option value="singles">Sort: Singles</option>
                <option value="doubles">Sort: Doubles</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>

            <div style={dynamicSelectWrap}>
              <label htmlFor="players-directory-filter" style={srOnlyStyle}>
                Filter player directory
              </label>
              <select
                id="players-directory-filter"
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterKey)}
                onFocus={() => setFocusedDirectoryControl('filter')}
                onBlur={() => setFocusedDirectoryControl(null)}
                style={dynamicFilterSelect}
              >
                <option value="all">All players</option>
                <option value="with-matches">With matches</option>
                <option value="high-rated">4.0+ overall</option>
                <option value="trending-up">Trending up</option>
                <option value="at-risk">At risk</option>
              </select>
            </div>

            <div style={dynamicSelectWrap}>
              <label htmlFor="players-directory-flight" style={srOnlyStyle}>
                Filter by league flight or NTRP level
              </label>
              <select
                id="players-directory-flight"
                value={flightFilter}
                onChange={(e) => setFlightFilter(e.target.value as FlightFilter)}
                onFocus={() => setFocusedDirectoryControl('flight')}
                onBlur={() => setFocusedDirectoryControl(null)}
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
          </div>

          <div id="players-directory-helper" style={controlsHelperText}>
            Type a name or location.
          </div>
          <div style={dynamicQuickFilterGrid} aria-label="Quick player filters">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setBrowseAll(false)
                setFilterBy('with-matches')
              }}
              style={{
                ...quickFilterButton,
                ...(loading ? quickFilterButtonDisabled : null),
                ...(filterBy === 'with-matches' ? quickFilterButtonActive : null),
              }}
            >
              <span>Match data</span>
              <strong>{loading ? '-' : playersWithMatches}</strong>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setBrowseAll(false)
                setFilterBy('trending-up')
              }}
              style={{
                ...quickFilterButton,
                ...(loading ? quickFilterButtonDisabled : null),
                ...(filterBy === 'trending-up' ? quickFilterButtonActive : null),
              }}
            >
              <span>Trending</span>
              <strong>{loading ? '-' : trendingPlayers}</strong>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setBrowseAll(false)
                setFilterBy('high-rated')
              }}
              style={{
                ...quickFilterButton,
                ...(loading ? quickFilterButtonDisabled : null),
                ...(filterBy === 'high-rated' ? quickFilterButtonActive : null),
              }}
            >
              <span>4.0+</span>
              <strong>{loading ? '-' : highRatedPlayers}</strong>
            </button>
          </div>
          <div style={controlsActionRow}>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setBrowseAll(true)
                setSortBy('overall')
              }}
              style={{
                ...clearFilterButton,
                ...(browseAll ? browseAllButtonActiveStyle : null),
                ...(loading ? quickFilterButtonDisabled : null),
              }}
            >
              Browse directory
            </button>
            {hasActiveFilters || browseAll ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setSortBy('overall')
                  setFilterBy('all')
                  setFlightFilter('all')
                  setBrowseAll(false)
                }}
                style={clearFilterButton}
              >
                Reset directory filters
              </button>
            ) : null}
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
            <div style={sectionKicker}>{shouldShowPlayerResults ? 'Directory' : 'Find'}</div>
            <h2 style={sectionTitle}>{shouldShowPlayerResults ? 'Open a player profile' : 'Choose a path.'}</h2>
          </div>
        </div>

        <section style={playerIdLaunchpadStyle} aria-label="Player ID launchpad">
          <div style={playerIdLaunchpadHeaderStyle}>
            <TiqFeatureIcon name="playerRatings" size="sm" variant="ghost" />
            <div style={playerIdLaunchpadCopyStyle}>
              <span style={playerIdLaunchpadKickerStyle}>Player ID launchpad</span>
              <h2 style={playerIdLaunchpadTitleStyle}>Turn search into a player record.</h2>
            </div>
          </div>
          <div style={playerIdLaunchpadGridStyle}>
            {playerIdLaunchpadSignals.map((signal) => (
              <article key={signal.label} style={playerIdLaunchpadCardStyle}>
                <span style={playerIdLaunchpadLabelStyle}>{signal.label}</span>
                <strong style={playerIdLaunchpadValueStyle}>{signal.value}</strong>
                <span style={playerIdLaunchpadTextStyle}>{signal.body}</span>
              </article>
            ))}
          </div>
          <div style={playerIdStarterReadStyle}>
            <div style={playerIdStarterReadCopyStyle}>
              <span style={playerIdLaunchpadLabelStyle}>Player ID starter path</span>
              <strong style={playerIdLaunchpadValueStyle}>{DIRECTORY_PLAYER_IDENTITY_READ.title}</strong>
              <span style={playerIdLaunchpadTextStyle}>{DIRECTORY_PLAYER_IDENTITY_READ.levelUpNudge}</span>
            </div>
            <div style={playerIdStarterReadGridStyle} aria-label="Player ID starter read">
              {playerIdStarterRead.map((item) => (
                <span key={item.label} style={playerIdStarterReadItemStyle}>
                  <em>{item.label}</em>
                  <b>{item.value}</b>
                </span>
              ))}
            </div>
            <div style={playerIdStarterActionRowStyle}>
              <Link href={DIRECTORY_LEVEL_UP_HREF} style={playerIdStarterPrimaryLinkStyle}>
                Start Level Up
              </Link>
              <Link href={DIRECTORY_PLAYER_DEVELOPMENT_HREF} style={playerIdStarterSecondaryLinkStyle}>
                Read Player ID
              </Link>
            </div>
          </div>
        </section>

        {loading ? (
          <div style={loadingCard}>
            <div style={sectionKicker}>Player discovery</div>
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
              Start with a player search.
            </div>
            <p style={emptyStateText}>
              Try a name, city, team, league, or rating level. The reviewed player layer is refreshing behind this starter view.
            </p>
            <DataTrustPanel
              title="Player data trust"
              signals={[
                { label: 'Source', value: 'Public records, TIQ context, Data Assist' },
                { label: 'Freshness', value: 'Last refresh shown on profiles' },
                { label: 'Confidence', value: 'Based on verified match volume' },
                { label: 'Status', value: 'Corrections reviewable' },
              ]}
            />
            <TiqDirectoryFallbackCard
              eyebrow="Featured player path"
              title="Start with a name, city, or rating band."
              body="A good first search is a player name, a city, or a level like 4.0 doubles. From there, open the profile, compare the matchup, or follow the player into My Lab."
              chips={['Search players', 'Compare matchup', 'Follow profile']}
              actions={[
                { href: '/matchup', label: 'Open Matchup' },
                { href: DATA_ASSIST_STORY.href, label: DATA_ASSIST_STORY.cta },
              ]}
            />
          </div>
        ) : !shouldShowPlayerResults ? (
          <div style={findStartPanelStyle}>
            <div style={findStartGridStyle}>
              <button
                type="button"
                onClick={() => searchInputRef.current?.focus()}
                style={findStartActionStyle}
              >
                <strong>Name or city</strong>
                <span>Jump to search.</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterBy('trending-up')}
                style={findStartActionStyle}
              >
                <strong>Trending</strong>
                <span>Players moving up.</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterBy('high-rated')}
                style={findStartActionStyle}
              >
                <strong>4.0+</strong>
                <span>Stronger ratings.</span>
              </button>
              <button
                type="button"
                onClick={() => setBrowseAll(true)}
                style={findStartActionStyle}
              >
                <strong>Browse</strong>
                <span>Full board.</span>
              </button>
            </div>
          </div>
        ) : visiblePlayers.length === 0 ? (
          <div style={loadingCard}>
            <div style={sectionKicker}>Directory reset</div>
            <div style={emptyStateTitle}>No players matched the current directory view.</div>
            <p style={emptyStateText}>
              Public discovery only shows reviewed player context. Try a broader name or location search, reset the filters, or refresh roster and scorecard context through Data Assist.
            </p>
            <DataTrustPanel
              title="Why a player may be missing"
              body="Player records appear after reviewed match, roster, or profile context is available. Data Assist is the fastest path for scorecards, team summaries, and corrections."
            />
            <div style={emptyStateActionRow}>
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setSortBy('overall')
                  setFilterBy('all')
                  setFlightFilter('all')
                  setBrowseAll(false)
                }}
                style={emptyStateButton}
              >
                Reset filters
              </button>
              <Link href={DATA_ASSIST_STORY.href} style={secondaryLink}>
                {DATA_ASSIST_STORY.cta}
              </Link>
            </div>
          </div>
        ) : (
          <div style={dynamicCardGrid}>
            {visiblePlayers.map((player) => {
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
                  {player.awards.length ? (
                    <div style={playerAwardRowStyle} aria-label={`${player.name} award badges`}>
                      {player.awards.slice(0, 2).map((award) => (
                        <Link
                          key={award.id}
                          href={`/awards/${encodeURIComponent(award.id)}`}
                          style={playerAwardPillStyle}
                          title={`${award.badgeLabel}: ${award.title}`}
                        >
                          <span>{award.badgeCode}</span>
                          <small>{award.sourceType === 'league' ? 'League' : 'Tournament'}</small>
                        </Link>
                      ))}
                      <Link href={`/players/${player.id}#profile-trophy-case`} style={playerAwardCaseLinkStyle}>
                        Trophy case
                      </Link>
                    </div>
                  ) : null}
                  <div style={playerLocation}>{player.location || 'Location not set'}</div>

                  <div style={playerScorecard}>
                    <div style={playerScorePrimary}>
                      <span style={scoreLabel}>TIQ overall</span>
                      <strong style={scoreValue}>{formatPublicRating(getRating(player, 'overall'), player)}</strong>
                    </div>
                    <div style={playerScoreMiniGrid}>
                      <div style={scoreMini}>
                        <span style={scoreMiniLabel}>USTA</span>
                        <strong style={scoreMiniValue}>{isSelfRatedPlayer(player) ? 'Pending' : player.baseOverall.toFixed(2)}</strong>
                      </div>
                      <div style={scoreMini}>
                        <span style={scoreMiniLabel}>Confidence</span>
                        <strong style={scoreMiniValue}>{player.confidence}</strong>
                      </div>
                    </div>
                  </div>

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

                  <TiqTrustStrip
                    label={`${player.name} data trust signals`}
                    signals={[
                      { label: 'Source', value: isSelfRatedPlayer(player) ? 'Self-rated' : 'Reviewed public data', tone: isSelfRatedPlayer(player) ? 'warn' : 'good' },
                      { label: 'Freshness', value: player.matches > 0 ? 'Match context' : 'Profile context', tone: player.matches > 0 ? 'good' : 'warn' },
                      { label: 'Confidence', value: player.confidence, tone: player.confidence === 'High' ? 'good' : player.confidence === 'Medium' ? 'warn' : 'info' },
                      { label: 'Status', value: isSelfRatedPlayer(player) ? 'Needs review' : 'Reviewable', tone: isSelfRatedPlayer(player) ? 'warn' : 'good' },
                    ]}
                    reviewContext={`Player ${player.name}`}
                  />

                  <div style={deltaRow}>
                    <div style={deltaStat}>
                      <span style={deltaLabel}>USTA</span>
                      <span style={deltaValue}>{isSelfRatedPlayer(player) ? 'Pending' : player.baseOverall.toFixed(2)}</span>
                    </div>
                    <div style={deltaStat}>
                      <span style={deltaLabel}>TIQ vs USTA</span>
                      <span style={deltaValue}>
                        {isSelfRatedPlayer(player)
                          ? 'Pending'
                          : `${player.overallDiff >= 0 ? '+' : ''}${player.overallDiff.toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  <div style={playerCardFooter}>
                    <Link
                      href={`/players/${player.id}`}
                      aria-label={`View ${player.name} profile`}
                      style={profileLinkText}
                    >
                      View profile
                    </Link>
                    <Link
                      href={compareHref}
                      aria-label={canCompareAgainstMe ? `Compare ${player.name} against me` : `Open Matchup for ${player.name}`}
                      style={compareLinkText}
                    >
                      {canCompareAgainstMe ? 'Compare vs me' : 'Compare'}
                    </Link>
                    <span style={arrowText}>→</span>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
      {shouldShowAds ? (
        <div style={{ marginTop: 12 }}>
          <AdsenseSlot slot={PLAYERS_INLINE_AD_SLOT} label="Sponsored" minHeight={250} />
        </div>
      ) : null}
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
  if (direction === 'up') return '^'
  if (direction === 'down') return 'v'
  return '->'
}

function getMeterTheme(status: RatingStatus) {
  switch (status) {
    case 'Bump Up Pace':
      return {
        pillBackground: 'color-mix(in srgb, var(--brand-lime) 18%, var(--shell-chip-bg) 82%)',
        pillColor: 'var(--foreground-strong)',
        pillBorder: 'color-mix(in srgb, var(--brand-lime) 34%, var(--shell-panel-border) 66%)',
        trendBackground: 'color-mix(in srgb, var(--brand-lime) 14%, var(--shell-chip-bg) 86%)',
        trendColor: 'var(--foreground-strong)',
        trendBorder: 'color-mix(in srgb, var(--brand-lime) 28%, var(--shell-panel-border) 72%)',
      }
    case 'Trending Up':
      return {
        pillBackground: 'color-mix(in srgb, var(--brand-lime) 16%, var(--shell-chip-bg) 84%)',
        pillColor: 'var(--foreground-strong)',
        pillBorder: 'color-mix(in srgb, var(--brand-lime) 30%, var(--shell-panel-border) 70%)',
        trendBackground: 'color-mix(in srgb, var(--brand-lime) 12%, var(--shell-chip-bg) 88%)',
        trendColor: 'var(--foreground-strong)',
        trendBorder: 'color-mix(in srgb, var(--brand-lime) 26%, var(--shell-panel-border) 74%)',
      }
    case 'Holding':
      return {
        pillBackground: 'color-mix(in srgb, #60a5fa 14%, var(--shell-chip-bg) 86%)',
        pillColor: 'var(--foreground-strong)',
        pillBorder: 'color-mix(in srgb, #60a5fa 30%, var(--shell-panel-border) 70%)',
        trendBackground: 'color-mix(in srgb, #60a5fa 10%, var(--shell-chip-bg) 90%)',
        trendColor: 'var(--foreground-strong)',
        trendBorder: 'color-mix(in srgb, #60a5fa 24%, var(--shell-panel-border) 76%)',
      }
    case 'At Risk':
      return {
        pillBackground: 'color-mix(in srgb, #fb923c 16%, var(--shell-chip-bg) 84%)',
        pillColor: 'var(--foreground-strong)',
        pillBorder: 'color-mix(in srgb, #fb923c 30%, var(--shell-panel-border) 70%)',
        trendBackground: 'color-mix(in srgb, #fb923c 12%, var(--shell-chip-bg) 88%)',
        trendColor: 'var(--foreground-strong)',
        trendBorder: 'color-mix(in srgb, #fb923c 26%, var(--shell-panel-border) 74%)',
      }
    case 'Drop Watch':
      return {
        pillBackground: 'color-mix(in srgb, #ef4444 15%, var(--shell-chip-bg) 85%)',
        pillColor: 'var(--foreground-strong)',
        pillBorder: 'color-mix(in srgb, #ef4444 30%, var(--shell-panel-border) 70%)',
        trendBackground: 'color-mix(in srgb, #ef4444 11%, var(--shell-chip-bg) 89%)',
        trendColor: 'var(--foreground-strong)',
        trendBorder: 'color-mix(in srgb, #ef4444 26%, var(--shell-panel-border) 74%)',
      }
  }
}

const controlsShell: CSSProperties = {
  borderRadius: '26px',
  background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(4,10,24,0.9))',
  border: '1px solid rgba(116,190,255,0.15)',
  boxShadow: '0 30px 86px rgba(2, 8, 23, 0.46), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  zIndex: 3,
  position: 'relative',
  overflow: 'hidden',
}

const controlsTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '12px',
  alignItems: 'center',
}

const controlsLabel: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.25rem, 2.4vw, 1.9rem)',
  fontWeight: 950,
  lineHeight: 1,
  letterSpacing: 0,
}

const controlsTitleGroup: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
}

const controlsRow: CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
  minWidth: 0,
}

const inlineStatRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(96px, 1fr))',
  gap: 10,
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
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  padding: '15px 16px 15px 46px',
  fontSize: '15px',
  outline: '2px solid transparent',
  outlineOffset: 2,
  boxShadow: 'var(--home-control-shadow)',
}

const selectStyle: CSSProperties = {
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
}

const directoryControlFocusStyle: CSSProperties = {
  borderColor: 'color-mix(in srgb, var(--brand-green) 44%, var(--shell-panel-border) 56%)',
  outline: '2px solid color-mix(in srgb, var(--brand-green) 48%, transparent)',
  boxShadow: '0 0 0 5px rgba(155,225,29,0.12), var(--home-control-shadow)',
}

const srOnlyStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
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
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground)',
  fontWeight: 900,
  cursor: 'pointer',
}

const quickFilterButtonActive: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-lime) 36%, var(--shell-panel-border) 64%)',
  background: 'color-mix(in srgb, var(--brand-lime) 14%, var(--shell-chip-bg) 86%)',
  color: 'var(--foreground-strong)',
}

const quickFilterButtonDisabled: CSSProperties = {
  opacity: 0.62,
  cursor: 'wait',
}

const clearFilterButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '38px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground)',
  fontWeight: 800,
  cursor: 'pointer',
}

const browseAllButtonActiveStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-lime) 36%, var(--shell-panel-border) 64%)',
  background: 'color-mix(in srgb, var(--brand-lime) 14%, var(--shell-chip-bg) 86%)',
  color: 'var(--foreground-strong)',
}

const statChip: CSSProperties = {
  borderRadius: '18px',
  padding: '12px 12px 11px',
  background: 'rgba(8,16,34,0.7)',
  border: '1px solid rgba(116,190,255,0.13)',
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
  letterSpacing: 0,
  marginBottom: '6px',
}

const statChipValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '20px',
  fontWeight: 900,
  letterSpacing: 0,
}

const errorCard: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto 18px',
  padding: '22px',
  borderRadius: '28px',
  border: '1px solid color-mix(in srgb, #f87171 26%, var(--shell-panel-border) 74%)',
  background: 'color-mix(in srgb, #7f1d1d 14%, var(--shell-panel-bg-strong) 86%)',
  boxShadow: 'var(--shadow-soft)',
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  minWidth: 0,
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
  letterSpacing: 0,
  marginBottom: '8px',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '30px',
  letterSpacing: 0,
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
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontWeight: 900,
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
}

const playerIdLaunchpadStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  marginBottom: 16,
  padding: 16,
  borderRadius: 22,
  border: '1px solid color-mix(in srgb, var(--brand-green) 20%, var(--shell-panel-border) 80%)',
  background: 'color-mix(in srgb, var(--brand-green) 7%, rgba(8,16,34,0.78) 93%)',
  overflowWrap: 'anywhere',
}

const playerIdLaunchpadHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  flexWrap: 'wrap',
}

const playerIdLaunchpadCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const playerIdLaunchpadKickerStyle: CSSProperties = {
  color: 'var(--brand-lime)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const playerIdLaunchpadTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: '1rem',
  lineHeight: 1.2,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const playerIdLaunchpadGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const playerIdLaunchpadCardStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.68)',
  overflowWrap: 'anywhere',
}

const playerIdLaunchpadLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  overflowWrap: 'anywhere',
}

const playerIdLaunchpadValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const playerIdLaunchpadTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const playerIdStarterReadStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: 12,
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)',
  background: 'rgba(7,17,33,0.52)',
  overflowWrap: 'anywhere',
}

const playerIdStarterReadCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const playerIdStarterReadGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const playerIdStarterReadItemStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  padding: '8px 9px',
  borderRadius: 12,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.35,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const playerIdStarterActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const playerIdStarterPrimaryLinkStyle: CSSProperties = {
  ...secondaryLink,
  minHeight: 40,
  padding: '0 14px',
  fontSize: 12,
}

const playerIdStarterSecondaryLinkStyle: CSSProperties = {
  ...playerIdStarterPrimaryLinkStyle,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(255,255,255,0.04)',
}

const loadingCard: CSSProperties = {
  padding: '22px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.74)',
  color: 'var(--foreground)',
  fontWeight: 700,
  boxShadow: '0 18px 48px rgba(2,10,24,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
}

const findStartPanelStyle: CSSProperties = {
  ...loadingCard,
  position: 'relative',
  overflow: 'hidden',
  padding: '24px',
  border: '1px solid rgba(155,225,29,0.20)',
  background:
    'linear-gradient(135deg, rgba(155,225,29,0.10), rgba(8,16,34,0.78) 42%, rgba(8,16,34,0.86))',
}

const findStartGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 12,
  minWidth: 0,
  marginTop: 16,
}

const findStartActionStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minHeight: 112,
  padding: 15,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
  minWidth: 0,
  overflowWrap: 'anywhere',
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

const emptyStateActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 14,
  maxWidth: '100%',
}

const emptyStateButton: CSSProperties = {
  ...secondaryLink,
  cursor: 'pointer',
}

const cardGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
  minWidth: 0,
}

const playerCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  textDecoration: 'none',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.74)',
  padding: '20px',
  boxShadow: '0 18px 48px rgba(2,10,24,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
  transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
  minWidth: 0,
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
  width: 'min(100%, 180px)',
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
  flexWrap: 'wrap',
}

const miniKicker: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const matchCountPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground)',
  fontSize: '12px',
  fontWeight: 800,
  border: '1px solid rgba(116,190,255,0.13)',
}

const playerName: CSSProperties = {
  position: 'relative',
  color: 'var(--foreground-strong)',
  fontSize: '28px',
  fontWeight: 900,
  letterSpacing: 0,
  lineHeight: 1.05,
  marginBottom: '8px',
  overflowWrap: 'anywhere',
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

const playerAwardRowStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  display: 'flex',
  flexWrap: 'wrap',
  gap: '7px',
  minWidth: 0,
  margin: '-2px 0 10px',
}

const playerAwardPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  minHeight: '28px',
  maxWidth: '100%',
  padding: '0 9px',
  borderRadius: '999px',
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.10)',
  color: 'var(--foreground-strong)',
  fontSize: '11px',
  fontWeight: 900,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const playerAwardCaseLinkStyle: CSSProperties = {
  ...playerAwardPillStyle,
  border: '1px solid rgba(116,190,255,0.20)',
  background: 'rgba(116,190,255,0.08)',
  color: 'var(--brand-blue-2)',
}

const playerScorecard: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
  gap: '10px',
  marginBottom: '16px',
}

const playerScorePrimary: CSSProperties = {
  display: 'grid',
  alignContent: 'center',
  gap: '6px',
  minHeight: '96px',
  borderRadius: '20px',
  padding: '14px',
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-lime) 18%, var(--shell-chip-bg) 82%), var(--shell-chip-bg))',
  border: '1px solid color-mix(in srgb, var(--brand-lime) 28%, var(--shell-panel-border) 72%)',
  boxShadow: 'var(--shadow-soft)',
}

const scoreLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const scoreValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '34px',
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: 0,
}

const playerScoreMiniGrid: CSSProperties = {
  display: 'grid',
  gap: '10px',
  minWidth: 0,
}

const scoreMini: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  minHeight: '43px',
  borderRadius: '16px',
  padding: '0 12px',
  background: 'rgba(7,17,33,0.72)',
  border: '1px solid rgba(116,190,255,0.13)',
}

const scoreMiniLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const scoreMiniValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '14px',
  fontWeight: 900,
  textAlign: 'right',
}

const playerCardFooter: CSSProperties = {
  position: 'relative',
  marginTop: '18px',
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  color: '#dfe9fb',
  gap: '10px',
  minWidth: 0,
}

const profileLinkText: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '999px',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  fontWeight: 900,
  fontSize: '13px',
  letterSpacing: 0,
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
  textAlign: 'center',
  textDecoration: 'none',
  whiteSpace: 'normal',
  maxWidth: '100%',
}

const arrowText: CSSProperties = {
  display: 'none',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  borderRadius: '999px',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  color: 'var(--brand-lime)',
  fontWeight: 900,
  fontSize: '18px',
}

const compareLinkText: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '999px',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(116,190,255,0.13)',
  fontWeight: 900,
  fontSize: '13px',
  textDecoration: 'none',
  textAlign: 'center',
  whiteSpace: 'normal',
  maxWidth: '100%',
}

const iconSvgStyle: CSSProperties = {
  width: '22px',
  height: '22px',
}

const playerToolWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '12px auto 18px',
  minWidth: 0,
}

const followButtonWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  marginBottom: '16px',
  display: 'flex',
  alignItems: 'center',
  maxWidth: '100%',
  minWidth: 0,
}

const signalRow: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '14px',
  zIndex: 2,
  minWidth: 0,
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
  letterSpacing: 0,
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
  whiteSpace: 'normal',
}

const signalConfidencePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(116,190,255,0.13)',
  fontSize: '11px',
  fontWeight: 800,
}

const deltaRow: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 128px), 1fr))',
  gap: '10px',
  marginTop: '12px',
  zIndex: 2,
}

const deltaStat: CSSProperties = {
  borderRadius: '16px',
  padding: '10px 12px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  minWidth: 0,
}

const deltaLabel: CSSProperties = {
  display: 'block',
  color: 'var(--shell-copy-muted)',
  fontSize: '11px',
  fontWeight: 700,
  marginBottom: '6px',
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const deltaValue: CSSProperties = {
  display: 'block',
  color: 'var(--foreground-strong)',
  fontSize: '18px',
  fontWeight: 900,
  letterSpacing: 0,
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: '-86px',
  top: '-108px',
  width: '340px',
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
  opacity: 0.14,
  pointerEvents: 'none',
}
