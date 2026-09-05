const STRIPE_API_VERSION = '2026-04-22.dahlia'
const PRICE_VERSION = '2026-09-05-pricing-v3'

const plans = [
  { id: 'player_plus', envName: 'STRIPE_PLAYER_PRICE_ID', amountCents: 199, previousAmountCents: 299 },
  { id: 'coach', envName: 'STRIPE_COACH_PRICE_ID', amountCents: 499, previousAmountCents: 599 },
  { id: 'captain', envName: 'STRIPE_CAPTAIN_PRICE_ID', amountCents: 499, previousAmountCents: 599 },
  { id: 'full_court', envName: 'STRIPE_FULL_COURT_PRICE_ID', amountCents: 999, previousAmountCents: 1499 },
  { id: 'club_starter', envName: 'STRIPE_CLUB_STARTER_PRICE_ID', amountCents: 9900, previousAmountCents: 9900 },
  { id: 'club_unlimited', envName: 'STRIPE_CLUB_UNLIMITED_PRICE_ID', amountCents: 14900, previousAmountCents: 19900 },
]

const secretKey = process.env.STRIPE_PRICE_MIGRATION_KEY?.trim() || process.env.STRIPE_SECRET_KEY?.trim() || ''
if (!isLiveStripeKey(secretKey)) stop('Use a live Stripe secret or restricted key to create the production price migration.')

const createdOrFound = []
for (const plan of plans) {
  const currentPriceId = process.env[plan.envName]?.trim() || ''
  const currentPrice = currentPriceId.startsWith('price_')
    ? await stripeRequest(`/v1/prices/${encodeURIComponent(currentPriceId)}`, { allowNotFound: true })
    : null
  const catalogPrice = currentPrice || await findCurrentCatalogPrice(plan)
  if (!catalogPrice) stop(`Could not find a current live Stripe Price for ${plan.id}.`)
  if (!catalogPrice.livemode || !catalogPrice.product) stop(`${plan.id} must reference a live Stripe Price with a product.`)
  if (catalogPrice.currency !== 'usd' || catalogPrice.recurring?.interval !== 'month') {
    stop(`${plan.id} must reference a monthly USD subscription Price.`)
  }

  const productId = typeof catalogPrice.product === 'string' ? catalogPrice.product : catalogPrice.product.id
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

async function findCurrentCatalogPrice(plan) {
  let startingAfter = ''
  do {
    const params = new URLSearchParams({ active: 'true', limit: '100' })
    if (startingAfter) params.set('starting_after', startingAfter)
    const page = await stripeRequest(`/v1/prices?${params.toString()}`)
    const prices = Array.isArray(page?.data) ? page.data : []
    const matching = prices
      .filter((price) => (
        price.livemode === true
        && price.active === true
        && price.currency === 'usd'
        && price.recurring?.interval === 'month'
        && (price.metadata?.tenaceiq_plan_id === plan.id || price.unit_amount === plan.previousAmountCents)
      ))
      .sort((left, right) => (right.created || 0) - (left.created || 0))[0]
    if (matching) return matching
    startingAfter = page?.has_more && prices.length ? prices[prices.length - 1]?.id || '' : ''
  } while (startingAfter)
  return null
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
  if (options.allowNotFound && response.status === 404) return null
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
