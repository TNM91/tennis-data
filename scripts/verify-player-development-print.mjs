import { chromium } from '@playwright/test'

const url = process.argv[2] ?? 'http://localhost:3000/player-development/relentless-competitor-4-0/workbook'
const screenshotPath = process.argv[3] ?? 'tmp-screenshots/player-development-print.png'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1 })

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
await page.emulateMedia({ media: 'print' })

const audit = await page.evaluate(() => {
  const allPages = [...document.querySelectorAll('article[class*="workbookPage"]')]
  const pages = allPages.filter((page) => page.getBoundingClientRect().height > 0)

  return {
    title: document.title,
    pageCount: allPages.length,
    visiblePageCount: pages.length,
    overflows: pages
      .map((page, index) => {
        const body = page.querySelector('[class*="workbookPageBody"]')
        const pageRect = page.getBoundingClientRect()
        const bodyRect = body?.getBoundingClientRect()
        const bodyOverflowY = body ? Math.round(body.scrollHeight - body.clientHeight) : 0

        return {
          page: index + 1,
          footer: page.querySelector('footer span')?.textContent ?? '',
          pageHeight: Math.round(pageRect.height),
          bodyHeight: body ? Math.round(body.scrollHeight) : 0,
          bodyClientHeight: body ? Math.round(body.clientHeight) : 0,
          bodyOverflowY,
          bodyBottomToPage: bodyRect ? Math.round(pageRect.bottom - bodyRect.bottom) : null,
        }
      })
      .filter((entry) => entry.bodyOverflowY > 3 || (entry.bodyBottomToPage !== null && entry.bodyBottomToPage < 34)),
  }
})

await page.screenshot({ path: screenshotPath, fullPage: false })
await browser.close()

console.log(JSON.stringify(audit, null, 2))
