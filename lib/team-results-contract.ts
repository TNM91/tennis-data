import { fixtureId, readReviewedNextMatch, type ReviewedNextMatch } from './team-fixtures-contract'
import { inferTiqBestOfThreeWinner } from './tiq-scoring'
import { readSavedTeamLineup, type SavedTeamLineup } from './team-match-lineup-contract'

export type TeamResultScore = { revision: string; won: number; lost: number; courtScores?: string[] }
export type TeamResultEntry = { fixtureId: string; match: ReviewedNextMatch; score: TeamResultScore | null; plannedLineup?: SavedTeamLineup }
export type TeamResultChange = TeamResultScore & { fixtureId: string; expected: string | null }
export type TeamRecord = { wins: number; losses: number; ties: number }
export type TeamResults = { canEdit: boolean; entries: TeamResultEntry[]; more: boolean; record?: TeamRecord }

export function readTeamRecord(value: unknown): TeamRecord {
  const row = value as Record<string, unknown> | null
  const wins = row?.wins, losses = row?.losses, ties = row?.ties
  const valid = (count: unknown): count is number => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
  if (!valid(wins) || !valid(losses) || !valid(ties)) throw Error('Invalid team record')
  return { wins, losses, ties }
}

export function teamResultOutcome(score: TeamResultScore): keyof TeamRecord {
  return score.won === score.lost ? 'ties' : score.won > score.lost ? 'wins' : 'losses'
}

export const maxTeamResultCourts = 30
export const teamCourtDefaults = { 'W-DEFAULT': 'Won by default', 'L-DEFAULT': 'Lost by default' } as const
export type TeamCourtDefault = keyof typeof teamCourtDefaults
export const isTeamCourtDefault = (value: unknown): value is TeamCourtDefault =>
  typeof value === 'string' && Object.hasOwn(teamCourtDefaults, value)

export function readTeamCourtScore(value: unknown) {
  if (typeof value !== 'string' || value.length > 64 || /\p{Cc}/u.test(value)) return null
  if (isTeamCourtDefault(value)) return { score: value, won: value === 'W-DEFAULT', defaulted: true } as const
  const score = value.trim().replace(/–/g, '-').split(/[,\s]+/).filter(Boolean).join(', ')
  const winner = score.length <= 64 ? inferTiqBestOfThreeWinner(score) : undefined
  return winner ? { score, won: winner === 'A', defaulted: false } as const : null
}

export function readTeamCourtTally(value: unknown) {
  if (!Array.isArray(value) || !value.length || value.length > maxTeamResultCourts) return null
  const courtScores: string[] = []
  let won = 0
  for (const input of value) {
    const court = readTeamCourtScore(input)
    if (!court) return null
    courtScores.push(court.score)
    if (court.won) won++
  }
  return { won, lost: courtScores.length - won, courtScores }
}

function readScore(value: Record<string, unknown>): TeamResultScore | null {
  const { revision, won, lost, courtScores } = value
  if (!fixtureId(revision) || typeof won !== 'number' || typeof lost !== 'number' ||
      !Number.isInteger(won) || !Number.isInteger(lost) || won < 0 || lost < 0 ||
      won > 99 || lost > 99 || won + lost === 0) return null
  if (courtScores === undefined) return { revision, won, lost }
  if (Array.isArray(courtScores) && !courtScores.length) return { revision, won, lost, courtScores: [] }
  const tally = readTeamCourtTally(courtScores)
  if (!tally || tally.won !== won || tally.lost !== lost) return null
  return { revision, ...tally }
}

export function readTeamResultChange(value: Record<string, unknown>): TeamResultChange | null {
  const { fixtureId: fixture, expected } = value
  const score = readScore(value)
  if (!score || !fixtureId(fixture) || expected !== null && !fixtureId(expected) || score.revision === expected) return null
  return { ...score, fixtureId: fixture, expected }
}

export function readTeamResultEntry(value: unknown): TeamResultEntry {
  const row = value as Record<string, unknown> | null
  const match = readReviewedNextMatch(row?.match)
  if (!row || !fixtureId(row.fixtureId) || !match) throw Error('Invalid team fixture')
  const score = row.score && typeof row.score === 'object' ? readScore(row.score as Record<string, unknown>) : null
  if (row.score !== null && !score) throw Error('Invalid team score')
  const plannedLineup = readSavedTeamLineup(row.plannedLineup)
  return { fixtureId: row.fixtureId, match, score, ...(plannedLineup ? { plannedLineup } : {}) }
}

export function readTeamResults(value: unknown): TeamResults {
  const row = value as Record<string, unknown> | null
  if (!row || typeof row.canEdit !== 'boolean' || typeof row.more !== 'boolean' ||
      !Array.isArray(row.entries) || row.entries.length > 20) throw Error('Invalid team results')
  const entries = row.entries.map(readTeamResultEntry)
  if (new Set(entries.map(entry => entry.fixtureId)).size !== entries.length ||
      !row.canEdit && entries.some(entry => !entry.score || entry.plannedLineup)) throw Error('Invalid team results')
  const record = row.record === undefined ? undefined : readTeamRecord(row.record)
  if (record) {
    const recent = { wins: 0, losses: 0, ties: 0 }
    for (const entry of entries) if (entry.score) recent[teamResultOutcome(entry.score)]++
    for (const outcome of ['wins', 'losses', 'ties'] as const) {
      if (record[outcome] < recent[outcome] || !row.more && record[outcome] !== recent[outcome]) throw Error('Invalid team record')
    }
  }
  return { canEdit: row.canEdit, more: row.more, entries, ...(record ? { record } : {}) }
}
