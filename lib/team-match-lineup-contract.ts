import { fixtureId } from './team-fixtures-contract'
import {readSharedTacticsBoard, type SharedTacticsBoard} from './shared-tactics'
import {readTacticalBoardReference, type TacticalBoardReference} from './tactical/board-reference'

export const maxTeamLineupCourts = 30
export type MatchLineupCourt = { format: 'singles' | 'doubles'; players: string[] }
export type SavedTeamLineup = { version: string; courts: MatchLineupCourt[]; names: Record<string, string>; tactics?: SharedTacticsBoard }
export type TeamLineupChange = { revision: string; version: string; expected: string | null; courts: MatchLineupCourt[]; tactics?: TacticalBoardReference | null; publish?: boolean }
export const lineupReplyLabels = { confirmed: 'Confirmed', needs_change: 'Needs a change' } as const
export type LineupReplyChoice = keyof typeof lineupReplyLabels
export type TeamLineupReply = { id: string; version: string; choice: LineupReplyChoice }
export type TeamLineupReplyChange = TeamLineupReply & { revision: string; expected: string | null }

export function readTeamLineupReply(value: unknown): TeamLineupReply {
  const row = value as Partial<TeamLineupReply> | null
  if (!row || !fixtureId(row.id) || !fixtureId(row.version) || typeof row.choice !== 'string' ||
      !Object.hasOwn(lineupReplyLabels, row.choice)) throw Error('Invalid lineup confirmation')
  return { id: row.id, version: row.version, choice: row.choice }
}

export function readTeamLineupReplyChange(row: Record<string, unknown>): TeamLineupReplyChange | null {
  try {
    const reply = readTeamLineupReply(row)
    if (!fixtureId(row.revision) || row.expected !== null && !fixtureId(row.expected) || row.expected === reply.id) return null
    return { ...reply, revision: row.revision, expected: row.expected }
  } catch { return null }
}

function readCourts(value: unknown): MatchLineupCourt[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxTeamLineupCourts) return null
  const courts: MatchLineupCourt[] = [], seen = new Set<string>()
  for (const item of value) {
    const { format, players } = (item ?? {}) as Partial<MatchLineupCourt>
    if ((format !== 'singles' && format !== 'doubles') || !Array.isArray(players) ||
        players.length !== (format === 'singles' ? 1 : 2)) return null
    for (const id of players) {
      if (!fixtureId(id) || seen.has(id)) return null
      seen.add(id)
    }
    courts.push({ format, players: [...players] })
  }
  return courts
}

export function readTeamLineupChange(row: Record<string, unknown>): TeamLineupChange | null {
  const { revision, version, expected } = row
  const courts = readCourts(row.courts)
  if (!fixtureId(revision) || !fixtureId(version) || (expected !== null && !fixtureId(expected)) ||
      version === expected || !courts || row.publish !== undefined && typeof row.publish !== 'boolean') return null
  try {
    return { revision, version, expected, courts,
      ...(row.tactics === undefined ? {} : {tactics: row.tactics === null ? null : readTacticalBoardReference(row.tactics)}),
      ...(row.publish === undefined ? {} : {publish: row.publish as boolean}) }
  } catch { return null }
}

export function readSavedTeamLineup(value: unknown): SavedTeamLineup | null {
  if (value == null) return null
  const { version, names, courts: rawCourts, tactics } = value as Partial<SavedTeamLineup>
  const courts = readCourts(rawCourts)
  if (!fixtureId(version) || !courts || !names || typeof names !== 'object' || Array.isArray(names)) throw Error('Invalid saved lineup')
  const players = courts.flatMap(court => court.players)
  if (Object.keys(names).length !== players.length || players.some(id =>
    !Object.hasOwn(names, id) || typeof names[id] !== 'string' || !names[id].trim() || names[id].length > 100)) {
    throw Error('Invalid saved lineup names')
  }
  return { version, courts, names, ...(tactics == null ? {} : {tactics: readSharedTacticsBoard(tactics)}) }
}
