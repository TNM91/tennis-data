import { chromium } from 'playwright'

const baseUrl = process.env.PORTAL_CHECK_BASE_URL || 'http://127.0.0.1:3004'

const routes = [
  '/compete',
  '/compete/leagues',
  '/compete/teams',
  '/compete/schedule',
  '/compete/results',
  '/league-coordinator',
  '/league-coordinator/results',
  '/league-coordinator/individual-results',
]

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 900 },
]

const browser = await chromium.launch({ headless: true })
const findings = []

for (const viewport of viewports) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  })

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text()
      if (text.includes('ep1.adtrafficquality.google') || text.includes('google/getconfig/sodar')) {
        return
      }
      if (text === 'Failed to load resource: net::ERR_FAILED') {
        return
      }

      findings.push({
        route: page.url(),
        viewport: viewport.name,
        type: 'console',
        text: text.slice(0, 220),
      })
    }
  })

  for (const route of routes) {
    try {
      await page.goto(`${baseUrl}${route}`, {
        waitUntil: 'networkidle',
        timeout: 30_000,
      })
      await page.waitForTimeout(500)

      const metrics = await page.evaluate(() => {
        const doc = document.documentElement
        const body = document.body
        const offenders = Array.from(document.querySelectorAll('body *'))
          .filter((element) => {
            const rect = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            if (rect.width === 0 || rect.height === 0) return false
            if (style.position === 'absolute' || style.position === 'fixed') return false
            return rect.right > window.innerWidth + 1 || rect.left < -1
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

      if (metrics.scrollWidth > metrics.clientWidth + 1 || metrics.offenders.length) {
        findings.push({ route, viewport: viewport.name, type: 'overflow', metrics })
      }
    } catch (error) {
      findings.push({
        route,
        viewport: viewport.name,
        type: 'navigation',
        text: error instanceof Error ? error.message : String(error),
      })
    }
  }

  await page.close()
}

await browser.close()

if (findings.length) {
  console.error(JSON.stringify(findings, null, 2))
  process.exit(1)
}

console.log('Portal overflow check passed.')
