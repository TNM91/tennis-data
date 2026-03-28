'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type RatingView = 'overall' | 'singles' | 'doubles'

type Player = {
  id: string
  name: string
  location?: string | null
  rating?: string | number | null
  dynamic_rating?: number | null
  overall_rating?: number | string | null
  overall_dynamic_rating?: number | null
  singles_rating?: number | string | null
  singles_dynamic_rating?: number | null
  doubles_rating?: number | string | null
  doubles_dynamic_rating?: number | null
}

type MatchRow = {
  id: string
  player_id: string
  opponent_id: string | null
  opponent: string
  result: string
  date: string
  match_type?: 'singles' | 'doubles' | null
}

type SnapshotRow = {
  id: string
  player_id: string
  match_id: string
  snapshot_date: string
  dynamic_rating: number
}

export default function PlayerProfilePage() {
  const params = useParams()
  const playerId = String(params.id)

  const [player, setPlayer] = useState<Player | null>(null)
  const [matches, setMatches] = useState<MatchRow[]>([])
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
          rating,
          dynamic_rating,
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

      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('id, player_id, opponent_id, opponent, result, date, match_type')
        .eq('player_id', playerId)
        .order('date', { ascending: false })
        .order('id', { ascending: false })

      if (matchesError) {
        throw new Error(matchesError.message)
      }

      const { data: snapshotsData, error: snapshotsError } = await supabase
        .from('rating_snapshots')
        .select('id, player_id, match_id, snapshot_date, dynamic_rating')
        .eq('player_id', playerId)
        .order('snapshot_date', { ascending: true })
        .order('id', { ascending: true })

      if (snapshotsError) {
        throw new Error(snapshotsError.message)
      }

      setPlayer(playerData as Player)
      setMatches((matchesData || []) as MatchRow[])
      setSnapshots((snapshotsData || []) as SnapshotRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load player profile')
    } finally {
      setLoading(false)
    }
  }

  const filteredMatches = useMemo(() => {
    if (ratingView === 'overall') return matches
    return matches.filter((match) => normalizeMatchType(match.match_type) === ratingView)
  }, [matches, ratingView])

  const wins = useMemo(
    () => filteredMatches.filter((match) => isWin(match.result)).length,
    [filteredMatches]
  )

  const losses = useMemo(
    () => filteredMatches.filter((match) => !isWin(match.result)).length,
    [filteredMatches]
  )

  const totalMatches = filteredMatches.length
  const winPct = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : '0.0'

  const mostRecentMatches = useMemo(() => filteredMatches.slice(0, 10), [filteredMatches])

  const chartPoints = useMemo(() => {
    if (ratingView === 'overall') {
      return snapshots.map((snapshot, index) => ({
        x: index + 1,
        date: snapshot.snapshot_date,
        rating: snapshot.dynamic_rating,
      }))
    }

    const allowedMatchIds = new Set(
      matches
        .filter((match) => normalizeMatchType(match.match_type) === ratingView)
        .map((match) => match.id)
    )

    return snapshots
      .filter((snapshot) => allowedMatchIds.has(snapshot.match_id))
      .map((snapshot, index) => ({
        x: index + 1,
        date: snapshot.snapshot_date,
        rating: snapshot.dynamic_rating,
      }))
  }, [snapshots, matches, ratingView])

  const selectedDynamicRating = useMemo(() => {
    if (!player) return 3.5

    if (ratingView === 'singles') {
      return toRatingNumber(
        player.singles_dynamic_rating ??
        player.overall_dynamic_rating ??
        player.dynamic_rating ??
        player.rating,
        3.5
      )
    }

    if (ratingView === 'doubles') {
      return toRatingNumber(
        player.doubles_dynamic_rating ??
        player.overall_dynamic_rating ??
        player.dynamic_rating ??
        player.rating,
        3.5
      )
    }

    return toRatingNumber(
      player.overall_dynamic_rating ??
      player.dynamic_rating ??
      player.rating,
      3.5
    )
  }, [player, ratingView])

  if (loading) {
    return (
      <main style={mainStyle}>
        <div style={cardStyle}>Loading player profile...</div>
      </main>
    )
  }

  if (error || !player) {
    return (
      <main style={mainStyle}>
        <div style={navRowStyle}>
          <Link href="/" style={navLinkStyle}>Home</Link>
          <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
        </div>

        <div style={errorBoxStyle}>
          <p style={{ margin: 0, fontWeight: 700 }}>{error || 'Player not found'}</p>
        </div>
      </main>
    )
  }

  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
        <Link href="/add-match" style={navLinkStyle}>Add Match</Link>
        <Link href="/csv-import" style={navLinkStyle}>CSV Import</Link>
        <Link href="/paste-results" style={navLinkStyle}>Paste Results</Link>
        <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
        <Link href="/manage-matches" style={navLinkStyle}>Manage Matches</Link>
        <Link href="/manage-players" style={navLinkStyle}>Manage Players</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>{player.name}</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px' }}>
          {player.location || 'No location set'}
        </p>
      </div>

      <div style={segmentContainerStyle}>
        <button
          onClick={() => setRatingView('overall')}
          style={{
            ...segmentButtonStyle,
            ...(ratingView === 'overall' ? activeSegmentButtonStyle : {}),
          }}
        >
          Overall
        </button>
        <button
          onClick={() => setRatingView('singles')}
          style={{
            ...segmentButtonStyle,
            ...(ratingView === 'singles' ? activeSegmentButtonStyle : {}),
          }}
        >
          Singles
        </button>
        <button
          onClick={() => setRatingView('doubles')}
          style={{
            ...segmentButtonStyle,
            ...(ratingView === 'doubles' ? activeSegmentButtonStyle : {}),
          }}
        >
          Doubles
        </button>
      </div>

      <div style={statsGridStyle}>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Current {capitalize(ratingView)} Rating</div>
          <div style={statValueStyle}>{selectedDynamicRating.toFixed(2)}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Overall</div>
          <div style={statValueStyle}>
            {formatRating(
              toRatingNumber(
                player.overall_dynamic_rating ??
                player.dynamic_rating ??
                player.rating,
                3.5
              )
            )}
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Singles</div>
          <div style={statValueStyle}>
            {formatRating(
              toRatingNumber(
                player.singles_dynamic_rating ??
                player.overall_dynamic_rating ??
                player.dynamic_rating ??
                player.rating,
                3.5
              )
            )}
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Doubles</div>
          <div style={statValueStyle}>
            {formatRating(
              toRatingNumber(
                player.doubles_dynamic_rating ??
                player.overall_dynamic_rating ??
                player.dynamic_rating ??
                player.rating,
                3.5
              )
            )}
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Wins</div>
          <div style={statValueStyle}>{wins}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Losses</div>
          <div style={statValueStyle}>{losses}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Win %</div>
          <div style={statValueStyle}>{winPct}%</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Matches</div>
          <div style={statValueStyle}>{totalMatches}</div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>{capitalize(ratingView)} Rating Trend</h2>
        {chartPoints.length === 0 ? (
          <p style={{ color: '#64748b' }}>No rating history yet.</p>
        ) : (
          <SimpleLineChart points={chartPoints} />
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>{capitalize(ratingView)} Match History</h2>

        {mostRecentMatches.length === 0 ? (
          <p style={{ color: '#64748b' }}>No matches found for this view.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Opponent</th>
                  <th style={thStyle}>Result</th>
                </tr>
              </thead>
              <tbody>
                {mostRecentMatches.map((match) => (
                  <tr key={match.id}>
                    <td style={tdStyle}>{match.date}</td>
                    <td style={tdStyle}>{capitalize(normalizeMatchType(match.match_type))}</td>
                    <td style={tdStyle}>{match.opponent}</td>
                    <td
                      style={{
                        ...tdStyle,
                        color: isWin(match.result) ? '#166534' : '#991b1b',
                        fontWeight: 700,
                      }}
                    >
                      {match.result}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height} style={{ width: '100%', height: 'auto' }}>
        <rect x="0" y="0" width={width} height={height} fill="#f8fafc" rx="16" />
        <path d={path} fill="none" stroke="#2563eb" strokeWidth="3" />
        {points.map((point, index) => {
          const x = padding + index * xStep
          const y =
            height - padding - ((point.rating - minRating) / spread) * (height - padding * 2)

          return (
            <g key={`${point.date}-${index}`}>
              <circle cx={x} cy={y} r="4" fill="#1d4ed8" />
            </g>
          )
        })}
      </svg>

      <div style={{ marginTop: '12px', color: '#64748b', fontSize: '14px' }}>
        {points.length} data point{points.length === 1 ? '' : 's'} • Latest:{' '}
        {points[points.length - 1]?.rating.toFixed(2)}
      </div>
    </div>
  )
}

function normalizeMatchType(value: string | null | undefined): 'singles' | 'doubles' {
  return value === 'doubles' ? 'doubles' : 'singles'
}

function isWin(result: string) {
  return result.trim().toUpperCase().startsWith('W')
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

const mainStyle = {
  padding: '24px',
  fontFamily: 'Arial, sans-serif',
  maxWidth: '1200px',
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

const segmentContainerStyle = {
  display: 'inline-flex',
  gap: '8px',
  padding: '6px',
  background: '#eff6ff',
  borderRadius: '16px',
  border: '1px solid #dbeafe',
  marginBottom: '22px',
}

const segmentButtonStyle = {
  padding: '10px 14px',
  border: 'none',
  borderRadius: '12px',
  background: 'transparent',
  color: '#1e3a8a',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: '14px',
}

const activeSegmentButtonStyle = {
  background: '#2563eb',
  color: 'white',
}

const statsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '14px',
  marginBottom: '22px',
}

const statCardStyle = {
  background: 'white',
  borderRadius: '18px',
  padding: '18px',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
  border: '1px solid #e2e8f0',
}

const statLabelStyle = {
  color: '#64748b',
  fontSize: '13px',
  marginBottom: '6px',
}

const statValueStyle = {
  color: '#0f172a',
  fontSize: '28px',
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

const errorBoxStyle = {
  marginTop: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: '#fee2e2',
  border: '1px solid #fca5a5',
  color: '#991b1b',
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
}

const thStyle = {
  textAlign: 'left' as const,
  padding: '12px',
  borderBottom: '1px solid #cbd5e1',
  color: '#334155',
  background: '#f8fafc',
}

const tdStyle = {
  padding: '12px',
  borderBottom: '1px solid #e2e8f0',
  color: '#0f172a',
}