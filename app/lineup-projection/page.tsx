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

type DoublesPair = {
  player1: RosterPlayer
  player2: RosterPlayer
  combinedDoubles: number
  notes: string[]
}

function safeText(value: string | null | undefined, fallback = 'Unknown') {
  const text = (value || '').trim()
  return text || fallback
}

function formatRating(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value.toFixed(2)
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

function normalizePlayerRelation(player: PlayerRelation) {
  if (!player) return null
  return Array.isArray(player) ? player[0] ?? null : player
}

function buildLeagueKey(leagueName: string, flight: string) {
  return `${leagueName}___${flight}`
}

function getAvailabilityLabel(status: AvailabilityStatus) {
  if (status === 'available') return 'Available'
  if (status === 'unavailable') return 'Unavailable'
  if (status === 'singles_only') return 'Singles Only'
  if (status === 'doubles_only') return 'Doubles Only'
  return 'Limited'
}

function canPlaySingles(player: RosterPlayer) {
  return player.availabilityStatus !== 'unavailable' && player.availabilityStatus !== 'doubles_only'
}

function canPlayDoubles(player: RosterPlayer) {
  return player.availabilityStatus !== 'unavailable' && player.availabilityStatus !== 'singles_only'
}

function limitedPenalty(player: RosterPlayer) {
  return player.availabilityStatus === 'limited' ? 0.03 : 0
}

function preferredRoleBonusSingles(player: RosterPlayer) {
  if (player.preferredRole === 'singles') return 0.03
  if (player.preferredRole === 'doubles') return -0.03
  return 0
}

function preferredRoleBonusDoubles(player: RosterPlayer) {
  if (player.preferredRole === 'doubles') return 0.03
  if (player.preferredRole === 'singles') return -0.03
  return 0
}

function adjustedSinglesScore(player: RosterPlayer) {
  const base = typeof player.singlesDynamic === 'number' ? player.singlesDynamic : -999
  return base + preferredRoleBonusSingles(player) - limitedPenalty(player)
}

function adjustedDoublesScore(player: RosterPlayer) {
  const base = typeof player.doublesDynamic === 'number' ? player.doublesDynamic : -999
  return base + preferredRoleBonusDoubles(player) - limitedPenalty(player)
}

export default function LineupProjectionPage() {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedLeagueKey, setSelectedLeagueKey] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedDate, setSelectedDate] = useState('')

  const [rosterLoading, setRosterLoading] = useState(false)
  const [roster, setRoster] = useState<RosterPlayer[]>([])

  useEffect(() => {
    void loadLeaguesAndTeams()
  }, [])

  useEffect(() => {
    if (!selectedLeagueKey || !selectedTeam) {
      setRoster([])
      return
    }

    void loadTeamRoster()
  }, [selectedLeagueKey, selectedTeam, selectedDate])

  async function loadLeaguesAndTeams() {
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
      setError(err instanceof Error ? err.message : 'Failed to load lineup data.')
    } finally {
      setLoading(false)
    }
  }

  async function loadTeamRoster() {
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
        if (b.appearances !== a.appearances) return b.appearances - a.appearances
        return a.name.localeCompare(b.name)
      })

      setRoster(rosterList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team roster.')
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

      if (teamMatch && row.match_date) {
        dateSet.add(row.match_date)
      }
    }

    return [...dateSet].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  }, [matches, selectedLeagueKey, selectedTeam])

  const singlesProjection = useMemo(() => {
    return [...roster]
      .filter(canPlaySingles)
      .sort((a, b) => {
        const aValue = adjustedSinglesScore(a)
        const bValue = adjustedSinglesScore(b)
        if (bValue !== aValue) return bValue - aValue
        return b.appearances - a.appearances
      })
      .slice(0, 6)
  }, [roster])

  const doublesPairs = useMemo<DoublesPair[]>(() => {
    const players = [...roster]
      .filter(canPlayDoubles)
      .filter((player) => typeof player.doublesDynamic === 'number')
      .sort((a, b) => {
        const aValue = adjustedDoublesScore(a)
        const bValue = adjustedDoublesScore(b)
        if (bValue !== aValue) return bValue - aValue
        return b.appearances - a.appearances
      })

    const pairs: DoublesPair[] = []

    for (let i = 0; i < players.length; i += 1) {
      for (let j = i + 1; j < players.length; j += 1) {
        const player1 = players[i]
        const player2 = players[j]
        const notes: string[] = []

        if (player1.availabilityStatus === 'limited' || player2.availabilityStatus === 'limited') {
          notes.push('Includes limited-availability player')
        }

        if (player1.preferredRole === 'doubles' && player2.preferredRole === 'doubles') {
          notes.push('Strong doubles-role fit')
        }

        const combinedDoubles =
          (adjustedDoublesScore(player1) + adjustedDoublesScore(player2)) / 2

        pairs.push({
          player1,
          player2,
          combinedDoubles,
          notes,
        })
      }
    }

    return pairs.sort((a, b) => b.combinedDoubles - a.combinedDoubles).slice(0, 8)
  }, [roster])

  const suggestedLineup = useMemo(() => {
    const topSingles = singlesProjection.slice(0, 2)
    const usedIds = new Set<string>(topSingles.map((player) => player.id))
    const topPairs: DoublesPair[] = []

    for (const pair of doublesPairs) {
      if (usedIds.has(pair.player1.id) || usedIds.has(pair.player2.id)) continue

      topPairs.push(pair)
      usedIds.add(pair.player1.id)
      usedIds.add(pair.player2.id)

      if (topPairs.length === 3) break
    }

    const notes: string[] = []

    if (roster.some((player) => player.availabilityStatus === 'unavailable')) {
      notes.push('Unavailable players were excluded.')
    }

    if (roster.some((player) => player.availabilityStatus === 'limited')) {
      notes.push('Limited players were included only if they still graded out strongly.')
    }

    if (roster.some((player) => player.availabilityStatus === 'singles_only')) {
      notes.push('Singles-only players were kept out of doubles pairings.')
    }

    if (roster.some((player) => player.availabilityStatus === 'doubles_only')) {
      notes.push('Doubles-only players were kept out of singles lines.')
    }

    return {
      singles: topSingles,
      doubles: topPairs,
      notes,
    }
  }, [singlesProjection, doublesPairs, roster])

  const selectedLeagueLabel = useMemo(() => {
    if (!selectedLeagueKey) return ''
    const [leagueName, flight] = selectedLeagueKey.split('___')
    return `${leagueName} · ${flight}`
  }, [selectedLeagueKey])

  const availabilitySummary = useMemo(() => {
    let available = 0
    let unavailable = 0
    let singlesOnly = 0
    let doublesOnly = 0
    let limited = 0

    for (const player of roster) {
      if (player.availabilityStatus === 'available') available += 1
      if (player.availabilityStatus === 'unavailable') unavailable += 1
      if (player.availabilityStatus === 'singles_only') singlesOnly += 1
      if (player.availabilityStatus === 'doubles_only') doublesOnly += 1
      if (player.availabilityStatus === 'limited') limited += 1
    }

    return { available, unavailable, singlesOnly, doublesOnly, limited }
  }, [roster])

  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
        <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
        <Link href="/leagues" style={navLinkStyle}>Leagues</Link>
        <Link href="/captains-corner" style={navLinkStyle}>Captain&apos;s Corner</Link>
        <Link href="/admin" style={navLinkStyle}>Admin</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>Lineup Projection</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          Pick a league, team, and optional match date to generate lineup suggestions using dynamic ratings,
          roster usage, preferences, and availability.
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
          <div style={emptyStateStyle}>Loading lineup data...</div>
        ) : error ? (
          <div style={errorBoxStyle}>{error}</div>
        ) : !selectedLeagueKey || !selectedTeam ? (
          <div style={emptyStateStyle}>
            Choose a league and team to generate a projected lineup.
          </div>
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
              {selectedDate ? (
                <div style={summaryPillStyle}>
                  Date: <strong>{formatDate(selectedDate)}</strong>
                </div>
              ) : null}
              <div style={summaryPillStyle}>
                <strong>{roster.length}</strong> players
              </div>
            </div>

            <div style={summaryPillRowStyle}>
              <div style={availabilityPillStyle}>Available: {availabilitySummary.available}</div>
              <div style={availabilityPillStyle}>Unavailable: {availabilitySummary.unavailable}</div>
              <div style={availabilityPillStyle}>Singles Only: {availabilitySummary.singlesOnly}</div>
              <div style={availabilityPillStyle}>Doubles Only: {availabilitySummary.doublesOnly}</div>
              <div style={availabilityPillStyle}>Limited: {availabilitySummary.limited}</div>
            </div>

            <div style={sectionBlockStyle}>
              <h2 style={sectionTitleStyle}>Suggested Lineup</h2>
              <div style={sectionSubStyle}>
                Best current estimate using ratings, availability, and role preferences.
              </div>

              <div style={projectionGridStyle}>
                <div style={projectionCardStyle}>
                  <div style={projectionHeaderStyle}>Projected Singles</div>
                  {suggestedLineup.singles.length ? (
                    suggestedLineup.singles.map((player, index) => (
                      <div key={player.id} style={lineItemStyle}>
                        <div>
                          <strong>S{index + 1}:</strong> {player.name}
                        </div>
                        <div style={lineMetaStyle}>
                          Singles DR: {formatRating(player.singlesDynamic)} · {getAvailabilityLabel(player.availabilityStatus)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={emptyMiniStyle}>Not enough eligible singles players.</div>
                  )}
                </div>

                <div style={projectionCardStyle}>
                  <div style={projectionHeaderStyle}>Projected Doubles</div>
                  {suggestedLineup.doubles.length ? (
                    suggestedLineup.doubles.map((pair, index) => (
                      <div key={`${pair.player1.id}-${pair.player2.id}`} style={lineItemStyle}>
                        <div>
                          <strong>D{index + 1}:</strong> {pair.player1.name} / {pair.player2.name}
                        </div>
                        <div style={lineMetaStyle}>
                          Pair DR: {pair.combinedDoubles.toFixed(2)}
                        </div>
                        {pair.notes.length ? (
                          <div style={lineNoteStyle}>{pair.notes.join(' · ')}</div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div style={emptyMiniStyle}>Not enough eligible doubles players.</div>
                  )}
                </div>
              </div>

              {suggestedLineup.notes.length ? (
                <div style={coachNotesBoxStyle}>
                  <div style={coachNotesHeaderStyle}>Captain Suggestions</div>
                  {suggestedLineup.notes.map((note) => (
                    <div key={note} style={coachNoteStyle}>• {note}</div>
                  ))}
                </div>
              ) : null}
            </div>
                        <div style={sectionBlockStyle}>
              <h2 style={sectionTitleStyle}>Roster Pool</h2>
              <div style={sectionSubStyle}>
                Available team pool after applying match-date availability.
              </div>

              <div style={rosterGridStyle}>
                {roster.map((player) => (
                  <div key={player.id} style={playerCardStyle}>
                    <div style={playerNameStyle}>{player.name}</div>
                    <div style={playerMetaStyle}>
                      {player.appearances} appearances · Flight {safeText(player.flight)}
                    </div>

                    <div style={statusBadgeRowStyle}>
                      <div
                        style={{
                          ...statusBadgeStyle,
                          ...(player.availabilityStatus === 'unavailable'
                            ? unavailableBadgeStyle
                            : player.availabilityStatus === 'limited'
                              ? limitedBadgeStyle
                              : player.availabilityStatus === 'singles_only'
                                ? singlesOnlyBadgeStyle
                                : player.availabilityStatus === 'doubles_only'
                                  ? doublesOnlyBadgeStyle
                                  : availableBadgeStyle),
                        }}
                      >
                        {getAvailabilityLabel(player.availabilityStatus)}
                      </div>

                      {player.preferredRole ? (
                        <div style={roleBadgeStyle}>Prefers {player.preferredRole}</div>
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

            <div style={sectionBlockStyle}>
              <h2 style={sectionTitleStyle}>Top Singles Options</h2>
              <div style={sectionSubStyle}>
                Ranked by singles dynamic rating, adjusted for availability and role preference.
              </div>

              <div style={listCardStyle}>
                {singlesProjection.map((player, index) => (
                  <div key={player.id} style={listRowStyle}>
                    <div>
                      <strong>{index + 1}.</strong> {player.name}
                    </div>
                    <div style={listRowMetaStyle}>
                      Singles DR: {formatRating(player.singlesDynamic)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={sectionBlockStyle}>
              <h2 style={sectionTitleStyle}>Top Doubles Pairings</h2>
              <div style={sectionSubStyle}>
                Ranked by average doubles dynamic rating, adjusted for availability and role preference.
              </div>

              <div style={listCardStyle}>
                {doublesPairs.map((pair, index) => (
                  <div key={`${pair.player1.id}-${pair.player2.id}`} style={listRowStyle}>
                    <div>
                      <strong>{index + 1}.</strong> {pair.player1.name} / {pair.player2.name}
                      {pair.notes.length ? (
                        <div style={pairNotesInlineStyle}>{pair.notes.join(' · ')}</div>
                      ) : null}
                    </div>
                    <div style={listRowMetaStyle}>
                      Pair DR: {pair.combinedDoubles.toFixed(2)}
                    </div>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniStatStyle}>
      <div style={miniStatLabelStyle}>{label}</div>
      <div style={miniStatValueStyle}>{value}</div>
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

const availabilityPillStyle = {
  padding: '10px 14px',
  borderRadius: '999px',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  color: '#334155',
  fontWeight: 700,
}

const sectionBlockStyle = {
  marginTop: '20px',
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

const projectionGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '16px',
}

const projectionCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '18px',
  padding: '18px',
}

const projectionHeaderStyle = {
  color: '#0f172a',
  fontSize: '20px',
  fontWeight: 800,
  marginBottom: '12px',
}

const lineItemStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '12px',
  marginBottom: '10px',
}

const lineMetaStyle = {
  color: '#64748b',
  fontSize: '13px',
  marginTop: '4px',
}

const lineNoteStyle = {
  color: '#92400e',
  fontSize: '12px',
  marginTop: '6px',
  fontWeight: 700,
}

const coachNotesBoxStyle = {
  marginTop: '16px',
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: '16px',
  padding: '14px',
}

const coachNotesHeaderStyle = {
  color: '#1d4ed8',
  fontWeight: 800,
  marginBottom: '8px',
}

const coachNoteStyle = {
  color: '#334155',
  fontSize: '14px',
  marginBottom: '4px',
}

const emptyMiniStyle = {
  color: '#64748b',
  fontSize: '14px',
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
  marginBottom: '12px',
}

const statusBadgeRowStyle = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap' as const,
  marginBottom: '12px',
}

const statusBadgeStyle = {
  padding: '6px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
}

const availableBadgeStyle = {
  background: '#dcfce7',
  color: '#166534',
}

const unavailableBadgeStyle = {
  background: '#fee2e2',
  color: '#991b1b',
}

const singlesOnlyBadgeStyle = {
  background: '#dbeafe',
  color: '#1d4ed8',
}

const doublesOnlyBadgeStyle = {
  background: '#ede9fe',
  color: '#6d28d9',
}

const limitedBadgeStyle = {
  background: '#fef3c7',
  color: '#92400e',
}

const roleBadgeStyle = {
  padding: '6px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  background: '#f1f5f9',
  color: '#334155',
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

const listCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  overflow: 'hidden',
}

const listRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  padding: '14px 16px',
  borderBottom: '1px solid #e2e8f0',
}

const listRowMetaStyle = {
  color: '#1d4ed8',
  fontWeight: 700,
  whiteSpace: 'nowrap' as const,
}

const pairNotesInlineStyle = {
  color: '#92400e',
  fontSize: '12px',
  marginTop: '4px',
  fontWeight: 700,
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