const STRIPE_API_VERSION = '2026-04-22.dahlia'
const COUPONS = [
  {
    id: 'tiq_captain_team_invite_first_month_2026_v2',
    amountOff: 300,
    name: 'Captain invite: first month $2.99',
    planId: 'captain',
  },
  {
    id: 'tiq_player_team_invite_first_month_2026_v2',
    amountOff: 150,
    name: 'Improve invite: first month $1.49',
    planId: 'player_plus',
  },
]

const secretKey = process.env.STRIPE_SECRET_KEY?.trim() || ''
const expectedMode = process.argv.includes('--expect=test') ? 'test' : 'live'

if (!secretKey) stop('Set STRIPE_SECRET_KEY before provisioning invitation coupons.')
if (expectedMode === 'live' && !isLiveStripeKey(secretKey)) {
  stop('Expected a live Stripe secret or restricted key. Use --expect=test only for an intentional test-mode setup.')
}
if (expectedMode === 'test' && !secretKey.startsWith('sk_test_')) {
  stop('Expected a test Stripe key.')
}

const results = []
for (const config of COUPONS) {
  const existing = await stripeRequest(`/v1/coupons/${encodeURIComponent(config.id)}`, { allowNotFound: true })
  const coupon = existing || await createCoupon(config)
  verifyCoupon(coupon, config)
  results.push({
    id: coupon.id,
    amountOff: coupon.amount_off,
    currency: coupon.currency,
    duration: coupon.duration,
    livemode: coupon.livemode,
    created: !existing,
  })
}

console.log(JSON.stringify({ expectedMode, coupons: results }, null, 2))

async function createCoupon(config) {
  const body = new URLSearchParams({
    id: config.id,
    amount_off: String(config.amountOff),
    currency: 'usd',
    duration: 'once',
    name: config.name,
    'metadata[source]': 'team_connection',
    'metadata[plan_id]': config.planId,
  })
  return stripeRequest('/v1/coupons', { method: 'POST', body })
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

function verifyCoupon(coupon, config) {
  const expectedLiveMode = expectedMode === 'live'
  if (
    coupon?.id !== config.id ||
    coupon.amount_off !== config.amountOff ||
    coupon.currency !== 'usd' ||
    coupon.duration !== 'once' ||
    coupon.livemode !== expectedLiveMode ||
    coupon.valid !== true
  ) {
    stop(`Coupon ${config.id} exists but does not match the expected immutable configuration.`)
  }
}

function stop(message) {
  console.error(message)
  process.exit(1)
}

function isLiveStripeKey(value) {
  return value.startsWith('sk_live_') || value.startsWith('rk_live_')
}
