'use client'

export const dynamic = 'force-dynamic'

import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AdminEmptyState,
  AdminReviewFrame,
  AdminReviewHero,
  AdminReviewPanel,
  AdminStatusPanel,
} from '@/app/admin/_components/admin-review-ui'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { getClientAuthState } from '@/lib/auth'
import { formatDate, formatRating, safeText } from '@/lib/captain-formatters'
import { type UserRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'

type MatchRow = {
  id: string
  league_name: string | null
  flight: string | null
  home_team: string | null
  away_team: string | null
  match_date: string
  line_number: string | null
}

type PlayerRecord = {
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

type PlayerRelation = PlayerRecord | PlayerRecord[] | null

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

function formatAvailabilityStatus(status: AvailabilityStatus) {
  return status.replaceAll('_', ' ')
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
    <SiteShell active="/admin">
      <AdminGate>
        <AdminReviewFrame>
          <AdminReviewHero kicker="Admin Tool" title="Lineup Availability">
            Set player availability for a team and match date so lineup suggestions can be built
            from realistic captain inputs.
          </AdminReviewHero>

          <AdminReviewPanel style={{ marginTop: 18 }}>
            <div style={filtersGrid}>
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

            <div style={actionRow}>
              <button
                type="button"
                onClick={() => setRefreshTick((current) => current + 1)}
                className="button-ghost"
                style={ghostButtonStyle}
                disabled={loading || rosterLoading}
              >
                {loading || rosterLoading ? 'Refreshing...' : 'Refresh availability data'}
              </button>
            </div>

            {loading ? (
              <AdminEmptyState text="Loading availability data..." />
            ) : error ? (
              <AdminStatusPanel tone="error" text={error}>
                <button
                  type="button"
                  onClick={() => setRefreshTick((current) => current + 1)}
                  className="button-ghost"
                  style={ghostButtonStyle}
                >
                  Retry availability load
                </button>
              </AdminStatusPanel>
            ) : !selectedLeagueKey || !selectedTeam ? (
              <AdminEmptyState text="Choose a league and team to manage availability." />
            ) : rosterLoading ? (
              <AdminEmptyState text="Loading roster..." />
            ) : roster.length === 0 ? (
              <AdminEmptyState text="No roster usage found for this team yet." />
            ) : (
              <>
                <div style={contextPills}>
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

                {status ? <AdminStatusPanel tone="success" text={status} /> : null}

                <div style={rosterGrid}>
                  {roster.map((player) => {
                    const current = availabilityMap[player.id] || {
                      status: 'available' as AvailabilityStatus,
                      notes: '',
                    }

                    return (
                      <div key={player.id} className="surface-card" style={playerCard}>
                        <div style={playerHeader}>
                          <div>
                            <div style={playerName}>{player.name}</div>
                            <div className="subtle-text" style={{ marginTop: 6, fontSize: 14 }}>
                              {player.appearances} appearances | Preferred:{' '}
                              <strong>{safeText(player.preferredRole, 'either')}</strong>
                            </div>
                          </div>

                          <div className="badge badge-blue" style={ratingBadge}>
                            TIQ S {formatRating(player.singlesDynamic)} | D{' '}
                            {formatRating(player.doublesDynamic)} | USTA S{' '}
                            {formatRating(player.singlesUstaDynamic)} | D{' '}
                            {formatRating(player.doublesUstaDynamic)}
                          </div>
                        </div>

                        <div style={statusGrid}>
                          {statusOptions.map((statusOption) => {
                            const active = current.status === statusOption
                            return (
                              <button
                                key={statusOption}
                                type="button"
                                onClick={() => updatePlayerStatus(player.id, statusOption)}
                                style={{
                                  ...statusButton,
                                  ...(active ? activeStatusButton : null),
                                }}
                              >
                                {formatAvailabilityStatus(statusOption)}
                              </button>
                            )
                          })}
                        </div>

                        <div style={{ marginTop: 14 }}>
                          <label className="label">Notes</label>
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

                <div style={saveRow}>
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
          </AdminReviewPanel>
        </AdminReviewFrame>
      </AdminGate>
    </SiteShell>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

const filtersGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: 16,
  marginBottom: 18,
}

const actionRow: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 16,
}

const ghostButtonStyle: CSSProperties = {
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  border: '1px solid var(--shell-panel-border)',
}

const contextPills: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginBottom: 18,
}

const rosterGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
  gap: 16,
}

const playerCard: CSSProperties = {
  padding: 18,
  background: 'var(--shell-panel-bg)',
}

const playerHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  marginBottom: 14,
  flexWrap: 'wrap',
}

const playerName: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 22,
  fontWeight: 800,
}

const ratingBadge: CSSProperties = {
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  maxWidth: '100%',
}

const statusGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const statusButton: CSSProperties = {
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
  padding: '10px 12px',
  borderRadius: 12,
  fontWeight: 700,
  cursor: 'pointer',
  textTransform: 'none',
  textAlign: 'center',
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const activeStatusButton: CSSProperties = {
  border: '1px solid rgba(116,190,255,0.36)',
  background: 'rgba(116,190,255,0.16)',
  color: 'var(--foreground-strong)',
}

const saveRow: CSSProperties = {
  marginTop: 22,
  display: 'flex',
  justifyContent: 'flex-start',
}
