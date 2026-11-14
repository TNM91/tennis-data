import { inferTiqBestOfThreeWinner, validateTiqTennisMatchScore } from './tiq-scoring'

export type TennisMatchOutcome = 'played' | 'walkover' | 'retirement'
export type TennisThirdSetRule = 'full_set' | 'match_tiebreak_10' | 'either'

function scoreText(input: unknown) {
  if (typeof input !== 'string' || input.length > 64 || /\p{Cc}/u.test(input)) throw Error('Check the scorecard details.')
  return input.trim().replace(/[–—]/g, '-')
}

export function readPlayedTennisScore(input: unknown) {
  const score = scoreText(input).replace(/[,\s]+/g, ', ')
  const winner = inferTiqBestOfThreeWinner(score)
  if (!winner) {
    const validation = validateTiqTennisMatchScore(score)
    throw Error(validation.message || 'Enter the deciding set only when the first two sets were split.')
  }
  return { score, winner }
}

export function readRetirementScore(input: unknown, rule: TennisThirdSetRule = 'either'): string {
  if (rule === 'either') {
    try { return readRetirementScore(input, 'full_set') }
    catch (error) {
      try { return readRetirementScore(input, 'match_tiebreak_10') }
      catch { throw error }
    }
  }
  const score = scoreText(input).split(/[,\s]+/).filter(Boolean).join(', ')
  if (!score) return ''
  const parts = score.split(', ')
  const invalid = () => Error('Enter only the score when play stopped, like 6-4, 2-1, or leave it blank.')
  if (parts.length > 3) throw invalid()
  let aWins = 0, bWins = 0
  for (const [index, part] of parts.entries()) {
    const match = /^(0|[1-9]\d?)-(0|[1-9]\d?)(?:\(\d{1,2}(?:-\d{1,2})?\))?$/.exec(part)
    if (!match) throw invalid()
    const a = Number(match[1]), b = Number(match[2]), high = Math.max(a, b), low = Math.min(a, b), gap = high - low
    const setComplete = high === 6 && low <= 4 || high === 7 && (low === 5 || low === 6)
    const setOpen = high <= 5 || high === 6 && (low === 5 || low === 6)
    const breakerComplete = high >= 10 && gap >= 2 && (high === 10 || gap === 2)
    const breakerOpen = high < 10 || gap <= 1
    const fullSet = index < 2 || rule === 'full_set'
    if (index === 2 && !(aWins === 1 && bWins === 1) ||
        part.includes('(') && !(high === 7 && low === 6 && fullSet)) throw invalid()
    const complete = fullSet ? setComplete : breakerComplete
    const unfinished = fullSet ? setOpen : breakerOpen
    if (complete) { if (a > b) aWins++; else bWins++ }
    else if (!unfinished || index !== parts.length - 1) throw invalid()
    if (aWins === 2 || bWins === 2) throw Error('This score is complete. Choose Played to record it.')
  }
  return score
}

export function tennisMatchScoreText(score: string, outcome?: TennisMatchOutcome) {
  return outcome === 'walkover' ? 'Walkover' : outcome === 'retirement'
    ? ['Retired', score].filter(Boolean).join(' · ') : score
}
