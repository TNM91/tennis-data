import { validateTimedScore, type TimedScoreInput } from './timed-score'

export type ScorecardCourtEntry = TimedScoreInput & {
  matchType: 'singles' | 'doubles'
  teamPlayers: string[]
  opponentPlayers: string[]
  resultType: 'played' | 'default' | 'retired'
  defaultKnownBeforeMatch: boolean | null
  retiredPlayer: string
  retirementReason: 'injury' | 'illness' | 'other' | null
  retirementKnownBeforeMatch: boolean | null
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function courtEntryIssue(court: ScorecardCourtEntry): string | null {
  if (court.resultType === 'default') return court.defaultKnownBeforeMatch === null ? 'Choose when the default was known.' : null
  const playerCount = court.matchType === 'doubles' ? 2 : 1
  if (court.teamPlayers.slice(0, playerCount).filter((name) => normalizeName(name)).length !== playerCount) return 'Select each player on your team.'
  if (court.opponentPlayers.slice(0, playerCount).filter((name) => normalizeName(name)).length !== playerCount) return 'Enter each opponent’s name.'
  if (!court.score.trim()) return 'Enter the score.'
  const timedIssue = validateTimedScore(court)
  if (timedIssue) return timedIssue
  if (court.resultType === 'retired') {
    const retiredSidePlayers = court.outcome === 'team' ? court.opponentPlayers : court.teamPlayers
    if (!retiredSidePlayers.map(normalizeName).includes(normalizeName(court.retiredPlayer))) return 'Select the player who retired.'
    if (court.retirementReason === null) return 'Choose why play stopped.'
    if (court.retirementKnownBeforeMatch === null) return 'Choose when the retirement issue became known.'
  }
  return null
}

export function isCourtEntryComplete(court: ScorecardCourtEntry) {
  return courtEntryIssue(court) === null
}
