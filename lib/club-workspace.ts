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
  onboardingCompletedAt: string
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
  capacity: number
  locationLabel: string
  registrationUrl: string
  defaultDurationMinutes: number
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

export type ClubInviteLanding = {
  title: string
  detail: string
  actionLabel: string
  href: string
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

export type ClubSetupStep = {
  id: 'club' | 'staff' | 'players' | 'programs' | 'access'
  label: string
  detail: string
  actionLabel: string
  tab: 'settings' | 'people' | 'groups' | 'compete'
  completed: boolean
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

export function getClubSetupSteps(workspace: ClubWorkspaceData): ClubSetupStep[] {
  const staffRoles: ClubRole[] = ['admin', 'director', 'coach', 'captain', 'coordinator']
  const playerRoles: ClubRole[] = ['player', 'guardian']
  const hasConnectedRole = (roles: ClubRole[]) => workspace.memberships.some((membership) =>
    membership.id !== workspace.currentMembership.id && membership.status === 'active' && membership.roles.some((role) => roles.includes(role)),
  ) || workspace.invites.some((invite) => invite.status === 'pending' && invite.roles.some((role) => roles.includes(role)))

  return [
    {
      id: 'club',
      label: 'Finish the club identity',
      detail: 'Add the location, club story, color, and optional logo.',
      actionLabel: 'Finish club identity',
      tab: 'settings',
      completed: Boolean(workspace.club.locationLabel && workspace.club.description),
    },
    {
      id: 'staff',
      label: 'Invite the first staff member',
      detail: 'Connect a director, coach, captain, or coordinator.',
      actionLabel: 'Invite staff',
      tab: 'people',
      completed: hasConnectedRole(staffRoles),
    },
    {
      id: 'players',
      label: 'Invite the first player',
      detail: 'Send a player access link so their club experience is connected.',
      actionLabel: 'Invite player',
      tab: 'people',
      completed: hasConnectedRole(playerRoles),
    },
    {
      id: 'programs',
      label: 'Add a program or team',
      detail: 'Create the first clinic, team, camp, or development group.',
      actionLabel: 'Add a program',
      tab: 'groups',
      completed: workspace.groups.length > 0,
    },
    {
      id: 'access',
      label: 'Open the club to your community',
      detail: 'Share the club page, then return here whenever staff or programs change.',
      actionLabel: 'Share club page',
      tab: 'settings',
      completed: Boolean(workspace.club.onboardingCompletedAt),
    },
  ]
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

export function buildClubToolHref(
  path: string,
  club: Pick<Club, 'id' | 'name' | 'slug'>,
  params: Record<string, string> = {},
) {
  const search = new URLSearchParams({
    clubId: club.id,
    clubName: club.name,
    club: club.slug,
    ...params,
  })
  return `${path}?${search.toString()}`
}

export function getClubInviteLanding(
  club: Pick<Club, 'id' | 'name' | 'slug'>,
  roles: ClubRole[],
): ClubInviteLanding {
  if (roles.some((role) => role === 'admin' || role === 'director')) {
    return {
      title: 'Club workspace',
      detail: 'Open staff, programs, coaching, leagues, and tournaments for this club.',
      actionLabel: 'Open Club workspace',
      href: buildClubToolHref('/clubs', club, { tab: 'home', source: 'club-invite' }),
    }
  }
  if (roles.includes('coach')) {
    return {
      title: 'Coach Hub',
      detail: 'Open the club roster and start connecting each player’s development work.',
      actionLabel: 'Open Coach Hub',
      href: buildClubToolHref('/coach', club, { source: 'club-invite' }),
    }
  }
  if (roles.includes('captain')) {
    return {
      title: 'Team Hub',
      detail: 'Open availability, projected lineups, and team communication.',
      actionLabel: 'Open Team Hub',
      href: buildClubToolHref('/captain', club, { source: 'club-invite' }),
    }
  }
  if (roles.includes('coordinator')) {
    return {
      title: 'League Office',
      detail: 'Open club leagues, schedules, entries, results, and tournament tools.',
      actionLabel: 'Open League Office',
      href: buildClubToolHref('/league-coordinator', club, { source: 'club-invite' }),
    }
  }
  if (roles.includes('player')) {
    return {
      title: 'My Lab',
      detail: 'Open your club-linked development work, match insight, and next steps.',
      actionLabel: 'Open My Lab',
      href: buildClubToolHref('/mylab', club, { source: 'club-invite' }),
    }
  }
  return {
    title: 'Club programs',
    detail: 'Open the programs, teams, and updates connected to this club.',
    actionLabel: 'Open club programs',
    href: buildClubToolHref('/clubs', club, { tab: 'groups', source: 'club-invite' }),
  }
}

export function hasClubTeamProgram(workspace: Pick<ClubWorkspaceData, 'groups'>) {
  return workspace.groups.some((group) => group.isActive && group.groupType === 'team')
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
    onboardingCompletedAt: cleanClubText(row.onboarding_completed_at, 80),
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
    capacity: Math.min(500, Math.max(0, Number(row.capacity) || 0)),
    locationLabel: cleanClubText(row.location_label),
    registrationUrl: cleanClubText(row.registration_url, 800),
    defaultDurationMinutes: Math.min(360, Math.max(15, Number(row.default_duration_minutes) || 90)),
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
