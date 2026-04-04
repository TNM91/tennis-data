'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import SiteShell from '@/app/components/site-shell'
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
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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

export default function CaptainHubPage() {
  const router = useRouter()

  const [role, setRole] = useState<UserRole>('public')
  const [authLoading, setAuthLoading] = useState(true)

  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedLeague, setSelectedLeague] = useState('')
  const [selectedFlight, setSelectedFlight] = useState('')

  const [matches, setMatches] = useState<TeamMatch[]>([])
  const [participants, setParticipants] = useState<MatchPlayer[]>([])

  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setSelectedTeam(params.get('team') || '')
    setSelectedLeague(params.get('league') || '')
    setSelectedFlight(params.get('flight') || '')
  }, [])

  useEffect(() => {
    async function loadAuth() {
      try {
        const { data } = await supabase.auth.getUser()
        const nextRole = getUserRole(data.user?.id ?? null)
        setRole(nextRole)

        if (nextRole === 'public') {
          router.replace('/login')
        }
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

      if (nextRole === 'public') {
        router.replace('/login')
      }
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

  async function loadTeamOptions() {
    setLoadingOptions(true)
    setError('')

    try {
      const { data, error: matchesError } = await supabase
        .from('matches')
        .select('home_team, away_team, league_name, flight, match_date')

      if (matchesError) throw new Error(matchesError.message)

      const map = new Map<string, TeamOption>()

      for (const row of (data || []) as any[]) {
        const league = safeText(row.league_name, 'Unknown League')
        const flight = safeText(row.flight, 'Unknown Flight')

        for (const side of [safeText(row.home_team), safeText(row.away_team)]) {
          if (side === 'Unknown') continue

          const key = `${side}__${league}__${flight}`

          if (!map.has(key)) {
            map.set(key, {
              team: side,
              league,
              flight,
              matches: 0,
            })
          }

          map.get(key)!.matches += 1
        }
      }

      const next = [...map.values()].sort((a, b) => {
        if (b.matches !== a.matches) return b.matches - a.matches
        return a.team.localeCompare(b.team)
      })

      setTeamOptions(next)

      if (!selectedTeam && next.length > 0) {
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

      const matchIds = typedMatches.map((match) => match.id)

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

      const match = matches.find((item) => item.id === row.match_id)
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
              .map((player) => player.doubles_dynamic_rating)
              .filter((value): value is number => typeof value === 'number'),
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
          ((a.singlesDynamic || 0) + a.appearances * 0.04),
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
      <SiteShell active="/captain">
        <section style={loadingWrap}>
          <div style={stateCard}>Loading Captain dashboard...</div>
        </section>
      </SiteShell>
    )
  }

  if (role === 'public') return null

  return (
    <SiteShell active="/captain">
      <div style={pageWrap}>
        <section style={heroCard}>
          <div style={heroLeft}>
            <div style={eyebrow}>Premium captain workflow</div>
            <h1 style={heroTitle}>Captain&apos;s Corner</h1>
            <p style={heroText}>
              A strategic command center for captains. Choose your team, review lineup intelligence,
              track availability, build match-day options, and compare scenarios with real team
              context.
            </p>

            <div style={heroControlRow}>
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
                    <option
                      key={`${option.team}__${option.league}__${option.flight}`}
                      value={option.team}
                    >
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
              <span style={badgeGreen}>
                {quickStats.wins}-{quickStats.losses} record
              </span>
              <span style={badgeSlate}>{quickStats.roster} active players</span>
            </div>
          </div>

          <div style={heroRightCard}>
            <div style={miniKicker}>Captain quick start</div>
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

        <section style={metricGrid}>
          <MetricCard label="Visible team" value={selectedTeam || '—'} />
          <MetricCard label="League" value={selectedLeague || '—'} />
          <MetricCard label="Flight" value={selectedFlight || '—'} />
          <MetricCard label="Latest match" value={formatDate(quickStats.latest)} accent />
        </section>

        <section style={sectionCard}>
          <div style={sectionHead}>
            <div>
              <div style={sectionKicker}>Quick actions</div>
              <h2 style={sectionTitle}>Captain toolkit</h2>
              <div style={sectionSub}>Everything important for match-week prep in one place.</div>
            </div>
          </div>

          <div style={actionGrid}>
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
              <div style={sectionSub}>
                A quick preview of the players and pairings you should be thinking about first.
              </div>
            </div>
          </div>

          {loadingTeam ? (
            <div style={stateCard}>Loading captain insights...</div>
          ) : (
            <div style={insightGrid}>
              <div style={insightCard}>
                <div style={insightLabel}>Top singles core</div>
                <div style={insightSub}>
                  Highest singles-ready players using singles dynamic rating plus actual team usage.
                </div>

                <div style={stackList}>
                  {recommendedSingles.length === 0 ? (
                    <div style={emptyLine}>No singles history yet.</div>
                  ) : (
                    recommendedSingles.map((player, index) => (
                      <div key={player.id} style={listCard}>
                        <div>
                          <div style={listTitle}>
                            #{index + 1} {player.name}
                          </div>
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
                <div style={insightSub}>
                  Pairs ranked by win rate first, then sample size and average doubles dynamic
                  rating.
                </div>

                <div style={stackList}>
                  {pairings.length === 0 ? (
                    <div style={emptyLine}>No doubles pair history yet.</div>
                  ) : (
                    pairings.slice(0, 3).map((pair, index) => (
                      <div key={pair.key} style={listCard}>
                        <div>
                          <div style={listTitle}>
                            #{index + 1} {pair.names.join(' / ')}
                          </div>
                          <div style={listMeta}>
                            {pair.wins}-{pair.losses} together · {pair.appearances} doubles lines
                          </div>
                        </div>

                        <div style={pairMetricWrap}>
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

        <section style={sectionCard}>
          <div style={sectionHead}>
            <div>
              <div style={sectionKicker}>Team snapshot</div>
              <h2 style={sectionTitle}>Roster and match mix</h2>
              <div style={sectionSub}>
                Fast context for how this team has been used across singles and doubles.
              </div>
            </div>
          </div>

          <div style={summaryGrid}>
            <MiniStat label="Roster size" value={String(quickStats.roster)} />
            <MiniStat label="Total matches" value={String(quickStats.matches)} />
            <MiniStat label="Singles lines" value={String(quickStats.singles)} />
            <MiniStat label="Doubles lines" value={String(quickStats.doubles)} />
          </div>

          <div style={rosterTableWrap}>
            {roster.length === 0 ? (
              <div style={emptyLine}>No roster history found for this team selection.</div>
            ) : (
              <div style={rosterList}>
                {roster.slice(0, 8).map((player) => (
                  <div key={player.id} style={rosterRow}>
                    <div>
                      <div style={rosterName}>{player.name}</div>
                      <div style={rosterMeta}>
                        {player.appearances} appearances · {player.wins}-{player.losses} record
                      </div>
                    </div>

                    <div style={rosterRatingRow}>
                      <span style={subtlePill}>Singles {formatRating(player.singlesDynamic)}</span>
                      <span style={subtlePill}>Doubles {formatRating(player.doublesDynamic)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </SiteShell>
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
    <article style={{ ...actionCard, ...(accent ? actionCardAccent : null) }}>
      <div style={actionGlow} />
      <span style={badgePill}>{badge}</span>
      <h3 style={actionTitle}>{title}</h3>
      <p style={actionText}>{description}</p>
      <Link href={href} style={accent ? primaryButtonSmall : secondaryButtonSmall}>
        {cta}
      </Link>
    </article>
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
    <div style={{ ...metricCard, ...(accent ? metricCardAccent : null) }}>
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
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

const pageWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - 48px))',
  margin: '0 auto',
  display: 'grid',
  gap: 24,
  padding: '32px 0 72px',
}

const loadingWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - 48px))',
  margin: '0 auto',
  display: 'grid',
  gap: 20,
  padding: '32px 0 72px',
}

const heroCard: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)',
  gap: 22,
  padding: 24,
  borderRadius: 32,
  border: '1px solid rgba(116,190,255,0.18)',
  background:
    'linear-gradient(180deg, rgba(12,24,48,0.88) 0%, rgba(15,39,71,0.82) 100%)',
  boxShadow:
    '0 24px 70px rgba(2,6,23,0.22), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const heroLeft: CSSProperties = {
  display: 'grid',
  gap: 16,
  alignContent: 'start',
}

const heroRightCard: CSSProperties = {
  display: 'grid',
  gap: 16,
  alignContent: 'start',
  padding: 20,
  borderRadius: 24,
  border: '1px solid rgba(116,190,255,0.14)',
  background:
    'linear-gradient(180deg, rgba(18,36,66,0.68) 0%, rgba(17,34,61,0.54) 100%)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.2)',
  background: 'rgba(255,255,255,0.06)',
  color: '#dbeafe',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const heroTitle: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(2.2rem, 4vw, 4rem)',
  lineHeight: 0.98,
  letterSpacing: '-0.05em',
  color: '#f8fbff',
}

const heroText: CSSProperties = {
  margin: 0,
  maxWidth: 760,
  fontSize: 16,
  lineHeight: 1.7,
  color: 'rgba(229,238,251,0.84)',
}

const heroControlRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
}

const selectStyle: CSSProperties = {
  minWidth: 280,
  flex: '1 1 320px',
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'linear-gradient(180deg, rgba(10,24,47,0.94) 0%, rgba(8,19,38,0.98) 100%)',
  color: '#e5eefc',
  padding: '13px 14px',
  outline: 'none',
  fontSize: 14,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '13px 16px',
  borderRadius: 16,
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: 14,
  color: '#04121a',
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  boxShadow: '0 16px 30px rgba(74,222,128,0.18)',
}

const primaryButtonSmall: CSSProperties = {
  ...primaryButton,
  padding: '11px 14px',
  fontSize: 13,
}

const secondaryButtonSmall: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '11px 14px',
  borderRadius: 14,
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: 13,
  color: '#dbeafe',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(255,255,255,0.06)',
}

const heroBadgeRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const badgeBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: '0.03em',
}

const badgeBlue: CSSProperties = {
  ...badgeBase,
  color: '#dbeafe',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(40,88,164,0.24)',
}

const badgeGreen: CSSProperties = {
  ...badgeBase,
  color: '#dcfce7',
  border: '1px solid rgba(74,222,128,0.2)',
  background: 'rgba(17, 39, 27, 0.88)',
}

const badgeSlate: CSSProperties = {
  ...badgeBase,
  color: '#e2e8f0',
  border: '1px solid rgba(148,163,184,0.18)',
  background: 'rgba(15, 23, 42, 0.78)',
}

const miniKicker: CSSProperties = {
  fontSize: 12,
  color: 'rgba(197,213,234,0.86)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 800,
}

const quickStartTitle: CSSProperties = {
  margin: 0,
  fontSize: 24,
  lineHeight: 1.1,
  letterSpacing: '-0.04em',
  color: '#f8fbff',
}

const workflowStack: CSSProperties = {
  display: 'grid',
  gap: 14,
}

const workflowRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '42px minmax(0, 1fr)',
  gap: 12,
  alignItems: 'start',
}

const workflowStep: CSSProperties = {
  width: 42,
  height: 42,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 14,
  fontWeight: 900,
  color: '#031018',
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
}

const workflowTitle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 800,
  fontSize: 15,
  marginBottom: 4,
}

const workflowText: CSSProperties = {
  color: 'rgba(229,238,251,0.78)',
  fontSize: 14,
  lineHeight: 1.6,
}

const errorCard: CSSProperties = {
  padding: 16,
  borderRadius: 20,
  border: '1px solid rgba(248,113,113,0.22)',
  background: 'rgba(60,16,24,0.76)',
  color: '#fecaca',
  fontWeight: 700,
}

const stateCard: CSSProperties = {
  padding: 18,
  borderRadius: 22,
  border: '1px solid rgba(116,190,255,0.14)',
  background:
    'linear-gradient(180deg, rgba(14,30,58,0.82) 0%, rgba(16,38,70,0.78) 100%)',
  color: '#dbeafe',
  fontWeight: 700,
}

const metricGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 16,
}

const metricCard: CSSProperties = {
  padding: 18,
  borderRadius: 22,
  border: '1px solid rgba(116,190,255,0.14)',
  background:
    'linear-gradient(180deg, rgba(14,30,58,0.82) 0%, rgba(16,38,70,0.78) 100%)',
  boxShadow: '0 10px 30px rgba(2,10,24,0.14)',
}

const metricCardAccent: CSSProperties = {
  border: '1px solid rgba(74,222,128,0.18)',
  boxShadow: '0 10px 24px rgba(74,222,128,0.08)',
}

const metricLabel: CSSProperties = {
  fontSize: 12,
  color: 'rgba(197,213,234,0.86)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 800,
}

const metricValue: CSSProperties = {
  marginTop: 10,
  color: '#f8fbff',
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1.05,
  letterSpacing: '-0.04em',
}

const sectionCard: CSSProperties = {
  display: 'grid',
  gap: 18,
  padding: 22,
  borderRadius: 28,
  border: '1px solid rgba(116,190,255,0.14)',
  background:
    'linear-gradient(180deg, rgba(14,30,58,0.82) 0%, rgba(16,38,70,0.78) 100%)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16)',
}

const sectionHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'start',
  gap: 16,
  flexWrap: 'wrap',
}

const sectionKicker: CSSProperties = {
  fontSize: 12,
  color: 'rgba(197,213,234,0.86)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 800,
}

const sectionTitle: CSSProperties = {
  margin: '6px 0 0',
  color: '#f8fbff',
  fontSize: 28,
  lineHeight: 1.06,
  letterSpacing: '-0.04em',
}

const sectionSub: CSSProperties = {
  marginTop: 8,
  color: 'rgba(229,238,251,0.78)',
  fontSize: 14,
  lineHeight: 1.7,
}

const actionGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
}

const actionCard: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  gap: 12,
  padding: 18,
  borderRadius: 22,
  border: '1px solid rgba(116,190,255,0.14)',
  background:
    'linear-gradient(180deg, rgba(18,36,66,0.68) 0%, rgba(17,34,61,0.54) 100%)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}

const actionCardAccent: CSSProperties = {
  border: '1px solid rgba(74,222,128,0.18)',
  boxShadow: '0 14px 34px rgba(74,222,128,0.08)',
}

const actionGlow: CSSProperties = {
  position: 'absolute',
  inset: 'auto -10% -40% auto',
  width: 180,
  height: 180,
  borderRadius: 999,
  background: 'radial-gradient(circle, rgba(74,163,255,0.14), transparent 70%)',
  pointerEvents: 'none',
}

const badgePill: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'inline-flex',
  width: 'fit-content',
  padding: '7px 11px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  color: '#dbeafe',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(255,255,255,0.06)',
}

const actionTitle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  margin: 0,
  color: '#f8fbff',
  fontSize: 20,
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const actionText: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  margin: 0,
  color: 'rgba(229,238,251,0.76)',
  fontSize: 14,
  lineHeight: 1.7,
}

const insightGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 18,
}

const insightCard: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 18,
  borderRadius: 22,
  border: '1px solid rgba(116,190,255,0.12)',
  background:
    'linear-gradient(180deg, rgba(18,36,66,0.68) 0%, rgba(17,34,61,0.54) 100%)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}

const insightLabel: CSSProperties = {
  color: '#f8fbff',
  fontSize: 18,
  fontWeight: 800,
}

const insightSub: CSSProperties = {
  color: 'rgba(229,238,251,0.74)',
  fontSize: 13,
  lineHeight: 1.65,
}

const stackList: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const listCard: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
}

const listTitle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 800,
  fontSize: 15,
}

const listMeta: CSSProperties = {
  marginTop: 4,
  color: 'rgba(197,213,234,0.86)',
  fontSize: 13,
  lineHeight: 1.5,
}

const pillStrong: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 62,
  padding: '8px 12px',
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 13,
  color: '#04121a',
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
}

const pillHelper: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  textAlign: 'center',
  color: 'rgba(229,238,251,0.78)',
  fontWeight: 700,
}

const pairMetricWrap: CSSProperties = {
  display: 'grid',
  justifyItems: 'end',
}

const emptyLine: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  color: 'rgba(197,213,234,0.9)',
  border: '1px dashed rgba(116,190,255,0.18)',
  background: 'rgba(255,255,255,0.04)',
}

const summaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 14,
}

const miniStatCard: CSSProperties = {
  padding: 16,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.05)',
}

const miniStatLabel: CSSProperties = {
  fontSize: 12,
  color: 'rgba(197,213,234,0.86)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 800,
}

const miniStatValue: CSSProperties = {
  marginTop: 8,
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: 22,
  letterSpacing: '-0.03em',
}

const rosterTableWrap: CSSProperties = {
  display: 'grid',
}

const rosterList: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const rosterRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
}

const rosterName: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 800,
  fontSize: 15,
}

const rosterMeta: CSSProperties = {
  marginTop: 4,
  color: 'rgba(197,213,234,0.86)',
  fontSize: 13,
}

const rosterRatingRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const subtlePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 10px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.14)',
  color: '#dbeafe',
  background: 'rgba(255,255,255,0.06)',
  fontWeight: 700,
  fontSize: 12,
}