import { expect, test, type Page } from '@playwright/test'

const PRIMARY_NAV = [
  { href: '/explore', label: 'Find' },
  { href: '/matchup', label: 'Prepare' },
  { href: '/mylab', label: 'Improve' },
  { href: '/coaches', label: 'Coaches' },
  { href: '/teams', label: 'Teams' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/leagues', label: 'Leagues' },
  { href: '/resources', label: 'Resources' },
  { href: '/pricing', label: 'Pricing' },
] as const

async function expectPrimaryNavigation(page: Page) {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  const viewportWidth = page.viewportSize()?.width ?? 1280
  const header = page.locator('header').first()

  if (viewportWidth < 980) {
    const menuButton = header.getByRole('button', { name: 'Open menu' }).first()
    const closeButton = header.getByRole('button', { name: 'Close menu' }).first()

    await expect(menuButton).toBeVisible()
    await expect
      .poll(
        async () => {
          if (await closeButton.isVisible().catch(() => false)) return true
          if (await menuButton.isVisible().catch(() => false)) {
            await menuButton.click()
          }
          return closeButton.isVisible().catch(() => false)
        },
        { message: 'mobile header menu should open after hydration' },
      )
      .toBe(true)
  }

  for (const { href, label } of PRIMARY_NAV) {
    await expect(header.locator(`a[href="${href}"]`).getByText(label, { exact: true }), `${label} header link`).toBeVisible()
  }

  if (viewportWidth >= 820) {
    const footer = page.locator('footer').first()
    for (const href of ['/', '/resources', '/pricing', '/explore/players', '/mylab', '/matchup', '/leagues', '/tournaments']) {
      await expect(footer.locator(`a[href="${href}"]`).first(), `${href} footer link`).toBeVisible()
    }
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
