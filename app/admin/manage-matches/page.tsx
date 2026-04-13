'use client'

import type { User } from '@supabase/supabase-js'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
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

  const [user, setUser] = useState<User | null>(null)
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
  const deferredSearch = useDeferredValue(search)

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
    const normalizedSearch = deferredSearch.trim().toLowerCase()

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
  }, [matches, deferredSearch, matchTypeFilter])

  const hasActiveFilters = search.trim().length > 0 || matchTypeFilter !== 'all'

  function resetFilters() {
    setSearch('')
    setMatchTypeFilter('all')
  }

  if (authLoading) {
    return (
      <SiteShell active="/admin">
        <section
          style={{
            width: '100%',
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '18px 24px 0',
          }}
        >
          <section className="hero-panel">
            <div className="hero-inner">
              <div className="section-kicker">Admin Tool</div>
              <h1 className="page-title">Checking access...</h1>
              <p className="page-subtitle">
                Verifying administrator permissions and loading match management tools.
              </p>
            </div>
          </section>
        </section>
      </SiteShell>
    )
  }

  if (!user || user.id !== ADMIN_ID) {
    return null
  }

  return (
    <SiteShell active="/admin">
      <AdminGate>
        <section
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '18px 24px 0',
        }}
      >
        <section className="hero-panel">
          <div className="hero-inner">
            <div className="section-kicker">Admin Tool</div>
            <h1 className="page-title">Manage Matches</h1>
            <p className="page-subtitle">
              View, search, filter, and delete singles or doubles matches stored in the
              matches and match_players structure.
            </p>
          </div>
        </section>

        <section
          className="surface-card panel-pad section"
          style={{
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-90px',
              right: '-70px',
              width: '240px',
              height: '240px',
              borderRadius: '999px',
              background:
                'radial-gradient(circle, rgba(74,163,255,0.14) 0%, transparent 72%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-120px',
              left: '-60px',
              width: '220px',
              height: '220px',
              borderRadius: '999px',
              background:
                'radial-gradient(circle, rgba(155,225,29,0.10) 0%, transparent 74%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                  flex: 1,
                  minWidth: 320,
                }}
              >
                <Field
                  label="Search"
                  htmlFor="manage-matches-search"
                  hint="Search by player, score, source, external id, or line label."
                >
                  <input
                    id="manage-matches-search"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Player, score, source, line..."
                    className="input"
                    disabled={loading || refreshing}
                  />
                </Field>

                <Field
                  label="Match Type"
                  htmlFor="manage-matches-type"
                  hint="Use the type filter when you only want singles or doubles cleanup in view."
                >
                  <select
                    id="manage-matches-type"
                    value={matchTypeFilter}
                    onChange={(e) => setMatchTypeFilter(e.target.value as 'all' | MatchType)}
                    className="select"
                    disabled={loading || refreshing}
                  >
                    <option value="all">All</option>
                    <option value="singles">Singles</option>
                    <option value="doubles">Doubles</option>
                  </select>
                </Field>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  onClick={() => void loadMatches(true)}
                  className="button-ghost"
                  style={{
                    background: 'rgba(15,23,42,0.24)',
                    color: '#dbeafe',
                    border: '1px solid rgba(116,190,255,0.12)',
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

                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="button-ghost"
                    style={{
                      background: 'rgba(15,23,42,0.24)',
                      color: '#dbeafe',
                      border: '1px solid rgba(148,163,184,0.18)',
                    }}
                    disabled={loading || refreshing}
                  >
                    Reset Filters
                  </button>
                ) : null}
              </div>
            </div>

            <p className="subtle-text" style={{ marginTop: 14, maxWidth: 760 }}>
              Narrow the table when you need a specific cleanup target, then reset back to the full ledger before doing destructive deletes or broad rating recalculations.
            </p>

            {message && (
              <div
                role="status"
                aria-live="polite"
                className="badge badge-green"
                style={{
                  marginTop: 16,
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
                role="alert"
                className="badge"
                style={{
                  marginTop: 16,
                  minHeight: 44,
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: '10px 14px',
                  background: 'rgba(220,38,38,0.12)',
                  color: '#fca5a5',
                  border: '1px solid rgba(220,38,38,0.18)',
                }}
              >
                {error}
              </div>
            )}

            <div className="metric-grid" style={{ marginTop: 20 }}>
              <MetricCard label="Total Matches" value={matches.length} />
              <MetricCard label="Filtered Matches" value={filteredMatches.length} />
              <MetricCard
                label="Singles"
                value={matches.filter((m) => m.matchType === 'singles').length}
              />
              <MetricCard
                label="Doubles"
                value={matches.filter((m) => m.matchType === 'doubles').length}
              />
            </div>

            {loading ? (
              <p style={{ marginTop: 20 }} className="subtle-text">
                Loading matches...
              </p>
            ) : filteredMatches.length === 0 ? (
              <div
                style={{
                  marginTop: 20,
                  borderRadius: 20,
                  border: '1px solid rgba(148,163,184,0.16)',
                  background: 'rgba(15,23,42,0.28)',
                  padding: '18px 20px',
                }}
              >
                <div className="section-title" style={{ fontSize: '1.05rem' }}>
                  {matches.length === 0 ? 'No matches loaded yet' : 'No matches match the current filters'}
                </div>
                <p className="subtle-text" style={{ marginTop: 8 }}>
                  {matches.length === 0
                    ? 'Import schedules or scorecards first, then the operational match ledger will appear here.'
                    : 'Widen the search or return the type filter to All to bring matches back into scope.'}
                </p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="button-ghost"
                    style={{
                      marginTop: 12,
                      background: 'rgba(15,23,42,0.24)',
                      color: '#dbeafe',
                      border: '1px solid rgba(116,190,255,0.12)',
                    }}
                  >
                    Reset Filters
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="table-wrap" style={{ marginTop: 20 }}>
                <table className="data-table" style={{ minWidth: 1300 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Side A</th>
                      <th>Side B</th>
                      <th>Winner</th>
                      <th>Score</th>
                      <th>Line</th>
                      <th>Source</th>
                      <th>External ID</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatches.map((match) => (
                      <tr key={match.id}>
                        <td>{match.matchDate}</td>
                        <td>{capitalize(match.matchType)}</td>
                        <td>
                          <div style={{ minWidth: 180 }}>
                            <strong>{match.sideA.map((player) => player.name).join(' / ')}</strong>
                          </div>
                        </td>
                        <td>
                          <div style={{ minWidth: 180 }}>
                            <strong>{match.sideB.map((player) => player.name).join(' / ')}</strong>
                          </div>
                        </td>
                        <td>{match.winnerSide}</td>
                        <td>{match.score}</td>
                        <td>{match.lineNumber || '—'}</td>
                        <td>{match.source || '—'}</td>
                        <td>{match.externalMatchId || '—'}</td>
                        <td>
                          <button
                            onClick={() => void handleDeleteMatch(match.id)}
                            disabled={deletingId === match.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minHeight: 40,
                              padding: '0 14px',
                              border: 'none',
                              borderRadius: 12,
                              background:
                                'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              opacity: deletingId === match.id ? 0.7 : 1,
                              cursor: deletingId === match.id ? 'not-allowed' : 'pointer',
                              boxShadow: '0 12px 24px rgba(127,29,29,0.22)',
                            }}
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
        </section>
        </section>
      </AdminGate>
    </SiteShell>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {hint ? <div className="subtle-text" style={{ marginTop: 6, fontSize: '0.88rem' }}>{hint}</div> : null}
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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
