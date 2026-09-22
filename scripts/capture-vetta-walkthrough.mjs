import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('.')
const out = path.join(root, 'output', 'vetta-meeting', '05-vetta-brand-concept', 'walkthrough-views')
await mkdir(out, { recursive: true })

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 })
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  for (const label of ['Club Home', 'Coach', 'Player', 'League', 'Tournament']) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await page.screenshot({ path: path.join(out, `${label.toLowerCase().replaceAll(' ', '-')}.png`), type: 'png' })
  }
} finally {
  await browser.close()
}
