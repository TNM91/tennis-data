import {test, expect, type Page} from '@playwright/test'
import {build} from 'esbuild'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
const origin = 'http://127.0.0.1:4285', owner = '11111111-1111-4111-8111-111111111111'
let javascript = '', stylesheet = '', shell = ''
test.describe.configure({retries: 0, timeout: 40000})
test.beforeAll(async () => {
  const bundle = await build({entryPoints: ['tests/fixtures/mobile-navigation.ts'], bundle: true, platform: 'browser', format: 'esm', outfile: 'fixture.js', write: false,
    jsx: 'automatic', define: {TIQ_FIRST_PARTY_BUILD: 'true'}, loader: {'.module.css': 'local-css'},
    alias: {'next/image': path.resolve('mobile/src/native-website-image.tsx'), 'next/link': path.resolve('mobile/src/native-website-link.tsx')},
    plugins: [{name: 'synthetic-player-progress', setup(builder) {
      builder.onResolve({filter: /^@capacitor\/app$/}, () => ({path: path.resolve('tests/fixtures/mobile-navigation-app.ts')}))
      builder.onResolve({filter: /^@supabase\/supabase-js$/}, () => ({path: path.resolve('tests/fixtures/mobile-navigation-client.ts')}))
    }}]})
  javascript = bundle.outputFiles.find(file => file.path.endsWith('.js'))!.text
  stylesheet = (await Promise.all(['style.css', 'website-ui.css', 'app.css', 'website-parity.css', 'app-atmosphere.css', 'premium-surfaces.css']
    .map(file => file === 'app.css' ? Promise.resolve(bundle.outputFiles.find(output => output.path.endsWith('.css'))!.text) : readFile('mobile/bundled/' + file, 'utf8')))).join('\n')
  shell = await readFile('mobile/bundled/index.html', 'utf8')
})
test.beforeEach(async ({page}) => {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) return route.abort()
    if (url.pathname === '/app.js') return route.fulfill({contentType: 'text/javascript', body: javascript})
    if (url.pathname.endsWith('.css')) return route.fulfill({contentType: 'text/css', body: url.pathname === '/style.css' ? stylesheet + (url.searchParams.has('large') ? '\n:root{font-size:22px!important}' : '') : ''})
    if (url.pathname.startsWith('/brand/') || url.pathname === '/logo.png') return route.fulfill({contentType: 'image/png', body: await readFile('mobile/bundled' + url.pathname)})
    return route.fulfill({contentType: 'text/html', body: url.searchParams.has('large') ? shell.replace('./style.css', './style.css?large=1') : shell})
  })
})
async function seed(page: Page) {
  await page.addInitScript(owner => localStorage.setItem('starter-tiq:v2:' + owner, JSON.stringify({
    current: {date: '2026-11-19', answers: {serve: 2, return: 2, rally: 2, movement: 2, net: 2, points: 2}},
    previous: {date: '2026-11-01', answers: {serve: 1, return: 1, rally: 1, movement: 1, net: 1, points: 1}},
  })), owner)
}
async function open(page: Page, query = '') {
  await page.goto(origin + '/?unlinked=1&player-progress=1&training-inbox-review=1' + query)
  await page.getByRole('button', {name: 'Your progress', exact: true}).click()
  const dialog = page.getByRole('dialog', {name: 'Your progress', exact: true})
  await expect(dialog.getByRole('button', {name: 'Refresh progress', exact: true})).toBeEnabled()
  return dialog
}
const savedSelf = (page: Page) => page.evaluate(owner => localStorage.getItem('starter-tiq:v2:' + owner), owner)
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  for (const element of await page.locator('dialog[open]').all()) expect(await element.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
}
for (const width of [320, 390]) test('compares labeled self and coach observations, keeps contexts separate, and uses navy surfaces at ' + width + 'px', async ({page}, info) => {
  await page.setViewportSize({width, height: 844}); await seed(page)
  const dialog = await open(page, '&assessment-history=cap&training-history-review=1' + (width === 320 ? '&large=1' : ''))
  await page.screenshot({path: info.outputPath('progress-overview.png'), scale: 'css'})
  const self = dialog.getByRole('region', {name: 'Self-assessment', exact: true})
  await expect(self).toContainText('7 / 10'); await expect(self).toContainText('Previously 4 / 10')
  const context = dialog.getByLabel('Court context', {exact: true})
  await context.selectOption('drill'); await expect(context).toBeFocused()
  await expect(context).toHaveCSS('background-color', 'rgb(9, 26, 51)')
  const skills = dialog.getByRole('list', {name: 'Your answers and coach observations'})
  await expect(skills.locator('li').filter({hasText: /^Net play/})).toContainText('Coach observedNot observed')
  const changes = dialog.locator('.player-progress-changes')
  await changes.locator('summary').click()
  await expect(changes.locator('[data-progress-change=higher]')).toContainText('Serve')
  await expect(changes.locator('[data-progress-change=lower]')).toContainText('Movement')
  await expect(changes.locator('[data-progress-change=unobserved]')).toContainText('Net play')
  await expect(changes).toContainText('Different coaches and playing conditions')
  await expect(dialog).toContainText('Latest 12 shared')
  const reads = await page.evaluate(() => (window as unknown as {coachAssessmentHistoryFixture: {reads: number}}).coachAssessmentHistoryFixture.reads)
  await context.selectOption('lesson'); await context.selectOption('drill')
  expect(await page.evaluate(() => (window as unknown as {coachAssessmentHistoryFixture: {reads: number}}).coachAssessmentHistoryFixture.reads)).toBe(reads)
  await fits(page); await dialog.screenshot({path: info.outputPath('your-progress-full.png')})
  await dialog.getByRole('region', {name: 'Practice next', exact: true}).scrollIntoViewIfNeeded()
  await page.screenshot({path: info.outputPath('practice-next.png'), scale: 'css'})
  await dialog.getByRole('button', {name: 'Close your progress'}).click()
  await expect(page.getByRole('button', {name: 'Your progress', exact: true})).toBeFocused()
})
test('saves a private practice session, updates consistency on return, and leaves the self-rating unchanged', async ({page}) => {
  await seed(page); const dialog = await open(page, '&assessment-history=1')
  await dialog.getByLabel('Court context').selectOption('drill')
  const before = await savedSelf(page)
  await dialog.getByRole('button', {name: 'Preview practice drill'}).click()
  const training = page.getByRole('dialog', {name: 'Level Up training', exact: true})
  await expect(training.getByRole('heading', {name: 'Serve Target Call', exact: true})).toBeVisible()
  await training.getByRole('button', {name: 'Start training', exact: true}).click()
  await training.getByRole('combobox', {name: 'Self-rated proof (0–5)', exact: true}).selectOption('4')
  await training.getByRole('button', {name: 'Save completed session', exact: true}).click()
  await training.getByRole('button', {name: 'Close Level Up', exact: true}).click()
  await expect(dialog.getByRole('button', {name: 'Preview practice drill'})).toBeFocused()
  const practice = dialog.getByRole('region', {name: 'Saved practice', exact: true})
  await expect(practice.locator('.player-progress-totals')).toContainText('Sessions1')
  await expect(practice.locator('.player-progress-totals')).toContainText('Practice days1 / 7')
  expect(await savedSelf(page)).toBe(before)
  await expect(dialog.getByLabel('Court context')).toHaveValue('drill')
  await expect(dialog.getByRole('region', {name: 'Self-assessment'})).toContainText('7 / 10')
})
test('opens the exact coach assignment and sends its check-in without raising TiQ', async ({page}) => {
  await seed(page); const dialog = await open(page, '&assessment-history=1&progress-assigned=1')
  await dialog.getByLabel('Court context').selectOption('drill')
  const before = await savedSelf(page)
  await dialog.getByRole('button', {name: 'Open coach practice', exact: true}).click()
  const training = page.getByRole('dialog', {name: 'Level Up training', exact: true})
  const assignment = training.locator('.training-assignment-next')
  await expect(assignment.getByRole('heading', {name: 'Serve Target Call', exact: true})).toBeVisible()
  await assignment.getByRole('button', {name: /Open check-in/}).click()
  const checkin = page.getByRole('dialog', {name: 'Coach assignment check-in'})
  await checkin.getByLabel('Your recap', {exact: true}).fill('Eight of ten second serves landed in.')
  await checkin.getByRole('button', {name: 'Review check-in', exact: true}).click()
  await checkin.getByRole('button', {name: 'Send check-in', exact: true}).click()
  await expect(checkin).toHaveCount(0)
  await training.getByRole('button', {name: 'Close Level Up', exact: true}).click()
  await expect(dialog.getByRole('region', {name: 'Practice next', exact: true})).toContainText('saved check-in')
  await expect(dialog.getByLabel('Court context')).toHaveValue('drill')
  expect(await savedSelf(page)).toBe(before)
})
test('clears revoked observations on refresh while keeping local ratings and retryable practice failures separate', async ({page}) => {
  await seed(page); const dialog = await open(page, '&assessment-history=1&training-history-review=1')
  await dialog.getByLabel('Court context').selectOption('drill')
  await page.evaluate(() => (window as unknown as {coachAssessmentHistoryFixture: {failed: boolean}}).coachAssessmentHistoryFixture.failed = true)
  await dialog.getByRole('button', {name: 'Refresh progress', exact: true}).click()
  await expect(dialog.getByRole('button', {name: 'Refresh progress', exact: true})).toBeEnabled()
  await expect(dialog.getByRole('button', {name: 'Refresh progress', exact: true})).toBeFocused()
  await expect(dialog.getByRole('region', {name: 'Coach observations', exact: true})).toContainText('couldn’t load')
  await expect(dialog).not.toContainText('Saved court observation')
  await expect(dialog.getByRole('button', {name: 'Retry saved practice', exact: true})).toBeVisible()
  await expect(dialog.getByRole('region', {name: 'Self-assessment'})).toContainText('7 / 10')
  await dialog.getByRole('button', {name: 'Retry saved practice', exact: true}).click()
  await expect(dialog.getByRole('region', {name: 'Saved practice'}).locator('.player-progress-totals')).toContainText('Sessions2')
  await page.evaluate(() => (window as unknown as {coachAssessmentHistoryFixture: {failed: boolean}}).coachAssessmentHistoryFixture.failed = false)
  await dialog.getByRole('button', {name: 'Retry coach observations', exact: true}).click()
  await expect(dialog.getByLabel('Court context')).toHaveValue('drill')
})
test('clears the progress view and an unfinished nested practice when the account changes', async ({page}) => {
  await seed(page); const dialog = await open(page, '&assessment-history=1')
  await dialog.getByRole('button', {name: 'Preview practice drill'}).click()
  const training = page.getByRole('dialog', {name: 'Level Up training', exact: true})
  await training.getByRole('button', {name: 'Start training', exact: true}).click()
  await training.getByLabel('Your training note', {exact: true}).fill('Private serve cue')
  await page.evaluate(() => {
    const controls = window as unknown as {refreshNavigationSession: () => void}
    controls.refreshNavigationSession(); document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(training.getByLabel('Your training note', {exact: true})).toHaveValue('Private serve cue')
  await page.evaluate(() => (window as unknown as {switchNavigationOwner: () => void}).switchNavigationOwner())
  await expect(dialog).toHaveCount(0); await expect(training).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Private serve cue')
  await page.getByRole('button', {name: 'Your progress', exact: true}).click()
  await expect(page.getByRole('dialog', {name: 'Your progress'}).getByRole('region', {name: 'Self-assessment'})).toContainText('Find your starting point')
})
test('welcomes a free player without a rating or coach and starts the assessment from progress', async ({page}) => {
  const dialog = await open(page, '&free-training=1')
  await expect(dialog).toContainText('Find your starting point')
  await expect(dialog).toContainText('No shared coach observations yet')
  await expect(dialog.getByRole('region', {name: 'Saved practice'})).toContainText('No saved sessions yet')
  await dialog.getByRole('button', {name: 'Start self-assessment', exact: true}).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', {name: 'Serve, return & rally', exact: true})).toBeFocused()
})
