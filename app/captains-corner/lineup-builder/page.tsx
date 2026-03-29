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

type LineStrength = {
  singlesScore: number | null
  doublesScore: number | null
  overall: number | null
}

type LineWin = {
  line: string
  myLabel: string
  oppLabel: string
  probability: number | null
  favored: string
  ratingSource: 'singles' | 'doubles'
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

const RATING_DIVISOR = 0.35

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

function formatPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
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

function expectedScore(a: number, b: number) {
  return 1 / (1 + Math.pow(10, (b - a) / RATING_DIVISOR))
}

function canPlaySingles(player: RosterPlayer) {
  return player.availabilityStatus !== 'unavailable' && player.availabilityStatus !== 'doubles_only'
}

function canPlayDoubles(player: RosterPlayer) {
  return player.availabilityStatus !== 'unavailable' && player.availabilityStatus !== 'singles_only'
}

function adjustedSinglesScore(player: RosterPlayer) {
  const base = typeof player.singlesDynamic === 'number' ? player.singlesDynamic : -999
  const preferredBoost =
    player.preferredRole === 'singles' ? 0.03 : player.preferredRole === 'doubles' ? -0.03 : 0
  const limitedPenalty = player.availabilityStatus === 'limited' ? 0.03 : 0
  return base + preferredBoost - limitedPenalty
}

function adjustedDoublesScore(player: RosterPlayer) {
  const base = typeof player.doublesDynamic === 'number' ? player.doublesDynamic : -999
  const preferredBoost =
    player.preferredRole === 'doubles' ? 0.03 : player.preferredRole === 'singles' ? -0.03 : 0
  const limitedPenalty = player.availabilityStatus === 'limited' ? 0.03 : 0
  return base + preferredBoost - limitedPenalty
}

function calcStrength(slots: BuilderSlots, playersById: Map<string, RosterPlayer>): LineStrength {
  const singlesPlayers = [slots.s1, slots.s2]
    .map((id) => playersById.get(id))
    .filter(Boolean) as RosterPlayer[]

  const doublesTeams = [
    [slots.d1p1, slots.d1p2],
    [slots.d2p1, slots.d2p2],
    [slots.d3p1, slots.d3p2],
  ]
    .map(([a, b]) => [playersById.get(a), playersById.get(b)].filter(Boolean) as RosterPlayer[])
    .filter((pair) => pair.length === 2)

  const singlesScore =
    singlesPlayers.length > 0
      ? singlesPlayers.reduce((sum, player) => sum + (player.singlesDynamic || 0), 0) /
        singlesPlayers.length
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
}

function buildSuggested(roster: RosterPlayer[]): BuilderSlots {
  const singlesPool = [...roster]
    .filter(canPlaySingles)
    .sort((a, b) => {
      const aValue = adjustedSinglesScore(a)
      const bValue = adjustedSinglesScore(b)
      if (bValue !== aValue) return bValue - aValue
      return b.appearances - a.appearances
    })

  const s1 = singlesPool[0]?.id || ''
  const s2 = singlesPool[1]?.id || ''

  const used = new Set([s1, s2].filter(Boolean))

  const doublesPool = [...roster]
    .filter(canPlayDoubles)
    .filter((player) => !used.has(player.id))
    .sort((a, b) => {
      const aValue = adjustedDoublesScore(a)
      const bValue = adjustedDoublesScore(b)
      if (bValue !== aValue) return bValue - aValue
      return b.appearances - a.appearances
    })

  return {
    s1,
    s2,
    d1p1: doublesPool[0]?.id || '',
    d1p2: doublesPool[1]?.id || '',
    d2p1: doublesPool[2]?.id || '',
    d2p2: doublesPool[3]?.id || '',
    d3p1: doublesPool[4]?.id || '',
    d3p2: doublesPool[5]?.id || '',
  }
}

function getSlotsSelectedIds(slots: BuilderSlots) {
  return Object.values(slots).filter(Boolean)
}
function buildWarnings(
  slots: BuilderSlots,
  playersById: Map<string, RosterPlayer>,
  sideLabel: string
) {
  const items: string[] = []
  const ids = getSlotsSelectedIds(slots)
  const counts = new Map<string, number>()

  for (const id of ids) {
    counts.set(id, (counts.get(id) || 0) + 1)
  }

  if ([...counts.values()].some((count) => count > 1)) {
    items.push(`${sideLabel}: A player is assigned more than once.`)
  }

  const checkSingles = (playerId: string, line: string) => {
    const player = playersById.get(playerId)
    if (!player) return
    if (player.availabilityStatus === 'unavailable') {
      items.push(`${sideLabel} ${line}: ${player.name} is unavailable.`)
    }
    if (player.availabilityStatus === 'doubles_only') {
      items.push(`${sideLabel} ${line}: ${player.name} is doubles only.`)
    }
    if (player.availabilityStatus === 'limited') {
      items.push(`${sideLabel} ${line}: ${player.name} is limited.`)
    }
    if (player.preferredRole === 'doubles') {
      items.push(`${sideLabel} ${line}: ${player.name} prefers doubles.`)
    }
  }

  const checkDoubles = (playerId: string, line: string) => {
    const player = playersById.get(playerId)
    if (!player) return
    if (player.availabilityStatus === 'unavailable') {
      items.push(`${sideLabel} ${line}: ${player.name} is unavailable.`)
    }
    if (player.availabilityStatus === 'singles_only') {
      items.push(`${sideLabel} ${line}: ${player.name} is singles only.`)
    }
    if (player.availabilityStatus === 'limited') {
      items.push(`${sideLabel} ${line}: ${player.name} is limited.`)
    }
    if (player.preferredRole === 'singles') {
      items.push(`${sideLabel} ${line}: ${player.name} prefers singles.`)
    }
  }

  checkSingles(slots.s1, 'S1')
  checkSingles(slots.s2, 'S2')

  checkDoubles(slots.d1p1, 'D1')
  checkDoubles(slots.d1p2, 'D1')
  checkDoubles(slots.d2p1, 'D2')
  checkDoubles(slots.d2p2, 'D2')
  checkDoubles(slots.d3p1, 'D3')
  checkDoubles(slots.d3p2, 'D3')

  return items
}

function buildLineWinProbabilities(
  mySlots: BuilderSlots,
  oppSlots: BuilderSlots,
  myPlayersById: Map<string, RosterPlayer>,
  oppPlayersById: Map<string, RosterPlayer>,
  myTeam: string,
  oppTeam: string
): LineWin[] {
  const result: LineWin[] = []

  const singlesLines: Array<[keyof BuilderSlots, keyof BuilderSlots, string]> = [
    ['s1', 's1', 'S1'],
    ['s2', 's2', 'S2'],
  ]

  for (const [myKey, oppKey, line] of singlesLines) {
    const myPlayer = myPlayersById.get(mySlots[myKey])
    const oppPlayer = oppPlayersById.get(oppSlots[oppKey])

    if (!myPlayer || !oppPlayer) {
      result.push({
        line,
        myLabel: myPlayer?.name || 'Open',
        oppLabel: oppPlayer?.name || 'Open',
        probability: null,
        favored: 'Incomplete',
        ratingSource: 'singles',
      })
      continue
    }

    const myRating = myPlayer.singlesDynamic || 0
    const oppRating = oppPlayer.singlesDynamic || 0
    const probability = expectedScore(myRating, oppRating)

    result.push({
      line,
      myLabel: myPlayer.name,
      oppLabel: oppPlayer.name,
      probability,
      favored: probability >= 0.5 ? myTeam : oppTeam,
      ratingSource: 'singles',
    })
  }

  const doublesLines: Array<
    [keyof BuilderSlots, keyof BuilderSlots, keyof BuilderSlots, keyof BuilderSlots, string]
  > = [
    ['d1p1', 'd1p2', 'd1p1', 'd1p2', 'D1'],
    ['d2p1', 'd2p2', 'd2p1', 'd2p2', 'D2'],
    ['d3p1', 'd3p2', 'd3p1', 'd3p2', 'D3'],
  ]

  for (const [a1, a2, b1, b2, line] of doublesLines) {
    const myP1 = myPlayersById.get(mySlots[a1])
    const myP2 = myPlayersById.get(mySlots[a2])
    const oppP1 = oppPlayersById.get(oppSlots[b1])
    const oppP2 = oppPlayersById.get(oppSlots[b2])

    if (!myP1 || !myP2 || !oppP1 || !oppP2) {
      result.push({
        line,
        myLabel: myP1 && myP2 ? `${myP1.name} / ${myP2.name}` : 'Open',
        oppLabel: oppP1 && oppP2 ? `${oppP1.name} / ${oppP2.name}` : 'Open',
        probability: null,
        favored: 'Incomplete',
        ratingSource: 'doubles',
      })
      continue
    }

    const myRating = ((myP1.doublesDynamic || 0) + (myP2.doublesDynamic || 0)) / 2
    const oppRating = ((oppP1.doublesDynamic || 0) + (oppP2.doublesDynamic || 0)) / 2
    const probability = expectedScore(myRating, oppRating)

    result.push({
      line,
      myLabel: `${myP1.name} / ${myP2.name}`,
      oppLabel: `${oppP1.name} / ${oppP2.name}`,
      probability,
      favored: probability >= 0.5 ? myTeam : oppTeam,
      ratingSource: 'doubles',
    })
  }

  return result
}

async function loadRosterForTeam(
  leagueKey: string,
  teamName: string,
  selectedDate: string
): Promise<RosterPlayer[]> {
  const [leagueName, flight] = leagueKey.split('___')

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
    .or(`home_team.eq.${teamName},away_team.eq.${teamName}`)

  if (teamMatchesError) throw new Error(teamMatchesError.message)

  const typedTeamMatches = (teamMatchesData || []) as MatchRow[]
  const matchIds = typedTeamMatches.map((match) => match.id)

  if (!matchIds.length) return []

  const sideByMatchId = new Map<string, 'A' | 'B'>()

  for (const match of typedTeamMatches) {
    if (safeText(match.home_team) === teamName) sideByMatchId.set(match.id, 'A')
    if (safeText(match.away_team) === teamName) sideByMatchId.set(match.id, 'B')
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
      .eq('team_name', teamName)

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

  return rosterList
}

export default function LineupBuilderPage() {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedLeagueKey, setSelectedLeagueKey] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedOpponent, setSelectedOpponent] = useState('')
  const [selectedDate, setSelectedDate] = useState('')

  const [rosterLoading, setRosterLoading] = useState(false)

  const [myRoster, setMyRoster] = useState<RosterPlayer[]>([])
  const [oppRoster, setOppRoster] = useState<RosterPlayer[]>([])

  const [mySlots, setMySlots] = useState<BuilderSlots>(EMPTY_SLOTS)
  const [oppSlots, setOppSlots] = useState<BuilderSlots>(EMPTY_SLOTS)

  useEffect(() => {
    void loadMatches()
  }, [])

  useEffect(() => {
    if (!selectedLeagueKey || !selectedTeam) {
      setMyRoster([])
      setMySlots(EMPTY_SLOTS)
      return
    }
    void loadMyRoster()
  }, [selectedLeagueKey, selectedTeam, selectedDate])

  useEffect(() => {
    if (!selectedLeagueKey || !selectedOpponent) {
      setOppRoster([])
      setOppSlots(EMPTY_SLOTS)
      return
    }
    void loadOpponentRoster()
  }, [selectedLeagueKey, selectedOpponent, selectedDate])

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

  async function loadMyRoster() {
    setRosterLoading(true)
    setError('')

    try {
      const roster = await loadRosterForTeam(selectedLeagueKey, selectedTeam, selectedDate)
      setMyRoster(roster)
      setMySlots(EMPTY_SLOTS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team roster.')
    } finally {
      setRosterLoading(false)
    }
  }

  async function loadOpponentRoster() {
    setRosterLoading(true)
    setError('')

    try {
      const roster = await loadRosterForTeam(selectedLeagueKey, selectedOpponent, selectedDate)
      setOppRoster(roster)
      setOppSlots(EMPTY_SLOTS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load opponent roster.')
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

  const opponentTeams = useMemo(() => {
    return teamsForLeague.filter((team) => team !== selectedTeam)
  }, [teamsForLeague, selectedTeam])

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

  const myPlayersById = useMemo(() => {
    const map = new Map<string, RosterPlayer>()
    for (const player of myRoster) map.set(player.id, player)
    return map
  }, [myRoster])

  const oppPlayersById = useMemo(() => {
    const map = new Map<string, RosterPlayer>()
    for (const player of oppRoster) map.set(player.id, player)
    return map
  }, [oppRoster])

  const suggestedMySlots = useMemo(() => buildSuggested(myRoster), [myRoster])
  const suggestedOppSlots = useMemo(() => buildSuggested(oppRoster), [oppRoster])

  const myStrength = useMemo(() => calcStrength(mySlots, myPlayersById), [mySlots, myPlayersById])
  const oppStrength = useMemo(() => calcStrength(oppSlots, oppPlayersById), [oppSlots, oppPlayersById])

  const suggestedMyStrength = useMemo(
    () => calcStrength(suggestedMySlots, myPlayersById),
    [suggestedMySlots, myPlayersById]
  )
  const suggestedOppStrength = useMemo(
    () => calcStrength(suggestedOppSlots, oppPlayersById),
    [suggestedOppSlots, oppPlayersById]
  )

  const myWarnings = useMemo(
    () => buildWarnings(mySlots, myPlayersById, selectedTeam || 'Your Team'),
    [mySlots, myPlayersById, selectedTeam]
  )

  const oppWarnings = useMemo(
    () => buildWarnings(oppSlots, oppPlayersById, selectedOpponent || 'Opponent'),
    [oppSlots, oppPlayersById, selectedOpponent]
  )

  const lineWinProbabilities = useMemo(() => {
    if (!selectedTeam || !selectedOpponent) return []
    return buildLineWinProbabilities(
      mySlots,
      oppSlots,
      myPlayersById,
      oppPlayersById,
      selectedTeam,
      selectedOpponent
    )
  }, [mySlots, oppSlots, myPlayersById, oppPlayersById, selectedTeam, selectedOpponent])

  const projectedTeamWins = useMemo(() => {
    const values = lineWinProbabilities
      .map((line) => line.probability)
      .filter((value): value is number => typeof value === 'number')

    if (!values.length) return null
    return values.reduce((sum, value) => sum + value, 0)
  }, [lineWinProbabilities])

  const projectedOpponentWins = useMemo(() => {
    if (projectedTeamWins === null) return null
    return 5 - projectedTeamWins
  }, [projectedTeamWins])

  function updateMySlot(slot: keyof BuilderSlots, value: string) {
    setMySlots((prev) => ({ ...prev, [slot]: value }))
  }

  function updateOppSlot(slot: keyof BuilderSlots, value: string) {
    setOppSlots((prev) => ({ ...prev, [slot]: value }))
  }

  function filteredMyOptions(slot: keyof BuilderSlots) {
    const otherSelected = new Set(
      Object.entries(mySlots)
        .filter(([key, value]) => key !== slot && Boolean(value))
        .map(([, value]) => value)
    )

    return myRoster.filter((player) => !otherSelected.has(player.id))
  }

  function filteredOppOptions(slot: keyof BuilderSlots) {
    const otherSelected = new Set(
      Object.entries(oppSlots)
        .filter(([key, value]) => key !== slot && Boolean(value))
        .map(([, value]) => value)
    )

    return oppRoster.filter((player) => !otherSelected.has(player.id))
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
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '820px' }}>
          Build your lineup, enter an opponent lineup, and compare projected line-by-line win probabilities.
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
                setSelectedOpponent('')
                setSelectedDate('')
                setMyRoster([])
                setOppRoster([])
                setMySlots(EMPTY_SLOTS)
                setOppSlots(EMPTY_SLOTS)
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
            <label style={labelStyle}>Your Team</label>
            <select
              value={selectedTeam}
              onChange={(e) => {
                setSelectedTeam(e.target.value)
                setSelectedOpponent('')
                setSelectedDate('')
                setMyRoster([])
                setOppRoster([])
                setMySlots(EMPTY_SLOTS)
                setOppSlots(EMPTY_SLOTS)
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
            <label style={labelStyle}>Opponent Team</label>
            <select
              value={selectedOpponent}
              onChange={(e) => {
                setSelectedOpponent(e.target.value)
                setOppRoster([])
                setOppSlots(EMPTY_SLOTS)
              }}
              style={inputStyle}
              disabled={!selectedTeam}
            >
              <option value="">Select opponent</option>
              {opponentTeams.map((team) => (
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
          <div style={emptyStateStyle}>Choose a league and your team to begin.</div>
        ) : rosterLoading ? (
          <div style={emptyStateStyle}>Loading rosters...</div>
        ) : (
          <>
            <div style={summaryPillRowStyle}>
              <div style={summaryPillStyle}><strong>{selectedTeam || 'Your Team'}</strong></div>
              {selectedOpponent ? (
                <div style={summaryPillStyle}><strong>{selectedOpponent}</strong></div>
              ) : null}
              {selectedDate ? (
                <div style={summaryPillStyle}>Date: <strong>{formatDate(selectedDate)}</strong></div>
              ) : null}
            </div>

            <div style={builderGridStyle}>
              <div style={builderCardStyle}>
                <div style={builderHeaderStyle}>Your Lineup</div>
                <BuilderSelect label="S1" value={mySlots.s1} onChange={(v) => updateMySlot('s1', v)} players={filteredMyOptions('s1')} />
                <BuilderSelect label="S2" value={mySlots.s2} onChange={(v) => updateMySlot('s2', v)} players={filteredMyOptions('s2')} />
                <BuilderSelect label="D1 Player 1" value={mySlots.d1p1} onChange={(v) => updateMySlot('d1p1', v)} players={filteredMyOptions('d1p1')} />
                <BuilderSelect label="D1 Player 2" value={mySlots.d1p2} onChange={(v) => updateMySlot('d1p2', v)} players={filteredMyOptions('d1p2')} />
                <BuilderSelect label="D2 Player 1" value={mySlots.d2p1} onChange={(v) => updateMySlot('d2p1', v)} players={filteredMyOptions('d2p1')} />
                <BuilderSelect label="D2 Player 2" value={mySlots.d2p2} onChange={(v) => updateMySlot('d2p2', v)} players={filteredMyOptions('d2p2')} />
                <BuilderSelect label="D3 Player 1" value={mySlots.d3p1} onChange={(v) => updateMySlot('d3p1', v)} players={filteredMyOptions('d3p1')} />
                <BuilderSelect label="D3 Player 2" value={mySlots.d3p2} onChange={(v) => updateMySlot('d3p2', v)} players={filteredMyOptions('d3p2')} />
              </div>

              <div style={builderCardStyle}>
                <div style={builderHeaderStyle}>Opponent Lineup</div>
                <BuilderSelect label="S1" value={oppSlots.s1} onChange={(v) => updateOppSlot('s1', v)} players={filteredOppOptions('s1')} />
                <BuilderSelect label="S2" value={oppSlots.s2} onChange={(v) => updateOppSlot('s2', v)} players={filteredOppOptions('s2')} />
                <BuilderSelect label="D1 Player 1" value={oppSlots.d1p1} onChange={(v) => updateOppSlot('d1p1', v)} players={filteredOppOptions('d1p1')} />
                <BuilderSelect label="D1 Player 2" value={oppSlots.d1p2} onChange={(v) => updateOppSlot('d1p2', v)} players={filteredOppOptions('d1p2')} />
                <BuilderSelect label="D2 Player 1" value={oppSlots.d2p1} onChange={(v) => updateOppSlot('d2p1', v)} players={filteredOppOptions('d2p1')} />
                <BuilderSelect label="D2 Player 2" value={oppSlots.d2p2} onChange={(v) => updateOppSlot('d2p2', v)} players={filteredOppOptions('d2p2')} />
                <BuilderSelect label="D3 Player 1" value={oppSlots.d3p1} onChange={(v) => updateOppSlot('d3p1', v)} players={filteredOppOptions('d3p1')} />
                <BuilderSelect label="D3 Player 2" value={oppSlots.d3p2} onChange={(v) => updateOppSlot('d3p2', v)} players={filteredOppOptions('d3p2')} />
              </div>
            </div>

            <div style={sectionBlockStyle}>
              <h2 style={sectionTitleStyle}>Lineup Strength</h2>
              <div style={comparisonGridStyle}>
                <StrengthCard label={`${selectedTeam || 'Your Team'} Overall`} value={formatRating(myStrength.overall)} />
                <StrengthCard label={`${selectedOpponent || 'Opponent'} Overall`} value={formatRating(oppStrength.overall)} />
                <StrengthCard
                  label="Suggested vs Suggested"
                  value={
                    suggestedMyStrength.overall !== null && suggestedOppStrength.overall !== null
                      ? `${formatRating(suggestedMyStrength.overall)} vs ${formatRating(suggestedOppStrength.overall)}`
                      : '—'
                  }
                />
              </div>
            </div>

            <div style={sectionBlockStyle}>
              <h2 style={sectionTitleStyle}>Projected Matchup</h2>
              <div style={sectionSubStyle}>
                Based on current manual line selections and dynamic ratings.
              </div>

              <div style={comparisonGridStyle}>
                <StrengthCard label={`${selectedTeam || 'Your Team'} Projected Wins`} value={projectedTeamWins === null ? '—' : projectedTeamWins.toFixed(2)} />
                <StrengthCard label={`${selectedOpponent || 'Opponent'} Projected Wins`} value={projectedOpponentWins === null ? '—' : projectedOpponentWins.toFixed(2)} />
              </div>

              <div style={listCardStyle}>
                {lineWinProbabilities.map((line) => (
                  <div key={line.line} style={listRowStyle}>
                    <div>
                      <strong>{line.line}</strong> · {line.myLabel} vs {line.oppLabel}
                      <div style={pairNotesInlineStyle}>
                        Source: {line.ratingSource}
                      </div>
                    </div>
                    <div style={listRowMetaStyle}>
                      {formatPercent(line.probability)} · Favored: {line.favored}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={sectionBlockStyle}>
              <h2 style={sectionTitleStyle}>Warnings</h2>
              {myWarnings.length || oppWarnings.length ? (
                <div style={warningBoxStyle}>
                  {[...myWarnings, ...oppWarnings].map((warning) => (
                    <div key={warning} style={warningItemStyle}>• {warning}</div>
                  ))}
                </div>
              ) : (
                <div style={successBoxStyle}>No major conflicts detected in either lineup.</div>
              )}
            </div>

            <div style={sectionBlockStyle}>
              <h2 style={sectionTitleStyle}>Suggested Reference Lineups</h2>
              <div style={builderGridStyle}>
                <SuggestedLineupCard
                  title={`${selectedTeam || 'Your Team'} Suggested`}
                  slots={suggestedMySlots}
                  playersById={myPlayersById}
                />
                <SuggestedLineupCard
                  title={`${selectedOpponent || 'Opponent'} Suggested`}
                  slots={suggestedOppSlots}
                  playersById={oppPlayersById}
                />
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

function SuggestedLineupCard({
  title,
  slots,
  playersById,
}: {
  title: string
  slots: BuilderSlots
  playersById: Map<string, RosterPlayer>
}) {
  const lookup = (id: string) => playersById.get(id)?.name || 'Open'

  return (
    <div style={builderCardStyle}>
      <div style={builderHeaderStyle}>{title}</div>
      <div style={suggestedRowStyle}><strong>S1:</strong> {lookup(slots.s1)}</div>
      <div style={suggestedRowStyle}><strong>S2:</strong> {lookup(slots.s2)}</div>
      <div style={suggestedRowStyle}><strong>D1:</strong> {lookup(slots.d1p1)} / {lookup(slots.d1p2)}</div>
      <div style={suggestedRowStyle}><strong>D2:</strong> {lookup(slots.d2p1)} / {lookup(slots.d2p2)}</div>
      <div style={suggestedRowStyle}><strong>D3:</strong> {lookup(slots.d3p1)} / {lookup(slots.d3p2)}</div>
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

const comparisonGridStyle = {
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
  fontSize: '26px',
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
  color: '#64748b',
  fontSize: '12px',
  marginTop: '4px',
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

const suggestedRowStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '12px',
  marginBottom: '10px',
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