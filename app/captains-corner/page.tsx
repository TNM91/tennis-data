'use client'

export const dynamic = 'force-dynamic'

import Image from 'next/image'
import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  const searchParams = useSearchParams()
  const teamParam = searchParams.get('team') || ''
  const leagueParam = searchParams.get('league') || ''
  const flightParam = searchParams.get('flight') || ''

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
    void loadTeamOptions()
  }, [])

  useEffect(() => {
    if (!selectedTeam) return
    void loadSelectedTeam()
  }, [selectedTeam, selectedLeague, selectedFlight])

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
        .filter((row) => row.match_id == match.id && row.side === side)
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
      .sort((a, b) => ((b.singlesDynamic || 0) + b.appearances * 0.04) - ((a.singlesDynamic || 0) + a.appearances * 0.04))
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
    ? `/captains-corner/lineup-builder?team=${encodeURIComponent(selectedTeam)}&league=${encodeURIComponent(selectedLeague)}&flight=${encodeURIComponent(selectedFlight)}`
    : '/captains-corner/lineup-builder'

  const availabilityHref = selectedTeam
    ? `/captains-corner/lineup-availability?team=${encodeURIComponent(selectedTeam)}&league=${encodeURIComponent(selectedLeague)}&flight=${encodeURIComponent(selectedFlight)}`
    : '/captains-corner/lineup-availability'

  const scenarioHref = selectedTeam
    ? `/captains-corner/scenario-comparison?team=${encodeURIComponent(selectedTeam)}&league=${encodeURIComponent(selectedLeague)}&flight=${encodeURIComponent(selectedFlight)}`
    : '/captains-corner/scenario-comparison'

  return (
    <main style={pageStyle}>
      <div style={orbOne} />
      <div style={orbTwo} />
      <div style={gridGlow} />

      <header style={headerStyle}>
        <div style={headerInnerResponsive(isTablet)}>
          <Link href="/" style={brandWrap} aria-label="TenAceIQ home">
            <BrandWordmark compact={isMobile} top />
          </Link>

          <nav style={navStyleResponsive(isTablet)}>
            {NAV_LINKS.map((link) => {
              const isActive = link.href === '/captains-corner'
              return (
                <Link key={link.href} href={link.href} style={{ ...navLink, ...(isActive ? activeNavLink : {}) }}>
                  {link.label}
                </Link>
              )
            })}
            <Link href="/admin" style={navLink}>Admin</Link>
          </nav>
        </div>
      </header>

      <section style={heroShellResponsive(isTablet, isMobile)}>
        <div>
          <div style={eyebrow}>Premium captain workflow</div>
          <h1 style={heroTitleResponsive(isSmallMobile, isMobile)}>Captain&apos;s Corner</h1>
          <p style={heroText}>
            A strategic command center for captains. Choose your team, review lineup intelligence,
            track availability, build match-day options, && compare scenarios with real team context.
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
              {filteredTeamOptions.map((option) => (
                <option key={`${option.team}__${option.league}__${option.flight}`} value={option.team}>
                  {option.team} · {option.league} · {option.flight}
                </option>
              ))}
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
              ['2', 'Use lineup intelligence', 'Lean on best singles && doubles history before making choices.'],
              ['3', 'Build && compare', 'Open lineup builder, test options, then compare final scenarios.'],
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
              description="Build your strongest options using actual team context && lineup intelligence."
              href={lineupBuilderHref}
              cta="Open Lineup Builder"
              accent
            />
            <ActionCard
              badge="Comparison"
              title="Scenario Comparison"
              description="Review saved lineups side by side before committing to match-day decisions."
              href={scenarioHref}
              cta="Open Scenario Comparison"
            />
            <ActionCard
              badge="Team Context"
              title="Open Team Page"
              description="Go deeper into roster usage, match history, && full team detail."
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
              <div style={sectionSub}>A quick preview of the players && pairings you should be thinking about first.</div>
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
                <div style={insightSub}>Pairs ranked by win rate first, then sample size && average doubles dynamic rating.</div>
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
                        <div style={pillStrong}>{formatRating(pair.avgDoublesRating)}</div>
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
              <Link href="/players" style={footerUtilityLink}>Players</Link>
              <Link href="/rankings" style={footerUtilityLink}>Rankings</Link>
              <Link href="/matchup" style={footerUtilityLink}>Matchup</Link>
              <Link href="/leagues" style={footerUtilityLink}>Leagues</Link>
              <Link href="/teams" style={footerUtilityLink}>Teams</Link>
              <Link href="/captains-corner" style={footerUtilityLink}>Captain&apos;s Corner</Link>
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
  const iconSize = compact ? 30 : top ? 38 : footer ? 36 : 34
  const fontSize = compact ? 24 : top ? 30 : footer ? 27 : 27

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: compact ? '8px' : '10px', lineHeight: 1 }}>
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
    gap: isTablet ? '14px' : '18px',
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
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.12fr) minmax(320px, 0.78fr)',
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
  background:
    'radial-gradient(circle at top, rgba(37,91,227,0.20), transparent 28%), linear-gradient(180deg, #050b17 0%, #071224 44%, #081527 100%)',
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
  alignSelf: 'flex-start',
  minHeight: '38px',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(130, 244, 118, 0.28)',
  background: 'rgba(89, 145, 73, 0.14)',
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
  color: 'rgba(224, 234, 247, 0.84)',
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
  background: 'rgba(10, 20, 37, 0.64)',
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

const heroBadgeRow: CSSProperties = {
  display: 'flex',
  gap: '0.65rem',
  flexWrap: 'wrap',
  marginTop: '0.8rem',
}

const badgeBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '36px',
  padding: '0 14px',
  borderRadius: '999px',
  fontSize: '0.82rem',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '0.02em',
  border: '1px solid transparent',
}

const badgeBlue: CSSProperties = {
  ...badgeBase,
  background: 'rgba(37, 91, 227, 0.16)',
  color: '#c7dbff',
  borderColor: 'rgba(98, 154, 255, 0.18)',
}

const badgeGreen: CSSProperties = {
  ...badgeBase,
  background: 'rgba(96, 221, 116, 0.14)',
  color: '#dffad5',
  borderColor: 'rgba(130, 244, 118, 0.2)',
}

const badgeSlate: CSSProperties = {
  ...badgeBase,
  background: 'rgba(255, 255, 255, 0.08)',
  color: '#e8eef9',
  borderColor: 'rgba(255, 255, 255, 0.1)',
}

const quickStartCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  background: 'linear-gradient(180deg, rgba(37, 56, 84, 0.88), rgba(21, 37, 64, 0.88))',
  padding: '20px',
  minHeight: '100%',
}

const quickStartLabel: CSSProperties = {
  color: 'rgba(217, 231, 255, 0.82)',
  fontSize: '12px',
  lineHeight: 1.5,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const quickStartTitle: CSSProperties = {
  marginTop: '10px',
  marginBottom: '14px',
  fontSize: '1.35rem',
  lineHeight: 1.15,
  color: '#ffffff',
  fontWeight: 900,
}

const workflowStack: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const workflowRow: CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'flex-start',
  padding: '12px 0',
}

const workflowStep: CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '999px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: '.92rem',
  color: '#0f1632',
  background: 'linear-gradient(135deg, #c7ff5e 0%, #7dffb3 100%)',
  flexShrink: 0,
}

const workflowTitle: CSSProperties = {
  fontWeight: 700,
  color: '#ffffff',
  marginBottom: '4px',
}

const workflowText: CSSProperties = {
  color: 'rgba(255,255,255,0.72)',
  lineHeight: 1.55,
  fontSize: '.96rem',
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
  color: '#fee2e2',
  fontWeight: 700,
}

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto',
}

const metricGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  marginBottom: '18px',
}

const metricCard: CSSProperties = {
  borderRadius: '22px',
  padding: '16px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'linear-gradient(180deg, rgba(12, 25, 45, 0.94), rgba(9, 18, 34, 0.96))',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.22)',
  minWidth: 0,
}

const metricCardAccent: CSSProperties = {
  border: '1px solid rgba(111, 236, 168, 0.34)',
}

const metricLabel: CSSProperties = {
  color: 'rgba(224, 234, 247, 0.7)',
  fontSize: '0.82rem',
  marginBottom: '0.42rem',
  fontWeight: 700,
}

const metricValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: 'clamp(1.1rem, 2vw, 1.5rem)',
  lineHeight: 1.15,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const sectionCard: CSSProperties = {
  borderRadius: '30px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'linear-gradient(180deg, rgba(11, 22, 39, 0.92), rgba(9, 18, 34, 0.96))',
  boxShadow: '0 24px 56px rgba(0, 0, 0, 0.24)',
  padding: '22px',
  marginBottom: '18px',
}

const sectionHead: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '1rem',
  flexWrap: 'wrap',
  marginBottom: '1rem',
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
  fontSize: '1.45rem',
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const sectionSub: CSSProperties = {
  marginTop: '0.45rem',
  color: 'rgba(224, 234, 247, 0.72)',
  fontSize: '0.94rem',
  lineHeight: 1.65,
  fontWeight: 500,
}

const actionGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const actionCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '28px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'linear-gradient(180deg, rgba(12, 25, 45, 0.94), rgba(9, 18, 34, 0.96))',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.22)',
}

const actionCardAccent: CSSProperties = {
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.28), rgba(28,49,95,0.46))',
}

const actionBar: CSSProperties = {
  height: '4px',
  width: '100%',
  background: 'linear-gradient(90deg, #255BE3 0%, #61a8ff 55%, #c7ff5e 100%)',
}

const actionBody: CSSProperties = {
  padding: '18px',
}

const badgePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.08)',
  color: '#dfe8f8',
  fontSize: '12px',
  fontWeight: 800,
  marginBottom: '14px',
}

const actionTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontSize: '1.18rem',
  lineHeight: 1.2,
  fontWeight: 900,
}

const actionText: CSSProperties = {
  marginTop: '12px',
  marginBottom: 0,
  color: 'rgba(224, 234, 247, 0.72)',
  lineHeight: 1.7,
  minHeight: '82px',
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 800,
  background: 'linear-gradient(135deg, #67f19a, #28cd6e)',
  color: '#071622',
  border: '1px solid rgba(133, 171, 255, 0.18)',
  boxShadow: '0 16px 32px rgba(26, 74, 196, 0.16)',
}

const ghostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 800,
  background: 'rgba(14, 27, 49, 0.9)',
  color: '#ebf1fd',
  border: '1px solid rgba(255, 255, 255, 0.12)',
}

const primaryButtonSmall: CSSProperties = {
  ...primaryButton,
  minHeight: '44px',
  marginTop: '18px',
}

const secondaryButtonSmall: CSSProperties = {
  ...ghostButton,
  minHeight: '44px',
  marginTop: '18px',
}

const insightGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const insightCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.28), rgba(28,49,95,0.46))',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.22)',
  padding: '18px',
}

const insightLabel: CSSProperties = {
  color: '#f8fbff',
  fontSize: '1.18rem',
  lineHeight: 1.2,
  fontWeight: 900,
}

const insightSub: CSSProperties = {
  marginTop: '0.45rem',
  color: 'rgba(224, 234, 247, 0.72)',
  fontSize: '0.92rem',
  lineHeight: 1.6,
}

const stackList: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  marginTop: '0.9rem',
}

const listCard: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.75rem',
  alignItems: 'center',
  borderRadius: '18px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.05)',
  padding: '0.9rem',
}

const listTitle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '0.98rem',
  lineHeight: 1.3,
}

const listMeta: CSSProperties = {
  marginTop: '0.3rem',
  color: 'rgba(224, 234, 247, 0.72)',
  fontSize: '0.84rem',
  lineHeight: 1.5,
}

const pillStrong: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '4.25rem',
  padding: '0.55rem 0.8rem',
  borderRadius: '999px',
  background: 'rgba(37, 91, 227, 0.16)',
  color: '#d8e7ff',
  fontWeight: 900,
  fontSize: '0.9rem',
}

const emptyLine: CSSProperties = {
  color: '#dfe8f8',
  fontWeight: 600,
  lineHeight: 1.6,
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
