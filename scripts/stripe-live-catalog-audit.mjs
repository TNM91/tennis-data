const args = new Set(process.argv.slice(2))
const queryStripe = args.has('--stripe')

const STRIPE_API_VERSION = '2026-04-22.dahlia'

const expectedPlans = [
  {
    id: 'player_plus',
    name: 'Player',
    envName: 'STRIPE_PLAYER_PRICE_ID',
    amountCents: 499,
    currency: 'usd',
    checkoutMode: 'subscription',
    recurringInterval: 'month',
  },
  {
    id: 'coach',
    name: 'Coach',
    envName: 'STRIPE_COACH_PRICE_ID',
    amountCents: 999,
    currency: 'usd',
    checkoutMode: 'subscription',
    recurringInterval: 'month',
  },
  {
    id: 'captain',
    name: 'Captain',
    envName: 'STRIPE_CAPTAIN_PRICE_ID',
    amountCents: 999,
    currency: 'usd',
    checkoutMode: 'subscription',
    recurringInterval: 'month',
  },
  {
    id: 'league',
    name: 'League',
    envName: 'STRIPE_LEAGUE_PRICE_ID',
    amountCents: 1499,
    currency: 'usd',
    checkoutMode: 'one_time',
    recurringInterval: null,
  },
  {
    id: 'full_court',
    name: 'Full-Court',
    envName: 'STRIPE_FULL_COURT_PRICE_ID',
    amountCents: 1999,
    currency: 'usd',
    checkoutMode: 'subscription',
    recurringInterval: 'month',
  },
]

const sourceChecks = [
  {
    label: 'Expected catalog has five paid plans',
    ok: expectedPlans.length === 5,
  },
  ...expectedPlans.map((plan) => ({
    label: `${plan.name} has a positive ${plan.currency.toUpperCase()} amount`,
    ok: Number.isInteger(plan.amountCents) && plan.amountCents > 0 && plan.currency === 'usd',
  })),
]

let stripeChecks = []

if (queryStripe) {
  stripeChecks = await queryStripePrices()
}

const checks = [...sourceChecks, ...stripeChecks]
const ok = checks.every((check) => check.ok)

console.log(JSON.stringify({
  ok,
  checkedStripe: queryStripe,
  apiVersion: STRIPE_API_VERSION,
  expectedPlans: expectedPlans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    envName: plan.envName,
    amountCents: plan.amountCents,
    currency: plan.currency,
    checkoutMode: plan.checkoutMode,
    recurringInterval: plan.recurringInterval,
  })),
  checks,
}, null, 2))

if (!ok) {
  stop('Stripe live catalog audit failed.')
}

async function queryStripePrices() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? ''

  if (!secretKey) {
    stop('Set STRIPE_SECRET_KEY in the shell before running the Stripe catalog audit with --stripe.')
  }

  if (!isLiveStripeKey(secretKey)) {
    stop('Use a live-mode Stripe key for --stripe. Test-mode keys are intentionally rejected.')
  }

  const checks = [
    { label: 'Stripe key is live-mode', ok: true },
  ]

  for (const plan of expectedPlans) {
    const priceId = process.env[plan.envName]?.trim() ?? ''
    if (!priceId) {
      checks.push({ label: `${plan.name} price env ${plan.envName} is set`, ok: false })
      continue
    }

    if (!priceId.startsWith('price_')) {
      checks.push({ label: `${plan.name} price env ${plan.envName} looks like a Stripe Price ID`, ok: false })
      continue
    }

    const price = await fetchStripePrice(priceId)
    const product = normalizeProduct(price.product)
    const recurringInterval = price.recurring?.interval ?? null

    checks.push(
      { label: `${plan.name} price ${redactStripeId(priceId)} is live-mode`, ok: price.livemode === true },
      { label: `${plan.name} price is active`, ok: price.active === true },
      { label: `${plan.name} product is active`, ok: product.active === true },
      { label: `${plan.name} amount matches ${plan.amountCents}`, ok: price.unit_amount === plan.amountCents },
      { label: `${plan.name} currency matches ${plan.currency}`, ok: price.currency === plan.currency },
      { label: `${plan.name} recurring interval matches`, ok: recurringInterval === plan.recurringInterval },
      { label: `${plan.name} product name is present`, ok: typeof product.name === 'string' && product.name.trim().length > 0 },
    )
  }

  return checks
}

async function fetchStripePrice(priceId) {
  const url = new URL(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`)
  url.searchParams.set('expand[]', 'product')

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Stripe-Version': STRIPE_API_VERSION,
    },
  })
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const message = body?.error?.message || `Stripe returned HTTP ${response.status}.`
    stop(`Could not read Stripe price ${redactStripeId(priceId)}: ${message}`)
  }

  return body
}

function normalizeProduct(product) {
  if (product && typeof product === 'object') {
    return product
  }
  return { id: typeof product === 'string' ? product : '', active: false, name: '' }
}

function isLiveStripeKey(value) {
  return value.startsWith('sk_live_') || value.startsWith('rk_live_')
}

function redactStripeId(value) {
  if (value.length <= 12) return `${value.slice(0, 6)}...`
  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

function stop(message) {
  console.error(message)
  process.exit(1)
}
