import type { PricingPlanId } from '@/lib/pricing-plans'

export function getPlanDestinationHref(planId: PricingPlanId) {
  if (planId === 'full_court') return '/league-coordinator'
  if (planId === 'coach') return '/coach'
  if (planId === 'captain') return '/captain'
  if (planId === 'league') return '/league-coordinator'
  if (planId === 'player_plus') return '/profile'
  return '/explore'
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
  if (candidate !== candidate.trim()) return fallback
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback
  if (/\\|%5c|[\u0000-\u001f\u007f]/i.test(candidate)) return fallback

  try {
    const base = new URL('https://tenaceiq.invalid')
    const parsed = new URL(candidate, base)
    if (parsed.origin !== base.origin) return fallback

    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`
    if (/^\/(login|join)(?:\/|$)/i.test(parsed.pathname)) return fallback
    return normalized
  } catch {
    return fallback
  }
}
