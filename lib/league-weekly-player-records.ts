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
  winPercentage: number
  gameDifferential: number
  currentStreak: { outcome: 'W' | 'L'; count: number } | null
  recentForm: Array<'W' | 'L'>
  bestPartner: LeagueWeeklyPlayerPartner | null
  latestWeek: LeagueWeeklyPlayerWeek | null
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

export type LeagueWeeklyPlayerPartner = {
  playerName: string
  setsPlayed: number
  wins: number
  losses: number
  winPercentage: number
  gameDifferential: number
}

export type LeagueWeeklyPlayerWeek = {
  sessionId: string
  playOn: string
  wins: number
  losses: number
  gameDifferential: number
  courtNumbers: number[]
  partners: string[]
}

export type LeagueWeeklyPlayerInsight = LeagueWeeklyStanding & {
  currentStreak: { outcome: 'W' | 'L'; count: number } | null
  recentForm: Array<'W' | 'L'>
  partners: LeagueWeeklyPlayerPartner[]
  weeks: LeagueWeeklyPlayerWeek[]
}

export type LeagueWeeklyCompetitionView = {
  summary: { weeks: number; acceptedSets: number; players: number; totalGames: number }
  standings: LeagueWeeklyStanding[]
  playerInsights: LeagueWeeklyPlayerInsight[]
  weeks: LeagueWeeklyScorecardWeek[]
}

export type LeagueWeeklyPublicWeek = {
  playOn: string
  status: 'published' | 'completed'
  rosterCount: number
  assignments: Array<{
    courtNumber: number
    startTime: string
    players: [string, string, string, string]
  }>
  acceptedSetCount: number
  expectedSetCount: number
  recap: { headline: string; summary: string; stories: string[] } | null
}

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

type Standing = { name: string; wins: number; losses: number; sessionIds: Set<string> }

type PlayerSetEvent = {
  sessionId: string
  playOn: string
  setNumber: number
  courtNumber: number
  won: boolean
  gamesWon: number
  gamesLost: number
  partners: string[]
}

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
  return input.participants.flatMap((participant) => {
    const view = buildLeagueWeeklyCompetitionView({
      leagueId: participant.leagueId,
      playerNames: [participant.playerName],
      sessions: input.sessions,
      results: input.results,
    })
    if (!view.summary.acceptedSets) return []
    const player = view.playerInsights.find((item) => normalize(item.playerName) === normalize(participant.playerName))
    if (!player) return []
    const leader = view.standings[0]

    return [{
      leagueId: participant.leagueId,
      playerName: player.playerName,
      wins: player.wins,
      losses: player.losses,
      setsPlayed: player.setsPlayed,
      weeksPlayed: player.weeksPlayed,
      leagueSetCount: view.summary.acceptedSets,
      leaderName: leader?.playerName || '',
      leaderWins: leader?.wins || 0,
      leaderLosses: leader?.losses || 0,
      winPercentage: player.winPercentage,
      gameDifferential: player.gameDifferential,
      currentStreak: player.currentStreak,
      recentForm: player.recentForm,
      bestPartner: player.partners[0] || null,
      latestWeek: player.weeks[0] || null,
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
  const eventsByPlayer = new Map<string, PlayerSetEvent[]>()

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

  function addEvent(playerName: string, teammates: string[], result: LeagueWeeklyRecordSetResult, won: boolean, gamesWon: number, gamesLost: number) {
    const key = normalize(playerName)
    const session = sessionsById.get(result.session_id)
    if (!session) return
    const events = eventsByPlayer.get(key) || []
    events.push({
      sessionId: result.session_id,
      playOn: session.play_on || '',
      setNumber: Number.isInteger(Number(result.set_number)) ? Number(result.set_number) : 0,
      courtNumber: Number.isInteger(Number(result.court_number)) ? Number(result.court_number) : 0,
      won,
      gamesWon,
      gamesLost,
      partners: teammates.filter((teammate) => normalize(teammate) !== key),
    })
    eventsByPlayer.set(key, events)
  }

  for (const result of acceptedResults) {
    const sideA = (result.side_a_players || []).filter((name) => normalize(name))
    const sideB = (result.side_b_players || []).filter((name) => normalize(name))
    const sideAWon = result.side_a_games > result.side_b_games
    for (const playerName of sideA) {
      addPlayer(playerName, sideAWon, result.side_a_games, result.side_b_games, result.session_id)
      addEvent(playerName, sideA, result, sideAWon, result.side_a_games, result.side_b_games)
    }
    for (const playerName of sideB) {
      addPlayer(playerName, !sideAWon, result.side_b_games, result.side_a_games, result.session_id)
      addEvent(playerName, sideB, result, !sideAWon, result.side_b_games, result.side_a_games)
    }
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

  const playerInsights = rankedStandings.map((standing): LeagueWeeklyPlayerInsight => {
    const events = [...(eventsByPlayer.get(normalize(standing.playerName)) || [])].sort((left, right) => (
      left.playOn.localeCompare(right.playOn) ||
      left.sessionId.localeCompare(right.sessionId) ||
      left.setNumber - right.setNumber ||
      left.courtNumber - right.courtNumber
    ))
    const lastEvent = events.at(-1)
    let streakCount = 0
    if (lastEvent) {
      for (let index = events.length - 1; index >= 0 && events[index].won === lastEvent.won; index -= 1) streakCount += 1
    }

    const partners = new Map<string, { name: string; wins: number; losses: number; gamesWon: number; gamesLost: number }>()
    const weeks = new Map<string, { playOn: string; wins: number; losses: number; gamesWon: number; gamesLost: number; courts: Set<number>; partners: Map<string, string> }>()
    for (const event of events) {
      const week = weeks.get(event.sessionId) || {
        playOn: event.playOn,
        wins: 0,
        losses: 0,
        gamesWon: 0,
        gamesLost: 0,
        courts: new Set<number>(),
        partners: new Map<string, string>(),
      }
      if (event.won) week.wins += 1
      else week.losses += 1
      week.gamesWon += event.gamesWon
      week.gamesLost += event.gamesLost
      if (event.courtNumber > 0) week.courts.add(event.courtNumber)

      for (const partnerName of event.partners) {
        const partnerKey = normalize(partnerName)
        if (!partnerKey) continue
        week.partners.set(partnerKey, partnerName.trim())
        const partner = partners.get(partnerKey) || { name: partnerName.trim(), wins: 0, losses: 0, gamesWon: 0, gamesLost: 0 }
        if (event.won) partner.wins += 1
        else partner.losses += 1
        partner.gamesWon += event.gamesWon
        partner.gamesLost += event.gamesLost
        partners.set(partnerKey, partner)
      }
      weeks.set(event.sessionId, week)
    }

    return {
      ...standing,
      currentStreak: lastEvent ? { outcome: lastEvent.won ? 'W' : 'L', count: streakCount } : null,
      recentForm: events.slice(-5).map((event) => event.won ? 'W' : 'L'),
      partners: [...partners.values()]
        .map((partner) => {
          const setsPlayed = partner.wins + partner.losses
          return {
            playerName: partner.name,
            setsPlayed,
            wins: partner.wins,
            losses: partner.losses,
            winPercentage: setsPlayed ? Math.round((partner.wins / setsPlayed) * 100) : 0,
            gameDifferential: partner.gamesWon - partner.gamesLost,
          }
        })
        .sort((left, right) => right.setsPlayed - left.setsPlayed || right.wins - left.wins || left.playerName.localeCompare(right.playerName)),
      weeks: [...weeks.entries()]
        .map(([sessionId, week]) => ({
          sessionId,
          playOn: week.playOn,
          wins: week.wins,
          losses: week.losses,
          gameDifferential: week.gamesWon - week.gamesLost,
          courtNumbers: [...week.courts].sort((left, right) => left - right),
          partners: [...week.partners.values()].sort((left, right) => left.localeCompare(right)),
        }))
        .sort((left, right) => right.playOn.localeCompare(left.playOn) || right.sessionId.localeCompare(left.sessionId)),
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
    playerInsights,
    weeks,
  }
}
