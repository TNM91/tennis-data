import type { UserRole } from './roles'

export function getSiteHeaderCompactBreakpoint(role: UserRole, authenticated: boolean) {
  if (role === 'admin') return 1540
  if (authenticated) return 1380
  return 1180
}

export function shouldUseCompactSiteHeader(input: {
  role: UserRole
  authenticated: boolean
  screenWidth: number
}) {
  return input.screenWidth < getSiteHeaderCompactBreakpoint(input.role, input.authenticated)
}
