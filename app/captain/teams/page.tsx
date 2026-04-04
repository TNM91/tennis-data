'use client'

export const dynamic = 'force-dynamic'

import Image from 'next/image'
import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type SortKey = 'name' | 'matches' | 'players' | 'winPct' | 'latest'
type FilterKey = 'all' | 'active' | 'winning' | 'deep-roster'

type MatchRow = {
  id: string
  home_team: string | null
  away_team: string | null
  league_name: string | null
  flight: string | null
  match_date: string | null
  winner_side: 'A' | 'B' | null
}

type MatchPlayerRow = {
  match_id: string
  side: 'A' | 'B'
  player_id: string
}

type TeamCard = {
  key: string
  team: string
  league: string
  flight: string
  matches: number
  players: number
  wins: number
  losses: number
  latestMatch: string | null
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

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('matches')
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
    void loadTeams()
  }, [])

  async function loadTeams() {
    setLoading(true)
    setError('')

    try {
      const { data: matchRows, error: matchesError } = await supabase
        .from('matches')
        .select(`
          id,
          home_team,
          away_team,
          league_name,
          flight,
          match_date,
          winner_side
        `)
        .order('match_date', { ascending: false })

      if (matchesError) throw new Error(matchesError.message)

      const typedMatches = (matchRows || []) as MatchRow[]
      const matchIds = typedMatches.map((match) => match.id)

      let matchPlayers: MatchPlayerRow[] = []

      if (matchIds.length > 0) {
        const { data: matchPlayerRows, error: matchPlayersError } = await supabase
          .from('match_players')
          .select(`
            match_id,
            side,
            player_id
          `)
          .in('match_id', matchIds)

        if (matchPlayersError) throw new Error(matchPlayersError.message)
        matchPlayers = (matchPlayerRows || []) as MatchPlayerRow[]
      }

      const teamMap = new Map<string, TeamCard>()
      const teamPlayerSets = new Map<string, Set<string>>()

      for (const match of typedMatches) {
        const league = safeText(match.league_name, 'Unknown League')
        const flight = safeText(match.flight, 'Unknown Flight')

        const teamEntries = [
          { team: safeText(match.home_team), side: 'A' as const },
          { team: safeText(match.away_team), side: 'B' as const },
        ]

        for (const entry of teamEntries) {
          if (entry.team === 'Unknown') continue

          const key = buildTeamKey(entry.team, league, flight)

          if (!teamMap.has(key)) {
            teamMap.set(key, {
              key,
              team: entry.team,
              league,
              flight,
              matches: 0,
              players: 0,
              wins: 0,
              losses: 0,
              latestMatch: null,
            })
          }

          if (!teamPlayerSets.has(key)) {
            teamPlayerSets.set(key, new Set<string>())
          }

          const summary = teamMap.get(key)!
          summary.matches += 1

          const won = match.winner_side === entry.side
          if (won) summary.wins += 1
          else summary.losses += 1

          if (isLaterDate(match.match_date, summary.latestMatch)) {
            summary.latestMatch = match.match_date
          }

          const participantsForSide = matchPlayers.filter(
            (row) => row.match_id === match.id && row.side === entry.side
          )

          for (const participant of participantsForSide) {
            if (participant.player_id) {
              teamPlayerSets.get(key)!.add(String(participant.player_id))
            }
          }
        }
      }

      const nextTeams = [...teamMap.values()].map((team) => ({
        ...team,
        players: teamPlayerSets.get(team.key)?.size || 0,
      }))

      setTeams(nextTeams)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase()

    let next = teams.filter((team) => {
      const matchesSearch =
        !q ||
        team.team.toLowerCase().includes(q) ||
        team.league.toLowerCase().includes(q) ||
        team.flight.toLowerCase().includes(q)

      if (!matchesSearch) return false

      if (filterBy === 'active') return team.matches >= 3
      if (filterBy === 'winning') return getWinPct(team) >= 0.5
      if (filterBy === 'deep-roster') return team.players >= 6
      return true
    })

    next = [...next].sort((a, b) => {
      if (sortBy === 'name') return a.team.localeCompare(b.team)
      if (sortBy === 'players') return b.players - a.players
      if (sortBy === 'winPct') return getWinPct(b) - getWinPct(a)
      if (sortBy === 'latest') return compareDatesDesc(a.latestMatch, b.latestMatch)
      return b.matches - a.matches
    })

    return next
  }, [teams, search, sortBy, filterBy])

  const totalMatches = useMemo(() => teams.reduce((sum, team) => sum + team.matches, 0), [teams])

  const avgRoster = useMemo(() => {
    if (teams.length === 0) return 0
    return teams.reduce((sum, team) => sum + team.players, 0) / teams.length
  }, [teams])

  const topWinPct = useMemo(() => {
    if (teams.length === 0) return 0
    return Math.max(...teams.map((team) => getWinPct(team)))
  }, [teams])

  const winningTeams = useMemo(() => teams.filter((team) => team.wins > team.losses).length, [teams])

  const dynamicHeaderInner: CSSProperties = {
    ...headerInner,
    flexDirection: isTablet ? 'column' : 'row',
    alignItems: isTablet ? 'flex-start' : 'center',
    gap: isTablet ? '14px' : '18px',
  }

  const dynamicNavStyle: CSSProperties = {
    ...navStyle,
    flexWrap: 'wrap',
    width: isTablet ? '100%' : 'auto',
    justifyContent: isTablet ? 'flex-start' : 'flex-end',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '26px 18px' : '34px 26px',
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.3fr) minmax(320px, 0.72fr)',
    gap: isMobile ? '18px' : '22px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '42px' : '58px',
  }

  const dynamicSearchPanel: CSSProperties = {
    ...searchPanel,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'stretch' : 'center',
  }

  const dynamicCardGrid: CSSProperties = {
    ...cardGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isTablet
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicSectionHeader: CSSProperties = {
    ...sectionHeader,
    alignItems: isMobile ? 'flex-start' : 'flex-end',
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
              const isActive = link.href === '/teams'
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

      <section style={dynamicHeroShell}>
        <div>
          <div style={eyebrow}>Team directory</div>
          <h1 style={dynamicHeroTitle}>
            Browse teams by league and flight, then jump into roster and match history fast.
          </h1>
          <p style={heroText}>
            This is your team discovery page for captain and league workflows. Search by team,
            filter by league context, compare depth, and open the full team page when you want the details.
          </p>

          <div style={dynamicSearchPanel}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team, league, or flight"
              style={searchInput}
            />

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} style={selectStyle}>
              <option value="matches">Sort: Matches</option>
              <option value="players">Sort: Players Used</option>
              <option value="winPct">Sort: Win %</option>
              <option value="latest">Sort: Latest Match</option>
              <option value="name">Sort: Name</option>
            </select>

            <select value={filterBy} onChange={(e) => setFilterBy(e.target.value as FilterKey)} style={selectStyle}>
              <option value="all">All teams</option>
              <option value="active">3+ matches</option>
              <option value="winning">Winning record</option>
              <option value="deep-roster">6+ players used</option>
            </select>
          </div>
        </div>

        <div style={summaryCard}>
          <div style={summaryTitle}>Directory snapshot</div>

          <div style={summaryMetricGrid}>
            <MetricBlock label="Teams" value={String(teams.length)} />
            <MetricBlock label="Showing" value={String(filteredTeams.length)} />
            <MetricBlock label="Total matches" value={String(totalMatches)} />
            <MetricBlock label="Avg roster" value={formatNumber(avgRoster)} />
          </div>

          <div style={{ ...summaryMetricGrid, marginTop: '12px' }}>
            <MetricBlock label="Best win %" value={formatPercent(topWinPct)} accent />
            <MetricBlock label="Winning teams" value={String(winningTeams)} />
          </div>

          <div style={summaryHint}>
            Best flow: discover the team here, open the team page, then use Matchup or Captain&apos;s Corner for prep.
          </div>
        </div>
      </section>

      {error ? (
        <section style={errorCard}>
          <div style={sectionKicker}>Teams</div>
          <h2 style={sectionTitle}>Unable to load teams</h2>
          <p style={sectionText}>{error}</p>
        </section>
      ) : null}

      <section style={contentWrap}>
        <div style={dynamicSectionHeader}>
          <div>
            <div style={sectionKicker}>Browse</div>
            <h2 style={sectionTitle}>Team cards built for league and captain workflows</h2>
          </div>
          <Link href="/leagues" style={secondaryLink}>
            Open leagues
          </Link>
        </div>

        {loading ? (
          <div style={loadingCard}>Loading team directory...</div>
        ) : filteredTeams.length === 0 ? (
          <div style={loadingCard}>No teams matched that search.</div>
        ) : (
          <div style={dynamicCardGrid}>
            {filteredTeams.map((team) => {
              const href = `/teams/${encodeURIComponent(team.team)}?league=${encodeURIComponent(team.league)}&flight=${encodeURIComponent(team.flight)}`

              return (
                <Link key={team.key} href={href} style={teamCard}>
                  <div style={cardGlow} />

                  <div style={teamCardTopRow}>
                    <div style={miniKicker}>Team</div>
                    <div style={matchCountPill}>{team.matches} matches</div>
                  </div>

                  <div style={teamName}>{team.team}</div>
                  <div style={teamMeta}>
                    {team.league} · {team.flight}
                  </div>

                  <div style={recordRow}>
                    <div style={recordPillWin}>{team.wins} wins</div>
                    <div style={recordPillLoss}>{team.losses} losses</div>
                    <div style={recordPillNeutral}>{formatPercent(getWinPct(team))} win %</div>
                  </div>

                  <div style={teamStatGrid}>
                    <TeamStat label="Players used" value={String(team.players)} />
                    <TeamStat label="Latest" value={formatShortDate(team.latestMatch)} />
                  </div>

                  <div style={teamCardFooter}>
                    <span style={profileLinkText}>Open team page</span>
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

function MetricBlock({
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
        ...summaryMetricCard,
        ...(accent ? summaryMetricCardAccent : {}),
      }}
    >
      <div style={summaryMetricLabel}>{label}</div>
      <div style={summaryMetricValue}>{value}</div>
    </div>
  )
}

function TeamStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={teamStatCard}>
      <div style={teamStatLabel}>{label}</div>
      <div style={teamStatValue}>{value}</div>
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

function buildTeamKey(team: string, league: string, flight: string) {
  return `${team}__${league}__${flight}`
}

function safeText(value: string | null | undefined, fallback = 'Unknown') {
  const text = (value || '').trim()
  return text || fallback
}

function getWinPct(team: TeamCard) {
  const totalDecisions = team.wins + team.losses
  if (totalDecisions === 0) return 0
  return team.wins / totalDecisions
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(1)
}

function formatShortDate(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function compareDatesDesc(a: string | null, b: string | null) {
  const timeA = a ? new Date(a).getTime() : 0
  const timeB = b ? new Date(b).getTime() : 0
  return timeB - timeA
}

function isLaterDate(next: string | null, current: string | null) {
  const nextTime = next ? new Date(next).getTime() : 0
  const currentTime = current ? new Date(current).getTime() : 0
  return nextTime > currentTime
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  position: 'relative',
  overflow: 'hidden',
  background:
    'radial-gradient(circle at top, rgba(66,149,255,0.16), transparent 28%), linear-gradient(180deg, #07111f 0%, #0b1730 42%, #0d1b35 100%)',
  padding: '24px 18px 56px',
}

const orbOne: CSSProperties = {
  position: 'absolute',
  top: '-100px',
  right: '-60px',
  width: '360px',
  height: '360px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(122,255,98,0.16), rgba(122,255,98,0) 68%)',
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
  textDecoration: 'none',
}

const brandIQ: CSSProperties = {
  background: 'linear-gradient(135deg, #9ef767 0%, #55d8ae 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
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

const summaryMetricCardAccent: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(31,102,74,0.92) 0%, rgba(42,162,96,0.84) 100%)',
  border: '1px solid rgba(134,239,172,0.24)',
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

const summaryHint: CSSProperties = {
  marginTop: '14px',
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

const teamCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  textDecoration: 'none',
  borderRadius: '28px',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.32) 0%, rgba(28,49,95,0.46) 100%)',
  padding: '20px',
  boxShadow: '0 18px 40px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)',
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

const teamCardTopRow: CSSProperties = {
  position: 'relative',
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

const teamName: CSSProperties = {
  position: 'relative',
  color: '#f8fbff',
  fontSize: '28px',
  fontWeight: 900,
  letterSpacing: '-0.04em',
  lineHeight: 1.05,
  marginBottom: '8px',
}

const teamMeta: CSSProperties = {
  position: 'relative',
  color: 'rgba(223,232,248,0.74)',
  fontSize: '15px',
  fontWeight: 700,
  marginBottom: '16px',
}

const recordRow: CSSProperties = {
  position: 'relative',
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginBottom: '14px',
}

const recordPillWin: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(34,197,94,0.16)',
  color: '#aff5c4',
  fontSize: '12px',
  fontWeight: 800,
}

const recordPillLoss: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(239,68,68,0.16)',
  color: '#ffb7b7',
  fontSize: '12px',
  fontWeight: 800,
}

const recordPillNeutral: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.08)',
  color: '#dfe8f8',
  fontSize: '12px',
  fontWeight: 800,
}

const teamStatGrid: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
}

const teamStatCard: CSSProperties = {
  borderRadius: '18px',
  padding: '12px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.05)',
}

const teamStatLabel: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 700,
  marginBottom: '6px',
}

const teamStatValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '18px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
  lineHeight: 1.2,
}

const teamCardFooter: CSSProperties = {
  position: 'relative',
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

const footerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  padding: '28px 0 0',
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