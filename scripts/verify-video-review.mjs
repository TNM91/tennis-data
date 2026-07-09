import { chromium } from 'playwright'

const baseUrl = cleanBaseUrl(process.env.VIDEO_REVIEW_BASE_URL || 'http://127.0.0.1:3000')
const route = '/video-review'
const viewports = [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]
const expectedText = [
  'Capture the stroke. Mark the moment.',
  'Player capture',
  'Coach review',
  'Keep the clip queue light.',
  'Video library',
  'Coach tools',
  'Export review file',
  'Import review file',
]
const ignoredConsoleFragments = [
  '/_next/webpack-hmr',
  '/_vercel/insights/script.js',
  '/_vercel/speed-insights/script.js',
  'Failed to load resource: net::ERR_FAILED',
]
const findings = []
const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
  ],
})

for (const viewport of viewports) {
  const context = await browser.newContext({
    permissions: ['camera'],
    viewport: {
      width: viewport.width,
      height: viewport.height,
    },
  })
  const page = await context.newPage()

  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (ignoredConsoleFragments.some((fragment) => text.includes(fragment))) return
    findings.push({
      viewport: viewport.name,
      type: 'console',
      text: text.slice(0, 220),
    })
  })

  try {
    await page.goto(`${baseUrl}${route}?videoqa=${Date.now()}`, {
      waitUntil: 'networkidle',
      timeout: 35_000,
    })

    const pageText = await page.locator('body').innerText({ timeout: 10_000 })
    const normalizedText = pageText.replace(/\s+/g, ' ').trim()
    for (const text of expectedText) {
      if (!normalizedText.includes(text)) {
        findings.push({
          viewport: viewport.name,
          type: 'missing-text',
          text,
        })
      }
    }

    await page.getByRole('button', { name: /Player capture/i }).waitFor({ state: 'visible', timeout: 10_000 })
    await page.getByRole('button', { name: /Coach review/i }).waitFor({ state: 'visible', timeout: 10_000 })
    await page.getByRole('button', { name: 'Open camera' }).click({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Record' }).waitFor({ state: 'visible', timeout: 10_000 })
    await page.waitForFunction(() => {
      const video = document.querySelector('video')
      return Boolean(video?.srcObject) && !video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    }, undefined, { timeout: 10_000 })

    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      mainVisible: Boolean(document.querySelector('main')),
      videoInputs: document.querySelectorAll('input[type="file"], video, canvas').length,
      cameraPreviewReady: Boolean(document.querySelector('video')?.srcObject),
    }))

    if (!layout.mainVisible) {
      findings.push({
        viewport: viewport.name,
        type: 'missing-main',
        text: 'No main element found.',
      })
    }

    if (layout.documentWidth > layout.viewportWidth + 2) {
      findings.push({
        viewport: viewport.name,
        type: 'horizontal-overflow',
        text: `${layout.documentWidth}px document width in ${layout.viewportWidth}px viewport.`,
      })
    }

    if (layout.videoInputs < 1) {
      findings.push({
        viewport: viewport.name,
        type: 'missing-video-surface',
        text: 'No file input, video, or canvas surface found.',
      })
    }

    if (!layout.cameraPreviewReady) {
      findings.push({
        viewport: viewport.name,
        type: 'camera-preview',
        text: 'Camera preview did not attach to a media stream.',
      })
    }
  } catch (error) {
    findings.push({
      viewport: viewport.name,
      type: 'navigation',
      text: error instanceof Error ? error.message : String(error),
    })
  } finally {
    await context.close()
  }
}

await browser.close()

if (findings.length) {
  console.error(JSON.stringify({ ok: false, baseUrl, route, findings }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({ ok: true, baseUrl, route, viewports: viewports.map((viewport) => viewport.name) }, null, 2))

function cleanBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '')
}
