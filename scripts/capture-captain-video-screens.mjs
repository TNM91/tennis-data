import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const env = loadEnvFile('.env.local')
const baseUrl = process.env.TENACEIQ_QA_BASE_URL || env.TENACEIQ_QA_BASE_URL || 'http://localhost:3000'
const email = process.env.TENACEIQ_QA_CAPTAIN_EMAIL || env.TENACEIQ_QA_CAPTAIN_EMAIL
const password = process.env.TENACEIQ_QA_CAPTAIN_PASSWORD || env.TENACEIQ_QA_CAPTAIN_PASSWORD
if (!email || !password) throw new Error('Captain QA credentials are required in .env.local or the shell.')

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await context.newPage()
const output = resolve(process.cwd(), 'public', 'media', 'product-tours')

try {
  await page.goto(`${baseUrl}/login?plan=captain&next=%2Fcaptain&fixtureauth=video-capture`, { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill(email)
  await page.locator('#password').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((url) => url.pathname === '/captain', { timeout: 35_000 })

  for (const [route, file] of [
    ['/captain/messaging', 'captain-messaging-phone.png'],
    ['/captain/record-result', 'captain-scorecard-phone.png'],
  ]) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1_000)
    await page.screenshot({ path: join(output, file) })
  }
  console.log('Captured real authenticated Captain messaging and scorecard screens without printing credentials.')
} finally {
  await context.close()
  await browser.close()
}

function loadEnvFile(fileName) {
  const path = join(process.cwd(), fileName)
  if (!existsSync(path)) return {}
  return Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => {
    const index = line.indexOf('=')
    return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')]
  }))
}
