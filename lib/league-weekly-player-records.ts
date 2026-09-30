export type LeagueWeeklyPlayerRecord = {
  leagueId: string
  playerName: string
  wins: number
  losses: number
  setsPlayed: number
  weeksPlayed: number
  leagueSetCount: number
  leaderName: string
  leaderWins: number
  leaderLosses: number
}

export type LeagueWeeklyRecordParticipant = {
  leagueId: string
  playerName: string
}

export type LeagueWeeklyRecordSession = {
  id: string
  league_id: string
  status: string
  play_on?: string
}

export type LeagueWeeklyRecordSetResult = {
  session_id: string
  side_a_players: string[] | null
  side_b_players: string[] | null
  side_a_games: number
  side_b_games: number
  review_status: string
  court_number?: number
  set_number?: number
}

export type LeagueWeeklyStanding = {
  rank: number
  playerName: string
  wins: number
  losses: number
  setsPlayed: number
  weeksPlayed: number
  gamesWon: number
  gamesLost: number
  gameDifferential: number
  winPercentage: number
}

export type LeagueWeeklyScorecardSet = {
  setNumber: number
  sideA: string[]
  sideB: string[]
  sideAGames: number
  sideBGames: number
}

export type LeagueWeeklyScorecardCourt = {
  courtNumber: number
  sets: LeagueWeeklyScorecardSet[]
}

export type LeagueWeeklyScorecardWeek = {
  sessionId: string
  playOn: string
  status: string
  acceptedSetCount: number
  courts: LeagueWeeklyScorecardCourt[]
}

export type LeagueWeeklyCompetitionView = {
  summary: { weeks: number; acceptedSets: number; players: number; totalGames: number }
  standings: LeagueWeeklyStanding[]
  weeks: LeagueWeeklyScorecardWeek[]
}

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

type Standing = { name: string; wins: number; losses: number; sessionIds: Set<string> }

function isAcceptedResult(result: LeagueWeeklyRecordSetResult, sessionsById: Map<string, LeagueWeeklyRecordSession>) {
  const session = sessionsById.get(result.session_id)
  if (!session || !['confirmed', 'approved'].includes(result.review_status)) return false
  if (!Number.isFinite(result.side_a_games) || !Number.isFinite(result.side_b_games) || result.side_a_games === result.side_b_games) return false
  const sideA = Array.isArray(result.side_a_players) ? result.side_a_players.filter((name) => normalize(name)) : []
  const sideB = Array.isArray(result.side_b_players) ? result.side_b_players.filter((name) => normalize(name)) : []
  return sideA.length > 0 && sideB.length > 0
}

export function buildLeagueWeeklyPlayerRecords(input: {
  participants: LeagueWeeklyRecordParticipant[]
  sessions: LeagueWeeklyRecordSession[]
  results: LeagueWeeklyRecordSetResult[]
}): LeagueWeeklyPlayerRecord[] {
  const sessionsById = new Map(
    input.sessions
      .filter((session) => ['published', 'completed'].includes(session.status))
      .map((session) => [session.id, session]),
  )
  const standingsByLeague = new Map<string, Map<string, Standing>>()
  const acceptedSetsByLeague = new Map<string, number>()

  for (const result of input.results) {
    const session = sessionsById.get(result.session_id)
    if (!session || !isAcceptedResult(result, sessionsById)) continue
    const sideA = Array.isArray(result.side_a_players) ? result.side_a_players.filter((name) => normalize(name)) : []
    const sideB = Array.isArray(result.side_b_players) ? result.side_b_players.filter((name) => normalize(name)) : []
    if (!sideA.length || !sideB.length) continue

    const winningSide = result.side_a_games > result.side_b_games ? sideA : sideB
    const losingSide = result.side_a_games > result.side_b_games ? sideB : sideA
    const leagueStandings = standingsByLeague.get(session.league_id) || new Map<string, Standing>()

    for (const [players, outcome] of [[winningSide, 'win'], [losingSide, 'loss']] as const) {
      for (const playerName of players) {
        const key = normalize(playerName)
        const standing = leagueStandings.get(key) || { name: playerName.trim(), wins: 0, losses: 0, sessionIds: new Set<string>() }
        if (outcome === 'win') standing.wins += 1
        else standing.losses += 1
        standing.sessionIds.add(session.id)
        leagueStandings.set(key, standing)
      }
    }

    standingsByLeague.set(session.league_id, leagueStandings)
    acceptedSetsByLeague.set(session.league_id, (acceptedSetsByLeague.get(session.league_id) || 0) + 1)
  }

  return input.participants.flatMap((participant) => {
    const standings = standingsByLeague.get(participant.leagueId)
    if (!standings) return []
    const player = standings.get(normalize(participant.playerName)) || {
      name: participant.playerName.trim(),
      wins: 0,
      losses: 0,
      sessionIds: new Set<string>(),
    }
    const leader = [...standings.values()].sort((left, right) => (
      right.wins - left.wins || left.losses - right.losses || left.name.localeCompare(right.name)
    ))[0]

    return [{
      leagueId: participant.leagueId,
      playerName: player.name,
      wins: player.wins,
      losses: player.losses,
      setsPlayed: player.wins + player.losses,
      weeksPlayed: player.sessionIds.size,
      leagueSetCount: acceptedSetsByLeague.get(participant.leagueId) || 0,
      leaderName: leader?.name || '',
      leaderWins: leader?.wins || 0,
      leaderLosses: leader?.losses || 0,
    }]
  })
}

export function buildLeagueWeeklyCompetitionView(input: {
  leagueId: string
  playerNames?: string[]
  sessions: LeagueWeeklyRecordSession[]
  results: LeagueWeeklyRecordSetResult[]
}): LeagueWeeklyCompetitionView {
  const sessions = input.sessions.filter((session) => (
    session.league_id === input.leagueId && ['published', 'completed'].includes(session.status)
  ))
  const sessionsById = new Map(sessions.map((session) => [session.id, session]))
  const acceptedResults = input.results.filter((result) => isAcceptedResult(result, sessionsById))
  const standings = new Map<string, Standing & { gamesWon: number; gamesLost: number }>()

  for (const playerName of input.playerNames || []) {
    const key = normalize(playerName)
    if (!key || standings.has(key)) continue
    standings.set(key, {
      name: playerName.trim(), wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, sessionIds: new Set<string>(),
    })
  }

  function addPlayer(playerName: string, won: boolean, gamesWon: number, gamesLost: number, sessionId: string) {
    const key = normalize(playerName)
    const current = standings.get(key) || {
      name: playerName.trim(), wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, sessionIds: new Set<string>(),
    }
    if (won) current.wins += 1
    else current.losses += 1
    current.gamesWon += gamesWon
    current.gamesLost += gamesLost
    current.sessionIds.add(sessionId)
    standings.set(key, current)
  }

  for (const result of acceptedResults) {
    const sideA = (result.side_a_players || []).filter((name) => normalize(name))
    const sideB = (result.side_b_players || []).filter((name) => normalize(name))
    const sideAWon = result.side_a_games > result.side_b_games
    for (const playerName of sideA) addPlayer(playerName, sideAWon, result.side_a_games, result.side_b_games, result.session_id)
    for (const playerName of sideB) addPlayer(playerName, !sideAWon, result.side_b_games, result.side_a_games, result.session_id)
  }

  const rankedStandings: LeagueWeeklyStanding[] = [...standings.values()]
    .sort((left, right) => (
      right.wins - left.wins ||
      left.losses - right.losses ||
      (right.gamesWon - right.gamesLost) - (left.gamesWon - left.gamesLost) ||
      left.name.localeCompare(right.name)
    ))
    .map((standing, index) => {
      const setsPlayed = standing.wins + standing.losses
      return {
        rank: index + 1,
        playerName: standing.name,
        wins: standing.wins,
        losses: standing.losses,
        setsPlayed,
        weeksPlayed: standing.sessionIds.size,
        gamesWon: standing.gamesWon,
        gamesLost: standing.gamesLost,
        gameDifferential: standing.gamesWon - standing.gamesLost,
        winPercentage: setsPlayed ? Math.round((standing.wins / setsPlayed) * 100) : 0,
      }
    })

  const weeks = sessions
    .map((session): LeagueWeeklyScorecardWeek => {
      const weekResults = acceptedResults.filter((result) => result.session_id === session.id)
      const courts = new Map<number, LeagueWeeklyScorecardSet[]>()
      for (const result of weekResults) {
        const courtNumber = Number(result.court_number)
        const setNumber = Number(result.set_number)
        if (!Number.isInteger(courtNumber) || courtNumber < 1 || !Number.isInteger(setNumber) || setNumber < 1) continue
        const sets = courts.get(courtNumber) || []
        sets.push({
          setNumber,
          sideA: (result.side_a_players || []).map((name) => name.trim()).filter(Boolean),
          sideB: (result.side_b_players || []).map((name) => name.trim()).filter(Boolean),
          sideAGames: result.side_a_games,
          sideBGames: result.side_b_games,
        })
        courts.set(courtNumber, sets)
      }
      return {
        sessionId: session.id,
        playOn: session.play_on || '',
        status: session.status,
        acceptedSetCount: weekResults.length,
        courts: [...courts.entries()]
          .sort(([left], [right]) => left - right)
          .map(([courtNumber, sets]) => ({ courtNumber, sets: sets.sort((left, right) => left.setNumber - right.setNumber) })),
      }
    })
    .sort((left, right) => right.playOn.localeCompare(left.playOn) || right.sessionId.localeCompare(left.sessionId))

  return {
    summary: {
      weeks: weeks.length,
      acceptedSets: acceptedResults.length,
      players: rankedStandings.length,
      totalGames: acceptedResults.reduce((total, result) => total + result.side_a_games + result.side_b_games, 0),
    },
    standings: rankedStandings,
    weeks,
  }
}
