import type { UserRole } from './roles'

export const SITE_HEADER_COMPACT_BREAKPOINT = 1200

export function getSiteHeaderCompactBreakpoint(role: UserRole, authenticated: boolean) {
  void role
  void authenticated
  return SITE_HEADER_COMPACT_BREAKPOINT
}

export function shouldUseCompactSiteHeader(input: {
  role: UserRole
  authenticated: boolean
  screenWidth: number
}) {
  return input.screenWidth < getSiteHeaderCompactBreakpoint(input.role, input.authenticated)
}
