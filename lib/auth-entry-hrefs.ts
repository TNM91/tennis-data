import { type MembershipTierId } from '@/lib/product-story'

export const AUTH_ENTRY_PLAN_IDS: MembershipTierId[] = ['free', 'player_plus', 'coach', 'captain', 'league', 'full_court']

export function getAuthEntryPlanId(candidate: string | null | undefined): MembershipTierId {
  return AUTH_ENTRY_PLAN_IDS.includes(candidate as MembershipTierId) ? (candidate as MembershipTierId) : 'free'
}

export function buildAuthEntryHref(
  pathname: string,
  planId: MembershipTierId,
  nextHref: string,
  includeNextHref: boolean,
) {
  const params = new URLSearchParams()
  if (planId !== 'free') params.set('plan', planId)
  if (includeNextHref) params.set('next', nextHref)

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
