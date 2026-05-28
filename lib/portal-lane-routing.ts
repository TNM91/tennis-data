import type { ProductAccessState } from './access-model'
import { getPrimaryNavTarget } from './primary-nav-access'

type PortalLaneRoutingInput = {
  laneId: 'find' | 'you' | 'coach' | 'team' | 'league'
  fallbackHref: string
  planRoute: '/explore' | '/mylab' | '/coach' | '/captain' | '/league-coordinator'
  access: ProductAccessState
  authenticated: boolean
  accessPending: boolean
  profileLinked?: boolean
}

export function getPortalLaneTarget({
  laneId,
  fallbackHref,
  planRoute,
  access,
  authenticated,
  accessPending,
  profileLinked = true,
}: PortalLaneRoutingInput) {
  if (accessPending) return { href: fallbackHref, locked: false, requiredPlan: null }

  if (laneId === 'you' && authenticated && access.canUseAdvancedPlayerInsights && !profileLinked) {
    return { href: '/profile', locked: false, requiredPlan: null }
  }

  if (laneId === 'team' && authenticated && access.canUseCaptainWorkflow && !profileLinked) {
    return { href: '/profile', locked: false, requiredPlan: null }
  }

  if (laneId === 'coach') {
    return getPrimaryNavTarget('/coach', access, authenticated)
  }

  if (laneId === 'league') {
    return access.canUseLeagueTools
      ? { href: '/league-coordinator', locked: false, requiredPlan: null }
      : { href: fallbackHref, locked: false, requiredPlan: null }
  }

  return getPrimaryNavTarget(planRoute, access, authenticated)
}
