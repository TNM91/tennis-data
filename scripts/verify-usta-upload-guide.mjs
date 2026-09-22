import { chromium } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.TIQ_BASE_URL || 'http://127.0.0.1:3018'
const evidenceDir = path.resolve('artifacts/usta-walkthrough-2026-08-13/site-integration')
await fs.mkdir(evidenceDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const errors = []

function captureConsoleError(scope, message) {
  if (message.type() !== 'error') return
  const location = message.location().url || ''
  const text = message.text()
  if (location.includes('/_vercel/') || text.includes('/_vercel/')) return
  errors.push(`${scope} console: ${text}`)
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  desktop.on('console', (message) => captureConsoleError('desktop', message))
  desktop.on('pageerror', (error) => errors.push(`desktop page: ${error.message}`))

  await desktop.goto(`${baseUrl}/resources/usta-upload`, { waitUntil: 'networkidle' })
  await desktop.getByRole('heading', { name: 'Upload USTA data without the guesswork.' }).waitFor()
  const videos = desktop.locator('video')
  if (await videos.count() !== 2) throw new Error('Expected two walkthrough videos.')
  if (await desktop.locator('track[kind="captions"]').count() !== 2) throw new Error('Expected captions on both videos.')
  if (await desktop.locator('[data-nextjs-dialog]').count()) throw new Error('Next.js error overlay detected.')
  await desktop.screenshot({ path: path.join(evidenceDir, 'desktop.png'), fullPage: true })

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  mobile.on('console', (message) => captureConsoleError('mobile', message))
  mobile.on('pageerror', (error) => errors.push(`mobile page: ${error.message}`))
  await mobile.goto(`${baseUrl}/resources/usta-upload`, { waitUntil: 'networkidle' })
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 1) throw new Error(`Mobile page overflows horizontally by ${overflow}px.`)
  await mobile.getByRole('link', { name: 'Watch the 1-minute guide' }).waitFor()
  await mobile.screenshot({ path: path.join(evidenceDir, 'mobile.png'), fullPage: true })

  await mobile.goto(`${baseUrl}/data-assist?intent=upload-source&context=Browser%20verification`, { waitUntil: 'networkidle' })
  await mobile.getByText('Watch the phone walkthrough first.').waitFor()
  const guideHref = await mobile.getByRole('link', { name: 'Watch walkthrough' }).getAttribute('href')
  if (guideHref !== '/resources/usta-upload') throw new Error(`Unexpected walkthrough link: ${guideHref}`)
  await mobile.screenshot({ path: path.join(evidenceDir, 'data-assist-mobile.png'), fullPage: true })

  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ ok: true, guideVideos: 2, captionTracks: 2, mobileOverflow: overflow, guideHref, evidenceDir }, null, 2))
} finally {
  await browser.close()
}
