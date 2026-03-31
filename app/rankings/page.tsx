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

  const topThree = rankedPlayers.slice(0, 3)

  return (
    <main className="page-shell-tight rankings-page">
      <div className="rankings-top-links">
        <Link href="/" className="button-ghost">Home</Link>
        <Link href="/rankings" className="button-ghost">Rankings</Link>
        <Link href="/matchup" className="button-ghost">Matchup</Link>
        <Link href="/admin" className="button-ghost">Admin</Link>
      </div>

      <section className="hero-panel rankings-hero-panel">
        <div className="hero-inner rankings-hero-inner">
          <div className="rankings-hero-copy">
            <div className="section-kicker rankings-kicker">Player Rankings</div>
            <h1 className="rankings-hero-title">See who rises to the top.</h1>
            <p className="rankings-hero-text">
              View player rankings by overall, singles, or doubles dynamic rating,
              then filter by player name or location to narrow the board.
            </p>

            <div className="rankings-hero-badges">
              <span className="badge badge-blue">{rankedPlayers.length} shown</span>
              <span className="badge badge-slate">{locations.length} locations</span>
              <span className="badge badge-green">{capitalize(ratingView)} mode</span>
            </div>
          </div>

          <div className="glass-card panel-pad rankings-hero-side">
            <div className="rankings-side-label">Current ranking basis</div>
            <div className="rankings-side-value">{capitalize(ratingView)}</div>
            <div className="rankings-side-text">
              Players are sorted descending by the selected dynamic rating.
            </div>
          </div>
        </div>
      </section>

      {topThree.length > 0 && !loading && !error ? (
        <section className="metric-grid rankings-podium-grid">
          {topThree.map((player, index) => (
            <div key={player.id} className={`metric-card rankings-podium-card place-${index + 1}`}>
              <div className="rankings-podium-rank">#{index + 1}</div>
              <div className="rankings-podium-name-row">
                <Link href={`/players/${player.id}`} className="rankings-podium-name">
                  {player.name}
                </Link>
              </div>
              <div className="rankings-podium-location">{player.location || 'No location'}</div>
              <div className="rankings-podium-rating">
                {formatRating(getSelectedRating(player, ratingView))}
              </div>
              <div className="rankings-podium-subtext">{capitalize(ratingView)} dynamic rating</div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="surface-card panel-pad rankings-controls-card">
        <div className="rankings-controls-head">
          <div>
            <div className="section-kicker">Filters</div>
            <h2 className="rankings-section-title">Search and refine the leaderboard</h2>
          </div>

          <div className="rankings-segment-wrap">
            <button
              onClick={() => setRatingView('overall')}
              className={`rankings-segment-btn ${ratingView === 'overall' ? 'is-active' : ''}`}
            >
              Overall
            </button>
            <button
              onClick={() => setRatingView('singles')}
              className={`rankings-segment-btn ${ratingView === 'singles' ? 'is-active' : ''}`}
            >
              Singles
            </button>
            <button
              onClick={() => setRatingView('doubles')}
              className={`rankings-segment-btn ${ratingView === 'doubles' ? 'is-active' : ''}`}
            >
              Doubles
            </button>
          </div>
        </div>

        <div className="rankings-filter-grid">
          <div>
            <label className="label" htmlFor="rankings-search">
              Search
            </label>
            <input
              id="rankings-search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search players or location"
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="rankings-location">
              Location
            </label>
            <select
              id="rankings-location"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="select"
            >
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="rankings-error-box">
            <p>{error}</p>
          </div>
        )}

        <div className="rankings-summary-row">
          <span className="badge badge-slate">Showing {rankedPlayers.length} players</span>
          <span className="badge badge-blue">Sorted by {capitalize(ratingView)} rating</span>
        </div>
      </section>

      <section className="surface-card panel-pad rankings-table-card">
        <div className="rankings-table-head">
          <div>
            <div className="section-kicker">Leaderboard</div>
            <h2 className="rankings-section-title">Full rankings</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table rankings-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Location</th>
                <th className={ratingView === 'overall' ? 'is-active-col' : ''}>Overall</th>
                <th className={ratingView === 'singles' ? 'is-active-col' : ''}>Singles</th>
                <th className={ratingView === 'doubles' ? 'is-active-col' : ''}>Doubles</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="rankings-empty-cell">
                    Loading rankings...
                  </td>
                </tr>
              ) : rankedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="rankings-empty-cell">
                    No players found.
                  </td>
                </tr>
              ) : (
                rankedPlayers.map((player, index) => (
                  <tr key={player.id}>
                    <td>
                      <span className="rankings-rank-badge">{index + 1}</span>
                    </td>
                    <td>
                      <Link href={`/players/${player.id}`} className="rankings-player-link">
                        {player.name}
                      </Link>
                    </td>
                    <td>{player.location || '—'}</td>
                    <td className={ratingView === 'overall' ? 'rankings-active-rating' : ''}>
                      {formatRating(player.overall_dynamic_rating)}
                    </td>
                    <td className={ratingView === 'singles' ? 'rankings-active-rating' : ''}>
                      {formatRating(player.singles_dynamic_rating)}
                    </td>
                    <td className={ratingView === 'doubles' ? 'rankings-active-rating' : ''}>
                      {formatRating(player.doubles_dynamic_rating)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        .rankings-page {
          padding-top: 1.25rem;
          padding-bottom: 2.5rem;
        }

        .rankings-top-links {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .rankings-hero-panel {
          overflow: hidden;
        }

        .rankings-hero-inner {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(260px, 340px);
          gap: 1rem;
          align-items: stretch;
        }

        .rankings-hero-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.85rem;
        }

        .rankings-kicker {
          color: rgba(217, 231, 255, 0.82);
        }

        .rankings-hero-title {
          margin: 0;
          color: #ffffff;
          font-size: clamp(2rem, 4vw, 3.2rem);
          line-height: 1;
          letter-spacing: -0.04em;
          font-weight: 900;
        }

        .rankings-hero-text {
          margin: 0;
          max-width: 52rem;
          color: rgba(219, 234, 254, 0.9);
          font-size: 1rem;
          line-height: 1.7;
          font-weight: 500;
        }

        .rankings-hero-badges {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin-top: 0.15rem;
        }

        .rankings-hero-side {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.6rem;
        }

        .rankings-side-label {
          color: rgba(217, 231, 255, 0.82);
          font-size: 0.8rem;
          line-height: 1.5;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .rankings-side-value {
          color: #ffffff;
          font-size: 2rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .rankings-side-text {
          color: rgba(219, 234, 254, 0.88);
          font-size: 0.95rem;
          line-height: 1.65;
          font-weight: 500;
        }

        .rankings-podium-grid {
          margin-top: 1rem;
          margin-bottom: 1rem;
        }

        .rankings-podium-card {
          position: relative;
          overflow: hidden;
        }

        .rankings-podium-card.place-1 {
          border-color: rgba(184, 230, 26, 0.32);
          box-shadow: 0 16px 36px rgba(184, 230, 26, 0.14);
        }

        .rankings-podium-card.place-2 {
          border-color: rgba(37, 91, 227, 0.18);
        }

        .rankings-podium-card.place-3 {
          border-color: rgba(15, 22, 50, 0.12);
        }

        .rankings-podium-rank {
          color: #255be3;
          font-size: 0.84rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .rankings-podium-name-row {
          margin-top: 0.6rem;
        }

        .rankings-podium-name {
          color: #0f172a;
          text-decoration: none;
          font-size: 1.2rem;
          line-height: 1.25;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .rankings-podium-name:hover {
          color: #255be3;
        }

        .rankings-podium-location {
          margin-top: 0.45rem;
          color: #64748b;
          font-size: 0.92rem;
          line-height: 1.5;
          font-weight: 600;
        }

        .rankings-podium-rating {
          margin-top: 0.9rem;
          color: #0f172a;
          font-size: 2rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .rankings-podium-subtext {
          margin-top: 0.35rem;
          color: #64748b;
          font-size: 0.82rem;
          line-height: 1.5;
          font-weight: 700;
        }

        .rankings-controls-card,
        .rankings-table-card {
          margin-top: 1rem;
        }

        .rankings-controls-head,
        .rankings-table-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .rankings-section-title {
          margin: 0.25rem 0 0;
          color: #0f172a;
          font-size: 1.35rem;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .rankings-segment-wrap {
          display: flex;
          gap: 0.55rem;
          flex-wrap: wrap;
          padding: 0.4rem;
          border-radius: 1rem;
          background: #f8fbff;
          border: 1px solid rgba(37, 91, 227, 0.1);
        }

        .rankings-segment-btn {
          border: 0;
          border-radius: 0.8rem;
          background: transparent;
          color: #103170;
          padding: 0.8rem 1rem;
          font-size: 0.92rem;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }

        .rankings-segment-btn:hover {
          background: rgba(37, 91, 227, 0.06);
        }

        .rankings-segment-btn.is-active {
          background: linear-gradient(135deg, #255be3 0%, #3fa7ff 100%);
          color: #ffffff;
          box-shadow: 0 12px 28px rgba(37, 91, 227, 0.2);
        }

        .rankings-filter-grid {
          margin-top: 1rem;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }

        .rankings-error-box {
          margin-top: 1rem;
          border-radius: 1rem;
          padding: 0.95rem 1rem;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.18);
          color: #991b1b;
        }

        .rankings-error-box p {
          margin: 0;
          font-size: 0.94rem;
          line-height: 1.6;
          font-weight: 700;
        }

        .rankings-summary-row {
          margin-top: 1rem;
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .rankings-table {
          min-width: 760px;
        }

        .rankings-table :global(th.is-active-col) {
          color: #255be3;
        }

        .rankings-empty-cell {
          text-align: center;
          color: #64748b;
          font-weight: 600;
          padding: 1.25rem;
        }

        .rankings-rank-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2.2rem;
          padding: 0.45rem 0.7rem;
          border-radius: 999px;
          background: #eff6ff;
          color: #255be3;
          font-size: 0.84rem;
          line-height: 1;
          font-weight: 900;
        }

        .rankings-player-link {
          color: #0f172a;
          font-weight: 800;
          text-decoration: none;
        }

        .rankings-player-link:hover {
          color: #255be3;
        }

        .rankings-active-rating {
          color: #255be3;
          font-weight: 900;
        }

        @media (max-width: 900px) {
          .rankings-hero-inner {
            grid-template-columns: 1fr;
          }

          .rankings-filter-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
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

function formatRating(value: number | null | undefined) {
  return toRatingNumber(value, 3.5).toFixed(2)
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}