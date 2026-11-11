import { fixtureId } from './team-fixtures-contract'
import { readSavedTeamLineup, type SavedTeamLineup } from './team-match-lineup-contract'

export const teamReplyLabels = { in: 'In', maybe: 'Maybe', out: 'Out' } as const
export type TeamMatchChoice = keyof typeof teamReplyLabels
export type TeamMatchReply = { id: string; choice: TeamMatchChoice }
export type TeamMatchReplyChange = TeamMatchReply & { revision: string; expected: string | null }
export type TeamLineupPlayer = { id: string; name: string; choice: TeamMatchChoice | null }
export type TeamMatchReplies = {
  own: TeamMatchReply | null
  team?: { name: string; choice: TeamMatchChoice }[]
  awaiting?: string[]
  awaitingTeammates?: number
  rosterComplete?: boolean
  lineupRoster?: TeamLineupPlayer[]
  savedLineup?: SavedTeamLineup
}

export const isTeamMatchChoice = (choice: unknown): choice is TeamMatchChoice =>
  typeof choice === 'string' && Object.hasOwn(teamReplyLabels, choice)

function readReply(value: unknown): TeamMatchReply {
  const row = value as Partial<TeamMatchReply> | null
  if (!row || !fixtureId(row.id) || !isTeamMatchChoice(row.choice)) throw Error('Invalid match reply')
  return { id: row.id, choice: row.choice }
}

export function readTeamMatchReplyChange(row: Record<string, unknown>): TeamMatchReplyChange | null {
  if (!fixtureId(row.revision) || !fixtureId(row.id) || !isTeamMatchChoice(row.choice) ||
      row.expected !== null && !fixtureId(row.expected) || row.id === row.expected) return null
  return { revision: row.revision, id: row.id, choice: row.choice, expected: row.expected }
}

export function readTeamMatchReplies(value: unknown): TeamMatchReplies {
  const row = value as Partial<TeamMatchReplies> | null
  if (!row || typeof row !== 'object') throw Error('Invalid availability')
  const own = row.own === null ? null : readReply(row.own)
  if (row.team === undefined) return { own }
  if (!Array.isArray(row.team) || row.team.length > 100) throw Error('Invalid team availability')
  const validName = (name: unknown): name is string => typeof name === 'string' && Boolean(name.trim()) && name.length <= 100
  const team = row.team.map(item => {
    if (!item || !validName(item.name) || !isTeamMatchChoice(item.choice)) {
      throw Error('Invalid teammate reply')
    }
    return { name: item.name, choice: item.choice }
  })
  if (row.awaiting === undefined) return { own, team }
  if (!Array.isArray(row.awaiting) || team.length + row.awaiting.length > 100 ||
      !row.awaiting.every(validName) || typeof row.rosterComplete !== 'boolean') throw Error('Invalid availability roster')
  const awaitingTeammates = row.awaitingTeammates
  if (awaitingTeammates !== undefined &&
      (!Number.isInteger(awaitingTeammates) || awaitingTeammates < 0 || awaitingTeammates > row.awaiting.length)) {
    throw Error('Invalid availability count')
  }
  let lineupRoster: TeamLineupPlayer[] | undefined
  if (row.lineupRoster !== undefined) {
    const roster = row.lineupRoster
    if (!Array.isArray(roster) || roster.length !== team.length + row.awaiting.length ||
        roster.some(player => !player || !fixtureId(player.id) || !validName(player.name) ||
          player.choice !== null && !isTeamMatchChoice(player.choice)) ||
        new Set(roster.map(player => player.id)).size !== roster.length) throw Error('Invalid lineup roster')
    lineupRoster = roster.map(({ id, name, choice }) => ({ id, name, choice }))
  }
  const savedLineup = readSavedTeamLineup(row.savedLineup)
  return { own, team, awaiting: row.awaiting, awaitingTeammates, rosterComplete: row.rosterComplete,
    ...(lineupRoster ? { lineupRoster } : {}), ...(savedLineup ? { savedLineup } : {}) }
}
