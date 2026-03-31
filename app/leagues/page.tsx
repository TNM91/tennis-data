'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type MatchLeagueRow = {
  id: string
  league_name: string | null
  flight: string | null
  usta_section: string | null
  district_area: string | null
  home_team: string | null
  away_team: string | null
  match_date: string
}

type LeagueCard = {
  key: string
  leagueName: string
  flight: string
  ustaSection: string
  districtArea: string
  matchCount: number
  teamCount: number
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

function buildLeagueKey(row: MatchLeagueRow) {
  return [
    safeText(row.league_name),
    safeText(row.flight),
    safeText(row.usta_section),
    safeText(row.district_area),
  ].join('___')
}

function buildLeagueHref(league: LeagueCard) {
  const params = new URLSearchParams({
    league: league.leagueName,
    flight: league.flight,
    section: league.ustaSection,
    district: league.districtArea,
  })

  return `/leagues/${encodeURIComponent(league.leagueName)}?${params.toString()}`
}

export default function LeaguesPage() {
  const [rows, setRows] = useState<MatchLeagueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [flightFilter, setFlightFilter] = useState('all')

  useEffect(() => {
    void loadLeagueRows()
  }, [])

  async function loadLeagueRows() {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          league_name,
          flight,
          usta_section,
          district_area,
          home_team,
          away_team,
          match_date
        `)
        .order('match_date', { ascending: false })

      if (error) throw new Error(error.message)

      setRows((data || []) as MatchLeagueRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leagues.')
    } finally {
      setLoading(false)
    }
  }

  const leagues = useMemo<LeagueCard[]>(() => {
    const map = new Map<string, LeagueCard & { teamSet: Set<string> }>()

    for (const row of rows) {
      const key = buildLeagueKey(row)

      if (!map.has(key)) {
        map.set(key, {
          key,
          leagueName: safeText(row.league_name),
          flight: safeText(row.flight),
          ustaSection: safeText(row.usta_section),
          districtArea: safeText(row.district_area),
          matchCount: 0,
          teamCount: 0,
          latestMatchDate: row.match_date || null,
          teamSet: new Set<string>(),
        })
      }

      const current = map.get(key)!
      current.matchCount += 1

      if (row.home_team) current.teamSet.add(row.home_team.trim())
      if (row.away_team) current.teamSet.add(row.away_team.trim())

      if (
        row.match_date &&
        (!current.latestMatchDate ||
          new Date(row.match_date).getTime() > new Date(current.latestMatchDate).getTime())
      ) {
        current.latestMatchDate = row.match_date
      }
    }

    return [...map.values()]
      .map((item) => ({
        key: item.key,
        leagueName: item.leagueName,
        flight: item.flight,
        ustaSection: item.ustaSection,
        districtArea: item.districtArea,
        matchCount: item.matchCount,
        teamCount: item.teamSet.size,
        latestMatchDate: item.latestMatchDate,
      }))
      .sort((a, b) => {
        const aDate = a.latestMatchDate ? new Date(a.latestMatchDate).getTime() : 0
        const bDate = b.latestMatchDate ? new Date(b.latestMatchDate).getTime() : 0
        return bDate - aDate
      })
  }, [rows])

  const flights = useMemo(() => {
    const unique = [...new Set(leagues.map((league) => league.flight).filter(Boolean))]
    return unique.sort((a, b) => a.localeCompare(b))
  }, [leagues])

  const filteredLeagues = useMemo(() => {
    const term = search.trim().toLowerCase()

    return leagues.filter((league) => {
      const matchesFlight = flightFilter === 'all' || league.flight === flightFilter

      const matchesSearch =
        !term ||
        league.leagueName.toLowerCase().includes(term) ||
        league.flight.toLowerCase().includes(term) ||
        league.ustaSection.toLowerCase().includes(term) ||
        league.districtArea.toLowerCase().includes(term)

      return matchesFlight && matchesSearch
    })
  }, [leagues, search, flightFilter])

  const summary = useMemo(() => {
    return {
      totalLeagues: filteredLeagues.length,
      totalMatches: rows.length,
      totalFlights: flights.length,
      latestMatch:
        leagues.length > 0
          ? leagues
              .map((league) => league.latestMatchDate)
              .filter(Boolean)
              .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] || null
          : null,
    }
  }, [filteredLeagues.length, rows.length, flights.length, leagues])

  return (
    <main className="page-shell-tight leagues-page">
      <div className="leagues-top-links">
        <Link href="/" className="button-ghost">Home</Link>
        <Link href="/rankings" className="button-ghost">Rankings</Link>
        <Link href="/matchup" className="button-ghost">Matchup</Link>
        <Link href="/leagues" className="button-ghost">Leagues</Link>
        <Link href="/admin" className="button-ghost">Admin</Link>
      </div>

      <section className="hero-panel leagues-hero-panel">
        <div className="hero-inner leagues-hero-inner">
          <div className="leagues-hero-copy">
            <div className="section-kicker leagues-kicker">League Explorer</div>
            <h1 className="leagues-hero-title">Browse imported league seasons.</h1>
            <p className="leagues-hero-text">
              Explore league groupings by league name, flight, section, and district.
              This is the foundation for season views, team pages, matchup prep,
              and future lineup projections across TenAceIQ.
            </p>

            <div className="leagues-hero-badges">
              <span className="badge badge-blue">{summary.totalLeagues} leagues</span>
              <span className="badge badge-slate">{summary.totalMatches} imported matches</span>
              <span className="badge badge-green">
                Latest: {formatDate(summary.latestMatch)}
              </span>
            </div>
          </div>

          <div className="glass-card panel-pad leagues-hero-side">
            <div className="leagues-side-label">Coverage snapshot</div>
            <div className="leagues-side-value">{summary.totalFlights}</div>
            <div className="leagues-side-text">
              Unique flights currently represented in imported match history.
            </div>
          </div>
        </div>
      </section>

      <section className="metric-grid leagues-metric-grid">
        <StatCard label="Visible Leagues" value={String(summary.totalLeagues)} />
        <StatCard label="Imported Matches" value={String(summary.totalMatches)} />
        <StatCard label="Flights" value={String(summary.totalFlights)} />
        <StatCard label="Latest Match" value={formatDate(summary.latestMatch)} />
      </section>

      <section className="surface-card panel-pad leagues-controls-card">
        <div className="leagues-controls-head">
          <div>
            <div className="section-kicker">Filters</div>
            <h2 className="leagues-section-title">Search and narrow league groups</h2>
          </div>
        </div>

        <div className="leagues-filter-grid">
          <div>
            <label className="label" htmlFor="league-search">
              Search
            </label>
            <input
              id="league-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by league, flight, section, or district"
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="league-flight-filter">
              Flight
            </label>
            <select
              id="league-flight-filter"
              value={flightFilter}
              onChange={(e) => setFlightFilter(e.target.value)}
              className="select"
            >
              <option value="all">All Flights</option>
              {flights.map((flight) => (
                <option key={flight} value={flight}>
                  {flight}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="leagues-state-box">Loading leagues...</div>
        ) : error ? (
          <div className="leagues-error-box">{error}</div>
        ) : filteredLeagues.length === 0 ? (
          <div className="leagues-state-box">No league records found yet.</div>
        ) : (
          <>
            <div className="leagues-summary-row">
              <span className="badge badge-blue">{filteredLeagues.length} visible leagues</span>
              <span className="badge badge-slate">{rows.length} total imported matches</span>
            </div>

            <div className="card-grid leagues-card-grid">
              {filteredLeagues.map((league) => (
                <div key={league.key} className="surface-card panel-pad leagues-card">
                  <div className="leagues-card-top">
                    <div className="leagues-card-heading">
                      <div className="leagues-card-title">{league.leagueName}</div>
                      <div className="leagues-card-flight">{league.flight}</div>
                    </div>

                    <Link href={buildLeagueHref(league)} className="button-secondary leagues-card-link">
                      View Season
                    </Link>
                  </div>

                  <div className="leagues-detail-grid">
                    <DetailCard label="USTA Section" value={league.ustaSection} />
                    <DetailCard label="District / Area" value={league.districtArea} />
                    <DetailCard label="Matches" value={String(league.matchCount)} />
                    <DetailCard label="Teams Seen" value={String(league.teamCount)} />
                  </div>

                  <div className="leagues-card-bottom">
                    <span className="leagues-bottom-meta">
                      Latest match: <strong>{formatDate(league.latestMatchDate)}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <style jsx>{`
        .leagues-page {
          padding-top: 1.25rem;
          padding-bottom: 2.5rem;
        }

        .leagues-top-links {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .leagues-hero-panel {
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .leagues-hero-inner {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(260px, 320px);
          gap: 1rem;
          align-items: stretch;
        }

        .leagues-hero-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.85rem;
        }

        .leagues-kicker {
          color: rgba(217, 231, 255, 0.82);
        }

        .leagues-hero-title {
          margin: 0;
          color: #ffffff;
          font-size: clamp(2rem, 4vw, 3.15rem);
          line-height: 1;
          letter-spacing: -0.04em;
          font-weight: 900;
        }

        .leagues-hero-text {
          margin: 0;
          max-width: 52rem;
          color: rgba(219, 234, 254, 0.9);
          font-size: 1rem;
          line-height: 1.7;
          font-weight: 500;
        }

        .leagues-hero-badges {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin-top: 0.15rem;
        }

        .leagues-hero-side {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.6rem;
        }

        .leagues-side-label {
          color: rgba(217, 231, 255, 0.82);
          font-size: 0.8rem;
          line-height: 1.5;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .leagues-side-value {
          color: #ffffff;
          font-size: 2.15rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .leagues-side-text {
          color: rgba(219, 234, 254, 0.88);
          font-size: 0.94rem;
          line-height: 1.65;
          font-weight: 500;
        }

        .leagues-metric-grid {
          margin-top: 0;
          margin-bottom: 1rem;
        }

        .leagues-controls-card {
          min-width: 0;
        }

        .leagues-controls-head {
          margin-bottom: 1rem;
        }

        .leagues-section-title {
          margin: 0.25rem 0 0;
          color: #0f172a;
          font-size: 1.35rem;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .leagues-filter-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 220px;
          gap: 1rem;
        }

        .leagues-summary-row {
          margin-top: 1rem;
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .leagues-card-grid {
          margin-top: 1rem;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1rem;
        }

        .leagues-card {
          min-width: 0;
        }

        .leagues-card-top {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: flex-start;
          margin-bottom: 0.95rem;
        }

        .leagues-card-heading {
          min-width: 0;
        }

        .leagues-card-title {
          color: #0f172a;
          font-size: 1.3rem;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .leagues-card-flight {
          color: #255be3;
          font-size: 0.95rem;
          line-height: 1.5;
          font-weight: 700;
          margin-top: 0.35rem;
        }

        .leagues-card-link {
          white-space: nowrap;
        }

        .leagues-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .leagues-card-bottom {
          margin-top: 0.95rem;
          padding-top: 0.9rem;
          border-top: 1px solid rgba(148, 163, 184, 0.18);
        }

        .leagues-bottom-meta {
          color: #475569;
          font-size: 0.9rem;
          line-height: 1.5;
          font-weight: 500;
        }

        .leagues-error-box {
          margin-top: 1rem;
          border-radius: 1rem;
          padding: 1rem 1.05rem;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.18);
          color: #991b1b;
          font-size: 0.96rem;
          line-height: 1.6;
          font-weight: 700;
        }

        .leagues-state-box {
          margin-top: 1rem;
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

        @media (max-width: 980px) {
          .leagues-hero-inner {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .leagues-filter-grid {
            grid-template-columns: 1fr;
          }

          .leagues-detail-grid {
            grid-template-columns: 1fr;
          }

          .leagues-card-top {
            flex-direction: column;
            align-items: stretch;
          }

          .leagues-card-link {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <div className="leagues-stat-label">{label}</div>
      <div className="leagues-stat-value">{value}</div>

      <style jsx>{`
        .leagues-stat-label {
          color: #64748b;
          font-size: 0.82rem;
          margin-bottom: 0.4rem;
          font-weight: 700;
        }

        .leagues-stat-value {
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

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card leagues-detail-card">
      <div className="leagues-detail-label">{label}</div>
      <div className="leagues-detail-value">{value}</div>

      <style jsx>{`
        .leagues-detail-card {
          padding: 0.85rem 0.9rem;
          min-width: 0;
        }

        .leagues-detail-label {
          color: #64748b;
          font-size: 0.76rem;
          margin-bottom: 0.28rem;
          font-weight: 700;
        }

        .leagues-detail-value {
          color: #0f172a;
          font-size: 0.98rem;
          line-height: 1.35;
          font-weight: 800;
          word-break: break-word;
        }
      `}</style>
    </div>
  )
}