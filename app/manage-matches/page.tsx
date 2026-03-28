'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { recalculateDynamicRatings } from '../../lib/recalculateRatings'

type MatchType = 'singles' | 'doubles'

type MatchRow = {
  id: string
  player_id: string
  opponent_id: string | null
  opponent: string
  result: string
  date: string
  match_type?: MatchType | null
  player_name?: string
}

type PlayerRow = {
  id: string
  name: string
}

const ADMIN_ID = 'accc3471-8912-491c-b8d9-4a84dcc7c42e'

export default function ManageMatchesPage() {
  const router = useRouter()

  const [matches, setMatches] = useState<MatchRow[]>([])
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [rebuilding, setRebuilding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [playerFilter, setPlayerFilter] = useState('')
  const [opponentFilter, setOpponentFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [matchTypeFilter, setMatchTypeFilter] = useState('')
  const [searchText, setSearchText] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editResult, setEditResult] = useState('')
  const [editOpponentId, setEditOpponentId] = useState('')
  const [editMatchType, setEditMatchType] = useState<MatchType>('singles')

  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setUser(user)
      setAuthLoading(false)

      if (!user || user.id !== ADMIN_ID) {
        router.push('/admin')
        return
      }

      await loadData()
    }

    checkUser()
  }, [router])

  async function loadData() {
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id, name')
        .order('name', { ascending: true })

      if (playersError) {
        throw new Error(playersError.message)
      }

      const playerNameMap = new Map<string, string>()
      for (const player of (playersData || []) as PlayerRow[]) {
        playerNameMap.set(player.id, player.name)
      }

      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('id, player_id, opponent_id, opponent, result, date, match_type')
        .order('date', { ascending: false })
        .order('id', { ascending: false })

      if (matchesError) {
        throw new Error(matchesError.message)
      }

      const hydratedMatches: MatchRow[] = ((matchesData || []) as MatchRow[]).map((match) => ({
        ...match,
        player_name: playerNameMap.get(match.player_id) || 'Unknown Player',
        match_type: normalizeMatchType(match.match_type),
      }))

      setPlayers((playersData || []) as PlayerRow[])
      setMatches(hydratedMatches)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(match: MatchRow) {
    setEditingId(match.id)
    setEditDate(match.date)
    setEditResult(match.result)
    setEditOpponentId(match.opponent_id ?? '')
    setEditMatchType(normalizeMatchType(match.match_type))
    setError('')
    setMessage('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDate('')
    setEditResult('')
    setEditOpponentId('')
    setEditMatchType('singles')
  }

  async function handleSaveEdit(match: MatchRow) {
    setSaving(true)
    setError('')
    setMessage('')

    try {
      if (!editDate.trim()) {
        throw new Error('Date is required.')
      }

      const normalizedResult = normalizeResult(editResult)
      if (!normalizedResult) {
        throw new Error('Result is required.')
      }

      if (!editOpponentId) {
        throw new Error('Opponent is required.')
      }

      if (editOpponentId === match.player_id) {
        throw new Error('Player and opponent must be different.')
      }

      const player = players.find((p) => p.id === match.player_id)
      const newOpponent = players.find((p) => p.id === editOpponentId)

      if (!player || !newOpponent) {
        throw new Error('Could not resolve selected players.')
      }

      const oldReverseResult = reverseResult(match.result)
      const newReverseResult = reverseResult(normalizedResult)

      const { error: updatePrimaryError } = await supabase
        .from('matches')
        .update({
          date: editDate,
          result: normalizedResult,
          opponent_id: newOpponent.id,
          opponent: newOpponent.name,
          match_type: editMatchType,
        })
        .eq('id', match.id)

      if (updatePrimaryError) {
        throw new Error(updatePrimaryError.message)
      }

      if (match.opponent_id) {
        const { data: mirrorRows, error: mirrorFindError } = await supabase
          .from('matches')
          .select('id')
          .eq('player_id', match.opponent_id)
          .eq('opponent_id', match.player_id)
          .eq('date', match.date)
          .eq('result', oldReverseResult)
          .eq('match_type', normalizeMatchType(match.match_type))
          .limit(1)

        if (mirrorFindError) {
          throw new Error(mirrorFindError.message)
        }

        const mirrorId = mirrorRows?.[0]?.id

        if (mirrorId) {
          const { error: updateMirrorError } = await supabase
            .from('matches')
            .update({
              date: editDate,
              result: newReverseResult,
              opponent_id: match.player_id,
              opponent: player.name,
              match_type: editMatchType,
            })
            .eq('id', mirrorId)

          if (updateMirrorError) {
            throw new Error(updateMirrorError.message)
          }
        }
      }

      await recalculateDynamicRatings()
      setMessage('Match updated and ratings rebuilt successfully.')
      cancelEdit()
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edit failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteMatch(matchId: string) {
    const confirmed = window.confirm(
      'Delete this match row? You will need to rebuild ratings after cleanup.'
    )

    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId)

      if (error) {
        throw new Error(error.message)
      }

      setMatches((prev) => prev.filter((match) => match.id !== matchId))
      setMessage('Match row deleted. Rebuild ratings to sync profiles and charts.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  async function handleDeleteBothSides(match: MatchRow) {
    const confirmed = window.confirm(
      'Delete both sides of this match and rebuild ratings later?'
    )

    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      const reverse = reverseResult(match.result)

      const { error: primaryDeleteError } = await supabase
        .from('matches')
        .delete()
        .or(
          [
            `and(id.eq.${match.id})`,
            match.opponent_id
              ? `and(player_id.eq.${match.opponent_id},opponent_id.eq.${match.player_id},date.eq.${match.date},result.eq.${escapeForOr(reverse)},match_type.eq.${normalizeMatchType(match.match_type)})`
              : '',
          ]
            .filter(Boolean)
            .join(',')
        )

      if (primaryDeleteError) {
        throw new Error(primaryDeleteError.message)
      }

      setMessage('Both sides deleted. Rebuild ratings to sync profiles and charts.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete both sides failed')
    }
  }

  async function handleRebuildRatings() {
    const confirmed = window.confirm('Rebuild all dynamic ratings and snapshots now?')
    if (!confirmed) return

    setRebuilding(true)
    setError('')
    setMessage('')

    try {
      await recalculateDynamicRatings()
      setMessage('Ratings and snapshots rebuilt successfully.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rebuild failed')
    } finally {
      setRebuilding(false)
    }
  }

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      const playerOk = !playerFilter || match.player_id === playerFilter
      const opponentOk = !opponentFilter || (match.opponent_id ?? '') === opponentFilter
      const resultOk =
        !resultFilter ||
        (resultFilter === 'W'
          ? match.result.trim().toUpperCase().startsWith('W')
          : match.result.trim().toUpperCase().startsWith('L'))

      const typeOk =
        !matchTypeFilter || normalizeMatchType(match.match_type) === matchTypeFilter

      const text = searchText.trim().toLowerCase()
      const textOk =
        !text ||
        (match.player_name || '').toLowerCase().includes(text) ||
        match.opponent.toLowerCase().includes(text) ||
        match.result.toLowerCase().includes(text) ||
        match.date.toLowerCase().includes(text) ||
        normalizeMatchType(match.match_type).toLowerCase().includes(text)

      return playerOk && opponentOk && resultOk && typeOk && textOk
    })
  }, [matches, playerFilter, opponentFilter, resultFilter, matchTypeFilter, searchText])

  const availableOpponentsForEdit = useMemo(() => {
    if (!editingId) return players
    const current = matches.find((m) => m.id === editingId)
    if (!current) return players
    return players.filter((p) => p.id !== current.player_id)
  }, [editingId, matches, players])

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
        <Link href="/add-match" style={navLinkStyle}>Add Match</Link>
        <Link href="/csv-import" style={navLinkStyle}>CSV Import</Link>
        <Link href="/paste-results" style={navLinkStyle}>Paste Results</Link>
        <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
        <Link href="/manage-matches" style={navLinkStyle}>Manage Matches</Link>
        <Link href="/manage-players" style={navLinkStyle}>Manage Players</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>Manage Matches</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          Review imported rows, edit both sides of a match, clean up mistakes, and rebuild ratings when needed.
        </p>
      </div>

      <div style={cardStyle}>
        <div style={toolbarStyle}>
          <div style={filtersGridStyle}>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search player, opponent, result, date, type"
              style={inputStyle}
            />

            <select
              value={playerFilter}
              onChange={(e) => setPlayerFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">All players</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>

            <select
              value={opponentFilter}
              onChange={(e) => setOpponentFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">All opponents</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>

            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">All results</option>
              <option value="W">Wins</option>
              <option value="L">Losses</option>
            </select>

            <select
              value={matchTypeFilter}
              onChange={(e) => setMatchTypeFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">All match types</option>
              <option value="singles">Singles</option>
              <option value="doubles">Doubles</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => void loadData()}
              style={secondaryButtonStyle}
              disabled={loading || rebuilding || saving}
            >
              Refresh
            </button>

            <button
              onClick={() => void handleRebuildRatings()}
              style={{
                ...successButtonStyle,
                opacity: rebuilding ? 0.7 : 1,
                cursor: rebuilding ? 'not-allowed' : 'pointer',
              }}
              disabled={rebuilding || saving}
            >
              {rebuilding ? 'Rebuilding...' : 'Rebuild Ratings'}
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

        <div style={{ marginTop: '18px', color: '#64748b', fontWeight: 600 }}>
          Showing {filteredMatches.length} of {matches.length} match rows
        </div>

        <div style={{ overflowX: 'auto', marginTop: '18px' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Player</th>
                <th style={thStyle}>Opponent</th>
                <th style={thStyle}>Result</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td style={tdStyle} colSpan={6}>Loading matches...</td>
                </tr>
              ) : filteredMatches.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={6}>No matches found.</td>
                </tr>
              ) : (
                filteredMatches.map((match) => {
                  const isEditing = editingId === match.id

                  return (
                    <tr key={match.id}>
                      <td style={tdStyle}>
                        {isEditing ? (
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            style={inlineInputStyle}
                            disabled={saving}
                          />
                        ) : (
                          match.date
                        )}
                      </td>

                      <td style={tdStyle}>{match.player_name}</td>

                      <td style={tdStyle}>
                        {isEditing ? (
                          <select
                            value={editOpponentId}
                            onChange={(e) => setEditOpponentId(e.target.value)}
                            style={inlineInputStyle}
                            disabled={saving}
                          >
                            <option value="">Select opponent</option>
                            {availableOpponentsForEdit.map((player) => (
                              <option key={player.id} value={player.id}>
                                {player.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          match.opponent
                        )}
                      </td>

                      <td style={tdStyle}>
                        {isEditing ? (
                          <input
                            value={editResult}
                            onChange={(e) => setEditResult(e.target.value)}
                            style={inlineInputStyle}
                            placeholder="W 6-3 6-4"
                            disabled={saving}
                          />
                        ) : (
                          match.result
                        )}
                      </td>

                      <td style={tdStyle}>
                        {isEditing ? (
                          <select
                            value={editMatchType}
                            onChange={(e) => setEditMatchType(e.target.value as MatchType)}
                            style={inlineInputStyle}
                            disabled={saving}
                          >
                            <option value="singles">Singles</option>
                            <option value="doubles">Doubles</option>
                          </select>
                        ) : (
                          capitalize(normalizeMatchType(match.match_type))
                        )}
                      </td>

                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => void handleSaveEdit(match)}
                                style={successButtonStyleSmall}
                                disabled={saving}
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>

                              <button
                                onClick={cancelEdit}
                                style={secondaryButtonStyle}
                                disabled={saving}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(match)}
                                style={primaryButtonStyleSmall}
                                disabled={saving || rebuilding}
                              >
                                Edit
                              </button>

                              <button
                                onClick={() => void handleDeleteMatch(match.id)}
                                style={dangerButtonStyle}
                                disabled={saving || rebuilding}
                              >
                                Delete Row
                              </button>

                              {match.opponent_id && (
                                <button
                                  onClick={() => void handleDeleteBothSides(match)}
                                  style={secondaryButtonStyle}
                                  disabled={saving || rebuilding}
                                >
                                  Delete Both Sides
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

function normalizeResult(result: string) {
  return result.trim().replace(/\s+/g, ' ')
}

function reverseResult(result: string) {
  const trimmed = normalizeResult(result)

  if (trimmed.startsWith('W')) return trimmed.replace(/^W/, 'L')
  if (trimmed.startsWith('L')) return trimmed.replace(/^L/, 'W')

  return trimmed
}

function normalizeMatchType(value: string | null | undefined): MatchType {
  return value === 'doubles' ? 'doubles' : 'singles'
}

function escapeForOr(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`
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

const inlineInputStyle = {
  width: '100%',
  minWidth: '140px',
  padding: '8px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  fontSize: '14px',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
  background: 'white',
}

const successButtonStyle = {
  padding: '14px 18px',
  border: 'none',
  borderRadius: '14px',
  background: '#16a34a',
  color: 'white',
  fontWeight: 700,
  fontSize: '15px',
}

const successButtonStyleSmall = {
  padding: '10px 14px',
  border: 'none',
  borderRadius: '12px',
  background: '#16a34a',
  color: 'white',
  fontWeight: 700,
  fontSize: '14px',
}

const primaryButtonStyleSmall = {
  padding: '10px 14px',
  border: 'none',
  borderRadius: '12px',
  background: '#2563eb',
  color: 'white',
  fontWeight: 700,
  fontSize: '14px',
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