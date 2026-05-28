import { buildProductAccessState, type ProductEntitlementSnapshot } from './access-model'
import { type UserRole } from './roles'

export const FREE_POST_LOGIN_ROUTE = '/explore/search'

export function getDefaultProductHomeRoute(
  role: UserRole = 'member',
  entitlements?: ProductEntitlementSnapshot | null,
  hasLinkedPlayer = true,
) {
  const access = buildProductAccessState(role, entitlements)

  if (access.canUseLeagueTools) return '/league-coordinator'
  if (access.canUseCaptainWorkflow) return hasLinkedPlayer ? '/captain' : '/profile'
  if (access.canUseCoachWorkflow) return '/coach'
  if (access.canUseAdvancedPlayerInsights) return hasLinkedPlayer ? '/mylab' : '/profile'

  return FREE_POST_LOGIN_ROUTE
}
