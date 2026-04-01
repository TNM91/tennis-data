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

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/players', label: 'Players' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/matchup', label: 'Matchup' },
  { href: '/leagues', label: 'Leagues' },
  { href: '/captains-corner', label: "Captain's Corner" },
  { href: '/admin', label: 'Admin' },
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
    <main className="team-page-shell">
      <div className="team-bg-orb team-bg-orb-one" />
      <div className="team-bg-orb team-bg-orb-two" />
      <div className="team-grid-glow" />

      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand-wrap" aria-label="TenAceIQ home">
            <div className="brand-mark">TA</div>
            <div className="brand-text">
              <span className="brand-tenace">TenAce</span>
              <span className="brand-iq">IQ</span>
            </div>
          </Link>

          <nav className="site-nav">
            {NAV_LINKS.map((link) => {
              const isActive = link.href === '/leagues'
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`site-nav-link ${isActive ? 'is-active' : ''}`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <section className="team-hero-shell">
        <div className="team-hero-copy">
          <div className="team-eyebrow">Team page</div>
          <h1 className="team-title">{teamInfo.teamName}</h1>
          <p className="team-meta">
            {teamInfo.leagueName} · {teamInfo.flightName} · {teamInfo.section} · {teamInfo.district}
          </p>

          <div className="team-hero-badges">
            <span className="team-badge team-badge-blue">{stats.totalMatches} matches</span>
            <span className="team-badge team-badge-green">
              {stats.wins}-{stats.losses} record
            </span>
            <span className="team-badge team-badge-slate">{roster.length} players used</span>
          </div>
        </div>

        <div className="team-actions-card">
          <div className="team-actions-title">Team tools</div>
          <p className="team-actions-text">
            Jump back to league context or open a forward-looking matchup flow for this team.
          </p>
          <div className="team-actions-buttons">
            <Link href="/leagues" className="team-button-secondary">
              Back to Leagues
            </Link>
            <Link
              href={buildMatchupHref(teamInfo.teamName, teamInfo.leagueName, teamInfo.flightName)}
              className="team-button-primary"
            >
              Future Lineup Projection
            </Link>
          </div>
        </div>
      </section>

      <section className="team-metric-grid">
        <StatCard label="Matches" value={String(stats.totalMatches)} />
        <StatCard label="Record" value={`${stats.wins}-${stats.losses}`} />
        <StatCard label="Home" value={String(stats.homeMatches)} />
        <StatCard label="Away" value={String(stats.awayMatches)} />
        <StatCard label="Singles" value={String(stats.singles)} />
        <StatCard label="Doubles" value={String(stats.doubles)} />
        <StatCard label="Latest Match" value={formatDate(stats.latest)} />
      </section>

      <section className="team-main-card">
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
                  <div className="team-section-kicker">Roster usage</div>
                  <h2 className="team-section-title">Players used by this team</h2>
                  <div className="team-section-sub">
                    Players who have appeared for this team in imported scorecards.
                  </div>
                </div>
              </div>

              <div className="team-roster-grid">
                {roster.map((player) => (
                  <div key={player.id} className="team-player-card">
                    <div className="team-player-top">
                      <div>
                        <div className="team-player-name">{player.name}</div>
                        <div className="team-player-meta">
                          {player.wins}-{player.losses} when appearing
                        </div>
                      </div>

                      <Link href={`/players/${player.id}`} className="team-player-link">
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
                  <div className="team-section-kicker">Season matches</div>
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
                    <div key={match.id} className="team-match-card">
                      <div className="team-match-top">
                        <div>
                          <div className="team-match-title">
                            {home} vs {away}
                          </div>
                          <div className="team-match-meta">
                            {formatDate(match.match_date)} · {match.match_type}
                          </div>
                        </div>

                        <div className={`team-result-badge ${won ? 'is-win' : 'is-loss'}`}>
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
        .team-page-shell {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at top, rgba(37, 91, 227, 0.22), transparent 28%),
            linear-gradient(180deg, #050b17 0%, #071224 44%, #081527 100%);
          padding: 28px 18px 56px;
        }

        .team-bg-orb {
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
          filter: blur(12px);
        }

        .team-bg-orb-one {
          top: -100px;
          right: -60px;
          width: 360px;
          height: 360px;
          background: radial-gradient(circle, rgba(122, 255, 98, 0.18), rgba(122, 255, 98, 0) 68%);
        }

        .team-bg-orb-two {
          top: 60px;
          left: -100px;
          width: 320px;
          height: 320px;
          background: radial-gradient(circle, rgba(37, 91, 227, 0.18), rgba(37, 91, 227, 0) 70%);
        }

        .team-grid-glow {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0));
          pointer-events: none;
        }

        .site-header {
          position: relative;
          z-index: 2;
          max-width: 1240px;
          margin: 0 auto 18px;
        }

        .site-header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          flex-wrap: wrap;
        }

        .brand-wrap {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
        }

        .brand-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(37, 91, 227, 0.95), rgba(96, 221, 116, 0.9));
          color: #04101e;
          font-weight: 900;
          font-size: 16px;
          letter-spacing: -0.04em;
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.24);
        }

        .brand-text {
          display: flex;
          align-items: baseline;
          gap: 1px;
          font-weight: 900;
          font-size: 28px;
          letter-spacing: -0.05em;
          line-height: 1;
        }

        .brand-tenace {
          color: #f8fbff;
        }

        .brand-iq {
          background: linear-gradient(135deg, #9ef767 0%, #55d8ae 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .site-nav {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .site-nav-link {
          padding: 13px 18px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(12, 28, 52, 0.78);
          color: #e7eefb;
          text-decoration: none;
          font-weight: 800;
          font-size: 15px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .site-nav-link.is-active {
          background: linear-gradient(135deg, rgba(29, 60, 108, 0.94), rgba(25, 92, 78, 0.82));
          border-color: rgba(130, 244, 118, 0.22);
        }

        .team-hero-shell {
          position: relative;
          z-index: 2;
          max-width: 1240px;
          margin: 0 auto 18px;
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(300px, 0.72fr);
          gap: 22px;
          padding: 34px 26px;
          border-radius: 34px;
          border: 1px solid rgba(107, 162, 255, 0.18);
          background: linear-gradient(135deg, rgba(7, 29, 61, 0.96), rgba(7, 20, 39, 0.96) 56%, rgba(18, 58, 50, 0.9) 100%);
          box-shadow: 0 34px 80px rgba(0, 0, 0, 0.32);
          overflow: hidden;
        }

        .team-hero-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.85rem;
          min-width: 0;
        }

        .team-eyebrow {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          min-height: 38px;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid rgba(130, 244, 118, 0.28);
          background: rgba(89, 145, 73, 0.14);
          color: #d9e7ef;
          font-weight: 800;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 4px;
        }

        .team-title {
          margin: 0;
          color: #ffffff;
          font-size: clamp(2.35rem, 4vw, 4rem);
          line-height: 0.98;
          letter-spacing: -0.055em;
          font-weight: 900;
        }

        .team-meta {
          margin: 0;
          color: rgba(224, 234, 247, 0.84);
          font-size: 1rem;
          line-height: 1.75;
          font-weight: 500;
          max-width: 900px;
        }

        .team-hero-badges {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin-top: 0.25rem;
        }

        .team-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          padding: 0 14px;
          border-radius: 999px;
          font-size: 0.82rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 0.02em;
          border: 1px solid transparent;
        }

        .team-badge-blue {
          background: rgba(37, 91, 227, 0.16);
          color: #c7dbff;
          border-color: rgba(98, 154, 255, 0.18);
        }

        .team-badge-green {
          background: rgba(96, 221, 116, 0.14);
          color: #dffad5;
          border-color: rgba(130, 244, 118, 0.2);
        }

        .team-badge-slate {
          background: rgba(255, 255, 255, 0.08);
          color: #e8eef9;
          border-color: rgba(255, 255, 255, 0.1);
        }

        .team-actions-card {
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: linear-gradient(180deg, rgba(37, 56, 84, 0.88), rgba(21, 37, 64, 0.88));
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 1rem;
          min-height: 100%;
        }

        .team-actions-title {
          color: #ffffff;
          font-size: 1rem;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .team-actions-text {
          margin: 0;
          color: rgba(224, 234, 247, 0.76);
          line-height: 1.65;
          font-size: 0.94rem;
        }

        .team-actions-buttons {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .team-button-primary,
        .team-button-secondary,
        .team-player-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          padding: 0 16px;
          border-radius: 999px;
          text-decoration: none;
          font-weight: 800;
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
        }

        .team-button-primary {
          background: linear-gradient(135deg, #255be3 0%, #4d86ff 100%);
          color: #ffffff;
          border: 1px solid rgba(133, 171, 255, 0.3);
          box-shadow: 0 16px 32px rgba(26, 74, 196, 0.3);
        }

        .team-button-secondary,
        .team-player-link {
          background: rgba(14, 27, 49, 0.9);
          color: #ebf1fd;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .team-button-primary:hover,
        .team-button-secondary:hover,
        .team-player-link:hover,
        .site-nav-link:hover {
          transform: translateY(-1px);
        }

        .team-metric-grid {
          position: relative;
          z-index: 2;
          max-width: 1240px;
          margin: 0 auto 18px;
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 14px;
        }

        .team-main-card {
          position: relative;
          z-index: 2;
          max-width: 1240px;
          margin: 0 auto;
          min-width: 0;
          padding: 22px;
          border-radius: 30px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(180deg, rgba(11, 22, 39, 0.92), rgba(9, 18, 34, 0.96));
          box-shadow: 0 24px 56px rgba(0, 0, 0, 0.24);
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

        .team-section-kicker {
          color: #8fb7ff;
          font-weight: 800;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
        }

        .team-section-title {
          margin: 0;
          color: #f8fbff;
          font-size: 1.45rem;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .team-section-sub {
          margin-top: 0.45rem;
          color: rgba(224, 234, 247, 0.72);
          font-size: 0.94rem;
          line-height: 1.65;
          font-weight: 500;
        }

        .team-roster-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1rem;
        }

        .team-player-card,
        .team-match-card {
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(180deg, rgba(12, 25, 45, 0.94), rgba(9, 18, 34, 0.96));
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
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
          color: #f8fbff;
          font-size: 1.3rem;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .team-player-meta {
          color: #8fb7ff;
          font-size: 0.9rem;
          line-height: 1.5;
          font-weight: 700;
          margin-top: 0.35rem;
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
          color: #f8fbff;
          font-size: 1.12rem;
          line-height: 1.25;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .team-match-meta {
          margin-top: 0.35rem;
          color: rgba(224, 234, 247, 0.72);
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
          border: 1px solid transparent;
        }

        .team-result-badge.is-win {
          background: rgba(34, 197, 94, 0.14);
          color: #dcfce7;
          border-color: rgba(74, 222, 128, 0.18);
        }

        .team-result-badge.is-loss {
          background: rgba(239, 68, 68, 0.14);
          color: #fee2e2;
          border-color: rgba(248, 113, 113, 0.18);
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
          color: #b8d0ff;
          font-size: 1rem;
          line-height: 1.2;
          font-weight: 900;
        }

        .team-match-submeta {
          color: rgba(224, 234, 247, 0.72);
          font-size: 0.92rem;
          line-height: 1.5;
          font-weight: 500;
        }

        .team-state-box {
          border-radius: 1rem;
          padding: 1rem 1.05rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px dashed rgba(255, 255, 255, 0.18);
          color: #dfe8f8;
          font-size: 0.96rem;
          line-height: 1.6;
          font-weight: 600;
        }

        .team-error-box {
          border-radius: 1rem;
          padding: 1rem 1.05rem;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #fee2e2;
          font-size: 0.96rem;
          line-height: 1.6;
          font-weight: 700;
        }

        @media (max-width: 1180px) {
          .team-metric-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 980px) {
          .team-hero-shell {
            grid-template-columns: 1fr;
            padding: 26px 18px;
            gap: 18px;
          }
        }

        @media (max-width: 820px) {
          .site-header-inner {
            flex-direction: column;
            align-items: flex-start;
          }

          .team-metric-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .team-page-shell {
            padding: 22px 14px 48px;
          }

          .brand-text {
            font-size: 24px;
          }

          .site-nav-link {
            padding: 12px 15px;
            font-size: 14px;
          }

          .team-title {
            font-size: 2.2rem;
          }

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
    <div className="team-stat-card">
      <div className="team-stat-label">{label}</div>
      <div className="team-stat-value">{value}</div>

      <style jsx>{`
        .team-stat-card {
          border-radius: 22px;
          padding: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(180deg, rgba(12, 25, 45, 0.94), rgba(9, 18, 34, 0.96));
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
          min-width: 0;
        }

        .team-stat-label {
          color: rgba(224, 234, 247, 0.7);
          font-size: 0.82rem;
          margin-bottom: 0.42rem;
          font-weight: 700;
        }

        .team-stat-value {
          color: #f8fbff;
          font-size: clamp(1.4rem, 2vw, 1.85rem);
          line-height: 1.05;
          font-weight: 900;
          letter-spacing: -0.03em;
        }
      `}</style>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="team-mini-stat">
      <div className="team-mini-stat-label">{label}</div>
      <div className="team-mini-stat-value">{value}</div>

      <style jsx>{`
        .team-mini-stat {
          padding: 0.85rem 0.9rem;
          min-width: 0;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.05);
        }

        .team-mini-stat-label {
          color: rgba(224, 234, 247, 0.68);
          font-size: 0.76rem;
          margin-bottom: 0.28rem;
          font-weight: 700;
        }

        .team-mini-stat-value {
          color: #f8fbff;
          font-size: 0.98rem;
          line-height: 1.2;
          font-weight: 800;
        }
      `}</style>
    </div>
  )
}
