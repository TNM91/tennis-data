import { expect, test, type Page } from '@playwright/test'

const THEME_STORAGE_KEY = 'tenaceiq-theme-mode'
const LOCKED_LABELS = ['My Lab', 'Captain', 'Coordinator']
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

  for (const label of LOCKED_LABELS) {
    const accessibleLabel = `${label} locked. Unlock to open.`
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

    const headerColor = await headerIcon.evaluate((icon) => getComputedStyle(icon).color)
    const footerColor = await footerIcon.evaluate((icon) => getComputedStyle(icon).color)
    expect(headerColor, `${label} header lock color is readable`).toBe(LOCK_COLOR)
    expect(footerColor, `${label} footer lock color is readable`).toBe(LOCK_COLOR)

    const headerBadgeBackground = await headerIcon.evaluate((icon) =>
      getComputedStyle(icon.parentElement as HTMLElement).backgroundImage,
    )
    const footerBadgeBackground = await footerIcon.evaluate((icon) =>
      getComputedStyle(icon.parentElement as HTMLElement).backgroundImage,
    )
    expect(headerBadgeBackground, `${label} header lock badge has a visible fill`).toContain('linear-gradient')
    expect(footerBadgeBackground, `${label} footer lock badge has a visible fill`).toContain('linear-gradient')
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
