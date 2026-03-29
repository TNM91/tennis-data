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

  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
        <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
        <Link href="/leagues" style={navLinkStyle}>Leagues</Link>
        <Link href="/admin" style={navLinkStyle}>Admin</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>Leagues</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          Browse imported USTA league seasons, grouped by league, flight, section, and district.
          This is the foundation for season views, team pages, and future lineup projections.
        </p>
      </div>

      <div style={cardStyle}>
        <div style={toolbarStyle}>
          <div style={searchWrapStyle}>
            <label style={labelStyle}>Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by league, flight, section, or district"
              style={inputStyle}
            />
          </div>

          <div style={filterWrapStyle}>
            <label style={labelStyle}>Flight</label>
            <select
              value={flightFilter}
              onChange={(e) => setFlightFilter(e.target.value)}
              style={inputStyle}
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
          <div style={emptyStateStyle}>Loading leagues...</div>
        ) : error ? (
          <div style={errorBoxStyle}>{error}</div>
        ) : filteredLeagues.length === 0 ? (
          <div style={emptyStateStyle}>No league records found yet.</div>
        ) : (
          <>
            <div style={summaryRowStyle}>
              <div style={summaryPillStyle}>
                <strong>{filteredLeagues.length}</strong> leagues
              </div>
              <div style={summaryPillStyle}>
                <strong>{rows.length}</strong> imported matches
              </div>
            </div>

            <div style={leagueGridStyle}>
              {filteredLeagues.map((league) => (
                <div key={league.key} style={leagueCardStyle}>
                  <div style={leagueCardTopStyle}>
                    <div>
                      <div style={leagueTitleStyle}>{league.leagueName}</div>
                      <div style={leagueMetaStyle}>{league.flight}</div>
                    </div>

                    <Link href={buildLeagueHref(league)} style={viewLinkStyle}>
                      View Season
                    </Link>
                  </div>

                  <div style={detailGridStyle}>
                    <div style={detailCardStyle}>
                      <div style={detailLabelStyle}>USTA Section</div>
                      <div style={detailValueStyle}>{league.ustaSection}</div>
                    </div>

                    <div style={detailCardStyle}>
                      <div style={detailLabelStyle}>District / Area</div>
                      <div style={detailValueStyle}>{league.districtArea}</div>
                    </div>

                    <div style={detailCardStyle}>
                      <div style={detailLabelStyle}>Matches</div>
                      <div style={detailValueStyle}>{league.matchCount}</div>
                    </div>

                    <div style={detailCardStyle}>
                      <div style={detailLabelStyle}>Teams Seen</div>
                      <div style={detailValueStyle}>{league.teamCount}</div>
                    </div>
                  </div>

                  <div style={bottomBarStyle}>
                    <span style={bottomMetaStyle}>
                      Latest match: <strong>{formatDate(league.latestMatchDate)}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

const mainStyle = {
  padding: '24px',
  fontFamily: 'Arial, sans-serif',
  maxWidth: '1250px',
  margin: '0 auto',
  background: '#f8fafc',
  minHeight: '100vh',
}

const navRowStyle = {
  display: 'flex',
  gap: '12px',
  marginBottom: '24px',
  flexWrap: 'wrap' as const,
}

const navLinkStyle = {
  padding: '10px 14px',
  border: '1px solid #dbeafe',
  borderRadius: '999px',
  textDecoration: 'none',
  color: '#1e3a8a',
  background: '#eff6ff',
  fontWeight: 600,
}

const heroCardStyle = {
  background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
  color: 'white',
  borderRadius: '20px',
  padding: '28px',
  boxShadow: '0 14px 30px rgba(37, 99, 235, 0.20)',
  marginBottom: '22px',
}

const cardStyle = {
  background: 'white',
  borderRadius: '20px',
  padding: '24px',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
  border: '1px solid #e2e8f0',
  marginBottom: '22px',
}

const toolbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: '16px',
  flexWrap: 'wrap' as const,
  marginBottom: '18px',
}

const searchWrapStyle = {
  flex: 1,
  minWidth: '320px',
}

const filterWrapStyle = {
  width: '220px',
}

const labelStyle = {
  display: 'block',
  fontWeight: 700,
  color: '#0f172a',
  marginBottom: '8px',
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #cbd5e1',
  borderRadius: '14px',
  fontSize: '15px',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
  background: 'white',
}

const summaryRowStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
  marginBottom: '18px',
}

const summaryPillStyle = {
  padding: '10px 14px',
  borderRadius: '999px',
  background: '#eff6ff',
  border: '1px solid #dbeafe',
  color: '#1e3a8a',
  fontWeight: 700,
}

const leagueGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '16px',
}

const leagueCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  padding: '18px',
}

const leagueCardTopStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  marginBottom: '14px',
}

const leagueTitleStyle = {
  color: '#0f172a',
  fontSize: '22px',
  fontWeight: 800,
  lineHeight: 1.2,
}

const leagueMetaStyle = {
  color: '#2563eb',
  fontWeight: 700,
  marginTop: '6px',
}

const viewLinkStyle = {
  display: 'inline-block',
  padding: '8px 10px',
  borderRadius: '10px',
  background: '#eff6ff',
  color: '#1d4ed8',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '13px',
  whiteSpace: 'nowrap' as const,
}

const detailGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
}

const detailCardStyle = {
  background: 'white',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '12px',
}

const detailLabelStyle = {
  color: '#64748b',
  fontSize: '12px',
  marginBottom: '4px',
}

const detailValueStyle = {
  color: '#0f172a',
  fontWeight: 700,
  lineHeight: 1.4,
}

const bottomBarStyle = {
  marginTop: '14px',
  paddingTop: '12px',
  borderTop: '1px solid #e2e8f0',
}

const bottomMetaStyle = {
  color: '#475569',
  fontSize: '14px',
}

const errorBoxStyle = {
  marginTop: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: '#fee2e2',
  border: '1px solid #fca5a5',
  color: '#991b1b',
}

const emptyStateStyle = {
  marginTop: '18px',
  padding: '18px',
  borderRadius: '16px',
  background: '#f8fafc',
  border: '1px dashed #cbd5e1',
  color: '#475569',
}