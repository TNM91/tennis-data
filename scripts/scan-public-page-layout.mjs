import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const baseUrl = process.env.PUBLIC_PAGE_SCAN_BASE_URL ?? 'http://127.0.0.1:3001'
const artifactDir = process.env.PUBLIC_PAGE_SCAN_ARTIFACT_DIR

const routes = [
  '/',
  '/pricing',
  '/upgrade?plan=club_starter&next=%2Fclubs',
  '/explore',
  '/explore/players',
  '/explore/teams',
  '/explore/leagues',
  '/explore/rankings',
  '/level-up',
  '/player-development',
  '/player-development/workbook',
  '/player-development/coach-planner',
  '/compete',
  '/league-coordinator',
  '/league-coordinator/tournaments',
  '/leagues-and-tournaments',
  '/tournaments',
  '/clubs',
  '/clubs/northstar-tennis-club-demo',
  '/captain',
  '/coach',
  '/mylab',
  '/profile',
  '/data-assist',
  '/tactics',
  '/resources',
  '/faq',
  '/contact',
]

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'web', width: 1440, height: 900 },
]

const screenshotRoutes = new Set([
  '/',
  '/resources',
  '/mylab',
  '/clubs',
  '/clubs/northstar-tennis-club-demo',
])

if (artifactDir) mkdirSync(artifactDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const rows = []

for (const viewport of viewports) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  })

  for (const route of routes) {
    const url = `${baseUrl}${route}`
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
      await page.waitForTimeout(300)

      const audit = await page.evaluate(() => {
        const doc = document.documentElement
        const body = document.body
        const pageWidth = window.innerWidth

        const isContainedScroller = (element) => {
          const style = window.getComputedStyle(element)
          return (
            element.scrollWidth > element.clientWidth + 1
            && (style.overflowX === 'auto' || style.overflowX === 'scroll')
          )
        }

        const hasContainedScrollerParent = (element) => {
          let current = element.parentElement
          while (current && current !== document.body) {
            if (isContainedScroller(current)) return true
            current = current.parentElement
          }
          return false
        }

        const offenders = [...document.querySelectorAll('body *')]
          .filter((element) => {
            const rect = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            if (rect.width === 0 || rect.height === 0) return false
            if (style.position === 'absolute' || style.position === 'fixed') return false
            if (isContainedScroller(element) && rect.left >= -1 && rect.right <= pageWidth + 1) return false
            if (hasContainedScrollerParent(element)) return false
            return rect.left < -1 || rect.right > pageWidth + 1 || element.scrollWidth > element.clientWidth + 2
          })
          .slice(0, 5)
          .map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              tag: element.tagName,
              className: String(element.className).slice(0, 90),
              text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 90),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              scrollWidth: Math.round(element.scrollWidth),
              clientWidth: Math.round(element.clientWidth),
            }
          })

        return {
          title: document.title,
          scrollHeight: Math.max(doc.scrollHeight, body.scrollHeight),
          viewportHeight: window.innerHeight,
          documentScrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
          clientWidth: doc.clientWidth,
          offenders,
        }
      })

      if (artifactDir && viewport.name === 'phone' && screenshotRoutes.has(route)) {
        const routeName = route === '/' ? 'home' : route.replace(/^\//, '').replaceAll('/', '-')
        await page.screenshot({ path: join(artifactDir, `${routeName}-iphone.png`), fullPage: true })
      }

      rows.push({
        route,
        viewport: viewport.name,
        screens: Number((audit.scrollHeight / audit.viewportHeight).toFixed(2)),
        documentOverflow: audit.documentScrollWidth > audit.clientWidth + 1,
        offenderCount: audit.offenders.length,
        offenders: audit.offenders,
      })
    } catch (error) {
      rows.push({
        route,
        viewport: viewport.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  await page.close()
}

await browser.close()

const ranked = rows
  .filter((row) => !row.error)
  .sort((a, b) => {
    if (a.viewport !== b.viewport) return a.viewport.localeCompare(b.viewport)
    if (b.offenderCount !== a.offenderCount) return b.offenderCount - a.offenderCount
    return b.screens - a.screens
  })

console.log(JSON.stringify(ranked, null, 2))
