export type TimedSetResult = {
  setNumber: number
  decidedBy: 'two_game_lead' | 'tiebreak'
  winner: 'team' | 'opponent' | ''
  /** Points are entered from your team's perspective; never counted as games. */
  tiebreakScore?: string
}

export type TimedScoreInput = {
  score: string
  outcome: 'team' | 'opponent'
  timedSets?: TimedSetResult[]
}

export function timedScoreSets(score: string) {
  return score.trim().split(/[\s,]+/).filter(Boolean)
}

export function validateTimedScore(input: TimedScoreInput): string | null {
  if (input.timedSets === undefined) return null
  if (!Array.isArray(input.timedSets) || !input.timedSets.length) return 'Choose how at least one timed set ended.'
  const tokens = timedScoreSets(input.score)
  if (!tokens.length || tokens.length > 3 || tokens.some((token) => !/^\d{1,2}[-–]\d{1,2}$/.test(token))) {
    return 'Enter up to three set scores from your team’s perspective, such as 6-4 5-4.'
  }
  const seen = new Set<number>()
  for (const set of input.timedSets) {
    if (!set || !Number.isInteger(set.setNumber) || set.setNumber < 1 || set.setNumber > tokens.length || seen.has(set.setNumber)) return 'Choose a valid set for each timed finish.'
    seen.add(set.setNumber)
    if (set.winner !== 'team' && set.winner !== 'opponent') return `Choose who won set ${set.setNumber}.`
    const [team, opponent] = tokens[set.setNumber - 1].split(/[-–]/).map(Number)
    if (Math.max(team, opponent) > 7 || Math.min(team, opponent) < 0) return 'Enter the games played in each timed set, not tiebreak points.'
    if (set.decidedBy === 'two_game_lead') {
      if (Math.abs(team - opponent) < 2 || (team > opponent ? 'team' : 'opponent') !== set.winner) return `Set ${set.setNumber} needs a two-game lead for its winner.`
    } else if (set.decidedBy === 'tiebreak') {
      if (Math.abs(team - opponent) >= 2) return `Set ${set.setNumber} has a two-game lead; use the two-game lead finish.`
      if (set.tiebreakScore) {
        if (typeof set.tiebreakScore !== 'string') return 'Enter tiebreak points as 7-5, or leave them blank.'
        const points = /^(\d{1,3})[-–](\d{1,3})$/.exec(set.tiebreakScore.trim())
        if (!points) return 'Enter tiebreak points as 7-5, or leave them blank.'
        const a = Number(points[1]), b = Number(points[2])
        if (Math.max(a, b) < 7 || Math.abs(a - b) < 2 || (a > b ? 'team' : 'opponent') !== set.winner) return `Tiebreak points must show the winner of set ${set.setNumber} winning by two.`
      }
    } else return 'Choose a two-game lead or a set tiebreak finish.'
  }
  const winners = tokens.map((token, index) => {
    const timed = input.timedSets?.find((set) => set.setNumber === index + 1)
    if (timed) return timed.winner
    const [a, b] = token.split(/[-–]/).map(Number)
    const high = Math.max(a, b), low = Math.min(a, b)
    const complete = (high === 6 && low <= 4) || (high === 7 && (low === 5 || low === 6))
      || (index === 2 && ((high === 1 && low === 0) || (high >= 10 && high - low >= 2)))
    return complete ? (a > b ? 'team' : 'opponent') : null
  })
  if (winners.includes(null)) return 'Mark each unfinished set as timed, or enter a completed set score.'
  const teamWins = winners.filter((winner) => winner === 'team').length
  const opponentWins = winners.length - teamWins
  if (teamWins === opponentWins) return 'Add the deciding set before saving the court winner.'
  if ((teamWins > opponentWins ? 'team' : 'opponent') !== input.outcome) return 'The court winner must match the set results, including timed-set tiebreaks.'
  return null
}

export function formatTimedScore(input: Pick<TimedScoreInput, 'score' | 'timedSets'>) {
  if (!input.timedSets?.length) return input.score.trim().replace(/\s+/g, ' ')
  return timedScoreSets(input.score).map((token, index) => {
    const timed = input.timedSets?.find((set) => set.setNumber === index + 1)
    if (!timed) return token
    const winner = timed.winner === 'team' ? 'your team' : 'opponents'
    const finish = timed.decidedBy === 'two_game_lead' ? 'two-game lead' : `tiebreak${timed.tiebreakScore ? ` ${timed.tiebreakScore.trim()}` : ''}`
    return `${token} (timed: ${winner} won by ${finish})`
  }).join(' ')
}

/** Read persisted timed-set annotations without treating tiebreak points as games. */
export function timedScoreAnnotations(score: string) {
  const annotations = new Map<number, { winner: 'A' | 'B'; tiebreak: boolean }>()
  const sets = [...score.matchAll(/\d+\s*[-:–—]\s*\d+(?:\s*\(([^)]*)\))?/g)]
  sets.forEach((set, index) => {
    const annotation = /^timed: (your team|opponents) won by (two-game lead|tiebreak(?: \d+[-–]\d+)?)$/.exec(set[1] || '')
    if (annotation) annotations.set(index, { winner: annotation[1] === 'your team' ? 'A' : 'B', tiebreak: annotation[2].startsWith('tiebreak') })
  })
  return annotations
}
