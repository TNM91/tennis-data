import { validateLeagueWeeklySetScore } from './league-weekly-format'
import { buildLeagueWeeklyCompetitionView, type LeagueWeeklyCompetitionView, type LeagueWeeklyScorecardWeek } from './league-weekly-player-records'

export type PairInsight = {
  key: string
  players: [string, string]
  wins: number
  losses: number
  setsPlayed: number
  weeksPlayed: number
  gamesWon: number
  gamesLost: number
  gameDifferential: number
  winPercentage: number
  opponents: Array<{ players: [string, string]; wins: number; losses: number }>
}
type RecordCount = { wins: number; losses: number }
export type PlayerExtra = {
  closeSets: RecordCount
  tiebreaks: RecordCount
  rankMovement: number | null
  repeatedPartners: number
}
export type WeeklyAnalytics = {
  view: LeagueWeeklyCompetitionView
  pairs: PairInsight[]
  players: Record<string, PlayerExtra>
  highlights: Array<{ title: string; detail: string }>
  closeSets: number
  tiebreaks: number
  playedWeeks: number
}
const normalize = (name: string) => name.trim().toLowerCase()
const pairKey = (names: string[]) => JSON.stringify(names.map(normalize).sort())

// Derive analytics from the already-authorized, accepted scorecards. No extra data fetch.
export function buildWeeklyAnalytics(source: LeagueWeeklyCompetitionView, sessionId = ''): WeeklyAnalytics {
  const names = new Map(source.standings.map(player => [normalize(player.playerName), player.playerName]))
  const displayName = (name: string) => names.get(normalize(name)) || name.trim()
  const allWeeks = source.weeks.map(week => ({ ...week, courts: week.courts.map(court => ({
    ...court, sets: court.sets.filter(set => set.sideA.length === 2 && set.sideB.length === 2
      && new Set([...set.sideA, ...set.sideB].map(normalize)).size === 4
      && [...set.sideA, ...set.sideB].every(name => normalize(name))
      && validateLeagueWeeklySetScore(set.sideAGames, set.sideBGames).valid).map(set => ({ ...set, sideA: set.sideA.map(displayName), sideB: set.sideB.map(displayName) })),
  })) }))
  const weeks = sessionId ? allWeeks.filter(week => week.sessionId === sessionId) : allWeeks
  function competition(selected: LeagueWeeklyScorecardWeek[]) {
    return buildLeagueWeeklyCompetitionView({ leagueId: 'analytics',
      sessions: selected.map(week => ({ id: week.sessionId, league_id: 'analytics', status: week.status, play_on: week.playOn })),
      results: selected.flatMap(week => week.courts.flatMap(court => court.sets.map(set => ({
        session_id: week.sessionId, court_number: court.courtNumber, set_number: set.setNumber,
        side_a_players: set.sideA, side_b_players: set.sideB, side_a_games: set.sideAGames,
        side_b_games: set.sideBGames, review_status: 'approved',
      })))),
    })
  }
  const view = competition(weeks)
  const pairs = new Map<string, PairInsight & { weekIds: Set<string> }>()
  const players: Record<string, PlayerExtra> = Object.create(null)
  let closeSets = 0
  let tiebreaks = 0
  const courts: Array<{ label: string; gap: number; sets: number }> = []
  for (const week of weeks) {
    for (const court of week.courts) {
      if (court.sets.length) courts.push({ label: `Court ${court.courtNumber} · ${week.playOn}`, gap: court.sets.reduce((sum, set) => sum + Math.abs(set.sideAGames - set.sideBGames), 0), sets: court.sets.length })
      for (const set of court.sets) {
        const close = Math.abs(set.sideAGames - set.sideBGames) <= 2
        const tiebreak = Math.max(set.sideAGames, set.sideBGames) === 7 && Math.min(set.sideAGames, set.sideBGames) === 6
        if (close) closeSets++
        if (tiebreak) tiebreaks++
        for (const [names, opponents, won, gamesWon, gamesLost] of [
          [set.sideA, set.sideB, set.sideAGames > set.sideBGames, set.sideAGames, set.sideBGames],
          [set.sideB, set.sideA, set.sideBGames > set.sideAGames, set.sideBGames, set.sideAGames],
        ] as Array<[string[], string[], boolean, number, number]>) {
          const key = pairKey(names)
          const pair = pairs.get(key) || { key, players: names.map(name => name.trim()).sort((a, b) => normalize(a).localeCompare(normalize(b))) as [string, string], wins: 0, losses: 0, setsPlayed: 0, weeksPlayed: 0, gamesWon: 0, gamesLost: 0, gameDifferential: 0, winPercentage: 0, opponents: [], weekIds: new Set<string>() }
          if (won) pair.wins++; else pair.losses++
          pair.setsPlayed++
          pair.gamesWon += gamesWon
          pair.gamesLost += gamesLost
          pair.weekIds.add(week.sessionId)
          const opponent = pair.opponents.find(item => pairKey(item.players) === pairKey(opponents)) || { players: opponents.map(name => name.trim()).sort() as [string, string], wins: 0, losses: 0 }
          if (won) opponent.wins++; else opponent.losses++
          if (!pair.opponents.includes(opponent)) pair.opponents.push(opponent)
          pairs.set(key, pair)
          for (const name of names) {
            const extra = players[normalize(name)] ||= { closeSets: { wins: 0, losses: 0 }, tiebreaks: { wins: 0, losses: 0 }, rankMovement: null, repeatedPartners: 0 }
            const outcome = won ? 'wins' : 'losses'
            if (close) extra.closeSets[outcome]++
            if (tiebreak) extra.tiebreaks[outcome]++
          }
        }
      }
    }
  }
  // Compare cumulative standings before/after the chosen scored week, not weekly rank vs season rank.
  const latest = [...weeks].filter(week => week.courts.some(court => court.sets.length)).sort((a, b) => b.playOn.localeCompare(a.playOn))[0]
  const priorWeeks = latest ? allWeeks.filter(week => week.playOn < latest.playOn) : []
  const previous = competition(priorWeeks)
  const throughLatest = competition(latest ? allWeeks.filter(week => week.playOn <= latest.playOn) : [])
  const previousActive = previous.standings.filter(player => player.setsPlayed > 0)
  const currentActive = throughLatest.standings.filter(player => player.setsPlayed > 0)
  for (const player of view.playerInsights) {
    const extra = players[normalize(player.playerName)]
    if (!extra) continue
    extra.repeatedPartners = player.partners.filter(partner => partner.setsPlayed > 1).length
    const before = previousActive.findIndex(item => normalize(item.playerName) === normalize(player.playerName))
    const after = currentActive.findIndex(item => normalize(item.playerName) === normalize(player.playerName))
    if (before >= 0 && after >= 0 && latest?.courts.some(court => court.sets.some(set => [...set.sideA, ...set.sideB].some(name => normalize(name) === normalize(player.playerName))))) extra.rankMovement = before - after
  }
  const pairList = [...pairs.values()].map(({ weekIds, ...pair }) => ({ ...pair, weeksPlayed: weekIds.size, gameDifferential: pair.gamesWon - pair.gamesLost, winPercentage: Math.round(pair.wins / pair.setsPlayed * 100) }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.gameDifferential - a.gameDifferential || a.key.localeCompare(b.key))
  const highlights: WeeklyAnalytics['highlights'] = []
  const unbeaten = view.standings.filter(player => player.setsPlayed >= 3 && player.losses === 0)
  if (unbeaten.length) highlights.push({ title: 'Clean sweep', detail: unbeaten.map(player => `${player.playerName} (${player.wins}–0)`).join(' · ') })
  const closest = courts.filter(court => court.sets === 3).sort((a, b) => a.gap - b.gap)[0]
  if (closest) highlights.push({ title: 'Closest court', detail: `${closest.label}: just ${closest.gap} games separated the sides across all three sets${courts.filter(court => court.sets === 3 && court.gap === closest.gap).length > 1 ? ' (tied closest)' : ''}.` })
  if (tiebreaks) highlights.push({ title: 'Tiebreak battles', detail: `${tiebreaks} sets finished 7–6. Tiebreak points are not recorded.` })
  const climbers = view.playerInsights.filter(player => (players[normalize(player.playerName)]?.rankMovement || 0) > 0)
    .sort((a, b) => (players[normalize(b.playerName)]?.rankMovement || 0) - (players[normalize(a.playerName)]?.rankMovement || 0))
  if (climbers.length) highlights.push({ title: 'Moving up', detail: `${climbers[0].playerName} climbed ${players[normalize(climbers[0].playerName)].rankMovement} places after ${latest?.playOn}.` })
  if (latest) {
    const latestPlayers = competition([latest]).standings
    const improved = latestPlayers.flatMap(player => {
      const prior = previous.standings.find(item => normalize(item.playerName) === normalize(player.playerName))
      if (!prior || prior.setsPlayed < 3 || player.setsPlayed < 3) return []
      const improvement = player.gameDifferential / player.setsPlayed - prior.gameDifferential / prior.setsPlayed
      return improvement > 0 ? [{ name: player.playerName, improvement }] : []
    }).sort((a, b) => b.improvement - a.improvement || a.name.localeCompare(b.name))
    if (improved.length) highlights.push({ title: 'Finding their stride', detail: `${improved[0].name}: game difference per set improved by ${improved[0].improvement.toFixed(1)} in the latest scored week versus their prior average. Different opponents can affect this comparison.` })
  }
  return { view, pairs: pairList, players, highlights, closeSets, tiebreaks, playedWeeks: weeks.filter(week => week.courts.some(court => court.sets.length)).length }
}
