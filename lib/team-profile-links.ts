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
  roles: TeamConnectionRole[]
  status: TeamConnectionStatus
  isRoleUpdate: boolean
  declinedRoles: TeamConnectionRole[]
  roleAcceptedAt: Partial<Record<TeamConnectionRole, string>>
  matchedPlayerId: string
  isDefault: boolean
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
  player_name?: string | null
  updated_at?: string | null
}

export type TeamProfileLinkRow = {
  id?: string | null
  team_name?: string | null
  normalized_team_name?: string | null
  league_name?: string | null
  flight?: string | null
  team_role?: string | null
  team_roles?: string[] | null
  declined_roles?: string[] | null
  role_accepted_at?: Record<string, unknown> | null
  matched_player_id?: string | null
  source_type?: string | null
  source_record_id?: string | null
  status?: string | null
  is_default?: boolean | null
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

export function normalizeTeamConnectionRoles(
  values: Array<string | null | undefined> | null | undefined,
  fallback?: string | null,
) {
  const roles = new Set<TeamConnectionRole>()
  for (const value of values || []) {
    const normalized = cleanText(value).toLowerCase().replace(/[\s-]+/g, '_')
    if (normalized === 'player' || normalized === 'captain' || normalized === 'co_captain' || normalized === 'cocaptain') {
      roles.add(normalizeTeamConnectionRole(value))
    }
  }
  if (!roles.size && fallback) roles.add(normalizeTeamConnectionRole(fallback))
  if (!roles.size) roles.add('player')
  return [...roles].sort((left, right) => getRolePriority(left) - getRolePriority(right))
}

export function mergeTeamConnectionRoles(...groups: TeamConnectionRole[][]) {
  const roles = groups.flat()
  return roles.length ? normalizeTeamConnectionRoles(roles) : []
}

export function getPrimaryTeamConnectionRole(roles: TeamConnectionRole[]) {
  return [...roles].sort((left, right) => getRolePriority(right) - getRolePriority(left))[0] || 'player'
}

export function getTeamConnectionRolesLabel(roles: TeamConnectionRole[]) {
  return normalizeTeamConnectionRoles(roles).map(getTeamConnectionRoleLabel).join(' + ')
}

export function normalizeTeamConnectionStatus(value: string | null | undefined): Exclude<TeamConnectionStatus, 'pending'> {
  if (value === 'declined' || value === 'unlinked') return value
  return 'accepted'
}

export function normalizeTeamConnectionSourceType(value: string | null | undefined): TeamConnectionSourceType {
  if (value === 'roster_membership' || value === 'tiq_entry' || value === 'manual_invite') return value
  return 'roster_contact'
}

export function getTeamConnectionSourceLabel(source: TeamConnectionSourceType) {
  if (source === 'roster_contact') return 'Player Roster contact'
  if (source === 'roster_membership') return 'Player Roster'
  if (source === 'tiq_entry') return 'TIQ league'
  return 'Direct invite'
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
    if (!connection) continue
    const key = buildTeamConnectionScopeKey(connection)
    discoveredByKey.set(key, mergeTeamConnections(discoveredByKey.get(key), connection))
  }

  for (const row of input.contacts || []) {
    const connection = mapRosterContactCandidate(row)
    if (!connection) continue
    const key = buildTeamConnectionScopeKey(connection)
    discoveredByKey.set(key, mergeTeamConnections(discoveredByKey.get(key), connection))
  }

  for (const [key, saved] of savedByKey) {
    const discovered = discoveredByKey.get(key)
    if (!discovered) continue
    const newRoles = discovered.roles.filter((role) => !saved.roles.includes(role))
      .filter((role) => !saved.declinedRoles.includes(role))
    if (saved.status !== 'accepted') {
      discoveredByKey.delete(key)
      continue
    }
    if (!newRoles.length) {
      discoveredByKey.delete(key)
      continue
    }
    const mergedRoles = mergeTeamConnectionRoles(saved.roles, discovered.roles)
    discoveredByKey.set(key, {
      ...discovered,
      roles: mergedRoles,
      role: getPrimaryTeamConnectionRole(mergedRoles),
      isRoleUpdate: true,
    })
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
    roles: [normalizeTeamConnectionRole(row.role)],
    status: 'pending',
    isRoleUpdate: false,
    declinedRoles: [],
    roleAcceptedAt: {},
    matchedPlayerId: '',
    isDefault: false,
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
    roles: ['player'],
    status: 'pending',
    isRoleUpdate: false,
    declinedRoles: [],
    roleAcceptedAt: {},
    matchedPlayerId: cleanText(row.player_id),
    isDefault: false,
    updatedAt: cleanText(row.updated_at),
  }
}

export function mapSavedTeamConnection(row: TeamProfileLinkRow): TeamConnection | null {
  const id = cleanText(row.id)
  const teamName = cleanText(row.team_name)
  if (!id || !teamName) return null
  const roles = normalizeTeamConnectionRoles(row.team_roles, row.team_role)
  const declinedRoles = row.declined_roles?.length
    ? normalizeTeamConnectionRoles(row.declined_roles)
    : []
  const roleAcceptedAt = normalizeRoleAcceptedAt(row.role_accepted_at)
  return {
    id,
    sourceType: normalizeTeamConnectionSourceType(row.source_type),
    sourceRecordId: cleanText(row.source_record_id),
    teamName,
    leagueName: cleanText(row.league_name),
    flight: cleanText(row.flight),
    role: getPrimaryTeamConnectionRole(roles),
    roles,
    status: normalizeTeamConnectionStatus(row.status),
    isRoleUpdate: false,
    declinedRoles,
    roleAcceptedAt,
    matchedPlayerId: cleanText(row.matched_player_id),
    isDefault: row.is_default === true,
    updatedAt: cleanText(row.updated_at),
  }
}

export function isCaptainTeamConnection(roleOrRoles: TeamConnectionRole | TeamConnectionRole[]) {
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles]
  return roles.includes('captain') || roles.includes('co_captain')
}

function mergeTeamConnections(current: TeamConnection | undefined, next: TeamConnection) {
  if (!current) return next
  const roles = mergeTeamConnectionRoles(current.roles, next.roles)
  const preferred = getRolePriority(next.role) > getRolePriority(current.role) ? next : current
  return {
    ...preferred,
    roles,
    role: getPrimaryTeamConnectionRole(roles),
    matchedPlayerId: current.matchedPlayerId || next.matchedPlayerId,
    updatedAt: latestTimestamp(current.updatedAt, next.updatedAt),
  }
}

function latestTimestamp(left: string, right: string) {
  const leftTime = Date.parse(left)
  const rightTime = Date.parse(right)
  if (!Number.isFinite(leftTime)) return right
  if (!Number.isFinite(rightTime)) return left
  return rightTime > leftTime ? right : left
}

function normalizeRoleAcceptedAt(value: Record<string, unknown> | null | undefined) {
  const result: Partial<Record<TeamConnectionRole, string>> = {}
  for (const role of ['player', 'co_captain', 'captain'] as TeamConnectionRole[]) {
    const timestamp = value?.[role]
    if (typeof timestamp === 'string' && Number.isFinite(Date.parse(timestamp))) result[role] = timestamp
  }
  return result
}

function compareTeamConnections(left: TeamConnection, right: TeamConnection) {
  if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
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
