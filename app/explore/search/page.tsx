'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useTheme, type ThemeMode } from '@/app/components/theme-provider'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import {
  badgeBlue,
  badgeGreen,
  buttonGhost,
  buttonPrimary,
  colors,
  pageShell,
  pageSubtitle,
  pageTitle,
  sectionKicker,
  sectionStack,
  sectionTitle,
  surfaceCard,
  surfaceCardStrong,
} from '@/lib/design-system'
import { getClientAuthState } from '@/lib/auth'
import { buildExploreLeagueHref, getCompetitionLayerLabel } from '@/lib/competition-layers'
import type { LeagueCard, LeagueSummaryPayload } from '@/lib/league-summary'
import { type UserRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { cleanText } from '@/lib/captain-formatters'

type SearchScope = 'players' | 'teams' | 'leagues' | 'flight' | 'area'

type PlayerSearchRow = {
  id: string
  name: string
  location?: string | null
  overall_dynamic_rating?: number | null
  overall_usta_dynamic_rating?: number | null
}

type TeamMatchRow = {
  id: string
  home_team: string | null
  away_team: string | null
  league_name: string | null
  flight: string | null
  match_date: string | null
}

type TeamSearchResult = {
  key: string
  team: string
  league: string | null
  flight: string | null
  matchCount: number
  latestMatchDate: string | null
}

type MatchupSuggestion = {
  key: string
  title: string
  text: string
  href: string
}

const searchScopes: Array<{ value: SearchScope; label: string }> = [
  { value: 'players', label: 'Player name' },
  { value: 'teams', label: 'Team' },
  { value: 'leagues', label: 'League' },
  { value: 'flight', label: 'Flight' },
  { value: 'area', label: 'Area' },
]

function formatCompactDate(value: string | null | undefined) {
  if (!value) return 'No recent match date'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function buildTeamKey(team: string, league: string | null, flight: string | null) {
  return `${team}__${league || ''}__${flight || ''}`
}

export default function ExploreSearchPage() {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])

  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('players')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [players, setPlayers] = useState<PlayerSearchRow[]>([])
  const [teams, setTeams] = useState<TeamSearchResult[]>([])
  const [leagues, setLeagues] = useState<LeagueCard[]>([])
  const [searchReady, setSearchReady] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nextQuery = params.get('q')?.trim() || ''
    const nextScope = params.get('scope')

    setQuery(nextQuery)
    setScope(
      nextScope === 'players' ||
        nextScope === 'teams' ||
        nextScope === 'leagues' ||
        nextScope === 'flight' ||
        nextScope === 'area'
        ? nextScope
        : 'players',
    )
    setSearchReady(true)
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
    if (!searchReady) return

    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      setPlayers([])
      setTeams([])
      setLeagues([])
      setError('')
      setLoading(false)
      return
    }

    let active = true

    async function runSearch() {
      setLoading(true)
      setError('')

      try {
        const [playersResult, teamsResult, leagueResult] = await Promise.all([
          searchPlayers(trimmedQuery),
          searchTeams(trimmedQuery),
          searchLeagues(trimmedQuery, scope),
        ])

        if (!active) return

        setPlayers(playersResult)
        setTeams(teamsResult)
        setLeagues(leagueResult)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Search failed.')
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    void runSearch()

    return () => {
      active = false
    }
  }, [query, scope, searchReady])

  function syncUrl(nextQuery: string, nextScope: SearchScope) {
    const params = new URLSearchParams()
    if (nextQuery.trim()) params.set('q', nextQuery.trim())
    params.set('scope', nextScope)
    const nextSearch = params.toString()
    window.history.replaceState(null, '', nextSearch ? `?${nextSearch}` : window.location.pathname)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    syncUrl(query, scope)
    setQuery((current) => current.trimStart())
  }

  const matchedFlights = useMemo(() => {
    return Array.from(
      new Set(leagues.map((league) => cleanText(league.flight)).filter(Boolean)),
    ).slice(0, 6)
  }, [leagues])

  const matchedAreas = useMemo(() => {
    return Array.from(
      new Set(leagues.map((league) => cleanText(league.districtArea)).filter(Boolean)),
    ).slice(0, 6)
  }, [leagues])

  const matchupSuggestions = useMemo<MatchupSuggestion[]>(() => {
    if (players.length < 2) return []

    const suggestions: MatchupSuggestion[] = []
    const seed = players.slice(0, 4)

    for (let index = 1; index < seed.length; index += 1) {
      const left = seed[0]
      const right = seed[index]
      suggestions.push({
        key: `${left.id}-${right.id}`,
        title: `${left.name} vs ${right.name}`,
        text: 'Launch a quick singles comparison from search results.',
        href: `/matchup?type=singles&playerA=${encodeURIComponent(left.id)}&playerB=${encodeURIComponent(right.id)}`,
      })
    }

    return suggestions.slice(0, 3)
  }, [players])

  const totalResults = players.length + teams.length + leagues.length + matchupSuggestions.length
  const selectedScopeLabel = searchScopes.find((item) => item.value === scope)?.label ?? 'Player name'

  const upgradeConfig = useMemo(() => {
    if (scope === 'players') {
      if (access.canUseAdvancedPlayerInsights) return null
      return {
        planId: 'player_plus' as const,
        headline: 'Want better answers than a basic directory?',
        body: 'Unlock Player+ to move from simple search into projections, role fit, and practical player insight.',
      }
    }

    if (scope === 'teams') {
      if (access.canUseCaptainWorkflow) return null
      return {
        planId: 'captain' as const,
        headline: 'Still piecing team context together manually?',
        body: 'Captain connects availability, lineup building, scenarios, and messaging so team search turns into weekly action.',
      }
    }

    if (access.canUseLeagueTools) return null
    return {
      planId: 'league' as const,
      headline: 'Need league structure, not more spreadsheet cleanup?',
      body: 'League tools turn flights, standings, schedules, and organizer communication into one cleaner operating layer.',
    }
  }, [access.canUseAdvancedPlayerInsights, access.canUseCaptainWorkflow, access.canUseLeagueTools, scope])

  return (
    <SiteShell active="explore">
      <div
        style={{
          ...pageShell,
          display: 'grid',
          gap: isMobile ? 18 : 24,
          paddingTop: isMobile ? 14 : 20,
        }}
      >
        <section
          style={{
            ...surfaceCardStrong,
            padding: isSmallMobile ? 18 : isMobile ? 22 : 28,
            display: 'grid',
            gap: 18,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'radial-gradient(circle at 18% 22%, rgba(74,163,255,0.16) 0%, transparent 28%), radial-gradient(circle at 82% 18%, rgba(155,225,29,0.14) 0%, transparent 24%)',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 12 }}>
            <div style={sectionKicker}>Unified Explore Search</div>
            <h1 style={{ ...pageTitle, fontSize: 'clamp(2.2rem, 4vw, 4rem)', lineHeight: 0.95 }}>
              Search once. See the right layer faster.
            </h1>
            <p style={{ ...pageSubtitle, marginTop: 0, maxWidth: 840 }}>
              This is the cleaner discovery path between the homepage and the rest of the product:
              players, teams, leagues, flights, areas, and quick matchup actions in one place.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr' : 'minmax(172px, 196px) minmax(0, 1fr) auto',
              gap: 10,
              alignItems: isMobile ? 'stretch' : 'end',
            }}
          >
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={searchLabelStyle}>Search by</span>
              <select
                value={scope}
                onChange={(event) => {
                  const nextScope = event.target.value as SearchScope
                  setScope(nextScope)
                  syncUrl(query, nextScope)
                }}
                style={getSearchSelectStyle(theme)}
                aria-label="Search by scope"
              >
                {searchScopes.map((item) => (
                  <option key={item.value} value={item.value} style={getSearchOptionStyle(theme)}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={searchLabelStyle}>Search term</span>
              <div style={getSearchInputWrapStyle(theme)}>
                <SearchIcon />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Search ${selectedScopeLabel.toLowerCase()}...`}
                  aria-label={`Search ${selectedScopeLabel.toLowerCase()}`}
                  style={getSearchInputStyle(theme)}
                />
              </div>
            </label>

            <button
              type="submit"
              style={{
                ...buttonPrimary,
                minHeight: isSmallMobile ? 52 : 56,
                minWidth: isTablet ? '100%' : 142,
                width: isMobile ? '100%' : undefined,
                border: 'none',
              }}
            >
              Search now
            </button>
          </form>

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <span style={badgeBlue}>{players.length} players</span>
            <span style={badgeBlue}>{teams.length} teams</span>
            <span style={badgeGreen}>{leagues.length} leagues</span>
            <span style={badgeGreen}>{matchupSuggestions.length} matchup actions</span>
            <span style={{ color: 'var(--muted-strong)', fontSize: 13, fontWeight: 700 }}>
              {query.trim() ? `${totalResults} surfaced for "${query.trim()}"` : 'Start with a search to unlock grouped results.'}
            </span>
          </div>
        </section>

        <section style={sectionStack}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.16fr) minmax(280px, 0.84fr)',
              gap: 16,
              alignItems: 'stretch',
            }}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={sectionKicker}>Search results</div>
              <h2 style={sectionTitle}>
                Grouped results keep discovery clear instead of sending users through four separate guesses.
              </h2>
              <p style={{ ...pageSubtitle, marginTop: 0 }}>
                Search by the identifier you know first, then move into the right TIQ surface without losing context.
              </p>
            </div>

            <div
              style={{
                ...surfaceCard,
                display: 'grid',
                gap: 10,
                padding: isSmallMobile ? 14 : 16,
                alignContent: 'start',
                background: isLight
                  ? 'color-mix(in srgb, var(--surface) 96%, var(--brand-blue-2) 4%)'
                  : 'color-mix(in srgb, var(--surface) 92%, var(--brand-blue-2) 8%)',
              }}
            >
              <div style={sectionKicker}>Quick context</div>
              <div style={{ color: 'var(--foreground-strong)', fontSize: 18, fontWeight: 900, lineHeight: 1.08 }}>
                Scope drives the answer:
              </div>
              <div style={{ color: 'var(--muted-strong)', fontSize: 13, lineHeight: 1.68 }}>
                Players lead toward Player+. Teams point naturally toward Captain. League, flight, and area searches lean into League tools and structure.
              </div>
            </div>
          </div>

          {error ? (
            <section style={{ ...surfaceCard, padding: 18, color: '#fecaca', borderColor: 'rgba(248,113,113,0.3)' }}>
              {error}
            </section>
          ) : null}

          {loading ? (
            <section style={{ ...surfaceCard, padding: 18 }}>
              <div style={sectionKicker}>Searching</div>
              <div style={{ color: 'var(--foreground-strong)', fontSize: 20, fontWeight: 900 }}>
                Pulling players, teams, leagues, and matchup shortcuts together...
              </div>
            </section>
          ) : null}

          {!loading && query.trim().length === 0 ? (
            <section style={emptyStateStyle}>
              <div style={sectionKicker}>Start with a name, team, flight, area, or league</div>
              <div style={{ color: 'var(--foreground-strong)', fontSize: 24, fontWeight: 900, lineHeight: 1.05 }}>
                One search now opens the right product layer instead of making the user guess first.
              </div>
              <div style={{ color: 'var(--muted-strong)', fontSize: 14, lineHeight: 1.7, maxWidth: 760 }}>
                Try a player name, a team, a league, a flight like 3.5, or an area or district. This is the cleaner handoff from homepage discovery into real TIQ surfaces.
              </div>
            </section>
          ) : null}

          {!loading && query.trim().length > 0 ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1fr) minmax(280px, 0.74fr)',
                  gap: 16,
                }}
              >
                <ResultGroup
                  title="Players"
                  count={players.length}
                  emptyMessage="No player matches yet. Try broadening the name or switching scope."
                  ctaHref="/explore/players"
                  ctaLabel="Open player directory"
                >
                  {players.map((player) => (
                    <Link key={player.id} href={`/players/${player.id}`} style={getResultCardStyle(theme)}>
                      <div style={resultHeaderStyle}>
                        <div>
                          <div style={resultTitleStyle}>{player.name}</div>
                          <div style={resultMetaStyle}>{cleanText(player.location) || 'Player profile'}</div>
                        </div>
                        <div style={resultBadgeWrapStyle}>
                          {typeof player.overall_usta_dynamic_rating === 'number' ? (
                            <span style={miniBadgeBlue}>USTA {player.overall_usta_dynamic_rating.toFixed(2)}</span>
                          ) : null}
                          {typeof player.overall_dynamic_rating === 'number' ? (
                            <span style={miniBadgeGreen}>TIQ {player.overall_dynamic_rating.toFixed(2)}</span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  ))}
                </ResultGroup>

                <ResultGroup
                  title="Matchup shortcuts"
                  count={matchupSuggestions.length}
                  emptyMessage="Once at least two player results match, quick comparison actions show up here."
                  ctaHref="/matchup"
                  ctaLabel="Open matchup builder"
                >
                  {matchupSuggestions.map((item) => (
                    <Link key={item.key} href={item.href} style={getResultCardStyle(theme)}>
                      <div style={resultTitleStyle}>{item.title}</div>
                      <div style={resultMetaStyle}>{item.text}</div>
                    </Link>
                  ))}
                </ResultGroup>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: 16,
                }}
              >
                <ResultGroup
                  title="Teams"
                  count={teams.length}
                  emptyMessage="No team matches surfaced yet. Try a league or broader team search."
                  ctaHref="/explore/teams"
                  ctaLabel="Open teams"
                >
                  {teams.map((team) => (
                    <Link
                      key={team.key}
                      href={`/teams/${encodeURIComponent(team.team)}${team.league || team.flight ? `?${new URLSearchParams({
                        ...(team.league ? { league: team.league } : {}),
                        ...(team.flight ? { flight: team.flight } : {}),
                      }).toString()}` : ''}`}
                      style={getResultCardStyle(theme)}
                    >
                      <div style={resultHeaderStyle}>
                        <div>
                          <div style={resultTitleStyle}>{team.team}</div>
                          <div style={resultMetaStyle}>
                            {[team.league, team.flight, `${team.matchCount} matches`].filter(Boolean).join(' • ')}
                          </div>
                        </div>
                        <span style={miniBadgeBlue}>{formatCompactDate(team.latestMatchDate)}</span>
                      </div>
                    </Link>
                  ))}
                </ResultGroup>

                <ResultGroup
                  title="Leagues"
                  count={leagues.length}
                  emptyMessage="No league matches surfaced yet. Try a section, district, area, or different league name."
                  ctaHref="/explore/leagues"
                  ctaLabel="Open leagues"
                >
                  {leagues.map((league) => (
                    <Link key={league.key} href={buildExploreLeagueHref(league)} style={getResultCardStyle(theme)}>
                      <div style={resultHeaderStyle}>
                        <div>
                          <div style={resultTitleStyle}>{league.leagueName}</div>
                          <div style={resultMetaStyle}>
                            {[league.flight, league.ustaSection, league.districtArea].filter(Boolean).join(' • ') || 'League context'}
                          </div>
                        </div>
                        <div style={resultBadgeWrapStyle}>
                          <span style={miniBadgeBlue}>{getCompetitionLayerLabel(league.competitionLayer)}</span>
                          <span style={miniBadgeGreen}>{league.matchCount} matches</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </ResultGroup>
              </div>

              {(matchedFlights.length > 0 || matchedAreas.length > 0) ? (
                <section style={{ ...surfaceCard, padding: isSmallMobile ? 16 : 18, display: 'grid', gap: 14 }}>
                  <div style={sectionKicker}>Matched filters</div>
                  <div style={{ color: 'var(--foreground-strong)', fontSize: 22, fontWeight: 900, lineHeight: 1.04 }}>
                    Jump straight into the exact flight or area that matched.
                  </div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {matchedFlights.length > 0 ? (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={matchedLabelStyle}>Flights</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          {matchedFlights.map((flight) => (
                            <Link key={flight} href={`/explore/leagues?q=${encodeURIComponent(flight)}`} style={filterJumpStyle}>
                              {flight}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {matchedAreas.length > 0 ? (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <div style={matchedLabelStyle}>Areas</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          {matchedAreas.map((area) => (
                            <Link key={area} href={`/explore/leagues?q=${encodeURIComponent(area)}`} style={filterJumpStyle}>
                              {area}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </section>

        {upgradeConfig ? (
          <UpgradePrompt
            planId={upgradeConfig.planId}
            headline={upgradeConfig.headline}
            body={upgradeConfig.body}
            secondaryHref="/pricing"
            secondaryLabel="Compare plans"
          />
        ) : null}
      </div>
    </SiteShell>
  )
}

async function searchPlayers(term: string): Promise<PlayerSearchRow[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, name, location, overall_dynamic_rating, overall_usta_dynamic_rating')
    .order('name', { ascending: true })
    .limit(250)

  if (error) throw new Error(error.message)

  const normalizedTerm = term.toLowerCase()
  return (((data || []) as PlayerSearchRow[]) || [])
    .filter((row) => {
      const haystack = [row.name, row.location || ''].join(' ').toLowerCase()
      return haystack.includes(normalizedTerm)
    })
    .slice(0, 8)
}

async function searchTeams(term: string): Promise<TeamSearchResult[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team, league_name, flight, match_date')
    .is('line_number', null)
    .order('match_date', { ascending: false })
    .limit(700)

  if (error) throw new Error(error.message)

  const normalizedTerm = term.toLowerCase()
  const teamMap = new Map<string, TeamSearchResult>()

  for (const row of ((data || []) as TeamMatchRow[]) || []) {
    for (const teamName of [cleanText(row.home_team), cleanText(row.away_team)]) {
      if (!teamName) continue

      const league = cleanText(row.league_name) || null
      const flight = cleanText(row.flight) || null
      const haystack = [teamName, league || '', flight || ''].join(' ').toLowerCase()
      if (!haystack.includes(normalizedTerm)) continue

      const key = buildTeamKey(teamName, league, flight)
      const current = teamMap.get(key)

      if (current) {
        current.matchCount += 1
        if (!current.latestMatchDate && row.match_date) {
          current.latestMatchDate = row.match_date
        }
      } else {
        teamMap.set(key, {
          key,
          team: teamName,
          league,
          flight,
          matchCount: 1,
          latestMatchDate: row.match_date || null,
        })
      }
    }
  }

  return Array.from(teamMap.values()).slice(0, 8)
}

async function searchLeagues(term: string, scope: SearchScope): Promise<LeagueCard[]> {
  const response = await fetch('/api/leagues/summary', { cache: 'no-store' })
  const payload = (await response.json()) as LeagueSummaryPayload & { error?: string }

  if (!response.ok) {
    throw new Error(payload.error || 'Failed to load league search results.')
  }

  const normalizedTerm = term.toLowerCase()

  return (payload.leagues || [])
    .filter((league) => {
      const matchLeague = league.leagueName.toLowerCase().includes(normalizedTerm)
      const matchFlight = league.flight.toLowerCase().includes(normalizedTerm)
      const matchArea = league.districtArea.toLowerCase().includes(normalizedTerm)
      const matchSection = league.ustaSection.toLowerCase().includes(normalizedTerm)

      if (scope === 'flight') return matchFlight
      if (scope === 'area') return matchArea || matchSection
      if (scope === 'leagues') return matchLeague || matchFlight || matchArea || matchSection

      return matchLeague || matchFlight || matchArea || matchSection
    })
    .slice(0, 8)
}

function ResultGroup({
  title,
  count,
  emptyMessage,
  ctaHref,
  ctaLabel,
  children,
}: {
  title: string
  count: number
  emptyMessage: string
  ctaHref: string
  ctaLabel: string
  children: ReactNode
}) {
  return (
    <section style={{ ...surfaceCard, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={sectionKicker}>{title}</div>
          <div style={{ color: 'var(--foreground-strong)', fontSize: 20, fontWeight: 900, lineHeight: 1.04 }}>
            {count} {title.toLowerCase()} surfaced
          </div>
        </div>
        <Link href={ctaHref} style={buttonGhost}>
          {ctaLabel}
        </Link>
      </div>

      {count === 0 ? (
        <div style={{ color: 'var(--muted-strong)', fontSize: 13, lineHeight: 1.65 }}>{emptyMessage}</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>{children}</div>
      )}
    </section>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M8.6 14.2a5.6 5.6 0 1 1 0-11.2 5.6 5.6 0 0 1 0 11.2Zm7 1.1-3.1-3.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const searchLabelStyle: CSSProperties = {
  color: 'var(--muted-strong)',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

function getSearchSelectStyle(theme: ThemeMode): CSSProperties {
  const isLight = theme === 'light'
  return {
    ...surfaceCard,
    minHeight: 56,
    padding: '0 14px',
    border: '1px solid var(--home-input-border)',
    background: 'var(--home-input-bg)',
    color: 'var(--foreground-strong)',
    fontSize: 14,
    fontWeight: 700,
    outline: 'none',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
    colorScheme: theme,
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage: isLight
      ? 'linear-gradient(45deg, transparent 50%, rgba(17,32,56,0.72) 50%), linear-gradient(135deg, rgba(17,32,56,0.72) 50%, transparent 50%)'
      : 'linear-gradient(45deg, transparent 50%, rgba(255,255,255,0.88) 50%), linear-gradient(135deg, rgba(255,255,255,0.88) 50%, transparent 50%)',
    backgroundPosition: 'calc(100% - 20px) calc(50% - 2px), calc(100% - 14px) calc(50% - 2px)',
    backgroundSize: '6px 6px, 6px 6px',
    backgroundRepeat: 'no-repeat',
    paddingRight: 34,
  }
}

function getSearchOptionStyle(theme: ThemeMode): CSSProperties {
  return {
    backgroundColor: theme === 'light' ? '#f4f7fb' : '#13233b',
    color: theme === 'light' ? '#112038' : '#f5f8ff',
  }
}

function getSearchInputWrapStyle(_theme: ThemeMode): CSSProperties {
  return {
    ...surfaceCard,
    minHeight: 56,
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: '1px solid var(--home-input-border)',
    background: 'var(--home-input-bg)',
    color: 'var(--muted-strong)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  }
}

function getSearchInputStyle(_theme: ThemeMode): CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    border: 'none',
    background: 'transparent',
    color: 'var(--foreground-strong)',
    fontSize: 15,
    outline: 'none',
  }
}

const emptyStateStyle: CSSProperties = {
  ...surfaceCard,
  padding: 22,
  display: 'grid',
  gap: 12,
  background: 'color-mix(in srgb, var(--surface) 95%, var(--brand-blue-2) 5%)',
}

function getResultCardStyle(theme: ThemeMode): CSSProperties {
  return {
    ...surfaceCard,
    padding: '14px 16px',
    display: 'grid',
    gap: 8,
    textDecoration: 'none',
    background:
      theme === 'light'
        ? 'color-mix(in srgb, var(--surface) 97%, var(--brand-blue-2) 3%)'
        : 'color-mix(in srgb, var(--surface) 94%, var(--brand-blue-2) 6%)',
  }
}

const resultHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'start',
  flexWrap: 'wrap',
}

const resultTitleStyle: CSSProperties = {
  color: colors.textStrong,
  fontSize: 16,
  fontWeight: 900,
  lineHeight: 1.08,
}

const resultMetaStyle: CSSProperties = {
  color: colors.mutedStrong,
  fontSize: 13,
  lineHeight: 1.6,
}

const resultBadgeWrapStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
}

const miniBadgeBlue: CSSProperties = {
  ...badgeBlue,
  minHeight: 28,
  padding: '0 10px',
  fontSize: 11,
}

const miniBadgeGreen: CSSProperties = {
  ...badgeGreen,
  minHeight: 28,
  padding: '0 10px',
  fontSize: 11,
}

const matchedLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const filterJumpStyle: CSSProperties = {
  ...buttonGhost,
  minHeight: 38,
  paddingInline: 14,
}
