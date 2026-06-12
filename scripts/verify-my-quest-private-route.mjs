import { chromium } from '@playwright/test'

const targetUrl = process.env.MY_QUEST_URL || 'https://www.tenaceiq.com/level-up/my-quest'
const privatePhrases = [
  'Operation Visible Abs',
  'Level Up: My Quest',
  "Today's Quest",
  'Today&apos;s Quest',
  'Streak Freeze',
  'Visible Abs Week',
  'XP Total',
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })

try {
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 45000 })
  const bodyText = await page.locator('body').innerText({ timeout: 10000 })

  if (!bodyText.includes('404') || !bodyText.includes('Not Found')) {
    throw new Error(`Expected logged-out private route to show Not Found. Saw: ${bodyText.slice(0, 180)}`)
  }

  const leakedPhrase = privatePhrases.find((phrase) => bodyText.includes(phrase))
  if (leakedPhrase) {
    throw new Error(`Private My Quest content leaked to logged-out visitor: ${leakedPhrase}`)
  }

  console.log(`My Quest private route smoke passed: ${targetUrl}`)
} finally {
  await browser.close()
}
