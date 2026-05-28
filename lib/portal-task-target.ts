import type { ProductAccessState } from './access-model'
import { getPrimaryNavTarget } from './primary-nav-access'
import { getPlanSignupHref, getPlanUnlockHref } from './plan-intent'

type PortalTaskTargetInput = {
  href: string
  requiredRoute: '/explore' | '/mylab' | '/coach' | '/captain' | '/league-coordinator'
  title: string
  access: ProductAccessState
  authenticated: boolean
  accessPending: boolean
  profileLinked?: boolean
}

export function getPortalTaskTarget({
  href,
  requiredRoute,
  title,
  access,
  authenticated,
  accessPending,
  profileLinked = true,
}: PortalTaskTargetInput) {
  if (accessPending) return { href, title, locked: false, requiredPlan: null }

  if (href === '/mylab' && authenticated && access.canUseAdvancedPlayerInsights && !profileLinked) {
    return { href: '/profile', title: 'Set profile', locked: false, requiredPlan: null }
  }

  if (requiredRoute === '/captain' && authenticated && access.canUseCaptainWorkflow && !profileLinked) {
    return { href: '/profile', title: 'Set profile', locked: false, requiredPlan: null }
  }

  const target = getPrimaryNavTarget(requiredRoute, access, authenticated)
  if (target.locked && href === '/league-coordinator/tournaments') {
    return {
      href: authenticated ? getPlanUnlockHref('full_court', href) : getPlanSignupHref('full_court', href),
      title,
      locked: true,
      requiredPlan: 'full_court',
    }
  }

  return {
    href: target.locked ? target.href : href,
    title,
    locked: target.locked,
    requiredPlan: target.requiredPlan,
  }
}
