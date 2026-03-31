'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type LeagueMatchRow = {
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

type TeamSummary = {
  name: string
  matches: number
  homeMatches: number
  awayMatches: number
  wins: number
  losses: number
  latestMatchDate: string | null
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

function buildTeamHref(teamName: string, leagueName: string, flight: string) {
  const params = new URLSearchParams({
    league: leagueName,
    flight,
  })

  return `/teams/${encodeURIComponent(teamName)}?${params.toString()}`
}

export default function LeagueDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()

  const leagueFromRoute = decodeURIComponent(String(params.league || ''))
  const flight = searchParams.get('flight') || ''
  const section = searchParams.get('section') || ''
  const district = searchParams.get('district') || ''

  const [rows, setRows] = useState<LeagueMatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [teamFilter, setTeamFilter] = useState('all')

  useEffect(() => {
    void loadLeagueMatches()
  }, [leagueFromRoute, flight, section, district])

  async function loadLeagueMatches() {
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
        .eq('league_name', leagueFromRoute)
        .order('match_date', { ascending: false })

      if (flight) query = query.eq('flight', flight)
      if (section) query = query.eq('usta_section', section)
      if (district) query = query.eq('district_area', district)

      const { data, error } = await query

      if (error) throw new Error(error.message)

      setRows((data || []) as LeagueMatchRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load league.')
    } finally {
      setLoading(false)
    }
  }

  const leagueInfo = useMemo(() => {
    if (!rows.length) {
      return {
        leagueName: leagueFromRoute || 'Unknown League',
        flight: flight || 'Unknown',
        section: section || 'Unknown',
        district: district || 'Unknown',
      }
    }

    const first = rows[0]
    return {
      leagueName: safeText(first.league_name, leagueFromRoute || 'Unknown League'),
      flight: safeText(first.flight, flight || 'Unknown'),
      section: safeText(first.usta_section, section || 'Unknown'),
      district: safeText(first.district_area, district || 'Unknown'),
    }
  }, [rows, leagueFromRoute, flight, section, district])

  const teamSummaries = useMemo<TeamSummary[]>(() => {
    const map = new Map<string, TeamSummary>()

    for (const row of rows) {
      const homeTeam = safeText(row.home_team)
      const awayTeam = safeText(row.away_team)

      if (!map.has(homeTeam)) {
        map.set(homeTeam, {
          name: homeTeam,
          matches: 0,
          homeMatches: 0,
          awayMatches: 0,
          wins: 0,
          losses: 0,
          latestMatchDate: null,
        })
      }

      if (!map.has(awayTeam)) {
        map.set(awayTeam, {
          name: awayTeam,
          matches: 0,
          homeMatches: 0,
          awayMatches: 0,
          wins: 0,
          losses: 0,
          latestMatchDate: null,
        })
      }

      const home = map.get(homeTeam)!
      const away = map.get(awayTeam)!

      home.matches += 1
      home.homeMatches += 1
      away.matches += 1
      away.awayMatches += 1

      const winningTeam = row.winner_side === 'A' ? homeTeam : awayTeam
      const losingTeam = row.winner_side === 'A' ? awayTeam : homeTeam

      map.get(winningTeam)!.wins += 1
      map.get(losingTeam)!.losses += 1

      for (const team of [home, away]) {
        if (
          row.match_date &&
          (!team.latestMatchDate ||
            new Date(row.match_date).getTime() > new Date(team.latestMatchDate).getTime())
        ) {
          team.latestMatchDate = row.match_date
        }
      }
    }

    return [...map.values()].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      if (a.losses !== b.losses) return a.losses - b.losses
      return a.name.localeCompare(b.name)
    })
  }, [rows])

  const filteredMatches = useMemo(() => {
    if (teamFilter === 'all') return rows
    return rows.filter(
      (row) =>
        safeText(row.home_team) === teamFilter || safeText(row.away_team) === teamFilter
    )
  }, [rows, teamFilter])

  const stats = useMemo(() => {
    const singles = rows.filter((row) => row.match_type === 'singles').length
    const doubles = rows.filter((row) => row.match_type === 'doubles').length
    const teams = teamSummaries.length
    const latest = rows[0]?.match_date || null

    return {
      matchCount: rows.length,
      singles,
      doubles,
      teams,
      latest,
    }
  }, [rows, teamSummaries])

  return (
    <main className="page-shell-tight league-detail-page">
      <div className="league-detail-top-links">
        <Link href="/" className="button-ghost">Home</Link>
        <Link href="/rankings" className="button-ghost">Rankings</Link>
        <Link href="/matchup" className="button-ghost">Matchup</Link>
        <Link href="/leagues" className="button-ghost">Leagues</Link>
        <Link href="/admin" className="button-ghost">Admin</Link>
      </div>

      <section className="hero-panel league-detail-hero">
        <div className="hero-inner league-detail-hero-inner">
          <div className="league-detail-hero-copy">
            <div className="section-kicker league-detail-kicker">League Season</div>
            <h1 className="league-detail-title">{leagueInfo.leagueName}</h1>
            <p className="league-detail-subtitle">
              {leagueInfo.flight} · {leagueInfo.section} · {leagueInfo.district}
            </p>

            <div className="league-detail-badges">
              <span className="badge badge-blue">{stats.matchCount} matches</span>
              <span className="badge badge-slate">{stats.teams} teams</span>
              <span className="badge badge-green">
                Latest: {formatDate(stats.latest)}
              </span>
            </div>
          </div>

          <div className="glass-card panel-pad league-detail-hero-side">
            <div className="league-detail-side-label">Season tools</div>
            <div className="league-detail-side-value">{leagueInfo.flight}</div>
            <div className="league-detail-side-text">
              Review team performance, standings-style summaries, and match history for this league segment.
            </div>
            <div className="league-detail-side-actions">
              <Link href="/leagues" className="button-secondary">
                Back to Leagues
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="metric-grid league-detail-metrics">
        <StatCard label="Matches" value={String(stats.matchCount)} />
        <StatCard label="Teams" value={String(stats.teams)} />
        <StatCard label="Singles Lines" value={String(stats.singles)} />
        <StatCard label="Doubles Lines" value={String(stats.doubles)} />
        <StatCard label="Latest Match" value={formatDate(stats.latest)} />
      </section>

      <section className="surface-card panel-pad league-detail-main-card">
        {loading ? (
          <div className="league-detail-state-box">Loading season data...</div>
        ) : error ? (
          <div className="league-detail-error-box">{error}</div>
        ) : rows.length === 0 ? (
          <div className="league-detail-state-box">No matches found for this league.</div>
        ) : (
          <>
            <section className="league-detail-block">
              <div className="league-detail-section-head">
                <div>
                  <div className="section-kicker">Team Summary</div>
                  <h2 className="league-detail-section-title">Teams</h2>
                  <div className="league-detail-section-sub">
                    Standings-style season snapshot for each team in this league.
                  </div>
                </div>
              </div>

              <div className="card-grid league-detail-team-grid">
                {teamSummaries.map((team, index) => (
                  <div key={team.name} className="surface-card panel-pad league-detail-team-card">
                    <div className="league-detail-team-top">
                      <div>
                        <div className="league-detail-team-rank">#{index + 1}</div>
                        <div className="league-detail-team-name">{team.name}</div>
                        <div className="league-detail-team-record">
                          {team.wins}-{team.losses} record
                        </div>
                      </div>

                      <Link
                        href={buildTeamHref(team.name, leagueInfo.leagueName, leagueInfo.flight)}
                        className="button-ghost league-detail-team-link"
                      >
                        Team Page
                      </Link>
                    </div>

                    <div className="league-detail-mini-grid">
                      <MiniStat label="Matches" value={String(team.matches)} />
                      <MiniStat label="Home" value={String(team.homeMatches)} />
                      <MiniStat label="Away" value={String(team.awayMatches)} />
                      <MiniStat label="Latest" value={formatDate(team.latestMatchDate)} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="league-detail-block">
              <div className="league-detail-section-head">
                <div>
                  <div className="section-kicker">Season Matches</div>
                  <h2 className="league-detail-section-title">Match History</h2>
                  <div className="league-detail-section-sub">
                    Filter the season list by team to narrow the schedule and results.
                  </div>
                </div>

                <div className="league-detail-filter-wrap">
                  <label className="label" htmlFor="teamFilter">
                    Filter by team
                  </label>
                  <select
                    id="teamFilter"
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    className="select"
                  >
                    <option value="all">All Teams</option>
                    {teamSummaries.map((team) => (
                      <option key={team.name} value={team.name}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="league-detail-match-list">
                {filteredMatches.map((row) => {
                  const home = safeText(row.home_team)
                  const away = safeText(row.away_team)
                  const winner = row.winner_side === 'A' ? home : away

                  return (
                    <div key={row.id} className="surface-card panel-pad league-detail-match-card">
                      <div className="league-detail-match-top">
                        <div>
                          <div className="league-detail-match-title">
                            {home} vs {away}
                          </div>
                          <div className="league-detail-match-meta">
                            {formatDate(row.match_date)} · {row.match_type}
                          </div>
                        </div>

                        <div className="league-detail-winner-pill">
                          Winner: {winner}
                        </div>
                      </div>

                      <div className="league-detail-match-bottom">
                        <div className="league-detail-score">
                          {row.score || 'No score entered'}
                        </div>
                        <div className="league-detail-submeta">
                          {leagueInfo.flight} · {leagueInfo.district}
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

      <style jsx>{`
        .league-detail-page {
          padding-top: 1.25rem;
          padding-bottom: 2.5rem;
        }

        .league-detail-top-links {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .league-detail-hero {
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .league-detail-hero-inner {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(280px, 360px);
          gap: 1rem;
          align-items: stretch;
        }

        .league-detail-hero-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.85rem;
        }

        .league-detail-kicker {
          color: rgba(217, 231, 255, 0.82);
        }

        .league-detail-title {
          margin: 0;
          color: #ffffff;
          font-size: clamp(2rem, 4vw, 3.15rem);
          line-height: 1;
          letter-spacing: -0.04em;
          font-weight: 900;
        }

        .league-detail-subtitle {
          margin: 0;
          color: rgba(219, 234, 254, 0.9);
          font-size: 1rem;
          line-height: 1.7;
          font-weight: 500;
        }

        .league-detail-badges {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin-top: 0.15rem;
        }

        .league-detail-hero-side {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.65rem;
        }

        .league-detail-side-label {
          color: rgba(217, 231, 255, 0.82);
          font-size: 0.8rem;
          font-weight: 700;
          line-height: 1.5;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .league-detail-side-value {
          color: #ffffff;
          font-size: 1.95rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .league-detail-side-text {
          color: rgba(219, 234, 254, 0.88);
          font-size: 0.95rem;
          line-height: 1.65;
          font-weight: 500;
        }

        .league-detail-side-actions {
          margin-top: 0.2rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .league-detail-metrics {
          margin-top: 0;
          margin-bottom: 1rem;
        }

        .league-detail-main-card {
          min-width: 0;
        }

        .league-detail-block + .league-detail-block {
          margin-top: 1.5rem;
        }

        .league-detail-section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .league-detail-section-title {
          margin: 0.25rem 0 0;
          color: #0f172a;
          font-size: 1.35rem;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .league-detail-section-sub {
          margin-top: 0.45rem;
          color: #64748b;
          font-size: 0.94rem;
          line-height: 1.6;
          font-weight: 500;
        }

        .league-detail-team-grid {
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1rem;
        }

        .league-detail-team-card {
          min-width: 0;
        }

        .league-detail-team-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 0.95rem;
        }

        .league-detail-team-rank {
          color: #255be3;
          font-size: 0.76rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 0.45rem;
        }

        .league-detail-team-name {
          color: #0f172a;
          font-size: 1.25rem;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .league-detail-team-record {
          color: #255be3;
          font-size: 0.92rem;
          line-height: 1.5;
          font-weight: 700;
          margin-top: 0.35rem;
        }

        .league-detail-team-link {
          white-space: nowrap;
        }

        .league-detail-mini-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .league-detail-filter-wrap {
          width: 260px;
          max-width: 100%;
        }

        .league-detail-match-list {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .league-detail-match-card {
          min-width: 0;
        }

        .league-detail-match-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .league-detail-match-title {
          color: #0f172a;
          font-size: 1.1rem;
          line-height: 1.25;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .league-detail-match-meta {
          color: #64748b;
          font-size: 0.92rem;
          line-height: 1.5;
          font-weight: 500;
          margin-top: 0.35rem;
          text-transform: capitalize;
        }

        .league-detail-winner-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem 0.7rem;
          border-radius: 999px;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.18);
          color: #166534;
          font-size: 0.75rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }

        .league-detail-match-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 0.9rem;
          padding-top: 0.9rem;
          border-top: 1px solid rgba(148, 163, 184, 0.18);
        }

        .league-detail-score {
          color: #255be3;
          font-size: 1rem;
          line-height: 1.2;
          font-weight: 900;
        }

        .league-detail-submeta {
          color: #64748b;
          font-size: 0.9rem;
          line-height: 1.5;
          font-weight: 500;
        }

        .league-detail-state-box {
          border-radius: 1rem;
          padding: 1rem 1.05rem;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          color: #475569;
          font-size: 0.96rem;
          line-height: 1.6;
          font-weight: 600;
          text-align: center;
        }

        .league-detail-error-box {
          border-radius: 1rem;
          padding: 1rem 1.05rem;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.18);
          color: #991b1b;
          font-size: 0.96rem;
          line-height: 1.6;
          font-weight: 700;
        }

        @media (max-width: 980px) {
          .league-detail-hero-inner {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .league-detail-mini-grid {
            grid-template-columns: 1fr 1fr;
          }

          .league-detail-match-bottom,
          .league-detail-team-top {
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
      <div className="league-detail-stat-label">{label}</div>
      <div className="league-detail-stat-value">{value}</div>

      <style jsx>{`
        .league-detail-stat-label {
          color: #64748b;
          font-size: 0.82rem;
          margin-bottom: 0.4rem;
          font-weight: 700;
        }

        .league-detail-stat-value {
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
    <div className="surface-card league-detail-mini-stat">
      <div className="league-detail-mini-stat-label">{label}</div>
      <div className="league-detail-mini-stat-value">{value}</div>

      <style jsx>{`
        .league-detail-mini-stat {
          padding: 0.85rem 0.9rem;
          min-width: 0;
        }

        .league-detail-mini-stat-label {
          color: #64748b;
          font-size: 0.76rem;
          margin-bottom: 0.28rem;
          font-weight: 700;
        }

        .league-detail-mini-stat-value {
          color: #0f172a;
          font-size: 0.98rem;
          line-height: 1.2;
          font-weight: 800;
        }
      `}</style>
    </div>
  )
}