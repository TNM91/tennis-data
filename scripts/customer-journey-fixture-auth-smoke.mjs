import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const env = loadEnvFile('.env.local')
const baseUrl = getEnv('TENACEIQ_QA_BASE_URL') || getEnv('PLATFORM_QA_BASE_URL') || 'http://localhost:3000'
const rawArgs = process.argv.slice(2)
const fixtureChecks = {
  coach_primary: {
    fixture: 'coach_primary',
    plan: 'coach',
    route: '/coach',
    credentials: [
      ['TENACEIQ_QA_COACH_EMAIL', getEnv('TENACEIQ_QA_COACH_EMAIL')],
      ['TENACEIQ_QA_COACH_PASSWORD', getEnv('TENACEIQ_QA_COACH_PASSWORD')],
    ],
    hasExpectedSignal(text) {
      return text.includes('Coach') && (/student/i.test(text) || /assignment/i.test(text) || /review/i.test(text))
    },
    missingSignalReason: 'missing-coach-hub-signal',
    verifiedSignal: 'Coach Hub signal visible',
  },
  player_plus_linked: {
    fixture: 'player_plus_linked',
    plan: 'player_plus',
    route: '/mylab',
    credentials: [
      ['TENACEIQ_QA_PLAYER_EMAIL', getEnv('TENACEIQ_QA_PLAYER_EMAIL')],
      ['TENACEIQ_QA_PLAYER_PASSWORD', getEnv('TENACEIQ_QA_PLAYER_PASSWORD')],
    ],
    hasExpectedSignal(text) {
      return /My Lab/i.test(text) && /(Player|Level Up|linked|profile|Unlock My Lab|next action|tennis)/i.test(text)
    },
    missingSignalReason: 'missing-my-lab-signal',
    verifiedSignal: 'My Lab linked-player signal visible',
  },
}
const fixtureGroups = {
  all: Object.keys(fixtureChecks),
  day1: ['coach_primary', 'player_plus_linked'],
}

if (rawArgs.includes('--help') || rawArgs.includes('help') || rawArgs.includes('--env')) {
  printEnvContract()
  process.exit(0)
}

const selection = selectFixtures(rawArgs)
const selectedChecks = selection.fixtures.map((fixture) => fixtureChecks[fixture])
const missing = selectedChecks
  .flatMap((check) => check.credentials)
  .filter(([, value]) => !value)
  .map(([key]) => key)
  .filter((key, index, keys) => keys.indexOf(key) === index)

console.log('TenAceIQ Fixture Auth Smoke')
console.log('')
console.log(`Base URL: ${baseUrl}`)
console.log(`Selection: ${selection.label}`)
console.log(`Fixtures: ${selectedChecks.map((check) => check.fixture).join(', ')}`)
console.log(`Routes: ${selectedChecks.map((check) => check.route).join(', ')}`)
console.log('')

if (selection.unknown.length) {
  console.log('Auth smoke blocked: unknown fixture selection.')
  console.log(`Unknown: ${selection.unknown.join(', ')}`)
  console.log(`Valid: ${Object.keys(fixtureChecks).join(', ')}, day1, all`)
  process.exit(1)
}

if (missing.length) {
  console.log('Auth smoke blocked: missing credential env.')
  console.log(`Missing: ${missing.join(', ')}`)
  console.log('')
  console.log(`Base URL currently resolves to: ${baseUrl}`)
  console.log('Set TENACEIQ_QA_BASE_URL=https://www.tenaceiq.com for production QA, or leave it local only when a local dev server is running.')
  console.log('')
  console.log('Set these in the shell or .env.local, then rerun one of:')
  console.log('- npm run qa:fixture-auth-smoke')
  console.log('- npm run qa:fixture-auth-smoke -- coach_primary')
  console.log('- npm run qa:fixture-auth-smoke -- player_plus_linked')
  console.log('- npm run qa:fixture-auth-smoke -- --env')
  console.log('')
  console.log('Credential values are intentionally never printed by this command.')
  process.exit(1)
}

const browser = await chromium.launch({ headless: true })
const results = []

try {
  let failedResult = null

  for (const check of selectedChecks) {
    const result = await verifyFixture(browser, check)
    results.push(result)

    if (!result.ok) {
      failedResult = result
      break
    }

    console.log(`Verified ${check.fixture} -> ${check.route}`)
  }

  if (failedResult) {
    console.error(JSON.stringify(failedResult, null, 2))
    process.exitCode = 1
  } else {
    console.log(JSON.stringify({
      ok: true,
      selection: selection.label,
      verified: results.map((result) => ({
        fixture: result.fixture,
        route: result.route,
        currentPath: result.currentPath,
        verified: result.verified,
        consoleErrors: result.consoleErrors,
      })),
    }, null, 2))
  }
} finally {
  await browser.close()
}

async function verifyFixture(browser, check) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const consoleErrors = []
  const credentials = Object.fromEntries(check.credentials)

  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (text.includes('/_next/webpack-hmr')) return
    consoleErrors.push(text.slice(0, 180))
  })

  try {
    const loginUrl = `${baseUrl}/login?plan=${check.plan}&next=${encodeURIComponent(check.route)}&fixtureauth=${Date.now()}`
    await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 35_000 })
    await page.getByLabel('Email').fill(credentials[check.credentials[0][0]])
    await page.getByLabel('Password').fill(credentials[check.credentials[1][0]])
    await page.getByRole('button', { name: /^Sign in$/i }).click()
    await page.waitForLoadState('networkidle', { timeout: 35_000 })
    await page.waitForTimeout(800)

    const currentUrl = new URL(page.url())
    const text = (await page.locator('body').innerText({ timeout: 10_000 })).replace(/\s+/g, ' ').trim()
    const stillOnLogin = currentUrl.pathname === '/login'
    const hasExpectedSignal = check.hasExpectedSignal(text)
    const hasAuthError = /unable to sign in|invalid login|invalid credentials|email not confirmed|sign in timed out/i.test(text)

    if (stillOnLogin || hasAuthError || !hasExpectedSignal) {
      return {
        ok: false,
        fixture: check.fixture,
        route: check.route,
        currentPath: currentUrl.pathname,
        reason: stillOnLogin ? 'still-on-login' : hasAuthError ? 'auth-error-visible' : check.missingSignalReason,
        saw: text.slice(0, 500),
        consoleErrors,
      }
    }

    return {
      ok: true,
      fixture: check.fixture,
      route: check.route,
      currentPath: currentUrl.pathname,
      verified: [
        `${check.fixture} credentials loaded without printing secrets`,
        'login submitted',
        'browser left /login',
        check.verifiedSignal,
      ],
      consoleErrors,
    }
  } finally {
    await context.close()
  }
}

function selectFixtures(rawArgs) {
  const requested = rawArgs.filter((arg) => arg && !arg.startsWith('--'))
  const labels = requested.length ? requested : ['day1']
  const unknown = labels.filter((label) => !fixtureChecks[label] && !fixtureGroups[label])
  const fixtures = labels.flatMap((label) => fixtureGroups[label] || (fixtureChecks[label] ? [label] : []))

  return {
    label: labels.join(', '),
    unknown,
    fixtures: fixtures.filter((fixture, index) => fixtures.indexOf(fixture) === index),
  }
}

function printEnvContract() {
  console.log('TenAceIQ Fixture Auth Smoke Env Contract')
  console.log('')
  console.log('Store real values in .env.local or the shell only. Do not commit credentials.')
  console.log('')
  console.log('Required for the default Day 1 smoke:')
  console.log('TENACEIQ_QA_BASE_URL=https://www.tenaceiq.com')
  console.log('TENACEIQ_QA_COACH_EMAIL=')
  console.log('TENACEIQ_QA_COACH_PASSWORD=')
  console.log('TENACEIQ_QA_PLAYER_EMAIL=')
  console.log('TENACEIQ_QA_PLAYER_PASSWORD=')
  console.log('')
  console.log('For local QA, use TENACEIQ_QA_BASE_URL=http://localhost:3000 and start the dev server first.')
  console.log('')
  console.log('Selectors:')
  console.log('- npm run qa:fixture-auth-smoke')
  console.log('- npm run qa:fixture-auth-smoke -- coach_primary')
  console.log('- npm run qa:fixture-auth-smoke -- player_plus_linked')
}

function getEnv(key) {
  return process.env[key] || env[key] || ''
}

function loadEnvFile(fileName) {
  const filePath = join(process.cwd(), fileName)
  if (!existsSync(filePath)) return {}

  return Object.fromEntries(
    readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        const key = line.slice(0, index).trim()
        const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
        return [key, value]
      }),
  )
}
