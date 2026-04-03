'use client'

export const dynamic = 'force-dynamic'

import Image from 'next/image'
import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUserRole, type UserRole } from '@/lib/roles'

type TeamMatch = {
  id: string
  league_name: string | null
  flight: string | null
  home_team: string | null
  away_team: string | null
  match_date: string
  match_type: 'singles' | 'doubles'
  score: string | null
  winner_side: 'A' | 'B'
}

type PlayerRelation =
  | {
      id: string
      name: string
      overall_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
    }
  | {
      id: string
      name: string
      overall_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
    }[]
  | null

type MatchPlayer = {
  match_id: string
  side: 'A' | 'B'
  seat: number | null
  player_id: string
  players: PlayerRelation
}

type TeamOption = {
  team: string
  league: string
  flight: string
  matches: number
}

type TeamPlayerSummary = {
  id: string
  name: string
  appearances: number
  wins: number
  losses: number
  singlesDynamic: number | null
  doublesDynamic: number | null
}

type PairingSummary = {
  key: string
  names: string[]
  appearances: number
  wins: number
  losses: number
  avgDoublesRating: number | null
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

function normalizePlayerRelation(player: PlayerRelation) {
  if (!player) return null
  return Array.isArray(player) ? player[0] ?? null : player
}

function formatDate(value: string | null) {
  if (!value) return 'Unknown'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRating(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value.toFixed(2)
}

function average(values: number[]) {
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function getWinPct(wins: number, losses: number) {
  const total = wins + losses
  if (!total) return 0
  return wins / total
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}


export default function CaptainsCornerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const teamParam = searchParams.get('team') || ''
  const leagueParam = searchParams.get('league') || ''
  const flightParam = searchParams.get('flight') || ''

  const [role, setRole] = useState<UserRole>('public')
  const [authLoading, setAuthLoading] = useState(true)

  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([])
  const [selectedTeam, setSelectedTeam] = useState(teamParam)
  const [selectedLeague, setSelectedLeague] = useState(leagueParam)
  const [selectedFlight, setSelectedFlight] = useState(flightParam)

  const [matches, setMatches] = useState<TeamMatch[]>([])
  const [participants, setParticipants] = useState<MatchPlayer[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [error, setError] = useState('')
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
    void loadSelectedTeam()
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
        .select('home_team, away_team, league_name, flight, match_date')

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

  async function loadSelectedTeam() {
    setLoadingTeam(true)
    setError('')

    try {
      let query = supabase
        .from('matches')
        .select(`
          id,
          league_name,
          flight,
          home_team,
          away_team,
          match_date,
          match_type,
          score,
          winner_side
        `)
        .or(`home_team.eq.${selectedTeam},away_team.eq.${selectedTeam}`)
        .order('match_date', { ascending: false })

      if (selectedLeague) query = query.eq('league_name', selectedLeague)
      if (selectedFlight) query = query.eq('flight', selectedFlight)

      const { data: matchData, error: matchError } = await query
      if (matchError) throw new Error(matchError.message)

      const typedMatches = (matchData || []) as TeamMatch[]
      setMatches(typedMatches)

      const matchIds = typedMatches.map((m) => m.id)
      if (!matchIds.length) {
        setParticipants([])
        return
      }

      const { data: participantData, error: participantError } = await supabase
        .from('match_players')
        .select(`
          match_id,
          side,
          seat,
          player_id,
          players (
            id,
            name,
            overall_dynamic_rating,
            singles_dynamic_rating,
            doubles_dynamic_rating
          )
        `)
        .in('match_id', matchIds)

      if (participantError) throw new Error(participantError.message)
      setParticipants((participantData || []) as MatchPlayer[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load captain hub')
    } finally {
      setLoadingTeam(false)
    }
  }

  const filteredTeamOptions = useMemo(() => {
    return teamOptions.filter((option) => option.team && option.league && option.flight)
  }, [teamOptions])

  const teamSideByMatchId = useMemo(() => {
    const map = new Map<string, 'A' | 'B'>()

    for (const match of matches) {
      if (safeText(match.home_team) === selectedTeam) map.set(match.id, 'A')
      if (safeText(match.away_team) === selectedTeam) map.set(match.id, 'B')
    }

    return map
  }, [matches, selectedTeam])

  const roster = useMemo<TeamPlayerSummary[]>(() => {
    const map = new Map<string, TeamPlayerSummary>()

    for (const row of participants) {
      const side = teamSideByMatchId.get(row.match_id)
      if (!side || row.side !== side) continue

      const player = normalizePlayerRelation(row.players)
      if (!player) continue

      const match = matches.find((m) => m.id === row.match_id)
      if (!match) continue

      if (!map.has(player.id)) {
        map.set(player.id, {
          id: player.id,
          name: player.name,
          appearances: 0,
          wins: 0,
          losses: 0,
          singlesDynamic: player.singles_dynamic_rating,
          doublesDynamic: player.doubles_dynamic_rating,
        })
      }

      const item = map.get(player.id)!
      item.appearances += 1
      if (match.winner_side === side) item.wins += 1
      else item.losses += 1
    }

    return [...map.values()].sort((a, b) => {
      if (b.appearances !== a.appearances) return b.appearances - a.appearances
      return a.name.localeCompare(b.name)
    })
  }, [participants, matches, teamSideByMatchId])

  const pairings = useMemo<PairingSummary[]>(() => {
    const map = new Map<string, PairingSummary>()

    for (const match of matches) {
      if (match.match_type !== 'doubles') continue

      const side = teamSideByMatchId.get(match.id)
      if (!side) continue

      const teamPlayers = participants
        .filter((row) => row.match_id === match.id && row.side === side)
        .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
        .map((row) => normalizePlayerRelation(row.players))
        .filter(Boolean) as NonNullable<ReturnType<typeof normalizePlayerRelation>>[]

      if (teamPlayers.length < 2) continue

      const pair = teamPlayers.slice(0, 2).sort((a, b) => a.name.localeCompare(b.name))
      const key = `${pair[0].id}__${pair[1].id}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          names: [pair[0].name, pair[1].name],
          appearances: 0,
          wins: 0,
          losses: 0,
          avgDoublesRating: average(
            pair
              .map((p) => p.doubles_dynamic_rating)
              .filter((v): v is number => typeof v === 'number')
          ),
        })
      }

      const item = map.get(key)!
      item.appearances += 1
      if (match.winner_side === side) item.wins += 1
      else item.losses += 1
    }

    return [...map.values()].sort((a, b) => {
      const pctDiff = getWinPct(b.wins, b.losses) - getWinPct(a.wins, a.losses)
      if (Math.abs(pctDiff) > 0.0001) return pctDiff
      if (b.appearances !== a.appearances) return b.appearances - a.appearances
      return a.names.join(' / ').localeCompare(b.names.join(' / '))
    })
  }, [matches, participants, teamSideByMatchId])

  const recommendedSingles = useMemo(() => {
    return [...roster]
      .sort(
        (a, b) =>
          ((b.singlesDynamic || 0) + b.appearances * 0.04) -
          ((a.singlesDynamic || 0) + a.appearances * 0.04)
      )
      .slice(0, 4)
  }, [roster])

  const quickStats = useMemo(() => {
    let wins = 0
    let losses = 0
    let doubles = 0
    let singles = 0

    for (const match of matches) {
      const side = teamSideByMatchId.get(match.id)
      if (!side) continue
      if (match.winner_side === side) wins += 1
      else losses += 1

      if (match.match_type === 'doubles') doubles += 1
      else singles += 1
    }

    return {
      matches: matches.length,
      wins,
      losses,
      singles,
      doubles,
      latest: matches[0]?.match_date || null,
      roster: roster.length,
    }
  }, [matches, teamSideByMatchId, roster.length])

  const currentTeamHref = selectedTeam
    ? `/teams/${encodeURIComponent(selectedTeam)}?league=${encodeURIComponent(selectedLeague)}&flight=${encodeURIComponent(selectedFlight)}`
    : '/teams'

  const lineupBuilderHref = selectedTeam
    ? `/captain/lineup-builder?team=${encodeURIComponent(selectedTeam)}&league=${encodeURIComponent(selectedLeague)}&flight=${encodeURIComponent(selectedFlight)}`
    : '/captain/lineup-builder'

  const availabilityHref = selectedTeam
    ? `/captain/availability?team=${encodeURIComponent(selectedTeam)}&league=${encodeURIComponent(selectedLeague)}&flight=${encodeURIComponent(selectedFlight)}`
    : '/captain/availability'

  const scenarioHref = selectedTeam
    ? `/captain/scenario-builder?team=${encodeURIComponent(selectedTeam)}&league=${encodeURIComponent(selectedLeague)}&flight=${encodeURIComponent(selectedFlight)}`
    : '/captain/scenario-builder'

  if (authLoading) {
    return (
      <main style={pageStyle}>
        <div style={orbOne} />
        <div style={orbTwo} />
        <div style={gridGlow} />
        <div style={topBlueWash} />
        <section style={loadingShell}>
          <div style={loadingCard}>Loading Captain dashboard...</div>
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
              const isActive = link.href === '/captain'
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{ ...navLink, ...(isActive && link.href === '/captain' ? activeNavLink : {}) }}
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
          <div style={eyebrow}>Premium captain workflow</div>
          <h1 style={heroTitleResponsive(isSmallMobile, isMobile)}>Captain&apos;s Corner</h1>
          <p style={heroText}>
            A strategic command center for captains. Choose your team, review lineup intelligence,
            track availability, build match-day options, and compare scenarios with real team context.
          </p>

          <div style={selectorPanelResponsive(isSmallMobile)}>
            <select
              value={selectedTeam}
              onChange={(e) => {
                const option = filteredTeamOptions.find((item) => item.team === e.target.value)
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

            <Link href={lineupBuilderHref} style={primaryButton}>
              Open Lineup Builder
            </Link>
          </div>

          <div style={heroBadgeRow}>
            <span style={badgeBlue}>{quickStats.matches} matches</span>
            <span style={badgeGreen}>{quickStats.wins}-{quickStats.losses} record</span>
            <span style={badgeSlate}>{quickStats.roster} active players</span>
          </div>
        </div>

        <div style={quickStartCard}>
          <div style={quickStartLabel}>Captain quick start</div>
          <h2 style={quickStartTitle}>Build better lineups with a repeatable process</h2>

          <div style={workflowStack}>
            {[
              ['1', 'Check availability', 'Start with the right player pool before building anything.'],
              ['2', 'Use lineup intelligence', 'Lean on best singles and doubles history before making choices.'],
              ['3', 'Build and compare', 'Open lineup builder, test options, then compare final scenarios.'],
            ].map(([step, title, text]) => (
              <div key={step} style={workflowRow}>
                <div style={workflowStep}>{step}</div>
                <div>
                  <div style={workflowTitle}>{title}</div>
                  <div style={workflowText}>{text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error ? <section style={errorCard}>{error}</section> : null}

      <section style={contentWrap}>
        <div style={metricGridResponsive(isSmallMobile, isMobile)}>
          <MetricCard label="Visible team" value={selectedTeam || '—'} />
          <MetricCard label="League" value={selectedLeague || '—'} />
          <MetricCard label="Flight" value={selectedFlight || '—'} />
          <MetricCard label="Latest match" value={formatDate(quickStats.latest)} accent />
        </div>

        <section style={sectionCard}>
          <div style={sectionHead}>
            <div>
              <div style={sectionKicker}>Quick actions</div>
              <h2 style={sectionTitle}>Captain toolkit</h2>
              <div style={sectionSub}>Everything important for match-week prep in one place.</div>
            </div>
          </div>

          <div style={actionGridResponsive(isSmallMobile, isTablet)}>
            <ActionCard
              badge="Availability"
              title="Availability Tracker"
              description="Track who is in, out, or uncertain before building any lineup."
              href={availabilityHref}
              cta="Open Availability"
            />
            <ActionCard
              badge="Strategy"
              title="Lineup Builder"
              description="Build your strongest options using actual team context and lineup intelligence."
              href={lineupBuilderHref}
              cta="Open Lineup Builder"
              accent
            />
            <ActionCard
              badge="Comparison"
              title="Scenario Builder"
              description="Review and compare likely opponent and saved lineup scenarios."
              href={scenarioHref}
              cta="Open Scenario Builder"
            />
            <ActionCard
              badge="Team Context"
              title="Open Team Page"
              description="Go deeper into roster usage, match history, and full team detail."
              href={currentTeamHref}
              cta="Open Team Page"
            />
          </div>
        </section>

        <section style={sectionCard}>
          <div style={sectionHead}>
            <div>
              <div style={sectionKicker}>Lineup intelligence preview</div>
              <h2 style={sectionTitle}>Best signals for {selectedTeam || 'your team'}</h2>
              <div style={sectionSub}>A quick preview of the players and pairings you should be thinking about first.</div>
            </div>
          </div>

          {loadingTeam ? (
            <div style={stateBox}>Loading captain insights...</div>
          ) : (
            <div style={insightGridResponsive(isSmallMobile, isTablet)}>
              <div style={insightCard}>
                <div style={insightLabel}>Top singles core</div>
                <div style={insightSub}>Highest singles-ready players using singles dynamic rating plus actual team usage.</div>
                <div style={stackList}>
                  {recommendedSingles.length === 0 ? (
                    <div style={emptyLine}>No singles history yet.</div>
                  ) : (
                    recommendedSingles.map((player, index) => (
                      <div key={player.id} style={listCard}>
                        <div>
                          <div style={listTitle}>#{index + 1} {player.name}</div>
                          <div style={listMeta}>
                            {player.appearances} appearances · {player.wins}-{player.losses} when used
                          </div>
                        </div>
                        <div style={pillStrong}>{formatRating(player.singlesDynamic)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={insightCard}>
                <div style={insightLabel}>Best doubles pairs</div>
                <div style={insightSub}>Pairs ranked by win rate first, then sample size and average doubles dynamic rating.</div>
                <div style={stackList}>
                  {pairings.length === 0 ? (
                    <div style={emptyLine}>No doubles pair history yet.</div>
                  ) : (
                    pairings.slice(0, 3).map((pair, index) => (
                      <div key={pair.key} style={listCard}>
                        <div>
                          <div style={listTitle}>#{index + 1} {pair.names.join(' / ')}</div>
                          <div style={listMeta}>
                            {pair.wins}-{pair.losses} together · {pair.appearances} doubles lines
                          </div>
                        </div>
                        <div>
                          <div style={pillStrong}>{formatRating(pair.avgDoublesRating)}</div>
                          <div style={pillHelper}>{formatPercent(getWinPct(pair.wins, pair.losses))}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
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
              <Link href="/explore" style={footerUtilityLink}>Explore</Link>
              <Link href="/matchup" style={footerUtilityLink}>Matchups</Link>
              <Link href="/leagues" style={footerUtilityLink}>Leagues</Link>
              <Link href="/teams" style={footerUtilityLink}>Teams</Link>
              <Link href="/captain" style={footerUtilityLink}>Captain</Link>
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

function ActionCard({
  badge,
  title,
  description,
  href,
  cta,
  accent = false,
}: {
  badge: string
  title: string
  description: string
  href: string
  cta: string
  accent?: boolean
}) {
  return (
    <article style={{ ...actionCard, ...(accent ? actionCardAccent : {}) }}>
      <div style={actionBar} />
      <div style={actionBody}>
        <span style={badgePill}>{badge}</span>
        <h3 style={actionTitle}>{title}</h3>
        <p style={actionText}>{description}</p>
        <Link href={href} style={accent ? primaryButtonSmall : secondaryButtonSmall}>
          {cta}
        </Link>
      </div>
    </article>
  )
}

function MetricCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ ...metricCard, ...(accent ? metricCardAccent : {}) }}>
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
      <Image
        src="/logo-icon.png"
        alt="TenAceIQ"
        width={iconSize}
        height={iconSize}
        priority
        style={{ width: `${iconSize}px`, height: `${iconSize}px`, display: 'block', objectFit: 'contain' }}
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
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.12fr) minmax(340px, 0.82fr)',
    padding: isMobile ? '26px 18px' : '34px 26px',
    gap: isMobile ? '18px' : '22px',
  }
}

function heroTitleResponsive(isSmallMobile: boolean, isMobile: boolean): CSSProperties {
  return {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '46px' : '58px',
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

function actionGridResponsive(isSmallMobile: boolean, isTablet: boolean): CSSProperties {
  return {
    ...actionGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
  }
}

function insightGridResponsive(isSmallMobile: boolean, isTablet: boolean): CSSProperties {
  return {
    ...insightGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : isTablet ? '1fr' : 'repeat(2, minmax(0, 1fr))',
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

const heroNoise: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at 12% 0%, rgba(116,190,255,0.26), transparent 28%), radial-gradient(circle at 72% 8%, rgba(88,170,255,0.18), transparent 24%), radial-gradient(circle at 100% 0%, rgba(155,225,29,0.10), transparent 26%)',
  pointerEvents: 'none',
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
  maxWidth: '860px',
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
  margin: '8px 0 14px',
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.04,
  fontWeight: 900,
  letterSpacing: '-0.045em',
}

const workflowStack: CSSProperties = {
  display: 'grid',
  gap: '14px',
}

const workflowRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '40px minmax(0, 1fr)',
  gap: '12px',
  alignItems: 'start',
}

const workflowStep: CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '999px',
  display: 'grid',
  placeItems: 'center',
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  color: '#08111d',
  fontWeight: 900,
  fontSize: '15px',
}

const workflowTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '16px',
  fontWeight: 800,
  marginBottom: '4px',
}

const workflowText: CSSProperties = {
  color: 'rgba(224,236,249,0.78)',
  fontSize: '14px',
  lineHeight: 1.6,
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

const metricCardAccent: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(34,64,118,0.78) 0%, rgba(16,33,64,0.9) 100%)',
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

const actionGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const actionCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '24px',
  background: 'linear-gradient(180deg, rgba(26,48,90,0.88) 0%, rgba(15,30,57,0.94) 100%)',
  border: '1px solid rgba(116,190,255,0.16)',
  minHeight: '220px',
  boxShadow: '0 18px 44px rgba(7,18,40,0.18)',
}

const actionCardAccent: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(23,55,78,0.88) 0%, rgba(11,40,38,0.94) 100%)',
  border: '1px solid rgba(155,225,29,0.18)',
}

const actionBar: CSSProperties = {
  height: '4px',
  background: 'linear-gradient(90deg, #74beff 0%, #9be11d 100%)',
}

const actionBody: CSSProperties = {
  padding: '20px',
  display: 'grid',
  gap: '12px',
}

const badgePill: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.08)',
  color: '#e7eefb',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.04em',
  border: '1px solid rgba(255,255,255,0.1)',
}

const actionTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontSize: '24px',
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: '-0.035em',
}

const actionText: CSSProperties = {
  margin: 0,
  color: 'rgba(224,236,249,0.78)',
  fontSize: '14px',
  lineHeight: 1.65,
}

const primaryButtonSmall: CSSProperties = {
  ...primaryButton,
  minHeight: '44px',
  width: 'fit-content',
  fontSize: '13px',
}

const secondaryButtonSmall: CSSProperties = {
  minHeight: '44px',
  width: 'fit-content',
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

const insightGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const insightCard: CSSProperties = {
  borderRadius: '24px',
  padding: '20px',
  background: 'linear-gradient(180deg, rgba(22,46,88,0.74) 0%, rgba(13,27,52,0.84) 100%)',
  border: '1px solid rgba(116,190,255,0.16)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.18)',
}

const insightLabel: CSSProperties = {
  color: '#f8fbff',
  fontSize: '20px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const insightSub: CSSProperties = {
  marginTop: '8px',
  color: 'rgba(224,236,249,0.76)',
  fontSize: '14px',
  lineHeight: 1.6,
}

const stackList: CSSProperties = {
  display: 'grid',
  gap: '12px',
  marginTop: '16px',
}

const listCard: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  alignItems: 'center',
  borderRadius: '18px',
  padding: '14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
}

const listTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '15px',
  fontWeight: 800,
  lineHeight: 1.4,
}

const listMeta: CSSProperties = {
  marginTop: '4px',
  color: 'rgba(224,236,249,0.7)',
  fontSize: '13px',
  lineHeight: 1.55,
}

const pillStrong: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '62px',
  minHeight: '36px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  color: '#08111d',
  fontWeight: 900,
  fontSize: '13px',
}

const pillHelper: CSSProperties = {
  marginTop: '6px',
  color: 'rgba(224,236,249,0.68)',
  fontSize: '12px',
  fontWeight: 700,
  textAlign: 'center',
}

const emptyLine: CSSProperties = {
  color: 'rgba(224,236,249,0.7)',
  fontSize: '14px',
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
