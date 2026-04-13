'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SiteShell from '@/app/components/site-shell'
import FollowButton from '@/app/components/follow-button'

type LeagueMatchRow = {
  id: string
  league_name: string | null
  flight: string | null
  usta_section: string | null
  district_area: string | null
  home_team: string | null
  away_team: string | null
  match_date: string
  match_type: 'singles' | 'doubles' | null
  score: string | null
  winner_side: 'A' | 'B' | null
}

type TeamSummary = {
  name: string
  matches: number
  homeMatches: number
  awayMatches: number
  wins: number
  losses: number
  latestMatchDate: string | null
  winPct: number
}

type LeagueScopeDiagnostic = {
  totalRows: number
  leagueNames: string[]
}

function cleanText(value: string | null | undefined): string | null {
  const text = (value || '').trim()
  return text.length > 0 ? text : null
}

function normalizeCompareText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function buildTeamHref(teamName: string, leagueName: string, flight: string) {
  const params = new URLSearchParams()

  if (leagueName) params.set('league', leagueName)
  if (flight) params.set('flight', flight)

  const query = params.toString()
  return `/teams/${encodeURIComponent(teamName)}${query ? `?${query}` : ''}`
}

function buildLeagueScopeHref(leagueName: string, flight: string, section: string, district: string) {
  const params = new URLSearchParams()

  if (leagueName) params.set('league', leagueName)
  if (flight) params.set('flight', flight)
  if (section) params.set('section', section)
  if (district) params.set('district', district)

  const query = params.toString()
  return `/leagues/${encodeURIComponent(leagueName || 'league')}${query ? `?${query}` : ''}`
}

export default function LeagueDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()

  const leagueFromRoute = decodeURIComponent(String(params.league || ''))
  const flight = searchParams.get('flight') || ''
  const section = searchParams.get('section') || ''
  const district = searchParams.get('district') || ''

  const [rows, setRows] = useState<LeagueMatchRow[]>([])
  const [nearbyRows, setNearbyRows] = useState<LeagueMatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [teamFilter, setTeamFilter] = useState('all')
  const [screenWidth, setScreenWidth] = useState(1280)

  const isTablet = screenWidth < 1080
  const isMobile = screenWidth < 820
  const isSmallMobile = screenWidth < 560

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const loadLeagueMatches = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      let query = supabase
        .from('matches')
        .select(`
          id,
          league_name,
          flight,
          usta_section,
          district_area,
          home_team,
          away_team,
          match_date,
          match_type,
          score,
          winner_side
        `)
        .eq('league_name', leagueFromRoute)
        .order('match_date', { ascending: false })
        .limit(200)

      if (flight) query = query.eq('flight', flight)
      if (section) query = query.eq('usta_section', section)
      if (district) query = query.eq('district_area', district)

      const { data, error } = await query

      if (error) throw new Error(error.message)

      const exactRows = (data || []) as LeagueMatchRow[]
      setRows(exactRows)

      if (exactRows.length === 0 && (flight || section || district)) {
        let fallbackQuery = supabase
          .from('matches')
          .select(`
            id,
            league_name,
            flight,
            usta_section,
            district_area,
            home_team,
            away_team,
            match_date,
            match_type,
            score,
            winner_side
          `)
          .order('match_date', { ascending: false })
          .limit(200)

        if (flight) fallbackQuery = fallbackQuery.eq('flight', flight)
        if (section) fallbackQuery = fallbackQuery.eq('usta_section', section)
        if (district) fallbackQuery = fallbackQuery.eq('district_area', district)

        const { data: fallbackData, error: fallbackError } = await fallbackQuery
        if (fallbackError) throw new Error(fallbackError.message)
        setNearbyRows((fallbackData || []) as LeagueMatchRow[])
      } else {
        setNearbyRows([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load league.')
    } finally {
      setLoading(false)
    }
  }, [district, flight, leagueFromRoute, section])

  useEffect(() => {
    void loadLeagueMatches()
  }, [loadLeagueMatches])

  const validRows = useMemo(() => {
    return rows.filter((row) => {
      const home = cleanText(row.home_team)
      const away = cleanText(row.away_team)
      return Boolean(home && away)
    })
  }, [rows])

  const nearbyScopeDiagnostic = useMemo<LeagueScopeDiagnostic | null>(() => {
    if (validRows.length > 0 || nearbyRows.length === 0) return null

    const leagueNames = Array.from(
      new Set(
        nearbyRows
          .map((row) => cleanText(row.league_name))
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => {
      const route = normalizeCompareText(leagueFromRoute)
      const aMatches = normalizeCompareText(a).includes(route) ? 1 : 0
      const bMatches = normalizeCompareText(b).includes(route) ? 1 : 0
      if (aMatches !== bMatches) return bMatches - aMatches
      return a.localeCompare(b)
    })

    return {
      totalRows: nearbyRows.length,
      leagueNames,
    }
  }, [validRows.length, nearbyRows, leagueFromRoute])

  const leagueInfo = useMemo(() => {
    if (!validRows.length) {
      return {
        leagueName: leagueFromRoute || '',
        flight: flight || '',
        section: section || '',
        district: district || '',
      }
    }

    const first = validRows[0]

    return {
      leagueName: cleanText(first.league_name) || leagueFromRoute || '',
      flight: cleanText(first.flight) || flight || '',
      section: cleanText(first.usta_section) || section || '',
      district: cleanText(first.district_area) || district || '',
    }
  }, [validRows, leagueFromRoute, flight, section, district])

  const teamSummaries = useMemo<TeamSummary[]>(() => {
    const map = new Map<string, Omit<TeamSummary, 'winPct'>>()

    for (const row of validRows) {
      const homeTeam = cleanText(row.home_team)
      const awayTeam = cleanText(row.away_team)
      if (!homeTeam || !awayTeam) continue

      if (!map.has(homeTeam)) {
        map.set(homeTeam, {
          name: homeTeam,
          matches: 0,
          homeMatches: 0,
          awayMatches: 0,
          wins: 0,
          losses: 0,
          latestMatchDate: null,
        })
      }

      if (!map.has(awayTeam)) {
        map.set(awayTeam, {
          name: awayTeam,
          matches: 0,
          homeMatches: 0,
          awayMatches: 0,
          wins: 0,
          losses: 0,
          latestMatchDate: null,
        })
      }

      const home = map.get(homeTeam)!
      const away = map.get(awayTeam)!

      home.matches += 1
      home.homeMatches += 1
      away.matches += 1
      away.awayMatches += 1

      if (row.winner_side === 'A') {
        home.wins += 1
        away.losses += 1
      } else if (row.winner_side === 'B') {
        away.wins += 1
        home.losses += 1
      }

      for (const team of [home, away]) {
        if (
          row.match_date &&
          (!team.latestMatchDate ||
            new Date(row.match_date).getTime() > new Date(team.latestMatchDate).getTime())
        ) {
          team.latestMatchDate = row.match_date
        }
      }
    }

    return [...map.values()]
      .map((team) => ({
        ...team,
        winPct: team.matches > 0 ? team.wins / team.matches : 0,
      }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        if (b.winPct !== a.winPct) return b.winPct - a.winPct
        if (a.losses !== b.losses) return a.losses - b.losses
        return a.name.localeCompare(b.name)
      })
  }, [validRows])

  const filteredMatches = useMemo(() => {
    if (teamFilter === 'all') return validRows

    return validRows.filter((row) => {
      const home = cleanText(row.home_team)
      const away = cleanText(row.away_team)
      return home === teamFilter || away === teamFilter
    })
  }, [validRows, teamFilter])
  const hasActiveTeamFilter = teamFilter !== 'all'

  const stats = useMemo(() => {
    const singles = validRows.filter((row) => row.match_type === 'singles').length
    const doubles = validRows.filter((row) => row.match_type === 'doubles').length
    const teams = teamSummaries.length
    const latest = validRows[0]?.match_date || null

    return {
      matchCount: validRows.length,
      singles,
      doubles,
      teams,
      latest,
    }
  }, [validRows, teamSummaries])

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '28px 18px 22px' : '34px 28px 24px',
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 0.95fr) minmax(300px, 1.05fr)',
    gap: isMobile ? '18px' : '22px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '46px' : '60px',
    lineHeight: isMobile ? 1.04 : 0.98,
    maxWidth: '560px',
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
    maxWidth: '560px',
  }

  const dynamicSeasonToolsCard: CSSProperties = {
    ...seasonToolsCard,
    position: isTablet ? 'relative' : 'sticky',
    top: isTablet ? 'auto' : '24px',
  }

  const dynamicMetricGrid: CSSProperties = {
    ...metricGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isMobile
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(5, minmax(0, 1fr))',
  }

  const dynamicSectionHead: CSSProperties = {
    ...sectionHead,
    alignItems: isMobile ? 'flex-start' : 'flex-end',
  }

  const dynamicTeamGrid: CSSProperties = {
    ...teamGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
  }

  const dynamicTeamTop: CSSProperties = {
    ...teamTop,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : 'flex-start',
  }

  const dynamicMiniGrid: CSSProperties = {
    ...miniGrid,
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicMatchTop: CSSProperties = {
    ...matchTop,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : 'flex-start',
  }

  const dynamicMatchBottom: CSSProperties = {
    ...matchBottom,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'flex-start' : 'center',
  }

  const subtitleParts = [leagueInfo.flight, leagueInfo.section, leagueInfo.district].filter(Boolean)
  const stableLeagueFollowId = [leagueInfo.leagueName || leagueFromRoute, leagueInfo.flight, leagueInfo.section, leagueInfo.district]
    .map((value) => cleanText(value) || '')
    .join('__')

  return (
    <SiteShell active="/leagues">
      <section style={pageContent}>
        <section style={dynamicHeroShell}>
          <div>
            <div style={eyebrow}>League Season</div>
            <h1 style={dynamicHeroTitle}>{leagueInfo.leagueName || 'League Season'}</h1>
            {subtitleParts.length > 0 ? (
              <p style={dynamicHeroText}>{subtitleParts.join(' · ')}</p>
            ) : null}

            <div style={heroHintRow}>
              <span style={heroHintPill}>{stats.matchCount} matches</span>
              <span style={heroHintPill}>{stats.teams} teams</span>
              <span style={heroHintPill}>Latest: {formatDate(stats.latest)}</span>
            </div>

            <div style={heroActions}>
              <FollowButton
                entityType="league"
                entityId={stableLeagueFollowId}
                entityName={leagueInfo.leagueName || leagueFromRoute || 'League'}
                subtitle={subtitleParts.join(' · ')}
              />
              <Link href="/leagues" style={ghostButton}>
                Back to Leagues
              </Link>
            </div>
          </div>

          <div style={dynamicSeasonToolsCard}>
            <div style={seasonToolsLabel}>Season tools</div>
            <div style={seasonToolsValue}>{leagueInfo.flight || 'League'}</div>
            <div style={seasonToolsText}>
              Review team performance, standings-style summaries, and match history for this league segment.
            </div>

            <div style={seasonToolsActions}>
              {leagueInfo.section ? <span style={miniPillSlate}>{leagueInfo.section}</span> : null}
              {leagueInfo.district ? <span style={miniPillGreen}>{leagueInfo.district}</span> : null}
            </div>
          </div>
        </section>

        <div style={dynamicMetricGrid}>
          <MetricCard label="Matches" value={String(stats.matchCount)} />
          <MetricCard label="Teams" value={String(stats.teams)} />
          <MetricCard label="Singles Lines" value={String(stats.singles)} />
          <MetricCard label="Doubles Lines" value={String(stats.doubles)} />
          <MetricCard label="Latest Match" value={formatDate(stats.latest)} accent />
        </div>

        <article style={panelCard}>
          {loading ? (
            <div style={stateBox}>Loading season data...</div>
          ) : error ? (
            <div style={errorBox}>{error}</div>
          ) : validRows.length === 0 ? (
            <div style={stateBox}>
              No valid matches were found for this league segment yet.
              <div style={stateHelperText}>
                This usually means the season scope exists, but imported match rows do not yet include both team names
                for this exact league, flight, or district slice.
              </div>
              {nearbyScopeDiagnostic ? (
                <div style={{ ...stateHelperText, marginTop: 12 }}>
                  I did find {nearbyScopeDiagnostic.totalRows} nearby rows in the same flight/section/district scope.
                  {nearbyScopeDiagnostic.leagueNames.length > 0
                    ? ` Nearby league names: ${nearbyScopeDiagnostic.leagueNames.slice(0, 5).join(' | ')}`
                    : ' Those rows are also missing a visible league name.'}
                </div>
              ) : null}
              {nearbyScopeDiagnostic && nearbyScopeDiagnostic.leagueNames.length > 0 ? (
                <div style={{ ...stateActionRow, marginTop: 12 }}>
                  {nearbyScopeDiagnostic.leagueNames.slice(0, 3).map((name) => (
                    <Link
                      key={name}
                      href={buildLeagueScopeHref(name, leagueInfo.flight, leagueInfo.section, leagueInfo.district)}
                      style={ghostButton}
                    >
                      Try {name}
                    </Link>
                  ))}
                </div>
              ) : null}
              <div style={stateActionRow}>
                <Link href="/leagues" style={ghostButton}>
                  Back to leagues
                </Link>
                <Link href="/teams" style={ghostButton}>
                  Browse teams
                </Link>
              </div>
            </div>
          ) : (
            <>
              <section>
                <div style={dynamicSectionHead}>
                  <div>
                    <div style={sectionKicker}>Team Summary</div>
                    <h2 style={sectionTitle}>Teams</h2>
                    <div style={sectionSub}>
                      Standings-style season snapshot for each team in this league.
                    </div>
                  </div>
                </div>

                <div style={dynamicTeamGrid}>
                  {teamSummaries.map((team, index) => (
                    <div key={team.name} style={teamCard}>
                      <div style={cardGlow} />

                      <div style={dynamicTeamTop}>
                        <div>
                          <div style={teamRank}>#{index + 1}</div>
                          <div style={teamName}>{team.name}</div>
                          <div style={teamRecord}>
                            {team.wins}-{team.losses} record
                            {team.matches > 0 ? ` · ${(team.winPct * 100).toFixed(0)}% win` : ''}
                          </div>
                        </div>

                        <Link
                          href={buildTeamHref(team.name, leagueInfo.leagueName, leagueInfo.flight)}
                          style={primaryButton}
                        >
                          Team Page
                        </Link>
                      </div>

                      <div style={dynamicMiniGrid}>
                        <MiniStatCard label="Matches" value={String(team.matches)} />
                        <MiniStatCard label="Home" value={String(team.homeMatches)} />
                        <MiniStatCard label="Away" value={String(team.awayMatches)} />
                        <MiniStatCard label="Latest" value={formatDate(team.latestMatchDate)} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section style={{ marginTop: '24px' }}>
                <div style={dynamicSectionHead}>
                  <div>
                    <div style={sectionKicker}>Season Matches</div>
                    <h2 style={sectionTitle}>Match History</h2>
                    <div style={sectionSub}>
                      Filter the season list by team to narrow the schedule and results.
                    </div>
                  </div>

                  <div style={filterWrap}>
                    <label htmlFor="teamFilter" style={inputLabel}>
                      Filter by team
                    </label>
                    <select
                      id="teamFilter"
                      value={teamFilter}
                      onChange={(e) => setTeamFilter(e.target.value)}
                      style={selectStyle}
                    >
                      <option value="all">All Teams</option>
                      {teamSummaries.map((team) => (
                        <option key={team.name} value={team.name}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    {hasActiveTeamFilter ? (
                      <button
                        type="button"
                        onClick={() => setTeamFilter('all')}
                        style={clearFilterButton}
                      >
                        Clear team filter
                      </button>
                    ) : null}
                  </div>
                </div>

                {filteredMatches.length === 0 ? (
                  <div style={stateBox}>
                    No matches matched the selected team filter.
                    <div style={stateHelperText}>
                      Clear the active filter to return to the full season view, or choose another team from the season
                      summary above.
                    </div>
                  </div>
                ) : null}

                <div style={matchList}>
                  {filteredMatches.map((row) => {
                    const home = cleanText(row.home_team)
                    const away = cleanText(row.away_team)
                    if (!home || !away) return null

                    const winner =
                      row.winner_side === 'A'
                        ? home
                        : row.winner_side === 'B'
                          ? away
                          : '—'

                    return (
                      <div key={row.id} style={matchCard}>
                        <div style={dynamicMatchTop}>
                          <div>
                            <div style={matchTitle}>
                              {home} vs {away}
                            </div>
                            <div style={matchMeta}>
                              {formatDate(row.match_date)}
                              {row.match_type ? ` · ${row.match_type}` : ''}
                            </div>
                          </div>

                          <div style={winnerPill}>Winner: {winner}</div>
                        </div>

                        <div style={dynamicMatchBottom}>
                          <div style={scoreText}>{row.score ?? '—'}</div>
                          <div style={subMeta}>
                            {[leagueInfo.flight, leagueInfo.district].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </article>
      </section>
    </SiteShell>
  )
}

function MetricCard({
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
        ...metricCard,
        ...(accent ? metricCardAccent : {}),
      }}
    >
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
    </div>
  )
}

function MiniStatCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div style={miniStatCard}>
      <div style={miniStatLabel}>{label}</div>
      <div style={miniStatValue}>{value}</div>
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

const heroTitle: CSSProperties = {
  margin: '16px 0 0',
  color: '#f8fbff',
  fontWeight: 900,
  letterSpacing: '-0.045em',
}

const heroText: CSSProperties = {
  margin: '14px 0 0',
  color: 'rgba(224,236,249,0.86)',
  lineHeight: 1.65,
  fontWeight: 500,
}

const heroHintRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '16px',
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

const heroActions: CSSProperties = {
  marginTop: '18px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
}

const seasonToolsCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(128,174,255,0.16)',
  background: 'linear-gradient(180deg, rgba(45,79,137,0.42) 0%, rgba(24,45,84,0.5) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
}

const seasonToolsLabel: CSSProperties = {
  color: 'rgba(217, 231, 255, 0.82)',
  fontSize: '12px',
  lineHeight: 1.5,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const seasonToolsValue: CSSProperties = {
  marginTop: '8px',
  color: '#ffffff',
  fontSize: '34px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const seasonToolsText: CSSProperties = {
  marginTop: '10px',
  color: 'rgba(219, 234, 254, 0.88)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
}

const seasonToolsActions: CSSProperties = {
  marginTop: '16px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
}

const ghostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#e7eefb',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '13px',
}

const miniPillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
}

const miniPillSlate: CSSProperties = {
  ...miniPillBase,
  background: 'rgba(255,255,255,0.08)',
  color: '#dfe8f8',
}

const miniPillGreen: CSSProperties = {
  ...miniPillBase,
  background: 'rgba(155,225,29,0.14)',
  color: '#e7ffd1',
}

const metricGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const metricCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.32) 0%, rgba(28,49,95,0.46) 100%)',
  boxShadow: '0 14px 34px rgba(9,25,54,0.14), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
}

const metricCardAccent: CSSProperties = {
  border: '1px solid rgba(111, 236, 168, 0.34)',
  boxShadow: '0 16px 34px rgba(43, 195, 104, 0.14), inset 0 1px 0 rgba(255,255,255,0.08)',
}

const metricLabel: CSSProperties = {
  color: 'rgba(198,216,248,0.78)',
  fontSize: '13px',
  lineHeight: 1.5,
  fontWeight: 750,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const metricValue: CSSProperties = {
  marginTop: '8px',
  color: '#f8fbff',
  fontSize: '32px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const panelCard: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(133, 168, 229, 0.16)',
  background:
    'radial-gradient(circle at top right, rgba(184, 230, 26, 0.12), transparent 34%), linear-gradient(135deg, rgba(8, 34, 75, 0.98) 0%, rgba(4, 18, 45, 0.98) 58%, rgba(7, 36, 46, 0.98) 100%)',
  boxShadow: '0 28px 60px rgba(2, 8, 23, 0.28)',
  minWidth: 0,
}

const stateBox: CSSProperties = {
  borderRadius: '18px',
  padding: '18px',
  background: 'linear-gradient(180deg, rgba(38,67,118,0.46) 0%, rgba(22,40,78,0.58) 100%)',
  border: '1px solid rgba(128,174,255,0.14)',
  color: '#dbeafe',
  fontSize: '15px',
  lineHeight: 1.7,
  fontWeight: 600,
  textAlign: 'center',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const errorBox: CSSProperties = {
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.18)',
  color: '#fecaca',
  fontWeight: 700,
  fontSize: '14px',
}

const stateHelperText: CSSProperties = {
  marginTop: '10px',
  color: 'rgba(219, 234, 254, 0.84)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
}

const stateActionRow: CSSProperties = {
  marginTop: '14px',
  display: 'flex',
  justifyContent: 'center',
  gap: '10px',
  flexWrap: 'wrap',
}

const sectionHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  flexWrap: 'wrap',
  marginBottom: '16px',
}

const sectionKicker: CSSProperties = {
  color: '#8fb7ff',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: '-0.04em',
}

const sectionSub: CSSProperties = {
  marginTop: '8px',
  color: '#c0d5f5',
  fontSize: '14px',
  lineHeight: 1.6,
  fontWeight: 500,
}

const teamGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const teamCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.32) 0%, rgba(28,49,95,0.46) 100%)',
  boxShadow: '0 14px 34px rgba(9,25,54,0.14), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
}

const cardGlow: CSSProperties = {
  position: 'absolute',
  top: '-70px',
  right: '-50px',
  width: '180px',
  height: '180px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(78,178,255,0.24), rgba(78,178,255,0) 70%)',
  pointerEvents: 'none',
}

const teamTop: CSSProperties = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  marginBottom: '16px',
}

const teamRank: CSSProperties = {
  color: '#8ec5ff',
  fontSize: '12px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: '8px',
}

const teamName: CSSProperties = {
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const teamRecord: CSSProperties = {
  marginTop: '8px',
  color: '#8ec5ff',
  fontSize: '15px',
  lineHeight: 1.5,
  fontWeight: 800,
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
  padding: '0 16px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, rgba(103, 241, 154, 1), rgba(40, 205, 110, 0.94))',
  color: '#071622',
  fontWeight: 900,
  fontSize: '13px',
  letterSpacing: '0.01em',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxShadow: '0 12px 30px rgba(43, 195, 104, 0.20), inset 0 1px 0 rgba(255,255,255,0.26)',
}

const miniGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const miniStatCard: CSSProperties = {
  borderRadius: '18px',
  padding: '14px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.08)',
  minWidth: 0,
}

const miniStatLabel: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 700,
  marginBottom: '6px',
}

const miniStatValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '16px',
  lineHeight: 1.35,
  fontWeight: 800,
  wordBreak: 'break-word',
}

const filterWrap: CSSProperties = {
  width: '260px',
  maxWidth: '100%',
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

const clearFilterButton: CSSProperties = {
  marginTop: '10px',
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

const matchList: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
}

const matchCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(140,184,255,0.16)',
  background: 'linear-gradient(180deg, rgba(39,67,118,0.34) 0%, rgba(20,36,71,0.46) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const matchTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
}

const matchTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '20px',
  lineHeight: 1.25,
  fontWeight: 900,
  letterSpacing: '-0.02em',
}

const matchMeta: CSSProperties = {
  color: '#c0d5f5',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 500,
  marginTop: '6px',
  textTransform: 'capitalize',
}

const winnerPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 12px',
  borderRadius: '999px',
  background: 'rgba(34, 197, 94, 0.14)',
  border: '1px solid rgba(34, 197, 94, 0.22)',
  color: '#bbf7d0',
  fontSize: '12px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap',
}

const matchBottom: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  marginTop: '14px',
  paddingTop: '14px',
  borderTop: '1px solid rgba(255,255,255,0.08)',
}

const scoreText: CSSProperties = {
  color: '#8ec5ff',
  fontSize: '18px',
  lineHeight: 1.2,
  fontWeight: 900,
}

const subMeta: CSSProperties = {
  color: '#c0d5f5',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 500,
}
