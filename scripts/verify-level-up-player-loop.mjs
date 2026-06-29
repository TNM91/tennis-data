import { chromium } from 'playwright'

const baseUrl = process.env.LEVEL_UP_BASE_URL ?? 'http://localhost:3074'
const identity = process.env.LEVEL_UP_IDENTITY ?? 'relentless-competitor-4-0'
const cardId = process.env.LEVEL_UP_CARD_ID ?? 'serve-target-call'
const cardTitle = 'Serve Target Call'
const url = `${baseUrl}/player-development/${identity}/level-up?card=${cardId}&playerloop=${Date.now()}`

const expectedBeforeStart = [
  'Finish the rep, score proof, then choose the next card.',
  'CHOOSE YOUR LANE',
  'LANE PROGRESS',
  'TODAY\'S PLAN',
]

const expectedActiveCard = [
  'ON-COURT MODE',
  'ACTIVE DRILL',
  'Serve Target Call',
  'SCORE PROOF',
  'Score now',
  'TODAY\'S PROOF GOAL',
]

const expectedAfterSave = [
  'PROOF SAVED',
  'RUN NEXT',
  'NEXT PRACTICE',
  'COACH ASK',
  'Copy coach update',
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 35_000 })
  await page.evaluate(() => localStorage.clear())
  await page.goto(url, { waitUntil: 'networkidle', timeout: 35_000 })

  const initialText = await normalizedBodyText(page)
  assertIncludes(initialText, expectedBeforeStart, 'before active card')

  const activeRegion = page.getByRole('region', { name: 'Active quick-start card' })
  await activeRegion.waitFor({ state: 'visible', timeout: 10_000 })
  if (!initialText.includes('ACTIVE DRILL')) {
    await page.locator('[data-level-up-start-action="true"]').first().click()
  }

  const activeText = await normalizedBodyText(page)
  assertIncludes(activeText, expectedActiveCard, 'active card')

  const activeBox = await activeRegion.boundingBox()
  if (!activeBox) {
    throw new Error('Active quick-start card did not have a visible bounding box.')
  }

  if (activeBox.y > 760 || activeBox.height < 300) {
    throw new Error(`Active card is not framed for mobile use. Box: ${JSON.stringify(activeBox)}`)
  }

  await page.getByRole('button', { name: /Score now/i }).first().click()
  const scoringText = await normalizedBodyText(page)
  assertIncludes(scoringText, ['Pick the number that matches the habit.', '0-1: not yet', '2-3: showing up', '4-5: repeatable'], 'scoring panel')
  await chooseRatingFour(page, activeRegion)
  await fillTinyNote(page, activeRegion, 'Target call stayed clear.')
  await page.getByRole('button', { name: /Save 4\/5(?: proof)?/i }).first().click()
  await page.getByText('Review proof details').first().click()

  const savedText = await normalizedBodyText(page)
  assertIncludes(savedText, expectedAfterSave, 'after proof save')

  const completions = await page.evaluate(() => JSON.parse(localStorage.getItem('tiq-level-up-completions') || '[]'))
  const latest = Array.isArray(completions)
    ? completions.find((completion) => completion.cardId === 'serve-target-call' && completion.proofRating === 4)
    : null

  if (!latest) {
    throw new Error(`Expected a saved 4/5 completion for ${cardId}. Saw: ${JSON.stringify(completions)}`)
  }

  console.log(JSON.stringify({
    ok: true,
    identity,
    cardId,
    url,
    verified: [
      'mobile route loaded',
      'direct card opens active mode',
      'active card stays visible on phone viewport',
      'proof rating and quick note save',
      'next-practice and coach-update copy render',
      'completion persisted to localStorage',
    ],
  }, null, 2))
} finally {
  await browser.close()
}

async function normalizedBodyText(page) {
  return (await page.locator('body').innerText({ timeout: 10_000 })).replace(/\s+/g, ' ').trim()
}

function assertIncludes(text, needles, label) {
  const missing = needles.filter((needle) => !text.includes(needle))
  if (!missing.length) return

  throw new Error(`Missing ${label} copy: ${missing.join(', ')}\nSaw:\n${text}`)
}

async function chooseRatingFour(page, activeRegion) {
  const portalRating = activeRegion
    .getByLabel(`Proof rating buttons for ${cardTitle}`)
    .getByRole('button', { name: /^4\b/ })

  if (await portalRating.count()) {
    await portalRating.first().click()
    return
  }

  await page
    .getByLabel('Rate this work from 0 to 5')
    .getByRole('button', { name: /^4$/ })
    .click()
}

async function fillTinyNote(page, activeRegion, note) {
  const portalNote = activeRegion.getByLabel(`Note for ${cardTitle}`)
  if (await portalNote.count()) {
    const noteDrawer = activeRegion.getByText('Add tiny note')
    if (await noteDrawer.count()) {
      await noteDrawer.first().click()
    }

    await portalNote.first().fill(note)
    return
  }

  await page.getByLabel('Tiny tracking note').fill(note)
}
