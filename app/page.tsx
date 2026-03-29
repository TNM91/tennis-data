'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type SortField =
  | 'name'
  | 'location'
  | 'overall'
  | 'singles'
  | 'doubles'

type SortDirection = 'asc' | 'desc'

type Player = {
  id: string
  name: string
  location?: string | null
  overall_dynamic_rating?: number | null
  singles_dynamic_rating?: number | null
  doubles_dynamic_rating?: number | null
}

export default function HomePage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [sortField, setSortField] = useState<SortField>('overall')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

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

  function handleSort(nextField: SortField) {
    if (sortField === nextField) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortField(nextField)
    setSortDirection(nextField === 'name' || nextField === 'location' ? 'asc' : 'desc')
  }

  const locations = useMemo(() => {
    return [...new Set(players.map((player) => player.location).filter(Boolean) as string[])].sort()
  }, [players])

  const filteredAndSortedPlayers = useMemo(() => {
    const query = searchText.trim().toLowerCase()

    const filtered = players.filter((player) => {
      const matchesSearch =
        !query ||
        player.name.toLowerCase().includes(query) ||
        String(player.location || '').toLowerCase().includes(query)

      const matchesLocation =
        !locationFilter || (player.location || '') === locationFilter

      return matchesSearch && matchesLocation
    })

    const sorted = [...filtered].sort((a, b) => {
      if (sortField === 'name') {
        return compareStrings(a.name, b.name, sortDirection)
      }

      if (sortField === 'location') {
        return compareStrings(a.location || '', b.location || '', sortDirection)
      }

      const aValue = getRatingValue(a, sortField)
      const bValue = getRatingValue(b, sortField)

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    })

    return sorted
  }, [players, searchText, locationFilter, sortField, sortDirection])

  const topOverallPlayers = useMemo(() => {
    return [...players]
      .sort((a, b) => getRatingValue(b, 'overall') - getRatingValue(a, 'overall'))
      .slice(0, 3)
  }, [players])

  const topOverall = players.length > 0
    ? formatRating(Math.max(...players.map((player) => getRatingValue(player, 'overall'))))
    : '—'

  const topSingles = players.length > 0
    ? formatRating(Math.max(...players.map((player) => getRatingValue(player, 'singles'))))
    : '—'

  const topDoubles = players.length > 0
    ? formatRating(Math.max(...players.map((player) => getRatingValue(player, 'doubles'))))
    : '—'

  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
        <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
        <Link href="/admin" style={navLinkStyle}>Admin</Link>
      </div>

      <div style={heroCardStyle}>
        <div style={heroTopRowStyle}>
          <div>
            <div style={brandBadgeStyle}>TenAceIQ</div>
            <h1 style={{ margin: '10px 0 0 0', fontSize: '42px', lineHeight: 1.05 }}>
              Smarter Tennis Ratings
            </h1>
            <p style={heroTextStyle}>
              TenAceIQ tracks player strength across singles, doubles, and overall.
              Search players, compare matchups, and monitor your local tennis landscape.
            </p>

            <div style={heroButtonRowStyle}>
              <Link href="/rankings" style={heroPrimaryLinkStyle}>
                View Rankings
              </Link>
              <Link href="/matchup" style={heroSecondaryLinkStyle}>
                Compare Players
              </Link>
            </div>
          </div>

          <div style={heroMiniPanelStyle}>
            <div style={heroMiniLabelStyle}>Site</div>
            <div style={heroMiniValueStyle}>TenAceIQ.com</div>
            <div style={heroMiniSubtleStyle}>Tennis intelligence, ratings, and matchup insights.</div>
          </div>
        </div>
      </div>

      <div style={statsGridStyle}>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Players</div>
          <div style={statValueStyle}>{players.length}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Filtered</div>
          <div style={statValueStyle}>{filteredAndSortedPlayers.length}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Top Overall</div>
          <div style={statValueStyle}>{topOverall}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Top Singles</div>
          <div style={statValueStyle}>{topSingles}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Top Doubles</div>
          <div style={statValueStyle}>{topDoubles}</div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Top Overall Snapshot</h2>
            <p style={sectionSubtextStyle}>Quick look at the current leaders.</p>
          </div>
          <Link href="/rankings" style={sectionActionLinkStyle}>Full Rankings</Link>
        </div>

        {topOverallPlayers.length === 0 ? (
          <p style={{ color: '#64748b' }}>No players available yet.</p>
        ) : (
          <div style={topCardsGridStyle}>
            {topOverallPlayers.map((player, index) => (
              <div key={player.id} style={topPlayerCardStyle}>
                <div style={topPlayerRankStyle}>#{index + 1}</div>
                <div style={topPlayerNameStyle}>{player.name}</div>
                <div style={topPlayerMetaStyle}>{player.location || '—'}</div>
                <div style={topPlayerRatingStyle}>
                  {formatRating(getRatingValue(player, 'overall'))}
                </div>
                <Link href={`/players/${player.id}`} style={actionLinkStyle}>
                  View Profile
                </Link>
              </div>
            ))}
          </div>
        )}
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

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => void loadPlayers()} style={secondaryButtonStyle}>
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div style={errorBoxStyle}>
            <p style={{ margin: 0, fontWeight: 700 }}>{error}</p>
          </div>
        )}

        <div style={{ marginTop: '18px', color: '#64748b', fontWeight: 600 }}>
          Showing {filteredAndSortedPlayers.length} of {players.length} players
        </div>

        <div style={{ overflowX: 'auto', marginTop: '18px' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>
                  <button style={headerButtonStyle} onClick={() => handleSort('name')}>
                    Player {renderSortIndicator(sortField, sortDirection, 'name')}
                  </button>
                </th>

                <th style={thStyle}>
                  <button style={headerButtonStyle} onClick={() => handleSort('location')}>
                    Location {renderSortIndicator(sortField, sortDirection, 'location')}
                  </button>
                </th>

                <th style={thStyle}>
                  <button style={headerButtonStyle} onClick={() => handleSort('overall')}>
                    Overall {renderSortIndicator(sortField, sortDirection, 'overall')}
                  </button>
                </th>

                <th style={thStyle}>
                  <button style={headerButtonStyle} onClick={() => handleSort('singles')}>
                    Singles {renderSortIndicator(sortField, sortDirection, 'singles')}
                  </button>
                </th>

                <th style={thStyle}>
                  <button style={headerButtonStyle} onClick={() => handleSort('doubles')}>
                    Doubles {renderSortIndicator(sortField, sortDirection, 'doubles')}
                  </button>
                </th>

                <th style={thStyle}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td style={tdStyle} colSpan={6}>Loading players...</td>
                </tr>
              ) : filteredAndSortedPlayers.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={6}>No players found.</td>
                </tr>
              ) : (
                filteredAndSortedPlayers.map((player, index) => (
                  <tr key={player.id}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <Link href={`/players/${player.id}`} style={playerLinkStyle}>
                          {player.name}
                        </Link>
                        <span style={subtleTextStyle}>#{index + 1} in current sort</span>
                      </div>
                    </td>

                    <td style={tdStyle}>{player.location || '—'}</td>

                    <td style={{ ...tdStyle, fontWeight: 700 }}>
                      {formatRating(getRatingValue(player, 'overall'))}
                    </td>

                    <td style={tdStyle}>
                      {formatRating(getRatingValue(player, 'singles'))}
                    </td>

                    <td style={tdStyle}>
                      {formatRating(getRatingValue(player, 'doubles'))}
                    </td>

                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Link href={`/players/${player.id}`} style={actionLinkStyle}>
                          View Profile
                        </Link>
                        <Link href={`/matchup?playerA=${player.id}`} style={actionLinkStyle}>
                          Compare
                        </Link>
                      </div>
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

function getRatingValue(player: Player, view: SortField) {
  if (view === 'singles') {
    return toRatingNumber(player.singles_dynamic_rating, 3.5)
  }

  if (view === 'doubles') {
    return toRatingNumber(player.doubles_dynamic_rating, 3.5)
  }

  if (view === 'overall') {
    return toRatingNumber(player.overall_dynamic_rating, 3.5)
  }

  return 0
}

function toRatingNumber(value: number | null | undefined, fallback = 3.5) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function formatRating(value: number) {
  return value.toFixed(2)
}

function compareStrings(a: string, b: string, direction: SortDirection) {
  const result = a.localeCompare(b)
  return direction === 'asc' ? result : -result
}

function renderSortIndicator(
  activeField: SortField,
  direction: SortDirection,
  field: SortField
) {
  if (activeField !== field) return '↕'
  return direction === 'asc' ? '↑' : '↓'
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
  gap: '18px',
  alignItems: 'flex-start',
  flexWrap: 'wrap' as const,
}

const brandBadgeStyle = {
  display: 'inline-block',
  padding: '8px 12px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.16)',
  border: '1px solid rgba(255,255,255,0.25)',
  fontWeight: 800,
  letterSpacing: '0.04em',
}

const heroTextStyle = {
  margin: '14px 0 0 0',
  color: '#dbeafe',
  fontSize: '17px',
  maxWidth: '800px',
  lineHeight: 1.6,
}

const heroButtonRowStyle = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap' as const,
  marginTop: '20px',
}

const heroPrimaryLinkStyle = {
  display: 'inline-block',
  padding: '12px 16px',
  borderRadius: '12px',
  background: 'white',
  color: '#1d4ed8',
  textDecoration: 'none',
  fontWeight: 800,
}

const heroSecondaryLinkStyle = {
  display: 'inline-block',
  padding: '12px 16px',
  borderRadius: '12px',
  background: 'rgba(255,255,255,0.12)',
  color: 'white',
  textDecoration: 'none',
  fontWeight: 800,
  border: '1px solid rgba(255,255,255,0.20)',
}

const heroMiniPanelStyle = {
  minWidth: '240px',
  maxWidth: '280px',
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.20)',
  borderRadius: '18px',
  padding: '18px',
}

const heroMiniLabelStyle = {
  color: '#bfdbfe',
  fontSize: '13px',
  marginBottom: '6px',
}

const heroMiniValueStyle = {
  color: 'white',
  fontSize: '24px',
  fontWeight: 800,
  marginBottom: '8px',
}

const heroMiniSubtleStyle = {
  color: '#dbeafe',
  fontSize: '14px',
  lineHeight: 1.5,
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

const sectionHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '16px',
  flexWrap: 'wrap' as const,
  marginBottom: '16px',
}

const sectionSubtextStyle = {
  margin: '6px 0 0 0',
  color: '#64748b',
}

const sectionActionLinkStyle = {
  display: 'inline-block',
  padding: '10px 12px',
  borderRadius: '10px',
  background: '#eff6ff',
  color: '#1d4ed8',
  textDecoration: 'none',
  fontWeight: 700,
}

const topCardsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
}

const topPlayerCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  padding: '18px',
}

const topPlayerRankStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '40px',
  height: '40px',
  borderRadius: '999px',
  background: '#dbeafe',
  color: '#1d4ed8',
  fontWeight: 900,
  marginBottom: '12px',
}

const topPlayerNameStyle = {
  color: '#0f172a',
  fontSize: '20px',
  fontWeight: 800,
  marginBottom: '4px',
}

const topPlayerMetaStyle = {
  color: '#64748b',
  fontSize: '14px',
  marginBottom: '12px',
}

const topPlayerRatingStyle = {
  color: '#1d4ed8',
  fontSize: '28px',
  fontWeight: 900,
  marginBottom: '14px',
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

const secondaryButtonStyle = {
  padding: '10px 14px',
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  background: 'white',
  color: '#0f172a',
  fontWeight: 700,
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
  verticalAlign: 'top' as const,
}

const headerButtonStyle = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  margin: 0,
  font: 'inherit',
  color: '#334155',
  fontWeight: 700,
  cursor: 'pointer',
}

const playerLinkStyle = {
  color: '#0f172a',
  fontWeight: 700,
  textDecoration: 'none',
}

const actionLinkStyle = {
  display: 'inline-block',
  padding: '8px 10px',
  borderRadius: '10px',
  background: '#eff6ff',
  color: '#1d4ed8',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '13px',
}

const subtleTextStyle = {
  color: '#64748b',
  fontSize: '12px',
}