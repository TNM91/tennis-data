'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { recalculateDynamicRatings } from '../../../lib/recalculateRatings'

type MatchType = 'singles' | 'doubles'

type Player = {
  id: string
  name: string
  rating: string
  dynamic_rating?: number | null
  singles_dynamic_rating?: number | null
  doubles_dynamic_rating?: number | null
  overall_dynamic_rating?: number | null
}

type MatchInsertRow = {
  player_id: string
  opponent_id?: string | null
  opponent: string
  result: string
  date: string
  match_type: MatchType
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10)
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

function formatPlayerRating(player: Player, matchType: MatchType) {
  const value =
    matchType === 'singles'
      ? player.singles_dynamic_rating ?? player.overall_dynamic_rating ?? player.dynamic_rating
      : player.doubles_dynamic_rating ?? player.overall_dynamic_rating ?? player.dynamic_rating

  if (value !== null && value !== undefined && Number.isFinite(Number(value))) {
    return Number(value).toFixed(2)
  }

  return Number(player.rating || 3.5).toFixed(2)
}

const ADMIN_ID = 'accc3471-8912-491c-b8d9-4a84dcc7c42e'

export default function AddMatchPage() {
  const router = useRouter()

  const [players, setPlayers] = useState<Player[]>([])
  const [playerId, setPlayerId] = useState('')
  const [opponentId, setOpponentId] = useState('')
  const [result, setResult] = useState('')
  const [date, setDate] = useState(getTodayDateString())
  const [matchType, setMatchType] = useState<MatchType>('singles')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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

      await fetchPlayers()
    }

    checkUser()
  }, [router])

  async function fetchPlayers() {
    const { data, error } = await supabase
      .from('players')
      .select(
        'id, name, rating, dynamic_rating, singles_dynamic_rating, doubles_dynamic_rating, overall_dynamic_rating'
      )
      .order('name')

    if (error) {
      setError(error.message)
      return
    }

    setPlayers((data || []) as Player[])
  }

  const availableOpponents = useMemo(
    () => players.filter((player) => player.id !== playerId),
    [players, playerId]
  )

  const isSubmitDisabled =
    saving ||
    !playerId ||
    !opponentId ||
    !result.trim() ||
    !date ||
    playerId === opponentId

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)

    try {
      if (!playerId || !opponentId || !result.trim() || !date) {
        throw new Error('Please fill out all fields.')
      }

      if (playerId === opponentId) {
        throw new Error('Player and opponent must be different.')
      }

      const player = players.find((p) => p.id === playerId)
      const opponent = players.find((p) => p.id === opponentId)

      if (!player || !opponent) {
        throw new Error('Could not find selected players.')
      }

      const normalizedResult = normalizeResult(result)

      const rowsToInsert: MatchInsertRow[] = [
        {
          player_id: playerId,
          opponent_id: opponentId,
          opponent: opponent.name,
          result: normalizedResult,
          date,
          match_type: matchType,
        },
        {
          player_id: opponentId,
          opponent_id: playerId,
          opponent: player.name,
          result: reverseResult(normalizedResult),
          date,
          match_type: matchType,
        },
      ]

      const { data, error: insertError } = await supabase
        .from('matches')
        .upsert(rowsToInsert, {
          onConflict: 'player_id,opponent_id,date,result,match_type',
          ignoreDuplicates: true,
        })
        .select('id')

      if (insertError) {
        throw new Error(insertError.message)
      }

      const insertedCount = data?.length ?? 0

      if (insertedCount === 0) {
        setMessage('This match already exists. No new rows were added.')
        return
      }

      await recalculateDynamicRatings()
      await fetchPlayers()

      setMessage(`Match added successfully as ${matchType}. Ratings updated.`)
      setPlayerId('')
      setOpponentId('')
      setResult('')
      setDate(getTodayDateString())
      setMatchType('singles')

      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return <p style={{ padding: '24px' }}>Checking access...</p>
  }

  if (!user || user.id !== ADMIN_ID) {
    return null
  }

  return (
    <main
      style={{
        padding: '24px',
        fontFamily: 'Arial, sans-serif',
        maxWidth: '1000px',
        margin: '0 auto',
        background: '#f8fafc',
        minHeight: '100vh',
      }}
    >
      <div style={navScrollerStyle}>
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
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>Add Match</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          Add a singles or doubles result, prevent duplicates, and update ratings plus history.
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>New Match</h2>

        <form onSubmit={handleSubmit}>
          <div style={formGridStyle}>
            <div>
              <label style={labelStyle}>Match Type</label>
              <select
                value={matchType}
                onChange={(e) => setMatchType(e.target.value as MatchType)}
                style={inputStyle}
                disabled={saving}
              >
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}
                disabled={saving}
              />
            </div>

            <div>
              <label style={labelStyle}>Player</label>
              <select
                value={playerId}
                onChange={(e) => {
                  const nextPlayerId = e.target.value
                  setPlayerId(nextPlayerId)

                  if (nextPlayerId && nextPlayerId === opponentId) {
                    setOpponentId('')
                  }
                }}
                style={inputStyle}
                disabled={saving}
              >
                <option value="">Select player</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} ({formatPlayerRating(player, matchType)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Opponent</label>
              <select
                value={opponentId}
                onChange={(e) => setOpponentId(e.target.value)}
                style={inputStyle}
                disabled={saving}
              >
                <option value="">Select opponent</option>
                {availableOpponents.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} ({formatPlayerRating(player, matchType)})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Result</label>
              <input
                type="text"
                value={result}
                onChange={(e) => setResult(e.target.value)}
                placeholder="W 6-3 6-4"
                style={inputStyle}
                disabled={saving}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              style={{
                ...primaryButtonStyle,
                opacity: isSubmitDisabled ? 0.65 : 1,
                cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Save Match'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '16px' }}>
          <p style={{ color: '#64748b', margin: 0 }}>
            Result examples: <strong>W 6-3 6-4</strong>, <strong>L 4-6 6-7</strong>
          </p>
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
      </div>
    </main>
  )
}

const navScrollerStyle = {
  overflowX: 'auto' as const,
  marginBottom: '24px',
  paddingBottom: '4px',
}

const navRowStyle = {
  display: 'inline-flex',
  gap: '12px',
  minWidth: 'max-content' as const,
  whiteSpace: 'nowrap' as const,
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

const primaryButtonStyle = {
  padding: '14px 18px',
  border: 'none',
  borderRadius: '14px',
  background: '#2563eb',
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