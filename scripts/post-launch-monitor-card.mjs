import { spawnSync } from 'node:child_process'

const args = new Set(process.argv.slice(2))
const includeLive = args.has('--live')

const postLaunchCadence = [
  {
    window: 'Immediately after production deploy',
    goal: 'Confirm the deploy is clean before sharing broadly.',
    commands: [
      'npm run qa:launch-owner-board -- --live --stripe-mode',
      'npm run qa:observability -- --live',
      'npm run qa:prod-logs -- --since=30m',
    ],
  },
  {
    window: 'First hour after launch announcement',
    goal: 'Watch for runtime errors, broken public metadata, traffic, performance, and owner-gated items.',
    commands: [
      'npm run qa:prod-logs -- --since=1h --limit=100',
      'npm run qa:seo-share -- --live',
      'npm run qa:adsense-live',
    ],
    dashboards: [
      'https://vercel.com/tennis-data/tennis-data/analytics',
      'https://vercel.com/tennis-data/tennis-data/speed-insights',
    ],
  },
  {
    window: 'Daily during launch week',
    goal: 'Keep launch confidence tied to production evidence, not memory.',
    commands: [
      'npm run qa:launch-owner-board -- --live --stripe-mode',
      'npm run verify:closeout:live',
      'npm run qa:results',
    ],
    dashboards: [
      'https://vercel.com/tennis-data/tennis-data/analytics',
      'https://vercel.com/tennis-data/tennis-data/speed-insights',
    ],
  },
]

const ownerActions = [
  {
    item: 'Vercel production branch',
    command: 'npm run qa:vercel-branch',
    ownerAction:
      'Open https://vercel.com/tennis-data/tennis-data/settings/git#connected-git-repository and change the Production Branch from main to master.',
  },
  {
    item: 'Stripe live paid upgrades',
    command: 'npm run qa:stripe-live-cutover',
    ownerAction:
      'Keep Stripe in test mode until paid upgrades should open; set live values privately, redeploy, then run npm run qa:stripe-live-mode.',
  },
]

const liveBoard = includeLive ? runLiveOwnerBoard() : null
const ok = !liveBoard || liveBoard.ok

console.log(JSON.stringify({
  ok,
  mode: {
    live: includeLive,
  },
  postLaunchCadence,
  ownerActions,
  liveBoard,
  next: ok
    ? 'Use the cadence above after production deploys and launch announcements.'
    : 'Resolve blocking live owner-board failures before broad launch announcements.',
}, null, 2))

if (!ok) process.exit(1)

function runLiveOwnerBoard() {
  const result = spawnSync(process.execPath, [
    'scripts/launch-owner-board.mjs',
    '--live',
    '--stripe-mode',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 20,
  })

  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim()
  const jsonText = extractFirstJsonObject(output)
  let board = null

  if (jsonText) {
    try {
      board = JSON.parse(jsonText)
    } catch {
      board = null
    }
  }

  return {
    ok: result.status === 0 && board?.ok === true,
    command: 'npm run qa:launch-owner-board -- --live --stripe-mode',
    status: result.status,
    summary: board?.summary || null,
    next: board?.next || [lastUsefulLine(output) || 'Live owner board did not return a parseable result.'],
  }
}

function extractFirstJsonObject(output) {
  const start = output.indexOf('{')
  if (start === -1) return ''

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
      return output.slice(start, index + 1)
    }
  }

  return ''
}

function lastUsefulLine(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('>'))
    .at(-1)
}
