export type UserRole = 'public' | 'member' | 'admin'

export const ADMIN_USER_IDS = new Set([
  'accc3471-8912-491c-b8d9-4a84dcc7c42e',
])

export function getUserRole(userId?: string | null): UserRole {
  if (!userId) return 'public'
  if (ADMIN_USER_IDS.has(userId)) return 'admin'
  return 'member'
}

export function isMember(role: UserRole) {
  return role === 'member' || role === 'admin'
}

export function isAdmin(role: UserRole) {
  return role === 'admin'
}