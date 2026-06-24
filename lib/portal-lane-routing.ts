import type { ProductAccessState } from './access-model'
import { getPrimaryNavTarget } from './primary-nav-access'
import { getPlanUnlockHref } from './plan-intent'

type PortalLaneRoutingInput = {
  laneId: 'find' | 'you' | 'compete' | 'coach' | 'team' | 'league'
  fallbackHref: string
  planRoute: '/explore' | '/player-development' | '/mylab' | '/compete' | '/coach' | '/captain' | '/league-coordinator'
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
  void profileLinked
  if (accessPending) return { href: fallbackHref, locked: false, requiredPlan: null }

  if (laneId === 'coach') {
    return getPrimaryNavTarget('/coach', access, authenticated)
  }

  if (laneId === 'league') {
    return access.canUseLeagueTools
      ? { href: '/league-coordinator', locked: false, requiredPlan: null }
      : {
          href: getPlanUnlockHref('league', '/league-coordinator'),
          locked: true,
          requiredPlan: 'league',
        }
  }

  return getPrimaryNavTarget(planRoute, access, authenticated)
}
