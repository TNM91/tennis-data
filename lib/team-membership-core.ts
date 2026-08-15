import { normalizeTeamName } from './captain-formatters'

export type TeamMembershipProfile = {
  linked_player_id: string | null
  linked_player_name: string | null
  linked_team_name: string | null
  linked_league_name: string | null
  linked_flight?: string | null
}

export type TeamRosterMembershipRow = {
  team_name: string | null
  league_name: string | null
  flight: string | null
  player_id: string | null
}

export type TeamMembership = {
  teamName: string
  leagueName: string
  flight: string
  linkedPlayerId: string
  source: 'profile' | 'roster'
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function membershipKey(membership: Pick<TeamMembership, 'teamName' | 'leagueName' | 'flight'>) {
  return [
    normalizeTeamName(membership.teamName),
    cleanText(membership.leagueName).toLowerCase(),
    cleanText(membership.flight).toLowerCase(),
  ].join('__')
}

export function buildTeamMemberships(
  profile: TeamMembershipProfile | null,
  rosterRows: TeamRosterMembershipRow[],
): TeamMembership[] {
  const linkedPlayerId = cleanText(profile?.linked_player_id)
  const memberships = new Map<string, TeamMembership>()

  const profileTeamName = cleanText(profile?.linked_team_name)
  if (profileTeamName) {
    const membership: TeamMembership = {
      teamName: profileTeamName,
      leagueName: cleanText(profile?.linked_league_name),
      flight: cleanText(profile?.linked_flight),
      linkedPlayerId,
      source: 'profile',
    }
    memberships.set(membershipKey(membership), membership)
  }

  for (const row of rosterRows) {
    const teamName = cleanText(row.team_name)
    if (!teamName) continue

    const membership: TeamMembership = {
      teamName,
      leagueName: cleanText(row.league_name),
      flight: cleanText(row.flight),
      linkedPlayerId: cleanText(row.player_id) || linkedPlayerId,
      source: 'roster',
    }
    memberships.set(membershipKey(membership), membership)
  }

  return [...memberships.values()].sort((left, right) => {
    const teamComparison = left.teamName.localeCompare(right.teamName)
    if (teamComparison !== 0) return teamComparison
    return left.leagueName.localeCompare(right.leagueName)
  })
}

export function isProfileLinkedToTeam(
  profile: TeamMembershipProfile | null,
  rosterPlayerIds: Array<string | null | undefined>,
  teamName: string,
  leagueName?: string | null,
  flight?: string | null,
) {
  const linkedPlayerId = cleanText(profile?.linked_player_id)
  const rosterMatch = Boolean(
    linkedPlayerId && rosterPlayerIds.some((playerId) => cleanText(playerId) === linkedPlayerId),
  )
  if (rosterMatch) return true

  if (normalizeTeamName(profile?.linked_team_name) !== normalizeTeamName(teamName)) return false

  const linkedLeague = cleanText(profile?.linked_league_name).toLowerCase()
  const currentLeague = cleanText(leagueName).toLowerCase()
  if (linkedLeague && currentLeague && linkedLeague !== currentLeague) return false

  const linkedFlight = cleanText(profile?.linked_flight).toLowerCase()
  const currentFlight = cleanText(flight).toLowerCase()
  if (linkedFlight && currentFlight && linkedFlight !== currentFlight) return false

  return Boolean(cleanText(profile?.linked_team_name))
}
