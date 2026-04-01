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
    <main className="page-shell-tight lineup-page">
      <div className="lineup-top-links">
        <Link href="/" className="button-ghost">Home</Link>
        <Link href="/rankings" className="button-ghost">Rankings</Link>
        <Link href="/matchup" className="button-ghost">Matchup</Link>
        <Link href="/leagues" className="button-ghost">Leagues</Link>
        <Link href="/captains-corner" className="button-ghost">Captain&apos;s Corner</Link>
        <Link href="/admin" className="button-ghost">Admin</Link>
      </div>

      <section className="hero-panel lineup-hero-panel">
        <div className="hero-inner lineup-hero-inner">
          <div className="lineup-hero-copy">
            <div className="section-kicker lineup-kicker">Lineup Projection</div>
            <h1 className="lineup-title">Build a smarter lineup from the available roster.</h1>
            <p className="lineup-subtitle">
              Pick a league, team, and optional match date to generate lineup suggestions using
              dynamic ratings, roster usage, preferences, and availability.
            </p>

            <div className="lineup-hero-badges">
              <span className="badge badge-blue">{leagueOptions.length} league / flight options</span>
              <span className="badge badge-slate">{matches.length} matches loaded</span>
              <span className="badge badge-green">Captain planning tool</span>
            </div>
          </div>

          <div className="glass-card panel-pad lineup-hero-side">
            <div className="lineup-side-label">Projection logic</div>
            <div className="lineup-side-value">Ratings + usage + availability</div>
            <div className="lineup-side-text">
              Singles and doubles recommendations are adjusted for availability status and preferred role,
              then ranked from the most competitive options.
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card panel-pad lineup-controls-card">
        <div className="lineup-controls-head">
          <div>
            <div className="section-kicker">Filters</div>
            <h2 className="lineup-section-title">Choose your team context</h2>
          </div>
        </div>

        <div className="lineup-filter-grid">
          <div>
            <label className="label">League / Flight</label>
            <select
              value={selectedLeagueKey}
              onChange={(e) => {
                setSelectedLeagueKey(e.target.value)
                setSelectedTeam('')
                setSelectedDate('')
                setRoster([])
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
            <label className="label">Match Date (optional)</label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="select"
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
          <div className="lineup-state-box">Loading lineup data...</div>
        ) : error ? (
          <div className="lineup-error-box">{error}</div>
        ) : !selectedLeagueKey || !selectedTeam ? (
          <div className="lineup-state-box">
            Choose a league and team to generate a projected lineup.
          </div>
        ) : rosterLoading ? (
          <div className="lineup-state-box">Loading roster...</div>
        ) : roster.length === 0 ? (
          <div className="lineup-state-box">No roster usage found for this team yet.</div>
        ) : (
          <>
            <div className="lineup-summary-row">
              <span className="badge badge-blue">
                <strong>{selectedTeam}</strong>
              </span>
              <span className="badge badge-slate">
                <strong>{selectedLeagueLabel}</strong>
              </span>
              {selectedDate ? (
                <span className="badge badge-slate">
                  Date: <strong>{formatDate(selectedDate)}</strong>
                </span>
              ) : null}
              <span className="badge badge-green">
                <strong>{roster.length}</strong> players
              </span>
            </div>

            <div className="lineup-summary-row">
              <SummaryBadge label="Available" value={availabilitySummary.available} tone="green" />
              <SummaryBadge label="Unavailable" value={availabilitySummary.unavailable} tone="red" />
              <SummaryBadge label="Singles Only" value={availabilitySummary.singlesOnly} tone="blue" />
              <SummaryBadge label="Doubles Only" value={availabilitySummary.doublesOnly} tone="purple" />
              <SummaryBadge label="Limited" value={availabilitySummary.limited} tone="amber" />
            </div>

            <section className="lineup-block">
              <div className="lineup-section-head">
                <div>
                  <div className="section-kicker">Suggested Lineup</div>
                  <h2 className="lineup-section-title">Best current estimate</h2>
                  <div className="lineup-section-sub">
                    Uses ratings, availability, and role preferences.
                  </div>
                </div>
              </div>

              <div className="card-grid lineup-projection-grid">
                <div className="surface-card panel-pad lineup-projection-card">
                  <div className="lineup-card-title">Projected Singles</div>
                  {suggestedLineup.singles.length ? (
                    suggestedLineup.singles.map((player, index) => (
                      <div key={player.id} className="lineup-line-item">
                        <div className="lineup-line-main">
                          <strong>S{index + 1}:</strong> {player.name}
                        </div>
                        <div className="lineup-line-meta">
                          Singles DR: {formatRating(player.singlesDynamic)} ·{' '}
                          {getAvailabilityLabel(player.availabilityStatus)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="lineup-empty-mini">Not enough eligible singles players.</div>
                  )}
                </div>

                <div className="surface-card panel-pad lineup-projection-card">
                  <div className="lineup-card-title">Projected Doubles</div>
                  {suggestedLineup.doubles.length ? (
                    suggestedLineup.doubles.map((pair, index) => (
                      <div
                        key={`${pair.player1.id}-${pair.player2.id}`}
                        className="lineup-line-item"
                      >
                        <div className="lineup-line-main">
                          <strong>D{index + 1}:</strong> {pair.player1.name} / {pair.player2.name}
                        </div>
                        <div className="lineup-line-meta">
                          Pair DR: {pair.combinedDoubles.toFixed(2)}
                        </div>
                        {pair.notes.length ? (
                          <div className="lineup-line-note">{pair.notes.join(' · ')}</div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="lineup-empty-mini">Not enough eligible doubles players.</div>
                  )}
                </div>
              </div>

              {suggestedLineup.notes.length ? (
                <div className="surface-card-strong panel-pad lineup-notes-card">
                  <div className="lineup-notes-title">Captain Suggestions</div>
                  <div className="lineup-notes-list">
                    {suggestedLineup.notes.map((note) => (
                      <div key={note} className="lineup-note-row">
                        • {note}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="lineup-block">
              <div className="lineup-section-head">
                <div>
                  <div className="section-kicker">Roster Pool</div>
                  <h2 className="lineup-section-title">Available team pool</h2>
                  <div className="lineup-section-sub">
                    Current roster after applying match-date availability.
                  </div>
                </div>
              </div>

              <div className="card-grid lineup-roster-grid">
                {roster.map((player) => (
                  <div key={player.id} className="surface-card panel-pad lineup-player-card">
                    <div className="lineup-player-name">{player.name}</div>
                    <div className="lineup-player-meta">
                      {player.appearances} appearances · Flight {safeText(player.flight)}
                    </div>

                    <div className="lineup-status-row">
                      <span
                        className={`lineup-status-badge ${
                          player.availabilityStatus === 'unavailable'
                            ? 'is-unavailable'
                            : player.availabilityStatus === 'limited'
                              ? 'is-limited'
                              : player.availabilityStatus === 'singles_only'
                                ? 'is-singles-only'
                                : player.availabilityStatus === 'doubles_only'
                                  ? 'is-doubles-only'
                                  : 'is-available'
                        }`}
                      >
                        {getAvailabilityLabel(player.availabilityStatus)}
                      </span>

                      {player.preferredRole ? (
                        <span className="lineup-role-badge">Prefers {player.preferredRole}</span>
                      ) : null}
                    </div>

                    <div className="lineup-mini-grid">
                      <MiniStat label="Overall" value={formatRating(player.overallDynamic)} />
                      <MiniStat label="Singles" value={formatRating(player.singlesDynamic)} />
                      <MiniStat label="Doubles" value={formatRating(player.doublesDynamic)} />
                    </div>

                    {player.availabilityNotes ? (
                      <div className="lineup-note-box">
                        <strong>Availability:</strong> {player.availabilityNotes}
                      </div>
                    ) : null}

                    {player.lineupNotes ? (
                      <div className="lineup-note-box">
                        <strong>Captain note:</strong> {player.lineupNotes}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="lineup-block">
              <div className="lineup-section-head">
                <div>
                  <div className="section-kicker">Singles Depth</div>
                  <h2 className="lineup-section-title">Top singles options</h2>
                  <div className="lineup-section-sub">
                    Ranked by singles dynamic rating, adjusted for availability and role preference.
                  </div>
                </div>
              </div>

              <div className="surface-card lineup-list-card">
                {singlesProjection.map((player, index) => (
                  <div key={player.id} className="lineup-list-row">
                    <div className="lineup-list-main">
                      <strong>{index + 1}.</strong> {player.name}
                    </div>
                    <div className="lineup-list-meta">
                      Singles DR: {formatRating(player.singlesDynamic)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="lineup-block">
              <div className="lineup-section-head">
                <div>
                  <div className="section-kicker">Doubles Depth</div>
                  <h2 className="lineup-section-title">Top doubles pairings</h2>
                  <div className="lineup-section-sub">
                    Ranked by average doubles dynamic rating, adjusted for availability and role preference.
                  </div>
                </div>
              </div>

              <div className="surface-card lineup-list-card">
                {doublesPairs.map((pair, index) => (
                  <div key={`${pair.player1.id}-${pair.player2.id}`} className="lineup-list-row">
                    <div className="lineup-list-main">
                      <strong>{index + 1}.</strong> {pair.player1.name} / {pair.player2.name}
                      {pair.notes.length ? (
                        <div className="lineup-pair-note-inline">{pair.notes.join(' · ')}</div>
                      ) : null}
                    </div>
                    <div className="lineup-list-meta">
                      Pair DR: {pair.combinedDoubles.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </section>

      <style jsx>{`
        .lineup-page {
          padding-top: 1.25rem;
          padding-bottom: 2.5rem;
        }

        .lineup-top-links {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .lineup-hero-panel {
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .lineup-hero-inner {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(280px, 360px);
          gap: 1rem;
          align-items: stretch;
        }

        .lineup-hero-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.85rem;
        }

        .lineup-kicker {
          color: rgba(217, 231, 255, 0.82);
        }

        .lineup-title {
          margin: 0;
          color: #ffffff;
          font-size: clamp(2rem, 4vw, 3.2rem);
          line-height: 1;
          letter-spacing: -0.04em;
          font-weight: 900;
        }

        .lineup-subtitle {
          margin: 0;
          max-width: 52rem;
          color: rgba(219, 234, 254, 0.9);
          font-size: 1rem;
          line-height: 1.7;
          font-weight: 500;
        }

        .lineup-hero-badges {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin-top: 0.15rem;
        }

        .lineup-hero-side {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.65rem;
        }

        .lineup-side-label {
          color: rgba(217, 231, 255, 0.82);
          font-size: 0.8rem;
          font-weight: 700;
          line-height: 1.5;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .lineup-side-value {
          color: #ffffff;
          font-size: 1.85rem;
          line-height: 1.05;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .lineup-side-text {
          color: rgba(219, 234, 254, 0.88);
          font-size: 0.95rem;
          line-height: 1.65;
          font-weight: 500;
        }

        .lineup-controls-card {
          min-width: 0;
        }

        .lineup-controls-head {
          margin-bottom: 1rem;
        }

        .lineup-section-title {
          margin: 0.25rem 0 0;
          color: #0f172a;
          font-size: 1.35rem;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .lineup-filter-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .lineup-state-box {
          margin-top: 1rem;
          border-radius: 1rem;
          padding: 1rem 1.05rem;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          color: #475569;
          font-size: 0.96rem;
          line-height: 1.6;
          font-weight: 600;
          text-align: center;
        }

        .lineup-error-box {
          margin-top: 1rem;
          border-radius: 1rem;
          padding: 1rem 1.05rem;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.18);
          color: #991b1b;
          font-size: 0.96rem;
          line-height: 1.6;
          font-weight: 700;
        }

        .lineup-summary-row {
          margin-top: 1rem;
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .lineup-block {
          margin-top: 1.5rem;
        }

        .lineup-section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .lineup-section-sub {
          margin-top: 0.45rem;
          color: #64748b;
          font-size: 0.94rem;
          line-height: 1.6;
          font-weight: 500;
        }

        .lineup-projection-grid {
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1rem;
        }

        .lineup-projection-card {
          min-width: 0;
        }

        .lineup-card-title {
          color: #0f172a;
          font-size: 1.15rem;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -0.02em;
          margin-bottom: 0.85rem;
        }

        .lineup-line-item {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 1rem;
          padding: 0.9rem 0.95rem;
        }

        .lineup-line-item + .lineup-line-item {
          margin-top: 0.75rem;
        }

        .lineup-line-main {
          color: #0f172a;
          font-size: 0.96rem;
          line-height: 1.55;
          font-weight: 700;
        }

        .lineup-line-meta {
          color: #64748b;
          font-size: 0.82rem;
          line-height: 1.55;
          margin-top: 0.25rem;
          font-weight: 600;
        }

        .lineup-line-note {
          color: #92400e;
          font-size: 0.78rem;
          line-height: 1.5;
          margin-top: 0.35rem;
          font-weight: 800;
        }

        .lineup-empty-mini {
          color: #64748b;
          font-size: 0.94rem;
          line-height: 1.6;
          font-weight: 600;
        }

        .lineup-notes-card {
          margin-top: 1rem;
        }

        .lineup-notes-title {
          color: #ffffff;
          font-size: 1rem;
          font-weight: 800;
          margin-bottom: 0.55rem;
        }

        .lineup-notes-list {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .lineup-note-row {
          color: rgba(231, 240, 255, 0.9);
          font-size: 0.92rem;
          line-height: 1.6;
          font-weight: 600;
        }

        .lineup-roster-grid {
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1rem;
        }

        .lineup-player-card {
          min-width: 0;
        }

        .lineup-player-name {
          color: #0f172a;
          font-size: 1.22rem;
          line-height: 1.2;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .lineup-player-meta {
          color: #64748b;
          font-size: 0.92rem;
          line-height: 1.6;
          margin-top: 0.35rem;
          margin-bottom: 0.9rem;
          font-weight: 500;
        }

        .lineup-status-row {
          display: flex;
          gap: 0.55rem;
          flex-wrap: wrap;
          margin-bottom: 0.9rem;
        }

        .lineup-status-badge,
        .lineup-role-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.42rem 0.7rem;
          border-radius: 999px;
          font-size: 0.74rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 0.02em;
        }

        .lineup-status-badge.is-available {
          background: rgba(34, 197, 94, 0.12);
          color: #166534;
        }

        .lineup-status-badge.is-unavailable {
          background: rgba(239, 68, 68, 0.12);
          color: #991b1b;
        }

        .lineup-status-badge.is-singles-only {
          background: rgba(37, 99, 235, 0.12);
          color: #1d4ed8;
        }

        .lineup-status-badge.is-doubles-only {
          background: rgba(109, 40, 217, 0.12);
          color: #6d28d9;
        }

        .lineup-status-badge.is-limited {
          background: rgba(245, 158, 11, 0.14);
          color: #92400e;
        }

        .lineup-role-badge {
          background: #f1f5f9;
          color: #334155;
        }

        .lineup-mini-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .lineup-note-box {
          margin-top: 0.75rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 0.9rem;
          padding: 0.75rem 0.8rem;
          color: #475569;
          font-size: 0.84rem;
          line-height: 1.55;
          font-weight: 500;
        }

        .lineup-list-card {
          overflow: hidden;
          padding: 0;
        }

        .lineup-list-row {
          display: flex;
          justify-content: space-between;
          gap: 0.85rem;
          align-items: center;
          padding: 0.95rem 1rem;
          border-bottom: 1px solid #e2e8f0;
        }

        .lineup-list-row:last-child {
          border-bottom: 0;
        }

        .lineup-list-main {
          color: #0f172a;
          font-size: 0.96rem;
          line-height: 1.55;
          font-weight: 700;
        }

        .lineup-list-meta {
          color: #255be3;
          font-size: 0.88rem;
          line-height: 1.3;
          font-weight: 800;
          white-space: nowrap;
        }

        .lineup-pair-note-inline {
          color: #92400e;
          font-size: 0.78rem;
          line-height: 1.45;
          margin-top: 0.28rem;
          font-weight: 800;
        }

        @media (max-width: 980px) {
          .lineup-hero-inner {
            grid-template-columns: 1fr;
          }

          .lineup-filter-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .lineup-mini-grid {
            grid-template-columns: 1fr;
          }

          .lineup-list-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .lineup-list-meta {
            white-space: normal;
          }
        }
      `}</style>
    </main>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card lineup-mini-stat">
      <div className="lineup-mini-stat-label">{label}</div>
      <div className="lineup-mini-stat-value">{value}</div>

      <style jsx>{`
        .lineup-mini-stat {
          padding: 0.8rem 0.85rem;
          min-width: 0;
        }

        .lineup-mini-stat-label {
          color: #64748b;
          font-size: 0.76rem;
          margin-bottom: 0.25rem;
          font-weight: 700;
        }

        .lineup-mini-stat-value {
          color: #0f172a;
          font-weight: 800;
          font-size: 0.98rem;
          line-height: 1.2;
        }
      `}</style>
    </div>
  )
}

function SummaryBadge({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'green' | 'red' | 'blue' | 'purple' | 'amber'
}) {
  return (
    <span className={`lineup-summary-badge is-${tone}`}>
      {label}: {value}

      <style jsx>{`
        .lineup-summary-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.55rem 0.8rem;
          border-radius: 999px;
          font-size: 0.78rem;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 0.02em;
          border: 1px solid transparent;
        }

        .lineup-summary-badge.is-green {
          background: rgba(34, 197, 94, 0.12);
          color: #166534;
          border-color: rgba(34, 197, 94, 0.18);
        }

        .lineup-summary-badge.is-red {
          background: rgba(239, 68, 68, 0.12);
          color: #991b1b;
          border-color: rgba(239, 68, 68, 0.18);
        }

        .lineup-summary-badge.is-blue {
          background: rgba(37, 99, 235, 0.12);
          color: #1d4ed8;
          border-color: rgba(37, 99, 235, 0.18);
        }

        .lineup-summary-badge.is-purple {
          background: rgba(109, 40, 217, 0.12);
          color: #6d28d9;
          border-color: rgba(109, 40, 217, 0.18);
        }

        .lineup-summary-badge.is-amber {
          background: rgba(245, 158, 11, 0.14);
          color: #92400e;
          border-color: rgba(245, 158, 11, 0.18);
        }
      `}</style>
    </span>
  )
}