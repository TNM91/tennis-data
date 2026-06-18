import { expect, test, type Page } from '@playwright/test'

const PRIMARY_NAV = [
  { href: '/explore', label: 'Explore' },
  { href: '/upgrade?plan=player_plus&next=%2Fmylab', label: 'Improve' },
  { href: '/upgrade?plan=coach&next=%2Fcoach', label: 'Coaches' },
  { href: '/upgrade?plan=captain&next=%2Fcaptain', label: 'Manage' },
  { href: '/upgrade?plan=league&next=%2Fleague-coordinator', label: 'Leagues & Tournaments' },
] as const

async function expectPrimaryNavigation(page: Page) {
  await page.context().clearCookies()
  await page.addInitScript(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  const viewportWidth = page.viewportSize()?.width ?? 1280
  const header = page.locator('header').first()
  const firstVisibleNavLink = page.locator(`a[href="${PRIMARY_NAV[0].href}"]`).getByText(PRIMARY_NAV[0].label, { exact: true }).first()

  if (viewportWidth < 980 && !(await firstVisibleNavLink.isVisible().catch(() => false))) {
    const menuButton = header.getByRole('button', { name: 'Open menu' }).first()

    await expect(menuButton).toBeVisible()
    await expect
      .poll(
        async () => {
          if (await firstVisibleNavLink.isVisible().catch(() => false)) return true
          if (await menuButton.isVisible().catch(() => false)) {
            await menuButton.click({ force: true })
          }
          return firstVisibleNavLink.isVisible().catch(() => false)
        },
        { message: 'mobile header menu should open after hydration' },
      )
      .toBe(true)
  }

  for (const { href, label } of PRIMARY_NAV) {
    await expect(page.locator(`a[href="${href}"]`).getByText(label, { exact: true }).first(), `${label} navigation link`).toBeVisible()
  }

  if (viewportWidth >= 820) {
    await expect(page.locator('body')).toContainText(/More Tennis\. Less Chaos\.|Find what matters\./)
  }
}

test.describe('public navigation contract', () => {
  test('keeps current header and footer links reachable in the dark shell', async ({ page }) => {
    await expectPrimaryNavigation(page)
  })
})

test.describe('public smoke routes', () => {
  for (const path of ['/', '/pricing', '/matchup']) {
    test(`${path} loads`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveTitle(/TenAceIQ|tennis/i)
      await expect(page.locator('body')).toBeVisible()
    })
  }
})
