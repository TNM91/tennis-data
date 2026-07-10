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
  'Record or upload',
  'Check the clip',
  'Save or send',
  'ASK COACH TO CHECK',
  'Toss',
  'Contact',
  'QUICK FOCUS',
]
const ignoredConsoleFragments = [
  '/_next/webpack-hmr',
  '/_vercel/insights/script.js',
  '/_vercel/speed-insights/script.js',
  'Failed to load resource: net::ERR_FAILED',
  'Failed to load resource: the server responded with a status of 404 (Not Found)',
  'violates the following report-only Content Security Policy directive',
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
      waitUntil: 'domcontentloaded',
      timeout: 35_000,
    })

    await page.getByRole('button', { name: /Player capture/i }).waitFor({ state: 'visible', timeout: 10_000 })
    await page.getByRole('button', { name: /Coach review/i }).waitFor({ state: 'visible', timeout: 10_000 })

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

    await page.getByRole('button', { name: 'Ask coach to check Toss' }).click({ timeout: 10_000 })
    const playerNoteReady = await page.getByLabel('Player note').evaluate((field) => {
      return field instanceof HTMLTextAreaElement && field.value.includes('toss is consistent')
    }).catch(() => false)

    if (!playerNoteReady) {
      findings.push({
        viewport: viewport.name,
        type: 'player-note-cue',
        text: 'Player note cue did not fill the coach question.',
      })
    }

    await page.getByRole('button', { name: 'Open camera' }).click({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Start recording' }).waitFor({ state: 'visible', timeout: 10_000 })
    await page.waitForFunction(() => {
      const video = document.querySelector('video')
      return Boolean(video?.srcObject) && !video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    }, undefined, { timeout: 10_000 })
    const cameraPreviewAttached = await page.locator('[class*="cameraPreview"] video').evaluate((video) => {
      return video instanceof HTMLVideoElement && Boolean(video.srcObject)
    }).catch(() => false)

    if (!cameraPreviewAttached) {
      findings.push({
        viewport: viewport.name,
        type: 'camera-preview',
        text: 'Camera preview did not attach to a media stream.',
      })
    }

    await page.getByRole('button', { name: 'Start recording' }).click({ timeout: 10_000 })
    await page.locator('[class*="recordingBadge"]').waitFor({ state: 'visible', timeout: 10_000 })
    await page.waitForTimeout(1_500)
    await page.getByRole('button', { name: 'Stop recording' }).click({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Discard clip' }).waitFor({ state: 'visible', timeout: 20_000 })

    const draftPreviewReady = await page.locator('[aria-label="Draft clip preview"] video').evaluate((video) => {
      return video instanceof HTMLVideoElement && Boolean(video.currentSrc || video.src)
    }).catch(() => false)

    if (!draftPreviewReady) {
      findings.push({
        viewport: viewport.name,
        type: 'draft-preview',
        text: 'Recorded clip did not appear in the draft preview.',
      })
    }

    const draftActionsReady = await page.locator('[aria-label="Draft clip preview"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Send to coach') && text.includes('Save private') && text.includes('Record again')
    }).catch(() => false)

    if (!draftActionsReady) {
      findings.push({
        viewport: viewport.name,
        type: 'draft-actions',
        text: 'Draft preview did not show save, send, and re-record actions together.',
      })
    }

    await page.getByRole('button', { name: 'Send to coach' }).click({ timeout: 10_000 })
    await page.getByText('Coach link ready').waitFor({ state: 'visible', timeout: 10_000 })
    await page.getByText('Next step | Waiting on coach').waitFor({ state: 'visible', timeout: 10_000 })

    const handoffReady = await page.locator('[aria-label="Coach handoff"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Copy coach link') && text.includes('Preview coach view') && text.includes('Share review file')
    }).catch(() => false)

    if (!handoffReady) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-handoff',
        text: 'Sent clip did not show the coach handoff actions.',
      })
    }

    await page.getByRole('button', { name: 'Preview coach view' }).click({ timeout: 10_000 })
    await page.locator('[aria-label="Coach return focus cues"]').getByRole('button', { name: /Spacing/ }).click({ timeout: 10_000 })

    const returnFocusReady = await page.getByLabel('Next focus').evaluate((field) => {
      return field instanceof HTMLTextAreaElement && field.value.includes('contact stays away from the body')
    }).catch(() => false)

    if (!returnFocusReady) {
      findings.push({
        viewport: viewport.name,
        type: 'return-focus-cue',
        text: 'Coach quick focus did not fill the return review note.',
      })
    }

    await page.getByRole('button', { name: 'Send review back' }).click({ timeout: 10_000 })
    await page.getByText('Review ready to send').waitFor({ state: 'visible', timeout: 10_000 })

    const returnHandoffReady = await page.locator('[aria-label="Player return handoff"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Copy player link') && text.includes('Preview player feedback') && text.includes('Share returned file')
    }).catch(() => false)

    if (!returnHandoffReady) {
      findings.push({
        viewport: viewport.name,
        type: 'player-return-handoff',
        text: 'Returned review did not show the player handoff actions.',
      })
    }

    await page.getByRole('button', { name: 'Preview player feedback' }).click({ timeout: 10_000 })
    await page.getByText(/Feedback ready for/i).waitFor({ state: 'visible', timeout: 10_000 })
    await page.getByText('Next step | Feedback ready').waitFor({ state: 'visible', timeout: 10_000 })

    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      mainVisible: Boolean(document.querySelector('main')),
      videoInputs: document.querySelectorAll('input[type="file"], video, canvas').length,
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
