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
export type ClubInviteTargetType = 'club' | 'group' | 'league' | 'tournament'

export type ClubInviteTarget = {
  type: ClubInviteTargetType
  id: string
  name: string
  groupType?: ClubGroupType
}

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
  closedAt: string
  sourceGroupId: string
  memberIds: string[]
  reviewMemberIds: string[]
  renewalPendingCount: number
  renewalConfirmedCount: number
  renewalDeclinedCount: number
  renewalsFinalizedAt: string
  renewalTargetRosterSize: number
  renewalFillCompletedAt: string
  launchHandoffCompletedAt: string
  clinicSessionCount: number
  nextClinicSessionAt: string
  teamRosterCount: number
  teamMatchCount: number
  nextTeamMatchAt: string
  coachExpectedPlayerCount: number
  coachLinkedPlayerCount: number
  coachPlannedPlayerCount: number
  nextCoachSessionAt: string
  coachActionPlayerLinkId: string
  linkedCompetitionId: string
  linkedCompetitionType: ClubCompetitionType | ''
  competitionEntryCount: number
  competitionScheduleCount: number
  nextCompetitionEventAt: string
  teamChatScope: {
    teamName: string
    leagueName: string
    flight: string
  } | null
  updatedAt: string
}

export type ClubProgramLaunchAction = {
  title: string
  detail: string
  label: string
  href: string
  syncCoachRoster: boolean
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
  target: ClubInviteTarget
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
  clubGroupId: string
  name: string
  type: ClubCompetitionType
  entrantType: 'players' | 'teams'
  memberIds: string[]
  entryNames?: string[]
  status: string
  isPublic: boolean
  href: string
  entryCount: number
  scheduleCount: number
  nextEventAt: string
}

export type ClubCalendarEventType = 'clinic' | 'team_match' | 'league_match' | 'tournament_match'

export type ClubCalendarEvent = {
  id: string
  type: ClubCalendarEventType
  title: string
  startsAt: string
  endsAt: string
  allDay: boolean
  locationLabel: string
  courtLabel: string
  groupId: string
  groupName: string
  membershipIds: string[]
  href: string
  needsResult?: boolean
}

export type ClubCalendarConflict = {
  id: string
  eventIds: [string, string]
  kind: 'people' | 'court'
  detail: string
}

export function getClubCalendarConflicts(events: ClubCalendarEvent[]): ClubCalendarConflict[] {
  const conflicts: ClubCalendarConflict[] = []
  const scheduled = events.filter((event) => !event.allDay && Number.isFinite(new Date(event.startsAt).getTime()) && Number.isFinite(new Date(event.endsAt).getTime()))

  for (let leftIndex = 0; leftIndex < scheduled.length; leftIndex += 1) {
    const left = scheduled[leftIndex]
    for (let rightIndex = leftIndex + 1; rightIndex < scheduled.length; rightIndex += 1) {
      const right = scheduled[rightIndex]
      if (new Date(left.startsAt).getTime() >= new Date(right.endsAt).getTime() || new Date(right.startsAt).getTime() >= new Date(left.endsAt).getTime()) continue

      const sharedMembershipIds = new Set(left.membershipIds)
      const sharesPeople = right.membershipIds.some((membershipId) => sharedMembershipIds.has(membershipId))
      const leftCourt = cleanClubText(left.courtLabel).toLowerCase()
      const rightCourt = cleanClubText(right.courtLabel).toLowerCase()
      const leftLocation = cleanClubText(left.locationLabel).toLowerCase()
      const rightLocation = cleanClubText(right.locationLabel).toLowerCase()
      const sharesCourt = Boolean(leftCourt && rightCourt && leftCourt === rightCourt && leftLocation && leftLocation === rightLocation)

      if (sharesPeople) conflicts.push({
        id: `people:${left.id}:${right.id}`,
        eventIds: [left.id, right.id],
        kind: 'people',
        detail: `${left.title} and ${right.title} include the same people.`,
      })
      if (sharesCourt) conflicts.push({
        id: `court:${left.id}:${right.id}`,
        eventIds: [left.id, right.id],
        kind: 'court',
        detail: `${left.title} and ${right.title} use ${left.courtLabel} at the same time.`,
      })
    }
  }

  return conflicts
}

export function getVisibleClubCalendarEvents(
  events: ClubCalendarEvent[],
  groups: Array<Pick<ClubGroup, 'id' | 'leadUserId'>>,
  membership: Pick<ClubMembership, 'id' | 'userId'>,
  roles: ClubRole[],
) {
  if (isClubManager(roles)) return events
  const leadGroupIds = new Set(groups.filter((group) => group.leadUserId === membership.userId).map((group) => group.id))
  return events.filter((event) => {
    if (event.membershipIds.includes(membership.id)) return true
    if (!leadGroupIds.has(event.groupId)) return false
    if (roles.includes('coach') && event.type === 'clinic') return true
    if (roles.includes('captain') && event.type === 'team_match') return true
    return roles.includes('coordinator') && (event.type === 'league_match' || event.type === 'tournament_match')
  })
}

export function buildClubWeeklyBrief(input: {
  clubName: string
  programName?: string
  timeZone: string
  events: ClubCalendarEvent[]
  conflictCount: number
  resultCount: number
  pendingRenewalCount: number
  openSpotCount: number
  publicUrl?: string
  today?: string
}) {
  const today = input.today || getClubDateForTimeZone(input.timeZone)
  const weekEnd = addClubDateDays(today, 6)
  const weekEvents = input.events
    .filter((event) => !event.needsResult && event.startsAt.slice(0, 10) >= today && event.startsAt.slice(0, 10) <= weekEnd)
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
  const eventLines = weekEvents.slice(0, 8).map((event) => {
    const date = formatClubBriefDate(event.startsAt.slice(0, 10))
    const time = event.allDay ? '' : ` at ${formatClubBriefTime(event.startsAt, input.timeZone)}`
    const place = [event.locationLabel, event.courtLabel].filter(Boolean).join(' · ')
    return `- ${date}${time}: ${event.title}${place ? ` — ${place}` : ''}`
  })
  if (weekEvents.length > eventLines.length) eventLines.push(`- +${weekEvents.length - eventLines.length} more in TIQ`)

  const attentionLines = [
    input.conflictCount ? `- ${input.conflictCount} schedule ${input.conflictCount === 1 ? 'check' : 'checks'}` : '',
    input.resultCount ? `- ${input.resultCount} ${input.resultCount === 1 ? 'result' : 'results'} to add` : '',
    input.pendingRenewalCount ? `- ${input.pendingRenewalCount} returning ${input.pendingRenewalCount === 1 ? 'player' : 'players'} waiting` : '',
    input.openSpotCount ? `- ${input.openSpotCount} open roster ${input.openSpotCount === 1 ? 'spot' : 'spots'}` : '',
  ].filter(Boolean)

  return [
    `${cleanClubText(input.programName, 120) || cleanClubText(input.clubName, 120) || 'Club'} | Weekly tennis brief`,
    cleanClubText(input.programName, 120)
      ? `${cleanClubText(input.clubName, 120) || 'Club'} · ${formatClubBriefDate(today)}–${formatClubBriefDate(weekEnd)}`
      : `${formatClubBriefDate(today)}–${formatClubBriefDate(weekEnd)}`,
    '',
    'Schedule',
    ...(eventLines.length ? eventLines : ['- No events scheduled this week']),
    '',
    'Needs attention',
    ...(attentionLines.length ? attentionLines : ['- No follow-ups right now']),
    cleanClubText(input.publicUrl, 800) ? '' : null,
    cleanClubText(input.publicUrl, 800) ? `Club page: ${cleanClubText(input.publicUrl, 800)}` : null,
  ].filter((line): line is string => line !== null).join('\n')
}

export function getClubWeeklyBriefTargets(
  groups: ClubGroup[],
  roles: ClubRole[],
  userId: string,
) {
  const manager = isClubManager(roles)
  return groups.filter((group) => {
    if (!group.isActive) return false
    if (group.groupType === 'clinic') {
      return manager || roles.includes('coach') && group.leadUserId === userId
    }
    return group.groupType === 'team' && Boolean(group.teamChatScope)
  })
}

function getClubDateForTimeZone(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timeZone || 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
    return `${value('year')}-${value('month')}-${value('day')}`
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function addClubDateDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function formatClubBriefDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
}

function formatClubBriefTime(startsAt: string, timeZone: string) {
  if (startsAt.endsWith('Z')) return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timeZone || 'America/Chicago' }).format(new Date(startsAt))
  const [hourValue, minute = '00'] = startsAt.slice(11, 16).split(':')
  const hour = Number(hourValue)
  if (!Number.isFinite(hour)) return 'time TBD'
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${minute} ${suffix}`
}

export type ClubCompetitionReadiness = {
  ready: boolean
  label: string
  detail: string
  actionLabel: string
}

export function getLinkableClubCompetitions(
  group: Pick<ClubGroup, 'groupType' | 'linkedCompetitionId'>,
  competitions: ClubLinkedCompetition[],
) {
  if (group.linkedCompetitionId) return []
  const competitionType = group.groupType === 'league_division'
    ? 'league'
    : group.groupType === 'tournament_field'
      ? 'tournament'
      : ''
  if (!competitionType) return []
  return competitions.filter((competition) => competition.type === competitionType && !competition.clubGroupId)
}

export function getClubCompetitionRosterHandoff(
  group: Pick<ClubGroup, 'linkedCompetitionId' | 'linkedCompetitionType' | 'memberIds'>,
  competitions: ClubLinkedCompetition[],
  memberships: ClubMembership[],
) {
  const competition = competitions.find((item) => item.id === group.linkedCompetitionId && item.type === group.linkedCompetitionType)
  if (!competition || competition.entrantType !== 'players') return null
  const activeMembershipIds = new Set(memberships.filter((membership) => membership.status === 'active').map((membership) => membership.id))
  const eligibleMemberIds = Array.from(new Set(group.memberIds.filter((membershipId) => activeMembershipIds.has(membershipId))))
  const connectedMemberIds = new Set(competition.memberIds)
  const missingMemberIds = eligibleMemberIds.filter((membershipId) => !connectedMemberIds.has(membershipId))
  return {
    competition,
    eligibleMemberIds,
    missingMemberIds,
    connectedCount: eligibleMemberIds.length - missingMemberIds.length,
  }
}

export function getClubCompetitionTeamHandoff(
  group: Pick<ClubGroup, 'linkedCompetitionId' | 'linkedCompetitionType' | 'seasonLabel'>,
  competitions: ClubLinkedCompetition[],
  groups: Array<Pick<ClubGroup, 'id' | 'name' | 'isActive' | 'groupType' | 'seasonLabel' | 'sourceGroupId' | 'memberIds' | 'reviewMemberIds'>>,
) {
  const competition = competitions.find((item) => item.id === group.linkedCompetitionId && item.type === group.linkedCompetitionType)
  if (!competition || competition.entrantType !== 'teams') return null
  const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
  const enteredNames = new Set((competition.entryNames ?? []).map(normalizeName))
  const eligibleTeams = Array.from(new Map(groups
    .filter((item) => item.isActive && item.groupType === 'team')
    .filter((item) => !group.seasonLabel || item.seasonLabel === group.seasonLabel)
    .filter((item) => item.reviewMemberIds.length === 0)
    .filter((item) => !item.sourceGroupId || item.memberIds.length > 0)
    .map((item) => [normalizeName(item.name), item])).values())
  const missingTeams = eligibleTeams.filter((team) => !enteredNames.has(normalizeName(team.name)))
  return {
    competition,
    eligibleTeams,
    missingTeams,
    connectedCount: eligibleTeams.length - missingTeams.length,
  }
}

export type ClubWorkspaceData = {
  club: Club
  currentMembership: ClubMembership
  memberships: ClubMembership[]
  invites: ClubInvite[]
  groups: ClubGroup[]
  templates: ClubCompetitionTemplate[]
  competitions: ClubLinkedCompetition[]
  calendarEvents?: ClubCalendarEvent[]
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

export function normalizeClubInviteEmails(value: unknown) {
  const values = Array.isArray(value) ? value : [value]
  return Array.from(new Set(values
    .flatMap((item) => typeof item === 'string' ? item.split(/[\s,;]+/) : [])
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)))
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
      completed: workspace.groups.some((group) => group.isActive),
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

export function getClubCompetitionReadiness(
  competition: Pick<ClubLinkedCompetition, 'type' | 'entryCount' | 'scheduleCount' | 'nextEventAt'>,
): ClubCompetitionReadiness {
  if (competition.entryCount < 2) return {
    ready: false,
    label: 'Add entries',
    detail: `Add at least ${2 - competition.entryCount} more ${competition.entryCount === 1 ? 'entry' : 'entries'} before building the ${competition.type === 'league' ? 'schedule' : 'draw'}.`,
    actionLabel: 'Add entries',
  }
  if (!competition.scheduleCount) return {
    ready: false,
    label: competition.type === 'league' ? 'Build schedule' : 'Build draw',
    detail: competition.type === 'league'
      ? `${competition.entryCount} entries are ready. Build the match schedule next.`
      : `${competition.entryCount} entries are ready. Build and schedule the draw next.`,
    actionLabel: competition.type === 'league' ? 'Build schedule' : 'Build draw',
  }
  return {
    ready: true,
    label: 'Ready',
    detail: competition.nextEventAt
      ? `Next event: ${formatClubEventDate(competition.nextEventAt)}.`
      : `${competition.entryCount} entries and ${competition.scheduleCount} scheduled ${competition.scheduleCount === 1 ? 'match' : 'matches'}.`,
    actionLabel: 'Open competition',
  }
}

function formatClubEventDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function buildClubCoachStudentLinkId(clubId: string, membershipId: string) {
  return `club-${cleanClubText(clubId)}-${cleanClubText(membershipId)}`
}

export function getClubProgramLaunchAction(
  group: Pick<ClubGroup, 'id' | 'name' | 'groupType'>,
  club: Pick<Club, 'id' | 'name' | 'slug'>,
): ClubProgramLaunchAction {
  const context = { source: 'club-program-launch', groupId: group.id, program: group.name }
  if (group.groupType === 'clinic') return {
    title: `${group.name} is ready for its first date.`,
    detail: 'Add the schedule so coaches and players see what comes next.',
    label: 'Add clinic schedule',
    href: `/clubs/clinics/${encodeURIComponent(group.id)}?${new URLSearchParams({ clubId: club.id, tab: 'schedule', source: context.source }).toString()}`,
    syncCoachRoster: false,
  }
  if (group.groupType === 'team') return {
    title: `${group.name} is ready for team planning.`,
    detail: 'Open availability, the season schedule, and the first team message.',
    label: 'Open Team Hub',
    href: buildClubToolHref('/captain', club, { ...context, team: group.name }),
    syncCoachRoster: false,
  }
  if (group.groupType === 'league_division') return {
    title: `${group.name} is ready for its schedule.`,
    detail: 'Set the league format, dates, entries, and results flow.',
    label: 'Open League Office',
    href: buildClubToolHref('/league-coordinator', club, { ...context, division: group.name }),
    syncCoachRoster: false,
  }
  if (group.groupType === 'tournament_field') return {
    title: `${group.name} is ready for its draw.`,
    detail: 'Set entries, format, courts, schedule, and scoring.',
    label: 'Open Tournament Desk',
    href: buildClubToolHref('/league-coordinator/tournaments', club, { ...context, division: group.name }),
    syncCoachRoster: false,
  }
  return {
    title: `${group.name} is ready for the first plan.`,
    detail: group.groupType === 'camp'
      ? 'Connect the roster, then plan the first camp day in Coach Hub.'
      : 'Connect the roster, then give players their first development focus.',
    label: 'Open Coach Hub',
    href: buildClubToolHref('/coach', club, context),
    syncCoachRoster: true,
  }
}

export function getClubProgramReadinessAction(
  group: Pick<ClubGroup, 'id' | 'name' | 'groupType'> & Partial<Pick<ClubGroup, 'teamRosterCount' | 'teamMatchCount' | 'coachExpectedPlayerCount' | 'coachLinkedPlayerCount' | 'coachPlannedPlayerCount' | 'nextCoachSessionAt' | 'coachActionPlayerLinkId' | 'linkedCompetitionId' | 'linkedCompetitionType' | 'competitionEntryCount' | 'competitionScheduleCount'>>,
  club: Pick<Club, 'id' | 'name' | 'slug'>,
): ClubProgramLaunchAction {
  if (group.groupType === 'league_division' && group.linkedCompetitionId) {
    const href = buildClubToolHref('/league-coordinator', club, { leagueId: group.linkedCompetitionId, groupId: group.id, program: group.name })
    if ((group.competitionEntryCount ?? 0) < 2) return {
      title: `${group.name} needs league entries.`,
      detail: 'Add at least two teams or players before building the schedule.',
      label: 'Add league entries',
      href,
      syncCoachRoster: false,
    }
    if (!(group.competitionScheduleCount ?? 0)) return {
      title: `${group.name} needs its match schedule.`,
      detail: 'The field is ready. Build the schedule so everyone sees what comes next.',
      label: 'Build league schedule',
      href,
      syncCoachRoster: false,
    }
    return { title: `${group.name} is ready.`, detail: 'Open the linked league.', label: 'Open league', href, syncCoachRoster: false }
  }

  if (group.groupType === 'tournament_field' && group.linkedCompetitionId) {
    const href = buildClubToolHref('/league-coordinator/tournaments', club, { tournamentId: group.linkedCompetitionId, groupId: group.id, program: group.name })
    if ((group.competitionEntryCount ?? 0) < 2) return {
      title: `${group.name} needs tournament entries.`,
      detail: 'Add at least two players or teams before building the draw.',
      label: 'Add tournament entries',
      href,
      syncCoachRoster: false,
    }
    if (!(group.competitionScheduleCount ?? 0)) return {
      title: `${group.name} needs its scheduled draw.`,
      detail: 'The field is ready. Add the first match time or court to finish the draw.',
      label: 'Schedule tournament draw',
      href,
      syncCoachRoster: false,
    }
    return { title: `${group.name} is ready.`, detail: 'Open the linked tournament.', label: 'Open tournament', href, syncCoachRoster: false }
  }

  if (group.groupType === 'team') {
    const returnTo = `/clubs?${new URLSearchParams({ clubId: club.id, tab: 'home' }).toString()}`
    if (!group.teamRosterCount) return {
      title: `${group.name} needs its Player Roster.`,
      detail: 'Import the TennisLink Player Roster to connect players, ratings, phone numbers, and email addresses.',
      label: 'Add Player Roster',
      href: `/data-assist?${new URLSearchParams({ type: 'team_summary', help: '1', context: 'Club Team', returnTo }).toString()}#upload`,
      syncCoachRoster: false,
    }
    if (!group.teamMatchCount) return {
      title: `${group.name} needs its schedule.`,
      detail: 'Import the TennisLink Match Schedule so the team sees every match and what comes next.',
      label: 'Add team schedule',
      href: `/data-assist?${new URLSearchParams({ type: 'schedule', help: '1', context: 'Club Team', returnTo }).toString()}#upload`,
      syncCoachRoster: false,
    }
  }

  if (group.groupType === 'camp' || group.groupType === 'development_group') {
    const expectedPlayers = group.coachExpectedPlayerCount ?? 0
    const linkedPlayers = group.coachLinkedPlayerCount ?? 0
    const plannedPlayers = group.coachPlannedPlayerCount ?? 0
    const coachContext = {
      source: 'club-program-launch',
      groupId: group.id,
      program: group.name,
      ...(group.coachActionPlayerLinkId ? { studentLinkId: group.coachActionPlayerLinkId } : {}),
    }
    const coachHref = `${buildClubToolHref('/coach', club, coachContext)}#coach-lesson-frame`
    if (linkedPlayers < expectedPlayers) {
      const missingPlayers = expectedPlayers - linkedPlayers
      return {
        title: `${group.name} needs ${missingPlayers} ${missingPlayers === 1 ? 'player' : 'players'} in Coach Hub.`,
        detail: 'Connect the program roster once so coaches can assign work and keep each player moving.',
        label: 'Connect Coach roster',
        href: `${buildClubToolHref('/coach', club, { ...coachContext, firstAssignment: '1' })}#coach-lesson-frame`,
        syncCoachRoster: true,
      }
    }
    if (plannedPlayers < expectedPlayers) {
      const missingPlans = expectedPlayers - plannedPlayers
      return {
        title: `${missingPlans} ${missingPlans === 1 ? 'player needs' : 'players need'} a development plan.`,
        detail: 'Give each player one clear focus and the work to complete before the next session.',
        label: 'Add player plans',
        href: `${buildClubToolHref('/coach', club, { ...coachContext, firstAssignment: '1' })}#coach-lesson-frame`,
        syncCoachRoster: false,
      }
    }
    if (!group.nextCoachSessionAt) return {
      title: `${group.name} needs its next session.`,
      detail: 'Add a lesson date so coaches and players see what comes next on their calendars.',
      label: 'Schedule next session',
      href: coachHref,
      syncCoachRoster: false,
    }
  }

  return getClubProgramLaunchAction(group, club)
}

export function needsClubProgramLaunch(group: Pick<ClubGroup, 'isActive' | 'memberIds' | 'reviewMemberIds' | 'groupType' | 'launchHandoffCompletedAt'> & Partial<Pick<ClubGroup, 'clinicSessionCount' | 'teamRosterCount' | 'teamMatchCount' | 'coachExpectedPlayerCount' | 'coachLinkedPlayerCount' | 'coachPlannedPlayerCount' | 'nextCoachSessionAt' | 'linkedCompetitionId' | 'competitionEntryCount' | 'competitionScheduleCount'>>) {
  if (!group.isActive || group.reviewMemberIds.length) return false
  const competitionProgram = group.groupType === 'league_division' || group.groupType === 'tournament_field'
  if (!competitionProgram && !group.memberIds.length) return false
  if (group.groupType === 'clinic') return group.clinicSessionCount === 0
  if (group.groupType === 'team') return group.teamRosterCount === 0 || group.teamMatchCount === 0
  if (group.groupType === 'camp' || group.groupType === 'development_group') {
    const expectedPlayers = group.coachExpectedPlayerCount ?? 0
    if (!expectedPlayers) return false
    return (group.coachLinkedPlayerCount ?? 0) < expectedPlayers
      || (group.coachPlannedPlayerCount ?? 0) < expectedPlayers
      || !group.nextCoachSessionAt
  }
  if (group.groupType === 'league_division' || group.groupType === 'tournament_field') {
    return !group.linkedCompetitionId
      || (group.competitionEntryCount ?? 0) < 2
      || !(group.competitionScheduleCount ?? 0)
  }
  return !group.launchHandoffCompletedAt
}

export function getClubInviteLanding(
  club: Pick<Club, 'id' | 'name' | 'slug'>,
  roles: ClubRole[],
  target: ClubInviteTarget = { type: 'club', id: '', name: '' },
): ClubInviteLanding {
  const clubContext = { clubId: club.id, clubName: club.name, club: club.slug, source: 'club-invite' }
  if (target.type === 'group' && target.id) {
    if (target.groupType === 'clinic') {
      return {
        title: target.name || 'Clinic Hub',
        detail: 'Open the clinic schedule, roster, assignments, and updates.',
        actionLabel: 'Open clinic',
        href: `/clubs/clinics/${encodeURIComponent(target.id)}?${new URLSearchParams(clubContext).toString()}`,
      }
    }
    return {
      title: target.name || 'Club program',
      detail: `Open this ${target.groupType ? getClubGroupTypeLabel(target.groupType).toLowerCase() : 'program'} and its connected roster.`,
      actionLabel: target.groupType === 'team' ? 'Open team' : 'Open program',
      href: buildClubToolHref('/clubs', club, { tab: 'groups', groupId: target.id, source: 'club-invite' }),
    }
  }
  if (target.type === 'league' && target.id) {
    const coordinator = roles.some((role) => role === 'owner' || role === 'admin' || role === 'director' || role === 'coordinator')
    return {
      title: target.name || 'Club league',
      detail: coordinator ? 'Open this league’s schedule, entries, and results.' : 'Open this league’s schedule, standings, and results.',
      actionLabel: 'Open league',
      href: coordinator
        ? buildClubToolHref('/league-coordinator', club, { leagueId: target.id, source: 'club-invite' })
        : buildClubToolHref(`/explore/leagues/tiq/${encodeURIComponent(target.id)}`, club, { league_id: target.id, source: 'club-invite' }),
    }
  }
  if (target.type === 'tournament' && target.id) {
    const coordinator = roles.some((role) => role === 'owner' || role === 'admin' || role === 'director' || role === 'coordinator')
    return {
      title: target.name || 'Club tournament',
      detail: coordinator ? 'Open this tournament’s entries, draw, courts, and results.' : 'Open this tournament’s draw, schedule, and results.',
      actionLabel: 'Open tournament',
      href: coordinator
        ? buildClubToolHref('/league-coordinator/tournaments', club, { tournamentId: target.id, source: 'club-invite' })
        : buildClubToolHref(`/tournaments/${encodeURIComponent(target.id)}`, club, { source: 'club-invite' }),
    }
  }
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

export function mapClubGroupRow(row: Row, memberIds: string[] = [], reviewMemberIds: string[] = []): ClubGroup {
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
    closedAt: cleanClubText(row.closed_at, 80),
    sourceGroupId: cleanClubText(row.rollover_source_group_id),
    memberIds,
    reviewMemberIds,
    renewalPendingCount: 0,
    renewalConfirmedCount: 0,
    renewalDeclinedCount: 0,
    renewalsFinalizedAt: cleanClubText(row.renewals_finalized_at, 80),
    renewalTargetRosterSize: Math.max(0, Number(row.renewal_target_roster_size) || 0),
    renewalFillCompletedAt: cleanClubText(row.renewal_fill_completed_at, 80),
    launchHandoffCompletedAt: cleanClubText(row.launch_handoff_completed_at, 80),
    clinicSessionCount: Math.max(0, Number(row.clinic_session_count) || 0),
    nextClinicSessionAt: cleanClubText(row.next_clinic_session_at, 80),
    teamRosterCount: Math.max(0, Number(row.team_roster_count) || 0),
    teamMatchCount: Math.max(0, Number(row.team_match_count) || 0),
    nextTeamMatchAt: cleanClubText(row.next_team_match_at, 80),
    coachExpectedPlayerCount: Math.max(0, Number(row.coach_expected_player_count) || 0),
    coachLinkedPlayerCount: Math.max(0, Number(row.coach_linked_player_count) || 0),
    coachPlannedPlayerCount: Math.max(0, Number(row.coach_planned_player_count) || 0),
    nextCoachSessionAt: cleanClubText(row.next_coach_session_at, 80),
    coachActionPlayerLinkId: cleanClubText(row.coach_action_player_link_id, 240),
    linkedCompetitionId: cleanClubText(row.linked_competition_id, 240),
    linkedCompetitionType: row.linked_competition_type === 'league' || row.linked_competition_type === 'tournament' ? row.linked_competition_type : '',
    competitionEntryCount: Math.max(0, Number(row.competition_entry_count) || 0),
    competitionScheduleCount: Math.max(0, Number(row.competition_schedule_count) || 0),
    nextCompetitionEventAt: cleanClubText(row.next_competition_event_at, 80),
    teamChatScope: null,
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
    target: mapClubInviteTargetRow(row),
    inviteToken: cleanClubText(row.invite_token),
    status: status === 'accepted' || status === 'revoked' || status === 'expired' ? status : 'pending',
    expiresAt: cleanClubText(row.expires_at, 80),
    createdAt: cleanClubText(row.created_at, 80),
  }
}

export function mapClubInviteTargetRow(row: Row): ClubInviteTarget {
  const targetType = cleanClubText(row.target_type)
  const groupType = cleanClubText(row.target_group_type)
  return {
    type: ['group', 'league', 'tournament'].includes(targetType) ? targetType as ClubInviteTargetType : 'club',
    id: cleanClubText(row.target_id, 180),
    name: cleanClubText(row.target_name),
    groupType: ['clinic', 'team', 'camp', 'development_group', 'league_division', 'tournament_field'].includes(groupType)
      ? groupType as ClubGroupType
      : undefined,
  }
}
