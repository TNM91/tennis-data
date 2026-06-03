import { chromium } from 'playwright'

const baseUrl = process.env.LEVEL_UP_BASE_URL ?? 'http://localhost:3058'
const identity = process.env.LEVEL_UP_IDENTITY ?? 'pressure-closer-4-0'
const url = `${baseUrl}/player-development/${identity}/level-up?coachnextverify=${Date.now()}`

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })

  const inbox = page.getByRole('region', { name: 'Coach challenge inbox' })
  await inbox.getByRole('button', { name: /Start next/i }).click()

  await page.locator('[data-level-up-start-action="true"]').first().click()
  await page.getByRole('button', { name: /Score now/i }).first().click()
  await page.getByRole('button', { name: /^4$/ }).first().click()
  await page.getByRole('button', { name: /Save 4\/5 proof/i }).first().click()

  const coachNext = page.locator('[aria-label^="Coach recommended next for"]').first()
  await coachNext.waitFor({ state: 'visible', timeout: 10_000 })

  const panelText = await coachNext.innerText()
  if (!panelText.includes('Send proof to coach.') || !panelText.includes('Copy coach update')) {
    throw new Error(`Expected coach send recommendation. Saw:\n${panelText}`)
  }

  console.log(JSON.stringify({
    ok: true,
    identity,
    url,
    panelText,
  }, null, 2))
} finally {
  await browser.close()
}
