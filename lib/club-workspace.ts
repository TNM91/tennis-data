export const CLUB_ROLES = [
  'owner',
  'admin',
  'director',
  'coach',
  'captain',
  'coordinator',
  'player',
  'guardian',
] as const

export type ClubRole = (typeof CLUB_ROLES)[number]
export type ClubGroupType = 'clinic' | 'team' | 'camp' | 'development_group' | 'league_division' | 'tournament_field'
export type ClubCompetitionType = 'league' | 'tournament'

export type Club = {
  id: string
  ownerUserId: string
  name: string
  slug: string
  description: string
  logoUrl: string
  heroImageUrl: string
  primaryColor: string
  locationLabel: string
  contactEmail: string
  timeZone: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export type ClubMembership = {
  id: string
  clubId: string
  userId: string
  roles: ClubRole[]
  status: 'active' | 'inactive' | 'removed'
  displayName: string
  email: string
  phone: string
  joinedAt: string
  updatedAt: string
}

export type ClubGroup = {
  id: string
  clubId: string
  name: string
  groupType: ClubGroupType
  description: string
  seasonLabel: string
  leadUserId: string
  isPublic: boolean
  isActive: boolean
  memberIds: string[]
  updatedAt: string
}

export type ClubCompetitionTemplate = {
  id: string
  clubId: string
  name: string
  competitionType: ClubCompetitionType
  entrantType: 'players' | 'teams'
  formatId: string
  divisionLabel: string
  defaultFacility: string
  scheduleNotes: string
  isPublic: boolean
  updatedAt: string
}

export type ClubInvite = {
  id: string
  clubId: string
  email: string
  roles: ClubRole[]
  inviteToken: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expiresAt: string
  createdAt: string
}

export type ClubLinkedCompetition = {
  id: string
  name: string
  type: ClubCompetitionType
  status: string
  isPublic: boolean
  href: string
}

export type ClubWorkspaceData = {
  club: Club
  currentMembership: ClubMembership
  memberships: ClubMembership[]
  invites: ClubInvite[]
  groups: ClubGroup[]
  templates: ClubCompetitionTemplate[]
  competitions: ClubLinkedCompetition[]
}

export function cleanClubText(value: unknown, maxLength = 240) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''
}

export function cleanClubMultiline(value: unknown, maxLength = 1200) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function createClubSlug(value: unknown) {
  return cleanClubText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function normalizeClubColor(value: unknown) {
  const color = cleanClubText(value, 7)
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '#9dea16'
}

export function normalizeClubRoles(value: unknown, fallback: ClubRole[] = ['player']): ClubRole[] {
  if (!Array.isArray(value)) return fallback
  const roles = Array.from(new Set(value.filter((role): role is ClubRole => CLUB_ROLES.includes(role as ClubRole))))
  return roles.length ? roles : fallback
}

export function isClubManager(roles: ClubRole[]) {
  return roles.some((role) => role === 'owner' || role === 'admin' || role === 'director')
}

export function canRunClubPrograms(roles: ClubRole[]) {
  return isClubManager(roles) || roles.some((role) => role === 'coach' || role === 'captain' || role === 'coordinator')
}

export function getClubRoleLabel(role: ClubRole) {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  if (role === 'director') return 'Director'
  if (role === 'coach') return 'Coach'
  if (role === 'captain') return 'Captain'
  if (role === 'coordinator') return 'Coordinator'
  if (role === 'guardian') return 'Guardian'
  return 'Player'
}

export function getClubGroupTypeLabel(type: ClubGroupType) {
  if (type === 'development_group') return 'Development group'
  if (type === 'league_division') return 'League division'
  if (type === 'tournament_field') return 'Tournament field'
  return `${type.slice(0, 1).toUpperCase()}${type.slice(1)}`
}

export function buildClubCompetitionLaunchHref(
  club: Pick<Club, 'id' | 'slug' | 'name' | 'locationLabel' | 'timeZone'>,
  template: ClubCompetitionTemplate,
) {
  const path = template.competitionType === 'tournament'
    ? '/league-coordinator/tournaments'
    : '/league-coordinator'
  const params = new URLSearchParams({
    clubId: club.id,
    club: club.slug,
    clubName: club.name,
    templateId: template.id,
    templateName: template.name,
    entrantType: template.entrantType,
    format: template.formatId,
    division: template.divisionLabel,
    facility: template.defaultFacility || club.locationLabel,
    timeZone: club.timeZone,
  })
  return `${path}?${params.toString()}#${template.competitionType === 'tournament' ? 'tournament-setup' : 'league-setup-form'}`
}

type Row = Record<string, unknown>

export function mapClubRow(row: Row): Club {
  return {
    id: cleanClubText(row.id),
    ownerUserId: cleanClubText(row.owner_user_id),
    name: cleanClubText(row.name),
    slug: cleanClubText(row.slug),
    description: cleanClubMultiline(row.description),
    logoUrl: cleanClubText(row.logo_url, 800),
    heroImageUrl: cleanClubText(row.hero_image_url, 800),
    primaryColor: normalizeClubColor(row.primary_color),
    locationLabel: cleanClubText(row.location_label),
    contactEmail: cleanClubText(row.contact_email, 180).toLowerCase(),
    timeZone: cleanClubText(row.time_zone, 80) || 'America/Chicago',
    isPublic: row.is_public !== false,
    createdAt: cleanClubText(row.created_at, 80),
    updatedAt: cleanClubText(row.updated_at, 80),
  }
}

export function mapClubMembershipRow(row: Row): ClubMembership {
  return {
    id: cleanClubText(row.id),
    clubId: cleanClubText(row.club_id),
    userId: cleanClubText(row.user_id),
    roles: normalizeClubRoles(row.roles),
    status: row.status === 'inactive' || row.status === 'removed' ? row.status : 'active',
    displayName: cleanClubText(row.display_name),
    email: cleanClubText(row.email, 180).toLowerCase(),
    phone: cleanClubText(row.phone, 40),
    joinedAt: cleanClubText(row.joined_at, 80),
    updatedAt: cleanClubText(row.updated_at, 80),
  }
}

export function mapClubGroupRow(row: Row, memberIds: string[] = []): ClubGroup {
  const rawType = cleanClubText(row.group_type) as ClubGroupType
  const groupType: ClubGroupType = ['clinic', 'team', 'camp', 'development_group', 'league_division', 'tournament_field'].includes(rawType)
    ? rawType
    : 'clinic'
  return {
    id: cleanClubText(row.id),
    clubId: cleanClubText(row.club_id),
    name: cleanClubText(row.name),
    groupType,
    description: cleanClubMultiline(row.description),
    seasonLabel: cleanClubText(row.season_label),
    leadUserId: cleanClubText(row.lead_user_id),
    isPublic: row.is_public !== false,
    isActive: row.is_active !== false,
    memberIds,
    updatedAt: cleanClubText(row.updated_at, 80),
  }
}

export function mapClubTemplateRow(row: Row): ClubCompetitionTemplate {
  return {
    id: cleanClubText(row.id),
    clubId: cleanClubText(row.club_id),
    name: cleanClubText(row.name),
    competitionType: row.competition_type === 'tournament' ? 'tournament' : 'league',
    entrantType: row.entrant_type === 'teams' ? 'teams' : 'players',
    formatId: cleanClubText(row.format_id, 80) || 'round_robin',
    divisionLabel: cleanClubText(row.division_label),
    defaultFacility: cleanClubText(row.default_facility),
    scheduleNotes: cleanClubMultiline(row.schedule_notes),
    isPublic: row.is_public !== false,
    updatedAt: cleanClubText(row.updated_at, 80),
  }
}

export function mapClubInviteRow(row: Row): ClubInvite {
  const status = cleanClubText(row.status)
  return {
    id: cleanClubText(row.id),
    clubId: cleanClubText(row.club_id),
    email: cleanClubText(row.email, 180).toLowerCase(),
    roles: normalizeClubRoles(row.roles),
    inviteToken: cleanClubText(row.invite_token),
    status: status === 'accepted' || status === 'revoked' || status === 'expired' ? status : 'pending',
    expiresAt: cleanClubText(row.expires_at, 80),
    createdAt: cleanClubText(row.created_at, 80),
  }
}
