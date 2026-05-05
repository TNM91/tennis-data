export type TiqParsedSet = {
  sideAGames: number
  sideBGames: number
}

export type TiqDynamicPointsResult = {
  sideAPoints: number
  sideBPoints: number
  parsedSets: TiqParsedSet[]
  valid: boolean
}

export type TiqLeagueScoringMode = 'standard' | 'dynamic_points'

export type TiqTeamStandingSortShape = {
  teamName: string
  wins: number
  lineWins: number
  points: number
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

export function parseTennisScoreSets(score: string | null | undefined): TiqParsedSet[] {
  return cleanText(score)
    .replace(/[()]/g, ' ')
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(\d{1,2})[-\u2013](\d{1,2})/)
      if (!match) return null
      const sideAGames = Number(match[1])
      const sideBGames = Number(match[2])
      if (!Number.isFinite(sideAGames) || !Number.isFinite(sideBGames)) return null
      if (sideAGames === sideBGames) return null
      return { sideAGames, sideBGames }
    })
    .filter((set): set is TiqParsedSet => Boolean(set))
}

export function calculateDynamicPointsForSides(
  score: string | null | undefined,
  winnerSide: 'A' | 'B' | null | undefined,
): TiqDynamicPointsResult {
  const parsedSets = parseTennisScoreSets(score)
  if (!winnerSide || parsedSets.length === 0) {
    return { sideAPoints: 0, sideBPoints: 0, parsedSets, valid: false }
  }

  const sideASetWins = parsedSets.filter((set) => set.sideAGames > set.sideBGames).length
  const sideBSetWins = parsedSets.filter((set) => set.sideBGames > set.sideAGames).length
  const winnerSetWins = winnerSide === 'A' ? sideASetWins : sideBSetWins
  const loserSetWins = winnerSide === 'A' ? sideBSetWins : sideASetWins
  const sideAGames = parsedSets.reduce((sum, set) => sum + set.sideAGames, 0)
  const sideBGames = parsedSets.reduce((sum, set) => sum + set.sideBGames, 0)

  if (winnerSetWins < 2 || winnerSetWins <= loserSetWins) {
    return { sideAPoints: 0, sideBPoints: 0, parsedSets, valid: false }
  }

  const winnerPoints = loserSetWins > 0 ? 12 : 14
  const straightSetLoserGames = winnerSide === 'A' ? sideBGames : sideAGames
  const loserPoints = loserSetWins > 0 ? 8 : Math.min(8, straightSetLoserGames)

  return {
    sideAPoints: winnerSide === 'A' ? winnerPoints : loserPoints,
    sideBPoints: winnerSide === 'B' ? winnerPoints : loserPoints,
    parsedSets,
    valid: true,
  }
}

export function getDynamicPointsRulesSummary() {
  return 'Best 2 of 3 sets: straight-set winner 14, split-set winner 12, split-set loser 8, straight-set loser gets one point per game won up to 8.'
}

export function getDynamicPointsValidationMessage(
  score: string | null | undefined,
  winnerSide: 'A' | 'B' | null | undefined,
) {
  const trimmedScore = cleanText(score)
  if (!winnerSide && trimmedScore) return 'Choose a winner before calculating dynamic points.'
  if (winnerSide && !trimmedScore) return 'Dynamic points need a score.'
  if (!winnerSide || !trimmedScore) return ''

  const points = calculateDynamicPointsForSides(trimmedScore, winnerSide)
  if (points.valid) return ''
  if (points.parsedSets.length === 0) return 'Enter a standard set score for dynamic points, like 6-4, 7-5.'

  return 'Dynamic points need a best-of-3 score where the selected winner wins two sets.'
}

export function formatDynamicPointsForSides(
  score: string | null | undefined,
  winnerSide: 'A' | 'B' | null | undefined,
) {
  const points = calculateDynamicPointsForSides(score, winnerSide)
  if (!points.valid) return null

  return {
    sideAPoints: points.sideAPoints,
    sideBPoints: points.sideBPoints,
    label: `A ${points.sideAPoints} - B ${points.sideBPoints}`,
  }
}

export function compareTiqTeamStandings(
  left: TiqTeamStandingSortShape,
  right: TiqTeamStandingSortShape,
  scoringMode: TiqLeagueScoringMode,
) {
  if (scoringMode === 'dynamic_points') {
    return (
      right.points - left.points ||
      right.wins - left.wins ||
      right.lineWins - left.lineWins ||
      left.teamName.localeCompare(right.teamName)
    )
  }

  return (
    right.wins - left.wins ||
    right.lineWins - left.lineWins ||
    right.points - left.points ||
    left.teamName.localeCompare(right.teamName)
  )
}
