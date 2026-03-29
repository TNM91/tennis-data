'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type SortField = 'name' | 'location' | 'overall' | 'singles' | 'doubles'
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

  const topOverall =
    players.length > 0
      ? formatRating(Math.max(...players.map((player) => getRatingValue(player, 'overall'))))
      : '—'

  const topSingles =
    players.length > 0
      ? formatRating(Math.max(...players.map((player) => getRatingValue(player, 'singles'))))
      : '—'

  const topDoubles =
    players.length > 0
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
            <div style={heroMiniSubtleStyle}>
              Tennis intelligence, ratings, and matchup insights.
            </div>
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

          <button onClick={() => void loadPlayers()} style={refreshButtonStyle} type="button">
            Refresh
          </button>
        </div>

        {error ? (
          <div style={errorStyle}>{error}</div>
        ) : null}

        <div style={resultsCountStyle}>
          Showing {filteredAndSortedPlayers.length} of {players.length} players
        </div>

        <div style={tableWrapStyle}>
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
                  <td colSpan={6} style={tdEmptyStyle}>Loading players...</td>
                </tr>
              ) : filteredAndSortedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={tdEmptyStyle}>No players found.</td>
                </tr>
              ) : (
                filteredAndSortedPlayers.map((player) => (
                  <tr key={player.id}>
                    <td style={tdStyle}>
                      <Link href={`/players/${player.id}`} style={playerNameLinkStyle}>
                        {player.name}
                      </Link>
                    </td>
                    <td style={tdStyle}>{player.location || '—'}</td>
                    <td style={ratingTdStyle}>
                      {formatRating(getRatingValue(player, 'overall'))}
                    </td>
                    <td style={tdStyle}>
                      {formatRating(getRatingValue(player, 'singles'))}
                    </td>
                    <td style={tdStyle}>
                      {formatRating(getRatingValue(player, 'doubles'))}
                    </td>
                    <td style={tdStyle}>
                      <div style={actionRowStyle}>
                        <Link href={`/players/${player.id}`} style={smallActionLinkStyle}>
                          View
                        </Link>
                        <Link href={`/matchup?playerA=${player.id}`} style={smallActionLinkStyle}>
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

const mainStyle: React.CSSProperties = {
  padding: '24px',
  fontFamily: 'Arial, sans-serif',
  maxWidth: '1250px',
  margin: '0 auto',
  background: '#f8fafc',
  minHeight: '100vh',
}

const navRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginBottom: '24px',
  flexWrap: 'wrap',
}

const navLinkStyle: React.CSSProperties = {
  padding: '10px 14px',
  border: '1px solid #dbeafe',
  borderRadius: '999px',
  textDecoration: 'none',
  color: '#1e3a8a',
  background: '#eff6ff',
  fontWeight: 600,
}

const heroCardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #071B4D, #0E63C7)',
  color: 'white',
  borderRadius: '24px',
  padding: '30px',
  boxShadow: '0 18px 50px rgba(14, 99, 199, 0.22)',
  marginBottom: '22px',
}

const heroTopRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '18px',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

const brandBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '8px 12px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.14)',
  border: '1px solid rgba(255,255,255,0.22)',
  fontWeight: 800,
  letterSpacing: '0.04em',
}

const heroTextStyle: React.CSSProperties = {
  margin: '14px 0 0 0',
  color: '#dbeafe',
  fontSize: '17px',
  maxWidth: '800px',
  lineHeight: 1.6,
}

const heroButtonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  marginTop: '20px',
}

const heroPrimaryLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 16px',
  borderRadius: '12px',
  background: 'white',
  color: '#0E63C7',
  textDecoration: 'none',
  fontWeight: 800,
}

const heroSecondaryLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 16px',
  borderRadius: '12px',
  background: 'rgba(255,255,255,0.12)',
  color: 'white',
  textDecoration: 'none',
  fontWeight: 800,
  border: '1px solid rgba(255,255,255,0.2)',
}

const heroMiniPanelStyle: React.CSSProperties = {
  minWidth: '240px',
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '18px',
  padding: '18px',
}

const heroMiniLabelStyle: React.CSSProperties = {
  color: '#bfdbfe',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 700,
}

const heroMiniValueStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 900,
  marginTop: '6px',
}

const heroMiniSubtleStyle: React.CSSProperties = {
  color: '#dbeafe',
  marginTop: '8px',
  lineHeight: 1.5,
}

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '16px',
  marginBottom: '22px',
}

const statCardStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid #d9e2f2',
  borderRadius: '18px',
  padding: '18px',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
}

const statLabelStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: '14px',
  fontWeight: 600,
  marginBottom: '8px',
}

const statValueStyle: React.CSSProperties = {
  color: '#071B4D',
  fontSize: '30px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const cardStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid #d9e2f2',
  borderRadius: '20px',
  padding: '22px',
  boxShadow: '0 10px 28px rgba(15, 23, 42, 0.05)',
  marginBottom: '22px',
}

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  alignItems: 'center',
  flexWrap: 'wrap',
  marginBottom: '18px',
}

const sectionSubtextStyle: React.CSSProperties = {
  margin: '6px 0 0 0',
  color: '#64748b',
}

const sectionActionLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: '#0E63C7',
  fontWeight: 800,
}

const topCardsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
}

const topPlayerCardStyle: React.CSSProperties = {
  border: '1px solid #d9e2f2',
  borderRadius: '18px',
  padding: '18px',
  background: 'linear-gradient(180deg, #ffffff, #f8fbff)',
}

const topPlayerRankStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: '999px',
  background: '#eff6ff',
  color: '#0E63C7',
  fontWeight: 800,
  fontSize: '13px',
  marginBottom: '12px',
}

const topPlayerNameStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: '20px',
  color: '#071B4D',
}

const topPlayerMetaStyle: React.CSSProperties = {
  color: '#64748b',
  marginTop: '4px',
}

const topPlayerRatingStyle: React.CSSProperties = {
  marginTop: '14px',
  marginBottom: '16px',
  fontSize: '34px',
  fontWeight: 900,
  color: '#0E63C7',
  letterSpacing: '-0.03em',
}

const actionLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 14px',
  borderRadius: '12px',
  textDecoration: 'none',
  background: '#071B4D',
  color: 'white',
  fontWeight: 700,
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  alignItems: 'center',
  flexWrap: 'wrap',
  marginBottom: '16px',
}

const filtersGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
  flex: 1,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid #cbd5e1',
  fontSize: '15px',
  outline: 'none',
  background: 'white',
}

const refreshButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: '12px',
  border: '1px solid #d9e2f2',
  background: 'white',
  color: '#071B4D',
  fontWeight: 800,
  cursor: 'pointer',
}

const errorStyle: React.CSSProperties = {
  marginBottom: '16px',
  padding: '12px 14px',
  borderRadius: '12px',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#b91c1c',
  fontWeight: 700,
}

const resultsCountStyle: React.CSSProperties = {
  color: '#64748b',
  fontWeight: 700,
  marginBottom: '14px',
}

const tableWrapStyle: React.CSSProperties = {
  overflowX: 'auto',
  border: '1px solid #d9e2f2',
  borderRadius: '16px',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: 'white',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '14px 16px',
  background: '#f8fafc',
  color: '#071B4D',
  borderBottom: '1px solid #d9e2f2',
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid #e2e8f0',
  color: '#0f172a',
}

const ratingTdStyle: React.CSSProperties = {
  ...tdStyle,
  color: '#0E63C7',
  fontWeight: 800,
}

const tdEmptyStyle: React.CSSProperties = {
  padding: '20px 16px',
  color: '#64748b',
}

const headerButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  margin: 0,
  color: '#071B4D',
  font: 'inherit',
  fontWeight: 800,
  cursor: 'pointer',
}

const playerNameLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: '#071B4D',
  fontWeight: 800,
}

const actionRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
}

const smallActionLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '8px 12px',
  borderRadius: '10px',
  textDecoration: 'none',
  background: '#eff6ff',
  color: '#0E63C7',
  fontWeight: 700,
}