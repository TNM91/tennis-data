'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
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

function buildMatchupHref(team: string, league: string, flight: string) {
  const params = new URLSearchParams({
    team,
    league,
    flight,
  })

  return `/matchup?${params.toString()}`
}

function normalizePlayerRelation(player: PlayerRelation) {
  if (!player) return null
  return Array.isArray(player) ? player[0] ?? null : player
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
      if (!teamSide) continue
      if (participant.side !== teamSide) continue

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

  return (
    <main className="page-shell-tight team-page">
      <div className="team-top-links">
        <Link href="/" className="button-ghost">Home</Link>
        <Link href="/rankings" className="button-ghost">Rankings</Link>
        <Link href="/matchup" className="button-ghost">Matchup</Link>
        <Link href="/leagues" className="button-ghost">Leagues</Link>
        <Link href="/admin" className="button-ghost">Admin</Link>
      </div>

      <section className="hero-panel team-hero-panel">
        <div className="hero-inner team-hero-inner">
          <div className="team-hero-copy">
            <div className="section-kicker team-kicker">Team Page</div>
            <h1 className="team-title">{teamInfo.teamName}</h1>
            <p className="team-meta">
              {teamInfo.leagueName} · {teamInfo.flightName} · {teamInfo.section} · {teamInfo.district}
            </p>

            <div className="team-hero-badges">
              <span className="badge badge-blue">{stats.totalMatches} matches</span>
              <span className="badge badge-green">{stats.wins}-{stats.losses} record</span>
              <span className="badge badge-slate">{roster.length} players used</span>
            </div>
          </div>

          <div className="glass-card panel-pad team-hero-actions-card">
            <div className="team-actions-title">Team tools</div>
            <div className="team-actions-buttons">
              <Link href="/leagues" className="button-secondary">
                Back to Leagues
              </Link>
              <Link
                href={buildMatchupHref(teamInfo.teamName, teamInfo.leagueName, teamInfo.flightName)}
                className="button-primary"
              >
                Future Lineup Projection
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="metric-grid team-metric-grid">
        <StatCard label="Matches" value={String(stats.totalMatches)} />
        <StatCard label="Record" value={`${stats.wins}-${stats.losses}`} />
        <StatCard label="Home" value={String(stats.homeMatches)} />
        <StatCard label="Away" value={String(stats.awayMatches)} />
        <StatCard label="Singles" value={String(stats.singles)} />
        <StatCard label="Doubles" value={String(stats.doubles)} />
        <StatCard label="Latest Match" value={formatDate(stats.latest)} />
      </section>

      <section className="surface-card panel-pad team-main-card">
        {loading ? (
          <div className="team-state-box">Loading team data...</div>
        ) : error ? (
          <div className="team-error-box">{error}</div>
        ) : matches.length === 0 ? (
          <div className="team-state-box">No matches found for this team.</div>
        ) : (
          <>
            <div className="team-section">
              <div className="team-section-head">
                <div>
                  <div className="section-kicker">Roster Usage</div>
                  <h2 className="team-section-title">Players used by this team</h2>
                  <div className="team-section-sub">
                    Players who have appeared for this team in imported scorecards.
                  </div>
                </div>
              </div>

              <div className="card-grid team-roster-grid">
                {roster.map((player) => (
                  <div key={player.id} className="surface-card team-player-card">
                    <div className="team-player-top">
                      <div>
                        <div className="team-player-name">{player.name}</div>
                        <div className="team-player-meta">
                          {player.wins}-{player.losses} when appearing
                        </div>
                      </div>

                      <Link href={`/players/${player.id}`} className="button-ghost team-player-link">
                        Player Page
                      </Link>
                    </div>

                    <div className="team-mini-grid">
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
            </div>

            <div className="team-section">
              <div className="team-section-head">
                <div>
                  <div className="section-kicker">Season Matches</div>
                  <h2 className="team-section-title">Team match history</h2>
                  <div className="team-section-sub">
                    Team match history inside the selected league and flight.
                  </div>
                </div>
              </div>

              <div className="team-match-list">
                {matches.map((match) => {
                  const home = safeText(match.home_team)
                  const away = safeText(match.away_team)
                  const side = teamSideByMatchId.get(match.id)
                  const won = side ? match.winner_side === side : false
                  const opponent = side === 'A' ? away : home

                  return (
                    <div key={match.id} className="surface-card team-match-card">
                      <div className="team-match-top">
                        <div>
                          <div className="team-match-title">
                            {home} vs {away}
                          </div>
                          <div className="team-match-meta">
                            {formatDate(match.match_date)} · {match.match_type}
                          </div>
                        </div>

                        <div
                          className={`team-result-badge ${won ? 'is-win' : 'is-loss'}`}
                        >
                          {won ? 'Win' : 'Loss'}
                        </div>
                      </div>

                      <div className="team-match-bottom">
                        <div className="team-score">{match.score || 'No score entered'}</div>
                        <div className="team-match-submeta">
                          Opponent: <strong>{opponent}</strong>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </section>

      <style jsx>{`
        .team-page {
          padding-top: 1.25rem;
          padding-bottom: 2.5rem;
        }

        .team-top-links {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .team-hero-panel {
          overflow: hidden;
        }

        .team-hero-inner {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(280px, 360px);
          gap: 1rem;
          align-items: stretch;
        }

        .team-hero-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.85rem;
        }

        .team-kicker {
          color: rgba(217, 231, 255, 0.82);
        }

        .team-title {
          margin: 0;
          color: #ffffff;
          font-size: clamp(2rem, 4vw, 3.2rem);
          line-height: 1;
          letter-spacing: -0.04em;
          font-weight: 900;
        }

        .team-meta {
          margin: 0;
          color: rgba(219, 234, 254, 0.9);
          font-size: 1rem;
          line-height: 1.7;
          font-weight: 500;
        }

        .team-hero-badges {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin-top: 0.15rem;
        }

        .team-hero-actions-card {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 1rem;
        }

        .team-actions-title {
          color: #ffffff;
          font-size: 0.95rem;
          font-weight: 800;
        }

        .team-actions-buttons {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .team-metric-grid {
          margin-top: 1rem;
          margin-bottom: 1rem;
        }

        .team-main-card {
          min-width: 0;
        }

        .team-section + .team-section {
          margin-top: 1.5rem;
        }

        .team-section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .team-section-title {
          margin: 0.25rem 0 0;
          color: #0f172a;
          font-size: 1.35rem;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .team-section-sub {
          margin-top: 0.45rem;
          color: #64748b;
          font-size: 0.94rem;
          line-height: 1.6;
          font-weight: 500;
        }

        .team-roster-grid {
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1rem;
        }

        .team-player-card {
          padding: 1rem;
        }

        .team-player-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 0.9rem;
        }

        .team-player-name {
          color: #0f172a;
          font-size: 1.25rem;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .team-player-meta {
          color: #255be3;
          font-size: 0.9rem;
          line-height: 1.5;
          font-weight: 700;
          margin-top: 0.35rem;
        }

        .team-player-link {
          white-space: nowrap;
        }

        .team-mini-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.7rem;
        }

        .team-match-list {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .team-match-card {
          padding: 1rem;
        }

        .team-match-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .team-match-title {
          color: #0f172a;
          font-size: 1.12rem;
          line-height: 1.25;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .team-match-meta {
          margin-top: 0.35rem;
          color: #64748b;
          font-size: 0.92rem;
          line-height: 1.5;
          font-weight: 500;
          text-transform: capitalize;
        }

        .team-result-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 4rem;
          padding: 0.48rem 0.7rem;
          border-radius: 999px;
          font-size: 0.78rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }

        .team-result-badge.is-win {
          background: rgba(34, 197, 94, 0.12);
          color: #166534;
        }

        .team-result-badge.is-loss {
          background: rgba(239, 68, 68, 0.12);
          color: #991b1b;
        }

        .team-match-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 0.9rem;
          padding-top: 0.9rem;
          border-top: 1px solid rgba(148, 163, 184, 0.18);
        }

        .team-score {
          color: #255be3;
          font-size: 1rem;
          line-height: 1.2;
          font-weight: 900;
        }

        .team-match-submeta {
          color: #64748b;
          font-size: 0.92rem;
          line-height: 1.5;
          font-weight: 500;
        }

        .team-state-box {
          border-radius: 1rem;
          padding: 1rem 1.05rem;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          color: #475569;
          font-size: 0.96rem;
          line-height: 1.6;
          font-weight: 600;
        }

        .team-error-box {
          border-radius: 1rem;
          padding: 1rem 1.05rem;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.18);
          color: #991b1b;
          font-size: 0.96rem;
          line-height: 1.6;
          font-weight: 700;
        }

        @media (max-width: 900px) {
          .team-hero-inner {
            grid-template-columns: 1fr;
          }

          .team-actions-buttons {
            flex-direction: column;
          }
        }

        @media (max-width: 640px) {
          .team-mini-grid {
            grid-template-columns: 1fr 1fr;
          }

          .team-player-top,
          .team-match-bottom {
            align-items: stretch;
          }
        }
      `}</style>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <div className="team-stat-label">{label}</div>
      <div className="team-stat-value">{value}</div>

      <style jsx>{`
        .team-stat-label {
          color: #64748b;
          font-size: 0.82rem;
          margin-bottom: 0.4rem;
          font-weight: 700;
        }

        .team-stat-value {
          color: #0f172a;
          font-size: clamp(1.4rem, 2vw, 1.85rem);
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.03em;
        }
      `}</style>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card team-mini-stat">
      <div className="team-mini-stat-label">{label}</div>
      <div className="team-mini-stat-value">{value}</div>

      <style jsx>{`
        .team-mini-stat {
          padding: 0.85rem 0.9rem;
          min-width: 0;
        }

        .team-mini-stat-label {
          color: #64748b;
          font-size: 0.76rem;
          margin-bottom: 0.28rem;
          font-weight: 700;
        }

        .team-mini-stat-value {
          color: #0f172a;
          font-size: 0.98rem;
          line-height: 1.2;
          font-weight: 800;
        }
      `}</style>
    </div>
  )
}