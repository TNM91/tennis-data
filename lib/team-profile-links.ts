export type TeamConnectionRole = 'player' | 'captain' | 'co_captain'
export type TeamConnectionStatus = 'pending' | 'accepted' | 'declined' | 'unlinked'
export type TeamConnectionSourceType = 'roster_contact' | 'roster_membership' | 'tiq_entry' | 'manual_invite'

export type TeamConnection = {
  id: string
  sourceType: TeamConnectionSourceType
  sourceRecordId: string
  teamName: string
  leagueName: string
  flight: string
  role: TeamConnectionRole
  status: TeamConnectionStatus
  matchedPlayerId: string
  updatedAt: string
}

export type TeamConnectionContactRow = {
  id?: string | null
  captain_user_id?: string | null
  team_name?: string | null
  normalized_team_name?: string | null
  league_name?: string | null
  flight?: string | null
  role?: string | null
  email?: string | null
  normalized_name?: string | null
  updated_at?: string | null
}

export type TeamConnectionRosterRow = {
  id?: string | null
  team_name?: string | null
  normalized_team_name?: string | null
  league_name?: string | null
  flight?: string | null
  player_id?: string | null
  updated_at?: string | null
}

export type TeamProfileLinkRow = {
  id?: string | null
  team_name?: string | null
  normalized_team_name?: string | null
  league_name?: string | null
  flight?: string | null
  team_role?: string | null
  matched_player_id?: string | null
  source_type?: string | null
  source_record_id?: string | null
  status?: string | null
  updated_at?: string | null
}

export function normalizeTeamConnectionRole(value: string | null | undefined): TeamConnectionRole {
  const normalized = cleanText(value).toLowerCase().replace(/[\s-]+/g, '_')
  if (normalized === 'captain') return 'captain'
  if (normalized === 'co_captain' || normalized === 'cocaptain') return 'co_captain'
  return 'player'
}

export function getTeamConnectionRoleLabel(role: TeamConnectionRole) {
  if (role === 'captain') return 'captain'
  if (role === 'co_captain') return 'co-captain'
  return 'player'
}

export function normalizeTeamConnectionStatus(value: string | null | undefined): Exclude<TeamConnectionStatus, 'pending'> {
  if (value === 'declined' || value === 'unlinked') return value
  return 'accepted'
}

export function normalizeTeamConnectionSourceType(value: string | null | undefined): TeamConnectionSourceType {
  if (value === 'roster_membership' || value === 'tiq_entry' || value === 'manual_invite') return value
  return 'roster_contact'
}

export function buildTeamConnectionKey(input: {
  teamName?: string | null
  leagueName?: string | null
  flight?: string | null
  role?: TeamConnectionRole | string | null
}) {
  return [
    normalizeKey(input.teamName),
    normalizeKey(input.leagueName),
    normalizeKey(input.flight),
    normalizeTeamConnectionRole(input.role),
  ].join('__')
}

export function buildTeamConnectionScopeKey(input: {
  teamName?: string | null
  leagueName?: string | null
  flight?: string | null
}) {
  return [
    normalizeKey(input.teamName),
    normalizeKey(input.leagueName),
    normalizeKey(input.flight),
  ].join('__')
}

export function buildTeamConnections(input: {
  contacts?: TeamConnectionContactRow[]
  rosterMemberships?: TeamConnectionRosterRow[]
  savedLinks?: TeamProfileLinkRow[]
}) {
  const savedByKey = new Map<string, TeamConnection>()
  for (const row of input.savedLinks || []) {
    const connection = mapSavedTeamConnection(row)
    if (connection) savedByKey.set(buildTeamConnectionScopeKey(connection), connection)
  }

  const discoveredByKey = new Map<string, TeamConnection>()
  for (const row of input.rosterMemberships || []) {
    const connection = mapRosterMembershipCandidate(row)
    if (connection) discoveredByKey.set(buildTeamConnectionScopeKey(connection), connection)
  }

  for (const row of input.contacts || []) {
    const connection = mapRosterContactCandidate(row)
    if (!connection) continue
    const key = buildTeamConnectionScopeKey(connection)
    const current = discoveredByKey.get(key)
    if (!current || getRolePriority(connection.role) > getRolePriority(current.role)) {
      discoveredByKey.set(key, connection)
    }
  }

  for (const [key, saved] of savedByKey) {
    const discovered = discoveredByKey.get(key)
    const isRoleUpgrade =
      saved.status === 'accepted' &&
      discovered &&
      getRolePriority(discovered.role) > getRolePriority(saved.role)
    if (!isRoleUpgrade) discoveredByKey.delete(key)
  }

  return {
    pending: [...discoveredByKey.values()].sort(compareTeamConnections),
    connections: [...savedByKey.values()].sort(compareTeamConnections),
  }
}

export function mapRosterContactCandidate(row: TeamConnectionContactRow): TeamConnection | null {
  const id = cleanText(row.id)
  const teamName = cleanText(row.team_name)
  if (!id || !teamName) return null
  return {
    id: `roster_contact:${id}`,
    sourceType: 'roster_contact',
    sourceRecordId: id,
    teamName,
    leagueName: cleanText(row.league_name),
    flight: cleanText(row.flight),
    role: normalizeTeamConnectionRole(row.role),
    status: 'pending',
    matchedPlayerId: '',
    updatedAt: cleanText(row.updated_at),
  }
}

export function mapRosterMembershipCandidate(row: TeamConnectionRosterRow): TeamConnection | null {
  const id = cleanText(row.id)
  const teamName = cleanText(row.team_name)
  if (!id || !teamName) return null
  return {
    id: `roster_membership:${id}`,
    sourceType: 'roster_membership',
    sourceRecordId: id,
    teamName,
    leagueName: cleanText(row.league_name),
    flight: cleanText(row.flight),
    role: 'player',
    status: 'pending',
    matchedPlayerId: cleanText(row.player_id),
    updatedAt: cleanText(row.updated_at),
  }
}

export function mapSavedTeamConnection(row: TeamProfileLinkRow): TeamConnection | null {
  const id = cleanText(row.id)
  const teamName = cleanText(row.team_name)
  if (!id || !teamName) return null
  return {
    id,
    sourceType: normalizeTeamConnectionSourceType(row.source_type),
    sourceRecordId: cleanText(row.source_record_id),
    teamName,
    leagueName: cleanText(row.league_name),
    flight: cleanText(row.flight),
    role: normalizeTeamConnectionRole(row.team_role),
    status: normalizeTeamConnectionStatus(row.status),
    matchedPlayerId: cleanText(row.matched_player_id),
    updatedAt: cleanText(row.updated_at),
  }
}

export function isCaptainTeamConnection(role: TeamConnectionRole) {
  return role === 'captain' || role === 'co_captain'
}

function compareTeamConnections(left: TeamConnection, right: TeamConnection) {
  const roleDiff = getRolePriority(right.role) - getRolePriority(left.role)
  if (roleDiff) return roleDiff
  const timeDiff = Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  if (Number.isFinite(timeDiff) && timeDiff) return timeDiff
  return left.teamName.localeCompare(right.teamName)
}

function getRolePriority(role: TeamConnectionRole) {
  if (role === 'captain') return 3
  if (role === 'co_captain') return 2
  return 1
}

function normalizeKey(value: string | null | undefined) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}
