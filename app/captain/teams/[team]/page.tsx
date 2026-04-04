'use client'

export const dynamic = 'force-dynamic'

import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type TeamMatch = {
  id: string
  home_team: string | null
  away_team: string | null
  match_date: string | null
  match_type: 'singles' | 'doubles' | null
  winner_side: 'A' | 'B' | null
  score: string | null
  flight?: string | null
  league_name?: string | null
  usta_section?: string | null
  district_area?: string | null
}

type Player = {
  id: string
  name: string
  singles_dynamic_rating: number | null
  doubles_dynamic_rating: number | null
  overall_dynamic_rating?: number | null
  location?: string | null
}

type PlayerRelation = Player | Player[] | null

type MatchPlayer = {
  match_id: string
  side: 'A' | 'B'
  player_id: string
  players: PlayerRelation
}

type RosterPlayer = Player & {
  appearances: number
  singlesAppearances: number
  doublesAppearances: number
  wins: number
  losses: number
}

type PairingCard = {
  key: string
  names: string[]
  appearances: number
  avgRating: number
  wins: number
  losses: number
}

function normalizePlayer(player: PlayerRelation): Player | null {
  if (!player) return null
  return Array.isArray(player) ? player[0] ?? null : player
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRating(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value.toFixed(2)
}

function teamSideForMatch(match: TeamMatch, teamName: string): 'A' | 'B' | null {
  if (match.home_team === teamName) return 'A'
  if (match.away_team === teamName) return 'B'
  return null
}

function didTeamWin(match: TeamMatch, teamName: string) {
  const side = teamSideForMatch(match, teamName)
  if (!side || !match.winner_side) return false
  return side === match.winner_side
}

function getOpponent(match: TeamMatch, teamName: string) {
  if (match.home_team === teamName) return match.away_team || 'Unknown opponent'
  if (match.away_team === teamName) return match.home_team || 'Unknown opponent'
  return 'Unknown opponent'
}

export default function TeamPage() {
  const params = useParams()
  const team = decodeURIComponent(String(params.team || ''))

  const [matches, setMatches] = useState<TeamMatch[]>([])
  const [players, setPlayers] = useState<MatchPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!team) return
    loadTeamPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team])

  async function loadTeamPage() {
    setLoading(true)
    setError(null)

    try {
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .or(`home_team.eq.${team},away_team.eq.${team}`)
        .order('match_date', { ascending: false })

      if (matchError) throw matchError

      const safeMatches = (matchData || []) as TeamMatch[]
      setMatches(safeMatches)

      const ids = safeMatches.map((match) => match.id)

      if (!ids.length) {
        setPlayers([])
        setLoading(false)
        return
      }

      const { data: playerData, error: playerError } = await supabase
        .from('match_players')
        .select(`
          match_id,
          side,
          player_id,
          players (*)
        `)
        .in('match_id', ids)

      if (playerError) throw playerError

      setPlayers((playerData || []) as MatchPlayer[])
    } catch (err) {
      console.error(err)
      setError('Unable to load this team page right now.')
    } finally {
      setLoading(false)
    }
  }

  const teamMeta = useMemo(() => {
    const firstWithLeague = matches.find((match) => match.league_name || match.flight || match.usta_section)
    return {
      league: firstWithLeague?.league_name || null,
      flight: firstWithLeague?.flight || null,
      section: firstWithLeague?.usta_section || null,
      district: firstWithLeague?.district_area || null,
    }
  }, [matches])

  const recentMatch = matches[0] || null

  const record = useMemo(() => {
    let wins = 0
    let losses = 0

    matches.forEach((match) => {
      if (didTeamWin(match, team)) wins += 1
      else losses += 1
    })

    return { wins, losses }
  }, [matches, team])

  const roster = useMemo<RosterPlayer[]>(() => {
    const map = new Map<string, RosterPlayer>()
    const matchLookup = new Map(matches.map((match) => [match.id, match]))

    players.forEach((entry) => {
      const player = normalizePlayer(entry.players)
      if (!player) return

      const match = matchLookup.get(entry.match_id)
      if (!match) return

      const teamSide = teamSideForMatch(match, team)
      if (!teamSide || entry.side !== teamSide) return

      if (!map.has(player.id)) {
        map.set(player.id, {
          ...player,
          appearances: 0,
          singlesAppearances: 0,
          doublesAppearances: 0,
          wins: 0,
          losses: 0,
        })
      }

      const current = map.get(player.id)!
      current.appearances += 1

      if (match.match_type === 'singles') current.singlesAppearances += 1
      if (match.match_type === 'doubles') current.doublesAppearances += 1

      if (didTeamWin(match, team)) current.wins += 1
      else current.losses += 1
    })

    return Array.from(map.values()).sort((a, b) => {
      const aOverall = a.overall_dynamic_rating ?? Math.max(a.singles_dynamic_rating ?? 0, a.doubles_dynamic_rating ?? 0)
      const bOverall = b.overall_dynamic_rating ?? Math.max(b.singles_dynamic_rating ?? 0, b.doubles_dynamic_rating ?? 0)
      return bOverall - aOverall
    })
  }, [matches, players, team])

  const bestSingles = useMemo(() => {
    return [...roster]
      .sort((a, b) => (b.singles_dynamic_rating || 0) - (a.singles_dynamic_rating || 0))
      .slice(0, 6)
  }, [roster])

  const bestDoubles = useMemo(() => {
    return [...roster]
      .sort((a, b) => (b.doubles_dynamic_rating || 0) - (a.doubles_dynamic_rating || 0))
      .slice(0, 6)
  }, [roster])

  const pairings = useMemo<PairingCard[]>(() => {
    const byMatch = new Map<string, MatchPlayer[]>()

    players.forEach((entry) => {
      if (!byMatch.has(entry.match_id)) {
        byMatch.set(entry.match_id, [])
      }
      byMatch.get(entry.match_id)!.push(entry)
    })

    const pairMap = new Map<string, PairingCard>()

    matches.forEach((match) => {
      if (match.match_type !== 'doubles') return

      const teamSide = teamSideForMatch(match, team)
      if (!teamSide) return

      const entries = (byMatch.get(match.id) || []).filter((entry) => entry.side === teamSide)
      if (entries.length < 2) return

      const normalized = entries
        .map((entry) => normalizePlayer(entry.players))
        .filter((player): player is Player => Boolean(player))
        .slice(0, 2)

      if (normalized.length < 2) return

      const sortedPlayers = [...normalized].sort((a, b) => a.name.localeCompare(b.name))
      const key = sortedPlayers.map((player) => player.id).join('-')
      const avgRating =
        sortedPlayers.reduce((sum, player) => sum + (player.doubles_dynamic_rating || 0), 0) / sortedPlayers.length

      if (!pairMap.has(key)) {
        pairMap.set(key, {
          key,
          names: sortedPlayers.map((player) => player.name),
          appearances: 0,
          avgRating,
          wins: 0,
          losses: 0,
        })
      }

      const pair = pairMap.get(key)!
      pair.appearances += 1
      pair.avgRating = avgRating

      if (didTeamWin(match, team)) pair.wins += 1
      else pair.losses += 1
    })

    return Array.from(pairMap.values()).sort((a, b) => {
      if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating
      return b.appearances - a.appearances
    })
  }, [matches, players, team])

  const matchCards = useMemo(() => {
    return matches.map((match) => {
      const won = didTeamWin(match, team)
      const opponent = getOpponent(match, team)
      const isHome = match.home_team === team

      return {
        ...match,
        won,
        opponent,
        venueLabel: isHome ? 'Home' : 'Away',
      }
    })
  }, [matches, team])

  const captainLinks = [
    {
      title: 'Availability',
      description: 'Track who is in, out, and on the bubble before lineup lock.',
      href: `/captain/availability?team=${encodeURIComponent(team)}`,
    },
    {
      title: 'Lineup Builder',
      description: 'Build stronger singles and doubles combinations around your core.',
      href: `/captain/lineup-builder?team=${encodeURIComponent(team)}`,
    },
    {
      title: 'Scenario Compare',
      description: 'Stress-test alternate lineups and compare projected outcomes.',
      href: `/captain/scenario-comparison?team=${encodeURIComponent(team)}`,
    },
  ]

  if (loading) {
    return (
      <main className="page-shell">
        <header className="site-header">
          <Link href="/" className="brand">
            <Image src="/logo-icon.png" width={36} height={36} alt="TenAceIQ" />
            <span>
              TenAce<span className="iq">IQ</span>
            </span>
          </Link>
        </header>

        <section className="hero-panel">
          <div className="hero-inner">
            <p className="section-kicker">Team Intelligence</p>
            <h1>Loading team page...</h1>
            <p>Pulling roster, matches, and lineup context.</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <Link href="/" className="brand">
          <Image src="/logo-icon.png" width={36} height={36} alt="TenAceIQ" />
          <span>
            TenAce<span className="iq">IQ</span>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          <Link href="/">Home</Link>
          <Link href="/players">Players</Link>
          <Link href="/rankings">Rankings</Link>
          <Link href="/matchup">Matchup</Link>
          <Link href="/leagues">Leagues</Link>
          <Link href="/teams">Teams</Link>
          <Link href="/captain">Captain&apos;s Corner</Link>
        </nav>
      </header>

      <section className="hero-panel">
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="section-kicker">Team Intelligence</p>
            <h1>{team || 'Team Detail'}</h1>
            <p>
              Full roster, recent form, top singles strength, doubles chemistry, and captain workflow tools in one
              place.
            </p>

            <div className="hero-badge-row">
              {teamMeta.league ? <span className="badge badge-blue">{teamMeta.league}</span> : null}
              {teamMeta.flight ? <span className="badge badge-green">{teamMeta.flight}</span> : null}
              {teamMeta.section ? <span className="badge">{teamMeta.section}</span> : null}
              <span className="badge">{matches.length} matches tracked</span>
            </div>

            <div className="hero-actions">
              <Link className="button-primary" href={`/captain/lineup-builder?team=${encodeURIComponent(team)}`}>
                Open lineup builder
              </Link>
              <Link className="button-secondary" href={`/captain/availability?team=${encodeURIComponent(team)}`}>
                Check availability
              </Link>
              <Link className="button-ghost" href="/teams">
                Back to teams
              </Link>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <section className="section">
          <div className="surface-card">
            <h2 className="section-title">Something went wrong</h2>
            <p>{error}</p>
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="metric-grid">
          <article className="metric-card">
            <span className="metric-label">Record</span>
            <strong className="metric-value">
              {record.wins}-{record.losses}
            </strong>
            <span className="metric-subtle">Wins / losses tracked</span>
          </article>

          <article className="metric-card">
            <span className="metric-label">Roster Size</span>
            <strong className="metric-value">{roster.length}</strong>
            <span className="metric-subtle">Players who have appeared</span>
          </article>

          <article className="metric-card">
            <span className="metric-label">Matches</span>
            <strong className="metric-value">{matches.length}</strong>
            <span className="metric-subtle">Singles and doubles logged</span>
          </article>

          <article className="metric-card">
            <span className="metric-label">Latest Match</span>
            <strong className="metric-value">{formatDate(recentMatch?.match_date)}</strong>
            <span className="metric-subtle">
              {recentMatch ? `vs ${getOpponent(recentMatch, team)}` : 'No recent match yet'}
            </span>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="card-grid">
          <article className="surface-card surface-card-strong">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">Singles Core</p>
                <h2 className="section-title">Top Singles Options</h2>
              </div>
            </div>

            {bestSingles.length ? (
              <div className="stack-list">
                {bestSingles.map((player, index) => (
                  <div key={player.id} className="list-row">
                    <div>
                      <strong>
                        {index + 1}. {player.name}
                      </strong>
                      <div className="muted-text">
                        {player.singlesAppearances} singles starts · {player.wins}-{player.losses} record
                      </div>
                    </div>
                    <span className="badge badge-blue">{formatRating(player.singles_dynamic_rating)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No singles data available yet.</p>
            )}
          </article>

          <article className="surface-card surface-card-strong">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">Doubles Chemistry</p>
                <h2 className="section-title">Best Pairs</h2>
              </div>
            </div>

            {pairings.length ? (
              <div className="stack-list">
                {pairings.slice(0, 6).map((pair) => (
                  <div key={pair.key} className="list-row">
                    <div>
                      <strong>{pair.names.join(' / ')}</strong>
                      <div className="muted-text">
                        {pair.appearances} matches together · {pair.wins}-{pair.losses} record
                      </div>
                    </div>
                    <span className="badge badge-green">{pair.avgRating.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No doubles pairings available yet.</p>
            )}
          </article>
        </div>
      </section>

      <section className="section">
        <div className="card-grid">
          <article className="surface-card">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">Captain Tools</p>
                <h2 className="section-title">Next Best Actions</h2>
              </div>
            </div>

            <div className="stack-list">
              {captainLinks.map((item) => (
                <Link key={item.title} href={item.href} className="list-link-card">
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </Link>
              ))}
            </div>
          </article>

          <article className="surface-card">
            <div className="section-heading-row">
              <div>
                <p className="section-kicker">Depth View</p>
                <h2 className="section-title">Top Doubles Players</h2>
              </div>
            </div>

            {bestDoubles.length ? (
              <div className="stack-list">
                {bestDoubles.map((player, index) => (
                  <div key={player.id} className="list-row">
                    <div>
                      <strong>
                        {index + 1}. {player.name}
                      </strong>
                      <div className="muted-text">
                        {player.doublesAppearances} doubles starts · {player.wins}-{player.losses} record
                      </div>
                    </div>
                    <span className="badge">{formatRating(player.doubles_dynamic_rating)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No doubles depth data available yet.</p>
            )}
          </article>
        </div>
      </section>

      <section className="section">
        <div className="surface-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Recent Form</p>
              <h2 className="section-title">Match History</h2>
            </div>
          </div>

          {matchCards.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    <th>Venue</th>
                    <th>Format</th>
                    <th>Score</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {matchCards.map((match) => (
                    <tr key={match.id}>
                      <td>{formatDate(match.match_date)}</td>
                      <td>{match.opponent}</td>
                      <td>{match.venueLabel}</td>
                      <td>{match.match_type ? match.match_type[0].toUpperCase() + match.match_type.slice(1) : '—'}</td>
                      <td>{match.score || '—'}</td>
                      <td>
                        <span className={`badge ${match.won ? 'badge-green' : 'badge-blue'}`}>
                          {match.won ? 'Win' : 'Loss'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">No team matches found yet.</p>
          )}
        </div>
      </section>

      <section className="section">
        <div className="surface-card">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Roster</p>
              <h2 className="section-title">Player Breakdown</h2>
            </div>
          </div>

          {roster.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Singles</th>
                    <th>Doubles</th>
                    <th>Appearances</th>
                    <th>Record</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((player) => (
                    <tr key={player.id}>
                      <td>
                        <div style={{ display: 'grid', gap: 4 }}>
                          <Link href={`/players/${player.id}`}>
                            <strong>{player.name}</strong>
                          </Link>
                          {player.location ? <span className="muted-text">{player.location}</span> : null}
                        </div>
                      </td>
                      <td>{formatRating(player.singles_dynamic_rating)}</td>
                      <td>{formatRating(player.doubles_dynamic_rating)}</td>
                      <td>{player.appearances}</td>
                      <td>
                        {player.wins}-{player.losses}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">No roster data available for this team yet.</p>
          )}
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-brand">
          <Link href="/" className="brand">
            <Image src="/logo-icon.png" width={30} height={30} alt="TenAceIQ" />
            <span>
              TenAce<span className="iq">IQ</span>
            </span>
          </Link>
          <p>Know more. Plan better. Compete smarter.</p>
        </div>

        <div className="footer-links">
          <Link href="/players">Players</Link>
          <Link href="/rankings">Rankings</Link>
          <Link href="/matchup">Matchup</Link>
          <Link href="/leagues">Leagues</Link>
          <Link href="/teams">Teams</Link>
          <Link href="/captain">Captain&apos;s Corner</Link>
        </div>
      </footer>
    </main>
  )
}