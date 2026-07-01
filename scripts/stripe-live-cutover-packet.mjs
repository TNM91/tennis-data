const stripeGoLiveChecklistUrl = 'https://docs.stripe.com/get-started/checklist/go-live'
const productionWebhookUrl = 'https://www.tenaceiq.com/api/stripe/webhook'

const requiredWebhookEvents = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
]

const requiredEnvNames = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PLAYER_PRICE_ID',
  'STRIPE_COACH_PRICE_ID',
  'STRIPE_CAPTAIN_PRICE_ID',
  'STRIPE_LEAGUE_PRICE_ID',
  'STRIPE_FULL_COURT_PRICE_ID',
]

const expectedCatalog = [
  {
    plan: 'Player',
    planId: 'player_plus',
    priceEnvName: 'STRIPE_PLAYER_PRICE_ID',
    amountCents: 499,
    currency: 'usd',
    checkoutMode: 'subscription',
    interval: 'month',
  },
  {
    plan: 'Coach',
    planId: 'coach',
    priceEnvName: 'STRIPE_COACH_PRICE_ID',
    amountCents: 999,
    currency: 'usd',
    checkoutMode: 'subscription',
    interval: 'month',
  },
  {
    plan: 'Captain',
    planId: 'captain',
    priceEnvName: 'STRIPE_CAPTAIN_PRICE_ID',
    amountCents: 999,
    currency: 'usd',
    checkoutMode: 'subscription',
    interval: 'month',
  },
  {
    plan: 'League',
    planId: 'league',
    priceEnvName: 'STRIPE_LEAGUE_PRICE_ID',
    amountCents: 1499,
    currency: 'usd',
    checkoutMode: 'one_time',
    interval: 'season',
  },
  {
    plan: 'Full-Court',
    planId: 'full_court',
    priceEnvName: 'STRIPE_FULL_COURT_PRICE_ID',
    amountCents: 1999,
    currency: 'usd',
    checkoutMode: 'subscription',
    interval: 'month',
  },
]

const cutoverPacket = {
  title: 'TenAceIQ Stripe Live Cutover Packet',
  safety: [
    'Do not paste Stripe secret keys, restricted keys, webhook secrets, or live price values into docs or chat.',
    'Use separate live-mode Stripe keys and live Price IDs; sandbox/test objects cannot power live checkout.',
    'Prefer a restricted live key with only the permissions this app needs when practical.',
    'Keep Stripe in test mode until the owner explicitly approves opening real paid upgrades.',
  ],
  sourceOfTruth: {
    stripeGoLiveChecklistUrl,
    productionWebhookUrl,
    apiVersion: '2026-04-22.dahlia',
  },
  expectedCatalog,
  requiredVercelProductionEnvNames: requiredEnvNames,
  requiredWebhookEvents,
  cutoverOrder: [
    {
      step: 'Create or confirm live Stripe catalog',
      checks: [
        'Create live Products and Prices for Player, Coach, Captain, League, and Full-Court.',
        'Use recurring monthly Prices for Player, Coach, Captain, and Full-Court.',
        'Use a one-time live Price for League season access.',
        'Confirm every live Price is active and uses USD at the expected amount.',
      ],
      command: 'npm run qa:stripe-live-catalog',
    },
    {
      step: 'Verify live catalog from the shell',
      checks: [
        'Set a live-mode Stripe key and the five live Price IDs in the local shell only.',
        'Run the audit against Stripe; it rejects test-mode keys and redacts Price IDs.',
      ],
      command: 'npm run qa:stripe-live-catalog -- --stripe',
    },
    {
      step: 'Register live production webhook',
      checks: [
        `Endpoint: ${productionWebhookUrl}`,
        'Add every required lifecycle event listed in this packet.',
        'Use the live webhook signing secret for Vercel Production.',
      ],
      command: 'npm run qa:stripe-live-readiness',
    },
    {
      step: 'Replace Vercel Production Stripe env values',
      checks: [
        'Set only Vercel Production values for the live cutover.',
        'Do not print or commit values.',
        'Confirm all required env names are present after the swap.',
      ],
      command: 'npm run qa:stripe-live-readiness -- --vercel',
    },
    {
      step: 'Redeploy and smoke live mode',
      checks: [
        'Redeploy Production so the new encrypted env values are active.',
        'Run the no-card checkout smoke and confirm Checkout Session IDs start with cs_live_.',
        'Run production log smoke after deploy.',
      ],
      command: 'npm run qa:stripe-live-mode && npm run qa:prod-logs',
    },
    {
      step: 'Controlled live payment',
      checks: [
        'Complete one controlled live payment for the lowest-risk paid plan.',
        'Confirm profile access, Stripe billing event audit row, and billing portal handoff.',
        'Refund or cancel only through Stripe Dashboard, then confirm webhook-driven access update.',
      ],
      command: 'Manual Stripe Dashboard plus app verification',
    },
  ],
  rollbackIfNeeded: [
    'Restore the previous test-mode Vercel Production Stripe env values from the secure owner source.',
    'Redeploy Production.',
    'Run node scripts/stripe-checkout-mode-smoke.mjs --expect=test --plan=coach.',
    'Run npm run qa:prod-logs.',
  ],
}

console.log(JSON.stringify(cutoverPacket, null, 2))
