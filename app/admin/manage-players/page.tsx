'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { recalculateDynamicRatings } from '../../../lib/recalculateRatings'

type PlayerRow = {
  id: string
  name: string
  location: string | null
  singles_rating: number | null
  singles_dynamic_rating: number | null
  doubles_rating: number | null
  doubles_dynamic_rating: number | null
  overall_rating: number | null
  overall_dynamic_rating: number | null
}

const ADMIN_ID = 'accc3471-8912-491c-b8d9-4a84dcc7c42e'

export default function ManagePlayersPage() {
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [recalculating, setRecalculating] = useState(false)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<
    | 'name'
    | 'location'
    | 'singles_rating'
    | 'singles_dynamic_rating'
    | 'doubles_rating'
    | 'doubles_dynamic_rating'
    | 'overall_rating'
    | 'overall_dynamic_rating'
  >('overall_dynamic_rating')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [editedPlayers, setEditedPlayers] = useState<Record<string, Partial<PlayerRow>>>({})

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setUser(user)
      setAuthLoading(false)

      if (!user || user.id !== ADMIN_ID) {
        router.push('/admin')
      }
    }

    checkUser()
  }, [router])

  useEffect(() => {
    if (!user || user.id !== ADMIN_ID) return
    loadPlayers()
  }, [user])

  async function loadPlayers(showRefreshing = false) {
    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const { data, error } = await supabase
        .from('players')
        .select(`
          id,
          name,
          location,
          singles_rating,
          singles_dynamic_rating,
          doubles_rating,
          doubles_dynamic_rating,
          overall_rating,
          overall_dynamic_rating
        `)

      if (error) {
        throw new Error(error.message)
      }

      setPlayers((data || []) as PlayerRow[])
      setEditedPlayers({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load players.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function getPlayerValue(player: PlayerRow, field: keyof PlayerRow) {
    const editedValue = editedPlayers[player.id]?.[field]
    return editedValue !== undefined ? editedValue : player[field]
  }

  function updatePlayerField(
    playerId: string,
    field: keyof Pick<
      PlayerRow,
      'name' | 'location' | 'singles_rating' | 'doubles_rating' | 'overall_rating'
    >,
    value: string
  ) {
    setEditedPlayers((prev) => {
      const next = { ...prev }
      const existing = { ...(next[playerId] || {}) }

      if (field === 'name' || field === 'location') {
        existing[field] = value
      } else {
        existing[field] = value === '' ? null : Number(value)
      }

      next[playerId] = existing
      return next
    })
  }

  function isPlayerDirty(playerId: string) {
    return !!editedPlayers[playerId]
  }

  async function handleSavePlayer(player: PlayerRow) {
    const changes = editedPlayers[player.id]
    if (!changes) return

    setSavingId(player.id)
    setError('')
    setMessage('')

    try {
      const payload: Partial<PlayerRow> = {}

      if (changes.name !== undefined) {
        const normalizedName = normalizeName(String(changes.name))
        if (!normalizedName) {
          throw new Error('Player name is required.')
        }
        payload.name = normalizedName
      }

      if (changes.location !== undefined) {
        payload.location = normalizeNullableText(String(changes.location))
      }

      for (const field of ['singles_rating', 'doubles_rating', 'overall_rating'] as const) {
        if (changes[field] !== undefined) {
          const rawValue = changes[field]
          if (rawValue === null) {
            payload[field] = 3.5
          } else {
            const numericValue = Number(rawValue)
            if (Number.isNaN(numericValue)) {
              throw new Error(`${field} must be a valid number.`)
            }
            payload[field] = numericValue
          }
        }
      }

      const { error } = await supabase
        .from('players')
        .update(payload)
        .eq('id', player.id)

      if (error) {
        throw new Error(error.message)
      }

      let ratingsRecalculated = false
      try {
        await recalculateDynamicRatings()
        ratingsRecalculated = true
      } catch (recalcError) {
        console.error('Rating recalculation failed:', recalcError)
      }

      setMessage(
        ratingsRecalculated
          ? 'Player updated and ratings recalculated.'
          : 'Player updated, but ratings were not recalculated.'
      )

      await loadPlayers(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save player.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleDeletePlayer(player: PlayerRow) {
    const confirmed = window.confirm(
      `Delete ${player.name}? This can fail if the player is still referenced by matches.`
    )
    if (!confirmed) return

    setDeletingId(player.id)
    setError('')
    setMessage('')

    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', player.id)

      if (error) {
        throw new Error(
          error.message.includes('reference')
            ? 'Cannot delete this player because they are still used in matches.'
            : error.message
        )
      }

      let ratingsRecalculated = false
      try {
        await recalculateDynamicRatings()
        ratingsRecalculated = true
      } catch (recalcError) {
        console.error('Rating recalculation failed:', recalcError)
      }

      setMessage(
        ratingsRecalculated
          ? 'Player deleted and ratings recalculated.'
          : 'Player deleted, but ratings were not recalculated.'
      )

      await loadPlayers(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete player.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRecalculateRatings() {
    setRecalculating(true)
    setError('')
    setMessage('')

    try {
      await recalculateDynamicRatings()
      setMessage('Ratings recalculated successfully.')
      await loadPlayers(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recalculate ratings.')
    } finally {
      setRecalculating(false)
    }
  }

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    const filtered = players.filter((player) => {
      if (!normalizedSearch) return true

      const haystack = [player.name, player.location || ''].join(' ').toLowerCase()

      return haystack.includes(normalizedSearch)
    })

    return [...filtered].sort((a, b) => {
      const aValue = a[sortBy]
      const bValue = b[sortBy]

      if (sortBy === 'name' || sortBy === 'location') {
        return String(aValue || '').localeCompare(String(bValue || ''))
      }

      return Number(bValue || 0) - Number(aValue || 0)
    })
  }, [players, search, sortBy])

  if (authLoading) {
    return (
      <main className="page-shell-tight">
        <section className="hero-panel">
          <div className="hero-inner">
            <div className="section-kicker">Admin Tool</div>
            <h1 className="page-title">Checking access...</h1>
            <p className="page-subtitle">
              Verifying administrator permissions and loading player management tools.
            </p>
          </div>
        </section>
      </main>
    )
  }

  if (!user || user.id !== ADMIN_ID) {
    return null
  }

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-inner">
          <div className="section-kicker">Admin Tool</div>
          <h1 className="page-title">Manage Players</h1>
          <p className="page-subtitle">
            View, search, edit, and delete players using the singles, doubles, and overall
            ratings structure.
          </p>
        </div>
      </section>

      <section className="surface-card panel-pad section">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'end',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              flex: 1,
              minWidth: '320px',
            }}
          >
            <Field label="Search">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Player name or location"
                className="input"
                disabled={loading || refreshing}
              />
            </Field>

            <Field label="Sort By">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="select"
                disabled={loading || refreshing}
              >
                <option value="name">Name</option>
                <option value="location">Location</option>
                <option value="singles_rating">Singles Rating</option>
                <option value="singles_dynamic_rating">Singles Dynamic</option>
                <option value="doubles_rating">Doubles Rating</option>
                <option value="doubles_dynamic_rating">Doubles Dynamic</option>
                <option value="overall_rating">Overall Rating</option>
                <option value="overall_dynamic_rating">Overall Dynamic</option>
              </select>
            </Field>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() => loadPlayers(true)}
              className="button-ghost"
              style={{
                background: 'rgba(15,23,42,0.06)',
                color: '#0f172a',
                border: '1px solid rgba(15,23,42,0.08)',
                opacity: refreshing ? 0.7 : 1,
                cursor: refreshing ? 'not-allowed' : 'pointer',
              }}
              disabled={refreshing || loading}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>

            <button
              onClick={handleRecalculateRatings}
              className="button-primary"
              style={{
                opacity: recalculating ? 0.7 : 1,
                cursor: recalculating ? 'not-allowed' : 'pointer',
              }}
              disabled={recalculating || loading}
            >
              {recalculating ? 'Recalculating...' : 'Recalculate Ratings'}
            </button>
          </div>
        </div>

        {message && (
          <div
            className="badge badge-green"
            style={{
              marginTop: '16px',
              minHeight: 44,
              width: '100%',
              justifyContent: 'flex-start',
              padding: '10px 14px',
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            className="badge"
            style={{
              marginTop: '16px',
              minHeight: 44,
              width: '100%',
              justifyContent: 'flex-start',
              padding: '10px 14px',
              background: 'rgba(220,38,38,0.12)',
              color: '#991b1b',
              border: '1px solid rgba(220,38,38,0.18)',
            }}
          >
            {error}
          </div>
        )}

        <div className="metric-grid" style={{ marginTop: '20px' }}>
          <MetricCard label="Total Players" value={players.length} />
          <MetricCard label="Filtered Players" value={filteredPlayers.length} />
          <MetricCard
            label="Editable Rows"
            value={filteredPlayers.length}
          />
        </div>

        {loading ? (
          <p style={{ marginTop: '20px' }} className="subtle-text">
            Loading players...
          </p>
        ) : filteredPlayers.length === 0 ? (
          <p style={{ marginTop: '20px' }} className="subtle-text">
            No players found.
          </p>
        ) : (
          <div className="table-wrap" style={{ marginTop: '20px' }}>
            <table className="data-table" style={{ minWidth: 1250 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Singles</th>
                  <th>Singles Dynamic</th>
                  <th>Doubles</th>
                  <th>Doubles Dynamic</th>
                  <th>Overall</th>
                  <th>Overall Dynamic</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player) => (
                  <tr key={player.id}>
                    <td>
                      <input
                        value={String(getPlayerValue(player, 'name') || '')}
                        onChange={(e) => updatePlayerField(player.id, 'name', e.target.value)}
                        className="input"
                        style={{ minWidth: 180, padding: '10px 12px' }}
                        disabled={savingId === player.id || deletingId === player.id}
                      />
                    </td>

                    <td>
                      <input
                        value={String(getPlayerValue(player, 'location') || '')}
                        onChange={(e) => updatePlayerField(player.id, 'location', e.target.value)}
                        className="input"
                        style={{ minWidth: 150, padding: '10px 12px' }}
                        disabled={savingId === player.id || deletingId === player.id}
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={String(getPlayerValue(player, 'singles_rating') ?? '')}
                        onChange={(e) =>
                          updatePlayerField(player.id, 'singles_rating', e.target.value)
                        }
                        className="input"
                        style={{ width: 110, padding: '10px 12px' }}
                        disabled={savingId === player.id || deletingId === player.id}
                      />
                    </td>

                    <td>{formatRating(player.singles_dynamic_rating)}</td>

                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={String(getPlayerValue(player, 'doubles_rating') ?? '')}
                        onChange={(e) =>
                          updatePlayerField(player.id, 'doubles_rating', e.target.value)
                        }
                        className="input"
                        style={{ width: 110, padding: '10px 12px' }}
                        disabled={savingId === player.id || deletingId === player.id}
                      />
                    </td>

                    <td>{formatRating(player.doubles_dynamic_rating)}</td>

                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={String(getPlayerValue(player, 'overall_rating') ?? '')}
                        onChange={(e) =>
                          updatePlayerField(player.id, 'overall_rating', e.target.value)
                        }
                        className="input"
                        style={{ width: 110, padding: '10px 12px' }}
                        disabled={savingId === player.id || deletingId === player.id}
                      />
                    </td>

                    <td>{formatRating(player.overall_dynamic_rating)}</td>

                    <td>
                      <div
                        style={{
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          onClick={() => handleSavePlayer(player)}
                          className="button-secondary"
                          style={{
                            minHeight: 40,
                            padding: '0 14px',
                            opacity:
                              savingId === player.id || !isPlayerDirty(player.id) ? 0.7 : 1,
                            cursor:
                              savingId === player.id || !isPlayerDirty(player.id)
                                ? 'not-allowed'
                                : 'pointer',
                          }}
                          disabled={savingId === player.id || !isPlayerDirty(player.id)}
                        >
                          {savingId === player.id ? 'Saving...' : 'Save'}
                        </button>

                        <button
                          onClick={() => handleDeletePlayer(player)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: 40,
                            padding: '0 14px',
                            border: 'none',
                            borderRadius: 12,
                            background: '#dc2626',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            opacity: deletingId === player.id ? 0.7 : 1,
                            cursor: deletingId === player.id ? 'not-allowed' : 'pointer',
                          }}
                          disabled={deletingId === player.id}
                        >
                          {deletingId === player.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  )
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = (value ?? '').trim()
  return normalized ? normalized : null
}

function formatRating(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value.toFixed(3)
}