import type { ProductAccessState } from './access-model'

type PortalLaneRoutingInput = {
  laneId: 'find' | 'you' | 'compete' | 'coach' | 'team' | 'league' | 'club'
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
  void laneId
  void planRoute
  void access
  void authenticated
  void accessPending
  void profileLinked

  return { href: fallbackHref, locked: false, requiredPlan: null }
}
