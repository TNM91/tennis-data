import { expect, test, type Page } from '@playwright/test'

const THEME_STORAGE_KEY = 'tenaceiq-theme-mode'
const LOCKED_PRIMARY_NAV = [
  { label: 'My Lab', plan: 'Player' },
  { label: 'Matchup', plan: 'Player' },
  { label: 'Captain', plan: 'Captain' },
  { label: 'Coordinator', plan: 'TIQ League Coordinator' },
] as const
const LOCK_COLOR = 'rgb(8, 17, 29)'

async function setTheme(page: Page, theme: 'dark' | 'light') {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value)
    },
    { key: THEME_STORAGE_KEY, value: theme },
  )
}

async function expectLockedNavIcons(page: Page, theme: 'dark' | 'light') {
  await setTheme(page, theme)
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

  const viewportWidth = page.viewportSize()?.width ?? 1280
  if (viewportWidth < 980) {
    const header = page.locator('header').first()
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

  for (const { label, plan } of LOCKED_PRIMARY_NAV) {
    const accessibleLabel = `${label} requires ${plan}. Create a free account first, then activate ${plan}.`
    const headerLink = page.locator(`header a[aria-label="${accessibleLabel}"]`).first()
    const footerLink = page.locator(`footer a[aria-label="${accessibleLabel}"]`).first()

    await expect(headerLink, `${label} header locked link`).toBeVisible()
    await expect(footerLink, `${label} footer locked link`).toBeVisible()

    const headerPaths = await headerLink.locator('svg path').evaluateAll((paths) =>
      paths.map((path) => path.getAttribute('d')),
    )
    const footerPaths = await footerLink.locator('svg path').evaluateAll((paths) =>
      paths.map((path) => path.getAttribute('d')),
    )
    expect(footerPaths, `${label} footer uses the same lock glyph as the header`).toEqual(headerPaths)

    const headerIcon = headerLink.locator('svg').first()
    const footerIcon = footerLink.locator('svg').first()
    await expect(headerIcon, `${label} header lock icon`).toBeVisible()
    await expect(footerIcon, `${label} footer lock icon`).toBeVisible()

    await expect
      .poll(() => headerIcon.evaluate((icon) => getComputedStyle(icon).color), {
        message: `${label} header lock color should settle`,
      })
      .toBe(LOCK_COLOR)
    await expect
      .poll(() => footerIcon.evaluate((icon) => getComputedStyle(icon).color), {
        message: `${label} footer lock color should settle`,
      })
      .toBe(LOCK_COLOR)

    await expect
      .poll(() => headerIcon.evaluate((icon) => getComputedStyle(icon.parentElement as HTMLElement).backgroundImage), {
        message: `${label} header lock badge should settle`,
      })
      .toContain('linear-gradient')
    await expect
      .poll(() => footerIcon.evaluate((icon) => getComputedStyle(icon.parentElement as HTMLElement).backgroundImage), {
        message: `${label} footer lock badge should settle`,
      })
      .toContain('linear-gradient')
  }
}

test.describe('locked primary navigation icons', () => {
  test('match between header and footer in light mode', async ({ page }) => {
    await expectLockedNavIcons(page, 'light')
  })

  test('match between header and footer in dark mode', async ({ page }) => {
    await expectLockedNavIcons(page, 'dark')
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
