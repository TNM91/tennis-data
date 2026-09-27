import { type BillablePricingPlanId } from '@/lib/pricing-plans'

export const AUTH_ENTRY_PLAN_IDS: BillablePricingPlanId[] = [
  'free',
  'player_plus',
  'coach',
  'captain',
  'league',
  'full_court',
  'club_starter',
  'club_unlimited',
]

export function getAuthEntryPlanId(candidate: string | null | undefined): BillablePricingPlanId {
  return AUTH_ENTRY_PLAN_IDS.includes(candidate as BillablePricingPlanId) ? (candidate as BillablePricingPlanId) : 'free'
}

export function buildAuthEntryHref(
  pathname: string,
  planId: BillablePricingPlanId,
  nextHref: string,
  includeNextHref: boolean,
) {
  const params = new URLSearchParams()
  if (planId !== 'free') params.set('plan', planId)
  if (includeNextHref) params.set('next', nextHref)

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
