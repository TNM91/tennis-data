'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import {
  badgeBlue,
  badgeGreen,
  buttonGhost,
  buttonPrimary,
  colors,
  pageShell,
  sectionKicker,
  sectionStack,
  sectionTitle,
  surfaceCard,
  surfaceCardStrong,
} from '@/lib/design-system'
import { buildExploreLeagueHref, getCompetitionLayerLabel } from '@/lib/competition-layers'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'
import type { LeagueCard, LeagueSummaryPayload } from '@/lib/league-summary'
import { supabase } from '@/lib/supabase'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { encodeTeamRouteSegment } from '@/lib/team-routes'
import { cleanText, normalizeTeamName, parseDisplayDate } from '@/lib/captain-formatters'
import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'

type SearchScope = 'players' | 'teams' | 'leagues' | 'flight' | 'area'

type PlayerSearchRow = {
  id: string
  name: string
  location?: string | null
  overall_rating?: number | null
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
  source?: string | null
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

const scopeGuides: Record<
  SearchScope,
  {
    eyebrow: string
    placeholder: string
    emptyTitle: string
    examples: string[]
  }
> = {
  players: {
    eyebrow: 'Player lookup',
    placeholder: 'Search a player name...',
    emptyTitle: 'Try a name.',
    examples: ['Johnson', 'Smith', 'Garcia'],
  },
  teams: {
    eyebrow: 'Team lookup',
    placeholder: 'Search a team name, league, or flight...',
    emptyTitle: 'Try a team clue.',
    examples: ['3.5', '40 & Over', 'Dallas'],
  },
  leagues: {
    eyebrow: 'League lookup',
    placeholder: 'Search a league, section, area, or flight...',
    emptyTitle: 'Try a league detail.',
    examples: ['Adult 18 & Over', 'Texas', 'Tri-Level'],
  },
  flight: {
    eyebrow: 'Flight lookup',
    placeholder: 'Search a flight like 3.5 or 4.0...',
    emptyTitle: 'Try a flight.',
    examples: ['3.0', '3.5', '4.0'],
  },
  area: {
    eyebrow: 'Area lookup',
    placeholder: 'Search an area, district, or section...',
    emptyTitle: 'Try an area.',
    examples: ['Dallas', 'Texas', 'Southern'],
  },
}

const scopeCommandCards: Array<{
  scope: SearchScope
  label: string
  title: string
  icon: TiqFeatureIconName
}> = [
  { scope: 'players', label: 'Players', title: 'Ratings and recent context', icon: 'playerRatings' },
  { scope: 'teams', label: 'Teams', title: 'Rosters and match clues', icon: 'teamRankings' },
  { scope: 'leagues', label: 'Leagues', title: 'Seasons, flights, and standings', icon: 'reports' },
  { scope: 'flight', label: 'Flight', title: 'Rating-level lane', icon: 'matchupAnalysis' },
  { scope: 'area', label: 'Area', title: 'Local league map', icon: 'opponentScouting' },
]

const SEARCH_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('relentless-competitor-4-0')
const SEARCH_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(SEARCH_PLAYER_IDENTITY)
const SEARCH_LEVEL_UP_HREF = `/level-up/${SEARCH_PLAYER_IDENTITY.slug}#level-up-flow`

function formatCompactDate(value: string | null | undefined) {
  if (!value) return 'No recent match date'

  const date = parseDisplayDate(value)
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
  return (
    <SiteShell active="explore">
      <JsonLd id="explore-search-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Search', '/explore/search')} />
      <ExploreSearchContent />
    </SiteShell>
  )
}

function ExploreSearchContent() {
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('players')
  const [ratingBand, setRatingBand] = useState<'all' | '2.5' | '3.0' | '3.5' | '4.0' | '4.5+'>('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [seasonFilter, setSeasonFilter] = useState('all')
  const [genderFilter, setGenderFilter] = useState('all')
  const [leagueRatingFilter, setLeagueRatingFilter] = useState('all')
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

  const leagueYears = useMemo(() => uniqueSorted(leagues.map((league) => league.year)), [leagues])
  const leagueSeasons = useMemo(() => uniqueSorted(leagues.map((league) => league.season)), [leagues])
  const leagueGenders = useMemo(() => uniqueSorted(leagues.map((league) => league.gender)), [leagues])
  const leagueRatings = useMemo(() => uniqueSorted(leagues.map((league) => league.rating)), [leagues])

  const filteredPlayers = useMemo(() => {
    if (ratingBand === 'all') return players
    return players.filter((p) => {
      const r = p.overall_dynamic_rating ?? p.overall_rating
      if (typeof r !== 'number') return false
      if (ratingBand === '2.5') return r >= 2.25 && r < 2.75
      if (ratingBand === '3.0') return r >= 2.75 && r < 3.25
      if (ratingBand === '3.5') return r >= 3.25 && r < 3.75
      if (ratingBand === '4.0') return r >= 3.75 && r < 4.25
      return r >= 4.25
    })
  }, [players, ratingBand])

  const matchupSuggestions = useMemo<MatchupSuggestion[]>(() => {
    if (filteredPlayers.length < 2) return []

    const suggestions: MatchupSuggestion[] = []
    const seed = filteredPlayers.slice(0, 4)

    for (let index = 1; index < seed.length; index += 1) {
      const left = seed[0]
      const right = seed[index]
      suggestions.push({
        key: `${left.id}-${right.id}`,
        title: `${left.name} vs ${right.name}`,
        text: 'Open My Lab prep with these players in mind.',
        href: `/mylab?playerA=${encodeURIComponent(left.id)}&playerB=${encodeURIComponent(right.id)}`,
      })
    }

    return suggestions.slice(0, 3)
  }, [filteredPlayers])

  const filteredLeagues = useMemo(() => {
    return leagues.filter((league) => {
      const matchesYear = yearFilter === 'all' || league.year === yearFilter
      const matchesSeason = seasonFilter === 'all' || league.season === seasonFilter
      const matchesGender = genderFilter === 'all' || league.gender === genderFilter
      const matchesRating = leagueRatingFilter === 'all' || league.rating === leagueRatingFilter
      return matchesYear && matchesSeason && matchesGender && matchesRating
    })
  }, [leagues, yearFilter, seasonFilter, genderFilter, leagueRatingFilter])

  const selectedScopeLabel = searchScopes.find((item) => item.value === scope)?.label ?? 'Player name'
  const selectedScopeGuide = scopeGuides[scope]
  const hasQuery = Boolean(query.trim())
  const showPlayerResults = scope === 'players'
  const showTeamResults = scope === 'teams'
  const showLeagueResults = scope === 'leagues' || scope === 'flight' || scope === 'area'
  const totalResults =
    (showPlayerResults ? filteredPlayers.length + matchupSuggestions.length : 0) +
    (showTeamResults ? teams.length : 0) +
    (showLeagueResults ? filteredLeagues.length : 0)
  const topPlayerResult = showPlayerResults ? filteredPlayers[0] : null
  const searchNextActions = [
    {
      label: 'Open profile',
      value: topPlayerResult?.name || 'Find the record',
      body: hasQuery
        ? 'Open the public player page when the right record appears.'
        : 'Start with a player, team, league, flight, or area clue.',
      href: topPlayerResult ? `/players/${encodeURIComponent(topPlayerResult.id)}` : '/explore/players',
      cta: topPlayerResult ? 'Open Player ID' : 'Browse players',
    },
    {
      label: 'Compare matchup',
      value: 'Know the next edge',
      body: 'Use two player records to prep the rating gap, why it matters, and what to watch.',
      href: '/matchup',
      cta: 'Open Matchup',
    },
    {
      label: 'Build practice plan',
      value: SEARCH_PLAYER_IDENTITY_READ.label,
      body: SEARCH_PLAYER_IDENTITY_READ.levelUpNudge,
      href: SEARCH_LEVEL_UP_HREF,
      cta: 'Start Level Up',
    },
  ] as const

  return (
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
            gap: isMobile ? 14 : 16,
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid rgba(116,190,255,0.15)',
            background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(4,10,24,0.9))',
            boxShadow: '0 30px 86px rgba(2, 8, 23, 0.46), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div aria-hidden="true" style={watermarkStyle} />
          <SearchCommandPanel
            activeScope={scope}
            query={query}
            totalResults={totalResults}
            onScopeChange={(nextScope) => {
              setScope(nextScope)
              syncUrl(query, nextScope)
            }}
          />

          <form
            onSubmit={handleSubmit}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : isTablet ? 'minmax(0, 1fr)' : 'minmax(min(100%, 172px), 196px) minmax(0, 1fr) minmax(0, auto)',
              gap: 10,
              minWidth: 0,
              overflowWrap: 'anywhere',
              alignItems: isMobile ? 'stretch' : 'end',
            }}
          >
            <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
              <span style={searchLabelStyle}>Search by</span>
              <select
                className="tiq-focus-ring"
                value={scope}
                onChange={(event) => {
                  const nextScope = event.target.value as SearchScope
                  setScope(nextScope)
                  syncUrl(query, nextScope)
                }}
                style={getSearchSelectStyle()}
                aria-label="Search by scope"
              >
                {searchScopes.map((item) => (
                  <option key={item.value} value={item.value} style={getSearchOptionStyle()}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
              <span style={searchLabelStyle}>Search term</span>
              <div style={getSearchInputWrapStyle()}>
                <SearchIcon />
                <input
                  className="tiq-focus-ring"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={selectedScopeGuide.placeholder}
                  aria-label={`Search ${selectedScopeLabel.toLowerCase()}`}
                  style={getSearchInputStyle()}
                />
              </div>
            </label>

            <button
              type="submit"
              style={{
                ...buttonPrimary,
                minHeight: isSmallMobile ? 52 : 56,
                minWidth: 0,
                maxWidth: '100%',
                width: isMobile ? '100%' : undefined,
                border: 'none',
                overflowWrap: 'anywhere',
              }}
            >
              Search now
            </button>
          </form>

          {scope === 'players' && players.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, minWidth: 0, marginTop: 12 }}>
              <span style={{ color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 700, alignSelf: 'center', overflowWrap: 'anywhere' }}>Rating band:</span>
              {(['all', '2.5', '3.0', '3.5', '4.0', '4.5+'] as const).map((band) => (
                <button
                  key={band}
                  type="button"
                  onClick={() => setRatingBand(band)}
                  style={{ maxWidth: '100%', padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 800, overflowWrap: 'anywhere', cursor: 'pointer', background: ratingBand === band ? 'color-mix(in srgb, var(--brand-blue-2) 14%, var(--shell-chip-bg) 86%)' : 'var(--shell-chip-bg)', border: `1px solid ${ratingBand === band ? 'color-mix(in srgb, var(--brand-blue-2) 30%, var(--shell-panel-border) 70%)' : 'var(--shell-panel-border)'}`, color: ratingBand === band ? 'var(--foreground-strong)' : 'var(--shell-copy-muted)' }}
                >
                  {band === 'all' ? 'All levels' : band}
                </button>
              ))}
            </div>
          ) : null}

          {leagues.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(4, minmax(min(100%, 150px), 1fr))', gap: 10, minWidth: 0, marginTop: 12 }}>
              <FilterSelect label="Year" value={yearFilter} onChange={setYearFilter} options={leagueYears} />
              <FilterSelect label="Season" value={seasonFilter} onChange={setSeasonFilter} options={leagueSeasons} />
              <FilterSelect label="Male/Female" value={genderFilter} onChange={setGenderFilter} options={leagueGenders} />
              <FilterSelect label="Rating / Flight" value={leagueRatingFilter} onChange={setLeagueRatingFilter} options={leagueRatings} />
            </div>
          ) : null}

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              minWidth: 0,
              alignItems: 'center',
            }}
          >
            {hasQuery && showPlayerResults ? <span style={badgeBlue}>{players.length} players</span> : null}
            {hasQuery && showTeamResults ? <span style={badgeBlue}>{teams.length} teams</span> : null}
            {hasQuery && showLeagueResults ? <span style={badgeGreen}>{filteredLeagues.length} leagues</span> : null}
            {hasQuery && showPlayerResults ? <span style={badgeGreen}>{matchupSuggestions.length} My Lab actions</span> : null}
            <span style={{ color: 'var(--muted-strong)', fontSize: 13, fontWeight: 700, overflowWrap: 'anywhere' }}>
              {hasQuery ? `${totalResults} results for "${query.trim()}"` : 'Ready to search'}
            </span>
          </div>
        </section>

        <section style={searchNextActionsStyle} aria-label="Search next actions">
          <div style={searchNextActionsHeaderStyle}>
            <TiqFeatureIcon name="playerRatings" size="sm" variant="ghost" />
            <div style={searchNextActionsCopyStyle}>
              <span style={searchNextActionsKickerStyle}>After search</span>
              <h2 style={searchNextActionsTitleStyle}>Open the record, then act on it.</h2>
            </div>
          </div>
          <div style={searchNextActionsGridStyle}>
            {searchNextActions.map((action) => (
              <article key={action.label} style={searchNextActionCardStyle}>
                <span style={searchNextActionsLabelStyle}>{action.label}</span>
                <strong style={searchNextActionsValueStyle}>{action.value}</strong>
                <span style={searchNextActionsTextStyle}>{action.body}</span>
                <Link href={action.href} style={searchNextActionLinkStyle}>
                  {action.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section style={sectionStack}>
          <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
            <div style={sectionKicker}>Search results</div>
            <h2 style={sectionTitle}>
              {query.trim() ? 'Open the match.' : selectedScopeGuide.eyebrow}
            </h2>
          </div>

          {error ? (
            <section style={{ ...portalInsetCardStyle, padding: 18, color: '#fecaca', borderColor: 'rgba(248,113,113,0.3)', overflowWrap: 'anywhere' }}>
              {error}
            </section>
          ) : null}

          {loading ? (
            <section style={{ ...portalInsetCardStyle, padding: 18 }}>
              <div style={sectionKicker}>Searching</div>
              <div style={{ color: 'var(--foreground-strong)', fontSize: 20, fontWeight: 900, overflowWrap: 'anywhere' }}>
                Pulling players, teams, leagues, and My Lab prep paths together...
              </div>
            </section>
          ) : null}

          {!loading && query.trim().length === 0 ? (
            <section style={emptyStateStyle}>
              <div style={sectionKicker}>{selectedScopeGuide.eyebrow}</div>
              <div style={emptyTitleStyle}>{selectedScopeGuide.emptyTitle}</div>
              <div style={exampleSearchGridStyle}>
                {selectedScopeGuide.examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setQuery(example)
                      syncUrl(example, scope)
                    }}
                    style={exampleSearchButtonStyle}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {!loading && query.trim().length > 0 ? (
            <>
              {showPlayerResults ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(min(100%, 280px), 0.74fr)',
                  gap: 16,
                  minWidth: 0,
                }}
              >
                <ResultGroup
                  title="Players"
                  count={players.length}
                  emptyMessage="No player matches yet. Try broadening the name or switching scope."
                  ctaHref="/explore/players"
                  ctaLabel="Open player directory"
                >
                  {filteredPlayers.map((player) => (
                    <Link key={player.id} href={`/players/${player.id}`} style={getResultCardStyle()}>
                      <div style={resultHeaderStyle}>
                        <div style={resultPrimaryStyle}>
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
                          {(() => {
                            const base = player.overall_rating
                            const usta = player.overall_usta_dynamic_rating
                            if (typeof base !== 'number' || typeof usta !== 'number') return null
                            const diff = usta - base
                            const status = diff >= 0.15 ? 'Bump Up Pace' : diff >= 0.07 ? 'Trending Up' : diff > -0.07 ? 'Holding' : diff > -0.15 ? 'At Risk' : 'Drop Watch'
                            const style: CSSProperties = diff >= 0.07
                              ? { ...miniBadgeGreen, background: 'rgba(155,225,29,0.12)', color: '#d9f84a', border: '1px solid rgba(155,225,29,0.22)' }
                              : diff <= -0.07
                                ? { ...miniBadgeBlue, background: 'rgba(239,68,68,0.10)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.18)' }
                                : { ...miniBadgeBlue }
                            return <span style={style}>{status}</span>
                          })()}
                        </div>
                      </div>
                    </Link>
                  ))}
                </ResultGroup>

                <ResultGroup
                  title="My Lab shortcuts"
                  count={matchupSuggestions.length}
                  emptyMessage="Once at least two player results match, Player comparison actions show up here."
                  ctaHref="/mylab"
                  ctaLabel="Open My Lab"
                >
                  {matchupSuggestions.map((item) => (
                    <Link key={item.key} href={item.href} style={getResultCardStyle()}>
                      <div style={resultTitleStyle}>{item.title}</div>
                      <div style={resultMetaStyle}>{item.text}</div>
                    </Link>
                  ))}
                </ResultGroup>
              </div>
              ) : null}

              {showTeamResults || showLeagueResults ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: 16,
                  minWidth: 0,
                }}
              >
                <ResultGroup
                  title="Teams"
                  count={showTeamResults ? teams.length : 0}
                  emptyMessage="No team matches found yet. Try a league or broader team search."
                  ctaHref="/explore/teams"
                  ctaLabel="Open teams"
                >
                  {showTeamResults ? teams.map((team) => (
                    <Link
                      key={team.key}
                      href={`/teams/${encodeTeamRouteSegment(team.team)}${team.league || team.flight ? `?${new URLSearchParams({
                        ...(team.league ? { league: team.league } : {}),
                        ...(team.flight ? { flight: team.flight } : {}),
                      }).toString()}` : ''}`}
                      style={getResultCardStyle()}
                    >
                      <div style={resultHeaderStyle}>
                        <div style={resultPrimaryStyle}>
                          <div style={resultTitleStyle}>{team.team}</div>
                          <div style={resultMetaStyle}>
                            {[team.league, team.flight, `${team.matchCount} matches`].filter(Boolean).join(' - ')}
                          </div>
                        </div>
                        <span style={miniBadgeBlue}>{formatCompactDate(team.latestMatchDate)}</span>
                      </div>
                    </Link>
                  )) : null}
                </ResultGroup>

                <ResultGroup
                  title="Leagues"
                  count={showLeagueResults ? filteredLeagues.length : 0}
                  emptyMessage="No league matches found yet. Try a section, district, area, or different league name."
                  ctaHref="/explore/leagues"
                  ctaLabel="Open leagues"
                >
                  {showLeagueResults ? filteredLeagues.map((league) => (
                    <Link key={league.key} href={buildExploreLeagueHref(league)} style={getResultCardStyle()}>
                      <div style={resultHeaderStyle}>
                        <div style={resultPrimaryStyle}>
                          <div style={resultTitleStyle}>{league.leagueName}</div>
                          <div style={resultMetaStyle}>
                            {[league.flight, league.ustaSection, league.districtArea].filter(Boolean).join(' - ') || 'League context'}
                          </div>
                        </div>
                        <div style={resultBadgeWrapStyle}>
                          <span style={miniBadgeBlue}>{getCompetitionLayerLabel(league.competitionLayer)}</span>
                          <span style={miniBadgeGreen}>{league.matchCount} matches</span>
                        </div>
                      </div>
                    </Link>
                  )) : null}
                </ResultGroup>
              </div>
              ) : null}

              {(matchedFlights.length > 0 || matchedAreas.length > 0) ? (
                <section style={{ ...portalInsetCardStyle, padding: isSmallMobile ? 16 : 18, display: 'grid', gap: 14 }}>
                  <div style={sectionKicker}>Matched filters</div>
                  <div style={{ color: 'var(--foreground-strong)', fontSize: 22, fontWeight: 900, lineHeight: 1.04, overflowWrap: 'anywhere' }}>
                    Jump straight into the exact flight or area that matched.
                  </div>
                  <div style={matchedFilterStackStyle}>
                    {matchedFlights.length > 0 ? (
                      <div style={matchedFilterGroupStyle}>
                        <div style={matchedLabelStyle}>Flights</div>
                        <div style={matchedFilterLinkRowStyle}>
                          {matchedFlights.map((flight) => (
                            <Link key={flight} href={`/explore/leagues?q=${encodeURIComponent(flight)}`} style={filterJumpStyle}>
                              {flight}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {matchedAreas.length > 0 ? (
                      <div style={matchedFilterGroupStyle}>
                        <div style={matchedLabelStyle}>Areas</div>
                        <div style={matchedFilterLinkRowStyle}>
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

    </div>
  )
}

async function searchPlayers(term: string): Promise<PlayerSearchRow[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, name, location, overall_rating, overall_dynamic_rating, overall_usta_dynamic_rating')
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
    .select('id, home_team, away_team, league_name, flight, match_date, source')
    .is('line_number', null)
    .order('match_date', { ascending: false })
    .limit(700)

  if (error) throw new Error(error.message)

  const normalizedTerm = term.toLowerCase()
  const teamMap = new Map<string, TeamSearchResult>()
  const allowedTeamsByScope = new Map<string, Set<string>>()

  for (const row of ((data || []) as TeamMatchRow[]) || []) {
    if (!/\bschedule\b/i.test(cleanText(row.source))) continue
    const scopeKey = buildTeamKey('', cleanText(row.league_name), cleanText(row.flight))
    if (!allowedTeamsByScope.has(scopeKey)) allowedTeamsByScope.set(scopeKey, new Set<string>())
    const allowed = allowedTeamsByScope.get(scopeKey)!
    const homeTeam = normalizeTeamName(row.home_team)
    const awayTeam = normalizeTeamName(row.away_team)
    if (homeTeam) allowed.add(homeTeam)
    if (awayTeam) allowed.add(awayTeam)
  }

  for (const row of ((data || []) as TeamMatchRow[]) || []) {
    const league = cleanText(row.league_name) || null
    const flight = cleanText(row.flight) || null
    const allowedTeams = allowedTeamsByScope.get(buildTeamKey('', league, flight))
    for (const teamName of [cleanText(row.home_team), cleanText(row.away_team)]) {
      if (!teamName) continue
      if (allowedTeams?.size && !allowedTeams.has(normalizeTeamName(teamName))) continue
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

function SearchCommandPanel({
  activeScope,
  query,
  totalResults,
  onScopeChange,
}: {
  activeScope: SearchScope
  query: string
  totalResults: number
  onScopeChange: (scope: SearchScope) => void
}) {
  return (
    <section style={searchCommandPanelStyle} aria-label="Search scope guide">
      <div style={searchCommandHeaderStyle}>
        <TiqFeatureIcon name="opponentScouting" size="md" variant="surface" />
        <div style={searchCommandHeaderCopyStyle}>
          <div style={searchCommandEyebrowStyle}>Search</div>
          <h1 style={searchCommandTitleStyle}>What are you looking for?</h1>
          {query.trim() ? (
            <p style={searchCommandTextStyle}>
              {totalResults} result{totalResults === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>
      </div>

      <div style={searchCommandGridStyle}>
        {scopeCommandCards.map((card) => {
          const selected = card.scope === activeScope
          return (
            <button
              key={card.scope}
              type="button"
              onClick={() => onScopeChange(card.scope)}
              style={{
                ...searchCommandCardStyle,
                ...(selected ? searchCommandCardActiveStyle : null),
              }}
            >
              <TiqFeatureIcon name={card.icon} size="sm" variant={selected ? 'surface' : 'ghost'} />
              <span style={searchCommandCardCopyStyle}>
                <span style={searchCommandLabelStyle}>{card.label}</span>
                <strong style={searchCommandCardTitleStyle}>{card.title}</strong>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return (
    <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <span style={searchLabelStyle}>{label}</span>
      <select className="tiq-focus-ring" value={value} onChange={(event) => onChange(event.target.value)} style={getSearchSelectStyle()}>
        <option value="all" style={getSearchOptionStyle()}>All</option>
        {options.map((option) => (
          <option key={option} value={option} style={getSearchOptionStyle()}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
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
    <section style={resultGroupStyle}>
      <div style={resultGroupHeaderStyle}>
        <div style={resultGroupCopyStyle}>
          <div style={sectionKicker}>{title}</div>
          <div style={resultGroupTitleStyle}>
            {count} {title.toLowerCase()} found
          </div>
        </div>
        <Link href={ctaHref} style={resultGroupActionStyle}>
          {ctaLabel}
        </Link>
      </div>

      {count === 0 ? (
        <div style={resultGroupEmptyStyle}>{emptyMessage}</div>
      ) : (
        <div style={resultGroupListStyle}>{children}</div>
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

const searchCommandPanelStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: 14,
  padding: 14,
  borderRadius: 20,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.7)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
}

const searchCommandHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px minmax(0, 1fr)',
  gap: 12,
  alignItems: 'center',
  minWidth: 0,
}

const searchCommandHeaderCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
}

const searchCommandEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const searchCommandTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.12rem, 2vw, 1.45rem)',
  lineHeight: 1.05,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const searchCommandTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const portalInsetCardStyle: CSSProperties = {
  ...surfaceCard,
  minWidth: 0,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,16,34,0.7)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const searchCommandGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 154px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const searchCommandCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32px minmax(0, 1fr)',
  gap: 9,
  alignItems: 'center',
  minHeight: 58,
  padding: '9px 10px',
  borderRadius: 15,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground)',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  minWidth: 0,
}

const searchCommandCardActiveStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.18), rgba(125,211,252,0.08))',
}

const searchCommandCardCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
}

const searchCommandLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const searchCommandCardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}

const searchLabelStyle: CSSProperties = {
  color: 'var(--muted-strong)',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

function getSearchSelectStyle(): CSSProperties {
  return {
    ...surfaceCard,
    minWidth: 0,
    minHeight: 56,
    padding: '0 14px',
    border: '1px solid var(--home-input-border)',
    background: 'var(--home-input-bg)',
    color: 'var(--foreground-strong)',
    fontSize: 14,
    fontWeight: 700,
    outline: '2px solid transparent',
    outlineOffset: 2,
    boxShadow: 'var(--home-control-shadow)',
    colorScheme: 'dark',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    paddingRight: 34,
  }
}

function getSearchOptionStyle(): CSSProperties {
  return {
    backgroundColor: '#13233b',
    color: '#f5f8ff',
  }
}

function getSearchInputWrapStyle(): CSSProperties {
  return {
    ...surfaceCard,
    minWidth: 0,
    minHeight: 56,
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: '1px solid var(--home-input-border)',
    background: 'var(--home-input-bg)',
    color: 'var(--muted-strong)',
    boxShadow: 'var(--home-control-shadow)',
  }
}

function getSearchInputStyle(): CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    border: 'none',
    background: 'transparent',
    color: 'var(--foreground-strong)',
    fontSize: 15,
    outline: '2px solid transparent',
    outlineOffset: 2,
  }
}

const emptyStateStyle: CSSProperties = {
  ...portalInsetCardStyle,
  padding: 22,
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const emptyTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1.05,
  overflowWrap: 'anywhere',
}

const exampleSearchGridStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
  marginTop: 2,
}

const exampleSearchButtonStyle: CSSProperties = {
  ...buttonGhost,
  maxWidth: '100%',
  minHeight: 38,
  paddingInline: 14,
  overflowWrap: 'anywhere',
  cursor: 'pointer',
}

const searchNextActionsStyle: CSSProperties = {
  ...portalInsetCardStyle,
  display: 'grid',
  gap: 12,
  padding: 16,
  border: '1px solid color-mix(in srgb, var(--brand-green) 20%, var(--shell-panel-border) 80%)',
  background: 'color-mix(in srgb, var(--brand-green) 7%, rgba(8,16,34,0.78) 93%)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const searchNextActionsHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  flexWrap: 'wrap',
}

const searchNextActionsCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const searchNextActionsKickerStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const searchNextActionsTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: '1rem',
  lineHeight: 1.2,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const searchNextActionsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const searchNextActionCardStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(7,17,33,0.68)',
  overflowWrap: 'anywhere',
}

const searchNextActionLinkStyle: CSSProperties = {
  ...buttonGhost,
  justifySelf: 'start',
  minHeight: 36,
  maxWidth: '100%',
  paddingInline: 12,
  marginTop: 2,
  fontSize: 12,
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
}

const searchNextActionsLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  overflowWrap: 'anywhere',
}

const searchNextActionsValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const searchNextActionsTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const resultGroupStyle: CSSProperties = {
  ...portalInsetCardStyle,
  padding: 18,
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const resultGroupHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
  minWidth: 0,
}

const resultGroupCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const resultGroupTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 20,
  fontWeight: 900,
  lineHeight: 1.04,
  overflowWrap: 'anywhere',
}

const resultGroupActionStyle: CSSProperties = {
  ...buttonGhost,
  maxWidth: '100%',
  minWidth: 0,
  textAlign: 'center',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const resultGroupEmptyStyle: CSSProperties = {
  color: 'var(--muted-strong)',
  fontSize: 13,
  lineHeight: 1.65,
  overflowWrap: 'anywhere',
}

const resultGroupListStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

function getResultCardStyle(): CSSProperties {
  return {
    ...portalInsetCardStyle,
    minWidth: 0,
    maxWidth: '100%',
    padding: '14px 16px',
    display: 'grid',
    gap: 8,
    textDecoration: 'none',
    background: 'rgba(7,17,33,0.72)',
  }
}

const resultHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'start',
  flexWrap: 'wrap',
  minWidth: 0,
}

const resultPrimaryStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
}

const resultTitleStyle: CSSProperties = {
  color: colors.textStrong,
  fontSize: 16,
  fontWeight: 900,
  lineHeight: 1.08,
  overflowWrap: 'anywhere',
}

const resultMetaStyle: CSSProperties = {
  color: colors.mutedStrong,
  fontSize: 13,
  lineHeight: 1.6,
  overflowWrap: 'anywhere',
}

const resultBadgeWrapStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  minWidth: 0,
  maxWidth: '100%',
}

const miniBadgeBlue: CSSProperties = {
  ...badgeBlue,
  minHeight: 28,
  padding: '0 10px',
  fontSize: 11,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
}

const miniBadgeGreen: CSSProperties = {
  ...badgeGreen,
  minHeight: 28,
  padding: '0 10px',
  fontSize: 11,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
}

const matchedLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const matchedFilterStackStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const matchedFilterGroupStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const matchedFilterLinkRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const filterJumpStyle: CSSProperties = {
  ...buttonGhost,
  maxWidth: '100%',
  minHeight: 38,
  paddingInline: 14,
  overflowWrap: 'anywhere',
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
