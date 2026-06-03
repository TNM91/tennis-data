import { chromium } from 'playwright'

const baseUrl = process.env.LEVEL_UP_BASE_URL ?? 'http://localhost:3065'
const identity = process.env.LEVEL_UP_IDENTITY ?? 'relentless-competitor-4-0'
const url = `${baseUrl}/player-development/${identity}/level-up?weeklybalance=${Date.now()}`

const now = new Date()
const completions = [
  {
    id: `weekly-${Date.now()}-serve`,
    playerId: 'local-player',
    cardId: 'serve-target-call',
    completedAt: now.toISOString(),
    proofRating: 4,
    note: 'Target call was clear.',
    durationMinutes: 10,
  },
  {
    id: `weekly-${Date.now()}-body`,
    playerId: 'local-player',
    cardId: 'jump-rope-rhythm-builder',
    completedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    proofRating: 3,
    note: 'Feet got lighter.',
    durationMinutes: 8,
  },
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate((seed) => {
    localStorage.setItem('tiq-level-up-completions', JSON.stringify(seed))
  }, completions)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('region', { name: 'Weekly training balance' }).waitFor({ state: 'visible', timeout: 10_000 })
  await page.waitForTimeout(2_500)

  const balanceText = await page.getByRole('region', { name: 'Weekly training balance' }).innerText()
  const normalizedBalanceText = balanceText.toLowerCase()
  if (!normalizedBalanceText.includes('2 proofs in the last 7 days.') || !normalizedBalanceText.includes('needs one') || !normalizedBalanceText.includes('start balance rep')) {
    throw new Error(`Weekly balance did not render expected summary.\n${balanceText}`)
  }

  console.log(JSON.stringify({
    ok: true,
    identity,
    url,
    balanceText,
  }, null, 2))
} finally {
  await browser.close()
}
