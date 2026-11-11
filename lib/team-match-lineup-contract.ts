import { fixtureId } from './team-fixtures-contract'

export const maxTeamLineupCourts = 30
export type MatchLineupCourt = { format: 'singles' | 'doubles'; players: string[] }
export type SavedTeamLineup = { version: string; courts: MatchLineupCourt[]; names: Record<string, string> }
export type TeamLineupChange = { revision: string; version: string; expected: string | null; courts: MatchLineupCourt[] }

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
      version === expected || !courts) return null
  return { revision, version, expected, courts }
}

export function readSavedTeamLineup(value: unknown): SavedTeamLineup | null {
  if (value == null) return null
  const { version, names, courts: rawCourts } = value as Partial<SavedTeamLineup>
  const courts = readCourts(rawCourts)
  if (!fixtureId(version) || !courts || !names || typeof names !== 'object' || Array.isArray(names)) throw Error('Invalid saved lineup')
  const players = courts.flatMap(court => court.players)
  if (Object.keys(names).length !== players.length || players.some(id =>
    !Object.hasOwn(names, id) || typeof names[id] !== 'string' || !names[id].trim() || names[id].length > 100)) {
    throw Error('Invalid saved lineup names')
  }
  return { version, courts, names }
}
