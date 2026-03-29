'use client'

import Link from 'next/link'
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

      const haystack = [
        player.name,
        player.location || '',
      ]
        .join(' ')
        .toLowerCase()

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
    return <p style={{ padding: '24px' }}>Checking access...</p>
  }

  if (!user || user.id !== ADMIN_ID) {
    return null
  }

  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
        <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
        <Link href="/admin" style={navLinkStyle}>Admin</Link>
        <Link href="/admin/add-match" style={navLinkStyle}>Add Match</Link>
        <Link href="/admin/csv-import" style={navLinkStyle}>CSV Import</Link>
        <Link href="/admin/paste-results" style={navLinkStyle}>Paste Results</Link>
        <Link href="/admin/manage-matches" style={navLinkStyle}>Manage Matches</Link>
        <Link href="/admin/manage-players" style={navLinkStyle}>Manage Players</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>Manage Players</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          View, search, edit, and delete players using the new singles, doubles, and overall ratings structure.
        </p>
      </div>

      <div style={cardStyle}>
        <div style={toolbarStyle}>
          <div style={filterGridStyle}>
            <div>
              <label style={labelStyle}>Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Player name or location"
                style={inputStyle}
                disabled={loading || refreshing}
              />
            </div>

            <div>
              <label style={labelStyle}>Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                style={inputStyle}
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
            </div>
          </div>

          <div style={buttonRowStyle}>
            <button
              onClick={() => loadPlayers(true)}
              style={{
                ...secondaryButtonStyle,
                opacity: refreshing ? 0.7 : 1,
                cursor: refreshing ? 'not-allowed' : 'pointer',
              }}
              disabled={refreshing || loading}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>

            <button
              onClick={handleRecalculateRatings}
              style={{
                ...primaryButtonStyle,
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
          <div style={successBoxStyle}>
            <p style={{ margin: 0, fontWeight: 700 }}>{message}</p>
          </div>
        )}

        {error && (
          <div style={errorBoxStyle}>
            <p style={{ margin: 0, fontWeight: 700 }}>{error}</p>
          </div>
        )}

        <div style={summaryGridStyle}>
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Total Players</div>
            <div style={summaryValueStyle}>{players.length}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Filtered Players</div>
            <div style={summaryValueStyle}>{filteredPlayers.length}</div>
          </div>
        </div>

        {loading ? (
          <p style={{ marginTop: '20px' }}>Loading players...</p>
        ) : filteredPlayers.length === 0 ? (
          <p style={{ marginTop: '20px', color: '#64748b' }}>No players found.</p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '20px' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Location</th>
                  <th style={thStyle}>Singles</th>
                  <th style={thStyle}>Singles Dynamic</th>
                  <th style={thStyle}>Doubles</th>
                  <th style={thStyle}>Doubles Dynamic</th>
                  <th style={thStyle}>Overall</th>
                  <th style={thStyle}>Overall Dynamic</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player) => (
                  <tr key={player.id} style={rowStyle}>
                    <td style={tdStyle}>
                      <input
                        value={String(getPlayerValue(player, 'name') || '')}
                        onChange={(e) => updatePlayerField(player.id, 'name', e.target.value)}
                        style={tableInputStyle}
                        disabled={savingId === player.id || deletingId === player.id}
                      />
                    </td>

                    <td style={tdStyle}>
                      <input
                        value={String(getPlayerValue(player, 'location') || '')}
                        onChange={(e) => updatePlayerField(player.id, 'location', e.target.value)}
                        style={tableInputStyle}
                        disabled={savingId === player.id || deletingId === player.id}
                      />
                    </td>

                    <td style={tdStyle}>
                      <input
                        type="number"
                        step="0.01"
                        value={String(getPlayerValue(player, 'singles_rating') ?? '')}
                        onChange={(e) => updatePlayerField(player.id, 'singles_rating', e.target.value)}
                        style={tableNumberInputStyle}
                        disabled={savingId === player.id || deletingId === player.id}
                      />
                    </td>

                    <td style={tdStyle}>{formatRating(player.singles_dynamic_rating)}</td>

                    <td style={tdStyle}>
                      <input
                        type="number"
                        step="0.01"
                        value={String(getPlayerValue(player, 'doubles_rating') ?? '')}
                        onChange={(e) => updatePlayerField(player.id, 'doubles_rating', e.target.value)}
                        style={tableNumberInputStyle}
                        disabled={savingId === player.id || deletingId === player.id}
                      />
                    </td>

                    <td style={tdStyle}>{formatRating(player.doubles_dynamic_rating)}</td>

                    <td style={tdStyle}>
                      <input
                        type="number"
                        step="0.01"
                        value={String(getPlayerValue(player, 'overall_rating') ?? '')}
                        onChange={(e) => updatePlayerField(player.id, 'overall_rating', e.target.value)}
                        style={tableNumberInputStyle}
                        disabled={savingId === player.id || deletingId === player.id}
                      />
                    </td>

                    <td style={tdStyle}>{formatRating(player.overall_dynamic_rating)}</td>

                    <td style={tdStyle}>
                      <div style={actionRowStyle}>
                        <button
                          onClick={() => handleSavePlayer(player)}
                          style={{
                            ...primarySmallButtonStyle,
                            opacity: savingId === player.id || !isPlayerDirty(player.id) ? 0.7 : 1,
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
                            ...dangerButtonStyle,
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
      </div>
    </main>
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

const mainStyle = {
  padding: '24px',
  fontFamily: 'Arial, sans-serif',
  maxWidth: '1300px',
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
  alignItems: 'end',
  gap: '16px',
  flexWrap: 'wrap' as const,
}

const filterGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
  flex: 1,
  minWidth: '320px',
}

const labelStyle = {
  display: 'block',
  marginBottom: '8px',
  color: '#334155',
  fontWeight: 600,
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  fontSize: '15px',
  boxSizing: 'border-box' as const,
}

const buttonRowStyle = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap' as const,
}

const primaryButtonStyle = {
  padding: '14px 18px',
  border: 'none',
  borderRadius: '14px',
  background: '#2563eb',
  color: 'white',
  fontWeight: 700,
  fontSize: '15px',
}

const primarySmallButtonStyle = {
  padding: '10px 14px',
  border: 'none',
  borderRadius: '12px',
  background: '#2563eb',
  color: 'white',
  fontWeight: 700,
  fontSize: '14px',
}

const secondaryButtonStyle = {
  padding: '14px 18px',
  border: '1px solid #cbd5e1',
  borderRadius: '14px',
  background: 'white',
  color: '#0f172a',
  fontWeight: 700,
  fontSize: '15px',
}

const dangerButtonStyle = {
  padding: '10px 14px',
  border: 'none',
  borderRadius: '12px',
  background: '#dc2626',
  color: 'white',
  fontWeight: 700,
  fontSize: '14px',
}

const successBoxStyle = {
  marginTop: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: '#dcfce7',
  border: '1px solid #86efac',
  color: '#166534',
}

const errorBoxStyle = {
  marginTop: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: '#fee2e2',
  border: '1px solid #fca5a5',
  color: '#991b1b',
}

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '12px',
  marginTop: '20px',
}

const summaryCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '14px',
}

const summaryLabelStyle = {
  color: '#64748b',
  fontSize: '13px',
  marginBottom: '6px',
}

const summaryValueStyle = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: 700,
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
  whiteSpace: 'nowrap' as const,
}

const tdStyle = {
  padding: '12px',
  borderBottom: '1px solid #e2e8f0',
  color: '#0f172a',
  verticalAlign: 'top' as const,
}

const rowStyle = {
  background: 'white',
}

const tableInputStyle = {
  width: '180px',
  padding: '10px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  fontSize: '14px',
  boxSizing: 'border-box' as const,
}

const tableNumberInputStyle = {
  width: '110px',
  padding: '10px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  fontSize: '14px',
  boxSizing: 'border-box' as const,
}

const actionRowStyle = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap' as const,
}