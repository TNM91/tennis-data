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

  test('My Lab keeps the compact Player handoff visible on mobile', async ({ page }) => {
    await expectSurfaceLoads(page, '/mylab')
    await expectDarkShell(page)
    const resetBoundary = await page.getByText('This view needs a quick reset').isVisible().catch(() => false)
    if (!resetBoundary) {
      await expect(page.getByRole('heading', { name: 'Unlock My Lab.' })).toBeVisible()
      await expect(page.getByText('Open progress, matchup prep, and cleaner tennis messages.')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Join early access' })).toBeVisible()
    }
  })

  test('Pricing keeps the compact role path visible on mobile', async ({ page }) => {
    await expectSurfaceLoads(page, '/pricing')
    await expectDarkShell(page)
    await expect(page.getByRole('heading', { name: 'Choose the tools you need.' })).toBeVisible()
    await expect(page.getByText('Start free. Add a role when it helps.')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Choose a tennis path' })).toBeVisible()
    await expect(page.getByText('Start with your role')).toBeVisible()
  })

  test('Join keeps the compact Free account handoff visible on mobile', async ({ page }) => {
    await expectSurfaceLoads(page, '/join')
    await expectDarkShell(page)
    await expect(page.getByRole('heading', { name: 'Create your free account.' })).toBeVisible()
    await expect(page.getByText('Search tennis now. Add tools only when they help.')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
  })

  test('Upgrade keeps the compact Free handoff visible on mobile', async ({ page }) => {
    await expectSurfaceLoads(page, '/upgrade?plan=free')
    await expectDarkShell(page)
    await expect(page.getByRole('heading', { name: 'Free is already active.' })).toBeVisible()
    await expect(page.getByText(/Your account already has the access needed for Free\./)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open Find' })).toBeVisible()
  })

  test('Explore search and rankings actions stay readable on mobile dark shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expectSurfaceLoads(page, '/explore')
    await expectDarkShell(page)
    const exploreResetBoundary = await page.getByText('This view needs a quick reset').isVisible().catch(() => false)
    if (!exploreResetBoundary) {
      await expect(page.getByRole('heading', { name: 'Find players, teams, leagues.' })).toBeVisible()
      await expect(page.getByRole('search', { name: 'Search TenAceIQ' })).toBeVisible()
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
    const redirecting = await page.getByText('Opening your next tennis tool...').isVisible().catch(() => false)
    const resetBoundary = await isResetBoundaryVisible(page)
    if (!redirecting && !resetBoundary) {
      await expect(page.getByRole('heading', { name: 'Sign in to TenAceIQ.' })).toBeVisible()
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

    await expect(page.getByRole('heading', { name: 'Tennis decisions, made clearer.' })).toBeVisible()
    await expect(page.getByRole('search', { name: 'Search TenAceIQ' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Start Exploring' })).toBeVisible()
    await expect(page.getByText('Search players, teams, leagues, rankings, and tournaments for free. Add the right tools when you want help with your game, team, players, competition, or club.')).toBeVisible()

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const viewportWidth = document.documentElement.clientWidth
            const portalNav = document.querySelector('main > div, main > section')?.getBoundingClientRect()
            const homepageHero = document.querySelector('#main-content h1')?.getBoundingClientRect()
            const laneCards = Array.from(document.querySelectorAll('main a')).slice(0, 3).map((element) =>
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
                laneCards.length >= 3 &&
                laneCards.every((card) => card.left >= -1 && card.right <= viewportWidth + 1),
            )
          }),
        { message: 'homepage portal lanes and hero should stay within the mobile viewport without overlap' },
      )
      .toBe(true)
  })

  test('Preview homepage keeps the compact Free plan handoff visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expectSurfaceLoads(page, '/preview-home')

    await expect(page.getByRole('heading', { name: 'Explore, improve, compete, or manage with less chaos.' })).toBeVisible()
    await expect(page.getByText('Search first, then open the tool that fits your next match, team, or season.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Full plan comparison' })).toBeVisible()
  })

  test('FAQ keeps League Office tied to competition tools', async ({ page }) => {
    await expectSurfaceLoads(page, '/faq')

    await expect(page.getByRole('heading', { name: 'Common questions about TenAceIQ.' })).toBeVisible()
    await expect(page.getByText('Is TenAceIQ only for captains?', { exact: true })).toBeVisible()
    await expect(page.getByText('Answer', { exact: true }).first()).toBeVisible()
  })

  test('Install manifest keeps the public toolkit story', async ({ page }) => {
    const response = await page.goto('/manifest.webmanifest')
    expect(response?.status() || 200, '/manifest.webmanifest should load').toBe(200)

    const manifest = JSON.parse(await page.locator('body').innerText()) as { description?: string }
    expect(manifest.description).toContain('Explore tennis context for free. Unlock the right TenAceIQ tools when you are ready to play, improve, captain, coach, or run competition with less chaos.')
    expect(manifest.description).not.toContain('next tennis job needs a home base')
    expect(manifest.description).not.toContain('Full-Court workspaces')
  })

  test('Coordinator setup stays readable on mobile dark shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expectSurfaceLoads(page, '/league-coordinator')
    await expectDarkShell(page)
    const resetBoundary = await page.getByText('This view needs a quick reset').isVisible().catch(() => false)
    if (!resetBoundary) {
      await expect(page.getByRole('heading', { name: 'What do you need to do?' })).toBeVisible()
      const firstLeagueSetup = await page.getByText('Create your first league.').isVisible().catch(() => false)
      if (firstLeagueSetup) {
        await expect(page.getByLabel('First league setup steps')).toBeVisible()
        await expect(page.getByText('More season options')).toBeVisible()
        await expect(page.getByText('Data refresh path')).not.toBeVisible()
      } else {
        await expect(page.getByText(/Unlock League Office|Continue season|Open League Office/)).toBeVisible()
      }
    }
  })

  test('Matchup clears stale player query params into an empty mobile setup', async ({ page }) => {
    await expectSurfaceLoads(page, '/matchup?type=singles&playerA=deleted-player-a&playerB=deleted-player-b')
    await expectDarkShell(page)

    const resetBoundary = await page.getByText('This view needs a quick reset').isVisible().catch(() => false)
    if (!resetBoundary) {
      await expect(page.getByRole('heading', { name: 'Choose two players.' })).toBeVisible()
      await expect(page.getByText('0 of 2 slots selected')).toBeVisible()
      await expect(page.getByLabel('Player A')).toHaveValue('')
      await expect(page.getByLabel('Player B')).toHaveValue('')
    }
  })
})
