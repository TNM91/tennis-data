export type LeagueDelegateRole = 'owner' | 'delegate'
export type LeagueDelegateInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export type LeagueDelegate = {
  userId: string
  email: string
  displayName: string
  role: LeagueDelegateRole
  createdAt: string
}

export type LeagueDelegateInvite = {
  id: string
  email: string
  token: string
  status: LeagueDelegateInviteStatus
  expiresAt: string
  createdAt: string
  inviteUrl: string
}

export function normalizeLeagueDelegateEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

export function isValidLeagueDelegateEmail(value: unknown) {
  const email = normalizeLeagueDelegateEmail(value)
  return email.length <= 180 && /^\S+@\S+\.\S+$/.test(email)
}

export function canAcceptLeagueDelegateInvite(invitedEmail: unknown, signedInEmail: unknown) {
  const invite = normalizeLeagueDelegateEmail(invitedEmail)
  const signedIn = normalizeLeagueDelegateEmail(signedInEmail)
  return Boolean(invite && signedIn && invite === signedIn)
}

export function isLeagueDelegateInviteExpired(expiresAt: unknown, now = Date.now()) {
  const timestamp = new Date(String(expiresAt || '')).getTime()
  return !Number.isFinite(timestamp) || timestamp <= now
}

export function getLeagueDelegateDisplayName(userMetadata: Record<string, unknown> | null | undefined, email: unknown) {
  const preferred = [userMetadata?.full_name, userMetadata?.name, userMetadata?.display_name]
    .map((value) => String(value || '').trim())
    .find(Boolean)
  return preferred || normalizeLeagueDelegateEmail(email).split('@')[0] || 'League delegate'
}
