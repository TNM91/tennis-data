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
  'Export review file',
  'Import review file',
  'Import on the other device',
  'Record or upload',
  'Check the clip',
  'Save or send',
  'Start a clip',
  'Set up the shot',
  'Phone sideways',
  'Phone angle',
  'Horizontal is best',
  'Full court',
  'Technique close-up',
  'ASK COACH TO CHECK',
  'Toss',
  'Contact',
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

    const initialOverflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    if (initialOverflow.scrollWidth > initialOverflow.clientWidth + 1) {
      findings.push({
        viewport: viewport.name,
        type: 'horizontal-overflow',
        text: `Initial page width overflowed the viewport by ${initialOverflow.scrollWidth - initialOverflow.clientWidth}px.`,
      })
    }

    await page.getByText('Choose a clip when you are ready to review.').waitFor({ state: 'visible', timeout: 10_000 })
    await page.getByRole('button', { name: 'Start a clip' }).waitFor({ state: 'visible', timeout: 10_000 })

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

    const defaultIntentReady = await page.locator('[aria-label="Clip goal"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Full court') && text.includes('Horizontal usually gives your coach')
    }).catch(() => false)

    if (!defaultIntentReady) {
      findings.push({
        viewport: viewport.name,
        type: 'capture-intent',
        text: 'Default full-court clip goal did not explain the best phone angle.',
      })
    }

    const defaultCaptureSetupReady = await page.locator('[aria-label="Before recording"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Set up the shot') && text.includes('Phone sideways') && text.includes('Player, ball path, recovery')
    }).catch(() => false)

    if (!defaultCaptureSetupReady) {
      findings.push({
        viewport: viewport.name,
        type: 'capture-setup',
        text: 'Full-court recording setup did not show the phone angle and framing checks.',
      })
    }

    await page.getByRole('button', { name: 'Choose Technique close-up' }).click({ timeout: 10_000 })
    const techniqueIntentReady = await page.locator('[aria-label="Clip goal"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Technique close-up') && text.includes('Portrait works')
    }).catch(() => false)

    if (!techniqueIntentReady) {
      findings.push({
        viewport: viewport.name,
        type: 'capture-intent',
        text: 'Technique clip goal did not switch the player guidance.',
      })
    }

    const techniqueCaptureSetupReady = await page.locator('[aria-label="Before recording"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Close-up ok') && text.includes('Grip, contact, finish')
    }).catch(() => false)

    if (!techniqueCaptureSetupReady) {
      findings.push({
        viewport: viewport.name,
        type: 'capture-setup',
        text: 'Technique recording setup did not switch the angle and framing checks.',
      })
    }

    await page.getByRole('button', { name: 'Choose Full court' }).click({ timeout: 10_000 })

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

    const phoneAngleReady = await page.locator('[aria-label="Phone recording angle"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Horizontal clip') && text.includes('full-court spacing')
    }).catch(() => false)

    if (!phoneAngleReady) {
      findings.push({
        viewport: viewport.name,
        type: 'phone-angle',
        text: 'Camera preview did not show horizontal recording guidance.',
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

    const sendReadinessReady = await page.locator('[aria-label="Send readiness"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Ready to send') && text.includes('Video') && text.includes('Goal') && text.includes('Question')
    }).catch(() => false)

    if (!sendReadinessReady) {
      findings.push({
        viewport: viewport.name,
        type: 'send-readiness',
        text: 'Draft preview did not show the coach-ready check before sending.',
      })
    }

    const draftAngleReady = await page.locator('[aria-label="Phone recording angle"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Horizontal clip') && text.includes('full-court spacing')
    }).catch(() => false)

    if (!draftAngleReady) {
      findings.push({
        viewport: viewport.name,
        type: 'draft-angle',
        text: 'Draft preview did not keep the recorded clip angle guidance visible.',
      })
    }

    const draftCoachQuestionReady = await page.locator('[aria-label="Draft coach question"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Coach question ready') && text.includes('Edit note') && text.includes('toss is consistent')
    }).catch(() => false)

    if (!draftCoachQuestionReady) {
      findings.push({
        viewport: viewport.name,
        type: 'draft-coach-question',
        text: 'Draft preview did not show the player note before sending to coach.',
      })
    }

    await page.locator('[aria-label="Draft coach question"]').getByRole('button', { name: 'Edit note' }).click({ timeout: 10_000 })
    const playerNoteFocused = await page.getByLabel('Player note').evaluate((field) => {
      return field instanceof HTMLTextAreaElement && document.activeElement === field
    }).catch(() => false)

    if (!playerNoteFocused) {
      findings.push({
        viewport: viewport.name,
        type: 'draft-note-focus',
        text: 'Edit note did not focus the player note field.',
      })
    }

    const draftOverflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    if (draftOverflow.scrollWidth > draftOverflow.clientWidth + 1) {
      findings.push({
        viewport: viewport.name,
        type: 'horizontal-overflow',
        text: `Draft preview overflowed the viewport by ${draftOverflow.scrollWidth - draftOverflow.clientWidth}px.`,
      })
    }

    await page.getByRole('button', { name: 'Send to coach' }).click({ timeout: 10_000 })
    await page.getByText('Coach link ready').waitFor({ state: 'visible', timeout: 10_000 })
    await page.getByText('Next step | Waiting on coach').waitFor({ state: 'visible', timeout: 10_000 })

    const handoffReady = await page.locator('[aria-label="Coach handoff"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Copy coach link') && text.includes('Preview coach view') && text.includes('Share review file')
        && text.includes('Different phone or computer') && text.includes('This device')
    }).catch(() => false)

    if (!handoffReady) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-handoff',
        text: 'Sent clip did not show the coach handoff actions.',
      })
    }

    await page.getByRole('button', { name: 'Preview coach view' }).click({ timeout: 10_000 })
    await page.getByText('Coach tools').waitFor({ state: 'visible', timeout: 10_000 })
    await page.getByText('QUICK FOCUS').waitFor({ state: 'visible', timeout: 10_000 })

    await page.locator('#video-review-coach-tools').getByRole('button', { name: 'Undo last mark' }).waitFor({ state: 'visible', timeout: 10_000 })

    const coachIntentReady = await page.locator('[aria-label="Clip goal for coach"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Full court') && text.includes('spacing')
    }).catch(() => false)

    if (!coachIntentReady) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-capture-intent',
        text: 'Coach review did not show the clip goal and review cue.',
      })
    }

    await page.locator('[aria-label="Coach review brief"]').getByRole('button', { name: 'Use player note' }).click({ timeout: 10_000 })
    const coachNoteFromPlayerReady = await page.getByLabel('Timestamp note').evaluate((field) => {
      return field instanceof HTMLTextAreaElement && field.value.includes('toss is consistent')
    }).catch(() => false)

    if (!coachNoteFromPlayerReady) {
      findings.push({
        viewport: viewport.name,
        type: 'player-note-to-coach-note',
        text: 'Coach shortcut did not load the player note into the timestamp note.',
      })
    }

    await page.locator('[aria-label="Coach review brief"]').getByRole('button', { name: 'Mark player question' }).click({ timeout: 10_000 })
    await page.getByText('Coach markup saved at this timestamp.').waitFor({ state: 'visible', timeout: 10_000 })
    const playerQuestionMarked = await page.locator('[aria-label="Timeline marks"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('| note') && text.includes('toss is consistent') && text.includes('On video now')
        && text.includes('Mark 1') && text.includes('1 mark saved') && text.includes('First mark') && text.includes('Latest mark')
    }).catch(() => false)

    if (!playerQuestionMarked) {
      findings.push({
        viewport: viewport.name,
        type: 'mark-player-question',
        text: 'Coach shortcut did not save the player question as a timeline mark.',
      })
    }

    const undoButtonReady = await page.locator('#video-review-coach-tools').getByRole('button', { name: 'Undo last mark' }).isEnabled().catch(() => false)

    if (!undoButtonReady) {
      findings.push({
        viewport: viewport.name,
        type: 'undo-last-mark',
        text: 'Undo last mark was not enabled after saving a coach mark.',
      })
    } else {
      await page.locator('#video-review-coach-tools').getByRole('button', { name: 'Undo last mark' }).click({ timeout: 10_000 })
      await page.getByText('Latest mark removed.').waitFor({ state: 'visible', timeout: 10_000 })

      const playerQuestionRemoved = await page.locator('[aria-label="Timeline marks"]').evaluate((section) => {
        const text = section.textContent || ''
        return !text.includes('toss is consistent') && text.includes('Coach markups will appear here by timestamp.')
      }).catch(() => false)

      if (!playerQuestionRemoved) {
        findings.push({
          viewport: viewport.name,
          type: 'undo-last-mark',
          text: 'Undo last mark did not remove the saved timeline note.',
        })
      }

      await page.locator('[aria-label="Coach review brief"]').getByRole('button', { name: 'Mark player question' }).click({ timeout: 10_000 })
      await page.getByText('Coach markup saved at this timestamp.').waitFor({ state: 'visible', timeout: 10_000 })
    }

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

    const coachReturnReadinessReady = await page.locator('[aria-label="Coach return readiness"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Ready to return') && text.includes('Watch') && text.includes('Mark') && text.includes('Focus') && text.includes('Send')
    }).catch(() => false)

    if (!coachReturnReadinessReady) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-return-readiness',
        text: 'Coach return panel did not show the readiness check before sending feedback.',
      })
    }

    await page.getByRole('button', { name: 'Send review back' }).click({ timeout: 10_000 })
    await page.getByText('Review ready to send').waitFor({ state: 'visible', timeout: 10_000 })

    const returnHandoffReady = await page.locator('[aria-label="Player return handoff"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Copy player link') && text.includes('Preview player feedback') && text.includes('Share returned file')
        && text.includes('Different phone or computer') && text.includes('This device')
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
    await page.locator('[aria-label="Player practice checklist"]').getByText('Watch the coach marks').waitFor({ state: 'visible', timeout: 10_000 })
    await page.locator('[aria-label="Player practice checklist"]').getByText('Log the practice').waitFor({ state: 'visible', timeout: 10_000 })
    const playerFeedbackFocusReady = await page.locator('[aria-label="Player feedback focus"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Take this to court') && text.includes('Watch') && text.includes('Cue') && text.includes('Practice')
        && text.includes('Mark after session')
    }).catch(() => false)

    if (!playerFeedbackFocusReady) {
      findings.push({
        viewport: viewport.name,
        type: 'player-feedback-focus',
        text: 'Returned player feedback did not show the watch, cue, and practice focus.',
      })
    }

    await page.locator('[aria-label="Player video library summary"]').getByRole('button', { name: 'Open feedback' }).click({ timeout: 10_000 })
    await page.getByText('Next step | Feedback ready').waitFor({ state: 'visible', timeout: 10_000 })
    const activeReviewInView = await page.waitForFunction(() => {
      if (window.innerWidth > 767) return true
      const review = document.getElementById('video-review-active')
      if (!review) return false
      const rect = review.getBoundingClientRect()
      return rect.top < window.innerHeight * 0.72 && rect.bottom > 0
    }, undefined, { timeout: 5_000 }).then(() => true).catch(() => false)
    if (!activeReviewInView) {
      findings.push({
        viewport: viewport.name,
        type: 'mobile-open-review',
        text: 'Opening a clip from the mobile library did not bring the review panel into view.',
      })
    }
    await page.locator('[aria-label="Quick video filters"]').getByRole('button', { name: 'Feedback ready' }).click({ timeout: 10_000 })
    await page.getByText('Feedback ready for').waitFor({ state: 'visible', timeout: 10_000 })
    await page.locator('[aria-label="Quick video filters"]').getByRole('button', { name: 'Private' }).click({ timeout: 10_000 })
    await page.getByText('No clips match these filters.').waitFor({ state: 'visible', timeout: 10_000 })
    await page.locator('[aria-label="Empty video library actions"]').getByRole('button', { name: 'Clear filters' }).click({ timeout: 10_000 })
    await page.getByText('Feedback ready for').waitFor({ state: 'visible', timeout: 10_000 })

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
