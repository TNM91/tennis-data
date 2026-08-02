export type TeamRoomScope = {
  teamName: string
  leagueName: string
  flight: string
}

export function normalizeTeamRoomKey(value: string | null | undefined) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function buildTeamRoomScopeId(scope: Partial<TeamRoomScope>) {
  return [scope.teamName, scope.leagueName, scope.flight]
    .map(normalizeTeamRoomKey)
    .join('__')
}

export function buildTeamRoomHref(scope: Partial<TeamRoomScope> = {}) {
  const params = new URLSearchParams()
  if (scope.teamName?.trim()) params.set('team', scope.teamName.trim())
  if (scope.leagueName?.trim()) params.set('league', scope.leagueName.trim())
  if (scope.flight?.trim()) params.set('flight', scope.flight.trim())
  const query = params.toString()
  return query ? `/team-room?${query}` : '/team-room'
}

export function canManageTeamRoom(roles: string[] | null | undefined) {
  return Boolean(roles?.includes('captain') || roles?.includes('co_captain'))
}
