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

  if (loading) {
    return (
      <main className="page-shell-tight player-profile-page">
        <section className="hero-panel">
          <div className="hero-inner">
            <div className="surface-card panel-pad player-loading-card">
              <div className="section-kicker">Player Profile</div>
              <h1 className="player-loading-title">Loading player profile...</h1>
              <p className="player-loading-text">Pulling ratings, snapshots, and recent match history.</p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  if (error || !player) {
    return (
      <main className="page-shell-tight player-profile-page">
        <div className="player-top-links">
          <Link href="/" className="button-ghost">Home</Link>
          <Link href="/rankings" className="button-ghost">Rankings</Link>
        </div>

        <section className="surface-card panel-pad player-error-card">
          <div className="section-kicker">Player Profile</div>
          <h1 className="player-error-title">Unable to load player</h1>
          <p className="player-error-text">{error || 'Player not found'}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="page-shell-tight player-profile-page">
      <div className="player-top-links">
        <Link href="/" className="button-ghost">Home</Link>
        <Link href="/rankings" className="button-ghost">Rankings</Link>
        <Link href="/matchup" className="button-ghost">Matchup</Link>
        <Link href="/admin" className="button-ghost">Admin</Link>
      </div>

      <section className="hero-panel player-hero-panel">
        <div className="hero-inner player-hero-inner">
          <div className="player-hero-copy">
            <div className="section-kicker player-kicker">Player Profile</div>
            <h1 className="player-hero-title">{player.name}</h1>
            <p className="player-hero-location">{player.location || 'No location set'}</p>

            <div className="player-hero-meta">
              <span className="badge badge-blue">{capitalize(ratingView)} view</span>
              <span className="badge badge-slate">{totalMatches} matches</span>
              <span className={`badge ${wins >= losses ? 'badge-green' : 'badge-blue'}`}>
                {winPct}% win rate
              </span>
            </div>
          </div>

          <div className="glass-card panel-pad player-view-card">
            <div className="player-view-title">Rating focus</div>
            <div className="player-segment-wrap">
              <button
                onClick={() => setRatingView('overall')}
                className={`player-segment-btn ${ratingView === 'overall' ? 'is-active' : ''}`}
              >
                Overall
              </button>
              <button
                onClick={() => setRatingView('singles')}
                className={`player-segment-btn ${ratingView === 'singles' ? 'is-active' : ''}`}
              >
                Singles
              </button>
              <button
                onClick={() => setRatingView('doubles')}
                className={`player-segment-btn ${ratingView === 'doubles' ? 'is-active' : ''}`}
              >
                Doubles
              </button>
            </div>

            <div className="player-view-summary">
              <div className="player-view-summary-label">Current {capitalize(ratingView)} dynamic rating</div>
              <div className="player-view-summary-value">{selectedDynamicRating.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="metric-grid player-metric-grid">
        <div className="metric-card">
          <div className="player-metric-label">Current {capitalize(ratingView)} Rating</div>
          <div className="player-metric-value">{selectedDynamicRating.toFixed(2)}</div>
        </div>

        <div className="metric-card">
          <div className="player-metric-label">Overall</div>
          <div className="player-metric-value">
            {formatRating(toRatingNumber(player.overall_dynamic_rating, 3.5))}
          </div>
        </div>

        <div className="metric-card">
          <div className="player-metric-label">Singles</div>
          <div className="player-metric-value">
            {formatRating(
              toRatingNumber(player.singles_dynamic_rating ?? player.overall_dynamic_rating, 3.5)
            )}
          </div>
        </div>

        <div className="metric-card">
          <div className="player-metric-label">Doubles</div>
          <div className="player-metric-value">
            {formatRating(
              toRatingNumber(player.doubles_dynamic_rating ?? player.overall_dynamic_rating, 3.5)
            )}
          </div>
        </div>

        <div className="metric-card">
          <div className="player-metric-label">Wins</div>
          <div className="player-metric-value">{wins}</div>
        </div>

        <div className="metric-card">
          <div className="player-metric-label">Losses</div>
          <div className="player-metric-value">{losses}</div>
        </div>

        <div className="metric-card">
          <div className="player-metric-label">Win %</div>
          <div className="player-metric-value">{winPct}%</div>
        </div>

        <div className="metric-card">
          <div className="player-metric-label">Matches</div>
          <div className="player-metric-value">{totalMatches}</div>
        </div>
      </section>

      <section className="card-grid player-content-grid">
        <div className="surface-card panel-pad player-chart-card">
          <div className="player-section-head">
            <div>
              <div className="section-kicker">Trend</div>
              <h2 className="player-section-title">{capitalize(ratingView)} Rating Trend</h2>
            </div>
            <span className="badge badge-slate">{chartPoints.length} points</span>
          </div>

          {chartPoints.length === 0 ? (
            <p className="player-empty-text">No rating history yet.</p>
          ) : (
            <SimpleLineChart points={chartPoints} />
          )}
        </div>

        <div className="surface-card panel-pad player-history-card">
          <div className="player-section-head">
            <div>
              <div className="section-kicker">Recent Results</div>
              <h2 className="player-section-title">{capitalize(ratingView)} Match History</h2>
            </div>
            <span className="badge badge-blue">Latest 10</span>
          </div>

          {mostRecentMatches.length === 0 ? (
            <p className="player-empty-text">No matches found for this view.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
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
                      <td>{match.date}</td>
                      <td>{capitalize(match.matchType)}</td>
                      <td>{match.partner || '—'}</td>
                      <td>{match.opponent}</td>
                      <td>{match.score}</td>
                      <td>
                        <span
                          className={`player-result-pill ${
                            match.result === 'W' ? 'is-win' : 'is-loss'
                          }`}
                        >
                          {match.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <style jsx>{`
        .player-profile-page {
          padding-top: 1.25rem;
          padding-bottom: 2.5rem;
        }

        .player-top-links {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .player-hero-panel {
          overflow: hidden;
        }

        .player-hero-inner {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(280px, 360px);
          gap: 1rem;
          align-items: stretch;
        }

        .player-hero-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.85rem;
        }

        .player-kicker {
          color: rgba(217, 231, 255, 0.82);
        }

        .player-hero-title {
          margin: 0;
          color: #ffffff;
          font-size: clamp(2rem, 4vw, 3.2rem);
          line-height: 1;
          letter-spacing: -0.04em;
          font-weight: 900;
        }

        .player-hero-location {
          margin: 0;
          color: rgba(219, 234, 254, 0.9);
          font-size: 1.02rem;
          line-height: 1.6;
          font-weight: 600;
        }

        .player-hero-meta {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin-top: 0.2rem;
        }

        .player-view-card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 1rem;
        }

        .player-view-title {
          color: #ffffff;
          font-size: 0.95rem;
          font-weight: 800;
        }

        .player-segment-wrap {
          display: flex;
          gap: 0.55rem;
          flex-wrap: wrap;
          padding: 0.4rem;
          border-radius: 1rem;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .player-segment-btn {
          border: 0;
          border-radius: 0.8rem;
          background: transparent;
          color: rgba(226, 236, 255, 0.9);
          padding: 0.8rem 1rem;
          font-size: 0.92rem;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }

        .player-segment-btn:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .player-segment-btn.is-active {
          background: linear-gradient(135deg, #56d8ae 0%, #b8e61a 100%);
          color: #07152f;
          box-shadow: 0 12px 26px rgba(184, 230, 26, 0.22);
        }

        .player-view-summary {
          padding: 1rem 1rem 1.05rem;
          border-radius: 1rem;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .player-view-summary-label {
          color: rgba(217, 231, 255, 0.82);
          font-size: 0.8rem;
          font-weight: 700;
          line-height: 1.5;
        }

        .player-view-summary-value {
          margin-top: 0.35rem;
          color: #ffffff;
          font-size: 2rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .player-metric-grid {
          margin-top: 1rem;
          margin-bottom: 1rem;
        }

        .player-metric-label {
          color: #64748b;
          font-size: 0.82rem;
          margin-bottom: 0.4rem;
          font-weight: 700;
        }

        .player-metric-value {
          color: #0f172a;
          font-size: clamp(1.5rem, 2vw, 1.9rem);
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .player-content-grid {
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        .player-chart-card,
        .player-history-card {
          min-width: 0;
        }

        .player-section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .player-section-title {
          margin: 0.25rem 0 0;
          color: #0f172a;
          font-size: 1.35rem;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .player-empty-text {
          margin: 0;
          color: #64748b;
          font-size: 0.96rem;
          line-height: 1.7;
          font-weight: 500;
        }

        .player-result-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2.25rem;
          padding: 0.35rem 0.55rem;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 900;
          letter-spacing: 0.02em;
        }

        .player-result-pill.is-win {
          background: rgba(34, 197, 94, 0.12);
          color: #166534;
        }

        .player-result-pill.is-loss {
          background: rgba(239, 68, 68, 0.12);
          color: #991b1b;
        }

        .player-loading-card,
        .player-error-card {
          margin-top: 0.25rem;
        }

        .player-loading-title,
        .player-error-title {
          margin: 0.2rem 0 0;
          color: #0f172a;
          font-size: clamp(1.6rem, 3vw, 2.2rem);
          line-height: 1.1;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .player-loading-text,
        .player-error-text {
          margin: 0.8rem 0 0;
          color: #64748b;
          font-size: 0.98rem;
          line-height: 1.7;
          font-weight: 500;
        }

        @media (max-width: 900px) {
          .player-hero-inner {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}

function SimpleLineChart({
  points,
}: {
  points: Array<{ x: number; date: string; rating: number }>
}) {
  const width = 900
  const height = 260
  const padding = 32

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
    <div className="player-chart-wrap">
      <svg width={width} height={height} className="player-chart-svg">
        <defs>
          <linearGradient id="playerLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#255BE3" />
            <stop offset="55%" stopColor="#3FA7FF" />
            <stop offset="100%" stopColor="#B8E61A" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} fill="#f8fbff" rx="18" />
        <path d={path} fill="none" stroke="url(#playerLineGradient)" strokeWidth="4" strokeLinecap="round" />
        {points.map((point, index) => {
          const x = padding + index * xStep
          const y =
            height - padding - ((point.rating - minRating) / spread) * (height - padding * 2)

          return (
            <g key={`${point.date}-${index}`}>
              <circle cx={x} cy={y} r="5" fill="#255BE3" />
              <circle cx={x} cy={y} r="9" fill="rgba(37, 91, 227, 0.12)" />
            </g>
          )
        })}
      </svg>

      <div className="player-chart-meta">
        {points.length} data point{points.length === 1 ? '' : 's'} • Latest:{' '}
        {points[points.length - 1]?.rating.toFixed(2)}
      </div>

      <style jsx>{`
        .player-chart-wrap {
          overflow-x: auto;
        }

        .player-chart-svg {
          width: 100%;
          height: auto;
          display: block;
        }

        .player-chart-meta {
          margin-top: 0.8rem;
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}

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