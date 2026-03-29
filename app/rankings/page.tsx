'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type RatingView = 'overall' | 'singles' | 'doubles'

type Player = {
  id: string
  name: string
  location?: string | null
  rating?: string | number | null
  dynamic_rating?: number | null
  overall_dynamic_rating?: number | null
  singles_dynamic_rating?: number | null
  doubles_dynamic_rating?: number | null
}

export default function RankingsPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
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
          rating,
          dynamic_rating,
          overall_dynamic_rating,
          singles_dynamic_rating,
          doubles_dynamic_rating
        `)

      if (error) {
        throw new Error(error.message)
      }

      setPlayers((data || []) as Player[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rankings')
    } finally {
      setLoading(false)
    }
  }

  const locations = useMemo(() => {
    return [...new Set(players.map((player) => player.location).filter(Boolean) as string[])].sort()
  }, [players])

  const filteredPlayers = useMemo(() => {
    const query = searchText.trim().toLowerCase()

    return players.filter((player) => {
      const matchesSearch =
        !query ||
        player.name.toLowerCase().includes(query) ||
        String(player.location || '').toLowerCase().includes(query)

      const matchesLocation =
        !locationFilter || (player.location || '') === locationFilter

      return matchesSearch && matchesLocation
    })
  }, [players, searchText, locationFilter])

  const rankedPlayers = useMemo(() => {
    return [...filteredPlayers]
      .map((player) => ({
        ...player,
        selectedRating: getSelectedRating(player, ratingView),
      }))
      .sort((a, b) => b.selectedRating - a.selectedRating)
  }, [filteredPlayers, ratingView])

  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
          <Link href="/" style={navLinkStyle}>Home</Link>
  <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
  <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
  <Link href="/admin" style={navLinkStyle}>Admin</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>Rankings</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          View player rankings by overall, singles, or doubles dynamic rating.
        </p>
      </div>

      <div style={cardStyle}>
        <div style={toolbarStyle}>
          <div style={filtersGridStyle}>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search players or location"
              style={inputStyle}
            />

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
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

        <div style={{ marginTop: '18px', color: '#64748b', fontWeight: 600 }}>
          Showing {rankedPlayers.length} players • Sorted by {capitalize(ratingView)} rating
        </div>

        <div style={{ overflowX: 'auto', marginTop: '18px' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Rank</th>
                <th style={thStyle}>Player</th>
                <th style={thStyle}>Location</th>
                <th style={thStyle}>Overall</th>
                <th style={thStyle}>Singles</th>
                <th style={thStyle}>Doubles</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td style={tdStyle} colSpan={6}>Loading rankings...</td>
                </tr>
              ) : rankedPlayers.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={6}>No players found.</td>
                </tr>
              ) : (
                rankedPlayers.map((player, index) => (
                  <tr key={player.id}>
                    <td style={tdStyle}>
                      <span style={rankBadgeStyle}>{index + 1}</span>
                    </td>
                    <td style={tdStyle}>
                      <Link
                        href={`/players/${player.id}`}
                        style={playerLinkStyle}
                      >
                        {player.name}
                      </Link>
                    </td>
                    <td style={tdStyle}>{player.location || '—'}</td>
                    <td
                      style={{
                        ...tdStyle,
                        ...(ratingView === 'overall' ? activeRatingCellStyle : {}),
                      }}
                    >
                      {formatRating(getSelectedRating(player, 'overall'))}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        ...(ratingView === 'singles' ? activeRatingCellStyle : {}),
                      }}
                    >
                      {formatRating(getSelectedRating(player, 'singles'))}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        ...(ratingView === 'doubles' ? activeRatingCellStyle : {}),
                      }}
                    >
                      {formatRating(getSelectedRating(player, 'doubles'))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

function getSelectedRating(player: Player, view: RatingView) {
  if (view === 'singles') {
    return toRatingNumber(
      player.singles_dynamic_rating ??
      player.overall_dynamic_rating ??
      player.dynamic_rating ??
      player.rating,
      3.5
    )
  }

  if (view === 'doubles') {
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

const filtersGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
  flex: 1,
  minWidth: '320px',
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

const activeRatingCellStyle = {
  fontWeight: 800,
  color: '#1d4ed8',
}

const rankBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '32px',
  height: '32px',
  padding: '0 10px',
  borderRadius: '999px',
  background: '#eff6ff',
  color: '#1d4ed8',
  fontWeight: 800,
}

const playerLinkStyle = {
  color: '#0f172a',
  fontWeight: 700,
  textDecoration: 'none',
}