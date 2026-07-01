import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = new Set(process.argv.slice(2))
const checkVercel = args.has('--vercel')

const requiredEnvNames = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PLAYER_PRICE_ID',
  'STRIPE_COACH_PRICE_ID',
  'STRIPE_CAPTAIN_PRICE_ID',
  'STRIPE_LEAGUE_PRICE_ID',
  'STRIPE_FULL_COURT_PRICE_ID',
]

const requiredWebhookEvents = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
]

const requiredPriceEnvNames = requiredEnvNames.filter((name) => name.endsWith('_PRICE_ID'))
const checks = []

checkFileIncludes('.env.example', requiredEnvNames, '.env.example documents every Stripe launch env var')
checkFileIncludes('docs/stripe-lifecycle-qa.md', [
  'https://www.tenaceiq.com/api/stripe/webhook',
  'npm run qa:stripe-live-mode',
  'cs_live_',
  'cs_test_',
  'controlled live payment',
  'Refund or cancel the controlled live payment only through Stripe Dashboard',
], 'Stripe lifecycle doc keeps the live-mode gate explicit')
checkFileIncludes('docs/stripe-lifecycle-qa.md', requiredWebhookEvents, 'Stripe lifecycle doc lists required webhook events')
checkFileIncludes('lib/stripe-checkout.ts', requiredPriceEnvNames, 'Stripe checkout maps every paid plan to a price env var')
checkFileIncludes('app/api/checkout/session/route.ts', [
  "STRIPE_API_VERSION = '2026-04-22.dahlia'",
  "'Stripe-Version': STRIPE_API_VERSION",
  'https://api.stripe.com/v1/checkout/sessions',
  'Authorization: `Bearer ${stripeSecretKey}`',
], 'Checkout session route uses the pinned Stripe API version and server-side secret')
checkFileIncludes('lib/stripe-webhook.ts', [
  'DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 300',
  'timingSafeEqual',
  'verifyStripeWebhookSignature',
], 'Webhook helper verifies signed payloads with a timestamp tolerance')
checkFileIncludes('app/api/stripe/webhook/route.ts', [
  'STRIPE_WEBHOOK_SECRET',
  "request.headers.get('stripe-signature')",
  'parseStripeWebhookEvent',
  "runtime = 'nodejs'",
], 'Production webhook route verifies Stripe signatures server-side')
checkFileIncludes('lib/stripe-billing.ts', requiredWebhookEvents.slice(2), 'Billing lifecycle helper handles required subscription events')
checkFileIncludes('package.json', [
  '"qa:stripe-live-mode": "node scripts/stripe-checkout-mode-smoke.mjs --expect=live"',
  '"qa:stripe-live-readiness": "node scripts/stripe-live-readiness.mjs"',
], 'Package scripts expose readiness and live-mode smoke commands')

if (checkVercel) {
  const output = runVercelEnvList()
  for (const envName of requiredEnvNames) {
    addCheck(
      `Vercel Production has ${envName}`,
      hasProductionEnvLine(output, envName),
    )
  }
}

const ok = checks.every((check) => check.ok)

console.log(JSON.stringify({
  ok,
  checkedVercel: checkVercel,
  checks,
}, null, 2))

if (!ok) {
  stop('Stripe live readiness checks failed.')
}

function checkFileIncludes(path, needles, label) {
  const source = readFile(path)
  addCheck(label, Boolean(source) && needles.every((needle) => source.includes(needle)))
}

function readFile(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

function addCheck(label, ok) {
  checks.push({ label, ok })
}

function hasProductionEnvLine(output, envName) {
  return output
    .split(/\r?\n/)
    .some((line) => line.trim().startsWith(`${envName} `) && line.includes('Production'))
}

function runVercelEnvList() {
  const vercelCommand = getVercelCommand()
  const result = spawnSync(vercelCommand.command, [
    ...vercelCommand.prefixArgs,
    'vercel',
    'env',
    'ls',
    '--scope',
    'tennis-data',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  if (result.error) {
    stop(`Vercel env metadata query failed: ${result.error.message}`)
  }

  if (result.status !== 0) {
    stop(`Vercel env metadata query exited with status ${result.status}.`)
  }

  return `${result.stdout}\n${result.stderr}`
}

function getVercelCommand() {
  if (process.platform !== 'win32') {
    return { command: 'npx', prefixArgs: [] }
  }

  const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
  const npxShim = join(programFiles, 'nodejs', 'npx.ps1')

  if (!existsSync(npxShim)) {
    stop(`Could not find the Windows npx PowerShell shim at ${npxShim}.`)
  }

  return {
    command: 'powershell.exe',
    prefixArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', npxShim],
  }
}

function stop(message) {
  console.error(message)
  process.exit(1)
}
