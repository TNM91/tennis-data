const STRIPE_API_VERSION = '2026-04-22.dahlia'
const RETIRED_TEAM_INVITE_COUPONS = [
  'tiq_captain_team_invite_first_month_2026_v2',
  'tiq_player_team_invite_first_month_2026_v2',
]

const secretKey = process.env.STRIPE_PRICE_MIGRATION_KEY?.trim() || process.env.STRIPE_SECRET_KEY?.trim() || ''
if (!isLiveStripeKey(secretKey)) stop('Use a live Stripe secret or restricted key to retire live promotion codes.')

const promotionCodes = await listActivePromotionCodes()
const apply = process.argv.includes('--apply')
const retiredCoupons = []
if (apply) {
  for (const promotionCode of promotionCodes) {
    const params = new URLSearchParams({ active: 'false' })
    await stripeRequest(`/v1/promotion_codes/${encodeURIComponent(promotionCode.id)}`, { method: 'POST', body: params })
  }

  for (const couponId of RETIRED_TEAM_INVITE_COUPONS) {
    const result = await stripeRequest(`/v1/coupons/${encodeURIComponent(couponId)}`, { method: 'DELETE', allowNotFound: true })
    if (result) retiredCoupons.push(couponId)
  }
}

console.log(JSON.stringify({
  ok: true,
  mode: apply ? 'applied' : 'audit',
  activePromotionCodeCount: promotionCodes.length,
  retiredTeamInviteCouponCount: apply ? retiredCoupons.length : null,
  note: 'Existing subscriptions keep the Stripe terms already attached to them.',
}, null, 2))

async function listActivePromotionCodes() {
  const results = []
  let startingAfter = ''
  do {
    const params = new URLSearchParams({ active: 'true', limit: '100' })
    if (startingAfter) params.set('starting_after', startingAfter)
    const page = await stripeRequest(`/v1/promotion_codes?${params.toString()}`)
    const data = Array.isArray(page?.data) ? page.data : []
    results.push(...data.filter((value) => typeof value?.id === 'string' && value.id))
    startingAfter = page?.has_more && data.length ? data[data.length - 1]?.id || '' : ''
  } while (startingAfter)
  return results
}

async function stripeRequest(path, options = {}) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
    },
    body: options.body,
  })
  if (options.allowNotFound && response.status === 404) return null
  const json = await response.json().catch(() => null)
  if (!response.ok) stop(json?.error?.message || `Stripe request failed with ${response.status}.`)
  return json
}

function isLiveStripeKey(value) {
  return value.startsWith('sk_live_') || value.startsWith('rk_live_')
}

function stop(message) {
  console.error(message)
  process.exit(1)
}
