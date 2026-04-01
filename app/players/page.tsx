'use client'

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
  { href: '/players', label: 'Players' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/matchup', label: 'Matchup' },
  { href: '/leagues', label: 'Leagues' },
  { href: '/captains-corner', label: "Captain's Corner" },
]

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('overall')
  const [filterBy, setFilterBy] = useState<FilterKey>('all')
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

  const heroTitleSize = isSmallMobile ? '36px' : isMobile ? '46px' : '62px'

  return (
    <main style={pageStyle}>
      <div style={orbOne} />
      <div style={orbTwo} />
      <div style={gridGlow} />

      <header style={headerStyle}>
        <div
          style={{
            ...headerInner,
            flexDirection: isTablet ? 'column' : 'row',
            alignItems: isTablet ? 'flex-start' : 'center',
            gap: isTablet ? '14px' : '18px',
          }}
        >
          <Link href="/" style={brandWrap} aria-label="TenAceIQ home">
            <div style={brandMark}>TA</div>
            <div style={brandText}>
              <span style={{ color: '#f8fbff' }}>TenAce</span>
              <span style={brandIQ}>IQ</span>
            </div>
          </Link>

          <nav
            style={{
              ...navStyle,
              flexWrap: 'wrap',
            }}
          >
            {NAV_LINKS.map((link) => {
              const isActive = link.href === '/players'
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

      <section
        style={{
          ...heroShell,
          padding: isMobile ? '28px 18px' : '38px 28px',
          gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.25fr) minmax(320px, 0.75fr)',
          gap: isMobile ? '18px' : '22px',
        }}
      >
        <div>
          <div style={eyebrow}>Players</div>
          <h1 style={{ ...heroTitle, fontSize: heroTitleSize }}>
            Find any player fast and jump straight into the full TenAceIQ profile.
          </h1>
          <p style={heroText}>
            Use the directory to search by name or location, sort by overall, singles, or doubles strength,
            and move directly into each player profile for trends, history, and matchup prep.
          </p>

          <div
            style={{
              ...searchPanel,
              flexDirection: isSmallMobile ? 'column' : 'row',
              alignItems: isSmallMobile ? 'stretch' : 'center',
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player name or location"
              style={searchInput}
            />

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} style={selectStyle}>
              <option value="overall">Sort: Overall</option>
              <option value="singles">Sort: Singles</option>
              <option value="doubles">Sort: Doubles</option>
              <option value="name">Sort: Name</option>
            </select>

            <select value={filterBy} onChange={(e) => setFilterBy(e.target.value as FilterKey)} style={selectStyle}>
              <option value="all">All players</option>
              <option value="with-matches">With matches</option>
              <option value="high-rated">4.0+ overall</option>
            </select>
          </div>
        </div>

        <div style={summaryCard}>
          <div>
            <div style={summaryTitle}>Directory snapshot</div>

            <div style={summaryMetricGrid}>
              <MetricBlock label="Players" value={String(players.length)} />
              <MetricBlock label="Showing" value={String(filteredPlayers.length)} />
              <MetricBlock label="Top overall" value={formatRating(topOverall)} />
              <MetricBlock label="Avg overall" value={formatRating(avgOverall)} />
            </div>
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
      </section>

      {error ? (
        <section style={errorCard}>
          <div style={sectionKicker}>Players</div>
          <h2 style={sectionTitle}>Unable to load players</h2>
          <p style={sectionText}>{error}</p>
        </section>
      ) : null}

      <section style={contentWrap}>
        <div style={sectionHeader}>
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
          <div
            style={{
              ...cardGrid,
              gridTemplateColumns: isSmallMobile
                ? '1fr'
                : isTablet
                  ? 'repeat(2, minmax(0, 1fr))'
                  : 'repeat(3, minmax(0, 1fr))',
            }}
          >
            {filteredPlayers.map((player) => (
              <Link key={player.id} href={`/players/${player.id}`} style={playerCard}>
                <div style={playerCardTopRow}>
                  <div style={miniKicker}>Player</div>
                  <div style={matchCountPill}>{player.matches} matches</div>
                </div>

                <div style={playerName}>{player.name}</div>
                <div style={playerLocation}>{player.location || 'Location not set'}</div>

                <div style={ratingRow}>
                  <RatingPill label="Overall" value={getRating(player, 'overall')} accent />
                  <RatingPill label="Singles" value={getRating(player, 'singles')} />
                  <RatingPill label="Doubles" value={getRating(player, 'doubles')} />
                </div>

                <div style={playerCardFooter}>
                  <span style={profileLinkText}>Open full profile</span>
                  <span style={arrowText}>→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryMetricCard}>
      <div style={summaryMetricLabel}>{label}</div>
      <div style={summaryMetricValue}>{value}</div>
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
    'radial-gradient(circle at top, rgba(37,91,227,0.22), transparent 28%), linear-gradient(180deg, #050b17 0%, #071224 44%, #081527 100%)',
  padding: '28px 18px 56px',
}

const orbOne: CSSProperties = {
  position: 'absolute',
  top: '-100px',
  right: '-60px',
  width: '360px',
  height: '360px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(122, 255, 98, 0.18), rgba(122,255,98,0) 68%)',
  filter: 'blur(10px)',
  pointerEvents: 'none',
}

const orbTwo: CSSProperties = {
  position: 'absolute',
  top: '60px',
  left: '-100px',
  width: '320px',
  height: '320px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(37,91,227,0.18), rgba(37,91,227,0) 70%)',
  filter: 'blur(12px)',
  pointerEvents: 'none',
}

const gridGlow: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
  backgroundSize: '64px 64px',
  maskImage: 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0))',
  pointerEvents: 'none',
}

const headerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto 18px',
}

const headerInner: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
}

const brandWrap: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '12px',
  textDecoration: 'none',
}

const brandMark: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '44px',
  height: '44px',
  borderRadius: '14px',
  background: 'linear-gradient(135deg, rgba(37,91,227,0.95), rgba(96,221,116,0.9))',
  color: '#04101e',
  fontWeight: 900,
  fontSize: '16px',
  letterSpacing: '-0.04em',
  boxShadow: '0 14px 30px rgba(0,0,0,0.24)',
}

const brandText: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '1px',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: '-0.05em',
  lineHeight: 1,
}

const brandIQ: CSSProperties = {
  background: 'linear-gradient(135deg, #9ef767 0%, #55d8ae 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}

const navStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
}

const navLink: CSSProperties = {
  padding: '13px 18px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(12, 28, 52, 0.78)',
  color: '#e7eefb',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '15px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
}

const activeNavLink: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(29,60,108,0.94), rgba(25,92,78,0.82))',
  border: '1px solid rgba(130, 244, 118, 0.22)',
}

const heroShell: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto 18px',
  display: 'grid',
  borderRadius: '34px',
  border: '1px solid rgba(107, 162, 255, 0.18)',
  background: 'linear-gradient(135deg, rgba(7,29,61,0.96), rgba(7,20,39,0.96) 56%, rgba(18,58,50,0.9) 100%)',
  boxShadow: '0 34px 80px rgba(0,0,0,0.32)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '38px',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(130, 244, 118, 0.28)',
  background: 'rgba(89, 145, 73, 0.14)',
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

const searchPanel: CSSProperties = {
  display: 'flex',
  gap: '12px',
  padding: '14px',
  borderRadius: '24px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(10, 20, 37, 0.64)',
  maxWidth: '860px',
}

const searchInput: CSSProperties = {
  flex: 1,
  minWidth: '220px',
  height: '52px',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: '#f5f8ff',
  padding: '0 16px',
  fontSize: '15px',
  outline: 'none',
}

const selectStyle: CSSProperties = {
  height: '52px',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#f5f8ff',
  padding: '0 14px',
  fontSize: '15px',
  outline: 'none',
}

const summaryCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'linear-gradient(180deg, rgba(37,56,84,0.88), rgba(21,37,64,0.88))',
  padding: '18px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  minHeight: '100%',
  gap: '18px',
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
  fontSize: '34px',
  letterSpacing: '-0.05em',
  lineHeight: 1,
}

const summaryFooterWrap: CSSProperties = {
  display: 'grid',
  gap: '14px',
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
  color: '#f8fbff',
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
  maxWidth: '1240px',
  margin: '0 auto 18px',
  padding: '22px',
  borderRadius: '28px',
  border: '1px solid rgba(255,100,100,0.2)',
  background: 'rgba(62,16,22,0.78)',
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto',
}

const sectionHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
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
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(14, 27, 49, 0.9)',
  color: '#ebf1fd',
  textDecoration: 'none',
  fontWeight: 800,
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
  textDecoration: 'none',
  borderRadius: '28px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(180deg, rgba(12,25,45,0.94), rgba(9,18,34,0.96))',
  padding: '20px',
  boxShadow: '0 18px 40px rgba(0,0,0,0.22)',
}

const playerCardTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '14px',
}

const miniKicker: CSSProperties = {
  color: '#87aeff',
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
  background: 'rgba(37,91,227,0.14)',
  color: '#b8d0ff',
  fontSize: '12px',
  fontWeight: 800,
}

const playerName: CSSProperties = {
  color: '#f8fbff',
  fontSize: '28px',
  fontWeight: 900,
  letterSpacing: '-0.04em',
  lineHeight: 1.05,
  marginBottom: '8px',
}

const playerLocation: CSSProperties = {
  color: 'rgba(223,232,248,0.74)',
  fontSize: '15px',
  fontWeight: 700,
  marginBottom: '16px',
}

const ratingRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '10px',
}

const ratingPill: CSSProperties = {
  borderRadius: '18px',
  padding: '12px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.05)',
}

const ratingPillAccent: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(112,228,86,0.2), rgba(69,189,150,0.14))',
  border: '1px solid rgba(130, 244, 118, 0.22)',
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
  marginTop: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  color: '#dfe9fb',
}

const profileLinkText: CSSProperties = {
  fontWeight: 800,
  fontSize: '14px',
}

const arrowText: CSSProperties = {
  fontWeight: 900,
  fontSize: '18px',
}
