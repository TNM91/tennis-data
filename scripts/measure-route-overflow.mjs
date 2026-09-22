import { chromium } from '@playwright/test'

const url = process.argv[2] ?? 'http://127.0.0.1:3001/'

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

const browser = await chromium.launch({ headless: true })
const results = []

for (const viewport of viewports) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  })

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForTimeout(300)

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body

    const isContainedHorizontalScroller = (element) => {
      const style = window.getComputedStyle(element)
      return (
        element.scrollWidth > element.clientWidth + 1
        && (style.overflowX === 'auto' || style.overflowX === 'scroll')
      )
    }

    const hasHorizontalScrollParent = (element) => {
      let current = element.parentElement

      while (current && current !== document.body) {
        if (isContainedHorizontalScroller(current)) return true
        current = current.parentElement
      }

      return false
    }

    const offenders = Array.from(document.querySelectorAll('body *'))
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)

        if (rect.width === 0 || rect.height === 0) return false
        if (style.position === 'absolute' || style.position === 'fixed') return false
        if (isContainedHorizontalScroller(element)) return false
        if (hasHorizontalScrollParent(element)) return false

        return rect.left < -1 || rect.right > window.innerWidth + 1
      })
      .slice(0, 8)
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          tag: element.tagName,
          text: (element.textContent || '').trim().slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        }
      })

    return {
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      clientWidth: doc.clientWidth,
      offenders,
    }
  })

  results.push({ ...viewport, ...metrics })
  await page.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 2))
