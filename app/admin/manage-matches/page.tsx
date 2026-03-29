'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { recalculateDynamicRatings } from '../../../lib/recalculateRatings'

type MatchType = 'singles' | 'doubles'
type MatchSide = 'A' | 'B'

type MatchRow = {
  id: string
  match_date: string
  match_type: MatchType
  score: string
  winner_side: MatchSide
  line_number: string | null
  source: string | null
  external_match_id: string | null
  dedupe_key: string
  created_at: string | null
}

type MatchPlayerJoinedRow = {
  match_id: string
  player_id: string
  side: MatchSide
  seat: number | null
  players:
    | {
        id: string
        name: string
      }
    | {
        id: string
        name: string
      }[]
    | null
}

type MatchParticipant = {
  playerId: string
  name: string
  seat: number | null
}

type MatchWithParticipants = {
  id: string
  matchDate: string
  matchType: MatchType
  score: string
  winnerSide: MatchSide
  lineNumber: string | null
  source: string | null
  externalMatchId: string | null
  dedupeKey: string
  createdAt: string | null
  sideA: MatchParticipant[]
  sideB: MatchParticipant[]
}

const ADMIN_ID = 'accc3471-8912-491c-b8d9-4a84dcc7c42e'

export default function ManageMatchesPage() {
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [matches, setMatches] = useState<MatchWithParticipants[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [recalculating, setRecalculating] = useState(false)

  const [search, setSearch] = useState('')
  const [matchTypeFilter, setMatchTypeFilter] = useState<'all' | MatchType>('all')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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

    void checkUser()
  }, [router])

  useEffect(() => {
    if (!user || user.id !== ADMIN_ID) return
    void loadMatches()
  }, [user])

  async function loadMatches(showRefreshing = false) {
    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
          id,
          match_date,
          match_type,
          score,
          winner_side,
          line_number,
          source,
          external_match_id,
          dedupe_key,
          created_at
        `)
        .order('match_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (matchesError) {
        throw new Error(matchesError.message)
      }

      const typedMatches = (matchesData || []) as MatchRow[]
      const matchIds = typedMatches.map((match) => match.id)

      let participantsData: MatchPlayerJoinedRow[] = []

      if (matchIds.length > 0) {
        const { data, error } = await supabase
          .from('match_players')
          .select(`
            match_id,
            player_id,
            side,
            seat,
            players (
              id,
              name
            )
          `)
          .in('match_id', matchIds)

        if (error) {
          throw new Error(error.message)
        }

        participantsData = (data || []) as MatchPlayerJoinedRow[]
      }

      const participantsByMatchId = new Map<string, MatchParticipant[]>()

      for (const participant of participantsData) {
        const rawPlayers = participant.players
        const playerRecord = Array.isArray(rawPlayers) ? rawPlayers[0] : rawPlayers

        const normalizedParticipant: MatchParticipant = {
          playerId: participant.player_id,
          name: playerRecord?.name || 'Unknown Player',
          seat: participant.seat,
        }

        const key = `${participant.match_id}:${participant.side}`
        const existing = participantsByMatchId.get(key) ?? []
        existing.push(normalizedParticipant)
        participantsByMatchId.set(key, existing)
      }

      const mappedMatches: MatchWithParticipants[] = typedMatches.map((match) => {
        const sideA = [...(participantsByMatchId.get(`${match.id}:A`) ?? [])].sort(
          (a, b) => (a.seat ?? 0) - (b.seat ?? 0)
        )

        const sideB = [...(participantsByMatchId.get(`${match.id}:B`) ?? [])].sort(
          (a, b) => (a.seat ?? 0) - (b.seat ?? 0)
        )

        return {
          id: match.id,
          matchDate: match.match_date,
          matchType: match.match_type,
          score: match.score,
          winnerSide: match.winner_side,
          lineNumber: match.line_number,
          source: match.source,
          externalMatchId: match.external_match_id,
          dedupeKey: match.dedupe_key,
          createdAt: match.created_at,
          sideA,
          sideB,
        }
      })

      setMatches(mappedMatches)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function handleDeleteMatch(matchId: string) {
    const confirmed = window.confirm(
      'Delete this match? This will also remove its match players and then recalculate ratings.'
    )
    if (!confirmed) return

    setDeletingId(matchId)
    setError('')
    setMessage('')

    try {
      const { error: deleteError } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      try {
        await recalculateDynamicRatings()
        setMessage('Match deleted and ratings recalculated.')
      } catch (recalcError) {
        console.error('Rating recalculation failed:', recalcError)
        setMessage('Match deleted, but ratings were not recalculated.')
      }

      await loadMatches(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete match.')
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recalculate ratings.')
    } finally {
      setRecalculating(false)
    }
  }

  const filteredMatches = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return matches.filter((match) => {
      if (matchTypeFilter !== 'all' && match.matchType !== matchTypeFilter) {
        return false
      }

      if (!normalizedSearch) return true

      const haystack = [
        match.matchDate,
        match.matchType,
        match.score,
        match.lineNumber || '',
        match.source || '',
        match.externalMatchId || '',
        match.sideA.map((player) => player.name).join(' / '),
        match.sideB.map((player) => player.name).join(' / '),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })
  }, [matches, search, matchTypeFilter])

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
        <h1 style={{ margin: 0, fontSize: '36px' }}>Manage Matches</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          View, search, filter, and delete singles or doubles matches stored in the new matches + match_players structure.
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
                placeholder="Player, score, source, line..."
                style={inputStyle}
                disabled={loading || refreshing}
              />
            </div>

            <div>
              <label style={labelStyle}>Match Type</label>
              <select
                value={matchTypeFilter}
                onChange={(e) => setMatchTypeFilter(e.target.value as 'all' | MatchType)}
                style={inputStyle}
                disabled={loading || refreshing}
              >
                <option value="all">All</option>
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
              </select>
            </div>
          </div>

          <div style={buttonRowStyle}>
            <button
              onClick={() => void loadMatches(true)}
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
            <div style={summaryLabelStyle}>Total Matches</div>
            <div style={summaryValueStyle}>{matches.length}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Filtered Matches</div>
            <div style={summaryValueStyle}>{filteredMatches.length}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Singles</div>
            <div style={summaryValueStyle}>{matches.filter((m) => m.matchType === 'singles').length}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Doubles</div>
            <div style={summaryValueStyle}>{matches.filter((m) => m.matchType === 'doubles').length}</div>
          </div>
        </div>

        {loading ? (
          <p style={{ marginTop: '20px' }}>Loading matches...</p>
        ) : filteredMatches.length === 0 ? (
          <p style={{ marginTop: '20px', color: '#64748b' }}>No matches found.</p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '20px' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Side A</th>
                  <th style={thStyle}>Side B</th>
                  <th style={thStyle}>Winner</th>
                  <th style={thStyle}>Score</th>
                  <th style={thStyle}>Line</th>
                  <th style={thStyle}>Source</th>
                  <th style={thStyle}>External ID</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMatches.map((match) => (
                  <tr key={match.id} style={rowStyle}>
                    <td style={tdStyle}>{match.matchDate}</td>
                    <td style={tdStyle}>{capitalize(match.matchType)}</td>
                    <td style={tdStyle}>
                      <div style={teamCellStyle}>
                        <strong>{match.sideA.map((player) => player.name).join(' / ')}</strong>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={teamCellStyle}>
                        <strong>{match.sideB.map((player) => player.name).join(' / ')}</strong>
                      </div>
                    </td>
                    <td style={tdStyle}>{match.winnerSide}</td>
                    <td style={tdStyle}>{match.score}</td>
                    <td style={tdStyle}>{match.lineNumber || '—'}</td>
                    <td style={tdStyle}>{match.source || '—'}</td>
                    <td style={tdStyle}>{match.externalMatchId || '—'}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => void handleDeleteMatch(match.id)}
                        style={{
                          ...dangerButtonStyle,
                          opacity: deletingId === match.id ? 0.7 : 1,
                          cursor: deletingId === match.id ? 'not-allowed' : 'pointer',
                        }}
                        disabled={deletingId === match.id}
                      >
                        {deletingId === match.id ? 'Deleting...' : 'Delete'}
                      </button>
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

const teamCellStyle = {
  minWidth: '180px',
}