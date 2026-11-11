import type { TeamRoomScope } from './team-room'

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const prefix = 'Private team '
export const privateTeamLeagueKey = (id: string) => prefix + id
export function privateTeamRoomId(leagueName: string) {
  const id = leagueName.startsWith(prefix) ? leagueName.slice(prefix.length) : ''
  return idPattern.test(id) ? id : ''
}

export type PrivateTeamInput = { id: string; teamName: string; leagueLabel: string; flight: string }
export function readPrivateTeamInput(value: Record<string, unknown>): PrivateTeamInput | null {
  const { id, teamName, leagueLabel, flight } = value
  if (typeof id !== 'string' || !idPattern.test(id) ||
      typeof teamName !== 'string' || !/[a-z0-9]/i.test(teamName) || teamName.length > 100 ||
      typeof leagueLabel !== 'string' || leagueLabel.length > 100 || typeof flight !== 'string' || flight.length > 60 ||
      /\p{Cc}/u.test(teamName + leagueLabel + flight)) return null
  return { id, teamName: teamName.trim(), leagueLabel: leagueLabel.trim(), flight: flight.trim() }
}

export function teamLeagueLabel(team: Pick<TeamRoomScope, 'leagueName'> & { leagueLabel?: string }) {
  return team.leagueLabel || (privateTeamRoomId(team.leagueName) ? 'Private team' : team.leagueName)
}
