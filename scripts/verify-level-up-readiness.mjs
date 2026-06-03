import { chromium } from 'playwright'

const baseUrl = process.env.LEVEL_UP_BASE_URL ?? 'http://localhost:3064'
const identity = process.env.LEVEL_UP_IDENTITY ?? 'relentless-competitor-4-0'
const url = `${baseUrl}/player-development/${identity}/level-up?readinessverify=${Date.now()}`

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })

  const readiness = page.getByRole('region', { name: "Choose today's readiness" })
  await readiness.getByRole('button', { name: /Tired/i }).click()
  await page.getByRole('heading', { name: /Tired: three good matches/i }).waitFor({ state: 'visible', timeout: 10_000 })

  await readiness.getByRole('button', { name: /Rushed/i }).click()
  await page.getByRole('heading', { name: /Rushed: three good matches/i }).waitFor({ state: 'visible', timeout: 10_000 })

  const bodyText = await page.locator('body').innerText()
  if (!bodyText.includes('Pick a quick win.') || !bodyText.includes('Do one clean card. Do not turn five minutes into browsing.')) {
    throw new Error('Expected rushed readiness command copy to render.')
  }

  console.log(JSON.stringify({
    ok: true,
    identity,
    url,
    verified: ['tired filters', 'rushed filters', 'readiness command copy'],
  }, null, 2))
} finally {
  await browser.close()
}
