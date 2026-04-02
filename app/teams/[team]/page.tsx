'use client'

export const dynamic = 'force-dynamic'

import Image from 'next/image'
import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type TeamMatchRow = {
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

type PlayerRelation =
  | {
      id: string
      name: string
      flight: string | null
      overall_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
    }
  | {
      id: string
      name: string
      flight: string | null
      overall_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
    }[]
  | null

type MatchPlayerRow = {
  match_id: string
  side: 'A' | 'B'
  seat: number | null
  player_id: string
  players: PlayerRelation
}

type TeamPlayerSummary = {
  id: string
  name: string
  appearances: number
  singlesAppearances: number
  doublesAppearances: number
  wins: number
  losses: number
  overallDynamic: number | null
  singlesDynamic: number | null
  doublesDynamic: number | null
}

type PairingSummary = {
  key: string
  playerIds: string[]
  names: string[]
  appearances: number
  wins: number
  losses: number
  avgDoublesRating: number | null
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

function formatRating(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value.toFixed(2)
}

function normalizePlayerRelation(player: PlayerRelation) {
  if (!player) return null
  return Array.isArray(player) ? player[0] ?? null : player
}

function average(values: number[]) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getWinPctFromRecord(wins: number, losses: number) {
  const total = wins + losses
  if (!total) return 0
  return wins / total
}

function buildMatchupHref(team: string, league: string, flight: string) {
  const params = new URLSearchParams({
    team,
    league,
    flight,
  })

  return `/matchup?${params.toString()}`
}

export default function TeamDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()

  const teamFromRoute = decodeURIComponent(String(params.team || ''))
  const league = searchParams.get('league') || ''
  const flight = searchParams.get('flight') || ''

  const [matches, setMatches] = useState<TeamMatchRow[]>([])
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayerRow[]>([])
  const [loading, setLoading] = useState(true)
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
    void loadTeamPage()
  }, [teamFromRoute, league, flight])

  async function loadTeamPage() {
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
        .or(`home_team.eq.${teamFromRoute},away_team.eq.${teamFromRoute}`)
        .order('match_date', { ascending: false })

      if (league) query = query.eq('league_name', league)
      if (flight) query = query.eq('flight', flight)

      const { data: matchData, error: matchError } = await query
      if (matchError) throw new Error(matchError.message)

      const typedMatches = (matchData || []) as TeamMatchRow[]
      setMatches(typedMatches)

      const matchIds = typedMatches.map((match) => match.id)
      if (matchIds.length === 0) {
        setMatchPlayers([])
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
            flight,
            overall_dynamic_rating,
            singles_dynamic_rating,
            doubles_dynamic_rating
          )
        `)
        .in('match_id', matchIds)

      if (participantError) throw new Error(participantError.message)

      const normalizedParticipants: MatchPlayerRow[] = ((participantData || []) as MatchPlayerRow[]).map(
        (row) => ({
          ...row,
          players: normalizePlayerRelation(row.players),
        })
      )

      setMatchPlayers(normalizedParticipants)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team page.')
    } finally {
      setLoading(false)
    }
  }

  const teamInfo = useMemo(() => {
    if (!matches.length) {
      return {
        teamName: teamFromRoute || 'Unknown Team',
        leagueName: league || 'Unknown League',
        flightName: flight || 'Unknown Flight',
        section: 'Unknown',
        district: 'Unknown',
      }
    }

    const first = matches[0]
    return {
      teamName: teamFromRoute || 'Unknown Team',
      leagueName: safeText(first.league_name, league || 'Unknown League'),
      flightName: safeText(first.flight, flight || 'Unknown Flight'),
      section: safeText(first.usta_section),
      district: safeText(first.district_area),
    }
  }, [matches, teamFromRoute, league, flight])

  const teamSideByMatchId = useMemo(() => {
    const map = new Map<string, 'A' | 'B'>()

    for (const match of matches) {
      const home = safeText(match.home_team)
      const away = safeText(match.away_team)

      if (home === teamFromRoute) map.set(match.id, 'A')
      if (away === teamFromRoute) map.set(match.id, 'B')
    }

    return map
  }, [matches, teamFromRoute])

  const roster = useMemo<TeamPlayerSummary[]>(() => {
    const map = new Map<string, TeamPlayerSummary>()

    for (const participant of matchPlayers) {
      const teamSide = teamSideByMatchId.get(participant.match_id)
      if (!teamSide || participant.side !== teamSide) continue

      const player = normalizePlayerRelation(participant.players)
      if (!player) continue

      const match = matches.find((m) => m.id === participant.match_id)
      if (!match) continue

      if (!map.has(player.id)) {
        map.set(player.id, {
          id: player.id,
          name: player.name,
          appearances: 0,
          singlesAppearances: 0,
          doublesAppearances: 0,
          wins: 0,
          losses: 0,
          overallDynamic: player.overall_dynamic_rating,
          singlesDynamic: player.singles_dynamic_rating,
          doublesDynamic: player.doubles_dynamic_rating,
        })
      }

      const summary = map.get(player.id)!
      summary.appearances += 1
      if (match.match_type === 'singles') summary.singlesAppearances += 1
      if (match.match_type === 'doubles') summary.doublesAppearances += 1

      const won = match.winner_side === teamSide
      if (won) summary.wins += 1
      else summary.losses += 1
    }

    return [...map.values()].sort((a, b) => {
      if (b.appearances !== a.appearances) return b.appearances - a.appearances
      return a.name.localeCompare(b.name)
    })
  }, [matchPlayers, matches, teamSideByMatchId])

  const pairings = useMemo<PairingSummary[]>(() => {
    const map = new Map<string, PairingSummary>()

    for (const match of matches) {
      if (match.match_type !== 'doubles') continue

      const teamSide = teamSideByMatchId.get(match.id)
      if (!teamSide) continue

      const teamParticipants = matchPlayers
        .filter((participant) => participant.match_id === match.id && participant.side === teamSide)
        .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))

      if (teamParticipants.length < 2) continue

      const normalizedPlayers = teamParticipants
        .map((participant) => normalizePlayerRelation(participant.players))
        .filter(Boolean) as NonNullable<ReturnType<typeof normalizePlayerRelation>>[]

      if (normalizedPlayers.length < 2) continue

      const pairPlayers = normalizedPlayers.slice(0, 2).sort((a, b) => a.name.localeCompare(b.name))
      const key = `${pairPlayers[0].id}__${pairPlayers[1].id}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          playerIds: [pairPlayers[0].id, pairPlayers[1].id],
          names: [pairPlayers[0].name, pairPlayers[1].name],
          appearances: 0,
          wins: 0,
          losses: 0,
          avgDoublesRating: average(
            pairPlayers
              .map((player) => player.doubles_dynamic_rating)
              .filter((value): value is number => typeof value === 'number')
          ),
          latestMatch: null,
        })
      }

      const summary = map.get(key)!
      summary.appearances += 1

      const won = match.winner_side === teamSide
      if (won) summary.wins += 1
      else summary.losses += 1

      if (
        !summary.latestMatch ||
        new Date(match.match_date).getTime() > new Date(summary.latestMatch).getTime()
      ) {
        summary.latestMatch = match.match_date
      }
    }

    return [...map.values()].sort((a, b) => {
      const winPctDiff = getWinPctFromRecord(b.wins, b.losses) - getWinPctFromRecord(a.wins, a.losses)
      if (Math.abs(winPctDiff) > 0.0001) return winPctDiff
      if (b.appearances !== a.appearances) return b.appearances - a.appearances
      return a.names.join(' / ').localeCompare(b.names.join(' / '))
    })
  }, [matches, matchPlayers, teamSideByMatchId])

  const recommendedSingles = useMemo(() => {
    return [...roster]
      .sort((a, b) => {
        const aScore = (a.singlesDynamic || 0) + a.singlesAppearances * 0.04
        const bScore = (b.singlesDynamic || 0) + b.singlesAppearances * 0.04
        return bScore - aScore
      })
      .slice(0, 4)
  }, [roster])

  const recommendedPairs = useMemo(() => pairings.slice(0, 3), [pairings])

  const stats = useMemo(() => {
    let wins = 0
    let losses = 0
    let homeMatches = 0
    let awayMatches = 0
    let singles = 0
    let doubles = 0

    for (const match of matches) {
      const side = teamSideByMatchId.get(match.id)
      if (!side) continue
      if (side === 'A') homeMatches += 1
      if (side === 'B') awayMatches += 1
      if (match.match_type === 'singles') singles += 1
      if (match.match_type === 'doubles') doubles += 1
      if (match.winner_side === side) wins += 1
      else losses += 1
    }

    return {
      totalMatches: matches.length,
      wins,
      losses,
      homeMatches,
      awayMatches,
      singles,
      doubles,
      latest: matches[0]?.match_date || null,
    }
  }, [matches, teamSideByMatchId])

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

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.15fr) minmax(320px, 0.75fr)',
    padding: isMobile ? '26px 18px' : '34px 26px',
    gap: isMobile ? '18px' : '22px',
  }

  const dynamicMetricGrid: CSSProperties = {
    ...metricGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(7, minmax(0, 1fr))',
  }

  const dynamicRosterGrid: CSSProperties = {
    ...rosterGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
  }

  const dynamicInsightGrid: CSSProperties = {
    ...insightGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : isTablet ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }

  const dynamicMiniGrid: CSSProperties = {
    ...miniGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
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
                  style={{ ...navLink, ...(isActive ? activeNavLink : {}) }}
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
        <div style={heroCopy}>
          <div style={eyebrow}>Team page</div>
          <h1 style={heroTitle}>{teamInfo.teamName}</h1>
          <p style={heroText}>
            {teamInfo.leagueName} · {teamInfo.flightName} · {teamInfo.section} · {teamInfo.district}
          </p>

          <div style={heroBadgeRow}>
            <span style={badgeBlue}>{stats.totalMatches} matches</span>
            <span style={badgeGreen}>{stats.wins}-{stats.losses} record</span>
            <span style={badgeSlate}>{roster.length} players used</span>
          </div>
        </div>

        <div style={actionsCard}>
          <div style={actionsTitle}>Team tools</div>
          <p style={actionsText}>
            Jump back to league context, compare future matchups, and use lineup intelligence built from actual team usage.
          </p>
          <div style={actionsButtons}>
            <Link href="/leagues" style={ghostButton}>Back to Leagues</Link>
            <Link
              href={buildMatchupHref(teamInfo.teamName, teamInfo.leagueName, teamInfo.flightName)}
              style={primaryButton}
            >
              Future Lineup Projection
            </Link>
          </div>
        </div>
      </section>

      <section style={dynamicMetricGrid}>
        <StatCard label="Matches" value={String(stats.totalMatches)} />
        <StatCard label="Record" value={`${stats.wins}-${stats.losses}`} />
        <StatCard label="Home" value={String(stats.homeMatches)} />
        <StatCard label="Away" value={String(stats.awayMatches)} />
        <StatCard label="Singles" value={String(stats.singles)} />
        <StatCard label="Doubles" value={String(stats.doubles)} />
        <StatCard label="Latest Match" value={formatDate(stats.latest)} />
      </section>

      <section style={mainCard}>
        {loading ? (
          <div style={stateBox}>Loading team data...</div>
        ) : error ? (
          <div style={errorBox}>{error}</div>
        ) : matches.length === 0 ? (
          <div style={stateBox}>No matches found for this team.</div>
        ) : (
          <>
            <section style={sectionBlock}>
              <div style={sectionHead}>
                <div>
                  <div style={sectionKicker}>Lineup intelligence</div>
                  <h2 style={sectionTitle}>Best lineup and pairing signals</h2>
                  <div style={sectionSub}>
                    Built from the team’s actual usage history and current dynamic ratings.
                  </div>
                </div>
              </div>

              <div style={dynamicInsightGrid}>
                <div style={insightCard}>
                  <div style={insightLabel}>Recommended singles core</div>
                  <div style={insightSub}>
                    Highest singles-ready players based on singles dynamic rating and actual singles usage.
                  </div>
                  <div style={stackList}>
                    {recommendedSingles.length === 0 ? (
                      <div style={emptyLine}>No singles history yet.</div>
                    ) : (
                      recommendedSingles.map((player, index) => (
                        <div key={player.id} style={listCard}>
                          <div>
                            <div style={listTitle}>#{index + 1} {player.name}</div>
                            <div style={listMeta}>
                              {player.singlesAppearances} singles appearances · {player.wins}-{player.losses} record
                            </div>
                          </div>
                          <div style={pillStrong}>{formatRating(player.singlesDynamic)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div style={insightCard}>
                  <div style={insightLabel}>Best doubles pairings</div>
                  <div style={insightSub}>
                    Top-performing pairs based on win rate first, then sample size and doubles strength.
                  </div>
                  <div style={stackList}>
                    {recommendedPairs.length === 0 ? (
                      <div style={emptyLine}>No doubles pair history yet.</div>
                    ) : (
                      recommendedPairs.map((pair, index) => (
                        <div key={pair.key} style={listCard}>
                          <div>
                            <div style={listTitle}>#{index + 1} {pair.names.join(' / ')}</div>
                            <div style={listMeta}>
                              {pair.wins}-{pair.losses} together · {pair.appearances} doubles matches
                            </div>
                          </div>
                          <div style={pillStrong}>{formatRating(pair.avgDoublesRating)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section style={sectionBlock}>
              <div style={sectionHead}>
                <div>
                  <div style={sectionKicker}>Roster usage</div>
                  <h2 style={sectionTitle}>Players used by this team</h2>
                  <div style={sectionSub}>
                    Players who have appeared for this team in imported scorecards.
                  </div>
                </div>
              </div>

              <div style={dynamicRosterGrid}>
                {roster.map((player) => (
                  <div key={player.id} style={playerCard}>
                    <div style={playerTop}>
                      <div>
                        <div style={playerName}>{player.name}</div>
                        <div style={playerMeta}>
                          {player.wins}-{player.losses} when appearing
                        </div>
                      </div>

                      <Link href={`/players/${player.id}`} style={playerLink}>
                        Player Page
                      </Link>
                    </div>

                    <div style={dynamicMiniGrid}>
                      <MiniStat label="Appearances" value={String(player.appearances)} />
                      <MiniStat label="Singles" value={String(player.singlesAppearances)} />
                      <MiniStat label="Doubles" value={String(player.doublesAppearances)} />
                      <MiniStat label="Overall" value={formatRating(player.overallDynamic)} />
                      <MiniStat label="Singles DR" value={formatRating(player.singlesDynamic)} />
                      <MiniStat label="Doubles DR" value={formatRating(player.doublesDynamic)} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section style={sectionBlock}>
              <div style={sectionHead}>
                <div>
                  <div style={sectionKicker}>Season matches</div>
                  <h2 style={sectionTitle}>Team match history</h2>
                  <div style={sectionSub}>
                    Team match history inside the selected league and flight.
                  </div>
                </div>
              </div>

              <div style={matchList}>
                {matches.map((match) => {
                  const home = safeText(match.home_team)
                  const away = safeText(match.away_team)
                  const side = teamSideByMatchId.get(match.id)
                  const won = side ? match.winner_side === side : false
                  const opponent = side === 'A' ? away : home

                  return (
                    <div key={match.id} style={matchCard}>
                      <div style={matchTop}>
                        <div>
                          <div style={matchTitle}>{home} vs {away}</div>
                          <div style={matchMeta}>
                            {formatDate(match.match_date)} · {match.match_type}
                          </div>
                        </div>

                        <div style={{ ...resultBadge, ...(won ? resultWin : resultLoss) }}>
                          {won ? 'Win' : 'Loss'}
                        </div>
                      </div>

                      <div style={matchBottom}>
                        <div style={scoreText}>{match.score || 'No score entered'}</div>
                        <div style={matchSubmeta}>
                          Opponent: <strong>{opponent}</strong>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCard}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniStatCard}>
      <div style={miniStatLabel}>{label}</div>
      <div style={miniStatValue}>{value}</div>
    </div>
  )
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

const heroCopy: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '0.85rem',
  minWidth: 0,
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
  margin: 0,
  color: '#ffffff',
  fontSize: 'clamp(2.35rem, 4vw, 4rem)',
  lineHeight: 0.98,
  letterSpacing: '-0.055em',
  fontWeight: 900,
}

const heroText: CSSProperties = {
  margin: 0,
  color: 'rgba(224, 234, 247, 0.84)',
  fontSize: '1rem',
  lineHeight: 1.75,
  fontWeight: 500,
  maxWidth: '900px',
}

const heroBadgeRow: CSSProperties = {
  display: 'flex',
  gap: '0.65rem',
  flexWrap: 'wrap',
  marginTop: '0.25rem',
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

const actionsCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  background: 'linear-gradient(180deg, rgba(37, 56, 84, 0.88), rgba(21, 37, 64, 0.88))',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '1rem',
  minHeight: '100%',
}

const actionsTitle: CSSProperties = {
  color: '#ffffff',
  fontSize: '1rem',
  fontWeight: 900,
  letterSpacing: '-0.02em',
}

const actionsText: CSSProperties = {
  margin: 0,
  color: 'rgba(224, 234, 247, 0.76)',
  lineHeight: 1.65,
  fontSize: '0.94rem',
}

const actionsButtons: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
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

const metricGrid: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto 18px',
  display: 'grid',
  gap: '14px',
}

const statCard: CSSProperties = {
  borderRadius: '22px',
  padding: '16px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'linear-gradient(180deg, rgba(12, 25, 45, 0.94), rgba(9, 18, 34, 0.96))',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.22)',
  minWidth: 0,
}

const statLabel: CSSProperties = {
  color: 'rgba(224, 234, 247, 0.7)',
  fontSize: '0.82rem',
  marginBottom: '0.42rem',
  fontWeight: 700,
}

const statValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: 'clamp(1.4rem, 2vw, 1.85rem)',
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const mainCard: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto',
  minWidth: 0,
  padding: '22px',
  borderRadius: '30px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'linear-gradient(180deg, rgba(11, 22, 39, 0.92), rgba(9, 18, 34, 0.96))',
  boxShadow: '0 24px 56px rgba(0, 0, 0, 0.24)',
}

const sectionBlock: CSSProperties = {
  marginBottom: '1.5rem',
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

const stateBox: CSSProperties = {
  borderRadius: '1rem',
  padding: '1rem 1.05rem',
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px dashed rgba(255, 255, 255, 0.18)',
  color: '#dfe8f8',
  fontSize: '0.96rem',
  lineHeight: 1.6,
  fontWeight: 600,
}

const errorBox: CSSProperties = {
  borderRadius: '1rem',
  padding: '1rem 1.05rem',
  background: 'rgba(239, 68, 68, 0.12)',
  border: '1px solid rgba(239, 68, 68, 0.2)',
  color: '#fee2e2',
  fontSize: '0.96rem',
  lineHeight: 1.6,
  fontWeight: 700,
}

const insightGrid: CSSProperties = {
  display: 'grid',
  gap: '1rem',
}

const insightCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.28), rgba(28,49,95,0.46))',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.22)',
  padding: '1rem',
}

const insightLabel: CSSProperties = {
  color: '#f8fbff',
  fontSize: '1.18rem',
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: '-0.02em',
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

const rosterGrid: CSSProperties = {
  display: 'grid',
  gap: '1rem',
}

const playerCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.28), rgba(28,49,95,0.46))',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.22)',
  padding: '1rem',
}

const playerTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '0.75rem',
  marginBottom: '0.9rem',
}

const playerName: CSSProperties = {
  color: '#f8fbff',
  fontSize: '1.3rem',
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: '-0.02em',
}

const playerMeta: CSSProperties = {
  color: '#8fb7ff',
  fontSize: '0.9rem',
  lineHeight: 1.5,
  fontWeight: 700,
  marginTop: '0.35rem',
}

const playerLink: CSSProperties = {
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

const miniGrid: CSSProperties = {
  display: 'grid',
  gap: '0.7rem',
}

const miniStatCard: CSSProperties = {
  padding: '0.85rem 0.9rem',
  minWidth: 0,
  borderRadius: '18px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'rgba(255, 255, 255, 0.05)',
}

const miniStatLabel: CSSProperties = {
  color: 'rgba(224, 234, 247, 0.68)',
  fontSize: '0.76rem',
  marginBottom: '0.28rem',
  fontWeight: 700,
}

const miniStatValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '0.98rem',
  lineHeight: 1.2,
  fontWeight: 800,
}

const matchList: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
}

const matchCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.28), rgba(28,49,95,0.46))',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.22)',
  padding: '1rem',
}

const matchTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '0.75rem',
  flexWrap: 'wrap',
}

const matchTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '1.12rem',
  lineHeight: 1.25,
  fontWeight: 900,
  letterSpacing: '-0.02em',
}

const matchMeta: CSSProperties = {
  marginTop: '0.35rem',
  color: 'rgba(224, 234, 247, 0.72)',
  fontSize: '0.92rem',
  lineHeight: 1.5,
  fontWeight: 500,
  textTransform: 'capitalize',
}

const resultBadge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '4rem',
  padding: '0.48rem 0.7rem',
  borderRadius: '999px',
  fontSize: '0.78rem',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  border: '1px solid transparent',
}

const resultWin: CSSProperties = {
  background: 'rgba(34, 197, 94, 0.14)',
  color: '#dcfce7',
  borderColor: 'rgba(74, 222, 128, 0.18)',
}

const resultLoss: CSSProperties = {
  background: 'rgba(239, 68, 68, 0.14)',
  color: '#fee2e2',
  borderColor: 'rgba(248, 113, 113, 0.18)',
}

const matchBottom: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.75rem',
  flexWrap: 'wrap',
  marginTop: '0.9rem',
  paddingTop: '0.9rem',
  borderTop: '1px solid rgba(148, 163, 184, 0.18)',
}

const scoreText: CSSProperties = {
  color: '#b8d0ff',
  fontSize: '1rem',
  lineHeight: 1.2,
  fontWeight: 900,
}

const matchSubmeta: CSSProperties = {
  color: 'rgba(224, 234, 247, 0.72)',
  fontSize: '0.92rem',
  lineHeight: 1.5,
  fontWeight: 500,
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
