'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  CSSProperties,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUserRole, type UserRole } from '@/lib/roles'

type TeamOption = {
  team: string
  league: string
  flight: string
  matches: number
}

type AvailabilityStatus = 'in' | 'out' | 'maybe' | 'unanswered'

type AvailabilityPlayer = {
  id: string
  name: string
  status: AvailabilityStatus
  note?: string
}

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/matchup', label: 'Matchups' },
  { href: '/captain', label: 'Captain' },
]

function safeText(value: string | null | undefined, fallback = 'Unknown') {
  const text = (value || '').trim()
  return text || fallback
}

export default function CaptainAvailabilityPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const teamParam = searchParams.get('team') || ''
  const leagueParam = searchParams.get('league') || ''
  const flightParam = searchParams.get('flight') || ''

  const [role, setRole] = useState<UserRole>('public')
  const [authLoading, setAuthLoading] = useState(true)

  const [screenWidth, setScreenWidth] = useState(1280)
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([])
  const [selectedTeam, setSelectedTeam] = useState(teamParam)
  const [selectedLeague, setSelectedLeague] = useState(leagueParam)
  const [selectedFlight, setSelectedFlight] = useState(flightParam)

  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [error, setError] = useState('')

  const [players, setPlayers] = useState<AvailabilityPlayer[]>([])
  const [weekLabel, setWeekLabel] = useState('Wednesday · 8:30 PM')
  const [requestSent, setRequestSent] = useState(false)

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
    async function loadAuth() {
      try {
        const { data } = await supabase.auth.getUser()
        const nextRole = getUserRole(data.user?.id ?? null)
        setRole(nextRole)
        if (nextRole === 'public') router.replace('/login')
      } finally {
        setAuthLoading(false)
      }
    }

    loadAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextRole = getUserRole(session?.user?.id ?? null)
      setRole(nextRole)
      setAuthLoading(false)
      if (nextRole === 'public') router.replace('/login')
    })

    return () => subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    void loadTeamOptions()
  }, [])

  useEffect(() => {
    if (!selectedTeam) return
    void loadRoster()
  }, [selectedTeam, selectedLeague, selectedFlight])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  async function loadTeamOptions() {
    setLoadingOptions(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('matches')
        .select('home_team, away_team, league_name, flight')

      if (error) throw new Error(error.message)

      const map = new Map<string, TeamOption>()

      for (const row of (data || []) as any[]) {
        const league = safeText(row.league_name, 'Unknown League')
        const flight = safeText(row.flight, 'Unknown Flight')

        for (const side of [safeText(row.home_team), safeText(row.away_team)]) {
          if (side === 'Unknown') continue
          const key = `${side}__${league}__${flight}`

          if (!map.has(key)) {
            map.set(key, { team: side, league, flight, matches: 0 })
          }

          map.get(key)!.matches += 1
        }
      }

      const next = [...map.values()].sort((a, b) => {
        if (b.matches !== a.matches) return b.matches - a.matches
        return a.team.localeCompare(b.team)
      })

      setTeamOptions(next)

      if (!teamParam && next.length > 0) {
        setSelectedTeam(next[0].team)
        setSelectedLeague(next[0].league)
        setSelectedFlight(next[0].flight)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams')
    } finally {
      setLoadingOptions(false)
    }
  }

  async function loadRoster() {
    setLoadingRoster(true)
    setError('')

    try {
      let matchQuery = supabase
        .from('matches')
        .select('id, home_team, away_team, league_name, flight')
        .or(`home_team.eq.${selectedTeam},away_team.eq.${selectedTeam}`)

      if (selectedLeague) matchQuery = matchQuery.eq('league_name', selectedLeague)
      if (selectedFlight) matchQuery = matchQuery.eq('flight', selectedFlight)

      const { data: matches, error: matchError } = await matchQuery.limit(25)
      if (matchError) throw new Error(matchError.message)

      const matchIds = (matches || []).map((m: any) => m.id)

      if (!matchIds.length) {
        setPlayers([])
        return
      }

      const { data: matchPlayers, error: playerError } = await supabase
        .from('match_players')
        .select(`
          match_id,
          side,
          players (
            id,
            name
          )
        `)
        .in('match_id', matchIds)

      if (playerError) throw new Error(playerError.message)

      const teamSides = new Map<string, 'A' | 'B'>()
      for (const match of (matches || []) as any[]) {
        if (safeText(match.home_team) == selectedTeam) teamSides.set(match.id, 'A')
        if (safeText(match.away_team) == selectedTeam) teamSides.set(match.id, 'B')
      }

      const rosterMap = new Map<string, AvailabilityPlayer>()

      for (const row of (matchPlayers || []) as any[]) {
        const expectedSide = teamSides.get(row.match_id)
        if (!expectedSide || row.side !== expectedSide) continue

        const player = Array.isArray(row.players) ? row.players[0] : row.players
        if (!player?.id || !player?.name) continue

        if (!rosterMap.has(player.id)) {
          rosterMap.set(player.id, {
            id: player.id,
            name: player.name,
            status: 'unanswered',
          })
        }
      }

      const roster = [...rosterMap.values()].sort((a, b) => a.name.localeCompare(b.name))

      const seeded = roster.map((player, index) => {
        if (index < 5) return { ...player, status: 'in' as AvailabilityStatus }
        if (index < 7) return { ...player, status: 'out' as AvailabilityStatus }
        if (index < 9) return { ...player, status: 'maybe' as AvailabilityStatus }
        return player
      })

      setPlayers(seeded)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load availability')
    } finally {
      setLoadingRoster(false)
    }
  }

  function updateStatus(playerId: string, status: AvailabilityStatus) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId ? { ...player, status } : player
      )
    )
  }

  const filteredTeamOptions = useMemo(() => {
    return teamOptions.filter((option) => option.team && option.league && option.flight)
  }, [teamOptions])

  const counts = useMemo(() => {
    return {
      in: players.filter((p) => p.status == 'in').length,
      out: players.filter((p) => p.status == 'out').length,
      maybe: players.filter((p) => p.status == 'maybe').length,
      unanswered: players.filter((p) => p.status == 'unanswered').length,
    }
  }, [players])

  if (authLoading) {
    return (
      <main style={pageStyle}>
        <div style={orbOne} />
        <div style={orbTwo} />
        <div style={gridGlow} />
        <div style={topBlueWash} />
        <section style={loadingShell}>
          <div style={loadingCard}>Loading availability...</div>
        </section>
      </main>
    )
  }

  if (role === 'public') return null

  return (
    <main style={pageStyle}>
      <div style={orbOne} />
      <div style={orbTwo} />
      <div style={gridGlow} />
      <div style={topBlueWash} />

      <header style={headerStyle}>
        <div style={headerInnerResponsive(isTablet)}>
          <Link href="/" style={brandWrap} aria-label="TenAceIQ home">
            <BrandWordmark compact={isMobile} top />
          </Link>

          <nav style={navStyleResponsive(isTablet)}>
            {NAV_LINKS.map((link) => {
              const isActive = link.href == '/captain'
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{ ...navLink, ...(isActive && link.href == '/captain' ? activeNavLink : {}) }}
                >
                  {link.label}
                </Link>
              )
            })}
            <Link href="/dashboard" style={ctaNavLink}>My Lab</Link>
            {role === 'admin' ? <Link href="/admin" style={navLink}>Admin</Link> : null}
            <button type="button" onClick={handleLogout} style={navButtonReset}>Logout</button>
          </nav>
        </div>
      </header>

      <section style={heroShellResponsive(isTablet, isMobile)}>
        <div>
          <div style={eyebrow}>Captain availability</div>
          <h1 style={heroTitleResponsive(isSmallMobile, isMobile)}>Know who you have before you build the lineup.</h1>
          <p style={heroText}>
            Use this page as your weekly captain checkpoint. Select the team, view availability status,
            follow up with non-responders, and move directly into lineup building once the roster is clear.
          </p>

          <div style={selectorPanelResponsive(isSmallMobile)}>
            <select
              value={selectedTeam}
              onChange={(e) => {
                const option = filteredTeamOptions.find((item) => item.team == e.target.value)
                setSelectedTeam(e.target.value)
                if (option) {
                  setSelectedLeague(option.league)
                  setSelectedFlight(option.flight)
                }
              }}
              style={selectStyle}
            >
              {loadingOptions && !filteredTeamOptions.length ? (
                <option>Loading teams...</option>
              ) : (
                filteredTeamOptions.map((option) => (
                  <option key={`${option.team}__${option.league}__${option.flight}`} value={option.team}>
                    {option.team} · {option.league} · {option.flight}
                  </option>
                ))
              )}
            </select>

            <input
              value={weekLabel}
              onChange={(e) => setWeekLabel(e.target.value)}
              style={textInputStyle}
              placeholder="Wednesday · 8:30 PM"
            />

            <button
              type="button"
              style={primaryButton}
              onClick={() => setRequestSent(true)}
            >
              Send Request
            </button>
          </div>

          <div style={heroBadgeRow}>
            <span style={badgeBlue}>{counts.in} available</span>
            <span style={badgeGreen}>{counts.maybe} maybe</span>
            <span style={badgeSlate}>{counts.unanswered} unanswered</span>
          </div>
        </div>

        <div style={quickStartCard}>
          <div style={quickStartLabel}>Availability snapshot</div>
          <h2 style={quickStartTitle}>{selectedTeam || 'Select a team'}</h2>
          <div style={quickStartMeta}>{selectedLeague || 'League'} · {selectedFlight || 'Flight'}</div>

          <div style={statusGrid}>
            <div style={statusCard}>
              <div style={statusLabelGreen}>In</div>
              <div style={statusValue}>{counts.in}</div>
            </div>
            <div style={statusCard}>
              <div style={statusLabelBlue}>Out</div>
              <div style={statusValue}>{counts.out}</div>
            </div>
            <div style={statusCard}>
              <div style={statusLabelSlate}>No reply</div>
              <div style={statusValue}>{counts.unanswered}</div>
            </div>
          </div>

          {requestSent ? (
            <div style={successBanner}>Availability request prepared for {weekLabel}.</div>
          ) : (
            <div style={helperBanner}>Set your match label and send a request when ready.</div>
          )}
        </div>
      </section>

      {error ? <section style={errorCard}>{error}</section> : null}

      <section style={contentWrap}>
        <div style={metricGridResponsive(isSmallMobile, isMobile)}>
          <MetricCard label="Available" value={String(counts.in)} accent="green" />
          <MetricCard label="Unavailable" value={String(counts.out)} accent="blue" />
          <MetricCard label="Maybe" value={String(counts.maybe)} accent="slate" />
          <MetricCard label="Unanswered" value={String(counts.unanswered)} accent="slate" />
        </div>

        <section style={sectionCard}>
          <div style={sectionHeadResponsive(isTablet)}>
            <div>
              <div style={sectionKicker}>Weekly roster</div>
              <h2 style={sectionTitle}>Player responses</h2>
              <div style={sectionSub}>Update statuses as you hear back, then move straight into lineup planning.</div>
            </div>

            <div style={sectionActions}>
              <Link href="/captain/lineup-builder" style={sectionCtaPrimary}>
                Build Lineup
              </Link>
              <Link href="/captain/messaging" style={sectionCtaSecondary}>
                Text Team
              </Link>
            </div>
          </div>

          {loadingRoster ? (
            <div style={stateBox}>Loading roster...</div>
          ) : players.length == 0 ? (
            <div style={stateBox}>No roster found yet for this team selection.</div>
          ) : (
            <div style={playerList}>
              {players.map((player) => (
                <div key={player.id} style={playerRowResponsive(isSmallMobile)}>
                  <div>
                    <div style={playerName}>{player.name}</div>
                    <div style={playerMeta}>{selectedTeam || 'Team'} · {weekLabel}</div>
                  </div>

                  <div style={statusButtonRowResponsive(isSmallMobile)}>
                    <button
                      type="button"
                      style={{ ...statusButton, ...(player.status == 'in' ? statusButtonIn : {}) }}
                      onClick={() => updateStatus(player.id, 'in')}
                    >
                      In
                    </button>
                    <button
                      type="button"
                      style={{ ...statusButton, ...(player.status == 'out' ? statusButtonOut : {}) }}
                      onClick={() => updateStatus(player.id, 'out')}
                    >
                      Out
                    </button>
                    <button
                      type="button"
                      style={{ ...statusButton, ...(player.status == 'maybe' ? statusButtonMaybe : {}) }}
                      onClick={() => updateStatus(player.id, 'maybe')}
                    >
                      Maybe
                    </button>
                    <button
                      type="button"
                      style={{ ...statusButton, ...(player.status == 'unanswered' ? statusButtonUnanswered : {}) }}
                      onClick={() => updateStatus(player.id, 'unanswered')}
                    >
                      Unanswered
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

      <footer style={footerStyle}>
        <div style={footerInnerResponsive(isMobile)}>
          <div style={footerRowResponsive(isTablet)}>
            <Link href="/" style={footerBrandLink}>
              <BrandWordmark compact={false} footer />
            </Link>
            <div style={footerLinksResponsive(isTablet)}>
              <Link href="/captain" style={footerUtilityLink}>Captain</Link>
              <Link href="/captain/availability" style={footerUtilityLink}>Availability</Link>
              <Link href="/captain/messaging" style={footerUtilityLink}>Messaging</Link>
              <Link href="/captain/lineup-builder" style={footerUtilityLink}>Lineup Builder</Link>
              <Link href="/captain/scenario-builder" style={footerUtilityLink}>Scenarios</Link>
            </div>
            <div style={{ ...footerBottom, ...(isTablet ? {} : { marginLeft: 'auto' }) }}>
              © {new Date().getFullYear()} TenAceIQ
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: 'green' | 'blue' | 'slate'
}) {
  return (
    <div
      style={{
        ...metricCard,
        ...(accent == 'green'
          ? metricCardGreen
          : accent == 'blue'
          ? metricCardBlue
          : metricCardSlate),
      }}
    >
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
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
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: compact ? '10px' : '12px', lineHeight: 1 }}>
      <span
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '999px',
          background:
            'radial-gradient(circle at 30% 30%, rgba(155,225,29,0.28), rgba(74,163,255,0.18) 55%, rgba(74,163,255,0.04) 100%)',
          boxShadow: '0 0 28px rgba(116,190,255,0.18)',
          overflow: 'hidden',
        }}
      >
        <Image
          src="/logo-icon.png"
          alt="TenAceIQ"
          width={iconSize}
          height={iconSize}
          priority
          style={{ width: `${iconSize}px`, height: `${iconSize}px`, display: 'block', objectFit: 'contain' }}
        />
      </span>
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

function headerInnerResponsive(isTablet: boolean): CSSProperties {
  return {
    ...headerInner,
    flexDirection: isTablet ? 'column' : 'row',
    alignItems: isTablet ? 'flex-start' : 'center',
    gap: isTablet ? '16px' : '22px',
  }
}

function navStyleResponsive(isTablet: boolean): CSSProperties {
  return {
    ...navStyle,
    width: isTablet ? '100%' : 'auto',
    justifyContent: isTablet ? 'flex-start' : 'flex-end',
    flexWrap: 'wrap',
  }
}

function heroShellResponsive(isTablet: boolean, isMobile: boolean): CSSProperties {
  return {
    ...heroShell,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.08fr) minmax(330px, 0.84fr)',
    padding: isMobile ? '26px 18px' : '34px 26px',
    gap: isMobile ? '18px' : '22px',
  }
}

function heroTitleResponsive(isSmallMobile: boolean, isMobile: boolean): CSSProperties {
  return {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '46px' : '56px',
  }
}

function selectorPanelResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...selectorPanel,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'stretch' : 'center',
  }
}

function metricGridResponsive(isSmallMobile: boolean, isMobile: boolean): CSSProperties {
  return {
    ...metricGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
  }
}

function sectionHeadResponsive(isTablet: boolean): CSSProperties {
  return {
    ...sectionHead,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: isTablet ? 'flex-start' : 'flex-end',
    gap: '16px',
    flexDirection: isTablet ? 'column' : 'row',
  }
}

function playerRowResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...playerRow,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'flex-start' : 'center',
  }
}

function statusButtonRowResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...statusButtonRow,
    width: isSmallMobile ? '100%' : 'auto',
  }
}

function footerInnerResponsive(isMobile: boolean): CSSProperties {
  return {
    ...footerInner,
    padding: isMobile ? '16px 16px 14px' : '16px 20px 14px',
  }
}

function footerRowResponsive(isTablet: boolean): CSSProperties {
  return {
    ...footerRow,
    flexDirection: isTablet ? 'column' : 'row',
    alignItems: isTablet ? 'flex-start' : 'center',
    gap: isTablet ? '12px' : '18px',
  }
}

function footerLinksResponsive(isTablet: boolean): CSSProperties {
  return {
    ...footerLinks,
    justifyContent: isTablet ? 'flex-start' : 'center',
  }
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  position: 'relative',
  overflow: 'hidden',
  background: `
    radial-gradient(circle at 14% 2%, rgba(120, 190, 255, 0.22) 0%, rgba(120, 190, 255, 0) 24%),
    radial-gradient(circle at 82% 10%, rgba(88, 170, 255, 0.18) 0%, rgba(88, 170, 255, 0) 26%),
    radial-gradient(circle at 50% -8%, rgba(150, 210, 255, 0.14) 0%, rgba(150, 210, 255, 0) 28%),
    linear-gradient(180deg, #0b1830 0%, #102347 34%, #0f2243 68%, #0c1a33 100%)
  `,
}

const orbOne: CSSProperties = {
  position: 'absolute',
  top: '-120px',
  left: '-140px',
  width: '420px',
  height: '420px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(116,190,255,0.28) 0%, rgba(116,190,255,0.12) 40%, rgba(116,190,255,0) 74%)',
  filter: 'blur(8px)',
  pointerEvents: 'none',
}

const orbTwo: CSSProperties = {
  position: 'absolute',
  right: '-140px',
  top: '140px',
  width: '420px',
  height: '420px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(155,225,29,0.13) 0%, rgba(155,225,29,0.05) 36%, rgba(155,225,29,0) 72%)',
  filter: 'blur(8px)',
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

const topBlueWash: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '420px',
  background:
    'linear-gradient(180deg, rgba(114,186,255,0.10) 0%, rgba(114,186,255,0.05) 38%, rgba(114,186,255,0) 100%)',
  pointerEvents: 'none',
}

const headerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  padding: '18px 24px 0',
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
  gap: '12px',
}

const navLink: CSSProperties = {
  padding: '12px 18px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.22)',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.22) 0%, rgba(27,62,120,0.18) 100%)',
  color: '#e7eefb',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '15px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
}

const ctaNavLink: CSSProperties = {
  ...navLink,
  color: '#08111d',
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  border: '1px solid rgba(155,225,29,0.34)',
  boxShadow: '0 10px 28px rgba(155,225,29,0.18)',
}

const navButtonReset: CSSProperties = {
  ...navLink,
  cursor: 'pointer',
  appearance: 'none',
}

const activeNavLink: CSSProperties = {
  ...ctaNavLink,
}

const heroShell: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1280px',
  margin: '14px auto 18px',
  display: 'grid',
  borderRadius: '34px',
  border: '1px solid rgba(116,190,255,0.22)',
  background: 'linear-gradient(135deg, rgba(26,54,104,0.52) 0%, rgba(17,36,72,0.72) 22%, rgba(12,27,52,0.82) 100%)',
  boxShadow: '0 34px 80px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 80px rgba(88,170,255,0.06)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  minHeight: '38px',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(130,244,118,0.28)',
  background: 'rgba(89,145,73,0.14)',
  color: '#d9e7ef',
  fontWeight: 800,
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
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
  color: 'rgba(224,234,247,0.84)',
  fontSize: '18px',
  lineHeight: 1.6,
  maxWidth: '760px',
}

const selectorPanel: CSSProperties = {
  display: 'flex',
  gap: '12px',
  padding: '14px',
  borderRadius: '24px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(10,20,37,0.64)',
  maxWidth: '940px',
}

const selectStyle: CSSProperties = {
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

const textInputStyle: CSSProperties = {
  ...selectStyle,
}

const primaryButton: CSSProperties = {
  minHeight: '52px',
  padding: '0 18px',
  borderRadius: '16px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '14px',
  color: '#08111d',
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  border: '1px solid rgba(155,225,29,0.34)',
  boxShadow: '0 10px 28px rgba(155,225,29,0.18)',
  cursor: 'pointer',
}

const heroBadgeRow: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginTop: '14px',
}

const badgeBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '36px',
  padding: '0 14px',
  borderRadius: '999px',
  fontSize: '13px',
  lineHeight: 1,
  fontWeight: 900,
  border: '1px solid transparent',
}

const badgeBlue: CSSProperties = {
  ...badgeBase,
  background: 'rgba(37,91,227,0.16)',
  color: '#c7dbff',
  borderColor: 'rgba(98,154,255,0.18)',
}

const badgeGreen: CSSProperties = {
  ...badgeBase,
  background: 'rgba(96,221,116,0.14)',
  color: '#dffad5',
  borderColor: 'rgba(130,244,118,0.2)',
}

const badgeSlate: CSSProperties = {
  ...badgeBase,
  background: 'rgba(255,255,255,0.08)',
  color: '#ecf4ff',
  borderColor: 'rgba(255,255,255,0.1)',
}

const quickStartCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'linear-gradient(180deg, rgba(24,49,93,0.68) 0%, rgba(13,26,50,0.92) 100%)',
  boxShadow: '0 22px 52px rgba(7,18,40,0.24)',
  padding: '22px',
  minHeight: '100%',
}

const quickStartLabel: CSSProperties = {
  color: '#e7ffd0',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const quickStartTitle: CSSProperties = {
  margin: '8px 0 10px',
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.04,
  fontWeight: 900,
  letterSpacing: '-0.045em',
}

const quickStartMeta: CSSProperties = {
  color: 'rgba(224,236,249,0.76)',
  fontSize: '14px',
  lineHeight: 1.55,
  marginBottom: '14px',
}

const statusGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '10px',
}

const statusCard: CSSProperties = {
  borderRadius: '18px',
  padding: '14px 12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  textAlign: 'center',
}

const statusLabelGreen: CSSProperties = {
  color: '#dffad5',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const statusLabelBlue: CSSProperties = {
  color: '#c7dbff',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const statusLabelSlate: CSSProperties = {
  color: '#ecf4ff',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const statusValue: CSSProperties = {
  marginTop: '8px',
  color: '#f8fbff',
  fontSize: '28px',
  fontWeight: 900,
  lineHeight: 1,
}

const successBanner: CSSProperties = {
  marginTop: '14px',
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(96,221,116,0.12)',
  border: '1px solid rgba(130,244,118,0.18)',
  color: '#e7ffd0',
  fontWeight: 700,
  fontSize: '14px',
}

const helperBanner: CSSProperties = {
  marginTop: '14px',
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#e7eefb',
  fontWeight: 700,
  fontSize: '14px',
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1280px',
  margin: '0 auto',
  display: 'grid',
  gap: '18px',
  padding: '0 24px 28px',
}

const metricGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
}

const metricCard: CSSProperties = {
  borderRadius: '20px',
  padding: '18px',
  background: 'linear-gradient(180deg, rgba(22,46,88,0.74) 0%, rgba(13,27,52,0.84) 100%)',
  border: '1px solid rgba(116,190,255,0.16)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.18)',
}

const metricCardGreen: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(20,66,54,0.82) 0%, rgba(10,40,32,0.92) 100%)',
  border: '1px solid rgba(130,244,118,0.16)',
}

const metricCardBlue: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(22,46,88,0.74) 0%, rgba(13,27,52,0.84) 100%)',
}

const metricCardSlate: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(31,38,56,0.82) 0%, rgba(17,22,34,0.94) 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
}

const metricLabel: CSSProperties = {
  color: 'rgba(188,208,232,0.8)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const metricValue: CSSProperties = {
  marginTop: '8px',
  color: '#f8fbff',
  fontSize: '24px',
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const sectionCard: CSSProperties = {
  borderRadius: '28px',
  padding: '24px',
  background: 'linear-gradient(180deg, rgba(20,42,80,0.42) 0%, rgba(11,23,44,0.76) 100%)',
  border: '1px solid rgba(116,190,255,0.16)',
  boxShadow: '0 20px 48px rgba(7,18,40,0.18)',
}

const sectionHead: CSSProperties = {
  marginBottom: '18px',
}

const sectionKicker: CSSProperties = {
  color: 'rgba(188,208,232,0.8)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.11em',
  marginBottom: '8px',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontSize: '32px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const sectionSub: CSSProperties = {
  marginTop: '10px',
  color: 'rgba(224,236,249,0.78)',
  fontSize: '14px',
  lineHeight: 1.65,
}

const sectionActions: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
}

const sectionCtaPrimary: CSSProperties = {
  ...primaryButton,
  minHeight: '44px',
  fontSize: '13px',
}

const sectionCtaSecondary: CSSProperties = {
  minHeight: '44px',
  padding: '0 16px',
  borderRadius: '999px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '13px',
  color: '#e7eefb',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.22) 0%, rgba(27,62,120,0.18) 100%)',
  border: '1px solid rgba(116,190,255,0.22)',
}

const playerList: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const playerRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  borderRadius: '20px',
  padding: '16px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
}

const playerName: CSSProperties = {
  color: '#f8fbff',
  fontSize: '16px',
  fontWeight: 800,
  lineHeight: 1.4,
}

const playerMeta: CSSProperties = {
  marginTop: '4px',
  color: 'rgba(224,236,249,0.7)',
  fontSize: '13px',
  lineHeight: 1.55,
}

const statusButtonRow: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  alignItems: 'center',
}

const statusButton: CSSProperties = {
  minHeight: '38px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e7eefb',
  fontWeight: 800,
  fontSize: '12px',
  cursor: 'pointer',
}

const statusButtonIn: CSSProperties = {
  background: 'rgba(96,221,116,0.14)',
  borderColor: 'rgba(130,244,118,0.20)',
  color: '#dffad5',
}

const statusButtonOut: CSSProperties = {
  background: 'rgba(37,91,227,0.16)',
  borderColor: 'rgba(98,154,255,0.18)',
  color: '#c7dbff',
}

const statusButtonMaybe: CSSProperties = {
  background: 'rgba(255,255,255,0.10)',
  borderColor: 'rgba(255,255,255,0.14)',
  color: '#ffffff',
}

const statusButtonUnanswered: CSSProperties = {
  background: 'rgba(31,38,56,0.82)',
  borderColor: 'rgba(255,255,255,0.08)',
  color: '#ecf4ff',
}

const stateBox: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  color: '#e7eefb',
  fontWeight: 700,
}

const errorCard: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1280px',
  margin: '0 auto 18px',
  padding: '14px 18px',
  borderRadius: '18px',
  background: 'rgba(142, 32, 32, 0.18)',
  border: '1px solid rgba(255, 122, 122, 0.26)',
  color: '#ffd7d7',
  fontWeight: 700,
}

const loadingShell: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1280px',
  margin: '40px auto',
  padding: '0 24px',
}

const loadingCard: CSSProperties = {
  borderRadius: '22px',
  padding: '18px 20px',
  color: '#eaf4ff',
  background: 'linear-gradient(180deg, rgba(24,49,93,0.68) 0%, rgba(13,26,50,0.92) 100%)',
  border: '1px solid rgba(116,190,255,0.18)',
  fontSize: '15px',
  fontWeight: 700,
}

const footerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  marginTop: '8px',
  padding: '0 18px 24px',
}

const footerInner: CSSProperties = {
  maxWidth: '1280px',
  margin: '0 auto',
  borderRadius: '24px',
  background: 'linear-gradient(180deg, rgba(21,42,80,0.54) 0%, rgba(12,24,46,0.88) 100%)',
  border: '1px solid rgba(116,190,255,0.12)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.18)',
}

const footerRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '18px',
}

const footerBrandLink: CSSProperties = {
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
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
  color: 'rgba(197,213,234,0.72)',
  fontSize: '13px',
  fontWeight: 700,
}