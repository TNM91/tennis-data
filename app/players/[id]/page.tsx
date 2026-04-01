'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type RatingView = 'overall' | 'singles' | 'doubles'
type MatchType = 'singles' | 'doubles'
type MatchSide = 'A' | 'B'

type Player = {
  id: string
  name: string
  location?: string | null
  overall_rating?: number | string | null
  overall_dynamic_rating?: number | null
  singles_rating?: number | string | null
  singles_dynamic_rating?: number | null
  doubles_rating?: number | string | null
  doubles_dynamic_rating?: number | null
}

type MatchRecord = {
  id: string
  date: string
  matchType: MatchType
  score: string
  result: 'W' | 'L'
  opponent: string
  partner: string | null
  sideA: string[]
  sideB: string[]
}

type SnapshotRow = {
  id: string
  player_id: string
  match_id: string
  snapshot_date: string
  rating_type?: RatingView | null
  dynamic_rating: number
}

type MatchRow = {
  id: string
  match_date: string
  match_type: MatchType
  score: string
  winner_side: MatchSide
}

type MatchPlayerRow = {
  match_id: string
  player_id: string
  side: MatchSide
  seat: number | null
  players: {
    id: string
    name: string
  } | null
}

const siteNav = [
  { href: '/', label: 'Home' },
  { href: '/players', label: 'Players' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/matchup', label: 'Matchup' },
  { href: '/leagues', label: 'Leagues' },
  { href: '/captains-corner', label: "Captain's Corner" },
  { href: '/admin', label: 'Admin' },
] as const

export default function PlayerProfilePage() {
  const params = useParams()
  const playerId = String(params.id)

  const [player, setPlayer] = useState<Player | null>(null)
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ratingView, setRatingView] = useState<RatingView>('overall')

  useEffect(() => {
    if (playerId) {
      void loadPlayerProfile()
    }
  }, [playerId])

  async function loadPlayerProfile() {
    setLoading(true)
    setError('')

    try {
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select(`
          id,
          name,
          location,
          overall_rating,
          overall_dynamic_rating,
          singles_rating,
          singles_dynamic_rating,
          doubles_rating,
          doubles_dynamic_rating
        `)
        .eq('id', playerId)
        .single()

      if (playerError) {
        throw new Error(playerError.message)
      }

      const { data: playerMatchRefs, error: playerMatchRefsError } = await supabase
        .from('match_players')
        .select('match_id')
        .eq('player_id', playerId)

      if (playerMatchRefsError) {
        throw new Error(playerMatchRefsError.message)
      }

      const matchIds = [...new Set((playerMatchRefs || []).map((row) => row.match_id))]

      let matchRows: MatchRow[] = []
      let participantRows: MatchPlayerRow[] = []

      if (matchIds.length > 0) {
        const { data: matchesData, error: matchesError } = await supabase
          .from('matches')
          .select(`
            id,
            match_date,
            match_type,
            score,
            winner_side
          `)
          .in('id', matchIds)
          .order('match_date', { ascending: false })
          .order('id', { ascending: false })

        if (matchesError) {
          throw new Error(matchesError.message)
        }

        matchRows = (matchesData || []) as MatchRow[]

        const { data: participantsData, error: participantsError } = await supabase
          .from('match_players')
          .select(`
            match_id,
            player_id,
            side,
            seat,
            players (
              id,
              name
            )
          `)
          .in('match_id', matchIds)

        if (participantsError) {
          throw new Error(participantsError.message)
        }

        participantRows = (participantsData || []) as unknown as MatchPlayerRow[]
      }

      const participantsByMatchId = new Map<string, MatchPlayerRow[]>()

      for (const row of participantRows) {
        const existing = participantsByMatchId.get(row.match_id) ?? []
        existing.push(row)
        participantsByMatchId.set(row.match_id, existing)
      }

      const groupedMatches: MatchRecord[] = matchRows.map((match) => {
        const participants = participantsByMatchId.get(match.id) ?? []

        const sideA = participants
          .filter((p) => p.side === 'A')
          .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))

        const sideB = participants
          .filter((p) => p.side === 'B')
          .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))

        const playerOnSideA = sideA.some((p) => p.player_id === playerId)
        const playerSide: MatchSide = playerOnSideA ? 'A' : 'B'
        const opponentSide: MatchSide = playerSide === 'A' ? 'B' : 'A'

        const playerTeam = (playerSide === 'A' ? sideA : sideB).map(
          (p) => p.players?.name || 'Unknown Player'
        )
        const opponentTeam = (opponentSide === 'A' ? sideA : sideB).map(
          (p) => p.players?.name || 'Unknown Player'
        )

        const partnerNames = playerTeam.filter(
          (name) => normalizeName(name).toLowerCase() !== normalizeName(playerData.name).toLowerCase()
        )

        const isWin =
          (playerSide === 'A' && match.winner_side === 'A') ||
          (playerSide === 'B' && match.winner_side === 'B')

        return {
          id: match.id,
          date: match.match_date,
          matchType: normalizeMatchType(match.match_type),
          score: match.score,
          result: isWin ? 'W' : 'L',
          opponent: opponentTeam.join(' / '),
          partner: partnerNames.length > 0 ? partnerNames.join(' / ') : null,
          sideA: sideA.map((p) => p.players?.name || 'Unknown Player'),
          sideB: sideB.map((p) => p.players?.name || 'Unknown Player'),
        }
      })

      const { data: snapshotsData, error: snapshotsError } = await supabase
        .from('rating_snapshots')
        .select('id, player_id, match_id, snapshot_date, rating_type, dynamic_rating')
        .eq('player_id', playerId)
        .order('snapshot_date', { ascending: true })
        .order('id', { ascending: true })

      if (snapshotsError) {
        throw new Error(snapshotsError.message)
      }

      setPlayer(playerData as Player)
      setMatches(groupedMatches)
      setSnapshots((snapshotsData || []) as SnapshotRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load player profile')
    } finally {
      setLoading(false)
    }
  }

  const filteredMatches = useMemo(() => {
    if (ratingView === 'overall') return matches
    return matches.filter((match) => match.matchType === ratingView)
  }, [matches, ratingView])

  const wins = useMemo(
    () => filteredMatches.filter((match) => match.result === 'W').length,
    [filteredMatches]
  )

  const losses = useMemo(
    () => filteredMatches.filter((match) => match.result === 'L').length,
    [filteredMatches]
  )

  const totalMatches = filteredMatches.length
  const winPct = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : '0.0'
  const mostRecentMatches = useMemo(() => filteredMatches.slice(0, 10), [filteredMatches])

  const chartPoints = useMemo(() => {
    const relevantSnapshots =
      ratingView === 'overall'
        ? snapshots.filter((snapshot) => !snapshot.rating_type || snapshot.rating_type === 'overall')
        : snapshots.filter((snapshot) => snapshot.rating_type === ratingView)

    return relevantSnapshots.map((snapshot, index) => ({
      x: index + 1,
      date: snapshot.snapshot_date,
      rating: snapshot.dynamic_rating,
    }))
  }, [snapshots, ratingView])

  const selectedDynamicRating = useMemo(() => {
    if (!player) return 3.5

    if (ratingView === 'singles') {
      return toRatingNumber(player.singles_dynamic_rating ?? player.overall_dynamic_rating, 3.5)
    }

    if (ratingView === 'doubles') {
      return toRatingNumber(player.doubles_dynamic_rating ?? player.overall_dynamic_rating, 3.5)
    }

    return toRatingNumber(player.overall_dynamic_rating, 3.5)
  }, [player, ratingView])

  const staticOverall = useMemo(() => toRatingNumber(player?.overall_rating, 3.5), [player])
  const staticSingles = useMemo(
    () => toRatingNumber(player?.singles_rating ?? player?.overall_rating, 3.5),
    [player]
  )
  const staticDoubles = useMemo(
    () => toRatingNumber(player?.doubles_rating ?? player?.overall_rating, 3.5),
    [player]
  )

  if (loading) {
    return (
      <main className="page-shell-tight player-page-shell">
        <SiteHeader />

        <section className="player-hero-card is-loading">
          <div className="player-hero-grid">
            <div className="player-hero-copy">
              <div className="player-kicker">Player profile</div>
              <h1 className="player-name">Loading player profile...</h1>
              <p className="player-location">Pulling ratings, trend data, and recent results.</p>
            </div>
          </div>
        </section>

        <style jsx>{baseStyles}</style>
      </main>
    )
  }

  if (error || !player) {
    return (
      <main className="page-shell-tight player-page-shell">
        <SiteHeader />

        <section className="player-hero-card player-error-state">
          <div className="player-kicker">Player profile</div>
          <h1 className="player-name">Unable to load player</h1>
          <p className="player-location">{error || 'Player not found.'}</p>
        </section>

        <style jsx>{baseStyles}</style>
      </main>
    )
  }

  return (
    <main className="page-shell-tight player-page-shell">
      <SiteHeader />

      <section className="player-hero-card">
        <div className="player-hero-grid">
          <div className="player-hero-copy">
            <div className="player-kicker">Player profile</div>
            <h1 className="player-name">{player.name}</h1>
            <p className="player-location">{player.location || 'Location not set'}</p>

            <div className="player-meta-row">
              <span className="player-chip player-chip-green">{capitalize(ratingView)} view</span>
              <span className="player-chip">{totalMatches} matches</span>
              <span className="player-chip">{winPct}% win rate</span>
            </div>
          </div>

          <div className="player-focus-card">
            <div className="player-focus-head">
              <div>
                <div className="player-focus-label">Rating focus</div>
                <div className="player-focus-subtitle">
                  Switch between overall, singles, and doubles.
                </div>
              </div>
            </div>

            <div className="player-segment-wrap">
              <button
                type="button"
                onClick={() => setRatingView('overall')}
                className={`player-segment-btn ${ratingView === 'overall' ? 'is-active' : ''}`}
              >
                Overall
              </button>
              <button
                type="button"
                onClick={() => setRatingView('singles')}
                className={`player-segment-btn ${ratingView === 'singles' ? 'is-active' : ''}`}
              >
                Singles
              </button>
              <button
                type="button"
                onClick={() => setRatingView('doubles')}
                className={`player-segment-btn ${ratingView === 'doubles' ? 'is-active' : ''}`}
              >
                Doubles
              </button>
            </div>

            <div className="player-focus-metrics">
              <div className="player-focus-metric">
                <span>Dynamic</span>
                <strong>{selectedDynamicRating.toFixed(2)}</strong>
              </div>
              <div className="player-focus-metric">
                <span>Static</span>
                <strong>
                  {ratingView === 'overall'
                    ? staticOverall.toFixed(2)
                    : ratingView === 'singles'
                      ? staticSingles.toFixed(2)
                      : staticDoubles.toFixed(2)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="player-stat-grid">
        <article className="player-stat-card accent-blue">
          <div className="player-stat-label">Current {capitalize(ratingView)} dynamic</div>
          <div className="player-stat-value">{selectedDynamicRating.toFixed(2)}</div>
        </article>
        <article className="player-stat-card">
          <div className="player-stat-label">Overall</div>
          <div className="player-stat-value">
            {formatRating(toRatingNumber(player.overall_dynamic_rating, 3.5))}
          </div>
        </article>
        <article className="player-stat-card">
          <div className="player-stat-label">Singles</div>
          <div className="player-stat-value">
            {formatRating(toRatingNumber(player.singles_dynamic_rating ?? player.overall_dynamic_rating, 3.5))}
          </div>
        </article>
        <article className="player-stat-card">
          <div className="player-stat-label">Doubles</div>
          <div className="player-stat-value">
            {formatRating(toRatingNumber(player.doubles_dynamic_rating ?? player.overall_dynamic_rating, 3.5))}
          </div>
        </article>
        <article className="player-stat-card">
          <div className="player-stat-label">Wins</div>
          <div className="player-stat-value">{wins}</div>
        </article>
        <article className="player-stat-card">
          <div className="player-stat-label">Losses</div>
          <div className="player-stat-value">{losses}</div>
        </article>
        <article className="player-stat-card">
          <div className="player-stat-label">Win rate</div>
          <div className="player-stat-value">{winPct}%</div>
        </article>
        <article className="player-stat-card">
          <div className="player-stat-label">Tracked matches</div>
          <div className="player-stat-value">{totalMatches}</div>
        </article>
      </section>

      <section className="player-content-grid">
        <article className="player-panel">
          <div className="player-panel-head">
            <div>
              <div className="player-kicker">Trend</div>
              <h2 className="player-panel-title">{capitalize(ratingView)} rating trend</h2>
            </div>
            <span className="player-chip">{chartPoints.length} points</span>
          </div>

          {chartPoints.length === 0 ? (
            <p className="player-empty-text">No rating history yet for this view.</p>
          ) : (
            <SimpleLineChart points={chartPoints} />
          )}
        </article>

        <article className="player-panel">
          <div className="player-panel-head">
            <div>
              <div className="player-kicker">Recent results</div>
              <h2 className="player-panel-title">Latest match history</h2>
            </div>
            <span className="player-chip">Latest 10</span>
          </div>

          {mostRecentMatches.length === 0 ? (
            <p className="player-empty-text">No matches found for this view.</p>
          ) : (
            <div className="player-table-wrap">
              <table className="player-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Partner</th>
                    <th>Opponent</th>
                    <th>Score</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {mostRecentMatches.map((match) => (
                    <tr key={match.id}>
                      <td>{formatDate(match.date)}</td>
                      <td>{capitalize(match.matchType)}</td>
                      <td>{match.partner || '—'}</td>
                      <td>{match.opponent}</td>
                      <td>{match.score}</td>
                      <td>
                        <span className={`player-result-pill ${match.result === 'W' ? 'is-win' : 'is-loss'}`}>
                          {match.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      <style jsx>{baseStyles}</style>
    </main>
  )
}

function SiteHeader() {
  return (
    <header className="site-header-shell">
      <div className="site-header-card">
        <div className="site-brand-row">
          <div>
            <p className="site-brand-kicker">TenAceIQ</p>
            <h2 className="site-brand-title">Player intelligence</h2>
          </div>
          <Link href="/players" className="site-header-cta">
            Browse players
          </Link>
        </div>

        <nav className="site-nav-row" aria-label="Primary navigation">
          {siteNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`site-nav-pill ${item.href === '/players' ? 'is-active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}

function SimpleLineChart({
  points,
}: {
  points: Array<{ x: number; date: string; rating: number }>
}) {
  const width = 920
  const height = 280
  const padding = 34

  const minRating = Math.min(...points.map((p) => p.rating))
  const maxRating = Math.max(...points.map((p) => p.rating))
  const spread = Math.max(maxRating - minRating, 0.1)
  const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0

  const path = points
    .map((point, index) => {
      const x = padding + index * xStep
      const y =
        height - padding - ((point.rating - minRating) / spread) * (height - padding * 2)

      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  return (
    <div className="chart-shell">
      <svg width={width} height={height} className="chart-svg" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="playerLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#255BE3" />
            <stop offset="55%" stopColor="#3FA7FF" />
            <stop offset="100%" stopColor="#B8E61A" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} rx="20" fill="rgba(8, 20, 44, 0.9)" />

        {[0.2, 0.4, 0.6, 0.8].map((line, index) => {
          const y = padding + (height - padding * 2) * line
          return (
            <line
              key={index}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="rgba(167, 190, 255, 0.12)"
              strokeWidth="1"
            />
          )
        })}

        <path d={path} fill="none" stroke="url(#playerLineGradient)" strokeWidth="4" strokeLinecap="round" />

        {points.map((point, index) => {
          const x = padding + index * xStep
          const y =
            height - padding - ((point.rating - minRating) / spread) * (height - padding * 2)

          return (
            <g key={`${point.date}-${index}`}>
              <circle cx={x} cy={y} r="10" fill="rgba(37, 91, 227, 0.14)" />
              <circle cx={x} cy={y} r="4.5" fill="#dff7ff" />
            </g>
          )
        })}
      </svg>

      <div className="chart-meta">
        {points.length} data point{points.length === 1 ? '' : 's'} • Latest rating{' '}
        {points[points.length - 1]?.rating.toFixed(2)}
      </div>

      <style jsx>{`
        .chart-shell {
          width: 100%;
        }

        .chart-svg {
          width: 100%;
          height: auto;
          display: block;
          overflow: visible;
        }

        .chart-meta {
          margin-top: 0.9rem;
          color: rgba(219, 230, 255, 0.78);
          font-size: 0.9rem;
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}

const baseStyles = `
  .player-page-shell {
    padding-top: 1.1rem;
    padding-bottom: 2.75rem;
  }

  .site-header-shell {
    margin-bottom: 1rem;
  }

  .site-header-card {
    position: relative;
    overflow: hidden;
    padding: 1rem;
    border-radius: 30px;
    border: 1px solid rgba(133, 168, 229, 0.16);
    background:
      radial-gradient(circle at top right, rgba(184, 230, 26, 0.12), transparent 34%),
      linear-gradient(135deg, rgba(8, 34, 75, 0.98) 0%, rgba(4, 18, 45, 0.98) 58%, rgba(7, 36, 46, 0.98) 100%);
    box-shadow: 0 28px 60px rgba(2, 8, 23, 0.28);
  }

  .site-brand-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.95rem;
  }

  .site-brand-kicker {
    margin: 0;
    color: rgba(184, 230, 26, 0.86);
    font-size: 0.82rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .site-brand-title {
    margin: 0.3rem 0 0;
    color: #f8fbff;
    font-size: clamp(1.2rem, 2.5vw, 1.7rem);
    font-weight: 900;
    letter-spacing: -0.04em;
  }

  .site-header-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0.8rem 1.05rem;
    border-radius: 999px;
    text-decoration: none;
    color: #07203c;
    font-weight: 900;
    background: linear-gradient(135deg, #60dfa3 0%, #b8e61a 100%);
    box-shadow: 0 16px 30px rgba(184, 230, 26, 0.18);
  }

  .site-nav-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .site-nav-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0.75rem 1.15rem;
    border-radius: 999px;
    text-decoration: none;
    color: rgba(241, 245, 255, 0.95);
    font-weight: 800;
    background: linear-gradient(180deg, rgba(33, 58, 98, 0.92) 0%, rgba(18, 36, 66, 0.92) 100%);
    border: 1px solid rgba(137, 170, 234, 0.2);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 30px rgba(0,0,0,0.18);
    transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
  }

  .site-nav-pill:hover {
    transform: translateY(-1px);
    border-color: rgba(184, 230, 26, 0.28);
  }

  .site-nav-pill.is-active {
    color: #07203c;
    background: linear-gradient(135deg, #60dfa3 0%, #b8e61a 100%);
    border-color: rgba(184, 230, 26, 0.36);
    box-shadow: 0 16px 30px rgba(184, 230, 26, 0.18);
  }

  .player-hero-card,
  .player-panel,
  .player-stat-card {
    position: relative;
    overflow: hidden;
    border-radius: 28px;
    border: 1px solid rgba(133, 168, 229, 0.16);
    background:
      radial-gradient(circle at top right, rgba(184, 230, 26, 0.12), transparent 34%),
      linear-gradient(135deg, rgba(8, 34, 75, 0.98) 0%, rgba(4, 18, 45, 0.98) 58%, rgba(7, 36, 46, 0.98) 100%);
    box-shadow: 0 28px 60px rgba(2, 8, 23, 0.28);
  }

  .player-hero-card {
    padding: clamp(1.35rem, 2vw, 2rem);
  }

  .player-hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(300px, 380px);
    gap: 1rem;
    align-items: stretch;
  }

  .player-hero-copy {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
  }

  .player-kicker {
    display: inline-flex;
    align-items: center;
    min-height: 38px;
    padding: 0.65rem 1rem;
    width: min(100%, 540px);
    border-radius: 999px;
    border: 1px solid rgba(184, 230, 26, 0.35);
    background: linear-gradient(90deg, rgba(152, 197, 52, 0.16) 0%, rgba(78, 205, 196, 0.08) 100%);
    color: rgba(228, 240, 255, 0.92);
    font-size: 0.88rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .player-name {
    margin: 1rem 0 0;
    color: #f8fbff;
    font-size: clamp(2.2rem, 5vw, 4rem);
    line-height: 0.98;
    letter-spacing: -0.05em;
    font-weight: 900;
  }

  .player-location {
    margin: 0.9rem 0 0;
    color: rgba(218, 231, 255, 0.88);
    font-size: 1.02rem;
    line-height: 1.6;
    font-weight: 650;
  }

  .player-meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }

  .player-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 38px;
    padding: 0.5rem 0.9rem;
    border-radius: 999px;
    background: rgba(16, 39, 77, 0.84);
    color: rgba(220, 232, 255, 0.92);
    border: 1px solid rgba(82, 127, 201, 0.2);
    font-weight: 800;
    font-size: 0.9rem;
  }

  .player-chip-green {
    background: rgba(141, 201, 44, 0.16);
    color: #d8ff9b;
    border-color: rgba(184, 230, 26, 0.24);
  }

  .player-focus-card {
    border-radius: 24px;
    padding: 1.15rem;
    border: 1px solid rgba(162, 188, 235, 0.16);
    background: linear-gradient(180deg, rgba(37, 60, 92, 0.82) 0%, rgba(20, 42, 75, 0.84) 100%);
    backdrop-filter: blur(14px);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .player-focus-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }

  .player-focus-label {
    color: #f8fbff;
    font-size: 1rem;
    font-weight: 850;
  }

  .player-focus-subtitle {
    margin-top: 0.35rem;
    color: rgba(217, 231, 255, 0.74);
    font-size: 0.9rem;
    line-height: 1.5;
    font-weight: 600;
  }

  .player-segment-wrap {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.55rem;
    padding: 0.45rem;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .player-segment-btn {
    border: 0;
    border-radius: 14px;
    background: transparent;
    color: rgba(225, 236, 255, 0.88);
    min-height: 52px;
    padding: 0.8rem 0.9rem;
    font-size: 0.95rem;
    font-weight: 850;
    cursor: pointer;
    transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
  }

  .player-segment-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .player-segment-btn.is-active {
    background: linear-gradient(135deg, #60dfa3 0%, #b8e61a 100%);
    color: #08203e;
    box-shadow: 0 16px 30px rgba(184, 230, 26, 0.18);
  }

  .player-focus-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .player-focus-metric {
    padding: 0.95rem 1rem;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .player-focus-metric span {
    display: block;
    color: rgba(217, 231, 255, 0.78);
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .player-focus-metric strong {
    display: block;
    margin-top: 0.35rem;
    color: #ffffff;
    font-size: 2rem;
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.04em;
  }

  .player-stat-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .player-stat-card {
    padding: 1.15rem 1.2rem;
    min-width: 0;
  }

  .player-stat-card.accent-blue {
    border-color: rgba(91, 162, 255, 0.26);
    box-shadow: 0 28px 60px rgba(2, 8, 23, 0.32), inset 0 0 0 1px rgba(59, 130, 246, 0.08);
  }

  .player-stat-label {
    color: rgba(198, 216, 248, 0.78);
    font-size: 0.82rem;
    line-height: 1.5;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .player-stat-value {
    margin-top: 0.5rem;
    color: #f8fbff;
    font-size: clamp(1.8rem, 2vw, 2.15rem);
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.04em;
  }

  .player-content-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    margin-top: 1rem;
  }

  .player-panel {
    padding: 1.25rem;
    min-width: 0;
  }

  .player-panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .player-panel-title {
    margin: 0.3rem 0 0;
    color: #f8fbff;
    font-size: clamp(1.2rem, 2vw, 1.5rem);
    line-height: 1.15;
    font-weight: 900;
    letter-spacing: -0.03em;
  }

  .player-empty-text {
    margin: 0;
    color: rgba(220, 231, 252, 0.78);
    font-size: 0.97rem;
    line-height: 1.7;
    font-weight: 550;
  }

  .player-table-wrap {
    overflow-x: auto;
    border-radius: 20px;
    border: 1px solid rgba(160, 185, 234, 0.12);
    background: rgba(7, 20, 45, 0.62);
  }

  .player-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 760px;
  }

  .player-table thead th {
    padding: 0.95rem 1rem;
    text-align: left;
    color: rgba(190, 210, 245, 0.8);
    font-size: 0.78rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-weight: 800;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(10, 27, 58, 0.78);
    white-space: nowrap;
  }

  .player-table tbody td {
    padding: 1rem;
    color: #e9f2ff;
    font-size: 0.94rem;
    line-height: 1.5;
    font-weight: 600;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    vertical-align: top;
  }

  .player-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .player-result-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.4rem;
    padding: 0.35rem 0.65rem;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.04em;
  }

  .player-result-pill.is-win {
    background: rgba(95, 223, 163, 0.14);
    color: #a9ffc8;
    border: 1px solid rgba(95, 223, 163, 0.2);
  }

  .player-result-pill.is-loss {
    background: rgba(255, 107, 107, 0.14);
    color: #ffc2c2;
    border: 1px solid rgba(255, 107, 107, 0.18);
  }

  .player-error-state,
  .is-loading {
    min-height: 220px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  @media (max-width: 1120px) {
    .player-stat-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .player-hero-grid,
    .site-brand-row {
      grid-template-columns: 1fr;
      display: grid;
    }

    .site-brand-row {
      gap: 0.8rem;
    }
  }

  @media (max-width: 640px) {
    .player-page-shell {
      padding-top: 1rem;
    }

    .site-header-card {
      padding: 0.9rem;
      border-radius: 24px;
    }

    .site-nav-row {
      gap: 0.6rem;
    }

    .site-nav-pill,
    .site-header-cta {
      min-height: 42px;
      padding: 0.7rem 1rem;
      font-size: 0.95rem;
    }

    .player-hero-card,
    .player-panel,
    .player-stat-card {
      border-radius: 24px;
    }

    .player-stat-grid,
    .player-segment-wrap,
    .player-focus-metrics {
      grid-template-columns: 1fr;
    }
  }
`

function normalizeMatchType(value: string | null | undefined): MatchType {
  return value === 'doubles' ? 'doubles' : 'singles'
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function toRatingNumber(value: number | string | null | undefined, fallback = 3.5) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function formatRating(value: number) {
  return value.toFixed(2)
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatDate(value: string) {
  if (!value) return '—'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
