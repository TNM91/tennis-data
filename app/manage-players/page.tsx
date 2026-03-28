'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { recalculateDynamicRatings } from '../../lib/recalculateRatings'

type Player = {
  id: string
  name: string
  rating: string
  dynamic_rating?: number | null
  location?: string | null
}

type MatchRow = {
  id: string
  player_id: string
  opponent_id: string | null
  opponent: string
  result: string
  date: string
}

type SnapshotRow = {
  id: string
  player_id: string
  match_id: string
  snapshot_date: string
  dynamic_rating: number
}

export default function ManagePlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')

  const [renamePlayerId, setRenamePlayerId] = useState('')
  const [renameValue, setRenameValue] = useState('')

  const [mergeSourceId, setMergeSourceId] = useState('')
  const [mergeTargetId, setMergeTargetId] = useState('')

  useEffect(() => {
    void loadPlayers()
  }, [])

  async function loadPlayers() {
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, name, rating, dynamic_rating, location')
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

  async function handleRenamePlayer() {
    setError('')
    setMessage('')

    try {
      if (!renamePlayerId) {
        throw new Error('Select a player to rename.')
      }

      const trimmedName = normalizeName(renameValue)

      if (!trimmedName) {
        throw new Error('Enter a new player name.')
      }

      const existingSameName = players.find(
        (player) =>
          player.id !== renamePlayerId &&
          normalizeName(player.name).toLowerCase() === trimmedName.toLowerCase()
      )

      if (existingSameName) {
        throw new Error(
          `A player named "${trimmedName}" already exists. Use merge instead of rename.`
        )
      }

      setWorking(true)

      const player = players.find((p) => p.id === renamePlayerId)
      if (!player) {
        throw new Error('Could not find selected player.')
      }

      const oldName = player.name

      const { error: updatePlayerError } = await supabase
        .from('players')
        .update({ name: trimmedName })
        .eq('id', renamePlayerId)

      if (updatePlayerError) {
        throw new Error(updatePlayerError.message)
      }

      const { data: matchesToUpdate, error: fetchMatchesError } = await supabase
        .from('matches')
        .select('id, opponent')
        .eq('opponent_id', renamePlayerId)

      if (fetchMatchesError) {
        throw new Error(fetchMatchesError.message)
      }

      const staleOpponentRows = ((matchesToUpdate || []) as Array<{ id: string; opponent: string }>)
        .filter((row) => normalizeName(row.opponent).toLowerCase() === normalizeName(oldName).toLowerCase())
        .map((row) => ({
          id: row.id,
          opponent: trimmedName,
        }))

      for (const chunk of chunkArray(staleOpponentRows, 500)) {
        if (chunk.length === 0) continue

        const { error } = await supabase
          .from('matches')
          .upsert(chunk, { onConflict: 'id' })

        if (error) {
          throw new Error(error.message)
        }
      }

      setMessage(`Renamed "${oldName}" to "${trimmedName}".`)
      setRenamePlayerId('')
      setRenameValue('')
      await loadPlayers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed')
    } finally {
      setWorking(false)
    }
  }

  async function handleMergePlayers() {
    setError('')
    setMessage('')

    try {
      if (!mergeSourceId || !mergeTargetId) {
        throw new Error('Select both source and target players.')
      }

      if (mergeSourceId === mergeTargetId) {
        throw new Error('Source and target players must be different.')
      }

      const source = players.find((p) => p.id === mergeSourceId)
      const target = players.find((p) => p.id === mergeTargetId)

      if (!source || !target) {
        throw new Error('Could not find selected players.')
      }

      const confirmed = window.confirm(
        `Merge "${source.name}" into "${target.name}"?\n\nThis will:\n- move match rows\n- move snapshots\n- update opponent references\n- delete the source player\n- rebuild ratings`
      )

      if (!confirmed) return

      setWorking(true)

      await moveMatchesFromSourceToTarget(source, target)
      await updateOpponentReferences(source, target)
      await moveSnapshotsFromSourceToTarget(source, target)
      await removeDuplicateMatches()
      await removeDuplicateSnapshots()
      await deleteSourcePlayer(source.id)
      await recalculateDynamicRatings()

      setMessage(`Merged "${source.name}" into "${target.name}" successfully.`)
      setMergeSourceId('')
      setMergeTargetId('')
      await loadPlayers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setWorking(false)
    }
  }

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase()

    return players.filter((player) => {
      if (!q) return true

      return (
        player.name.toLowerCase().includes(q) ||
        String(player.dynamic_rating ?? player.rating ?? '').toLowerCase().includes(q) ||
        String(player.location ?? '').toLowerCase().includes(q)
      )
    })
  }, [players, search])

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
        <h1 style={{ margin: 0, fontSize: '36px' }}>Manage Players</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          Rename players, merge duplicate player records, and keep match history plus ratings clean.
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Rename Player</h2>

        <div style={formGridStyle}>
          <select
            value={renamePlayerId}
            onChange={(e) => {
              const nextId = e.target.value
              setRenamePlayerId(nextId)

              const selected = players.find((p) => p.id === nextId)
              setRenameValue(selected?.name ?? '')
            }}
            style={inputStyle}
            disabled={working}
          >
            <option value="">Select player</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>

          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="New player name"
            style={inputStyle}
            disabled={working}
          />

          <button
            onClick={() => void handleRenamePlayer()}
            style={{
              ...primaryButtonStyle,
              opacity: working ? 0.7 : 1,
              cursor: working ? 'not-allowed' : 'pointer',
            }}
            disabled={working}
          >
            {working ? 'Working...' : 'Rename Player'}
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Merge Players</h2>

        <p style={{ color: '#64748b', marginTop: 0 }}>
          Choose the duplicate player as the source, and the player record you want to keep as the target.
        </p>

        <div style={formGridStyle}>
          <select
            value={mergeSourceId}
            onChange={(e) => setMergeSourceId(e.target.value)}
            style={inputStyle}
            disabled={working}
          >
            <option value="">Source player to merge from</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>

          <select
            value={mergeTargetId}
            onChange={(e) => setMergeTargetId(e.target.value)}
            style={inputStyle}
            disabled={working}
          >
            <option value="">Target player to keep</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => void handleMergePlayers()}
            style={{
              ...dangerButtonStyle,
              opacity: working ? 0.7 : 1,
              cursor: working ? 'not-allowed' : 'pointer',
            }}
            disabled={working}
          >
            {working ? 'Working...' : 'Merge Players'}
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={toolbarStyle}>
          <h2 style={{ margin: 0 }}>Players</h2>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players"
            style={searchInputStyle}
          />
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

        <div style={{ overflowX: 'auto', marginTop: '18px' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Dynamic Rating</th>
                <th style={thStyle}>Base Rating</th>
                <th style={thStyle}>Location</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td style={tdStyle} colSpan={4}>Loading players...</td>
                </tr>
              ) : filteredPlayers.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={4}>No players found.</td>
                </tr>
              ) : (
                filteredPlayers.map((player) => (
                  <tr key={player.id}>
                    <td style={tdStyle}>{player.name}</td>
                    <td style={tdStyle}>{formatRating(player.dynamic_rating)}</td>
                    <td style={tdStyle}>{player.rating}</td>
                    <td style={tdStyle}>{player.location || '—'}</td>
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

async function moveMatchesFromSourceToTarget(source: Player, target: Player) {
  const { data, error } = await supabase
    .from('matches')
    .select('id, player_id, opponent_id, opponent, result, date')
    .eq('player_id', source.id)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data || []) as MatchRow[]

  const updatedRows = rows.map((row) => ({
    id: row.id,
    player_id: target.id,
  }))

  for (const chunk of chunkArray(updatedRows, 500)) {
    if (chunk.length === 0) continue

    const { error: updateError } = await supabase
      .from('matches')
      .upsert(chunk, { onConflict: 'id' })

    if (updateError) {
      throw new Error(updateError.message)
    }
  }
}

async function updateOpponentReferences(source: Player, target: Player) {
  const { data, error } = await supabase
    .from('matches')
    .select('id, player_id, opponent_id, opponent, result, date')
    .eq('opponent_id', source.id)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data || []) as MatchRow[]

  const updatedRows = rows.map((row) => ({
    id: row.id,
    opponent_id: target.id,
    opponent:
      normalizeName(row.opponent).toLowerCase() === normalizeName(source.name).toLowerCase()
        ? target.name
        : row.opponent,
  }))

  for (const chunk of chunkArray(updatedRows, 500)) {
    if (chunk.length === 0) continue

    const { error: updateError } = await supabase
      .from('matches')
      .upsert(chunk, { onConflict: 'id' })

    if (updateError) {
      throw new Error(updateError.message)
    }
  }
}

async function moveSnapshotsFromSourceToTarget(source: Player, target: Player) {
  const { data, error } = await supabase
    .from('rating_snapshots')
    .select('id, player_id, match_id, snapshot_date, dynamic_rating')
    .eq('player_id', source.id)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data || []) as SnapshotRow[]

  const updates = rows.map((row) => ({
    id: row.id,
    player_id: target.id,
  }))

  for (const chunk of chunkArray(updates, 500)) {
    if (chunk.length === 0) continue

    const { error: updateError } = await supabase
      .from('rating_snapshots')
      .upsert(chunk, { onConflict: 'id' })

    if (updateError) {
      throw new Error(updateError.message)
    }
  }
}

async function removeDuplicateMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('id, player_id, opponent_id, result, date')
    .order('id', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data || []) as Array<{
    id: string
    player_id: string
    opponent_id: string | null
    result: string
    date: string
  }>

  const seen = new Map<string, string>()
  const duplicateIds: string[] = []

  for (const row of rows) {
    const key = `${row.player_id}|${row.opponent_id ?? ''}|${row.date}|${row.result}`

    if (seen.has(key)) {
      duplicateIds.push(row.id)
    } else {
      seen.set(key, row.id)
    }
  }

  for (const chunk of chunkArray(duplicateIds, 500)) {
    if (chunk.length === 0) continue

    const { error: deleteError } = await supabase
      .from('matches')
      .delete()
      .in('id', chunk)

    if (deleteError) {
      throw new Error(deleteError.message)
    }
  }
}

async function removeDuplicateSnapshots() {
  const { data, error } = await supabase
    .from('rating_snapshots')
    .select('id, player_id, match_id, snapshot_date')
    .order('id', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data || []) as Array<{
    id: string
    player_id: string
    match_id: string
    snapshot_date: string
  }>

  const seen = new Map<string, string>()
  const duplicateIds: string[] = []

  for (const row of rows) {
    const key = `${row.player_id}|${row.match_id}|${row.snapshot_date}`

    if (seen.has(key)) {
      duplicateIds.push(row.id)
    } else {
      seen.set(key, row.id)
    }
  }

  for (const chunk of chunkArray(duplicateIds, 500)) {
    if (chunk.length === 0) continue

    const { error: deleteError } = await supabase
      .from('rating_snapshots')
      .delete()
      .in('id', chunk)

    if (deleteError) {
      throw new Error(deleteError.message)
    }
  }
}

async function deleteSourcePlayer(sourcePlayerId: string) {
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', sourcePlayerId)

  if (error) {
    throw new Error(error.message)
  }
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function formatRating(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '—'

  const num = Number(value)
  return Number.isFinite(num) ? num.toFixed(2) : String(value)
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }

  return chunks
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

const formGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '16px',
  alignItems: 'center',
}

const toolbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap' as const,
  alignItems: 'center',
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

const searchInputStyle = {
  ...inputStyle,
  maxWidth: '320px',
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

const dangerButtonStyle = {
  padding: '14px 18px',
  border: 'none',
  borderRadius: '14px',
  background: '#dc2626',
  color: 'white',
  fontWeight: 700,
  fontSize: '15px',
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
}