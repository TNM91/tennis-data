import { expect, test } from '@playwright/test'

test('connects the platform tour to current role plans without mobile overflow', async ({ page }) => {
  await page.goto('/resources/platform-tour')

  await expect(page.getByRole('heading', { name: 'See where TenAceIQ fits your tennis life.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Start free. Add only the tennis tools you need.' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Player \$2\.99\/month/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /League \$25\/season/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Club From \$99\/month/ })).toBeVisible()

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(hasHorizontalOverflow).toBe(false)

  await page.getByRole('button', { name: /Coach.*I develop players between lessons/ }).click()
  const recommendation = page.getByTestId('tour-plan-recommendation')
  await expect(recommendation).toContainText('Coach')
  await expect(recommendation).toContainText('$5.99/month')
  await expect(recommendation.getByRole('link', { name: 'Unlock Coach' })).toBeVisible()

  await recommendation.getByRole('button', { name: 'Watch Coach overview' }).click()
  const dialog = page.getByRole('dialog', { name: /Give every player a clearer next step/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('video')).toHaveAttribute('playsinline', '')
  await expect(dialog.locator('track[kind="captions"]')).toHaveCount(1)
  await expect(dialog).toContainText('$5.99/month')
  await expect(dialog.getByText('Read transcript')).toBeVisible()
  await dialog.getByRole('button', { name: 'Close video' }).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('button', { name: /Club.*I connect staff, programs, players, teams, and competition/ }).click()
  await expect(recommendation).toContainText('From $99/month')
  await expect(recommendation).toContainText('Club Unlimited $199/month')
  await expect(recommendation.getByRole('link', { name: 'Compare Club plans' })).toBeVisible()
})
