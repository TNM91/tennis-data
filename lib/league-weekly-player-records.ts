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
}

export type LeagueWeeklyRecordSetResult = {
  session_id: string
  side_a_players: string[] | null
  side_b_players: string[] | null
  side_a_games: number
  side_b_games: number
  review_status: string
}

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

type Standing = { name: string; wins: number; losses: number; sessionIds: Set<string> }

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
    if (!session || !['confirmed', 'approved'].includes(result.review_status)) continue
    if (result.side_a_games === result.side_b_games) continue
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
