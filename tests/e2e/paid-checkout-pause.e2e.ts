import { expect, test } from '@playwright/test'

test('keeps paid checkout paused while preserving the early-access path', async ({ page, request }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const locationUrl = message.location().url
    if (locationUrl.includes('/_vercel/') || message.text().includes('/_vercel/')) return
    consoleErrors.push(message.text())
  })

  await page.goto('/pricing')
  await expect(page.getByRole('heading', { name: 'Choose the tools you need.' })).toBeVisible()
  await expect(page.getByText('Paid plans are opening soon.', { exact: false }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /^(Join early access|Early access)$/ }).first()).toBeVisible()

  await page.goto('/upgrade?plan=captain&next=%2Fcaptain')
  await expect(page.getByRole('heading', { name: 'Paid plans are opening soon.' })).toBeVisible()
  await expect(page.getByText('Join early access and we will let you know when checkout is ready.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request Team Hub' })).toBeVisible()
  await expect(page.getByText('Stripe', { exact: false })).toHaveCount(0)

  const checkoutResponse = await request.post('/api/checkout/session', { data: {} })
  expect(checkoutResponse.status()).toBe(503)
  await expect(checkoutResponse.json()).resolves.toMatchObject({ ok: false, code: 'checkout_paused' })

  expect(consoleErrors).toEqual([])
})
