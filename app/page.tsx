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
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div style={headerInnerStyle}>
          <Link href="/" style={logoWrapStyle}>
            <img
              src="/logo-light.png"
              alt="TenAceIQ"
              style={{ height: 52, width: 'auto', display: 'block' }}
            />
          </Link>

          <nav style={navStyle}>
            <Link href="/" style={navLinkStyle}>Home</Link>
            <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
            <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
            <Link href="/add-match" style={navLinkStyle}>Add Match</Link>
            <Link href="/csv-import" style={navLinkStyle}>Import</Link>
            <Link href="/admin" style={navLinkStyle}>Admin</Link>
          </nav>
        </div>
      </header>

      <section style={heroSectionStyle}>
        <div style={heroContentStyle}>
          <div style={heroLeftStyle}>
            <div style={heroBadgeStyle}>Smarter Tennis Intelligence</div>
            <h1 style={heroTitleStyle}>
              Track Ratings.
              <br />
              Compare Matchups.
              <br />
              Improve Faster.
            </h1>
            <p style={heroTextStyle}>
              TenAceIQ helps players and local tennis communities analyze singles,
              doubles, and overall ratings with a cleaner, faster, data-driven experience.
            </p>

            <div style={heroButtonsStyle}>
              <Link href="/rankings" style={primaryButtonStyle}>
                Explore Rankings
              </Link>
              <Link href="/matchup" style={accentButtonStyle}>
                Compare Players
              </Link>
              <Link href="/add-match" style={secondaryButtonStyle}>
                Add Match
              </Link>
            </div>

            <div style={heroMiniStatsStyle}>
              <div style={heroMiniStatCardStyle}>
                <div style={heroMiniStatLabelStyle}>Top Overall</div>
                <div style={heroMiniStatValueStyle}>{topOverall}</div>
              </div>
              <div style={heroMiniStatCardStyle}>
                <div style={heroMiniStatLabelStyle}>Top Singles</div>
                <div style={heroMiniStatValueStyle}>{topSingles}</div>
              </div>
              <div style={heroMiniStatCardStyle}>
                <div style={heroMiniStatLabelStyle}>Top Doubles</div>
                <div style={heroMiniStatValueStyle}>{topDoubles}</div>
              </div>
            </div>
          </div>

          <div style={heroRightStyle}>
            <div style={heroImageCardStyle}>
              <img
                src="/logo-dark.png"
                alt="TenAceIQ logo"
                style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 18 }}
              />
            </div>
          </div>
        </div>
      </section>

      <section style={metricsGridStyle}>
        <div style={metricCardStyle}>
          <div style={metricLabelStyle}>Players</div>
          <div style={metricValueStyle}>{players.length}</div>
          <div style={metricSubtextStyle}>Tracked in the system</div>
        </div>

        <div style={metricCardStyle}>
          <div style={metricLabelStyle}>Filtered</div>
          <div style={metricValueStyle}>{filteredAndSortedPlayers.length}</div>
          <div style={metricSubtextStyle}>Current search results</div>
        </div>

        <div style={metricCardStyle}>
          <div style={metricLabelStyle}>Brand</div>
          <div style={metricValueStyle}>TenAceIQ</div>
          <div style={metricSubtextStyle}>Ratings + matchup insights</div>
        </div>
      </section>

      <section style={featureGridStyle}>
        <div style={featureCardStyle}>
          <div style={featureTitleStyle}>Rankings</div>
          <div style={featureTextStyle}>
            View player standings and quickly sort by overall, singles, and doubles performance.
          </div>
        </div>

        <div style={featureCardStyle}>
          <div style={featureTitleStyle}>Matchup Analysis</div>
          <div style={featureTextStyle}>
            Compare players head-to-head and see clearer rating-based advantages.
          </div>
        </div>

        <div style={featureCardStyle}>
          <div style={featureTitleStyle}>Performance Tracking</div>
          <div style={featureTextStyle}>
            Monitor progression over time and build a smarter picture of player strength.
          </div>
        </div>
      </section>

      <section style={cardSectionStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Top Overall Snapshot</h2>
            <p style={sectionSubtitleStyle}>A quick look at the current leaders.</p>
          </div>
          <Link href="/rankings" style={sectionLinkStyle}>Full Rankings</Link>
        </div>

        {topOverallPlayers.length === 0 ? (
          <p style={emptyStyle}>No players available yet.</p>
        ) : (
          <div style={topCardsGridStyle}>
            {topOverallPlayers.map((player, index) => (
              <div key={player.id} style={topPlayerCardStyle}>
                <div style={topRankBadgeStyle}>#{index + 1}</div>
                <div style={topPlayerNameStyle}>{player.name}</div>
                <div style={topPlayerLocationStyle}>{player.location || '—'}</div>
                <div style={topPlayerRatingStyle}>
                  {formatRating(getRatingValue(player, 'overall'))}
                </div>
                <Link href={`/players/${player.id}`} style={smallPrimaryLinkStyle}>
                  View Profile
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={cardSectionStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Player Search</h2>
            <p style={sectionSubtitleStyle}>
              Find players quickly and sort by the ratings that matter most.
            </p>
          </div>

          <button onClick={() => void loadPlayers()} style={refreshButtonStyle} type="button">
            Refresh
          </button>
        </div>

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

        {error ? <div style={errorStyle}>{error}</div> : null}

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
      </section>

      <footer style={footerStyle}>
        <div style={footerInnerStyle}>
          <img
            src="/logo-light.png"
            alt="TenAceIQ"
            style={{ height: 42, width: 'auto', display: 'block' }}
          />
          <div style={footerTextStyle}>
            Smarter Tennis Ratings & Matchup Insights
          </div>
        </div>
      </footer>
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

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
}

const headerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  background: 'rgba(248,250,252,0.92)',
  backdropFilter: 'blur(10px)',
  borderBottom: '1px solid #d9e2f2',
}

const headerInnerStyle: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '14px 20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '20px',
  flexWrap: 'wrap',
}

const logoWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  textDecoration: 'none',
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  gap: '14px',
  flexWrap: 'wrap',
}

const navLinkStyle: React.CSSProperties = {
  color: '#071B4D',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '15px',
}

const heroSectionStyle: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '28px 20px 16px',
}

const heroContentStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.4fr 0.9fr',
  gap: '24px',
  alignItems: 'stretch',
}

const heroLeftStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #071B4D, #0E63C7)',
  borderRadius: '30px',
  padding: '36px',
  color: 'white',
  boxShadow: '0 20px 60px rgba(7, 27, 77, 0.18)',
}

const heroRightStyle: React.CSSProperties = {
  display: 'flex',
}

const heroImageCardStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, #ffffff, #eef5ff)',
  border: '1px solid #d9e2f2',
  borderRadius: '30px',
  padding: '24px',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 16px 50px rgba(15, 23, 42, 0.08)',
}

const heroBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '8px 12px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.18)',
  fontWeight: 800,
  fontSize: '13px',
  letterSpacing: '0.04em',
  marginBottom: '14px',
}

const heroTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '56px',
  lineHeight: 1.02,
  letterSpacing: '-0.04em',
}

const heroTextStyle: React.CSSProperties = {
  marginTop: '18px',
  color: '#dbeafe',
  fontSize: '18px',
  lineHeight: 1.65,
  maxWidth: '760px',
}

const heroButtonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  marginTop: '24px',
}

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '14px 18px',
  borderRadius: '14px',
  background: '#ffffff',
  color: '#0E63C7',
  textDecoration: 'none',
  fontWeight: 800,
  boxShadow: '0 10px 24px rgba(255,255,255,0.12)',
}

const accentButtonStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '14px 18px',
  borderRadius: '14px',
  background: '#9BE11D',
  color: '#071B4D',
  textDecoration: 'none',
  fontWeight: 800,
}

const secondaryButtonStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '14px 18px',
  borderRadius: '14px',
  background: 'rgba(255,255,255,0.10)',
  color: '#ffffff',
  textDecoration: 'none',
  fontWeight: 800,
  border: '1px solid rgba(255,255,255,0.20)',
}

const heroMiniStatsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '14px',
  marginTop: '26px',
}

const heroMiniStatCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '18px',
  padding: '16px',
}

const heroMiniStatLabelStyle: React.CSSProperties = {
  color: '#bfdbfe',
  fontSize: '13px',
  fontWeight: 700,
  marginBottom: '8px',
}

const heroMiniStatValueStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const metricsGridStyle: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '8px 20px 0',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '16px',
}

const metricCardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #d9e2f2',
  borderRadius: '22px',
  padding: '22px',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)',
}

const metricLabelStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: '14px',
  fontWeight: 700,
  marginBottom: '8px',
}

const metricValueStyle: React.CSSProperties = {
  color: '#071B4D',
  fontSize: '34px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const metricSubtextStyle: React.CSSProperties = {
  marginTop: '8px',
  color: '#64748b',
  fontSize: '14px',
}

const featureGridStyle: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '16px 20px 0',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '16px',
}

const featureCardStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, #ffffff, #f8fbff)',
  border: '1px solid #d9e2f2',
  borderRadius: '22px',
  padding: '22px',
}

const featureTitleStyle: React.CSSProperties = {
  color: '#071B4D',
  fontSize: '20px',
  fontWeight: 800,
  marginBottom: '10px',
}

const featureTextStyle: React.CSSProperties = {
  color: '#64748b',
  lineHeight: 1.6,
  fontSize: '15px',
}

const cardSectionStyle: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '16px 20px 0',
}

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '16px',
  flexWrap: 'wrap',
  background: '#ffffff',
  border: '1px solid #d9e2f2',
  borderBottom: 'none',
  borderTopLeftRadius: '24px',
  borderTopRightRadius: '24px',
  padding: '24px 24px 18px',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)',
}

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#071B4D',
  fontSize: '28px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const sectionSubtitleStyle: React.CSSProperties = {
  margin: '8px 0 0 0',
  color: '#64748b',
}

const sectionLinkStyle: React.CSSProperties = {
  color: '#0E63C7',
  textDecoration: 'none',
  fontWeight: 800,
}

const topCardsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '16px',
  background: '#ffffff',
  border: '1px solid #d9e2f2',
  borderTop: 'none',
  borderBottomLeftRadius: '24px',
  borderBottomRightRadius: '24px',
  padding: '0 24px 24px',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)',
}

const topPlayerCardStyle: React.CSSProperties = {
  border: '1px solid #d9e2f2',
  borderRadius: '20px',
  padding: '20px',
  background: 'linear-gradient(180deg, #ffffff, #f5faff)',
}

const topRankBadgeStyle: React.CSSProperties = {
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
  color: '#071B4D',
  fontWeight: 800,
  fontSize: '22px',
}

const topPlayerLocationStyle: React.CSSProperties = {
  color: '#64748b',
  marginTop: '4px',
}

const topPlayerRatingStyle: React.CSSProperties = {
  marginTop: '16px',
  marginBottom: '16px',
  color: '#0E63C7',
  fontSize: '38px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const smallPrimaryLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 14px',
  borderRadius: '12px',
  background: '#071B4D',
  color: '#ffffff',
  textDecoration: 'none',
  fontWeight: 700,
}

const filtersGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '14px',
  background: '#ffffff',
  borderLeft: '1px solid #d9e2f2',
  borderRight: '1px solid #d9e2f2',
  padding: '0 24px 18px',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  fontSize: '15px',
  outline: 'none',
}

const refreshButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: '12px',
  border: '1px solid #d9e2f2',
  background: '#ffffff',
  color: '#071B4D',
  fontWeight: 800,
  cursor: 'pointer',
}

const errorStyle: React.CSSProperties = {
  background: '#ffffff',
  borderLeft: '1px solid #d9e2f2',
  borderRight: '1px solid #d9e2f2',
  padding: '0 24px 18px',
  color: '#b91c1c',
  fontWeight: 700,
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)',
}

const resultsCountStyle: React.CSSProperties = {
  background: '#ffffff',
  borderLeft: '1px solid #d9e2f2',
  borderRight: '1px solid #d9e2f2',
  padding: '0 24px 16px',
  color: '#64748b',
  fontWeight: 700,
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)',
}

const tableWrapStyle: React.CSSProperties = {
  overflowX: 'auto',
  background: '#ffffff',
  border: '1px solid #d9e2f2',
  borderTop: 'none',
  borderBottomLeftRadius: '24px',
  borderBottomRightRadius: '24px',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#ffffff',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '16px',
  background: '#f8fafc',
  color: '#071B4D',
  borderBottom: '1px solid #d9e2f2',
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const tdStyle: React.CSSProperties = {
  padding: '16px',
  borderBottom: '1px solid #e2e8f0',
  color: '#0f172a',
}

const ratingTdStyle: React.CSSProperties = {
  ...tdStyle,
  color: '#0E63C7',
  fontWeight: 800,
}

const tdEmptyStyle: React.CSSProperties = {
  padding: '22px 16px',
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

const emptyStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #d9e2f2',
  borderTop: 'none',
  borderBottomLeftRadius: '24px',
  borderBottomRightRadius: '24px',
  padding: '24px',
  color: '#64748b',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)',
}

const footerStyle: React.CSSProperties = {
  marginTop: '36px',
  background: 'linear-gradient(135deg, #071B4D, #0B2768)',
}

const footerInnerStyle: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '24px 20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '16px',
  flexWrap: 'wrap',
}

const footerTextStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.82)',
  fontWeight: 600,
}