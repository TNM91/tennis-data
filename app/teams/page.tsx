'use client'

import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState, type ReactNode } from 'react'
import AdsenseSlot from '@/app/components/adsense-slot'
import DataTrustPanel from '@/app/components/data-trust-panel'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import TiqDirectoryFallbackCard from '@/app/components/tiq-directory-fallback-card'
import TiqTrustStrip from '@/app/components/tiq-trust-strip'
import { TiqActionCard, TiqLineupPreview, TiqWorkspacePreview } from '@/app/components/tiq-product-preview-cards'
import TrackedProductLink from '@/app/components/tracked-product-link'
import { shouldShowSponsoredPlacements } from '@/lib/access-model'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
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
  const [focusedDirectoryControl, setFocusedDirectoryControl] = useState<string | null>(null)

  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
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
  const visibleRows = shouldShowTeamResults ? filteredRows : []

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
          <article style={publicIntroCard}>
            <div style={publicIntroCopy}>
              <p style={sectionKicker}>Teams</p>
              <h1 style={publicIntroTitle}>Team tennis without the group-text chaos.</h1>
              <p style={publicIntroText}>
                Find teams, follow rosters, scout opponents, collect availability, build lineups, and keep match week organized.
              </p>
              <div style={publicIntroActions}>
                <button
                  type="button"
                  style={primaryIntroButton}
                  onClick={() => {
                    void trackProductUsageEvent({
                      eventName: 'team_search_submitted',
                      surface: 'teams',
                      metadata: {
                        location: 'teams_intro',
                      },
                    })
                    document.getElementById('team-directory-search')?.focus()
                  }}
                >
                  Find Teams
                </button>
                <TrackedProductLink
                  href="/captain"
                  style={secondaryIntroButton}
                  event={{
                    eventName: 'captain_tools_clicked',
                    surface: 'teams',
                    metadata: {
                      location: 'teams_intro',
                      label: 'Open Captain Tools',
                    },
                  }}
                >
                  Open Captain Tools
                </TrackedProductLink>
              </div>
            </div>
            <div style={publicIntroGrid}>
              <IntroMiniCard title="For players" body="Find your team, follow the schedule, see rosters, and stay connected." />
              <IntroMiniCard title="For captains" body="Collect availability, build smarter lineups, scout opponents, and prepare each court." />
              <IntroMiniCard title="For opponents" body="Scout team strength, recent results, roster depth, and matchup context." />
              <IntroMiniCard title="For leagues" body="Keep rosters, schedules, captains, scorecards, and team visibility easier to manage." />
            </div>
          </article>
        </section>
        <section style={contentWrap}>
          <section style={filtersCard}>
            <div style={sectionHeader}>
              <div>
                <p style={sectionKicker}>Team next actions</p>
                <h2 style={sectionTitle}>Pick the match-week job, then open the right tool.</h2>
                <p style={sectionText}>
                  Teams are public. Captain Tools are the leadership lane for availability, lineups, scouting, and clean team data.
                </p>
              </div>
            </div>
            <div style={teamNextActionGrid}>
              {teamNextActions.map((action) => (
                <TiqActionCard
                  key={action.title}
                  eyebrow={action.eyebrow}
                  title={action.title}
                  body={action.body}
                  metrics={[...action.metrics]}
                  href={action.href}
                  cta={action.cta}
                  event={action.event}
                  trust={[...action.trust]}
                />
              ))}
            </div>
          </section>
        </section>
        <section style={contentWrap}>
          <section style={filtersCard}>
            <div style={sectionHeader}>
              <div>
                <p style={sectionKicker}>Team Hub preview</p>
                <h2 style={sectionTitle}>Availability, lineup, scouting, and match week.</h2>
                <p style={sectionText}>
                  Team Hub is the public team object plus Captain Tools for the person organizing who can play, where they fit, and what the week needs.
                </p>
              </div>
            </div>
            <div style={teamHubPreviewGrid}>
              <TiqWorkspacePreview
                eyebrow="Availability"
                title="Saturday vs West County"
                body="Collect who is in, out, or on the bubble before lineup lock."
                metrics={[
                  { label: 'Available', value: '8/10' },
                  { label: 'Bubble', value: '2' },
                  { label: 'Deadline', value: 'Thu' },
                ]}
                href="/captain/availability"
                cta="Check Availability"
                event={{
                  eventName: 'availability_clicked',
                  surface: 'teams',
                  metadata: {
                    location: 'team_hub_preview',
                  },
                }}
              />
              <TiqLineupPreview
                title="Suggested lineup"
                body="Compare projected courts, player availability, and team edge before match day."
                metrics={[
                  { label: 'Available', value: '8/10' },
                  { label: 'Team edge', value: '71%' },
                  { label: 'Risk', value: 'D1 swap' },
                ]}
                href="/captain/lineup-builder"
                cta="Build Lineup"
                event={{
                  eventName: 'lineup_preview_clicked',
                  surface: 'teams',
                  metadata: {
                    location: 'team_hub_preview',
                  },
                }}
              />
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
          </section>
        </section>
        <section style={contentWrap}>
          <section style={filtersCard}>
            <div aria-hidden="true" style={watermarkStyle} />
            <div style={sectionHeader}>
              <div>
                <p style={sectionKicker}>Team discovery</p>
                <h2 style={sectionTitle}>Find a team.</h2>
                <p style={sectionText}>
                  Search by team name, league, or flight, then open the team record.
                </p>
              </div>

              <button
                type="button"
                style={resetButton}
                onClick={() => {
                  setSearch('')
                  setLeagueFilter('')
                  setFlightFilter('')
                  setSortBy('matches')
                  setBrowseAll(false)
                }}
              >
                Reset
              </button>
            </div>

            <div style={summaryRow(isSmallMobile)}>
              <StatPill label="Teams" value={loading ? '-' : String(totals.teams)} />
              <StatPill label="Leagues" value={loading ? '-' : String(totals.leagues)} />
              <StatPill label="Flights" value={loading ? '-' : String(totals.flights)} />
              <StatPill label="Players" value={loading ? '-' : String(totals.players)} />
            </div>

            <div style={filtersGrid(isMobile)}>
              <div>
                <label htmlFor="team-directory-search" style={labelStyle}>Search</label>
                <input
                  id="team-directory-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onFocus={() => setFocusedDirectoryControl('search')}
                  onBlur={() => setFocusedDirectoryControl(null)}
                  placeholder="Search teams"
                  style={{
                    ...inputStyle,
                    ...(focusedDirectoryControl === 'search' ? directoryControlFocusStyle : null),
                  }}
                />
              </div>

              <div>
                <label htmlFor="team-directory-league" style={labelStyle}>League</label>
                <select
                  id="team-directory-league"
                  value={leagueFilter}
                  onFocus={() => setFocusedDirectoryControl('league')}
                  onBlur={() => setFocusedDirectoryControl(null)}
                  onChange={(event) => {
                    setLeagueFilter(event.target.value)
                    setFlightFilter('')
                  }}
                  style={{
                    ...inputStyle,
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
                <label htmlFor="team-directory-flight" style={labelStyle}>Flight</label>
                <select
                  id="team-directory-flight"
                  value={flightFilter}
                  onFocus={() => setFocusedDirectoryControl('flight')}
                  onBlur={() => setFocusedDirectoryControl(null)}
                  onChange={(event) => setFlightFilter(event.target.value)}
                  style={{
                    ...inputStyle,
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
                <label htmlFor="team-directory-sort" style={labelStyle}>Sort</label>
                <select
                  id="team-directory-sort"
                  value={sortBy}
                  onFocus={() => setFocusedDirectoryControl('sort')}
                  onBlur={() => setFocusedDirectoryControl(null)}
                  onChange={(event) => setSortBy(event.target.value as SortKey)}
                  style={{
                    ...inputStyle,
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
                  ...(browseAll ? browseAllButtonActiveStyle : null),
                  ...(loading ? disabledButtonStyle : null),
                }}
                onClick={() => {
                  setBrowseAll(true)
                  setSortBy('matches')
                }}
              >
                Browse teams
              </button>
              {hasActiveFilters || browseAll ? (
                <button
                  type="button"
                  style={clearFilterButton}
                  onClick={() => {
                    setSearch('')
                    setLeagueFilter('')
                    setFlightFilter('')
                    setSortBy('matches')
                    setBrowseAll(false)
                  }}
                >
                  Clear active filters
                </button>
              ) : null}
            </div>
          </section>

          {loading ? (
            <section style={surfaceCard}>
              <div style={sectionKicker}>Team discovery</div>
              <div style={emptyTitle}>Search for a team or browse by league.</div>
              <p style={emptyText}>
                Team pages help players, captains, opponents, and league organizers understand the week. The live directory is refreshing behind this starter view.
              </p>
              <DataTrustPanel
                title="Team data trust"
                signals={[
                  { label: 'Source', value: 'Scorecards, rosters, team summaries' },
                  { label: 'Freshness', value: 'Recent matches first' },
                  { label: 'Confidence', value: 'Higher with reviewed scorecards' },
                  { label: 'Status', value: 'Needs review when disputed' },
                ]}
              />
              <TiqDirectoryFallbackCard
                eyebrow="Featured team path"
                title="Scout the next team before match week."
                body="Start with a team name, league, or flight. Team pages help players and captains see roster context, recent form, and where Captain Tools can make the week cleaner."
                chips={['Roster context', 'Recent results', 'Captain Tools']}
                actions={[
                  { href: '/captain', label: 'Open Captain Tools' },
                  { href: DATA_ASSIST_STORY.href, label: DATA_ASSIST_STORY.cta },
                ]}
              />
              <div style={teamStartGridStyle}>
                <button type="button" style={teamStartActionStyle} onClick={() => setBrowseAll(true)}>
                  <strong>Browse teams</strong>
                  <span>Open the reviewed team board when it is ready.</span>
                </button>
                <Link href="/captain" style={{ ...teamStartActionStyle, textDecoration: 'none' }}>
                  <strong>Captain Tools</strong>
                  <span>Collect availability and build the week.</span>
                </Link>
              </div>
            </section>
          ) : error ? (
            <section style={surfaceCard}>
              <div style={sectionKicker}>Directory error</div>
              <div style={errorTitle}>Unable to load teams</div>
              <p style={emptyText}>{error}</p>
              <GhostBtn onClick={() => { void loadTeams() }}>Retry team load</GhostBtn>
            </section>
          ) : !shouldShowTeamResults ? (
            <section style={teamStartPanelStyle}>
              <div style={teamStartGridStyle}>
                <button type="button" style={teamStartActionStyle} onClick={() => document.getElementById('team-directory-search')?.focus()}>
                  <strong>Team name</strong>
                  <span>Jump to search.</span>
                </button>
                <button type="button" style={teamStartActionStyle} onClick={() => setSortBy('winpct')}>
                  <strong>Best win %</strong>
                  <span>Results signal.</span>
                </button>
                <button type="button" style={teamStartActionStyle} onClick={() => setSortBy('recent')}>
                  <strong>Most recent</strong>
                  <span>Active context.</span>
                </button>
                <button type="button" style={teamStartActionStyle} onClick={() => setBrowseAll(true)}>
                  <strong>Browse</strong>
                  <span>Full board.</span>
                </button>
              </div>
            </section>
          ) : visibleRows.length === 0 ? (
            <section style={surfaceCard}>
              <div style={sectionKicker}>Directory reset</div>
              <div style={emptyTitle}>Search for a team or browse by league.</div>
              <p style={emptyText}>
                Public discovery only shows reviewed team context. Try widening your filters, clearing the search box, or use Data Assist if this league and flight should already exist.
              </p>
              <DataTrustPanel
                title="Why a team may be missing"
                body="Team pages need reviewed roster, scorecard, league, or team-summary context before they appear in public discovery."
              />
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
            </section>
          )}
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
    eyebrow: 'Find',
    title: 'Find a team or roster',
    body: 'Search by team name, league, captain, club, or flight before opening the public team record.',
    metrics: [
      { label: 'Search', value: 'Team' },
      { label: 'Context', value: 'Roster' },
      { label: 'Next', value: 'Open' },
    ],
    href: '#team-directory-search',
    cta: 'Find Teams',
    event: {
      eventName: 'team_search_submitted',
      surface: 'teams',
      metadata: {
        location: 'team_next_actions',
      },
    },
    trust: [
      { label: 'Source', value: 'Reviewed team layer', tone: 'info' },
      { label: 'Status', value: 'Discovery ready', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Availability',
    title: 'Collect who can play',
    body: 'Captain Tools help turn scattered replies into a match-week availability read.',
    metrics: [
      { label: 'Players', value: 'In / out' },
      { label: 'Deadline', value: 'Match week' },
      { label: 'Use', value: 'Lineup' },
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
      { label: 'Freshness', value: 'Week of match', tone: 'good' },
    ],
  },
  {
    eyebrow: 'Lineup',
    title: 'Build the courts',
    body: 'Compare availability, player fit, projected court strength, and opponent context before locking lines.',
    metrics: [
      { label: 'Tool', value: 'Lineup' },
      { label: 'Risk', value: 'Court swaps' },
      { label: 'Next', value: 'Submit' },
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
    eyebrow: 'Fix data',
    title: 'Refresh team context',
    body: 'Use Data Assist when rosters, scorecards, schedules, or team names need a reviewed source.',
    metrics: [
      { label: 'Upload', value: 'Roster' },
      { label: 'Review', value: 'Required' },
      { label: 'Feeds', value: 'Team Hub' },
    ],
    href: '/data-assist?intent=upload-source&context=Team%20Hub',
    cta: DATA_ASSIST_STORY.cta,
    event: {
      eventName: 'data_assist_opened',
      surface: 'data_assist',
      metadata: {
        location: 'team_next_actions',
      },
    },
    trust: [
      { label: 'Source', value: 'User upload', tone: 'info' },
      { label: 'Status', value: 'Review before public use', tone: 'warn' },
    ],
  },
] as const

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
                <span style={teamRecordWinText}>{row.wins}W · {winPct}%</span>
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
          <Metric label="Last match" value={formatShortDate(row.mostRecentMatchDate, '—')} />
        </div>
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

function IntroMiniCard({ title, body }: { title: string; body: string }) {
  return (
    <div style={introMiniCardStyle}>
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

const publicIntroCard: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: 18,
  alignItems: 'stretch',
  borderRadius: 26,
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(7,20,40,0.88))',
  boxShadow: '0 30px 86px rgba(2, 8, 23, 0.40), inset 0 1px 0 rgba(255,255,255,0.05)',
  padding: 20,
  minWidth: 0,
}

const publicIntroCopy: CSSProperties = {
  display: 'grid',
  alignContent: 'center',
  gap: 12,
  minWidth: 0,
}

const publicIntroTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2rem, 4vw, 4rem)',
  lineHeight: 0.98,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const publicIntroText: CSSProperties = {
  margin: 0,
  maxWidth: 720,
  color: 'var(--shell-copy-muted)',
  fontSize: 'clamp(1rem, 1.3vw, 1.15rem)',
  lineHeight: 1.7,
  fontWeight: 700,
}

const publicIntroActions: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const primaryIntroButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'linear-gradient(180deg, #eaff9e 0%, #9be11d 100%)',
  color: '#071226',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 950,
  cursor: 'pointer',
}

const secondaryIntroButton: CSSProperties = {
  ...primaryIntroButton,
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(116,190,255,0.16)',
}

const publicIntroGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const teamHubPreviewGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const teamNextActionGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const introMiniCardStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  alignContent: 'start',
  minHeight: 132,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 720,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const summaryRow = (isSmallMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isSmallMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
  gap: '12px',
  marginTop: '18px',
  minWidth: 0,
})

const statPill: CSSProperties = {
  borderRadius: '20px',
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.7)',
  padding: '16px 18px',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const statValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '28px',
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
  borderRadius: '26px',
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(4,10,24,0.9))',
  boxShadow: '0 30px 86px rgba(2, 8, 23, 0.46), inset 0 1px 0 rgba(255,255,255,0.05)',
  padding: '20px',
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
  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(4, minmax(0, 1fr))',
  gap: '14px',
  minWidth: 0,
  marginTop: '18px',
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

const teamStartPanelStyle: CSSProperties = {
  ...surfaceCard,
  position: 'relative',
  overflow: 'hidden',
  padding: '24px',
  border: '1px solid rgba(155,225,29,0.20)',
  background:
    'linear-gradient(135deg, rgba(155,225,29,0.10), rgba(8,16,34,0.78) 42%, rgba(8,16,34,0.86))',
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
