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

  if (winnerSetWins <= loserSetWins) {
    return { sideAPoints: 0, sideBPoints: 0, parsedSets, valid: false }
  }

  const winnerPoints = loserSetWins > 0 ? 12 : 14
  const loserPoints = loserSetWins > 0 ? 8 : winnerSide === 'A' ? sideBGames : sideAGames

  return {
    sideAPoints: winnerSide === 'A' ? winnerPoints : loserPoints,
    sideBPoints: winnerSide === 'B' ? winnerPoints : loserPoints,
    parsedSets,
    valid: true,
  }
}

export function getDynamicPointsRulesSummary() {
  return 'Best 2 of 3 sets: straight-set winner 14, split-set winner 12, split-set loser 8, straight-set loser gets one point per game won.'
}
