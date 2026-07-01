const PUBLISHER_ID = 'pub-1351888380884789'
const baseUrl = cleanBaseUrl(process.env.ADSENSE_QA_BASE_URL || 'https://www.tenaceiq.com')
const sitemapBaseUrls = getSitemapBaseUrls(baseUrl)

const publicRoutes = [
  '/',
  '/explore',
  '/rankings',
  '/players',
  '/leagues',
  '/teams',
  '/matchup',
]

const trustRoutes = [
  '/about',
  '/contact',
  '/faq',
  '/how-it-works',
  '/methodology',
  '/advertising-disclosure',
  '/legal/privacy',
  '/legal/terms',
  '/legal/cookies',
]

const adFreeRoutes = [
  '/admin/access',
  '/captain',
  '/coach',
  '/login',
  '/join',
  '/mylab',
  '/tactics',
  '/upgrade?plan=coach',
]

const results = {
  baseUrl,
  publicRoutes: [],
  trustRoutes: [],
  policyFiles: {},
  adFreeRoutes: [],
}

for (const route of publicRoutes) {
  const { status, text, url } = await fetchText(route)
  assertOk(status, route)
  const hasAdMarkup = includesAdSlotMarkup(text)
  if (hasAdMarkup) {
    assertIncludes(text, 'Advertisement', `${route} ad label`)
    assertIncludes(text, 'TenAceIQ partner placement', `${route} ad placement copy`)
  }
  results.publicRoutes.push({ route, status, hasAdMarkup, finalPath: new URL(url).pathname })
}

for (const route of trustRoutes) {
  const { status, text, url } = await fetchText(route)
  assertOk(status, route)
  assertNoNoindex(text, route)
  results.trustRoutes.push({ route, status, finalPath: new URL(url).pathname })
}

const adsTxt = await fetchText('/ads.txt')
assertOk(adsTxt.status, '/ads.txt')
assertIncludes(adsTxt.text, `google.com, ${PUBLISHER_ID}, DIRECT`, '/ads.txt publisher line')
results.policyFiles.adsTxt = { status: adsTxt.status, publisherLinePresent: true }

const robots = await fetchText('/robots.txt')
assertOk(robots.status, '/robots.txt')
assertIncludes(robots.text, 'Sitemap: https://tenaceiq.com/sitemap.xml', '/robots.txt sitemap')
for (const privatePath of ['/admin', '/coach/', '/captain/', '/mylab', '/api', '/login', '/join', '/upgrade']) {
  assertIncludes(robots.text, `Disallow: ${privatePath}`, `/robots.txt ${privatePath}`)
}
results.policyFiles.robotsTxt = { status: robots.status, sitemapPresent: true }

const sitemap = await fetchText('/sitemap.xml')
assertOk(sitemap.status, '/sitemap.xml')
for (const route of [...publicRoutes, ...trustRoutes]) {
  if (!hasSitemapRoute(sitemap.text, route)) {
    stop(`/sitemap.xml is missing public route ${route}.`)
  }
}
for (const blockedRoute of ['/admin', '/coach', '/captain', '/mylab', '/login', '/join', '/upgrade']) {
  if (hasExactSitemapRoute(sitemap.text, blockedRoute)) {
    stop(`/sitemap.xml includes private or utility route ${blockedRoute}.`)
  }
}
results.policyFiles.sitemapXml = { status: sitemap.status, publicRoutesPresent: true, privateRoutesAbsent: true }

for (const route of adFreeRoutes) {
  const { status, text, url } = await fetchText(route)
  if (status >= 500) stop(`${route} returned HTTP ${status}.`)
  if (includesAdSlotMarkup(text)) stop(`${route} rendered AdSense markup on a private/auth/workspace page.`)
  results.adFreeRoutes.push({ route, status, finalPath: new URL(url).pathname, adMarkupAbsent: true })
}

console.log(JSON.stringify({ ok: true, ...results }, null, 2))

async function fetchText(route) {
  const url = new URL(route, `${baseUrl}/`)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'TenAceIQ launch readiness smoke',
      },
    })
    return {
      status: response.status,
      text: await response.text(),
      url: response.url,
    }
  } catch (error) {
    stop(`${route} fetch failed: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    clearTimeout(timer)
  }
}

function cleanBaseUrl(value) {
  return value.trim().replace(/\/+$/, '')
}

function getSitemapBaseUrls(value) {
  const values = new Set([value])
  values.add(value.replace('https://www.', 'https://'))
  values.add(value.replace('http://www.', 'http://'))
  return [...values]
}

function hasSitemapRoute(text, route) {
  return sitemapBaseUrls.some((url) => {
    const path = route === '/' ? '' : route
    return text.includes(`${url}${path}`) || (route === '/' && text.includes(`${url}/`))
  })
}

function hasExactSitemapRoute(text, route) {
  return sitemapBaseUrls.some((url) => {
    const escaped = escapeRegExp(`${url}${route}`)
    return new RegExp(`<loc>${escaped}/?</loc>`).test(text)
  })
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function assertOk(status, route) {
  if (status < 200 || status >= 300) {
    stop(`${route} returned HTTP ${status}.`)
  }
}

function assertNoNoindex(text, route) {
  if (/noindex/i.test(text)) {
    stop(`${route} contains noindex.`)
  }
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    stop(`${label} is missing expected content: ${expected}`)
  }
}

function includesAdSlotMarkup(text) {
  return text.includes('data-ad-slot=') || text.includes('TenAceIQ partner placement')
}

function stop(message) {
  console.error(message)
  process.exit(1)
}
