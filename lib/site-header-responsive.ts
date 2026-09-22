import type { UserRole } from './roles'

export const SITE_HEADER_COMPACT_BREAKPOINT = 10000

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

export function getHeaderResumeShortcutLabel(input: {
  status: 'unfinished' | 'recent'
  actionLabel: string
  lane: string
  handoff?: boolean
  isMobile: boolean
  screenWidth: number
  compact: boolean
}) {
  if (input.handoff) {
    return input.isMobile && input.screenWidth < 380 ? 'Next' : input.actionLabel
  }
  if (input.status === 'unfinished') {
    return input.isMobile && input.screenWidth < 380 ? 'Next' : input.actionLabel
  }
  return input.isMobile || input.compact ? 'Continue' : `Continue ${input.lane}`
}
