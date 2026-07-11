import { chromium } from 'playwright'

const baseUrl = cleanBaseUrl(process.env.VIDEO_REVIEW_BASE_URL || 'http://127.0.0.1:3000')
const route = '/video-review'
const viewports = [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]
const expectedText = [
  'Video Review',
  'Record a clip, send it to your coach, and practice the returned marks.',
  'Player capture',
  'Coach review',
  'Keep the clip queue light.',
  'clip slots left',
  'Record',
  'Review',
  'Practice',
  'Capture one clean clip.',
  'Notifications and review files',
  'Share or import',
  'Record or upload',
  'Check the clip',
  'Save or send',
  'Record or upload first',
  'Open the camera on court or upload a video from your phone.',
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

    await page.getByRole('button', { name: 'Player capture', exact: true }).waitFor({ state: 'visible', timeout: 10_000 })
    await page.getByRole('button', { name: 'Coach review', exact: true }).waitFor({ state: 'visible', timeout: 10_000 })

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

    if (viewport.name === 'mobile') {
      const mobileShortcutLayoutReady = await page.evaluate(() => {
        const heroShortcut = document.querySelector('[aria-label="Video review shortcuts"]')
        const dock = document.querySelector('[aria-label="Video review mobile shortcuts"]')
        const heroStyle = heroShortcut ? window.getComputedStyle(heroShortcut) : null
        const dockStyle = dock ? window.getComputedStyle(dock) : null

        return Boolean(heroShortcut && dock)
          && heroStyle?.display === 'none'
          && dockStyle?.display !== 'none'
          && dockStyle?.visibility !== 'hidden'
      }).catch(() => false)

      if (!mobileShortcutLayoutReady) {
        findings.push({
          viewport: viewport.name,
          type: 'mobile-shortcuts',
          text: 'Phone view should use the bottom shortcut dock instead of repeating hero shortcuts.',
        })
      }

      const smallTouchTargets = await page.evaluate(() => {
        return [...document.querySelectorAll('button, a[href], label, select, textarea, input:not([type="file"])')]
          .filter((element) => {
            const rect = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            return rect.width > 0
              && rect.height > 0
              && rect.bottom > 0
              && rect.top < window.innerHeight
              && style.display !== 'none'
              && style.visibility !== 'hidden'
          })
          .filter((element) => {
            const rect = element.getBoundingClientRect()
            return rect.width < 40 || rect.height < 40
          })
          .map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              text: (element.textContent || element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.tagName).trim().replace(/\s+/g, ' ').slice(0, 80),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            }
          })
          .slice(0, 5)
      })

      if (smallTouchTargets.length) {
        findings.push({
          viewport: viewport.name,
          type: 'mobile-touch-target',
          text: `Small phone tap targets found: ${JSON.stringify(smallTouchTargets)}`,
        })
      }
    }

    const initialStageReady = await page.locator('[aria-label="Video review steps"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Record') && text.includes('Capture one clean clip.')
        && text.includes('Review') && text.includes('Send, share, or watch marks.')
        && text.includes('Practice') && text.includes('Feedback appears here after coach review.')
    }).catch(() => false)

    if (!initialStageReady) {
      findings.push({
        viewport: viewport.name,
        type: 'stage-tabs',
        text: 'Video review did not show the simplified Record, Review, Practice steps on first load.',
      })
    }

    const initialWorkspaceFocused = await page.evaluate(() => {
      const workspace = document.getElementById('video-review-workspace')
      const text = workspace?.textContent || ''
      const library = document.querySelector('[aria-label="Video library clips"]')
      const activeReview = document.querySelector('[aria-label="Active video review"]')
      return text.includes('Record or upload first') && !library && !activeReview
    }).catch(() => false)

    if (!initialWorkspaceFocused) {
      findings.push({
        viewport: viewport.name,
        type: 'initial-focused-workspace',
        text: 'First load should show capture only, without the library or active review stack.',
      })
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

    const initialCaptureNextStepReady = await page.locator('[aria-label="Capture next step"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Record or upload first') && text.includes('Open the camera on court or upload a video from your phone.')
    }).catch(() => false)

    if (!initialCaptureNextStepReady) {
      findings.push({
        viewport: viewport.name,
        type: 'capture-next-step',
        text: 'Capture panel did not explain the first player action before a clip is selected.',
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

    const cameraViewChoicesReady = await page.locator('[aria-label="Camera view"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Horizontal court') && text.includes('Portrait close-up')
        && text.includes('Serves, movement, full point') && text.includes('Grip, contact, swing path')
    }).catch(() => false)

    if (!cameraViewChoicesReady) {
      findings.push({
        viewport: viewport.name,
        type: 'camera-view-choices',
        text: 'Capture panel did not show horizontal and portrait camera view choices.',
      })
    }

    await page.locator('[aria-label="Camera view"]').getByRole('button', { name: 'Portrait close-up Grip, contact, swing path' }).click({ timeout: 10_000 })
    const portraitChoiceReady = await page.locator('[aria-label="Before recording"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Close-up ok') && text.includes('Grip, contact, finish')
    }).catch(() => false)

    if (!portraitChoiceReady) {
      findings.push({
        viewport: viewport.name,
        type: 'portrait-camera-choice',
        text: 'Portrait close-up view did not update the recording checklist.',
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

    const cameraPreviewPlacementReady = await page.evaluate(() => {
      const preview = document.querySelector('[class*="cameraPreview"]')
      const goal = document.querySelector('[aria-label="Clip goal"]')
      if (!preview || !goal) return false
      return preview.getBoundingClientRect().top < goal.getBoundingClientRect().top
    }).catch(() => false)

    if (!cameraPreviewPlacementReady) {
      findings.push({
        viewport: viewport.name,
        type: 'camera-preview-placement',
        text: 'Camera preview did not appear before clip goal guidance after opening the camera.',
      })
    }

    const cameraFrameShapeReady = await page.locator('[class*="cameraPreviewFrame"]').evaluate((frame) => {
      const rect = frame.getBoundingClientRect()
      return frame.className.includes('captureMediaLandscape') && rect.width > rect.height
    }).catch(() => false)

    if (!cameraFrameShapeReady) {
      findings.push({
        viewport: viewport.name,
        type: 'camera-frame-shape',
        text: 'Full-court camera preview did not use a horizontal video frame.',
      })
    }

    const liveRecordingControlsReady = await page.locator('[aria-label="Live recording controls"]').evaluate((section) => {
      const text = section.textContent || ''
      const button = section.querySelector('button')
      return text.includes('Start recording') && Boolean(button && !button.disabled)
    }).catch(() => false)

    if (!liveRecordingControlsReady) {
      findings.push({
        viewport: viewport.name,
        type: 'live-recording-controls',
        text: 'Camera preview did not show an enabled recording button beside the live view.',
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
    const liveStopControlsReady = await page.locator('[aria-label="Live recording controls"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Stop recording')
    }).catch(() => false)

    if (!liveStopControlsReady) {
      findings.push({
        viewport: viewport.name,
        type: 'live-stop-recording-controls',
        text: 'Camera preview did not switch to Stop recording while recording.',
      })
    }

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

    const draftFrameShapeReady = await page.locator('[aria-label="Draft clip preview"] video').evaluate((video) => {
      const rect = video.getBoundingClientRect()
      return video.className.includes('captureMediaLandscape') && rect.width > rect.height
    }).catch(() => false)

    if (!draftFrameShapeReady) {
      findings.push({
        viewport: viewport.name,
        type: 'draft-frame-shape',
        text: 'Full-court draft preview did not keep a horizontal video frame.',
      })
    }

    const draftActionsReady = await page.locator('[aria-label="Draft clip preview"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Coach question attached')
        && text.includes('Draft only. Send or save before leaving this page.')
        && text.includes('Send to coach') && text.includes('Save private') && text.includes('Record again')
    }).catch(() => false)

    if (!draftActionsReady) {
      findings.push({
        viewport: viewport.name,
        type: 'draft-actions',
        text: 'Draft preview did not show save, send, and re-record actions together.',
      })
    }

    const unsavedDraftGuardReady = await page.evaluate(() => typeof window.onbeforeunload === 'function').catch(() => false)
    if (!unsavedDraftGuardReady) {
      findings.push({
        viewport: viewport.name,
        type: 'unsaved-draft-guard',
        text: 'Recorded draft did not enable a leave-page warning before saving or sending.',
      })
    }

    const draftActionsPlacementReady = await page.locator('[aria-label="Draft clip preview"]').evaluate((section) => {
      const actions = section.querySelector('[aria-label="Draft clip actions"]')
      const readiness = section.querySelector('[aria-label="Send readiness"]')
      if (!actions || !readiness) return false
      return actions.getBoundingClientRect().top < readiness.getBoundingClientRect().top
    }).catch(() => false)

    if (!draftActionsPlacementReady) {
      findings.push({
        viewport: viewport.name,
        type: 'draft-actions-placement',
        text: 'Draft save, send, and re-record actions did not appear directly after playback.',
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
        && text.includes('Toss') && text.includes('Contact') && text.includes('Footwork')
    }).catch(() => false)

    if (!draftCoachQuestionReady) {
      findings.push({
        viewport: viewport.name,
        type: 'draft-coach-question',
        text: 'Draft preview did not show the player note before sending to coach.',
      })
    }

    const draftCaptureNextStepReady = await page.locator('[aria-label="Capture next step"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Ready to save or send') && text.includes('Play it once, then send it to your coach or keep it private.')
    }).catch(() => false)

    if (!draftCaptureNextStepReady) {
      findings.push({
        viewport: viewport.name,
        type: 'draft-next-step',
        text: 'Draft preview did not tell the player what to do before saving or sending.',
      })
    }

    await page.locator('[aria-label="Draft coach question"]').getByRole('button', { name: 'Edit note' }).click({ timeout: 10_000 })
    const playerNoteFocused = await page.waitForFunction(() => {
      const field = document.getElementById('video-review-player-note')
      return field instanceof HTMLTextAreaElement && document.activeElement === field
    }, undefined, { timeout: 10_000 }).then(() => true).catch(() => false)

    if (!playerNoteFocused) {
      findings.push({
        viewport: viewport.name,
        type: 'draft-note-focus',
        text: 'Edit note did not focus the player note field.',
      })
    }

    const noteNextStepReady = await page.locator('[aria-label="Player note next step"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Question ready') && text.includes('Review clip actions')
    }).catch(() => false)

    if (!noteNextStepReady) {
      findings.push({
        viewport: viewport.name,
        type: 'note-next-step',
        text: 'Player note field did not offer a return path to the draft actions.',
      })
    }

    await page.locator('[aria-label="Player note next step"]').getByRole('button', { name: 'Review clip actions' }).click({ timeout: 10_000 })
    const noteReturnReady = await page.waitForFunction(() => {
      const section = document.querySelector('[aria-label="Draft clip actions"]')
      if (!(section instanceof HTMLElement)) return false
      const rect = section.getBoundingClientRect()
      return document.activeElement === section && rect.top >= 0 && rect.bottom <= window.innerHeight
    }, undefined, { timeout: 10_000 }).then(() => true).catch(() => false)

    if (!noteReturnReady) {
      findings.push({
        viewport: viewport.name,
        type: 'note-return-actions',
        text: 'Review clip actions did not bring the draft decision block back into view.',
      })
    }

    await page.locator('[aria-label="Draft clip actions"]').getByRole('button', { name: 'Record again' }).click({ timeout: 10_000 })
    const recordAgainReady = await page.waitForFunction(() => {
      const nextStep = document.querySelector('[aria-label="Capture next step"]')
      const text = nextStep?.textContent || ''
      const draftPreview = document.querySelector('[aria-label="Draft clip preview"]')
      const startRecording = Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.includes('Start recording'))
      return text.includes('Previous take deleted. Record a new one when the frame is ready.')
        && !draftPreview
        && startRecording
    }, undefined, { timeout: 10_000 }).then(() => true).catch(() => false)

    if (!recordAgainReady) {
      findings.push({
        viewport: viewport.name,
        type: 'record-again-reset',
        text: 'Record again did not clear the draft clip and return the player to capture.',
      })
    }

    await page.getByRole('button', { name: 'Start recording' }).click({ timeout: 10_000 })
    await page.locator('[class*="recordingBadge"]').waitFor({ state: 'visible', timeout: 10_000 })
    await page.waitForTimeout(1_000)
    await page.getByRole('button', { name: 'Stop recording' }).click({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Send to coach' }).waitFor({ state: 'visible', timeout: 20_000 })

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

    const sentActivityReady = await page.locator('[aria-label="Clip activity trail"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Clip activity') && text.includes('Saved to lab') && text.includes('Sent to Coach')
        && text.includes('Coach marks next') && text.includes('Feedback not returned') && text.includes('Practice not logged')
    }).catch(() => false)

    if (!sentActivityReady) {
      findings.push({
        viewport: viewport.name,
        type: 'clip-activity-sent',
        text: 'Sent clip did not show the saved, sent, waiting, and practice activity trail.',
      })
    }

    const playerSentStatusReady = await page.locator('[aria-label="Player sent clip status"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('With coach') && text.includes('is waiting for Coach') && text.includes('Open waiting clip')
        && text.includes('Show waiting') && text.includes('Keep the coach link handy')
    }).catch(() => false)

    if (!playerSentStatusReady) {
      findings.push({
        viewport: viewport.name,
        type: 'player-sent-status',
        text: 'Player library did not show the waiting coach handoff banner after sending.',
      })
    }

    const sentLibraryNextStepReady = await page.locator('[aria-label="Video library clips"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Next: waiting on coach')
    }).catch(() => false)

    if (!sentLibraryNextStepReady) {
      findings.push({
        viewport: viewport.name,
        type: 'library-next-step',
        text: 'Player library card did not show the waiting-on-coach next step.',
      })
    }

    const handoffReady = await page.locator('[aria-label="Coach handoff"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Copy coach link') && text.includes('Preview coach view') && text.includes('Share review file')
        && text.includes('Coach on another phone') && text.includes('Coach with this device')
        && text.includes('The file includes the video and notes') && text.includes('Download file')
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

    const coachInboxReady = await page.locator('[aria-label="Coach inbox"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Coach inbox') && text.includes('Player sent') && text.includes('Open request')
        && text.includes('Show needs review') && text.includes('mark the key moment')
    }).catch(() => false)

    if (!coachInboxReady) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-inbox',
        text: 'Coach view did not show the newest player clip as an inbox request.',
      })
    }

    await page.locator('#video-review-coach-tools').getByRole('button', { name: 'Undo last mark' }).waitFor({ state: 'visible', timeout: 10_000 })

    const coachLibraryNextStepReady = await page.locator('[aria-label="Video library clips"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Next: mark key moment')
    }).catch(() => false)

    if (!coachLibraryNextStepReady) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-library-next-step',
        text: 'Coach library card did not show the mark-key-moment next step.',
      })
    }

    const coachReviewFiltersReady = await page.locator('[aria-label="Coach review filters"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Coach work') && text.includes('All coach work')
        && text.includes('Needs first mark') && text.includes('Ready to return')
        && text.includes('1 need a first mark') && text.includes('0 ready to return')
    }).catch(() => false)

    if (!coachReviewFiltersReady) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-review-filters',
        text: 'Coach queue did not show review-stage filters and counts.',
      })
    }

    await page.locator('[aria-label="Coach review filters"]').getByRole('button', { name: 'Needs first mark' }).click({ timeout: 10_000 })
    const needsMarkFilterReady = await page.locator('[aria-label="Video library clips"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Next: mark key moment')
    }).catch(() => false)

    if (!needsMarkFilterReady) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-filter-needs-mark',
        text: 'Needs first mark filter did not keep the unmarked coach request visible.',
      })
    }

    const coachActiveFiltersReady = await page.locator('[aria-label="Active video filters"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Showing') && text.includes('Status') && text.includes('Coach queue')
        && text.includes('Coach work') && text.includes('Needs first mark') && text.includes('Clear')
    }).catch(() => false)

    if (!coachActiveFiltersReady) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-active-filters',
        text: 'Coach filters did not show the active filter chips.',
      })
    }

    await page.getByRole('button', { name: 'Clear coach work filter' }).click({ timeout: 10_000 })
    const coachWorkFilterCleared = await page.locator('[aria-label="Active video filters"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Status') && text.includes('Coach queue') && !text.includes('Needs first mark')
    }).catch(() => false)

    if (!coachWorkFilterCleared) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-active-filter-clear',
        text: 'Clearing the coach work chip did not leave the queue status filter visible.',
      })
    }

    await page.locator('[aria-label="Coach review filters"]').getByRole('button', { name: 'Ready to return' }).click({ timeout: 10_000 })
    await page.getByText('No clips match these filters.').waitFor({ state: 'visible', timeout: 10_000 })
    await page.locator('[aria-label="Coach review filters"]').getByRole('button', { name: 'All coach work' }).click({ timeout: 10_000 })
    await page.locator('[aria-label="Video library clips"]').getByText('Next: mark key moment').waitFor({ state: 'visible', timeout: 10_000 })

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

    const initialCoachNextStepReady = await page.locator('[aria-label="Coach next step"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Mark the key moment') && text.includes('Pause at the frame that matters')
    }).catch(() => false)

    if (!initialCoachNextStepReady) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-next-step',
        text: 'Coach tools did not explain the next action before a mark is added.',
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
        && text.includes('Mark 1') && text.includes('1 mark saved') && text.includes('0 of 1 watched')
        && text.includes('Next: Mark 1 at') && text.includes('Watch Mark 1')
        && text.includes('First mark') && text.includes('Latest mark')
    }).catch(() => false)

    if (!playerQuestionMarked) {
      findings.push({
        viewport: viewport.name,
        type: 'mark-player-question',
        text: 'Coach shortcut did not save the player question as a timeline mark.',
      })
    }

    const markedActivityReady = await page.locator('[aria-label="Clip activity trail"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('1 coach mark') && text.includes('Latest mark at') && text.includes('Feedback not returned')
    }).catch(() => false)

    if (!markedActivityReady) {
      findings.push({
        viewport: viewport.name,
        type: 'clip-activity-marked',
        text: 'Coach mark did not update the active clip activity trail.',
      })
    }

    const markedCoachNextStepReady = await page.locator('[aria-label="Coach next step"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Name one next focus') && text.includes('Add next focus')
    }).catch(() => false)

    if (!markedCoachNextStepReady) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-next-step-after-mark',
        text: 'Coach next step did not offer a direct Add next focus action after the first mark.',
      })
    }

    await page.locator('[aria-label="Coach next step"]').getByRole('button', { name: 'Add next focus' }).click({ timeout: 10_000 })
    const returnReviewVisible = await page.waitForFunction(() => {
      const section = document.getElementById('video-review-return-review')
      if (!(section instanceof HTMLElement)) return false
      const rect = section.getBoundingClientRect()
      return rect.top >= 0 && rect.top < window.innerHeight * 0.8
    }, undefined, { timeout: 10_000 }).then(() => true).catch(() => false)
    const returnFocusFocused = await page.waitForFunction(() => {
      const field = document.getElementById('video-review-coach-return-focus')
      return field instanceof HTMLTextAreaElement && document.activeElement === field
    }, undefined, { timeout: 10_000 }).then(() => true).catch(() => false)

    if (!returnReviewVisible) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-next-focus-scroll',
        text: 'Add next focus did not bring the return review panel into view.',
      })
    }

    if (!returnFocusFocused) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-next-focus-focus',
        text: 'Add next focus did not place the cursor in the next focus field.',
      })
    }

    const savedMarkFocusAssistReady = await page.locator('[aria-label="Saved mark focus"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Saved mark can be the next focus.') && text.includes('Use saved mark')
    }).catch(() => false)

    if (!savedMarkFocusAssistReady) {
      findings.push({
        viewport: viewport.name,
        type: 'saved-mark-focus-assist',
        text: 'Return review did not offer to use the saved mark as the next focus.',
      })
    }

    const savedMarkReadinessReady = await page.locator('[aria-label="Coach return readiness"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Ready with saved mark') && text.includes('Focus') && text.includes('Saved mark')
        && text.includes('Send') && text.includes('Can send')
    }).catch(() => false)

    if (!savedMarkReadinessReady) {
      findings.push({
        viewport: viewport.name,
        type: 'saved-mark-readiness',
        text: 'Return readiness did not distinguish a saved mark focus from a written next focus.',
      })
    }

    await page.locator('[aria-label="Saved mark focus"]').getByRole('button', { name: 'Use saved mark' }).click({ timeout: 10_000 })
    const savedMarkFocusApplied = await page.waitForFunction(() => {
      const field = document.getElementById('video-review-coach-return-focus')
      return field instanceof HTMLTextAreaElement && field.value.includes('toss is consistent')
        && document.activeElement === field
    }, undefined, { timeout: 10_000 }).then(() => true).catch(() => false)

    if (!savedMarkFocusApplied) {
      findings.push({
        viewport: viewport.name,
        type: 'saved-mark-focus-apply',
        text: 'Use saved mark did not fill and focus the next focus field.',
      })
    }

    const writtenFocusReadinessReady = await page.locator('[aria-label="Coach return readiness"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Ready to return') && text.includes('Focus') && text.includes('Ready')
        && text.includes('Send') && text.includes('Ready')
    }).catch(() => false)

    if (!writtenFocusReadinessReady) {
      findings.push({
        viewport: viewport.name,
        type: 'written-focus-readiness',
        text: 'Return readiness did not switch to ready after the saved mark was accepted into the next focus field.',
      })
    }

    await page.locator('[aria-label="Coach review filters"]').getByRole('button', { name: 'Ready to return' }).click({ timeout: 10_000 })
    const readyReturnFilterReady = await page.locator('[aria-label="Video library clips"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Next: send back')
    }).catch(() => false)

    if (!readyReturnFilterReady) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-filter-ready-return',
        text: 'Ready to return filter did not show the marked coach request.',
      })
    }

    await page.locator('[aria-label="Coach review filters"]').getByRole('button', { name: 'All coach work' }).click({ timeout: 10_000 })

    await page.locator('[aria-label="Timeline marks"]').getByRole('button', { name: 'Open' }).click({ timeout: 10_000 })
    const playerQuestionWatched = await page.locator('[aria-label="Timeline marks"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('1 of 1 watched') && text.includes('Watched') && text.includes('All watched')
        && text.includes('All marks watched')
        && text.includes('Start over')
    }).catch(() => false)

    if (!playerQuestionWatched) {
      findings.push({
        viewport: viewport.name,
        type: 'watched-mark-progress',
        text: 'Opening a timeline mark did not show watched progress.',
      })
    }

    const watchedMarkStored = await page.evaluate(() => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem('tenaceiq.videoReview.watchedMarks.v1') || '{}')
        return Object.values(parsed).some((annotationIds) => Array.isArray(annotationIds) && annotationIds.length > 0)
      } catch {
        return false
      }
    }).catch(() => false)

    if (!watchedMarkStored) {
      findings.push({
        viewport: viewport.name,
        type: 'watched-mark-storage',
        text: 'Opening a timeline mark did not save watched progress on the device.',
      })
    }

    await page.locator('[aria-label="Timeline marks"]').getByRole('button', { name: 'Start over' }).click({ timeout: 10_000 })
    await page.getByText('Coach marks ready to watch again.').waitFor({ state: 'visible', timeout: 10_000 })
    const watchedMarkReset = await page.locator('[aria-label="Timeline marks"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('0 of 1 watched') && text.includes('Next: Mark 1 at') && text.includes('Watch Mark 1')
        && !text.includes('Watched') && !text.includes('Start over')
    }).catch(() => false)

    if (!watchedMarkReset) {
      findings.push({
        viewport: viewport.name,
        type: 'watched-mark-reset',
        text: 'Starting over did not clear watched progress from the timeline.',
      })
    }

    const watchedMarkStorageReset = await page.evaluate(() => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem('tenaceiq.videoReview.watchedMarks.v1') || '{}')
        return !Object.values(parsed).some((annotationIds) => Array.isArray(annotationIds) && annotationIds.length > 0)
      } catch {
        return false
      }
    }).catch(() => false)

    if (!watchedMarkStorageReset) {
      findings.push({
        viewport: viewport.name,
        type: 'watched-mark-reset-storage',
        text: 'Starting over did not clear saved watched progress on the device.',
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

    const readyCoachNextStepReady = await page.locator('[aria-label="Coach next step"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Ready to send back') && text.includes('Send the review back')
    }).catch(() => false)

    if (!readyCoachNextStepReady) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-next-step-ready',
        text: 'Coach tools did not switch to the send-back next step when the review was ready.',
      })
    }

    const readyCoachNextStepActionReady = await page.locator('[aria-label="Coach next step actions"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Send review back')
    }).catch(() => false)

    if (!readyCoachNextStepActionReady) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-next-step-ready-action',
        text: 'Coach next step did not offer Send review back once the review was ready.',
      })
    }

    const readyCoachLibraryNextStepReady = await page.locator('[aria-label="Video library clips"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Next: send back')
    }).catch(() => false)

    if (!readyCoachLibraryNextStepReady) {
      findings.push({
        viewport: viewport.name,
        type: 'coach-library-next-step-ready',
        text: 'Coach library card did not switch to send-back after the return focus was ready.',
      })
    }

    await page.locator('[aria-label="Coach next step actions"]').getByRole('button', { name: 'Send review back' }).click({ timeout: 10_000 })
    await page.getByText('Review ready to send').waitFor({ state: 'visible', timeout: 10_000 })

    const returnHandoffReady = await page.locator('[aria-label="Player return handoff"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Copy player link') && text.includes('Preview player feedback') && text.includes('Share returned file')
        && text.includes('Player on another phone') && text.includes('Player with this device')
        && text.includes('The file includes the marked video') && text.includes('Download file')
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

    const returnedActivityReady = await page.locator('[aria-label="Clip activity trail"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Feedback returned') && text.includes('Practice not logged') && text.includes('contact stays away from the body')
    }).catch(() => false)

    if (!returnedActivityReady) {
      findings.push({
        viewport: viewport.name,
        type: 'clip-activity-returned',
        text: 'Returned feedback did not update the active clip activity trail.',
      })
    }

    await page.locator('[aria-label="Video review steps"]').getByRole('button', { name: /Review/ }).click({ timeout: 10_000 })
    await page.locator('[aria-label="Video library clips"]').waitFor({ state: 'visible', timeout: 10_000 })
    const reviewedLibraryNextStepReady = await page.locator('[aria-label="Video library clips"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Next: watch Mark 1')
    }).catch(() => false)

    if (!reviewedLibraryNextStepReady) {
      findings.push({
        viewport: viewport.name,
        type: 'reviewed-library-next-step',
        text: 'Player library card did not show the next coach mark to watch.',
      })
    }

    await page.locator('[aria-label="Video review steps"]').getByRole('button', { name: /Practice/ }).click({ timeout: 10_000 })
    await page.locator('[aria-label="Player feedback focus"]').waitFor({ state: 'visible', timeout: 10_000 })
    await page.locator('[aria-label="Player practice checklist"]').getByText('Watch the coach marks').waitFor({ state: 'visible', timeout: 10_000 })
    await page.locator('[aria-label="Player practice checklist"]').getByText('Log the practice').waitFor({ state: 'visible', timeout: 10_000 })
    const playerFeedbackFocusReady = await page.locator('[aria-label="Player feedback focus"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Take this to court') && text.includes('Watch') && text.includes('Cue') && text.includes('Practice')
        && text.includes('Mark after session') && text.includes('Watch Mark 1')
    }).catch(() => false)

    if (!playerFeedbackFocusReady) {
      findings.push({
        viewport: viewport.name,
        type: 'player-feedback-focus',
        text: 'Returned player feedback did not show the watch, cue, and practice focus.',
      })
    }

    await page.locator('[aria-label="Player feedback focus"]').getByRole('button', { name: 'Watch Mark 1' }).click({ timeout: 10_000 })
    const playerFeedbackNextActionReady = await page.locator('[aria-label="Player feedback focus"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('All marks watched') && text.includes('Log practice')
    }).catch(() => false)

    if (!playerFeedbackNextActionReady) {
      findings.push({
        viewport: viewport.name,
        type: 'player-feedback-next-action',
        text: 'Player feedback focus did not switch from watching marks to logging practice.',
      })
    }

    const courtChecklistReady = await page.locator('[aria-label="Court checklist"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Court checklist') && text.includes('Use this next hit')
        && text.includes('Warm-up: Shadow the shape') && text.includes('Main set: Basket check')
        && text.includes('Finish: Pressure rep') && text.includes('contact stays away from the body')
    }).catch(() => false)

    if (!courtChecklistReady) {
      findings.push({
        viewport: viewport.name,
        type: 'court-checklist',
        text: 'Returned player feedback did not show the on-court checklist.',
      })
    }

    await page.locator('[aria-label="Player feedback next action"]').getByRole('button', { name: 'Log practice' }).click({ timeout: 10_000 })
    await page.getByText('Practice marked done for').waitFor({ state: 'visible', timeout: 10_000 })
    const playerFeedbackPracticeLoggedReady = await page.locator('[aria-label="Player feedback focus"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Practice logged') && text.includes('Practice') && text.includes('Logged')
        && text.includes('Practice again') && text.includes('Copy plan') && text.includes('Download summary')
    }).catch(() => false)

    if (!playerFeedbackPracticeLoggedReady) {
      findings.push({
        viewport: viewport.name,
        type: 'player-feedback-practice-logged',
        text: 'Player feedback focus did not show repeat, copy, and summary actions after practice was logged.',
      })
    }

    const practicedActivityReady = await page.locator('[aria-label="Clip activity trail"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Practice logged') && text.includes('contact stays away from the body')
    }).catch(() => false)

    if (!practicedActivityReady) {
      findings.push({
        viewport: viewport.name,
        type: 'clip-activity-practiced',
        text: 'Marking practice done did not update the active clip activity trail.',
      })
    }

    const practicedCourtChecklistReady = await page.locator('[aria-label="Court checklist"]').evaluate((section) => {
      const doneItems = section.querySelectorAll('[class*="courtPlanItemDone"]').length
      return doneItems >= 3
    }).catch(() => false)

    if (!practicedCourtChecklistReady) {
      findings.push({
        viewport: viewport.name,
        type: 'court-checklist-practiced',
        text: 'Marking practice done did not complete the on-court checklist.',
      })
    }

    const practiceWrapReady = await page.locator('[aria-label="Practice wrap-up"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Practice logged') && text.includes('Keep the cue or clear space')
        && text.includes('contact stays away from the body') && text.includes('logged')
        && text.includes('clip size') && text.includes('mark') && text.includes('Copy plan')
        && text.includes('Download summary') && text.includes('Practice again') && text.includes('Delete clip')
    }).catch(() => false)

    if (!practiceWrapReady) {
      findings.push({
        viewport: viewport.name,
        type: 'practice-wrap-up',
        text: 'Marking practice done did not show the keep, repeat, and clear-space wrap-up.',
      })
    }

    await page.locator('[aria-label="Video review steps"]').getByRole('button', { name: /Review/ }).click({ timeout: 10_000 })
    await page.locator('[aria-label="Video library clips"]').waitFor({ state: 'visible', timeout: 10_000 })
    const practiceLibraryStatusReady = await page.locator('[aria-label="Player practice status"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Practice logged') && text.includes('contact stays away from the body')
        && text.includes('Open wrap-up') && text.includes('Show feedback')
    }).catch(() => false)

    if (!practiceLibraryStatusReady) {
      findings.push({
        viewport: viewport.name,
        type: 'practice-library-status',
        text: 'Player library did not show the latest practiced clip and wrap-up action.',
      })
    }

    const practiceLibrarySummaryReady = await page.locator('[aria-label="Player video library summary"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('practiced') && text.includes('1')
    }).catch(() => false)

    if (!practiceLibrarySummaryReady) {
      findings.push({
        viewport: viewport.name,
        type: 'practice-library-summary',
        text: 'Player library summary did not count practiced clips.',
      })
    }

    const practicedLibraryCardReady = await page.locator('[aria-label="Video library clips"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Next: practice logged') && text.includes('Practice logged')
    }).catch(() => false)

    if (!practicedLibraryCardReady) {
      findings.push({
        viewport: viewport.name,
        type: 'practice-library-card',
        text: 'Practiced clips did not show practice status on the library card.',
      })
    }

    await page.locator('[aria-label="Practice filters"]').getByRole('button', { name: 'Practiced' }).click({ timeout: 10_000 })
    const practicedFilterReady = await page.locator('[aria-label="Video library clips"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Next: practice logged') && text.includes('Practice logged')
    }).catch(() => false)

    if (!practicedFilterReady) {
      findings.push({
        viewport: viewport.name,
        type: 'practice-filter-practiced',
        text: 'Practiced filter did not keep practiced clips visible.',
      })
    }

    const playerActiveFiltersReady = await page.locator('[aria-label="Active video filters"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Showing') && text.includes('Status') && text.includes('Reviewed')
        && text.includes('Practice') && text.includes('Practiced') && text.includes('Clear')
    }).catch(() => false)

    if (!playerActiveFiltersReady) {
      findings.push({
        viewport: viewport.name,
        type: 'player-active-filters',
        text: 'Player practice filters did not show active filter chips.',
      })
    }

    await page.locator('[aria-label="Practice filters"]').getByRole('button', { name: 'Needs practice' }).click({ timeout: 10_000 })
    await page.getByText('No clips match these filters.').waitFor({ state: 'visible', timeout: 10_000 })
    await page.locator('[aria-label="Practice filters"]').getByRole('button', { name: 'All practice' }).click({ timeout: 10_000 })
    const allPracticeFilterReady = await page.locator('[aria-label="Video library clips"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Practice logged')
    }).catch(() => false)

    if (!allPracticeFilterReady) {
      findings.push({
        viewport: viewport.name,
        type: 'practice-filter-all',
        text: 'All practice filter did not restore the practiced clip.',
      })
    }

    const storageCleanupSummaryReady = await page.locator('[aria-label="Storage cleanup summary"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('reviewed or private') && text.includes('can be cleared')
    }).catch(() => false)

    if (!storageCleanupSummaryReady) {
      findings.push({
        viewport: viewport.name,
        type: 'storage-cleanup-summary',
        text: 'Storage panel did not show cleanup counts for reviewed or private clips.',
      })
    }

    await page.getByRole('button', { name: 'Show space savers' }).click({ timeout: 10_000 })
    const storageFilterReady = await page.locator('[aria-label="Active video filters"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Storage') && text.includes('Reviewed and private') && text.includes('Clear')
    }).catch(() => false)

    if (!storageFilterReady) {
      findings.push({
        viewport: viewport.name,
        type: 'storage-filter-chip',
        text: 'Show space savers did not apply the visible storage filter chip.',
      })
    }

    const storageFilterLibraryReady = await page.locator('[aria-label="Video library clips"]').evaluate((section) => {
      const text = section.textContent || ''
      return text.includes('Next: practice logged') && text.includes('Practice logged')
    }).catch(() => false)

    if (!storageFilterLibraryReady) {
      findings.push({
        viewport: viewport.name,
        type: 'storage-filter-library',
        text: 'Storage space savers filter did not keep reviewed or private clips visible.',
      })
    }

    await page.locator('[aria-label="Player video library summary"]').getByRole('button', { name: 'Open feedback' }).click({ timeout: 10_000 })
    await page.getByText('Next step | Practice logged').waitFor({ state: 'visible', timeout: 10_000 })
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
    await page.locator('[aria-label="Video review steps"]').getByRole('button', { name: /Review/ }).click({ timeout: 10_000 })
    await page.locator('[aria-label="Quick video filters"]').waitFor({ state: 'visible', timeout: 10_000 })
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
