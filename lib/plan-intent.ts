import type { BillablePricingPlanId } from '@/lib/pricing-plans'

export function getPlanDestinationHref(planId: BillablePricingPlanId) {
  if (planId === 'club_starter' || planId === 'club_unlimited') return '/clubs'
  if (planId === 'full_court') return '/league-coordinator'
  if (planId === 'coach') return '/coach'
  if (planId === 'captain') return '/captain'
  if (planId === 'league') return '/league-coordinator'
  if (planId === 'player_plus') return '/profile'
  return '/mylab'
}

export function getPlanUnlockHref(planId: BillablePricingPlanId, nextHref = getPlanDestinationHref(planId)) {
  if (planId === 'free') return nextHref
  return `/upgrade?plan=${planId}&next=${encodeURIComponent(nextHref)}`
}

export function getPlanSignupHref(planId: BillablePricingPlanId, nextHref = getPlanUnlockHref(planId)) {
  return `/join?plan=${planId}&next=${encodeURIComponent(nextHref)}`
}

export function isSafeLocalNextHref(candidate: string | null | undefined, fallback: string) {
  if (!candidate) return fallback
  if (!candidate.startsWith('/')) return fallback
  if (candidate.startsWith('//')) return fallback
  if (candidate.startsWith('/login')) return fallback
  if (candidate.startsWith('/join')) return fallback
  return candidate
}
