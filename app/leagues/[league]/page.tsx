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
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
        <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
        <Link href="/leagues" style={navLinkStyle}>Leagues</Link>
        <Link href="/admin" style={navLinkStyle}>Admin</Link>
      </div>

      <div style={heroCardStyle}>
        <div style={heroTopRowStyle}>
          <div>
            <div style={heroEyebrowStyle}>League Season</div>
            <h1 style={{ margin: '8px 0 0', fontSize: '36px' }}>{leagueInfo.leagueName}</h1>
          </div>

          <Link href="/leagues" style={heroBackLinkStyle}>
            Back to Leagues
          </Link>
        </div>

        <p style={heroMetaStyle}>
          {leagueInfo.flight} · {leagueInfo.section} · {leagueInfo.district}
        </p>
      </div>

      <div style={cardStyle}>
        {loading ? (
          <div style={emptyStateStyle}>Loading season data...</div>
        ) : error ? (
          <div style={errorBoxStyle}>{error}</div>
        ) : rows.length === 0 ? (
          <div style={emptyStateStyle}>No matches found for this league.</div>
        ) : (
          <>
            <div style={statsGridStyle}>
              <StatCard label="Matches" value={String(stats.matchCount)} />
              <StatCard label="Teams" value={String(stats.teams)} />
              <StatCard label="Singles Lines" value={String(stats.singles)} />
              <StatCard label="Doubles Lines" value={String(stats.doubles)} />
              <StatCard label="Latest Match" value={formatDate(stats.latest)} />
            </div>

            <div style={sectionBlockStyle}>
              <div style={sectionHeaderRowStyle}>
                <h2 style={sectionTitleStyle}>Teams</h2>
                <div style={sectionSubStyle}>Standings-style season summary</div>
              </div>

              <div style={teamGridStyle}>
                {teamSummaries.map((team) => (
                  <div key={team.name} style={teamCardStyle}>
                    <div style={teamCardTopStyle}>
                      <div>
                        <div style={teamNameStyle}>{team.name}</div>
                        <div style={teamMetaStyle}>
                          {team.wins}-{team.losses} record
                        </div>
                      </div>

                      <Link
                        href={buildTeamHref(team.name, leagueInfo.leagueName, leagueInfo.flight)}
                        style={viewLinkStyle}
                      >
                        Team Page
                      </Link>
                    </div>

                    <div style={miniStatsGridStyle}>
                      <MiniStat label="Matches" value={String(team.matches)} />
                      <MiniStat label="Home" value={String(team.homeMatches)} />
                      <MiniStat label="Away" value={String(team.awayMatches)} />
                      <MiniStat label="Latest" value={formatDate(team.latestMatchDate)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={sectionBlockStyle}>
              <div style={sectionHeaderRowStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>Season Matches</h2>
                  <div style={sectionSubStyle}>
                    Match list for this league season. Team filtering here will be useful later for
                    lineup projection.
                  </div>
                </div>

                <div style={filterWrapStyle}>
                  <label style={labelStyle}>Filter by team</label>
                  <select
                    value={teamFilter}
                    onChange={(e) => setTeamFilter(e.target.value)}
                    style={inputStyle}
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

              <div style={matchListStyle}>
                {filteredMatches.map((row) => {
                  const home = safeText(row.home_team)
                  const away = safeText(row.away_team)
                  const winner = row.winner_side === 'A' ? home : away

                  return (
                    <div key={row.id} style={matchCardStyle}>
                      <div style={matchTopRowStyle}>
                        <div>
                          <div style={matchTitleStyle}>
                            {home} vs {away}
                          </div>
                          <div style={matchMetaStyle}>
                            {formatDate(row.match_date)} · {row.match_type}
                          </div>
                        </div>

                        <div style={winnerBadgeStyle}>Winner: {winner}</div>
                      </div>

                      <div style={matchBottomRowStyle}>
                        <div style={scoreStyle}>{row.score || 'No score entered'}</div>
                        <div style={matchSubMetaStyle}>
                          {leagueInfo.flight} · {leagueInfo.district}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCardStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={statValueStyle}>{value}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniStatStyle}>
      <div style={miniStatLabelStyle}>{label}</div>
      <div style={miniStatValueStyle}>{value}</div>
    </div>
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

const heroTopRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  flexWrap: 'wrap' as const,
}

const heroEyebrowStyle = {
  color: '#bfdbfe',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  fontSize: '12px',
}

const heroMetaStyle = {
  margin: '12px 0 0',
  color: '#dbeafe',
  fontSize: '16px',
}

const heroBackLinkStyle = {
  display: 'inline-block',
  padding: '10px 14px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.14)',
  border: '1px solid rgba(255,255,255,0.22)',
  color: '#ffffff',
  textDecoration: 'none',
  fontWeight: 700,
}

const cardStyle = {
  background: 'white',
  borderRadius: '20px',
  padding: '24px',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
  border: '1px solid #e2e8f0',
  marginBottom: '22px',
}

const statsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
  marginBottom: '20px',
}

const statCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '16px',
}

const statLabelStyle = {
  color: '#64748b',
  fontSize: '12px',
  marginBottom: '6px',
}

const statValueStyle = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: 800,
}

const sectionBlockStyle = {
  marginTop: '20px',
}

const sectionHeaderRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: '16px',
  flexWrap: 'wrap' as const,
  marginBottom: '14px',
}

const sectionTitleStyle = {
  margin: 0,
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: 800,
}

const sectionSubStyle = {
  color: '#64748b',
  fontSize: '14px',
  marginTop: '6px',
}

const teamGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '16px',
}

const teamCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  padding: '18px',
}

const teamCardTopStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '14px',
}

const teamNameStyle = {
  color: '#0f172a',
  fontSize: '22px',
  fontWeight: 800,
}

const teamMetaStyle = {
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

const miniStatsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
}

const miniStatStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '12px',
}

const miniStatLabelStyle = {
  color: '#64748b',
  fontSize: '12px',
  marginBottom: '4px',
}

const miniStatValueStyle = {
  color: '#0f172a',
  fontWeight: 700,
}

const filterWrapStyle = {
  width: '240px',
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

const matchListStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '12px',
}

const matchCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '16px',
}

const matchTopRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  flexWrap: 'wrap' as const,
}

const matchTitleStyle = {
  color: '#0f172a',
  fontSize: '20px',
  fontWeight: 800,
}

const matchMetaStyle = {
  color: '#64748b',
  marginTop: '6px',
  textTransform: 'capitalize' as const,
}

const winnerBadgeStyle = {
  padding: '8px 10px',
  borderRadius: '999px',
  background: '#dcfce7',
  border: '1px solid #bbf7d0',
  color: '#166534',
  fontWeight: 700,
  fontSize: '12px',
}

const matchBottomRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap' as const,
  marginTop: '12px',
}

const scoreStyle = {
  color: '#1d4ed8',
  fontWeight: 800,
  fontSize: '18px',
}

const matchSubMetaStyle = {
  color: '#64748b',
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