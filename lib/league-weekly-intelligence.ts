import { buildLeagueWeeklyCourts, buildLeagueWeeklyPlayerStats, normalizeLeagueWeeklySettings, type LeagueWeeklyCourt, type LeagueWeeklyPlayerStat, type LeagueWeeklySettings } from './league-weekly-format'

export type LeagueWeeklyReviewedResult = {
  courtNumber: number
  setNumber: number
  sideAGames: number
  sideBGames: number
  reviewStatus: 'pending' | 'confirmed' | 'disputed' | 'approved'
  submittedByName?: string
}

export type LeagueWeeklyScoreSubmission = {
  courtNumber: number
  setNumber: number
  sideAGames: number
  sideBGames: number
  submittedByName: string
  submittedAt?: string
}

export type LeagueWeeklyPlayerScorecard = LeagueWeeklyPlayerStat & {
  weeksPlayed: number
  setWinPercentage: number
  currentWinStreak: number
}

export type LeagueWeeklyPlayerBaseline = {
  playerName: string
  playerId?: string
  tiqDoublesRating: number | null
}

export type LeagueWeeklyCourtPlayerSignal = {
  playerName: string
  tiqRating: number | null
  acceptedSets: number
  leagueFormIndex: number | null
  courtFitIndex: number
  basis: 'tiq' | 'blended' | 'league' | 'untracked'
}

export type LeagueWeeklyCourtPlanInsight = {
  courtNumber: number
  strengthIndex: number
  trackedPlayers: number
  freshConnections: number
  repeatConnections: number
  movedPlayers: string[]
  lockedPlayers: string[]
  playerSignals: LeagueWeeklyCourtPlayerSignal[]
}

export type LeagueWeeklyCourtPlan = {
  strategy: 'balanced' | 'manual'
  courts: LeagueWeeklyCourt[]
  insights: LeagueWeeklyCourtPlanInsight[]
  summary: {
    trackedPlayers: number
    tiqRatedPlayers: number
    lockedPlayers: number
    movedPlayers: number
    freshConnections: number
    repeatConnections: number
    strengthSpread: number
  }
}

export function isAcceptedLeagueWeeklyResult(result: Pick<LeagueWeeklyReviewedResult, 'reviewStatus'>) {
  return result.reviewStatus === 'confirmed' || result.reviewStatus === 'approved'
}

export function deriveLeagueWeeklyOfficialScore(submissions: LeagueWeeklyScoreSubmission[]) {
  if (!submissions.length) return null
  const scores = new Map<string, LeagueWeeklyScoreSubmission[]>()
  for (const submission of submissions) {
    const key = `${submission.sideAGames}-${submission.sideBGames}`
    scores.set(key, [...(scores.get(key) || []), submission])
  }
  const latest = [...submissions].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))[0]
  return {
    courtNumber: latest.courtNumber,
    setNumber: latest.setNumber,
    sideAGames: latest.sideAGames,
    sideBGames: latest.sideBGames,
    submittedByName: latest.submittedByName,
    reviewStatus: scores.size > 1 ? 'disputed' as const : submissions.length > 1 ? 'confirmed' as const : 'pending' as const,
  }
}

export function buildLeagueWeeklyScoreReview(
  courts: LeagueWeeklyCourt[],
  results: LeagueWeeklyReviewedResult[],
  submissions: LeagueWeeklyScoreSubmission[],
) {
  const expected = courts.flatMap((court) => court.sets.map((set) => ({ courtNumber: court.courtNumber, setNumber: set.setNumber })))
  const findResult = (courtNumber: number, setNumber: number) => results.find((result) => result.courtNumber === courtNumber && result.setNumber === setNumber)
  const missing = expected.filter((set) => !findResult(set.courtNumber, set.setNumber))
  const pending = expected.filter((set) => findResult(set.courtNumber, set.setNumber)?.reviewStatus === 'pending')
  const disputed = expected.filter((set) => findResult(set.courtNumber, set.setNumber)?.reviewStatus === 'disputed')
  const accepted = expected.filter((set) => {
    const result = findResult(set.courtNumber, set.setNumber)
    return result ? isAcceptedLeagueWeeklyResult(result) : false
  })
  const submittedPlayers = new Set(submissions.map((submission) => submission.submittedByName.trim()).filter(Boolean))
  return { expectedCount: expected.length, acceptedCount: accepted.length, missing, pending, disputed, submittedPlayerCount: submittedPlayers.size }
}

export function buildLeagueWeeklyDashboard(courts: LeagueWeeklyCourt[], results: LeagueWeeklyReviewedResult[]) {
  const accepted = results.filter(isAcceptedLeagueWeeklyResult)
  const playerStats = buildLeagueWeeklyPlayerStats(courts, accepted)
  const totalGames = accepted.reduce((total, result) => total + result.sideAGames + result.sideBGames, 0)
  const closeSets = accepted.filter((result) => Math.abs(result.sideAGames - result.sideBGames) <= 2).length
  return {
    completedSets: accepted.length,
    totalGames,
    closeSets,
    leaders: playerStats.slice(0, 3),
  }
}

export function buildLeagueWeeklySeasonScorecards(sessions: Array<{
  playOn: string
  courts: LeagueWeeklyCourt[]
  results: LeagueWeeklyReviewedResult[]
}>): LeagueWeeklyPlayerScorecard[] {
  const combined = new Map<string, LeagueWeeklyPlayerScorecard>()
  const weekSets = new Map<string, Set<string>>()
  const streaks = new Map<string, number>()
  const orderedSessions = [...sessions].sort((a, b) => a.playOn.localeCompare(b.playOn))
  for (const session of orderedSessions) {
    const accepted = session.results.filter(isAcceptedLeagueWeeklyResult).sort((a, b) => a.courtNumber - b.courtNumber || a.setNumber - b.setNumber)
    for (const stat of buildLeagueWeeklyPlayerStats(session.courts, accepted)) {
      const current = combined.get(stat.playerName) || { ...stat, setsPlayed: 0, setsWon: 0, gamesWon: 0, gamesLost: 0, gameDifferential: 0, weeksPlayed: 0, setWinPercentage: 0, currentWinStreak: 0 }
      current.setsPlayed += stat.setsPlayed
      current.setsWon += stat.setsWon
      current.gamesWon += stat.gamesWon
      current.gamesLost += stat.gamesLost
      current.gameDifferential = current.gamesWon - current.gamesLost
      const weeks = weekSets.get(stat.playerName) || new Set<string>()
      weeks.add(session.playOn)
      weekSets.set(stat.playerName, weeks)
      combined.set(stat.playerName, current)
    }
    for (const result of accepted) {
      const set = session.courts.find((court) => court.courtNumber === result.courtNumber)?.sets.find((item) => item.setNumber === result.setNumber)
      if (!set) continue
      for (const player of set.sideA) streaks.set(player, result.sideAGames > result.sideBGames ? (streaks.get(player) || 0) + 1 : 0)
      for (const player of set.sideB) streaks.set(player, result.sideBGames > result.sideAGames ? (streaks.get(player) || 0) + 1 : 0)
    }
  }
  for (const scorecard of combined.values()) {
    scorecard.weeksPlayed = weekSets.get(scorecard.playerName)?.size || 0
    scorecard.setWinPercentage = scorecard.setsPlayed ? Math.round((scorecard.setsWon / scorecard.setsPlayed) * 100) : 0
    scorecard.currentWinStreak = streaks.get(scorecard.playerName) || 0
  }
  return Array.from(combined.values()).sort((a, b) => b.setWinPercentage - a.setWinPercentage || b.gameDifferential - a.gameDifferential || a.playerName.localeCompare(b.playerName))
}

export function buildBalancedLeagueWeeklyCourts(input: {
  playerNames: string[]
  settings: Partial<LeagueWeeklySettings>
  scorecards: LeagueWeeklyPlayerScorecard[]
  playerBaselines?: LeagueWeeklyPlayerBaseline[]
  historyCourts: LeagueWeeklyCourt[][]
  lockedCourts?: Record<string, number>
}) {
  const settings = normalizeLeagueWeeklySettings(input.settings)
  const players = Array.from(new Set(input.playerNames.map((name) => name.trim()).filter(Boolean)))
  const courtTotal = Math.min(settings.courtCount, Math.floor(players.length / 4))
  if (!courtTotal) return []
  const eligiblePlayers = players.slice(0, courtTotal * 4)
  const groups = Array.from({ length: courtTotal }, () => [] as string[])
  const playerSignals = buildLeagueWeeklyCourtSignals(players, input.scorecards, input.playerBaselines || [])
  const ratings = new Map(playerSignals.map((signal) => [signal.playerName.toLowerCase(), signal.courtFitIndex]))
  const attendance = new Map(input.scorecards.map((scorecard) => [scorecard.playerName.toLowerCase(), scorecard.weeksPlayed]))
  const targetRating = eligiblePlayers.reduce((total, player) => total + (ratings.get(player.toLowerCase()) ?? 50), 0) / eligiblePlayers.length
  const targetAttendance = eligiblePlayers.reduce((total, player) => total + (attendance.get(player.toLowerCase()) || 0), 0) / eligiblePlayers.length
  const teammateCounts = new Map<string, number>()
  const latestCourt = new Map<string, number>()
  input.historyCourts.forEach((courts, weekIndex) => courts.forEach((court) => court.players.forEach((player) => {
    if (weekIndex === 0 && !latestCourt.has(player.toLowerCase())) latestCourt.set(player.toLowerCase(), court.courtNumber)
    court.players.filter((other) => other !== player).forEach((other) => {
      const key = [player.toLowerCase(), other.toLowerCase()].sort().join('|')
      teammateCounts.set(key, (teammateCounts.get(key) || 0) + 1)
    })
  })))
  const locked = new Set<string>()
  eligiblePlayers.forEach((player) => {
    const courtNumber = input.lockedCourts?.[player]
    if (Number.isInteger(courtNumber) && courtNumber! >= 1 && courtNumber! <= courtTotal && groups[courtNumber! - 1].length < 4) {
      groups[courtNumber! - 1].push(player)
      locked.add(player)
    }
  })
  const remaining = eligiblePlayers.filter((player) => !locked.has(player)).sort((a, b) => (ratings.get(b.toLowerCase()) ?? 50) - (ratings.get(a.toLowerCase()) ?? 50))
  for (const player of remaining) {
    const candidates = groups.map((group, index) => {
      if (group.length >= 4) return { index, penalty: Number.POSITIVE_INFINITY }
      const projected = [...group, player]
      const ratingPenalty = Math.abs(projected.reduce((total, name) => total + (ratings.get(name.toLowerCase()) ?? 50), 0) - targetRating * projected.length)
      const attendancePenalty = Math.abs(projected.reduce((total, name) => total + (attendance.get(name.toLowerCase()) || 0), 0) - targetAttendance * projected.length) * 2
      const repeatPenalty = group.reduce((total, other) => total + (teammateCounts.get([player.toLowerCase(), other.toLowerCase()].sort().join('|')) || 0) * 8, 0)
      const sameCourtPenalty = latestCourt.get(player.toLowerCase()) === index + 1 ? 6 : 0
      return { index, penalty: ratingPenalty + attendancePenalty + repeatPenalty + sameCourtPenalty + group.length }
    }).sort((a, b) => a.penalty - b.penalty || a.index - b.index)
    groups[candidates[0].index].push(player)
  }
  return groups.filter((group) => group.length === 4).map((group, index) => {
    const [court] = buildLeagueWeeklyCourts(group, { ...settings, courtCount: 1, startTimes: [settings.startTimes[index % settings.startTimes.length]] })
    return { ...court, courtNumber: index + 1 }
  })
}

export function buildLeagueWeeklyCourtPlan(input: {
  playerNames: string[]
  settings: Partial<LeagueWeeklySettings>
  scorecards: LeagueWeeklyPlayerScorecard[]
  playerBaselines?: LeagueWeeklyPlayerBaseline[]
  historyCourts: LeagueWeeklyCourt[][]
  lockedCourts?: Record<string, number>
  strategy?: 'balanced' | 'manual'
}): LeagueWeeklyCourtPlan {
  const strategy = input.strategy || 'balanced'
  const courts = strategy === 'balanced'
    ? buildBalancedLeagueWeeklyCourts(input)
    : buildManualLeagueWeeklyCourts(input.playerNames, input.settings, input.lockedCourts)
  const playerSignals = buildLeagueWeeklyCourtSignals(input.playerNames, input.scorecards, input.playerBaselines || [])
  const signalsByPlayer = new Map(playerSignals.map((signal) => [signal.playerName.toLowerCase(), signal]))
  const ratings = new Map(playerSignals.map((signal) => [signal.playerName.toLowerCase(), signal.courtFitIndex]))
  const latestCourt = new Map<string, number>()
  const priorConnections = new Set<string>()
  input.historyCourts.forEach((historyWeek, weekIndex) => historyWeek.forEach((court) => {
    for (const player of court.players) {
      const playerKey = player.toLowerCase()
      if (weekIndex === 0 && !latestCourt.has(playerKey)) latestCourt.set(playerKey, court.courtNumber)
    }
    for (let left = 0; left < court.players.length; left += 1) {
      for (let right = left + 1; right < court.players.length; right += 1) {
        priorConnections.add(connectionKey(court.players[left], court.players[right]))
      }
    }
  }))

  const insights = courts.map((court): LeagueWeeklyCourtPlanInsight => {
    let freshConnections = 0
    let repeatConnections = 0
    for (let left = 0; left < court.players.length; left += 1) {
      for (let right = left + 1; right < court.players.length; right += 1) {
        if (priorConnections.has(connectionKey(court.players[left], court.players[right]))) repeatConnections += 1
        else freshConnections += 1
      }
    }
    const trackedRatings = court.players.flatMap((player) => {
      const signal = signalsByPlayer.get(player.toLowerCase())
      return signal && signal.acceptedSets > 0 ? [signal.courtFitIndex] : []
    })
    return {
      courtNumber: court.courtNumber,
      strengthIndex: roundOne(court.players.reduce((total, player) => total + (ratings.get(player.toLowerCase()) ?? 50), 0) / court.players.length),
      trackedPlayers: trackedRatings.length,
      freshConnections,
      repeatConnections,
      movedPlayers: court.players.filter((player) => {
        const previousCourt = latestCourt.get(player.toLowerCase())
        return previousCourt !== undefined && previousCourt !== court.courtNumber
      }),
      lockedPlayers: court.players.filter((player) => input.lockedCourts?.[player] === court.courtNumber),
      playerSignals: court.players.map((player) => signalsByPlayer.get(player.toLowerCase()) || {
        playerName: player,
        tiqRating: null,
        acceptedSets: 0,
        leagueFormIndex: null,
        courtFitIndex: 50,
        basis: 'untracked',
      }),
    }
  })
  const strengths = insights.map((insight) => insight.strengthIndex)

  return {
    strategy,
    courts,
    insights,
    summary: {
      trackedPlayers: new Set(courts.flatMap((court) => court.players).filter((player) => (signalsByPlayer.get(player.toLowerCase())?.acceptedSets || 0) > 0)).size,
      tiqRatedPlayers: new Set(courts.flatMap((court) => court.players).filter((player) => typeof signalsByPlayer.get(player.toLowerCase())?.tiqRating === 'number')).size,
      lockedPlayers: insights.reduce((total, insight) => total + insight.lockedPlayers.length, 0),
      movedPlayers: insights.reduce((total, insight) => total + insight.movedPlayers.length, 0),
      freshConnections: insights.reduce((total, insight) => total + insight.freshConnections, 0),
      repeatConnections: insights.reduce((total, insight) => total + insight.repeatConnections, 0),
      strengthSpread: strengths.length ? roundOne(Math.max(...strengths) - Math.min(...strengths)) : 0,
    },
  }
}

export function buildLeagueWeeklyCourtSignals(
  playerNames: string[],
  scorecards: LeagueWeeklyPlayerScorecard[],
  playerBaselines: LeagueWeeklyPlayerBaseline[],
): LeagueWeeklyCourtPlayerSignal[] {
  const scorecardByPlayer = new Map(scorecards.map((scorecard) => [scorecard.playerName.trim().toLowerCase(), scorecard]))
  const baselineByPlayer = new Map(playerBaselines.map((baseline) => [baseline.playerName.trim().toLowerCase(), baseline]))

  return Array.from(new Set(playerNames.map((name) => name.trim()).filter(Boolean))).map((playerName) => {
    const playerKey = playerName.toLowerCase()
    const scorecard = scorecardByPlayer.get(playerKey)
    const baseline = baselineByPlayer.get(playerKey)
    const acceptedSets = scorecard?.setsPlayed || 0
    const leagueFormIndex = scorecard
      ? clampIndex(scorecard.setWinPercentage + scorecard.gameDifferential / Math.max(1, scorecard.setsPlayed))
      : null
    const tiqRating = typeof baseline?.tiqDoublesRating === 'number' && Number.isFinite(baseline.tiqDoublesRating)
      ? baseline.tiqDoublesRating
      : null
    const tiqIndex = tiqRating === null ? null : clampIndex(50 + (tiqRating - 3.5) * 20)

    if (tiqIndex !== null && leagueFormIndex !== null && acceptedSets > 0) {
      const tiqWeight = acceptedSets <= 5 ? 0.75 : acceptedSets <= 14 ? 0.55 : 0.35
      return {
        playerName,
        tiqRating,
        acceptedSets,
        leagueFormIndex: roundOne(leagueFormIndex),
        courtFitIndex: roundOne(tiqIndex * tiqWeight + leagueFormIndex * (1 - tiqWeight)),
        basis: 'blended',
      }
    }
    if (tiqIndex !== null) {
      return { playerName, tiqRating, acceptedSets, leagueFormIndex, courtFitIndex: roundOne(tiqIndex), basis: 'tiq' }
    }
    if (leagueFormIndex !== null) {
      return { playerName, tiqRating, acceptedSets, leagueFormIndex: roundOne(leagueFormIndex), courtFitIndex: roundOne(leagueFormIndex), basis: 'league' }
    }
    return { playerName, tiqRating, acceptedSets, leagueFormIndex, courtFitIndex: 50, basis: 'untracked' }
  })
}

function buildManualLeagueWeeklyCourts(
  playerNames: string[],
  settingsInput: Partial<LeagueWeeklySettings>,
  lockedCourts: Record<string, number> = {},
) {
  const settings = normalizeLeagueWeeklySettings(settingsInput)
  const players = Array.from(new Set(playerNames.map((name) => name.trim()).filter(Boolean)))
  const courtTotal = Math.min(settings.courtCount, Math.floor(players.length / 4))
  const eligiblePlayers = players.slice(0, courtTotal * 4)
  const groups = Array.from({ length: courtTotal }, () => [] as string[])
  const lockedPlayers = new Set<string>()
  for (const player of eligiblePlayers) {
    const courtNumber = lockedCourts[player]
    if (!Number.isInteger(courtNumber) || courtNumber < 1 || courtNumber > courtTotal || groups[courtNumber - 1].length >= 4) continue
    groups[courtNumber - 1].push(player)
    lockedPlayers.add(player)
  }
  for (const player of eligiblePlayers) {
    if (lockedPlayers.has(player)) continue
    const group = groups.find((candidate) => candidate.length < 4)
    if (group) group.push(player)
  }
  return groups.filter((group) => group.length === 4).map((group, index) => {
    const [court] = buildLeagueWeeklyCourts(group, { ...settings, courtCount: 1, startTimes: [settings.startTimes[index % settings.startTimes.length]] })
    return { ...court, courtNumber: index + 1 }
  })
}

function connectionKey(left: string, right: string) {
  return [left.trim().toLowerCase(), right.trim().toLowerCase()].sort().join('|')
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10
}

function clampIndex(value: number) {
  return Math.min(100, Math.max(0, value))
}
