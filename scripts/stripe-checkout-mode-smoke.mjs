import { readFileSync } from 'node:fs'

const PLAN_CONFIG = {
  player_plus: { name: 'Player', nextHref: '/me' },
  coach: { name: 'Coach', nextHref: '/coach' },
  captain: { name: 'Captain', nextHref: '/captain' },
  league: { name: 'League', nextHref: '/league-coordinator' },
  full_court: { name: 'Full-Court', nextHref: '/league-coordinator/tournaments' },
}

const args = new Map(
  process.argv.slice(2).flatMap((arg) => {
    if (!arg.startsWith('--')) return []
    const [key, ...rest] = arg.slice(2).split('=')
    return [[key, rest.join('=') || 'true']]
  }),
)

const expectedMode = args.get('expect') || 'live'
const planId = args.get('plan') || 'coach'
const plan = PLAN_CONFIG[planId]

if (!['live', 'test', 'any'].includes(expectedMode)) {
  stop('Use --expect=live, --expect=test, or --expect=any.')
}

if (!plan) {
  stop(`Use --plan=${Object.keys(PLAN_CONFIG).join('|')}.`)
}

const env = loadDotenv('.env.local')
const baseUrl = env.TENACEIQ_QA_BASE_URL || env.PLATFORM_QA_BASE_URL || 'https://www.tenaceiq.com'
const email = env.TENACEIQ_QA_FREE_EMAIL
const password = env.TENACEIQ_QA_FREE_PASSWORD

if (!email || !password) {
  stop('Set TENACEIQ_QA_FREE_EMAIL and TENACEIQ_QA_FREE_PASSWORD before running the Stripe mode smoke.')
}

const { url: supabaseUrl, key: supabaseKey } = readSupabasePublicConfig()
const token = await signInQaUser({ supabaseUrl, supabaseKey, email, password })
const requestId = await createUpgradeRequest({ baseUrl, token, email, planId, plan })
const checkout = await createCheckoutSession({ baseUrl, token, requestId, nextHref: plan.nextHref })
const checkoutHost = new URL(checkout.url).hostname
const stripeSessionMode = getSessionMode(checkout.sessionId)
const passed = expectedMode === 'any' || expectedMode === stripeSessionMode

console.log(JSON.stringify({
  baseUrl,
  plan: plan.name,
  expectedMode,
  stripeSessionMode,
  checkoutHost,
  upgradeRequestCreated: true,
  checkoutSessionCreated: true,
  passed,
}, null, 2))

if (!passed) {
  stop(`Expected Stripe ${expectedMode} mode but production returned ${stripeSessionMode} mode.`)
}

function loadDotenv(path) {
  let source = ''
  try {
    source = readFileSync(path, 'utf8')
  } catch {
    return {}
  }

  const values = {}
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const index = line.indexOf('=')
    if (index === -1) continue

    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }

  return values
}

function readSupabasePublicConfig() {
  const source = readFileSync('lib/supabase.ts', 'utf8')
  const url = source.match(/supabaseUrl = '([^']+)'/)?.[1]
  const key = source.match(/supabaseKey = '([^']+)'/)?.[1]

  if (!url || !key) {
    stop('Could not read the public Supabase config from lib/supabase.ts.')
  }

  return { url, key }
}

async function signInQaUser({ supabaseUrl, supabaseKey, email, password }) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
  const body = await readJson(response)

  if (!response.ok || !body.access_token) {
    stop(`QA sign-in failed with HTTP ${response.status}.`)
  }

  return body.access_token
}

async function createUpgradeRequest({ baseUrl, token, email, planId, plan }) {
  const response = await fetch(`${baseUrl}/api/upgrade-requests`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      planId,
      planName: plan.name,
      email,
      goal: `Production QA Stripe ${expectedMode} mode smoke for ${plan.name}`,
      nextHref: plan.nextHref,
    }),
  })
  const body = await readJson(response)

  if (!response.ok || !body.ok || !body.request?.id) {
    stop(`Upgrade request failed with HTTP ${response.status}: ${body.message || 'unknown error'}`)
  }

  return body.request.id
}

async function createCheckoutSession({ baseUrl, token, requestId, nextHref }) {
  const response = await fetch(`${baseUrl}/api/checkout/session`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requestId, nextHref }),
  })
  const body = await readJson(response)

  if (!response.ok || !body.ok || !body.sessionId || !body.url) {
    stop(`Checkout session failed with HTTP ${response.status}: ${body.message || 'unknown error'}`)
  }

  return body
}

async function readJson(response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text.slice(0, 200) }
  }
}

function getSessionMode(sessionId) {
  if (typeof sessionId !== 'string') return 'unknown'
  if (sessionId.startsWith('cs_live_')) return 'live'
  if (sessionId.startsWith('cs_test_')) return 'test'
  return 'unknown'
}

function stop(message) {
  console.error(message)
  process.exit(1)
}
