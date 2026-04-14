'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import SiteShell from '@/app/components/site-shell'
import FollowButton from '@/app/components/follow-button'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type TeamMatch = {
  id: string
  home_team: string | null
  away_team: string | null
  match_date: string | null
  match_type: 'singles' | 'doubles' | null
  winner_side: 'A' | 'B' | null
  score: string | null
  flight?: string | null
  league_name?: string | null
  usta_section?: string | null
  district_area?: string | null
  line_number?: string | null
}

type Player = {
  id: string
  name: string
  singles_dynamic_rating: number | null
  doubles_dynamic_rating: number | null
  overall_dynamic_rating?: number | null
  location?: string | null
}

type PlayerRelation = Player | Player[] | null

type MatchPlayer = {
  match_id: string
  side: 'A' | 'B'
  player_id: string
  players: PlayerRelation
}

type RosterPlayer = Player & {
  appearances: number
  singlesAppearances: number
  doublesAppearances: number
  wins: number
  losses: number
}

type PairingCard = {
  key: string
  names: string[]
  appearances: number
  avgRating: number | null
  wins: number
  losses: number
}

type MatchCard = TeamMatch & {
  won: boolean | null
  opponent: string | null
  venueLabel: string
}

function cleanText(value: string | null | undefined): string | null {
  const text = (value || '').trim()
  return text.length > 0 ? text : null
}

function normalizePlayer(player: PlayerRelation): Player | null {
  if (!player) return null
  return Array.isArray(player) ? player[0] ?? null : player
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRating(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value.toFixed(2)
}

function teamSideForMatch(match: TeamMatch, teamName: string): 'A' | 'B' | null {
  const home = cleanText(match.home_team)
  const away = cleanText(match.away_team)
  if (home === teamName) return 'A'
  if (away === teamName) return 'B'
  return null
}

function didTeamWin(match: TeamMatch, teamName: string): boolean | null {
  const side = teamSideForMatch(match, teamName)
  if (!side || !match.winner_side) return null
  return side === match.winner_side
}

function getOpponent(match: TeamMatch, teamName: string): string | null {
  const home = cleanText(match.home_team)
  const away = cleanText(match.away_team)
  if (home === teamName) return away
  if (away === teamName) return home
  return null
}

function safeOverallRating(player: Player) {
  if (typeof player.overall_dynamic_rating === 'number' && !Number.isNaN(player.overall_dynamic_rating)) {
    return player.overall_dynamic_rating
  }

  const singles = typeof player.singles_dynamic_rating === 'number' && !Number.isNaN(player.singles_dynamic_rating)
    ? player.singles_dynamic_rating
    : null
  const doubles = typeof player.doubles_dynamic_rating === 'number' && !Number.isNaN(player.doubles_dynamic_rating)
    ? player.doubles_dynamic_rating
    : null

  if (singles == null && doubles == null) return null
  return Math.max(singles ?? Number.NEGATIVE_INFINITY, doubles ?? Number.NEGATIVE_INFINITY)
}

function buildStableTeamFollowId(team: string, league: string | null, flight: string | null) {
  return `${team}__${league || ''}__${flight || ''}`
}

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || ''
  return value || ''
}

export default function TeamPage() {
  const params = useParams()
  const searchParams = useSearchParams()

  const rawTeam = getParamValue(params.team as string | string[] | undefined)
  const team = decodeURIComponent(rawTeam).trim()

  const leagueFilter = cleanText(searchParams.get('league'))
  const flightFilter = cleanText(searchParams.get('flight'))

  const [matches, setMatches] = useState<TeamMatch[]>([])
  const [players, setPlayers] = useState<MatchPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  const loadTeamPage = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (!team) {
        setMatches([])
        setPlayers([])
        setError('Team not found.')
        return
      }

      let matchQuery = supabase
        .from('matches')
        .select(`
          id,
          home_team,
          away_team,
          match_date,
          match_type,
          winner_side,
          score,
          flight,
          league_name,
          usta_section,
          district_area,
          line_number
        `)
        .is('line_number', null)
        .order('match_date', { ascending: false })
        .limit(250)

      if (leagueFilter) {
        matchQuery = matchQuery.eq('league_name', leagueFilter)
      }

      if (flightFilter) {
        matchQuery = matchQuery.eq('flight', flightFilter)
      }

      if (!leagueFilter && !flightFilter) {
        matchQuery = matchQuery.or(`home_team.eq.${team},away_team.eq.${team}`)
      }

      const { data: matchData, error: matchError } = await matchQuery
      if (matchError) throw matchError

      const scopedMatches = ((matchData || []) as TeamMatch[]).filter((match) => {
        const home = cleanText(match.home_team)
        const away = cleanText(match.away_team)
        if (!home || !away) return false

        if (leagueFilter && cleanText(match.league_name) !== leagueFilter) return false
        if (flightFilter && cleanText(match.flight) !== flightFilter) return false

        return home === team || away === team
      })

      setMatches(scopedMatches)

      if (!scopedMatches.length) {
        setPlayers([])
        return
      }

      const ids = scopedMatches.map((match) => match.id)

      const { data: playerData, error: playerError } = await supabase
        .from('match_players')
        .select(`
          match_id,
          side,
          player_id,
          players (
            id,
            name,
            singles_dynamic_rating,
            doubles_dynamic_rating,
            overall_dynamic_rating,
            location
          )
        `)
        .in('match_id', ids)

      if (playerError) throw playerError

      setPlayers((playerData || []) as MatchPlayer[])
    } catch (err) {
      console.error(err)
      setMatches([])
      setPlayers([])
      setError('Unable to load this team page right now.')
    } finally {
      setLoading(false)
    }
  }, [flightFilter, leagueFilter, team])

  useEffect(() => {
    void loadTeamPage()
  }, [loadTeamPage])

  const teamMeta = useMemo(() => {
    const firstWithLeague = matches.find(
      (match) => cleanText(match.league_name) || cleanText(match.flight) || cleanText(match.usta_section),
    )

    return {
      league: cleanText(firstWithLeague?.league_name) || leagueFilter,
      flight: cleanText(firstWithLeague?.flight) || flightFilter,
      section: cleanText(firstWithLeague?.usta_section),
      district: cleanText(firstWithLeague?.district_area),
    }
  }, [matches, leagueFilter, flightFilter])

  const recentMatch = matches[0] || null

  const record = useMemo(() => {
    let wins = 0
    let losses = 0

    matches.forEach((match) => {
      const result = didTeamWin(match, team)
      if (result === true) wins += 1
      if (result === false) losses += 1
    })

    return { wins, losses }
  }, [matches, team])

  const roster = useMemo<RosterPlayer[]>(() => {
    const map = new Map<string, RosterPlayer>()
    const matchLookup = new Map(matches.map((match) => [match.id, match]))

    players.forEach((entry) => {
      const player = normalizePlayer(entry.players)
      if (!player) return

      const match = matchLookup.get(entry.match_id)
      if (!match) return

      const teamSide = teamSideForMatch(match, team)
      if (!teamSide || entry.side !== teamSide) return

      if (!map.has(player.id)) {
        map.set(player.id, {
          ...player,
          appearances: 0,
          singlesAppearances: 0,
          doublesAppearances: 0,
          wins: 0,
          losses: 0,
        })
      }

      const current = map.get(player.id)
      if (!current) return

      current.appearances += 1

      if (match.match_type === 'singles') current.singlesAppearances += 1
      if (match.match_type === 'doubles') current.doublesAppearances += 1

      const result = didTeamWin(match, team)
      if (result === true) current.wins += 1
      if (result === false) current.losses += 1
    })

    return Array.from(map.values()).sort((a, b) => {
      const aOverall = safeOverallRating(a)
      const bOverall = safeOverallRating(b)

      if (aOverall == null && bOverall == null) return a.name.localeCompare(b.name)
      if (aOverall == null) return 1
      if (bOverall == null) return -1
      if (bOverall !== aOverall) return bOverall - aOverall
      return a.name.localeCompare(b.name)
    })
  }, [matches, players, team])

  const bestSingles = useMemo(() => {
    return [...roster]
      .sort((a, b) => {
        const left = a.singles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        const right = b.singles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        if (right !== left) return right - left
        return a.name.localeCompare(b.name)
      })
      .slice(0, 6)
  }, [roster])

  const bestDoubles = useMemo(() => {
    return [...roster]
      .sort((a, b) => {
        const left = a.doubles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        const right = b.doubles_dynamic_rating ?? Number.NEGATIVE_INFINITY
        if (right !== left) return right - left
        return a.name.localeCompare(b.name)
      })
      .slice(0, 6)
  }, [roster])

  const pairings = useMemo<PairingCard[]>(() => {
    const byMatch = new Map<string, MatchPlayer[]>()

    players.forEach((entry) => {
      if (!byMatch.has(entry.match_id)) {
        byMatch.set(entry.match_id, [])
      }
      byMatch.get(entry.match_id)?.push(entry)
    })

    const pairMap = new Map<string, PairingCard>()

    matches.forEach((match) => {
      if (match.match_type !== 'doubles') return

      const teamSide = teamSideForMatch(match, team)
      if (!teamSide) return

      const entries = (byMatch.get(match.id) || []).filter((entry) => entry.side === teamSide)
      if (entries.length < 2) return

      const normalized = entries
        .map((entry) => normalizePlayer(entry.players))
        .filter((player): player is Player => Boolean(player))
        .slice(0, 2)

      if (normalized.length < 2) return

      const sortedPlayers = [...normalized].sort((a, b) => a.name.localeCompare(b.name))
      const key = sortedPlayers.map((player) => player.id).join('-')
      const validRatings = sortedPlayers
        .map((player) => player.doubles_dynamic_rating)
        .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))
      const avgRating = validRatings.length
        ? validRatings.reduce((sum, value) => sum + value, 0) / validRatings.length
        : null

      if (!pairMap.has(key)) {
        pairMap.set(key, {
          key,
          names: sortedPlayers.map((player) => player.name),
          appearances: 0,
          avgRating,
          wins: 0,
          losses: 0,
        })
      }

      const pair = pairMap.get(key)
      if (!pair) return

      pair.appearances += 1
      pair.avgRating = avgRating

      const result = didTeamWin(match, team)
      if (result === true) pair.wins += 1
      if (result === false) pair.losses += 1
    })

    return Array.from(pairMap.values()).sort((a, b) => {
      if (a.avgRating == null && b.avgRating == null) {
        if (b.appearances !== a.appearances) return b.appearances - a.appearances
        return a.names.join(' / ').localeCompare(b.names.join(' / '))
      }
      if (a.avgRating == null) return 1
      if (b.avgRating == null) return -1
      if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating
      if (b.appearances !== a.appearances) return b.appearances - a.appearances
      return a.names.join(' / ').localeCompare(b.names.join(' / '))
    })
  }, [matches, players, team])

  const matchCards = useMemo<MatchCard[]>(() => {
    return matches.map((match) => {
      const won = didTeamWin(match, team)
      const opponent = getOpponent(match, team)
      const isHome = cleanText(match.home_team) === team

      return {
        ...match,
        won,
        opponent,
        venueLabel: isHome ? 'Home' : 'Away',
      }
    })
  }, [matches, team])

  const captainLinks = [
    {
      title: 'Availability',
      description: 'Track who is in, out, and on the bubble before lineup lock.',
      href: `/captain/availability?team=${encodeURIComponent(team)}${leagueFilter ? `&league=${encodeURIComponent(leagueFilter)}` : ''}${flightFilter ? `&flight=${encodeURIComponent(flightFilter)}` : ''}`,
    },
    {
      title: 'Lineup Builder',
      description: 'Build stronger singles and doubles combinations around your core.',
      href: `/captain/lineup-builder?team=${encodeURIComponent(team)}${leagueFilter ? `&league=${encodeURIComponent(leagueFilter)}` : ''}${flightFilter ? `&flight=${encodeURIComponent(flightFilter)}` : ''}`,
    },
    {
      title: 'Scenario Compare',
      description: 'Stress-test alternate lineups and compare projected outcomes.',
      href: `/captain/scenario-builder?team=${encodeURIComponent(team)}${leagueFilter ? `&league=${encodeURIComponent(leagueFilter)}` : ''}${flightFilter ? `&flight=${encodeURIComponent(flightFilter)}` : ''}`,
    },
  ]

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '26px 18px' : '34px 26px',
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.2fr) minmax(300px, 0.85fr)',
    gap: isMobile ? '18px' : '22px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '42px' : '56px',
  }

  const dynamicMetricGrid: CSSProperties = {
    ...metricGridStyle,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isTablet
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(4, minmax(0, 1fr))',
  }

  const dynamicCardGrid: CSSProperties = {
    ...cardGridStyle,
    gridTemplateColumns: isTablet ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }

  const heroMetaParts = [teamMeta.league, teamMeta.flight, teamMeta.section].filter(Boolean)
  const stableFollowId = buildStableTeamFollowId(team, teamMeta.league, teamMeta.flight)

  if (loading) {
    return (
      <SiteShell active="/teams">
        <section style={pageContent}>
          <section style={dynamicHeroShell}>
            <div>
              <p style={eyebrow}>Team Intelligence</p>
              <h1 style={dynamicHeroTitle}>Loading team page...</h1>
              <p style={heroText}>Pulling roster, matches, and lineup context.</p>
            </div>
          </section>
        </section>
      </SiteShell>
    )
  }

  return (
    <SiteShell active="/teams">
      <section style={pageContent}>
        <section style={dynamicHeroShell}>
          <div>
            <p style={eyebrow}>Team Intelligence</p>
            <h1 style={dynamicHeroTitle}>{team || 'Team Detail'}</h1>
            <p style={heroText}>
              Full roster, recent form, top singles strength, doubles chemistry, and captain workflow tools in one place.
            </p>

            <div style={heroBadgeRow}>
              {teamMeta.league ? <span style={badgeBlue}>{teamMeta.league}</span> : null}
              {teamMeta.flight ? <span style={badgeGreen}>{teamMeta.flight}</span> : null}
              {teamMeta.section ? <span style={badgeSlate}>{teamMeta.section}</span> : null}
              <span style={badgeSlate}>{matches.length} matches tracked</span>
            </div>

            <div style={heroActions}>
              <Link style={buttonPrimary} href={captainLinks[1].href}>
                Open lineup builder
              </Link>
              <Link style={buttonSecondary} href={captainLinks[0].href}>
                Check availability
              </Link>
              <div style={followButtonWrap}>
                <FollowButton
                  entityType="team"
                  entityId={stableFollowId}
                  entityName={team}
                  subtitle={heroMetaParts.join(' · ') || undefined}
                />
              </div>
              <Link style={buttonGhost} href="/teams">
                Back to teams
              </Link>
            </div>
          </div>

          <div style={summaryCard}>
            <div style={summaryTitle}>Team snapshot</div>

            <div style={summaryMetricGrid}>
              <MetricCard label="Record" value={`${record.wins}-${record.losses}`} subtle="Wins / losses tracked" />
              <MetricCard label="Roster size" value={String(roster.length)} subtle="Players who have appeared" />
              <MetricCard label="Matches" value={String(matches.length)} subtle="Singles and doubles logged" />
              <MetricCard
                label="Latest match"
                value={formatDate(recentMatch?.match_date)}
                subtle={recentMatch ? `vs ${getOpponent(recentMatch, team) ?? '—'}` : 'No recent match yet'}
              />
            </div>

            {teamMeta.district ? <div style={summaryHint}>{teamMeta.district}</div> : null}
          </div>
        </section>

        {error ? (
          <section style={surfaceCard}>
            <h2 style={sectionTitle}>Something went wrong</h2>
            <p style={bodyText}>{error}</p>
            <div style={{ marginTop: 14 }}>
              <button type="button" onClick={() => void loadTeamPage()} style={buttonSecondary}>
                Retry team page
              </button>
            </div>
          </section>
        ) : null}

        {!error && !matches.length ? (
          <section style={surfaceCard}>
            <h2 style={sectionTitle}>No team matches found</h2>
            <p style={bodyText}>
              We could not find any valid matches for this team with the current league and flight filters.
            </p>
            <p style={bodyText}>
              Try opening the broader team directory, removing the active league or flight filter from the URL, or jumping straight into the captain tools to start planning before match history is complete.
            </p>
            <div style={helperCallout}>
              Current scope: {[teamMeta.league, teamMeta.flight].filter(Boolean).join(' | ') || 'All leagues'}
            </div>
            <div style={heroActions}>
              <Link href="/teams" style={buttonSecondary}>
                Browse all teams
              </Link>
              <Link href={captainLinks[0].href} style={buttonGhost}>
                Open captain availability
              </Link>
            </div>
          </section>
        ) : null}

        <section style={dynamicMetricGrid}>
          <article style={metricCard}>
            <span style={metricLabel}>Record</span>
            <strong style={metricValue}>{record.wins}-{record.losses}</strong>
            <span style={metricSubtle}>Wins / losses tracked</span>
          </article>

          <article style={metricCard}>
            <span style={metricLabel}>Roster Size</span>
            <strong style={metricValue}>{roster.length}</strong>
            <span style={metricSubtle}>Players who have appeared</span>
          </article>

          <article style={metricCard}>
            <span style={metricLabel}>Matches</span>
            <strong style={metricValue}>{matches.length}</strong>
            <span style={metricSubtle}>Singles and doubles logged</span>
          </article>

          <article style={metricCard}>
            <span style={metricLabel}>Latest Match</span>
            <strong style={metricValue}>{formatDate(recentMatch?.match_date)}</strong>
            <span style={metricSubtle}>
              {recentMatch ? `vs ${getOpponent(recentMatch, team) ?? '—'}` : 'No recent match yet'}
            </span>
          </article>
        </section>

        <section style={dynamicCardGrid}>
          <article style={surfaceCardStrong}>
            <div style={sectionHeadingRow}>
              <div>
                <p style={sectionKicker}>Singles Core</p>
                <h2 style={sectionTitle}>Top Singles Options</h2>
              </div>
            </div>

            {bestSingles.length ? (
              <div style={stackList}>
                {bestSingles.map((player, index) => (
                  <div key={player.id} style={listRow}>
                    <div>
                      <strong>
                        {index + 1}. {player.name}
                      </strong>
                      <div style={mutedText}>
                        {player.singlesAppearances} singles starts · {player.wins}-{player.losses} record
                      </div>
                    </div>
                    <span style={badgeBlue}>{formatRating(player.singles_dynamic_rating)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={emptyStateBlock}>
                <p style={emptyState}>No singles data available yet.</p>
                <p style={mutedText}>Once this team logs singles courts, the strongest options will surface here.</p>
              </div>
            )}
          </article>

          <article style={surfaceCardStrong}>
            <div style={sectionHeadingRow}>
              <div>
                <p style={sectionKicker}>Doubles Chemistry</p>
                <h2 style={sectionTitle}>Best Pairs</h2>
              </div>
            </div>

            {pairings.length ? (
              <div style={stackList}>
                {pairings.slice(0, 6).map((pair) => (
                  <div key={pair.key} style={listRow}>
                    <div>
                      <strong>{pair.names.join(' / ')}</strong>
                      <div style={mutedText}>
                        {pair.appearances} matches together · {pair.wins}-{pair.losses} record
                      </div>
                    </div>
                    <span style={badgeGreen}>{formatRating(pair.avgRating)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={emptyStateBlock}>
                <p style={emptyState}>No doubles pairings available yet.</p>
                <p style={mutedText}>As soon as this roster logs repeat partnerships, chemistry trends will appear here.</p>
              </div>
            )}
          </article>
        </section>

        <section style={dynamicCardGrid}>
          <article style={surfaceCard}>
            <div style={sectionHeadingRow}>
              <div>
                <p style={sectionKicker}>Captain Tools</p>
                <h2 style={sectionTitle}>Next Best Actions</h2>
              </div>
            </div>

            <div style={stackList}>
              {captainLinks.map((item) => (
                <Link key={item.title} href={item.href} style={listLinkCard}>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </Link>
              ))}
            </div>
          </article>

          <article style={surfaceCard}>
            <div style={sectionHeadingRow}>
              <div>
                <p style={sectionKicker}>Depth View</p>
                <h2 style={sectionTitle}>Top Doubles Players</h2>
              </div>
            </div>

            {bestDoubles.length ? (
              <div style={stackList}>
                {bestDoubles.map((player, index) => (
                  <div key={player.id} style={listRow}>
                    <div>
                      <strong>
                        {index + 1}. {player.name}
                      </strong>
                      <div style={mutedText}>
                        {player.doublesAppearances} doubles starts · {player.wins}-{player.losses} record
                      </div>
                    </div>
                    <span style={badgeSlate}>{formatRating(player.doubles_dynamic_rating)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={emptyStateBlock}>
                <p style={emptyState}>No doubles depth data available yet.</p>
                <p style={mutedText}>Match results will fill in this ladder once players start appearing in doubles lines.</p>
              </div>
            )}
          </article>
        </section>

        <section style={surfaceCard}>
          <div style={sectionHeadingRow}>
            <div>
              <p style={sectionKicker}>Recent Form</p>
              <h2 style={sectionTitle}>Match History</h2>
            </div>
          </div>

          {matchCards.length ? (
            <div style={tableWrap}>
              <table style={dataTable}>
                <thead>
                  <tr>
                    <th style={tableHeaderCell}>Date</th>
                    <th style={tableHeaderCell}>Opponent</th>
                    <th style={tableHeaderCell}>Venue</th>
                    <th style={tableHeaderCell}>Format</th>
                    <th style={tableHeaderCell}>Score</th>
                    <th style={tableHeaderCell}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {matchCards.map((match) => (
                    <tr key={match.id}>
                      <td style={tableCell}>{formatDate(match.match_date)}</td>
                      <td style={tableCell}>{match.opponent ?? '—'}</td>
                      <td style={tableCell}>{match.venueLabel}</td>
                      <td style={tableCell}>
                        {match.match_type ? match.match_type[0].toUpperCase() + match.match_type.slice(1) : '—'}
                      </td>
                      <td style={tableCell}>{match.score ?? '—'}</td>
                      <td style={tableCell}>
                        <span style={match.won === true ? badgeGreen : match.won === false ? badgeBlue : badgeSlate}>
                          {match.won === true ? 'Win' : match.won === false ? 'Loss' : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={emptyStateBlock}>
              <p style={emptyState}>No team matches found yet.</p>
              <p style={mutedText}>Return to the team directory or use the captain tools above while the season history catches up.</p>
            </div>
          )}
        </section>

        <section style={surfaceCard}>
          <div style={sectionHeadingRow}>
            <div>
              <p style={sectionKicker}>Roster</p>
              <h2 style={sectionTitle}>Player Breakdown</h2>
            </div>
          </div>

          {roster.length ? (
            <div style={tableWrap}>
              <table style={dataTable}>
                <thead>
                  <tr>
                    <th style={tableHeaderCell}>Player</th>
                    <th style={tableHeaderCell}>Singles</th>
                    <th style={tableHeaderCell}>Doubles</th>
                    <th style={tableHeaderCell}>Appearances</th>
                    <th style={tableHeaderCell}>Record</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((player) => (
                    <tr key={player.id}>
                      <td style={tableCell}>
                        <div style={{ display: 'grid', gap: 4 }}>
                          <Link href={`/players/${player.id}`} style={playerLink}>
                            <strong>{player.name}</strong>
                          </Link>
                          {player.location ? <span style={mutedText}>{player.location}</span> : null}
                        </div>
                      </td>
                      <td style={tableCell}>{formatRating(player.singles_dynamic_rating)}</td>
                      <td style={tableCell}>{formatRating(player.doubles_dynamic_rating)}</td>
                      <td style={tableCell}>{player.appearances}</td>
                      <td style={tableCell}>
                        {player.wins}-{player.losses}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={emptyStateBlock}>
              <p style={emptyState}>No roster data available for this team yet.</p>
              <p style={mutedText}>Use the captain tools above to start from availability and lineup planning while the roster history catches up.</p>
            </div>
          )}
        </section>
      </section>
    </SiteShell>
  )
}

function MetricCard({
  label,
  value,
  subtle,
}: {
  label: string
  value: string
  subtle: string
}) {
  return (
    <div style={summaryMetricCard}>
      <div style={summaryMetricLabel}>{label}</div>
      <div style={summaryMetricValue}>{value}</div>
      <div style={summaryHintSmall}>{subtle}</div>
    </div>
  )
}

const pageContent: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '18px 24px 0',
  display: 'grid',
  gap: '18px',
}

const heroShell: CSSProperties = {
  position: 'relative',
  display: 'grid',
  borderRadius: '34px',
  border: '1px solid rgba(107, 162, 255, 0.18)',
  background:
    'linear-gradient(135deg, rgba(14,39,82,0.88) 0%, rgba(11,30,64,0.90) 56%, rgba(12,46,62,0.84) 100%)',
  boxShadow: '0 28px 80px rgba(3,10,24,0.30)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '38px',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.12)',
  color: '#d9e7ef',
  fontWeight: 800,
  fontSize: '14px',
  marginBottom: '18px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const heroTitle: CSSProperties = {
  margin: '0 0 12px',
  color: '#f7fbff',
  fontWeight: 900,
  lineHeight: 0.98,
  letterSpacing: '-0.055em',
  maxWidth: '760px',
}

const heroText: CSSProperties = {
  margin: '0 0 20px',
  color: 'rgba(224, 234, 247, 0.84)',
  fontSize: '18px',
  lineHeight: 1.6,
  maxWidth: '720px',
}

const heroBadgeRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginBottom: '18px',
}

const heroActions: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  alignItems: 'center',
}

const buttonPrimary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 800,
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  color: '#071622',
  border: '1px solid rgba(155,225,29,0.34)',
  boxShadow: '0 16px 32px rgba(74, 222, 128, 0.14)',
}

const buttonSecondary: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 800,
  background: 'linear-gradient(180deg, rgba(58,115,212,0.18) 0%, rgba(27,62,120,0.14) 100%)',
  color: '#ebf1fd',
  border: '1px solid rgba(116,190,255,0.18)',
}

const buttonGhost: CSSProperties = {
  ...buttonSecondary,
  background: 'rgba(255,255,255,0.06)',
}

const followButtonWrap: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
}

const badgeBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
}

const badgeBlue: CSSProperties = {
  ...badgeBase,
  background: 'rgba(37, 91, 227, 0.16)',
  color: '#c7dbff',
}

const badgeGreen: CSSProperties = {
  ...badgeBase,
  background: 'rgba(155,225,29,0.14)',
  color: '#e7ffd1',
}

const badgeSlate: CSSProperties = {
  ...badgeBase,
  background: 'rgba(255,255,255,0.08)',
  color: '#dfe8f8',
}

const summaryCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(37,56,84,0.72), rgba(21,37,64,0.76))',
  padding: '18px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  minHeight: '100%',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const summaryTitle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: '-0.03em',
  marginBottom: '14px',
}

const summaryMetricGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px',
}

const summaryMetricCard: CSSProperties = {
  borderRadius: '20px',
  padding: '14px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.08)',
}

const summaryMetricLabel: CSSProperties = {
  color: 'rgba(220,231,244,0.7)',
  fontWeight: 700,
  fontSize: '13px',
  marginBottom: '8px',
}

const summaryMetricValue: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: '-0.05em',
  lineHeight: 1,
}

const summaryHint: CSSProperties = {
  marginTop: '14px',
  color: 'rgba(224, 234, 247, 0.76)',
  lineHeight: 1.6,
  fontSize: '14px',
}

const summaryHintSmall: CSSProperties = {
  marginTop: '8px',
  color: 'rgba(224, 234, 247, 0.72)',
  lineHeight: 1.5,
  fontSize: '13px',
}

const metricGridStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
}

const metricCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.14) 0%, rgba(16,34,70,0.42) 100%)',
  boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
}

const metricLabel: CSSProperties = {
  color: 'rgba(225,236,250,0.72)',
  fontSize: '0.82rem',
  marginBottom: '0.42rem',
  fontWeight: 700,
  display: 'block',
}

const metricValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '1.8rem',
  fontWeight: 900,
  lineHeight: 1.1,
  display: 'block',
}

const metricSubtle: CSSProperties = {
  marginTop: '8px',
  color: 'rgba(224,234,247,0.72)',
  lineHeight: 1.55,
  fontSize: '0.9rem',
  display: 'block',
}

const cardGridStyle: CSSProperties = {
  display: 'grid',
  gap: '18px',
}

const surfaceCard: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.14) 0%, rgba(16,34,70,0.42) 100%)',
  boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
}

const surfaceCardStrong: CSSProperties = {
  ...surfaceCard,
  background:
    'radial-gradient(circle at top right, rgba(155,225,29,0.10), transparent 34%), linear-gradient(135deg, rgba(13,42,90,0.82) 0%, rgba(8,27,59,0.90) 58%, rgba(7,30,62,0.94) 100%)',
}

const sectionHeadingRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  marginBottom: '16px',
  flexWrap: 'wrap',
}

const sectionKicker: CSSProperties = {
  color: '#8fb7ff',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: 0,
}

const sectionTitle: CSSProperties = {
  margin: '8px 0 0',
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: '-0.04em',
}

const bodyText: CSSProperties = {
  margin: '10px 0 0',
  color: 'rgba(232, 239, 248, 0.84)',
  lineHeight: 1.6,
}

const stackList: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const listRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '14px',
  padding: '14px',
  borderRadius: '18px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
}

const mutedText: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  lineHeight: 1.55,
  fontSize: '0.92rem',
  marginTop: '4px',
}

const emptyState: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  margin: 0,
  lineHeight: 1.65,
}

const emptyStateBlock: CSSProperties = {
  display: 'grid',
  gap: '8px',
}

const helperCallout: CSSProperties = {
  marginTop: '14px',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '34px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: '#e6eefb',
  fontSize: '13px',
  fontWeight: 700,
}

const listLinkCard: CSSProperties = {
  display: 'grid',
  gap: '8px',
  textDecoration: 'none',
  color: '#f8fbff',
  padding: '16px',
  borderRadius: '18px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
}

const tableWrap: CSSProperties = {
  width: '100%',
  overflowX: 'auto',
  borderRadius: '18px',
  border: '1px solid rgba(255,255,255,0.08)',
}

const dataTable: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
}

const tableHeaderCell: CSSProperties = {
  textAlign: 'left',
  padding: '14px',
  background: 'rgba(255,255,255,0.06)',
  color: '#c7dbff',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const tableCell: CSSProperties = {
  padding: '14px',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  color: '#f8fbff',
  verticalAlign: 'top',
}

const playerLink: CSSProperties = {
  color: '#f8fbff',
  textDecoration: 'none',
}
