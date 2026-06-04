import { chromium } from 'playwright'

const baseUrl = process.env.LEVEL_UP_BASE_URL ?? 'http://localhost:3058'
const identity = process.env.LEVEL_UP_IDENTITY ?? 'pressure-closer-4-0'
const url = `${baseUrl}/player-development/${identity}/level-up?coachnextverify=${Date.now()}`

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })

  const initialText = await page.locator('body').innerText()
  if (
    !initialText.includes('COACH ASSIGNMENT BUILDER')
    || !initialText.includes('PATH COACH')
    || !initialText.includes('Start with one proof.')
    || !initialText.includes('HABIT MOMENTUM')
    || (!initialText.includes('Start momentum') && !initialText.includes('START MOMENTUM'))
    || !initialText.includes('CHALLENGE')
    || !initialText.includes('WHY')
    || !initialText.includes('PROOF')
  ) {
    throw new Error(`Expected coach builder and challenge plan before active drill. Saw:\n${initialText}`)
  }

  await page.getByText('COACH ASSIGNMENT BUILDER').click()
  const builderText = await page.locator('body').innerText()
  if (!builderText.includes('COACH TEMPLATES') || !builderText.includes('Return pressure block')) {
    throw new Error(`Expected coach assignment templates after opening builder. Saw:\n${builderText}`)
  }
  await page.getByRole('button', { name: /Return pressure block/i }).click()
  const templateText = await page.locator('body').innerText()
  if (
    !templateText.includes('PLAYER WILL SEE')
    || !templateText.includes('Return 30-30 Game')
    || !templateText.includes('Start at 30-30. Pick the return job before the toss and recover for ball two.')
  ) {
    throw new Error(`Expected coach template to prefill the assignment preview. Saw:\n${templateText}`)
  }

  const inbox = page.getByRole('region', { name: 'Coach challenge inbox' })
  await inbox.getByRole('button', { name: /Start next/i }).click()

  await page.locator('[data-level-up-start-action="true"]').first().click()
  await page.getByRole('button', { name: /Score now/i }).first().click()
  await page.getByRole('button', { name: /^4$/ }).first().click()
  await page.getByRole('button', { name: /Save 4\/5 proof/i }).first().click()

  const coachNext = page.locator('[aria-label^="Coach recommended next for"]').first()
  await coachNext.waitFor({ state: 'visible', timeout: 10_000 })

  const panelText = await coachNext.innerText()
  const bodyText = await page.locator('body').innerText()
  const hasCoachSendAction =
    panelText.includes('SEND')
    && panelText.includes('ASK')
    && panelText.includes('THEN')
    && panelText.includes('Copy coach update')
  const hasCoachRecipeAction =
    panelText.includes('SETUP')
    && panelText.includes('SCORE')
    && panelText.includes('STOP')
    && (
      panelText.includes('Add pressure')
      || panelText.includes('Repeat cleaner')
      || panelText.includes('Scale down')
    )

  if (
    !panelText.includes('COACH RECOMMENDED NEXT')
    || (!hasCoachSendAction && !hasCoachRecipeAction)
  ) {
    throw new Error(`Expected coach next recommendation. Saw:\n${panelText}`)
  }

  if (
    !bodyText.includes('RUN NEXT')
    || !bodyText.includes('NEXT PRACTICE')
    || !bodyText.includes('DOSE')
    || !bodyText.includes('FOCUS')
    || !bodyText.includes('COACH ASK')
    || !(
      bodyText.includes('Start next card')
      || bodyText.includes('Add pressure here')
      || bodyText.includes('Repeat this card')
      || bodyText.includes('Scale this card')
    )
  ) {
    throw new Error(`Expected post-proof next card handoff. Saw:\n${bodyText}`)
  }

  await page.getByRole('button', { name: /Exit/i }).first().click()
  await page.locator('button').filter({ hasText: /^Ready/ }).first().click()
  const collapsedText = await page.locator('body').innerText()
  if (!collapsedText.includes('Assign suggested next')) {
    throw new Error(`Expected coach feedback suggested assignment after collapse. Saw:\n${collapsedText}`)
  }
  await page.getByRole('button', { name: /Assign suggested next/i }).first().click()
  const assignedText = await page.locator('body').innerText()
  if (
    !assignedText.includes('SUGGESTED CHALLENGE ASSIGNED')
    || !assignedText.includes('Suggested assigned')
    || !assignedText.includes('Start suggested challenge')
    || !assignedText.includes('TO DO\n1')
  ) {
    throw new Error(`Expected suggested assignment confirmation. Saw:\n${assignedText}`)
  }
  await page.getByRole('button', { name: /Start suggested challenge/i }).first().click()
  const startedSuggestedText = await page.locator('body').innerText()
  if (
    !startedSuggestedText.includes('ON-COURT MODE')
    || !startedSuggestedText.includes('Return 30-30 Game')
    || !startedSuggestedText.includes('ACTIVE DRILL')
    || !startedSuggestedText.includes('Start')
    || !startedSuggestedText.includes('+1')
    || !startedSuggestedText.includes('Exit')
  ) {
    throw new Error(`Expected suggested assignment to open on-court mode. Saw:\n${startedSuggestedText}`)
  }

  console.log(JSON.stringify({
    ok: true,
    identity,
    url,
    panelText,
  }, null, 2))
} finally {
  await browser.close()
}
