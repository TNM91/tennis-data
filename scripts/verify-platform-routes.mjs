import { chromium } from 'playwright'

const baseUrl = process.env.PLATFORM_QA_BASE_URL ?? 'http://localhost:3074'

const ignoredConsoleFragments = [
  'ep1.adtrafficquality.google',
  'google/getconfig/sodar',
  '/_next/webpack-hmr',
  "Framing 'https://www.google.com/' violates",
  'Failed to load resource: net::ERR_FAILED',
]

const routeChecks = [
  {
    tier: 'Free',
    route: '/',
    expectedAny: ['Tennis decisions', 'More Tennis', 'Start free'],
  },
  {
    tier: 'Free',
    route: '/explore',
    expectedAny: ['Explore', 'players', 'teams', 'leagues'],
  },
  {
    tier: 'Free',
    route: '/pricing',
    expectedAny: ['Free', 'Player', 'Coach', 'Captain', 'Full-Court'],
  },
  {
    tier: 'Free',
    route: '/data-assist',
    expectedAny: ['Data Assist', 'Upload source', 'Verified', 'needs review'],
  },
  {
    tier: 'Free',
    route: '/leagues',
    expectedAny: ['Leagues', 'League Office', 'standings', 'schedule'],
  },
  {
    tier: 'Player',
    route: '/mylab',
    requiresAuth: true,
    expectedAny: ['My Lab', 'Player', 'Unlock My Lab'],
  },
  {
    tier: 'Player',
    route: '/matchup',
    requiresAuth: true,
    expectedAny: ['Matchup', 'Player', 'Compare'],
  },
  {
    tier: 'Player',
    route: '/player-development/relentless-competitor-4-0/level-up',
    expectedAny: ['Level Up', 'Next best rep', 'First rep'],
  },
  {
    tier: 'Coach',
    route: '/coach',
    requiresAuth: true,
    expectedAny: ['Coach', 'students', 'assignments', 'Unlock Coach'],
  },
  {
    tier: 'Coach',
    route: '/tactics',
    requiresAuth: true,
    expectedAny: ['Tactical', 'Coach', 'Captain'],
  },
  {
    tier: 'Coach',
    route: '/player-development/relentless-competitor-4-0/coach-planner',
    expectedAny: ['Coach Planner', 'Lesson', 'Relentless Competitor'],
  },
  {
    tier: 'Captain',
    route: '/captain',
    requiresAuth: true,
    expectedAny: ['Captain', 'lineup', 'team'],
  },
  {
    tier: 'Captain',
    route: '/captain/lineup-builder',
    requiresAuth: true,
    expectedAny: ['Lineup', 'Captain', 'team'],
  },
  {
    tier: 'League',
    route: '/league-coordinator',
    requiresAuth: true,
    expectedAny: ['League', 'Coordinator', 'season'],
  },
  {
    tier: 'League',
    route: '/league-coordinator/results',
    requiresAuth: true,
    expectedAny: ['Results', 'League', 'Team'],
  },
  {
    tier: 'Admin',
    route: '/admin',
    requiresAuth: true,
    expectedAny: ['Admin', 'Access', 'Import'],
  },
  {
    tier: 'Admin',
    route: '/admin/access',
    requiresAuth: true,
    expectedAny: ['Admin Access', 'entitlements', 'League Office', 'TENACEIQ ACCESS', 'Sign in'],
  },
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const findings = []
const authRedirects = []

page.on('console', (message) => {
  if (message.type() !== 'error') return
  const text = message.text()
  if (ignoredConsoleFragments.some((fragment) => text.includes(fragment))) return

  findings.push({
    route: page.url(),
    type: 'console',
    text: text.slice(0, 220),
  })
})

try {
  for (const check of routeChecks) {
    const url = `${baseUrl}${check.route}?platformqa=${Date.now()}`

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 35_000 })
      await page.waitForTimeout(400)

      const text = await page.locator('body').innerText({ timeout: 10_000 })
      const compactText = text.replace(/\s+/g, ' ').trim()
      const currentUrl = new URL(page.url())
      const redirectedToLogin = currentUrl.pathname === '/login' && currentUrl.searchParams.get('next') === check.route

      if (redirectedToLogin) {
        if (check.requiresAuth) {
          authRedirects.push({
            route: check.route,
            tier: check.tier,
            redirectedTo: `${currentUrl.pathname}?next=${currentUrl.searchParams.get('next')}`,
          })
          continue
        }

        findings.push({
          route: check.route,
          tier: check.tier,
          type: 'unexpected-auth-redirect',
          text: compactText.slice(0, 500),
        })
        continue
      }

      const matched = check.expectedAny.some((needle) => compactText.toLowerCase().includes(needle.toLowerCase()))

      if (!compactText || compactText === 'PREPARING TENACEIQ...' || compactText.length < 40) {
        findings.push({
          route: check.route,
          tier: check.tier,
          type: 'loading-shell',
          text: compactText,
        })
      } else if (!matched) {
        findings.push({
          route: check.route,
          tier: check.tier,
          type: 'missing-copy',
          expectedAny: check.expectedAny,
          text: compactText.slice(0, 500),
        })
      }
    } catch (error) {
      findings.push({
        route: check.route,
        tier: check.tier,
        type: 'navigation',
        text: error instanceof Error ? error.message : String(error),
      })
    }
  }
} finally {
  await browser.close()
}

if (findings.length) {
  console.error(JSON.stringify({ ok: false, baseUrl, findings }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  checked: routeChecks.length,
  authRedirects,
  tiers: [...new Set(routeChecks.map((check) => check.tier))],
}, null, 2))
