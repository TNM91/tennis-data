'use client'

export const dynamic = 'force-dynamic'

import Image from 'next/image'
import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type MatchLeagueRow = {
  id: string
  league_name: string | null
  flight: string | null
  usta_section: string | null
  district_area: string | null
  home_team: string | null
  away_team: string | null
  match_date: string
}

type LeagueCard = {
  key: string
  leagueName: string
  flight: string
  ustaSection: string
  districtArea: string
  matchCount: number
  teamCount: number
  latestMatchDate: string | null
}

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/players', label: 'Players' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/matchup', label: 'Matchup' },
  { href: '/leagues', label: 'Leagues' },
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

function buildLeagueKey(row: MatchLeagueRow) {
  return [
    safeText(row.league_name),
    safeText(row.flight),
    safeText(row.usta_section),
    safeText(row.district_area),
  ].join('___')
}

function buildLeagueHref(league: LeagueCard) {
  const params = new URLSearchParams({
    league: league.leagueName,
    flight: league.flight,
    section: league.ustaSection,
    district: league.districtArea,
  })

  return `/leagues/${encodeURIComponent(league.leagueName)}?${params.toString()}`
}

export default function LeaguesPage() {
  const [rows, setRows] = useState<MatchLeagueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [flightFilter, setFlightFilter] = useState('all')
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
    void loadLeagueRows()
  }, [])

  async function loadLeagueRows() {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          league_name,
          flight,
          usta_section,
          district_area,
          home_team,
          away_team,
          match_date
        `)
        .order('match_date', { ascending: false })

      if (error) throw new Error(error.message)

      setRows((data || []) as MatchLeagueRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leagues.')
    } finally {
      setLoading(false)
    }
  }

  const leagues = useMemo<LeagueCard[]>(() => {
    const map = new Map<string, LeagueCard & { teamSet: Set<string> }>()

    for (const row of rows) {
      const key = buildLeagueKey(row)

      if (!map.has(key)) {
        map.set(key, {
          key,
          leagueName: safeText(row.league_name),
          flight: safeText(row.flight),
          ustaSection: safeText(row.usta_section),
          districtArea: safeText(row.district_area),
          matchCount: 0,
          teamCount: 0,
          latestMatchDate: row.match_date || null,
          teamSet: new Set<string>(),
        })
      }

      const current = map.get(key)!
      current.matchCount += 1

      if (row.home_team) current.teamSet.add(row.home_team.trim())
      if (row.away_team) current.teamSet.add(row.away_team.trim())

      if (
        row.match_date &&
        (!current.latestMatchDate ||
          new Date(row.match_date).getTime() > new Date(current.latestMatchDate).getTime())
      ) {
        current.latestMatchDate = row.match_date
      }
    }

    return [...map.values()]
      .map((item) => ({
        key: item.key,
        leagueName: item.leagueName,
        flight: item.flight,
        ustaSection: item.ustaSection,
        districtArea: item.districtArea,
        matchCount: item.matchCount,
        teamCount: item.teamSet.size,
        latestMatchDate: item.latestMatchDate,
      }))
      .sort((a, b) => {
        const aDate = a.latestMatchDate ? new Date(a.latestMatchDate).getTime() : 0
        const bDate = b.latestMatchDate ? new Date(b.latestMatchDate).getTime() : 0
        return bDate - aDate
      })
  }, [rows])

  const flights = useMemo(() => {
    const unique = [...new Set(leagues.map((league) => league.flight).filter(Boolean))]
    return unique.sort((a, b) => a.localeCompare(b))
  }, [leagues])

  const filteredLeagues = useMemo(() => {
    const term = search.trim().toLowerCase()

    return leagues.filter((league) => {
      const matchesFlight = flightFilter === 'all' || league.flight === flightFilter
      const matchesSearch =
        !term ||
        league.leagueName.toLowerCase().includes(term) ||
        league.flight.toLowerCase().includes(term) ||
        league.ustaSection.toLowerCase().includes(term) ||
        league.districtArea.toLowerCase().includes(term)

      return matchesFlight && matchesSearch
    })
  }, [leagues, search, flightFilter])

  const summary = useMemo(() => {
    return {
      totalLeagues: filteredLeagues.length,
      totalMatches: rows.length,
      totalFlights: flights.length,
      latestMatch:
        leagues.length > 0
          ? leagues
              .map((league) => league.latestMatchDate)
              .filter(Boolean)
              .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] || null
          : null,
    }
  }, [filteredLeagues.length, rows.length, flights.length, leagues])

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
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
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

  const dynamicCoverageCard: CSSProperties = {
    ...coverageCard,
    position: isTablet ? 'relative' : 'sticky',
    top: isTablet ? 'auto' : '24px',
  }

  const dynamicSummaryGrid: CSSProperties = {
    ...summaryGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isMobile
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(4, minmax(0, 1fr))',
  }

  const dynamicFilterGrid: CSSProperties = {
    ...filterGrid,
    gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 220px',
  }

  const dynamicCardGrid: CSSProperties = {
    ...cardGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : 'repeat(auto-fit, minmax(320px, 1fr))',
  }

  const dynamicLeagueDetailGrid: CSSProperties = {
    ...leagueDetailGrid,
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicLeagueTop: CSSProperties = {
    ...leagueTop,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : 'flex-start',
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
              <div style={eyebrow}>League Explorer</div>
              <h1 style={dynamicHeroTitle}>Browse imported league seasons.</h1>
              <p style={dynamicHeroText}>
                Explore league groupings by league name, flight, section, and district.
                This is the foundation for season views, team pages, matchup prep, and future lineup
                projections across TenAceIQ.
              </p>

              <div style={heroHintRow}>
                <span style={heroHintPill}>{summary.totalLeagues} leagues</span>
                <span style={heroHintPill}>{summary.totalMatches} imported matches</span>
                <span style={heroHintPill}>Latest: {formatDate(summary.latestMatch)}</span>
              </div>
            </div>

            <div style={dynamicCoverageCard}>
              <div style={coverageLabel}>Coverage snapshot</div>
              <div style={coverageValue}>{summary.totalFlights}</div>
              <div style={coverageText}>
                Unique flights currently represented in imported match history.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={contentWrap}>
        <div style={dynamicSummaryGrid}>
          <MetricCard label="Visible leagues" value={String(summary.totalLeagues)} />
          <MetricCard label="Imported matches" value={String(summary.totalMatches)} />
          <MetricCard label="Flights" value={String(summary.totalFlights)} />
          <MetricCard label="Latest match" value={formatDate(summary.latestMatch)} accent />
        </div>

        <article style={panelCard}>
          <div style={panelHead}>
            <div>
              <div style={sectionKicker}>Filters</div>
              <h2 style={panelTitle}>Search and narrow league groups</h2>
            </div>
          </div>

          <div style={dynamicFilterGrid}>
            <div>
              <label htmlFor="league-search" style={inputLabel}>Search</label>
              <div style={searchWrap}>
                <div style={searchIconWrap}>
                  <SearchIcon />
                </div>
                <input
                  id="league-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by league, flight, section, or district"
                  style={searchInput}
                />
              </div>
            </div>

            <div>
              <label htmlFor="league-flight-filter" style={inputLabel}>Flight</label>
              <select
                id="league-flight-filter"
                value={flightFilter}
                onChange={(e) => setFlightFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="all">All Flights</option>
                {flights.map((flight) => (
                  <option key={flight} value={flight}>
                    {flight}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div style={stateBox}>Loading leagues...</div>
          ) : error ? (
            <div style={errorBox}>{error}</div>
          ) : filteredLeagues.length === 0 ? (
            <div style={stateBox}>No league records found yet.</div>
          ) : (
            <>
              <div style={summaryBadgeRow}>
                <span style={heroHintPill}>{filteredLeagues.length} visible leagues</span>
                <span style={heroHintPill}>{rows.length} total imported matches</span>
              </div>

              <div style={dynamicCardGrid}>
                {filteredLeagues.map((league) => (
                  <div key={league.key} style={leagueCard}>
                    <div style={cardGlow} />

                    <div style={dynamicLeagueTop}>
                      <div style={leagueHeading}>
                        <div style={leagueTitle}>{league.leagueName}</div>
                        <div style={leagueFlight}>{league.flight}</div>
                      </div>

                      <Link href={buildLeagueHref(league)} style={primaryButton}>
                        View Season
                      </Link>
                    </div>

                    <div style={dynamicLeagueDetailGrid}>
                      <DetailCard label="USTA Section" value={league.ustaSection} />
                      <DetailCard label="District / Area" value={league.districtArea} />
                      <DetailCard label="Matches" value={String(league.matchCount)} />
                      <DetailCard label="Teams Seen" value={String(league.teamCount)} />
                    </div>

                    <div style={leagueBottom}>
                      <span style={leagueBottomMeta}>
                        Latest match: <strong>{formatDate(league.latestMatchDate)}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
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

function DetailCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div style={detailCard}>
      <div style={detailLabel}>{label}</div>
      <div style={detailValue}>{value}</div>
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

const coverageCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(128,174,255,0.16)',
  background: 'linear-gradient(180deg, rgba(45,79,137,0.42) 0%, rgba(24,45,84,0.5) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
}

const coverageLabel: CSSProperties = {
  color: 'rgba(217, 231, 255, 0.82)',
  fontSize: '12px',
  lineHeight: 1.5,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const coverageValue: CSSProperties = {
  marginTop: '8px',
  color: '#ffffff',
  fontSize: '34px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const coverageText: CSSProperties = {
  marginTop: '10px',
  color: 'rgba(219, 234, 254, 0.88)',
  fontSize: '14px',
  lineHeight: 1.65,
  fontWeight: 500,
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '0 18px 0',
}

const summaryGrid: CSSProperties = {
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

const panelHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '16px',
  flexWrap: 'wrap',
}

const sectionKicker: CSSProperties = {
  color: '#8fb7ff',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
}

const panelTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: '-0.04em',
}

const filterGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  marginBottom: '16px',
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

const searchWrap: CSSProperties = {
  position: 'relative',
}

const searchIconWrap: CSSProperties = {
  position: 'absolute',
  left: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'rgba(210,226,244,0.82)',
  pointerEvents: 'none',
}

const searchInput: CSSProperties = {
  width: '100%',
  borderRadius: '18px',
  border: '1px solid rgba(138,182,255,0.16)',
  background: 'rgba(10,20,40,0.6)',
  color: '#f7fbff',
  padding: '15px 16px 15px 46px',
  fontSize: '15px',
  outline: 'none',
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

const stateBox: CSSProperties = {
  marginTop: '8px',
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
  marginTop: '8px',
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.18)',
  color: '#fecaca',
  fontWeight: 700,
  fontSize: '14px',
}

const summaryBadgeRow: CSSProperties = {
  marginTop: '4px',
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginBottom: '16px',
}

const cardGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const leagueCard: CSSProperties = {
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

const leagueTop: CSSProperties = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  marginBottom: '16px',
}

const leagueHeading: CSSProperties = {
  minWidth: 0,
}

const leagueTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const leagueFlight: CSSProperties = {
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

const leagueDetailGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const detailCard: CSSProperties = {
  borderRadius: '18px',
  padding: '14px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.08)',
  minWidth: 0,
}

const detailLabel: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 700,
  marginBottom: '6px',
}

const detailValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '16px',
  lineHeight: 1.45,
  fontWeight: 800,
  wordBreak: 'break-word',
}

const leagueBottom: CSSProperties = {
  marginTop: '16px',
  paddingTop: '16px',
  borderTop: '1px solid rgba(255,255,255,0.08)',
}

const leagueBottomMeta: CSSProperties = {
  color: '#d5e5fb',
  fontSize: '14px',
  lineHeight: 1.6,
  fontWeight: 600,
}

const iconSvgStyle: CSSProperties = {
  width: '22px',
  height: '22px',
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
