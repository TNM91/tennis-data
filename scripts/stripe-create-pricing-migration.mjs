const STRIPE_API_VERSION = '2026-04-22.dahlia'
const PRICE_VERSION = '2026-08-29-pricing-v2'

const plans = [
  { id: 'player_plus', envName: 'STRIPE_PLAYER_PRICE_ID', amountCents: 299 },
  { id: 'coach', envName: 'STRIPE_COACH_PRICE_ID', amountCents: 599 },
  { id: 'captain', envName: 'STRIPE_CAPTAIN_PRICE_ID', amountCents: 599 },
  { id: 'full_court', envName: 'STRIPE_FULL_COURT_PRICE_ID', amountCents: 1499 },
]

const secretKey = process.env.STRIPE_PRICE_MIGRATION_KEY?.trim() || process.env.STRIPE_SECRET_KEY?.trim() || ''
if (!isLiveStripeKey(secretKey)) stop('Use a live Stripe secret or restricted key to create the production price migration.')

const createdOrFound = []
for (const plan of plans) {
  const currentPriceId = process.env[plan.envName]?.trim() || ''
  if (!currentPriceId.startsWith('price_')) stop(`Missing a valid ${plan.envName}.`)

  const currentPrice = await stripeRequest(`/v1/prices/${encodeURIComponent(currentPriceId)}`)
  if (!currentPrice?.livemode || !currentPrice?.product) stop(`${plan.id} must reference a live Stripe Price with a product.`)
  if (currentPrice.currency !== 'usd' || currentPrice.recurring?.interval !== 'month') {
    stop(`${plan.id} must reference a monthly USD subscription Price.`)
  }

  const productId = typeof currentPrice.product === 'string' ? currentPrice.product : currentPrice.product.id
  const matchingPrice = await findMatchingPrice(productId, plan)
  const price = matchingPrice || await createPrice(productId, plan)
  createdOrFound.push({
    planId: plan.id,
    envName: plan.envName,
    priceId: price.id,
    amountCents: price.unit_amount,
    created: !matchingPrice,
  })
}

console.log(JSON.stringify({ ok: true, priceVersion: PRICE_VERSION, prices: createdOrFound }, null, 2))

async function findMatchingPrice(productId, plan) {
  const params = new URLSearchParams({ product: productId, active: 'true', limit: '100' })
  const response = await stripeRequest(`/v1/prices?${params.toString()}`)
  return response.data?.find((price) => (
    price.livemode === true &&
    price.active === true &&
    price.unit_amount === plan.amountCents &&
    price.currency === 'usd' &&
    price.recurring?.interval === 'month' &&
    price.metadata?.tenaceiq_plan_id === plan.id &&
    price.metadata?.tenaceiq_price_version === PRICE_VERSION
  )) || null
}

async function createPrice(productId, plan) {
  const body = new URLSearchParams({
    product: productId,
    unit_amount: String(plan.amountCents),
    currency: 'usd',
    'recurring[interval]': 'month',
    'metadata[tenaceiq_plan_id]': plan.id,
    'metadata[tenaceiq_price_version]': PRICE_VERSION,
  })
  return stripeRequest('/v1/prices', { method: 'POST', body })
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
  const json = await response.json().catch(() => null)
  if (!response.ok) stop(json?.error?.message || `Stripe request failed with ${response.status}.`)
  return json
}

function stop(message) {
  console.error(message)
  process.exit(1)
}

function isLiveStripeKey(value) {
  return value.startsWith('sk_live_') || value.startsWith('rk_live_')
}
