import { getPricingPlan, type PricingPlanId } from './pricing-plans'

export type PaidPricingPlanId = Exclude<PricingPlanId, 'free'>

export type StripeCheckoutSessionInput = {
  planId: PaidPricingPlanId
  priceId: string
  requestId: string
  userId: string
  customerEmail?: string
  origin: string
  nextHref: string
}

export const STRIPE_PRICE_ENV_BY_PLAN: Record<PaidPricingPlanId, string> = {
  player_plus: 'STRIPE_PLAYER_PRICE_ID',
  captain: 'STRIPE_CAPTAIN_PRICE_ID',
  league: 'STRIPE_LEAGUE_PRICE_ID',
}

export function getStripePriceId(planId: PaidPricingPlanId, env: Record<string, string | undefined> = process.env) {
  return env[STRIPE_PRICE_ENV_BY_PLAN[planId]]?.trim() ?? ''
}

export function getStripeCheckoutMode(planId: PaidPricingPlanId) {
  const checkoutMode = getPricingPlan(planId).billing.checkoutMode
  return checkoutMode === 'subscription' ? 'subscription' : 'payment'
}

export function buildStripeCheckoutSessionParams({
  planId,
  priceId,
  requestId,
  userId,
  customerEmail,
  origin,
  nextHref,
}: StripeCheckoutSessionInput) {
  const mode = getStripeCheckoutMode(planId)
  const metadata = {
    upgrade_request_id: requestId,
    user_id: userId,
    plan_id: planId,
  }
  const successUrl = buildUpgradeReturnUrl(origin, planId, nextHref, 'success', requestId)
  const cancelUrl = buildUpgradeReturnUrl(origin, planId, nextHref, 'cancel', requestId)
  const params = new URLSearchParams()

  params.set('mode', mode)
  params.set('line_items[0][price]', priceId)
  params.set('line_items[0][quantity]', '1')
  params.set('success_url', successUrl)
  params.set('cancel_url', cancelUrl)
  params.set('client_reference_id', requestId)
  params.set('allow_promotion_codes', 'true')
  params.set('metadata[upgrade_request_id]', metadata.upgrade_request_id)
  params.set('metadata[user_id]', metadata.user_id)
  params.set('metadata[plan_id]', metadata.plan_id)

  if (customerEmail) {
    params.set('customer_email', customerEmail)
  }

  const nestedMetadataPrefix =
    mode === 'subscription'
      ? 'subscription_data[metadata]'
      : 'payment_intent_data[metadata]'

  params.set(`${nestedMetadataPrefix}[upgrade_request_id]`, metadata.upgrade_request_id)
  params.set(`${nestedMetadataPrefix}[user_id]`, metadata.user_id)
  params.set(`${nestedMetadataPrefix}[plan_id]`, metadata.plan_id)

  return params
}

function buildUpgradeReturnUrl(
  origin: string,
  planId: PaidPricingPlanId,
  nextHref: string,
  checkout: 'success' | 'cancel',
  requestId: string,
) {
  const url = new URL('/upgrade', origin)
  url.searchParams.set('plan', planId)
  url.searchParams.set('next', nextHref)
  url.searchParams.set('checkout', checkout)
  url.searchParams.set('request', requestId)
  if (checkout === 'success') {
    url.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}')
  }
  return url.toString()
}
