import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const origin = process.env.BRAND_QA_URL || 'http://localhost:3107'
const output = '.codex-audit/brand-20261024'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
try {
  const page = await browser.newPage()
  for (const [url, original] of [
    ['/favicon.ico', 'TenAceIQ_favicon.ico'],
    ['/apple-icon.png', 'TiQ_Icon_180.png'],
    ['/apple-touch-icon.png', 'TiQ_Icon_180.png'],
    ['/brand/icons/pwa-192.png', 'TiQ_Icon_192.png'],
    ['/brand/icons/pwa-512.png', 'TiQ_Icon_512.png'],
    ['/brand/web/header-logo-transparent.png', 'TenAceIQ_Light_Transparent.png'],
    ['/brand/web/header-logo-light-bg.png', 'TenAceIQ_Dark_Transparent.png'],
  ]) {
    const response = await page.request.get(origin + url)
    assert.equal(response.status(), 200, url)
    assert.deepEqual(await response.body(), await readFile(`public/brand/approved/${original}`), url)
    results.push({ asset: url, status: 'original bytes served' })
  }
  const manifest = await (await page.request.get(origin + '/manifest.webmanifest')).json()
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512'])
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    for (const route of ['/', '/login', '/join', '/forget-password', '/reset-password']) {
      await page.goto(origin + route, { waitUntil: 'domcontentloaded' })
      const logo = page.locator('.site-header-brand-picture img')
      await logo.waitFor({ state: 'visible' })
      await logo.evaluate(image => image.decode())
      const state = await logo.evaluate(image => {
        const r = image.getBoundingClientRect()
        const style = getComputedStyle(image)
        return { complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, src: image.currentSrc, fit: style.objectFit, filter: style.filter, radius: style.borderRadius, x: r.x, width: r.width, viewport: innerWidth }
      })
      assert.ok(state.complete && state.naturalWidth > 0)
      assert.ok(state.src.includes('20261024-approved-v1'), 'header must bypass the historical optimized image cache')
      // Responsive natural dimensions are density-corrected and rounded by Chromium.
      assert.ok(Math.abs(state.naturalWidth / state.naturalHeight - 2109 / 461) < 0.2, 'loaded header must have the approved artwork proportions')
      assert.equal(state.fit, 'contain')
      assert.equal(state.filter, 'none')
      assert.equal(state.radius, '0px')
      assert.ok(state.x >= 0 && state.x + state.width <= state.viewport)
      const icons = await page.locator('link[rel="icon"]').evaluateAll(links => links.map(link => link.getAttribute('href')))
      assert.ok(icons.some(href => href.includes('/favicon.ico')))
      await page.screenshot({ path: `${output}/${viewport.width}-${route.replaceAll('/', '') || 'home'}.png` })
      results.push({ route, viewport: viewport.width, header: state, icons })
    }
  }
  await page.setViewportSize({ width: 900, height: 600 })
  await page.setContent(`<main style="display:grid;gap:24px;padding:24px">
    <div style="background:#06172f;padding:32px"><img alt="Light wordmark on navy" src="${origin}/brand/approved/TenAceIQ_Light_Transparent.png" style="width:600px;height:auto;object-fit:contain"></div>
    <div style="background:#fff;padding:32px"><img alt="Dark wordmark on white" src="${origin}/brand/approved/TenAceIQ_Dark_Transparent.png" style="width:600px;height:auto;object-fit:contain"></div>
  </main>`)
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())))
  await page.screenshot({ path: `${output}/wordmarks-dark-and-light.png` })
} finally {
  await browser.close()
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2))
}
console.log(`Brand checks passed (${results.length}); evidence: ${output}`)
