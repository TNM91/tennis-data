'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'

type MatchRow = {
  id: string
  league_name: string | null
  flight: string | null
  home_team: string | null
  away_team: string | null
  match_date: string
}

type PlayerRelation =
  | {
      id: string
      name: string
      flight: string | null
      preferred_role: string | null
      lineup_notes: string | null
      overall_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
    }
  | {
      id: string
      name: string
      flight: string | null
      preferred_role: string | null
      lineup_notes: string | null
      overall_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
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
  singlesDynamic: number | null
  doublesDynamic: number | null
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

function formatDate(value: string | null) {
  if (!value) return 'Unknown'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function buildLeagueKey(leagueName: string, flight: string) {
  return `${leagueName}___${flight}`
}

function formatRating(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value.toFixed(2)
}

export default function LineupAvailabilityPage() {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const [selectedLeagueKey, setSelectedLeagueKey] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedDate, setSelectedDate] = useState('')

  const [rosterLoading, setRosterLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [availabilityMap, setAvailabilityMap] = useState<
    Record<string, { status: AvailabilityStatus; notes: string }>
  >({})

  useEffect(() => {
    void loadMatches()
  }, [])

  useEffect(() => {
    if (!selectedLeagueKey || !selectedTeam) {
      setRoster([])
      setAvailabilityMap({})
      return
    }

    void loadRosterAndAvailability()
  }, [selectedLeagueKey, selectedTeam, selectedDate])

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
          match_date
        `)
        .order('match_date', { ascending: false })

      if (error) throw new Error(error.message)

      setMatches((data || []) as MatchRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load availability data.')
    } finally {
      setLoading(false)
    }
  }

  async function loadRosterAndAvailability() {
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
          match_date
        `)
        .eq('league_name', leagueName)
        .eq('flight', flight)
        .or(`home_team.eq.${selectedTeam},away_team.eq.${selectedTeam}`)

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
            singles_dynamic_rating,
            doubles_dynamic_rating
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
            singlesDynamic: player.singles_dynamic_rating,
            doublesDynamic: player.doubles_dynamic_rating,
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
  }

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
    return `${leagueName} · ${flight}`
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
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/leagues" style={navLinkStyle}>Leagues</Link>
        <Link href="/teams" style={navLinkStyle}>Teams</Link>
        <Link href="/lineup-projection" style={navLinkStyle}>Lineup Projection</Link>
        <Link href="/admin" style={navLinkStyle}>Admin</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>Lineup Availability</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          Set player availability for a team and match date so lineup suggestions can be built from
          realistic captain inputs.
        </p>
      </div>
            <div style={cardStyle}>
        <div style={toolbarStyle}>
          <div style={filterWrapStyle}>
            <label style={labelStyle}>League / Flight</label>
            <select
              value={selectedLeagueKey}
              onChange={(e) => {
                setSelectedLeagueKey(e.target.value)
                setSelectedTeam('')
                setSelectedDate('')
                setRoster([])
                setAvailabilityMap({})
              }}
              style={inputStyle}
            >
              <option value="">Select league</option>
              {leagueOptions.map((option) => {
                const key = buildLeagueKey(option.leagueName, option.flight)
                return (
                  <option key={key} value={key}>
                    {option.leagueName} · {option.flight}
                  </option>
                )
              })}
            </select>
          </div>

          <div style={filterWrapStyle}>
            <label style={labelStyle}>Team</label>
            <select
              value={selectedTeam}
              onChange={(e) => {
                setSelectedTeam(e.target.value)
                setSelectedDate('')
                setRoster([])
                setAvailabilityMap({})
              }}
              style={inputStyle}
              disabled={!selectedLeagueKey}
            >
              <option value="">Select team</option>
              {teamsForLeague.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          <div style={filterWrapStyle}>
            <label style={labelStyle}>Match Date</label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={inputStyle}
              disabled={!selectedTeam}
            >
              <option value="">Select date</option>
              {relevantDates.map((date) => (
                <option key={date} value={date}>
                  {formatDate(date)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={emptyStateStyle}>Loading...</div>
        ) : error ? (
          <div style={errorBoxStyle}>{error}</div>
        ) : !selectedLeagueKey || !selectedTeam ? (
          <div style={emptyStateStyle}>Choose a league and team to manage availability.</div>
        ) : rosterLoading ? (
          <div style={emptyStateStyle}>Loading roster...</div>
        ) : roster.length === 0 ? (
          <div style={emptyStateStyle}>No roster usage found for this team yet.</div>
        ) : (
          <>
            <div style={summaryPillRowStyle}>
              <div style={summaryPillStyle}>
                <strong>{selectedTeam}</strong>
              </div>
              <div style={summaryPillStyle}>
                <strong>{selectedLeagueLabel}</strong>
              </div>
              <div style={summaryPillStyle}>
                Match Date: <strong>{selectedDate ? formatDate(selectedDate) : 'Not selected'}</strong>
              </div>
            </div>

            {status ? <div style={successBoxStyle}>{status}</div> : null}

            <div style={rosterGridStyle}>
              {roster.map((player) => {
                const current = availabilityMap[player.id] || {
                  status: 'available' as AvailabilityStatus,
                  notes: '',
                }

                return (
                  <div key={player.id} style={playerCardStyle}>
                    <div style={playerTopStyle}>
                      <div>
                        <div style={playerNameStyle}>{player.name}</div>
                        <div style={playerMetaStyle}>
                          {player.appearances} appearances · Preferred:{' '}
                          <strong>{safeText(player.preferredRole, 'either')}</strong>
                        </div>
                      </div>

                      <div style={ratingChipStyle}>
                        S {formatRating(player.singlesDynamic)} · D {formatRating(player.doublesDynamic)}
                      </div>
                    </div>

                    <div style={statusGridStyle}>
                      {(
                        [
                          'available',
                          'unavailable',
                          'singles_only',
                          'doubles_only',
                          'limited',
                        ] as AvailabilityStatus[]
                      ).map((statusOption) => (
                        <button
                          key={statusOption}
                          type="button"
                          onClick={() => updatePlayerStatus(player.id, statusOption)}
                          style={{
                            ...statusButtonStyle,
                            ...(current.status === statusOption ? activeStatusButtonStyle : {}),
                          }}
                        >
                          {statusOption}
                        </button>
                      ))}
                    </div>

                    <div style={notesWrapStyle}>
                      <label style={notesLabelStyle}>Notes</label>
                      <textarea
                        value={current.notes}
                        onChange={(e) => updatePlayerNotes(player.id, e.target.value)}
                        placeholder="Optional notes like late arrival, can only play doubles, etc."
                        style={textareaStyle}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={saveRowStyle}>
              <button
                type="button"
                onClick={saveAvailability}
                disabled={saving || !selectedDate}
                style={{
                  ...saveButtonStyle,
                  ...((saving || !selectedDate) ? disabledButtonStyle : {}),
                }}
              >
                {saving ? 'Saving...' : 'Save Availability'}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

const mainStyle = {
  padding: '24px',
  fontFamily: 'Arial, sans-serif',
  maxWidth: '1250px',
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
  gap: '16px',
  flexWrap: 'wrap' as const,
  marginBottom: '18px',
}

const filterWrapStyle = {
  minWidth: '240px',
  flex: 1,
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

const summaryPillRowStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
  marginBottom: '18px',
}

const summaryPillStyle = {
  padding: '10px 14px',
  borderRadius: '999px',
  background: '#eff6ff',
  border: '1px solid #dbeafe',
  color: '#1e3a8a',
  fontWeight: 700,
}

const rosterGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
  gap: '16px',
}

const playerCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  padding: '18px',
}

const playerTopStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '14px',
}

const playerNameStyle = {
  color: '#0f172a',
  fontSize: '22px',
  fontWeight: 800,
}

const playerMetaStyle = {
  color: '#64748b',
  marginTop: '6px',
  fontSize: '14px',
}

const ratingChipStyle = {
  padding: '8px 10px',
  borderRadius: '999px',
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  color: '#1d4ed8',
  fontWeight: 700,
  fontSize: '12px',
  whiteSpace: 'nowrap' as const,
}

const statusGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
}

const statusButtonStyle = {
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#334155',
  padding: '10px 12px',
  borderRadius: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  textTransform: 'none' as const,
}

const activeStatusButtonStyle = {
  background: '#2563eb',
  color: '#ffffff',
  border: '1px solid #2563eb',
}

const notesWrapStyle = {
  marginTop: '14px',
}

const notesLabelStyle = {
  display: 'block',
  color: '#334155',
  fontWeight: 700,
  fontSize: '13px',
  marginBottom: '8px',
}

const textareaStyle = {
  width: '100%',
  minHeight: '88px',
  padding: '12px',
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  fontSize: '14px',
  fontFamily: 'inherit',
  boxSizing: 'border-box' as const,
  resize: 'vertical' as const,
}

const saveRowStyle = {
  marginTop: '22px',
  display: 'flex',
  justifyContent: 'flex-start',
}

const saveButtonStyle = {
  border: '1px solid #2563eb',
  background: '#2563eb',
  color: '#ffffff',
  padding: '12px 18px',
  borderRadius: '999px',
  fontWeight: 700,
  cursor: 'pointer',
}

const disabledButtonStyle = {
  opacity: 0.7,
  cursor: 'not-allowed',
}

const successBoxStyle = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: '#dcfce7',
  border: '1px solid #bbf7d0',
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

const emptyStateStyle = {
  marginTop: '18px',
  padding: '18px',
  borderRadius: '16px',
  background: '#f8fafc',
  border: '1px dashed #cbd5e1',
  color: '#475569',
}