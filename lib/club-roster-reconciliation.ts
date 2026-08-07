export type ClubRosterConnectionStatus = 'connected' | 'pending' | 'ready' | 'email_needed'

type RosterContactCandidate = {
  email?: string | null
  phone?: string | null
}

type ClubMembershipCandidate = {
  email?: string | null
  phone?: string | null
  status?: string | null
}

type ClubInviteCandidate = {
  email?: string | null
  status?: string | null
  expires_at?: string | null
}

export function normalizeClubContactEmail(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

export function normalizeClubContactPhone(value: string | null | undefined) {
  const digits = (value || '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : ''
}

export function getClubRosterConnectionStatus(input: {
  contact: RosterContactCandidate
  memberships: ClubMembershipCandidate[]
  invites: ClubInviteCandidate[]
  now?: Date
}): ClubRosterConnectionStatus {
  const email = normalizeClubContactEmail(input.contact.email)
  const phone = normalizeClubContactPhone(input.contact.phone)
  const connected = input.memberships.some((membership) => {
    if ((membership.status || '').toLowerCase() === 'removed') return false
    const memberEmail = normalizeClubContactEmail(membership.email)
    const memberPhone = normalizeClubContactPhone(membership.phone)
    return Boolean((email && memberEmail === email) || (phone && memberPhone === phone))
  })
  if (connected) return 'connected'

  const now = input.now?.getTime() ?? Date.now()
  const pending = Boolean(email && input.invites.some((invite) => {
    if ((invite.status || '').toLowerCase() !== 'pending') return false
    if (normalizeClubContactEmail(invite.email) !== email) return false
    const expiresAt = Date.parse(invite.expires_at || '')
    return !Number.isFinite(expiresAt) || expiresAt > now
  }))
  if (pending) return 'pending'
  return email ? 'ready' : 'email_needed'
}

export function getClubRosterConnectionLabel(status: ClubRosterConnectionStatus) {
  if (status === 'connected') return 'Already connected'
  if (status === 'pending') return 'Invite pending'
  if (status === 'ready') return 'Ready to invite'
  return 'Email needed'
}
