import type { UserRole } from './roles'

export function getSiteHeaderCompactBreakpoint(role: UserRole, authenticated: boolean) {
  if (role === 'admin') return 1680
  if (authenticated) return 1480
  return 1200
}

export function shouldUseCompactSiteHeader(input: {
  role: UserRole
  authenticated: boolean
  screenWidth: number
}) {
  void input
  return true
}
