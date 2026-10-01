export type LeagueWeeklySettings = {
  enabled: boolean
  collectAvailability: boolean
  autoGenerateCourts: boolean
  collectPlayerStories: boolean
  leagueChatEnabled: boolean
  emailRemindersEnabled: boolean
  courtCount: number
  startTimes: string[]
}

export type LeagueWeeklyCourt = {
  courtNumber: number
  startTime: string
  players: [string, string, string, string]
  sets: Array<{
    setNumber: 1 | 2 | 3
    sideA: [string, string]
    sideB: [string, string]
  }>
}

export type LeagueWeeklyPlayerStat = {
  playerName: string
  setsPlayed: number
  setsWon: number
  gamesWon: number
  gamesLost: number
  gameDifferential: number
}

export const ROTATING_PARTNER_DOUBLES_FORMAT = {
  label: 'Rotating partner doubles',
  courtSummary: '4 players · 3 sets · every player partners once',
  scoringSummary: 'First to 6, win by 2. At 6–6, play a 7-point tiebreak and record 7–6.',
  entrySummary: 'Enter games won by each side. Do not enter tiebreak points.',
} as const

export const DEFAULT_LEAGUE_WEEKLY_SETTINGS: LeagueWeeklySettings = {
  enabled: false,
  collectAvailability: true,
  autoGenerateCourts: true,
  collectPlayerStories: true,
  leagueChatEnabled: false,
  emailRemindersEnabled: false,
  courtCount: 4,
  startTimes: ['08:00', '08:30'],
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

export function normalizeLeagueWeeklySettings(
  value: Partial<LeagueWeeklySettings> | null | undefined,
): LeagueWeeklySettings {
  const rawCourtCount = Number(value?.courtCount)
  const startTimes = Array.from(new Set(
    (Array.isArray(value?.startTimes) ? value.startTimes : DEFAULT_LEAGUE_WEEKLY_SETTINGS.startTimes)
      .map(cleanText)
      .filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)),
  )).slice(0, 8)

  return {
    enabled: normalizeBoolean(value?.enabled, false),
    collectAvailability: normalizeBoolean(value?.collectAvailability, true),
    autoGenerateCourts: normalizeBoolean(value?.autoGenerateCourts, true),
    collectPlayerStories: normalizeBoolean(value?.collectPlayerStories, true),
    leagueChatEnabled: normalizeBoolean(value?.leagueChatEnabled, false),
    emailRemindersEnabled: normalizeBoolean(value?.emailRemindersEnabled, false),
    courtCount: Number.isFinite(rawCourtCount)
      ? Math.max(1, Math.min(24, Math.round(rawCourtCount)))
      : DEFAULT_LEAGUE_WEEKLY_SETTINGS.courtCount,
    startTimes: startTimes.length ? startTimes : DEFAULT_LEAGUE_WEEKLY_SETTINGS.startTimes,
  }
}

export function buildLeagueWeeklyCourts(
  playerNames: string[],
  settings: Partial<LeagueWeeklySettings>,
): LeagueWeeklyCourt[] {
  const normalized = normalizeLeagueWeeklySettings(settings)
  const players = Array.from(new Set(playerNames.map(cleanText).filter(Boolean)))
  const courtTotal = Math.min(normalized.courtCount, Math.floor(players.length / 4))

  return Array.from({ length: courtTotal }, (_, index) => {
    const courtPlayers = players.slice(index * 4, index * 4 + 4) as [string, string, string, string]
    const [a, b, c, d] = courtPlayers
    return {
      courtNumber: index + 1,
      startTime: normalized.startTimes[index % normalized.startTimes.length],
      players: courtPlayers,
      sets: [
        { setNumber: 1, sideA: [a, b], sideB: [c, d] },
        { setNumber: 2, sideA: [a, c], sideB: [b, d] },
        { setNumber: 3, sideA: [a, d], sideB: [b, c] },
      ],
    }
  })
}

export function getLeagueWeeklyRosterSummary(playerNames: string[], settings: Partial<LeagueWeeklySettings>) {
  const normalized = normalizeLeagueWeeklySettings(settings)
  const playerCount = Array.from(new Set(playerNames.map(cleanText).filter(Boolean))).length
  const playingCount = Math.min(playerCount, normalized.courtCount * 4)
  const waitlistCount = Math.max(0, playerCount - playingCount)
  const openSpots = Math.max(0, normalized.courtCount * 4 - playingCount)
  return { playerCount, playingCount, waitlistCount, openSpots, courtCount: Math.floor(playingCount / 4) }
}

export function validateLeagueWeeklySetScore(sideAGames: number, sideBGames: number) {
  if (![sideAGames, sideBGames].every((score) => Number.isInteger(score) && score >= 0 && score <= 7)) {
    return { valid: false, message: 'Enter games won from 0 to 7 for both sides.' }
  }
  if (sideAGames === sideBGames) {
    return { valid: false, message: 'A completed set must have one winning side.' }
  }

  const winnerGames = Math.max(sideAGames, sideBGames)
  const loserGames = Math.min(sideAGames, sideBGames)
  const valid = (winnerGames === 6 && loserGames <= 4)
    || (winnerGames === 7 && (loserGames === 5 || loserGames === 6))

  return valid
    ? { valid: true, message: '' }
    : { valid: false, message: 'Use a completed score: 6–0 through 6–4, 7–5, or 7–6.' }
}

export function buildLeagueWeeklyRecap(input: {
  leagueName: string
  playOn: string
  courts: LeagueWeeklyCourt[]
  results: Array<{ courtNumber: number; setNumber: number; sideAGames: number; sideBGames: number }>
  stories: string[]
}) {
  const completedSets = input.results.filter((result) => (
    Number.isFinite(result.sideAGames) && Number.isFinite(result.sideBGames)
  ))
  const totalGames = completedSets.reduce((total, result) => total + result.sideAGames + result.sideBGames, 0)
  const closeSets = completedSets.filter((result) => Math.abs(result.sideAGames - result.sideBGames) <= 2).length
  const stories = Array.from(new Set(input.stories.map(cleanText).filter(Boolean)))

  return {
    headline: `${input.leagueName || 'League'} weekly recap`,
    summary: `${input.courts.length} court${input.courts.length === 1 ? '' : 's'}, ${completedSets.length} completed set${completedSets.length === 1 ? '' : 's'}, and ${totalGames} games played${closeSets ? ` — ${closeSets} set${closeSets === 1 ? '' : 's'} finished within two games` : ''}.`,
    stories,
    playOn: input.playOn,
  }
}

export function buildLeagueWeeklyPlayerStats(
  courts: LeagueWeeklyCourt[],
  results: Array<{ courtNumber: number; setNumber: number; sideAGames: number; sideBGames: number }>,
): LeagueWeeklyPlayerStat[] {
  const stats = new Map<string, LeagueWeeklyPlayerStat>()
  function add(playerName: string, gamesWon: number, gamesLost: number) {
    const current = stats.get(playerName) || { playerName, setsPlayed: 0, setsWon: 0, gamesWon: 0, gamesLost: 0, gameDifferential: 0 }
    current.setsPlayed += 1
    current.setsWon += gamesWon > gamesLost ? 1 : 0
    current.gamesWon += gamesWon
    current.gamesLost += gamesLost
    current.gameDifferential = current.gamesWon - current.gamesLost
    stats.set(playerName, current)
  }

  for (const result of results) {
    const set = courts.find((court) => court.courtNumber === result.courtNumber)?.sets.find((item) => item.setNumber === result.setNumber)
    if (!set) continue
    for (const player of set.sideA) add(player, result.sideAGames, result.sideBGames)
    for (const player of set.sideB) add(player, result.sideBGames, result.sideAGames)
  }

  return Array.from(stats.values()).sort((a, b) => (
    b.setsWon - a.setsWon || b.gameDifferential - a.gameDifferential || a.playerName.localeCompare(b.playerName)
  ))
}

export function orderLeagueWeeklyPlayers(playerNames: string[], stats: LeagueWeeklyPlayerStat[]) {
  const statIndex = new Map(stats.map((stat, index) => [stat.playerName.toLowerCase(), index]))
  return Array.from(new Set(playerNames.map(cleanText).filter(Boolean))).sort((a, b) => {
    const aIndex = statIndex.get(a.toLowerCase())
    const bIndex = statIndex.get(b.toLowerCase())
    if (aIndex === undefined && bIndex === undefined) return 0
    if (aIndex === undefined) return 1
    if (bIndex === undefined) return -1
    return aIndex - bIndex
  })
}
