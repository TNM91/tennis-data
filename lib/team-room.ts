export type TeamRoomScope = {
  teamName: string
  leagueName: string
  flight: string
}

export type TeamRoomMatchContext = {
  date: string
  opponent: string
  time: string
  facility: string
  messageId: string
  court: string
  player: string
  arrivalAction: 'message' | ''
}

export function normalizeTeamRoomKey(value: string | null | undefined) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function buildTeamRoomScopeId(scope: Partial<TeamRoomScope>) {
  return [scope.teamName, scope.leagueName, scope.flight]
    .map(normalizeTeamRoomKey)
    .join('__')
}

export function buildTeamRoomHref(scope: Partial<TeamRoomScope & TeamRoomMatchContext> = {}) {
  const params = new URLSearchParams()
  if (scope.teamName?.trim()) params.set('team', scope.teamName.trim())
  if (scope.leagueName?.trim()) params.set('league', scope.leagueName.trim())
  if (scope.flight?.trim()) params.set('flight', scope.flight.trim())
  if (scope.date?.trim()) params.set('date', scope.date.trim())
  if (scope.opponent?.trim()) params.set('opponent', scope.opponent.trim())
  if (scope.time?.trim()) params.set('time', scope.time.trim())
  if (scope.facility?.trim()) params.set('facility', scope.facility.trim())
  if (scope.messageId?.trim()) params.set('message', scope.messageId.trim())
  if (scope.court?.trim()) params.set('court', scope.court.trim())
  if (scope.player?.trim()) params.set('player', scope.player.trim())
  if (scope.arrivalAction?.trim()) params.set('arrival', scope.arrivalAction.trim())
  const query = params.toString()
  return query ? `/team-room?${query}` : '/team-room'
}

export function canManageTeamRoom(roles: string[] | null | undefined) {
  return Boolean(roles?.includes('captain') || roles?.includes('co_captain'))
}
