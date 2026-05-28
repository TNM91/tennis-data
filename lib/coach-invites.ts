export type CoachInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export type CoachStudentInvite = {
  id: string
  studentLinkId: string | null
  inviteEmail: string
  inviteToken: string
  status: CoachInviteStatus
  message: string
  inviteHref: string
  expiresAt: string | null
  updatedAt: string
}

export type CoachStudentInviteRow = {
  id: string
  student_link_id: string | null
  invite_email: string
  invite_token: string
  status: string
  message: string
  expires_at: string | null
  updated_at: string
}

export type CoachStudentInviteInput = {
  id?: unknown
  studentLinkId?: unknown
  inviteEmail?: unknown
  message?: unknown
  expiresAt?: unknown
}

export function normalizeCoachInviteStatus(value: unknown): CoachInviteStatus {
  return value === 'pending' || value === 'accepted' || value === 'revoked' || value === 'expired'
    ? value
    : 'pending'
}

export function canAcceptCoachInviteEmail(inviteEmail: string, userEmail: string | null | undefined) {
  const requiredEmail = inviteEmail.trim().toLowerCase()
  if (!requiredEmail) return true
  return requiredEmail === (userEmail ?? '').trim().toLowerCase()
}

export function isCoachInviteExpired(expiresAt: string | null | undefined, now = Date.now()) {
  if (!expiresAt) return false
  const timestamp = Date.parse(expiresAt)
  return Number.isFinite(timestamp) && timestamp < now
}

export function mapCoachInviteRow(row: CoachStudentInviteRow, origin = ''): CoachStudentInvite {
  const inviteHref = `${origin || ''}/coach/invite/${row.invite_token}`
  return {
    id: row.id,
    studentLinkId: row.student_link_id,
    inviteEmail: row.invite_email,
    inviteToken: row.invite_token,
    status: normalizeCoachInviteStatus(row.status),
    message: row.message,
    inviteHref,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
  }
}

export function buildCoachInvitePayload(input: CoachStudentInviteInput, coachUserId: string) {
  const id = stringOrEmpty(input.id).trim() || `coach-invite-${crypto.randomUUID()}`
  const inviteToken = crypto.randomUUID()

  return {
    id,
    coach_user_id: coachUserId,
    student_link_id: nullableString(input.studentLinkId),
    invite_email: normalizeEmail(input.inviteEmail),
    invite_token: inviteToken,
    status: 'pending' as CoachInviteStatus,
    message: stringOrEmpty(input.message).trim(),
    expires_at: nullableTimestamp(input.expiresAt),
    updated_at: new Date().toISOString(),
  }
}

function normalizeEmail(value: unknown) {
  const email = stringOrEmpty(value).trim().toLowerCase()
  return email.includes('@') ? email : ''
}

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function nullableString(value: unknown) {
  const text = stringOrEmpty(value).trim()
  return text || null
}

function nullableTimestamp(value: unknown) {
  const text = stringOrEmpty(value).trim()
  if (!text) return null
  const timestamp = Date.parse(text)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}
