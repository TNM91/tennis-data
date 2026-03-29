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
            <div style={heroEyebrowStyle}>Team Page</div>
            <h1 style={{ margin: '8px 0 0', fontSize: '36px' }}>{teamInfo.teamName}</h1>
          </div>

          <div style={heroButtonWrapStyle}>
            <Link href="/leagues" style={heroBackLinkStyle}>
              Back to Leagues
            </Link>
            <Link
              href={buildMatchupHref(teamInfo.teamName, teamInfo.leagueName, teamInfo.flightName)}
              style={heroActionLinkStyle}
            >
              Future Lineup Projection
            </Link>
          </div>
        </div>

        <p style={heroMetaStyle}>
          {teamInfo.leagueName} · {teamInfo.flightName} · {teamInfo.section} · {teamInfo.district}
        </p>
      </div>

      <div style={cardStyle}>
        {loading ? (
          <div style={emptyStateStyle}>Loading team data...</div>
        ) : error ? (
          <div style={errorBoxStyle}>{error}</div>
        ) : matches.length === 0 ? (
          <div style={emptyStateStyle}>No matches found for this team.</div>
        ) : (
          <>
            <div style={statsGridStyle}>
              <StatCard label="Matches" value={String(stats.totalMatches)} />
              <StatCard label="Record" value={`${stats.wins}-${stats.losses}`} />
              <StatCard label="Home" value={String(stats.homeMatches)} />
              <StatCard label="Away" value={String(stats.awayMatches)} />
              <StatCard label="Singles" value={String(stats.singles)} />
              <StatCard label="Doubles" value={String(stats.doubles)} />
              <StatCard label="Latest Match" value={formatDate(stats.latest)} />
            </div>

            <div style={sectionBlockStyle}>
              <div style={sectionHeaderRowStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>Roster Usage</h2>
                  <div style={sectionSubStyle}>
                    Players who have appeared for this team in imported scorecards.
                  </div>
                </div>
              </div>

              <div style={rosterGridStyle}>
                {roster.map((player) => (
                  <div key={player.id} style={playerCardStyle}>
                    <div style={playerCardTopStyle}>
                      <div>
                        <div style={playerNameStyle}>{player.name}</div>
                        <div style={playerMetaStyle}>
                          {player.wins}-{player.losses} when appearing
                        </div>
                      </div>

                      <Link href={`/players/${player.id}`} style={viewLinkStyle}>
                        Player Page
                      </Link>
                    </div>

                    <div style={miniStatsGridStyle}>
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
                        <div style={sectionBlockStyle}>
              <div style={sectionHeaderRowStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>Season Matches</h2>
                  <div style={sectionSubStyle}>
                    Team match history inside the selected league and flight.
                  </div>
                </div>
              </div>

              <div style={matchListStyle}>
                {matches.map((match) => {
                  const home = safeText(match.home_team)
                  const away = safeText(match.away_team)
                  const side = teamSideByMatchId.get(match.id)
                  const won = side ? match.winner_side === side : false
                  const opponent = side === 'A' ? away : home

                  return (
                    <div key={match.id} style={matchCardStyle}>
                      <div style={matchTopRowStyle}>
                        <div>
                          <div style={matchTitleStyle}>
                            {home} vs {away}
                          </div>
                          <div style={matchMetaStyle}>
                            {formatDate(match.match_date)} · {match.match_type}
                          </div>
                        </div>

                        <div
                          style={{
                            ...winnerBadgeStyle,
                            ...(won ? winBadgeStyle : lossBadgeStyle),
                          }}
                        >
                          {won ? 'Win' : 'Loss'}
                        </div>
                      </div>

                      <div style={matchBottomRowStyle}>
                        <div style={scoreStyle}>{match.score || 'No score entered'}</div>
                        <div style={matchSubMetaStyle}>
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

const heroButtonWrapStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
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

const heroActionLinkStyle = {
  display: 'inline-block',
  padding: '10px 14px',
  borderRadius: '999px',
  background: '#ffffff',
  border: '1px solid #ffffff',
  color: '#1d4ed8',
  textDecoration: 'none',
  fontWeight: 800,
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

const rosterGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '16px',
}

const playerCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  padding: '18px',
}

const playerCardTopStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '14px',
}

const playerNameStyle = {
  color: '#0f172a',
  fontSize: '22px',
  fontWeight: 800,
}

const playerMetaStyle = {
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
  fontWeight: 700,
  fontSize: '12px',
}

const winBadgeStyle = {
  background: '#dcfce7',
  border: '1px solid #bbf7d0',
  color: '#166534',
}

const lossBadgeStyle = {
  background: '#fee2e2',
  border: '1px solid #fecaca',
  color: '#991b1b',
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