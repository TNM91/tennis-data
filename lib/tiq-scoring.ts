export type TiqParsedSet = {
  sideAGames: number
  sideBGames: number
  kind?: 'set' | 'match_tiebreak'
}

export type TiqDynamicPointsResult = {
  sideAPoints: number
  sideBPoints: number
  parsedSets: TiqParsedSet[]
  valid: boolean
}

export type TiqLeagueScoringMode = 'standard' | 'dynamic_points'

export type TiqScoreValidationResult = {
  valid: boolean
  message: string
  parsedSets: TiqParsedSet[]
}

export type TiqTeamStandingSortShape = {
  teamName: string
  wins: number
  lineWins: number
  points: number
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function isMatchTiebreakSet(sideAGames: number, sideBGames: number) {
  const winnerGames = Math.max(sideAGames, sideBGames)
  const loserGames = Math.min(sideAGames, sideBGames)
  return (winnerGames === 1 && loserGames === 0) || (winnerGames >= 10 && winnerGames - loserGames >= 2)
}

function isValidCompletedSet(sideAGames: number, sideBGames: number, setIndex: number) {
  if (sideAGames === sideBGames) return false

  const winnerGames = Math.max(sideAGames, sideBGames)
  const loserGames = Math.min(sideAGames, sideBGames)
  const isDecidingSet = setIndex === 2
  if (isMatchTiebreakSet(sideAGames, sideBGames)) return isDecidingSet

  if (winnerGames === 6 && loserGames <= 4) return true
  if (winnerGames === 7 && (loserGames === 5 || loserGames === 6)) return true
  return false
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

export function validateTiqTennisMatchScore(
  score: string | null | undefined,
  winnerSide?: 'A' | 'B' | null,
): TiqScoreValidationResult {
  const trimmedScore = cleanText(score).replace(/\u2013/g, '-')
  if (!trimmedScore) {
    return { valid: false, message: 'Enter the match score before saving the result.', parsedSets: [] }
  }

  const parts = trimmedScore
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length < 2 || parts.length > 3) {
    return {
      valid: false,
      message: 'Enter a completed best-of-3 score, like 6-4, 7-6 or 6-4, 4-6, 10-8.',
      parsedSets: [],
    }
  }

  const parsedSets: TiqParsedSet[] = []
  for (let index = 0; index < parts.length; index += 1) {
    const match = parts[index].match(/^(\d{1,2})[-](\d{1,2})(?:\(\d{1,2}(?:[-]\d{1,2})?\))?$/)
    if (!match) {
      return {
        valid: false,
        message: 'Use set scores only, like 6-4, 7-6, 6-7, 10-8, or 1-0.',
        parsedSets,
      }
    }

    const sideAGames = Number(match[1])
    const sideBGames = Number(match[2])
    if (!isValidCompletedSet(sideAGames, sideBGames, index)) {
      return {
        valid: false,
        message:
          sideAGames === sideBGames
            ? 'A tennis set cannot end tied. Use 7-6 for a tiebreak set, not 7-7.'
            : 'Use completed set scores: 6-0 through 6-4, 7-5, 7-6, or a deciding 10-point tiebreak like 10-8.',
        parsedSets,
      }
    }

    parsedSets.push({
      sideAGames,
      sideBGames,
      kind: isMatchTiebreakSet(sideAGames, sideBGames) ? 'match_tiebreak' : 'set',
    })
  }

  const sideASetWins = parsedSets.filter((set) => set.sideAGames > set.sideBGames).length
  const sideBSetWins = parsedSets.filter((set) => set.sideBGames > set.sideAGames).length
  if (sideASetWins + sideBSetWins !== parsedSets.length || Math.max(sideASetWins, sideBSetWins) !== 2) {
    return {
      valid: false,
      message: 'Enter the full match score with one side winning two sets.',
      parsedSets,
    }
  }

  if (winnerSide) {
    const winnerSetWins = winnerSide === 'A' ? sideASetWins : sideBSetWins
    if (winnerSetWins !== 2) {
      return {
        valid: false,
        message: 'The selected winner must match the player who won two sets in the score.',
        parsedSets,
      }
    }
  }

  return { valid: true, message: '', parsedSets }
}

export function calculateDynamicPointsForSides(
  score: string | null | undefined,
  winnerSide: 'A' | 'B' | null | undefined,
): TiqDynamicPointsResult {
  const validation = validateTiqTennisMatchScore(score, winnerSide)
  const parsedSets = validation.parsedSets
  if (!winnerSide || !validation.valid) {
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
  return 'Best 2 of 3 sets. The third set is optional and may be played out or entered as a 10-point match tiebreak, such as 1-0 or 10-8. Straight-set winner 14, split-set winner 12, split-set loser 8, straight-set loser gets one point per game won up to 8.'
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
  const looseParsedSets = parseTennisScoreSets(trimmedScore)
  if (points.parsedSets.length === 0 && looseParsedSets.length === 0) {
    return 'Enter a standard set score for dynamic points, like 6-4, 7-5.'
  }

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
