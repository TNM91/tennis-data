import { expect, test, type Page } from '@playwright/test'

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
  expect(pageErrors, `${path} should not throw uncaught browser errors`).toEqual([])
}

test.describe('TIQ league surfaces', () => {
  for (const path of [
    '/explore/leagues',
    '/league-coordinator',
    '/league-coordinator/results',
    '/league-coordinator/individual-results',
  ]) {
    test(`${path} loads without browser errors`, async ({ page }) => {
      await expectSurfaceLoads(page, path)
    })
  }

  test('scheduled result handoff routes stay renderable while signed out', async ({ page }) => {
    await expectSurfaceLoads(
      page,
      '/league-coordinator/individual-results?leagueId=test-league&scheduleItemId=test-schedule&suggest_player_a=name%3APlayer%20A&suggest_player_b=name%3APlayer%20B&resultDate=2026-01-15#player-result-entry',
    )

    await expectSurfaceLoads(
      page,
      '/league-coordinator/results?leagueId=test-league&scheduleItemId=test-schedule&teamA=Team%20A&teamB=Team%20B&matchDate=2026-01-15&facility=Court%201#team-match-entry',
    )
  })
})
