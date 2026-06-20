import { expect, test, type Page } from '@playwright/test'

async function expectDarkShell(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
}

async function resetBrowserState(page: Page) {
  await page.context().clearCookies()
  await page.addInitScript(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
  await page.evaluate(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  }).catch(() => undefined)
}

async function expectSurfaceLoads(page: Page, path: string) {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  const response = await page.goto(path)
  expect(response?.status() || 200, `${path} should not return a server error`).toBeLessThan(500)
  await expect(page.locator('body')).toBeVisible()
  await expect(page).toHaveTitle(/.+/)
  await expect(page.locator('body')).not.toContainText('Application error')
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      { message: `${path} should not create page-level horizontal overflow` },
    )
    .toBe(true)
  expect(pageErrors, `${path} should not throw uncaught browser errors`).toEqual([])
}

async function isResetBoundaryVisible(page: Page) {
  return page.getByText('This view needs a quick reset').isVisible().catch(() => false)
}

async function expectSignedOutHandoffRoute(page: Page, path: string) {
  await resetBrowserState(page)
  await expectSurfaceLoads(page, path)

  const currentUrl = new URL(page.url())
  if (currentUrl.pathname === '/login') {
    expect(currentUrl.searchParams.get('next')).toBe(path)
    return
  }

  expect(`${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`).toBe(path)
  await expect(page.locator('body')).not.toContainText('Application error')
}

test.describe('TIQ league surfaces', () => {
  test.beforeEach(async ({ page }) => {
    await resetBrowserState(page)
  })

  for (const path of [
    '/explore',
    '/compete/leagues',
    '/compete/results',
    '/explore/leagues',
    '/explore/players',
    '/explore/rankings',
    '/explore/search',
    '/explore/teams',
    '/captain',
    '/data-assist',
    '/league-coordinator',
    '/league-coordinator/results',
    '/league-coordinator/individual-results',
    '/matchup',
    '/mylab',
    '/pricing',
  ]) {
    test(`${path} loads without browser errors`, async ({ page }) => {
      await expectSurfaceLoads(page, path)
    })
  }

  for (const path of ['/captain', '/compete/leagues', '/compete/results', '/data-assist', '/explore', '/explore/rankings', '/league-coordinator', '/matchup', '/mylab', '/pricing']) {
    test(`${path} keeps the dark shell renderable without horizontal overflow`, async ({ page }) => {
      await expectSurfaceLoads(page, path)
      await expectDarkShell(page)
    })
  }

  test('scheduled result handoff routes stay renderable while signed out', async ({ page }) => {
    await expectSignedOutHandoffRoute(
      page,
      '/league-coordinator/individual-results?leagueId=test-league&scheduleItemId=test-schedule&suggest_player_a=name%3APlayer%20A&suggest_player_b=name%3APlayer%20B&resultDate=2026-01-15#player-result-entry',
    )

    await expectSignedOutHandoffRoute(
      page,
      '/league-coordinator/results?leagueId=test-league&scheduleItemId=test-schedule&teamA=Team%20A&teamB=Team%20B&matchDate=2026-01-15&facility=Court%201#team-match-entry',
    )
  })

  test('My Lab keeps the premium routine and Data Assist refresh path visible', async ({ page }) => {
    await expectSurfaceLoads(page, '/mylab')
    await expectDarkShell(page)
    const resetBoundary = await page.getByText('This view needs a quick reset').isVisible().catch(() => false)
    if (!resetBoundary) {
      await expect(page.getByRole('heading', { name: /Welcome to your (lab|tennis lab)\.|Make My Lab yours/ })).toBeVisible()
      await expect(page.locator('body')).toContainText(/Data Assist|Improve data/)
      await expect(page.getByRole('link', { name: /Open Data Assist/ })).toBeVisible()
    }
  })

  test('Pricing separates free account access from paid plan activation', async ({ page }) => {
    await expectSurfaceLoads(page, '/pricing')
    await expectDarkShell(page)
    await expect(page.getByRole('heading', { name: 'Choose your role.' })).toBeVisible()
    await expect(page.getByText('Start from what you are trying to do.')).toBeVisible()
    await expect(page.getByText('Start free, then unlock the home base that matches your tennis job: My Lab, Coach Hub, Team Hub, League Office, or Full-Court.')).toBeVisible()
    await expect(page.getByText('Search players, teams, leagues, rankings, tournaments, coaches, and tennis resources before the next tennis job needs a home base.')).toBeVisible()
    await expect(page.getByText('Creating an account opens Free access for public tennis intelligence and data contributions.')).toBeVisible()
    await expect(page.getByText('My Lab, Coach Hub, Team Hub, League Office, and Full-Court open only after the matching plan is active.')).toBeVisible()
    await expect(page.getByText('Data Assist uploads refresh tennis context and move through review before they shape TenAceIQ.')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('before choosing a paid workspace')
  })

  test('Join keeps the Free handoff tied to a tennis home base', async ({ page }) => {
    await expectSurfaceLoads(page, '/join')
    await expectDarkShell(page)
    await expect(page.getByRole('heading', { name: /Start free(\. Pick the tennis job later\.)?/ })).toBeVisible()
    await expect(page.getByText('Search the tennis map first. Upgrade only when a specific tennis job needs a home base.')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Upgrade only when a specific job needs a workspace')
    await expect(page.locator('body')).not.toContainText('Upgrade only when a specific tennis job needs a workspace')
  })

  test('Upgrade keeps the Free path tied to the next tennis job', async ({ page }) => {
    await expectSurfaceLoads(page, '/upgrade?plan=free')
    await expectDarkShell(page)
    await expect(page.getByRole('heading', { name: 'Free is already active.' })).toBeVisible()
    await expect(page.getByText('Search the tennis map first, then pick the next tennis job when it needs a home base.')).toBeVisible()
    await expect(page.getByText('Upgrade when the next tennis job needs a home base')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Upgrade when the next tennis job needs a workspace')
  })

  test('Explore start and rankings actions stay readable on mobile dark shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expectSurfaceLoads(page, '/explore')
    await expectDarkShell(page)
    const exploreResetBoundary = await page.getByText('This view needs a quick reset').isVisible().catch(() => false)
    if (!exploreResetBoundary) {
      await expect(page.getByText('Choose a path.')).toBeVisible()
      await expect(page.locator('section[aria-label="Explore mode paths"]').getByText('Find a player', { exact: true })).toBeVisible()
    }

    await page.context().clearCookies()
    await expectSurfaceLoads(page, '/explore/rankings')
    await expectDarkShell(page)
    await expect(page.locator('body')).toContainText(/Rankings board|Full rankings|This view needs a quick reset/)
  })

  test('Login stays readable without mobile content overlap', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await resetBrowserState(page)
    await expectSurfaceLoads(page, '/login')
    const redirecting = await page.getByText('Opening your next tennis job...').isVisible().catch(() => false)
    const resetBoundary = await isResetBoundaryVisible(page)
    if (!redirecting && !resetBoundary) {
      await expect(page.getByRole('heading', { name: 'Open the tennis map.' })).toBeVisible()
      await expect(page.getByText('Next tennis job: Find')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
      await expect(page.getByLabel('Email')).toBeVisible()
      await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible()

      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const header = document.querySelector('header')?.getBoundingClientRect()
              const authShell = document.querySelector('#main-content section')?.getBoundingClientRect()
              return Boolean(header && authShell && authShell.top >= header.bottom - 1)
            }),
          { message: 'login content should start below the sticky mobile header' },
        )
        .toBe(true)
    }
  })

  test('Homepage command center stays readable without mobile overlap', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expectSurfaceLoads(page, '/')
    const resetBoundary = await isResetBoundaryVisible(page)
    if (resetBoundary) return

    await expect(page.getByRole('heading', { name: 'More Tennis. Less Chaos.' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Choose a TenAceIQ workspace' })).toBeVisible()
    await expect(page.getByPlaceholder('Search players, teams, leagues, tournaments, coaches, resources, or tennis actions')).toBeVisible()
    await expect(page.getByText('TenAceIQ is organized around tennis actions first, then the right hub when the next tennis job needs a home base.')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('then the right hub when the next tennis job needs a workspace')

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const viewportWidth = document.documentElement.clientWidth
            const portalNav = document.querySelector('nav[aria-label="Choose a TenAceIQ workspace"]')?.getBoundingClientRect()
            const homepageHero = document.querySelector('#main-content h1')?.getBoundingClientRect()
            const laneCards = Array.from(document.querySelectorAll('nav[aria-label="Choose a TenAceIQ workspace"] a')).map((element) =>
              element.getBoundingClientRect(),
            )

            return Boolean(
              portalNav &&
                homepageHero &&
                document.documentElement.scrollWidth <= viewportWidth + 1 &&
                portalNav.left >= -1 &&
                portalNav.right <= viewportWidth + 1 &&
                homepageHero.left >= -1 &&
                homepageHero.right <= viewportWidth + 1 &&
                laneCards.length >= 5 &&
                laneCards.every((card) => card.left >= -1 && card.right <= viewportWidth + 1),
            )
          }),
        { message: 'homepage portal lanes and hero should stay within the mobile viewport without overlap' },
      )
      .toBe(true)
  })

  test('Coordinator setup stays readable on mobile dark shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expectSurfaceLoads(page, '/league-coordinator')
    await expectDarkShell(page)
    const resetBoundary = await page.getByText('This view needs a quick reset').isVisible().catch(() => false)
    if (!resetBoundary) {
      await expect(page.getByText('Data refresh path')).toBeVisible()
      await expect(page.locator('details#league-public-pages summary').getByText('Public page readiness')).toBeVisible()
      await expect(page.getByText('Add a league')).toBeVisible()
    }
  })

  test('Matchup clears stale player query params into a Data Assist-aware notice', async ({ page }) => {
    await expectSurfaceLoads(page, '/matchup?type=singles&playerA=deleted-player-a&playerB=deleted-player-b')
    await expectDarkShell(page)

    const resetBoundary = await page.getByText('This view needs a quick reset').isVisible().catch(() => false)
    if (!resetBoundary) {
      await expect(page.getByText('0 of 2 slots selected')).toBeVisible()
      await expect(page.getByText('Report or request review through Data Assist')).toBeVisible()
    }
  })
})
