import type { PricingPlanId } from '@/lib/pricing-plans'

export function getPlanDestinationHref(planId: PricingPlanId) {
  if (planId === 'captain') return '/captain'
  if (planId === 'league') return '/captain/season-dashboard'
  if (planId === 'player_plus') return '/profile'
  return '/mylab'
}

export function getPlanUnlockHref(planId: PricingPlanId, nextHref = getPlanDestinationHref(planId)) {
  if (planId === 'free') return nextHref
  return `/upgrade?plan=${planId}&next=${encodeURIComponent(nextHref)}`
}

export function getPlanSignupHref(planId: PricingPlanId, nextHref = getPlanUnlockHref(planId)) {
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
