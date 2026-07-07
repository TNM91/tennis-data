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
  '/_vercel/insights/script.js',
  '/_vercel/speed-insights/script.js',
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
    const location = message.location()
    const locationUrl = location?.url ?? ''
    const combined = `${text} ${locationUrl}`
    if (ignoredConsoleFragments.some((fragment) => combined.includes(fragment))) return

    findings.push({
      viewport: viewport.name,
      route: page.url(),
      type: 'console',
      source: locationUrl,
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
      const mobilePortalPalette = document.querySelector('[data-mobile-portal-palette]')
      const portalContentScroll = document.querySelector('[data-portal-content-scroll="true"]')
      const rail = document.querySelector('[data-portal-rail="true"]')

      return {
        bodyText,
        documentWidth: document.documentElement.scrollWidth,
        footer: roundRect('footer'),
        footerContent: footerContent ? roundRect('[data-site-footer-content="true"]') : null,
        footerNav: footerNav ? roundRect('footer nav') : null,
        header: roundRect('header'),
        main: roundRect('#main-content'),
        mobilePortalPalette: mobilePortalPalette ? roundRect('[data-mobile-portal-palette]') : null,
        openMenuButton: openMenuButton ? roundRect('button[aria-label="Open menu"]') : null,
        portalContentScroll: portalContentScroll ? roundRect('[data-portal-content-scroll="true"]') : null,
        portalContentScrollHeight: portalContentScroll ? portalContentScroll.scrollHeight : null,
        portalContentScrollTop: portalContentScroll ? portalContentScroll.scrollTop : null,
        rail: roundRect('[data-portal-rail="true"]'),
        railScrollbarWidth: rail ? window.getComputedStyle(rail).scrollbarWidth : null,
        viewportHeight: window.innerHeight,
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

    const homeHeroHeightLimit = viewport.name === 'mobile' ? 850 : viewport.name === 'tablet' ? 900 : 520
    if (!metrics.main || !metrics.footer || metrics.footer.top <= metrics.main.top) {
      findings.push({
        viewport: viewport.name,
        type: 'home-shell-content-missing',
        metrics,
      })
    } else if (metrics.footer.top - metrics.main.top < 100) {
      findings.push({
        viewport: viewport.name,
        type: 'home-shell-content-too-short',
        metrics,
      })
    }

    const firstHomeSection = await page.locator('#main-content main > section').first().boundingBox()
    if (!firstHomeSection || firstHomeSection.height > homeHeroHeightLimit) {
      findings.push({
        viewport: viewport.name,
        type: 'home-hero-too-tall',
        homeHeroHeightLimit,
        firstHomeSection,
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
      } else if (metrics.rail.bottom < metrics.viewportHeight - 12) {
        findings.push({
          viewport: viewport.name,
          type: 'rail-does-not-fill-viewport',
          rail: metrics.rail,
          viewportHeight: metrics.viewportHeight,
        })
      }

      if (metrics.railScrollbarWidth !== 'none') {
        findings.push({
          viewport: viewport.name,
          type: 'rail-scrollbar-visible',
          railScrollbarWidth: metrics.railScrollbarWidth,
        })
      }

      if (!metrics.portalContentScroll) {
        findings.push({
          viewport: viewport.name,
          type: 'portal-content-scroll-missing',
          metrics,
        })
      } else if (metrics.header && metrics.portalContentScroll.height < metrics.viewportHeight - metrics.header.height - 40) {
        findings.push({
          viewport: viewport.name,
          type: 'portal-content-scroll-too-short',
          metrics,
        })
      } else {
        const scrollState = await page.evaluate(async () => {
          const scroller = document.querySelector('[data-portal-content-scroll="true"]')
          const header = document.querySelector('header')
          const rail = document.querySelector('[data-portal-rail="true"]')
          if (!(scroller instanceof HTMLElement) || !header || !rail) return null

          const before = {
            headerTop: Math.round(header.getBoundingClientRect().top),
            railTop: Math.round(rail.getBoundingClientRect().top),
            windowY: Math.round(window.scrollY),
          }

          scroller.style.scrollBehavior = 'auto'
          scroller.scrollTop = 420
          await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)))

          return {
            before,
            after: {
              headerTop: Math.round(header.getBoundingClientRect().top),
              railTop: Math.round(rail.getBoundingClientRect().top),
              scrollerTop: Math.round(scroller.scrollTop),
              windowY: Math.round(window.scrollY),
            },
          }
        })

        if (!scrollState || scrollState.after.scrollerTop < 120) {
          findings.push({
            viewport: viewport.name,
            type: 'portal-content-did-not-scroll',
            scrollState,
            metrics,
          })
        } else if (scrollState.after.windowY !== scrollState.before.windowY) {
          findings.push({
            viewport: viewport.name,
            type: 'portal-window-scrolled-with-content',
            scrollState,
          })
        } else if (Math.abs(scrollState.after.headerTop - scrollState.before.headerTop) > tolerance) {
          findings.push({
            viewport: viewport.name,
            type: 'portal-header-moved-during-content-scroll',
            scrollState,
          })
        } else if (Math.abs(scrollState.after.railTop - scrollState.before.railTop) > tolerance) {
          findings.push({
            viewport: viewport.name,
            type: 'portal-rail-moved-during-content-scroll',
            scrollState,
          })
        }
      }

      if (!metrics.openMenuButton) {
        findings.push({
          viewport: viewport.name,
          type: 'rail-header-menu-button-missing',
          metrics,
        })
      } else if (metrics.openMenuButton.width < 72) {
        findings.push({
          viewport: viewport.name,
          type: 'rail-header-menu-button-too-small',
          openMenuButton: metrics.openMenuButton,
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

      if (metrics.footer && metrics.footer.height > 176) {
        findings.push({
          viewport: viewport.name,
          type: 'rail-footer-too-tall',
          footer: metrics.footer,
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

      if (!metrics.mobilePortalPalette) {
        findings.push({
          viewport: viewport.name,
          type: 'mobile-portal-lane-palette-missing',
          metrics,
        })
      } else if (metrics.mobilePortalPalette.height > 58) {
        findings.push({
          viewport: viewport.name,
          type: 'mobile-portal-too-tall',
          mobilePortalPalette: metrics.mobilePortalPalette,
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
          const portalPalette = document.querySelector('[data-mobile-portal-palette]')
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
            portalPaletteVisible: Boolean(portalPalette),
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

        if (menuState.portalPaletteVisible) {
          findings.push({
            viewport: viewport.name,
            type: 'mobile-portal-visible-under-header-menu',
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

        const portalPalette = page.locator('[data-mobile-portal-palette="lanes"]')
        const portalPaletteCount = await portalPalette.count()

        if (portalPaletteCount !== 1) {
          findings.push({
            viewport: viewport.name,
            type: 'mobile-portal-lane-palette-missing',
            portalPaletteCount,
          })
        }

        const competeLane = page.locator('[data-mobile-portal-lane="compete"]')
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

          const actionPalette = page.locator('[data-mobile-portal-palette="actions"]')
          const actionPaletteCount = await actionPalette.count()
          const mainAction = page.locator('[data-mobile-portal-action="main"]')
          const mainActionCount = await mainAction.count()
          const matchPrepAction = page.locator('[data-mobile-portal-action="match-prep"]')
          const matchPrepActionCount = await matchPrepAction.count()

          if (actionPaletteCount !== 1 || mainActionCount !== 1 || matchPrepActionCount !== 1) {
            findings.push({
              viewport: viewport.name,
              type: 'mobile-portal-match-prep-missing',
              actionPaletteCount,
              mainActionCount,
              matchPrepActionCount,
            })
          } else {
            await mainAction.click()
            await page.waitForTimeout(200)

            const restoredLanePaletteCount = await page.locator('[data-mobile-portal-palette="lanes"]').count()
            if (restoredLanePaletteCount !== 1) {
              findings.push({
                viewport: viewport.name,
                type: 'mobile-portal-main-did-not-restore-lanes',
                restoredLanePaletteCount,
              })
            }

            await competeLane.click()
            await page.waitForTimeout(200)

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

const captainMobilePage = await browser.newPage({
  viewport: {
    width: 390,
    height: 844,
  },
})

captainMobilePage.on('console', (message) => {
  if (message.type() !== 'error') return
  const text = message.text()
  const location = message.location()
  const locationUrl = location?.url ?? ''
  const combined = `${text} ${locationUrl}`
  if (ignoredConsoleFragments.some((fragment) => combined.includes(fragment))) return

  findings.push({
    viewport: 'mobile',
    route: captainMobilePage.url(),
    type: 'console',
    source: locationUrl,
    text: text.slice(0, 220),
  })
})

try {
  await captainMobilePage.goto(`${baseUrl}/captain?shellqa=${Date.now()}`, {
    waitUntil: 'networkidle',
    timeout: 35_000,
  })
  await captainMobilePage.waitForTimeout(400)

  const captainMetrics = await captainMobilePage.evaluate(() => {
    const quickActions = document.querySelector('[aria-label="Captain mobile unlock actions"]')
    const bodyText = document.body.textContent || ''
    const summaryUpgradeHeading = Array.from(document.querySelectorAll('h3')).find((element) =>
      (element.textContent || '').includes('Still building'),
    )
    const summaryUpgradeCard = summaryUpgradeHeading?.closest('section')
    const summaryUpgradeCardRect = summaryUpgradeCard?.getBoundingClientRect()
    const links = Array.from(quickActions?.querySelectorAll('a') || []).map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
        href: element.getAttribute('href'),
        text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
        top: Math.round(rect.top),
        visible: rect.bottom > 0 && rect.top < window.innerHeight,
        width: Math.round(rect.width),
      }
    })

    return {
      documentWidth: document.documentElement.scrollWidth,
      repeatedUnlockGuidance: [
        'Creating an account starts Free access',
        'Best next unlock',
        'Claim the team week',
      ].filter((text) => bodyText.includes(text)),
      links,
      quickActionsVisible: Boolean(quickActions),
      railVisible: Boolean(document.querySelector('[data-portal-rail="true"]')),
      summaryUpgradeCardTop: summaryUpgradeCardRect ? Math.round(summaryUpgradeCardRect.top) : null,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    }
  })

  if (captainMetrics.documentWidth > captainMetrics.viewportWidth + 1) {
    findings.push({
      viewport: 'mobile',
      type: 'captain-mobile-horizontal-overflow',
      documentWidth: captainMetrics.documentWidth,
      viewportWidth: captainMetrics.viewportWidth,
    })
  }

  if (captainMetrics.railVisible) {
    findings.push({
      viewport: 'mobile',
      type: 'captain-mobile-rail-visible',
    })
  }

  if (captainMetrics.repeatedUnlockGuidance.length) {
    findings.push({
      viewport: 'mobile',
      type: 'captain-mobile-summary-repeated-guidance',
      repeatedUnlockGuidance: captainMetrics.repeatedUnlockGuidance,
    })
  }

  if (
    typeof captainMetrics.summaryUpgradeCardTop !== 'number' ||
    captainMetrics.summaryUpgradeCardTop > captainMetrics.viewportHeight
  ) {
    findings.push({
      viewport: 'mobile',
      type: 'captain-mobile-summary-card-not-in-first-view',
      captainMetrics,
    })
  }

  if (!captainMetrics.quickActionsVisible) {
    findings.push({
      viewport: 'mobile',
      type: 'captain-mobile-unlock-actions-missing',
      captainMetrics,
    })
  } else {
    const unlockAction = captainMetrics.links.find((link) => link.href === '/upgrade?plan=captain&next=%2Fcaptain')
    const secondaryAction = captainMetrics.links.find((link) => link.href === '/pricing' || link.href === '/mylab')

    if (!unlockAction || !unlockAction.visible || unlockAction.height < 42 || unlockAction.top > captainMetrics.viewportHeight * 0.58) {
      findings.push({
        viewport: 'mobile',
        type: 'captain-mobile-unlock-action-not-prominent',
        captainMetrics,
      })
    }

    if (!secondaryAction || !secondaryAction.visible || secondaryAction.height < 42) {
      findings.push({
        viewport: 'mobile',
        type: 'captain-mobile-secondary-action-not-prominent',
        captainMetrics,
      })
    }
  }

  const captainUnlockAction = captainMobilePage.locator(
    '[aria-label="Captain mobile unlock actions"] a[href="/upgrade?plan=captain&next=%2Fcaptain"]',
  )
  const captainUnlockActionCount = await captainUnlockAction.count()

  if (captainUnlockActionCount !== 1) {
    findings.push({
      viewport: 'mobile',
      type: 'captain-mobile-unlock-action-route-missing',
      captainUnlockActionCount,
    })
  } else {
    await Promise.all([
      captainMobilePage.waitForURL(/\/upgrade\?plan=captain&next=%2Fcaptain/, { timeout: 10_000 }),
      captainUnlockAction.click(),
    ])
  }
} catch (error) {
  findings.push({
    viewport: 'mobile',
    type: 'captain-mobile-unlock-actions-navigation',
    text: error instanceof Error ? error.message : String(error),
  })
} finally {
  await captainMobilePage.close()
}

const leagueMobilePage = await browser.newPage({
  viewport: {
    width: 390,
    height: 844,
  },
})

leagueMobilePage.on('console', (message) => {
  if (message.type() !== 'error') return
  const text = message.text()
  const location = message.location()
  const locationUrl = location?.url ?? ''
  const combined = `${text} ${locationUrl}`
  if (ignoredConsoleFragments.some((fragment) => combined.includes(fragment))) return

  findings.push({
    viewport: 'mobile',
    route: leagueMobilePage.url(),
    type: 'console',
    source: locationUrl,
    text: text.slice(0, 220),
  })
})

try {
  await leagueMobilePage.goto(`${baseUrl}/league-coordinator?shellqa=${Date.now()}`, {
    waitUntil: 'networkidle',
    timeout: 35_000,
  })
  await leagueMobilePage.waitForTimeout(400)

  const leagueMetrics = await leagueMobilePage.evaluate(() => {
    const bodyText = document.body.textContent || ''
    const promptHeadlines = [
      'Ready to run organized competition without spreadsheets?',
      'Need this draft to become active League Office tools?',
      'Ready to run the season without spreadsheet cleanup?',
    ]
    const promptCards = Array.from(document.querySelectorAll('h3'))
      .filter((element) => promptHeadlines.includes((element.textContent || '').trim()))
      .map((element) => {
        const rect = element.closest('section')?.getBoundingClientRect()
        return {
          height: rect ? Math.round(rect.height) : 0,
          text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
          top: rect ? Math.round(rect.top) : null,
        }
      })

    return {
      documentWidth: document.documentElement.scrollWidth,
      promptCards,
      railVisible: Boolean(document.querySelector('[data-portal-rail="true"]')),
      repeatedUnlockGuidance: [
        'Creating an account starts Free access',
        'Best next unlock',
        'Structure the season',
        'Track participation',
        'Reduce cleanup',
      ].filter((text) => bodyText.includes(text)),
      viewportWidth: window.innerWidth,
    }
  })

  if (leagueMetrics.documentWidth > leagueMetrics.viewportWidth + 1) {
    findings.push({
      viewport: 'mobile',
      type: 'league-mobile-horizontal-overflow',
      documentWidth: leagueMetrics.documentWidth,
      viewportWidth: leagueMetrics.viewportWidth,
    })
  }

  if (leagueMetrics.railVisible) {
    findings.push({
      viewport: 'mobile',
      type: 'league-mobile-rail-visible',
    })
  }

  if (leagueMetrics.repeatedUnlockGuidance.length) {
    findings.push({
      viewport: 'mobile',
      type: 'league-mobile-summary-repeated-guidance',
      repeatedUnlockGuidance: leagueMetrics.repeatedUnlockGuidance,
    })
  }

  const oversizedPromptCards = leagueMetrics.promptCards.filter((card) => card.height > 700)
  if (leagueMetrics.promptCards.length === 0 || oversizedPromptCards.length) {
    findings.push({
      viewport: 'mobile',
      type: 'league-mobile-summary-prompt-too-tall',
      leagueMetrics,
      oversizedPromptCards,
    })
  }
} catch (error) {
  findings.push({
    viewport: 'mobile',
    type: 'league-mobile-summary-smoke',
    text: error instanceof Error ? error.message : String(error),
  })
} finally {
  await leagueMobilePage.close()
}

for (const viewport of viewports) {
  const upgradePage = await browser.newPage({
    viewport: {
      width: viewport.width,
      height: viewport.height,
    },
  })

  upgradePage.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    const location = message.location()
    const locationUrl = location?.url ?? ''
    const combined = `${text} ${locationUrl}`
    if (ignoredConsoleFragments.some((fragment) => combined.includes(fragment))) return

    findings.push({
      viewport: viewport.name,
      route: upgradePage.url(),
      type: 'console',
      source: locationUrl,
      text: text.slice(0, 220),
    })
  })

  try {
    await upgradePage.goto(`${baseUrl}/upgrade?plan=captain&next=%2Fcaptain&shellqa=${Date.now()}`, {
      waitUntil: 'networkidle',
      timeout: 35_000,
    })
    await upgradePage.waitForTimeout(400)

    const upgradeMetrics = await upgradePage.evaluate(() => {
      const roundRect = (selector) => {
        const element = document.querySelector(selector)
        if (!element) return null
        const rect = element.getBoundingClientRect()
        return {
          bottom: Math.round(rect.bottom),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
        }
      }

      return {
        documentWidth: document.documentElement.scrollWidth,
        hero: roundRect('#main-content main > section'),
        planCard: roundRect('#main-content main > section aside'),
        railVisible: Boolean(document.querySelector('[data-portal-rail="true"]')),
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      }
    })

    if (upgradeMetrics.documentWidth > upgradeMetrics.viewportWidth + 1) {
      findings.push({
        viewport: viewport.name,
        type: 'upgrade-horizontal-overflow',
        documentWidth: upgradeMetrics.documentWidth,
        viewportWidth: upgradeMetrics.viewportWidth,
      })
    }

    const heroHeightLimit = viewport.name === 'mobile' ? 1250 : viewport.name === 'tablet' ? 980 : 820
    if (!upgradeMetrics.hero || upgradeMetrics.hero.height > heroHeightLimit) {
      findings.push({
        viewport: viewport.name,
        type: 'upgrade-hero-too-tall',
        heroHeightLimit,
        upgradeMetrics,
      })
    }

    if (!upgradeMetrics.planCard || upgradeMetrics.planCard.height > heroHeightLimit - 70) {
      findings.push({
        viewport: viewport.name,
        type: 'upgrade-plan-card-too-tall',
        heroHeightLimit,
        upgradeMetrics,
      })
    }

    if (viewport.expectsRail && !upgradeMetrics.railVisible) {
      findings.push({
        viewport: viewport.name,
        type: 'upgrade-rail-missing',
        upgradeMetrics,
      })
    }

    if (!viewport.expectsRail && upgradeMetrics.railVisible) {
      findings.push({
        viewport: viewport.name,
        type: 'upgrade-mobile-rail-visible',
        upgradeMetrics,
      })
    }
  } catch (error) {
    findings.push({
      viewport: viewport.name,
      type: 'upgrade-density-smoke',
      text: error instanceof Error ? error.message : String(error),
    })
  } finally {
    await upgradePage.close()
  }
}

const publicDirectoryPages = [
  {
    route: '/teams',
    label: 'teams',
    expectedCopy: 'Team tennis without the group-text chaos.',
  },
  {
    route: '/leagues',
    label: 'leagues',
    expectedCopy: 'Run the season without the spreadsheet chaos.',
  },
]

for (const viewport of viewports) {
  for (const publicPage of publicDirectoryPages) {
    const directoryPage = await browser.newPage({
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
    })

    directoryPage.on('console', (message) => {
      if (message.type() !== 'error') return
      const text = message.text()
      const location = message.location()
      const locationUrl = location?.url ?? ''
      const combined = `${text} ${locationUrl}`
      if (ignoredConsoleFragments.some((fragment) => combined.includes(fragment))) return

      findings.push({
        viewport: viewport.name,
        route: directoryPage.url(),
        type: 'console',
        source: locationUrl,
        text: text.slice(0, 220),
      })
    })

    try {
      await directoryPage.goto(`${baseUrl}${publicPage.route}?shellqa=${Date.now()}`, {
        waitUntil: 'domcontentloaded',
        timeout: 35_000,
      })
      await directoryPage.waitForTimeout(800)

      const directoryMetrics = await directoryPage.evaluate(() => {
        const roundRect = (selector) => {
          const element = document.querySelector(selector)
          if (!element) return null
          const rect = element.getBoundingClientRect()
          return {
            bottom: Math.round(rect.bottom),
            height: Math.round(rect.height),
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
          }
        }

        return {
          bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').trim(),
          documentWidth: document.documentElement.scrollWidth,
          hero: roundRect('#main-content main > section, #main-content > section'),
          introCards: Array.from(document.querySelectorAll('#main-content main > section:first-of-type article > div:last-child > div, #main-content > section:first-of-type article > div:last-child > div')).map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              height: Math.round(rect.height),
              width: Math.round(rect.width),
            }
          }),
          railVisible: Boolean(document.querySelector('[data-portal-rail="true"]')),
          viewportWidth: window.innerWidth,
        }
      })

      if (!directoryMetrics.bodyText.includes(publicPage.expectedCopy)) {
        findings.push({
          viewport: viewport.name,
          route: publicPage.route,
          type: `${publicPage.label}-intro-copy-missing`,
          text: directoryMetrics.bodyText.slice(0, 240),
        })
      }

      if (directoryMetrics.documentWidth > directoryMetrics.viewportWidth + 1) {
        findings.push({
          viewport: viewport.name,
          route: publicPage.route,
          type: `${publicPage.label}-horizontal-overflow`,
          documentWidth: directoryMetrics.documentWidth,
          viewportWidth: directoryMetrics.viewportWidth,
        })
      }

      const directoryHeroHeightLimit = viewport.name === 'mobile' ? 760 : viewport.name === 'tablet' ? 640 : 640
      if (!directoryMetrics.hero || directoryMetrics.hero.height > directoryHeroHeightLimit) {
        findings.push({
          viewport: viewport.name,
          route: publicPage.route,
          type: `${publicPage.label}-intro-too-tall`,
          directoryHeroHeightLimit,
          directoryMetrics,
        })
      }

      if (viewport.expectsRail && !directoryMetrics.railVisible) {
        findings.push({
          viewport: viewport.name,
          route: publicPage.route,
          type: `${publicPage.label}-rail-missing`,
          directoryMetrics,
        })
      }

      if (!viewport.expectsRail && directoryMetrics.railVisible) {
        findings.push({
          viewport: viewport.name,
          route: publicPage.route,
          type: `${publicPage.label}-mobile-rail-visible`,
          directoryMetrics,
        })
      }

      if (viewport.name === 'mobile' && directoryMetrics.introCards.length !== 4) {
        findings.push({
          viewport: viewport.name,
          route: publicPage.route,
          type: `${publicPage.label}-intro-cards-missing`,
          directoryMetrics,
        })
      }
    } catch (error) {
      findings.push({
        viewport: viewport.name,
        route: publicPage.route,
        type: `${publicPage.label}-density-smoke`,
        text: error instanceof Error ? error.message : String(error),
      })
    } finally {
      await directoryPage.close()
    }
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
