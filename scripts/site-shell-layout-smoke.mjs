import { chromium } from 'playwright'

const baseUrl = process.env.SITE_SHELL_BASE_URL ?? 'http://127.0.0.1:3000'

const viewports = [
  { name: 'desktop', width: 1440, height: 900, expectsRail: true },
  { name: 'tablet', width: 900, height: 900, expectsRail: true },
  { name: 'mobile', width: 390, height: 844, expectsRail: false },
]

const ignoredConsoleFragments = [
  'ep1.adtrafficquality.google',
  'google/getconfig/sodar',
  '/_next/webpack-hmr',
  "Framing 'https://www.google.com/' violates",
  'Failed to load resource: net::ERR_FAILED',
]

const tolerance = 2
const findings = []

const browser = await chromium.launch({ headless: true })

for (const viewport of viewports) {
  const page = await browser.newPage({
    viewport: {
      width: viewport.width,
      height: viewport.height,
    },
  })

  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (ignoredConsoleFragments.some((fragment) => text.includes(fragment))) return

    findings.push({
      viewport: viewport.name,
      route: page.url(),
      type: 'console',
      text: text.slice(0, 220),
    })
  })

  try {
    await page.goto(`${baseUrl}/?shellqa=${Date.now()}`, {
      waitUntil: 'networkidle',
      timeout: 35_000,
    })
    await page.waitForTimeout(400)

    const metrics = await page.evaluate(() => {
      const roundRect = (selector) => {
        const element = document.querySelector(selector)
        if (!element) return null
        const rect = element.getBoundingClientRect()
        return {
          bottom: Math.round(rect.bottom),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
        }
      }

      const bodyText = (document.body.innerText || '').replace(/\s+/g, ' ').trim()
      const footerContent = document.querySelector('[data-site-footer-content="true"]')
      const footerNav = document.querySelector('footer nav')
      const openMenuButton = document.querySelector('button[aria-label="Open menu"]')
      const rail = document.querySelector('[data-portal-rail="true"]')

      return {
        bodyText,
        documentWidth: document.documentElement.scrollWidth,
        footer: roundRect('footer'),
        footerContent: footerContent ? roundRect('[data-site-footer-content="true"]') : null,
        footerNav: footerNav ? roundRect('footer nav') : null,
        header: roundRect('header'),
        main: roundRect('#main-content'),
        openMenuButton: openMenuButton ? roundRect('button[aria-label="Open menu"]') : null,
        rail: roundRect('[data-portal-rail="true"]'),
        railScrollbarWidth: rail ? window.getComputedStyle(rail).scrollbarWidth : null,
        viewportWidth: window.innerWidth,
      }
    })

    if (!metrics.bodyText.includes('Tennis decisions')) {
      findings.push({
        viewport: viewport.name,
        type: 'missing-home-copy',
        text: metrics.bodyText.slice(0, 240),
      })
    }

    if (metrics.documentWidth > metrics.viewportWidth + 1) {
      findings.push({
        viewport: viewport.name,
        type: 'horizontal-overflow',
        documentWidth: metrics.documentWidth,
        viewportWidth: metrics.viewportWidth,
      })
    }

    if (!metrics.main || metrics.main.width < 280) {
      findings.push({
        viewport: viewport.name,
        type: 'main-content-missing',
        metrics,
      })
    }

    if (viewport.expectsRail) {
      if (!metrics.rail) {
        findings.push({
          viewport: viewport.name,
          type: 'rail-missing',
          metrics,
        })
      } else if (metrics.main && metrics.main.left < metrics.rail.right + 1) {
        findings.push({
          viewport: viewport.name,
          type: 'rail-overlaps-main',
          main: metrics.main,
          rail: metrics.rail,
        })
      }

      if (metrics.railScrollbarWidth !== 'none') {
        findings.push({
          viewport: viewport.name,
          type: 'rail-scrollbar-visible',
          railScrollbarWidth: metrics.railScrollbarWidth,
        })
      }

      if (!metrics.footerContent) {
        findings.push({
          viewport: viewport.name,
          type: 'footer-content-missing',
          metrics,
        })
      } else if (metrics.main) {
        const leftDelta = Math.abs(metrics.footerContent.left - metrics.main.left)
        const rightDelta = Math.abs(metrics.footerContent.right - metrics.main.right)

        if (leftDelta > tolerance || rightDelta > tolerance) {
          findings.push({
            viewport: viewport.name,
            type: 'footer-content-not-aligned-with-main',
            footerContent: metrics.footerContent,
            main: metrics.main,
          })
        }
      }

      if (metrics.footerNav) {
        findings.push({
          viewport: viewport.name,
          type: 'rail-footer-nav-visible',
          footerNav: metrics.footerNav,
        })
      }
    } else {
      if (metrics.rail) {
        findings.push({
          viewport: viewport.name,
          type: 'mobile-rail-visible',
          rail: metrics.rail,
        })
      }

      if (metrics.footerNav) {
        findings.push({
          viewport: viewport.name,
          type: 'mobile-footer-nav-visible',
          footerNav: metrics.footerNav,
        })
      }

      if (!metrics.openMenuButton) {
        findings.push({
          viewport: viewport.name,
          type: 'mobile-menu-button-missing',
          metrics,
        })
      } else {
        await page.locator('button[aria-label="Open menu"]').click()
        await page.waitForTimeout(200)

        const menuState = await page.evaluate(() => {
          const close = document.querySelector('button[aria-label="Close menu"]')
          const links = Array.from(document.querySelectorAll('a'))
            .map((element) => {
              const rect = element.getBoundingClientRect()
              return {
                height: Math.round(rect.height),
                text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
                top: Math.round(rect.top),
                width: Math.round(rect.width),
              }
            })
            .filter((link) => link.width >= 44 && link.height >= 44 && link.top >= 0 && link.top <= window.innerHeight)

          return {
            closeButtonVisible: Boolean(close),
            visibleLargeLinks: links.length,
          }
        })

        if (!menuState.closeButtonVisible || menuState.visibleLargeLinks < 4) {
          findings.push({
            viewport: viewport.name,
            type: 'mobile-menu-did-not-open',
            menuState,
          })
        }

        const menuSearchInput = page.locator('#site-header-compact-menu input[name="q"]')
        const menuSearchSubmit = page.locator('#site-header-compact-menu button[type="submit"]')
        const menuSearchInputCount = await menuSearchInput.count()
        const menuSearchSubmitCount = await menuSearchSubmit.count()

        if (menuSearchInputCount !== 1 || menuSearchSubmitCount !== 1) {
          findings.push({
            viewport: viewport.name,
            type: 'mobile-menu-search-missing',
            menuSearchInputCount,
            menuSearchSubmitCount,
          })
        } else {
          await menuSearchInput.click()
          await menuSearchInput.pressSequentially('teams')
          await Promise.all([
            page.waitForURL(new URL('/teams?q=teams', baseUrl).href, { timeout: 10_000 }),
            menuSearchSubmit.click(),
          ])
        }

        await page.goto(`${baseUrl}/?shellqa=${Date.now()}&portal=1`, {
          waitUntil: 'networkidle',
          timeout: 35_000,
        })
        await page.evaluate(() => window.scrollTo(0, 0))

        const competeLane = page.getByRole('button', { name: 'Compete: Matchups, scouting, lineups' })
        const competeLaneCount = await competeLane.count()

        if (competeLaneCount !== 1) {
          findings.push({
            viewport: viewport.name,
            type: 'mobile-portal-compete-lane-missing',
            competeLaneCount,
          })
        } else {
          await competeLane.click()
          await page.waitForTimeout(200)

          const matchPrepAction = page.locator('#tenaceiq-mobile-portal-actions a[href="/matchup"]')
          const matchPrepActionCount = await matchPrepAction.count()

          if (matchPrepActionCount !== 1) {
            findings.push({
              viewport: viewport.name,
              type: 'mobile-portal-match-prep-missing',
              matchPrepActionCount,
            })
          } else {
            await Promise.all([
              page.waitForURL(/\/matchup/, { timeout: 10_000 }),
              matchPrepAction.click(),
            ])
          }
        }
      }
    }
  } catch (error) {
    findings.push({
      viewport: viewport.name,
      type: 'navigation',
      text: error instanceof Error ? error.message : String(error),
    })
  } finally {
    await page.close()
  }
}

await browser.close()

if (findings.length) {
  console.error(JSON.stringify({ ok: false, baseUrl, findings }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  checkedViewports: viewports.map(({ name, width, height }) => ({ name, width, height })),
}, null, 2))
