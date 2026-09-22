import { chromium } from '@playwright/test'

const baseUrl = process.env.PLAYER_DEVELOPMENT_CHECK_BASE_URL ?? 'http://127.0.0.1:3001'

const routes = [
  '/player-development/workbook',
  '/player-development/coach-planner',
  '/player-development/relentless-competitor-4-0/workbook',
  '/player-development/relentless-competitor-4-0/coach-planner',
]

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'web', width: 1440, height: 900 },
]

const browser = await chromium.launch({ headless: true })
const failures = []
const results = []

for (const viewport of viewports) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  })

  for (const route of routes) {
    const url = `${baseUrl}${route}`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
    await page.waitForTimeout(300)

    const audit = await page.evaluate(() => {
      const doc = document.documentElement
      const body = document.body
      const pageWidth = window.innerWidth

      const visibleWorkbookOverflows = [...document.querySelectorAll('article[class*="workbookPage"]')]
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0
        })
        .map((element, index) => {
          const rect = element.getBoundingClientRect()
          return {
            index: index + 1,
            className: element.className,
            scrollWidth: Math.round(element.scrollWidth),
            clientWidth: Math.round(element.clientWidth),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
          }
        })
        .filter((entry) => entry.scrollWidth > entry.clientWidth + 1 || entry.left < -1 || entry.right > pageWidth + 1)

      return {
        title: document.title,
        scrollHeight: Math.max(doc.scrollHeight, body.scrollHeight),
        viewportHeight: window.innerHeight,
        documentScrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
        clientWidth: doc.clientWidth,
        workbookOverflows: visibleWorkbookOverflows.slice(0, 8),
      }
    })

    const result = {
      route,
      viewport: viewport.name,
      screens: Number((audit.scrollHeight / audit.viewportHeight).toFixed(2)),
      documentOverflow: audit.documentScrollWidth > audit.clientWidth + 1,
      workbookOverflowCount: audit.workbookOverflows.length,
    }
    results.push(result)

    if (result.documentOverflow || result.workbookOverflowCount > 0) {
      failures.push({ ...result, workbookOverflows: audit.workbookOverflows })
    }
  }

  await page.close()
}

await browser.close()

console.log(JSON.stringify(results, null, 2))

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2))
  process.exit(1)
}
