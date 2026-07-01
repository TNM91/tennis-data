import { spawnSync } from 'node:child_process'

const args = new Set(process.argv.slice(2))
const includeLive = args.has('--live')
const includeStripeMode = args.has('--stripe-mode')

const checks = [
  runCheck({
    name: 'Customer journey launch evidence',
    command: process.execPath,
    commandArgs: ['scripts/customer-journey-launch-readiness.mjs'],
    label: 'npm run qa:launch',
    type: 'blocking',
  }),
  runCheck({
    name: 'Workspace artifact audit',
    command: process.execPath,
    commandArgs: ['scripts/audit-artifacts.mjs'],
    label: 'npm run audit:artifacts',
    type: 'blocking',
  }),
  runCheck({
    name: 'Stripe live readiness guard',
    command: process.execPath,
    commandArgs: ['scripts/stripe-live-readiness.mjs'],
    label: 'npm run qa:stripe-live-readiness',
    type: 'blocking',
  }),
  runCheck({
    name: 'Vercel observability wiring',
    command: process.execPath,
    commandArgs: ['scripts/vercel-observability-smoke.mjs'],
    label: 'npm run qa:observability',
    type: 'blocking',
  }),
]

if (includeLive) {
  checks.push(
    runCheck({
      name: 'Production runtime logs',
      command: process.execPath,
      commandArgs: ['scripts/vercel-production-log-smoke.mjs'],
      label: 'npm run qa:prod-logs',
      type: 'blocking',
    }),
    runCheck({
      name: 'AdSense live readiness',
      command: process.execPath,
      commandArgs: ['scripts/adsense-live-readiness-smoke.mjs'],
      label: 'npm run qa:adsense-live',
      type: 'blocking',
    }),
    runCheck({
      name: 'SEO and share readiness',
      command: process.execPath,
      commandArgs: ['scripts/seo-share-readiness-smoke.mjs', '--live'],
      label: 'npm run qa:seo-share -- --live',
      type: 'blocking',
    }),
    runCheck({
      name: 'Vercel production branch alignment',
      command: process.execPath,
      commandArgs: ['scripts/vercel-production-branch-smoke.mjs'],
      label: 'npm run qa:vercel-branch',
      type: 'owner-action',
      expectedFailureMeans: 'Vercel dashboard still points production at main instead of master. Open https://vercel.com/tennis-data/tennis-data/settings/git#connected-git-repository and change the Production Branch to master.',
    }),
  )
}

if (includeStripeMode) {
  checks.push(
    runCheck({
      name: 'Stripe checkout mode smoke',
      command: process.execPath,
      commandArgs: ['scripts/stripe-checkout-mode-smoke.mjs', '--expect=test', '--plan=coach'],
      label: 'node scripts/stripe-checkout-mode-smoke.mjs --expect=test --plan=coach',
      type: 'owner-action',
      passMeans: 'Stripe is still intentionally in test mode until live paid upgrades are approved.',
      expectedFailureMeans: 'Stripe mode smoke could not confirm the current payment mode.',
    }),
  )
}

const blockingFailures = checks.filter((check) => check.type === 'blocking' && !check.ok)
const ownerActions = checks.filter((check) => check.type === 'owner-action' && !check.ok)
const passedOwnerChecks = checks.filter((check) => check.type === 'owner-action' && check.ok)
const ok = blockingFailures.length === 0

console.log(JSON.stringify({
  ok,
  mode: {
    live: includeLive,
    stripeMode: includeStripeMode,
  },
  summary: {
    blockingChecks: checks.filter((check) => check.type === 'blocking').length,
    blockingFailures: blockingFailures.length,
    ownerActions: ownerActions.length,
    passedOwnerChecks: passedOwnerChecks.length,
  },
  checks,
  launchRead: ok
    ? 'Product/code gates are clear. Owner actions may still be required before opening broad paid launch.'
    : 'Blocking launch gates need attention before launch handoff.',
  next: nextActions({ blockingFailures, ownerActions, passedOwnerChecks }),
}, null, 2))

if (!ok) {
  process.exit(1)
}

function runCheck({ name, command, commandArgs, label, type, passMeans = '', expectedFailureMeans = '' }) {
  const invocation = getInvocation(command, commandArgs, label)
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 10,
  })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim()

  return {
    name,
    type,
    ok: result.status === 0,
    command: label,
    passMeans: result.status === 0 ? passMeans || undefined : undefined,
    next: result.status === 0
      ? undefined
      : expectedFailureMeans || result.error?.message || lastUsefulLine(output) || `Command exited with status ${result.status}.`,
  }
}

function getInvocation(command, commandArgs, label) {
  return { command, args: commandArgs, label }
}

function nextActions({ blockingFailures, ownerActions, passedOwnerChecks }) {
  if (blockingFailures.length) {
    return blockingFailures.map((check) => `${check.name}: ${check.next}`)
  }

  const actions = ownerActions.map((check) => `${check.name}: ${check.next}`)

  if (passedOwnerChecks.some((check) => check.name === 'Stripe checkout mode smoke')) {
    actions.push('Stripe live cutover: run npm run qa:stripe-live-cutover, set live Stripe/Vercel values privately, redeploy, then run npm run qa:stripe-live-mode.')
  }

  if (!actions.length) {
    actions.push('No blocking product/code gates or owner actions were detected by this board.')
  }

  return actions
}

function lastUsefulLine(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== '{' && line !== '}' && line !== '],' && line !== '},')
    .filter((line) => !line.startsWith('>'))
    .at(-1)
}
