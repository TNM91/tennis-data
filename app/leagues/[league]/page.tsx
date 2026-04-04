'use client'

export const dynamic = 'force-dynamic'

import Image from 'next/image'
import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type LeagueMatchRow = {
  id: string
  league_name: string | null
  flight: string | null
  usta_section: string | null
  district_area: string | null
  home_team: string | null
  away_team: string | null
  match_date: string
  match_type: 'singles' | 'doubles'
  score: string | null
  winner_side: 'A' | 'B'
}

type TeamSummary = {
  name: string
  matches: number
  homeMatches: number
  awayMatches: number
  wins: number
  losses: number
  latestMatchDate: string | null
}

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/players', label: 'Players' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/matchup', label: 'Matchup' },
  { href: '/leagues', label: 'Leagues' },
  { href: '/teams', label: 'Teams' },
  { href: '/captains-corner', label: "Captain's Corner" },
]

function safeText(value: string | null | undefined, fallback = 'Unknown') {
  const text = (value || '').trim()
  return text || fallback
}

function formatDate(value: string | null) {
  if (!value) return 'Unknown'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function buildTeamHref(teamName: string, leagueName: string, flight: string) {
  const params = new URLSearchParams({
    league: leagueName,
    flight,
  })

  return `/teams/${encodeURIComponent(teamName)}?${params.toString()}`
}

export default function LeagueDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()

  const leagueFromRoute = decodeURIComponent(String(params.league || ''))
  const flight = searchParams.get('flight') || ''
  const section = searchParams.get('section') || ''
  const district = searchParams.get('district') || ''

  const [rows, setRows] = useState<LeagueMatchRow[]>([])
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

  useEffect(() => {
    void loadLeagueMatches()
  }, [leagueFromRoute, flight, section, district])

  async function loadLeagueMatches() {
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

      if (flight) query = query.eq('flight', flight)
      if (section) query = query.eq('usta_section', section)
      if (district) query = query.eq('district_area', district)

      const { data, error } = await query

      if (error) throw new Error(error.message)

      setRows((data || []) as LeagueMatchRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load league.')
    } finally {
      setLoading(false)
    }
  }

  const leagueInfo = useMemo(() => {
    if (!rows.length) {
      return {
        leagueName: leagueFromRoute || 'Unknown League',
        flight: flight || 'Unknown',
        section: section || 'Unknown',
        district: district || 'Unknown',
      }
    }

    const first = rows[0]
    return {
      leagueName: safeText(first.league_name, leagueFromRoute || 'Unknown League'),
      flight: safeText(first.flight, flight || 'Unknown'),
      section: safeText(first.usta_section, section || 'Unknown'),
      district: safeText(first.district_area, district || 'Unknown'),
    }
  }, [rows, leagueFromRoute, flight, section, district])

  const teamSummaries = useMemo<TeamSummary[]>(() => {
    const map = new Map<string, TeamSummary>()

    for (const row of rows) {
      const homeTeam = safeText(row.home_team)
      const awayTeam = safeText(row.away_team)

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

      const winningTeam = row.winner_side === 'A' ? homeTeam : awayTeam
      const losingTeam = row.winner_side === 'A' ? awayTeam : homeTeam

      map.get(winningTeam)!.wins += 1
      map.get(losingTeam)!.losses += 1

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

    return [...map.values()].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      if (a.losses !== b.losses) return a.losses - b.losses
      return a.name.localeCompare(b.name)
    })
  }, [rows])

  const filteredMatches = useMemo(() => {
    if (teamFilter === 'all') return rows
    return rows.filter(
      (row) =>
        safeText(row.home_team) === teamFilter || safeText(row.away_team) === teamFilter
    )
  }, [rows, teamFilter])

  const stats = useMemo(() => {
    const singles = rows.filter((row) => row.match_type === 'singles').length
    const doubles = rows.filter((row) => row.match_type === 'doubles').length
    const teams = teamSummaries.length
    const latest = rows[0]?.match_date || null

    return {
      matchCount: rows.length,
      singles,
      doubles,
      teams,
      latest,
    }
  }, [rows, teamSummaries])

  const dynamicHeaderInner: CSSProperties = {
    ...headerInner,
    flexDirection: isTablet ? 'column' : 'row',
    alignItems: isTablet ? 'flex-start' : 'center',
    gap: isTablet ? '14px' : '18px',
  }

  const dynamicNavStyle: CSSProperties = {
    ...navStyle,
    width: isTablet ? '100%' : 'auto',
    justifyContent: isTablet ? 'flex-start' : 'flex-end',
    flexWrap: 'wrap',
  }

  const dynamicHeroWrap: CSSProperties = {
    ...heroWrap,
    padding: isMobile ? '14px 16px 22px' : '10px 18px 24px',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '28px 18px 22px' : '34px 28px 24px',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
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

  const dynamicFooterInner: CSSProperties = {
    ...footerInner,
    padding: isMobile ? '16px 16px 14px' : '16px 20px 14px',
  }

  const dynamicFooterRow: CSSProperties = {
    ...footerRow,
    flexDirection: isTablet ? 'column' : 'row',
    alignItems: isTablet ? 'flex-start' : 'center',
    gap: isTablet ? '12px' : '18px',
  }

  const dynamicFooterLinks: CSSProperties = {
    ...footerLinks,
    justifyContent: isTablet ? 'flex-start' : 'center',
  }

  const dynamicFooterBottom: CSSProperties = {
    ...footerBottom,
    marginLeft: isTablet ? 0 : 'auto',
  }

  return (
    <main style={pageStyle}>
      <div style={orbOne} />
      <div style={orbTwo} />
      <div style={gridGlow} />

      <header style={headerStyle}>
        <div style={dynamicHeaderInner}>
          <Link href="/" style={brandWrap} aria-label="TenAceIQ home">
            <BrandWordmark compact={isMobile} top />
          </Link>

          <nav style={dynamicNavStyle}>
            {NAV_LINKS.map((link) => {
              const isActive = link.href === '/leagues'
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    ...navLink,
                    ...(isActive ? activeNavLink : {}),
                  }}
                >
                  {link.label}
                </Link>
              )
            })}
            <Link href="/admin" style={navLink}>Admin</Link>
          </nav>
        </div>
      </header>

      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div style={heroNoise} />

          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>League Season</div>
              <h1 style={dynamicHeroTitle}>{leagueInfo.leagueName}</h1>
              <p style={dynamicHeroText}>
                {leagueInfo.flight} · {leagueInfo.section} · {leagueInfo.district}
              </p>

              <div style={heroHintRow}>
                <span style={heroHintPill}>{stats.matchCount} matches</span>
                <span style={heroHintPill}>{stats.teams} teams</span>
                <span style={heroHintPill}>Latest: {formatDate(stats.latest)}</span>
              </div>
            </div>

            <div style={dynamicSeasonToolsCard}>
              <div style={seasonToolsLabel}>Season tools</div>
              <div style={seasonToolsValue}>{leagueInfo.flight}</div>
              <div style={seasonToolsText}>
                Review team performance, standings-style summaries, and match history for this league segment.
              </div>

              <div style={seasonToolsActions}>
                <Link href="/leagues" style={ghostButton}>
                  Back to Leagues
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={contentWrap}>
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
          ) : rows.length === 0 ? (
            <div style={stateBox}>No matches found for this league.</div>
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
                          <div style={teamRecord}>{team.wins}-{team.losses} record</div>
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
                  </div>
                </div>

                <div style={matchList}>
                  {filteredMatches.map((row) => {
                    const home = safeText(row.home_team)
                    const away = safeText(row.away_team)
                    const winner = row.winner_side === 'A' ? home : away

                    return (
                      <div key={row.id} style={matchCard}>
                        <div style={dynamicMatchTop}>
                          <div>
                            <div style={matchTitle}>
                              {home} vs {away}
                            </div>
                            <div style={matchMeta}>
                              {formatDate(row.match_date)} · {row.match_type}
                            </div>
                          </div>

                          <div style={winnerPill}>Winner: {winner}</div>
                        </div>

                        <div style={dynamicMatchBottom}>
                          <div style={scoreText}>{row.score || 'No score entered'}</div>
                          <div style={subMeta}>{leagueInfo.flight} · {leagueInfo.district}</div>
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

      <footer style={footerStyle}>
        <div style={dynamicFooterInner}>
          <div style={dynamicFooterRow}>
            <Link href="/" style={footerBrandLink}>
              <BrandWordmark compact={false} footer />
            </Link>

            <div style={dynamicFooterLinks}>
              <Link href="/players" style={footerUtilityLink}>Players</Link>
              <Link href="/rankings" style={footerUtilityLink}>Rankings</Link>
              <Link href="/matchup" style={footerUtilityLink}>Matchup</Link>
              <Link href="/leagues" style={footerUtilityLink}>Leagues</Link>
              <Link href="/teams" style={footerUtilityLink}>Teams</Link>
              <Link href="/captains-corner" style={footerUtilityLink}>Captain&apos;s Corner</Link>
            </div>

            <div style={dynamicFooterBottom}>© {new Date().getFullYear()} TenAceIQ</div>
          </div>
        </div>
      </footer>
    </main>
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

function BrandWordmark({
  compact = false,
  footer = false,
  top = false,
}: {
  compact?: boolean
  footer?: boolean
  top?: boolean
}) {
  const iconSize = compact ? 30 : top ? 38 : footer ? 36 : 34
  const fontSize = compact ? 24 : top ? 30 : footer ? 27 : 27

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '8px' : '10px',
        lineHeight: 1,
      }}
    >
      <Image
        src="/logo-icon.png"
        alt="TenAceIQ"
        width={iconSize}
        height={iconSize}
        priority
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          display: 'block',
          objectFit: 'contain',
        }}
      />

      <div
        style={{
          fontWeight: 900,
          letterSpacing: '-0.045em',
          fontSize: `${fontSize}px`,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'baseline',
        }}
      >
        <span style={{ color: footer ? '#FFFFFF' : '#F8FBFF' }}>TenAce</span>
        <span style={brandIQ}>IQ</span>
      </div>
    </div>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  position: 'relative',
  overflow: 'hidden',
  background:
    'radial-gradient(circle at top, rgba(66,149,255,0.16), transparent 28%), linear-gradient(180deg, #07111f 0%, #0b1730 42%, #0d1b35 100%)',
}

const orbOne: CSSProperties = {
  position: 'absolute',
  top: '-90px',
  left: '-110px',
  width: '340px',
  height: '340px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(84,163,255,0.18) 0%, rgba(84,163,255,0) 70%)',
  pointerEvents: 'none',
}

const orbTwo: CSSProperties = {
  position: 'absolute',
  right: '-120px',
  top: '180px',
  width: '340px',
  height: '340px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(90,233,176,0.11) 0%, rgba(90,233,176,0) 68%)',
  pointerEvents: 'none',
}

const gridGlow: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)',
  backgroundRepeat: 'repeat, repeat',
  backgroundSize: '34px 34px, 34px 34px',
  maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent 88%)',
  pointerEvents: 'none',
}

const headerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  padding: '24px 18px 0',
}

const headerInner: CSSProperties = {
  width: '100%',
  maxWidth: '1240px',
  margin: '0 auto',
  display: 'flex',
  justifyContent: 'space-between',
}

const brandWrap: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  textDecoration: 'none',
}

const brandIQ: CSSProperties = {
  background: 'linear-gradient(135deg, #4ade80 0%, #bbf7d0 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  marginLeft: '2px',
}

const navStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
}

const navLink: CSSProperties = {
  color: 'rgba(231,243,255,0.9)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
  letterSpacing: '0.01em',
  padding: '10px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(122,170,255,0.16)',
  background: 'rgba(22,42,78,0.42)',
  backdropFilter: 'blur(14px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  transition: 'all 180ms ease',
}

const activeNavLink: CSSProperties = {
  color: '#06111f',
  background: 'linear-gradient(135deg, #4ade80 0%, #86efac 100%)',
  border: '1px solid rgba(134,239,172,0.45)',
  boxShadow: '0 10px 30px rgba(74,222,128,0.22)',
}

const heroWrap: CSSProperties = {
  position: 'relative',
  zIndex: 1,
}

const heroShell: CSSProperties = {
  width: '100%',
  maxWidth: '1240px',
  margin: '0 auto',
  borderRadius: '30px',
  background:
    'linear-gradient(180deg, rgba(16,29,56,0.84) 0%, rgba(13,25,48,0.72) 100%)',
  border: '1px solid rgba(128,174,255,0.12)',
  boxShadow:
    '0 24px 80px rgba(6,18,42,0.24), inset 0 1px 0 rgba(255,255,255,0.05)',
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
  gap: '12px',
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

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '0 18px 0',
}

const metricGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
  marginBottom: '16px',
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
  marginBottom: '16px',
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

const footerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  padding: '12px 18px 20px',
}

const footerInner: CSSProperties = {
  width: '100%',
  maxWidth: '1240px',
  margin: '0 auto',
  borderRadius: '22px',
  background: 'rgba(17,31,58,0.72)',
  border: '1px solid rgba(128,174,255,0.12)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const footerRow: CSSProperties = {
  display: 'flex',
  width: '100%',
}

const footerBrandLink: CSSProperties = {
  display: 'inline-flex',
  textDecoration: 'none',
  flexShrink: 0,
}

const footerLinks: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px 14px',
}

const footerUtilityLink: CSSProperties = {
  color: 'rgba(231,243,255,0.86)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
}

const footerBottom: CSSProperties = {
  color: 'rgba(190,205,224,0.74)',
  fontSize: '13px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
}