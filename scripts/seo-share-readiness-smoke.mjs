import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const args = new Set(process.argv.slice(2))
const includeLive = args.has('--live')
const baseUrl = cleanBaseUrl(process.env.SEO_SHARE_QA_BASE_URL || 'https://www.tenaceiq.com')
const canonicalBaseUrl = 'https://tenaceiq.com'
const previewImagePath = '/tenaceiq/logos/tenaceiq-social-preview.png'
const previewImageFile = join(process.cwd(), 'public', 'tenaceiq', 'logos', 'tenaceiq-social-preview.png')
const maxPreviewBytes = 5 * 1024 * 1024

const publicRoutes = [
  '/',
  '/pricing',
  '/explore',
  '/players',
  '/leagues',
  '/teams',
  '/rankings',
  '/matchup',
  '/player-development',
  '/compete',
  '/manage',
  '/coaches',
  '/tournaments',
  '/resources',
  '/about',
  '/faq',
  '/contact',
]

const liveRoutes = [
  '/',
  '/pricing',
  '/explore',
  '/players',
  '/leagues',
  '/teams',
  '/matchup',
]

const privateRoutes = [
  '/admin',
  '/captain',
  '/coach',
  '/league-coordinator',
  '/messages',
  '/mylab',
  '/profile',
  '/preview-home',
  '/tactics',
  '/api',
  '/login',
  '/join',
  '/level-up/my-quest',
  '/forget-password',
  '/reset-password',
  '/upgrade',
]

const local = runLocalChecks()
const live = includeLive ? await runLiveChecks() : null

console.log(JSON.stringify({
  ok: true,
  mode: {
    live: includeLive,
  },
  baseUrl: includeLive ? baseUrl : undefined,
  canonicalBaseUrl,
  local,
  live,
}, null, 2))

function runLocalChecks() {
  const layoutSource = read('app/layout.tsx')
  const homeSource = read('app/page.tsx')
  const routeMetadataSource = read('lib/route-metadata.ts')
  const sitemapSource = read('app/sitemap.ts')
  const robotsSource = read('app/robots.ts')
  const manifestSource = read('app/manifest.ts')
  const structuredDataSource = read('lib/structured-data.ts')

  assertIncludes(layoutSource, "metadataBase: new URL('https://tenaceiq.com')", 'root metadataBase')
  assertIncludes(layoutSource, previewImagePath, 'root social preview image')
  assertIncludes(layoutSource, 'openGraph', 'root Open Graph metadata')
  assertIncludes(layoutSource, 'twitter', 'root Twitter metadata')
  assertIncludes(layoutSource, "manifest: '/manifest.webmanifest'", 'root manifest link')
  assertIncludes(layoutSource, 'buildOrganizationJsonLd', 'root organization JSON-LD')
  assertIncludes(layoutSource, 'buildWebSiteJsonLd', 'root website JSON-LD')
  assertIncludes(layoutSource, "'google-adsense-account'", 'root AdSense account metadata')

  assertIncludes(homeSource, 'openGraph', 'homepage Open Graph metadata')
  assertIncludes(homeSource, 'twitter', 'homepage Twitter metadata')
  assertIncludes(homeSource, previewImagePath, 'homepage social preview image')

  assertIncludes(routeMetadataSource, `DEFAULT_IMAGE = '${previewImagePath}'`, 'shared route social preview')
  assertIncludes(routeMetadataSource, 'alternates', 'shared route canonical metadata')
  assertIncludes(routeMetadataSource, 'openGraph', 'shared route Open Graph metadata')
  assertIncludes(routeMetadataSource, 'twitter', 'shared route Twitter metadata')

  assertIncludes(structuredDataSource, "'@type': 'Organization'", 'organization structured data')
  assertIncludes(structuredDataSource, "'@type': 'WebSite'", 'website structured data')
  assertIncludes(structuredDataSource, 'SearchAction', 'website search structured data')

  assertIncludes(manifestSource, "name: 'TenAceIQ'", 'manifest app name')
  assertIncludes(manifestSource, 'PRODUCT_MOTTO', 'manifest product story language')
  assertIncludes(manifestSource, "'/tenaceiq-icon-512.png'", 'manifest 512 icon')
  assertIncludes(manifestSource, "'/tenaceiq/logos/tenaceiq-brand-preview.png'", 'manifest screenshot')

  for (const route of publicRoutes) {
    if (route === '/') continue
    assertIncludes(sitemapSource, `path: '${route}'`, `sitemap public route ${route}`)
  }

  for (const route of privateRoutes) {
    assertIncludes(robotsSource, `'${route}`, `robots private route ${route}`)
    if (sitemapSource.includes(`path: '${route}'`)) {
      stop(`sitemap includes private route ${route}.`)
    }
  }

  assertIncludes(robotsSource, `sitemap: '${canonicalBaseUrl}/sitemap.xml'`, 'robots sitemap URL')
  assertIncludes(robotsSource, `host: '${canonicalBaseUrl}'`, 'robots host URL')

  if (!existsSync(previewImageFile)) {
    stop(`${previewImageFile} is missing.`)
  }

  const previewImage = statSync(previewImageFile)
  if (previewImage.size <= 0) {
    stop(`${previewImageFile} is empty.`)
  }
  if (previewImage.size > maxPreviewBytes) {
    stop(`${previewImageFile} is ${previewImage.size} bytes, above the ${maxPreviewBytes} byte launch cap.`)
  }

  return {
    publicRoutes: publicRoutes.length,
    privateRoutes: privateRoutes.length,
    previewImage: {
      path: previewImagePath,
      bytes: previewImage.size,
      maxBytes: maxPreviewBytes,
    },
  }
}

async function runLiveChecks() {
  const routeResults = []

  for (const route of liveRoutes) {
    const { status, text, url } = await fetchText(route)
    assertOk(status, route)
    assertMetaTags(text, route)
    assertNoNoindex(text, route)
    routeResults.push({ route, status, finalPath: new URL(url).pathname })
  }

  const robots = await fetchText('/robots.txt')
  assertOk(robots.status, '/robots.txt')
  assertIncludes(robots.text, `Sitemap: ${canonicalBaseUrl}/sitemap.xml`, '/robots.txt sitemap')
  for (const route of privateRoutes) {
    assertIncludes(robots.text, `Disallow: ${route}`, `/robots.txt ${route}`)
  }

  const sitemap = await fetchText('/sitemap.xml')
  assertOk(sitemap.status, '/sitemap.xml')
  for (const route of liveRoutes) {
    if (!hasSitemapRoute(sitemap.text, route)) {
      stop(`/sitemap.xml is missing public route ${route}.`)
    }
  }
  for (const route of privateRoutes) {
    if (hasExactSitemapRoute(sitemap.text, route)) {
      stop(`/sitemap.xml includes private route ${route}.`)
    }
  }

  const preview = await fetchBinary(previewImagePath)
  assertOk(preview.status, previewImagePath)
  if (!preview.contentType.toLowerCase().includes('image/png')) {
    stop(`${previewImagePath} returned content-type ${preview.contentType || 'unknown'} instead of image/png.`)
  }
  if (preview.bytes <= 0) {
    stop(`${previewImagePath} returned an empty body.`)
  }
  if (preview.bytes > maxPreviewBytes) {
    stop(`${previewImagePath} returned ${preview.bytes} bytes, above the ${maxPreviewBytes} byte launch cap.`)
  }

  return {
    routes: routeResults,
    policyFiles: {
      robotsTxt: { status: robots.status },
      sitemapXml: { status: sitemap.status },
      previewImage: {
        status: preview.status,
        contentType: preview.contentType,
        bytes: preview.bytes,
        maxBytes: maxPreviewBytes,
      },
    },
  }
}

async function fetchText(route) {
  const response = await fetchWithTimeout(route)
  return {
    status: response.status,
    text: await response.text(),
    url: response.url,
  }
}

async function fetchBinary(route) {
  const response = await fetchWithTimeout(route)
  const buffer = Buffer.from(await response.arrayBuffer())
  return {
    status: response.status,
    bytes: buffer.byteLength,
    contentType: response.headers.get('content-type') || '',
    url: response.url,
  }
}

async function fetchWithTimeout(route) {
  const url = new URL(route, `${baseUrl}/`)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)

  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'TenAceIQ SEO share readiness smoke',
      },
    })
  } catch (error) {
    stop(`${route} fetch failed: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    clearTimeout(timer)
  }
}

function assertMetaTags(text, route) {
  for (const pattern of [
    /<link[^>]+rel=["']canonical["'][^>]*>/i,
    /<meta[^>]+property=["']og:title["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]*>/i,
    /<meta[^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:card["'][^>]*>/i,
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>/i,
  ]) {
    if (!pattern.test(text)) {
      stop(`${route} is missing expected SEO/share markup: ${pattern}`)
    }
  }

  if (route === '/') {
    assertIncludes(text, 'google-adsense-account', 'homepage AdSense publisher metadata')
  }
}

function hasSitemapRoute(text, route) {
  return getSitemapBaseUrls().some((url) => {
    const path = route === '/' ? '' : route
    return text.includes(`${url}${path}`) || (route === '/' && text.includes(`${url}/`))
  })
}

function hasExactSitemapRoute(text, route) {
  return getSitemapBaseUrls().some((url) => {
    const escaped = escapeRegExp(`${url}${route}`)
    return new RegExp(`<loc>${escaped}/?</loc>`).test(text)
  })
}

function getSitemapBaseUrls() {
  const values = new Set([baseUrl, canonicalBaseUrl])
  values.add(baseUrl.replace('https://www.', 'https://'))
  values.add(baseUrl.replace('http://www.', 'http://'))
  return [...values]
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

function read(path) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

function cleanBaseUrl(value) {
  return value.trim().replace(/\/+$/, '')
}

function stop(message) {
  console.error(message)
  process.exit(1)
}
