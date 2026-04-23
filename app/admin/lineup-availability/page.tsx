'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { formatDate, formatRating } from '@/lib/captain-formatters'
import { getClientAuthState } from '@/lib/auth'
import { type UserRole } from '@/lib/roles'

type MatchRow = {
  id: string
  league_name: string | null
  flight: string | null
  home_team: string | null
  away_team: string | null
  match_date: string
  line_number: string | null
}

type PlayerRelation =
  | {
      id: string
      name: string
      flight: string | null
      preferred_role: string | null
      lineup_notes: string | null
      overall_dynamic_rating: number | null
      overall_usta_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      singles_usta_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
      doubles_usta_dynamic_rating: number | null
    }
  | {
      id: string
      name: string
      flight: string | null
      preferred_role: string | null
      lineup_notes: string | null
      overall_dynamic_rating: number | null
      overall_usta_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      singles_usta_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
      doubles_usta_dynamic_rating: number | null
    }[]
  | null

type MatchPlayerRow = {
  match_id: string
  side: 'A' | 'B'
  player_id: string
  players: PlayerRelation
}

type RosterPlayer = {
  id: string
  name: string
  flight: string | null
  preferredRole: string | null
  lineupNotes: string | null
  appearances: number
  overallDynamic: number | null
  overallUstaDynamic: number | null
  singlesDynamic: number | null
  singlesUstaDynamic: number | null
  doublesDynamic: number | null
  doublesUstaDynamic: number | null
}

type AvailabilityStatus =
  | 'available'
  | 'unavailable'
  | 'singles_only'
  | 'doubles_only'
  | 'limited'

type AvailabilityRow = {
  id: string
  match_date: string
  team_name: string
  league_name: string | null
  flight: string | null
  player_id: string
  status: AvailabilityStatus
  notes: string | null
}

type LeagueOption = {
  leagueName: string
  flight: string
}

function safeText(value: string | null | undefined, fallback = 'Unknown') {
  const text = (value || '').trim()
  return text || fallback
}

function normalizePlayerRelation(player: PlayerRelation) {
  if (!player) return null
  return Array.isArray(player) ? player[0] ?? null : player
}

function buildLeagueKey(leagueName: string, flight: string) {
  return `${leagueName}___${flight}`
}

function formatLeagueScopeLabel(leagueName: string, flight: string) {
  return [leagueName, flight].filter(Boolean).join(' - ')
}

const statusOptions: AvailabilityStatus[] = [
  'available',
  'unavailable',
  'singles_only',
  'doubles_only',
  'limited',
]

export default function LineupAvailabilityPage() {
  const router = useRouter()
  const [role, setRole] = useState<UserRole>('public')
  const [authResolved, setAuthResolved] = useState(false)
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const [selectedLeagueKey, setSelectedLeagueKey] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  const [rosterLoading, setRosterLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [availabilityMap, setAvailabilityMap] = useState<
    Record<string, { status: AvailabilityStatus; notes: string }>
  >({})

  useEffect(() => {
    async function loadAuth() {
      const authState = await getClientAuthState()
      setRole(authState.role)
      setAuthResolved(true)

      if (authState.role !== 'admin') {
        router.replace(`/login?next=${encodeURIComponent('/admin/lineup-availability')}`)
      }
    }

    void loadAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      const authState = await getClientAuthState()
      setRole(authState.role)
      setAuthResolved(true)

      if (authState.role !== 'admin') {
        router.replace(`/login?next=${encodeURIComponent('/admin/lineup-availability')}`)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    if (!authResolved || role !== 'admin') return
    void loadMatches()
  }, [authResolved, role, refreshTick])

  async function loadMatches() {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          league_name,
          flight,
          home_team,
          away_team,
          match_date,
          line_number
        `)
        .is('line_number', null)
        .order('match_date', { ascending: false })
        .limit(400)

      if (error) throw new Error(error.message)

      setMatches((data || []) as MatchRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load availability data.')
    } finally {
      setLoading(false)
    }
  }

  const loadRosterAndAvailability = useCallback(async () => {
    setRosterLoading(true)
    setError('')
    setStatus('')

    try {
      const [leagueName, flight] = selectedLeagueKey.split('___')

      const { data: teamMatchesData, error: teamMatchesError } = await supabase
        .from('matches')
        .select(`
          id,
          league_name,
          flight,
          home_team,
          away_team,
          match_date,
          line_number
        `)
        .eq('league_name', leagueName)
        .eq('flight', flight)
        .or(`home_team.eq.${selectedTeam},away_team.eq.${selectedTeam}`)
        .is('line_number', null)

      if (teamMatchesError) throw new Error(teamMatchesError.message)

      const typedTeamMatches = (teamMatchesData || []) as MatchRow[]
      const matchIds = typedTeamMatches.map((match) => match.id)

      if (!matchIds.length) {
        setRoster([])
        setAvailabilityMap({})
        return
      }

      const sideByMatchId = new Map<string, 'A' | 'B'>()

      for (const match of typedTeamMatches) {
        if (safeText(match.home_team) === selectedTeam) sideByMatchId.set(match.id, 'A')
        if (safeText(match.away_team) === selectedTeam) sideByMatchId.set(match.id, 'B')
      }

      const { data: participantData, error: participantError } = await supabase
        .from('match_players')
        .select(`
          match_id,
          side,
          player_id,
          players (
            id,
            name,
            flight,
            preferred_role,
            lineup_notes,
            overall_dynamic_rating,
            overall_usta_dynamic_rating,
            singles_dynamic_rating,
            singles_usta_dynamic_rating,
            doubles_dynamic_rating,
            doubles_usta_dynamic_rating
          )
        `)
        .in('match_id', matchIds)

      if (participantError) throw new Error(participantError.message)

      const typedParticipants = (participantData || []) as MatchPlayerRow[]
      const rosterMap = new Map<string, RosterPlayer>()

      for (const participant of typedParticipants) {
        const expectedSide = sideByMatchId.get(participant.match_id)
        if (!expectedSide) continue
        if (participant.side !== expectedSide) continue

        const player = normalizePlayerRelation(participant.players)
        if (!player) continue

        if (!rosterMap.has(player.id)) {
          rosterMap.set(player.id, {
            id: player.id,
            name: player.name,
            flight: player.flight,
            preferredRole: player.preferred_role,
            lineupNotes: player.lineup_notes,
            appearances: 0,
            overallDynamic: player.overall_dynamic_rating,
            overallUstaDynamic: player.overall_usta_dynamic_rating,
            singlesDynamic: player.singles_dynamic_rating,
            singlesUstaDynamic: player.singles_usta_dynamic_rating,
            doublesDynamic: player.doubles_dynamic_rating,
            doublesUstaDynamic: player.doubles_usta_dynamic_rating,
          })
        }

        rosterMap.get(player.id)!.appearances += 1
      }

      const rosterList = [...rosterMap.values()].sort((a, b) => {
        if (b.appearances !== a.appearances) return b.appearances - a.appearances
        return a.name.localeCompare(b.name)
      })

      setRoster(rosterList)

      if (!selectedDate) {
        const defaults: Record<string, { status: AvailabilityStatus; notes: string }> = {}
        for (const player of rosterList) {
          defaults[player.id] = { status: 'available', notes: '' }
        }
        setAvailabilityMap(defaults)
        return
      }

      const { data: availabilityData, error: availabilityError } = await supabase
        .from('lineup_availability')
        .select(`
          id,
          match_date,
          team_name,
          league_name,
          flight,
          player_id,
          status,
          notes
        `)
        .eq('match_date', selectedDate)
        .eq('team_name', selectedTeam)

      if (availabilityError) throw new Error(availabilityError.message)

      const typedAvailability = (availabilityData || []) as AvailabilityRow[]
      const nextMap: Record<string, { status: AvailabilityStatus; notes: string }> = {}

      for (const player of rosterList) {
        const existing = typedAvailability.find((row) => row.player_id === player.id)
        nextMap[player.id] = {
          status: existing?.status || 'available',
          notes: existing?.notes || '',
        }
      }

      setAvailabilityMap(nextMap)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roster or availability.')
    } finally {
      setRosterLoading(false)
    }
  }, [selectedDate, selectedLeagueKey, selectedTeam])

  useEffect(() => {
    if (!selectedLeagueKey || !selectedTeam) {
      setRoster([])
      setAvailabilityMap({})
      return
    }

    void loadRosterAndAvailability()
  }, [loadRosterAndAvailability, selectedLeagueKey, selectedTeam])

  async function saveAvailability() {
    if (!selectedLeagueKey || !selectedTeam || !selectedDate) {
      setError('Please select a league, team, and match date first.')
      return
    }

    setSaving(true)
    setError('')
    setStatus('')

    try {
      const [leagueName, flight] = selectedLeagueKey.split('___')

      const payload = roster.map((player) => ({
        match_date: selectedDate,
        team_name: selectedTeam,
        league_name: leagueName,
        flight,
        player_id: player.id,
        status: availabilityMap[player.id]?.status || 'available',
        notes: availabilityMap[player.id]?.notes || null,
      }))

      const { error } = await supabase
        .from('lineup_availability')
        .upsert(payload, {
          onConflict: 'match_date,team_name,player_id',
        })

      if (error) throw new Error(error.message)

      setStatus('Availability saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save availability.')
    } finally {
      setSaving(false)
    }
  }

  const leagueOptions = useMemo<LeagueOption[]>(() => {
    const map = new Map<string, LeagueOption>()

    for (const row of matches) {
      const leagueName = safeText(row.league_name)
      const flight = safeText(row.flight)
      const key = buildLeagueKey(leagueName, flight)

      if (!map.has(key)) {
        map.set(key, { leagueName, flight })
      }
    }

    return [...map.values()].sort((a, b) => {
      if (a.leagueName !== b.leagueName) return a.leagueName.localeCompare(b.leagueName)
      return a.flight.localeCompare(b.flight)
    })
  }, [matches])

  const teamsForLeague = useMemo(() => {
    if (!selectedLeagueKey) return []

    const [leagueName, flight] = selectedLeagueKey.split('___')
    const teamSet = new Set<string>()

    for (const row of matches) {
      if (safeText(row.league_name) !== leagueName) continue
      if (safeText(row.flight) !== flight) continue

      if (row.home_team) teamSet.add(row.home_team.trim())
      if (row.away_team) teamSet.add(row.away_team.trim())
    }

    return [...teamSet].sort((a, b) => a.localeCompare(b))
  }, [matches, selectedLeagueKey])

  const relevantDates = useMemo(() => {
    if (!selectedLeagueKey || !selectedTeam) return []

    const [leagueName, flight] = selectedLeagueKey.split('___')
    const dateSet = new Set<string>()

    for (const row of matches) {
      if (safeText(row.league_name) !== leagueName) continue
      if (safeText(row.flight) !== flight) continue

      const teamMatch =
        safeText(row.home_team) === selectedTeam || safeText(row.away_team) === selectedTeam

      if (teamMatch && row.match_date) {
        dateSet.add(row.match_date)
      }
    }

    return [...dateSet].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  }, [matches, selectedLeagueKey, selectedTeam])

  const selectedLeagueLabel = useMemo(() => {
    if (!selectedLeagueKey) return ''
    const [leagueName, flight] = selectedLeagueKey.split('___')
    return formatLeagueScopeLabel(leagueName, flight)
  }, [selectedLeagueKey])

  function updatePlayerStatus(playerId: string, status: AvailabilityStatus) {
    setAvailabilityMap((prev) => ({
      ...prev,
      [playerId]: {
        status,
        notes: prev[playerId]?.notes || '',
      },
    }))
  }

  function updatePlayerNotes(playerId: string, notes: string) {
    setAvailabilityMap((prev) => ({
      ...prev,
      [playerId]: {
        status: prev[playerId]?.status || 'available',
        notes,
      },
    }))
  }

  return (
    <main className="page-shell">
      {!authResolved ? (
        <section className="surface-card panel-pad section">
          <div className="subtle-text">Checking admin access...</div>
        </section>
      ) : role !== 'admin' ? (
        <section className="surface-card panel-pad section">
          <div className="subtle-text">Admin access is required. Redirecting to login...</div>
        </section>
      ) : (
        <>
      <section className="hero-panel">
        <div className="hero-inner">
          <div className="section-kicker">Admin Tool</div>
          <h1 className="page-title">Lineup Availability</h1>
          <p className="page-subtitle">
            Set player availability for a team and match date so lineup suggestions can be built
            from realistic captain inputs.
          </p>
        </div>
      </section>

      <section className="surface-card panel-pad section">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 18,
          }}
        >
          <Field label="League / Flight">
            <select
              value={selectedLeagueKey}
              onChange={(e) => {
                setSelectedLeagueKey(e.target.value)
                setSelectedTeam('')
                setSelectedDate('')
                setRoster([])
                setAvailabilityMap({})
              }}
              className="select"
            >
              <option value="">Select league</option>
              {leagueOptions.map((option) => {
                const key = buildLeagueKey(option.leagueName, option.flight)
                return (
                  <option key={key} value={key}>
                    {formatLeagueScopeLabel(option.leagueName, option.flight)}
                  </option>
                )
              })}
            </select>
          </Field>

          <Field label="Team">
            <select
              value={selectedTeam}
              onChange={(e) => {
                setSelectedTeam(e.target.value)
                setSelectedDate('')
                setRoster([])
                setAvailabilityMap({})
              }}
              className="select"
              disabled={!selectedLeagueKey}
            >
              <option value="">Select team</option>
              {teamsForLeague.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Match Date">
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="select"
              disabled={!selectedTeam}
            >
              <option value="">Select date</option>
              {relevantDates.map((date) => (
                <option key={date} value={date}>
                  {formatDate(date)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <button
            type="button"
            onClick={() => setRefreshTick((current) => current + 1)}
            className="button-ghost"
            style={{
              background: 'var(--shell-chip-bg)',
              color: 'var(--foreground)',
              border: '1px solid var(--shell-panel-border)',
              opacity: loading || rosterLoading ? 0.7 : 1,
              cursor: loading || rosterLoading ? 'not-allowed' : 'pointer',
            }}
            disabled={loading || rosterLoading}
          >
            {loading || rosterLoading ? 'Refreshing...' : 'Refresh availability data'}
          </button>
        </div>

        {loading ? (
          <div
            style={{
              marginTop: 18,
              padding: 18,
              borderRadius: 16,
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              color: '#475569',
            }}
          >
            Loading...
          </div>
        ) : error ? (
          <div
            className="badge"
            style={{
              marginTop: 16,
              minHeight: 44,
              width: '100%',
              justifyContent: 'flex-start',
              padding: '10px 14px',
              background: 'rgba(220,38,38,0.10)',
              color: '#991b1b',
              border: '1px solid rgba(220,38,38,0.18)',
            }}
          >
            <div>{error}</div>
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setRefreshTick((current) => current + 1)}
                className="button-ghost"
                style={{
                  background: 'var(--shell-chip-bg)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--shell-panel-border)',
                }}
              >
                Retry availability load
              </button>
            </div>
          </div>
        ) : !selectedLeagueKey || !selectedTeam ? (
          <div
            style={{
              marginTop: 18,
              padding: 18,
              borderRadius: 16,
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              color: '#475569',
            }}
          >
            Choose a league and team to manage availability.
          </div>
        ) : rosterLoading ? (
          <div
            style={{
              marginTop: 18,
              padding: 18,
              borderRadius: 16,
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              color: '#475569',
            }}
          >
            Loading roster...
          </div>
        ) : roster.length === 0 ? (
          <div
            style={{
              marginTop: 18,
              padding: 18,
              borderRadius: 16,
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              color: '#475569',
            }}
          >
            No roster usage found for this team yet.
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: 18,
              }}
            >
              <div className="badge badge-blue" style={{ minHeight: 38 }}>
                <strong>{selectedTeam}</strong>
              </div>
              <div className="badge badge-slate" style={{ minHeight: 38 }}>
                <strong>{selectedLeagueLabel}</strong>
              </div>
              <div className="badge badge-green" style={{ minHeight: 38 }}>
                Match Date:&nbsp;
                <strong>{selectedDate ? formatDate(selectedDate) : 'Not selected'}</strong>
              </div>
            </div>

            {status ? (
              <div
                className="badge badge-green"
                style={{
                  marginBottom: 16,
                  minHeight: 44,
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: '10px 14px',
                }}
              >
                {status}
              </div>
            ) : null}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: 16,
              }}
            >
              {roster.map((player) => {
                const current = availabilityMap[player.id] || {
                  status: 'available' as AvailabilityStatus,
                  notes: '',
                }

                return (
                  <div
                    key={player.id}
                    className="surface-card"
                    style={{
                      padding: 18,
                      background: '#f8fafc',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        marginBottom: 14,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: '#0f172a',
                            fontSize: 22,
                            fontWeight: 800,
                          }}
                        >
                          {player.name}
                        </div>
                        <div
                          className="subtle-text"
                          style={{
                            marginTop: 6,
                            fontSize: 14,
                          }}
                        >
                          {player.appearances} appearances · Preferred:{' '}
                          <strong>{safeText(player.preferredRole, 'either')}</strong>
                        </div>
                      </div>

                      <div className="badge badge-blue" style={{ whiteSpace: 'nowrap' }}>
                        TIQ S {formatRating(player.singlesDynamic)} · D {formatRating(player.doublesDynamic)} | USTA S {formatRating(player.singlesUstaDynamic)} · D {formatRating(player.doublesUstaDynamic)}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 10,
                      }}
                    >
                      {statusOptions.map((statusOption) => {
                        const active = current.status === statusOption
                        return (
                          <button
                            key={statusOption}
                            type="button"
                            onClick={() => updatePlayerStatus(player.id, statusOption)}
                            style={{
                              border: active
                                ? '1px solid #2563eb'
                                : '1px solid #cbd5e1',
                              background: active ? '#2563eb' : '#ffffff',
                              color: active ? '#ffffff' : '#334155',
                              padding: '10px 12px',
                              borderRadius: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              textTransform: 'none',
                            }}
                          >
                            {statusOption}
                          </button>
                        )
                      })}
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <label
                        style={{
                          display: 'block',
                          color: '#334155',
                          fontWeight: 700,
                          fontSize: 13,
                          marginBottom: 8,
                        }}
                      >
                        Notes
                      </label>
                      <textarea
                        value={current.notes}
                        onChange={(e) => updatePlayerNotes(player.id, e.target.value)}
                        placeholder="Optional notes like late arrival, can only play doubles, etc."
                        className="textarea"
                        style={{ minHeight: 88, fontSize: 14 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div
              style={{
                marginTop: 22,
                display: 'flex',
                justifyContent: 'flex-start',
              }}
            >
              <button
                type="button"
                onClick={saveAvailability}
                disabled={saving || !selectedDate}
                className="button-primary"
                style={{
                  opacity: saving || !selectedDate ? 0.7 : 1,
                  cursor: saving || !selectedDate ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save Availability'}
              </button>
            </div>
          </>
        )}
      </section>
        </>
      )}
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
