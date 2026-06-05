import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const live = args.includes('--live')
const browserBaseArg = args.find((arg) => arg.startsWith('--browser-base='))
const browserBase = browserBaseArg?.slice('--browser-base='.length).trim()

if (live && !process.env.PLATFORM_QA_BASE_URL) {
  process.env.PLATFORM_QA_BASE_URL = 'https://www.tenaceiq.com'
}
if (live && !process.env.LEVEL_UP_BASE_URL) {
  process.env.LEVEL_UP_BASE_URL = 'https://www.tenaceiq.com'
}
if (live && !process.env.PORTAL_CHECK_BASE_URL) {
  process.env.PORTAL_CHECK_BASE_URL = 'https://www.tenaceiq.com'
}

if (browserBase) {
  process.env.PLATFORM_QA_BASE_URL = browserBase
  process.env.LEVEL_UP_BASE_URL = browserBase
  process.env.PORTAL_CHECK_BASE_URL = browserBase
}

const checks = [
  {
    label: 'Tier copy consistency',
    command: process.execPath,
    args: ['scripts/verify-tier-copy.mjs'],
  },
  {
    label: 'Coach-player Level Up contract',
    command: process.execPath,
    args: ['scripts/verify-coach-player-loop.mjs'],
  },
  {
    label: 'Level Up content quality',
    command: process.execPath,
    args: ['scripts/verify-level-up-content.mjs'],
  },
  {
    label: 'Platform closeout inventory',
    command: process.execPath,
    args: ['scripts/verify-platform-closeout-inventory.mjs'],
  },
]

if (process.env.PLATFORM_QA_BASE_URL) {
  checks.push({
    label: 'Platform route smoke',
    command: process.execPath,
    args: ['scripts/verify-platform-routes.mjs'],
  })
}

if (process.env.LEVEL_UP_BASE_URL) {
  checks.push({
    label: 'Level Up player loop smoke',
    command: process.execPath,
    args: ['scripts/verify-level-up-player-loop.mjs'],
  })
}

if (process.env.PORTAL_CHECK_BASE_URL) {
  checks.push({
    label: 'Portal overflow smoke',
    command: process.execPath,
    args: ['scripts/portal-overflow-check.mjs'],
  })
}

const skipped = [
  process.env.PLATFORM_QA_BASE_URL ? null : 'Platform route smoke (set PLATFORM_QA_BASE_URL or use --live/--browser-base)',
  process.env.LEVEL_UP_BASE_URL ? null : 'Level Up player loop smoke (set LEVEL_UP_BASE_URL or use --live/--browser-base)',
  process.env.PORTAL_CHECK_BASE_URL ? null : 'Portal overflow smoke (set PORTAL_CHECK_BASE_URL or use --live/--browser-base)',
].filter(Boolean)
const hasBrowserChecks = Boolean(process.env.PLATFORM_QA_BASE_URL || process.env.LEVEL_UP_BASE_URL || process.env.PORTAL_CHECK_BASE_URL)

console.log('Platform closeout mode:', hasBrowserChecks ? 'browser + deterministic' : 'deterministic only')
if (skipped.length) {
  console.log('Skipped optional browser checks:')
  for (const item of skipped) console.log(`- ${item}`)
}

for (const check of checks) {
  console.log(`\n== ${check.label} ==`)
  await run(check.command, check.args)
}

console.log('\nPlatform closeout checks passed.')

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`))
    })
  })
}
