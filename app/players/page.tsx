'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type SortKey = 'overall' | 'singles' | 'doubles' | 'name'
type FilterKey = 'all' | 'with-matches' | 'high-rated'

type PlayerRow = {
  id: string
  name: string
  location?: string | null
  overall_dynamic_rating?: number | null
  singles_dynamic_rating?: number | null
  doubles_dynamic_rating?: number | null
}

type PlayerCard = PlayerRow & {
  matches: number
}

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/matchup', label: 'Matchups' },
  { href: '/captain', label: 'Captain' },
  { href: '/leagues', label: 'Leagues' },
]

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('overall')
  const [filterBy, setFilterBy] = useState<FilterKey>('all')
  const [screenWidth, setScreenWidth] = useState(1280)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [searchFocused, setSearchFocused] = useState(false)

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
      const { data: playerRows, error: playersError } = await supabase
        .from('players')
        .select(`
          id,
          name,
          location,
          overall_dynamic_rating,
          singles_dynamic_rating,
          doubles_dynamic_rating
        `)
        .order('name', { ascending: true })

      if (playersError) throw new Error(playersError.message)

      const typedPlayers = (playerRows || []) as PlayerRow[]
      const playerIds = typedPlayers.map((player) => player.id)
      const matchCounts = new Map<string, number>()

      if (playerIds.length > 0) {
        const { data: matchPlayerRows, error: matchPlayersError } = await supabase
          .from('match_players')
          .select('player_id')
          .in('player_id', playerIds)

        if (matchPlayersError) throw new Error(matchPlayersError.message)

        for (const row of matchPlayerRows || []) {
          const playerId = String(row.player_id)
          matchCounts.set(playerId, (matchCounts.get(playerId) || 0) + 1)
        }
      }

      setPlayers(
        typedPlayers.map((player) => ({
          ...player,
          matches: matchCounts.get(player.id) || 0,
        }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load players')
    } finally {
      setLoading(false)
    }
  }

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase()

    let next = players.filter((player) => {
      const matchesSearch =
        !q ||
        player.name.toLowerCase().includes(q) ||
        (player.location || '').toLowerCase().includes(q)

      if (!matchesSearch) return false

      if (filterBy === 'with-matches') return player.matches > 0
      if (filterBy === 'high-rated') return getRating(player, 'overall') >= 4.0
      return true
    })

    next = [...next].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      return getRating(b, sortBy) - getRating(a, sortBy)
    })

    return next
  }, [filterBy, players, search, sortBy])

  const topOverall = useMemo(() => {
    if (players.length === 0) return 0
    return Math.max(...players.map((player) => getRating(player, 'overall')))
  }, [players])

  const avgOverall = useMemo(() => {
    if (players.length === 0) return 0
    const total = players.reduce((sum, player) => sum + getRating(player, 'overall'), 0)
    return total / players.length
  }, [players])

  const totalMatches = useMemo(() => {
    return players.reduce((sum, player) => sum + player.matches, 0)
  }, [players])

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
    padding: isMobile ? '14px 16px 24px' : '10px 18px 24px',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '28px 18px 22px' : '34px 28px 24px',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
    gridTemplateColumns: isTablet
      ? '1fr'
      : 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
    gap: isMobile ? '18px' : '22px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '46px' : '60px',
    lineHeight: isMobile ? 1.04 : 0.98,
    maxWidth: '520px',
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
    maxWidth: '520px',
  }

  const dynamicControlsShell: CSSProperties = {
    ...controlsShell,
    padding: isMobile ? '16px' : '18px',
    boxShadow: searchFocused
      ? '0 20px 44px rgba(7,24,53,0.18), 0 0 0 2px rgba(72,161,255,0.18)'
      : controlsShell.boxShadow,
    position: isTablet ? 'relative' : 'sticky',
    top: isTablet ? 'auto' : '24px',
  }

  const dynamicControlsTopRow: CSSProperties = {
    ...controlsTopRow,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'flex-start' : 'center',
  }

  const dynamicControlsRow: CSSProperties = {
    ...controlsRow,
    flexDirection: isTablet ? 'column' : 'row',
    alignItems: isTablet ? 'stretch' : 'center',
  }

  const dynamicSearchInputWrap: CSSProperties = {
    ...searchInputWrap,
    width: '100%',
    minWidth: 0,
  }

  const dynamicSearchInput: CSSProperties = {
    ...searchInput,
    boxShadow: searchFocused ? '0 0 0 2px rgba(64,145,255,0.18)' : 'none',
  }

  const dynamicSelectStyle: CSSProperties = {
    ...selectStyle,
    width: isTablet ? '100%' : 'auto',
    minWidth: isTablet ? 0 : '150px',
  }

  const dynamicHeroStatsGrid: CSSProperties = {
    ...heroStatsGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicSectionHeader: CSSProperties = {
    ...sectionHeader,
    alignItems: isMobile ? 'flex-start' : 'flex-end',
  }

  const dynamicCardGrid: CSSProperties = {
    ...cardGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isTablet
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicRatingRow: CSSProperties = {
    ...ratingRow,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
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
              const isActive = link.href === '/explore'
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
            <Link href="/login" style={navLink}>
              Login
            </Link>
            <Link href="/join" style={activeNavLink}>
              Join
            </Link>
          </nav>
        </div>
      </header>

      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div style={heroNoise} />

          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>Players</div>

              <h1 style={dynamicHeroTitle}>
                Find any player fast and jump straight into the full TenAceIQ profile.
              </h1>

              <p style={dynamicHeroText}>
                Search by name or location, sort by overall, singles, or doubles strength,
                and move directly into each player profile for trends, history, and matchup prep.
              </p>

              <div style={heroHintRow}>
                <span style={heroHintPill}>Search faster</span>
                <span style={heroHintPill}>Compare stronger</span>
                <span style={heroHintPill}>Plan smarter</span>
              </div>
            </div>

            <div style={heroRight}>
              <div style={dynamicControlsShell}>
                <div style={dynamicControlsTopRow}>
                  <div style={controlsLabel}>Player controls</div>
                  {!isTablet ? <div style={controlsHint}>Search, sort, and filter</div> : null}
                </div>

                <div style={dynamicControlsRow}>
                  <div style={dynamicSearchInputWrap}>
                    <div style={searchIconWrap}>
                      <SearchIcon />
                    </div>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setSearchFocused(false)}
                      placeholder="Search player name or location..."
                      style={dynamicSearchInput}
                    />
                  </div>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    style={dynamicSelectStyle}
                  >
                    <option value="overall">Sort: Overall</option>
                    <option value="singles">Sort: Singles</option>
                    <option value="doubles">Sort: Doubles</option>
                    <option value="name">Sort: Name</option>
                  </select>

                  <select
                    value={filterBy}
                    onChange={(e) => setFilterBy(e.target.value as FilterKey)}
                    style={dynamicSelectStyle}
                  >
                    <option value="all">All players</option>
                    <option value="with-matches">With matches</option>
                    <option value="high-rated">4.0+ overall</option>
                  </select>
                </div>

                <div style={controlsHelperText}>
                  Use the directory to move from a broad search into exact player profiles in one step.
                </div>
              </div>

              <div style={summaryCard}>
                <div style={summaryTitle}>Directory snapshot</div>

                <div style={dynamicHeroStatsGrid}>
                  <StatChip label="Players" value={String(players.length)} />
                  <StatChip label="Showing" value={String(filteredPlayers.length)} />
                  <StatChip label="Top overall" value={formatRating(topOverall)} accent />
                  <StatChip label="Avg overall" value={formatRating(avgOverall)} />
                </div>

                <div style={summaryFooterWrap}>
                  <div style={summaryInlineStat}>
                    <span style={summaryInlineLabel}>Tracked matches</span>
                    <span style={summaryInlineValue}>{totalMatches}</span>
                  </div>
                  <div style={summaryHint}>
                    Search here, open a profile, then use Matchup or Captain&apos;s Corner when you need deeper prep.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <section style={errorCard}>
          <div style={sectionKicker}>Players</div>
          <h2 style={sectionTitle}>Unable to load players</h2>
          <p style={sectionText}>{error}</p>
        </section>
      ) : null}

      <section style={contentWrap}>
        <div style={dynamicSectionHeader}>
          <div>
            <div style={sectionKicker}>Directory</div>
            <h2 style={sectionTitle}>Browse player cards and open each full profile</h2>
          </div>
          <Link href="/rankings" style={secondaryLink}>
            Open rankings
          </Link>
        </div>

        {loading ? (
          <div style={loadingCard}>Loading player directory...</div>
        ) : filteredPlayers.length === 0 ? (
          <div style={loadingCard}>No players matched that search.</div>
        ) : (
          <div style={dynamicCardGrid}>
            {filteredPlayers.map((player) => {
              const isHovered = hoveredCard === player.id
              return (
                <Link
                  key={player.id}
                  href={`/players/${player.id}`}
                  style={{
                    ...playerCard,
                    ...(isHovered ? playerCardHover : {}),
                  }}
                  onMouseEnter={() => setHoveredCard(player.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div style={cardAccentGlow} />

                  <div style={playerCardTopRow}>
                    <div style={miniKicker}>Player</div>
                    <div style={matchCountPill}>{player.matches} matches</div>
                  </div>

                  <div style={playerName}>{player.name}</div>
                  <div style={playerLocation}>{player.location || 'Location not set'}</div>

                  <div style={dynamicRatingRow}>
                    <RatingPill label="Overall" value={getRating(player, 'overall')} accent />
                    <RatingPill label="Singles" value={getRating(player, 'singles')} />
                    <RatingPill label="Doubles" value={getRating(player, 'doubles')} />
                  </div>

                  <div style={playerCardFooter}>
                    <span style={profileLinkText}>Open full profile</span>
                    <span style={arrowText}>→</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
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
        ...statChip,
        ...(accent ? statChipAccent : {}),
      }}
    >
      <div style={statChipLabel}>{label}</div>
      <div style={statChipValue}>{value}</div>
    </div>
  )
}

function RatingPill({
  label,
  value,
  accent = false,
}: {
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div
      style={{
        ...ratingPill,
        ...(accent ? ratingPillAccent : {}),
      }}
    >
      <div style={ratingPillLabel}>{label}</div>
      <div style={ratingPillValue}>{formatRating(value)}</div>
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
  const iconSize = compact ? 34 : top ? 46 : footer ? 38 : 36
  const fontSize = compact ? 27 : top ? 34 : footer ? 29 : 29

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

function getRating(player: PlayerRow, view: Exclude<SortKey, 'name'>) {
  if (view === 'singles') return toNumber(player.singles_dynamic_rating)
  if (view === 'doubles') return toNumber(player.doubles_dynamic_rating)
  return toNumber(player.overall_dynamic_rating)
}

function toNumber(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatRating(value: number) {
  return value > 0 ? value.toFixed(2) : '—'
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
  maxWidth: '1280px',
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
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
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
  fontSize: '15px',
  fontWeight: 700,
  letterSpacing: '0.01em',
  padding: '12px 18px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.22)',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.22) 0%, rgba(27,62,120,0.18) 100%)',
  backdropFilter: 'blur(14px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  transition: 'all 180ms ease',
}

const activeNavLink: CSSProperties = {
  color: '#06111f',
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  border: '1px solid rgba(155,225,29,0.34)',
  boxShadow: '0 10px 28px rgba(155,225,29,0.18)',
}

const heroWrap: CSSProperties = {
  position: 'relative',
  zIndex: 1,
}

const heroShell: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  borderRadius: '30px',
  background:
    `
    linear-gradient(180deg, rgba(26, 54, 104, 0.52) 0%, rgba(17, 36, 72, 0.72) 22%, rgba(12, 27, 52, 0.82) 100%)
  `,
  border: '1px solid rgba(116,190,255,0.22)',
  boxShadow:
    '0 26px 80px rgba(7,18,42,0.24), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 80px rgba(88,170,255,0.06)',
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

const heroRight: CSSProperties = {
  display: 'grid',
  gap: '14px',
  alignContent: 'start',
  minWidth: 0,
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

const controlsShell: CSSProperties = {
  borderRadius: '24px',
  background:
    'linear-gradient(180deg, rgba(43,78,138,0.42) 0%, rgba(20,37,73,0.56) 100%)',
  border: '1px solid rgba(142,184,255,0.18)',
  boxShadow:
    '0 18px 44px rgba(9,25,54,0.16), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  zIndex: 3,
}

const controlsTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '12px',
  alignItems: 'center',
}

const controlsLabel: CSSProperties = {
  color: '#f6fbff',
  fontSize: '15px',
  fontWeight: 800,
  letterSpacing: '-0.02em',
}

const controlsHint: CSSProperties = {
  color: 'rgba(204,220,241,0.76)',
  fontSize: '12px',
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

const controlsRow: CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
  minWidth: 0,
}

const searchInputWrap: CSSProperties = {
  position: 'relative',
  flex: 1,
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

const controlsHelperText: CSSProperties = {
  marginTop: '12px',
  color: 'rgba(216,230,246,0.78)',
  fontSize: '13px',
  lineHeight: 1.6,
}

const summaryCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid rgba(128,174,255,0.16)',
  background: 'linear-gradient(180deg, rgba(45,79,137,0.42) 0%, rgba(24,45,84,0.5) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
}

const summaryTitle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: '-0.03em',
  marginBottom: '14px',
}

const heroStatsGrid: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const statChip: CSSProperties = {
  borderRadius: '18px',
  padding: '12px 12px 11px',
  background: 'rgba(26,42,71,0.58)',
  border: '1px solid rgba(74,123,211,0.24)',
  minWidth: 0,
}

const statChipAccent: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(31,102,74,0.92) 0%, rgba(42,162,96,0.84) 100%)',
  border: '1px solid rgba(134,239,172,0.24)',
}

const statChipLabel: CSSProperties = {
  color: 'rgba(198,214,230,0.74)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '6px',
}

const statChipValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '20px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const summaryFooterWrap: CSSProperties = {
  display: 'grid',
  gap: '14px',
  marginTop: '14px',
}

const summaryInlineStat: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '14px 16px',
  borderRadius: '20px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
}

const summaryInlineLabel: CSSProperties = {
  color: 'rgba(220,231,244,0.78)',
  fontWeight: 700,
  fontSize: '14px',
}

const summaryInlineValue: CSSProperties = {
  background: 'linear-gradient(135deg, #9af2bd, #4ade80 55%, #22c55e)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 900,
  fontSize: '22px',
  letterSpacing: '-0.04em',
}

const summaryHint: CSSProperties = {
  color: 'rgba(224, 234, 247, 0.76)',
  lineHeight: 1.6,
  fontSize: '14px',
}

const errorCard: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1280px',
  margin: '0 auto 18px',
  padding: '22px',
  borderRadius: '28px',
  border: '1px solid rgba(255,100,100,0.2)',
  background: 'rgba(62,16,22,0.78)',
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '0 18px 0',
}

const sectionHeader: CSSProperties = {
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
  marginBottom: '8px',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '30px',
  letterSpacing: '-0.04em',
}

const sectionText: CSSProperties = {
  margin: '10px 0 0',
  color: 'rgba(232, 239, 248, 0.84)',
  lineHeight: 1.6,
}

const secondaryLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '48px',
  padding: '0 18px',
  borderRadius: '999px',
  border: '1px solid rgba(109, 239, 171, 0.34)',
  background: 'linear-gradient(135deg, rgba(88, 224, 135, 0.98), rgba(40, 205, 110, 0.92))',
  color: '#071622',
  textDecoration: 'none',
  fontWeight: 900,
  boxShadow: '0 14px 34px rgba(45, 196, 106, 0.24), inset 0 1px 0 rgba(255,255,255,0.26)',
}

const loadingCard: CSSProperties = {
  padding: '26px',
  borderRadius: '28px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(11, 22, 39, 0.82)',
  color: '#dfe8f8',
  fontWeight: 700,
}

const cardGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const playerCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  textDecoration: 'none',
  borderRadius: '28px',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.32) 0%, rgba(28,49,95,0.46) 100%)',
  padding: '20px',
  boxShadow: '0 14px 34px rgba(9,25,54,0.14), inset 0 1px 0 rgba(255,255,255,0.05)',
  transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
}

const playerCardHover: CSSProperties = {
  transform: 'translateY(-3px)',
  boxShadow: '0 22px 48px rgba(10,28,58,0.2)',
  border: '1px solid rgba(158,197,255,0.28)',
}

const cardAccentGlow: CSSProperties = {
  position: 'absolute',
  top: '-70px',
  right: '-50px',
  width: '180px',
  height: '180px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(78,178,255,0.24), rgba(78,178,255,0) 70%)',
  pointerEvents: 'none',
}

const playerCardTopRow: CSSProperties = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '14px',
}

const miniKicker: CSSProperties = {
  color: '#bad7ff',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const matchCountPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.12)',
  color: '#d6e6ff',
  fontSize: '12px',
  fontWeight: 800,
  border: '1px solid rgba(255,255,255,0.10)',
}

const playerName: CSSProperties = {
  position: 'relative',
  color: '#f8fbff',
  fontSize: '28px',
  fontWeight: 900,
  letterSpacing: '-0.04em',
  lineHeight: 1.05,
  marginBottom: '8px',
}

const playerLocation: CSSProperties = {
  position: 'relative',
  color: 'rgba(223,232,248,0.82)',
  fontSize: '15px',
  fontWeight: 700,
  marginBottom: '16px',
}

const ratingRow: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: '10px',
}

const ratingPill: CSSProperties = {
  borderRadius: '18px',
  padding: '12px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.08)',
  minWidth: 0,
}

const ratingPillAccent: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(88, 224, 135, 0.30), rgba(32, 200, 109, 0.18))',
  border: '1px solid rgba(111, 236, 168, 0.34)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 28px rgba(38, 196, 102, 0.12)',
}

const ratingPillLabel: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 700,
  marginBottom: '6px',
}

const ratingPillValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '24px',
  fontWeight: 900,
  letterSpacing: '-0.04em',
  lineHeight: 1,
}

const playerCardFooter: CSSProperties = {
  position: 'relative',
  marginTop: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  color: '#dfe9fb',
  gap: '12px',
}

const profileLinkText: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, rgba(103, 241, 154, 1), rgba(40, 205, 110, 0.94))',
  color: '#071622',
  fontWeight: 900,
  fontSize: '13px',
  letterSpacing: '0.01em',
  boxShadow: '0 12px 30px rgba(43, 195, 104, 0.20), inset 0 1px 0 rgba(255,255,255,0.26)',
}

const arrowText: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  borderRadius: '999px',
  background: 'rgba(91, 233, 146, 0.12)',
  border: '1px solid rgba(109, 239, 171, 0.18)',
  color: '#9df0bf',
  fontWeight: 900,
  fontSize: '18px',
}

const iconSvgStyle: CSSProperties = {
  width: '22px',
  height: '22px',
}

const footerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  padding: '28px 18px 20px',
}

const footerInner: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  borderRadius: '22px',
  background: 'rgba(17,31,58,0.72)',
  border: '1px solid rgba(116,190,255,0.22)',
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
  gap: '12px 14px',
}

const footerUtilityLink: CSSProperties = {
  color: 'rgba(215,229,247,0.8)',
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
