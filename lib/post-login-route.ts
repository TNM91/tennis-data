import { buildProductAccessState, type ProductEntitlementSnapshot } from './access-model'
import { type UserRole } from './roles'

export const FREE_POST_LOGIN_ROUTE = '/explore/search'

export function getDefaultProductHomeRoute(
  role: UserRole = 'member',
  entitlements?: ProductEntitlementSnapshot | null,
  hasLinkedPlayer = true,
) {
  void hasLinkedPlayer
  const access = buildProductAccessState(role, entitlements)

  if (access.canUseLeagueTools) return '/league-coordinator'
  if (access.canUseCaptainWorkflow) return '/captain'
  if (access.canUseCoachWorkflow) return '/coach'
  if (access.canUseAdvancedPlayerInsights) return '/mylab'

  return FREE_POST_LOGIN_ROUTE
}
