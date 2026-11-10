import { isValidCalendarDate } from './calendar-date'
import { validateTiqTennisMatchScore } from './tiq-scoring'

export const courtAccountId = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
export const courtLeagueId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value)
export const courtNumber = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 30
export const courtScorecardKey = (league: string, fixture: string, court: number) => `league:${league}:${fixture}:court:${court}`

export type CourtFormat = 'singles' | 'doubles'
export type CourtMember = { id: string; name: string }
export type CourtSubmission = { court: number; format: CourtFormat; a: string[]; b: string[]; winner: 'A' | 'B'; score: string; revision: string; expected: string | null }
export type CourtFixture = { league: string; fixture: string; date: string; teamA: string; teamB: string; side: 'A' | 'B' }
export type CaptainCourt = Omit<CourtSubmission, 'expected'>
export type CourtDesk = CourtFixture & { captain: boolean; membersA: CourtMember[]; membersB: CourtMember[]; courts: CaptainCourt[] }
export type PostedCourtScorecard = {
  id: string; calendar_match_id: string; match_date: string; opponent: string; format: CourtFormat;
  outcome: 'Won' | 'Lost'; score: string; scoreOrder: string; court: number
}

export function readCourtSubmission(value: Record<string, unknown>): CourtSubmission {
  const { court, format, a, b, winner, revision, expected } = value
  const score = typeof value.score === 'string' ? value.score.trim() : ''
  if (Object.keys(value).length !== 8 || !courtNumber(court) || format !== 'singles' && format !== 'doubles' ||
      winner !== 'A' && winner !== 'B' || !courtAccountId(revision) || expected !== null && !courtAccountId(expected) ||
      !Array.isArray(a) || !Array.isArray(b)) throw Error('Check the court, players, and result.')
  const size = format === 'singles' ? 1 : 2
  const accounts = [...a, ...b]
  if (a.length !== size || b.length !== size || !accounts.every(courtAccountId) || new Set(accounts).size !== accounts.length) {
    throw Error('Choose a different confirmed player for every spot on the court.')
  }
  if (!score || score.length > 64 || /\p{Cc}/u.test(score)) throw Error('Enter the set scores in team order.')
  const result = validateTiqTennisMatchScore(score, winner)
  if (!result.valid) throw Error(result.message)
  return { court, format, a, b, winner, score, revision, expected }
}

export const courtDate = (value: unknown): value is string => typeof value === 'string' && isValidCalendarDate(value)
