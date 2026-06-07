import { expect, test, type Page } from '@playwright/test'

async function expectDarkShell(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
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

async function expectLoginNextPreservesHandoff(page: Page, path: string) {
  await page.context().clearCookies()
  await page.addInitScript(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
  await expectSurfaceLoads(page, path)
  await page.waitForURL(/\/login\?next=/, { timeout: 15_000 })

  const currentUrl = new URL(page.url())
  expect(currentUrl.pathname).toBe('/login')
  expect(currentUrl.searchParams.get('next')).toBe(path)
}

test.describe('TIQ league surfaces', () => {
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
    await expectLoginNextPreservesHandoff(
      page,
      '/league-coordinator/individual-results?leagueId=test-league&scheduleItemId=test-schedule&suggest_player_a=name%3APlayer%20A&suggest_player_b=name%3APlayer%20B&resultDate=2026-01-15#player-result-entry',
    )

    await expectLoginNextPreservesHandoff(
      page,
      '/league-coordinator/results?leagueId=test-league&scheduleItemId=test-schedule&teamA=Team%20A&teamB=Team%20B&matchDate=2026-01-15&facility=Court%201#team-match-entry',
    )
  })

  test('My Lab keeps the premium routine and Data Assist refresh path visible', async ({ page }) => {
    await expectSurfaceLoads(page, '/mylab')
    await expectDarkShell(page)
    await expect(page.getByText('My Lab is the home base. Data Assist, Matchup, and Messages stay one move away.')).toBeVisible()
    await expect(page.getByText('Find yourself, choose a goal, open one useful card.')).toBeVisible()
    await expect(page.getByText('Choose your tennis goal')).toBeVisible()
    await expect(page.getByText('Open your first read', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Upload data' })).toBeVisible()
  })

  test('Pricing separates free account access from paid plan activation', async ({ page }) => {
    await expectSurfaceLoads(page, '/pricing')
    await expectDarkShell(page)
    await expect(page.getByRole('heading', { name: 'Choose your role.' })).toBeVisible()
    await expect(page.getByText('Start from what you are trying to do.')).toBeVisible()
    await expect(page.getByText('Creating an account opens Free access for public tennis intelligence and data contributions.')).toBeVisible()
    await expect(page.getByText('Paid workspaces open only after the matching plan is active.')).toBeVisible()
    await expect(page.getByText('Data Assist uploads refresh the platform and move through review before they shape TenAceIQ.')).toBeVisible()
  })

  test('Explore start and rankings actions stay readable on mobile dark shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expectSurfaceLoads(page, '/explore')
    await expectDarkShell(page)
    await expect(page.getByText('Choose a path.')).toBeVisible()
    await expect(page.locator('section[aria-label="Find mode paths"]').getByText('Find a player', { exact: true })).toBeVisible()

    await expectSurfaceLoads(page, '/explore/rankings')
    await expectDarkShell(page)
    await expect(page.getByText('Full rankings')).toBeVisible()
    await expect(page.getByText('Use rankings to decide what to check next.')).toBeVisible()
  })

  test('Login stays readable without mobile content overlap', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expectSurfaceLoads(page, '/login')
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
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
  })

  test('Homepage command center stays readable without mobile overlap', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expectSurfaceLoads(page, '/')
    await expect(page.getByRole('heading', { name: 'More Tennis. Less Chaos.' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Choose a TenAceIQ workspace' })).toBeVisible()
    await expect(page.getByPlaceholder('Search players, teams, leagues, ratings...')).toBeVisible()

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const viewportWidth = document.documentElement.clientWidth
            const portal = document.querySelector('section[aria-label="TenAceIQ command center"]')?.getBoundingClientRect()
            const portalNav = document.querySelector('nav[aria-label="Choose a TenAceIQ workspace"]')?.getBoundingClientRect()
            const homepageHero = document.querySelector('#main-content h1')?.getBoundingClientRect()
            const laneCards = Array.from(document.querySelectorAll('nav[aria-label="Choose a TenAceIQ workspace"] a')).map((element) =>
              element.getBoundingClientRect(),
            )

            return Boolean(
              portal &&
                portalNav &&
                homepageHero &&
                document.documentElement.scrollWidth <= viewportWidth + 1 &&
                portalNav.left >= -1 &&
                portalNav.right <= viewportWidth + 1 &&
                portalNav.height <= 260 &&
                homepageHero.top >= portal.bottom - 1 &&
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
    await expect(page.getByText('Data refresh path')).toBeVisible()
    await expect(page.locator('details#league-public-pages summary').getByText('Public page readiness')).toBeVisible()
    await expect(page.getByText('Add a league')).toBeVisible()
  })

  test('Matchup clears stale player query params into a Data Assist-aware notice', async ({ page }) => {
    await expectSurfaceLoads(page, '/matchup?type=singles&playerA=deleted-player-a&playerB=deleted-player-b')
    await expectDarkShell(page)

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const params = new URLSearchParams(window.location.search)
            return !params.has('playerA') && !params.has('playerB')
          }),
        { message: 'stale matchup player params should be removed from the URL' },
      )
      .toBe(true)
    await expect(page.getByText(/Matchup cleared those slots/i)).toBeVisible()
    await expect(page.getByText(/Data Assist after review/i)).toBeVisible()
  })
})
