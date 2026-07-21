'use client'

import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState, type ReactNode } from 'react'
import AdsenseSlot from '@/app/components/adsense-slot'
import DataTrustPanel from '@/app/components/data-trust-panel'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import TiqTrustStrip from '@/app/components/tiq-trust-strip'
import { TiqWorkspacePreview } from '@/app/components/tiq-product-preview-cards'
import TrackedProductLink from '@/app/components/tracked-product-link'
import { shouldShowSponsoredPlacements } from '@/lib/access-model'
import { supabase } from '@/lib/supabase'
import { encodeTeamRouteSegment } from '@/lib/team-routes'
import { useProductAccess } from '@/lib/use-product-access'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { formatShortDate, uniqueSorted, cleanText, normalizeTeamName } from '@/lib/captain-formatters'
import { DATA_ASSIST_STORY } from '@/lib/product-story'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'
import { loadRecentTiqAwards, type TiqAwardRecord } from '@/lib/tiq-awards-registry'

type MatchRow = {
  id: string
  match_date: string | null
  home_team: string | null
  away_team: string | null
  league_name: string | null
  flight: string | null
  line_number: string | null
  winner_side: 'A' | 'B' | null
  source?: string | null
  status?: string | null
  score?: string | null
}

type MatchPlayerRow = {
  match_id: string
  side: 'A' | 'B' | null
  player_id?: string | null
  players?:
    | {
        id?: string | null
        name?: string | null
      }
    | Array<{
        id?: string | null
        name?: string | null
      }>
    | null
}

type TeamDirectoryEntry = {
  key: string
  team: string
  league: string | null
  flight: string | null
  matchCount: number
  wins: number
  losses: number
  recentForm: Array<'W' | 'L'>
  playerIds: Set<string>
  mostRecentMatchDate: string | null
}

type SortKey = 'team' | 'matches' | 'players' | 'recent' | 'winpct'

const TEAMS_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_TEAMS_INLINE || null
const TEAM_DEFAULT_CARD_LIMIT = 8

function buildTeamKey(team: string, league: string | null, flight: string | null) {
  return `${team}__${league || ''}__${flight || ''}`
}

function buildScopeKey(league: string | null, flight: string | null) {
  return `${(league || '').toLowerCase()}__${(flight || '').toLowerCase()}`
}

function isScheduleLikeMatch(match: MatchRow) {
  return /\bschedule\b/i.test(cleanText(match.source))
}

function compareNullableDatesDesc(left: string | null, right: string | null) {
  if (!left && !right) return 0
  if (!left) return 1
  if (!right) return -1

  const leftTime = new Date(left).getTime()
  const rightTime = new Date(right).getTime()

  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0
  if (Number.isNaN(leftTime)) return 1
  if (Number.isNaN(rightTime)) return -1

  return rightTime - leftTime
}


function chunkArray<T>(rows: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size))
  }
  return chunks
}

export default function TeamsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<TeamDirectoryEntry[]>([])
  const [awardsByTeamName, setAwardsByTeamName] = useState<Record<string, TiqAwardRecord[]>>({})

  const [search, setSearch] = useState('')
  const [leagueFilter, setLeagueFilter] = useState('')
  const [flightFilter, setFlightFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('matches')
  const [browseAll, setBrowseAll] = useState(false)
  const [showAllTeams, setShowAllTeams] = useState(false)
  const [focusedDirectoryControl, setFocusedDirectoryControl] = useState<string | null>(null)

  const { screenWidth, isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const isTinyMobile = screenWidth < 360
  const compactIntroCards = isMobile
  const { access, authResolved } = useProductAccess()
  const shouldShowAds = authResolved && shouldShowSponsoredPlacements(access)

  useEffect(() => {
    void loadTeams()
    void loadTeamAwards()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearch('')
        setLeagueFilter('')
        setFlightFilter('')
        setSortBy('matches')
        setBrowseAll(false)
        setShowAllTeams(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nextSearch = params.get('q')?.trim() || ''
    const nextLeague = params.get('league')?.trim() || ''
    const nextFlight = params.get('flight')?.trim() || ''
    setSearch(nextSearch)
    setLeagueFilter(nextLeague)
    setFlightFilter(nextFlight)
    setBrowseAll(Boolean(nextSearch || nextLeague || nextFlight))
  }, [])

  async function loadTeams() {
    setLoading(true)
    setError('')

    try {
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('id, match_date, home_team, away_team, league_name, flight, line_number, winner_side, source, status, score')
        .is('line_number', null)
        .order('match_date', { ascending: false })

      if (matchError) throw new Error(matchError.message)

      const matches = ((matchData ?? []) as MatchRow[]).filter((row) => {
        const homeTeam = cleanText(row.home_team)
        const awayTeam = cleanText(row.away_team)

        return Boolean(homeTeam && awayTeam)
      })

      if (!matches.length) {
        setRows([])
        return
      }

      const teamSideByMatchAndTeam = new Map<string, 'A' | 'B'>()
      const directoryMap = new Map<string, TeamDirectoryEntry>()
      const scheduleTeamsByScope = new Map<string, Set<string>>()
      const rosterTeamsByScope = new Map<string, Set<string>>()

      const { data: rosterTeamData } = await supabase
        .from('team_roster_members')
        .select('team_name, league_name, flight')
        .limit(3000)

      for (const row of (rosterTeamData || []) as Array<{ team_name: string | null; league_name: string | null; flight: string | null }>) {
        const teamName = normalizeTeamName(row.team_name)
        if (!teamName) continue
        const scopeKey = buildScopeKey(cleanText(row.league_name), cleanText(row.flight))
        if (!rosterTeamsByScope.has(scopeKey)) rosterTeamsByScope.set(scopeKey, new Set<string>())
        rosterTeamsByScope.get(scopeKey)!.add(teamName)
      }

      for (const match of matches) {
        if (!isScheduleLikeMatch(match)) continue
        const league = cleanText(match.league_name)
        const flight = cleanText(match.flight)
        const scopeKey = buildScopeKey(league, flight)
        if (!scheduleTeamsByScope.has(scopeKey)) scheduleTeamsByScope.set(scopeKey, new Set<string>())
        const allowedTeams = scheduleTeamsByScope.get(scopeKey)!
        const homeTeam = normalizeTeamName(match.home_team)
        const awayTeam = normalizeTeamName(match.away_team)
        if (homeTeam) allowedTeams.add(homeTeam)
        if (awayTeam) allowedTeams.add(awayTeam)
      }

      for (const match of matches) {
        const homeTeam = cleanText(match.home_team)
        const awayTeam = cleanText(match.away_team)

        if (!homeTeam || !awayTeam) continue

        const league = cleanText(match.league_name)
        const flight = cleanText(match.flight)
        const scopeKey = buildScopeKey(league, flight)
        const allowedTeams = scheduleTeamsByScope.get(scopeKey) ?? rosterTeamsByScope.get(scopeKey)
        if (
          allowedTeams?.size &&
          (!allowedTeams.has(normalizeTeamName(homeTeam)) || !allowedTeams.has(normalizeTeamName(awayTeam)))
        ) {
          continue
        }

        const homeKey = buildTeamKey(homeTeam, league, flight)
        const awayKey = buildTeamKey(awayTeam, league, flight)

        if (!directoryMap.has(homeKey)) {
          directoryMap.set(homeKey, {
            key: homeKey,
            team: homeTeam,
            league,
            flight,
            matchCount: 0,
            wins: 0,
            losses: 0,
            recentForm: [],
            playerIds: new Set<string>(),
            mostRecentMatchDate: null,
          })
        }

        if (!directoryMap.has(awayKey)) {
          directoryMap.set(awayKey, {
            key: awayKey,
            team: awayTeam,
            league,
            flight,
            matchCount: 0,
            wins: 0,
            losses: 0,
            recentForm: [],
            playerIds: new Set<string>(),
            mostRecentMatchDate: null,
          })
        }

        const homeEntry = directoryMap.get(homeKey)
        const awayEntry = directoryMap.get(awayKey)

        if (homeEntry) {
          homeEntry.matchCount += 1
          const homeResult: 'W' | 'L' | null = match.winner_side === 'A' ? 'W' : match.winner_side === 'B' ? 'L' : null
          if (homeResult === 'W') homeEntry.wins += 1
          else if (homeResult === 'L') homeEntry.losses += 1
          if (homeResult && homeEntry.recentForm.length < 5) homeEntry.recentForm.push(homeResult)
          if (
            compareNullableDatesDesc(match.match_date, homeEntry.mostRecentMatchDate) < 0 ||
            homeEntry.mostRecentMatchDate === null
          ) {
            homeEntry.mostRecentMatchDate = match.match_date
          }
        }

        if (awayEntry) {
          awayEntry.matchCount += 1
          const awayResult: 'W' | 'L' | null = match.winner_side === 'B' ? 'W' : match.winner_side === 'A' ? 'L' : null
          if (awayResult === 'W') awayEntry.wins += 1
          else if (awayResult === 'L') awayEntry.losses += 1
          if (awayResult && awayEntry.recentForm.length < 5) awayEntry.recentForm.push(awayResult)
          if (
            compareNullableDatesDesc(match.match_date, awayEntry.mostRecentMatchDate) < 0 ||
            awayEntry.mostRecentMatchDate === null
          ) {
            awayEntry.mostRecentMatchDate = match.match_date
          }
        }

        teamSideByMatchAndTeam.set(`${match.id}__${homeKey}`, 'A')
        teamSideByMatchAndTeam.set(`${match.id}__${awayKey}`, 'B')
      }

      const matchIds = matches.map((match) => match.id).filter(Boolean)
      const playerRows: MatchPlayerRow[] = []

      for (const idChunk of chunkArray(matchIds, 500)) {
        const { data, error: playerError } = await supabase
          .from('match_players')
          .select(
            `
            match_id,
            side,
            player_id,
            players (
              id,
              name
            )
          `,
          )
          .in('match_id', idChunk)

        if (playerError) throw new Error(playerError.message)

        playerRows.push(...(((data ?? []) as MatchPlayerRow[]) || []))
      }

      const matchMetaById = new Map<
        string,
        {
          league: string | null
          flight: string | null
          homeTeam: string
          awayTeam: string
        }
      >()

      for (const match of matches) {
        const homeTeam = cleanText(match.home_team)
        const awayTeam = cleanText(match.away_team)
        if (!homeTeam || !awayTeam) continue

        matchMetaById.set(match.id, {
          league: cleanText(match.league_name),
          flight: cleanText(match.flight),
          homeTeam,
          awayTeam,
        })
      }

      for (const row of playerRows) {
        if (!row.match_id || (row.side !== 'A' && row.side !== 'B')) continue

        const matchMeta = matchMetaById.get(row.match_id)
        if (!matchMeta) continue

        const teamName = row.side === 'A' ? matchMeta.homeTeam : matchMeta.awayTeam
        const teamKey = buildTeamKey(teamName, matchMeta.league, matchMeta.flight)
        const expectedSide = teamSideByMatchAndTeam.get(`${row.match_id}__${teamKey}`)

        if (!expectedSide || expectedSide !== row.side) continue

        const entry = directoryMap.get(teamKey)
        if (!entry) continue

        const nestedPlayer = Array.isArray(row.players) ? row.players[0] : row.players
        const playerId = cleanText(row.player_id) || cleanText(nestedPlayer?.id ?? null)

        if (!playerId) continue

        entry.playerIds.add(playerId)
      }

      setRows(
        Array.from(directoryMap.values()).sort((left, right) => {
          if (right.matchCount !== left.matchCount) return right.matchCount - left.matchCount
          return left.team.localeCompare(right.team)
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  async function loadTeamAwards() {
    const result = await loadRecentTiqAwards()
    const nextAwardsByTeamName: Record<string, TiqAwardRecord[]> = {}

    for (const award of result.data) {
      if (award.sourceType !== 'league' || !award.recipientName || award.recipientPlayerId) continue
      const key = normalizeTeamName(award.recipientName).toLowerCase()
      if (!key) continue
      const existing = nextAwardsByTeamName[key] ?? []
      existing.push(award)
      nextAwardsByTeamName[key] = existing
    }

    setAwardsByTeamName(nextAwardsByTeamName)
  }

  const leagueOptions = useMemo(() => uniqueSorted(rows.map((row) => row.league)), [rows])
  const flightOptions = useMemo(() => {
    const scopedRows = leagueFilter ? rows.filter((row) => row.league === leagueFilter) : rows
    return uniqueSorted(scopedRows.map((row) => row.flight))
  }, [leagueFilter, rows])

  const filteredRows = useMemo(() => {
    const searchText = search.trim().toLowerCase()

    const next = rows.filter((row) => {
      if (leagueFilter && row.league !== leagueFilter) return false
      if (flightFilter && row.flight !== flightFilter) return false

      if (!searchText) return true

      const haystack = [row.team, row.league ?? '', row.flight ?? ''].join(' ').toLowerCase()
      return haystack.includes(searchText)
    })

    next.sort((left, right) => {
      if (sortBy === 'team') return left.team.localeCompare(right.team)
      if (sortBy === 'players') {
        const diff = right.playerIds.size - left.playerIds.size
        if (diff !== 0) return diff
        return left.team.localeCompare(right.team)
      }
      if (sortBy === 'recent') {
        const diff = compareNullableDatesDesc(left.mostRecentMatchDate, right.mostRecentMatchDate)
        if (diff !== 0) return diff
        return left.team.localeCompare(right.team)
      }
      if (sortBy === 'winpct') {
        const lPct = left.wins + left.losses > 0 ? left.wins / (left.wins + left.losses) : -1
        const rPct = right.wins + right.losses > 0 ? right.wins / (right.wins + right.losses) : -1
        const diff = rPct - lPct
        if (diff !== 0) return diff
        return left.team.localeCompare(right.team)
      }

      const diff = right.matchCount - left.matchCount
      if (diff !== 0) return diff
      return left.team.localeCompare(right.team)
    })

    return next
  }, [flightFilter, leagueFilter, rows, search, sortBy])
  const hasActiveFilters =
    search.trim().length > 0 || leagueFilter.length > 0 || flightFilter.length > 0 || sortBy !== 'matches'
  const shouldShowTeamResults = hasActiveFilters || browseAll
  const visibleRows = shouldShowTeamResults
    ? showAllTeams
      ? filteredRows
      : filteredRows.slice(0, TEAM_DEFAULT_CARD_LIMIT)
    : []
  const hasMoreTeams = shouldShowTeamResults && filteredRows.length > TEAM_DEFAULT_CARD_LIMIT
  const filterActionStyle = isMobile
    ? { ...clearFilterButton, ...compactFilterActionStyle }
    : clearFilterButton

  const totals = useMemo(() => {
    const rowsForTotals = shouldShowTeamResults ? filteredRows : rows
    const uniqueTeams = new Set(rowsForTotals.map((row) => row.key))
    const leagues = new Set(rowsForTotals.map((row) => row.league).filter(Boolean))
    const flights = new Set(rowsForTotals.map((row) => row.flight).filter(Boolean))
    const players = rowsForTotals.reduce((sum, row) => sum + row.playerIds.size, 0)

    return {
      teams: uniqueTeams.size,
      leagues: leagues.size,
      flights: flights.size,
      players,
    }
  }, [filteredRows, rows, shouldShowTeamResults])

  return (
    <SiteShell active="teams">
      <main style={pageWrap}>
        <JsonLd id="teams-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Teams', '/teams')} />
        <section style={contentWrap}>
          <section style={{ ...filtersCard, padding: isMobile ? 12 : filtersCard.padding }}>
            <div aria-hidden="true" style={watermarkStyle} />
            <div style={sectionHeader}>
              <div>
                <p style={sectionKicker}>Team discovery</p>
                <h1 style={sectionTitle}>Find a team.</h1>
                <p style={{ ...sectionText, display: isMobile ? 'none' : undefined }}>
                  Search by team name, league, or flight, then open the team record.
                </p>
              </div>

              <button
                type="button"
                style={{ ...resetButton, ...(isMobile ? compactFilterActionStyle : null) }}
                onClick={() => {
                  setSearch('')
                  setLeagueFilter('')
                  setFlightFilter('')
                  setSortBy('matches')
                  setBrowseAll(false)
                  setShowAllTeams(false)
                }}
              >
                Reset
              </button>
            </div>

            <div style={summaryRow(isSmallMobile, isMobile)}>
              <StatPill label="Teams" value={loading ? 'Refreshing' : String(totals.teams)} />
              <StatPill label="Leagues" value={loading ? 'Starter' : String(totals.leagues)} />
              <StatPill label="Flights" value={loading ? 'Reviewing' : String(totals.flights)} />
              <StatPill label="Players" value={loading ? 'Roster sync' : String(totals.players)} />
            </div>

            <div style={filtersGrid(isMobile)}>
              <div>
                <label htmlFor="team-directory-search" style={{ ...labelStyle, marginBottom: isMobile ? 6 : labelStyle.marginBottom }}>Search</label>
                <input
                  id="team-directory-search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setShowAllTeams(false)
                  }}
                  onFocus={() => setFocusedDirectoryControl('search')}
                  onBlur={() => setFocusedDirectoryControl(null)}
                  placeholder="Search teams"
                  style={{
                    ...inputStyle,
                    ...(isMobile ? compactDirectoryControlStyle : null),
                    ...(focusedDirectoryControl === 'search' ? directoryControlFocusStyle : null),
                  }}
                />
              </div>

              <div>
                <label htmlFor="team-directory-league" style={{ ...labelStyle, marginBottom: isMobile ? 6 : labelStyle.marginBottom }}>League</label>
                <select
                  id="team-directory-league"
                  value={leagueFilter}
                  onFocus={() => setFocusedDirectoryControl('league')}
                  onBlur={() => setFocusedDirectoryControl(null)}
                  onChange={(event) => {
                    setLeagueFilter(event.target.value)
                    setFlightFilter('')
                    setShowAllTeams(false)
                  }}
                  style={{
                    ...inputStyle,
                    ...(isMobile ? compactDirectoryControlStyle : null),
                    borderColor: leagueFilter ? 'color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)' : undefined,
                    boxShadow: leagueFilter ? 'var(--home-control-shadow)' : undefined,
                    ...(focusedDirectoryControl === 'league' ? directoryControlFocusStyle : null),
                  }}
                >
                  <option value="">All leagues</option>
                  {leagueOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="team-directory-flight" style={{ ...labelStyle, marginBottom: isMobile ? 6 : labelStyle.marginBottom }}>Flight</label>
                <select
                  id="team-directory-flight"
                  value={flightFilter}
                  onFocus={() => setFocusedDirectoryControl('flight')}
                  onBlur={() => setFocusedDirectoryControl(null)}
                  onChange={(event) => {
                    setFlightFilter(event.target.value)
                    setShowAllTeams(false)
                  }}
                  style={{
                    ...inputStyle,
                    ...(isMobile ? compactDirectoryControlStyle : null),
                    borderColor: flightFilter ? 'color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)' : undefined,
                    boxShadow: flightFilter ? 'var(--home-control-shadow)' : undefined,
                    ...(focusedDirectoryControl === 'flight' ? directoryControlFocusStyle : null),
                  }}
                >
                  <option value="">All flights</option>
                  {flightOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="team-directory-sort" style={{ ...labelStyle, marginBottom: isMobile ? 6 : labelStyle.marginBottom }}>Sort</label>
                <select
                  id="team-directory-sort"
                  value={sortBy}
                  onFocus={() => setFocusedDirectoryControl('sort')}
                  onBlur={() => setFocusedDirectoryControl(null)}
                  onChange={(event) => {
                    setSortBy(event.target.value as SortKey)
                    setShowAllTeams(false)
                  }}
                  style={{
                    ...inputStyle,
                    ...(isMobile ? compactDirectoryControlStyle : null),
                    borderColor: sortBy !== 'matches' ? 'color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)' : undefined,
                    boxShadow: sortBy !== 'matches' ? 'var(--home-control-shadow)' : undefined,
                    ...(focusedDirectoryControl === 'sort' ? directoryControlFocusStyle : null),
                  }}
                >
                  <option value="matches">Most matches</option>
                  <option value="winpct">Best win %</option>
                  <option value="players">Most players</option>
                  <option value="recent">Most recent</option>
                  <option value="team">Team name</option>
                </select>
              </div>
            </div>
            <div style={filtersActionRow}>
              <button
                type="button"
                disabled={loading}
                style={{
                  ...clearFilterButton,
                  ...(isMobile ? compactFilterActionStyle : null),
                  ...(browseAll ? browseAllButtonActiveStyle : null),
                  ...(loading ? disabledButtonStyle : null),
                }}
                onClick={() => {
                  setBrowseAll(true)
                  setSortBy('matches')
                  setShowAllTeams(false)
                }}
              >
                Browse teams
              </button>
              <TrackedProductLink
                href="/captain"
                style={{ ...filterActionStyle, textDecoration: 'none' }}
                event={{
                  eventName: 'captain_tools_clicked',
                  surface: 'teams',
                  metadata: {
                    location: 'teams_filters',
                    label: 'Captain Tools',
                  },
                }}
              >
                Open Captain tools
              </TrackedProductLink>
              {hasActiveFilters || browseAll ? (
                <button
                  type="button"
                  style={filterActionStyle}
                  onClick={() => {
                    setSearch('')
                    setLeagueFilter('')
                    setFlightFilter('')
                    setSortBy('matches')
                    setBrowseAll(false)
                    setShowAllTeams(false)
                  }}
                >
                Clear active filters
              </button>
            ) : null}
            </div>
            {loading ? (
              <div style={{ ...loadingInlineStyle, ...(isMobile ? compactLoadingInlineStyle : null) }}>
                <strong>Team records are loading.</strong>
                <span>Search, filter, or open Captain tools while the reviewed team list refreshes.</span>
              </div>
            ) : null}
          </section>

          {loading ? (
            null
          ) : error ? (
            <section style={surfaceCard}>
              <div style={sectionKicker}>Directory error</div>
              <div style={errorTitle}>Unable to load teams</div>
              <p style={emptyText}>{error}</p>
              <GhostBtn onClick={() => { void loadTeams() }}>Retry team load</GhostBtn>
            </section>
          ) : !shouldShowTeamResults ? (
            null
          ) : visibleRows.length === 0 ? (
            <section style={surfaceCard}>
              <div style={sectionKicker}>Directory reset</div>
              <div style={emptyTitle}>Search for a team or browse by league.</div>
              <p style={emptyText}>
                Public discovery only shows reviewed team context. Try widening your filters, clearing the search box, or use Data Assist if this league and flight should already exist.
              </p>
              <TeamsDetailsSection
                eyebrow="Why a team may be missing"
                title="Reviewed team context is needed."
                compactTitle="Why no team?"
                cue="Show reason"
                compact={isMobile}
              >
                <DataTrustPanel
                  title="Why a team may be missing"
                  body="Team pages need reviewed roster, scorecard, league, or team-summary context before they appear in public discovery."
                />
              </TeamsDetailsSection>
              <div style={emptyActionRow}>
                <button
                  type="button"
                  style={ghostButton}
                  onClick={() => {
                    setSearch('')
                    setLeagueFilter('')
                    setFlightFilter('')
                    setSortBy('matches')
                    setBrowseAll(false)
                    setShowAllTeams(false)
                  }}
                >
                  Reset team filters
                </button>
                <Link href={DATA_ASSIST_STORY.href} style={ghostButton}>
                  {DATA_ASSIST_STORY.cta}
                </Link>
              </div>
            </section>
          ) : (
            <section style={cardsGrid(isTablet, isMobile)}>
              {visibleRows.map((row) => {
                const teamHref = {
                  pathname: `/teams/${encodeTeamRouteSegment(row.team)}`,
                  query: {
                    ...(row.league ? { league: row.league } : {}),
                    ...(row.flight ? { flight: row.flight } : {}),
                  },
                }

                return (
                  <TeamCard
                    key={row.key}
                    href={teamHref}
                    row={row}
                    awards={awardsByTeamName[normalizeTeamName(row.team).toLowerCase()] || []}
                  />
                )
              })}
              {hasMoreTeams || showAllTeams ? (
                <div style={teamBoardLimitRowStyle}>
                  <span style={teamBoardLimitTextStyle}>
                    Showing {visibleRows.length} of {filteredRows.length} teams.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllTeams((current) => !current)}
                    style={clearFilterButton}
                  >
                    {showAllTeams ? 'Show top teams' : 'Show full directory'}
                  </button>
                </div>
              ) : null}
            </section>
          )}
        </section>
        <section style={contentWrap}>
          <TeamsDetailsSection
            eyebrow="Team paths"
            title="Players, captains, opponents, and leagues."
            compactTitle="Open the right team path."
            cue="Show team paths"
            compact={isMobile}
          >
            <div style={publicIntroGridStyle(isTinyMobile)}>
              <IntroMiniCard title="For players" body="Find your team, follow the schedule, see rosters, and stay connected." compact={compactIntroCards} />
              <IntroMiniCard title="For captains" body="Collect availability, build smarter lineups, scout opponents, and prepare each court." compact={compactIntroCards} />
              <IntroMiniCard title="For opponents" body="Scout team strength, recent results, roster depth, and matchup context." compact={compactIntroCards} />
              <IntroMiniCard title="For leagues" body="Keep rosters, schedules, captains, scorecards, and team visibility easier to manage." compact={compactIntroCards} />
            </div>
          </TeamsDetailsSection>
        </section>
        <section style={contentWrap}>
          <TeamsDetailsSection
            eyebrow="Team Hub preview"
            title="Availability, lineup, scouting, and team message."
            compactTitle="Open Team Hub tools."
            cue="Show Team Hub preview"
            compact={isMobile}
          >
            <section style={filtersCard}>
              <div style={sectionHeader}>
                <div>
                  <p style={sectionKicker}>Captain decision path</p>
                  <h2 style={sectionTitle}>Who can play, where they fit, and what gets sent?</h2>
                  <p style={sectionText}>
                    Team Hub connects the public team record with Captain Tools, so availability, lineup choices, scouting, and the final team note reduce match-week chaos in one path.
                  </p>
                </div>
              </div>
              <div style={teamWeekBoardStyle(isMobile, isTablet)}>
                <div style={teamWeekLeftStackStyle}>
                  <TeamWeekSpotlight />
                  <TiqWorkspacePreview
                    eyebrow="Opponent scouting"
                    title="West County roster read"
                    body="Scan roster depth, recent results, and matchup context before assigning courts."
                    metrics={[
                      { label: 'Roster', value: '12' },
                      { label: 'Recent', value: '3-1' },
                      { label: 'Watch', value: 'Doubles' },
                    ]}
                    href="/matchup"
                    cta="Scout Opponent"
                    event={{
                      eventName: 'matchup_started',
                      surface: 'matchup',
                      metadata: {
                        location: 'team_hub_preview',
                      },
                    }}
                  />
                </div>
                <div style={teamWeekStepListStyle}>
                  {teamNextActions.map((action, index) => (
                    <TeamWeekStep key={action.title} action={action} step={index + 1} />
                  ))}
                </div>
              </div>
            </section>
          </TeamsDetailsSection>
        </section>
      </main>
      {shouldShowAds ? (
        <div style={{ marginTop: 12 }}>
          <AdsenseSlot slot={TEAMS_INLINE_AD_SLOT} label="Sponsored" minHeight={250} />
        </div>
      ) : null}
    </SiteShell>
  )
}

const teamNextActions = [
  {
    eyebrow: 'Availability',
    title: 'Who is available?',
    body: 'Collect who is in, out, or on the bubble so the player pool is clear before lineup work starts.',
    metrics: [
      { label: 'Players', value: 'In / out' },
      { label: 'Bubble', value: 'Clear' },
      { label: 'Next', value: 'Lineup' },
    ],
    href: '/captain/availability',
    cta: 'Check Availability',
    event: {
      eventName: 'availability_clicked',
      surface: 'teams',
      metadata: {
        location: 'team_next_actions',
      },
    },
    trust: [
      { label: 'Source', value: 'Captain update', tone: 'info' },
      { label: 'Freshness', value: 'Match week', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Lineup',
    title: 'What lineup gives us the best chance?',
    body: 'Compare available players, court strength, opponent context, and risk before locking the lineup.',
    metrics: [
      { label: 'Tool', value: 'Lineup' },
      { label: 'Risk', value: 'Court swaps' },
      { label: 'Next', value: 'Save' },
    ],
    href: '/captain/lineup-builder',
    cta: 'Build Lineup',
    event: {
      eventName: 'lineup_preview_clicked',
      surface: 'teams',
      metadata: {
        location: 'team_next_actions',
      },
    },
    trust: [
      { label: 'Confidence', value: 'Improves with results', tone: 'warn' },
      { label: 'Status', value: 'Captain decision', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Pairings',
    title: 'Who should play together?',
    body: 'Pressure-test doubles combinations, scenario changes, and court swaps before the plan gets shared.',
    metrics: [
      { label: 'Combos', value: 'Compare' },
      { label: 'Scenario', value: 'Test' },
      { label: 'Risk', value: 'Visible' },
    ],
    href: '/captain/scenario-builder',
    cta: 'Test Pairings',
    event: {
      eventName: 'lineup_preview_clicked',
      surface: 'teams',
      metadata: {
        location: 'team_next_actions',
      },
    },
    trust: [
      { label: 'Confidence', value: 'Improves with results', tone: 'warn' },
      { label: 'Status', value: 'Scenario ready', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Message',
    title: 'What should I communicate?',
    body: 'Turn the lineup decision into a clear team note so players know where to be, who they play with, and what matters.',
    metrics: [
      { label: 'Plan', value: 'Shared' },
      { label: 'Players', value: 'Aligned' },
      { label: 'Chaos', value: 'Less' },
    ],
    href: '/captain/messaging',
    cta: 'Send Team Plan',
    event: {
      eventName: 'captain_tools_clicked',
      surface: 'teams',
      metadata: {
        location: 'team_next_actions',
      },
    },
    trust: [
      { label: 'Status', value: 'Ready to send', tone: 'good' },
      { label: 'Follow-up', value: 'Team week', tone: 'info' },
    ],
  },
] as const

type TeamNextAction = (typeof teamNextActions)[number]

function TeamsDetailsSection({
  eyebrow,
  title,
  compactTitle,
  cue,
  compact = false,
  children,
}: {
  eyebrow: string
  title: string
  compactTitle?: string
  cue: string
  compact?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const summaryStyle = compact
    ? { ...teamsDetailsSummaryStyle, flexWrap: 'nowrap' as const, gap: 8, padding: '10px 11px' }
    : teamsDetailsSummaryStyle
  const titleStyle = compact
    ? { ...teamsDetailsTitleStyle, fontSize: 13, lineHeight: 1.15 }
    : teamsDetailsTitleStyle
  const cueStyle = compact
    ? { ...teamsDetailsCueStyle, fontSize: 11 }
    : teamsDetailsCueStyle

  return (
    <details style={teamsDetailsSectionStyle} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary style={summaryStyle}>
        <span style={teamsDetailsSummaryCopyStyle}>
          <span style={teamsDetailsEyebrowStyle}>{eyebrow}</span>
          <strong style={titleStyle}>{compact && compactTitle ? compactTitle : title}</strong>
        </span>
        <span style={cueStyle}>{compact ? 'Open' : cue}</span>
      </summary>
      <div style={open ? teamsDetailsContentStyle : teamsDetailsContentClosedStyle}>{children}</div>
    </details>
  )
}

function TeamWeekSpotlight() {
  return (
    <article style={teamWeekSpotlightStyle}>
      <div style={teamWeekSpotlightTopStyle}>
        <span style={teamWeekBadgeStyle}>Team Hub preview</span>
        <TrackedProductLink
          href="/captain/lineup-builder"
          style={teamWeekSpotlightLinkStyle}
          event={{
            eventName: 'lineup_preview_clicked',
            surface: 'teams',
            metadata: {
              location: 'team_hub_preview',
            },
          }}
        >
          Build Lineup
        </TrackedProductLink>
      </div>
      <h3 style={teamWeekSpotlightTitleStyle}>Saturday vs West County</h3>
      <p style={teamWeekSupportLineStyle}>Availability, lineup, scouting, and match week.</p>
      <p style={teamWeekSpotlightTextStyle}>
        Check availability, choose the lineup, watch doubles risk, and send the team plan before match day.
      </p>
      <div style={teamWeekMetricGridStyle}>
        <Metric label="Available" value="8/10" />
        <Metric label="Team edge" value="71%" />
        <Metric label="Risk" value="D1 swap" />
      </div>
      <div style={teamWeekSpotlightActionRowStyle}>
        <TrackedProductLink
          href="/captain/availability"
          style={secondaryIntroButton}
          event={{
            eventName: 'availability_clicked',
            surface: 'teams',
            metadata: {
              location: 'team_hub_preview',
            },
          }}
        >
          Check Availability
        </TrackedProductLink>
        <TrackedProductLink
          href="/captain/messaging"
          style={secondaryIntroButton}
          event={{
            eventName: 'captain_tools_clicked',
            surface: 'teams',
            metadata: {
              location: 'team_hub_preview',
            },
          }}
        >
          Send Team Plan
        </TrackedProductLink>
      </div>
    </article>
  )
}

function TeamWeekStep({ action, step }: { action: TeamNextAction; step: number }) {
  return (
    <article style={teamWeekStepStyle}>
      <div style={teamWeekStepNumberStyle}>{step}</div>
      <div style={teamWeekStepCopyStyle}>
        <div style={teamWeekStepTopStyle}>
          <span style={teamWeekStepEyebrowStyle}>{action.eyebrow}</span>
          <TrackedProductLink href={action.href} style={teamWeekStepLinkStyle} event={action.event}>
            {action.cta}
          </TrackedProductLink>
        </div>
        <h3 style={teamWeekStepTitleStyle}>{action.title}</h3>
        <p style={teamWeekStepBodyStyle}>{action.body}</p>
        <div style={teamWeekStepMetricsStyle}>
          {action.metrics.map((metric) => (
            <span key={metric.label} style={teamWeekStepMetricPillStyle}>
              {metric.label}: {metric.value}
            </span>
          ))}
        </div>
      </div>
    </article>
  )
}

function TeamCard({ href, row, awards }: { href: object; row: TeamDirectoryEntry; awards: TiqAwardRecord[] }) {
  const [hovered, setHovered] = useState(false)

  return (
    <article
      style={{
        ...teamCard,
        transform: hovered ? 'translateY(-3px)' : 'none',
        borderColor: hovered ? 'rgba(116,190,255,0.34)' : 'rgba(116,190,255,0.14)',
        boxShadow: hovered
          ? '0 28px 70px rgba(0,0,0,0.32), 0 0 0 1px rgba(116,190,255,0.12)'
          : '0 20px 55px rgba(0,0,0,0.22)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
        <div style={teamCardTop}>
          <div style={teamCardCopy}>
            <Link href={href as Parameters<typeof Link>[0]['href']} style={teamNameLink}>
              {row.team}
            </Link>

            {(row.league || row.flight) ? (
              <div style={metaRow}>
                {row.league ? <span style={metaPillBlue}>{row.league}</span> : null}
                {row.flight ? <span style={metaPillGreen}>{row.flight}</span> : null}
              </div>
            ) : null}
          </div>

          <Link
            href={href as Parameters<typeof Link>[0]['href']}
            style={{
              ...viewPill,
              borderColor: hovered ? 'rgba(116,190,255,0.30)' : 'rgba(116,190,255,0.14)',
              color: hovered ? '#e8f2ff' : '#d6e5f5',
            }}
          >
            View team
          </Link>
        </div>

        <TeamAwardBadges awards={awards} />

        {row.wins + row.losses > 0 ? (() => {
          const total = row.wins + row.losses
          const winPct = Math.round((row.wins / total) * 100)
          return (
            <div style={teamRecordBarWrap}>
              <div style={teamRecordBar}>
                <div style={{ width: `${winPct}%`, background: 'linear-gradient(90deg,rgba(155,225,29,0.65),rgba(74,222,128,0.65))', minWidth: winPct > 0 ? 4 : 0, transition: 'width 400ms ease' }} />
                <div style={{ flex: 1, background: 'rgba(239,68,68,0.22)' }} />
              </div>
              <div style={teamRecordLegend}>
                <span style={teamRecordWinText}>{row.wins}W - {winPct}%</span>
                <span style={teamRecordLossText}>{row.losses}L</span>
              </div>
            </div>
          )
        })() : null}

        {row.recentForm.length > 0 ? (
          <div style={recentFormRow}>
            <span style={recentFormLabel}>Form</span>
            {row.recentForm.map((r, i) => (
              <span key={i} style={{ ...recentFormBadgeBase, background: r === 'W' ? 'rgba(155,225,29,0.12)' : 'rgba(239,68,68,0.10)', color: r === 'W' ? '#d9f84a' : '#fca5a5', border: `1px solid ${r === 'W' ? 'rgba(155,225,29,0.22)' : 'rgba(239,68,68,0.18)'}` }}>
                {r}
              </span>
            ))}
          </div>
        ) : null}

        <div style={metricsGrid}>
          <Metric label="Matches" value={String(row.matchCount)} />
          <Metric label="Players" value={String(row.playerIds.size)} />
          <Metric label="Last match" value={formatShortDate(row.mostRecentMatchDate, '--')} />
        </div>
        <details style={teamCardTrustDetailsStyle}>
          <summary style={teamCardTrustSummaryStyle}>
            <span>Data check</span>
            <strong>{row.mostRecentMatchDate ? 'Match context' : 'Review pending'}</strong>
          </summary>
          <div style={teamCardTrustBodyStyle}>
            <TiqTrustStrip
              label={`${row.team} data trust signals`}
              signals={[
                { label: 'Source', value: 'Scorecards / rosters', tone: 'info' },
                { label: 'Freshness', value: row.mostRecentMatchDate ? formatShortDate(row.mostRecentMatchDate, 'Review pending') : 'Review pending', tone: row.mostRecentMatchDate ? 'good' : 'warn' },
                { label: 'Confidence', value: row.matchCount >= 5 ? 'High' : row.matchCount >= 2 ? 'Medium' : 'Limited', tone: row.matchCount >= 5 ? 'good' : row.matchCount >= 2 ? 'warn' : 'info' },
                { label: 'Status', value: 'Reviewable', tone: 'good' },
              ]}
              reviewContext={`Team ${row.team}`}
            />
          </div>
        </details>
    </article>
  )
}

function TeamAwardBadges({ awards }: { awards: TiqAwardRecord[] }) {
  if (!awards.length) return null

  return (
    <div style={teamAwardRowStyle} aria-label="Team league awards">
      {awards.slice(0, 3).map((award) => (
        <Link
          key={award.id}
          href={`/awards/${encodeURIComponent(award.id)}`}
          style={teamAwardPillStyle}
          title={`${award.badgeLabel}: ${award.title}`}
        >
          <span>{award.badgeCode}</span>
          <small>{award.sourceName}</small>
        </Link>
      ))}
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={statPill}>
      <div style={statValue}>{value}</div>
      <div style={statLabel}>{label}</div>
    </div>
  )
}

function IntroMiniCard({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return (
    <div style={introMiniCardStyle(compact)}>
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCard}>
      <div style={metricValue}>{value}</div>
      <div style={metricLabel}>{label}</div>
    </div>
  )
}

const pageWrap: CSSProperties = {
  color: 'var(--foreground)',
  paddingBottom: '56px',
  minWidth: 0,
  overflowX: 'clip',
  boxSizing: 'border-box',
}

const contentWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '12px auto 0',
  minWidth: 0,
}

const teamsDetailsSectionStyle: CSSProperties = {
  display: 'block',
  gap: 10,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const teamsDetailsSummaryStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minWidth: 0,
  padding: '12px 14px',
  borderRadius: 8,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  cursor: 'pointer',
  listStyle: 'none',
  overflowWrap: 'anywhere',
}

const teamsDetailsSummaryCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const teamsDetailsEyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const teamsDetailsTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const teamsDetailsCueStyle: CSSProperties = {
  flex: '0 0 auto',
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const teamsDetailsContentStyle: CSSProperties = {
  display: 'grid',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const teamsDetailsContentClosedStyle: CSSProperties = {
  display: 'none',
}

const secondaryIntroButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 950,
  cursor: 'pointer',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const publicIntroGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const publicIntroGridStyle = (isTinyMobile: boolean): CSSProperties => ({
  ...publicIntroGrid,
  gridTemplateColumns: isTinyMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
  gap: isTinyMobile ? 8 : publicIntroGrid.gap,
})

const teamWeekBoardStyle = (isMobile: boolean, isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : isTablet ? 'minmax(0, 1fr)' : 'minmax(320px, 0.9fr) minmax(0, 1.1fr)',
  gap: isMobile ? 12 : 14,
  alignItems: 'start',
  minWidth: 0,
  marginTop: 18,
})

const teamWeekLeftStackStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const teamWeekSpotlightStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  alignSelf: 'start',
  gap: 14,
  minWidth: 0,
  minHeight: 0,
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 12%, transparent), rgba(8,16,34,0.86) 48%, rgba(7,17,33,0.92))',
  padding: 16,
  overflow: 'hidden',
}

const teamWeekSpotlightTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const teamWeekBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const teamWeekSpotlightLinkStyle: CSSProperties = {
  ...secondaryIntroButton,
  minHeight: 34,
  padding: '0 12px',
  fontSize: 12,
}

const teamWeekSpotlightTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.45rem, 2.2vw, 2rem)',
  lineHeight: 1.05,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const teamWeekSpotlightTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 740,
  overflowWrap: 'anywhere',
}

const teamWeekSupportLineStyle: CSSProperties = {
  margin: 0,
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const teamWeekMetricGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
  minWidth: 0,
}

const teamWeekSpotlightActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const teamWeekStepListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const teamWeekStepStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'start',
  minWidth: 0,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(255,255,255,0.04)',
  padding: 12,
}

const teamWeekStepNumberStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 12%, var(--shell-chip-bg) 88%)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
}

const teamWeekStepCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
}

const teamWeekStepTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
}

const teamWeekStepEyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const teamWeekStepLinkStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  textDecoration: 'none',
  borderBottom: '1px solid color-mix(in srgb, var(--brand-green) 46%, transparent)',
}

const teamWeekStepTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 17,
  lineHeight: 1.15,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const teamWeekStepBodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 720,
  overflowWrap: 'anywhere',
}

const teamWeekStepMetricsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  minWidth: 0,
}

const teamWeekStepMetricPillStyle: CSSProperties = {
  display: 'inline-flex',
  minHeight: 24,
  alignItems: 'center',
  padding: '0 8px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(7,17,33,0.62)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 780,
  overflowWrap: 'anywhere',
}

const introMiniCardStyle = (compact: boolean): CSSProperties => ({
  display: 'grid',
  gap: compact ? 5 : 7,
  alignContent: 'start',
  minHeight: compact ? 84 : 132,
  padding: compact ? 10 : 14,
  borderRadius: compact ? 8 : 18,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: compact ? 12 : 13,
  lineHeight: compact ? 1.42 : 1.55,
  fontWeight: 720,
  minWidth: 0,
  overflowWrap: 'anywhere',
})

const summaryRow = (isSmallMobile: boolean, isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isSmallMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
  gap: isMobile ? '6px' : '8px',
  marginTop: isMobile ? '10px' : '14px',
  minWidth: 0,
})

const statPill: CSSProperties = {
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.7)',
  padding: '11px 12px',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const statValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '20px',
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const statLabel: CSSProperties = {
  marginTop: '4px',
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const filtersCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(4,10,24,0.9))',
  boxShadow: '0 30px 86px rgba(2, 8, 23, 0.46), inset 0 1px 0 rgba(255,255,255,0.05)',
  padding: '16px',
  minWidth: 0,
}

const sectionHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const sectionKicker: CSSProperties = {
  margin: 0,
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const sectionTitle: CSSProperties = {
  margin: '8px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.55rem, 3vw, 2.25rem)',
  lineHeight: 1.08,
  letterSpacing: 0,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const sectionText: CSSProperties = {
  margin: '10px 0 0',
  maxWidth: '760px',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.7,
  overflowWrap: 'anywhere',
}

const resetButton: CSSProperties = {
  appearance: 'none',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  padding: '10px 14px',
  borderRadius: '14px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 700,
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const filtersActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '14px',
  minWidth: 0,
}

const compactLoadingInlineStyle: CSSProperties = {
  marginTop: 10,
  padding: '8px 10px',
  fontSize: 12,
}

const loadingInlineStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  marginTop: 12,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.35,
  minWidth: 0,
  overflowWrap: 'anywhere',
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
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  cursor: 'pointer',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const compactFilterActionStyle: CSSProperties = {
  minHeight: 36,
  padding: '0 12px',
  borderRadius: '12px',
  fontSize: 12,
}

const browseAllButtonActiveStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-lime) 36%, var(--shell-panel-border) 64%)',
  background: 'color-mix(in srgb, var(--brand-lime) 14%, var(--shell-chip-bg) 86%)',
  color: 'var(--foreground-strong)',
}

const disabledButtonStyle: CSSProperties = {
  opacity: 0.62,
  cursor: 'wait',
}

const ghostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  marginTop: '12px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '13px',
  cursor: 'pointer',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...ghostButton, ...(hovered ? { background: 'var(--shell-chip-bg-strong)', transform: 'translateY(-2px)', boxShadow: 'var(--shadow-soft)' } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

const filtersGrid = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
  gap: isMobile ? '8px' : '10px',
  minWidth: 0,
  marginTop: isMobile ? '10px' : '14px',
})

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const inputStyle: CSSProperties = {
  width: '100%',
  height: '46px',
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  padding: '0 14px',
  fontSize: '14px',
  outline: '2px solid transparent',
  outlineOffset: 2,
  colorScheme: 'dark',
}

const compactDirectoryControlStyle: CSSProperties = {
  height: '42px',
  borderRadius: '10px',
  padding: '0 10px',
  fontSize: '13px',
}

const directoryControlFocusStyle: CSSProperties = {
  borderColor: 'color-mix(in srgb, var(--brand-green) 44%, var(--shell-panel-border) 56%)',
  outline: '2px solid color-mix(in srgb, var(--brand-green) 48%, transparent)',
  boxShadow: '0 0 0 5px rgba(155,225,29,0.12), var(--home-control-shadow)',
}

const surfaceCard: CSSProperties = {
  marginTop: '18px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.74)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
  padding: '22px',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const teamStartGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 12,
  minWidth: 0,
  marginTop: 16,
}

const teamStartActionStyle: CSSProperties = {
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

const emptyTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '22px',
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const errorTitle: CSSProperties = {
  color: '#ffb4b4',
  fontSize: '22px',
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const emptyText: CSSProperties = {
  marginTop: '8px',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.7,
  overflowWrap: 'anywhere',
}

const emptyActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '12px',
  maxWidth: '100%',
  minWidth: 0,
}

const cardsGrid = (isTablet: boolean, isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
  gap: '16px',
  marginTop: '18px',
  minWidth: 0,
})

const teamBoardLimitRowStyle: CSSProperties = {
  gridColumn: '1 / -1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
  padding: '14px',
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
}

const teamBoardLimitTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const teamCard: CSSProperties = {
  height: '100%',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.74)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
  padding: '20px',
  transition: 'transform 140ms ease, border-color 140ms ease',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const teamCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
  minWidth: 0,
}

const teamCardCopy: CSSProperties = {
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const teamName: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '23px',
  lineHeight: 1.08,
  letterSpacing: 0,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const teamNameLink: CSSProperties = {
  ...teamName,
  display: 'inline-flex',
  maxWidth: '100%',
  textDecoration: 'none',
}

const metaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginTop: '12px',
  minWidth: 0,
}

const metaPillBlue: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '7px 10px',
  borderRadius: '999px',
  background: 'color-mix(in srgb, var(--brand-blue-2) 14%, var(--shell-chip-bg) 86%)',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 24%, var(--shell-panel-border) 76%)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 700,
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const metaPillGreen: CSSProperties = {
  ...metaPillBlue,
  background: 'color-mix(in srgb, var(--brand-green) 14%, var(--shell-chip-bg) 86%)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  color: 'var(--foreground-strong)',
}

const viewPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'normal',
  textAlign: 'center',
  padding: '8px 10px',
  borderRadius: '999px',
  background: 'rgba(7,17,33,0.72)',
  border: '1px solid rgba(116,190,255,0.13)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  textDecoration: 'none',
  maxWidth: '100%',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const teamAwardRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  margin: '14px 0 10px',
  minWidth: 0,
}

const teamAwardPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  maxWidth: '100%',
  minHeight: '26px',
  padding: '0 9px',
  borderRadius: '999px',
  border: '1px solid rgba(245,158,11,0.32)',
  background: 'rgba(245,158,11,0.12)',
  color: '#fff7ed',
  fontSize: '10px',
  fontWeight: 900,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const teamRecordBarWrap: CSSProperties = {
  marginBottom: 10,
  minWidth: 0,
}

const teamRecordBar: CSSProperties = {
  display: 'flex',
  borderRadius: 999,
  overflow: 'hidden',
  height: 7,
  background: 'color-mix(in srgb, var(--foreground-strong) 6%, transparent)',
  marginBottom: 5,
  minWidth: 0,
}

const teamRecordLegend: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
}

const teamRecordWinText: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--brand-lime)',
  overflowWrap: 'anywhere',
}

const teamRecordLossText: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#fca5a5',
  overflowWrap: 'anywhere',
}

const recentFormRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const recentFormLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0,
  flexShrink: 0,
  overflowWrap: 'anywhere',
}

const recentFormBadgeBase: CSSProperties = {
  width: 20,
  height: 20,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
  flex: '0 0 auto',
}

const metricsGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 84px), 1fr))',
  gap: '10px',
  marginTop: '18px',
  minWidth: 0,
}

const teamCardTrustDetailsStyle: CSSProperties = {
  minWidth: 0,
  marginTop: '12px',
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.46)',
  overflow: 'hidden',
  overflowWrap: 'anywhere',
}

const teamCardTrustSummaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  minHeight: 42,
  padding: '0 12px',
  color: 'var(--foreground-strong)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0,
  flexWrap: 'wrap',
  overflowWrap: 'anywhere',
}

const teamCardTrustBodyStyle: CSSProperties = {
  padding: '0 10px 10px',
  minWidth: 0,
}

const metricCard: CSSProperties = {
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  padding: '14px 12px',
  minWidth: 0,
}

const metricValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '18px',
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const metricLabel: CSSProperties = {
  marginTop: '5px',
  color: 'var(--shell-copy-muted)',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '-108px',
  width: 'min(280px, 58vw)',
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
  opacity: 0.14,
  pointerEvents: 'none',
}
