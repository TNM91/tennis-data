'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
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

function statusLabel(status: AvailabilityStatus) {
  switch (status) {
    case 'available':
      return 'Available'
    case 'unavailable':
      return 'Unavailable'
    case 'singles_only':
      return 'Singles Only'
    case 'doubles_only':
      return 'Doubles Only'
    case 'limited':
      return 'Limited'
    default:
      return status
  }
}

function statusBadgeClass(status: AvailabilityStatus) {
  switch (status) {
    case 'available':
      return 'badge-green'
    case 'unavailable':
      return 'badge-slate'
    case 'singles_only':
    case 'doubles_only':
      return 'badge-blue'
    case 'limited':
      return 'badge-slate'
    default:
      return 'badge-slate'
  }
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

  const availabilitySummary = useMemo(() => {
    const counts: Record<AvailabilityStatus, number> = {
      available: 0,
      unavailable: 0,
      singles_only: 0,
      doubles_only: 0,
      limited: 0,
    }

    for (const player of roster) {
      const current = availabilityMap[player.id]?.status || 'available'
      counts[current] += 1
    }

    return counts
  }, [roster, availabilityMap])

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
      <section className="hero-panel">
        <div className="hero-inner">
          <div style={heroGridStyle}>
            <div>
              <div className="badge badge-blue" style={{ marginBottom: 14 }}>
                Captain Tools
              </div>

              <p className="section-kicker" style={{ marginBottom: 10 }}>
                Availability management
              </p>

              <h1 style={heroTitleStyle}>Lineup Availability</h1>

              <p style={heroTextStyle}>
                Set player availability for a team and match date so lineup decisions start
                from realistic captain inputs instead of guesswork.
              </p>

              <div style={heroButtonRowStyle}>
                <Link href="/captains-corner/lineup-builder" className="button-primary">
                  Open Lineup Builder
                </Link>
                <Link
                  href="/captains-corner/scenario-comparison"
                  className="button-secondary"
                >
                  Compare Scenarios
                </Link>
              </div>

              <div className="metric-grid" style={heroMetricGridStyle}>
                <div className="metric-card">
                  <div className="section-kicker">League / Flight</div>
                  <div style={metricValueStyle}>{selectedLeagueLabel || 'Not selected'}</div>
                </div>

                <div className="metric-card">
                  <div className="section-kicker">Team</div>
                  <div style={metricValueStyle}>{selectedTeam || 'Not selected'}</div>
                </div>

                <div className="metric-card">
                  <div className="section-kicker">Match Date</div>
                  <div style={metricValueStyle}>
                    {selectedDate ? formatDate(selectedDate) : 'Not selected'}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card panel-pad">
              <p className="section-kicker" style={{ marginBottom: 8 }}>
                Workflow
              </p>
              <h2 style={sideHeroTitleStyle}>Select the match context, set each player, save</h2>

              <div style={workflowListStyle}>
                <div style={workflowRowStyle}>
                  <div style={workflowNumberStyle}>1</div>
                  <div>
                    <div style={workflowTitleStyle}>Choose league, team, and date</div>
                    <div style={workflowTextStyle}>
                      Load the roster from prior team match usage for the right match context.
                    </div>
                  </div>
                </div>

                <div style={workflowRowStyle}>
                  <div style={workflowNumberStyle}>2</div>
                  <div>
                    <div style={workflowTitleStyle}>Set each player’s availability</div>
                    <div style={workflowTextStyle}>
                      Mark players as available, unavailable, singles-only, doubles-only, or limited.
                    </div>
                  </div>
                </div>

                <div style={workflowRowStyle}>
                  <div style={workflowNumberStyle}>3</div>
                  <div>
                    <div style={workflowTitleStyle}>Add notes for lineup context</div>
                    <div style={workflowTextStyle}>
                      Capture details like late arrival, court preference, or match-day restrictions.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="surface-card-strong panel-pad">
          <div style={sectionHeaderStyle}>
            <div>
              <p className="section-kicker" style={{ marginBottom: 8 }}>
                Match filters
              </p>
              <h2 className="section-title" style={{ marginBottom: 8 }}>
                Load the right roster and match context
              </h2>
              <p style={sectionBodyTextStyle}>
                Choose a league, team, and match date to manage availability for that lineup pool.
              </p>
            </div>
          </div>

          <div style={filtersGridStyle}>
            <div>
              <label className="label">League / Flight</label>
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
                      {option.leagueName} · {option.flight}
                    </option>
                  )
                })}
              </select>
            </div>

            <div>
              <label className="label">Team</label>
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
            </div>

            <div>
              <label className="label">Match Date</label>
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
            </div>
          </div>

          {!!selectedTeam && (
            <div style={pillRowStyle}>
              <span className="badge badge-slate">{selectedTeam}</span>
              {selectedLeagueLabel ? (
                <span className="badge badge-blue">{selectedLeagueLabel}</span>
              ) : null}
              <span className="badge badge-slate">
                {selectedDate ? formatDate(selectedDate) : 'No match date selected'}
              </span>
            </div>
          )}
        </div>
      </section>

      {loading ? (
        <section className="section">
          <div className="surface-card panel-pad">
            <p style={mutedTextStyle}>Loading availability inputs...</p>
          </div>
        </section>
      ) : error ? (
        <section className="section">
          <div className="surface-card panel-pad">
            <p style={errorTextStyle}>{error}</p>
          </div>
        </section>
      ) : !selectedLeagueKey || !selectedTeam ? (
        <section className="section">
          <div className="surface-card panel-pad">
            <h3 className="section-title" style={{ marginBottom: 8 }}>
              Start by selecting a league and team
            </h3>
            <p style={mutedTextStyle}>
              Once selected, this page will load the roster usage history and let you set availability for the chosen match date.
            </p>
          </div>
        </section>
      ) : rosterLoading ? (
        <section className="section">
          <div className="surface-card panel-pad">
            <p style={mutedTextStyle}>Loading roster and saved availability...</p>
          </div>
        </section>
      ) : roster.length === 0 ? (
        <section className="section">
          <div className="surface-card panel-pad">
            <h3 className="section-title" style={{ marginBottom: 8 }}>
              No roster usage found yet
            </h3>
            <p style={mutedTextStyle}>
              This team does not have enough prior `match_players` history yet to build an availability roster.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="section">
            <div className="metric-grid" style={availabilityMetricsStyle}>
              <div className="metric-card">
                <div className="section-kicker">Roster Size</div>
                <div style={metricValueStyle}>{roster.length}</div>
              </div>
              <div className="metric-card">
                <div className="section-kicker">Available</div>
                <div style={metricValueStyle}>{availabilitySummary.available}</div>
              </div>
              <div className="metric-card">
                <div className="section-kicker">Unavailable</div>
                <div style={metricValueStyle}>{availabilitySummary.unavailable}</div>
              </div>
              <div className="metric-card">
                <div className="section-kicker">Singles Only</div>
                <div style={metricValueStyle}>{availabilitySummary.singles_only}</div>
              </div>
              <div className="metric-card">
                <div className="section-kicker">Doubles Only</div>
                <div style={metricValueStyle}>{availabilitySummary.doubles_only}</div>
              </div>
              <div className="metric-card">
                <div className="section-kicker">Limited</div>
                <div style={metricValueStyle}>{availabilitySummary.limited}</div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="surface-card panel-pad">
              <div style={sectionHeaderStyle}>
                <div>
                  <p className="section-kicker" style={{ marginBottom: 8 }}>
                    Roster availability
                  </p>
                  <h2 className="section-title" style={{ marginBottom: 8 }}>
                    Set match-day status for each player
                  </h2>
                  <p style={sectionBodyTextStyle}>
                    Update each player’s status and add optional notes for lineup building context.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={saveAvailability}
                  disabled={saving || !selectedDate}
                  className="button-primary"
                >
                  {saving ? 'Saving...' : 'Save Availability'}
                </button>
              </div>

              {!selectedDate ? (
                <div style={noticeStyle}>
                  Choose a match date before saving. You can still set statuses now, but they will not persist until a date is selected.
                </div>
              ) : null}

              {status ? <div style={successBoxStyle}>{status}</div> : null}

              <div style={rosterGridStyle}>
                {roster.map((player) => {
                  const current = availabilityMap[player.id] || {
                    status: 'available' as AvailabilityStatus,
                    notes: '',
                  }

                  return (
                    <article key={player.id} style={playerCardStyle}>
                      <div style={playerTopStyle}>
                        <div>
                          <div style={playerNameStyle}>{player.name}</div>
                          <div style={playerMetaStyle}>
                            {player.appearances} appearance{player.appearances === 1 ? '' : 's'}
                            {' · '}
                            Preferred: <strong>{safeText(player.preferredRole, 'either')}</strong>
                            {player.flight ? ` · ${player.flight}` : ''}
                          </div>
                        </div>

                        <div style={ratingsStackStyle}>
                          <span className={`badge ${statusBadgeClass(current.status)}`}>
                            {statusLabel(current.status)}
                          </span>
                          <div className="badge badge-slate">
                            OVR {formatRating(player.overallDynamic)}
                          </div>
                        </div>
                      </div>

                      <div style={pillRowStyle}>
                        <span className="badge badge-slate">
                          S {formatRating(player.singlesDynamic)}
                        </span>
                        <span className="badge badge-slate">
                          D {formatRating(player.doublesDynamic)}
                        </span>
                      </div>

                      {player.lineupNotes ? (
                        <p style={lineupNoteStyle}>{player.lineupNotes}</p>
                      ) : null}

                      <div style={statusGridStyle}>
                        {(
                          [
                            'available',
                            'unavailable',
                            'singles_only',
                            'doubles_only',
                            'limited',
                          ] as AvailabilityStatus[]
                        ).map((statusOption) => {
                          const isActive = current.status === statusOption

                          return (
                            <button
                              key={statusOption}
                              type="button"
                              onClick={() => updatePlayerStatus(player.id, statusOption)}
                              style={{
                                ...statusButtonStyle,
                                ...(isActive ? activeStatusButtonStyle : null),
                              }}
                            >
                              {statusLabel(statusOption)}
                            </button>
                          )
                        })}
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <label className="label" style={{ marginBottom: 8 }}>
                          Notes
                        </label>
                        <textarea
                          value={current.notes}
                          onChange={(e) => updatePlayerNotes(player.id, e.target.value)}
                          placeholder="Optional notes like late arrival, doubles only, court preference, or limited match-day window."
                          className="textarea"
                          style={{ minHeight: 92 }}
                        />
                      </div>
                    </article>
                  )
                })}
              </div>

              <div style={saveFooterStyle}>
                <button
                  type="button"
                  onClick={saveAvailability}
                  disabled={saving || !selectedDate}
                  className="button-primary"
                >
                  {saving ? 'Saving...' : 'Save Availability'}
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  )
}

const heroGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.45fr) minmax(300px, 0.95fr)',
  gap: '24px',
  alignItems: 'stretch',
}

const heroTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(2.15rem, 4vw, 3.1rem)',
  lineHeight: 1.02,
  letterSpacing: '-0.03em',
}

const heroTextStyle: CSSProperties = {
  marginTop: 16,
  marginBottom: 0,
  maxWidth: 820,
  color: 'rgba(255,255,255,0.78)',
  fontSize: '1.02rem',
  lineHeight: 1.72,
}

const heroButtonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 22,
}

const heroMetricGridStyle: CSSProperties = {
  marginTop: 22,
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
}

const availabilityMetricsStyle: CSSProperties = {
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
}

const metricValueStyle: CSSProperties = {
  marginTop: 6,
  fontSize: '1.05rem',
  fontWeight: 800,
}

const sideHeroTitleStyle: CSSProperties = {
  marginTop: 10,
  marginBottom: 14,
  fontSize: '1.35rem',
  lineHeight: 1.14,
}

const workflowListStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const workflowRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
  paddingTop: 2,
}

const workflowNumberStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: '.92rem',
  color: '#0f1632',
  background: 'linear-gradient(135deg, #c7ff5e 0%, #7dffb3 100%)',
  flexShrink: 0,
}

const workflowTitleStyle: CSSProperties = {
  fontWeight: 700,
  color: '#ffffff',
  marginBottom: 4,
}

const workflowTextStyle: CSSProperties = {
  color: 'rgba(255,255,255,0.72)',
  lineHeight: 1.55,
  fontSize: '.95rem',
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  flexWrap: 'wrap',
  marginBottom: '16px',
}

const sectionBodyTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--muted-foreground, #667085)',
  lineHeight: 1.65,
  maxWidth: 760,
}

const filtersGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
}

const pillRowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '16px',
}

const rosterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
  gap: '16px',
}

const playerCardStyle: CSSProperties = {
  borderRadius: '18px',
  padding: '18px',
  background: 'linear-gradient(180deg, rgba(248,250,255,0.98) 0%, #ffffff 100%)',
  border: '1px solid rgba(15, 22, 50, 0.08)',
  boxShadow: '0 16px 40px rgba(15, 22, 50, 0.05)',
}

const playerTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '12px',
}

const playerNameStyle: CSSProperties = {
  color: '#0f1632',
  fontSize: '1.15rem',
  fontWeight: 800,
}

const playerMetaStyle: CSSProperties = {
  color: 'var(--muted-foreground, #667085)',
  marginTop: '6px',
  fontSize: '0.92rem',
  lineHeight: 1.55,
}

const ratingsStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '8px',
}

const lineupNoteStyle: CSSProperties = {
  marginTop: '12px',
  marginBottom: 0,
  color: '#0f1632',
  lineHeight: 1.58,
  fontSize: '.95rem',
}

const statusGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
  marginTop: '14px',
}

const statusButtonStyle: CSSProperties = {
  border: '1px solid rgba(15, 22, 50, 0.12)',
  background: '#ffffff',
  color: '#334155',
  padding: '10px 12px',
  borderRadius: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  textTransform: 'none',
}

const activeStatusButtonStyle: CSSProperties = {
  background: 'linear-gradient(135deg, #255BE3 0%, #3d7cff 100%)',
  color: '#ffffff',
  border: '1px solid #255BE3',
  boxShadow: '0 10px 24px rgba(37, 91, 227, 0.22)',
}

const saveFooterStyle: CSSProperties = {
  marginTop: '22px',
  display: 'flex',
  justifyContent: 'flex-start',
}

const noticeStyle: CSSProperties = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: 'rgba(255, 214, 102, 0.14)',
  border: '1px solid rgba(255, 214, 102, 0.34)',
  color: '#7a5a00',
  lineHeight: 1.55,
}

const successBoxStyle: CSSProperties = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: 'rgba(112, 255, 165, 0.12)',
  border: '1px solid rgba(112, 255, 165, 0.30)',
  color: '#0f8f52',
}

const mutedTextStyle: CSSProperties = {
  color: 'var(--muted-foreground, #667085)',
  margin: 0,
  lineHeight: 1.65,
}

const errorTextStyle: CSSProperties = {
  color: '#b42318',
  margin: 0,
  lineHeight: 1.65,
}