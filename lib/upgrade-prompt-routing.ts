import { buildAuthEntryHref } from './auth-entry-hrefs'
import { getPlanCheckoutHref, getPlanUnlockHref } from './plan-intent'
import type { BillablePricingPlanId } from './pricing-plans'

export function getUpgradePromptHref(
  planId: BillablePricingPlanId,
  ctaHref: string | undefined,
  checkoutEnabled: boolean,
  signedIn: boolean,
) {
  if (!checkoutEnabled || planId === 'free') return ctaHref || getPlanUnlockHref(planId)

  let checkoutHref = getPlanCheckoutHref(planId, planId === 'player_plus' ? '/mylab' : undefined)
  if (ctaHref) {
    if (!ctaHref.startsWith('/upgrade?')) return ctaHref
    const url = new URL(ctaHref, 'https://tenaceiq.invalid')
    if (url.searchParams.get('plan') !== planId) return ctaHref
    const checkoutState = url.searchParams.get('checkout')
    if (checkoutState && checkoutState !== 'auto') return ctaHref
    url.searchParams.set('checkout', 'auto')
    checkoutHref = `${url.pathname}${url.search}${url.hash}`
  }

  return signedIn ? checkoutHref : buildAuthEntryHref('/login', planId, checkoutHref, true)
}
