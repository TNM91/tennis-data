'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
      overall_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
      preferred_role: string | null
      lineup_notes: string | null
    }
  | {
      id: string
      name: string
      flight: string | null
      overall_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
      preferred_role: string | null
      lineup_notes: string | null
    }[]
  | null

type MatchPlayerRow = {
  match_id: string
  side: 'A' | 'B'
  player_id: string
  players: PlayerRelation
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

type RosterPlayer = {
  id: string
  name: string
  flight: string | null
  appearances: number
  singlesDynamic: number | null
  doublesDynamic: number | null
  overallDynamic: number | null
  preferredRole: string | null
  lineupNotes: string | null
  availabilityStatus: AvailabilityStatus
  availabilityNotes: string
}

type LeagueOption = {
  leagueName: string
  flight: string
}

type BuilderSlots = {
  s1: string
  s2: string
  d1p1: string
  d1p2: string
  d2p1: string
  d2p2: string
  d3p1: string
  d3p2: string
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

function formatRating(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value.toFixed(2)
}

function getAvailabilityLabel(status: AvailabilityStatus) {
  if (status === 'available') return 'Available'
  if (status === 'unavailable') return 'Unavailable'
  if (status === 'singles_only') return 'Singles Only'
  if (status === 'doubles_only') return 'Doubles Only'
  return 'Limited'
}

function buildLeagueKey(leagueName: string, flight: string) {
  return `${leagueName}___${flight}`
}

const EMPTY_SLOTS: BuilderSlots = {
  s1: '',
  s2: '',
  d1p1: '',
  d1p2: '',
  d2p1: '',
  d2p2: '',
  d3p1: '',
  d3p2: '',
}

export default function LineupBuilderPage() {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedLeagueKey, setSelectedLeagueKey] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedDate, setSelectedDate] = useState('')

  const [rosterLoading, setRosterLoading] = useState(false)
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [slots, setSlots] = useState<BuilderSlots>(EMPTY_SLOTS)

  useEffect(() => {
    void loadMatches()
  }, [])

  useEffect(() => {
    if (!selectedLeagueKey || !selectedTeam) {
      setRoster([])
      setSlots(EMPTY_SLOTS)
      return
    }

    void loadRoster()
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
      setError(err instanceof Error ? err.message : 'Failed to load lineup builder data.')
    } finally {
      setLoading(false)
    }
  }

  async function loadRoster() {
    setRosterLoading(true)
    setError('')

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
        setSlots(EMPTY_SLOTS)
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
            overall_dynamic_rating,
            singles_dynamic_rating,
            doubles_dynamic_rating,
            preferred_role,
            lineup_notes
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
            appearances: 0,
            singlesDynamic: player.singles_dynamic_rating,
            doublesDynamic: player.doubles_dynamic_rating,
            overallDynamic: player.overall_dynamic_rating,
            preferredRole: player.preferred_role,
            lineupNotes: player.lineup_notes,
            availabilityStatus: 'available',
            availabilityNotes: '',
          })
        }

        rosterMap.get(player.id)!.appearances += 1
      }

      const rosterList = [...rosterMap.values()]

      if (selectedDate) {
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
        const availabilityByPlayerId = new Map<string, AvailabilityRow>(
          typedAvailability.map((row) => [row.player_id, row])
        )

        for (const player of rosterList) {
          const availability = availabilityByPlayerId.get(player.id)
          if (availability) {
            player.availabilityStatus = availability.status
            player.availabilityNotes = availability.notes || ''
          }
        }
      }

      rosterList.sort((a, b) => {
        const aSingles = typeof a.singlesDynamic === 'number' ? a.singlesDynamic : -999
        const bSingles = typeof b.singlesDynamic === 'number' ? b.singlesDynamic : -999
        if (bSingles !== aSingles) return bSingles - aSingles
        return a.name.localeCompare(b.name)
      })

      setRoster(rosterList)
      setSlots(EMPTY_SLOTS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roster.')
    } finally {
      setRosterLoading(false)
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

      if (teamMatch && row.match_date) dateSet.add(row.match_date)
    }

    return [...dateSet].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  }, [matches, selectedLeagueKey, selectedTeam])

  const playersById = useMemo(() => {
    const map = new Map<string, RosterPlayer>()
    for (const player of roster) map.set(player.id, player)
    return map
  }, [roster])

  const selectedIds = useMemo(() => {
    return Object.values(slots).filter(Boolean)
  }, [slots])

  const duplicateIds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const id of selectedIds) {
      counts.set(id, (counts.get(id) || 0) + 1)
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id))
  }, [selectedIds])

  const warnings = useMemo(() => {
    const items: string[] = []

    const checkSinglesSlot = (slotId: string, label: string) => {
      const player = playersById.get(slotId)
      if (!player) return
      if (player.availabilityStatus === 'unavailable') items.push(`${label}: ${player.name} is unavailable.`)
      if (player.availabilityStatus === 'doubles_only') items.push(`${label}: ${player.name} is doubles only.`)
      if (player.availabilityStatus === 'limited') items.push(`${label}: ${player.name} is limited.`)
      if (player.preferredRole === 'doubles') items.push(`${label}: ${player.name} prefers doubles.`)
    }

    const checkDoublesSlot = (slotId: string, label: string) => {
      const player = playersById.get(slotId)
      if (!player) return
      if (player.availabilityStatus === 'unavailable') items.push(`${label}: ${player.name} is unavailable.`)
      if (player.availabilityStatus === 'singles_only') items.push(`${label}: ${player.name} is singles only.`)
      if (player.availabilityStatus === 'limited') items.push(`${label}: ${player.name} is limited.`)
      if (player.preferredRole === 'singles') items.push(`${label}: ${player.name} prefers singles.`)
    }

    if (duplicateIds.size > 0) {
      items.push('A player is assigned in more than one lineup spot.')
    }

    checkSinglesSlot(slots.s1, 'S1')
    checkSinglesSlot(slots.s2, 'S2')

    checkDoublesSlot(slots.d1p1, 'D1')
    checkDoublesSlot(slots.d1p2, 'D1')
    checkDoublesSlot(slots.d2p1, 'D2')
    checkDoublesSlot(slots.d2p2, 'D2')
    checkDoublesSlot(slots.d3p1, 'D3')
    checkDoublesSlot(slots.d3p2, 'D3')

    return items
  }, [slots, playersById, duplicateIds])

  const lineupStrength = useMemo(() => {
    const singlesPlayers = [slots.s1, slots.s2].map((id) => playersById.get(id)).filter(Boolean) as RosterPlayer[]
    const doublesTeams = [
      [slots.d1p1, slots.d1p2],
      [slots.d2p1, slots.d2p2],
      [slots.d3p1, slots.d3p2],
    ]
      .map(([a, b]) => [playersById.get(a), playersById.get(b)].filter(Boolean) as RosterPlayer[])
      .filter((pair) => pair.length === 2)

    const singlesScore =
      singlesPlayers.length > 0
        ? singlesPlayers.reduce((sum, player) => sum + (player.singlesDynamic || 0), 0) / singlesPlayers.length
        : null

    const doublesScores = doublesTeams.map(
      (pair) => ((pair[0].doublesDynamic || 0) + (pair[1].doublesDynamic || 0)) / 2
    )

    const doublesScore =
      doublesScores.length > 0
        ? doublesScores.reduce((sum, value) => sum + value, 0) / doublesScores.length
        : null

    const overall =
      singlesScore !== null || doublesScore !== null
        ? (((singlesScore || 0) * 2) + ((doublesScore || 0) * 3)) / 5
        : null

    return { singlesScore, doublesScore, overall }
  }, [slots, playersById])

  function updateSlot(slot: keyof BuilderSlots, value: string) {
    setSlots((prev) => ({ ...prev, [slot]: value }))
  }

  function filteredOptions(slot: keyof BuilderSlots) {
    const otherSelected = new Set(
      Object.entries(slots)
        .filter(([key, value]) => key !== slot && Boolean(value))
        .map(([, value]) => value)
    )

    return roster.filter((player) => !otherSelected.has(player.id))
  }

  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
        <Link href="/leagues" style={navLinkStyle}>Leagues</Link>
        <Link href="/captains-corner" style={navLinkStyle}>Captain&apos;s Corner</Link>
        <Link href="/admin" style={navLinkStyle}>Admin</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>Manual Lineup Builder</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          Build your own lineup, see lineup strength, and catch availability or role-fit issues before match day.
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
                setSlots(EMPTY_SLOTS)
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
                setSlots(EMPTY_SLOTS)
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
            <label style={labelStyle}>Match Date (optional)</label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={inputStyle}
              disabled={!selectedTeam}
            >
              <option value="">No date filter</option>
              {relevantDates.map((date) => (
                <option key={date} value={date}>
                  {formatDate(date)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={emptyStateStyle}>Loading builder data...</div>
        ) : error ? (
          <div style={errorBoxStyle}>{error}</div>
        ) : !selectedLeagueKey || !selectedTeam ? (
          <div style={emptyStateStyle}>Choose a league and team to start building a lineup.</div>
        ) : rosterLoading ? (
          <div style={emptyStateStyle}>Loading roster...</div>
        ) : roster.length === 0 ? (
          <div style={emptyStateStyle}>No roster usage found for this team yet.</div>
        ) : (
          <>
            <div style={summaryPillRowStyle}>
              <div style={summaryPillStyle}><strong>{selectedTeam}</strong></div>
              {selectedDate ? (
                <div style={summaryPillStyle}>Date: <strong>{formatDate(selectedDate)}</strong></div>
              ) : null}
              <div style={summaryPillStyle}><strong>{roster.length}</strong> players</div>
            </div>

            <div style={builderGridStyle}>
              <div style={builderCardStyle}>
                <div style={builderHeaderStyle}>Singles</div>
                <BuilderSelect
                  label="S1"
                  value={slots.s1}
                  onChange={(value) => updateSlot('s1', value)}
                  players={filteredOptions('s1')}
                />
                <BuilderSelect
                  label="S2"
                  value={slots.s2}
                  onChange={(value) => updateSlot('s2', value)}
                  players={filteredOptions('s2')}
                />
              </div>

              <div style={builderCardStyle}>
                <div style={builderHeaderStyle}>Doubles</div>
                <BuilderSelect
                  label="D1 Player 1"
                  value={slots.d1p1}
                  onChange={(value) => updateSlot('d1p1', value)}
                  players={filteredOptions('d1p1')}
                />
                <BuilderSelect
                  label="D1 Player 2"
                  value={slots.d1p2}
                  onChange={(value) => updateSlot('d1p2', value)}
                  players={filteredOptions('d1p2')}
                />
                <BuilderSelect
                  label="D2 Player 1"
                  value={slots.d2p1}
                  onChange={(value) => updateSlot('d2p1', value)}
                  players={filteredOptions('d2p1')}
                />
                <BuilderSelect
                  label="D2 Player 2"
                  value={slots.d2p2}
                  onChange={(value) => updateSlot('d2p2', value)}
                  players={filteredOptions('d2p2')}
                />
                <BuilderSelect
                  label="D3 Player 1"
                  value={slots.d3p1}
                  onChange={(value) => updateSlot('d3p1', value)}
                  players={filteredOptions('d3p1')}
                />
                <BuilderSelect
                  label="D3 Player 2"
                  value={slots.d3p2}
                  onChange={(value) => updateSlot('d3p2', value)}
                  players={filteredOptions('d3p2')}
                />
              </div>
            </div>
                        <div style={sectionBlockStyle}>
              <h2 style={sectionTitleStyle}>Lineup Strength</h2>
              <div style={strengthGridStyle}>
                <StrengthCard
                  label="Singles Average"
                  value={formatRating(lineupStrength.singlesScore)}
                />
                <StrengthCard
                  label="Doubles Average"
                  value={formatRating(lineupStrength.doublesScore)}
                />
                <StrengthCard
                  label="Overall Lineup Score"
                  value={formatRating(lineupStrength.overall)}
                />
              </div>
            </div>

            <div style={sectionBlockStyle}>
              <h2 style={sectionTitleStyle}>Captain Warnings</h2>
              {warnings.length ? (
                <div style={warningBoxStyle}>
                  {warnings.map((warning) => (
                    <div key={warning} style={warningItemStyle}>• {warning}</div>
                  ))}
                </div>
              ) : (
                <div style={successBoxStyle}>No major conflicts detected in this lineup.</div>
              )}
            </div>

            <div style={sectionBlockStyle}>
              <h2 style={sectionTitleStyle}>Roster Pool</h2>
              <div style={sectionSubStyle}>
                Use this as your bench and alternate pool while building the lineup.
              </div>

              <div style={rosterGridStyle}>
                {roster.map((player) => (
                  <div key={player.id} style={playerCardStyle}>
                    <div style={playerNameStyle}>{player.name}</div>
                    <div style={playerMetaStyle}>
                      {player.appearances} appearances · {getAvailabilityLabel(player.availabilityStatus)}
                    </div>

                    <div style={badgeRowStyle}>
                      {player.preferredRole ? (
                        <div style={roleBadgeStyle}>Prefers {player.preferredRole}</div>
                      ) : null}
                      {selectedIds.includes(player.id) ? (
                        <div style={selectedBadgeStyle}>Selected</div>
                      ) : null}
                    </div>

                    <div style={miniStatsGridStyle}>
                      <MiniStat label="Overall" value={formatRating(player.overallDynamic)} />
                      <MiniStat label="Singles" value={formatRating(player.singlesDynamic)} />
                      <MiniStat label="Doubles" value={formatRating(player.doublesDynamic)} />
                    </div>

                    {player.availabilityNotes ? (
                      <div style={notesBoxStyle}>
                        <strong>Availability:</strong> {player.availabilityNotes}
                      </div>
                    ) : null}

                    {player.lineupNotes ? (
                      <div style={notesBoxStyle}>
                        <strong>Captain note:</strong> {player.lineupNotes}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function BuilderSelect({
  label,
  value,
  onChange,
  players,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  players: RosterPlayer[]
}) {
  return (
    <div style={builderFieldStyle}>
      <label style={builderLabelStyle}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        <option value="">Open slot</option>
        {players.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name} · S {formatRating(player.singlesDynamic)} · D {formatRating(player.doublesDynamic)} · {getAvailabilityLabel(player.availabilityStatus)}
          </option>
        ))}
      </select>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniStatStyle}>
      <div style={miniStatLabelStyle}>{label}</div>
      <div style={miniStatValueStyle}>{value}</div>
    </div>
  )
}

function StrengthCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={strengthCardStyle}>
      <div style={strengthLabelStyle}>{label}</div>
      <div style={strengthValueStyle}>{value}</div>
    </div>
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
  minWidth: '280px',
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

const builderGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '16px',
}

const builderCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  padding: '18px',
}

const builderHeaderStyle = {
  color: '#0f172a',
  fontSize: '22px',
  fontWeight: 800,
  marginBottom: '12px',
}

const builderFieldStyle = {
  marginBottom: '12px',
}

const builderLabelStyle = {
  display: 'block',
  fontWeight: 700,
  color: '#334155',
  marginBottom: '8px',
  fontSize: '14px',
}

const sectionBlockStyle = {
  marginTop: '22px',
}

const sectionTitleStyle = {
  margin: 0,
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: 800,
}

const sectionSubStyle = {
  color: '#64748b',
  fontSize: '14px',
  marginTop: '6px',
  marginBottom: '14px',
}

const strengthGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
}

const strengthCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '16px',
}

const strengthLabelStyle = {
  color: '#64748b',
  fontSize: '12px',
  marginBottom: '6px',
}

const strengthValueStyle = {
  color: '#0f172a',
  fontWeight: 800,
  fontSize: '28px',
}

const warningBoxStyle = {
  background: '#fff7ed',
  border: '1px solid #fed7aa',
  borderRadius: '16px',
  padding: '14px',
}

const warningItemStyle = {
  color: '#9a3412',
  fontSize: '14px',
  marginBottom: '6px',
}

const successBoxStyle = {
  background: '#dcfce7',
  border: '1px solid #bbf7d0',
  borderRadius: '16px',
  padding: '14px',
  color: '#166534',
  fontWeight: 700,
}

const rosterGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '14px',
}

const playerCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '16px',
}

const playerNameStyle = {
  color: '#0f172a',
  fontSize: '20px',
  fontWeight: 800,
}

const playerMetaStyle = {
  color: '#64748b',
  fontSize: '14px',
  marginTop: '6px',
  marginBottom: '10px',
}

const badgeRowStyle = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap' as const,
  marginBottom: '12px',
}

const roleBadgeStyle = {
  padding: '6px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  background: '#f1f5f9',
  color: '#334155',
}

const selectedBadgeStyle = {
  padding: '6px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  background: '#dbeafe',
  color: '#1d4ed8',
}

const miniStatsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '10px',
}

const miniStatStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '10px',
}

const miniStatLabelStyle = {
  color: '#64748b',
  fontSize: '12px',
  marginBottom: '4px',
}

const miniStatValueStyle = {
  color: '#0f172a',
  fontWeight: 700,
}

const notesBoxStyle = {
  marginTop: '10px',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '10px',
  color: '#475569',
  fontSize: '13px',
  lineHeight: 1.5,
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