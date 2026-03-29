'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type RatingView = 'overall' | 'singles' | 'doubles'

type Player = {
  id: string
  name: string
  location?: string | null
  overall_dynamic_rating?: number | null
  singles_dynamic_rating?: number | null
  doubles_dynamic_rating?: number | null
}

export default function MatchupPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [playerAId, setPlayerAId] = useState('')
  const [playerBId, setPlayerBId] = useState('')
  const [ratingView, setRatingView] = useState<RatingView>('overall')

  useEffect(() => {
    void loadPlayers()
  }, [])

  async function loadPlayers() {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('players')
        .select(`
          id,
          name,
          location,
          overall_dynamic_rating,
          singles_dynamic_rating,
          doubles_dynamic_rating
        `)
        .order('name', { ascending: true })

      if (error) {
        throw new Error(error.message)
      }

      setPlayers((data || []) as Player[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load players')
    } finally {
      setLoading(false)
    }
  }

  const playerA = useMemo(
    () => players.find((player) => player.id === playerAId) || null,
    [players, playerAId]
  )

  const playerB = useMemo(
    () => players.find((player) => player.id === playerBId) || null,
    [players, playerBId]
  )

  const availablePlayersForA = useMemo(
    () => players.filter((player) => player.id !== playerBId),
    [players, playerBId]
  )

  const availablePlayersForB = useMemo(
    () => players.filter((player) => player.id !== playerAId),
    [players, playerAId]
  )

  const playerARating = playerA ? getSelectedRating(playerA, ratingView) : null
  const playerBRating = playerB ? getSelectedRating(playerB, ratingView) : null

  const ratingGap =
    playerARating !== null && playerBRating !== null
      ? Math.abs(playerARating - playerBRating)
      : null

  const higherRatedLabel =
    playerARating !== null && playerBRating !== null
      ? playerARating === playerBRating
        ? 'Even matchup'
        : playerARating > playerBRating
          ? `${playerA?.name} leads`
          : `${playerB?.name} leads`
      : ''

  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
        <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
        <Link href="/admin" style={navLinkStyle}>Admin</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>Matchup Comparison</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          Compare two players across overall, singles, or doubles dynamic ratings.
        </p>
      </div>

      <div style={cardStyle}>
        <div style={toolbarStyle}>
          <div style={selectGridStyle}>
            <div>
              <label style={labelStyle}>Player A</label>
              <select
                value={playerAId}
                onChange={(e) => setPlayerAId(e.target.value)}
                style={inputStyle}
                disabled={loading}
              >
                <option value="">Select player</option>
                {availablePlayersForA.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Player B</label>
              <select
                value={playerBId}
                onChange={(e) => setPlayerBId(e.target.value)}
                style={inputStyle}
                disabled={loading}
              >
                <option value="">Select player</option>
                {availablePlayersForB.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
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
        </div>

        {error && (
          <div style={errorBoxStyle}>
            <p style={{ margin: 0, fontWeight: 700 }}>{error}</p>
          </div>
        )}

        {loading ? (
          <div style={{ marginTop: '18px', color: '#64748b' }}>Loading players...</div>
        ) : !playerA || !playerB ? (
          <div style={emptyStateStyle}>
            Select two different players to compare their {ratingView} ratings.
          </div>
        ) : (
          <>
            <div style={comparisonGridStyle}>
              <div style={playerCardStyle}>
                <div style={playerCardHeaderStyle}>
                  <div>
                    <div style={playerNameStyle}>{playerA.name}</div>
                    <div style={playerMetaStyle}>{playerA.location || 'No location set'}</div>
                  </div>

                  <Link href={`/players/${playerA.id}`} style={profileLinkStyle}>
                    View Profile
                  </Link>
                </div>

                <div style={ratingGridStyle}>
                  <RatingPill
                    label="Overall"
                    value={getSelectedRating(playerA, 'overall')}
                    active={ratingView === 'overall'}
                  />
                  <RatingPill
                    label="Singles"
                    value={getSelectedRating(playerA, 'singles')}
                    active={ratingView === 'singles'}
                  />
                  <RatingPill
                    label="Doubles"
                    value={getSelectedRating(playerA, 'doubles')}
                    active={ratingView === 'doubles'}
                  />
                </div>

                <div style={highlightBoxStyle}>
                  <div style={highlightLabelStyle}>Selected Rating</div>
                  <div style={highlightValueStyle}>
                    {formatRating(getSelectedRating(playerA, ratingView))}
                  </div>
                </div>
              </div>

              <div style={centerComparisonCardStyle}>
                <div style={vsBadgeStyle}>VS</div>

                <div style={gapCardStyle}>
                  <div style={gapLabelStyle}>{capitalize(ratingView)} Rating Gap</div>
                  <div style={gapValueStyle}>
                    {ratingGap !== null ? formatRating(ratingGap) : '—'}
                  </div>
                  <div style={gapMetaStyle}>{higherRatedLabel}</div>
                </div>
              </div>

              <div style={playerCardStyle}>
                <div style={playerCardHeaderStyle}>
                  <div>
                    <div style={playerNameStyle}>{playerB.name}</div>
                    <div style={playerMetaStyle}>{playerB.location || 'No location set'}</div>
                  </div>

                  <Link href={`/players/${playerB.id}`} style={profileLinkStyle}>
                    View Profile
                  </Link>
                </div>

                <div style={ratingGridStyle}>
                  <RatingPill
                    label="Overall"
                    value={getSelectedRating(playerB, 'overall')}
                    active={ratingView === 'overall'}
                  />
                  <RatingPill
                    label="Singles"
                    value={getSelectedRating(playerB, 'singles')}
                    active={ratingView === 'singles'}
                  />
                  <RatingPill
                    label="Doubles"
                    value={getSelectedRating(playerB, 'doubles')}
                    active={ratingView === 'doubles'}
                  />
                </div>

                <div style={highlightBoxStyle}>
                  <div style={highlightLabelStyle}>Selected Rating</div>
                  <div style={highlightValueStyle}>
                    {formatRating(getSelectedRating(playerB, ratingView))}
                  </div>
                </div>
              </div>
            </div>

            <div style={summaryCardStyle}>
              <h2 style={{ marginTop: 0 }}>Quick Read</h2>
              <p style={{ margin: 0, color: '#334155', lineHeight: 1.6 }}>
                In <strong>{ratingView}</strong>,{' '}
                {playerARating === playerBRating
                  ? `${playerA.name} and ${playerB.name} are currently even at ${formatRating(playerARating!)}.`
                  : playerARating! > playerBRating!
                    ? `${playerA.name} leads ${playerB.name} by ${formatRating(ratingGap!)} points.`
                    : `${playerB.name} leads ${playerA.name} by ${formatRating(ratingGap!)} points.`}
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function RatingPill({
  label,
  value,
  active,
}: {
  label: string
  value: number
  active: boolean
}) {
  return (
    <div
      style={{
        ...ratingPillStyle,
        ...(active ? activeRatingPillStyle : {}),
      }}
    >
      <div style={ratingPillLabelStyle}>{label}</div>
      <div style={ratingPillValueStyle}>{formatRating(value)}</div>
    </div>
  )
}

function getSelectedRating(player: Player, view: RatingView) {
  if (view === 'singles') {
    return toRatingNumber(player.singles_dynamic_rating, 3.5)
  }

  if (view === 'doubles') {
    return toRatingNumber(player.doubles_dynamic_rating, 3.5)
  }

  return toRatingNumber(player.overall_dynamic_rating, 3.5)
}

function toRatingNumber(value: number | null | undefined, fallback = 3.5) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
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
  alignItems: 'flex-start',
  gap: '16px',
  flexWrap: 'wrap' as const,
}

const selectGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '12px',
  flex: 1,
  minWidth: '320px',
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

const segmentContainerStyle = {
  display: 'flex',
  gap: '8px',
  padding: '6px',
  background: '#eff6ff',
  borderRadius: '16px',
  border: '1px solid #dbeafe',
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
  border: '1px solid #e2e8f0',
  color: '#64748b',
}

const comparisonGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, 1fr) minmax(180px, 220px) minmax(280px, 1fr)',
  gap: '18px',
  marginTop: '22px',
}

const playerCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  padding: '18px',
}

const playerCardHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '16px',
}

const playerNameStyle = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: 800,
}

const playerMetaStyle = {
  color: '#64748b',
  fontSize: '14px',
  marginTop: '4px',
}

const profileLinkStyle = {
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

const ratingGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(90px, 1fr))',
  gap: '10px',
  marginBottom: '16px',
}

const ratingPillStyle = {
  background: 'white',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '12px',
}

const activeRatingPillStyle = {
  border: '1px solid #93c5fd',
  background: '#eff6ff',
}

const ratingPillLabelStyle = {
  color: '#64748b',
  fontSize: '12px',
  marginBottom: '4px',
}

const ratingPillValueStyle = {
  color: '#0f172a',
  fontSize: '20px',
  fontWeight: 800,
}

const highlightBoxStyle = {
  background: 'white',
  border: '1px solid #dbeafe',
  borderRadius: '16px',
  padding: '16px',
}

const highlightLabelStyle = {
  color: '#64748b',
  fontSize: '13px',
  marginBottom: '6px',
}

const highlightValueStyle = {
  color: '#1d4ed8',
  fontSize: '32px',
  fontWeight: 900,
}

const centerComparisonCardStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  gap: '16px',
}

const vsBadgeStyle = {
  width: '72px',
  height: '72px',
  borderRadius: '999px',
  background: '#2563eb',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
  fontSize: '22px',
  boxShadow: '0 12px 24px rgba(37, 99, 235, 0.20)',
}

const gapCardStyle = {
  width: '100%',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  padding: '18px',
  textAlign: 'center' as const,
}

const gapLabelStyle = {
  color: '#64748b',
  fontSize: '13px',
  marginBottom: '6px',
}

const gapValueStyle = {
  color: '#0f172a',
  fontSize: '32px',
  fontWeight: 900,
}

const gapMetaStyle = {
  color: '#1d4ed8',
  fontSize: '14px',
  fontWeight: 700,
  marginTop: '8px',
}

const summaryCardStyle = {
  marginTop: '20px',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  padding: '18px',
}