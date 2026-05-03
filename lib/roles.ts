export type UserRole = 'public' | 'member' | 'captain' | 'admin'

export function normalizeUserRole(value: unknown): UserRole {
  if (value === 'admin') return 'admin'
  if (value === 'captain') return 'captain'
  if (value === 'member') return 'member'
  return 'public'
}

// ✅ CRITICAL BACKWARD COMPATIBILITY FIX
export function getUserRole(value: unknown): UserRole {
  return normalizeUserRole(value)
}

export function isMember(role: UserRole) {
  return role === 'member' || role === 'captain' || role === 'admin'
}

export function isCaptain(role: UserRole) {
  return role === 'captain' || role === 'admin'
}

export function isAdmin(role: UserRole) {
  return role === 'admin'
}