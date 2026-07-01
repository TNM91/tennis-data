import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = new Set(process.argv.slice(2))
const includeLive = args.has('--live')

const analyticsDashboard = 'https://vercel.com/tennis-data/tennis-data/analytics'
const speedInsightsDashboard = 'https://vercel.com/tennis-data/tennis-data/speed-insights'

const checks = [
  checkPackageDependencies(),
  checkRootLayoutMounts(),
  checkLaunchRunbooks(),
]

const liveDeployment = includeLive ? checkLatestProductionDeployment() : null
if (liveDeployment) {
  checks.push({
    name: 'Latest production deployment',
    ok: liveDeployment.ok,
    next: liveDeployment.ok ? undefined : liveDeployment.next,
  })
}

const ok = checks.every((check) => check.ok)

console.log(JSON.stringify({
  ok,
  mode: {
    live: includeLive,
  },
  checks,
  dashboards: [
    {
      name: 'Vercel Web Analytics',
      url: analyticsDashboard,
      watchFor: 'Expected public traffic after sharing launch links.',
    },
    {
      name: 'Vercel Speed Insights',
      url: speedInsightsDashboard,
      watchFor: 'No material Core Web Vitals regression after production deploys.',
    },
  ],
  liveDeployment: liveDeployment?.summary || null,
  next: ok
    ? 'Use the dashboards above after deploys and launch announcements; keep npm run qa:prod-logs as the first error signal.'
    : 'Fix the failed observability smoke checks before relying on launch-week monitoring.',
}, null, 2))

if (!ok) process.exit(1)

function checkPackageDependencies() {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
  const dependencies = packageJson.dependencies || {}
  const missing = [
    '@vercel/analytics',
    '@vercel/speed-insights',
  ].filter((dependency) => !dependencies[dependency])

  return {
    name: 'Vercel observability packages',
    ok: missing.length === 0,
    next: missing.length
      ? `Install missing dependencies: ${missing.join(', ')}.`
      : undefined,
  }
}

function checkRootLayoutMounts() {
  const layoutSource = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8')
  const requiredSnippets = [
    "import { Analytics } from '@vercel/analytics/next'",
    "import { SpeedInsights } from '@vercel/speed-insights/next'",
    '<Analytics />',
    '<SpeedInsights />',
  ]
  const missing = requiredSnippets.filter((snippet) => !layoutSource.includes(snippet))

  return {
    name: 'Root app shell mounts Web Analytics and Speed Insights',
    ok: missing.length === 0,
    next: missing.length
      ? `Restore missing app/layout.tsx wiring: ${missing.join(', ')}.`
      : undefined,
  }
}

function checkLaunchRunbooks() {
  const sources = [
    readFileSync(join(process.cwd(), 'docs/deploy-checklist.md'), 'utf8'),
    readFileSync(join(process.cwd(), 'docs/platform-closeout-verification-log.md'), 'utf8'),
    readFileSync(join(process.cwd(), 'scripts/post-launch-monitor-card.mjs'), 'utf8'),
  ].join('\n')

  const requiredSnippets = [
    'npm run qa:observability',
    analyticsDashboard,
    speedInsightsDashboard,
  ]
  const missing = requiredSnippets.filter((snippet) => !sources.includes(snippet))

  return {
    name: 'Launch runbooks include observability checks',
    ok: missing.length === 0,
    next: missing.length
      ? `Restore missing runbook references: ${missing.join(', ')}.`
      : undefined,
  }
}

function checkLatestProductionDeployment() {
  const vercelCommand = getVercelCommand()
  const result = spawnSync(vercelCommand.command, [
    ...vercelCommand.prefixArgs,
    'vercel',
    'api',
    '/v6/deployments?projectId=prj_v5O8xWepQDShD0EzC6R6ooS0IlW0&limit=3',
    '--scope',
    'tennis-data',
    '--raw',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 10,
  })

  if (result.error) {
    return {
      ok: false,
      next: `Vercel deployment query failed: ${result.error.message}`,
      summary: null,
    }
  }

  if (result.status !== 0) {
    return {
      ok: false,
      next: `Vercel deployment query exited with status ${result.status}.`,
      summary: null,
    }
  }

  const payload = parseFirstJsonObject(`${result.stdout || ''}\n${result.stderr || ''}`)
  const production = payload?.deployments?.find((deployment) => deployment.target === 'production')
  const currentSha = getCurrentSha()
  const isReady = production?.readyState === 'READY'
  const isPromoted = production?.readySubstate === 'PROMOTED'
  const matchesCurrentSha = production?.meta?.githubCommitSha === currentSha

  return {
    ok: Boolean(production && isReady && isPromoted && matchesCurrentSha),
    next: production
      ? 'Wait for the latest production deployment to be READY/PROMOTED for the current commit before checking analytics and performance dashboards.'
      : 'No production deployment was found in the latest Vercel deployment results.',
    summary: production
      ? {
          url: `https://${production.url}`,
          readyState: production.readyState,
          readySubstate: production.readySubstate,
          commit: production.meta?.githubCommitSha?.slice(0, 8) || null,
          currentCommit: currentSha.slice(0, 8),
        }
      : null,
  }
}

function getCurrentSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
  })

  return result.stdout.trim()
}

function getVercelCommand() {
  if (process.platform !== 'win32') {
    return { command: 'npx', prefixArgs: [] }
  }

  const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
  const npxShim = join(programFiles, 'nodejs', 'npx.ps1')

  if (!existsSync(npxShim)) {
    return { command: 'npx', prefixArgs: [] }
  }

  return {
    command: 'powershell.exe',
    prefixArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', npxShim],
  }
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
