'use client'

import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState, type ReactNode } from 'react'
import AdsenseSlot from '@/app/components/adsense-slot'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import SiteShell from '@/app/components/site-shell'
import { shouldShowSponsoredPlacements } from '@/lib/access-model'
import { supabase } from '@/lib/supabase'
import { encodeTeamRouteSegment } from '@/lib/team-routes'
import { useProductAccess } from '@/lib/use-product-access'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { formatShortDate, uniqueSorted, cleanText, normalizeTeamName } from '@/lib/captain-formatters'

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

  const [search, setSearch] = useState('')
  const [leagueFilter, setLeagueFilter] = useState('')
  const [flightFilter, setFlightFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('matches')

  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const { access } = useProductAccess()
  const shouldShowAds = shouldShowSponsoredPlacements(access)

  useEffect(() => {
    void loadTeams()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearch('')
        setLeagueFilter('')
        setFlightFilter('')
        setSortBy('matches')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setSearch(params.get('q')?.trim() || '')
    setLeagueFilter(params.get('league')?.trim() || '')
    setFlightFilter(params.get('flight')?.trim() || '')
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

  const totals = useMemo(() => {
    const uniqueTeams = new Set(filteredRows.map((row) => row.key))
    const leagues = new Set(filteredRows.map((row) => row.league).filter(Boolean))
    const flights = new Set(filteredRows.map((row) => row.flight).filter(Boolean))
    const players = filteredRows.reduce((sum, row) => sum + row.playerIds.size, 0)

    return {
      teams: uniqueTeams.size,
      leagues: leagues.size,
      flights: flights.size,
      players,
    }
  }, [filteredRows])

  const avgVisibleMatches = useMemo(() => {
    if (filteredRows.length === 0) return 0
    return filteredRows.reduce((sum, row) => sum + row.matchCount, 0) / filteredRows.length
  }, [filteredRows])

  return (
    <SiteShell active="/explore">
      <main style={pageWrap}>
        <section style={heroSection}>
          <div style={contentWrap}>
            <div style={heroCard}>
              <div style={heroEyebrow}>Teams directory</div>
              <h1 style={heroTitle}>Teams grouped by league, flight, and schedule context.</h1>
              <p style={heroText}>
                Browse real team rows inside their league and flight. The directory stays focused on teams,
                not player names, line labels, or incomplete rows.
              </p>

              <div style={exploreNavRow}>
                <Link href="/explore/players" style={exploreNavLink}>Players</Link>
                <Link href="/explore/rankings" style={exploreNavLink}>Rankings</Link>
                <Link href="/explore/leagues" style={exploreNavLink}>Leagues</Link>
                <Link href="/mylab" style={exploreNavLink}>My Lab</Link>
              </div>

              <div style={heroStatsGrid(isSmallMobile)}>
                <StatPill label="Teams" value={String(totals.teams)} />
                <StatPill label="Leagues" value={String(totals.leagues)} />
                <StatPill label="Flights" value={String(totals.flights)} />
                <StatPill label="Players" value={String(totals.players)} />
              </div>

              {(!access.canUseCaptainWorkflow || !access.canUseLeagueTools) ? (
                <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
                  {!access.canUseCaptainWorkflow ? (
                    <UpgradePrompt
                      planId="captain"
                      compact
                      headline="Need team context to turn into smarter lineups?"
                      body="Unlock Captain to move from the team directory into availability, lineup building, messaging, and weekly execution without guesswork."
                      ctaLabel="Unlock Captain Tools"
                      ctaHref="/pricing"
                      secondaryLabel="See Captain value"
                      secondaryHref="/pricing"
                    />
                  ) : null}
                  {!access.canUseLeagueTools ? (
                    <UpgradePrompt
                      planId="league"
                      compact
                      headline="Organizing team seasons outside the app?"
                      body="League tools give you one place for scheduling, standings, structure, and league-wide coordination instead of spreadsheet cleanup."
                      ctaLabel="Run Your League on TIQ"
                      ctaHref="/pricing"
                      secondaryLabel="See league plan"
                      secondaryHref="/pricing"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section style={contentWrap}>
          {!loading && !error ? (
            <section style={editorialPanel}>
              <p style={sectionKicker}>Directory context</p>
              <h2 style={sectionTitle}>Team cards are best used to understand season shape before you drill in.</h2>
              <p style={sectionText}>
                This board is meant to help you see how teams cluster inside leagues and flights, how
                active they have been, and where to go next for more useful context. It works best as a
                season discovery layer, not as the final word on a team.
              </p>
              <div style={editorialGrid}>
                <StatPill label="Visible teams" value={String(totals.teams)} />
                <StatPill label="Avg matches" value={avgVisibleMatches.toFixed(1)} />
                <StatPill label="Best next step" value="Open team page" />
              </div>
            </section>
          ) : null}

          <section style={filtersCard}>
            <div style={sectionHeader}>
              <div>
                <p style={sectionKicker}>Filters</p>
                <h2 style={sectionTitle}>Scope the team directory</h2>
                <p style={sectionText}>
                  Search by team name, league, or flight.
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
                }}
              >
                Reset
              </button>
            </div>

            <div style={filtersGrid(isMobile)}>
              <div>
                <label style={labelStyle}>Search</label>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search teams"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>League</label>
                <select
                  value={leagueFilter}
                  onChange={(event) => {
                    setLeagueFilter(event.target.value)
                    setFlightFilter('')
                  }}
                  style={{
                    ...inputStyle,
                    borderColor: leagueFilter ? 'rgba(155,225,29,0.42)' : undefined,
                    boxShadow: leagueFilter ? '0 0 0 1px rgba(155,225,29,0.12)' : undefined,
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
                <label style={labelStyle}>Flight</label>
                <select
                  value={flightFilter}
                  onChange={(event) => setFlightFilter(event.target.value)}
                  style={{
                    ...inputStyle,
                    borderColor: flightFilter ? 'rgba(155,225,29,0.42)' : undefined,
                    boxShadow: flightFilter ? '0 0 0 1px rgba(155,225,29,0.12)' : undefined,
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
                <label style={labelStyle}>Sort</label>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortKey)}
                  style={{
                    ...inputStyle,
                    borderColor: sortBy !== 'matches' ? 'rgba(155,225,29,0.42)' : undefined,
                    boxShadow: sortBy !== 'matches' ? '0 0 0 1px rgba(155,225,29,0.12)' : undefined,
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
            {hasActiveFilters ? (
              <div style={filtersActionRow}>
                <button
                  type="button"
                  style={clearFilterButton}
                  onClick={() => {
                    setSearch('')
                    setLeagueFilter('')
                    setFlightFilter('')
                    setSortBy('matches')
                  }}
                >
                  Clear active filters
                </button>
              </div>
            ) : null}
          </section>

          {loading ? (
            <section style={surfaceCard}>
              <div style={sectionKicker}>Directory loading</div>
              <div style={emptyTitle}>Loading teams...</div>
              <p style={emptyText}>Building the directory from valid match rows only.</p>
            </section>
          ) : error ? (
            <section style={surfaceCard}>
              <div style={sectionKicker}>Directory error</div>
              <div style={errorTitle}>Unable to load teams</div>
              <p style={emptyText}>{error}</p>
              <GhostBtn onClick={() => { void loadTeams() }}>Retry team load</GhostBtn>
            </section>
          ) : filteredRows.length === 0 ? (
            <section style={surfaceCard}>
              <div style={sectionKicker}>Directory reset</div>
              <div style={emptyTitle}>Teams are not available yet</div>
              <p style={emptyText}>
                Try widening your filters, clearing the search box, or importing more season data if this league and flight should already exist.
              </p>
            </section>
          ) : (
            <section style={cardsGrid(isTablet, isMobile)}>
              {filteredRows.map((row) => {
                const teamHref = {
                  pathname: `/teams/${encodeTeamRouteSegment(row.team)}`,
                  query: {
                    ...(row.league ? { league: row.league } : {}),
                    ...(row.flight ? { flight: row.flight } : {}),
                  },
                }

                return (
                  <TeamCard key={row.key} href={teamHref} row={row} />
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

function TeamCard({ href, row }: { href: object; row: TeamDirectoryEntry }) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href as Parameters<typeof Link>[0]['href']}
      style={teamCardLink}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <article
        style={{
          ...teamCard,
          transform: hovered ? 'translateY(-3px)' : 'none',
          borderColor: hovered ? 'rgba(116,190,255,0.34)' : 'rgba(116,190,255,0.14)',
          boxShadow: hovered
            ? '0 28px 70px rgba(0,0,0,0.32), 0 0 0 1px rgba(116,190,255,0.12)'
            : '0 20px 55px rgba(0,0,0,0.22)',
        }}
      >
        <div style={teamCardTop}>
          <div>
            <div style={teamName}>{row.team}</div>

            {(row.league || row.flight) ? (
              <div style={metaRow}>
                {row.league ? <span style={metaPillBlue}>{row.league}</span> : null}
                {row.flight ? <span style={metaPillGreen}>{row.flight}</span> : null}
              </div>
            ) : null}
          </div>

          <span
            style={{
              ...viewPill,
              borderColor: hovered ? 'rgba(116,190,255,0.30)' : 'rgba(116,190,255,0.14)',
              color: hovered ? '#e8f2ff' : '#d6e5f5',
            }}
          >
            View team
          </span>
        </div>

        {row.wins + row.losses > 0 ? (() => {
          const total = row.wins + row.losses
          const winPct = Math.round((row.wins / total) * 100)
          return (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', borderRadius: 999, overflow: 'hidden', height: 7, background: 'rgba(255,255,255,0.06)', marginBottom: 5 }}>
                <div style={{ width: `${winPct}%`, background: 'linear-gradient(90deg,rgba(155,225,29,0.65),rgba(74,222,128,0.65))', minWidth: winPct > 0 ? 4 : 0, transition: 'width 400ms ease' }} />
                <div style={{ flex: 1, background: 'rgba(239,68,68,0.22)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(155,225,29,0.8)' }}>{row.wins}W · {winPct}%</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(239,68,68,0.65)' }}>{row.losses}L</span>
              </div>
            </div>
          )
        })() : null}

        {row.recentForm.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ color: 'rgba(190,210,240,0.45)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', flexShrink: 0 }}>Form</span>
            {row.recentForm.map((r, i) => (
              <span key={i} style={{ width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, fontSize: 10, fontWeight: 900, background: r === 'W' ? 'rgba(155,225,29,0.12)' : 'rgba(239,68,68,0.10)', color: r === 'W' ? '#d9f84a' : '#fca5a5', border: `1px solid ${r === 'W' ? 'rgba(155,225,29,0.22)' : 'rgba(239,68,68,0.18)'}` }}>
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
      </article>
    </Link>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCard}>
      <div style={metricValue}>{value}</div>
      <div style={metricLabel}>{label}</div>
    </div>
  )
}

const pageWrap: CSSProperties = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top, rgba(37,91,227,0.18) 0%, rgba(15,22,50,0) 28%), linear-gradient(180deg, #07111f 0%, #091525 100%)',
  color: '#f8fbff',
  paddingBottom: '56px',
}

const contentWrap: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '0 20px',
}

const heroSection: CSSProperties = {
  padding: '28px 0 18px',
}

const heroCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '28px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(9,20,38,0.96) 0%, rgba(8,18,34,0.92) 100%)',
  boxShadow: '0 30px 70px rgba(0,0,0,0.32)',
  padding: '28px',
}

const heroEyebrow: CSSProperties = {
  color: '#8fb8ff',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const heroTitle: CSSProperties = {
  margin: '10px 0 0',
  fontSize: 'clamp(30px, 5vw, 48px)',
  lineHeight: 1.02,
  letterSpacing: '-0.05em',
  fontWeight: 900,
}

const heroText: CSSProperties = {
  margin: '14px 0 0',
  maxWidth: '760px',
  color: 'rgba(214,228,245,0.78)',
  fontSize: '15px',
  lineHeight: 1.75,
}

const exploreNavRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '16px',
}

const exploreNavLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '36px',
  padding: '0 13px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(255,255,255,0.06)',
  color: '#f8fbff',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: 800,
}

const heroStatsGrid = (isSmallMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isSmallMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
  gap: '12px',
  marginTop: '22px',
})

const statPill: CSSProperties = {
  borderRadius: '20px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(8, 17, 31, 0.78)',
  padding: '16px 18px',
}

const statValue: CSSProperties = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const statLabel: CSSProperties = {
  marginTop: '4px',
  color: 'rgba(210,225,244,0.72)',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const filtersCard: CSSProperties = {
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(10,20,36,0.96) 0%, rgba(8,17,31,0.92) 100%)',
  boxShadow: '0 22px 60px rgba(0,0,0,0.24)',
  padding: '22px',
}

const sectionHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  flexWrap: 'wrap',
}

const sectionKicker: CSSProperties = {
  margin: 0,
  color: '#8fb8ff',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

const sectionTitle: CSSProperties = {
  margin: '8px 0 0',
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.08,
  letterSpacing: '-0.04em',
  fontWeight: 900,
}

const sectionText: CSSProperties = {
  margin: '10px 0 0',
  maxWidth: '760px',
  color: 'rgba(210,225,244,0.74)',
  fontSize: '14px',
  lineHeight: 1.7,
}

const resetButton: CSSProperties = {
  appearance: 'none',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(8, 17, 31, 0.82)',
  color: '#d6e5f5',
  padding: '10px 14px',
  borderRadius: '14px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 700,
}

const editorialPanel: CSSProperties = {
  display: 'grid',
  gap: '14px',
  marginBottom: '18px',
  padding: '24px',
  borderRadius: '26px',
  background: 'linear-gradient(180deg, rgba(19,38,70,0.74) 0%, rgba(9,19,36,0.96) 100%)',
  border: '1px solid rgba(116,190,255,0.14)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.18), inset 0 1px 0 rgba(255,255,255,0.03)',
}

const editorialGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
}

const filtersActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '14px',
}

const clearFilterButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '38px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e6eefb',
  fontWeight: 800,
  cursor: 'pointer',
}

const ghostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  marginTop: '12px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#e7eefb',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '13px',
  cursor: 'pointer',
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...ghostButton, ...(hovered ? { background: 'rgba(255,255,255,0.12)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(2,10,24,0.28)' } : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

const filtersGrid = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))',
  gap: '14px',
  marginTop: '18px',
})

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  color: '#cfe0f5',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const inputStyle: CSSProperties = {
  width: '100%',
  height: '46px',
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(5, 12, 24, 0.88)',
  color: '#f8fbff',
  padding: '0 14px',
  fontSize: '14px',
  outline: 'none',
  colorScheme: 'dark',
}

const surfaceCard: CSSProperties = {
  marginTop: '18px',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(10,20,36,0.96) 0%, rgba(8,17,31,0.92) 100%)',
  padding: '28px',
}

const emptyTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '22px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const errorTitle: CSSProperties = {
  color: '#ffb4b4',
  fontSize: '22px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const emptyText: CSSProperties = {
  marginTop: '8px',
  color: 'rgba(210,225,244,0.72)',
  fontSize: '14px',
  lineHeight: 1.7,
}

const cardsGrid = (isTablet: boolean, isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
  gap: '16px',
  marginTop: '18px',
})

const teamCardLink: CSSProperties = {
  textDecoration: 'none',
}

const teamCard: CSSProperties = {
  height: '100%',
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(10,20,36,0.96) 0%, rgba(8,17,31,0.92) 100%)',
  boxShadow: '0 20px 55px rgba(0,0,0,0.22)',
  padding: '20px',
  transition: 'transform 140ms ease, border-color 140ms ease',
}

const teamCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
}

const teamName: CSSProperties = {
  color: '#f8fbff',
  fontSize: '23px',
  lineHeight: 1.08,
  letterSpacing: '-0.04em',
  fontWeight: 900,
}

const metaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginTop: '12px',
}

const metaPillBlue: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '7px 10px',
  borderRadius: '999px',
  background: 'rgba(37,91,227,0.18)',
  border: '1px solid rgba(116,190,255,0.16)',
  color: '#cde1ff',
  fontSize: '12px',
  fontWeight: 700,
}

const metaPillGreen: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '7px 10px',
  borderRadius: '999px',
  background: 'rgba(74, 222, 128, 0.12)',
  border: '1px solid rgba(155,225,29,0.16)',
  color: '#d8f6c5',
  fontSize: '12px',
  fontWeight: 700,
}

const viewPill: CSSProperties = {
  whiteSpace: 'nowrap',
  padding: '8px 10px',
  borderRadius: '999px',
  background: 'rgba(8,17,31,0.82)',
  border: '1px solid rgba(116,190,255,0.14)',
  color: '#d6e5f5',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const metricsGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '10px',
  marginTop: '18px',
}

const metricCard: CSSProperties = {
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(6, 13, 25, 0.8)',
  padding: '14px 12px',
}

const metricValue: CSSProperties = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const metricLabel: CSSProperties = {
  marginTop: '5px',
  color: 'rgba(210,225,244,0.7)',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}
