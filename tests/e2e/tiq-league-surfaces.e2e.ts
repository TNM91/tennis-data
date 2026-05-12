import { expect, test, type Page } from '@playwright/test'

const THEME_STORAGE_KEY = 'tenaceiq-theme-mode'

async function setTheme(page: Page, theme: 'dark' | 'light') {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value)
    },
    { key: THEME_STORAGE_KEY, value: theme },
  )
}

async function expectSurfaceLoads(page: Page, path: string) {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  const response = await page.goto(path)
  expect(response?.status() || 200, `${path} should not return a server error`).toBeLessThan(500)
  await expect(page.locator('body')).toBeVisible()
  await expect(page).toHaveTitle(/TenAceIQ|tennis|Login/i)
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
    test(`${path} keeps light mode renderable without horizontal overflow`, async ({ page }) => {
      await setTheme(page, 'light')
      await expectSurfaceLoads(page, path)
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
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
    await setTheme(page, 'light')
    await expectSurfaceLoads(page, '/mylab')
    await expect(page.getByText('A weekly tennis routine, not another dashboard.')).toBeVisible()
    await expect(page.getByText('Personal scorecard')).toBeVisible()
    await expect(page.getByText('Reviewed uploads', { exact: true })).toBeVisible()
    await expect(page.getByText('Use reviewed uploads', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open Data Assist' })).toBeVisible()
  })

  test('Pricing separates free account access from paid plan activation', async ({ page }) => {
    await setTheme(page, 'light')
    await expectSurfaceLoads(page, '/pricing')
    await expect(page.getByText('A free account is the starting line, not a paid unlock.')).toBeVisible()
    await expect(page.getByText('Paid tools need activation')).toBeVisible()
    await expect(page.getByText(/matching plan is active/i)).toBeVisible()
    await expect(page.getByText(/Data Assist review before they shape TenAceIQ/i)).toBeVisible()
  })

  test('Explore start and rankings actions stay readable on mobile light mode', async ({ page }) => {
    await setTheme(page, 'light')
    await page.setViewportSize({ width: 390, height: 844 })
    await expectSurfaceLoads(page, '/explore')
    await expect(page.getByText('Start here')).toBeVisible()
    await expect(page.getByText('Refresh with Data Assist')).toBeVisible()

    await expectSurfaceLoads(page, '/explore/rankings')
    await expect(page.getByText('Full rankings')).toBeVisible()
    await expect(page.getByText('Run Matchup')).toBeVisible()
  })

  test('Coordinator setup stays readable on mobile light mode', async ({ page }) => {
    await setTheme(page, 'light')
    await page.setViewportSize({ width: 390, height: 844 })
    await expectSurfaceLoads(page, '/league-coordinator')
    await expect(page.getByText('Use uploads as the coordinator refresh path.')).toBeVisible()
    await expect(page.getByText('Team Results handles team match events and line scores')).toBeVisible()
    await expect(page.getByText('Add a league')).toBeVisible()
  })

  test('Matchup clears stale player query params into a Data Assist-aware notice', async ({ page }) => {
    await setTheme(page, 'light')
    await expectSurfaceLoads(page, '/matchup?type=singles&playerA=deleted-player-a&playerB=deleted-player-b')

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
