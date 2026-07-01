import { spawnSync } from 'node:child_process'

const args = new Set(process.argv.slice(2))
const includeLive = args.has('--live')
const includeStripeMode = !args.has('--skip-stripe-mode')

const ownerBoard = runJsonCommand({
  label: includeLive
    ? 'npm run qa:launch-owner-board -- --live --stripe-mode'
    : 'npm run qa:launch-owner-board',
  commandArgs: [
    'scripts/launch-owner-board.mjs',
    ...(includeLive ? ['--live'] : []),
    ...(includeStripeMode ? ['--stripe-mode'] : []),
  ],
})

const observability = runJsonCommand({
  label: includeLive
    ? 'npm run qa:observability -- --live'
    : 'npm run qa:observability',
  commandArgs: [
    'scripts/vercel-observability-smoke.mjs',
    ...(includeLive ? ['--live'] : []),
  ],
})

const postLaunch = runJsonCommand({
  label: 'npm run qa:post-launch',
  commandArgs: ['scripts/post-launch-monitor-card.mjs'],
})

const currentCommit = getCurrentCommit()
const blockingOk = ownerBoard.ok && observability.ok && postLaunch.ok
const ownerNext = [
  ...(ownerBoard.json?.next || []),
  ...(postLaunch.json?.ownerActions || []).map((action) => `${action.item}: ${action.ownerAction}`),
]
const uniqueOwnerNext = collapseOwnerActions(ownerNext)

console.log(JSON.stringify({
  ok: blockingOk,
  mode: {
    live: includeLive,
    stripeMode: includeStripeMode,
  },
  release: {
    commit: currentCommit,
    productionDeployment: observability.json?.liveDeployment || null,
  },
  decision: blockingOk
    ? 'GO for public launch announcement. Keep paid upgrades in test mode until Stripe live cutover is intentionally completed.'
    : 'NO-GO until blocking launch checks pass.',
  gates: {
    ownerBoard: summarizeCommand(ownerBoard),
    observability: summarizeCommand(observability),
    postLaunch: summarizeCommand(postLaunch),
  },
  ownerActions: uniqueOwnerNext,
  launchCommandOrder: [
    'npm run qa:go-no-go -- --live',
    'npm run qa:post-launch -- --live',
    'npm run qa:prod-logs -- --since=30m',
    'Stripe live cutover stays deferred until real paid upgrades should open.',
    'Review Vercel Web Analytics and Speed Insights after sharing links.',
  ],
  next: blockingOk
    ? 'Use this packet as the final pre-announcement checkpoint, then follow the post-launch cadence after links are shared.'
    : 'Resolve the failed gate above, rerun npm run qa:go-no-go -- --live, then continue.',
}, null, 2))

if (!blockingOk) process.exit(1)

function runJsonCommand({ label, commandArgs }) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 30,
  })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim()
  const json = parseFirstJsonObject(output)

  return {
    label,
    ok: result.status === 0 && json?.ok === true,
    status: result.status,
    json,
    error: result.error?.message,
    fallback: json ? undefined : lastUsefulLine(output),
  }
}

function summarizeCommand(result) {
  return {
    ok: result.ok,
    command: result.label,
    status: result.status,
    summary: result.json?.summary || null,
    next: result.ok
      ? undefined
      : result.json?.next || result.error || result.fallback || `Command exited with status ${result.status}.`,
  }
}

function collapseOwnerActions(actions) {
  const collapsed = new Map()

  for (const action of actions) {
    const normalized = action.toLowerCase()
    const key = normalized.includes('vercel')
      ? 'vercel-production-branch'
      : normalized.includes('stripe')
        ? 'stripe-live-cutover'
        : normalized

    if (!collapsed.has(key)) {
      collapsed.set(key, action)
    }
  }

  return [...collapsed.values()]
}

function getCurrentCommit() {
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
  })

  return (result.stdout || '').trim() || 'unknown'
}

function parseFirstJsonObject(output) {
  const start = output.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < output.length; index += 1) {
    const char = output[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = inString
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') depth += 1
    if (char === '}') depth -= 1

    if (depth === 0) {
      try {
        return JSON.parse(output.slice(start, index + 1))
      } catch {
        return null
      }
    }
  }

  return null
}

function lastUsefulLine(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('>'))
    .at(-1)
}
