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
}

type PlayerRelation =
  | {
      id: string
      name: string
      flight: string | null
      overall_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
    }
  | {
      id: string
      name: string
      flight: string | null
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
  appearances: number
  singlesDynamic: number | null
  doublesDynamic: number | null
  overallDynamic: number | null
}

type LeagueOption = {
  leagueName: string
  flight: string
}

type DoublesPair = {
  player1: RosterPlayer
  player2: RosterPlayer
  combinedDoubles: number
}

function safeText(value: string | null | undefined, fallback = 'Unknown') {
  const text = (value || '').trim()
  return text || fallback
}

function formatRating(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return value.toFixed(2)
}

function normalizePlayerRelation(player: PlayerRelation) {
  if (!player) return null
  return Array.isArray(player) ? player[0] ?? null : player
}

function buildLeagueKey(leagueName: string, flight: string) {
  return `${leagueName}___${flight}`
}

export default function LineupProjectionPage() {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedLeagueKey, setSelectedLeagueKey] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')

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
  }, [selectedLeagueKey, selectedTeam])

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
          away_team
        `)
        .order('league_name', { ascending: true })

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
          away_team
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
            appearances: 0,
            singlesDynamic: player.singles_dynamic_rating,
            doublesDynamic: player.doubles_dynamic_rating,
            overallDynamic: player.overall_dynamic_rating,
          })
        }

        rosterMap.get(player.id)!.appearances += 1
      }

      const rosterList = [...rosterMap.values()].sort((a, b) => {
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

  const singlesProjection = useMemo(() => {
    return [...roster]
      .sort((a, b) => {
        const aValue = typeof a.singlesDynamic === 'number' ? a.singlesDynamic : -999
        const bValue = typeof b.singlesDynamic === 'number' ? b.singlesDynamic : -999
        if (bValue !== aValue) return bValue - aValue
        return b.appearances - a.appearances
      })
      .slice(0, 6)
  }, [roster])

  const doublesPairs = useMemo<DoublesPair[]>(() => {
    const players = [...roster]
      .filter((player) => typeof player.doublesDynamic === 'number')
      .sort((a, b) => {
        const aValue = typeof a.doublesDynamic === 'number' ? a.doublesDynamic : -999
        const bValue = typeof b.doublesDynamic === 'number' ? b.doublesDynamic : -999
        if (bValue !== aValue) return bValue - aValue
        return b.appearances - a.appearances
      })

    const pairs: DoublesPair[] = []

    for (let i = 0; i < players.length; i += 1) {
      for (let j = i + 1; j < players.length; j += 1) {
        const player1 = players[i]
        const player2 = players[j]
        const combinedDoubles =
          ((player1.doublesDynamic || 0) + (player2.doublesDynamic || 0)) / 2

        pairs.push({
          player1,
          player2,
          combinedDoubles,
        })
      }
    }

    return pairs
      .sort((a, b) => b.combinedDoubles - a.combinedDoubles)
      .slice(0, 8)
  }, [roster])

  const suggestedLineup = useMemo(() => {
    const topSingles = singlesProjection.slice(0, 2)

    const usedIds = new Set<string>()
    const topPairs: DoublesPair[] = []

    for (const pair of doublesPairs) {
      if (usedIds.has(pair.player1.id) || usedIds.has(pair.player2.id)) continue

      topPairs.push(pair)
      usedIds.add(pair.player1.id)
      usedIds.add(pair.player2.id)

      if (topPairs.length === 3) break
    }

    return {
      singles: topSingles,
      doubles: topPairs,
    }
  }, [singlesProjection, doublesPairs])

  const selectedLeagueLabel = useMemo(() => {
    if (!selectedLeagueKey) return ''
    const [leagueName, flight] = selectedLeagueKey.split('___')
    return `${leagueName} · ${flight}`
  }, [selectedLeagueKey])

  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
        <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
        <Link href="/leagues" style={navLinkStyle}>Leagues</Link>
        <Link href="/lineup-projection" style={navLinkStyle}>Lineup Projection</Link>
        <Link href="/admin" style={navLinkStyle}>Admin</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>Lineup Projection</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          Pick a league and team to project likely singles and doubles lines from imported roster usage
          and dynamic ratings.
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
              onChange={(e) => setSelectedTeam(e.target.value)}
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
              <div style={summaryPillStyle}>
                <strong>{roster.length}</strong> players
              </div>
            </div>

            <div style={sectionBlockStyle}>
              <h2 style={sectionTitleStyle}>Suggested Lineup</h2>
              <div style={sectionSubStyle}>
                Best current estimate using dynamic ratings and roster appearances.
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
                          Singles DR: {formatRating(player.singlesDynamic)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={emptyMiniStyle}>Not enough singles data.</div>
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
                      </div>
                    ))
                  ) : (
                    <div style={emptyMiniStyle}>Not enough doubles data.</div>
                  )}
                </div>
              </div>
            </div>
                        <div style={sectionBlockStyle}>
              <h2 style={sectionTitleStyle}>Roster Pool</h2>
              <div style={sectionSubStyle}>
                Available players seen for this team in imported matches.
              </div>

              <div style={rosterGridStyle}>
                {roster.map((player) => (
                  <div key={player.id} style={playerCardStyle}>
                    <div style={playerNameStyle}>{player.name}</div>
                    <div style={playerMetaStyle}>
                      {player.appearances} appearances · Flight {safeText(player.flight)}
                    </div>

                    <div style={miniStatsGridStyle}>
                      <MiniStat label="Overall" value={formatRating(player.overallDynamic)} />
                      <MiniStat label="Singles" value={formatRating(player.singlesDynamic)} />
                      <MiniStat label="Doubles" value={formatRating(player.doublesDynamic)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={sectionBlockStyle}>
              <h2 style={sectionTitleStyle}>Top Singles Options</h2>
              <div style={sectionSubStyle}>
                Ranked by singles dynamic rating.
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
                Ranked by average doubles dynamic rating.
              </div>

              <div style={listCardStyle}>
                {doublesPairs.map((pair, index) => (
                  <div key={`${pair.player1.id}-${pair.player2.id}`} style={listRowStyle}>
                    <div>
                      <strong>{index + 1}.</strong> {pair.player1.name} / {pair.player2.name}
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