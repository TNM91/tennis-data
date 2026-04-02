'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type RatingView = 'overall' | 'singles' | 'doubles'

type Player = {
  id: string
  name: string
  location?: string | null
  overall_dynamic_rating?: number | null
  singles_dynamic_rating?: number | null
  doubles_dynamic_rating?: number | null
}

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/players', label: 'Players' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/matchup', label: 'Matchup' },
  { href: '/leagues', label: 'Leagues' },
  { href: '/captains-corner', label: "Captain's Corner" },
]

export default function RankingsPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [ratingView, setRatingView] = useState<RatingView>('overall')
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
    void loadPlayers()
  }, [])

  async function loadPlayers() {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('players')
        .select(`
          id,
          name,
          location,
          overall_dynamic_rating,
          singles_dynamic_rating,
          doubles_dynamic_rating
        `)

      if (error) throw new Error(error.message)
      setPlayers((data || []) as Player[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rankings')
    } finally {
      setLoading(false)
    }
  }

  const locations = useMemo(() => {
    return [...new Set(players.map((player) => player.location).filter(Boolean) as string[])].sort()
  }, [players])

  const filteredPlayers = useMemo(() => {
    const query = searchText.trim().toLowerCase()

    return players.filter((player) => {
      const matchesSearch =
        !query ||
        player.name.toLowerCase().includes(query) ||
        String(player.location || '').toLowerCase().includes(query)

      const matchesLocation = !locationFilter || (player.location || '') === locationFilter
      return matchesSearch && matchesLocation
    })
  }, [players, searchText, locationFilter])

  const rankedPlayers = useMemo(() => {
    return [...filteredPlayers]
      .map((player) => ({
        ...player,
        selectedRating: getSelectedRating(player, ratingView),
      }))
      .sort((a, b) => b.selectedRating - a.selectedRating)
  }, [filteredPlayers, ratingView])

  const topThree = rankedPlayers.slice(0, 3)
  const avgSelected = useMemo(() => {
    if (rankedPlayers.length === 0) return 0
    const total = rankedPlayers.reduce((sum, player) => sum + player.selectedRating, 0)
    return total / rankedPlayers.length
  }, [rankedPlayers])

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
    padding: isMobile ? '14px 16px 20px' : '10px 18px 24px',
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
    maxWidth: '540px',
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
    maxWidth: '540px',
  }

  const dynamicControlsCard: CSSProperties = {
    ...controlsCard,
    position: isTablet ? 'relative' : 'sticky',
    top: isTablet ? 'auto' : '24px',
  }

  const dynamicControlsTopRow: CSSProperties = {
    ...controlsTopRow,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'flex-start' : 'center',
  }

  const dynamicControlsGrid: CSSProperties = {
    ...controlsGrid,
    gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.25fr) minmax(220px, 0.75fr)',
  }

  const dynamicPodiumGrid: CSSProperties = {
    ...podiumGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isTablet
        ? 'repeat(3, minmax(0, 1fr))'
        : 'repeat(3, minmax(0, 1fr))',
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
              const isActive = link.href === '/rankings'
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
            <Link href="/admin" style={navLink}>
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div style={heroNoise} />

          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>Rankings</div>

              <h1 style={dynamicHeroTitle}>See who rises to the top.</h1>

              <p style={dynamicHeroText}>
                View player rankings by overall, singles, or doubles dynamic rating, then filter
                by player name or location to narrow the board and jump straight into full profiles.
              </p>

              <div style={heroHintRow}>
                <span style={heroHintPill}>{rankedPlayers.length} shown</span>
                <span style={heroHintPill}>{locations.length} locations</span>
                <span style={heroHintPill}>{capitalize(ratingView)} mode</span>
              </div>
            </div>

            <div style={dynamicControlsCard}>
              <div style={dynamicControlsTopRow}>
                <div>
                  <div style={controlsLabel}>Leaderboard controls</div>
                  <div style={controlsHint}>Search, filter, and switch ranking mode</div>
                </div>

                <div style={segmentWrap}>
                  <button
                    onClick={() => setRatingView('overall')}
                    style={{
                      ...segmentButton,
                      ...(ratingView === 'overall' ? segmentButtonActive : {}),
                    }}
                  >
                    Overall
                  </button>
                  <button
                    onClick={() => setRatingView('singles')}
                    style={{
                      ...segmentButton,
                      ...(ratingView === 'singles' ? segmentButtonActive : {}),
                    }}
                  >
                    Singles
                  </button>
                  <button
                    onClick={() => setRatingView('doubles')}
                    style={{
                      ...segmentButton,
                      ...(ratingView === 'doubles' ? segmentButtonActive : {}),
                    }}
                  >
                    Doubles
                  </button>
                </div>
              </div>

              <div style={dynamicControlsGrid}>
                <div>
                  <label htmlFor="rankings-search" style={inputLabel}>Search</label>
                  <div style={searchWrap}>
                    <div style={searchIconWrap}>
                      <SearchIcon />
                    </div>
                    <input
                      id="rankings-search"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="Search players or location..."
                      style={searchInput}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="rankings-location" style={inputLabel}>Location</label>
                  <select
                    id="rankings-location"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">All locations</option>
                    {locations.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error ? (
                <div style={errorBanner}>{error}</div>
              ) : null}

              <div style={summaryStatsGrid}>
                <StatChip label="Players shown" value={String(rankedPlayers.length)} />
                <StatChip label="Top rating" value={formatRating(topThree[0]?.selectedRating)} accent />
                <StatChip label="Average" value={formatRating(avgSelected)} />
                <StatChip label="Basis" value={capitalize(ratingView)} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {!loading && !error && topThree.length > 0 ? (
        <section style={contentWrap}>
          <div style={dynamicPodiumGrid}>
            {topThree.map((player, index) => (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                style={{
                  ...podiumCard,
                  ...(index === 0 ? podiumFirst : index === 1 ? podiumSecond : podiumThird),
                }}
              >
                <div style={podiumRank}>#{index + 1}</div>
                <div style={podiumName}>{player.name}</div>
                <div style={podiumLocation}>{player.location || 'No location'}</div>
                <div style={podiumRating}>{formatRating(player.selectedRating)}</div>
                <div style={podiumSubtext}>{capitalize(ratingView)} dynamic rating</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section style={contentWrap}>
        <article style={tableCard}>
          <div style={panelHead}>
            <div>
              <div style={sectionKicker}>Leaderboard</div>
              <h2 style={panelTitle}>Full rankings</h2>
            </div>

            <div style={panelChipWrap}>
              <span style={panelChip}>Showing {rankedPlayers.length}</span>
              <span style={panelChip}>{capitalize(ratingView)} rating</span>
            </div>
          </div>

          <div style={tableWrap}>
            <table style={dataTable}>
              <thead>
                <tr>
                  <th style={tableHead}>Rank</th>
                  <th style={tableHead}>Player</th>
                  <th style={tableHead}>Location</th>
                  <th style={{ ...tableHead, ...(ratingView === 'overall' ? activeTableHead : {}) }}>Overall</th>
                  <th style={{ ...tableHead, ...(ratingView === 'singles' ? activeTableHead : {}) }}>Singles</th>
                  <th style={{ ...tableHead, ...(ratingView === 'doubles' ? activeTableHead : {}) }}>Doubles</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={emptyCell}>Loading rankings...</td>
                  </tr>
                ) : rankedPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={emptyCell}>No players found.</td>
                  </tr>
                ) : (
                  rankedPlayers.map((player, index) => (
                    <tr key={player.id}>
                      <td style={tableCell}>
                        <span style={rankBadge}>{index + 1}</span>
                      </td>
                      <td style={tableCell}>
                        <Link href={`/players/${player.id}`} style={playerLink}>
                          {player.name}
                        </Link>
                      </td>
                      <td style={tableCell}>{player.location || '—'}</td>
                      <td style={{ ...tableCell, ...(ratingView === 'overall' ? activeRatingCell : {}) }}>
                        {formatRating(player.overall_dynamic_rating)}
                      </td>
                      <td style={{ ...tableCell, ...(ratingView === 'singles' ? activeRatingCell : {}) }}>
                        {formatRating(player.singles_dynamic_rating)}
                      </td>
                      <td style={{ ...tableCell, ...(ratingView === 'doubles' ? activeRatingCell : {}) }}>
                        {formatRating(player.doubles_dynamic_rating)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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

            <div style={dynamicFooterBottom}>
              © {new Date().getFullYear()} TenAceIQ
            </div>
          </div>
        </div>
      </footer>
    </main>
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
        ...chipStat,
        ...(accent ? chipStatAccent : {}),
      }}
    >
      <div style={chipStatLabel}>{label}</div>
      <div style={chipStatValue}>{value}</div>
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" style={iconSvgStyle} aria-hidden="true">
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M16 16l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function getSelectedRating(player: Player, view: RatingView) {
  if (view === 'singles') return toRatingNumber(player.singles_dynamic_rating, 3.5)
  if (view === 'doubles') return toRatingNumber(player.doubles_dynamic_rating, 3.5)
  return toRatingNumber(player.overall_dynamic_rating, 3.5)
}

function toRatingNumber(value: number | null | undefined, fallback = 3.5) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function formatRating(value: number | null | undefined) {
  return toRatingNumber(value, 3.5).toFixed(2)
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
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

const controlsCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(128,174,255,0.16)',
  background: 'linear-gradient(180deg, rgba(45,79,137,0.42) 0%, rgba(24,45,84,0.5) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
}

const controlsTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '14px',
}

const controlsLabel: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: '-0.03em',
}

const controlsHint: CSSProperties = {
  marginTop: '4px',
  color: 'rgba(220,231,244,0.78)',
  fontWeight: 600,
  fontSize: '14px',
  lineHeight: 1.6,
}

const segmentWrap: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
}

const segmentButton: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '16px',
  background: 'rgba(255,255,255,0.06)',
  color: '#f7fbff',
  minHeight: '48px',
  padding: '0 14px',
  fontSize: '14px',
  fontWeight: 800,
  cursor: 'pointer',
}

const segmentButtonActive: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(103, 241, 154, 1), rgba(40, 205, 110, 0.94))',
  color: '#071622',
  border: '1px solid rgba(111, 236, 168, 0.34)',
  boxShadow: '0 12px 30px rgba(43, 195, 104, 0.20), inset 0 1px 0 rgba(255,255,255,0.26)',
}

const controlsGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  marginBottom: '14px',
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

const errorBanner: CSSProperties = {
  marginBottom: '14px',
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.18)',
  color: '#fecaca',
  fontWeight: 700,
  fontSize: '14px',
}

const summaryStatsGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
}

const chipStat: CSSProperties = {
  borderRadius: '18px',
  padding: '12px 12px 11px',
  background: 'rgba(26,42,71,0.58)',
  border: '1px solid rgba(74,123,211,0.24)',
  minWidth: 0,
}

const chipStatAccent: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(31,102,74,0.92) 0%, rgba(42,162,96,0.84) 100%)',
  border: '1px solid rgba(134,239,172,0.24)',
}

const chipStatLabel: CSSProperties = {
  color: 'rgba(198,214,230,0.74)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '6px',
}

const chipStatValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '20px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '0 18px 0',
}

const podiumGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
  marginBottom: '16px',
}

const podiumCard: CSSProperties = {
  textDecoration: 'none',
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.32) 0%, rgba(28,49,95,0.46) 100%)',
  boxShadow: '0 14px 34px rgba(9,25,54,0.14), inset 0 1px 0 rgba(255,255,255,0.05)',
}

const podiumFirst: CSSProperties = {
  border: '1px solid rgba(111, 236, 168, 0.34)',
  boxShadow: '0 16px 34px rgba(43, 195, 104, 0.14), inset 0 1px 0 rgba(255,255,255,0.08)',
}

const podiumSecond: CSSProperties = {}

const podiumThird: CSSProperties = {}

const podiumRank: CSSProperties = {
  color: '#bbf7d0',
  fontSize: '13px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const podiumName: CSSProperties = {
  marginTop: '8px',
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const podiumLocation: CSSProperties = {
  marginTop: '8px',
  color: 'rgba(223,232,248,0.82)',
  fontSize: '15px',
  fontWeight: 700,
}

const podiumRating: CSSProperties = {
  marginTop: '16px',
  color: '#f8fbff',
  fontSize: '34px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const podiumSubtext: CSSProperties = {
  marginTop: '6px',
  color: 'rgba(198,216,248,0.78)',
  fontSize: '13px',
  fontWeight: 700,
}

const tableCard: CSSProperties = {
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

const panelChipWrap: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
}

const panelChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '38px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(16, 39, 77, 0.84)',
  color: 'rgba(220, 232, 255, 0.92)',
  border: '1px solid rgba(82, 127, 201, 0.2)',
  fontWeight: 800,
  fontSize: '13px',
}

const tableWrap: CSSProperties = {
  overflowX: 'auto',
  borderRadius: '20px',
  border: '1px solid rgba(160, 185, 234, 0.12)',
  background: 'rgba(7, 20, 45, 0.62)',
}

const dataTable: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: '760px',
}

const tableHead: CSSProperties = {
  padding: '15px 16px',
  textAlign: 'left',
  color: 'rgba(190, 210, 245, 0.8)',
  fontSize: '12px',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  fontWeight: 800,
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'rgba(10, 27, 58, 0.78)',
  whiteSpace: 'nowrap',
}

const activeTableHead: CSSProperties = {
  color: '#bbf7d0',
}

const tableCell: CSSProperties = {
  padding: '16px',
  color: '#e9f2ff',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 600,
  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  verticalAlign: 'top',
}

const emptyCell: CSSProperties = {
  textAlign: 'center',
  color: 'rgba(220,231,244,0.78)',
  fontWeight: 700,
  padding: '24px',
}

const rankBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '2.2rem',
  padding: '0.45rem 0.7rem',
  borderRadius: '999px',
  background: 'rgba(37,91,227,0.18)',
  color: '#dbeafe',
  fontSize: '12px',
  lineHeight: 1,
  fontWeight: 900,
}

const playerLink: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 800,
  textDecoration: 'none',
}

const activeRatingCell: CSSProperties = {
  color: '#bbf7d0',
  fontWeight: 900,
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
