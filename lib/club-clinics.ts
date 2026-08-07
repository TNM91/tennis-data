import { cleanClubMultiline, cleanClubText, type ClubMembership, type ClubRole } from './club-workspace'

export type ClinicRosterStatus = 'active' | 'waitlist' | 'inactive'
export type ClinicSessionStatus = 'scheduled' | 'completed' | 'canceled'
export type ClinicAttendanceStatus = 'expected' | 'present' | 'absent' | 'late' | 'excused'
export type ClinicMessageKind = 'announcement' | 'update'

export type ClinicRosterMember = ClubMembership & {
  rosterStatus: ClinicRosterStatus
}

export type ClubClinic = {
  id: string
  clubId: string
  name: string
  description: string
  seasonLabel: string
  leadUserId: string
  leadCoachName: string
  capacity: number
  locationLabel: string
  registrationUrl: string
  defaultDurationMinutes: number
  isPublic: boolean
}

export type ClubClinicSession = {
  id: string
  groupId: string
  title: string
  startsAt: string
  endsAt: string
  locationLabel: string
  courtLabel: string
  focus: string
  plan: string
  playerNextStep: string
  status: ClinicSessionStatus
}

export type ClubClinicAttendance = {
  sessionId: string
  membershipId: string
  status: ClinicAttendanceStatus
  note: string
}

export type ClubClinicMessage = {
  id: string
  groupId: string
  authorName: string
  body: string
  kind: ClinicMessageKind
  createdAt: string
}

export type ClubClinicWorkspace = {
  club: {
    id: string
    name: string
    slug: string
    logoUrl: string
    primaryColor: string
    locationLabel: string
  }
  clinic: ClubClinic
  currentMembership: ClubMembership
  roster: ClinicRosterMember[]
  sessions: ClubClinicSession[]
  attendance: ClubClinicAttendance[]
  messages: ClubClinicMessage[]
}

export type ClinicRecurrenceInput = {
  startsAt: string
  durationMinutes: number
  weeks: number
  title: string
  locationLabel: string
  courtLabel: string
}

export function canManageClinic(roles: ClubRole[], leadUserId: string, userId: string) {
  return roles.some((role) => role === 'owner' || role === 'admin' || role === 'director')
    || (roles.includes('coach') && Boolean(userId) && leadUserId === userId)
}

export function canCoachClinic(roles: ClubRole[]) {
  return roles.some((role) => role === 'owner' || role === 'admin' || role === 'director' || role === 'coach')
}

export function normalizeClinicRosterStatus(value: unknown): ClinicRosterStatus {
  return value === 'waitlist' || value === 'inactive' ? value : 'active'
}

export function normalizeClinicSessionStatus(value: unknown): ClinicSessionStatus {
  return value === 'completed' || value === 'canceled' ? value : 'scheduled'
}

export function normalizeClinicAttendanceStatus(value: unknown): ClinicAttendanceStatus {
  return value === 'present' || value === 'absent' || value === 'late' || value === 'excused' ? value : 'expected'
}

export function normalizeClinicMessageKind(value: unknown): ClinicMessageKind {
  return value === 'announcement' ? 'announcement' : 'update'
}

export function normalizeClinicCapacity(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.min(500, Math.max(0, Math.round(numeric))) : 0
}

export function normalizeClinicDuration(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.min(360, Math.max(15, Math.round(numeric))) : 90
}

export function normalizeClinicExternalUrl(value: unknown) {
  const raw = cleanClubText(value, 800)
  if (!raw) return ''
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

export function buildClinicSessionRows(input: ClinicRecurrenceInput) {
  const firstStart = new Date(input.startsAt)
  if (Number.isNaN(firstStart.getTime())) return []
  const weeks = Math.min(52, Math.max(1, Math.round(input.weeks || 1)))
  const durationMinutes = normalizeClinicDuration(input.durationMinutes)
  return Array.from({ length: weeks }, (_, index) => {
    const start = new Date(firstStart.getTime() + index * 7 * 24 * 60 * 60 * 1000)
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
    return {
      title: cleanClubText(input.title, 120) || 'Clinic session',
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      location_label: cleanClubText(input.locationLabel),
      court_label: cleanClubText(input.courtLabel, 120),
    }
  })
}

export function mapClubClinicRow(row: Record<string, unknown>): ClubClinic {
  return {
    id: cleanClubText(row.id),
    clubId: cleanClubText(row.club_id),
    name: cleanClubText(row.name),
    description: cleanClubMultiline(row.description),
    seasonLabel: cleanClubText(row.season_label),
    leadUserId: cleanClubText(row.lead_user_id),
    leadCoachName: cleanClubText(row.lead_coach_name),
    capacity: normalizeClinicCapacity(row.capacity),
    locationLabel: cleanClubText(row.location_label),
    registrationUrl: cleanClubText(row.registration_url, 800),
    defaultDurationMinutes: normalizeClinicDuration(row.default_duration_minutes),
    isPublic: row.is_public !== false,
  }
}

export function mapClubClinicSessionRow(row: Record<string, unknown>): ClubClinicSession {
  return {
    id: cleanClubText(row.id),
    groupId: cleanClubText(row.group_id),
    title: cleanClubText(row.title),
    startsAt: cleanClubText(row.starts_at, 80),
    endsAt: cleanClubText(row.ends_at, 80),
    locationLabel: cleanClubText(row.location_label),
    courtLabel: cleanClubText(row.court_label, 120),
    focus: cleanClubText(row.focus, 320),
    plan: cleanClubMultiline(row.plan, 4000),
    playerNextStep: cleanClubMultiline(row.player_next_step, 1600),
    status: normalizeClinicSessionStatus(row.status),
  }
}

export function mapClubClinicAttendanceRow(row: Record<string, unknown>): ClubClinicAttendance {
  return {
    sessionId: cleanClubText(row.session_id),
    membershipId: cleanClubText(row.membership_id),
    status: normalizeClinicAttendanceStatus(row.status),
    note: cleanClubText(row.note, 500),
  }
}

export function mapClubClinicMessageRow(row: Record<string, unknown>): ClubClinicMessage {
  return {
    id: cleanClubText(row.id),
    groupId: cleanClubText(row.group_id),
    authorName: cleanClubText(row.author_name) || 'Club staff',
    body: cleanClubMultiline(row.body, 2000),
    kind: normalizeClinicMessageKind(row.kind),
    createdAt: cleanClubText(row.created_at, 80),
  }
}
